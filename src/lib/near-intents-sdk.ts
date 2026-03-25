/**
 * NEAR Intents SDK Wrapper
 * Упрощенная интеграция с NEAR Intents смарт-контрактом
 * Поддерживает как view методы, так и подготовку транзакций для client-side signing
 */

import { getTestnetRpcProvider, getProviderByNetwork, view } from '@near-js/client'

export interface IntentStatus {
  status: 'pending' | 'filled' | 'expired' | 'cancelled'
  solver?: string
  filledAt?: number
  expiryAt?: number
  transactionHash?: string
}

export interface SwapIntentArgs {
  from_token: string
  from_chain: string
  to_token: string
  to_chain: string
  amount: string // В наименьших единицах токена
  min_receive: string // Минимальная сумма получения
  user_account: string
  deadline: number // Unix timestamp
  app_fees?: string // Комиссия DEX
  fee_recipient?: string // Получатель комиссии
}

export interface BridgeIntentArgs {
  from_chain: string
  to_chain: string
  amount: string
  user_account: string
  deadline: number
  app_fees?: string
  fee_recipient?: string
}

/**
 * NEAR Intents SDK класс
 * Предоставляет методы для взаимодействия с NEAR Intents смарт-контрактом
 */
export class NearIntentsSDK {
  private rpcProvider: any
  private network: 'mainnet' | 'testnet'
  private contractId: string

  constructor(network: 'mainnet' | 'testnet' = 'testnet', contractId?: string) {
    this.network = network
    this.contractId = contractId || process.env.NEAR_INTENTS_VERIFIER_CONTRACT || 'verifier.testnet'
    
    // Инициализируем RPC provider
    this.rpcProvider = network === 'testnet'
      ? getTestnetRpcProvider()
      : getProviderByNetwork('mainnet')
  }

  /**
   * Получает статус intent из смарт-контракта
   * View method - не требует подписания транзакции
   */
  async getIntentStatus(intentId: string): Promise<IntentStatus> {
    try {
      const statusData = await view<IntentStatus>({
        account: this.contractId,
        method: 'get_intent_status',
        args: { intent_id: intentId },
        deps: { rpcProvider: this.rpcProvider },
      })

      return statusData || {
        status: 'pending',
      }
    } catch (error: any) {
      console.error('Error getting intent status from contract:', error)
      
      // Если intent не найден, возвращаем pending
      return {
        status: 'pending',
      }
    }
  }

  /**
   * Получает список интентов пользователя
   * View method
   */
  async getIntentsByUser(userAccount: string): Promise<string[]> {
    try {
      const intents = await view<string[]>({
        account: this.contractId,
        method: 'get_intents_by_user',
        args: { user_account: userAccount },
        deps: { rpcProvider: this.rpcProvider },
      })

      return intents || []
    } catch (error: any) {
      console.error('Error getting user intents:', error)
      return []
    }
  }

  /**
   * Подготавливает данные транзакции для создания swap intent
   * Транзакция будет подписана на клиенте через wallet selector
   */
  prepareSwapIntentTransaction(args: SwapIntentArgs): {
    receiverId: string
    methodName: string
    args: SwapIntentArgs
    gas: string
    attachedDeposit: string
  } {
    return {
      receiverId: this.contractId,
      methodName: 'create_swap_intent',
      args,
      gas: '300000000000000', // 300 TGas
      attachedDeposit: '0', // Без депозита, комиссия через app_fees
    }
  }

  /**
   * Подготавливает данные транзакции для создания bridge intent
   * Транзакция будет подписана на клиенте через wallet selector
   */
  prepareBridgeIntentTransaction(args: BridgeIntentArgs): {
    receiverId: string
    methodName: string
    args: BridgeIntentArgs
    gas: string
    attachedDeposit: string
  } {
    return {
      receiverId: this.contractId,
      methodName: 'create_bridge_intent',
      args,
      gas: '300000000000000', // 300 TGas
      attachedDeposit: '0',
    }
  }

  /**
   * Подготавливает транзакцию для отмены intent
   */
  prepareCancelIntentTransaction(intentId: string, userAccount: string): {
    receiverId: string
    methodName: string
    args: { intent_id: string }
    gas: string
    attachedDeposit: string
  } {
    return {
      receiverId: this.contractId,
      methodName: 'cancel_intent',
      args: { intent_id: intentId },
      gas: '100000000000000', // 100 TGas для отмены
      attachedDeposit: '0',
    }
  }

  /**
   * Валидирует параметры swap intent перед созданием
   */
  validateSwapIntent(args: SwapIntentArgs): { valid: boolean; error?: string } {
    if (!args.from_token || !args.to_token) {
      return { valid: false, error: 'Tokens are required' }
    }

    if (args.from_token === args.to_token) {
      return { valid: false, error: 'From and to tokens must be different' }
    }

    if (!args.amount || BigInt(args.amount) <= BigInt(0)) {
      return { valid: false, error: 'Amount must be greater than 0' }
    }

    if (!args.min_receive || BigInt(args.min_receive) <= BigInt(0)) {
      return { valid: false, error: 'Min receive must be greater than 0' }
    }

    if (!args.user_account) {
      return { valid: false, error: 'User account is required' }
    }

    if (args.deadline <= Math.floor(Date.now() / 1000)) {
      return { valid: false, error: 'Deadline must be in the future' }
    }

    return { valid: true }
  }

  /**
   * Валидирует параметры bridge intent перед созданием
   */
  validateBridgeIntent(args: BridgeIntentArgs): { valid: boolean; error?: string } {
    if (!args.from_chain || !args.to_chain) {
      return { valid: false, error: 'Chains are required' }
    }

    if (args.from_chain === args.to_chain) {
      return { valid: false, error: 'Source and destination chains must be different' }
    }

    if (!args.amount || BigInt(args.amount) <= BigInt(0)) {
      return { valid: false, error: 'Amount must be greater than 0' }
    }

    if (!args.user_account) {
      return { valid: false, error: 'User account is required' }
    }

    if (args.deadline <= Math.floor(Date.now() / 1000)) {
      return { valid: false, error: 'Deadline must be in the future' }
    }

    return { valid: true }
  }

  /**
   * Получает информацию о контракте
   */
  getContractInfo() {
    return {
      contractId: this.contractId,
      network: this.network,
      rpcUrl: this.network === 'mainnet'
        ? 'https://rpc.mainnet.near.org'
        : 'https://rpc.testnet.near.org',
      explorerUrl: this.network === 'mainnet'
        ? 'https://explorer.near.org'
        : 'https://explorer.testnet.near.org',
    }
  }
}

/**
 * Создает экземпляр NEAR Intents SDK
 */
export function createNearIntentsSDK(
  network?: 'mainnet' | 'testnet',
  contractId?: string
): NearIntentsSDK {
  const networkId = network || (process.env.NEXT_PUBLIC_NEAR_NETWORK as 'mainnet' | 'testnet') || 'testnet'
  return new NearIntentsSDK(networkId, contractId)
}

/**
 * Singleton instance для использования в API routes
 */
let sdkInstance: NearIntentsSDK | null = null

/**
 * Получает singleton экземпляр SDK
 */
export function getNearIntentsSDK(): NearIntentsSDK {
  if (!sdkInstance) {
    const network = (process.env.NEXT_PUBLIC_NEAR_NETWORK as 'mainnet' | 'testnet') || 'testnet'
    sdkInstance = new NearIntentsSDK(network)
  }
  return sdkInstance
}

