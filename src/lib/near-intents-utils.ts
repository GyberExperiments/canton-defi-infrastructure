/**
 * NEAR Intents Utilities
 * Вспомогательные функции для работы с NEAR Intents
 */

/**
 * Извлекает intent ID из transaction result или receipt
 */
export function extractIntentIdFromTransaction(
  transactionHash: string,
  receipt: any
): string | null {
  try {
    // Intent ID может быть в:
    // 1. Transaction receipt (если контракт возвращает его)
    // 2. Logs от контракта
    // 3. Нужно запросить через API статуса
    
    if (receipt?.receipts) {
      for (const receiptItem of receipt.receipts) {
        // Проверяем execution outcome
        const outcome = receiptItem.outcome
        if (outcome?.logs) {
          for (const log of outcome.logs) {
            // Ищем intent_id в логах
            const intentIdMatch = log.match(/intent_id[:\s]+([a-zA-Z0-9_-]+)/i)
            if (intentIdMatch) {
              return intentIdMatch[1]
            }
          }
        }
        
        // Проверяем возвращаемое значение из контракта
        if (outcome?.status?.SuccessValue) {
          try {
            const returnValue = Buffer.from(outcome.status.SuccessValue, 'base64').toString('utf-8')
            const parsed = JSON.parse(returnValue)
            if (parsed.intent_id || parsed.intentId) {
              return parsed.intent_id || parsed.intentId
            }
          } catch (e) {
            // Не удалось распарсить, продолжаем
          }
        }
      }
    }
    
    return null
  } catch (error) {
    console.error('Error extracting intent ID from transaction:', error)
    return null
  }
}

/**
 * Форматирует intent ID для отображения
 */
export function formatIntentId(intentId: string): string {
  if (!intentId) return ''
  
  // Если ID длинный, показываем первые и последние символы
  if (intentId.length > 20) {
    return `${intentId.substring(0, 8)}...${intentId.substring(intentId.length - 8)}`
  }
  
  return intentId
}

/**
 * Проверяет валидность intent ID формата
 */
export function isValidIntentId(intentId: string): boolean {
  if (!intentId || typeof intentId !== 'string') {
    return false
  }
  
  // Intent ID обычно состоит из букв, цифр и дефисов/подчеркиваний
  // Минимальная длина - обычно 10+ символов
  return /^[a-zA-Z0-9_-]{10,}$/.test(intentId)
}

/**
 * Создает explorer URL для intent (если доступен)
 */
export function getIntentExplorerUrl(
  intentId: string,
  network: 'mainnet' | 'testnet' = 'testnet'
): string | null {
  if (!isValidIntentId(intentId)) {
    return null
  }
  
  const baseUrl = network === 'mainnet'
    ? 'https://explorer.near.org'
    : 'https://explorer.testnet.near.org'
  
  // Если есть transaction hash - используем его
  // Иначе показываем account контракта
  return `${baseUrl}/transactions/${intentId}`
}

/**
 * Вычисляет deadline timestamp с запасом
 */
export function calculateDeadline(durationSeconds: number = 3600): number {
  return Math.floor(Date.now() / 1000) + durationSeconds
}

/**
 * Проверяет не истек ли deadline
 */
export function isDeadlineExpired(deadline: number): boolean {
  const now = Math.floor(Date.now() / 1000)
  return now >= deadline
}

/**
 * Форматирует оставшееся время до deadline
 */
export function formatTimeUntilDeadline(deadline: number): string {
  const now = Math.floor(Date.now() / 1000)
  const remaining = deadline - now
  
  if (remaining <= 0) {
    return 'Expired'
  }
  
  const hours = Math.floor(remaining / 3600)
  const minutes = Math.floor((remaining % 3600) / 60)
  const seconds = remaining % 60
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  } else {
    return `${seconds}s`
  }
}

/**
 * Конвертирует amount в наименьшие единицы токена (atoms)
 */
export function toTokenAtoms(amount: number, decimals: number): string {
  return BigInt(Math.floor(amount * Math.pow(10, decimals))).toString()
}

/**
 * Конвертирует из наименьших единиц токена в human-readable формат
 */
export function fromTokenAtoms(amount: string, decimals: number): number {
  try {
    const amountBN = BigInt(amount)
    const divisor = BigInt(Math.pow(10, decimals))
    return Number(amountBN) / Number(divisor)
  } catch (error) {
    console.error('Error converting from token atoms:', error)
    return 0
  }
}

/**
 * Получает decimals для токена по его символу
 */
export function getTokenDecimals(tokenSymbol: string): number {
  const decimalsMap: Record<string, number> = {
    'NEAR': 24,
    'USDT': 6,
    'USDC': 6,
    'ETH': 18,
    'BTC': 8,
    'DAI': 18,
  }
  
  return decimalsMap[tokenSymbol] || 18 // Default: 18 decimals
}

