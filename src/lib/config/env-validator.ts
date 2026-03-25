/**
 * Environment Variables Validator
 * Проверяет наличие и корректность всех обязательных environment variables при старте приложения
 * 
 * КРИТИЧНО: Приложение не должно запускаться без критических секретов
 */

interface EnvVarDefinition {
  name: string
  required: boolean
  description: string
  validator?: (value: string) => { valid: boolean; error?: string }
}

/**
 * Определения обязательных и опциональных env переменных
 */
const ENV_VARIABLES: EnvVarDefinition[] = [
  // Критические секреты для работы приложения
  {
    name: 'NEXTAUTH_SECRET',
    required: true,
    description: 'NextAuth secret для JWT подписи',
    validator: (value) => {
      if (value.length < 32) {
        return { valid: false, error: 'NEXTAUTH_SECRET must be at least 32 characters long' }
      }
      if (value === 'build-time-placeholder') {
        return { valid: false, error: 'NEXTAUTH_SECRET cannot be a placeholder value' }
      }
      return { valid: true }
    }
  },
  {
    name: 'ADMIN_PASSWORD_HASH',
    required: true,
    description: 'Bcrypt hash пароля администратора',
    validator: (value) => {
      if (!value.startsWith('$2a$') && !value.startsWith('$2b$') && !value.startsWith('$2y$')) {
        return { valid: false, error: 'ADMIN_PASSWORD_HASH must be a valid bcrypt hash' }
      }
      return { valid: true }
    }
  },
  
  // Google Sheets интеграция
  {
    name: 'GOOGLE_SHEET_ID',
    required: true,
    description: 'Google Sheets ID для хранения ордеров'
  },
  {
    name: 'GOOGLE_SERVICE_ACCOUNT_EMAIL',
    required: true,
    description: 'Email сервисного аккаунта Google'
  },
  {
    name: 'GOOGLE_PRIVATE_KEY',
    required: true,
    description: 'Private key сервисного аккаунта Google',
    validator: (value) => {
      if (!value.includes('BEGIN PRIVATE KEY') || !value.includes('END PRIVATE KEY')) {
        return { valid: false, error: 'GOOGLE_PRIVATE_KEY must be a valid PEM format private key' }
      }
      return { valid: true }
    }
  },
  
  // Intercom интеграция
  {
    name: 'INTERCOM_ACCESS_TOKEN',
    required: true,
    description: 'Intercom API access token'
  },
  {
    name: 'INTERCOM_API_SECRET',
    required: true,
    description: 'Intercom API secret для Identity Verification'
  },
  
  // Telegram (опционально, если используется)
  {
    name: 'TELEGRAM_BOT_TOKEN',
    required: false,
    description: 'Telegram bot token (опционально)'
  },
  
  // NEAR DEX конфигурация
  {
    name: 'NEAR_DEX_FEE_RECIPIENT',
    required: false,
    description: 'NEAR account ID для получения комиссий DEX (рекомендуется для production)'
  },
  
  // Опциональные переменные
  {
    name: 'NEXT_PUBLIC_NEAR_NETWORK',
    required: false,
    description: 'NEAR network (testnet/mainnet), по умолчанию testnet'
  },
  {
    name: 'REDIS_URL',
    required: false,
    description: 'Redis URL для кеширования (опционально)'
  }
]

/**
 * Результат валидации env переменных
 */
export interface EnvValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  missing: string[]
  invalid: Array<{ name: string; error: string }>
}

/**
 * Валидирует все environment variables
 * @returns Результат валидации с детальной информацией об ошибках
 */
export function validateEnvironmentVariables(): EnvValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const missing: string[] = []
  const invalid: Array<{ name: string; error: string }> = []

  for (const envVar of ENV_VARIABLES) {
    const value = process.env[envVar.name]

    // Проверка обязательных переменных
    if (envVar.required) {
      if (!value || value.trim() === '') {
        missing.push(envVar.name)
        errors.push(`Missing required environment variable: ${envVar.name} - ${envVar.description}`)
        continue
      }
    } else {
      // Для опциональных переменных только предупреждение
      if (!value || value.trim() === '') {
        warnings.push(`Optional environment variable not set: ${envVar.name} - ${envVar.description}`)
        continue
      }
    }

    // Дополнительная валидация если есть validator
    if (value && envVar.validator) {
      const validation = envVar.validator(value)
      if (!validation.valid) {
        invalid.push({
          name: envVar.name,
          error: validation.error || 'Validation failed'
        })
        errors.push(`${envVar.name}: ${validation.error}`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    missing,
    invalid
  }
}

/**
 * Валидирует env переменные и выбрасывает ошибку если есть критические проблемы
 * Используется при старте приложения для fail-fast подхода
 */
export function validateAndThrowOnError(): void {
  const result = validateEnvironmentVariables()

  if (result.warnings.length > 0) {
    console.warn('⚠️ Environment variables warnings:')
    result.warnings.forEach(warning => console.warn(`   ${warning}`))
  }

  if (!result.valid) {
    console.error('❌ Environment variables validation failed:')
    result.errors.forEach(error => console.error(`   ${error}`))
    
    if (result.missing.length > 0) {
      console.error('\n📋 Missing required variables:')
      result.missing.forEach(name => console.error(`   - ${name}`))
    }
    
    if (result.invalid.length > 0) {
      console.error('\n❌ Invalid variables:')
      result.invalid.forEach(({ name, error }) => {
        console.error(`   - ${name}: ${error}`)
      })
    }
    
    throw new Error('Environment variables validation failed. Please check the errors above.')
  }

  console.log('✅ Environment variables validation passed')
}

/**
 * Проверяет наличие конкретной env переменной
 */
export function hasEnvVar(name: string): boolean {
  const value = process.env[name]
  return value !== undefined && value.trim() !== ''
}

/**
 * Получает значение env переменной с проверкой
 */
export function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name]
  if (!value || value.trim() === '') {
    if (defaultValue !== undefined) {
      return defaultValue
    }
    throw new Error(`Environment variable ${name} is not set and no default value provided`)
  }
  return value
}




