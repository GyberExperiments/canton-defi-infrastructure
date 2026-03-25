/**
 * 🚀 Async I/O Service
 * Система для устранения блокирующих операций ввода/вывода:
 * - Асинхронные операции с файловой системой
 * - Queue-based обработка запросов
 * - Connection pooling для внешних API
 * - Batch processing для множественных операций
 * - Caching layer для часто используемых данных
 * - Circuit breaker для внешних сервисов
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { FSWatcher } from 'fs';
// promisify не используется в текущей реализации
import { UnifiedCacheService } from '../services/unifiedCache';

// ============================================================================
// QUEUE SYSTEM FOR NON-BLOCKING OPERATIONS
// ============================================================================

interface QueueTask<T = unknown> {
  id: string;
  operation: () => Promise<T>;
  priority: 'low' | 'medium' | 'high' | 'critical';
  retries: number;
  maxRetries: number;
  timeout?: number;
  onSuccess?: (result: T) => void;
  onError?: (error: Error) => void;
  onProgress?: (progress: number) => void;
  metadata?: Record<string, unknown>;
}

interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  totalProcessingTime: number;
  averageProcessingTime: number;
}

export class AsyncQueue extends EventEmitter {
  private static instance: AsyncQueue;
  private queue: QueueTask[] = [];
  private processing = new Set<string>();
  private concurrencyLimit = 10;
  private stats: QueueStats = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    totalProcessingTime: 0,
    averageProcessingTime: 0
  };

  static getInstance(): AsyncQueue {
    if (!AsyncQueue.instance) {
      AsyncQueue.instance = new AsyncQueue();
    }
    return AsyncQueue.instance;
  }

  /**
   * Добавление задачи в очередь
   */
  async enqueue<T>(
    operation: () => Promise<T>,
    options: {
      priority?: QueueTask['priority'];
      maxRetries?: number;
      timeout?: number;
      id?: string;
      onSuccess?: (result: T) => void;
      onError?: (error: Error) => void;
      onProgress?: (progress: number) => void;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<T> {
    const task: QueueTask<T> = {
      id: options.id || this.generateTaskId(),
      operation,
      priority: options.priority || 'medium',
      retries: 0,
      maxRetries: options.maxRetries || 3,
      timeout: options.timeout,
      onSuccess: options.onSuccess,
      onError: options.onError,
      onProgress: options.onProgress,
      metadata: options.metadata
    };

    return new Promise((resolve, reject) => {
      // Обёртка для resolve/reject
      task.onSuccess = (result: T) => {
        options.onSuccess?.(result);
        resolve(result);
      };

      task.onError = (error: Error) => {
        options.onError?.(error);
        reject(error);
      };

      this.addToQueue(task);
      this.processQueue();
    });
  }

  private addToQueue<T = unknown>(task: QueueTask<T>): void {
    // Сортировка по приоритету
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    
    const insertIndex = this.queue.findIndex(
      queuedTask => priorityOrder[queuedTask.priority] > priorityOrder[task.priority]
    );

    if (insertIndex === -1) {
      this.queue.push(task as QueueTask);
    } else {
      this.queue.splice(insertIndex, 0, task as QueueTask);
    }

    this.stats.pending = this.queue.length;
    this.emit('taskQueued', task);
  }

  private async processQueue(): Promise<void> {
    while (this.queue.length > 0 && this.processing.size < this.concurrencyLimit) {
      const task = this.queue.shift()!;
      this.processing.add(task.id);
      
      this.stats.pending = this.queue.length;
      this.stats.processing = this.processing.size;

      // Обработка задачи в фоне
      this.processTask(task).finally(() => {
        this.processing.delete(task.id);
        this.stats.processing = this.processing.size;
      });
    }
  }

  private async processTask<T>(task: QueueTask<T>): Promise<void> {
    const startTime = Date.now();

    try {
      this.emit('taskStarted', task);
      
      // Применение timeout если указан
      const result = task.timeout 
        ? await this.withTimeout(task.operation(), task.timeout)
        : await task.operation();

      const processingTime = Date.now() - startTime;
      this.updateStats('completed', processingTime);

      task.onSuccess?.(result);
      this.emit('taskCompleted', { task, result, processingTime });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Retry логика
      if (task.retries < task.maxRetries) {
        task.retries++;
        console.warn(`Retrying task ${task.id} (attempt ${task.retries}/${task.maxRetries}):`, error);
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, task.retries - 1), 30000);
        setTimeout(() => {
          this.addToQueue(task);
          this.processQueue();
        }, delay);
        
        return;
      }

      this.updateStats('failed', processingTime);
      task.onError?.(error instanceof Error ? error : new Error(String(error)));
      this.emit('taskFailed', { task, error, processingTime });
    }
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    );

    return Promise.race([promise, timeoutPromise]);
  }

  private updateStats(type: 'completed' | 'failed', processingTime: number): void {
    this.stats[type]++;
    this.stats.totalProcessingTime += processingTime;
    
    const totalTasks = this.stats.completed + this.stats.failed;
    this.stats.averageProcessingTime = totalTasks > 0 
      ? this.stats.totalProcessingTime / totalTasks 
      : 0;
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getStats(): QueueStats {
    return { ...this.stats };
  }

  setConcurrencyLimit(limit: number): void {
    this.concurrencyLimit = Math.max(1, limit);
    this.processQueue(); // Обработать больше задач если лимит увеличен
  }
}

// ============================================================================
// FILE SYSTEM OPERATIONS
// ============================================================================

export class AsyncFileSystem {
  private static instance: AsyncFileSystem;
  private queue: AsyncQueue;
  private cache: UnifiedCacheService;

  constructor() {
    this.queue = AsyncQueue.getInstance();
    this.cache = UnifiedCacheService.getInstance();
  }

  static getInstance(): AsyncFileSystem {
    if (!AsyncFileSystem.instance) {
      AsyncFileSystem.instance = new AsyncFileSystem();
    }
    return AsyncFileSystem.instance;
  }

  /**
   * Асинхронное чтение файла с кешированием
   */
  async readFile(
    filePath: string, 
    options: {
      encoding?: BufferEncoding;
      cache?: boolean;
      cacheTTL?: number;
      priority?: QueueTask['priority'];
    } = {}
  ): Promise<string | Buffer> {
    const { 
      encoding = 'utf8', 
      cache = true, 
      cacheTTL = 5 * 60, // 5 minutes
      priority = 'medium' 
    } = options;

    const cacheKey = `file:${filePath}:${encoding}`;

    // Проверяем кеш
    if (cache) {
      const cached = await this.cache.get(cacheKey);
      if (cached !== null) {
        return cached as string | Buffer;
      }
    }

    // Читаем файл асинхронно
    const result = await this.queue.enqueue(
      async () => {
        const stats = await fs.stat(filePath);
        if (!stats.isFile()) {
          throw new Error(`Path is not a file: ${filePath}`);
        }

        return await fs.readFile(filePath, encoding);
      },
      {
        priority,
        id: `read_file_${filePath}`,
        metadata: { filePath, encoding }
      }
    );

    // Сохраняем в кеш
    if (cache) {
      await this.cache.set(cacheKey, result, { ttl: cacheTTL });
    }

    return result;
  }

  /**
   * Асинхронная запись файла с батчингом
   */
  async writeFile(
    filePath: string,
    data: string | Buffer,
    options: {
      encoding?: BufferEncoding;
      createDirs?: boolean;
      backup?: boolean;
      priority?: QueueTask['priority'];
    } = {}
  ): Promise<void> {
    const { 
      encoding = 'utf8',
      createDirs = true,
      backup = false,
      priority = 'high'
    } = options;

    await this.queue.enqueue(
      async () => {
        // Создаём директории если нужно
        if (createDirs) {
          const dir = path.dirname(filePath);
          await fs.mkdir(dir, { recursive: true });
        }

        // Создаём backup если нужно
        if (backup) {
          try {
            await fs.access(filePath);
            const backupPath = `${filePath}.backup.${Date.now()}`;
            await fs.copyFile(filePath, backupPath);
          } catch {
            // Файл не существует - backup не нужен
          }
        }

        // Записываем файл
        await fs.writeFile(filePath, data, encoding);

        // Инвалидируем кеш
        const cacheKey = `file:${filePath}:${encoding}`;
        await this.cache.delete(cacheKey);
      },
      {
        priority,
        id: `write_file_${filePath}`,
        metadata: { filePath, size: Buffer.byteLength(data, encoding) }
      }
    );
  }

  /**
   * Батчевая обработка файлов
   */
  async processBatch<T>(
    files: string[],
    processor: (filePath: string, content: string | Buffer) => Promise<T>,
    options: {
      batchSize?: number;
      encoding?: BufferEncoding;
      priority?: QueueTask['priority'];
      onProgress?: (processed: number, total: number) => void;
    } = {}
  ): Promise<T[]> {
    const { 
      batchSize = 10, 
      encoding = 'utf8',
      priority = 'medium',
      onProgress 
    } = options;

    const results: T[] = [];
    let processed = 0;

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (filePath) => {
        const content = await this.readFile(filePath, { encoding, priority });
        const result = await processor(filePath, content);
        
        processed++;
        onProgress?.(processed, files.length);
        
        return result;
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Наблюдение за изменениями файлов
   */
  watchFile(
    filePath: string,
    callback: (event: 'change' | 'rename', filename: string | null) => void,
    options: {
      persistent?: boolean;
      recursive?: boolean;
      encoding?: BufferEncoding;
    } = {}
  ): () => void {
    // FSWatcher type from 'fs' module
    let watcher: FSWatcher | null = null;

    this.queue.enqueue(
      async () => {
        // В Node.js fs.watch возвращает FSWatcher
        const { watch: fsWatch } = await import('fs');
        watcher = fsWatch(filePath, options, callback);
      },
      {
        priority: 'low',
        id: `watch_file_${filePath}`
      }
    );

    // Возвращаем функцию для остановки наблюдения
    return () => {
      if (watcher && typeof watcher === 'object' && 'close' in watcher) {
        watcher.close();
      }
    };
  }
}

// ============================================================================
// HTTP CLIENT WITH CONNECTION POOLING
// ============================================================================

interface HTTPClientOptions {
  maxConcurrentRequests?: number;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  keepAlive?: boolean;
  maxRedirects?: number;
}

interface CircuitBreakerOptions {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
}

class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(private options: CircuitBreakerOptions) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      const now = Date.now();
      if (now - this.lastFailureTime >= this.options.recoveryTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      
      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failures = 0;
      }
      
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();
      
      if (this.failures >= this.options.failureThreshold) {
        this.state = 'open';
      }
      
      throw error;
    }
  }

  getState(): { state: string; failures: number; lastFailureTime: number } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}

export class AsyncHTTPClient {
  private static instance: AsyncHTTPClient;
  private queue: AsyncQueue;
  private cache: UnifiedCacheService;
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private options: Required<HTTPClientOptions>;

  constructor(options: HTTPClientOptions = {}) {
    this.options = {
      maxConcurrentRequests: 50,
      timeout: 10000,
      retries: 3,
      retryDelay: 1000,
      keepAlive: true,
      maxRedirects: 5,
      ...options
    };
    
    this.queue = AsyncQueue.getInstance();
    this.cache = UnifiedCacheService.getInstance();
    
    // Настройка concurrency для HTTP запросов
    this.queue.setConcurrencyLimit(this.options.maxConcurrentRequests);
  }

  static getInstance(options?: HTTPClientOptions): AsyncHTTPClient {
    if (!AsyncHTTPClient.instance) {
      AsyncHTTPClient.instance = new AsyncHTTPClient(options);
    }
    return AsyncHTTPClient.instance;
  }

  /**
   * GET запрос с кешированием и circuit breaker
   */
  async get<T = unknown>(
    url: string,
    options: {
      headers?: Record<string, string>;
      cache?: boolean;
      cacheTTL?: number;
      priority?: QueueTask['priority'];
      circuitBreaker?: CircuitBreakerOptions;
    } = {}
  ): Promise<T> {
    const { 
      headers = {}, 
      cache = true, 
      cacheTTL = 5 * 60,
      priority = 'medium',
      circuitBreaker
    } = options;

    const cacheKey = `http:get:${url}:${JSON.stringify(headers)}`;

    // Проверяем кеш
    if (cache) {
      const cached = await this.cache.get<T>(cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    // Circuit breaker
    let breaker: CircuitBreaker | undefined;
    if (circuitBreaker) {
      const hostname = new URL(url).hostname;
      if (!this.circuitBreakers.has(hostname)) {
        this.circuitBreakers.set(hostname, new CircuitBreaker(circuitBreaker));
      }
      breaker = this.circuitBreakers.get(hostname);
    }

    const operation = async (): Promise<T> => {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        signal: AbortSignal.timeout(this.options.timeout)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    };

    // Выполняем запрос через очередь и circuit breaker
    const result = await this.queue.enqueue(
      breaker ? () => breaker!.execute(operation) : operation,
      {
        priority,
        maxRetries: this.options.retries,
        timeout: this.options.timeout,
        id: `http_get_${url}`,
        metadata: { url, method: 'GET' }
      }
    );

    // Сохраняем в кеш
    if (cache) {
      await this.cache.set(cacheKey, result, { ttl: cacheTTL });
    }

    return result;
  }

  /**
   * POST запрос с retry логикой
   */
  async post<T = unknown>(
    url: string,
    data: unknown,
    options: {
      headers?: Record<string, string>;
      priority?: QueueTask['priority'];
      circuitBreaker?: CircuitBreakerOptions;
    } = {}
  ): Promise<T> {
    const { 
      headers = {}, 
      priority = 'high',
      circuitBreaker 
    } = options;

    // Circuit breaker
    let breaker: CircuitBreaker | undefined;
    if (circuitBreaker) {
      const hostname = new URL(url).hostname;
      if (!this.circuitBreakers.has(hostname)) {
        this.circuitBreakers.set(hostname, new CircuitBreaker(circuitBreaker));
      }
      breaker = this.circuitBreakers.get(hostname);
    }

    const operation = async (): Promise<T> => {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(this.options.timeout)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    };

    return await this.queue.enqueue(
      breaker ? () => breaker!.execute(operation) : operation,
      {
        priority,
        maxRetries: this.options.retries,
        timeout: this.options.timeout,
        id: `http_post_${url}`,
        metadata: { url, method: 'POST', dataSize: JSON.stringify(data).length }
      }
    );
  }

  /**
   * Параллельные запросы с ограничением concurrency
   */
  async batchRequests<T>(
    requests: Array<{ url: string; options?: Record<string, unknown> }>,
    options: {
      batchSize?: number;
      priority?: QueueTask['priority'];
      onProgress?: (completed: number, total: number) => void;
    } = {}
  ): Promise<T[]> {
    const { 
      batchSize = 10, 
      priority = 'medium',
      onProgress 
    } = options;

    const results: T[] = [];
    let completed = 0;

    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async ({ url, options: reqOptions }) => {
        const result = await this.get<T>(url, { ...reqOptions, priority });
        completed++;
        onProgress?.(completed, requests.length);
        return result;
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  getCircuitBreakerStats(): Record<string, unknown> {
    const stats: Record<string, unknown> = {};
    
    for (const [hostname, breaker] of this.circuitBreakers.entries()) {
      stats[hostname] = breaker.getState();
    }
    
    return stats;
  }
}

// ============================================================================
// EXPORTS AND SINGLETONS
// ============================================================================

export const asyncQueue = AsyncQueue.getInstance();
export const asyncFileSystem = AsyncFileSystem.getInstance();
export const asyncHTTPClient = AsyncHTTPClient.getInstance({
  maxConcurrentRequests: 50,
  timeout: 30000,
  retries: 3,
  keepAlive: true
});

// Utility функции для быстрого использования
export const nonBlockingFS = {
  readFile: asyncFileSystem.readFile.bind(asyncFileSystem),
  writeFile: asyncFileSystem.writeFile.bind(asyncFileSystem),
  processBatch: asyncFileSystem.processBatch.bind(asyncFileSystem),
  watchFile: asyncFileSystem.watchFile.bind(asyncFileSystem)
};

export const nonBlockingHTTP = {
  get: asyncHTTPClient.get.bind(asyncHTTPClient),
  post: asyncHTTPClient.post.bind(asyncHTTPClient),
  batchRequests: asyncHTTPClient.batchRequests.bind(asyncHTTPClient)
};
