/**
 * Log Sanitizer
 * Удаляет чувствительные данные из логов
 * 
 * ✅ PROB-011: Log Sanitization
 * Защищает от утечки секретов в логи production
 */

const SENSITIVE_PATTERNS = [
  // Telegram Bot Tokens (формат: 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz123456789)
  {
    pattern: /[0-9]{8,10}:[A-Za-z0-9_-]{35}/g,
    replacement: 'TELEGRAM_BOT_TOKEN_***'
  },
  // Telegram Session Strings (длинные base64 строки)
  {
    pattern: /1[A-Za-z0-9+/=]{200,}/g,
    replacement: 'SESSION_STRING_***'
  },
  // API Keys (различные форматы)
  {
    pattern: /sk_[a-zA-Z0-9]{24,}/g,
    replacement: 'API_KEY_***'
  },
  {
    pattern: /pk_[a-zA-Z0-9]{24,}/g,
    replacement: 'API_KEY_***'
  },
  // Bearer tokens
  {
    pattern: /Bearer [A-Za-z0-9._-]{20,}/g,
    replacement: 'Bearer ***'
  },
  // Supabase keys
  {
    pattern: /eyJ[a-zA-Z0-9_-]{100,}/g,
    replacement: 'JWT_TOKEN_***'
  },
  // Emails (частично маскируем домен)
  {
    pattern: /([a-zA-Z0-9._-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    replacement: '$1@***'
  },
  // Passwords в URL (password=...)
  {
    pattern: /password=[^&\s]+/gi,
    replacement: 'password=***'
  },
  // API secrets в конфигах
  {
    pattern: /(api[_-]?secret|secret[_-]?key|access[_-]?token)\s*[:=]\s*['"]?[A-Za-z0-9_-]{20,}['"]?/gi,
    replacement: '$1=***'
  }
];

/**
 * Санитизация строки - удаляет чувствительные данные
 */
export function sanitizeLog(message: any): any {
  if (typeof message === 'string') {
    let sanitized = message;
    
    for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, replacement);
    }
    
    return sanitized;
  }
  
  if (typeof message === 'object' && message !== null) {
    const sanitized: any = Array.isArray(message) ? [] : {};
    
    for (const key in message) {
      // Прямая проверка ключей с чувствительными названиями
      if (key.toLowerCase().includes('token') || 
          key.toLowerCase().includes('secret') || 
          key.toLowerCase().includes('password') ||
          key.toLowerCase().includes('key') ||
          key.toLowerCase().includes('session') ||
          key.toLowerCase().includes('auth') ||
          key.toLowerCase().includes('credential')) {
        sanitized[key] = '***';
      } else {
        // Рекурсивная санитизация вложенных объектов
        sanitized[key] = sanitizeLog(message[key]);
      }
    }
    
    return sanitized;
  }
  
  return message;
}

/**
 * Безопасные обертки для console методов
 * Автоматически санитизируют все аргументы
 */
export const safeLog = {
  log: (...args: any[]) => {
    const sanitized = args.map(sanitizeLog);
    console.log(...sanitized);
  },
  error: (...args: any[]) => {
    const sanitized = args.map(sanitizeLog);
    console.error(...sanitized);
  },
  warn: (...args: any[]) => {
    const sanitized = args.map(sanitizeLog);
    console.warn(...sanitized);
  },
  info: (...args: any[]) => {
    const sanitized = args.map(sanitizeLog);
    console.info(...sanitized);
  },
  debug: (...args: any[]) => {
    const sanitized = args.map(sanitizeLog);
    console.debug(...sanitized);
  }
};

/**
 * Санитизация объекта конфигурации
 * Полезно для логирования env переменных
 */
export function sanitizeConfig(config: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(config)) {
    if (key.toLowerCase().includes('token') ||
        key.toLowerCase().includes('secret') ||
        key.toLowerCase().includes('password') ||
        key.toLowerCase().includes('key') ||
        key.toLowerCase().includes('session') ||
        key.toLowerCase().includes('auth')) {
      sanitized[key] = '***';
    } else {
      sanitized[key] = typeof value === 'string' 
        ? sanitizeLog(value) 
        : value;
    }
  }
  
  return sanitized;
}

/**
 * Санитизация ошибки перед логированием
 */
export function sanitizeError(error: Error | unknown): {
  message: string;
  name?: string;
  stack?: string;
} {
  const errorObj = error instanceof Error ? error : new Error(String(error));
  
  return {
    message: sanitizeLog(errorObj.message) as string,
    name: errorObj.name,
    stack: errorObj.stack ? sanitizeLog(errorObj.stack) as string : undefined
  };
}
