/**
 * Startup Validator
 * Выполняет валидацию конфигурации при старте приложения
 * Вызывается в middleware или критических API routes
 */

import { validateEnvironmentVariables } from './env-validator'
import { validateDEXConfig } from '../dex-config'

let validationPerformed = false
let validationResult: { valid: boolean; errors: string[] } | null = null

/**
 * Выполняет валидацию конфигурации при старте
 * Кэширует результат для избежания повторных проверок
 */
export async function performStartupValidation(): Promise<{ valid: boolean; errors: string[] }> {
  // Если валидация уже выполнена, возвращаем кэшированный результат
  if (validationPerformed && validationResult) {
    return validationResult
  }

  const errors: string[] = []

  // 1. Валидация environment variables
  const envValidation = validateEnvironmentVariables()
  if (!envValidation.valid) {
    errors.push(...envValidation.errors)
  }

  // 2. Валидация DEX конфигурации
  try {
    const dexValidation = await validateDEXConfig()
    if (!dexValidation.valid) {
      errors.push(...dexValidation.errors)
    }
  } catch (error: any) {
    // DEX конфигурация не критична для старта, только предупреждение
    console.warn('⚠️ DEX config validation failed (non-critical):', error.message)
  }

  validationResult = {
    valid: errors.length === 0,
    errors
  }

  validationPerformed = true

  return validationResult
}

/**
 * Проверяет валидацию и выбрасывает ошибку если есть критические проблемы
 * Используется в критических местах для fail-fast подхода
 */
export async function validateStartupAndThrow(): Promise<void> {
  const result = await performStartupValidation()
  
  if (!result.valid) {
    console.error('❌ Startup validation failed:')
    result.errors.forEach(error => console.error(`   ${error}`))
    throw new Error('Startup validation failed. Please check the configuration.')
  }
}

/**
 * Сбрасывает кэш валидации (для тестирования или перезагрузки конфигурации)
 */
export function resetValidationCache(): void {
  validationPerformed = false
  validationResult = null
}




