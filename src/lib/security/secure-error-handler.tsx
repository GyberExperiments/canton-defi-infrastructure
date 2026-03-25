/**
 * 🛡️ Secure Error Handler
 * Предотвращает утечки sensitive информации в production
 * - Маскирует stack traces в production
 * - Логирует полные ошибки для разработчиков
 * - Предотвращает утечку внутренней архитектуры
 * - Поддерживает структурированное логирование
 */

import React from 'react';
import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  ip?: string;
  path?: string;
  method?: string;
  timestamp?: number;
  requestId?: string;
}

export interface SecureErrorOptions {
  showStackTrace?: boolean;
  logLevel?: 'error' | 'warn' | 'info';
  includeContext?: boolean;
  maskSensitiveData?: boolean;
  reportToMonitoring?: boolean;
}

export class SecureErrorHandler {
  private static instance: SecureErrorHandler;
  private readonly isProduction = process.env.NODE_ENV === 'production';
  private readonly sensitivePatterns = [
    /password/i,
    /secret/i,
    /token/i,
    /key/i,
    /api_key/i,
    /private.*key/i,
    /hash/i,
    /salt/i,
    /seed/i,
    /mnemonic/i,
    /private.*phrase/i,
    /email.*password/i,
    /smtp.*password/i,
    /database.*url/i,
    /connection.*string/i
  ];

  static getInstance(): SecureErrorHandler {
    if (!SecureErrorHandler.instance) {
      SecureErrorHandler.instance = new SecureErrorHandler();
    }
    return SecureErrorHandler.instance;
  }

  /**
   * Основной метод обработки ошибок для API routes
   */
  handleAPIError(
    error: Error | unknown,
    context: ErrorContext = {},
    options: SecureErrorOptions = {}
  ): NextResponse {
    const errorId = this.generateErrorId();
    const sanitizedError = this.sanitizeError(error, context, errorId, options);

    // Логирование полной ошибки для разработчиков
    this.logError(error, context, errorId, options);

    // Мониторинг (если включен)
    if (options.reportToMonitoring) {
      this.reportToMonitoring(error, context, errorId);
    }

    return NextResponse.json(
      {
        error: true,
        message: sanitizedError.message,
        code: sanitizedError.code,
        errorId,
        timestamp: Date.now(),
        ...(this.shouldIncludeDebugInfo(options) && {
          debug: sanitizedError.debug
        })
      },
      { status: sanitizedError.status }
    );
  }

  /**
   * Обработка ошибок для React компонентов
   */
  handleClientError(
    error: Error | unknown,
    errorInfo?: { componentStack: string },
    context: Partial<ErrorContext> = {}
  ): {
    message: string;
    errorId: string;
    shouldReload?: boolean;
  } {
    const errorId = this.generateErrorId();
    const sanitizedError = this.sanitizeError(error, context, errorId);

    // Логирование
    this.logError(error, { ...context, componentStack: errorInfo?.componentStack }, errorId);

    return {
      message: sanitizedError.message,
      errorId,
      shouldReload: this.isCriticalError(error)
    };
  }

  /**
   * Middleware для Next.js API routes
   */
  middleware(handler: (...args: unknown[]) => Promise<Response>) {
    return async (req: NextRequest, ...args: unknown[]) => {
      try {
        return await handler(req, ...args);
      } catch (error) {
        const context: ErrorContext = {
          path: req.nextUrl.pathname,
          method: req.method,
          userAgent: req.headers.get('user-agent') || undefined,
          ip: this.getClientIP(req),
          timestamp: Date.now(),
          requestId: req.headers.get('x-request-id') || crypto.randomUUID()
        };

        return this.handleAPIError(error, context, {
          reportToMonitoring: true,
          includeContext: true
        });
      }
    };
  }

  /**
   * Валидация и санитизация ошибок
   */
  private sanitizeError(
    error: Error | unknown,
    context: Partial<ErrorContext>,
    errorId: string,
    options: SecureErrorOptions = {}
  ): {
    message: string;
    code: string;
    status: number;
    debug?: Record<string, unknown>;
  } {
    // Определение типа ошибки
    let message: string;
    let code: string;
    let status: number;
    let debug: Record<string, unknown> = {};

    if (error instanceof Error) {
      // Специальная обработка известных типов ошибок
      if (error.name === 'ValidationError') {
        message = this.isProduction ? 'Invalid input data' : error.message;
        code = 'VALIDATION_ERROR';
        status = 400;
      } else if (error.name === 'UnauthorizedError' || error.message.includes('unauthorized')) {
        message = 'Access denied';
        code = 'UNAUTHORIZED';
        status = 401;
      } else if (error.name === 'ForbiddenError' || error.message.includes('forbidden')) {
        message = 'Insufficient permissions';
        code = 'FORBIDDEN';
        status = 403;
      } else if (error.name === 'NotFoundError' || error.message.includes('not found')) {
        message = 'Resource not found';
        code = 'NOT_FOUND';
        status = 404;
      } else if (error.name === 'RateLimitError' || error.message.includes('rate limit')) {
        message = 'Too many requests';
        code = 'RATE_LIMITED';
        status = 429;
      } else if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
        message = 'Request timeout';
        code = 'TIMEOUT';
        status = 408;
      } else {
        // Общая ошибка сервера
        message = this.isProduction 
          ? 'An unexpected error occurred' 
          : this.maskSensitiveData(error.message);
        code = 'INTERNAL_ERROR';
        status = 500;
      }

      // Debug информация для development
      if (!this.isProduction || options.showStackTrace) {
        debug = {
          originalMessage: this.maskSensitiveData(error.message),
          name: error.name,
          ...(options.showStackTrace && error.stack && {
            stack: this.maskSensitiveData(error.stack)
          })
        };
      }
    } else {
      // Неизвестный тип ошибки
      message = this.isProduction ? 'An unexpected error occurred' : String(error);
      code = 'UNKNOWN_ERROR';
      status = 500;
    }

    return { message, code, status, debug };
  }

  /**
   * Маскировка sensitive данных
   */
  private maskSensitiveData(text: string): string {
    if (!text) return text;

    let maskedText = text;

    // Маскировка по паттернам
    for (const pattern of this.sensitivePatterns) {
      maskedText = maskedText.replace(pattern, '[MASKED]');
    }

    // Маскировка возможных токенов/ключей (длинные алфанумерные строки)
    maskedText = maskedText.replace(
      /\b[a-zA-Z0-9]{20,}\b/g,
      (match) => match.substring(0, 4) + '***' + match.substring(match.length - 4)
    );

    // Маскировка email адресов (кроме доменов)
    maskedText = maskedText.replace(
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      (email) => {
        const [user, domain] = email.split('@');
        return user.substring(0, 2) + '***@' + domain;
      }
    );

    // Маскировка IP адресов
    maskedText = maskedText.replace(
      /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
      (ip) => {
        const parts = ip.split('.');
        return `${parts[0]}.***.***.${parts[3]}`;
      }
    );

    return maskedText;
  }

  /**
   * Структурированное логирование
   */
  private logError(
    error: Error | unknown,
    context: Partial<ErrorContext & { componentStack?: string }>,
    errorId: string,
    options: SecureErrorOptions = {}
  ): void {
    const logLevel = options.logLevel || 'error';
    const timestamp = new Date().toISOString();

    const logData = {
      level: logLevel,
      timestamp,
      errorId,
      context: options.includeContext ? this.sanitizeContext(context) : undefined,
      error: {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        version: process.env.npm_package_version,
        platform: process.platform
      }
    };

    // Выбор метода логирования
    const logMessage = `[${errorId}] ${logData.error.message}`;

    switch (logLevel) {
      case 'error':
        console.error(logMessage, logData);
        break;
      case 'warn':
        console.warn(logMessage, logData);
        break;
      case 'info':
        console.info(logMessage, logData);
        break;
    }

    // В production логировать в файл или внешний сервис
    if (this.isProduction) {
      this.logToFile(logData);
    }
  }

  /**
   * Санитизация контекста
   */
  private sanitizeContext(context: Partial<ErrorContext & { componentStack?: string }>): Record<string, unknown> {
    return {
      ...context,
      userAgent: context.userAgent ? this.maskSensitiveData(context.userAgent) : undefined,
      ip: context.ip ? this.maskSensitiveData(context.ip) : undefined
    };
  }

  /**
   * Получение IP адреса клиента
   */
  private getClientIP(req: NextRequest): string {
    return (
      req.headers.get('x-forwarded-for')?.split(',')[0] ||
      req.headers.get('x-real-ip') ||
      req.headers.get('x-client-ip') ||
      'unknown'
    );
  }

  /**
   * Генерация уникального ID ошибки
   */
  private generateErrorId(): string {
    return `err_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Определение, нужно ли включать debug информацию
   */
  private shouldIncludeDebugInfo(options: SecureErrorOptions): boolean {
    return !this.isProduction || options.showStackTrace === true;
  }

  /**
   * Определение критичности ошибки
   */
  private isCriticalError(error: Error | unknown): boolean {
    if (!(error instanceof Error)) return false;

    const criticalPatterns = [
      /memory/i,
      /heap/i,
      /maximum call stack/i,
      /network/i,
      /connection/i,
      /database/i
    ];

    return criticalPatterns.some(pattern => pattern.test(error.message));
  }

  /**
   * Отправка в систему мониторинга
   */
  private async reportToMonitoring(
    error: Error | unknown,
    context: Partial<ErrorContext>,
    errorId: string
  ): Promise<void> {
    try {
      // Интеграция с внешними системами мониторинга
      // Например, Sentry, LogRocket, или custom endpoint
      
      if (process.env.MONITORING_WEBHOOK_URL) {
        const payload = {
          errorId,
          message: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
          environment: process.env.NODE_ENV,
          context: this.sanitizeContext(context)
        };

        await fetch(process.env.MONITORING_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
    } catch (monitoringError) {
      console.warn('Failed to report error to monitoring:', monitoringError);
    }
  }

  /**
   * Логирование в файл (для production)
   */
  private async logToFile(logData: Record<string, unknown>): Promise<void> {
    try {
      // В реальном production окружении лучше использовать
      // winston, pino или другую production-ready библиотеку логирования
      console.error('[PRODUCTION ERROR LOG]', JSON.stringify(logData));
    } catch (fileError) {
      console.error('Failed to log to file:', fileError);
    }
  }
}

// Export singleton и utility функции
export const secureErrorHandler = SecureErrorHandler.getInstance();

// HOC для React компонентов
export function withSecureErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>
): React.ComponentType<P> {
  return class SecureErrorBoundary extends React.Component<P, { hasError: boolean; errorId?: string }> {
    constructor(props: P) {
      super(props);
      this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): { hasError: boolean; errorId: string } {
      const result = secureErrorHandler.handleClientError(error);
      return {
        hasError: true,
        errorId: result.errorId
      };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
      secureErrorHandler.handleClientError(error, { componentStack: errorInfo.componentStack || '' });
    }

    render() {
      if (this.state.hasError) {
        return (
          <div className="error-fallback">
            <h2>Something went wrong</h2>
            <p>We&apos;ve been notified about this issue.</p>
            <p className="text-sm text-gray-500">Error ID: {this.state.errorId}</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
            >
              Try again
            </button>
          </div>
        );
      }

      return <WrappedComponent {...this.props} />;
    }
  };
}

// Middleware wrapper для API routes
export function withSecureErrorHandling(handler: (...args: unknown[]) => Promise<Response>) {
  return secureErrorHandler.middleware(handler);
}

