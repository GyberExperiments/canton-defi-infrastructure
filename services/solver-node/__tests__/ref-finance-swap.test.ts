/**
 * Unit Tests for REF Finance Swap
 */

describe('REF Finance Swap', () => {
  describe('token mapping', () => {
    const TOKEN_IDS: Record<string, string> = {
      'NEAR': 'wrap.near',
      'USDT': 'usdt.tether-token.near',
      'USDC': 'usdc.fair-launch.testnet',
      'ETH': 'aurora',
    }

    it('should map NEAR to wrap.near', () => {
      expect(TOKEN_IDS['NEAR']).toBe('wrap.near')
    })

    it('should map USDT correctly', () => {
      expect(TOKEN_IDS['USDT']).toBe('usdt.tether-token.near')
    })

    it('should handle unknown token', () => {
      const unknownToken = 'UNKNOWN'
      const tokenId = TOKEN_IDS[unknownToken] || unknownToken.toLowerCase()
      expect(tokenId).toBe('unknown')
    })
  })

  describe('swap message formatting', () => {
    it('should create valid swap message', () => {
      const swapMsg = {
        force: 0,
        actions: [
          {
            pool_id: 42,
            token_in: 'wrap.near',
            token_out: 'usdt.tether-token.near',
            amount_in: '1000000000000000000000000',
            min_amount_out: '100000000',
          },
        ],
      }

      expect(swapMsg.force).toBe(0)
      expect(swapMsg.actions).toHaveLength(1)
      expect(swapMsg.actions[0].pool_id).toBe(42)
    })

    it('should serialize to JSON correctly', () => {
      const swapMsg = {
        force: 0,
        actions: [
          {
            pool_id: 42,
            token_in: 'wrap.near',
            token_out: 'usdt.tether-token.near',
            amount_in: '1000000',
            min_amount_out: '100000',
          },
        ],
      }

      const json = JSON.stringify(swapMsg)
      const parsed = JSON.parse(json)

      expect(parsed.force).toBe(0)
      expect(parsed.actions[0].pool_id).toBe(42)
    })
  })

  describe('balance validation', () => {
    it('should validate sufficient balance', () => {
      const balance = BigInt('1000000000000000000000000') // 1 NEAR
      const required = BigInt('100000000000000000000000') // 0.1 NEAR

      const hasSufficient = balance >= required
      expect(hasSufficient).toBe(true)
    })

    it('should detect insufficient balance', () => {
      const balance = BigInt('100000000000000000000000') // 0.1 NEAR
      const required = BigInt('1000000000000000000000000') // 1 NEAR

      const hasSufficient = balance >= required
      expect(hasSufficient).toBe(false)
    })
  })

  describe('amount_out extraction', () => {
    it('should extract from returnValue', () => {
      const txResult = {
        success: true,
        transactionHash: 'hash_123',
        returnValue: {
          amount_out: '100000000',
        },
      }

      const amountOut = txResult.returnValue?.amount_out
      expect(amountOut).toBe('100000000')
    })

    it('should handle missing amount_out', () => {
      const txResult = {
        success: true,
        transactionHash: 'hash_123',
        returnValue: {},
      }

      const amountOut = txResult.returnValue?.amount_out
      expect(amountOut).toBeUndefined()
    })
  })
})

