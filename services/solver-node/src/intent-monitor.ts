/**
 * Intent Monitor
 * Сканирует блокчейн на наличие новых pending intents
 */

import { getTestnetRpcProvider, getProviderByNetwork, view } from '@near-js/client'
import { Intent } from './profitability'
import { ProfitabilityCalculator, ProfitabilityResult } from './profitability'
import { IntentExecutor } from './executor'

export class IntentMonitor {
  private network: 'mainnet' | 'testnet'
  private contractId: string
  private rpcProvider: any
  private profitabilityCalculator: ProfitabilityCalculator
  private executor: IntentExecutor
  private lastCheckedBlock: number = 0
  private isRunning: boolean = false
  private pollingInterval: number

  constructor(
    network: 'mainnet' | 'testnet',
    contractId: string,
    solverAccountId: string,
    profitabilityCalculator: ProfitabilityCalculator,
    executor: IntentExecutor
  ) {
    this.network = network
    this.contractId = contractId
    this.rpcProvider = network === 'testnet'
      ? getTestnetRpcProvider()
      : getProviderByNetwork('mainnet')
    this.profitabilityCalculator = profitabilityCalculator
    this.executor = executor
    this.pollingInterval = parseInt(process.env.SOLVER_POLLING_INTERVAL || '2000')
  }

  /**
   * Запускает мониторинг intents
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('⚠️ Intent monitor is already running')
      return
    }

    this.isRunning = true
    console.log('🚀 Starting Intent Monitor...', {
      network: this.network,
      contractId: this.contractId,
      pollingInterval: this.pollingInterval,
    })

    // Начинаем polling цикл
    await this.pollLoop()
  }

  /**
   * Останавливает мониторинг
   */
  stop(): void {
    this.isRunning = false
    console.log('⏹️  Stopping Intent Monitor')
  }

  /**
   * Основной polling цикл
   */
  private async pollLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.checkNewIntents()
      } catch (error: any) {
        console.error('❌ Error in poll loop:', error)
      }

      // Ждем перед следующим циклом
      await this.sleep(this.pollingInterval)
    }
  }

  /**
   * Проверяет новые intents в блокчейне
   */
  private async checkNewIntents(): Promise<void> {
    try {
      // Получаем pending intents из контракта
      // ⚠️ Метод get_pending_intents может не существовать в контракте
      // В реальности нужно использовать другой подход:
      // - Слушать события от контракта
      // - Или получать все intents и фильтровать по статусу
      
      let pendingIntents: Intent[] = []

      try {
        const intentsData = await view<{ intents: Intent[] }>({
          account: this.contractId,
          method: 'get_pending_intents',
          args: {
            from_block: this.lastCheckedBlock,
          },
          deps: { rpcProvider: this.rpcProvider },
        })

        pendingIntents = intentsData?.intents || []
      } catch (error: any) {
        // Если метод не поддерживается, пробуем альтернативный подход
        console.warn('⚠️ get_pending_intents not available, trying alternative method')
        
        // TODO: Альтернативный способ получения intents
        // Например, через get_intents_by_status('pending')
        pendingIntents = []
      }

      if (pendingIntents.length === 0) {
        // Нет новых intents, продолжаем мониторинг
        return
      }

      console.log(`📋 Found ${pendingIntents.length} pending intents`)

      // Обрабатываем каждый intent
      for (const intent of pendingIntents) {
        await this.processIntent(intent)
      }

      // Обновляем последний проверенный блок
      this.lastCheckedBlock = await this.getLatestBlock()
    } catch (error: any) {
      console.error('❌ Error checking new intents:', error)
    }
  }

  /**
   * Обрабатывает один intent
   */
  private async processIntent(intent: Intent): Promise<void> {
    try {
      // 1. Проверяем валидность
      if (!this.profitabilityCalculator.isValidIntent(intent)) {
        console.log(`⏭️  Skipping invalid intent: ${intent.intent_id}`)
        return
      }

      // 2. Проверяем прибыльность
      const profitability = await this.profitabilityCalculator.checkProfitability(intent)

      if (!profitability.isProfitable) {
        console.log(`💰 Intent ${intent.intent_id} not profitable:`, profitability.reason)
        return
      }

      // 3. Исполняем intent
      console.log(`✅ Intent ${intent.intent_id} is profitable, executing...`)
      const executionResult = await this.executor.executeIntent(intent, profitability)

      if (executionResult.success) {
        console.log(`🎉 Intent ${intent.intent_id} executed successfully:`, executionResult.transactionHash)
      } else {
        console.error(`❌ Failed to execute intent ${intent.intent_id}:`, executionResult.error)
      }
    } catch (error: any) {
      console.error(`❌ Error processing intent ${intent.intent_id}:`, error)
    }
  }

  /**
   * Получает номер последнего блока
   */
  private async getLatestBlock(): Promise<number> {
    try {
      // TODO: Получить реальный номер последнего блока через RPC
      // Пока возвращаем 0 как placeholder
      return 0
    } catch (error) {
      console.error('Error getting latest block:', error)
      return this.lastCheckedBlock
    }
  }

  /**
   * Утилита для sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

