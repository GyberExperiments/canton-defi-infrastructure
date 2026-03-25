/**
 * NEAR Ecosystem Tokens Configuration
 * Полный список токенов с контрактными адресами
 */

export interface Token {
  symbol: string
  name: string
  icon: string
  chain: 'NEAR' | 'AURORA' | 'ETHEREUM' | 'POLYGON' | 'BSC'
  decimals: number
  contractId: string // REF Finance token ID
  coingeckoId?: string // Для получения цены
  pythPriceId?: string // Pyth Network price feed ID
}

/**
 * Полный список токенов NEAR экосистемы
 */
export const NEAR_TOKENS: Token[] = [
  // Native & Wrapped
  {
    symbol: 'NEAR',
    name: 'NEAR Protocol',
    icon: 'Ⓝ',
    chain: 'NEAR',
    decimals: 24,
    contractId: 'wrap.near',
    coingeckoId: 'near',
    pythPriceId: 'c415de8d2eba7db216527dff4b60e8f3a5311c740dadb233e13e12547e226750',
  },
  
  // Stablecoins
  {
    symbol: 'USDT',
    name: 'Tether USD',
    icon: '$',
    chain: 'NEAR',
    decimals: 6,
    contractId: 'usdt.tether-token.near',
    coingeckoId: 'tether',
    pythPriceId: '1fc18861232290221461220bb4c2e99eadb97c4d87feb9a0f7c6a00e03deeb7e',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    icon: '$',
    chain: 'NEAR',
    decimals: 6,
    contractId: 'usdc.fair-launch.testnet', // Mainnet: a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near
    coingeckoId: 'usd-coin',
    pythPriceId: 'eaa020c61cc479712813461ce153894a96a11c147962391e012d41a9f46c9e6a',
  },
  {
    symbol: 'USDC.e',
    name: 'USD Coin (Ethereum)',
    icon: '$',
    chain: 'NEAR',
    decimals: 6,
    contractId: 'a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near',
    coingeckoId: 'usd-coin',
  },
  {
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    icon: '$',
    chain: 'NEAR',
    decimals: 18,
    contractId: '6b175474e89094c44da98b954eedeac495271d0f.factory.bridge.near',
    coingeckoId: 'dai',
    pythPriceId: '87a67534df596dac4e6fdb0f1e6d3ee8b7e6c3b3c4c3e6d7f8b9c0d1e2f3a4b',
  },
  
  // Bitcoin
  {
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    icon: '₿',
    chain: 'NEAR',
    decimals: 8,
    contractId: '2260fac5e5542a773aa44fbcfedf7c193bc2c599.factory.bridge.near',
    coingeckoId: 'wrapped-bitcoin',
    pythPriceId: 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  },
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    icon: '₿',
    chain: 'NEAR',
    decimals: 8,
    contractId: '2260fac5e5542a773aa44fbcfedf7c193bc2c599.factory.bridge.near', // Same as WBTC
    coingeckoId: 'bitcoin',
  },
  
  // Ethereum (Aurora)
  {
    symbol: 'ETH',
    name: 'Ethereum',
    icon: 'Ξ',
    chain: 'AURORA',
    decimals: 18,
    contractId: 'aurora',
    coingeckoId: 'ethereum',
    pythPriceId: 'ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  },
  {
    symbol: 'WETH',
    name: 'Wrapped Ethereum',
    icon: 'Ξ',
    chain: 'AURORA',
    decimals: 18,
    contractId: 'aurora',
    coingeckoId: 'weth',
  },
  
  // NEAR Ecosystem Tokens
  {
    symbol: 'REF',
    name: 'Ref Finance',
    icon: '🌊',
    chain: 'NEAR',
    decimals: 18,
    contractId: 'token.ref-finance.near',
    coingeckoId: 'ref-finance',
  },
  {
    symbol: 'TRI',
    name: 'Trisolaris',
    icon: '🔺',
    chain: 'AURORA',
    decimals: 18,
    contractId: 'tri.tkn.near',
    coingeckoId: 'trisolaris',
  },
  {
    symbol: 'stNEAR',
    name: 'Meta Pool Staked NEAR',
    icon: '🔒',
    chain: 'NEAR',
    decimals: 24,
    contractId: 'meta-pool.near',
    coingeckoId: 'meta-pool',
  },
  {
    symbol: 'NEARX',
    name: 'Stader NEARX',
    icon: '🔒',
    chain: 'NEAR',
    decimals: 24,
    contractId: 'v3.oin_finance.near',
  },
  
  // DeFi Tokens
  {
    symbol: 'LINEAR',
    name: 'LiNEAR Protocol',
    icon: '📈',
    chain: 'NEAR',
    decimals: 24,
    contractId: 'linear-protocol.near',
  },
  {
    symbol: 'SWEAT',
    name: 'Sweat Economy',
    icon: '💧',
    chain: 'NEAR',
    decimals: 18,
    contractId: 'token.sweat',
    coingeckoId: 'sweatcoin',
  },
  
  // More stablecoins & bridges
  {
    symbol: 'FRAX',
    name: 'Frax',
    icon: '$',
    chain: 'NEAR',
    decimals: 18,
    contractId: '853d955acef822db058eb8505911ed77f175b99e.factory.bridge.near',
    coingeckoId: 'frax',
  },
  {
    symbol: 'CUSD',
    name: 'Celo Dollar',
    icon: '$',
    chain: 'NEAR',
    decimals: 18,
    contractId: '7653c3c3f2d2d3e3f4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6',
  },
]

/**
 * Получить токен по символу
 */
export function getTokenBySymbol(symbol: string): Token | undefined {
  return NEAR_TOKENS.find(token => token.symbol.toUpperCase() === symbol.toUpperCase())
}

/**
 * Получить токены по chain
 */
export function getTokensByChain(chain: string): Token[] {
  return NEAR_TOKENS.filter(token => token.chain === chain)
}

/**
 * Получить все токены для свапа (исключая bridge-only)
 */
export function getSwapableTokens(): Token[] {
  return NEAR_TOKENS.filter(token => 
    token.chain === 'NEAR' || token.chain === 'AURORA'
  )
}

/**
 * Получить токены для bridge
 */
export function getBridgeableTokens(): Token[] {
  return NEAR_TOKENS
}

/**
 * Загрузить токены динамически из REF Finance
 */
export async function loadTokensFromRefFinance(): Promise<Token[]> {
  try {
    const response = await fetch('https://indexer.ref-finance.com/list-token')
    if (!response.ok) {
      console.warn('Failed to load tokens from REF Finance')
      return NEAR_TOKENS
    }

    const data = await response.json()
    
    // Маппинг REF Finance token data в наш формат
    const refTokens: Token[] = (data || []).map((token: any) => ({
      symbol: token.symbol || token.id?.split('.')[0]?.toUpperCase() || 'UNKNOWN',
      name: token.name || token.symbol || 'Unknown Token',
      icon: '🪙',
      chain: 'NEAR' as const,
      decimals: token.decimals || 24,
      contractId: token.id,
    }))

    // Объединяем с нашими известными токенами (приоритет нашим)
    const knownTokens = new Map<string, Token>()
    NEAR_TOKENS.forEach(token => {
      knownTokens.set(token.contractId.toLowerCase(), token)
    })

    // Добавляем новые токены из REF
    refTokens.forEach(token => {
      const key = token.contractId.toLowerCase()
      if (!knownTokens.has(key)) {
        knownTokens.set(key, token)
      }
    })

    return Array.from(knownTokens.values())
  } catch (error) {
    console.error('Error loading tokens from REF Finance:', error)
    return NEAR_TOKENS
  }
}

/**
 * Получить токены (с кешированием)
 */
let cachedTokens: Token[] | null = null
let cacheTimestamp: number = 0
const CACHE_TTL = 60 * 60 * 1000 // 1 час

export async function getTokens(forceRefresh = false): Promise<Token[]> {
  const now = Date.now()
  
  if (!forceRefresh && cachedTokens && (now - cacheTimestamp < CACHE_TTL)) {
    return cachedTokens
  }

  try {
    const tokens = await loadTokensFromRefFinance()
    cachedTokens = tokens
    cacheTimestamp = now
    return tokens
  } catch (error) {
    console.error('Error getting tokens:', error)
    return cachedTokens || NEAR_TOKENS
  }
}

