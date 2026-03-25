/**
 * 🚀 Unified Cache Service
 * Единый сервис кеширования с поддержкой многоуровневого хранения
 * L1: In-memory LRU cache
 * L2: Redis distributed cache
 * Features: Compression, TTL, Namespaces, Metrics
 */

import { Redis } from 'ioredis';
import { LRUCache } from 'lru-cache';
import { EventEmitter } from 'events';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export interface CacheConfig {
  ttl?: number;                    // Time to live в секундах
  namespace?: string;              // Namespace для изоляции
  fallbackToMemory?: boolean;      // Использовать память при недоступности Redis
  compressionThreshold?: number;   // Порог для сжатия (байты)
  priority?: 'low' | 'medium' | 'high'; // Приоритет кеширования
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  compressions: number;
  decompressions: number;
  errors: number;
  memoryUsage: number;
  itemCount: number;
}

interface CacheItem<T> {
  value: T;
  compressed: boolean;
  timestamp: number;
  hits: number;
}

export class UnifiedCacheService {
  private static instance: UnifiedCacheService;
  private redis: Redis | null = null;
  private memoryCache: LRUCache<string, CacheItem<unknown>>;
  private stats: Map<string, CacheStats> = new Map();
  private eventEmitter = new EventEmitter();
  private isRedisConnected = false;

  // Конфигурация
  private readonly DEFAULT_TTL = 3600; // 1 час
  private readonly DEFAULT_COMPRESSION_THRESHOLD = 1024; // 1KB
  private readonly MAX_MEMORY_MB = parseInt(process.env.CACHE_MEMORY_MB || '200');
  private readonly NAMESPACE_SEPARATOR = ':';

  private constructor() {
    // Инициализация LRU кеша
    this.memoryCache = new LRUCache({
      max: 10000, // Максимум элементов
      maxSize: this.MAX_MEMORY_MB * 1024 * 1024, // Максимум памяти
      sizeCalculation: (item: CacheItem<unknown>) => {
        if (item.compressed && Buffer.isBuffer(item.value)) {
          return item.value.length;
        }
        return JSON.stringify(item.value).length;
      },
      ttl: this.DEFAULT_TTL * 1000, // Миллисекунды
      updateAgeOnGet: true,
      updateAgeOnHas: true,
      dispose: (value: unknown, key: string) => {
        // Вызывается при удалении из кеша
        this.incrementStat('default', 'evictions');
        this.eventEmitter.emit('eviction', { key, reason: 'lru' });
      }
    });

    // Инициализация Redis
    this.initializeRedis();

    // Периодическая очистка и сбор статистики
    this.startMaintenanceTasks();

    console.log('🚀 UnifiedCacheService initialized:', {
      maxMemoryMB: this.MAX_MEMORY_MB,
      defaultTTL: this.DEFAULT_TTL,
      compressionThreshold: this.DEFAULT_COMPRESSION_THRESHOLD
    });
  }

  /**
   * Получить единственный экземпляр сервиса
   */
  public static getInstance(): UnifiedCacheService {
    if (!UnifiedCacheService.instance) {
      UnifiedCacheService.instance = new UnifiedCacheService();
    }
    return UnifiedCacheService.instance;
  }

  /**
   * Инициализация Redis подключения
   */
  private async initializeRedis(): Promise<void> {
    try {
      const redisUrl = process.env.CACHE_REDIS_URL || process.env.REDIS_URL;
      
      if (!redisUrl) {
        console.warn('⚠️ Redis URL not configured, using memory-only mode');
        return;
      }

      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        connectTimeout: 10000,
        commandTimeout: 5000,
        enableOfflineQueue: true,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        }
      });

      // Обработчики событий
      this.redis.on('connect', () => {
        this.isRedisConnected = true;
        console.log('✅ UnifiedCache Redis connected');
        this.eventEmitter.emit('redis:connected');
      });

      this.redis.on('error', (error) => {
        console.error('❌ UnifiedCache Redis error:', error);
        this.isRedisConnected = false;
        this.incrementStat('default', 'errors');
        this.eventEmitter.emit('redis:error', error);
      });

      this.redis.on('close', () => {
        this.isRedisConnected = false;
        console.log('🔌 UnifiedCache Redis disconnected');
        this.eventEmitter.emit('redis:disconnected');
      });

      // Тестовое подключение
      await this.redis.ping();
      this.isRedisConnected = true;

    } catch (error) {
      console.error('❌ Failed to initialize Redis for UnifiedCache:', error);
      this.isRedisConnected = false;
    }
  }

  /**
   * Получить значение из кеша
   */
  async get<T>(key: string, config: CacheConfig = {}): Promise<T | null> {
    try {
      const fullKey = this.buildKey(key, config.namespace);
      const namespace = config.namespace || 'default';

      // L1: Memory cache
      const memoryItem = this.memoryCache.get(fullKey);
      if (memoryItem) {
        this.incrementStat(namespace, 'hits');
        memoryItem.hits++;
        
        // Декомпрессия если нужно
        if (memoryItem.compressed && Buffer.isBuffer(memoryItem.value)) {
          const decompressed = await this.decompress(memoryItem.value);
          this.incrementStat(namespace, 'decompressions');
          return decompressed as T;
        }
        
        return memoryItem.value as T;
      }

      // L2: Redis cache
      if (this.redis && this.isRedisConnected) {
        try {
          const redisValue = await this.redis.get(fullKey);
          if (redisValue) {
            const parsed = await this.parseRedisValue<T>(redisValue);
            
            // Сохраняем в L1 для быстрого доступа
            const cacheItem: CacheItem<T> = {
              value: parsed,
              compressed: false,
              timestamp: Date.now(),
              hits: 1
            };
            
            this.memoryCache.set(fullKey, cacheItem, {
              ttl: (config.ttl || this.DEFAULT_TTL) * 1000
            });
            
            this.incrementStat(namespace, 'hits');
            return parsed;
          }
        } catch (error) {
          console.error('Redis get error:', error);
          this.incrementStat(namespace, 'errors');
        }
      }

      this.incrementStat(namespace, 'misses');
      return null;

    } catch (error) {
      console.error('Cache get error:', error);
      this.incrementStat(config.namespace || 'default', 'errors');
      return null;
    }
  }

  /**
   * Сохранить значение в кеш
   */
  async set<T>(
    key: string, 
    value: T, 
    config: CacheConfig = {}
  ): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, config.namespace);
      const namespace = config.namespace || 'default';
      const ttl = config.ttl || this.DEFAULT_TTL;

      // Определяем нужна ли компрессия
      const serialized = JSON.stringify(value);
      const shouldCompress = serialized.length > 
        (config.compressionThreshold || this.DEFAULT_COMPRESSION_THRESHOLD);

      let storedValue: T | Buffer = value;
      let compressed = false;

      if (shouldCompress) {
        storedValue = await this.compress(serialized);
        compressed = true;
        this.incrementStat(namespace, 'compressions');
      }

      // L1: Memory cache
      const cacheItem: CacheItem<T | Buffer> = {
        value: compressed ? storedValue : value,
        compressed,
        timestamp: Date.now(),
        hits: 0
      };

      // Приоритетное кеширование
      const memoryTtl = config.priority === 'high' 
        ? ttl * 2 * 1000 
        : ttl * 1000;

      this.memoryCache.set(fullKey, cacheItem, { ttl: memoryTtl });

      // L2: Redis cache
      if (this.redis && this.isRedisConnected) {
        try {
          const redisValue = compressed && Buffer.isBuffer(storedValue) 
            ? storedValue.toString('base64') 
            : serialized;
          const redisKey = compressed ? `${fullKey}:gz` : fullKey;
          
          await this.redis.setex(redisKey, ttl, redisValue);
        } catch (error) {
          console.error('Redis set error:', error);
          this.incrementStat(namespace, 'errors');
          
          // Если Redis недоступен но разрешён fallback
          if (!config.fallbackToMemory) {
            return false;
          }
        }
      }

      this.incrementStat(namespace, 'sets');
      this.eventEmitter.emit('cache:set', { key: fullKey, ttl, compressed });
      
      return true;

    } catch (error) {
      console.error('Cache set error:', error);
      this.incrementStat(config.namespace || 'default', 'errors');
      return false;
    }
  }

  /**
   * Удалить значение из кеша
   */
  async delete(key: string, namespace?: string): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, namespace);
      const ns = namespace || 'default';

      // L1: Memory cache
      this.memoryCache.delete(fullKey);

      // L2: Redis cache
      if (this.redis && this.isRedisConnected) {
        try {
          // Удаляем обе версии (сжатую и несжатую)
          await this.redis.del(fullKey, `${fullKey}:gz`);
        } catch (error) {
          console.error('Redis delete error:', error);
          this.incrementStat(ns, 'errors');
        }
      }

      this.incrementStat(ns, 'deletes');
      this.eventEmitter.emit('cache:delete', { key: fullKey });
      
      return true;

    } catch (error) {
      console.error('Cache delete error:', error);
      this.incrementStat(namespace || 'default', 'errors');
      return false;
    }
  }

  /**
   * Удалить все ключи по паттерну
   */
  async invalidatePattern(pattern: string, namespace?: string): Promise<number> {
    let invalidated = 0;
    const ns = namespace || 'default';

    try {
      // L1: Memory cache
      const memoryPattern = this.buildKey(pattern, namespace);
      const regex = new RegExp('^' + memoryPattern.replace(/\*/g, '.*') + '$');
      
      for (const key of this.memoryCache.keys()) {
        if (regex.test(key)) {
          this.memoryCache.delete(key);
          invalidated++;
        }
      }

      // L2: Redis cache
      if (this.redis && this.isRedisConnected) {
        try {
          // Redis SCAN для безопасного поиска ключей
          const stream = this.redis.scanStream({
            match: memoryPattern,
            count: 100
          });

          const keysToDelete: string[] = [];
          
          stream.on('data', (keys: string[]) => {
            keysToDelete.push(...keys);
            // Также добавляем сжатые версии
            keys.forEach(k => keysToDelete.push(`${k}:gz`));
          });

          await new Promise((resolve, reject) => {
            stream.on('end', resolve);
            stream.on('error', reject);
          });

          if (keysToDelete.length > 0) {
            await this.redis.del(...keysToDelete);
            invalidated += keysToDelete.length / 2; // Делим на 2 т.к. считаем и сжатые версии
          }
        } catch (error) {
          console.error('Redis pattern delete error:', error);
          this.incrementStat(ns, 'errors');
        }
      }

      this.incrementStat(ns, 'deletes', invalidated);
      this.eventEmitter.emit('cache:invalidate', { pattern: memoryPattern, count: invalidated });

    } catch (error) {
      console.error('Cache invalidate pattern error:', error);
      this.incrementStat(ns, 'errors');
    }

    return invalidated;
  }

  /**
   * Прогрев кеша
   */
  async warmUp(
    loader: () => Promise<Record<string, unknown>>, 
    config: CacheConfig = {}
  ): Promise<void> {
    try {
      console.log('🔥 Cache warm-up started...');
      const startTime = Date.now();
      
      const data = await loader();
      const entries = Object.entries(data);
      
      // Параллельная загрузка с ограничением
      const batchSize = 100;
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        const promises = batch.map(([key, value]) => 
          this.set(key, value, { ...config, priority: 'high' })
        );
        
        await Promise.allSettled(promises);
      }
      
      const duration = Date.now() - startTime;
      console.log(`✅ Cache warmed up with ${entries.length} entries in ${duration}ms`);
      
      this.eventEmitter.emit('cache:warmup', { 
        count: entries.length, 
        duration,
        namespace: config.namespace || 'default'
      });
      
    } catch (error) {
      console.error('❌ Cache warm-up failed:', error);
      this.incrementStat(config.namespace || 'default', 'errors');
    }
  }

  /**
   * Получить статистику
   */
  getStats(namespace?: string): CacheStats | Record<string, CacheStats> {
    if (namespace) {
      return this.getNamespaceStats(namespace);
    }

    // Возвращаем статистику по всем namespace
    const allStats: Record<string, CacheStats> = {};
    
    for (const [ns, stats] of this.stats.entries()) {
      allStats[ns] = { ...stats };
    }

    // Добавляем общую статистику по памяти
    allStats['_total'] = {
      ...this.getNamespaceStats('_total'),
      memoryUsage: this.memoryCache.calculatedSize || 0,
      itemCount: this.memoryCache.size
    };

    return allStats;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    memory: {
      used: number;
      max: number;
      percentage: number;
      itemCount: number;
    };
    redis: {
      connected: boolean;
      latency?: number;
    };
    uptime: number;
  }> {
    const memoryUsed = this.memoryCache.calculatedSize || 0;
    const memoryMax = this.MAX_MEMORY_MB * 1024 * 1024;
    const memoryPercentage = (memoryUsed / memoryMax) * 100;

    let redisLatency: number | undefined;
    let redisHealthy = false;

    if (this.redis && this.isRedisConnected) {
      try {
        const start = Date.now();
        await this.redis.ping();
        redisLatency = Date.now() - start;
        redisHealthy = true;
      } catch {}
    }

    const status = redisHealthy 
      ? (memoryPercentage > 90 ? 'degraded' : 'healthy')
      : 'degraded';

    return {
      status,
      memory: {
        used: memoryUsed,
        max: memoryMax,
        percentage: Math.round(memoryPercentage),
        itemCount: this.memoryCache.size
      },
      redis: {
        connected: redisHealthy,
        latency: redisLatency
      },
      uptime: process.uptime()
    };
  }

  /**
   * Очистить весь кеш
   */
  async clear(namespace?: string): Promise<void> {
    if (namespace) {
      await this.invalidatePattern('*', namespace);
    } else {
      // Очищаем всю память
      this.memoryCache.clear();
      
      // Очищаем Redis
      if (this.redis && this.isRedisConnected) {
        try {
          await this.redis.flushdb();
        } catch (error) {
          console.error('Redis clear error:', error);
        }
      }
      
      // Сбрасываем статистику
      this.stats.clear();
    }

    this.eventEmitter.emit('cache:clear', { namespace });
  }

  /**
   * Подписаться на события
   */
  on(event: string, listener: (...args: unknown[]) => void): void {
    this.eventEmitter.on(event, listener);
  }

  /**
   * Отписаться от событий
   */
  off(event: string, listener: (...args: unknown[]) => void): void {
    this.eventEmitter.off(event, listener);
  }

  /**
   * Закрыть соединения
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      this.isRedisConnected = false;
    }
    
    this.memoryCache.clear();
    this.eventEmitter.removeAllListeners();
    
    console.log('🔌 UnifiedCacheService closed');
  }

  // === Приватные методы ===

  private buildKey(key: string, namespace?: string): string {
    return namespace 
      ? `${namespace}${this.NAMESPACE_SEPARATOR}${key}`
      : key;
  }

  private async compress(data: string): Promise<Buffer> {
    return gzip(Buffer.from(data));
  }

  private async decompress(data: Buffer): Promise<unknown> {
    const decompressed = await gunzip(data);
    return JSON.parse(decompressed.toString());
  }

  private async parseRedisValue<T>(value: string): Promise<T> {
    try {
      // Пробуем как обычный JSON
      return JSON.parse(value);
    } catch {
      // Если не JSON, возможно это сжатые данные
      const buffer = Buffer.from(value, 'base64');
      return this.decompress(buffer) as Promise<T>;
    }
  }

  private incrementStat(
    namespace: string, 
    stat: keyof CacheStats, 
    value = 1
  ): void {
    if (!this.stats.has(namespace)) {
      this.stats.set(namespace, {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        evictions: 0,
        compressions: 0,
        decompressions: 0,
        errors: 0,
        memoryUsage: 0,
        itemCount: 0
      });
    }

    const stats = this.stats.get(namespace)!;
    (stats[stat] as number) += value;
  }

  private getNamespaceStats(namespace: string): CacheStats {
    return this.stats.get(namespace) || {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      compressions: 0,
      decompressions: 0,
      errors: 0,
      memoryUsage: 0,
      itemCount: 0
    };
  }

  private startMaintenanceTasks(): void {
    // Периодический сбор статистики
    setInterval(() => {
      // Обновляем статистику памяти
      for (const [namespace] of this.stats.entries()) {
        const stats = this.stats.get(namespace)!;
        let namespaceSize = 0;
        let namespaceCount = 0;

        for (const [key] of this.memoryCache.entries()) {
          if (key.startsWith(namespace + this.NAMESPACE_SEPARATOR)) {
            namespaceCount++;
            namespaceSize += this.memoryCache.calculatedSize || 0;
          }
        }

        stats.memoryUsage = namespaceSize;
        stats.itemCount = namespaceCount;
      }

      // Публикуем метрики
      this.eventEmitter.emit('metrics', this.getStats());
    }, 30000); // Каждые 30 секунд

    // Периодическая проверка здоровья
    setInterval(async () => {
      const health = await this.healthCheck();
      if (health.status === 'unhealthy') {
        console.error('⚠️ UnifiedCache health check failed:', health);
      }
      this.eventEmitter.emit('health', health);
    }, 60000); // Каждую минуту
  }
}

// Export singleton instance
export const unifiedCache = UnifiedCacheService.getInstance();
export default unifiedCache;
