/**
 * 💰 STABLECOIN CONFIGURATION FOR CANTON NETWORK
 * Supported stablecoins для bridge operations
 */

export type NetworkType = 'BSC' | 'ETHEREUM' | 'POLYGON' | 'CANTON';

export interface StablecoinConfig {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
  networks: NetworkType[];
  addresses: {
    [network: string]: string;
  };
  isActive: boolean;
  bridgeEnabled: boolean;
}

export const STABLECOINS: StablecoinConfig[] = [
  {
    id: 'usdt',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 18,
    networks: ['BSC', 'ETHEREUM', 'POLYGON', 'CANTON'],
    addresses: {
      BSC: '0x55d398326f99059fF775485246999027B3197955',
      ETHEREUM: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      POLYGON: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      CANTON: 'canton_usdt_contract'
    },
    isActive: true,
    bridgeEnabled: true
  },
  {
    id: 'usdc',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 18,
    networks: ['BSC', 'ETHEREUM', 'POLYGON', 'CANTON'],
    addresses: {
      BSC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      ETHEREUM: '0xA0b86a33E6411aB5C30cD49Df69c36BDB21c2b3a',
      POLYGON: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      CANTON: 'canton_usdc_contract'
    },
    isActive: true,
    bridgeEnabled: true
  },
  {
    id: 'usd1',
    symbol: 'USD1',
    name: 'USD1 Stablecoin',
    decimals: 18,
    networks: ['BSC', 'CANTON'],
    addresses: {
      BSC: '0x03066C07f01D85AaF4F9D4d1b4D54B9D5FBE0F44',
      CANTON: 'canton_usd1_contract'
    },
    isActive: true,
    bridgeEnabled: true
  }
];

// Export helper functions
export const getStablecoinDropdownOptions = (network: NetworkType): StablecoinConfig[] => {
  return STABLECOINS.filter(coin => coin.networks.includes(network));
};

export const getStablecoinBySymbol = (symbol: string): StablecoinConfig | null => {
  return STABLECOINS.find(coin => coin.symbol === symbol) || null;
};

export const getStablecoinAddress = (symbol: string, network: NetworkType): string | null => {
  const coin = getStablecoinBySymbol(symbol);
  return coin?.addresses[network] || null;
};

// Canton Coin purchase configuration
export const CC_PURCHASE_CONFIG = {
  minPurchaseAmount: 50,
  maxPurchaseAmount: 100000,
  supportedStablecoins: ['USDT', 'USDC', 'USD1'],
  exchangeRate: 1.0, // 1:1 for stablecoins
  networkFee: 0.001,
  
  // ✅ ДОБАВЛЕНЫ НЕДОСТАЮЩИЕ ПОЛЯ для совместимости с компонентом
  MIN_PURCHASE_USD: 50,
  MAX_PURCHASE_USD: 100000,
  CC_PRICE_USD: 1.0, // Цена 1 CC токена в USD
  NETWORK_FEES: {
    BSC: 0.1,
    ETHEREUM: 0.15,
    POLYGON: 0.08,
    CANTON: 0.05,
  },
  QUOTE_EXPIRY_SECONDS: 300, // 5 minutes
};

// Canton Bridge configuration
export const CANTON_BRIDGE_CONFIG = {
  supportedChains: ['BSC', 'ETHEREUM', 'POLYGON'],
  bridgeFee: 0.1, // 0.1%
  BRIDGE_FEE_USD: 0.1, // Fixed bridge fee in USD
  estimatedTime: {
    BSC_TO_CANTON: 300, // 5 minutes
    ETHEREUM_TO_CANTON: 600, // 10 minutes
    POLYGON_TO_CANTON: 400 // 7 minutes
  },
  PROCESSING_TIME_ESTIMATES: {
    BSC: 5,
    ETHEREUM: 10,
    POLYGON: 7,
    CANTON: 2,
  },
};

export default STABLECOINS;
