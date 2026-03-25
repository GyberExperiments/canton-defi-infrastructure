/**
 * 📈 Market Price Service
 * Получение актуальной рыночной цены Canton Coin из внешних API
 * Поддержка fallback на статичные цены при недоступности API
 */

import axios, { AxiosInstance } from 'axios';

interface MarketPriceConfig {
  // Binance Futures API конфигурация (основной источник для Canton Coin)
  binanceFuturesSymbol?: string; // Торговая пара на Binance Futures (например, 'CCUSDT')
  binanceSpotSymbol?: string; // Торговая пара на Binance Spot (fallback)
  // CoinGecko API конфигурация (fallback)
  coinGeckoApiKey?: string;
  coinGeckoCoinId?: string; // ID токена на CoinGecko (например, 'canton-network')
  // GeckoTerminal API конфигурация (fallback)
  geckoTerminalNetwork?: string; // Сеть (например, 'polygon_pos')
  geckoTerminalPoolAddress?: string; // Адрес пула (например, '0x2ef3fe6b5833a95edd005ed53377965edda66f64')
  // Настройки кеширования и обновления
  cacheTTL?: number; // Время жизни кеша в секундах (по умолчанию 60)
  updateInterval?: number; // Интервал обновления в миллисекундах (по умолчанию 60000 = 1 минута)
  // Fallback настройки
  enableFallback?: boolean; // Использовать fallback при ошибках API
  fallbackPrice?: number; // Цена по умолчанию при недоступности API
}

interface MarketPriceData {
  price: number;
  source: 'coingecko' | 'fallback' | 'static';
  timestamp: number;
  lastUpdate: Date;
  currency: string;
}

class MarketPriceService {
  private static instance: MarketPriceService;
  private config: MarketPriceConfig;
  private client: AxiosInstance;
  private geckoTerminalClient: AxiosInstance;
  private binanceClient: AxiosInstance;
  private cache: MarketPriceData | null = null;
  private cacheExpiry: number = 0;
  private isUpdating: boolean = false;
  private updateIntervalId: NodeJS.Timeout | null = null;
  private readonly baseUrl = 'https://api.coingecko.com/api/v3';
  private readonly geckoTerminalBaseUrl = 'https://api.geckoterminal.com/api/v2';
  private readonly binanceFuturesUrl = 'https://fapi.binance.com/fapi/v1';
  private readonly binanceSpotUrl = 'https://api.binance.com/api/v3';

  private constructor() {
    this.config = {
      binanceFuturesSymbol: process.env.BINANCE_FUTURES_SYMBOL || 'CCUSDT',
      binanceSpotSymbol: process.env.BINANCE_SPOT_SYMBOL || 'CCUSDT',
      coinGeckoCoinId: process.env.COINGECKO_COIN_ID || 'canton-network',
      coinGeckoApiKey: process.env.COINGECKO_API_KEY, // Опциональный API ключ для увеличения лимитов
      geckoTerminalPoolAddress: process.env.GECKO_TERMINAL_POOL_ADDRESS || '0x2ef3fe6b5833a95edd005ed53377965edda66f64',
      geckoTerminalNetwork: process.env.GECKO_TERMINAL_NETWORK || 'polygon_pos',
      cacheTTL: parseInt(process.env.MARKET_PRICE_CACHE_TTL || '60'),
      updateInterval: parseInt(process.env.MARKET_PRICE_UPDATE_INTERVAL || '60000'),
      enableFallback: process.env.MARKET_PRICE_ENABLE_FALLBACK !== 'false',
      fallbackPrice: parseFloat(process.env.MARKET_PRICE_FALLBACK || '0')
    };

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000, // 10 секунд
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    this.geckoTerminalClient = axios.create({
      baseURL: this.geckoTerminalBaseUrl,
      timeout: 10000, // 10 секунд
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    this.binanceClient = axios.create({
      baseURL: this.binanceFuturesUrl,
      timeout: 10000, // 10 секунд
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    // Request interceptor для добавления API ключа если есть
    this.client.interceptors.request.use((config) => {
      if (this.config.coinGeckoApiKey) {
        config.params = {
          ...config.params,
          x_cg_demo_api_key: this.config.coinGeckoApiKey
        };
      }
      return config;
    });

    // Response interceptor для error handling CoinGecko
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('❌ CoinGecko API Error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          message: error.message,
          url: error.config?.url
        });
        throw error;
      }
    );

    // Response interceptor для error handling GeckoTerminal
    this.geckoTerminalClient.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('❌ GeckoTerminal API Error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          message: error.message,
          url: error.config?.url
        });
        throw error;
      }
    );

    // Response interceptor для error handling Binance
    this.binanceClient.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('❌ Binance API Error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          message: error.message,
          url: error.config?.url
        });
        throw error;
      }
    );

    // Запускаем автообновление
    this.startAutoUpdate();
    
    // Загружаем начальную цену
    this.fetchMarketPrice().catch(err => {
      console.warn('⚠️ Failed to fetch initial market price:', err);
    });
  }

  static getInstance(): MarketPriceService {
    if (!MarketPriceService.instance) {
      MarketPriceService.instance = new MarketPriceService();
    }
    return MarketPriceService.instance;
  }

  /**
   * Получить актуальную рыночную цену Canton Coin
   * @returns Promise с ценой в USD
   */
  async getMarketPrice(): Promise<number> {
    // Проверяем кеш
    if (this.cache && Date.now() < this.cacheExpiry) {
      return this.cache.price;
    }

    // Если кеш истек, пытаемся обновить
    if (!this.isUpdating) {
      this.fetchMarketPrice().catch(err => {
        console.warn('⚠️ Failed to refresh market price:', err);
      });
    }

    // Возвращаем кешированное значение если есть (даже истекшее)
    if (this.cache) {
      return this.cache.price;
    }

    // Fallback на статичную цену
    if (this.config.enableFallback && this.config.fallbackPrice && this.config.fallbackPrice > 0) {
      console.warn('⚠️ Using fallback price:', this.config.fallbackPrice);
      return this.config.fallbackPrice;
    }

    // Последний fallback - возвращаем 0 (система должна использовать статичные цены из ConfigMap)
    console.error('❌ No market price available, returning 0');
    return 0;
  }

  /**
   * Получить детальную информацию о цене
   */
  async getMarketPriceData(): Promise<MarketPriceData> {
    // Проверяем кеш
    if (this.cache && Date.now() < this.cacheExpiry) {
      return this.cache;
    }

    // Пытаемся обновить
    if (!this.isUpdating) {
      await this.fetchMarketPrice();
    }

    // Возвращаем кешированное значение если есть
    if (this.cache) {
      return this.cache;
    }

    // Fallback
    return {
      price: this.config.fallbackPrice || 0,
      source: 'fallback',
      timestamp: Date.now(),
      lastUpdate: new Date(),
      currency: 'usd'
    };
  }

  /**
   * Принудительно обновить цену из API
   */
  async refreshMarketPrice(): Promise<boolean> {
    return await this.fetchMarketPrice();
  }

  /**
   * Внутренний метод для получения цены из Binance Futures API (основной источник)
   */
  private async fetchFromBinanceFutures(): Promise<number | null> {
    try {
      const symbol = this.config.binanceFuturesSymbol || 'CCUSDT';
      
      const response = await this.binanceClient.get('/ticker/price', {
        params: {
          symbol: symbol
        }
      });
      
      const priceStr = response.data?.price;
      
      if (!priceStr) {
        throw new Error('Invalid response from Binance Futures API');
      }

      const price = parseFloat(priceStr);
      
      if (isNaN(price) || price <= 0) {
        throw new Error('Invalid price from Binance Futures API');
      }

      return price;
    } catch (error) {
      console.error('❌ Failed to fetch market price from Binance Futures:', error);
      return null;
    }
  }

  /**
   * Внутренний метод для получения цены из Binance Spot API (fallback)
   */
  private async fetchFromBinanceSpot(): Promise<number | null> {
    try {
      const symbol = this.config.binanceSpotSymbol || 'CCUSDT';
      
      const response = await axios.get(`${this.binanceSpotUrl}/ticker/price`, {
        params: {
          symbol: symbol
        },
        timeout: 10000
      });
      
      const priceStr = response.data?.price;
      
      if (!priceStr) {
        throw new Error('Invalid response from Binance Spot API');
      }

      const price = parseFloat(priceStr);
      
      if (isNaN(price) || price <= 0) {
        throw new Error('Invalid price from Binance Spot API');
      }

      return price;
    } catch (error) {
      console.error('❌ Failed to fetch market price from Binance Spot:', error);
      return null;
    }
  }

  /**
   * Внутренний метод для получения цены из GeckoTerminal (fallback)
   */
  private async fetchFromGeckoTerminal(): Promise<number | null> {
    try {
      const network = this.config.geckoTerminalNetwork || 'polygon_pos';
      const poolAddress = this.config.geckoTerminalPoolAddress || '0x2ef3fe6b5833a95edd005ed53377965edda66f64';
      
      const response = await this.geckoTerminalClient.get(`/networks/${network}/pools/${poolAddress}`);
      
      const baseTokenPrice = response.data?.data?.attributes?.base_token_price_usd;
      
      if (!baseTokenPrice) {
        throw new Error('Invalid response from GeckoTerminal API');
      }

      const price = parseFloat(baseTokenPrice);
      
      if (isNaN(price) || price <= 0) {
        throw new Error('Invalid price from GeckoTerminal API');
      }

      return price;
    } catch (error) {
      console.error('❌ Failed to fetch market price from GeckoTerminal:', error);
      return null;
    }
  }

  /**
   * Внутренний метод для получения цены из CoinGecko (fallback)
   */
  private async fetchFromCoinGecko(): Promise<number | null> {
    try {
      const coinId = this.config.coinGeckoCoinId || 'canton-network';
      
      const response = await this.client.get('/simple/price', {
        params: {
          ids: coinId,
          vs_currencies: 'usd',
          include_24hr_change: false,
          include_last_updated_at: true
        }
      });

      const data = response.data[coinId];
      
      if (!data || !data.usd) {
        throw new Error('Invalid response from CoinGecko API');
      }

      return parseFloat(data.usd);
    } catch (error) {
      console.error('❌ Failed to fetch market price from CoinGecko:', error);
      return null;
    }
  }

  /**
   * Внутренний метод для получения цены из API
   */
  private async fetchMarketPrice(): Promise<boolean> {
    if (this.isUpdating) {
      return false;
    }

    this.isUpdating = true;

    try {
      // ✅ Сначала пытаемся получить цену из Binance Futures (основной источник)
      let price: number | null = await this.fetchFromBinanceFutures();
      let source: 'coingecko' | 'fallback' | 'static' = 'coingecko';
      let timestamp = Date.now();

      // Если Binance Futures не сработал, пробуем Binance Spot
      if (!price) {
        price = await this.fetchFromBinanceSpot();
      }

      // Если Binance не сработал, пробуем GeckoTerminal
      if (!price) {
        price = await this.fetchFromGeckoTerminal();
      }

      // Если GeckoTerminal не сработал, пробуем CoinGecko как последний fallback
      if (!price) {
        price = await this.fetchFromCoinGecko();
        if (price) {
          source = 'coingecko';
        }
      } else {
        source = 'coingecko'; // Любой API успешно вернул цену
      }

      // Если оба API не сработали, используем fallback цену
      if (!price || price <= 0) {
        // Fallback на статичные цены если API недоступен
        console.warn('⚠️ Market price API unavailable, using static prices');
        if (this.config.enableFallback && this.config.fallbackPrice && this.config.fallbackPrice > 0) {
          price = this.config.fallbackPrice;
          source = 'fallback';
        } else {
          // Не используем fallback - вернем false, чтобы использовать статичные цены из ConfigMap
          return false;
        }
      }

      // Обновляем кеш
      this.cache = {
        price,
        source,
        timestamp,
        lastUpdate: new Date(timestamp),
        currency: 'usd'
      };

      this.cacheExpiry = Date.now() + (this.config.cacheTTL || 60) * 1000;

      console.log('✅ Market price updated from Binance:', {
        price,
        source: 'binance',
        timestamp: new Date(timestamp).toISOString()
      });

      return true;
    } catch (error) {
      console.error('❌ Failed to fetch market price:', error);

      // Если есть кеш, сохраняем его
      if (this.cache) {
        // Используем старое значение с обновленным временем истекшего кеша
        this.cacheExpiry = Date.now() + 30000; // Даем еще 30 секунд для старого значения
        return true;
      }

      // Если нет кеша и включен fallback
      if (this.config.enableFallback && this.config.fallbackPrice && this.config.fallbackPrice > 0) {
        this.cache = {
          price: this.config.fallbackPrice,
          source: 'fallback',
          timestamp: Date.now(),
          lastUpdate: new Date(),
          currency: 'usd'
        };
        this.cacheExpiry = Date.now() + 60000; // 1 минута для fallback
        return true;
      }

      return false;
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Запустить автоматическое обновление цены
   */
  private startAutoUpdate(): void {
    if (this.updateIntervalId) {
      clearInterval(this.updateIntervalId);
    }

    const interval = this.config.updateInterval || 60000; // 1 минута по умолчанию

    this.updateIntervalId = setInterval(async () => {
      try {
        await this.fetchMarketPrice();
      } catch (error) {
        console.error('❌ Auto-update error:', error);
      }
    }, interval);

    console.log(`🔄 Market price auto-update started (interval: ${interval}ms)`);
  }

  /**
   * Остановить автоматическое обновление
   */
  stopAutoUpdate(): void {
    if (this.updateIntervalId) {
      clearInterval(this.updateIntervalId);
      this.updateIntervalId = null;
      console.log('⏹️ Market price auto-update stopped');
    }
  }

  /**
   * Получить статус сервиса
   */
  getStatus(): {
    isConfigured: boolean;
    hasCache: boolean;
    cacheAge: number;
    lastPrice: number | null;
    source: string;
  } {
    const cacheAge = this.cache 
      ? Math.floor((Date.now() - this.cache.timestamp) / 1000)
      : 0;

    return {
      isConfigured: !!this.config.coinGeckoCoinId,
      hasCache: !!this.cache,
      cacheAge,
      lastPrice: this.cache?.price || null,
      source: this.cache?.source || 'none'
    };
  }

  /**
   * Обновить конфигурацию
   */
  updateConfig(newConfig: Partial<MarketPriceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Перезапускаем автообновление если изменился интервал
    if (newConfig.updateInterval) {
      this.stopAutoUpdate();
      this.startAutoUpdate();
    }
  }
}

// Экспортируем singleton instance
export const marketPriceService = MarketPriceService.getInstance();
export type { MarketPriceConfig, MarketPriceData };

