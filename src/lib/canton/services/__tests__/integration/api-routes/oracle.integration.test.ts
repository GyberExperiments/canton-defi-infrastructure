import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OracleService } from '@/lib/canton/services/oracleService';

describe('Oracle API Integration', () => {
  let oracleService: OracleService;

  beforeEach(() => {
    vi.clearAllMocks();

    oracleService = new OracleService({
      enabled: true,
      updateInterval: 60000, // 1 minute
      dataSources: ['PYTH', 'CHAINLINK', 'COINGECKO'],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('OracleService Integration', () => {
    it('should get treasury yield for 1-year maturity', async () => {
      const yieldData = await oracleService.getTreasuryYield('1Y');

      expect(yieldData).toBeDefined();
      expect(yieldData.maturity).toBe('1Y');
      expect(yieldData.yield).toBeDefined();
      expect(yieldData.asOfDate).toBeDefined();
    });

    it('should get treasury yield for 6-month maturity', async () => {
      const yieldData = await oracleService.getTreasuryYield('6M');

      expect(yieldData).toBeDefined();
      expect(yieldData.maturity).toBe('6M');
      expect(yieldData.yield).toBeDefined();
    });

    it('should get treasury yield for 3-month maturity', async () => {
      const yieldData = await oracleService.getTreasuryYield('3M');

      expect(yieldData).toBeDefined();
      expect(yieldData.maturity).toBe('3M');
      expect(yieldData.yield).toBeDefined();
    });

    it('should get treasury yield for 1-month maturity', async () => {
      const yieldData = await oracleService.getTreasuryYield('1M');

      expect(yieldData).toBeDefined();
      expect(yieldData.maturity).toBe('1M');
      expect(yieldData.yield).toBeDefined();
    });

    it('should get all treasury yields', async () => {
      const yields = await oracleService.getAllTreasuryYields();

      expect(yields).toBeDefined();
      expect(yields.length).toBeGreaterThan(0);
      expect(yields.every(y => y.maturity && y.yield)).toBe(true);
    });

    it('should get crypto price for USDC', async () => {
      const price = await oracleService.getCryptoPrice('USDC');

      expect(price).toBeDefined();
      expect(price.symbol).toBe('USDC');
      expect(price.price).toBeDefined();
      expect(price.timestamp).toBeDefined();
    });

    it('should get crypto price for USDT', async () => {
      const price = await oracleService.getCryptoPrice('USDT');

      expect(price).toBeDefined();
      expect(price.symbol).toBe('USDT');
      expect(price.price).toBeDefined();
    });

    it('should get crypto price for ETH', async () => {
      const price = await oracleService.getCryptoPrice('ETH');

      expect(price).toBeDefined();
      expect(price.symbol).toBe('ETH');
      expect(price.price).toBeDefined();
    });

    it('should get crypto price for BTC', async () => {
      const price = await oracleService.getCryptoPrice('BTC');

      expect(price).toBeDefined();
      expect(price.symbol).toBe('BTC');
      expect(price.price).toBeDefined();
    });

    it('should get multiple crypto prices', async () => {
      const prices = await oracleService.getCryptoPrices(['USDC', 'USDT', 'ETH', 'BTC']);

      expect(prices).toBeDefined();
      expect(prices.length).toBe(4);
      expect(prices.every(p => p.symbol && p.price)).toBe(true);
    });

    it('should get property valuation', async () => {
      const valuation = await oracleService.getPropertyValuation('property-123');

      expect(valuation).toBeDefined();
      expect(valuation.propertyId).toBe('property-123');
      expect(valuation.estimatedValue).toBeDefined();
      expect(valuation.valuationDate).toBeDefined();
    });

    it('should get exchange rate', async () => {
      const rate = await oracleService.getExchangeRate('USD', 'EUR');

      expect(rate).toBeDefined();
      expect(rate.fromCurrency).toBe('USD');
      expect(rate.toCurrency).toBe('EUR');
      expect(rate.rate).toBeDefined();
      expect(rate.timestamp).toBeDefined();
    });

    it('should get multiple exchange rates', async () => {
      const rates = await oracleService.getExchangeRates('USD', ['EUR', 'GBP', 'JPY']);

      expect(rates).toBeDefined();
      expect(rates.length).toBe(3);
      expect(rates.every(r => r.fromCurrency === 'USD' && r.rate)).toBe(true);
    });

    it('should get market data for asset', async () => {
      const marketData = await oracleService.getMarketData('USDC');

      expect(marketData).toBeDefined();
      expect(marketData.symbol).toBe('USDC');
      expect(marketData.price).toBeDefined();
      expect(marketData.volume24h).toBeDefined();
      expect(marketData.marketCap).toBeDefined();
    });

    it('should get historical price data', async () => {
      const historicalData = await oracleService.getHistoricalPriceData(
        'USDC',
        '1D',
        7
      );

      expect(historicalData).toBeDefined();
      expect(historicalData.symbol).toBe('USDC');
      expect(historicalData.interval).toBe('1D');
      expect(historicalData.dataPoints.length).toBeGreaterThan(0);
    });

    it('should subscribe to price updates', () => {
      const callback = vi.fn();
      const subscriptionId = oracleService.subscribeToPriceUpdates('USDC', callback);

      expect(subscriptionId).toBeDefined();
      expect(typeof subscriptionId).toBe('string');
    });

    it('should unsubscribe from price updates', () => {
      const callback = vi.fn();
      const subscriptionId = oracleService.subscribeToPriceUpdates('USDC', callback);

      const result = oracleService.unsubscribeFromPriceUpdates(subscriptionId);

      expect(result).toBe(true);
    });

    it('should get oracle health status', () => {
      const health = oracleService.getHealthStatus();

      expect(health).toBeDefined();
      expect(health.status).toBeDefined();
      expect(health.lastUpdate).toBeDefined();
      expect(health.dataSources).toBeDefined();
    });
  });

  describe('Oracle Service Events', () => {
    it('should emit price_updated event', async () => {
      const eventSpy = vi.fn();
      oracleService.on('price_updated', eventSpy);

      await oracleService.getCryptoPrice('USDC');

      // Event should be emitted after price update
      expect(eventSpy).toHaveBeenCalled();
    });

    it('should emit treasury_yield_updated event', async () => {
      const eventSpy = vi.fn();
      oracleService.on('treasury_yield_updated', eventSpy);

      await oracleService.getTreasuryYield('1Y');

      // Event should be emitted after yield update
      expect(eventSpy).toHaveBeenCalled();
    });

    it('should emit data_source_connected event', () => {
      const eventSpy = vi.fn();
      oracleService.on('data_source_connected', eventSpy);

      // Trigger data source connection
      oracleService.connectDataSource('PYTH');

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should emit data_source_disconnected event', () => {
      const eventSpy = vi.fn();
      oracleService.on('data_source_disconnected', eventSpy);

      // Trigger data source disconnection
      oracleService.disconnectDataSource('PYTH');

      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('Oracle Service Error Handling', () => {
    it('should handle invalid symbol gracefully', async () => {
      const price = await oracleService.getCryptoPrice('INVALID_SYMBOL');

      expect(price).toBeDefined();
      expect(price.price).toBe('0');
    });

    it('should handle invalid maturity gracefully', async () => {
      const yieldData = await oracleService.getTreasuryYield('INVALID' as any);

      expect(yieldData).toBeDefined();
      expect(yieldData.yield).toBe('0');
    });

    it('should handle network errors gracefully', async () => {
      // Mock network error
      vi.spyOn(oracleService as any, 'fetchFromDataSource').mockRejectedValueOnce(
        new Error('Network error')
      );

      const price = await oracleService.getCryptoPrice('USDC');

      expect(price).toBeDefined();
      expect(price.price).toBe('0');
    });
  });
});
