import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTreasuryBills } from '@/lib/canton/hooks/useTreasuryBills';
import { TreasuryBillsService } from '@/lib/canton/services/treasuryBillsService';
import { DamlIntegrationService } from '@/lib/canton/services/damlIntegrationService';
import { OracleService } from '@/lib/canton/services/oracleService';
import { ComplianceService } from '@/lib/canton/services/complianceService';

// Mock services
vi.mock('@/lib/canton/services/treasuryBillsService', () => ({
  TreasuryBillsService: vi.fn().mockImplementation(() => ({
    getActiveTreasuryBills: vi.fn(),
    createPurchaseRequest: vi.fn(),
    getUserHoldings: vi.fn(),
    createSellOrder: vi.fn(),
    createBuyOrder: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  })),
}));

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

describe('TreasuryBillsPanel Integration', () => {
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

  describe('useTreasuryBills Hook Integration', () => {
    it('should load available bills on mount', async () => {
      const mockBills = [
        {
          billId: 'bill-1',
          name: 'US Treasury 1-Year',
          symbol: 'USTB1Y',
          maturity: '1Y',
          currentYield: '5.25',
          pricePerToken: '100.00',
          status: 'ACTIVE',
        },
        {
          billId: 'bill-2',
          name: 'US Treasury 6-Month',
          symbol: 'USTB6M',
          maturity: '6M',
          currentYield: '5.10',
          pricePerToken: '100.00',
          status: 'ACTIVE',
        },
      ];

      vi.spyOn(treasuryService, 'getActiveTreasuryBills').mockReturnValue(mockBills);

      const { result } = renderHook(() => useTreasuryBills());

      await waitFor(() => {
        expect(result.current.bills).toBeDefined();
        expect(result.current.bills.length).toBe(2);
        expect(result.current.bills[0].name).toBe('US Treasury 1-Year');
      });
    });

    it('should purchase a bill successfully', async () => {
      const mockPurchaseRequest = {
        requestId: 'req-123',
        billId: 'bill-1',
        investor: 'investor-123',
        numberOfTokens: '100',
        totalAmount: '10000',
        status: 'PENDING',
      };

      vi.spyOn(treasuryService, 'createPurchaseRequest').mockResolvedValue(mockPurchaseRequest);

      const { result } = renderHook(() => useTreasuryBills());

      await waitFor(() => {
        expect(result.current.bills).toBeDefined();
      });

      await result.current.purchaseBill('bill-1', 100, {
        method: 'CRYPTO',
        walletAddress: '0x1234567890abcdef',
        kycLevel: 'RETAIL',
      });

      await waitFor(() => {
        expect(treasuryService.createPurchaseRequest).toHaveBeenCalledWith(
          'bill-1',
          'investor-123',
          100,
          expect.any(Object)
        );
      });
    });

    it('should load user holdings', async () => {
      const mockHoldings = [
        {
          holdingId: 'hold-1',
          billId: 'bill-1',
          investor: 'investor-123',
          tokensOwned: '100',
          currentMarketValue: '10000',
          status: 'ACTIVE',
        },
      ];

      vi.spyOn(treasuryService, 'getUserHoldings').mockReturnValue(mockHoldings);

      const { result } = renderHook(() => useTreasuryBills());

      await waitFor(() => {
        expect(result.current.holdings).toBeDefined();
        expect(result.current.holdings.length).toBe(1);
        expect(result.current.holdings[0].investor).toBe('investor-123');
      });
    });

    it('should create sell order', async () => {
      const mockSellOrder = {
        orderId: 'sell-123',
        holdingId: 'hold-1',
        billId: 'bill-1',
        numberOfTokens: '50',
        pricePerToken: '101.00',
        status: 'OPEN',
      };

      vi.spyOn(treasuryService, 'createSellOrder').mockResolvedValue(mockSellOrder);

      const { result } = renderHook(() => useTreasuryBills());

      await waitFor(() => {
        expect(result.current.holdings).toBeDefined();
      });

      await result.current.sellTokens('hold-1', 50, '101.00', 'LIMIT');

      await waitFor(() => {
        expect(treasuryService.createSellOrder).toHaveBeenCalledWith(
          'hold-1',
          50,
          '101.00',
          'LIMIT'
        );
      });
    });

    it('should create buy order', async () => {
      const mockBuyOrder = {
        orderId: 'buy-123',
        billId: 'bill-1',
        investor: 'investor-123',
        numberOfTokens: '100',
        pricePerToken: '99.00',
        status: 'OPEN',
      };

      vi.spyOn(treasuryService, 'createBuyOrder').mockResolvedValue(mockBuyOrder);

      const { result } = renderHook(() => useTreasuryBills());

      await waitFor(() => {
        expect(result.current.bills).toBeDefined();
      });

      await result.current.placeBuyOrder('bill-1', 100, '99.00', 'LIMIT');

      await waitFor(() => {
        expect(treasuryService.createBuyOrder).toHaveBeenCalledWith(
          'bill-1',
          'investor-123',
          100,
          '99.00',
          'LIMIT'
        );
      });
    });
  });

  describe('TreasuryBillsPanel Component Integration', () => {
    it('should display available bills', async () => {
      const mockBills = [
        {
          billId: 'bill-1',
          name: 'US Treasury 1-Year',
          symbol: 'USTB1Y',
          maturity: '1Y',
          currentYield: '5.25',
          pricePerToken: '100.00',
          status: 'ACTIVE',
        },
      ];

      vi.spyOn(treasuryService, 'getActiveTreasuryBills').mockReturnValue(mockBills);

      const { result } = renderHook(() => useTreasuryBills());

      await waitFor(() => {
        expect(result.current.bills).toBeDefined();
        expect(result.current.bills.length).toBeGreaterThan(0);
      });
    });

    it('should display user holdings', async () => {
      const mockHoldings = [
        {
          holdingId: 'hold-1',
          billId: 'bill-1',
          investor: 'investor-123',
          tokensOwned: '100',
          currentMarketValue: '10000',
          status: 'ACTIVE',
        },
      ];

      vi.spyOn(treasuryService, 'getUserHoldings').mockReturnValue(mockHoldings);

      const { result } = renderHook(() => useTreasuryBills());

      await waitFor(() => {
        expect(result.current.holdings).toBeDefined();
        expect(result.current.holdings.length).toBeGreaterThan(0);
      });
    });

    it('should handle loading state', async () => {
      vi.spyOn(treasuryService, 'getActiveTreasuryBills').mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve([]), 100))
      );

      const { result } = renderHook(() => useTreasuryBills());

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should handle error state', async () => {
      vi.spyOn(treasuryService, 'getActiveTreasuryBills').mockImplementation(
        () => Promise.reject(new Error('Failed to load bills'))
      );

      const { result } = renderHook(() => useTreasuryBills());

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
        expect(result.current.error?.message).toBe('Failed to load bills');
      });
    });
  });

  describe('TreasuryBillsPanel User Interactions', () => {
    it('should handle purchase button click', async () => {
      const mockPurchaseRequest = {
        requestId: 'req-123',
        billId: 'bill-1',
        investor: 'investor-123',
        numberOfTokens: '100',
        totalAmount: '10000',
        status: 'PENDING',
      };

      vi.spyOn(treasuryService, 'createPurchaseRequest').mockResolvedValue(mockPurchaseRequest);

      const { result } = renderHook(() => useTreasuryBills());

      await waitFor(() => {
        expect(result.current.bills).toBeDefined();
      });

      await result.current.purchaseBill('bill-1', 100, {
        method: 'CRYPTO',
        walletAddress: '0x1234567890abcdef',
        kycLevel: 'RETAIL',
      });

      await waitFor(() => {
        expect(result.current.purchaseSuccess).toBe(true);
      });
    });

    it('should handle sell button click', async () => {
      const mockSellOrder = {
        orderId: 'sell-123',
        holdingId: 'hold-1',
        billId: 'bill-1',
        numberOfTokens: '50',
        pricePerToken: '101.00',
        status: 'OPEN',
      };

      vi.spyOn(treasuryService, 'createSellOrder').mockResolvedValue(mockSellOrder);

      const { result } = renderHook(() => useTreasuryBills());

      await waitFor(() => {
        expect(result.current.holdings).toBeDefined();
      });

      await result.current.sellTokens('hold-1', 50, '101.00', 'LIMIT');

      await waitFor(() => {
        expect(result.current.sellSuccess).toBe(true);
      });
    });

    it('should handle buy order placement', async () => {
      const mockBuyOrder = {
        orderId: 'buy-123',
        billId: 'bill-1',
        investor: 'investor-123',
        numberOfTokens: '100',
        pricePerToken: '99.00',
        status: 'OPEN',
      };

      vi.spyOn(treasuryService, 'createBuyOrder').mockResolvedValue(mockBuyOrder);

      const { result } = renderHook(() => useTreasuryBills());

      await waitFor(() => {
        expect(result.current.bills).toBeDefined();
      });

      await result.current.placeBuyOrder('bill-1', 100, '99.00', 'LIMIT');

      await waitFor(() => {
        expect(result.current.buySuccess).toBe(true);
      });
    });
  });

  describe('TreasuryBillsPanel Real-time Updates', () => {
    it('should update bills when new bill is created', async () => {
      const mockBills = [
        {
          billId: 'bill-1',
          name: 'US Treasury 1-Year',
          symbol: 'USTB1Y',
          maturity: '1Y',
          currentYield: '5.25',
          pricePerToken: '100.00',
          status: 'ACTIVE',
        },
      ];

      vi.spyOn(treasuryService, 'getActiveTreasuryBills').mockReturnValue(mockBills);

      const { result } = renderHook(() => useTreasuryBills());

      await waitFor(() => {
        expect(result.current.bills).toBeDefined();
        expect(result.current.bills.length).toBe(1);
      });

      // Simulate new bill creation
      const newBill = {
        billId: 'bill-2',
        name: 'US Treasury 6-Month',
        symbol: 'USTB6M',
        maturity: '6M',
        currentYield: '5.10',
        pricePerToken: '100.00',
        status: 'ACTIVE',
      };

      mockBills.push(newBill);

      await waitFor(() => {
        expect(result.current.bills.length).toBe(2);
      });
    });

    it('should update holdings when purchase is approved', async () => {
      const mockHoldings = [
        {
          holdingId: 'hold-1',
          billId: 'bill-1',
          investor: 'investor-123',
          tokensOwned: '100',
          currentMarketValue: '10000',
          status: 'ACTIVE',
        },
      ];

      vi.spyOn(treasuryService, 'getUserHoldings').mockReturnValue(mockHoldings);

      const { result } = renderHook(() => useTreasuryBills());

      await waitFor(() => {
        expect(result.current.holdings).toBeDefined();
        expect(result.current.holdings.length).toBe(1);
      });

      // Simulate new holding creation
      const newHolding = {
        holdingId: 'hold-2',
        billId: 'bill-2',
        investor: 'investor-123',
        tokensOwned: '50',
        currentMarketValue: '5000',
        status: 'ACTIVE',
      };

      mockHoldings.push(newHolding);

      await waitFor(() => {
        expect(result.current.holdings.length).toBe(2);
      });
    });
  });
});
