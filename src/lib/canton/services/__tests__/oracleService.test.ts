import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OracleService, OracleConfig, PriceData, ExchangeRate, InterestRate, TreasuryYield, MarketIndex, PropertyValuation } from '../oracleService';

// Mock EventEmitter methods
vi.mock('events', () => {
  const EventEmitter = class {
    private listeners: Map<string, Function[]> = new Map();
    
    on(event: string, listener: Function) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event)!.push(listener);
      return this;
    }
    
    off(event: string, listener: Function) {
      const listeners = this.listeners.get(event);
      if (listeners) {
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
      return this;
    }
    
    emit(event: string, ...args: any[]) {
      const listeners = this.listeners.get(event);
      if (listeners) {
        listeners.forEach(listener => listener(...args));
      }
      return true;
    }
    
    removeAllListeners(event?: string) {
      if (event) {
        this.listeners.delete(event);
      } else {
        this.listeners.clear();
      }
      return this;
    }
  };
  
  return { EventEmitter };
});

describe('OracleService', () => {
  let service: OracleService;
  let config: Partial<OracleConfig>;
  
  beforeEach(() => {
    config = {
      enabled: true,
      defaultProvider: 'pyth',
      fallbackProviders: ['chainlink', 'band', 'coingecko'],
      cacheTTL: 60,
      updateInterval: 30,
      maxRetries: 3,
      retryDelay: 1000
    };
    
    service = new OracleService(config);
    
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    service.stopPeriodicUpdates();
  });

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      const defaultService = new OracleService();
      expect(defaultService).toBeInstanceOf(OracleService);
      expect(defaultService['config'].enabled).toBe(true);
      expect(defaultService['config'].defaultProvider).toBe('pyth');
    });

    it('should initialize with custom configuration', () => {
      expect(service['config'].enabled).toBe(true);
      expect(service['config'].defaultProvider).toBe('pyth');
      expect(service['config'].cacheTTL).toBe(60);
      expect(service['config'].updateInterval).toBe(30);
    });

    it('should initialize crypto symbols list', () => {
      const symbols = service['CRYPTO_SYMBOLS'];
      expect(symbols).toContain('BTC');
      expect(symbols).toContain('ETH');
      expect(symbols).toContain('USDT');
    });

    it('should initialize fiat currencies list', () => {
      const currencies = service['FIAT_CURRENCIES'];
      expect(currencies).toContain('USD');
      expect(currencies).toContain('EUR');
      expect(currencies).toContain('GBP');
    });

    it('should initialize treasury maturities', () => {
      const maturities = service['TREASURY_MATURITIES'];
      expect(maturities).toContain('1M');
      expect(maturities).toContain('1Y');
      expect(maturities).toContain('10Y');
    });

    it('should initialize market indices', () => {
      const indices = service['MARKET_INDICES'];
      expect(indices.length).toBeGreaterThan(0);
      expect(indices[0].symbol).toBe('SPX');
    });
  });

  describe('getPrice', () => {
    it('should get price for BTC successfully', async () => {
      const result = await service.getPrice('BTC');
      
      expect(result).toBeDefined();
      expect(result.symbol).toBe('BTC');
      expect(result.price).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.source).toBe('pyth');
    });

    it('should get price for ETH successfully', async () => {
      const result = await service.getPrice('ETH');
      
      expect(result).toBeDefined();
      expect(result.symbol).toBe('ETH');
      expect(result.price).toBeDefined();
    });

    it('should get price for stablecoin', async () => {
      const result = await service.getPrice('USDT');
      
      expect(result).toBeDefined();
      expect(result.symbol).toBe('USDT');
      expect(parseFloat(result.price)).toBeCloseTo(1.0, 1);
    });

    it('should cache price data', async () => {
      await service.getPrice('BTC');
      const cached = service['priceCache'].get('BTC');
      
      expect(cached).toBeDefined();
      expect(cached?.data.symbol).toBe('BTC');
    });

    it('should return cached price if not expired', async () => {
      const firstResult = await service.getPrice('BTC');
      const secondResult = await service.getPrice('BTC');
      
      expect(firstResult.price).toBe(secondResult.price);
    });

    it('should emit price_updated event', async () => {
      const eventSpy = vi.fn();
      service.on('price_updated', eventSpy);

      await service.getPrice('BTC');
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'BTC',
          priceData: expect.any(Object)
        })
      );
    });
  });

  describe('getPrices', () => {
    it('should get prices for multiple symbols', async () => {
      const symbols = ['BTC', 'ETH', 'USDT'];
      const result = await service.getPrices(symbols);
      
      expect(result).toHaveLength(3);
      expect(result[0].symbol).toBe('BTC');
      expect(result[1].symbol).toBe('ETH');
      expect(result[2].symbol).toBe('USDT');
    });

    it('should handle empty symbols array', async () => {
      const result = await service.getPrices([]);
      expect(result).toHaveLength(0);
    });

    it('should handle single symbol', async () => {
      const result = await service.getPrices(['BTC']);
      expect(result).toHaveLength(1);
      expect(result[0].symbol).toBe('BTC');
    });
  });

  describe('getExchangeRate', () => {
    it('should get exchange rate successfully', async () => {
      const result = await service.getExchangeRate('USD', 'EUR');
      
      expect(result).toBeDefined();
      expect(result.fromCurrency).toBe('USD');
      expect(result.toCurrency).toBe('EUR');
      expect(result.rate).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should get exchange rate for USD to GBP', async () => {
      const result = await service.getExchangeRate('USD', 'GBP');
      
      expect(result.fromCurrency).toBe('USD');
      expect(result.toCurrency).toBe('GBP');
      expect(parseFloat(result.rate)).toBeGreaterThan(0);
    });

    it('should cache exchange rate', async () => {
      await service.getExchangeRate('USD', 'EUR');
      const cached = service['exchangeRateCache'].get('USD_EUR');
      
      expect(cached).toBeDefined();
      expect(cached?.data.fromCurrency).toBe('USD');
    });

    it('should return cached exchange rate if not expired', async () => {
      const firstResult = await service.getExchangeRate('USD', 'EUR');
      const secondResult = await service.getExchangeRate('USD', 'EUR');
      
      expect(firstResult.rate).toBe(secondResult.rate);
    });

    it('should emit exchange_rate_updated event', async () => {
      const eventSpy = vi.fn();
      service.on('exchange_rate_updated', eventSpy);

      await service.getExchangeRate('USD', 'EUR');
      
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('getInterestRate', () => {
    it('should get interest rate successfully', async () => {
      const result = await service.getInterestRate('USD', 'FED_FUNDS');
      
      expect(result).toBeDefined();
      expect(result.currency).toBe('USD');
      expect(result.rateType).toBe('FED_FUNDS');
      expect(result.rate).toBeDefined();
    });

    it('should get treasury yield rate', async () => {
      const result = await service.getInterestRate('USD', 'TREASURY_YIELD', '1Y');
      
      expect(result.currency).toBe('USD');
      expect(result.rateType).toBe('TREASURY_YIELD');
      expect(result.maturity).toBe('1Y');
    });

    it('should cache interest rate', async () => {
      await service.getInterestRate('USD', 'FED_FUNDS');
      const cached = service['interestRateCache'].get('USD_FED_FUNDS_default');
      
      expect(cached).toBeDefined();
    });

    it('should emit interest_rate_updated event', async () => {
      const eventSpy = vi.fn();
      service.on('interest_rate_updated', eventSpy);

      await service.getInterestRate('USD', 'FED_FUNDS');
      
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('getTreasuryYield', () => {
    it('should get treasury yield for 1Y maturity', async () => {
      const result = await service.getTreasuryYield('1Y');
      
      expect(result).toBeDefined();
      expect(result.maturity).toBe('1Y');
      expect(result.yield).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should get treasury yield for 10Y maturity', async () => {
      const result = await service.getTreasuryYield('10Y');
      
      expect(result.maturity).toBe('10Y');
      expect(parseFloat(result.yield)).toBeGreaterThan(0);
    });

    it('should cache treasury yield', async () => {
      await service.getTreasuryYield('1Y');
      const cached = service['treasuryYieldCache'].get('1Y');
      
      expect(cached).toBeDefined();
      expect(cached?.data.maturity).toBe('1Y');
    });

    it('should emit treasury_yield_updated event', async () => {
      const eventSpy = vi.fn();
      service.on('treasury_yield_updated', eventSpy);

      await service.getTreasuryYield('1Y');
      
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('getAllTreasuryYields', () => {
    it('should get all treasury yields', async () => {
      const result = await service.getAllTreasuryYields();
      
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].maturity).toBeDefined();
      expect(result[0].yield).toBeDefined();
    });

    it('should include all maturities', async () => {
      const result = await service.getAllTreasuryYields();
      const maturities = result.map(y => y.maturity);
      
      expect(maturities).toContain('1M');
      expect(maturities).toContain('1Y');
      expect(maturities).toContain('10Y');
      expect(maturities).toContain('30Y');
    });
  });

  describe('getMarketIndex', () => {
    it('should get S&P 500 index', async () => {
      const result = await service.getMarketIndex('SPX');
      
      expect(result).toBeDefined();
      expect(result.symbol).toBe('SPX');
      expect(result.name).toBe('S&P 500');
      expect(result.value).toBeDefined();
    });

    it('should get Dow Jones index', async () => {
      const result = await service.getMarketIndex('DJI');
      
      expect(result.symbol).toBe('DJI');
      expect(result.name).toBe('Dow Jones Industrial Average');
    });

    it('should get NASDAQ index', async () => {
      const result = await service.getMarketIndex('IXIC');
      
      expect(result.symbol).toBe('IXIC');
      expect(result.name).toBe('NASDAQ Composite');
    });

    it('should throw error for unknown index', async () => {
      await expect(service.getMarketIndex('UNKNOWN')).rejects.toThrow('Unknown index: UNKNOWN');
    });

    it('should emit market_index_updated event', async () => {
      const eventSpy = vi.fn();
      service.on('market_index_updated', eventSpy);

      await service.getMarketIndex('SPX');
      
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('getAllMarketIndices', () => {
    it('should get all market indices', async () => {
      const result = await service.getAllMarketIndices();
      
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].symbol).toBeDefined();
      expect(result[0].value).toBeDefined();
    });

    it('should include all predefined indices', async () => {
      const result = await service.getAllMarketIndices();
      const symbols = result.map(i => i.symbol);
      
      expect(symbols).toContain('SPX');
      expect(symbols).toContain('DJI');
      expect(symbols).toContain('IXIC');
    });
  });

  describe('getPropertyValuation', () => {
    it('should get property valuation successfully', async () => {
      const result = await service.getPropertyValuation('123 Main St', 'New York', 'NY', 'US');
      
      expect(result).toBeDefined();
      expect(result.address).toBe('123 Main St');
      expect(result.city).toBe('New York');
      expect(result.state).toBe('NY');
      expect(result.country).toBe('US');
      expect(result.estimatedValue).toBeDefined();
    });

    it('should include comparable sales', async () => {
      const result = await service.getPropertyValuation('123 Main St', 'New York', 'NY', 'US');
      
      expect(result.comparableSales).toBeDefined();
      expect(result.comparableSales.length).toBeGreaterThan(0);
    });

    it('should include market trends', async () => {
      const result = await service.getPropertyValuation('123 Main St', 'New York', 'NY', 'US');
      
      expect(result.marketTrends).toBeDefined();
      expect(result.marketTrends.length).toBeGreaterThan(0);
    });

    it('should cache property valuation', async () => {
      await service.getPropertyValuation('123 Main St', 'New York', 'NY', 'US');
      const cacheKey = '123 Main St_New York_NY_US';
      const cached = service['propertyValuationCache'].get(cacheKey);
      
      expect(cached).toBeDefined();
    });

    it('should emit property_valuation_updated event', async () => {
      const eventSpy = vi.fn();
      service.on('property_valuation_updated', eventSpy);

      await service.getPropertyValuation('123 Main St', 'New York', 'NY', 'US');
      
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('getHealthStatus', () => {
    it('should return health object with empty dataSources initially', () => {
      const result = service.getHealthStatus();
      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
      expect(result.dataSources).toEqual([]);
      expect(result.lastUpdate).toBeDefined();
    });

    it('should return health status after fetching data', async () => {
      await service.getPrice('BTC');
      const result = service.getHealthStatus();
      
      expect(result.dataSources.length).toBeGreaterThan(0);
      expect(result.dataSources[0].provider).toBeDefined();
      expect(result.dataSources[0].status).toBeDefined();
    });
  });

  describe('getProviderHealth', () => {
    it('should return undefined for non-existent provider', () => {
      const result = service.getProviderHealth('non-existent');
      expect(result).toBeUndefined();
    });

    it('should return health status for existing provider', async () => {
      await service.getPrice('BTC');
      const result = service.getProviderHealth('pyth');
      
      expect(result).toBeDefined();
      expect(result?.provider).toBe('pyth');
      expect(result?.status).toBe('HEALTHY');
    });
  });

  describe('clearCache', () => {
    beforeEach(async () => {
      await service.getPrice('BTC');
      await service.getExchangeRate('USD', 'EUR');
      await service.getTreasuryYield('1Y');
    });

    it('should clear all caches', () => {
      service.clearCache();
      
      expect(service['priceCache'].size).toBe(0);
      expect(service['exchangeRateCache'].size).toBe(0);
      expect(service['interestRateCache'].size).toBe(0);
      expect(service['treasuryYieldCache'].size).toBe(0);
      expect(service['propertyValuationCache'].size).toBe(0);
    });

    it('should emit cache_cleared event', () => {
      const eventSpy = vi.fn();
      service.on('cache_cleared', eventSpy);

      service.clearCache();
      
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('clear specific caches', () => {
    beforeEach(async () => {
      await service.getPrice('BTC');
      await service.getExchangeRate('USD', 'EUR');
    });

    it('should clear price cache only', () => {
      service.clearPriceCache();
      
      expect(service['priceCache'].size).toBe(0);
      expect(service['exchangeRateCache'].size).toBeGreaterThan(0);
    });

    it('should clear exchange rate cache only', () => {
      service.clearExchangeRateCache();
      
      expect(service['priceCache'].size).toBeGreaterThan(0);
      expect(service['exchangeRateCache'].size).toBe(0);
    });

    it('should clear interest rate cache only', async () => {
      await service.getInterestRate('USD', 'FED_FUNDS');
      service.clearInterestRateCache();
      
      expect(service['interestRateCache'].size).toBe(0);
    });

    it('should clear treasury yield cache only', async () => {
      await service.getTreasuryYield('1Y');
      service.clearTreasuryYieldCache();
      
      expect(service['treasuryYieldCache'].size).toBe(0);
    });

    it('should clear property valuation cache only', async () => {
      await service.getPropertyValuation('123 Main St', 'New York', 'NY', 'US');
      service.clearPropertyValuationCache();
      
      expect(service['propertyValuationCache'].size).toBe(0);
    });
  });

  describe('convertCurrency', () => {
    it('should return same amount for same currency', async () => {
      const result = await service.convertCurrency('100', 'USD', 'USD');
      expect(result).toBe('100');
    });

    it('should convert USD to EUR', async () => {
      const result = await service.convertCurrency('100', 'USD', 'EUR');
      expect(parseFloat(result)).toBeGreaterThan(0);
      expect(parseFloat(result)).toBeLessThan(100);
    });

    it('should convert EUR to USD', async () => {
      const result = await service.convertCurrency('100', 'EUR', 'USD');
      expect(parseFloat(result)).toBeGreaterThan(100);
    });
  });

  describe('calculateTreasuryYield', () => {
    it('should calculate yield for 1Y maturity', async () => {
      const result = await service.calculateTreasuryYield('1Y', '10000');
      
      expect(result).toBeDefined();
      expect(result.yield).toBeDefined();
      expect(result.interest).toBeDefined();
      expect(result.maturityDate).toBeDefined();
    });

    it('should calculate yield for 10Y maturity', async () => {
      const result = await service.calculateTreasuryYield('10Y', '10000');
      
      expect(parseFloat(result.interest)).toBeGreaterThan(parseFloat(result.yield));
    });

    it('should calculate correct maturity date', async () => {
      const result = await service.calculateTreasuryYield('1Y', '10000');
      const maturityDate = new Date(result.maturityDate);
      const now = new Date();
      const daysDiff = (maturityDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      
      expect(daysDiff).toBeCloseTo(365, 1);
    });
  });

  describe('stopPeriodicUpdates', () => {
    it('should stop periodic updates', () => {
      service.stopPeriodicUpdates();
      
      expect(service['updateIntervalId']).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle unknown symbol gracefully', async () => {
      const result = await service.getPrice('UNKNOWN');
      expect(result).toBeDefined();
      expect(['0', '0.00'].includes(result.price)).toBe(true);
    });

    it('should handle unknown exchange rate pair', async () => {
      const result = await service.getExchangeRate('XXX', 'YYY');
      expect(result).toBeDefined();
      expect(result.rate).toBe('1.000000');
    });

    it('should handle very large amounts in currency conversion', async () => {
      const result = await service.convertCurrency('999999999999', 'USD', 'EUR');
      expect(parseFloat(result)).toBeGreaterThan(0);
    });

    it('should handle very small amounts in currency conversion', async () => {
      const result = await service.convertCurrency('0.01', 'USD', 'EUR');
      expect(parseFloat(result)).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle provider errors gracefully', async () => {
      // Mock fetch to throw error
      const originalFetch = service['fetchPriceFromProvider'];
      service['fetchPriceFromProvider'] = vi.fn().mockRejectedValue(new Error('Provider error'));

      // Should still work with fallback
      const result = await service.getPrice('BTC');
      expect(result).toBeDefined();

      // Restore original
      service['fetchPriceFromProvider'] = originalFetch;
    });
  });

  describe('Event Emission', () => {
    it('should emit health_updated event', async () => {
      const eventSpy = vi.fn();
      service.on('health_updated', eventSpy);

      await service.getPrice('BTC');
      
      expect(eventSpy).toHaveBeenCalled();
    });
  });
});
