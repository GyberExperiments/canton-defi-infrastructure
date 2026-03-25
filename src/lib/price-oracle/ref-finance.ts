/**
 * REF Finance Price Oracle
 * Интеграция с REF Finance для получения реальных цен токенов на NEAR
 */

export interface RefPriceQuote {
  estimatedOut: string
  priceImpact: number
  route: string[]
  fee?: number
}

export interface TokenInfo {
  id: string
  symbol: string
  decimals: number
}

/**
 * Получает REF Finance token ID по символу
 * Расширенный список токенов NEAR экосистемы
 */
const REF_TOKEN_IDS: Record<string, string> = {
  // Native & Wrapped
  'NEAR': 'wrap.near',
  'WNEAR': 'wrap.near',
  
  // Stablecoins
  'USDT': 'usdt.tether-token.near',
  'USDC': 'usdc.fair-launch.testnet', // Testnet, mainnet: a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near
  'USDC.e': 'a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near',
  'DAI': '6b175474e89094c44da98b954eedeac495271d0f.factory.bridge.near',
  
  // Bitcoin
  'WBTC': '2260fac5e5542a773aa44fbcfedf7c193bc2c599.factory.bridge.near',
  'BTC': '2260fac5e5542a773aa44fbcfedf7c193bc2c599.factory.bridge.near',
  
  // Ethereum (Aurora)
  'ETH': 'aurora',
  'WETH': 'aurora',
  
  // NEAR Ecosystem
  'REF': 'token.ref-finance.near',
  'TRI': 'tri.tkn.near',
  'stNEAR': 'meta-pool.near',
  'NEARX': 'v3.oin_finance.near',
  'LINEAR': 'linear-protocol.near',
  'SWEAT': 'token.sweat',
  
  // More tokens
  'FRAX': '853d955acef822db058eb8505911ed77f175b99e.factory.bridge.near',
}

/**
 * Получает quote для обмена токенов через REF Finance
 */
export async function getRefFinanceQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: number
): Promise<RefPriceQuote | null> {
  try {
    const tokenInId = REF_TOKEN_IDS[tokenIn] || tokenIn.toLowerCase()
    const tokenOutId = REF_TOKEN_IDS[tokenOut] || tokenOut.toLowerCase()

    // REF Finance Indexer API для получения quote
    const response = await fetch(
      `https://indexer.ref-finance.near.org/get-quote?tokenIn=${tokenInId}&tokenOut=${tokenOutId}&amountIn=${(amountIn * 1e24).toString()}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      console.warn(`REF Finance API error: ${response.status}`)
      return null
    }

    const data = await response.json()

    if (!data || !data.estimatedOut) {
      return null
    }

    return {
      estimatedOut: data.estimatedOut,
      priceImpact: data.priceImpact || 0,
      route: data.route || [tokenInId, tokenOutId],
      fee: data.fee || 0.003, // 0.3% default REF fee
    }
  } catch (error) {
    console.error('Error fetching REF Finance quote:', error)
    return null
  }
}

/**
 * Получает текущую цену токена в USD через REF Finance
 */
export async function getRefTokenPrice(tokenSymbol: string): Promise<number | null> {
  try {
    // Для получения USD цены нужно обменять токен на USDT
    if (tokenSymbol === 'USDT' || tokenSymbol === 'USDC') {
      return 1.0
    }

    const quote = await getRefFinanceQuote(tokenSymbol, 'USDT', 1)
    if (!quote) {
      return null
    }

    // Конвертируем estimatedOut обратно в USD
    const priceInUSDT = parseFloat(quote.estimatedOut) / 1e6 // USDT decimals = 6
    return priceInUSDT
  } catch (error) {
    console.error('Error fetching token price from REF Finance:', error)
    return null
  }
}

/**
 * Вычисляет best route для обмена через REF Finance pools
 */
export async function getBestRoute(
  tokenIn: string,
  tokenOut: string,
  amountIn: number
): Promise<{
  route: string[]
  estimatedOut: number
  priceImpact: number
  fee: number
} | null> {
  try {
    const quote = await getRefFinanceQuote(tokenIn, tokenOut, amountIn)
    if (!quote) {
      return null
    }

    // Конвертируем estimatedOut обратно в readable формат
    const tokenOutDecimals = tokenOut === 'USDT' || tokenOut === 'USDC' ? 6 : 24
    const estimatedOut = parseFloat(quote.estimatedOut) / Math.pow(10, tokenOutDecimals)

    return {
      route: quote.route,
      estimatedOut,
      priceImpact: quote.priceImpact,
      fee: quote.fee || 0.003,
    }
  } catch (error) {
    console.error('Error getting best route:', error)
    return null
  }
}

