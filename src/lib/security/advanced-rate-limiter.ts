/**
 * 🚦 Advanced Rate Limiter
 * Продвинутая система rate limiting для защиты admin endpoints
 * - Sliding window алгоритм
 * - Adaptive rate limiting на основе нагрузки
 * - IP whitelisting/blacklisting
 * - Distributed rate limiting с Redis
 * - Detailed analytics и reporting
 */

import { NextRequest, NextResponse } from 'next/server';
import { Redis } from 'ioredis';

export interface RateLimitRule {
  path: string | RegExp;
  method?: string | string[];
  windowMs: number;           // Окно времени в миллисекундах
  maxRequests: number;        // Максимум запросов в окне
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: NextRequest) => string;
  skip?: (req: NextRequest) => boolean | Promise<boolean>;
  onLimitReached?: (req: NextRequest, rateLimitInfo: RateLimitInfo) => void;
}

export interface RateLimitInfo {
  limit: number;
  current: number;
  remaining: number;
  resetTime: number;
  retryAfter: number;
}

export interface RateLimitStats {
  totalRequests: number;
  blockedRequests: number;
  uniqueIPs: Set<string>;
  topPaths: Map<string, number>;
  blocksByHour: Map<string, number>;
}

export class AdvancedRateLimiter {
  private static instance: AdvancedRateLimiter;
  private redis?: Redis;
  private rules: Map<string, RateLimitRule> = new Map();
  private stats: RateLimitStats = {
    totalRequests: 0,
    blockedRequests: 0,
    uniqueIPs: new Set(),
    topPaths: new Map(),
    blocksByHour: new Map()
  };
  
  // IP Whitelist (не ограничиваются)
  private whitelist: Set<string> = new Set([
    '127.0.0.1',
    '::1',
    'localhost'
  ]);
  
  // IP Blacklist (полностью заблокированы)
  private blacklist: Set<string> = new Set();
  
  // Adaptive rate limiting
  private systemLoadThreshold = 0.8;
  private adaptiveMultiplier = 1.0;

  constructor() {
    this.initializeRedis();
    this.setupDefaultRules();
    this.startStatisticsCollection();
  }

  static getInstance(): AdvancedRateLimiter {
    if (!AdvancedRateLimiter.instance) {
      AdvancedRateLimiter.instance = new AdvancedRateLimiter();
    }
    return AdvancedRateLimiter.instance;
  }

  private async initializeRedis(): Promise<void> {
    try {
      if (process.env.REDIS_URL) {
        this.redis = new Redis(process.env.REDIS_URL);
        await this.redis.ping();
        console.info('✅ Rate limiter connected to Redis');
      }
    } catch (error) {
      console.warn('⚠️ Rate limiter falling back to memory storage:', error);
    }
  }

  private setupDefaultRules(): void {
    // Строгие лимиты для admin endpoints
    this.addRule('admin_login', {
      path: /^\/api\/admin\/auth/,
      method: 'POST',
      windowMs: 15 * 60 * 1000,  // 15 минут
      maxRequests: 5,             // Максимум 5 попыток входа
      onLimitReached: (req) => {
        console.warn(`🚨 Admin login attempts exceeded from ${this.getClientIP(req)}`);
      }
    });

    this.addRule('admin_config', {
      path: /^\/api\/admin\/config/,
      method: ['GET', 'POST', 'PUT', 'PATCH'],
      windowMs: 5 * 60 * 1000,    // 5 минут
      maxRequests: 30,            // 30 запросов на изменение конфигурации
    });

    this.addRule('admin_users', {
      path: /^\/api\/admin\/users/,
      windowMs: 1 * 60 * 1000,    // 1 минута
      maxRequests: 10,            // 10 запросов управления пользователями
    });

    // Общие API endpoints
    this.addRule('api_general', {
      path: /^\/api\/(?!admin)/,
      windowMs: 1 * 60 * 1000,    // 1 минута
      maxRequests: 60,            // 60 запросов в минуту для обычных API
    });

    // Создание заказов
    this.addRule('orders_create', {
      path: /^\/api\/orders$/,
      method: 'POST',
      windowMs: 10 * 60 * 1000,   // 10 минут
      maxRequests: 3,             // Максимум 3 заказа в 10 минут
    });

    // Webhook endpoints (более строгие лимиты)
    this.addRule('webhooks', {
      path: /^\/api\/(telegram|intercom).*webhook/,
      windowMs: 1 * 60 * 1000,    // 1 минута
      maxRequests: 100,           // 100 webhook запросов в минуту
    });
  }

  /**
   * Добавление нового правила rate limiting
   */
  addRule(name: string, rule: RateLimitRule): void {
    this.rules.set(name, rule);
    console.info(`➕ Added rate limit rule: ${name}`, {
      path: rule.path,
      windowMs: rule.windowMs,
      maxRequests: rule.maxRequests
    });
  }

  /**
   * Middleware для Next.js API routes
   */
  middleware() {
    return async (req: NextRequest) => {
      
      
      try {
        // Получение информации о клиенте
        const clientIP = this.getClientIP(req);
        const path = req.nextUrl.pathname;
        const method = req.method;

        // Обновление статистики
        this.updateStats(clientIP, path);

        // Проверка blacklist
        if (this.blacklist.has(clientIP)) {
          return this.createErrorResponse(
            'IP address is blacklisted',
            'BLACKLISTED',
            429,
            { retryAfter: 3600 } // 1 час
          );
        }

        // Проверка whitelist (пропускаем rate limiting)
        if (this.whitelist.has(clientIP)) {
          return this.createSuccessResponse();
        }

        // Найти подходящее правило
        const matchingRule = this.findMatchingRule(path, method);
        if (!matchingRule) {
          return this.createSuccessResponse();
        }

        // Проверка skip условий
        if (matchingRule.skip && await matchingRule.skip(req)) {
          return this.createSuccessResponse();
        }

        // Генерация ключа для rate limiting
        const key = matchingRule.keyGenerator
          ? matchingRule.keyGenerator(req)
          : this.generateDefaultKey(clientIP, path, matchingRule);

        // Проверка rate limit
        const rateLimitInfo = await this.checkRateLimit(key, matchingRule);

        if (rateLimitInfo.current > rateLimitInfo.limit) {
          // Вызов callback при превышении лимита
          if (matchingRule.onLimitReached) {
            matchingRule.onLimitReached(req, rateLimitInfo);
          }

          // Обновление статистики блокировок
          this.stats.blockedRequests++;
          this.updateBlockStats();

          // Логирование
          console.warn(`🚦 Rate limit exceeded`, {
            ip: clientIP,
            path,
            method,
            limit: rateLimitInfo.limit,
            current: rateLimitInfo.current,
            key
          });

          return this.createErrorResponse(
            'Too many requests',
            'RATE_LIMITED',
            429,
            {
              retryAfter: Math.ceil(rateLimitInfo.retryAfter / 1000),
              limit: rateLimitInfo.limit,
              remaining: rateLimitInfo.remaining,
              resetTime: rateLimitInfo.resetTime
            }
          );
        }

        // Добавление headers с информацией о rate limiting
        return this.createSuccessResponse({
          'X-RateLimit-Limit': rateLimitInfo.limit.toString(),
          'X-RateLimit-Remaining': rateLimitInfo.remaining.toString(),
          'X-RateLimit-Reset': rateLimitInfo.resetTime.toString()
        });

      } catch (error) {
        console.error('Rate limiter error:', error);
        
        // В случае ошибки - пропускаем запрос (fail open)
        return this.createSuccessResponse();
      }
    };
  }

  /**
   * Проверка rate limit для ключа
   */
  private async checkRateLimit(
    key: string,
    rule: RateLimitRule
  ): Promise<RateLimitInfo> {
    const now = Date.now();
    const windowStart = now - rule.windowMs;
    
    // Adaptive rate limiting на основе нагрузки системы
    const adaptiveLimit = Math.floor(rule.maxRequests * this.adaptiveMultiplier);

    if (this.redis) {
      return await this.checkRateLimitRedis(key, rule, adaptiveLimit, now, windowStart);
    } else {
      return await this.checkRateLimitMemory(key, rule, adaptiveLimit, now, windowStart);
    }
  }

  /**
   * Rate limiting с использованием Redis (sliding window)
   */
  private async checkRateLimitRedis(
    key: string,
    rule: RateLimitRule,
    limit: number,
    now: number,
    windowStart: number
  ): Promise<RateLimitInfo> {
    const pipeline = this.redis!.pipeline();
    
    // Sliding window counter algorithm
    const windowKey = `rate_limit:${key}`;
    const requestId = `${now}:${Math.random()}`;

    // 1. Удаляем старые записи
    pipeline.zremrangebyscore(windowKey, '-inf', windowStart);
    
    // 2. Добавляем текущий запрос
    pipeline.zadd(windowKey, now, requestId);
    
    // 3. Получаем количество запросов в окне
    pipeline.zcard(windowKey);
    
    // 4. Устанавливаем TTL для ключа
    pipeline.expire(windowKey, Math.ceil(rule.windowMs / 1000) + 1);

    const results = await pipeline.exec();
    const currentCount = results![2][1] as number;

    const resetTime = windowStart + rule.windowMs;
    const remaining = Math.max(0, limit - currentCount);
    const retryAfter = currentCount > limit ? resetTime - now : 0;

    return {
      limit,
      current: currentCount,
      remaining,
      resetTime,
      retryAfter
    };
  }

  /**
   * Rate limiting в памяти (fallback)
   */
  private memoryStore = new Map<string, { requests: number[], lastReset: number }>();

  private async checkRateLimitMemory(
    key: string,
    rule: RateLimitRule,
    limit: number,
    now: number,
    windowStart: number
  ): Promise<RateLimitInfo> {
    let entry = this.memoryStore.get(key);
    
    if (!entry) {
      entry = { requests: [], lastReset: now };
      this.memoryStore.set(key, entry);
    }

    // Очистка старых запросов
    entry.requests = entry.requests.filter(timestamp => timestamp > windowStart);
    
    // Добавление текущего запроса
    entry.requests.push(now);
    entry.lastReset = now;

    const currentCount = entry.requests.length;
    const resetTime = windowStart + rule.windowMs;
    const remaining = Math.max(0, limit - currentCount);
    const retryAfter = currentCount > limit ? resetTime - now : 0;

    return {
      limit,
      current: currentCount,
      remaining,
      resetTime,
      retryAfter
    };
  }

  /**
   * Поиск подходящего правила
   */
  private findMatchingRule(path: string, method: string): RateLimitRule | null {
    for (const [, rule] of this.rules) {
      // Проверка пути
      const pathMatches = typeof rule.path === 'string'
        ? path === rule.path
        : rule.path.test(path);

      if (!pathMatches) continue;

      // Проверка метода
      if (rule.method) {
        const methodMatches = Array.isArray(rule.method)
          ? rule.method.includes(method)
          : rule.method === method;

        if (!methodMatches) continue;
      }

      return rule;
    }

    return null;
  }

  /**
   * Генерация ключа по умолчанию
   */
  private generateDefaultKey(ip: string, path: string, rule: RateLimitRule): string {
    return `${ip}:${path}:${rule.windowMs}`;
  }

  /**
   * Получение IP адреса клиента
   */
  private getClientIP(req: NextRequest): string {
    return (
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      req.headers.get('x-client-ip') ||
      'unknown'
    );
  }

  /**
   * Создание ответа об ошибке
   */
  private createErrorResponse(
    message: string,
    code: string,
    status: number,
    headers: Record<string, unknown> = {}
  ): NextResponse {
    const response = NextResponse.json({
      error: true,
      message,
      code,
      timestamp: Date.now(),
      ...headers
    }, { status });

    // Добавление security headers
    this.addSecurityHeaders(response);

    return response;
  }

  /**
   * Создание успешного ответа
   */
  private createSuccessResponse(headers: Record<string, string> = {}): NextResponse {
    const response = NextResponse.next();

    // Добавление rate limit headers
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    // Добавление security headers
    this.addSecurityHeaders(response);

    return response;
  }

  /**
   * Добавление security headers
   */
  private addSecurityHeaders(response: NextResponse): void {
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  }

  /**
   * Обновление статистики
   */
  private updateStats(ip: string, path: string): void {
    this.stats.totalRequests++;
    this.stats.uniqueIPs.add(ip);
    
    const currentCount = this.stats.topPaths.get(path) || 0;
    this.stats.topPaths.set(path, currentCount + 1);
  }

  /**
   * Обновление статистики блокировок
   */
  private updateBlockStats(): void {
    const hour = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
    const currentCount = this.stats.blocksByHour.get(hour) || 0;
    this.stats.blocksByHour.set(hour, currentCount + 1);
  }

  /**
   * Мониторинг нагрузки системы для adaptive rate limiting
   */
  private startStatisticsCollection(): void {
    setInterval(() => {
      this.updateAdaptiveMultiplier();
      this.cleanupOldStats();
    }, 60 * 1000); // Каждую минуту
  }

  private updateAdaptiveMultiplier(): void {
    // Простая эвристика: если много блокировок в последний час - снижаем лимиты
    const lastHour = new Date().toISOString().slice(0, 13);
    const blocksLastHour = this.stats.blocksByHour.get(lastHour) || 0;

    if (blocksLastHour > 100) {
      this.adaptiveMultiplier = Math.max(0.5, this.adaptiveMultiplier - 0.1);
    } else if (blocksLastHour < 10) {
      this.adaptiveMultiplier = Math.min(1.0, this.adaptiveMultiplier + 0.05);
    }

    console.debug(`🎯 Adaptive rate limit multiplier: ${this.adaptiveMultiplier.toFixed(2)}`);
  }

  private cleanupOldStats(): void {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 13);

    // Очистка старых данных блокировок
    for (const [hour] of this.stats.blocksByHour) {
      if (hour < twentyFourHoursAgo) {
        this.stats.blocksByHour.delete(hour);
      }
    }
  }

  /**
   * Управление IP списками
   */
  addToWhitelist(ip: string): void {
    this.whitelist.add(ip);
    console.info(`✅ Added ${ip} to whitelist`);
  }

  removeFromWhitelist(ip: string): void {
    this.whitelist.delete(ip);
    console.info(`❌ Removed ${ip} from whitelist`);
  }

  addToBlacklist(ip: string, duration?: number): void {
    this.blacklist.add(ip);
    console.warn(`🚫 Added ${ip} to blacklist`);

    if (duration) {
      setTimeout(() => {
        this.blacklist.delete(ip);
        console.info(`🔓 Removed ${ip} from blacklist after ${duration}ms`);
      }, duration);
    }
  }

  removeFromBlacklist(ip: string): void {
    this.blacklist.delete(ip);
    console.info(`🔓 Removed ${ip} from blacklist`);
  }

  /**
   * Получение статистики
   */
  getStats(): RateLimitStats & {
    whitelistCount: number;
    blacklistCount: number;
    adaptiveMultiplier: number;
  } {
    return {
      ...this.stats,
      whitelistCount: this.whitelist.size,
      blacklistCount: this.blacklist.size,
      adaptiveMultiplier: this.adaptiveMultiplier
    };
  }

  /**
   * Очистка ресурсов
   */
  destroy(): void {
    if (this.redis) {
      this.redis.disconnect();
    }
    this.memoryStore.clear();
  }
}

// Export singleton
export const advancedRateLimiter = AdvancedRateLimiter.getInstance();
