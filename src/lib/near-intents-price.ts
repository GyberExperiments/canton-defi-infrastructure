/**
 * NEAR Intents Price Oracle
 * Интеграция с price oracles для получения реальных курсов обмена
 * Теперь использует unified price oracle (REF Finance + Pyth Network)
 */

import { getBestPriceQuote, getTokenPriceInUSD } from './price-oracle'

export interface TokenPrice {
  symbol: string
  priceUSD: number
  lastUpdated: number
}

export interface SwapRate {
  fromToken: string
  toToken: string
  rate: number // Сколько toToken получим за 1 fromToken
  priceImpact?: number // Процент price impact
  estimatedTime?: number // Оценка времени выполнения в секундах
  source?: 'ref' | 'pyth' | 'combined' // Источник цены
}

/**
 * Получает курс обмена между двумя токенами через NEAR Intents протокол
 * Использует unified price oracle (REF Finance + Pyth Network) для best price
 */
export async function getSwapRate(
  fromToken: string,
  toToken: string,
  amount: number
): Promise<SwapRate | null> {
  try {
    console.log(`Getting swap rate: ${fromToken} → ${toToken}, amount: ${amount}`)
    
    // Используем unified price oracle для получения best quote
    const priceQuote = await getBestPriceQuote(fromToken, toToken, amount)
    
    if (priceQuote) {
      return {
        fromToken,
        toToken,
        rate: priceQuote.swapRate,
        priceImpact: priceQuote.priceImpact,
        estimatedTime: 30, // 30 секунд для NEAR Intents
        source: priceQuote.source,
      }
    }

    // Fallback на базовый курс если oracle недоступен
    console.warn('Price oracle unavailable, using fallback rate')
    return {
      fromToken,
      toToken,
      rate: 1,
      priceImpact: 0,
      estimatedTime: 60, // Более длительное время при fallback
    }
  } catch (error) {
    console.error('Error getting swap rate:', error)
    return null
  }
}

/**
 * Получает USD цену токена через unified price oracle
 * Пробует REF Finance и Pyth Network, fallback на CoinGecko
 */
export async function getTokenPrice(tokenSymbol: string): Promise<TokenPrice | null> {
  try {
    // Пробуем unified price oracle first (REF Finance + Pyth)
    const oraclePrice = await getTokenPriceInUSD(tokenSymbol)
    
    if (oraclePrice !== null) {
      return {
        symbol: tokenSymbol,
        priceUSD: oraclePrice,
        lastUpdated: Date.now(),
      }
    }

    // Fallback на CoinGecko API если oracle недоступен
    console.warn(`Price oracle unavailable for ${tokenSymbol}, using CoinGecko fallback`)
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${getCoinGeckoId(tokenSymbol)}&vs_currencies=usd`,
      {
        next: { revalidate: 60 }, // Кешируем на 60 секунд
      }
    )
    
    if (!response.ok) {
      throw new Error('Failed to fetch token price from CoinGecko')
    }
    
    const data = await response.json()
    const coinGeckoId = getCoinGeckoId(tokenSymbol)
    const price = data[coinGeckoId]?.usd
    
    if (!price) {
      return null
    }
    
    return {
      symbol: tokenSymbol,
      priceUSD: price,
      lastUpdated: Date.now(),
    }
  } catch (error) {
    console.error('Error fetching token price:', error)
    return null
  }
}

/**
 * Конвертирует название токена в CoinGecko ID
 */
function getCoinGeckoId(symbol: string): string {
  const mapping: Record<string, string> = {
    'NEAR': 'near',
    'USDT': 'tether',
    'USDC': 'usd-coin',
    'ETH': 'ethereum',
  }
  return mapping[symbol] || symbol.toLowerCase()
}

/**
 * Рассчитывает итоговую сумму с учетом slippage tolerance
 */
export function calculateWithSlippage(
  amount: number,
  slippageTolerance: number
): {
  minAmount: number
  maxAmount: number
} {
  const slippageMultiplier = slippageTolerance / 100
  const minAmount = amount * (1 - slippageMultiplier)
  const maxAmount = amount * (1 + slippageMultiplier)
  
  return { minAmount, maxAmount }
}

/**
 * Форматирует время выполнения intent
 */
export function formatEstimatedTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`
  }
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m`
}

