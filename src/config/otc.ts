/**
 * 💰 Canton OTC Configuration
 * Конфигурация для OTC обмена Canton Coin
 */

// Supported networks
export type NetworkType = 'ETHEREUM' | 'BSC' | 'TRON' | 'SOLANA' | 'OPTIMISM';
export type TokenSymbol = 'USDT';

// Token configuration
export interface TokenConfig {
  symbol: TokenSymbol;
  name: string;
  network: NetworkType;
  networkName: string;
  decimals: number;
  priceUSD: number; // Current price in USD
  minAmount: number;
  receivingAddress: string;
  contractAddress?: string; // For ERC-20/BEP-20 tokens
  icon: string;
  color: string;
}

// Get receiving addresses from environment variables with fallbacks
const ETH_RECEIVING_ADDRESS = process.env.ETH_RECEIVING_ADDRESS || process.env.NEXT_PUBLIC_ETH_RECEIVING_ADDRESS || '0xe70eC2DeA28CD14B2d392E72F2fE68F8d8799D5E';
const BSC_RECEIVING_ADDRESS = process.env.BSC_RECEIVING_ADDRESS || process.env.NEXT_PUBLIC_BSC_RECEIVING_ADDRESS || '0xe70eC2DeA28CD14B2d392E72F2fE68F8d8799D5E';
const TRON_RECEIVING_ADDRESS = process.env.TRON_RECEIVING_ADDRESS || process.env.NEXT_PUBLIC_TRON_RECEIVING_ADDRESS || 'TKau36dpRiTENTjhdJVU4DhoFzX9x3N5Q1';
const SOLANA_RECEIVING_ADDRESS = process.env.SOLANA_RECEIVING_ADDRESS || process.env.NEXT_PUBLIC_SOLANA_RECEIVING_ADDRESS || '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
const OPTIMISM_RECEIVING_ADDRESS = process.env.OPTIMISM_RECEIVING_ADDRESS || process.env.NEXT_PUBLIC_OPTIMISM_RECEIVING_ADDRESS || '0xe70eC2DeA28CD14B2d392E72F2fE68F8d8799D5E';

// Supported payment tokens - only USDT stablecoins
export const SUPPORTED_TOKENS: TokenConfig[] = [
  {
    symbol: 'USDT',
    name: 'USDT (ERC-20)',
    network: 'ETHEREUM',
    networkName: 'Ethereum',
    decimals: 6,
    priceUSD: 1,
    minAmount: parseFloat(process.env.MIN_USDT_AMOUNT || '1'),
    receivingAddress: ETH_RECEIVING_ADDRESS,
    contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    icon: '$',
    color: '#50AF95'
  },
  {
    symbol: 'USDT',
    name: 'USDT (BEP-20)',
    network: 'BSC',
    networkName: 'BNB Chain',
    decimals: 18,
    priceUSD: 1,
    minAmount: parseFloat(process.env.MIN_USDT_AMOUNT || '1'),
    receivingAddress: BSC_RECEIVING_ADDRESS,
    contractAddress: '0x55d398326f99059fF775485246999027B3197955',
    icon: '$',
    color: '#F0B90B'
  },
  {
    symbol: 'USDT',
    name: 'USDT (TRC-20)',
    network: 'TRON',
    networkName: 'TRON',
    decimals: 6,
    priceUSD: 1,
    minAmount: parseFloat(process.env.MIN_USDT_AMOUNT || '1'),
    receivingAddress: TRON_RECEIVING_ADDRESS,
    contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    icon: '$',
    color: '#FF6B35'
  },
  {
    symbol: 'USDT',
    name: 'USDT (Solana)',
    network: 'SOLANA',
    networkName: 'Solana',
    decimals: 6,
    priceUSD: 1,
    minAmount: parseFloat(process.env.MIN_USDT_AMOUNT || '1'),
    receivingAddress: SOLANA_RECEIVING_ADDRESS,
    contractAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    icon: '$',
    color: '#9945FF'
  },
  {
    symbol: 'USDT',
    name: 'USDT (Optimism)',
    network: 'OPTIMISM',
    networkName: 'Optimism',
    decimals: 6,
    priceUSD: 1,
    minAmount: parseFloat(process.env.MIN_USDT_AMOUNT || '1'),
    receivingAddress: OPTIMISM_RECEIVING_ADDRESS,
    contractAddress: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    icon: '$',
    color: '#FF0420'
  }
];

// 🎯 Progressive Discount Tiers (Volume-based pricing)
export const DISCOUNT_TIERS = [
  {
    minAmount: 0,
    maxAmount: 5000,
    discount: 0,
    label: 'Standard',
    description: '0%'
  },
  {
    minAmount: 5000,
    maxAmount: 25000,
    discount: 0.005, // 0.5% discount
    label: 'Bronze',
    description: '+0.5%'
  },
  {
    minAmount: 25000,
    maxAmount: 50000,
    discount: 0.01, // 1% discount
    label: 'Silver',
    description: '+1%'
  },
  {
    minAmount: 50000,
    maxAmount: Infinity,
    discount: 0.015, // 1.5% discount
    label: 'Gold',
    description: '1.5%'
  }
] as const;

export type DiscountTier = typeof DISCOUNT_TIERS[number];

// 🎯 Dynamic price getters - use ConfigManager prices
export const getCantonCoinBuyPrice = async (): Promise<number> => {
  try {
    // Используем ConfigManager для получения актуальных цен
    if (typeof window !== 'undefined') {
      // На клиенте - нет доступа к ConfigManager, используем API
      const response = await fetch('/api/config');
      if (response.ok) {
        const config = await response.json();
        console.log('🌐 Client: Buy price from API:', config.cantonCoinBuyPrice);
        return config.cantonCoinBuyPrice || 0.77; // Fallback обновлен до актуального значения из ConfigMap
      }
    } else {
      // На сервере - используем ConfigManager напрямую
      const { configManager } = await import('@/lib/config-manager');
      await configManager.refreshConfig(); // ✅ Обновляем конфигурацию перед чтением
      const config = configManager.getConfig();
      console.log('🖥️  Server: Buy price from ConfigManager:', config?.cantonCoinBuyPrice);
      return config?.cantonCoinBuyPrice || 0.17;
    }
  } catch (error) {
    console.warn('⚠️  Failed to get buy price from ConfigManager, using default:', error);
  }
  return 0.77; // ✅ Обновлено: Совпадает с текущим ConfigMap (CANTON_COIN_BUY_PRICE_USD: "0.77")
};

export const getCantonCoinSellPrice = async (): Promise<number> => {
  try {
    // Используем ConfigManager для получения актуальных цен
    if (typeof window !== 'undefined') {
      // На клиенте - нет доступа к ConfigManager, используем API
      const response = await fetch('/api/config');
      if (response.ok) {
        const config = await response.json();
        console.log('🌐 Client: Sell price from API:', config.cantonCoinSellPrice);
        return config.cantonCoinSellPrice || 0.22; // Fallback обновлен до актуального значения из ConfigMap
      }
    } else {
      // На сервере - используем ConfigManager напрямую
      const { configManager } = await import('@/lib/config-manager');
      await configManager.refreshConfig(); // ✅ Обновляем конфигурацию перед чтением
      const config = configManager.getConfig();
      console.log('🖥️  Server: Sell price from ConfigManager:', config?.cantonCoinSellPrice);
      return config?.cantonCoinSellPrice || 0.22; // Fallback обновлен до актуального значения из ConfigMap
    }
  } catch (error) {
    console.warn('⚠️  Failed to get sell price from ConfigManager, using default:', error);
  }
  return 0.12; // ✅ ИСПРАВЛЕНО: Совпадает с синхронной версией и текущим ConfigMap
};

export const getCantonCoinPrice = async (): Promise<number> => {
  // Вычисляем среднюю цену динамически из ConfigManager
  try {
    const buyPrice = await getCantonCoinBuyPrice();
    const sellPrice = await getCantonCoinSellPrice();
    return (buyPrice + sellPrice) / 2;
  } catch (error) {
    console.error('Cannot calculate Canton price:', error);
    return 0.15; // Default average
  }
};

// ⚠️  DEPRECATED: Синхронные геттеры для обратной совместимости
// ВАЖНО: Используют УСТАРЕВШИЕ hardcoded значения!
// РЕКОМЕНДАЦИЯ: Используйте асинхронные getCantonCoinBuyPrice() и getCantonCoinSellPrice()
export const getCantonCoinBuyPriceSync = (): number => {
  // ВСЕГДА берем из environment (ConfigMap в Kubernetes)
  // Фоллбек 0.77 используется ТОЛЬКО при build времени
  const envPrice = process.env.CANTON_COIN_BUY_PRICE_USD;
  
  if (envPrice) {
    const price = parseFloat(envPrice);
    if (price > 0) return price;
  }
  
  // Build-time фоллбек (в runtime ВСЕГДА будет env переменная из ConfigMap)
  console.warn('⚠️ Using build-time fallback price for buy. In production, ConfigMap value will be used.');
  return 0.77; // ✅ Обновлено: Совпадает с текущим ConfigMap
};

export const getCantonCoinSellPriceSync = (): number => {
  // ВСЕГДА берем из environment (ConfigMap в Kubernetes)
  // Фоллбек 0.12 используется ТОЛЬКО при build времени
  const envPrice = process.env.CANTON_COIN_SELL_PRICE_USD;
  
  if (envPrice) {
    const price = parseFloat(envPrice);
    if (price > 0) return price;
  }
  
  // Build-time фоллбек (в runtime ВСЕГДА будет env переменная из ConfigMap)
  console.warn('⚠️ Using build-time fallback price for sell. In production, ConfigMap value will be used.');
  return 0.22; // ✅ Обновлено: Совпадает с текущим ConfigMap
};

export const OTC_CONFIG = {
  // Exchange rates - separate prices for buy and sell (now dynamic with ConfigManager integration)
  get CANTON_COIN_BUY_PRICE_USD() { 
    return getCantonCoinBuyPriceSync(); 
  },
  get CANTON_COIN_SELL_PRICE_USD() { 
    return getCantonCoinSellPriceSync(); 
  },
  
  // Legacy single price for backward compatibility
  get CANTON_COIN_PRICE_USD() { return (getCantonCoinBuyPriceSync() + getCantonCoinSellPriceSync()) / 2; },
  
  // Updated limits - configurable via environment variables
  MIN_USDT_AMOUNT: parseFloat(process.env.MIN_USDT_AMOUNT || '1'), // Minimum USD amount
  
  // Canton Coin selling limits - использовать из ConfigProvider на клиенте
  MIN_CANTON_AMOUNT: 5, // Статичное значение для избежания ошибок на клиенте
  USDT_RECEIVING_ADDRESS: TRON_RECEIVING_ADDRESS,
  
  // Processing times and statuses
  PROCESSING_STEPS: [
    { id: 1, name: "Awaiting deposit", description: "Send USDT to provided address" },
    { id: 2, name: "Awaiting confirmation", description: "Confirming your payment" },
    { id: 3, name: "Exchanging", description: "Processing the exchange" },
    { id: 4, name: "Sending to you", description: "Sending Canton Coin to your address" },
    { id: 5, name: "Done", description: "Exchange completed successfully" }
  ],
  
  // Contact information
  SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || "support@cantonotc.com",
  TELEGRAM_BOT_USERNAME: process.env.TELEGRAM_BOT_USERNAME || "@canton_otc_bot",
  
  // Business hours
  BUSINESS_HOURS: process.env.BUSINESS_HOURS || "8:00 AM - 10:00 PM (GMT+8)",
  
  // Google Sheets configuration
  GOOGLE_SHEETS: {
    SHEET_ID: process.env.GOOGLE_SHEET_ID || "",
    RANGE: process.env.GOOGLE_SHEETS_RANGE || "A:K", // Columns: OrderId, Timestamp, UsdtAmount, CantonAmount, CantonAddress, RefundAddress, Email, WhatsApp, Telegram, Status, TxHash
  },
  
  // Telegram Bot configuration
  TELEGRAM: {
    BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "",
    CHAT_ID: process.env.TELEGRAM_CHAT_ID || "",
  }
} as const;

export type OrderStatus = 'awaiting-deposit' | 'awaiting-confirmation' | 'exchanging' | 'sending' | 'completed' | 'failed';

export interface OTCOrder {
  orderId: string;
  timestamp: number;
  // Payment token information
  paymentToken: TokenConfig;
  paymentAmount: number;
  paymentAmountUSD: number; // Amount in USD for unified calculations
  // Canton Coin information
  cantonAmount: number;
  cantonAddress: string;
  receivingAddress?: string; // ✅ При sell: адрес для получения USDT (payment token address)
  refundAddress?: string;
  email: string;
  whatsapp?: string;
  telegram?: string;
  status: OrderStatus;
  txHash?: string;
  // Exchange direction
  exchangeDirection?: 'buy' | 'sell'; // Buy = USDT → Canton, Sell = Canton → USDT
  // UNIQUE ADDRESS FIELDS
  uniqueAddress?: string; // Unique payment address for this order
  addressPath?: string; // HD wallet derivation path
  // Service commission and manual price
  manualPrice?: number; // Ручная цена (если указана)
  serviceCommission?: number; // Комиссия сервиса в %
  telegramMessageId?: number; // ID сообщения в публичном канале
  chatLink?: string; // Ссылка на сервисный чат
  // P2P Private Deal
  isPrivateDeal?: boolean; // Приватная сделка (не публикуется в Telegram группу клиентов)
  // REQ-002: Market Price Deal
  isMarketPrice?: boolean; // Сделка по рыночной цене (пометка "at Market Price")
  // Market Price Discount
  marketPriceDiscountPercent?: number; // Процент дисконта от рыночной цены (от 0.1%, по умолчанию 0)
  // Legacy fields for backward compatibility
  usdtAmount?: number;
}

// Helper functions
export const getTokenById = (symbol: TokenSymbol, network: NetworkType): TokenConfig | undefined => {
  return SUPPORTED_TOKENS.find(token => token.symbol === symbol && token.network === network);
};

export const getTokenKey = (token: TokenConfig): string => {
  return `${token.symbol}_${token.network}`;
};

/**
 * Get applicable discount tier based on USD amount
 */
export const getDiscountTier = (usdAmount: number): DiscountTier => {
  return DISCOUNT_TIERS.find(
    tier => usdAmount >= tier.minAmount && usdAmount < tier.maxAmount
  ) || DISCOUNT_TIERS[0];
};

/**
 * Calculate Canton amount with volume discount applied
 * @param paymentAmountUSD - Amount in USD
 * @param applyDiscount - Whether to apply volume discount
 * @param isBuying - true for buying Canton (use buy price), false for selling (use sell price)
 */
export const calculateCantonAmount = (paymentAmountUSD: number, applyDiscount: boolean = true, isBuying: boolean = true): number => {
  const price = isBuying ? getCantonCoinBuyPriceSync() : getCantonCoinSellPriceSync();
  const baseAmount = paymentAmountUSD / price;
  
  if (!applyDiscount) {
    return baseAmount;
  }
  
  const tier = getDiscountTier(paymentAmountUSD);
  
  if (isBuying) {
    // When buying: discount means MORE Canton tokens for same USD (bonus tokens)
    const discountMultiplier = 1 + tier.discount;
    return baseAmount * discountMultiplier;
  } else {
    // When selling: discount means MORE USD for same Canton tokens (better price)
    // This function should return the USD amount with discount applied
    const discountMultiplier = 1 + tier.discount;
    return paymentAmountUSD * discountMultiplier;
  }
};

/**
 * Calculate effective price per Canton with discount
 * @param usdAmount - Amount in USD
 * @param isBuying - true for buying Canton (use buy price), false for selling (use sell price)
 */
export const getEffectivePrice = (usdAmount: number, isBuying: boolean = true): number => {
  const tier = getDiscountTier(usdAmount);
  const basePrice = isBuying ? getCantonCoinBuyPriceSync() : getCantonCoinSellPriceSync();
  
  if (isBuying) {
    // When buying: discount means lower effective price (better for buyer)
    return basePrice * (1 - tier.discount);
  } else {
    // When selling: discount means higher effective price (better for seller)
    return basePrice * (1 + tier.discount);
  }
};
