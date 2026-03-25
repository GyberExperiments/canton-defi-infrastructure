# 🔄 Примеры миграции на UnifiedCacheService

## 1. Миграция ConversationStorageService

### До миграции:
```typescript
// src/lib/services/conversationStorage.ts
class ConversationStorageService {
  private cache = new Map<string, ConversationContext>();
  private cacheExpiry = new Map<string, number>();
  
  async saveContext(orderId: string, context: ConversationContext) {
    this.cache.set(orderId, context);
    this.cacheExpiry.set(orderId, Date.now() + (this.ttl * 1000));
    await this.saveToFile();
  }
}
```

### После миграции:
```typescript
// src/lib/services/conversationStorageV2.ts
import { unifiedCache } from './unifiedCache';

class ConversationStorageServiceV2 {
  private readonly NAMESPACE = 'conversations';
  private readonly DEFAULT_TTL = 86400; // 24 часа
  
  async saveContext(
    orderId: string, 
    context: Omit<ConversationContext, 'createdAt' | 'updatedAt' | 'lastActivity'>
  ): Promise<boolean> {
    const now = Date.now();
    const existingContext = await this.getContext(orderId);
    
    const conversationContext: ConversationContext = {
      ...context,
      createdAt: existingContext?.createdAt || now,
      updatedAt: now,
      lastActivity: now
    };

    // Используем UnifiedCache вместо собственной реализации
    return unifiedCache.set(orderId, conversationContext, {
      namespace: this.NAMESPACE,
      ttl: this.DEFAULT_TTL,
      priority: 'high' // Важные данные
    });
  }
  
  async getContext(orderId: string): Promise<ConversationContext | null> {
    const context = await unifiedCache.get<ConversationContext>(orderId, {
      namespace: this.NAMESPACE
    });
    
    if (context) {
      // Обновляем активность
      context.lastActivity = Date.now();
      await unifiedCache.set(orderId, context, {
        namespace: this.NAMESPACE,
        ttl: this.DEFAULT_TTL
      });
    }
    
    return context;
  }
  
  async deleteContext(orderId: string): Promise<boolean> {
    return unifiedCache.delete(orderId, this.NAMESPACE);
  }
  
  async getActiveConversations(): Promise<ConversationContext[]> {
    // Можно использовать warm-up для предзагрузки всех активных разговоров
    const pattern = '*';
    // В реальной реализации нужно будет добавить метод для получения всех ключей
    // или хранить список активных разговоров отдельно
    return [];
  }
  
  async cleanupExpired(): Promise<number> {
    // TTL обрабатывается автоматически UnifiedCache
    // Этот метод больше не нужен
    return 0;
  }
  
  getStats() {
    return unifiedCache.getStats(this.NAMESPACE);
  }
}
```

## 2. Миграция AntiSpamService

### До миграции:
```typescript
// src/lib/services/antiSpamService.ts
class AntiSpamService {
  private orderCache = new Map<string, OrderData[]>();
  private blockedIPs = new Map<string, number>();
  
  // Все данные теряются при перезапуске!
}
```

### После миграции:
```typescript
// src/lib/services/antiSpamServiceV2.ts
import { unifiedCache } from './unifiedCache';

export class AntiSpamServiceV2 {
  private static instance: AntiSpamServiceV2;
  private readonly NAMESPACE = 'antispam';
  private readonly BLOCK_TTL = 1800; // 30 минут
  private readonly ORDER_CACHE_TTL = 300; // 5 минут
  
  /**
   * Сохранение заказа в кеше
   */
  private async cacheOrder(orderData: OrderData): Promise<void> {
    const key = `order:${orderData.orderId}`;
    await unifiedCache.set(key, orderData, {
      namespace: this.NAMESPACE,
      ttl: this.ORDER_CACHE_TTL
    });
    
    // Также сохраняем в индексы для быстрого поиска
    await this.addToIndex('email', orderData.email, orderData.orderId);
    await this.addToIndex('ip', orderData.ip, orderData.orderId);
    await this.addToIndex('amount', orderData.usdtAmount.toString(), orderData.orderId);
  }
  
  /**
   * Добавление в индекс
   */
  private async addToIndex(indexType: string, indexValue: string, orderId: string): Promise<void> {
    const key = `index:${indexType}:${indexValue}`;
    const existing = await unifiedCache.get<string[]>(key, {
      namespace: this.NAMESPACE
    }) || [];
    
    existing.push(orderId);
    
    await unifiedCache.set(key, existing, {
      namespace: this.NAMESPACE,
      ttl: this.ORDER_CACHE_TTL
    });
  }
  
  /**
   * Блокировка IP
   */
  private async blockIP(ip: string, duration: number): Promise<void> {
    const key = `blocked:ip:${ip}`;
    const blockedUntil = Date.now() + duration;
    
    await unifiedCache.set(key, blockedUntil, {
      namespace: this.NAMESPACE,
      ttl: Math.ceil(duration / 1000),
      priority: 'high' // Важно для безопасности
    });
  }
  
  /**
   * Проверка блокировки
   */
  private async isBlocked(type: 'ip' | 'email' | 'address', value: string): Promise<boolean> {
    const key = `blocked:${type}:${value}`;
    const blockedUntil = await unifiedCache.get<number>(key, {
      namespace: this.NAMESPACE
    });
    
    return blockedUntil ? Date.now() < blockedUntil : false;
  }
  
  /**
   * Проверка дублирующихся сумм
   */
  private async checkDuplicateAmounts(orderData: OrderData): Promise<SpamPattern | null> {
    const key = `index:amount:${orderData.usdtAmount}`;
    const orderIds = await unifiedCache.get<string[]>(key, {
      namespace: this.NAMESPACE
    }) || [];
    
    if (orderIds.length >= 2) {
      const confidence = Math.min(orderIds.length * 30, 100);
      const severity = orderIds.length >= 5 ? 'CRITICAL' : 
                       orderIds.length >= 3 ? 'HIGH' : 'MEDIUM';
      
      return {
        type: 'DUPLICATE_AMOUNT',
        severity,
        description: `${orderIds.length} orders with same amount ($${orderData.usdtAmount})`,
        confidence
      };
    }
    
    return null;
  }
  
  /**
   * Основной метод детекции с персистентностью
   */
  async detectSpam(orderData: OrderData): Promise<SpamDetectionResult> {
    // Проверяем блокировки
    if (await this.isBlocked('ip', orderData.ip)) {
      return {
        isSpam: true,
        confidence: 100,
        reason: 'IP is blocked',
        riskLevel: 'CRITICAL'
      };
    }
    
    // Сохраняем заказ
    await this.cacheOrder(orderData);
    
    // Выполняем проверки
    const patterns: SpamPattern[] = [];
    
    const duplicateAmount = await this.checkDuplicateAmounts(orderData);
    if (duplicateAmount) patterns.push(duplicateAmount);
    
    // ... другие проверки ...
    
    const result = this.analyzeSpamPatterns(patterns);
    
    // Блокируем если нужно
    if (result.isSpam && result.riskLevel === 'CRITICAL') {
      await this.blockIP(orderData.ip, this.BLOCK_DURATION_MS);
    }
    
    return result;
  }
  
  /**
   * Получить статистику
   */
  async getStats() {
    const cacheStats = unifiedCache.getStats(this.NAMESPACE);
    
    // Дополнительная статистика
    const blockedIPs = await unifiedCache.invalidatePattern('blocked:ip:*', this.NAMESPACE);
    const totalOrders = await unifiedCache.invalidatePattern('order:*', this.NAMESPACE);
    
    return {
      ...cacheStats,
      blockedIPs,
      totalOrders
    };
  }
}
```

## 3. Миграция GoogleSheetsService

### До миграции:
```typescript
// src/lib/services/googleSheets.ts
class GoogleSheetsService {
  async getAllOrders(): Promise<OTCOrder[]> {
    // Каждый раз запрос к Google Sheets API!
    const response = await this.sheets.spreadsheets.values.get({...});
    return this.parseOrders(response.data.values);
  }
}
```

### После миграции:
```typescript
// src/lib/services/googleSheetsV2.ts
import { unifiedCache } from './unifiedCache';

export class GoogleSheetsServiceV2 extends GoogleSheetsService {
  private readonly NAMESPACE = 'sheets';
  private readonly ORDERS_TTL = 300; // 5 минут
  private readonly ORDER_TTL = 600; // 10 минут
  
  /**
   * Получение всех заказов с кешированием
   */
  async getAllOrders(): Promise<OTCOrder[]> {
    const cacheKey = 'orders:all';
    
    // Пробуем из кеша
    const cached = await unifiedCache.get<OTCOrder[]>(cacheKey, {
      namespace: this.NAMESPACE
    });
    
    if (cached) {
      console.log('📋 Orders loaded from cache');
      return cached;
    }
    
    // Загружаем из Google Sheets
    console.log('📊 Loading orders from Google Sheets...');
    const orders = await super.getAllOrders();
    
    // Сохраняем в кеш
    await unifiedCache.set(cacheKey, orders, {
      namespace: this.NAMESPACE,
      ttl: this.ORDERS_TTL,
      compressionThreshold: 1024 // Сжимаем если больше 1KB
    });
    
    // Также кешируем каждый заказ отдельно
    const cachePromises = orders.map(order => 
      unifiedCache.set(`order:${order.orderId}`, order, {
        namespace: this.NAMESPACE,
        ttl: this.ORDER_TTL
      })
    );
    
    await Promise.allSettled(cachePromises);
    
    return orders;
  }
  
  /**
   * Получение заказа по ID с кешированием
   */
  async getOrderById(orderId: string): Promise<OTCOrder | null> {
    const cacheKey = `order:${orderId}`;
    
    // Пробуем из кеша
    const cached = await unifiedCache.get<OTCOrder>(cacheKey, {
      namespace: this.NAMESPACE
    });
    
    if (cached) {
      console.log(`📋 Order ${orderId} loaded from cache`);
      return cached;
    }
    
    // Если нет в кеше, загружаем все заказы
    const orders = await this.getAllOrders();
    return orders.find(o => o.orderId === orderId) || null;
  }
  
  /**
   * Сохранение заказа с инвалидацией кеша
   */
  async saveOrder(order: OTCOrder): Promise<boolean> {
    const result = await super.saveOrder(order);
    
    if (result) {
      // Инвалидируем кеш всех заказов
      await unifiedCache.delete('orders:all', this.NAMESPACE);
      
      // Обновляем кеш конкретного заказа
      await unifiedCache.set(`order:${order.orderId}`, order, {
        namespace: this.NAMESPACE,
        ttl: this.ORDER_TTL
      });
      
      // Опционально: прогреваем кеш заново в фоне
      setImmediate(() => {
        this.getAllOrders().catch(console.error);
      });
    }
    
    return result;
  }
  
  /**
   * Обновление заказа с умной инвалидацией
   */
  async updateOrder(orderId: string, updates: Partial<OTCOrder>): Promise<boolean> {
    const result = await super.updateOrder(orderId, updates);
    
    if (result) {
      // Получаем текущий заказ из кеша
      const cachedOrder = await unifiedCache.get<OTCOrder>(`order:${orderId}`, {
        namespace: this.NAMESPACE
      });
      
      if (cachedOrder) {
        // Обновляем только кеш конкретного заказа
        const updatedOrder = { ...cachedOrder, ...updates };
        await unifiedCache.set(`order:${orderId}`, updatedOrder, {
          namespace: this.NAMESPACE,
          ttl: this.ORDER_TTL
        });
      }
      
      // Инвалидируем общий список
      await unifiedCache.delete('orders:all', this.NAMESPACE);
    }
    
    return result;
  }
  
  /**
   * Массовое обновление с оптимизацией кеша
   */
  async batchUpdateOrders(updates: Array<{orderId: string, updates: Partial<OTCOrder>}>): Promise<boolean> {
    const result = await super.batchUpdateOrders(updates);
    
    if (result) {
      // Инвалидируем весь кеш заказов
      await unifiedCache.invalidatePattern('order:*', this.NAMESPACE);
      await unifiedCache.delete('orders:all', this.NAMESPACE);
      
      // Прогреваем кеш заново
      setImmediate(() => {
        this.warmUpCache().catch(console.error);
      });
    }
    
    return result;
  }
  
  /**
   * Прогрев кеша при старте приложения
   */
  async warmUpCache(): Promise<void> {
    console.log('🔥 Warming up Google Sheets cache...');
    
    try {
      const orders = await this.getAllOrders();
      console.log(`✅ Cache warmed up with ${orders.length} orders`);
    } catch (error) {
      console.error('❌ Failed to warm up cache:', error);
    }
  }
  
  /**
   * Получить статистику кеша
   */
  getCacheStats() {
    return unifiedCache.getStats(this.NAMESPACE);
  }
}
```

## 4. Интеграция с API endpoints

### Пример использования в API:
```typescript
// src/app/api/v1/orders/route.ts
import { googleSheetsServiceV2 } from '@/lib/services/googleSheetsV2';
import { unifiedCache } from '@/lib/services/unifiedCache';

export async function GET(request: Request) {
  try {
    // Проверяем кеш на уровне API
    const cached = await unifiedCache.get('api:orders:list', {
      namespace: 'api',
      ttl: 60 // 1 минута для API ответов
    });
    
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          'X-Cache': 'HIT',
          'Cache-Control': 'public, max-age=60'
        }
      });
    }
    
    // Получаем данные
    const orders = await googleSheetsServiceV2.getAllOrders();
    
    const response = {
      success: true,
      data: orders,
      timestamp: Date.now()
    };
    
    // Кешируем ответ
    await unifiedCache.set('api:orders:list', response, {
      namespace: 'api',
      ttl: 60
    });
    
    return NextResponse.json(response, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': 'public, max-age=60'
      }
    });
    
  } catch (error) {
    // При ошибке пробуем вернуть stale данные из кеша
    const stale = await unifiedCache.get('api:orders:list', {
      namespace: 'api'
    });
    
    if (stale) {
      return NextResponse.json(stale, {
        headers: {
          'X-Cache': 'STALE',
          'Cache-Control': 'public, max-age=10'
        }
      });
    }
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch orders'
    }, { status: 500 });
  }
}
```

## 5. Мониторинг и метрики

### Endpoint для метрик кеша:
```typescript
// src/app/api/admin/cache/metrics/route.ts
import { unifiedCache } from '@/lib/services/unifiedCache';

export async function GET(request: Request) {
  const stats = unifiedCache.getStats();
  const health = await unifiedCache.healthCheck();
  
  const metrics = {
    stats,
    health,
    hitRate: calculateHitRate(stats),
    recommendations: getOptimizationRecommendations(stats, health)
  };
  
  return NextResponse.json(metrics);
}

function calculateHitRate(stats: Record<string, CacheStats>): Record<string, number> {
  const hitRates: Record<string, number> = {};
  
  for (const [namespace, stat] of Object.entries(stats)) {
    const total = stat.hits + stat.misses;
    hitRates[namespace] = total > 0 ? (stat.hits / total) * 100 : 0;
  }
  
  return hitRates;
}

function getOptimizationRecommendations(
  stats: Record<string, CacheStats>, 
  health: any
): string[] {
  const recommendations: string[] = [];
  
  // Анализ hit rate
  for (const [namespace, stat] of Object.entries(stats)) {
    const hitRate = (stat.hits / (stat.hits + stat.misses)) * 100;
    
    if (hitRate < 50) {
      recommendations.push(
        `Low hit rate (${hitRate.toFixed(1)}%) in namespace "${namespace}". ` +
        `Consider increasing TTL or preloading frequently accessed data.`
      );
    }
  }
  
  // Анализ памяти
  if (health.memory.percentage > 80) {
    recommendations.push(
      `High memory usage (${health.memory.percentage}%). ` +
      `Consider reducing cache size or enabling compression.`
    );
  }
  
  // Анализ Redis
  if (!health.redis.connected) {
    recommendations.push(
      `Redis is not connected. Running in degraded mode with memory-only cache.`
    );
  }
  
  return recommendations;
}
```

## 6. Конфигурация для production

### Environment variables:
```env
# Cache Configuration
CACHE_MEMORY_MB=500                    # Увеличиваем для production
CACHE_REDIS_URL=redis://redis:6379    # Redis в Kubernetes
CACHE_DEFAULT_TTL=3600                 # 1 час по умолчанию
CACHE_COMPRESSION_THRESHOLD=512        # Сжимаем данные > 512 байт

# Service-specific TTLs
CONVERSATION_CACHE_TTL=86400           # 24 часа для разговоров
ANTISPAM_CACHE_TTL=1800               # 30 минут для антиспама
SHEETS_CACHE_TTL=300                  # 5 минут для Google Sheets
API_CACHE_TTL=60                      # 1 минута для API ответов
PRICING_CACHE_TTL=30                  # 30 секунд для цен

# Redis Configuration
REDIS_MAX_RETRIES=5
REDIS_CONNECT_TIMEOUT=10000
REDIS_COMMAND_TIMEOUT=5000
```

### Kubernetes ConfigMap:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: cache-config
data:
  CACHE_MEMORY_MB: "500"
  CACHE_REDIS_URL: "redis://redis-service:6379"
  CACHE_DEFAULT_TTL: "3600"
  CACHE_COMPRESSION_THRESHOLD: "512"
```

## Результаты миграции

### Ожидаемые улучшения:

1. **Производительность**:
   - Google Sheets API calls: -90%
   - Response time: -70%
   - Memory usage: оптимизировано с LRU

2. **Надёжность**:
   - Данные AntiSpam сохраняются при рестартах
   - Graceful degradation при недоступности Redis
   - Автоматическое восстановление

3. **Масштабируемость**:
   - Готовность к multi-instance deployment
   - Распределённый кеш через Redis
   - Эффективное использование ресурсов

4. **Мониторинг**:
   - Детальная статистика по namespace
   - Health checks
   - Рекомендации по оптимизации
