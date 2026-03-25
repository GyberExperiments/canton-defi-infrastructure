/**
 * NEAR Intents Integration Library
 * Интеграция с протоколом NEAR Intents для swap и bridge операций
 */

export interface SwapIntentParams {
  fromToken: string
  fromChain: string
  toToken: string
  toChain: string
  amount: number
  fee: number // Комиссия DEX в долях (0.003 = 0.3%)
  userAccount: string // NEAR account ID пользователя
}

export interface BridgeIntentParams {
  fromChain: string
  toChain: string
  amount: number
  fee: number // Комиссия DEX в долях (0.005 = 0.5%)
  userAccount: string // NEAR account ID пользователя
}

export interface IntentResult {
  success: boolean
  intentId?: string
  error?: string
  transactionHash?: string
  transactionData?: {
    receiverId: string
    methodName: string
    args: Record<string, any>
    gas: string
    attachedDeposit: string
  }
  feeInfo?: {
    percent: number
    amount: string
    recipient: string
  }
  message?: string
}

/**
 * Создает swap intent через NEAR Intents протокол
 * 
 * @param params Параметры swap intent
 * @returns Результат создания intent
 */
export async function createSwapIntent(params: SwapIntentParams): Promise<IntentResult> {
  try {
    const response = await fetch('/api/near-intents/swap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fromToken: params.fromToken,
        fromChain: params.fromChain,
        toToken: params.toToken,
        toChain: params.toChain,
        amount: params.amount,
        dexFee: params.fee, // Комиссия DEX
        userAccount: params.userAccount,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      return {
        success: false,
        error: error.error || `HTTP ${response.status}`,
      }
    }

    const data = await response.json()
    
    return {
      success: true,
      transactionData: data.transactionData,
      feeInfo: data.feeInfo,
      message: data.message,
      intentId: data.intentId, // Если есть в ответе
      transactionHash: data.transactionHash, // Если есть в ответе
    }
  } catch (error: any) {
    console.error('Error creating swap intent:', error)
    return {
      success: false,
      error: error.message || 'Failed to create swap intent',
    }
  }
}

/**
 * Создает bridge intent через NEAR Intents протокол
 * 
 * @param params Параметры bridge intent
 * @returns Результат создания intent
 */
export async function createBridgeIntent(params: BridgeIntentParams): Promise<IntentResult> {
  try {
    const response = await fetch('/api/near-intents/bridge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fromChain: params.fromChain,
        toChain: params.toChain,
        amount: params.amount,
        dexFee: params.fee, // Комиссия DEX
        userAccount: params.userAccount,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      return {
        success: false,
        error: error.error || `HTTP ${response.status}`,
      }
    }

    const data = await response.json()
    
    return {
      success: true,
      transactionData: data.transactionData,
      feeInfo: data.feeInfo,
      message: data.message,
      intentId: data.intentId, // Если есть в ответе
      transactionHash: data.transactionHash, // Если есть в ответе
    }
  } catch (error: any) {
    console.error('Error creating bridge intent:', error)
    return {
      success: false,
      error: error.message || 'Failed to create bridge intent',
    }
  }
}

/**
 * Получает статус intent по его ID
 * Использует API endpoint который вызывает SDK для получения статуса из контракта
 * 
 * @param intentId ID intent
 * @returns Статус intent
 */
export async function getIntentStatus(intentId: string): Promise<{
  status: 'pending' | 'filled' | 'expired' | 'cancelled'
  transactionHash?: string
  filledAt?: number
  expiryAt?: number
  solver?: string
  error?: string
}> {
  try {
    const response = await fetch(`/api/near-intents/status/${intentId}`, {
      next: { revalidate: 5 }, // Кешируем на 5 секунд
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error: any) {
    console.error('Error getting intent status:', error)
    return {
      status: 'cancelled',
      error: error.message || 'Failed to get intent status',
    }
  }
}

/**
 * Получает список всех интентов пользователя
 * 
 * @param userAccount NEAR account ID пользователя
 * @returns Список intent IDs
 */
export async function getUserIntents(userAccount: string): Promise<string[]> {
  try {
    const response = await fetch(`/api/near-intents/user/${userAccount}`, {
      next: { revalidate: 30 }, // Кешируем на 30 секунд
    })
    
    if (!response.ok) {
      // Если endpoint не доступен, возвращаем пустой массив
      if (response.status === 404) {
        return []
      }
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    return data.intentIds || []
  } catch (error: any) {
    console.error('Error getting user intents:', error)
    return []
  }
}

/**
 * Отменяет intent
 * 
 * @param intentId ID intent для отмены
 * @param userAccount NEAR account ID пользователя
 * @returns Transaction data для подписания
 */
export async function cancelIntent(
  intentId: string,
  userAccount: string
): Promise<{
  success: boolean
  transactionData?: {
    receiverId: string
    methodName: string
    args: Record<string, any>
    gas: string
    attachedDeposit: string
  }
  error?: string
}> {
  try {
    const response = await fetch('/api/near-intents/cancel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intentId,
        userAccount,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}`,
      }
    }

    const data = await response.json()
    
    return {
      success: true,
      transactionData: data.transactionData,
    }
  } catch (error: any) {
    console.error('Error cancelling intent:', error)
    return {
      success: false,
      error: error.message || 'Failed to cancel intent',
    }
  }
}

