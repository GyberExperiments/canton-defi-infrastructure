/**
 * Unified Price Oracle
 * Объединяет различные источники цен для получения best price
 */

import { getRefFinanceQuote, getRefTokenPrice, getBestRoute } from './ref-finance'
import { getPythPrice, getSwapRateFromPyth, getMultiplePythPrices } from './pyth-network'

export interface PriceQuote {
  source: 'ref' | 'pyth' | 'combined'
  tokenIn: string
  tokenOut: string
  amountIn: number
  estimatedOut: number
  swapRate: number
  priceImpact: number
  fee: number
  route?: string[]
  confidence?: number
}

/**
 * Получает лучшую цену из всех доступных источников
 */
export async function getBestPriceQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: number
): Promise<PriceQuote | null> {
  try {
    // Параллельно запрашиваем цены из разных источников
    const [refQuote, pythRate] = await Promise.all([
      getRefFinanceQuote(tokenIn, tokenOut, amountIn),
      getSwapRateFromPyth(tokenIn, tokenOut),
    ])

    // Если REF Finance доступен - используем его (более точный для конкретного amount)
    if (refQuote) {
      const tokenOutDecimals = tokenOut === 'USDT' || tokenOut === 'USDC' ? 6 : 24
      const estimatedOut = parseFloat(refQuote.estimatedOut) / Math.pow(10, tokenOutDecimals)
      const swapRate = estimatedOut / amountIn

      return {
        source: 'ref',
        tokenIn,
        tokenOut,
        amountIn,
        estimatedOut,
        swapRate,
        priceImpact: refQuote.priceImpact,
        fee: refQuote.fee || 0.003,
        route: refQuote.route,
      }
    }

    // Fallback на Pyth если REF недоступен
    if (pythRate) {
      const estimatedOut = amountIn * pythRate
      
      return {
        source: 'pyth',
        tokenIn,
        tokenOut,
        amountIn,
        estimatedOut,
        swapRate: pythRate,
        priceImpact: 0.1, // Показываем минимальный impact для oracle price
        fee: 0.003, // Default fee
      }
    }

    return null
  } catch (error) {
    console.error('Error getting best price quote:', error)
    return null
  }
}

/**
 * Получает текущую цену токена в USD
 */
export async function getTokenPriceInUSD(tokenSymbol: string): Promise<number | null> {
  try {
    // Пробуем REF Finance first (более точный для NEAR ecosystem)
    const refPrice = await getRefTokenPrice(tokenSymbol)
    if (refPrice !== null) {
      return refPrice
    }

    // Fallback на Pyth
    const pythPrice = await getPythPrice(tokenSymbol)
    if (pythPrice) {
      return pythPrice.price
    }

    return null
  } catch (error) {
    console.error('Error getting token price in USD:', error)
    return null
  }
}

/**
 * Получает цены для нескольких токенов одновременно
 */
export async function getMultipleTokenPrices(
  symbols: string[]
): Promise<Record<string, number>> {
  const results: Record<string, number> = {}

  // Пробуем Pyth batch request first (быстрее)
  const pythPrices = await getMultiplePythPrices(symbols)
  
  // Заполняем результаты из Pyth
  Object.entries(pythPrices).forEach(([symbol, data]) => {
    results[symbol] = data.price
  })

  // Для токенов которых нет в Pyth - пробуем REF
  for (const symbol of symbols) {
    if (!results[symbol]) {
      const refPrice = await getRefTokenPrice(symbol)
      if (refPrice !== null) {
        results[symbol] = refPrice
      }
    }
  }

  return results
}

/**
 * Вычисляет минимальную сумму получения с учетом slippage
 */
export function calculateMinReceive(
  estimatedOut: number,
  slippageTolerance: number = 0.005 // 0.5% default
): number {
  return estimatedOut * (1 - slippageTolerance)
}

/**
 * Вычисляет price impact для большого ордера
 */
export async function calculatePriceImpact(
  tokenIn: string,
  tokenOut: string,
  amountIn: number
): Promise<number> {
  try {
    // Получаем quote для маленькой суммы (1 токен)
    const smallAmountQuote = await getBestPriceQuote(tokenIn, tokenOut, 1)
    if (!smallAmountQuote) {
      return 0
    }

    // Получаем quote для реальной суммы
    const actualQuote = await getBestPriceQuote(tokenIn, tokenOut, amountIn)
    if (!actualQuote) {
      return 0
    }

    // Вычисляем price impact
    // Impact = (expected_rate - actual_rate) / expected_rate * 100
    const expectedRate = smallAmountQuote.swapRate
    const actualRate = actualQuote.swapRate
    const impact = ((expectedRate - actualRate) / expectedRate) * 100

    return Math.max(0, impact) // Не показываем negative impact
  } catch (error) {
    console.error('Error calculating price impact:', error)
    return 0
  }
}

