/**
 * 📝 Centralized Logging Service
 * Production-ready logging with structured output
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'success';

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private isProduction = process.env.NODE_ENV === 'production';

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext = this.formatError(error);
    this.log('error', message, { ...context, ...errorContext });
  }

  /**
   * Log debug message (only in development)
   */
  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      this.log('debug', message, context);
    }
  }

  /**
   * Log success message
   */
  success(message: string, context?: LogContext): void {
    this.log('success', message, context);
  }

  /**
   * Core logging function
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    const timestamp = new Date().toISOString();
    const emoji = this.getEmoji(level);
    
    const logData = {
      timestamp,
      level,
      message,
      ...context,
    };

    if (this.isProduction) {
      // Production: Structured JSON logging
      console.log(JSON.stringify(logData));
    } else {
      // Development: Human-readable logging
      const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
      console.log(`${emoji} [${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`);
    }
  }

  /**
   * Get emoji for log level
   */
  private getEmoji(level: LogLevel): string {
    const emojiMap: Record<LogLevel, string> = {
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
      debug: '🔍',
      success: '✅',
    };
    return emojiMap[level] || 'ℹ️';
  }

  /**
   * Format error object for logging
   */
  private formatError(error: unknown): LogContext {
    if (error instanceof Error) {
      return {
        errorName: error.name,
        errorMessage: error.message,
        errorStack: this.isDevelopment ? error.stack : undefined,
      };
    }

    if (typeof error === 'object' && error !== null) {
      return { error };
    }

    return { error: String(error) };
  }

  /**
   * Log API request
   */
  logApiRequest(method: string, path: string, ip: string, context?: LogContext): void {
    this.info(`API Request: ${method} ${path}`, {
      method,
      path,
      ip,
      ...context,
    });
  }

  /**
   * Log API response
   */
  logApiResponse(method: string, path: string, statusCode: number, duration: number): void {
    const level = statusCode >= 400 ? 'error' : statusCode >= 300 ? 'warn' : 'info';
    this.log(level, `API Response: ${method} ${path}`, {
      method,
      path,
      statusCode,
      duration: `${duration}ms`,
    });
  }

  /**
   * Log service integration event
   */
  logServiceEvent(service: string, event: string, success: boolean, context?: LogContext): void {
    const level = success ? 'success' : 'error';
    this.log(level, `${service}: ${event}`, {
      service,
      event,
      success,
      ...context,
    });
  }

  /**
   * Log order event
   */
  logOrderEvent(orderId: string, event: string, context?: LogContext): void {
    this.info(`Order ${event}`, {
      orderId,
      event,
      ...context,
    });
  }
}

// Export singleton instance
export const logger = new Logger();
export default logger;



