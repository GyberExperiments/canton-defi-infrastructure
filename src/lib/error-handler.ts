/**
 * 🚨 Centralized Error Handler
 *
 * Единая система обработки ошибок во всем приложении.
 *
 * Функции:
 * - Единый формат логирования
 * - Структурированные ошибки для клиента
 * - Интеграция с мониторингом
 * - Скрытие sensitive информации в production
 * - Retry логика
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import { NextResponse } from 'next/server';

/**
 * Тип контекста ошибки
 */
export interface ErrorContext {
  endpoint?: string;
  method?: string;
  userId?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  customData?: Record<string, any>;
}

/**
 * Структурированная ошибка для клиента
 */
export interface ClientErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  requestId?: string;
  timestamp: string;
}

/**
 * Внутренняя ошибка для логирования
 */
export interface InternalErrorLog {
  timestamp: string;
  code: string;
  message: string;
  stack?: string;
  context?: ErrorContext;
  severity: 'info' | 'warn' | 'error' | 'critical';
}

/**
 * Типы ошибок
 */
export enum ErrorCode {
  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED = 'MISSING_REQUIRED',

  // Authentication & Authorization
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',

  // Rate limiting
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  RATE_LIMITED = 'RATE_LIMITED',

  // Resource errors
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  CONFLICT = 'CONFLICT',

  // Server errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',

  // External service errors
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  TELEGRAM_ERROR = 'TELEGRAM_ERROR',
  EMAIL_ERROR = 'EMAIL_ERROR',
  GOOGLE_SHEETS_ERROR = 'GOOGLE_SHEETS_ERROR',

  // Business logic errors
  INVALID_ORDER = 'INVALID_ORDER',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  DUPLICATE_ORDER = 'DUPLICATE_ORDER',
}

/**
 * Маппинг ErrorCode на HTTP статус
 */
const ERROR_STATUS_MAP: Record<ErrorCode, number> = {
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.MISSING_REQUIRED]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.TOKEN_EXPIRED]: 401,
  [ErrorCode.TOO_MANY_REQUESTS]: 429,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.ALREADY_EXISTS]: 409,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.TIMEOUT]: 408,
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
  [ErrorCode.TELEGRAM_ERROR]: 502,
  [ErrorCode.EMAIL_ERROR]: 502,
  [ErrorCode.GOOGLE_SHEETS_ERROR]: 502,
  [ErrorCode.INVALID_ORDER]: 400,
  [ErrorCode.INSUFFICIENT_FUNDS]: 402,
  [ErrorCode.DUPLICATE_ORDER]: 409,
};

/**
 * Централизованный обработчик ошибок
 */
export class ErrorHandler {
  /**
   * Обработать ошибку
   */
  static handle(error: Error | unknown, context: ErrorContext = {}): InternalErrorLog {
    const code = this.getErrorCode(error);
    const severity = this.getSeverity(code);
    const message = this.getErrorMessage(error);
    const stack = error instanceof Error ? error.stack : undefined;

    const errorLog: InternalErrorLog = {
      timestamp: new Date().toISOString(),
      code,
      message,
      stack: process.env.NODE_ENV === 'development' ? stack : undefined,
      context: {
        endpoint: context.endpoint,
        method: context.method,
        userId: context.userId,
        requestId: context.requestId,
        ...context
      },
      severity
    };

    this.log(errorLog);

    return errorLog;
  }

  /**
   * Форматировать ошибку для клиента
   */
  static formatForClient(error: Error | unknown, code?: ErrorCode, requestId?: string): ClientErrorResponse {
    const errorCode = code || this.getErrorCode(error);
    const message = this.getClientMessage(errorCode);
    const details = this.getClientDetails(error, errorCode);

    return {
      success: false,
      error: {
        code: errorCode,
        message,
        ...(process.env.NODE_ENV === 'development' && { details })
      },
      requestId,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Создать NextResponse с ошибкой
   */
  static createErrorResponse(
    error: Error | unknown,
    code?: ErrorCode,
    requestId?: string
  ): NextResponse<ClientErrorResponse> {
    const errorCode = code || this.getErrorCode(error);
    const status = ERROR_STATUS_MAP[errorCode];
    const response = this.formatForClient(error, errorCode, requestId);

    return NextResponse.json(response, { status });
  }

  /**
   * Логировать ошибку во все системы мониторинга
   */
  static log(errorLog: InternalErrorLog): void {
    const { timestamp, code, message, severity, stack, context } = errorLog;

    // Консоль - маппируем severity на доступные методы console
    const consoleMethod = severity === 'critical' ? 'error' : severity;
    const logFn = (console as any)[consoleMethod] || console.error;
    logFn(`[${timestamp}] ${code}: ${message}`, {
      severity,
      context,
      ...(stack && { stack })
    });

    // Интеграция с мониторингом (если доступна)
    this.sendToMonitoring(errorLog);
  }

  /**
   * Отправить ошибку в систему мониторинга
   */
  private static sendToMonitoring(errorLog: InternalErrorLog): void {
    try {
      // Здесь можно добавить интеграцию с Sentry, DataDog, etc.
      if (process.env.NODE_ENV === 'production') {
        // Например: Sentry.captureException(error);
      }
    } catch (error) {
      // Не прерываем основную обработку ошибок
      console.error('Failed to send error to monitoring:', error);
    }
  }

  /**
   * Получить код ошибки
   */
  private static getErrorCode(error: Error | unknown): ErrorCode {
    if (error instanceof Error) {
      // Проверяем свойство code если оно есть
      if ('code' in error && typeof error.code === 'string') {
        return error.code as ErrorCode;
      }

      // Проверяем имя ошибки
      if (error.name === 'ValidationError') {
        return ErrorCode.VALIDATION_ERROR;
      }
      if (error.name === 'UnauthorizedError') {
        return ErrorCode.UNAUTHORIZED;
      }
      if (error.name === 'ForbiddenError') {
        return ErrorCode.FORBIDDEN;
      }
    }

    return ErrorCode.INTERNAL_ERROR;
  }

  /**
   * Получить уровень серьезности
   */
  private static getSeverity(code: ErrorCode): 'info' | 'warn' | 'error' | 'critical' {
    if (
      code === ErrorCode.VALIDATION_ERROR ||
      code === ErrorCode.INVALID_INPUT ||
      code === ErrorCode.NOT_FOUND
    ) {
      return 'warn';
    }

    if (
      code === ErrorCode.UNAUTHORIZED ||
      code === ErrorCode.FORBIDDEN ||
      code === ErrorCode.TOKEN_EXPIRED
    ) {
      return 'info';
    }

    if (
      code === ErrorCode.INTERNAL_ERROR ||
      code === ErrorCode.SERVICE_UNAVAILABLE ||
      code === ErrorCode.EXTERNAL_SERVICE_ERROR
    ) {
      return 'critical';
    }

    return 'error';
  }

  /**
   * Получить сообщение об ошибке
   */
  private static getErrorMessage(error: Error | unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'Unknown error';
  }

  /**
   * Получить сообщение для клиента (user-friendly)
   */
  private static getClientMessage(code: ErrorCode): string {
    const messages: Record<ErrorCode, string> = {
      [ErrorCode.VALIDATION_ERROR]: 'Ошибка валидации данных. Пожалуйста, проверьте вводимые данные.',
      [ErrorCode.INVALID_INPUT]: 'Некорректный ввод. Пожалуйста, проверьте данные.',
      [ErrorCode.MISSING_REQUIRED]: 'Отсутствуют обязательные поля.',
      [ErrorCode.UNAUTHORIZED]: 'Требуется аутентификация.',
      [ErrorCode.FORBIDDEN]: 'У вас нет прав доступа.',
      [ErrorCode.TOKEN_EXPIRED]: 'Ваша сессия истекла. Пожалуйста, авторизуйтесь заново.',
      [ErrorCode.TOO_MANY_REQUESTS]: 'Слишком много запросов. Пожалуйста, подождите.',
      [ErrorCode.RATE_LIMITED]: 'Превышен лимит запросов. Пожалуйста, попробуйте позже.',
      [ErrorCode.NOT_FOUND]: 'Ресурс не найден.',
      [ErrorCode.ALREADY_EXISTS]: 'Такой ресурс уже существует.',
      [ErrorCode.CONFLICT]: 'Конфликт данных. Пожалуйста, обновите страницу и попробуйте снова.',
      [ErrorCode.INTERNAL_ERROR]: 'Произошла ошибка сервера. Пожалуйста, попробуйте позже.',
      [ErrorCode.SERVICE_UNAVAILABLE]: 'Сервис временно недоступен.',
      [ErrorCode.TIMEOUT]: 'Время выполнения истекло. Пожалуйста, попробуйте позже.',
      [ErrorCode.EXTERNAL_SERVICE_ERROR]: 'Ошибка при обращении к внешнему сервису.',
      [ErrorCode.TELEGRAM_ERROR]: 'Ошибка при отправке сообщения.',
      [ErrorCode.EMAIL_ERROR]: 'Ошибка при отправке письма.',
      [ErrorCode.GOOGLE_SHEETS_ERROR]: 'Ошибка при сохранении данных.',
      [ErrorCode.INVALID_ORDER]: 'Некорректные параметры заказа.',
      [ErrorCode.INSUFFICIENT_FUNDS]: 'Недостаточно средств.',
      [ErrorCode.DUPLICATE_ORDER]: 'Такой заказ уже существует.',
    };

    return messages[code] || 'Произошла ошибка. Пожалуйста, попробуйте позже.';
  }

  /**
   * Получить детали ошибки для клиента (только в development)
   */
  private static getClientDetails(error: Error | unknown, code: ErrorCode): Record<string, any> | undefined {
    if (process.env.NODE_ENV !== 'development') {
      return undefined;
    }

    const details: Record<string, any> = {};

    if (error instanceof Error) {
      details.message = error.message;
      details.name = error.name;
    }

    return details;
  }
}

/**
 * Вспомогательная функция для создания custom ошибок
 */
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode?: number,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Результат валидации
 */
export interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  errors?: Record<string, string[]>;
}

/**
 * Базовый валидатор
 */
export abstract class BaseValidator {
  /**
   * Абстрактный метод валидации
   */
  abstract validate(data: any): ValidationResult<any>;
}
