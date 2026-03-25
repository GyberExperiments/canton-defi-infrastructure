/**
 * 🔒 Security utilities for admin panel
 */

// ✅ WHITELIST разрешенных секретов
export const ALLOWED_ADMIN_SECRETS = [
  'CANTON_COIN_BUY_PRICE_USD',
  'CANTON_COIN_SELL_PRICE_USD', 
  'MIN_USDT_AMOUNT',
  'MAX_USDT_AMOUNT',
  'BUSINESS_HOURS',
  'SUPPORT_EMAIL',
  'TELEGRAM_BOT_USERNAME',
] as const;

// ❌ ЗАЩИЩЕННЫЕ секреты (никогда не изменяются из админки)
export const PROTECTED_SECRETS = [
  'GITHUB_TOKEN',
  'KUBECONFIG',
  'GHCR_TOKEN',
  'NEXTAUTH_SECRET',
  'ADMIN_PASSWORD_HASH',
  'ADMIN_API_KEY',
  'GOOGLE_PRIVATE_KEY',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
  'SMTP_PASSWORD',
  'INTERCOM_ACCESS_TOKEN',
  'HD_WALLET_SEED',
  'TRON_API_KEY',
  'USDT_RECEIVING_ADDRESS',
  'ETH_RECEIVING_ADDRESS',
  'TRON_RECEIVING_ADDRESS',
  'SOLANA_RECEIVING_ADDRESS',
  'OPTIMISM_RECEIVING_ADDRESS',
  'REDIS_URL',
  'GOOGLE_SHEET_ID',
  'GOOGLE_SERVICE_ACCOUNT_EMAIL',
] as const;

/**
 * Проверить, разрешен ли секрет для изменения из админки
 */
export function isSecretAllowed(secretName: string): boolean {
  return ALLOWED_ADMIN_SECRETS.includes(secretName as typeof ALLOWED_ADMIN_SECRETS[number]);
}

/**
 * Проверить, защищен ли секрет от изменения
 */
export function isSecretProtected(secretName: string): boolean {
  return PROTECTED_SECRETS.includes(secretName as typeof PROTECTED_SECRETS[number]);
}

/**
 * Валидация цен на разумность
 */
export function validatePriceChange(oldPrice: number, newPrice: number, maxChangePercent: number = 50): boolean {
  const changePercent = Math.abs(newPrice - oldPrice) / oldPrice * 100;
  return changePercent <= maxChangePercent;
}

/**
 * Rate limiting для админских операций
 */
const rateLimitMap = new Map<string, number>();

export function checkRateLimit(key: string, windowMs: number = 60000): boolean {
  const now = Date.now();
  const lastUpdate = rateLimitMap.get(key);
  
  if (lastUpdate && now - lastUpdate < windowMs) {
    return false; // Rate limit exceeded
  }
  
  rateLimitMap.set(key, now);
  return true; // Rate limit OK
}

/**
 * Валидация входных данных для настроек
 */
export interface SettingsValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateSettingsUpdate(updates: Record<string, unknown>): SettingsValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Валидация цен
  if (updates.cantonCoinBuyPrice !== undefined) {
    if (typeof updates.cantonCoinBuyPrice !== 'number' || updates.cantonCoinBuyPrice <= 0) {
      errors.push('Buy price must be a positive number');
    } else if (updates.cantonCoinBuyPrice < 0.01 || updates.cantonCoinBuyPrice > 100) {
      warnings.push('Buy price seems unusually high or low');
    }
  }

  if (updates.cantonCoinSellPrice !== undefined) {
    if (typeof updates.cantonCoinSellPrice !== 'number' || updates.cantonCoinSellPrice <= 0) {
      errors.push('Sell price must be a positive number');
    } else if (updates.cantonCoinSellPrice < 0.01 || updates.cantonCoinSellPrice > 100) {
      warnings.push('Sell price seems unusually high or low');
    }
  }

  // Валидация соотношения цен
  if (updates.cantonCoinBuyPrice && updates.cantonCoinSellPrice) {
    const buyPrice = updates.cantonCoinBuyPrice as number;
    const sellPrice = updates.cantonCoinSellPrice as number;
    
    if (buyPrice <= sellPrice) {
      errors.push('Buy price must be higher than sell price');
    }
    
    const spread = (buyPrice - sellPrice) / buyPrice;
    if (spread < 0.05) { // Менее 5% спред
      warnings.push('Price spread is very small (<5%)');
    }
  }

  // Валидация лимитов
  if (updates.minAmount !== undefined) {
    if (typeof updates.minAmount !== 'number' || updates.minAmount <= 0) {
      errors.push('Min amount must be a positive number');
    } else if (updates.minAmount < 1) {
      warnings.push('Min amount is very low');
    }
  }

  if (updates.maxAmount !== undefined && updates.maxAmount !== null) {
    if (typeof updates.maxAmount !== 'number' || updates.maxAmount <= 0) {
      errors.push('Max amount must be a positive number or null');
    }
  }

  // Валидация email
  if (updates.supportEmail !== undefined) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (typeof updates.supportEmail !== 'string' || !emailRegex.test(updates.supportEmail)) {
      errors.push('Support email must be a valid email address');
    }
  }

  // Валидация Telegram username
  if (updates.telegramBotUsername !== undefined) {
    if (typeof updates.telegramBotUsername !== 'string' || !updates.telegramBotUsername.startsWith('@')) {
      errors.push('Telegram bot username must start with @');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Аудит операций
 */
export interface AuditLog {
  timestamp: string;
  user: string;
  action: string;
  details: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

export function logAuditEvent(
  user: string,
  action: string,
  details: Record<string, unknown>,
  ip?: string,
  userAgent?: string
): void {
  const auditLog: AuditLog = {
    timestamp: new Date().toISOString(),
    user,
    action,
    details,
    ip,
    userAgent
  };

  console.log('🔐 AUDIT LOG:', JSON.stringify(auditLog, null, 2));
  
  // В продакшне здесь можно добавить отправку в систему аудита
  // Например, в базу данных или внешний сервис логирования
}

/**
 * Безопасное логирование (скрывает чувствительные данные)
 */
export function safeLog(message: string, data?: unknown): void {
  if (data) {
    // Удаляем чувствительные поля
    const sanitizedData = { ...(data as Record<string, unknown>) };
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'hash'];
    
    for (const field of sensitiveFields) {
      if (sanitizedData[field]) {
        sanitizedData[field] = '[REDACTED]';
      }
    }
    
    console.log(message, sanitizedData);
  } else {
    console.log(message);
  }
}
