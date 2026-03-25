# 🧠 Анализ системы памяти Canton OTC и предложения по улучшению

## 📊 Текущее состояние системы памяти

### 1. Компоненты системы памяти

#### 1.1 ConversationStorageService
**Файл**: `src/lib/services/conversationStorage.ts`

**✅ Преимущества**:
- Персистентное файловое хранилище с fallback на in-memory
- Встроенный TTL (Time To Live) механизм
- Поддержка резервного копирования и восстановления
- Двухуровневое кеширование (память + файл)
- Автоматическая очистка устаревших данных

**❌ Недостатки**:
- Отсутствует Redis интеграция (хотя интерфейс готов)
- Нет распределённого кеширования для кластера
- Синхронная запись в файл может быть узким местом
- Нет метрик производительности

#### 1.2 RedisRateLimiter
**Файл**: `src/lib/services/redisRateLimiter.ts`

**✅ Преимущества**:
- Использует Redis для распределённого rate limiting
- Graceful degradation при недоступности Redis
- Pipeline операции для производительности
- Health check функциональность

**❌ Недостатки**:
- In-memory fallback слишком примитивный
- Нет синхронизации между инстансами при fallback
- Отсутствует кеширование результатов

#### 1.3 AntiSpamService
**Файл**: `src/lib/services/antiSpamService.ts`

**✅ Преимущества**:
- Комплексная система детекции спама
- Множество паттернов анализа
- Настраиваемые параметры через ENV

**❌ Недостатки**:
- **КРИТИЧНО**: Только in-memory хранилище - теряет все данные при перезапуске
- Нет персистентности блокировок
- Нет распределённого состояния между инстансами
- Отсутствует интеграция с Redis

#### 1.4 NextAuth Session Management
**Файл**: `src/lib/auth.ts`

**✅ Преимущества**:
- JWT токены с secure cookies
- 24-часовая сессия
- Edge Runtime совместимость

**❌ Недостатки**:
- Нет централизованного управления сессиями
- Невозможно инвалидировать токены до истечения

#### 1.5 Google Sheets Integration
**Файл**: `src/lib/services/googleSheets.ts`

**❌ Критические недостатки**:
- **НЕТ КЕШИРОВАНИЯ** - каждый запрос идёт в Google Sheets
- Высокая латентность
- Жёсткие API лимиты
- Single point of failure

### 2. Основные проблемы текущей архитектуры

1. **Несогласованность подходов**: Каждый сервис использует свой подход к хранению
2. **Отсутствие единого кеш-слоя**: Нет централизованного управления кешем
3. **Потеря данных**: AntiSpamService теряет все данные при рестарте
4. **Производительность**: Google Sheets без кеширования - узкое место
5. **Масштабируемость**: Многие компоненты не готовы к работе в кластере

## 🚀 Предложения по улучшению

### 1. Unified Cache Layer (Единый слой кеширования)

```typescript
// src/lib/services/unifiedCache.ts

export interface CacheConfig {
  ttl?: number;          // Time to live в секундах
  namespace?: string;    // Namespace для изоляции
  fallbackToMemory?: boolean;
  compressionThreshold?: number; // Сжимать данные больше N байт
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  memoryUsage: number;
}

export class UnifiedCacheService {
  private redis: Redis | null;
  private memoryCache: LRUCache<string, any>;
  private stats: Map<string, CacheStats>;
  
  constructor() {
    // LRU кеш с ограничением по памяти
    this.memoryCache = new LRUCache({
      max: parseInt(process.env.CACHE_MEMORY_MB || '100') * 1024 * 1024,
      sizeCalculation: (value) => JSON.stringify(value).length,
      ttl: 1000 * 60 * 5, // 5 минут по умолчанию
      updateAgeOnGet: true,
      updateAgeOnHas: true,
    });
    
    this.initializeRedis();
    this.setupMetrics();
  }
  
  /**
   * Многоуровневое кеширование с компрессией
   */
  async get<T>(key: string, config: CacheConfig = {}): Promise<T | null> {
    const fullKey = this.buildKey(key, config.namespace);
    
    // L1: Memory cache
    const memoryValue = this.memoryCache.get(fullKey);
    if (memoryValue) {
      this.recordHit(fullKey);
      return memoryValue;
    }
    
    // L2: Redis cache
    if (this.redis) {
      try {
        const redisValue = await this.redis.get(fullKey);
        if (redisValue) {
          const parsed = this.decompress(redisValue);
          // Populate L1 cache
          this.memoryCache.set(fullKey, parsed, { ttl: config.ttl });
          this.recordHit(fullKey);
          return parsed;
        }
      } catch (error) {
        console.error('Redis get error:', error);
      }
    }
    
    this.recordMiss(fullKey);
    return null;
  }
  
  /**
   * Запись с автоматической компрессией
   */
  async set<T>(
    key: string, 
    value: T, 
    config: CacheConfig = {}
  ): Promise<boolean> {
    const fullKey = this.buildKey(key, config.namespace);
    const ttl = config.ttl || 3600; // 1 час по умолчанию
    
    // L1: Memory cache
    this.memoryCache.set(fullKey, value, { ttl: ttl * 1000 });
    
    // L2: Redis cache
    if (this.redis) {
      try {
        const compressed = this.compress(value, config.compressionThreshold);
        await this.redis.setex(fullKey, ttl, compressed);
        return true;
      } catch (error) {
        console.error('Redis set error:', error);
      }
    }
    
    return config.fallbackToMemory !== false;
  }
  
  /**
   * Invalidate паттерном
   */
  async invalidatePattern(pattern: string, namespace?: string): Promise<number> {
    let invalidated = 0;
    
    // Clear from memory cache
    const memoryPattern = this.buildKey(pattern, namespace);
    for (const key of this.memoryCache.keys()) {
      if (this.matchesPattern(key, memoryPattern)) {
        this.memoryCache.delete(key);
        invalidated++;
      }
    }
    
    // Clear from Redis
    if (this.redis) {
      try {
        const keys = await this.redis.keys(memoryPattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
          invalidated += keys.length;
        }
      } catch (error) {
        console.error('Redis invalidate error:', error);
      }
    }
    
    return invalidated;
  }
  
  /**
   * Прогрев кеша
   */
  async warmUp(
    loader: () => Promise<Record<string, any>>, 
    config: CacheConfig = {}
  ): Promise<void> {
    try {
      const data = await loader();
      const promises = Object.entries(data).map(([key, value]) => 
        this.set(key, value, config)
      );
      await Promise.allSettled(promises);
      console.log(`✅ Cache warmed up with ${Object.keys(data).length} entries`);
    } catch (error) {
      console.error('❌ Cache warm up failed:', error);
    }
  }
  
  /**
   * Получить статистику
   */
  getStats(): Record<string, CacheStats> {
    return Object.fromEntries(this.stats);
  }
  
  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    memoryCache: { size: number; itemCount: number };
    redis: boolean;
  }> {
    const memoryInfo = {
      size: this.memoryCache.calculatedSize,
      itemCount: this.memoryCache.size
    };
    
    let redisHealthy = false;
    if (this.redis) {
      try {
        await this.redis.ping();
        redisHealthy = true;
      } catch {}
    }
    
    return {
      status: redisHealthy ? 'healthy' : 'degraded',
      memoryCache: memoryInfo,
      redis: redisHealthy
    };
  }
  
  private compress(value: any, threshold = 1024): string {
    const json = JSON.stringify(value);
    if (json.length < threshold) return json;
    
    // Используем zlib для компрессии
    return zlib.gzipSync(json).toString('base64');
  }
  
  private decompress(value: string): any {
    try {
      // Пробуем как обычный JSON
      return JSON.parse(value);
    } catch {
      // Если не JSON, значит сжатые данные
      const buffer = Buffer.from(value, 'base64');
      const json = zlib.gunzipSync(buffer).toString();
      return JSON.parse(json);
    }
  }
}
```

### 2. Миграция AntiSpamService на персистентное хранилище

```typescript
// src/lib/services/antiSpamServiceV2.ts

export class AntiSpamServiceV2 extends AntiSpamService {
  private cache: UnifiedCacheService;
  
  constructor(cache: UnifiedCacheService) {
    super();
    this.cache = cache;
    this.migrateToPersistedStorage();
  }
  
  /**
   * Сохранение состояния в персистентное хранилище
   */
  private async persistState(): Promise<void> {
    const state = {
      orderCache: Array.from(this.orderCache.entries()),
      blockedIPs: Array.from(this.blockedIPs.entries()),
      blockedEmails: Array.from(this.blockedEmails.entries()),
      blockedAddresses: Array.from(this.blockedAddresses.entries()),
    };
    
    await this.cache.set('antispam:state', state, {
      namespace: 'security',
      ttl: 86400, // 24 часа
      compressionThreshold: 512
    });
  }
  
  /**
   * Восстановление состояния из персистентного хранилища
   */
  private async restoreState(): Promise<void> {
    const state = await this.cache.get<any>('antispam:state', {
      namespace: 'security'
    });
    
    if (state) {
      this.orderCache = new Map(state.orderCache);
      this.blockedIPs = new Map(state.blockedIPs);
      this.blockedEmails = new Map(state.blockedEmails);
      this.blockedAddresses = new Map(state.blockedAddresses);
      
      console.log('✅ AntiSpam state restored from cache');
    }
  }
  
  /**
   * Переопределяем методы для автоматического сохранения
   */
  async detectSpam(orderData: OrderData): Promise<SpamDetectionResult> {
    const result = await super.detectSpam(orderData);
    
    // Сохраняем состояние после каждой проверки
    setImmediate(() => this.persistState().catch(console.error));
    
    return result;
  }
}
```

### 3. Оптимизация Google Sheets с кешированием

```typescript
// src/lib/services/googleSheetsV2.ts

export class GoogleSheetsServiceV2 extends GoogleSheetsService {
  private cache: UnifiedCacheService;
  
  constructor(cache: UnifiedCacheService) {
    super();
    this.cache = cache;
  }
  
  /**
   * Получение всех заказов с кешированием
   */
  async getAllOrders(): Promise<OTCOrder[]> {
    // Пробуем получить из кеша
    const cached = await this.cache.get<OTCOrder[]>('orders:all', {
      namespace: 'sheets'
    });
    
    if (cached) {
      console.log('📋 Orders loaded from cache');
      return cached;
    }
    
    // Загружаем из Google Sheets
    const orders = await super.getAllOrders();
    
    // Сохраняем в кеш
    await this.cache.set('orders:all', orders, {
      namespace: 'sheets',
      ttl: 300, // 5 минут
      compressionThreshold: 1024
    });
    
    return orders;
  }
  
  /**
   * Сохранение заказа с инвалидацией кеша
   */
  async saveOrder(order: OTCOrder): Promise<boolean> {
    const result = await super.saveOrder(order);
    
    if (result) {
      // Инвалидируем кеш
      await this.cache.invalidatePattern('orders:*', 'sheets');
      
      // Опционально: обновляем кеш сразу
      setImmediate(() => this.getAllOrders().catch(console.error));
    }
    
    return result;
  }
  
  /**
   * Получение заказа по ID с кешированием
   */
  async getOrderById(orderId: string): Promise<OTCOrder | null> {
    const cacheKey = `orders:${orderId}`;
    
    // Пробуем из кеша
    const cached = await this.cache.get<OTCOrder>(cacheKey, {
      namespace: 'sheets'
    });
    
    if (cached) return cached;
    
    // Загружаем все заказы (или реализуем поиск по ID)
    const orders = await this.getAllOrders();
    const order = orders.find(o => o.orderId === orderId) || null;
    
    // Кешируем результат
    if (order) {
      await this.cache.set(cacheKey, order, {
        namespace: 'sheets',
        ttl: 600 // 10 минут
      });
    }
    
    return order;
  }
}
```

### 4. Smart Memory Management (Умное управление памятью)

```typescript
// src/lib/services/memoryManager.ts

export interface MemoryPolicy {
  maxMemoryMB: number;
  evictionPolicy: 'LRU' | 'LFU' | 'FIFO';
  compressionEnabled: boolean;
  alertThreshold: number; // Процент использования для алерта
}

export class MemoryManager {
  private policies: Map<string, MemoryPolicy>;
  private usage: Map<string, number>;
  private alerts: EventEmitter;
  
  constructor() {
    this.policies = new Map();
    this.usage = new Map();
    this.alerts = new EventEmitter();
    this.startMonitoring();
  }
  
  /**
   * Регистрация сервиса с политикой памяти
   */
  registerService(
    serviceName: string, 
    policy: Partial<MemoryPolicy> = {}
  ): void {
    const defaultPolicy: MemoryPolicy = {
      maxMemoryMB: 100,
      evictionPolicy: 'LRU',
      compressionEnabled: true,
      alertThreshold: 80
    };
    
    this.policies.set(serviceName, { ...defaultPolicy, ...policy });
    this.usage.set(serviceName, 0);
    
    console.log(`📊 Memory policy registered for ${serviceName}:`, 
      this.policies.get(serviceName));
  }
  
  /**
   * Обновление использования памяти
   */
  updateUsage(serviceName: string, bytes: number): void {
    this.usage.set(serviceName, bytes);
    
    const policy = this.policies.get(serviceName);
    if (!policy) return;
    
    const usagePercent = (bytes / (policy.maxMemoryMB * 1024 * 1024)) * 100;
    
    if (usagePercent > policy.alertThreshold) {
      this.alerts.emit('memory-alert', {
        service: serviceName,
        usage: bytes,
        percent: usagePercent,
        threshold: policy.alertThreshold
      });
    }
  }
  
  /**
   * Получить рекомендации по оптимизации
   */
  getOptimizationSuggestions(): Record<string, string[]> {
    const suggestions: Record<string, string[]> = {};
    
    for (const [service, usage] of this.usage.entries()) {
      const policy = this.policies.get(service)!;
      const usagePercent = (usage / (policy.maxMemoryMB * 1024 * 1024)) * 100;
      
      suggestions[service] = [];
      
      if (usagePercent > 90) {
        suggestions[service].push('Критическое использование памяти - требуется немедленная очистка');
      }
      
      if (usagePercent > 70 && !policy.compressionEnabled) {
        suggestions[service].push('Включите компрессию для экономии памяти');
      }
      
      if (policy.evictionPolicy !== 'LRU' && usagePercent > 50) {
        suggestions[service].push('Рассмотрите переход на LRU eviction policy');
      }
    }
    
    return suggestions;
  }
  
  /**
   * Мониторинг памяти
   */
  private startMonitoring(): void {
    setInterval(() => {
      const memoryUsage = process.memoryUsage();
      
      // Глобальная статистика
      const totalMB = memoryUsage.heapUsed / 1024 / 1024;
      
      if (totalMB > parseInt(process.env.MAX_MEMORY_MB || '512')) {
        console.warn(`⚠️ High memory usage: ${totalMB.toFixed(2)}MB`);
        
        // Запускаем garbage collection если доступно
        if (global.gc) {
          global.gc();
          console.log('🧹 Manual GC triggered');
        }
      }
      
      // Публикуем метрики
      this.alerts.emit('memory-stats', {
        total: memoryUsage,
        services: Object.fromEntries(this.usage),
        timestamp: Date.now()
      });
    }, 30000); // Каждые 30 секунд
  }
}
```

### 5. Context-Aware Caching (Контекстно-зависимое кеширование)

```typescript
// src/lib/services/contextCache.ts

export interface CacheContext {
  userId?: string;
  sessionId?: string;
  role?: string;
  feature?: string;
  priority?: 'low' | 'medium' | 'high';
}

export class ContextAwareCacheService {
  private cache: UnifiedCacheService;
  private contextPolicies: Map<string, CachePolicy>;
  
  constructor(cache: UnifiedCacheService) {
    this.cache = cache;
    this.contextPolicies = new Map();
    this.initializePolicies();
  }
  
  /**
   * Получение данных с учётом контекста
   */
  async get<T>(
    key: string, 
    context: CacheContext = {}
  ): Promise<T | null> {
    const policy = this.getPolicyForContext(context);
    const contextKey = this.buildContextKey(key, context);
    
    return this.cache.get<T>(contextKey, {
      ttl: policy.ttl,
      namespace: policy.namespace
    });
  }
  
  /**
   * Сохранение с учётом контекста и приоритета
   */
  async set<T>(
    key: string, 
    value: T, 
    context: CacheContext = {}
  ): Promise<boolean> {
    const policy = this.getPolicyForContext(context);
    const contextKey = this.buildContextKey(key, context);
    
    // Высокоприоритетные данные кешируем дольше
    const ttl = context.priority === 'high' 
      ? policy.ttl * 2 
      : policy.ttl;
    
    return this.cache.set(contextKey, value, {
      ttl,
      namespace: policy.namespace,
      compressionThreshold: policy.compressionThreshold
    });
  }
  
  /**
   * Предзагрузка данных для контекста
   */
  async preloadForContext(
    context: CacheContext,
    dataLoader: () => Promise<Record<string, any>>
  ): Promise<void> {
    const data = await dataLoader();
    
    const promises = Object.entries(data).map(([key, value]) =>
      this.set(key, value, { ...context, priority: 'high' })
    );
    
    await Promise.allSettled(promises);
    
    console.log(`📦 Preloaded ${Object.keys(data).length} items for context:`, context);
  }
  
  /**
   * Умная инвалидация по контексту
   */
  async invalidateContext(context: CacheContext): Promise<number> {
    const pattern = this.buildContextPattern(context);
    return this.cache.invalidatePattern(pattern);
  }
  
  private getPolicyForContext(context: CacheContext): CachePolicy {
    // Определяем политику на основе контекста
    if (context.role === 'admin') {
      return {
        ttl: 300, // 5 минут для админов
        namespace: 'admin',
        compressionThreshold: 2048
      };
    }
    
    if (context.feature === 'pricing') {
      return {
        ttl: 60, // 1 минута для цен
        namespace: 'pricing',
        compressionThreshold: 512
      };
    }
    
    // Дефолтная политика
    return {
      ttl: 600, // 10 минут
      namespace: 'default',
      compressionThreshold: 1024
    };
  }
  
  private buildContextKey(key: string, context: CacheContext): string {
    const parts = [key];
    
    if (context.userId) parts.push(`u:${context.userId}`);
    if (context.sessionId) parts.push(`s:${context.sessionId}`);
    if (context.role) parts.push(`r:${context.role}`);
    if (context.feature) parts.push(`f:${context.feature}`);
    
    return parts.join(':');
  }
}
```

## 📋 План внедрения

### Фаза 1: Базовая инфраструктура (1-2 недели)

1. **Внедрить UnifiedCacheService**
   - Создать сервис с поддержкой Redis и in-memory
   - Настроить автоматическое переключение между уровнями
   - Добавить метрики и мониторинг

2. **Мигрировать ConversationStorage на UnifiedCache**
   - Использовать единый кеш вместо собственной реализации
   - Сохранить обратную совместимость

### Фаза 2: Критические исправления (1 неделя)

1. **Исправить AntiSpamService**
   - Добавить персистентность через UnifiedCache
   - Реализовать распределённое хранение блокировок
   - Добавить восстановление после рестарта

2. **Оптимизировать Google Sheets**
   - Внедрить кеширование всех операций чтения
   - Добавить прогрев кеша при старте
   - Реализовать умную инвалидацию

### Фаза 3: Продвинутые оптимизации (2-3 недели)

1. **Внедрить MemoryManager**
   - Мониторинг использования памяти
   - Автоматические алерты
   - Рекомендации по оптимизации

2. **Добавить ContextAwareCache**
   - Кеширование с учётом контекста пользователя
   - Приоритизация важных данных
   - Умная предзагрузка

### Фаза 4: Мониторинг и тюнинг (ongoing)

1. **Настроить дашборды**
   - Cache hit/miss ratio
   - Memory usage по сервисам
   - Latency метрики

2. **Оптимизация политик**
   - Анализ паттернов использования
   - Настройка TTL на основе данных
   - Оптимизация размеров кешей

## 🎯 Ожидаемые результаты

1. **Производительность**
   - Снижение latency на 70-80% для часто запрашиваемых данных
   - Уменьшение нагрузки на Google Sheets API на 90%
   - Ускорение отклика системы в 3-5 раз

2. **Надёжность**
   - Устойчивость к перезапускам (сохранение состояния)
   - Работа при недоступности внешних сервисов
   - Автоматическое восстановление после сбоев

3. **Масштабируемость**
   - Готовность к работе в кластере
   - Распределённое состояние через Redis
   - Эффективное использование памяти

4. **Операционная эффективность**
   - Прозрачный мониторинг
   - Предиктивные алерты
   - Автоматическая оптимизация

## 🔧 Конфигурация

```env
# Cache Configuration
CACHE_MEMORY_MB=200
CACHE_REDIS_URL=redis://localhost:6379
CACHE_DEFAULT_TTL=3600
CACHE_COMPRESSION_THRESHOLD=1024

# Memory Management
MAX_MEMORY_MB=512
MEMORY_ALERT_THRESHOLD=80
ENABLE_MEMORY_MONITORING=true

# Service-specific
CONVERSATION_CACHE_TTL=86400
ANTISPAM_CACHE_TTL=3600
SHEETS_CACHE_TTL=300
PRICING_CACHE_TTL=60
```

## 📊 Метрики для отслеживания

1. **Cache Metrics**
   - Hit rate по namespace
   - Average latency
   - Memory usage
   - Eviction rate

2. **Performance Metrics**
   - API response time
   - Database query time
   - External service calls

3. **Health Metrics**
   - Redis connectivity
   - Memory pressure
   - GC frequency

## 🚨 Риски и митигация

1. **Cache Invalidation**
   - Риск: Устаревшие данные в кеше
   - Митигация: TTL + event-based invalidation

2. **Memory Overflow**
   - Риск: OOM при больших объёмах
   - Митигация: LRU eviction + monitoring

3. **Redis Downtime**
   - Риск: Потеря распределённого кеша
   - Митигация: In-memory fallback + Redis Sentinel

4. **Thundering Herd**
   - Риск: Массовые запросы при пустом кеше
   - Митигация: Stale-while-revalidate + request coalescing
