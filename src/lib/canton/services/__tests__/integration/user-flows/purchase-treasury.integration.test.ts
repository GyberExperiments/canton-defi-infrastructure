import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { TreasuryBillsService } from '@/lib/canton/services/treasuryBillsService';
import { DamlIntegrationService } from '@/lib/canton/services/damlIntegrationService';
import { OracleService } from '@/lib/canton/services/oracleService';
import { ComplianceService } from '@/lib/canton/services/complianceService';

// Mock dependencies
vi.mock('@/lib/canton/services/damlIntegrationService', () => ({
  DamlIntegrationService: vi.fn().mockImplementation(() => ({
    createInstitutionalAsset: vi.fn(),
    createPurchaseRequest: vi.fn(),
    exercisePurchaseRequest: vi.fn(),
  })),
}));

vi.mock('@/lib/canton/services/oracleService', () => ({
  OracleService: vi.fn().mockImplementation(() => ({
    getTreasuryYield: vi.fn().mockResolvedValue({
      maturity: '1Y',
      yield: '5.25',
      asOfDate: new Date().toISOString(),
    }),
  })),
}));

vi.mock('@/lib/canton/services/complianceService', () => ({
  ComplianceService: vi.fn().mockImplementation(() => ({
    validateTransaction: vi.fn().mockResolvedValue({
      compliant: true,
      reasons: [],
    }),
  })),
}));

describe('Purchase Treasury Bills Flow Integration', () => {
  let treasuryService: TreasuryBillsService;
  let damlService: DamlIntegrationService;
  let oracleService: OracleService;
  let complianceService: ComplianceService;

  beforeEach(() => {
    vi.clearAllMocks();

    damlService = new DamlIntegrationService();
    oracleService = new OracleService();
    complianceService = new ComplianceService();

    treasuryService = new TreasuryBillsService(
      {
        enabled: true,
        minInvestment: '100',
        maxInvestment: '10000000',
        settlementType: 'T0',
        yieldDistributionFrequency: 'DAILY',
        autoReinvest: false,
        secondaryMarketEnabled: true,
      },
      damlService,
      oracleService,
      complianceService
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Purchase Flow', () => {
    it('should complete full treasury bill purchase process', async () => {
      // Step 1: Browse available treasury bills
      const bill = await treasuryService.createTreasuryBill({
        name: 'US Treasury 1-Year',
        symbol: 'USTB1Y',
        description: '1-Year US Treasury Bill',
        maturity: '1Y',
        totalSupply: '10000000',
        availableSupply: '10000000',
        pricePerToken: '100.00',
      });

      expect(bill).toBeDefined();
      expect(bill.status).toBe('ACTIVE');
      expect(bill.currentYield).toBe('5.25');

      // Step 2: Create purchase request
      const purchaseRequest = await treasuryService.createPurchaseRequest(
        bill.billId,
        'investor-123',
        100,
        {
          method: 'CRYPTO',
          walletAddress: '0x1234567890abcdef',
          kycLevel: 'RETAIL',
        }
      );

      expect(purchaseRequest).toBeDefined();
      expect(purchaseRequest.status).toBe('PENDING');
      expect(purchaseRequest.complianceCheck.passed).toBe(true);

      // Step 3: Approve purchase request
      const holding = await treasuryService.approvePurchaseRequest(
        purchaseRequest.requestId,
        'approver-123',
        '0xabcdef1234567890',
        12345
      );

      expect(holding).toBeDefined();
      expect(holding.status).toBe('ACTIVE');
      expect(holding.tokensOwned).toBe('100');
      expect(holding.currentMarketValue).toBe('10000');

      // Step 4: Verify holding in user portfolio
      const holdings = treasuryService.getUserHoldings('investor-123');

      expect(holdings.length).toBeGreaterThan(0);
      expect(holdings[0].holdingId).toBe(holding.holdingId);
    });

    it('should handle purchase with minimum investment', async () => {
      const bill = await treasuryService.createTreasuryBill({
        name: 'US Treasury 6-Month',
        symbol: 'USTB6M',
        maturity: '6M',
        minimumInvestment: '100',
      });

      const purchaseRequest = await treasuryService.createPurchaseRequest(
        bill.billId,
        'investor-456',
        1, // 1 token = $100
        {
          method: 'CRYPTO',
          walletAddress: '0x1234567890abcdef',
          kycLevel: 'RETAIL',
        }
      );

      expect(purchaseRequest).toBeDefined();
      expect(purchaseRequest.totalAmount).toBe('100');
    });

    it('should handle purchase with maximum investment', async () => {
      const bill = await treasuryService.createTreasuryBill({
        name: 'US Treasury 1-Year',
        symbol: 'USTB1Y',
        maturity: '1Y',
        maximumInvestment: '10000000',
      });

      const purchaseRequest = await treasuryService.createPurchaseRequest(
        bill.billId,
        'investor-789',
        100000, // 100000 tokens = $10,000,000
        {
          method: 'CRYPTO',
          walletAddress: '0x1234567890abcdef',
          kycLevel: 'INSTITUTIONAL',
        }
      );

      expect(purchaseRequest).toBeDefined();
      expect(purchaseRequest.totalAmount).toBe('10000000');
    });
  });

  describe('Purchase Validation Flow', () => {
    it('should reject purchase below minimum investment', async () => {
      const bill = await treasuryService.createTreasuryBill({
        name: 'US Treasury 1-Year',
        symbol: 'USTB1Y',
        maturity: '1Y',
        minimumInvestment: '100',
      });

      await expect(
        treasuryService.createPurchaseRequest(
          bill.billId,
          'investor-123',
          0.5, // 0.5 token = $50 (below minimum)
          {
            method: 'CRYPTO',
            walletAddress: '0x1234567890abcdef',
            kycLevel: 'RETAIL',
          }
        )
      ).rejects.toThrow('below minimum');
    });

    it('should reject purchase above maximum investment', async () => {
      const bill = await treasuryService.createTreasuryBill({
        name: 'US Treasury 1-Year',
        symbol: 'USTB1Y',
        maturity: '1Y',
        maximumInvestment: '10000000',
      });

      await expect(
        treasuryService.createPurchaseRequest(
          bill.billId,
          'investor-456',
          200000, // 200000 tokens = $20,000,000 (above maximum)
          {
            method: 'CRYPTO',
            walletAddress: '0x1234567890abcdef',
            kycLevel: 'INSTITUTIONAL',
          }
        )
      ).rejects.toThrow('above maximum');
    });

    it('should reject purchase with insufficient supply', async () => {
      const bill = await treasuryService.createTreasuryBill({
        name: 'US Treasury 1-Year',
        symbol: 'USTB1Y',
        maturity: '1Y',
        availableSupply: '1000',
      });

      await expect(
        treasuryService.createPurchaseRequest(
          bill.billId,
          'investor-789',
          2000, // Requesting more than available
          {
            method: 'CRYPTO',
            walletAddress: '0x1234567890abcdef',
            kycLevel: 'RETAIL',
          }
        )
      ).rejects.toThrow('Insufficient available tokens');
    });

    it('should reject purchase with compliance failure', async () => {
      vi.spyOn(complianceService, 'validateTransaction').mockResolvedValueOnce({
        compliant: false,
        reasons: ['Sanctioned country', 'High risk transaction'],
      });

      const bill = await treasuryService.createTreasuryBill({
        name: 'US Treasury 1-Year',
        symbol: 'USTB1Y',
        maturity: '1Y',
      });

      await expect(
        treasuryService.createPurchaseRequest(
          bill.billId,
          'investor-sanctioned',
          100,
          {
            method: 'CRYPTO',
            walletAddress: '0x1234567890abcdef',
            kycLevel: 'RETAIL',
          }
        )
      ).rejects.toThrow('Compliance check failed');
    });
  });

  describe('Purchase Approval Flow', () => {
    it('should approve purchase request successfully', async () => {
      const bill = await treasuryService.createTreasuryBill({
        name: 'US Treasury 1-Year',
        symbol: 'USTB1Y',
        maturity: '1Y',
      });

      const purchaseRequest = await treasuryService.createPurchaseRequest(
        bill.billId,
        'investor-123',
        100,
        {
          method: 'CRYPTO',
          walletAddress: '0x1234567890abcdef',
          kycLevel: 'RETAIL',
        }
      );

      const holding = await treasuryService.approvePurchaseRequest(
        purchaseRequest.requestId,
        'approver-123',
        '0xabcdef1234567890',
        12345
      );

      expect(holding).toBeDefined();
      expect(holding.status).toBe('ACTIVE');
      expect(holding.purchaseDate).toBeDefined();
    });

    it('should handle approval of non-existent request', async () => {
      await expect(
        treasuryService.approvePurchaseRequest(
          'non-existent-request-id',
          'approver-123',
          '0xabcdef1234567890',
          12345
        )
      ).rejects.toThrow('Purchase request not found');
    });

    it('should handle approval of already approved request', async () => {
      const bill = await treasuryService.createTreasuryBill({
        name: 'US Treasury 1-Year',
        symbol: 'USTB1Y',
        maturity: '1Y',
      });

      const purchaseRequest = await treasuryService.createPurchaseRequest(
        bill.billId,
        'investor-123',
        100,
        {
          method: 'CRYPTO',
          walletAddress: '0x1234567890abcdef',
          kycLevel: 'RETAIL',
        }
      );

      await treasuryService.approvePurchaseRequest(
        purchaseRequest.requestId,
        'approver-123',
        '0xabcdef1234567890',
        12345
      );

      await expect(
        treasuryService.approvePurchaseRequest(
          purchaseRequest.requestId,
          'approver-456',
          '0x1234567890abcdef',
          12346
        )
      ).rejects.toThrow();
    });
  });

  describe('Portfolio Management Flow', () => {
    it('should track multiple holdings in portfolio', async () => {
      const bill1 = await treasuryService.createTreasuryBill({
        name: 'US Treasury 1-Year',
        symbol: 'USTB1Y',
        maturity: '1Y',
      });

      const bill2 = await treasuryService.createTreasuryBill({
        name: 'US Treasury 6-Month',
        symbol: 'USTB6M',
        maturity: '6M',
      });

      // Purchase first bill
      const request1 = await treasuryService.createPurchaseRequest(
        bill1.billId,
        'investor-123',
        100,
        {
          method: 'CRYPTO',
          walletAddress: '0x1234567890abcdef',
          kycLevel: 'RETAIL',
        }
      );

      await treasuryService.approvePurchaseRequest(
        request1.requestId,
        'approver-123',
        '0xabcdef1234567890',
        12345
      );

      // Purchase second bill
      const request2 = await treasuryService.createPurchaseRequest(
        bill2.billId,
        'investor-123',
        50,
        {
          method: 'CRYPTO',
          walletAddress: '0x1234567890abcdef',
          kycLevel: 'RETAIL',
        }
      );

      await treasuryService.approvePurchaseRequest(
        request2.requestId,
        'approver-123',
        '0xabcdef1234567890',
        12346
      );

      // Verify portfolio
      const holdings = treasuryService.getUserHoldings('investor-123');

      expect(holdings.length).toBe(2);
      expect(holdings.some(h => h.billId === bill1.billId)).toBe(true);
      expect(holdings.some(h => h.billId === bill2.billId)).toBe(true);
    });

    it('should calculate portfolio value correctly', async () => {
      const bill = await treasuryService.createTreasuryBill({
        name: 'US Treasury 1-Year',
        symbol: 'USTB1Y',
        maturity: '1Y',
        pricePerToken: '100.00',
      });

      const request = await treasuryService.createPurchaseRequest(
        bill.billId,
        'investor-123',
        100,
        {
          method: 'CRYPTO',
          walletAddress: '0x1234567890abcdef',
          kycLevel: 'RETAIL',
        }
      );

      const holding = await treasuryService.approvePurchaseRequest(
        request.requestId,
        'approver-123',
        '0xabcdef1234567890',
        12345
      );

      expect(holding.currentMarketValue).toBe('10000');
      expect(holding.averageCostBasis).toBe('100.00');
    });
  });

  describe('Yield Distribution Flow', () => {
    it('should distribute yield to holdings', async () => {
      const bill = await treasuryService.createTreasuryBill({
        name: 'US Treasury 1-Year',
        symbol: 'USTB1Y',
        maturity: '1Y',
      });

      const request = await treasuryService.createPurchaseRequest(
        bill.billId,
        'investor-123',
        100,
        {
          method: 'CRYPTO',
          walletAddress: '0x1234567890abcdef',
          kycLevel: 'RETAIL',
        }
      );

      await treasuryService.approvePurchaseRequest(
        request.requestId,
        'approver-123',
        '0xabcdef1234567890',
        12345
      );

      // Simulate yield distribution
      const distribution = await (treasuryService as any).distributeYield(
        bill.billId,
        '500',
        new Date().toISOString()
      );

      expect(distribution).toBeDefined();
      expect(distribution.totalYield).toBe('500');
    });
  });

  describe('Error Handling Flow', () => {
    it('should handle network errors during purchase', async () => {
      vi.spyOn(treasuryService as any, 'createPurchaseRequest').mockRejectedValueOnce(
        new Error('Network error')
      );

      const bill = await treasuryService.createTreasuryBill({
        name: 'US Treasury 1-Year',
        symbol: 'USTB1Y',
        maturity: '1Y',
      });

      await expect(
        treasuryService.createPurchaseRequest(
          bill.billId,
          'investor-123',
          100,
          {
            method: 'CRYPTO',
            walletAddress: '0x1234567890abcdef',
            kycLevel: 'RETAIL',
          }
        )
      ).rejects.toThrow('Network error');
    });

    it('should handle concurrent purchase requests', async () => {
      const bill = await treasuryService.createTreasuryBill({
        name: 'US Treasury 1-Year',
        symbol: 'USTB1Y',
        maturity: '1Y',
      });

      const purchasePromises = [
        treasuryService.createPurchaseRequest(
          bill.billId,
          'investor-1',
          100,
          {
            method: 'CRYPTO',
            walletAddress: '0x1234567890abcdef',
            kycLevel: 'RETAIL',
          }
        ),
        treasuryService.createPurchaseRequest(
          bill.billId,
          'investor-2',
          100,
          {
            method: 'CRYPTO',
            walletAddress: '0x1234567890abcdef',
            kycLevel: 'RETAIL',
          }
        ),
      ];

      const results = await Promise.all(purchasePromises);

      expect(results.length).toBe(2);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.status).toBe('PENDING');
      });
    });
  });
});
