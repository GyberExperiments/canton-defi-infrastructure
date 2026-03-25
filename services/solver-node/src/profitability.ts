/**
 * Profitability Calculator
 * Рассчитывает прибыльность исполнения intent
 */

import { PriceOracle, PriceQuote } from './price-oracle'

export interface Intent {
  intent_id: string
  from_token: string
  to_token: string
  amount: string
  min_receive: string
  deadline: number
  user_account: string
}

export interface ProfitabilityResult {
  isProfitable: boolean
  profit: number // В NEAR или USDT
  profitPercent: number
  estimatedOutput: number
  minReceive: number
  gasCost: number
  netProfit: number
  reason?: string
}

export class ProfitabilityCalculator {
  private priceOracle: PriceOracle
  private minProfitThreshold: number
  private maxGasCost: number

  constructor(priceOracle: PriceOracle) {
    this.priceOracle = priceOracle
    this.minProfitThreshold = parseFloat(process.env.SOLVER_MIN_PROFIT_THRESHOLD || '0.1')
    this.maxGasCost = parseFloat(process.env.SOLVER_MAX_GAS_COST || '0.01')
  }

  /**
   * Проверяет прибыльность исполнения intent
   */
  async checkProfitability(intent: Intent): Promise<ProfitabilityResult> {
    try {
      // 1. Проверяем deadline
      const now = Math.floor(Date.now() / 1000)
      if (intent.deadline <= now) {
        return {
          isProfitable: false,
          profit: 0,
          profitPercent: 0,
          estimatedOutput: 0,
          minReceive: 0,
          gasCost: 0,
          netProfit: 0,
          reason: 'Deadline expired',
        }
      }

      // 2. Получаем decimals
      const fromDecimals = this.priceOracle.getTokenDecimals(intent.from_token)
      const toDecimals = this.priceOracle.getTokenDecimals(intent.to_token)

      // 3. Конвертируем amounts
      const amountIn = this.priceOracle.fromTokenAtoms(intent.amount, fromDecimals)
      const minReceive = this.priceOracle.fromTokenAtoms(intent.min_receive, toDecimals)

      // 4. Получаем текущую цену на DEX
      const priceQuote = await this.priceOracle.getBestPrice(
        intent.from_token,
        intent.to_token,
        intent.amount
      )

      if (!priceQuote) {
        return {
          isProfitable: false,
          profit: 0,
          profitPercent: 0,
          estimatedOutput: 0,
          minReceive,
          gasCost: 0,
          netProfit: 0,
          reason: 'Price oracle unavailable',
        }
      }

      // 5. Рассчитываем прибыль
      const estimatedOutput = parseFloat(priceQuote.amountOut)
      const profit = estimatedOutput - minReceive
      const gasCost = this.maxGasCost // В NEAR (примерно)
      
      // Конвертируем gas cost в токен получателя если нужно
      let gasCostInOutputToken = gasCost
      if (intent.to_token !== 'NEAR') {
        // Конвертируем через текущую цену
        // Упрощенная версия - в реальности нужно использовать точную цену NEAR -> to_token
        gasCostInOutputToken = gasCost * 100 // Предположим 1 NEAR = 100 USDT (примерно)
      }

      const netProfit = profit - gasCostInOutputToken
      const profitPercent = (netProfit / minReceive) * 100

      // 6. Проверяем threshold
      const isProfitable = netProfit > this.minProfitThreshold && netProfit > 0

      return {
        isProfitable,
        profit,
        profitPercent,
        estimatedOutput,
        minReceive,
        gasCost: gasCostInOutputToken,
        netProfit,
        reason: isProfitable 
          ? `Profitable: ${netProfit.toFixed(2)} ${intent.to_token}`
          : `Not profitable: profit ${netProfit.toFixed(2)} < threshold ${this.minProfitThreshold}`,
      }
    } catch (error: any) {
      console.error('Error calculating profitability:', error)
      return {
        isProfitable: false,
        profit: 0,
        profitPercent: 0,
        estimatedOutput: 0,
        minReceive: 0,
        gasCost: 0,
        netProfit: 0,
        reason: `Error: ${error.message}`,
      }
    }
  }

  /**
   * Проверяет базовую валидность intent
   */
  isValidIntent(intent: Intent): boolean {
    if (!intent.intent_id || !intent.from_token || !intent.to_token) {
      return false
    }

    if (intent.from_token === intent.to_token) {
      return false
    }

    if (!intent.amount || BigInt(intent.amount) <= BigInt(0)) {
      return false
    }

    if (!intent.min_receive || BigInt(intent.min_receive) <= BigInt(0)) {
      return false
    }

    return true
  }
}

