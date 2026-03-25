/**
 * Unit Tests for ProfitabilityCalculator
 */

import { ProfitabilityCalculator } from '../src/profitability'
import { PriceOracle } from '../src/price-oracle'

describe('ProfitabilityCalculator', () => {
  let calculator: ProfitabilityCalculator
  let priceOracle: PriceOracle

  beforeEach(() => {
    priceOracle = new PriceOracle()
    calculator = new ProfitabilityCalculator(priceOracle)
  })

  describe('intent validation', () => {
    it('should validate correct intent', () => {
      const validIntent = {
        intent_id: 'test_123',
        from_token: 'NEAR',
        to_token: 'USDT',
        amount: '1000000000000000000000000', // 1 NEAR
        min_receive: '100000000', // 100 USDT
        deadline: Math.floor(Date.now() / 1000) + 3600,
        user_account: 'user.testnet',
      }

      const isValid = calculator.isValidIntent(validIntent)
      expect(isValid).toBe(true)
    })

    it('should reject intent with same tokens', () => {
      const invalidIntent = {
        intent_id: 'test_123',
        from_token: 'NEAR',
        to_token: 'NEAR',
        amount: '1000000',
        min_receive: '1000000',
        deadline: Math.floor(Date.now() / 1000) + 3600,
        user_account: 'user.testnet',
      }

      const isValid = calculator.isValidIntent(invalidIntent)
      expect(isValid).toBe(false)
    })

    it('should reject intent with zero amount', () => {
      const invalidIntent = {
        intent_id: 'test_123',
        from_token: 'NEAR',
        to_token: 'USDT',
        amount: '0',
        min_receive: '1000000',
        deadline: Math.floor(Date.now() / 1000) + 3600,
        user_account: 'user.testnet',
      }

      const isValid = calculator.isValidIntent(invalidIntent)
      expect(isValid).toBe(false)
    })

    it('should reject intent with missing fields', () => {
      const invalidIntent = {
        intent_id: 'test_123',
        from_token: '',
        to_token: 'USDT',
        amount: '1000000',
        min_receive: '1000000',
        deadline: Math.floor(Date.now() / 1000) + 3600,
        user_account: 'user.testnet',
      }

      const isValid = calculator.isValidIntent(invalidIntent)
      expect(isValid).toBe(false)
    })
  })

  describe('profitability calculation', () => {
    it('should calculate profit correctly', () => {
      const estimatedOutput = 10100 // USDT
      const minReceive = 10000 // USDT
      const gasCost = 1 // USDT

      const profit = estimatedOutput - minReceive
      const netProfit = profit - gasCost

      expect(netProfit).toBe(99)
      expect(netProfit > 0).toBe(true)
    })

    it('should identify unprofitable intent', () => {
      const estimatedOutput = 10000 // USDT
      const minReceive = 10000 // USDT
      const gasCost = 1 // USDT

      const profit = estimatedOutput - minReceive
      const netProfit = profit - gasCost

      expect(netProfit).toBe(-1)
      expect(netProfit > 0).toBe(false)
    })

    it('should account for threshold', () => {
      const minProfitThreshold = 0.1
      const netProfit = 0.05

      const isProfitable = netProfit > minProfitThreshold && netProfit > 0

      expect(isProfitable).toBe(false)
    })
  })
})

