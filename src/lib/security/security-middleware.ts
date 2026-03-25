/**
 * 🛡️ Security Middleware & CVE-2025-56200 Fix
 * Комплексная система безопасности включающая:
 * - Security Headers (CSP, HSTS, etc.)
 * - Безопасная валидация URL (fix для CVE-2025-56200)
 * - Input sanitization
 * - XSS/CSRF protection
 * - CORS configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { advancedRateLimiter } from './advanced-rate-limiter';
import * as crypto from 'crypto';

// Безопасная замена validator.js для CVE-2025-56200
class SecureValidator {
  /**
   * Безопасная валидация URL (исправление CVE-2025-56200)
   * Фикс для уязвимости в validator.js где isURL() использует ://
   * вместо : как разделитель протокола
   */
  static isURL(input: string, options: {
    protocols?: string[];
    requireProtocol?: boolean;
    allowDataUrl?: boolean;
    allowedHosts?: string[];
    disallowAuth?: boolean;
  } = {}): boolean {
    if (!input || typeof input !== 'string') {
      return false;
    }

    try {
      // CVE-2025-56200 Fix: Используем встроенный URL constructor
      // который правильно обрабатывает протоколы
      const url = new URL(input);
      
      // Проверка протокола
      const allowedProtocols = options.protocols || ['http', 'https'];
      if (!allowedProtocols.includes(url.protocol.slice(0, -1))) {
        return false;
      }

      // Проверка наличия протокола (если требуется)
      if (options.requireProtocol !== false && !url.protocol) {
        return false;
      }

      // Проверка data URLs
      if (!options.allowDataUrl && url.protocol === 'data:') {
        return false;
      }

      // Проверка разрешённых хостов
      if (options.allowedHosts && options.allowedHosts.length > 0) {
        if (!options.allowedHosts.includes(url.hostname)) {
          return false;
        }
      }

      // Проверка на auth в URL (user:pass@host)
      if (options.disallowAuth && (url.username || url.password)) {
        return false;
      }

      // Дополнительные проверки безопасности
      
      // Блокировка подозрительных протоколов
      const dangerousProtocols = [
        'javascript:', 'vbscript:', 'data:', 'file:', 'ftp:'
      ];
      
      if (dangerousProtocols.some(proto => url.protocol === proto)) {
        return false;
      }

      // Блокировка локальных/частных IP
      if (this.isPrivateIP(url.hostname)) {
        return false;
      }

      // Блокировка подозрительных доменов
      if (this.isSuspiciousDomain(url.hostname)) {
        return false;
      }

      return true;
    } catch {
      // URL constructor выбросил ошибку - невалидный URL
      return false;
    }
  }

  /**
   * Проверка на приватные/локальные IP адреса
   */
  private static isPrivateIP(hostname: string): boolean {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    
    if (!ipv4Regex.test(hostname)) {
      return false; // Не IP адрес
    }

    const parts = hostname.split('.').map(Number);
    
    // Проверка валидности IP
    if (parts.some(part => part < 0 || part > 255)) {
      return true; // Невалидный IP - блокируем
    }

    // RFC 1918 приватные диапазоны
    const [a, b] = parts;
    
    return (
      a === 10 ||                                    // 10.0.0.0/8
      (a === 172 && b >= 16 && b <= 31) ||         // 172.16.0.0/12
      (a === 192 && b === 168) ||                   // 192.168.0.0/16
      a === 127 ||                                  // 127.0.0.0/8 (loopback)
      a === 0 ||                                    // 0.0.0.0/8
      a >= 224                                      // Multicast и reserved
    );
  }

  /**
   * Проверка на подозрительные домены
   */
  private static isSuspiciousDomain(hostname: string): boolean {
    const suspiciousPatterns = [
      /localhost/i,
      /\.local$/i,
      /\.internal$/i,
      /\.corp$/i,
      /metadata\.google\.internal/i,    // AWS/GCP metadata
      /169\.254\./,                      // AWS metadata IP
      /\.onion$/i,                       // Tor domains
    ];

    return suspiciousPatterns.some(pattern => pattern.test(hostname));
  }

  /**
   * Валидация email с дополнительными проверками безопасности
   */
  static isEmail(input: string): boolean {
    if (!input || typeof input !== 'string') {
      return false;
    }

    // Базовая проверка формата
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input)) {
      return false;
    }

    // Проверка на подозрительные паттерны
    const suspiciousPatterns = [
      /@localhost/i,
      /@.*\.local$/i,
      /@test\./i,
      /@example\./i,
      /@tempmail\./i,
      /@10minutemail\./i,
    ];

    return !suspiciousPatterns.some(pattern => pattern.test(input));
  }
}

// CSP Nonce generator
class CSPNonceGenerator {
  private static nonces = new Map<string, { nonce: string; timestamp: number }>();
  
  static generateNonce(): string {
    const nonce = crypto.randomBytes(16).toString('base64');
    const requestId = crypto.randomUUID();
    
    this.nonces.set(requestId, {
      nonce,
      timestamp: Date.now()
    });
    
    // Очистка старых nonces (старше 1 часа)
    this.cleanupOldNonces();
    
    return nonce;
  }
  
  private static cleanupOldNonces(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    
    for (const [requestId, data] of this.nonces.entries()) {
      if (data.timestamp < oneHourAgo) {
        this.nonces.delete(requestId);
      }
    }
  }
}

export interface SecurityConfig {
  // CSP Configuration
  enableCSP?: boolean;
  cspDirectives?: Record<string, string[]>;
  
  // Headers Configuration
  enableSecurityHeaders?: boolean;
  customHeaders?: Record<string, string>;
  
  // Rate Limiting
  enableRateLimiting?: boolean;
  
  // Input Sanitization
  enableInputSanitization?: boolean;
  
  // CORS Configuration
  corsOrigins?: string[];
  corsCredentials?: boolean;
}

export class SecurityMiddleware {
  private static instance: SecurityMiddleware;
  private config: SecurityConfig;
  
  constructor(config: SecurityConfig = {}) {
    this.config = {
      enableCSP: true,
      enableSecurityHeaders: true,
      enableRateLimiting: true,
      enableInputSanitization: true,
      corsOrigins: [
        'https://1otc.cc',
        'https://stage.minimal.build.infra.1otc.cc',
        ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : [])
      ],
      corsCredentials: true,
      ...config
    };
  }

  static getInstance(config?: SecurityConfig): SecurityMiddleware {
    if (!SecurityMiddleware.instance) {
      SecurityMiddleware.instance = new SecurityMiddleware(config);
    }
    return SecurityMiddleware.instance;
  }

  /**
   * Главный middleware для обработки всех аспектов безопасности
   */
  async handle(request: NextRequest): Promise<NextResponse> {
    try {
      // 1. Rate Limiting (если включён)
      if (this.config.enableRateLimiting) {
        const rateLimitResponse = await advancedRateLimiter.middleware()(request);
        if (rateLimitResponse.status === 429) {
          return rateLimitResponse;
        }
      }

      // 2. CORS проверки
      const corsResponse = this.handleCORS(request);
      if (corsResponse) {
        return corsResponse;
      }

      // 3. Input Sanitization (для POST/PUT запросов)
      if (this.config.enableInputSanitization) {
        const sanitizationResult = await this.sanitizeRequest(request);
        if (!sanitizationResult.isValid) {
          return NextResponse.json(
            {
              error: true,
              message: sanitizationResult.reason,
              code: 'INVALID_INPUT'
            },
            { status: 400 }
          );
        }
      }

      // 4. Создание ответа с security headers
      const response = NextResponse.next();
      this.addSecurityHeaders(response, request);

      return response;

    } catch (error) {
      console.error('Security middleware error:', error);
      
      // В случае ошибки - пропускаем запрос с базовыми headers
      const response = NextResponse.next();
      this.addBasicSecurityHeaders(response);
      return response;
    }
  }

  /**
   * Обработка CORS
   */
  private handleCORS(request: NextRequest): NextResponse | null {
    const origin = request.headers.get('origin');
    const method = request.method;

    // Preflight requests
    if (method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 200 });
      
      if (origin && this.isAllowedOrigin(origin)) {
        response.headers.set('Access-Control-Allow-Origin', origin);
        if (this.config.corsCredentials) {
          response.headers.set('Access-Control-Allow-Credentials', 'true');
        }
      }

      response.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,X-Request-ID');
      response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours

      return response;
    }

    return null;
  }

  /**
   * Проверка разрешённых origins
   */
  private isAllowedOrigin(origin: string): boolean {
    if (!this.config.corsOrigins) return false;
    return this.config.corsOrigins.includes(origin);
  }

  /**
   * Санитизация входящих запросов
   */
  private async sanitizeRequest(request: NextRequest): Promise<{
    isValid: boolean;
    reason?: string;
  }> {
    try {
      const contentType = request.headers.get('content-type') || '';
      
      // Проверка JSON payload
      if (contentType.includes('application/json')) {
        const body = await request.text();
        
        // Проверка на подозрительные паттерны в JSON
        const suspiciousPatterns = [
          /__proto__/,
          /constructor/,
          /prototype/,
          /eval\(/,
          /Function\(/,
          /setTimeout\(/,
          /setInterval\(/,
          /<script/i,
          /javascript:/i,
          /vbscript:/i,
        ];

        for (const pattern of suspiciousPatterns) {
          if (pattern.test(body)) {
            return {
              isValid: false,
              reason: 'Suspicious content detected in request body'
            };
          }
        }

        // Попытка парсинга JSON
        try {
          const parsed = JSON.parse(body);
          
          // Проверка на prototype pollution
          if (this.hasPrototypePollution(parsed)) {
            return {
              isValid: false,
              reason: 'Potential prototype pollution detected'
            };
          }
          
        } catch {
          return {
            isValid: false,
            reason: 'Invalid JSON format'
          };
        }
      }

      // Валидация URL параметров
      const urlParams = request.nextUrl.searchParams;
      for (const [key, value] of urlParams.entries()) {
        // Проверка на XSS в параметрах
        if (this.containsXSSPayload(value)) {
          return {
            isValid: false,
            reason: `Suspicious content in URL parameter: ${key}`
          };
        }

        // Валидация URL параметров с помощью SecureValidator
        if (key.toLowerCase().includes('url') || key.toLowerCase().includes('redirect')) {
          if (!SecureValidator.isURL(value, {
            protocols: ['http', 'https'],
            requireProtocol: true,
            allowDataUrl: false,
            disallowAuth: true
          })) {
            return {
              isValid: false,
              reason: `Invalid URL in parameter: ${key}`
            };
          }
        }

        // Валидация email параметров
        if (key.toLowerCase().includes('email')) {
          if (!SecureValidator.isEmail(value)) {
            return {
              isValid: false,
              reason: `Invalid email in parameter: ${key}`
            };
          }
        }
      }

      return { isValid: true };

    } catch (error) {
      console.error('Request sanitization error:', error);
      return {
        isValid: false,
        reason: 'Request processing error'
      };
    }
  }

  /**
   * Проверка на prototype pollution
   */
  private hasPrototypePollution(obj: Record<string, unknown>, visited = new WeakSet()): boolean {
    if (obj === null || typeof obj !== 'object') {
      return false;
    }

    if (visited.has(obj)) {
      return false; // Циклическая ссылка
    }
    visited.add(obj);

    // Проверка на опасные ключи
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    
    for (const key of Object.keys(obj)) {
      if (dangerousKeys.includes(key)) {
        return true;
      }
      
      // Рекурсивная проверка
      const value = obj[key];
      if (value && typeof value === 'object' && this.hasPrototypePollution(value as Record<string, unknown>, visited)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Проверка на XSS payload
   */
  private containsXSSPayload(value: string): boolean {
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /onload=/gi,
      /onerror=/gi,
      /onclick=/gi,
      /onmouseover=/gi,
      /onfocus=/gi,
      /onblur=/gi,
      /eval\(/gi,
      /alert\(/gi,
      /confirm\(/gi,
      /prompt\(/gi,
      /document\.cookie/gi,
      /document\.write/gi,
      /window\.location/gi,
    ];

    return xssPatterns.some(pattern => pattern.test(value));
  }

  /**
   * Добавление полных security headers
   */
  private addSecurityHeaders(response: NextResponse, request: NextRequest): void {
    const origin = request.headers.get('origin');

    // CORS Headers
    if (origin && this.isAllowedOrigin(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      if (this.config.corsCredentials) {
        response.headers.set('Access-Control-Allow-Credentials', 'true');
      }
    }

    // Basic Security Headers
    this.addBasicSecurityHeaders(response);

    // CSP Header
    if (this.config.enableCSP) {
      const cspNonce = CSPNonceGenerator.generateNonce();
      const csp = this.buildCSP(cspNonce);
      response.headers.set('Content-Security-Policy', csp);
      response.headers.set('X-CSP-Nonce', cspNonce);
    }

    // Custom Headers
    if (this.config.customHeaders) {
      Object.entries(this.config.customHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
    }
  }

  /**
   * Базовые security headers
   */
  private addBasicSecurityHeaders(response: NextResponse): void {
    // Prevent MIME type sniffing
    response.headers.set('X-Content-Type-Options', 'nosniff');
    
    // Prevent clickjacking
    response.headers.set('X-Frame-Options', 'DENY');
    
    // XSS Protection
    response.headers.set('X-XSS-Protection', '1; mode=block');
    
    // HSTS (только для HTTPS)
    if (process.env.NODE_ENV === 'production') {
      response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    
    // Referrer Policy
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions Policy
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    
    // Cache Control для sensitive endpoints
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  }

  /**
   * Построение Content Security Policy
   */
  private buildCSP(nonce: string): string {
    const defaultDirectives = {
      'default-src': ["'self'"],
      'script-src': [
        "'self'",
        `'nonce-${nonce}'`,
        "'strict-dynamic'",
        // Разрешённые внешние скрипты
        'https://widget.intercom.io',
        'https://www.google-analytics.com',
        'https://connect.facebook.net',
        // Только для development
        ...(process.env.NODE_ENV === 'development' ? ["'unsafe-eval'"] : [])
      ],
      'style-src': [
        "'self'",
        "'unsafe-inline'", // Требуется для styled-components и Tailwind
        'https://fonts.googleapis.com'
      ],
      'font-src': [
        "'self'",
        'https://fonts.gstatic.com'
      ],
      'img-src': [
        "'self'",
        'data:',
        'https:',
        // CDN и внешние сервисы
        'https://static.intercomcdn.com',
        'https://downloads.intercomcdn.com'
      ],
      'connect-src': [
        "'self'",
        // API endpoints
        'https://api-iam.intercom.io',
        'https://widget.intercom.io',
        'https://nexus-websocket-a.intercom.io',
        'https://nexus-websocket-b.intercom.io',
        ...(process.env.NODE_ENV === 'development' ? ['ws://localhost:*', 'http://localhost:*'] : [])
      ],
      'frame-src': [
        "'self'",
        'https://widget.intercom.io'
      ],
      'worker-src': ["'self'", 'blob:'],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'upgrade-insecure-requests': []
    };

    // Merge with custom directives
    const mergedDirectives = {
      ...defaultDirectives,
      ...this.config.cspDirectives
    };

    // Build CSP string
    return Object.entries(mergedDirectives)
      .map(([directive, sources]) => {
        if (sources.length === 0) {
          return directive;
        }
        return `${directive} ${sources.join(' ')}`;
      })
      .join('; ');
  }
}

// Export instances and utilities
export const securityMiddleware = SecurityMiddleware.getInstance();
export { SecureValidator, CSPNonceGenerator };

// Middleware wrapper для использования в Next.js
export function withSecurityMiddleware(config?: SecurityConfig) {
  const middleware = SecurityMiddleware.getInstance(config);
  
  return async (request: NextRequest) => {
    return await middleware.handle(request);
  };
}
