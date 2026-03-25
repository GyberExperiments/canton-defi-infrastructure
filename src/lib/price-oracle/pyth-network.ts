/**
 * Pyth Network Price Oracle
 * Интеграция с Pyth Network для получения real-time цен токенов
 * Pyth Network предоставляет криптографически верифицированные цены
 */

export interface PythPriceData {
  price: number
  confidence: number
  timestamp: number
  symbol: string
}

/**
 * Pyth Network Price Feed IDs
 * Эти ID используются для получения цен через Pyth API
 */
const PYTH_PRICE_FEED_IDS: Record<string, string> = {
  'NEAR': '0xc415de8d2eba7db216527dff4b60e8f3a5311c740dadb233e13e12547e226750',
  'ETH': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  'USDT': '0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b',
  'USDC': '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
  'BTC': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
}

/**
 * Hermes Pyth API endpoint (для NEAR ecosystem)
 */
const PYTH_HERMES_API = 'https://hermes.pyth.network'

/**
 * Получает цену токена из Pyth Network
 */
export async function getPythPrice(symbol: string): Promise<PythPriceData | null> {
  try {
    const priceFeedId = PYTH_PRICE_FEED_IDS[symbol]
    if (!priceFeedId) {
      console.warn(`Pyth price feed not found for ${symbol}`)
      return null
    }

    // Pyth Hermes API для получения latest price
    const response = await fetch(
      `${PYTH_HERMES_API}/api/latest_price_feeds?ids[]=${priceFeedId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      console.warn(`Pyth API error: ${response.status}`)
      return null
    }

    const data = await response.json()

    if (!data || !data.length || !data[0].price) {
      return null
    }

    const priceFeed = data[0]
    const price = priceFeed.price
    const expo = priceFeed.expo || -8 // Default exponent для большинства токенов

    // Конвертируем price с учетом exponent
    // price = actual_price * 10^(-expo)
    const actualPrice = parseFloat(price.price) * Math.pow(10, expo)

    return {
      price: actualPrice,
      confidence: parseFloat(price.conf) * Math.pow(10, expo),
      timestamp: price.publish_time,
      symbol,
    }
  } catch (error) {
    console.error('Error fetching Pyth price:', error)
    return null
  }
}

/**
 * Получает цены для нескольких токенов одновременно
 */
export async function getMultiplePythPrices(
  symbols: string[]
): Promise<Record<string, PythPriceData>> {
  const results: Record<string, PythPriceData> = {}
  
  // Pyth поддерживает batch requests
  const priceFeedIds = symbols
    .map(s => PYTH_PRICE_FEED_IDS[s])
    .filter(Boolean)

  if (priceFeedIds.length === 0) {
    return results
  }

  try {
    const idsParam = priceFeedIds.map(id => `ids[]=${id}`).join('&')
    const response = await fetch(
      `${PYTH_HERMES_API}/api/latest_price_feeds?${idsParam}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      console.warn(`Pyth batch API error: ${response.status}`)
      return results
    }

    const data = await response.json()

    // Маппим результаты обратно к символам
    data.forEach((feed: any, index: number) => {
      const symbol = symbols[index]
      if (!symbol || !feed.price) return

      const price = feed.price
      const expo = feed.expo || -8
      const actualPrice = parseFloat(price.price) * Math.pow(10, expo)

      results[symbol] = {
        price: actualPrice,
        confidence: parseFloat(price.conf) * Math.pow(10, expo),
        timestamp: price.publish_time,
        symbol,
      }
    })

    return results
  } catch (error) {
    console.error('Error fetching multiple Pyth prices:', error)
    return results
  }
}

/**
 * Вычисляет swap rate используя Pyth prices
 */
export async function getSwapRateFromPyth(
  tokenIn: string,
  tokenOut: string
): Promise<number | null> {
  try {
    const [priceIn, priceOut] = await Promise.all([
      getPythPrice(tokenIn),
      getPythPrice(tokenOut),
    ])

    if (!priceIn || !priceOut) {
      return null
    }

    // Swap rate = priceIn / priceOut
    const swapRate = priceIn.price / priceOut.price
    return swapRate
  } catch (error) {
    console.error('Error calculating swap rate from Pyth:', error)
    return null
  }
}

