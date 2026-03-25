import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TreasuryBillsService, TreasuryBillConfig, TreasuryBill, TreasuryBillHolding, PurchaseRequest, SellOrder, BuyOrder } from '../treasuryBillsService';
import { DamlIntegrationService } from '../damlIntegrationService';
import { OracleService } from '../oracleService';
import { ComplianceService } from '../complianceService';
import Decimal from 'decimal.js';

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

describe('TreasuryBillsService', () => {
  let service: TreasuryBillsService;
  let damlService: DamlIntegrationService;
  let oracleService: OracleService;
  let complianceService: ComplianceService;
  let config: Partial<TreasuryBillConfig>;
  
  beforeEach(() => {
    // Set environment variables for testing
    process.env.NEXT_PUBLIC_DAML_USE_MOCK_FALLBACK = 'true';
    
    config = {
      enabled: true,
      minInvestment: '100',
      maxInvestment: '10000000',
      settlementType: 'T0',
      yieldDistributionFrequency: 'DAILY',
      autoReinvest: false,
      secondaryMarketEnabled: true
    };
    
    damlService = new DamlIntegrationService({
      participantUrl: 'https://test-participant.canton.network',
      participantId: 'test-participant',
      authToken: 'test-token',
      partyId: 'test-party'
    });
    
    oracleService = new OracleService({
      enabled: true,
      defaultProvider: 'pyth',
      cacheTTL: 60
    });
    
    complianceService = new ComplianceService({
      enabled: true,
      strictMode: false
    });
    
    service = new TreasuryBillsService(config, damlService, oracleService, complianceService);
    
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      const defaultService = new TreasuryBillsService({}, damlService, oracleService, complianceService);
      expect(defaultService).toBeInstanceOf(TreasuryBillsService);
      expect(defaultService['config'].enabled).toBe(true);
      expect(defaultService['config'].minInvestment).toBe('100');
    });

    it('should initialize with custom configuration', () => {
      expect(service['config'].enabled).toBe(true);
      expect(service['config'].minInvestment).toBe('100');
      expect(service['config'].maxInvestment).toBe('10000000');
      expect(service['config'].settlementType).toBe('T0');
    });

    it('should initialize dependencies', () => {
      expect(service['damlService']).toBe(damlService);
      expect(service['oracleService']).toBe(oracleService);
      expect(service['complianceService']).toBe(complianceService);
    });
  });

  describe('createTreasuryBill', () => {
    it('should create treasury bill successfully', async () => {
      const billData = {
        name: 'US Treasury Bill 1Y',
        symbol: 'USTB1Y',
        description: '1-year US Treasury Bill',
        maturity: '1Y' as const,
        totalSupply: '10000000',
        availableSupply: '10000000',
        pricePerToken: '100.00'
      };

      const result = await service.createTreasuryBill(billData);
      
      expect(result).toBeDefined();
      expect(result.billId).toBeDefined();
      expect(result.name).toBe('US Treasury Bill 1Y');
      expect(result.symbol).toBe('USTB1Y');
      expect(result.status).toBe('ACTIVE');
    });

    it('should use default values when not provided', async () => {
      const billData = {
        name: 'Test Bill'
      };

      const result = await service.createTreasuryBill(billData);
      
      expect(result).toBeDefined();
      expect(result.symbol).toBe('USTB');
      expect(result.maturity).toBe('1Y');
      expect(result.pricePerToken).toBe('100.00');
    });

    it('should calculate maturity date correctly', async () => {
      const billData = {
        name: 'Test Bill',
        maturity: '1Y' as const
      };

      const result = await service.createTreasuryBill(billData);
      const maturityDate = new Date(result.maturityDate);
      const now = new Date();
      const daysDiff = (maturityDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      
      expect(daysDiff).toBeCloseTo(365, 1);
    });

    it('should cache treasury bill', async () => {
      const billData = {
        name: 'Test Bill'
      };

      const result = await service.createTreasuryBill(billData);
      const cached = service['treasuryBills'].get(result.billId);
      
      expect(cached).toBeDefined();
      expect(cached?.name).toBe('Test Bill');
    });

    it('should emit treasury_bill_created event', async () => {
      const billData = {
        name: 'Test Bill'
      };

      const eventSpy = vi.fn();
      service.on('treasury_bill_created', eventSpy);

      await service.createTreasuryBill(billData);
      
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('getTreasuryBill', () => {
    let billId: string;

    beforeEach(async () => {
      const bill = await service.createTreasuryBill({ name: 'Test Bill' });
      billId = bill.billId;
    });

    it('should get treasury bill by ID', () => {
      const result = service.getTreasuryBill(billId);
      
      expect(result).toBeDefined();
      expect(result?.billId).toBe(billId);
    });

    it('should return undefined for non-existent bill', () => {
      const result = service.getTreasuryBill('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('getAllTreasuryBills', () => {
    it('should return empty array initially', () => {
      const result = service.getAllTreasuryBills();
      expect(result).toEqual([]);
    });

    it('should return all treasury bills', async () => {
      await service.createTreasuryBill({ name: 'Bill 1' });
      await service.createTreasuryBill({ name: 'Bill 2' });
      
      const result = service.getAllTreasuryBills();
      expect(result.length).toBe(2);
    });
  });

  describe('getActiveTreasuryBills', () => {
    it('should return only active bills', async () => {
      const bill1 = await service.createTreasuryBill({ name: 'Active Bill' });
      await service.createTreasuryBill({ name: 'Suspended Bill', status: 'SUSPENDED' });
      
      const result = service.getActiveTreasuryBills();
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some((b: any) => b.billId === bill1.billId)).toBe(true);
    });
  });

  describe('updateTreasuryBill', () => {
    let billId: string;

    beforeEach(async () => {
      const bill = await service.createTreasuryBill({ name: 'Test Bill' });
      billId = bill.billId;
    });

    it('should update treasury bill successfully', async () => {
      const result = await service.updateTreasuryBill(billId, {
        name: 'Updated Bill',
        availableSupply: '5000000'
      });
      
      expect(result.name).toBe('Updated Bill');
      expect(result.availableSupply).toBe('5000000');
    });

    it('should throw error for non-existent bill', async () => {
      await expect(
        service.updateTreasuryBill('non-existent', { name: 'Updated' })
      ).rejects.toThrow('Treasury bill not found');
    });

    it('should emit treasury_bill_updated event', async () => {
      const eventSpy = vi.fn();
      service.on('treasury_bill_updated', eventSpy);

      await service.updateTreasuryBill(billId, { name: 'Updated' });
      
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('createPurchaseRequest', () => {
    let billId: string;

    beforeEach(async () => {
      const bill = await service.createTreasuryBill({
        name: 'Test Bill',
        pricePerToken: '100.00',
        availableSupply: '1000000'
      });
      billId = bill.billId;
      
      // Create approved KYC verification
      const personalInfo = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        nationality: 'US',
        countryOfResidence: 'US'
      };
      const verification = await complianceService.startKYCVerification('investor1', personalInfo, 'RETAIL');
      
      const document = {
        documentType: 'PASSPORT' as const,
        documentNumber: 'A12345678',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      };
      const doc = await complianceService.submitKYCDocument(verification.verificationId, document);
      await complianceService.verifyKYCDocument(verification.verificationId, doc.documentId, 'VERIFIED');
      
      const document2 = {
        documentType: 'PROOF_OF_ADDRESS' as const,
        documentNumber: 'ADDR123',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      };
      const doc2 = await complianceService.submitKYCDocument(verification.verificationId, document2);
      await complianceService.verifyKYCDocument(verification.verificationId, doc2.documentId, 'VERIFIED');
    });

    it('should create purchase request successfully', async () => {
      const result = await service.createPurchaseRequest(
        billId,
        'investor1',
        10,
        {
          method: 'CRYPTO',
          kycLevel: 'RETAIL',
          country: 'US'
        }
      );
      
      expect(result).toBeDefined();
      expect(result.requestId).toBeDefined();
      expect(result.billId).toBe(billId);
      expect(result.investor).toBe('investor1');
      expect(result.status).toBe('PENDING');
    });

    it('should calculate total amount correctly', async () => {
      const result = await service.createPurchaseRequest(
        billId,
        'investor1',
        10,
        { method: 'CRYPTO' }
      );
      
      expect(['1000', '1000.00'].includes(result.totalAmount)).toBe(true);
    });

    it('should throw error for non-existent bill', async () => {
      await expect(
        service.createPurchaseRequest('non-existent', 'investor1', 10, {})
      ).rejects.toThrow('Treasury bill not found');
    });

    it('should throw error for amount below minimum', async () => {
      await expect(
        service.createPurchaseRequest(billId, 'investor1', 0.5, {})
      ).rejects.toThrow('Investment amount below minimum');
    });

    it('should throw error for amount above maximum', async () => {
      await expect(
        service.createPurchaseRequest(billId, 'investor1', 200000, {})
      ).rejects.toThrow('Investment amount above maximum');
    });

    it('should throw error for insufficient tokens', async () => {
      await expect(
        service.createPurchaseRequest(billId, 'investor1', 2000000, {})
      ).rejects.toThrow();
    });

    it('should cache purchase request', async () => {
      const result = await service.createPurchaseRequest(
        billId,
        'investor1',
        10,
        { method: 'CRYPTO' }
      );
      
      const cached = service['purchaseRequests'].get(result.requestId);
      expect(cached).toBeDefined();
      expect(cached?.investor).toBe('investor1');
    });

    it('should emit purchase_request_created event', async () => {
      const eventSpy = vi.fn();
      service.on('purchase_request_created', eventSpy);

      await service.createPurchaseRequest(billId, 'investor1', 10, {});
      
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('approvePurchaseRequest', () => {
    let requestId: string;

    beforeEach(async () => {
      const bill = await service.createTreasuryBill({
        name: 'Test Bill',
        pricePerToken: '100.00',
        availableSupply: '1000000'
      });
      
      // Create approved KYC verification
      const personalInfo = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        nationality: 'US',
        countryOfResidence: 'US'
      };
      const verification = await complianceService.startKYCVerification('investor1', personalInfo, 'RETAIL');
      
      const document = {
        documentType: 'PASSPORT' as const,
        documentNumber: 'A12345678',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      };
      const doc = await complianceService.submitKYCDocument(verification.verificationId, document);
      await complianceService.verifyKYCDocument(verification.verificationId, doc.documentId, 'VERIFIED');
      
      const document2 = {
        documentType: 'PROOF_OF_ADDRESS' as const,
        documentNumber: 'ADDR123',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      };
      const doc2 = await complianceService.submitKYCDocument(verification.verificationId, document2);
      await complianceService.verifyKYCDocument(verification.verificationId, doc2.documentId, 'VERIFIED');
      
      const request = await service.createPurchaseRequest(
        bill.billId,
        'investor1',
        10,
        { method: 'CRYPTO' }
      );
      requestId = request.requestId;
    });

    it('should approve purchase request successfully', async () => {
      const result = await service.approvePurchaseRequest(
        requestId,
        'approver1',
        '0x1234567890abcdef',
        12345
      );
      
      expect(result).toBeDefined();
      expect(result.holdingId).toBeDefined();
      expect(result.investor).toBe('investor1');
      expect(result.status).toBe('ACTIVE');
    });

    it('should update bill available supply', async () => {
      const bill = service.getTreasuryBill(service['purchaseRequests'].get(requestId)!.billId);
      const initialSupply = bill?.availableSupply;
      
      await service.approvePurchaseRequest(
        requestId,
        'approver1',
        '0x1234567890abcdef',
        12345
      );
      
      const updatedBill = service.getTreasuryBill(service['purchaseRequests'].get(requestId)!.billId);
      expect(updatedBill?.availableSupply).not.toBe(initialSupply);
    });

    it('should throw error for non-existent request', async () => {
      await expect(
        service.approvePurchaseRequest('non-existent', 'approver1', '0x123', 12345)
      ).rejects.toThrow('Purchase request not found');
    });

    it('should emit purchase_approved event', async () => {
      const eventSpy = vi.fn();
      service.on('purchase_approved', eventSpy);

      await service.approvePurchaseRequest(
        requestId,
        'approver1',
        '0x1234567890abcdef',
        12345
      );
      
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('rejectPurchaseRequest', () => {
    let requestId: string;

    beforeEach(async () => {
      const bill = await service.createTreasuryBill({
        name: 'Test Bill',
        pricePerToken: '100.00',
        availableSupply: '1000000'
      });
      
      // Create approved KYC verification
      const personalInfo = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        nationality: 'US',
        countryOfResidence: 'US'
      };
      const verification = await complianceService.startKYCVerification('investor1', personalInfo, 'RETAIL');
      
      const document = {
        documentType: 'PASSPORT' as const,
        documentNumber: 'A12345678',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      };
      const doc = await complianceService.submitKYCDocument(verification.verificationId, document);
      await complianceService.verifyKYCDocument(verification.verificationId, doc.documentId, 'VERIFIED');
      
      const document2 = {
        documentType: 'PROOF_OF_ADDRESS' as const,
        documentNumber: 'ADDR123',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      };
      const doc2 = await complianceService.submitKYCDocument(verification.verificationId, document2);
      await complianceService.verifyKYCDocument(verification.verificationId, doc2.documentId, 'VERIFIED');
      
      const request = await service.createPurchaseRequest(
        bill.billId,
        'investor1',
        10,
        { method: 'CRYPTO' }
      );
      requestId = request.requestId;
    });

    it('should reject purchase request successfully', async () => {
      await service.rejectPurchaseRequest(requestId, 'Insufficient funds');
      
      const request = service['purchaseRequests'].get(requestId);
      expect(request?.status).toBe('REJECTED');
    });

    it('should throw error for non-existent request', async () => {
      await expect(
        service.rejectPurchaseRequest('non-existent', 'Reason')
      ).rejects.toThrow('Purchase request not found');
    });

    it('should emit purchase_rejected event', async () => {
      const eventSpy = vi.fn();
      service.on('purchase_rejected', eventSpy);

      await service.rejectPurchaseRequest(requestId, 'Reason');
      
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('getHolding', () => {
    let holdingId: string;

    beforeEach(async () => {
      const bill = await service.createTreasuryBill({
        name: 'Test Bill',
        pricePerToken: '100.00',
        availableSupply: '1000000'
      });
      
      // Create approved KYC verification
      const personalInfo = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        nationality: 'US',
        countryOfResidence: 'US'
      };
      const verification = await complianceService.startKYCVerification('investor1', personalInfo, 'RETAIL');
      
      const document = {
        documentType: 'PASSPORT' as const,
        documentNumber: 'A12345678',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      };
      const doc = await complianceService.submitKYCDocument(verification.verificationId, document);
      await complianceService.verifyKYCDocument(verification.verificationId, doc.documentId, 'VERIFIED');
      
      const document2 = {
        documentType: 'PROOF_OF_ADDRESS' as const,
        documentNumber: 'ADDR123',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      };
      const doc2 = await complianceService.submitKYCDocument(verification.verificationId, document2);
      await complianceService.verifyKYCDocument(verification.verificationId, doc2.documentId, 'VERIFIED');
      
      const request = await service.createPurchaseRequest(
        bill.billId,
        'investor1',
        10,
        { method: 'CRYPTO' }
      );
      const holding = await service.approvePurchaseRequest(
        request.requestId,
        'approver1',
        '0x1234567890abcdef',
        12345
      );
      holdingId = holding.holdingId;
    });

    it('should get holding by ID', () => {
      const result = service.getHolding(holdingId);
      
      expect(result).toBeDefined();
      expect(result?.holdingId).toBe(holdingId);
    });

    it('should return undefined for non-existent holding', () => {
      const result = service.getHolding('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('getInvestorHoldings', () => {
    beforeEach(async () => {
      const bill = await service.createTreasuryBill({
        name: 'Test Bill',
        pricePerToken: '100.00',
        availableSupply: '1000000'
      });
      
      // Create approved KYC verification
      const personalInfo = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        nationality: 'US',
        countryOfResidence: 'US'
      };
      const verification = await complianceService.startKYCVerification('investor1', personalInfo, 'RETAIL');
      
      const document = {
        documentType: 'PASSPORT' as const,
        documentNumber: 'A12345678',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      };
      const doc = await complianceService.submitKYCDocument(verification.verificationId, document);
      await complianceService.verifyKYCDocument(verification.verificationId, doc.documentId, 'VERIFIED');
      
      const document2 = {
        documentType: 'PROOF_OF_ADDRESS' as const,
        documentNumber: 'ADDR123',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      };
      const doc2 = await complianceService.submitKYCDocument(verification.verificationId, document2);
      await complianceService.verifyKYCDocument(verification.verificationId, doc2.documentId, 'VERIFIED');
      
      const request = await service.createPurchaseRequest(
        bill.billId,
        'investor1',
        10,
        { method: 'CRYPTO' }
      );
      await service.approvePurchaseRequest(
        request.requestId,
        'approver1',
        '0x1234567890abcdef',
        12345
      );
    });

    it('should get holdings for investor', () => {
      const result = service.getInvestorHoldings('investor1');
      
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].investor).toBe('investor1');
    });

    it('should return empty array for investor with no holdings', () => {
      const result = service.getInvestorHoldings('investor2');
      expect(result).toEqual([]);
    });
  });

  describe('updateHoldingMarketValue', () => {
    let holdingId: string;

    beforeEach(async () => {
      const bill = await service.createTreasuryBill({
        name: 'Test Bill',
        pricePerToken: '100.00',
        availableSupply: '1000000'
      });
      
      // Create approved KYC verification
      const personalInfo = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        nationality: 'US',
        countryOfResidence: 'US'
      };
      const verification = await complianceService.startKYCVerification('investor1', personalInfo, 'RETAIL');
      
      const document = {
        documentType: 'PASSPORT' as const,
        documentNumber: 'A12345678',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      };
      const doc = await complianceService.submitKYCDocument(verification.verificationId, document);
      await complianceService.verifyKYCDocument(verification.verificationId, doc.documentId, 'VERIFIED');
      
      const document2 = {
        documentType: 'PROOF_OF_ADDRESS' as const,
        documentNumber: 'ADDR123',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      };
      const doc2 = await complianceService.submitKYCDocument(verification.verificationId, document2);
      await complianceService.verifyKYCDocument(verification.verificationId, doc2.documentId, 'VERIFIED');
      
      const request = await service.createPurchaseRequest(
        bill.billId,
        'investor1',
        10,
        { method: 'CRYPTO' }
      );
      const holding = await service.approvePurchaseRequest(
        request.requestId,
        'approver1',
        '0x1234567890abcdef',
        12345
      );
      holdingId = holding.holdingId;
    });

    it('should update holding market value successfully', async () => {
      const result = await service.updateHoldingMarketValue(holdingId);
      
      expect(result).toBeDefined();
      expect(result.holdingId).toBe(holdingId);
      expect(result.currentMarketValue).toBeDefined();
    });

    it('should throw error for non-existent holding', async () => {
      await expect(
        service.updateHoldingMarketValue('non-existent')
      ).rejects.toThrow('Holding not found');
    });

    it('should emit holding_updated event', async () => {
      const eventSpy = vi.fn();
      service.on('holding_updated', eventSpy);

      await service.updateHoldingMarketValue(holdingId);
      
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('createSellOrder', () => {
    let holdingId: string;

    beforeEach(async () => {
      const bill = await service.createTreasuryBill({
        name: 'Test Bill',
        pricePerToken: '100.00',
        availableSupply: '1000000'
      });
      
      // Create approved KYC verification
      const personalInfo = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        nationality: 'US',
        countryOfResidence: 'US'
      };
      const verification = await complianceService.startKYCVerification('investor1', personalInfo, 'RETAIL');
      
      const document = {
        documentType: 'PASSPORT' as const,
        documentNumber: 'A12345678',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      };
      const doc = await complianceService.submitKYCDocument(verification.verificationId, document);
      await complianceService.verifyKYCDocument(verification.verificationId, doc.documentId, 'VERIFIED');
      
      const document2 = {
        documentType: 'PROOF_OF_ADDRESS' as const,
        documentNumber: 'ADDR123',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      };
      const doc2 = await complianceService.submitKYCDocument(verification.verificationId, document2);
      await complianceService.verifyKYCDocument(verification.verificationId, doc2.documentId, 'VERIFIED');
      
      const request = await service.createPurchaseRequest(
        bill.billId,
        'investor1',
        10,
        { method: 'CRYPTO' }
      );
      const holding = await service.approvePurchaseRequest(
        request.requestId,
        'approver1',
        '0x1234567890abcdef',
        12345
      );
      holdingId = holding.holdingId;
    });

    it('should create sell order successfully', async () => {
      const result = await service.createSellOrder(
        holdingId,
        5,
        '105.00',
        'LIMIT'
      );
      
      expect(result).toBeDefined();
      expect(result.orderId).toBeDefined();
      expect(result.holdingId).toBe(holdingId);
      expect(result.status).toBe('OPEN');
      expect(result.orderType).toBe('LIMIT');
    });

    it('should calculate total amount correctly', async () => {
      const result = await service.createSellOrder(
        holdingId,
        5,
        '105.00',
        'LIMIT'
      );
      
      expect(['525', '525.00'].includes(result.totalAmount)).toBe(true);
    });

    it('should throw error for non-existent holding', async () => {
      await expect(
        service.createSellOrder('non-existent', 5, '105.00')
      ).rejects.toThrow('Holding not found');
    });

    it('should throw error for insufficient tokens', async () => {
      await expect(
        service.createSellOrder(holdingId, 20, '105.00')
      ).rejects.toThrow('Insufficient tokens');
    });

    it('should emit sell_order_created event', async () => {
      const eventSpy = vi.fn();
      service.on('sell_order_created', eventSpy);

      await service.createSellOrder(holdingId, 5, '105.00');
      
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('createBuyOrder', () => {
    let billId: string;

    beforeEach(async () => {
      const bill = await service.createTreasuryBill({
        name: 'Test Bill',
        pricePerToken: '100.00',
        availableSupply: '1000000'
      });
      billId = bill.billId;
      
      // Create approved KYC verification
      const personalInfo = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        nationality: 'US',
        countryOfResidence: 'US'
      };
      const verification = await complianceService.startKYCVerification('investor1', personalInfo, 'RETAIL');
      
      const document = {
        documentType: 'PASSPORT' as const,
        documentNumber: 'A12345678',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      };
      const doc = await complianceService.submitKYCDocument(verification.verificationId, document);
      await complianceService.verifyKYCDocument(verification.verificationId, doc.documentId, 'VERIFIED');
      
      const document2 = {
        documentType: 'PROOF_OF_ADDRESS' as const,
        documentNumber: 'ADDR123',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      };
      const doc2 = await complianceService.submitKYCDocument(verification.verificationId, document2);
      await complianceService.verifyKYCDocument(verification.verificationId, doc2.documentId, 'VERIFIED');
    });

    it('should create buy order successfully', async () => {
      const result = await service.createBuyOrder(
        billId,
        'investor1',
        5,
        '95.00',
        'LIMIT'
      );
      
      expect(result).toBeDefined();
      expect(result.orderId).toBeDefined();
      expect(result.billId).toBe(billId);
      expect(result.status).toBe('OPEN');
      expect(result.orderType).toBe('LIMIT');
    });

    it('should calculate total amount correctly', async () => {
      const result = await service.createBuyOrder(
        billId,
        'investor1',
        5,
        '95.00',
        'LIMIT'
      );
      
      expect(['475', '475.00'].includes(result.totalAmount)).toBe(true);
    });

    it('should throw error for non-existent bill', async () => {
      await expect(
        service.createBuyOrder('non-existent', 'investor1', 5, '95.00')
      ).rejects.toThrow('Treasury bill not found');
    });

    it('should emit buy_order_created event', async () => {
      const eventSpy = vi.fn();
      service.on('buy_order_created', eventSpy);

      await service.createBuyOrder(billId, 'investor1', 5, '95.00');
      
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('matchOrders', () => {
    let sellOrderId: string;
    let buyOrderId: string;

    beforeEach(async () => {
      const bill = await service.createTreasuryBill({
        name: 'Test Bill',
        pricePerToken: '100.00',
        availableSupply: '1000000'
      });
      
      // Create approved KYC verification for seller
      const personalInfo1 = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        nationality: 'US',
        countryOfResidence: 'US'
      };
      const verification1 = await complianceService.startKYCVerification('investor1', personalInfo1, 'RETAIL');
      
      const document1 = {
        documentType: 'PASSPORT' as const,
        documentNumber: 'A12345678',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      };
      const doc1 = await complianceService.submitKYCDocument(verification1.verificationId, document1);
      await complianceService.verifyKYCDocument(verification1.verificationId, doc1.documentId, 'VERIFIED');
      
      const document2 = {
        documentType: 'PROOF_OF_ADDRESS' as const,
        documentNumber: 'ADDR123',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      };
      const doc2 = await complianceService.submitKYCDocument(verification1.verificationId, document2);
      await complianceService.verifyKYCDocument(verification1.verificationId, doc2.documentId, 'VERIFIED');
      
      const request1 = await service.createPurchaseRequest(
        bill.billId,
        'investor1',
        10,
        { method: 'CRYPTO' }
      );
      const holding1 = await service.approvePurchaseRequest(
        request1.requestId,
        'approver1',
        '0x1234567890abcdef',
        12345
      );
      
      const sellOrder = await service.createSellOrder(
        holding1.holdingId,
        5,
        '100.00',
        'LIMIT'
      );
      sellOrderId = sellOrder.orderId;
      
      // Create approved KYC verification for buyer
      const personalInfo2 = {
        firstName: 'Jane',
        lastName: 'Smith',
        dateOfBirth: '1990-01-01',
        nationality: 'US',
        countryOfResidence: 'US'
      };
      const verification2 = await complianceService.startKYCVerification('investor2', personalInfo2, 'RETAIL');
      
      const document3 = {
        documentType: 'PASSPORT' as const,
        documentNumber: 'B87654321',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      };
      const doc3 = await complianceService.submitKYCDocument(verification2.verificationId, document3);
      await complianceService.verifyKYCDocument(verification2.verificationId, doc3.documentId, 'VERIFIED');
      
      const document4 = {
        documentType: 'PROOF_OF_ADDRESS' as const,
        documentNumber: 'ADDR456',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      };
      const doc4 = await complianceService.submitKYCDocument(verification2.verificationId, document4);
      await complianceService.verifyKYCDocument(verification2.verificationId, doc4.documentId, 'VERIFIED');
      
      const buyOrder = await service.createBuyOrder(
        bill.billId,
        'investor2',
        5,
        '100.00',
        'LIMIT'
      );
      buyOrderId = buyOrder.orderId;
    });

    it('should match orders successfully', async () => {
      await service.matchOrders();
      
      const sellOrder = service['sellOrders'].get(sellOrderId);
      const buyOrder = service['buyOrders'].get(buyOrderId);
      
      expect(sellOrder?.status).toBe('FILLED');
      expect(buyOrder?.status).toBe('FILLED');
    });

    it('should emit trade_executed event', async () => {
      const eventSpy = vi.fn();
      service.on('trade_executed', eventSpy);

      await service.matchOrders();
      
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('distributeYield', () => {
    let holdingId: string;
    let billId: string;

    beforeEach(async () => {
      const bill = await service.createTreasuryBill({
        name: 'Test Bill',
        pricePerToken: '100.00',
        availableSupply: '1000000'
      });
      billId = bill.billId;
      
      // Create approved KYC verification
      const personalInfo = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        nationality: 'US',
        countryOfResidence: 'US'
      };
      const verification = await complianceService.startKYCVerification('investor1', personalInfo, 'RETAIL');
      
      const document = {
        documentType: 'PASSPORT' as const,
        documentNumber: 'A12345678',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      };
      const doc = await complianceService.submitKYCDocument(verification.verificationId, document);
      await complianceService.verifyKYCDocument(verification.verificationId, doc.documentId, 'VERIFIED');
      
      const document2 = {
        documentType: 'PROOF_OF_ADDRESS' as const,
        documentNumber: 'ADDR123',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      };
      const doc2 = await complianceService.submitKYCDocument(verification.verificationId, document2);
      await complianceService.verifyKYCDocument(verification.verificationId, doc2.documentId, 'VERIFIED');
      
      const request = await service.createPurchaseRequest(
        bill.billId,
        'investor1',
        10,
        { method: 'CRYPTO' }
      );
      const holding = await service.approvePurchaseRequest(
        request.requestId,
        'approver1',
        '0x1234567890abcdef',
        12345
      );
      holdingId = holding.holdingId;
    });

    it('should distribute yield successfully', async () => {
      await service.distributeYield();
      
      const holding = service['holdings'].get(holdingId);
      expect(holding?.accumulatedYield).not.toBe('0');
    });

    it('should create yield distribution record', async () => {
      await service.distributeYield();
      
      const distributions = Array.from(service['yieldDistributions'].values());
      expect(distributions.length).toBeGreaterThan(0);
    });

    it('should emit yield_distributed event', async () => {
      const eventSpy = vi.fn();
      service.on('yield_distributed', eventSpy);

      await service.distributeYield();
      
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('getInvestorPortfolioSummary', () => {
    beforeEach(async () => {
      const bill = await service.createTreasuryBill({
        name: 'Test Bill',
        pricePerToken: '100.00',
        availableSupply: '1000000'
      });
      
      // Create approved KYC verification
      const personalInfo = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        nationality: 'US',
        countryOfResidence: 'US'
      };
      const verification = await complianceService.startKYCVerification('investor1', personalInfo, 'RETAIL');
      
      const document = {
        documentType: 'PASSPORT' as const,
        documentNumber: 'A12345678',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      };
      const doc = await complianceService.submitKYCDocument(verification.verificationId, document);
      await complianceService.verifyKYCDocument(verification.verificationId, doc.documentId, 'VERIFIED');
      
      const document2 = {
        documentType: 'PROOF_OF_ADDRESS' as const,
        documentNumber: 'ADDR123',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      };
      const doc2 = await complianceService.submitKYCDocument(verification.verificationId, document2);
      await complianceService.verifyKYCDocument(verification.verificationId, doc2.documentId, 'VERIFIED');
      
      const request = await service.createPurchaseRequest(
        bill.billId,
        'investor1',
        10,
        { method: 'CRYPTO' }
      );
      await service.approvePurchaseRequest(
        request.requestId,
        'approver1',
        '0x1234567890abcdef',
        12345
      );
    });

    it('should get portfolio summary for investor', () => {
      const result = service.getInvestorPortfolioSummary('investor1');
      
      expect(result).toBeDefined();
      expect(result.totalHoldings).toBeGreaterThan(0);
      expect(result.totalValue).toBeDefined();
      expect(result.totalYield).toBeDefined();
      expect(result.byBill).toBeDefined();
    });

    it('should return empty summary for investor with no holdings', () => {
      const result = service.getInvestorPortfolioSummary('investor2');
      
      expect(result.totalHoldings).toBe(0);
      expect(result.totalValue).toBe('0');
      expect(result.totalYield).toBe('0');
      expect(result.byBill).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero tokens purchase', async () => {
      const bill = await service.createTreasuryBill({
        name: 'Test Bill',
        pricePerToken: '100.00',
        availableSupply: '1000000'
      });
      
      // Create approved KYC verification
      const personalInfo = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        nationality: 'US',
        countryOfResidence: 'US'
      };
      const verification = await complianceService.startKYCVerification('investor1', personalInfo, 'RETAIL');
      
      const document = {
        documentType: 'PASSPORT' as const,
        documentNumber: 'A12345678',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      };
      const doc = await complianceService.submitKYCDocument(verification.verificationId, document);
      await complianceService.verifyKYCDocument(verification.verificationId, doc.documentId, 'VERIFIED');
      
      const document2 = {
        documentType: 'PROOF_OF_ADDRESS' as const,
        documentNumber: 'ADDR123',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      };
      const doc2 = await complianceService.submitKYCDocument(verification.verificationId, document2);
      await complianceService.verifyKYCDocument(verification.verificationId, doc2.documentId, 'VERIFIED');
      
      await expect(
        service.createPurchaseRequest(bill.billId, 'investor1', 0, { method: 'CRYPTO' })
      ).rejects.toThrow();
    });

    it('should handle very large amounts', async () => {
      const bill = await service.createTreasuryBill({
        name: 'Test Bill',
        pricePerToken: '100.00',
        availableSupply: '100000000'
      });
      
      expect(bill).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle compliance check failure', async () => {
      const bill = await service.createTreasuryBill({
        name: 'Test Bill',
        pricePerToken: '100.00',
        availableSupply: '1000000'
      });
      
      // No KYC verification - should fail compliance
      await expect(
        service.createPurchaseRequest(bill.billId, 'investor1', 10, {})
      ).rejects.toThrow();
    });
  });
});
