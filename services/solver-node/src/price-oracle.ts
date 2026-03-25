/**
 * Price Oracle для Solver Node
 * Получает реальные цены с различных источников для расчета прибыльности
 */

import axios from 'axios'

export interface PriceQuote {
  tokenIn: string
  tokenOut: string
  amountIn: string
  amountOut: string
  price: number
  source: 'ref-finance' | 'pyth' | 'fallback'
}

export class PriceOracle {
  private refFinanceApi = process.env.REF_FINANCE_API || 'https://indexer.ref-finance.near.org'

  /**
   * Получает цену обмена через REF Finance
   */
  async getRefFinancePrice(
    tokenIn: string,
    tokenOut: string,
    amountIn: string
  ): Promise<PriceQuote | null> {
    try {
      const response = await axios.post(`${this.refFinanceApi}/get-quote`, {
        tokenIn,
        tokenOut,
        amountIn,
      }, {
        timeout: 5000,
      })

      if (response.data && response.data.estimatedOut) {
        const amountOut = response.data.estimatedOut
        const price = parseFloat(amountOut) / parseFloat(amountIn)

        return {
          tokenIn,
          tokenOut,
          amountIn,
          amountOut: amountOut.toString(),
          price,
          source: 'ref-finance',
        }
      }

      return null
    } catch (error) {
      console.error('Error fetching REF Finance price:', error)
      return null
    }
  }

  /**
   * Получает лучшую цену из всех доступных источников
   */
  async getBestPrice(
    tokenIn: string,
    tokenOut: string,
    amountIn: string
  ): Promise<PriceQuote | null> {
    // Пробуем REF Finance
    const refPrice = await this.getRefFinancePrice(tokenIn, tokenOut, amountIn)
    
    if (refPrice) {
      return refPrice
    }

    // Fallback: можно добавить другие источники
    // TODO: Pyth Network integration

    return null
  }

  /**
   * Конвертирует amount в наименьшие единицы токена
   */
  toTokenAtoms(amount: number, decimals: number): string {
    return BigInt(Math.floor(amount * Math.pow(10, decimals))).toString()
  }

  /**
   * Конвертирует из наименьших единиц токена
   */
  fromTokenAtoms(amount: string, decimals: number): number {
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
   * Получает decimals для токена
   */
  getTokenDecimals(tokenSymbol: string): number {
    const decimalsMap: Record<string, number> = {
      'NEAR': 24,
      'USDT': 6,
      'USDC': 6,
      'ETH': 18,
      'BTC': 8,
      'DAI': 18,
      'REF': 18,
    }

    return decimalsMap[tokenSymbol] || 18
  }
}

