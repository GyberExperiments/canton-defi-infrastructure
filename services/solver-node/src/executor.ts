/**
 * Intent Executor
 * Исполняет profitable intents через DEX
 */

import { NearSigner } from './near-signer'
import { Intent } from './profitability'
import { ProfitabilityResult } from './profitability'

export interface ExecutionResult {
  success: boolean
  transactionHash?: string
  error?: string
  intentId: string
}

export class IntentExecutor {
  private network: 'mainnet' | 'testnet'
  private contractId: string
  private solverAccountId: string
  private signer: NearSigner

  constructor(
    network: 'mainnet' | 'testnet',
    contractId: string,
    solverAccountId: string,
    signer: NearSigner
  ) {
    this.network = network
    this.contractId = contractId
    this.solverAccountId = solverAccountId
    this.signer = signer
  }

  /**
   * Исполняет intent через DEX и подтверждает в контракте
   */
  async executeIntent(
    intent: Intent,
    profitability: ProfitabilityResult
  ): Promise<ExecutionResult> {
    try {
      console.log(`🚀 Executing intent ${intent.intent_id}:`, {
        fromToken: intent.from_token,
        toToken: intent.to_token,
        amount: intent.amount,
        minReceive: intent.min_receive,
        estimatedOutput: profitability.estimatedOutput,
        netProfit: profitability.netProfit,
      })

      // Шаг 1: Выполняем swap через REF Finance
      const swapResult = await this.swapThroughRefFinance(intent, profitability)

      if (!swapResult.success) {
        console.error(`❌ Swap failed for intent ${intent.intent_id}:`, swapResult.error)
        return {
          success: false,
          intentId: intent.intent_id,
          error: swapResult.error || 'Swap failed',
        }
      }

      console.log(`✅ Swap successful for intent ${intent.intent_id}:`, {
        transactionHash: swapResult.transactionHash,
        amountOut: swapResult.amountOut,
      })

      // Шаг 2: Подтверждаем исполнение в NEAR Intents контракте
      const fulfilled = await this.fulfillIntent(
        intent.intent_id,
        swapResult.transactionHash!
      )

      if (!fulfilled) {
        console.warn(`⚠️ Swap successful but fulfill_intent failed for ${intent.intent_id}`)
        // Все равно возвращаем успех, так как swap прошел
        // fulfill_intent может быть вызван позже вручную
      }

      return {
        success: true,
        transactionHash: swapResult.transactionHash,
        intentId: intent.intent_id,
      }

      // После реализации будет так:
      /*
      // 1. Обмениваем через REF Finance
      const swapTx = await this.swapThroughRefFinance(intent, profitability)
      
      // 2. Подтверждаем исполнение в контракте
      const fulfillTx = await call({
        account: this.contractId,
        method: 'fulfill_intent',
        args: {
          intent_id: intent.intent_id,
          solver: this.solverAccountId,
        },
        deps: { rpcProvider: this.rpcProvider },
      })

      return {
        success: true,
        transactionHash: fulfillTx.transaction.hash,
        intentId: intent.intent_id,
      }
      */
    } catch (error: any) {
      console.error(`❌ Error executing intent ${intent.intent_id}:`, error)
      return {
        success: false,
        intentId: intent.intent_id,
        error: error.message || 'Execution failed',
      }
    }
  }

  /**
   * Обменивает токены через REF Finance
   */
  private async swapThroughRefFinance(
    intent: Intent,
    profitability: ProfitabilityResult
  ): Promise<SwapResult> {
    // Импортируем REF Finance swap module
    const { executeSwapThroughRefFinance } = await import('./ref-finance-swap')

    // Конвертируем intent параметры для REF Finance
    const swapParams = {
      tokenIn: intent.from_token,
      tokenOut: intent.to_token,
      amountIn: intent.amount,
      minAmountOut: intent.min_receive,
      solverAccountId: this.solverAccountId,
    }

    // Выполняем swap с использованием signer
    const result = await executeSwapThroughRefFinance(
      swapParams,
      this.network,
      this.signer
    )

    return result
  }

  /**
   * Подтверждает исполнение intent в контракте
   */
  private async fulfillIntent(
    intentId: string,
    transactionHash: string
  ): Promise<boolean> {
    try {
      console.log(`📝 Fulfilling intent ${intentId} in contract...`)

      const result = await this.signer.signAndSendTransaction({
        receiverId: this.contractId,
        methodName: 'fulfill_intent',
        args: {
          intent_id: intentId,
          solver: this.solverAccountId,
          transaction_hash: transactionHash,
        },
        gas: '100000000000000', // 100 TGas
        attachedDeposit: '0',
      })

      if (result.success) {
        console.log(`✅ Intent ${intentId} fulfilled successfully`)
        return true
      } else {
        console.error(`❌ Failed to fulfill intent ${intentId}:`, result.error)
        return false
      }
    } catch (error: any) {
      console.error(`❌ Error fulfilling intent ${intentId}:`, error)
      return false
    }
  }
}

interface SwapResult {
  success: boolean
  transactionHash?: string
  amountOut?: string
  error?: string
}

