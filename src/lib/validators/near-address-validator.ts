/**
 * NEAR Address Validator
 * Валидация формата NEAR account ID согласно спецификации NEAR Protocol
 * 
 * Формат NEAR account ID:
 * - Длина: от 2 до 64 символов
 * - Символы: строчные буквы (a-z), цифры (0-9), разделители (., -, _)
 * - Не может начинаться или заканчиваться разделителями
 * - Не может содержать последовательные разделители
 */

/**
 * Валидирует формат NEAR account ID
 * @param accountId NEAR account ID для валидации
 * @returns true если валидный, false если нет
 */
export function validateNearAccountId(accountId: string): boolean {
  if (!accountId || typeof accountId !== 'string') {
    return false
  }

  const trimmed = accountId.trim()

  // Проверка длины: от 2 до 64 символов
  if (trimmed.length < 2 || trimmed.length > 64) {
    return false
  }

  // Проверка что не начинается и не заканчивается разделителями
  if (/^[._-]/.test(trimmed) || /[._-]$/.test(trimmed)) {
    return false
  }

  // Проверка на последовательные разделители
  if (/[._-]{2,}/.test(trimmed)) {
    return false
  }

  // Проверка что содержит только допустимые символы: a-z, 0-9, ., -, _
  // И что содержит хотя бы один буквенно-цифровой символ
  const nearAccountRegex = /^(?=.{2,64}$)(?!.*[._-]{2})[a-z0-9]+(?:[._-][a-z0-9]+)*$/
  
  return nearAccountRegex.test(trimmed)
}

/**
 * Валидирует NEAR account ID и возвращает детальную информацию
 * @param accountId NEAR account ID для валидации
 * @returns Объект с результатом валидации и деталями ошибки
 */
export function validateNearAccountIdDetailed(accountId: string): {
  valid: boolean
  error?: string
} {
  if (!accountId || typeof accountId !== 'string') {
    return {
      valid: false,
      error: 'Account ID is required and must be a string'
    }
  }

  const trimmed = accountId.trim()

  if (trimmed.length < 2) {
    return {
      valid: false,
      error: 'Account ID must be at least 2 characters long'
    }
  }

  if (trimmed.length > 64) {
    return {
      valid: false,
      error: 'Account ID must be at most 64 characters long'
    }
  }

  if (/^[._-]/.test(trimmed)) {
    return {
      valid: false,
      error: 'Account ID cannot start with a separator (., -, _)'
    }
  }

  if (/[._-]$/.test(trimmed)) {
    return {
      valid: false,
      error: 'Account ID cannot end with a separator (., -, _)'
    }
  }

  if (/[._-]{2,}/.test(trimmed)) {
    return {
      valid: false,
      error: 'Account ID cannot contain consecutive separators'
    }
  }

  const nearAccountRegex = /^(?=.{2,64}$)(?!.*[._-]{2})[a-z0-9]+(?:[._-][a-z0-9]+)*$/
  
  if (!nearAccountRegex.test(trimmed)) {
    return {
      valid: false,
      error: 'Account ID contains invalid characters. Only lowercase letters (a-z), digits (0-9), and separators (., -, _) are allowed'
    }
  }

  return { valid: true }
}




