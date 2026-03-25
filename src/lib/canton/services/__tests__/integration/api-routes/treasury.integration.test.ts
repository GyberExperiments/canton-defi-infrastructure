import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET, POST } from '@/app/api/defi/treasury/bills/route';
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

describe('Treasury API Integration', () => {
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

  describe('TreasuryBillsService Integration', () => {
    it('should create a new treasury bill', async () => {
      const billData = {
        name: 'US Treasury 1-Year',
        symbol: 'USTB1Y',
        description: '1-Year US Treasury Bill',
        maturity: '1Y' as const,
        totalSupply: '10000000',
        pricePerToken: '100.00',
      };

      const bill = await treasuryService.createTreasuryBill(billData);

      expect(bill).toBeDefined();
      expect(bill.billId).toBeDefined();
      expect(bill.name).toBe('US Treasury 1-Year');
      expect(bill.symbol).toBe('USTB1Y');
      expect(bill.maturity).toBe('1Y');
      expect(bill.status).toBe('ACTIVE');
    });

    it('should get treasury bill by ID', async () => {
      const billData = {
        name: 'US Treasury 6-Month',
        symbol: 'USTB6M',
        maturity: '6M' as const,
      };

      const createdBill = await treasuryService.createTreasuryBill(billData);
      const retrievedBill = treasuryService.getTreasuryBill(createdBill.billId);

      expect(retrievedBill).toBeDefined();
      expect(retrievedBill?.billId).toBe(createdBill.billId);
    });

    it('should get all treasury bills', async () => {
      await treasuryService.createTreasuryBill({
        name: 'US Treasury 1-Year',
        symbol: 'USTB1Y',
        maturity: '1Y' as const,
      });

      await treasuryService.createTreasuryBill({
        name: 'US Treasury 6-Month',
        symbol: 'USTB6M',
        maturity: '6M' as const,
      });

      const allBills = treasuryService.getAllTreasuryBills();

      expect(allBills.length).toBeGreaterThanOrEqual(2);
    });

    it('should get only active treasury bills', async () => {
      await treasuryService.createTreasuryBill({
        name: 'Active Bill',
        symbol: 'ACTV',
        maturity: '1Y' as const,
      });

      const activeBills = treasuryService.getActiveTreasuryBills();

      expect(activeBills.length).toBeGreaterThan(0);
      expect(activeBills.every(bill => bill.status === 'ACTIVE')).toBe(true);
    });

    it('should create purchase request', async () => {
      const bill = await treasuryService.createTreasuryBill({
        name: 'US Treasury 1-Year',
        symbol: 'USTB1Y',
        maturity: '1Y' as const,
        totalSupply: '10000000',
        availableSupply: '10000000',
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
      expect(purchaseRequest.billId).toBe(bill.billId);
      expect(purchaseRequest.investor).toBe('investor-123');
      expect(purchaseRequest.status).toBe('PENDING');
    });

    it('should approve purchase request', async () => {
      const bill = await treasuryService.createTreasuryBill({
        name: 'US Treasury 1-Year',
        symbol: 'USTB1Y',
        maturity: '1Y' as const,
        totalSupply: '10000000',
        availableSupply: '10000000',
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
      expect(holding.holdingId).toBeDefined();
      expect(holding.billId).toBe(bill.billId);
      expect(holding.investor).toBe('investor-123');
      expect(holding.status).toBe('ACTIVE');
    });

    it('should get user holdings', async () => {
      const bill = await treasuryService.createTreasuryBill({
        name: 'US Treasury 1-Year',
        symbol: 'USTB1Y',
        maturity: '1Y' as const,
        totalSupply: '10000000',
        availableSupply: '10000000',
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

      const holdings = treasuryService.getUserHoldings('investor-123');

      expect(holdings.length).toBeGreaterThan(0);
      expect(holdings[0].investor).toBe('investor-123');
    });

    it('should create sell order', async () => {
      const bill = await treasuryService.createTreasuryBill({
        name: 'US Treasury 1-Year',
        symbol: 'USTB1Y',
        maturity: '1Y' as const,
        totalSupply: '10000000',
        availableSupply: '10000000',
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

      const sellOrder = await treasuryService.createSellOrder(
        holding.holdingId,
        50,
        '101.00',
        'LIMIT'
      );

      expect(sellOrder).toBeDefined();
      expect(sellOrder.orderId).toBeDefined();
      expect(sellOrder.holdingId).toBe(holding.holdingId);
      expect(sellOrder.status).toBe('OPEN');
    });

    it('should create buy order', async () => {
      const bill = await treasuryService.createTreasuryBill({
        name: 'US Treasury 1-Year',
        symbol: 'USTB1Y',
        maturity: '1Y' as const,
        totalSupply: '10000000',
        availableSupply: '10000000',
      });

      const buyOrder = await treasuryService.createBuyOrder(
        bill.billId,
        'investor-456',
        100,
        '99.00',
        'LIMIT'
      );

      expect(buyOrder).toBeDefined();
      expect(buyOrder.orderId).toBeDefined();
      expect(buyOrder.billId).toBe(bill.billId);
      expect(buyOrder.investor).toBe('investor-456');
      expect(buyOrder.status).toBe('OPEN');
    });
  });

  describe('Treasury Service Events', () => {
    it('should emit treasury_bill_created event', async () => {
      const eventSpy = vi.fn();
      treasuryService.on('treasury_bill_created', eventSpy);

      await treasuryService.createTreasuryBill({
        name: 'US Treasury 1-Year',
        symbol: 'USTB1Y',
        maturity: '1Y' as const,
      });

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should emit purchase_request_created event', async () => {
      const bill = await treasuryService.createTreasuryBill({
        name: 'US Treasury 1-Year',
        symbol: 'USTB1Y',
        maturity: '1Y' as const,
      });

      const eventSpy = vi.fn();
      treasuryService.on('purchase_request_created', eventSpy);

      await treasuryService.createPurchaseRequest(
        bill.billId,
        'investor-123',
        100,
        {
          method: 'CRYPTO',
          walletAddress: '0x1234567890abcdef',
          kycLevel: 'RETAIL',
        }
      );

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should emit holding_created event', async () => {
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

      const eventSpy = vi.fn();
      treasuryService.on('holding_created', eventSpy);

      await treasuryService.approvePurchaseRequest(
        purchaseRequest.requestId,
        'approver-123',
        '0xabcdef1234567890',
        12345
      );

      expect(eventSpy).toHaveBeenCalled();
    });
  });
});
