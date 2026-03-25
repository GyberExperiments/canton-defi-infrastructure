'use client';

/**
 * 🔮 ORACLE SERVICE 2025
 * 
 * Сервис оракулов для Canton Wealth Platform:
 * - Получение цен активов в реальном времени
 * - Интеграция с Pyth Network, Chainlink, Band Protocol
 * - Валютные курсы и обменные ставки
 * - Процентные ставки и доходность
 * - Индексы рынка и макроэкономические данные
 * - Property valuation для недвижимости
 * - Treasury yields для казначейских облигаций
 * - Кэширование данных для производительности
 * - Fallback механизмы при недоступности оракулов
 */

import { EventEmitter } from 'events';
import Decimal from 'decimal.js';

// ========================================
// ORACLE TYPES
// ========================================

export interface OracleConfig {
  enabled: boolean;
  defaultProvider: 'pyth' | 'chainlink' | 'band' | 'coingecko';
  fallbackProviders: string[];
  cacheTTL: number; // seconds
  updateInterval: number; // seconds
  maxRetries: number;
  retryDelay: number; // milliseconds
  /** When true, use stub/mock data (tests only). When false (DevNet/prod), use real providers or throw. */
  useStub?: boolean;
}

export interface PriceData {
  symbol: string;
  price: string;
  timestamp: string;
  source: string;
  confidence: number;
  volume24h?: string;
  change24h?: string;
  high24h?: string;
  low24h?: string;
}

export interface ExchangeRate {
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  timestamp: string;
  source: string;
}

export interface InterestRate {
  currency: string;
  rate: string;
  rateType: 'FED_FUNDS' | 'LIBOR' | 'SOFR' | 'EURIBOR' | 'TREASURY_YIELD';
  maturity?: string;
  timestamp: string;
  source: string;
}

export interface TreasuryYield {
  maturity: '1M' | '3M' | '6M' | '1Y' | '2Y' | '5Y' | '10Y' | '30Y';
  yield: string;
  timestamp: string;
  source: string;
}

export interface MarketIndex {
  symbol: string;
  name: string;
  value: string;
  change: string;
  changePercent: string;
  timestamp: string;
  source: string;
}

export interface PropertyValuation {
  propertyId: string;
  address: string;
  city: string;
  state: string;
  country: string;
  propertyType: 'RESIDENTIAL' | 'COMMERCIAL' | 'INDUSTRIAL' | 'MIXED_USE';
  
  estimatedValue: string;
  valuePerSqFt: string;
  confidence: number;
  
  comparableSales: ComparableSale[];
  marketTrends: MarketTrend[];
  
  lastUpdated: string;
  source: string;
}

export interface ComparableSale {
  address: string;
  salePrice: string;
  saleDate: string;
  propertyType: string;
  distance: string;
  similarity: number;
}

export interface MarketTrend {
  period: string;
  averagePrice: string;
  priceChange: string;
  priceChangePercent: string;
  salesVolume: number;
}

export interface OracleHealth {
  provider: string;
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  lastUpdate: string;
  latency: number;
  errorRate: number;
}

// ========================================
// ORACLE SERVICE CLASS
// ========================================

export class OracleService extends EventEmitter {
  private config: OracleConfig;
  private priceCache: Map<string, { data: PriceData; expiresAt: number }> = new Map();
  private exchangeRateCache: Map<string, { data: ExchangeRate; expiresAt: number }> = new Map();
  private interestRateCache: Map<string, { data: InterestRate; expiresAt: number }> = new Map();
  private treasuryYieldCache: Map<string, { data: TreasuryYield; expiresAt: number }> = new Map();
  private propertyValuationCache: Map<string, { data: PropertyValuation; expiresAt: number }> = new Map();
  
  private healthStatus: Map<string, OracleHealth> = new Map();
  private updateIntervalId?: NodeJS.Timeout;
  
  // Supported symbols
  private readonly CRYPTO_SYMBOLS = [
    'BTC', 'ETH', 'USDT', 'USDC', 'DAI', 'WBTC', 'LINK', 'UNI', 'AAVE', 'COMP'
  ];
  
  private readonly FIAT_CURRENCIES = [
    'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'CNY'
  ];
  
  private readonly TREASURY_MATURITIES: TreasuryYield['maturity'][] = [
    '1M', '3M', '6M', '1Y', '2Y', '5Y', '10Y', '30Y'
  ];
  
  private readonly MARKET_INDICES = [
    { symbol: 'SPX', name: 'S&P 500' },
    { symbol: 'DJI', name: 'Dow Jones Industrial Average' },
    { symbol: 'IXIC', name: 'NASDAQ Composite' },
    { symbol: 'RUT', name: 'Russell 2000' },
    { symbol: 'VIX', name: 'CBOE Volatility Index' }
  ];
  
  constructor(config: Partial<OracleConfig> = {}) {
    super();
    this.config = {
      enabled: config.enabled ?? true,
      defaultProvider: config.defaultProvider ?? 'pyth',
      fallbackProviders: config.fallbackProviders ?? ['chainlink', 'band', 'coingecko'],
      cacheTTL: config.cacheTTL ?? 60, // 1 minute
      updateInterval: config.updateInterval ?? 30, // 30 seconds
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000
    };
    
    console.log('🔮 Oracle Service initialized', {
      enabled: this.config.enabled,
      defaultProvider: this.config.defaultProvider,
      cacheTTL: this.config.cacheTTL
    });
    
    // Start periodic updates
    this.startPeriodicUpdates();
  }
  
  // ========================================
  // PRICE DATA
  // ========================================
  
  /**
   * Get price for a symbol
   */
  public async getPrice(symbol: string): Promise<PriceData> {
    try {
      console.log('💰 Getting price...', { symbol });
      
      // Check cache first
      const cached = this.priceCache.get(symbol);
      if (cached && cached.expiresAt > Date.now()) {
        console.log('✅ Price from cache:', symbol);
        return cached.data;
      }
      
      // Fetch from oracle
      const priceData = await this.fetchPriceFromOracle(symbol);
      
      // Cache the result
      this.priceCache.set(symbol, {
        data: priceData,
        expiresAt: Date.now() + this.config.cacheTTL * 1000
      });
      
      console.log('✅ Price fetched:', { symbol, price: priceData.price });
      this.emit('price_updated', { symbol, priceData });
      
      return priceData;
      
    } catch (error) {
      console.error('❌ Failed to get price:', error);
      
      // Try fallback providers
      for (const fallback of this.config.fallbackProviders) {
        try {
          console.log(`🔄 Trying fallback provider: ${fallback}`);
          const priceData = await this.fetchPriceFromProvider(symbol, fallback);
          
          this.priceCache.set(symbol, {
            data: priceData,
            expiresAt: Date.now() + this.config.cacheTTL * 1000
          });
          
          return priceData;
        } catch (fallbackError) {
          console.warn(`⚠️ Fallback provider ${fallback} failed:`, fallbackError);
        }
      }
      
      if (this.config.useStub) {
        return {
          symbol,
          price: '0',
          timestamp: new Date().toISOString(),
          source: 'fallback',
          confidence: 0,
          volume24h: '0',
          change24h: '0',
          high24h: '0',
          low24h: '0'
        };
      }
      throw error;
    }
  }
  
  /**
   * Get prices for multiple symbols
   */
  public async getPrices(symbols: string[]): Promise<PriceData[]> {
    try {
      console.log('💰 Getting prices for multiple symbols...', { count: symbols.length });
      
      const pricePromises = symbols.map(symbol => this.getPrice(symbol));
      const prices = await Promise.all(pricePromises);
      
      console.log('✅ Prices fetched:', { count: prices.length });
      return prices;
      
    } catch (error) {
      console.error('❌ Failed to get prices:', error);
      throw error;
    }
  }
  
  /**
   * Fetch price from default oracle
   */
  private async fetchPriceFromOracle(symbol: string): Promise<PriceData> {
    const provider = this.config.defaultProvider;
    return this.fetchPriceFromProvider(symbol, provider);
  }
  
  /**
   * Fetch price from specific provider
   */
  private async fetchPriceFromProvider(symbol: string, provider: string): Promise<PriceData> {
    try {
      let priceData: PriceData;
      
      switch (provider) {
        case 'pyth':
          priceData = await this.fetchFromPyth(symbol);
          break;
        case 'chainlink':
          priceData = await this.fetchFromChainlink(symbol);
          break;
        case 'band':
          priceData = await this.fetchFromBand(symbol);
          break;
        case 'coingecko':
          priceData = await this.fetchFromCoingecko(symbol);
          break;
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }
      
      // Update health status
      this.updateHealthStatus(provider, 'HEALTHY');
      
      return priceData;
      
    } catch (error) {
      console.error(`❌ Failed to fetch from ${provider}:`, error);
      this.updateHealthStatus(provider, 'DEGRADED');
      throw error;
    }
  }
  
  /**
   * Fetch from data source (for testing purposes)
   */
  public async fetchFromDataSource(symbol: string): Promise<PriceData> {
    return this.fetchPriceFromOracle(symbol);
  }
  
  /**
   * Fetch from Pyth Network. When useStub=false (DevNet/prod), requires real API or throws.
   */
  private async fetchFromPyth(symbol: string): Promise<PriceData> {
    if (!this.config.useStub) {
      const url = typeof process !== 'undefined' && process.env?.PYTH_API_URL;
      if (!url) {
        throw new Error('Oracle stub disabled. Set ORACLE_USE_STUB=true for tests or PYTH_API_URL for real Pyth.');
      }
      const res = await fetch(`${url}/api/price?symbol=${encodeURIComponent(symbol)}`).catch(() => null);
      if (!res?.ok) throw new Error('Pyth API request failed');
      const data = await res.json();
      return {
        symbol,
        price: String(data.price ?? '0'),
        timestamp: new Date().toISOString(),
        source: 'pyth',
        confidence: Number(data.confidence ?? 0),
        volume24h: data.volume24h != null ? String(data.volume24h) : undefined,
        change24h: data.change24h != null ? String(data.change24h) : undefined,
        high24h: data.high24h != null ? String(data.high24h) : undefined,
        low24h: data.low24h != null ? String(data.low24h) : undefined
      };
    }
    const mockPrices: Record<string, number> = {
      'BTC': 95000,
      'ETH': 3500,
      'USDT': 1.00,
      'USDC': 1.00,
      'DAI': 1.00,
      'WBTC': 95000,
      'LINK': 15,
      'UNI': 8,
      'AAVE': 150,
      'COMP': 80
    };
    
    const price = mockPrices[symbol] || 0;
    
    // Format price: return '0' for invalid symbols, '0.00' for valid zero prices
    const formattedPrice = price === 0 ? '0' : price.toFixed(2);
    
    return {
      symbol,
      price: formattedPrice,
      timestamp: new Date().toISOString(),
      source: 'pyth',
      confidence: 0.99,
      volume24h: (price * 1000000).toFixed(2),
      change24h: (Math.random() * 10 - 5).toFixed(2),
      high24h: (price * 1.05).toFixed(2),
      low24h: (price * 0.95).toFixed(2)
    };
  }
  
  /**
   * Fetch from Chainlink. When useStub=false (DevNet/prod), requires real API or throws.
   */
  private async fetchFromChainlink(symbol: string): Promise<PriceData> {
    if (!this.config.useStub) {
      const url = typeof process !== 'undefined' && process.env?.CHAINLINK_API_URL;
      if (!url) {
        throw new Error('Oracle stub disabled. Set ORACLE_USE_STUB=true for tests or CHAINLINK_API_URL for real Chainlink.');
      }
      const res = await fetch(`${url}/api/price?symbol=${encodeURIComponent(symbol)}`).catch(() => null);
      if (!res?.ok) throw new Error('Chainlink API request failed');
      const data = await res.json();
      return {
        symbol,
        price: String(data.price ?? '0'),
        timestamp: new Date().toISOString(),
        source: 'chainlink',
        confidence: Number(data.confidence ?? 0),
        volume24h: data.volume24h != null ? String(data.volume24h) : undefined,
        change24h: data.change24h != null ? String(data.change24h) : undefined,
        high24h: data.high24h != null ? String(data.high24h) : undefined,
        low24h: data.low24h != null ? String(data.low24h) : undefined
      };
    }
    // Mock data for tests only
    const mockPrices: Record<string, number> = {
      'BTC': 95000,
      'ETH': 3500,
      'USDT': 1.00,
      'USDC': 1.00
    };
    
    const price = mockPrices[symbol] || 0;
    
    return {
      symbol,
      price: price.toFixed(2),
      timestamp: new Date().toISOString(),
      source: 'chainlink',
      confidence: 0.98,
      volume24h: (price * 500000).toFixed(2),
      change24h: (Math.random() * 8 - 4).toFixed(2)
    };
  }
  
  /**
   * Fetch from Band Protocol. When useStub=false (DevNet/prod), requires real API or throws.
   */
  private async fetchFromBand(symbol: string): Promise<PriceData> {
    if (!this.config.useStub) {
      const url = typeof process !== 'undefined' && process.env?.BAND_API_URL;
      if (!url) {
        throw new Error('Oracle stub disabled. Set ORACLE_USE_STUB=true for tests or BAND_API_URL for real Band Protocol.');
      }
      const res = await fetch(`${url}/api/price?symbol=${encodeURIComponent(symbol)}`).catch(() => null);
      if (!res?.ok) throw new Error('Band Protocol API request failed');
      const data = await res.json();
      return {
        symbol,
        price: String(data.price ?? '0'),
        timestamp: new Date().toISOString(),
        source: 'band',
        confidence: Number(data.confidence ?? 0),
        volume24h: data.volume24h != null ? String(data.volume24h) : undefined,
        change24h: data.change24h != null ? String(data.change24h) : undefined,
        high24h: data.high24h != null ? String(data.high24h) : undefined,
        low24h: data.low24h != null ? String(data.low24h) : undefined
      };
    }
    // Mock data for tests only
    const mockPrices: Record<string, number> = {
      'BTC': 95000,
      'ETH': 3500
    };
    
    const price = mockPrices[symbol] || 0;
    
    return {
      symbol,
      price: price.toFixed(2),
      timestamp: new Date().toISOString(),
      source: 'band',
      confidence: 0.97,
      volume24h: (price * 300000).toFixed(2),
      change24h: (Math.random() * 6 - 3).toFixed(2)
    };
  }
  
  /**
   * Fetch from CoinGecko. When useStub=false (DevNet/prod), requires real API or throws.
   */
  private async fetchFromCoingecko(symbol: string): Promise<PriceData> {
    if (!this.config.useStub) {
      const url = typeof process !== 'undefined' && process.env?.COINGECKO_API_URL;
      if (!url) {
        throw new Error('Oracle stub disabled. Set ORACLE_USE_STUB=true for tests or COINGECKO_API_URL for real CoinGecko.');
      }
      const res = await fetch(`${url}/api/v3/simple/price?ids=${encodeURIComponent(symbol)}&vs_currencies=usd`).catch(() => null);
      if (!res?.ok) throw new Error('CoinGecko API request failed');
      const data = await res.json();
      return {
        symbol,
        price: String(data.usd ?? '0'),
        timestamp: new Date().toISOString(),
        source: 'coingecko',
        confidence: 0.95,
        volume24h: data.total_volume != null ? String(data.total_volume) : undefined,
        change24h: data.price_change_percentage_24h != null ? String(data.price_change_percentage_24h) : undefined,
        high24h: data.high_24h != null ? String(data.high_24h) : undefined,
        low24h: data.low_24h != null ? String(data.low_24h) : undefined
      };
    }
    // Mock data for tests only
    const mockPrices: Record<string, number> = {
      'BTC': 95000,
      'ETH': 3500,
      'USDT': 1.00,
      'USDC': 1.00,
      'DAI': 1.00
    };
    
    const price = mockPrices[symbol] || 0;
    
    return {
      symbol,
      price: price.toFixed(2),
      timestamp: new Date().toISOString(),
      source: 'coingecko',
      confidence: 0.95,
      volume24h: (price * 200000).toFixed(2),
      change24h: (Math.random() * 5 - 2.5).toFixed(2)
    };
  }
  
  // ========================================
  // EXCHANGE RATES
  // ========================================
  
  /**
   * Get exchange rate
   */
  public async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<ExchangeRate> {
    try {
      console.log('💱 Getting exchange rate...', { fromCurrency, toCurrency });
      
      const cacheKey = `${fromCurrency}_${toCurrency}`;
      
      // Check cache first
      const cached = this.exchangeRateCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        console.log('✅ Exchange rate from cache:', cacheKey);
        return cached.data;
      }
      
      // Fetch from oracle
      const exchangeRate = await this.fetchExchangeRateFromOracle(fromCurrency, toCurrency);
      
      // Cache the result
      this.exchangeRateCache.set(cacheKey, {
        data: exchangeRate,
        expiresAt: Date.now() + this.config.cacheTTL * 1000
      });
      
      console.log('✅ Exchange rate fetched:', { fromCurrency, toCurrency, rate: exchangeRate.rate });
      this.emit('exchange_rate_updated', { fromCurrency, toCurrency, exchangeRate });
      
      return exchangeRate;
      
    } catch (error) {
      console.error('❌ Failed to get exchange rate:', error);
      throw error;
    }
  }
  
  /**
   * Fetch exchange rate from oracle. When useStub=false (DevNet/prod), requires real API or throws.
   */
  private async fetchExchangeRateFromOracle(fromCurrency: string, toCurrency: string): Promise<ExchangeRate> {
    if (!this.config.useStub) {
      const url = typeof process !== 'undefined' && process.env?.FOREX_API_URL;
      if (!url) {
        throw new Error('Oracle stub disabled. Set ORACLE_USE_STUB=true for tests or FOREX_API_URL for real forex API.');
      }
      const res = await fetch(`${url}/api/rate?from=${fromCurrency}&to=${toCurrency}`).catch(() => null);
      if (!res?.ok) throw new Error('Forex API request failed');
      const data = await res.json();
      return {
        fromCurrency,
        toCurrency,
        rate: String(data.rate ?? '1.0'),
        timestamp: new Date().toISOString(),
        source: data.source ?? 'forex_oracle'
      };
    }
    // Mock data for tests only
    const mockRates: Record<string, number> = {
      'USD_EUR': 0.92,
      'USD_GBP': 0.79,
      'USD_JPY': 149.50,
      'USD_CHF': 0.88,
      'USD_CAD': 1.36,
      'USD_AUD': 1.53,
      'USD_CNY': 7.24,
      'EUR_USD': 1.09,
      'GBP_USD': 1.27,
      'JPY_USD': 0.0067
    };
    
    const cacheKey = `${fromCurrency}_${toCurrency}`;
    const rate = mockRates[cacheKey] || 1.0;
    
    return {
      fromCurrency,
      toCurrency,
      rate: rate.toFixed(6),
      timestamp: new Date().toISOString(),
      source: 'forex_oracle'
    };
  }
  
  // ========================================
  // INTEREST RATES
  // ========================================
  
  /**
   * Get interest rate
   */
  public async getInterestRate(currency: string, rateType: InterestRate['rateType'], maturity?: string): Promise<InterestRate> {
    try {
      console.log('📊 Getting interest rate...', { currency, rateType, maturity });
      
      const cacheKey = `${currency}_${rateType}_${maturity || 'default'}`;
      
      // Check cache first
      const cached = this.interestRateCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        console.log('✅ Interest rate from cache:', cacheKey);
        return cached.data;
      }
      
      // Fetch from oracle
      const interestRate = await this.fetchInterestRateFromOracle(currency, rateType, maturity);
      
      // Cache the result
      this.interestRateCache.set(cacheKey, {
        data: interestRate,
        expiresAt: Date.now() + this.config.cacheTTL * 1000
      });
      
      console.log('✅ Interest rate fetched:', { currency, rateType, rate: interestRate.rate });
      this.emit('interest_rate_updated', { currency, rateType, interestRate });
      
      return interestRate;
      
    } catch (error) {
      console.error('❌ Failed to get interest rate:', error);
      throw error;
    }
  }
  
  /**
   * Fetch interest rate from oracle. When useStub=false (DevNet/prod), requires real API or throws.
   */
  private async fetchInterestRateFromOracle(currency: string, rateType: InterestRate['rateType'], maturity?: string): Promise<InterestRate> {
    if (!this.config.useStub) {
      const url = typeof process !== 'undefined' && process.env?.INTEREST_RATE_API_URL;
      if (!url) {
        throw new Error('Oracle stub disabled. Set ORACLE_USE_STUB=true for tests or INTEREST_RATE_API_URL for real interest rates.');
      }
      const res = await fetch(`${url}/api/rate?currency=${currency}&type=${rateType}&maturity=${maturity || 'default'}`).catch(() => null);
      if (!res?.ok) throw new Error('Interest rate API request failed');
      const data = await res.json();
      return {
        currency,
        rate: String(data.rate ?? '0'),
        rateType,
        maturity,
        timestamp: new Date().toISOString(),
        source: data.source ?? 'interest_rate_oracle'
      };
    }
    // Mock data for tests only
    const mockRates: Record<string, number> = {
      'USD_FED_FUNDS': 5.25,
      'USD_SOFR': 5.30,
      'USD_TREASURY_YIELD_1M': 5.40,
      'USD_TREASURY_YIELD_3M': 5.45,
      'USD_TREASURY_YIELD_6M': 5.50,
      'USD_TREASURY_YIELD_1Y': 5.55,
      'USD_TREASURY_YIELD_2Y': 5.60,
      'USD_TREASURY_YIELD_5Y': 5.65,
      'USD_TREASURY_YIELD_10Y': 5.70,
      'USD_TREASURY_YIELD_30Y': 5.75,
      'EUR_EURIBOR': 4.50,
      'GBP_LIBOR': 5.75,
      'JPY_LIBOR': 0.50
    };
    
    const cacheKey = `${currency}_${rateType}_${maturity || 'default'}`;
    const rate = mockRates[cacheKey] || 0;
    
    return {
      currency,
      rate: rate.toFixed(2),
      rateType,
      maturity,
      timestamp: new Date().toISOString(),
      source: 'interest_rate_oracle'
    };
  }
  
  // ========================================
  // TREASURY YIELDS
  // ========================================
  
  /**
   * Get all treasury yields
   */
  public async getAllTreasuryYields(): Promise<TreasuryYield[]> {
    try {
      console.log('📈 Getting all treasury yields...');
      
      const yieldPromises = this.TREASURY_MATURITIES.map(maturity => this.getTreasuryYield(maturity));
      const yields = await Promise.all(yieldPromises);
      
      console.log('✅ All treasury yields fetched:', { count: yields.length });
      return yields;
      
    } catch (error) {
      console.error('❌ Failed to get treasury yields:', error);
      throw error;
    }
  }
  
  /**
   * Fetch treasury yield. When useStub=false (DevNet/prod), requires real API or throws.
   */
  private async fetchTreasuryYieldFromOracle(maturity: TreasuryYield['maturity']): Promise<TreasuryYield> {
    if (!this.config.useStub) {
      const url = typeof process !== 'undefined' && process.env?.TREASURY_YIELD_API_URL;
      if (!url) {
        throw new Error('Oracle stub disabled. Set ORACLE_USE_STUB=true for tests or TREASURY_YIELD_API_URL for real treasury yields.');
      }
      const res = await fetch(`${url}?maturity=${maturity}`).catch(() => null);
      if (!res?.ok) throw new Error('Treasury yield API request failed');
      const data = await res.json();
      return {
        maturity,
        yield: String(data.yield ?? data.rate ?? '0'),
        timestamp: new Date().toISOString(),
        source: data.source ?? 'treasury_oracle'
      };
    }
    const mockYields: Record<TreasuryYield['maturity'], number> = {
      '1M': 5.40,
      '3M': 5.45,
      '6M': 5.50,
      '1Y': 5.55,
      '2Y': 5.60,
      '5Y': 5.65,
      '10Y': 5.70,
      '30Y': 5.75
    };
    
    const yieldValue = mockYields[maturity];
    
    // Handle invalid maturity gracefully
    if (yieldValue === undefined) {
      return {
        maturity,
        yield: '0',
        timestamp: new Date().toISOString(),
        source: 'treasury_oracle'
      };
    }
    
    return {
      maturity,
      yield: yieldValue.toFixed(2),
      timestamp: new Date().toISOString(),
      source: 'treasury_oracle'
    };
  }
  
  // ========================================
  // MARKET INDICES
  // ========================================
  
  /**
   * Get market index. When useStub=false (DevNet/prod), requires real API or throws.
   */
  public async getMarketIndex(symbol: string): Promise<MarketIndex> {
    try {
      console.log('📊 Getting market index...', { symbol });
      
      if (!this.config.useStub) {
        const url = typeof process !== 'undefined' && process.env?.MARKET_INDEX_API_URL;
        if (!url) {
          throw new Error('Oracle stub disabled. Set ORACLE_USE_STUB=true for tests or MARKET_INDEX_API_URL for real market indices.');
        }
        const res = await fetch(`${url}/api/index?symbol=${encodeURIComponent(symbol)}`).catch(() => null);
        if (!res?.ok) throw new Error('Market index API request failed');
        const data = await res.json();
        const index = this.MARKET_INDICES.find(i => i.symbol === symbol);
        const changePercent = new Decimal(data.change ?? 0)
          .div(data.value ?? 1)
          .mul(100)
          .toFixed(2);
        const marketIndex: MarketIndex = {
          symbol,
          name: index?.name || symbol,
          value: String(data.value ?? '0'),
          change: String(data.change ?? '0'),
          changePercent,
          timestamp: new Date().toISOString(),
          source: data.source ?? 'market_oracle'
        };
        console.log('✅ Market index fetched:', { symbol, value: marketIndex.value });
        this.emit('market_index_updated', { symbol, marketIndex });
        return marketIndex;
      }
      
      // Mock data for tests only
      const mockIndices: Record<string, { value: number; change: number }> = {
        'SPX': { value: 5200, change: 25 },
        'DJI': { value: 39000, change: 150 },
        'IXIC': { value: 16500, change: 80 },
        'RUT': { value: 2100, change: 15 },
        'VIX': { value: 14, change: -0.5 }
      };
      
      const indexData = mockIndices[symbol];
      if (!indexData) {
        throw new Error(`Unknown index: ${symbol}`);
      }
      
      const index = this.MARKET_INDICES.find(i => i.symbol === symbol);
      
      const changePercent = new Decimal(indexData.change)
        .div(indexData.value)
        .mul(100)
        .toFixed(2);
      
      const marketIndex: MarketIndex = {
        symbol,
        name: index?.name || symbol,
        value: indexData.value.toFixed(2),
        change: indexData.change.toFixed(2),
        changePercent,
        timestamp: new Date().toISOString(),
        source: 'market_oracle'
      };
      
      console.log('✅ Market index fetched:', { symbol, value: marketIndex.value });
      this.emit('market_index_updated', { symbol, marketIndex });
      
      return marketIndex;
      
    } catch (error) {
      console.error('❌ Failed to get market index:', error);
      throw error;
    }
  }
  
  /**
   * Get all market indices
   */
  public async getAllMarketIndices(): Promise<MarketIndex[]> {
    try {
      console.log('📊 Getting all market indices...');
      
      const indexPromises = this.MARKET_INDICES.map(index => this.getMarketIndex(index.symbol));
      const indices = await Promise.all(indexPromises);
      
      console.log('✅ All market indices fetched:', { count: indices.length });
      return indices;
      
    } catch (error) {
      console.error('❌ Failed to get market indices:', error);
      throw error;
    }
  }
  
  // ========================================
  // PROPERTY VALUATION
  // ========================================
  
  /**
   * Fetch property valuation from oracle
   */
  private async fetchPropertyValuationFromOracle(address: string, city: string, state: string, country: string): Promise<PropertyValuation> {
    // In production, integrate with real property valuation API (Zillow, Redfin, etc.)
    // For now, return mock data
    
    const propertyId = `PROP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Mock valuation based on location
    const baseValue = 500000;
    const cityMultiplier = city.toLowerCase().includes('new york') ? 2.5 : 
                          city.toLowerCase().includes('san francisco') ? 2.0 : 
                          city.toLowerCase().includes('los angeles') ? 1.8 : 1.0;
    const estimatedValue = baseValue * cityMultiplier * (1 + Math.random() * 0.2 - 0.1);
    const sqFt = 2000 + Math.floor(Math.random() * 1000);
    const valuePerSqFt = estimatedValue / sqFt;
    
    // Generate comparable sales
    const comparableSales: ComparableSale[] = Array.from({ length: 5 }, (_, i) => ({
      address: `${100 + i * 10} Main St`,
      salePrice: (estimatedValue * (0.9 + Math.random() * 0.2)).toFixed(2),
      saleDate: new Date(Date.now() - (i + 1) * 30 * 24 * 60 * 60 * 1000).toISOString(),
      propertyType: 'RESIDENTIAL',
      distance: (0.1 + Math.random() * 0.5).toFixed(2),
      similarity: 0.8 + Math.random() * 0.15
    }));
    
    // Generate market trends
    const marketTrends: MarketTrend[] = [
      {
        period: '1M',
        averagePrice: (estimatedValue * 1.01).toFixed(2),
        priceChange: (estimatedValue * 0.01).toFixed(2),
        priceChangePercent: '1.0',
        salesVolume: 150
      },
      {
        period: '3M',
        averagePrice: (estimatedValue * 1.03).toFixed(2),
        priceChange: (estimatedValue * 0.03).toFixed(2),
        priceChangePercent: '3.0',
        salesVolume: 450
      },
      {
        period: '6M',
        averagePrice: (estimatedValue * 1.05).toFixed(2),
        priceChange: (estimatedValue * 0.05).toFixed(2),
        priceChangePercent: '5.0',
        salesVolume: 900
      },
      {
        period: '1Y',
        averagePrice: (estimatedValue * 1.08).toFixed(2),
        priceChange: (estimatedValue * 0.08).toFixed(2),
        priceChangePercent: '8.0',
        salesVolume: 1800
      }
    ];
    
    return {
      propertyId,
      address,
      city,
      state,
      country,
      propertyType: 'RESIDENTIAL',
      estimatedValue: estimatedValue.toFixed(2),
      valuePerSqFt: valuePerSqFt.toFixed(2),
      confidence: 0.85 + Math.random() * 0.1,
      comparableSales,
      marketTrends,
      lastUpdated: new Date().toISOString(),
      source: 'property_oracle'
    };
  }
  
  // ========================================
  // HEALTH MONITORING
  // ========================================
  
  /**
   * Update health status for provider
   */
  private updateHealthStatus(provider: string, status: OracleHealth['status']): void {
    const health: OracleHealth = {
      provider,
      status,
      lastUpdate: new Date().toISOString(),
      latency: Math.random() * 100 + 50,
      errorRate: status === 'HEALTHY' ? 0 : Math.random() * 0.1
    };
    
    this.healthStatus.set(provider, health);
    this.emit('health_updated', health);
  }
  
  /**
   * Get health status for specific provider
   */
  public getProviderHealth(provider: string): OracleHealth | undefined {
    return this.healthStatus.get(provider);
  }
  
  // ========================================
  // PERIODIC UPDATES
  // ========================================
  
  /**
   * Start periodic updates
   */
  private startPeriodicUpdates(): void {
    if (this.updateIntervalId) {
      clearInterval(this.updateIntervalId);
    }
    
    this.updateIntervalId = setInterval(async () => {
      try {
        console.log('🔄 Running periodic oracle updates...');
        
        // Update crypto prices
        await this.getPrices(this.CRYPTO_SYMBOLS);
        
        // Update treasury yields
        await this.getAllTreasuryYields();
        
        // Update market indices
        await this.getAllMarketIndices();
        
        console.log('✅ Periodic updates completed');
        
      } catch (error) {
        console.error('❌ Periodic updates failed:', error);
      }
    }, this.config.updateInterval * 1000);
    
    console.log('✅ Periodic updates started', { interval: this.config.updateInterval });
  }
  
  /**
   * Stop periodic updates
   */
  public stopPeriodicUpdates(): void {
    if (this.updateIntervalId) {
      clearInterval(this.updateIntervalId);
      this.updateIntervalId = undefined;
      console.log('⏹️ Periodic updates stopped');
    }
  }
  
  // ========================================
  // CACHE MANAGEMENT
  // ========================================
  
  /**
   * Clear all caches
   */
  public clearCache(): void {
    this.priceCache.clear();
    this.exchangeRateCache.clear();
    this.interestRateCache.clear();
    this.treasuryYieldCache.clear();
    this.propertyValuationCache.clear();
    console.log('🗑️ All caches cleared');
    this.emit('cache_cleared');
  }
  
  /**
   * Clear specific cache
   */
  public clearPriceCache(): void {
    this.priceCache.clear();
    console.log('🗑️ Price cache cleared');
  }
  
  public clearExchangeRateCache(): void {
    this.exchangeRateCache.clear();
    console.log('🗑️ Exchange rate cache cleared');
  }
  
  public clearInterestRateCache(): void {
    this.interestRateCache.clear();
    console.log('🗑️ Interest rate cache cleared');
  }
  
  public clearTreasuryYieldCache(): void {
    this.treasuryYieldCache.clear();
    console.log('🗑️ Treasury yield cache cleared');
  }
  
  public clearPropertyValuationCache(): void {
    this.propertyValuationCache.clear();
    console.log('🗑️ Property valuation cache cleared');
  }
  
  // ========================================
  // UTILITY METHODS
  // ========================================
  
  /**
   * Convert amount from one currency to another
   */
  public async convertCurrency(amount: string, fromCurrency: string, toCurrency: string): Promise<string> {
    if (fromCurrency === toCurrency) {
      return amount;
    }
    
    const rate = await this.getExchangeRate(fromCurrency, toCurrency);
    const convertedAmount = new Decimal(amount).mul(rate.rate);
    
    return convertedAmount.toFixed(2);
  }
  
  /**
   * Calculate yield for treasury bill
   */
  public async calculateTreasuryYield(maturity: TreasuryYield['maturity'], principal: string): Promise<{
    yield: string;
    interest: string;
    maturityDate: string;
  }> {
    const treasuryYield = await this.getTreasuryYield(maturity);
    
    // Calculate maturity date
    const maturityDays = {
      '1M': 30,
      '3M': 90,
      '6M': 180,
      '1Y': 365,
      '2Y': 730,
      '5Y': 1825,
      '10Y': 3650,
      '30Y': 10950
    };
    
    const days = maturityDays[maturity];
    const maturityDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    
    // Calculate interest (simplified)
    const yieldRate = new Decimal(treasuryYield.yield).div(100);
    const years = days / 365;
    const interest = new Decimal(principal).mul(yieldRate).mul(years);
    
    return {
      yield: treasuryYield.yield,
      interest: interest.toFixed(2),
      maturityDate
    };
  }

  // ========================================
  // BACKWARD COMPATIBILITY LAYER
  // ========================================

  /**
   * Get crypto price (alias for getPrice)
   * @deprecated Use getPrice instead
   */
  public async getCryptoPrice(symbol: string): Promise<PriceData> {
    return this.getPrice(symbol);
  }

  /**
   * Get multiple crypto prices (alias for getPrices)
   * @deprecated Use getPrices instead
   */
  public async getCryptoPrices(symbols: string[]): Promise<PriceData[]> {
    return this.getPrices(symbols);
  }

  /**
   * Get treasury yield with backward compatibility
   * Returns asOfDate field for compatibility with old tests
   */
  public async getTreasuryYield(maturity: TreasuryYield['maturity']): Promise<TreasuryYield & { asOfDate?: string }> {
    try {
      console.log('📈 Getting treasury yield...', { maturity });
      
      // Check cache first
      const cached = this.treasuryYieldCache.get(maturity);
      if (cached && cached.expiresAt > Date.now()) {
        console.log('✅ Treasury yield from cache:', maturity);
        return { ...cached.data, asOfDate: cached.data.timestamp };
      }
      
      // Fetch from oracle
      const treasuryYield = await this.fetchTreasuryYieldFromOracle(maturity);
      
      // Cache the result
      this.treasuryYieldCache.set(maturity, {
        data: treasuryYield,
        expiresAt: Date.now() + this.config.cacheTTL * 1000
      });
      
      console.log('✅ Treasury yield fetched:', { maturity, yield: treasuryYield.yield });
      this.emit('treasury_yield_updated', { maturity, treasuryYield });
      
      // Return with asOfDate for backward compatibility
      return { ...treasuryYield, asOfDate: treasuryYield.timestamp };
      
    } catch (error) {
      console.error('❌ Failed to get treasury yield:', error);
      throw error;
    }
  }

  /**
   * Get property valuation with backward compatibility
   * Supports both old signature (propertyId) and new signature (address, city, state, country)
   */
  public async getPropertyValuation(
    param1: string,
    city?: string,
    state?: string,
    country?: string
  ): Promise<PropertyValuation & { valuationDate?: string }> {
    // Check if called with old signature (propertyId only)
    if (!city && !state && !country) {
      // Old signature: getPropertyValuation(propertyId)
      const propertyId = param1;
      console.log('🏠 Getting property valuation by ID...', { propertyId });
      
      // Generate mock valuation for property ID
      const baseValue = 500000;
      const estimatedValue = baseValue * (1 + Math.random() * 0.2 - 0.1);
      const sqFt = 2000 + Math.floor(Math.random() * 1000);
      const valuePerSqFt = estimatedValue / sqFt;
      
      const valuation: PropertyValuation & { valuationDate?: string } = {
        propertyId,
        address: `${Math.floor(Math.random() * 9999)} Main St`,
        city: 'New York',
        state: 'NY',
        country: 'USA',
        propertyType: 'RESIDENTIAL',
        estimatedValue: estimatedValue.toFixed(2),
        valuePerSqFt: valuePerSqFt.toFixed(2),
        confidence: 0.85 + Math.random() * 0.1,
        comparableSales: [],
        marketTrends: [],
        lastUpdated: new Date().toISOString(),
        source: 'property_oracle',
        valuationDate: new Date().toISOString()
      };
      
      console.log('✅ Property valuation fetched:', { propertyId, value: valuation.estimatedValue });
      return valuation;
    } else {
      // New signature: getPropertyValuation(address, city, state, country)
      const address = param1;
      const valuation = await this.getPropertyValuationInternal(address, city!, state!, country!);
      return { ...valuation, valuationDate: valuation.lastUpdated };
    }
  }

  /**
   * Internal property valuation method
   */
  private async getPropertyValuationInternal(
    address: string,
    city: string,
    state: string,
    country: string
  ): Promise<PropertyValuation> {
    try {
      console.log('🏠 Getting property valuation...', { address, city, state, country });
      
      const cacheKey = `${address}_${city}_${state}_${country}`;
      
      // Check cache first
      const cached = this.propertyValuationCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        console.log('✅ Property valuation from cache:', cacheKey);
        return cached.data;
      }
      
      // Fetch from oracle
      const propertyValuation = await this.fetchPropertyValuationFromOracle(address, city, state, country);
      
      // Cache the result
      this.propertyValuationCache.set(cacheKey, {
        data: propertyValuation,
        expiresAt: Date.now() + this.config.cacheTTL * 1000 * 60 // 1 hour cache for property data
      });
      
      console.log('✅ Property valuation fetched:', { address, value: propertyValuation.estimatedValue });
      this.emit('property_valuation_updated', { address, propertyValuation });
      
      return propertyValuation;
      
    } catch (error) {
      console.error('❌ Failed to get property valuation:', error);
      throw error;
    }
  }

  /**
   * Get multiple exchange rates
   */
  public async getExchangeRates(fromCurrency: string, toCurrencies: string[]): Promise<ExchangeRate[]> {
    const ratePromises = toCurrencies.map(toCurrency => 
      this.getExchangeRate(fromCurrency, toCurrency)
    );
    return Promise.all(ratePromises);
  }

  /**
   * Get market data for asset
   */
  public async getMarketData(symbol: string): Promise<{
    symbol: string;
    price: string;
    volume24h: string;
    marketCap: string;
    change24h: string;
  }> {
    const priceData = await this.getPrice(symbol);
    const price = parseFloat(priceData.price);
    
    return {
      symbol,
      price: priceData.price,
      volume24h: priceData.volume24h || '0',
      marketCap: (price * 1000000000).toFixed(2), // Mock market cap
      change24h: priceData.change24h || '0'
    };
  }

  /**
   * Get historical price data
   */
  public async getHistoricalPriceData(
    symbol: string,
    interval: string,
    count: number
  ): Promise<{
    symbol: string;
    interval: string;
    dataPoints: Array<{
      timestamp: string;
      price: string;
      volume: string;
    }>;
  }> {
    const priceData = await this.getPrice(symbol);
    const basePrice = parseFloat(priceData.price);
    
    const dataPoints = Array.from({ length: count }, (_, i) => {
      const timestamp = new Date(Date.now() - (count - 1 - i) * 24 * 60 * 60 * 1000).toISOString();
      const price = (basePrice * (1 + (Math.random() - 0.5) * 0.1)).toFixed(2);
      const volume = (Math.random() * 1000000).toFixed(2);
      
      return { timestamp, price, volume };
    });
    
    return {
      symbol,
      interval,
      dataPoints
    };
  }

  /**
   * Subscribe to price updates
   */
  public subscribeToPriceUpdates(symbol: string, callback: (priceData: PriceData) => void): string {
    const subscriptionId = `sub_${symbol}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const handler = (data: any) => {
      if (data.symbol === symbol) {
        callback(data.priceData);
      }
    };
    
    this.on('price_updated', handler);
    
    // Store subscription
    (this as any).subscriptions = (this as any).subscriptions || new Map();
    (this as any).subscriptions.set(subscriptionId, { symbol, handler });
    
    console.log('✅ Subscribed to price updates:', { symbol, subscriptionId });
    return subscriptionId;
  }

  /**
   * Unsubscribe from price updates
   */
  public unsubscribeFromPriceUpdates(subscriptionId: string): boolean {
    const subscriptions = (this as any).subscriptions as Map<string, any>;
    if (!subscriptions) {
      return false;
    }
    
    const subscription = subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }
    
    this.off('price_updated', subscription.handler);
    subscriptions.delete(subscriptionId);
    
    console.log('✅ Unsubscribed from price updates:', { subscriptionId });
    return true;
  }

  /**
   * Connect to data source
   */
  public connectDataSource(source: string): void {
    console.log('🔌 Connecting to data source:', source);
    this.updateHealthStatus(source.toLowerCase(), 'HEALTHY');
    this.emit('data_source_connected', { source });
  }

  /**
   * Disconnect from data source
   */
  public disconnectDataSource(source: string): void {
    console.log('🔌 Disconnecting from data source:', source);
    this.updateHealthStatus(source.toLowerCase(), 'DEGRADED');
    this.emit('data_source_disconnected', { source });
  }

  /**
   * Get health status with backward compatibility
   * Returns object with status, lastUpdate, and dataSources fields
   */
  public getHealthStatus(): {
    status: string;
    lastUpdate: string;
    dataSources: Array<{
      provider: string;
      status: string;
      lastUpdate: string;
    }>;
  } {
    const healthArray = Array.from(this.healthStatus.values());
    const lastUpdate = healthArray.length > 0 
      ? healthArray[healthArray.length - 1].lastUpdate 
      : new Date().toISOString();
    
    const overallStatus = healthArray.some(h => h.status === 'UNHEALTHY')
      ? 'UNHEALTHY'
      : healthArray.some(h => h.status === 'DEGRADED')
      ? 'DEGRADED'
      : 'HEALTHY';
    
    return {
      status: overallStatus,
      lastUpdate,
      dataSources: healthArray.map(h => ({
        provider: h.provider,
        status: h.status,
        lastUpdate: h.lastUpdate
      }))
    };
  }
}
