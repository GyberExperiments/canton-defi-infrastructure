/**
 * 🛡️⚡ Next.js Middleware - Security & Performance Integration
 * Интеграция всех систем безопасности и производительности:
 * - Rate limiting для всех endpoints
 * - Security headers и CSP
 * - Input sanitization
 * - Performance monitoring
 * - Error handling
 * - CORS configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurityMiddleware } from './src/lib/security/security-middleware';
import { secureErrorHandler } from './src/lib/security/secure-error-handler';

// ============================================================================
// MIDDLEWARE CONFIGURATION
// ============================================================================

const SECURITY_CONFIG = {
  enableCSP: true,
  enableSecurityHeaders: true,
  enableRateLimiting: true,
  enableInputSanitization: true,
  corsOrigins: [
    'https://1otc.cc',
    'https://stage.minimal.build.infra.1otc.cc',
    ...(process.env.NODE_ENV === 'development' ? [
      'http://localhost:3000',
      'http://localhost:3001'
    ] : [])
  ],
  corsCredentials: true,
  cspDirectives: {
    'script-src': [
      "'self'",
      "'unsafe-inline'", // Для styled-components в development
      'https://widget.intercom.io',
      'https://js.intercomcdn.com',
      ...(process.env.NODE_ENV === 'development' ? ["'unsafe-eval'"] : [])
    ],
    'connect-src': [
      "'self'",
      'https://api-iam.intercom.io',
      'https://widget.intercom.io',
      'https://nexus-websocket-a.intercom.io',
      'https://nexus-websocket-b.intercom.io',
      'wss://nexus-websocket-a.intercom.io',
      'wss://nexus-websocket-b.intercom.io',
      ...(process.env.NODE_ENV === 'development' ? [
        'ws://localhost:*',
        'http://localhost:*'
      ] : [])
    ]
  }
};

// Пути, которые должны пропускаться middleware
const BYPASS_PATHS = [
  '/_next',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.json',
  '/api/health', // Health check не должен rate limiting
];

// Пути с особыми правилами безопасности
const ADMIN_PATHS = [
  '/admin',
  '/api/admin'
];

const API_PATHS = [
  '/api'
];

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

class PerformanceMonitor {
  private static metrics = new Map<string, {
    count: number;
    totalTime: number;
    avgTime: number;
    maxTime: number;
    minTime: number;
  }>();

  static startTimer(path: string): string {
    const requestId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const start = performance.now();
    
    // Сохраняем время начала
    this.metrics.set(requestId, {
      count: 1,
      totalTime: start,
      avgTime: 0,
      maxTime: 0,
      minTime: Infinity
    });
    
    return requestId;
  }

  static endTimer(requestId: string, path: string): void {
    const end = performance.now();
    const startData = this.metrics.get(requestId);
    
    if (!startData) return;

    const duration = end - startData.totalTime;
    
    // Обновляем статистику для пути
    const pathKey = this.normalizePath(path);
    const existing = this.metrics.get(pathKey) || {
      count: 0,
      totalTime: 0,
      avgTime: 0,
      maxTime: 0,
      minTime: Infinity
    };

    existing.count++;
    existing.totalTime += duration;
    existing.avgTime = existing.totalTime / existing.count;
    existing.maxTime = Math.max(existing.maxTime, duration);
    existing.minTime = Math.min(existing.minTime, duration);

    this.metrics.set(pathKey, existing);

    // Логируем медленные запросы
    if (duration > 1000) { // > 1s
      console.warn(`🐌 Slow request detected: ${path}`, {
        duration: `${duration.toFixed(2)}ms`,
        requestId
      });
    }

    // Очищаем временную метрику
    this.metrics.delete(requestId);
  }

  private static normalizePath(path: string): string {
    // Нормализуем путь для группировки статистики
    return path
      .replace(/\/\d+/g, '/[id]')        // /api/orders/123 -> /api/orders/[id]
      .replace(/\?.*$/, '')              // Убираем query parameters
      .replace(/\/+$/, '') || '/';       // Убираем trailing slash
  }

  static getStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [path, metrics] of this.metrics.entries()) {
      if (!path.includes('_')) { // Исключаем временные метрики
        stats[path] = {
          requests: metrics.count,
          avgResponseTime: `${metrics.avgTime.toFixed(2)}ms`,
          maxResponseTime: `${metrics.maxTime.toFixed(2)}ms`,
          minResponseTime: `${metrics.minTime === Infinity ? 0 : metrics.minTime.toFixed(2)}ms`,
          totalTime: `${metrics.totalTime.toFixed(2)}ms`
        };
      }
    }
    
    return stats;
  }
}

// ============================================================================
// MAIN MIDDLEWARE FUNCTION
// ============================================================================

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const method = request.method;
  const startTime = Date.now();
  
  try {
    // Проверяем нужно ли пропустить middleware
    if (shouldBypass(path)) {
      return NextResponse.next();
    }

    // Стартуем мониторинг производительности
    const requestId = PerformanceMonitor.startTimer(path);

    // Логирование входящих запросов (только в development)
    if (process.env.NODE_ENV === 'development') {
      console.log(`📡 ${method} ${path}`, {
        userAgent: request.headers.get('user-agent')?.substring(0, 50),
        ip: getClientIP(request)
      });
    }

    // ============================================================================
    // ПРИМЕНЕНИЕ SECURITY MIDDLEWARE
    // ============================================================================

    const securityMiddleware = withSecurityMiddleware(SECURITY_CONFIG);
    const securityResponse = await securityMiddleware(request);

    // Если security middleware вернул ошибку (например, rate limit)
    if (securityResponse.status >= 400) {
      PerformanceMonitor.endTimer(requestId, path);
      return securityResponse;
    }

    // ============================================================================
    // ДОПОЛНИТЕЛЬНЫЕ ПРОВЕРКИ ДЛЯ ADMIN PATHS
    // ============================================================================

    if (isAdminPath(path)) {
      const adminCheckResponse = await handleAdminPath(request);
      if (adminCheckResponse) {
        PerformanceMonitor.endTimer(requestId, path);
        return adminCheckResponse;
      }
    }

    // ============================================================================
    // API SPECIFIC OPTIMIZATIONS
    // ============================================================================

    if (isAPIPath(path)) {
      const apiResponse = await handleAPIPath(request);
      if (apiResponse) {
        PerformanceMonitor.endTimer(requestId, path);
        return apiResponse;
      }
    }

    // ============================================================================
    // СОЗДАНИЕ ФИНАЛЬНОГО ОТВЕТА
    // ============================================================================

    const response = NextResponse.next();
    
    // Добавляем дополнительные headers
    addPerformanceHeaders(response, request);
    addSecurityHeaders(response, request);
    
    // Завершаем мониторинг производительности
    PerformanceMonitor.endTimer(requestId, path);
    
    // Добавляем метрики производительности в response (только в development)
    if (process.env.NODE_ENV === 'development') {
      const processingTime = Date.now() - startTime;
      response.headers.set('X-Processing-Time', `${processingTime}ms`);
      response.headers.set('X-Request-ID', requestId);
    }

    return response;

  } catch (error) {
    console.error('Middleware error:', error);
    
    // Используем secure error handler
    return secureErrorHandler.handleAPIError(error, {
      path,
      method,
      userAgent: request.headers.get('user-agent') || undefined,
      ip: getClientIP(request),
      timestamp: Date.now()
    }, {
      reportToMonitoring: true,
      showStackTrace: process.env.NODE_ENV === 'development'
    });
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function shouldBypass(path: string): boolean {
  return BYPASS_PATHS.some(bypassPath => 
    path.startsWith(bypassPath) || path === bypassPath
  );
}

function isAdminPath(path: string): boolean {
  return ADMIN_PATHS.some(adminPath => path.startsWith(adminPath));
}

function isAPIPath(path: string): boolean {
  return API_PATHS.some(apiPath => path.startsWith(apiPath));
}

function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-client-ip') ||
    'unknown'
  );
}

/**
 * Дополнительная обработка admin paths
 */
async function handleAdminPath(request: NextRequest): Promise<NextResponse | null> {
  const path = request.nextUrl.pathname;
  
  // Дополнительные проверки для admin панели
  if (path.startsWith('/admin') && !path.startsWith('/api/admin')) {
    // Проверяем есть ли активная сессия (правильные имена cookie для NextAuth v5)
    const authCookie = request.cookies.get('authjs.session-token') || 
                       request.cookies.get('__Secure-authjs.session-token');
    
    if (!authCookie && !path.includes('/login')) {
      // Редирект на страницу входа для неаутентифицированных пользователей
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('callbackUrl', path);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Дополнительная защита для admin API
  if (path.startsWith('/api/admin')) {
    // Проверяем Content-Type для POST/PUT запросов
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      const contentType = request.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return NextResponse.json(
          { error: 'Invalid Content-Type', code: 'INVALID_CONTENT_TYPE' },
          { status: 400 }
        );
      }
    }

    // Проверяем наличие CSRF token (если настроен)
    const csrfToken = request.headers.get('x-csrf-token');
    if (process.env.ENABLE_CSRF_PROTECTION === 'true' && !csrfToken) {
      return NextResponse.json(
        { error: 'Missing CSRF token', code: 'MISSING_CSRF_TOKEN' },
        { status: 403 }
      );
    }
  }

  return null;
}

/**
 * Оптимизации для API endpoints
 */
async function handleAPIPath(request: NextRequest): Promise<NextResponse | null> {
  const path = request.nextUrl.pathname;
  
  // Добавляем Vary header для правильного кеширования
  const response = NextResponse.next();
  response.headers.set('Vary', 'Accept-Encoding, Authorization');
  
  // Специальная обработка для webhook endpoints
  if (path.includes('webhook')) {
    // Webhook endpoints должны быть быстрыми
    const userAgent = request.headers.get('user-agent') || '';
    
    // Проверяем что это реальный webhook (упрощённая проверка)
    const isValidWebhook = userAgent.includes('Intercom') || 
                          userAgent.includes('Telegram') ||
                          request.headers.has('x-webhook-signature');
    
    if (!isValidWebhook && process.env.NODE_ENV === 'production') {
      console.warn(`Suspicious webhook request: ${path}`, {
        userAgent,
        ip: getClientIP(request)
      });
    }
  }

  return null;
}

/**
 * Добавление performance headers
 */
function addPerformanceHeaders(response: NextResponse, request: NextRequest): void {
  // Server timing (для debugging)
  if (process.env.NODE_ENV === 'development') {
    response.headers.set('Server-Timing', 'middleware;dur=0');
  }
  
  // Cache control для API endpoints
  const path = request.nextUrl.pathname;
  if (path.startsWith('/api/')) {
    if (path.includes('/config') || path.includes('/public')) {
      // Короткое кеширование для конфигурации
      response.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
    } else {
      // Без кеширования для остальных API
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    }
  }
}

/**
 * Добавление security headers
 */
function addSecurityHeaders(response: NextResponse, request: NextRequest): void {
  // Request ID для трейсинга
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  response.headers.set('X-Request-ID', requestId);
  
  // Дополнительные security headers
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // Feature Policy для дополнительной безопасности
  response.headers.set('Permissions-Policy', 
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=()'
  );
}

// ============================================================================
// MIDDLEWARE CONFIGURATION
// ============================================================================

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - robots.txt
     * - sitemap.xml
     * - manifest.json
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.json).*)',
  ],
};

// ============================================================================
// PERFORMANCE MONITORING ENDPOINT
// ============================================================================

// Экспортируем функцию для получения статистики производительности
export function getMiddlewareStats() {
  return PerformanceMonitor.getStats();
}
