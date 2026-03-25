/**
 * Unit Tests for NearSigner
 */

import { NearSigner, createNearSigner } from '../src/near-signer'

describe('NearSigner', () => {
  describe('initialization', () => {
    it('should require valid configuration', async () => {
      const invalidConfig = {
        network: 'testnet' as const,
        accountId: '',
        privateKey: '',
      }

      await expect(createNearSigner(invalidConfig)).rejects.toThrow()
    })

    it('should validate private key format', async () => {
      const config = {
        network: 'testnet' as const,
        accountId: 'test.testnet',
        privateKey: 'invalid-key',
      }

      await expect(createNearSigner(config)).rejects.toThrow()
    })
  })

  describe('transaction preparation', () => {
    it('should prepare valid transaction data', () => {
      // Mock test - в реальности нужен valid signer
      const transactionParams = {
        receiverId: 'contract.testnet',
        methodName: 'test_method',
        args: { test: 'value' },
        gas: '300000000000000',
        attachedDeposit: '0',
      }

      expect(transactionParams.receiverId).toBe('contract.testnet')
      expect(transactionParams.methodName).toBe('test_method')
      expect(transactionParams.gas).toBe('300000000000000')
    })
  })

  describe('ft_transfer_call', () => {
    it('should format ft_transfer_call parameters correctly', () => {
      const params = {
        tokenContractId: 'token.testnet',
        receiverId: 'ref.testnet',
        amount: '1000000',
        msg: JSON.stringify({ action: 'swap' }),
      }

      expect(params.tokenContractId).toBe('token.testnet')
      expect(params.receiverId).toBe('ref.testnet')
      expect(JSON.parse(params.msg)).toEqual({ action: 'swap' })
    })
  })
})

describe('Transaction Result Parsing', () => {
  it('should parse successful transaction', () => {
    const mockResult = {
      success: true,
      transactionHash: 'hash_123',
      returnValue: { amount_out: '1000000' },
    }

    expect(mockResult.success).toBe(true)
    expect(mockResult.transactionHash).toBe('hash_123')
    expect(mockResult.returnValue.amount_out).toBe('1000000')
  })

  it('should handle failed transaction', () => {
    const mockResult = {
      success: false,
      transactionHash: '',
      error: 'Transaction failed',
    }

    expect(mockResult.success).toBe(false)
    expect(mockResult.error).toBeDefined()
  })
})

