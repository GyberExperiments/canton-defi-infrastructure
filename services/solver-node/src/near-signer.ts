/**
 * NEAR Transaction Signer
 * Модуль для подписания и отправки транзакций в NEAR blockchain
 */

import { connect, keyStores, KeyPair, transactions, utils } from 'near-api-js'
import { InMemoryKeyStore } from 'near-api-js/lib/key_stores'

export interface SignerConfig {
  network: 'mainnet' | 'testnet'
  accountId: string
  privateKey: string
}

export interface TransactionParams {
  receiverId: string
  methodName: string
  args: Record<string, any>
  gas?: string
  attachedDeposit?: string
}

export interface TransactionResult {
  success: boolean
  transactionHash: string
  receipts?: any[]
  returnValue?: any
  error?: string
}

/**
 * NEAR Transaction Signer
 * Управляет подписанием и отправкой транзакций
 */
export class NearSigner {
  private connection: any
  private account: any
  private accountId: string
  private network: 'mainnet' | 'testnet'

  constructor(config: SignerConfig) {
    this.accountId = config.accountId
    this.network = config.network
  }

  /**
   * Инициализирует подключение к NEAR
   */
  async initialize(config: SignerConfig): Promise<void> {
    try {
      // Создаем KeyPair из приватного ключа
      const keyPair = KeyPair.fromString(config.privateKey as any)

      // Создаем in-memory keystore
      const keyStore = new InMemoryKeyStore()
      await keyStore.setKey(config.network, config.accountId, keyPair)

      // Конфигурация подключения
      const connectionConfig = {
        networkId: config.network,
        keyStore,
        nodeUrl: config.network === 'mainnet'
          ? 'https://rpc.mainnet.near.org'
          : 'https://rpc.testnet.near.org',
        walletUrl: config.network === 'mainnet'
          ? 'https://wallet.near.org'
          : 'https://wallet.testnet.near.org',
        helperUrl: config.network === 'mainnet'
          ? 'https://helper.mainnet.near.org'
          : 'https://helper.testnet.near.org',
      }

      // Подключаемся к NEAR
      this.connection = await connect(connectionConfig)
      this.account = await this.connection.account(config.accountId)

      console.log('✅ NEAR Signer initialized:', {
        network: config.network,
        accountId: config.accountId,
      })
    } catch (error: any) {
      console.error('❌ Failed to initialize NEAR Signer:', error)
      throw new Error(`NEAR Signer initialization failed: ${error.message}`)
    }
  }

  /**
   * Подписывает и отправляет транзакцию
   */
  async signAndSendTransaction(params: TransactionParams): Promise<TransactionResult> {
    try {
      if (!this.account) {
        throw new Error('NEAR Signer not initialized. Call initialize() first.')
      }

      console.log('📝 Signing transaction:', {
        from: this.accountId,
        to: params.receiverId,
        method: params.methodName,
        gas: params.gas,
        deposit: params.attachedDeposit,
      })

      // Вызываем метод контракта
      const result = await this.account.functionCall({
        contractId: params.receiverId,
        methodName: params.methodName,
        args: params.args,
        gas: params.gas || '300000000000000', // 300 TGas по умолчанию
        attachedDeposit: params.attachedDeposit || '0',
      })

      // Парсим результат
      const transactionHash = result.transaction.hash
      const receipts = result.receipts_outcome || []
      const returnValue = this.parseReturnValue(result)

      console.log('✅ Transaction successful:', {
        hash: transactionHash,
        receiptsCount: receipts.length,
      })

      return {
        success: true,
        transactionHash,
        receipts,
        returnValue,
      }
    } catch (error: any) {
      console.error('❌ Transaction failed:', error)
      
      return {
        success: false,
        transactionHash: '',
        error: error.message || 'Transaction signing failed',
      }
    }
  }

  /**
   * Вызывает ft_transfer_call для transfer + вызов метода в одной транзакции
   */
  async ftTransferCall(
    tokenContractId: string,
    receiverId: string,
    amount: string,
    msg: string,
    gas?: string,
    deposit?: string
  ): Promise<TransactionResult> {
    return this.signAndSendTransaction({
      receiverId: tokenContractId,
      methodName: 'ft_transfer_call',
      args: {
        receiver_id: receiverId,
        amount,
        msg,
      },
      gas: gas || '300000000000000', // 300 TGas
      attachedDeposit: deposit || '1', // 1 yoctoNEAR для security
    })
  }

  /**
   * Проверяет баланс токена
   */
  async checkTokenBalance(tokenContractId: string): Promise<string | null> {
    try {
      if (!this.account) {
        throw new Error('NEAR Signer not initialized')
      }

      const balance = await this.account.viewFunction({
        contractId: tokenContractId,
        methodName: 'ft_balance_of',
        args: { account_id: this.accountId },
      })

      return balance || '0'
    } catch (error: any) {
      console.error('Error checking token balance:', error)
      return null
    }
  }

  /**
   * Парсит return value из transaction result
   */
  private parseReturnValue(result: any): any {
    try {
      if (result.status?.SuccessValue) {
        const buffer = Buffer.from(result.status.SuccessValue, 'base64')
        const value = buffer.toString('utf-8')
        
        // Пробуем распарсить как JSON
        try {
          return JSON.parse(value)
        } catch {
          return value
        }
      }

      // Проверяем в receipts
      if (result.receipts_outcome && result.receipts_outcome.length > 0) {
        for (const receipt of result.receipts_outcome) {
          if (receipt.outcome?.status?.SuccessValue) {
            const buffer = Buffer.from(receipt.outcome.status.SuccessValue, 'base64')
            const value = buffer.toString('utf-8')
            
            try {
              return JSON.parse(value)
            } catch {
              return value
            }
          }
        }
      }

      return null
    } catch (error) {
      console.error('Error parsing return value:', error)
      return null
    }
  }

  /**
   * Получает account info
   */
  async getAccountInfo(): Promise<any> {
    try {
      if (!this.account) {
        throw new Error('NEAR Signer not initialized')
      }

      const state = await this.account.state()
      return {
        accountId: this.accountId,
        balance: utils.format.formatNearAmount(state.amount),
        storage: state.storage_usage,
      }
    } catch (error: any) {
      console.error('Error getting account info:', error)
      return null
    }
  }
}

/**
 * Создает и инициализирует NEAR Signer
 */
export async function createNearSigner(config: SignerConfig): Promise<NearSigner> {
  const signer = new NearSigner(config)
  await signer.initialize(config)
  return signer
}

