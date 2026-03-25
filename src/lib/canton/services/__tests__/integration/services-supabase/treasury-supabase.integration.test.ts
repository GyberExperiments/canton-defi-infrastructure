import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TreasuryBillsService } from '@/lib/canton/services/treasuryBillsService';
import { DamlIntegrationService } from '@/lib/canton/services/damlIntegrationService';
import { OracleService } from '@/lib/canton/services/oracleService';
import { ComplianceService } from '@/lib/canton/services/complianceService';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(),
        order: vi.fn(() => ({
          limit: vi.fn(),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
    })),
  })),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

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

describe('TreasuryBillsService ↔ Supabase Integration', () => {
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

  describe('Treasury Bills Storage in Supabase', () => {
    it('should save treasury bill to Supabase database', async () => {
      const billData = {
        name: 'US Treasury 1-Year',
        symbol: 'USTB1Y',
        description: '1-Year US Treasury Bill',
        maturity: '1Y' as const,
        totalSupply: '10000000',
        pricePerToken: '100.00',
      };

      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                bill_id: 'bill-123',
                name: 'US Treasury 1-Year',
                symbol: 'USTB1Y',
                status: 'ACTIVE',
              },
              error: null,
            }),
          })),
        })),
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          })),
        })),
      });

      const bill = await treasuryService.createTreasuryBill(billData);

      expect(bill).toBeDefined();
      expect(bill.billId).toBeDefined();
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('treasury_bills');
    });

    it('should retrieve treasury bill from Supabase database', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                bill_id: 'bill-123',
                name: 'US Treasury 1-Year',
                symbol: 'USTB1Y',
                maturity: '1Y',
                status: 'ACTIVE',
                total_supply: '10000000',
                available_supply: '10000000',
                price_per_token: '100.00',
                current_yield: '5.25',
              },
              error: null,
            }),
          })),
        })),
      });

      const bill = await (treasuryService as any).getTreasuryBillFromDB('bill-123');

      expect(bill).toBeDefined();
      expect(bill.billId).toBe('bill-123');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('treasury_bills');
    });

    it('should update treasury bill in Supabase database', async () => {
      mockSupabaseClient.from.mockReturnValue({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  bill_id: 'bill-123',
                  name: 'US Treasury 1-Year Updated',
                  symbol: 'USTB1Y',
                  status: 'ACTIVE',
                },
                error: null,
              }),
            })),
          })),
        })),
      });

      const updatedBill = await (treasuryService as any).updateTreasuryBillInDB(
        'bill-123',
        { name: 'US Treasury 1-Year Updated' }
      );

      expect(updatedBill).toBeDefined();
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('treasury_bills');
    });
  });

  describe('Purchase Requests Storage in Supabase', () => {
    it('should save purchase request to Supabase database', async () => {
      const bill = await treasuryService.createTreasuryBill({
        name: 'US Treasury 1-Year',
        symbol: 'USTB1Y',
        maturity: '1Y' as const,
      });

      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                request_id: 'req-123',
                bill_id: bill.billId,
                investor: 'investor-123',
                number_of_tokens: '100',
                total_amount: '10000',
                status: 'PENDING',
              },
              error: null,
            }),
          })),
        })),
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

      expect(purchaseRequest).toBeDefined();
      expect(purchaseRequest.requestId).toBeDefined();
    });

    it('should retrieve purchase request from Supabase database', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                request_id: 'req-123',
                bill_id: 'bill-123',
                investor: 'investor-123',
                number_of_tokens: '100',
                total_amount: '10000',
                status: 'PENDING',
              },
              error: null,
            }),
          })),
        })),
      });

      const request = await (treasuryService as any).getPurchaseRequestFromDB('req-123');

      expect(request).toBeDefined();
      expect(request.requestId).toBe('req-123');
    });

    it('should update purchase request status in Supabase database', async () => {
      mockSupabaseClient.from.mockReturnValue({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  request_id: 'req-123',
                  status: 'APPROVED',
                },
                error: null,
              }),
            })),
          })),
        })),
      });

      const updatedRequest = await (treasuryService as any).updatePurchaseRequestInDB(
        'req-123',
        { status: 'APPROVED' }
      );

      expect(updatedRequest).toBeDefined();
      expect(updatedRequest.status).toBe('APPROVED');
    });
  });

  describe('Holdings Storage in Supabase', () => {
    it('should save holding to Supabase database', async () => {
      const bill = await treasuryService.createTreasuryBill({
        name: 'US Treasury 1-Year',
        symbol: 'USTB1Y',
        maturity: '1Y' as const,
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

      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                holding_id: 'hold-123',
                bill_id: bill.billId,
                investor: 'investor-123',
                tokens_owned: '100',
                average_cost_basis: '100.00',
                current_market_value: '10000',
                status: 'ACTIVE',
              },
              error: null,
            }),
          })),
        })),
      });

      const holding = await treasuryService.approvePurchaseRequest(
        purchaseRequest.requestId,
        'approver-123',
        '0xabcdef1234567890',
        12345
      );

      expect(holding).toBeDefined();
      expect(holding.holdingId).toBeDefined();
    });

    it('should retrieve user holdings from Supabase database', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue({
                data: [
                  {
                    holding_id: 'hold-123',
                    bill_id: 'bill-123',
                    investor: 'investor-123',
                    tokens_owned: '100',
                    status: 'ACTIVE',
                  },
                ],
                error: null,
              }),
            })),
          })),
        })),
      });

      const holdings = await (treasuryService as any).getUserHoldingsFromDB('investor-123');

      expect(holdings).toBeDefined();
      expect(holdings.length).toBeGreaterThan(0);
      expect(holdings[0].investor).toBe('investor-123');
    });

    it('should update holding in Supabase database', async () => {
      mockSupabaseClient.from.mockReturnValue({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  holding_id: 'hold-123',
                  tokens_owned: '150',
                  current_market_value: '15000',
                },
                error: null,
              }),
            })),
          })),
        })),
      });

      const updatedHolding = await (treasuryService as any).updateHoldingInDB(
        'hold-123',
        { tokensOwned: '150', currentMarketValue: '15000' }
      );

      expect(updatedHolding).toBeDefined();
      expect(updatedHolding.tokensOwned).toBe('150');
    });
  });

  describe('Yield Distributions Storage in Supabase', () => {
    it('should save yield distribution to Supabase database', async () => {
      const bill = await treasuryService.createTreasuryBill({
        name: 'US Treasury 1-Year',
        symbol: 'USTB1Y',
        maturity: '1Y' as const,
      });

      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                distribution_id: 'dist-123',
                bill_id: bill.billId,
                total_yield: '500',
                yield_per_token: '0.05',
                distribution_date: new Date().toISOString(),
              },
              error: null,
            }),
          })),
        })),
      });

      const distribution = await (treasuryService as any).createYieldDistributionInDB({
        billId: bill.billId,
        totalYield: '500',
        yieldPerToken: '0.05',
      });

      expect(distribution).toBeDefined();
      expect(distribution.distributionId).toBeDefined();
    });

    it('should retrieve yield distributions from Supabase database', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue({
                data: [
                  {
                    distribution_id: 'dist-123',
                    bill_id: 'bill-123',
                    total_yield: '500',
                    yield_per_token: '0.05',
                  },
                ],
                error: null,
              }),
            })),
          })),
        })),
      });

      const distributions = await (treasuryService as any).getYieldDistributionsFromDB('bill-123');

      expect(distributions).toBeDefined();
      expect(distributions.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling with Supabase', () => {
    it('should handle Supabase connection errors', async () => {
      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockRejectedValue(new Error('Connection error')),
          })),
        })),
      });

      await expect(
        (treasuryService as any).createTreasuryBillInDB({
          name: 'Test Bill',
          symbol: 'TEST',
        })
      ).rejects.toThrow('Connection error');
    });

    it('should handle Supabase constraint violations', async () => {
      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: {
                message: 'duplicate key value violates unique constraint',
                code: '23505',
              },
            }),
          })),
        })),
      });

      await expect(
        (treasuryService as any).createTreasuryBillInDB({
          name: 'Test Bill',
          symbol: 'TEST',
        })
      ).rejects.toThrow();
    });
  });
});
