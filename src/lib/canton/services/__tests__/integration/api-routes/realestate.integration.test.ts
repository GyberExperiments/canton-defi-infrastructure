import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RealEstateService } from '@/lib/canton/services/realEstateService';
import { DamlIntegrationService } from '@/lib/canton/services/damlIntegrationService';
import { ComplianceService } from '@/lib/canton/services/complianceService';
import { PropertyValuationAPI } from '@/lib/canton/services/propertyValuationAPI';

// Mock dependencies
vi.mock('@/lib/canton/services/damlIntegrationService', () => ({
  DamlIntegrationService: vi.fn().mockImplementation(() => ({
    createInstitutionalAsset: vi.fn(),
    createPurchaseRequest: vi.fn(),
    exercisePurchaseRequest: vi.fn(),
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

vi.mock('@/lib/canton/services/propertyValuationAPI', () => ({
  PropertyValuationAPI: vi.fn().mockImplementation(() => ({
    getPropertyValuation: vi.fn().mockResolvedValue({
      propertyId: 'prop-123',
      estimatedValue: '500000',
      valuationDate: new Date().toISOString(),
      confidence: 0.95,
    }),
  })),
}));

describe('RealEstate API Integration', () => {
  let realEstateService: RealEstateService;
  let damlService: DamlIntegrationService;
  let complianceService: ComplianceService;
  let valuationAPI: PropertyValuationAPI;

  beforeEach(() => {
    vi.clearAllMocks();

    damlService = new DamlIntegrationService();
    complianceService = new ComplianceService();
    valuationAPI = new PropertyValuationAPI();

    realEstateService = new RealEstateService(
      {
        enabled: true,
        minInvestment: '1000',
        maxInvestment: '10000000',
        propertyManagementFee: '0.02',
        rentalYieldDistribution: 'MONTHLY',
      },
      damlService,
      complianceService,
      valuationAPI
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('RealEstateService Integration', () => {
    it('should create a new property', async () => {
      const propertyData = {
        name: 'Manhattan Luxury Apartment',
        description: 'Luxury apartment in Manhattan, NYC',
        address: '123 5th Avenue, New York, NY 10001',
        propertyType: 'RESIDENTIAL',
        totalArea: '2500',
        bedrooms: 3,
        bathrooms: 2,
        totalValue: '2500000',
        tokenPrice: '1000',
        totalTokens: '2500',
      };

      const property = await realEstateService.createProperty(propertyData);

      expect(property).toBeDefined();
      expect(property.propertyId).toBeDefined();
      expect(property.name).toBe('Manhattan Luxury Apartment');
      expect(property.status).toBe('ACTIVE');
    });

    it('should get property by ID', async () => {
      const propertyData = {
        name: 'Brooklyn Brownstone',
        address: '456 Park Place, Brooklyn, NY 11216',
        propertyType: 'RESIDENTIAL' as const,
        totalValue: '1800000',
        tokenPrice: '1000',
        totalTokens: '1800',
      };

      const createdProperty = await realEstateService.createProperty(propertyData);
      const retrievedProperty = realEstateService.getProperty(createdProperty.propertyId);

      expect(retrievedProperty).toBeDefined();
      expect(retrievedProperty?.propertyId).toBe(createdProperty.propertyId);
    });

    it('should get all properties', async () => {
      await realEstateService.createProperty({
        name: 'Property 1',
        address: 'Address 1',
        propertyType: 'RESIDENTIAL' as const,
        totalValue: '1000000',
        tokenPrice: '1000',
        totalTokens: '1000',
      });

      await realEstateService.createProperty({
        name: 'Property 2',
        address: 'Address 2',
        propertyType: 'COMMERCIAL' as const,
        totalValue: '2000000',
        tokenPrice: '1000',
        totalTokens: '2000',
      });

      const allProperties = realEstateService.getAllProperties();

      expect(allProperties.length).toBeGreaterThanOrEqual(2);
    });

    it('should get active properties only', async () => {
      await realEstateService.createProperty({
        name: 'Active Property',
        address: 'Active Address',
        propertyType: 'RESIDENTIAL' as const,
        totalValue: '1500000',
        tokenPrice: '1000',
        totalTokens: '1500',
      });

      const activeProperties = realEstateService.getActiveProperties();

      expect(activeProperties.length).toBeGreaterThan(0);
      expect(activeProperties.every(prop => prop.status === 'ACTIVE')).toBe(true);
    });

    it('should create purchase request for property tokens', async () => {
      const property = await realEstateService.createProperty({
        name: 'Purchase Test Property',
        address: 'Purchase Address',
        propertyType: 'RESIDENTIAL' as const,
        totalValue: '1000000',
        tokenPrice: '1000',
        totalTokens: '1000',
        availableTokens: '1000',
      });

      const purchaseRequest = await realEstateService.createPurchaseRequest(
        property.propertyId,
        'investor-123',
        10,
        {
          method: 'CRYPTO',
          walletAddress: '0x1234567890abcdef',
          kycLevel: 'RETAIL',
        }
      );

      expect(purchaseRequest).toBeDefined();
      expect(purchaseRequest.requestId).toBeDefined();
      expect(purchaseRequest.propertyId).toBe(property.propertyId);
      expect(purchaseRequest.investor).toBe('investor-123');
      expect(purchaseRequest.status).toBe('PENDING');
    });

    it('should approve purchase request', async () => {
      const property = await realEstateService.createProperty({
        name: 'Approve Test Property',
        address: 'Approve Address',
        propertyType: 'RESIDENTIAL' as const,
        totalValue: '1000000',
        tokenPrice: '1000',
        totalTokens: '1000',
        availableTokens: '1000',
      });

      const purchaseRequest = await realEstateService.createPurchaseRequest(
        property.propertyId,
        'investor-456',
        5,
        {
          method: 'CRYPTO',
          walletAddress: '0x1234567890abcdef',
          kycLevel: 'RETAIL',
        }
      );

      const holding = await realEstateService.approvePurchaseRequest(
        purchaseRequest.requestId,
        'approver-123',
        '0xabcdef1234567890',
        12345
      );

      expect(holding).toBeDefined();
      expect(holding.holdingId).toBeDefined();
      expect(holding.propertyId).toBe(property.propertyId);
      expect(holding.investor).toBe('investor-456');
      expect(holding.status).toBe('ACTIVE');
    });

    it('should get user property holdings', async () => {
      const property = await realEstateService.createProperty({
        name: 'Holdings Test Property',
        address: 'Holdings Address',
        propertyType: 'RESIDENTIAL' as const,
        totalValue: '1000000',
        tokenPrice: '1000',
        totalTokens: '1000',
        availableTokens: '1000',
      });

      const purchaseRequest = await realEstateService.createPurchaseRequest(
        property.propertyId,
        'investor-789',
        15,
        {
          method: 'CRYPTO',
          walletAddress: '0x1234567890abcdef',
          kycLevel: 'RETAIL',
        }
      );

      await realEstateService.approvePurchaseRequest(
        purchaseRequest.requestId,
        'approver-123',
        '0xabcdef1234567890',
        12345
      );

      const holdings = realEstateService.getUserHoldings('investor-789');

      expect(holdings.length).toBeGreaterThan(0);
      expect(holdings[0].investor).toBe('investor-789');
    });

    it('should distribute rental yield', async () => {
      const property = await realEstateService.createProperty({
        name: 'Yield Test Property',
        address: 'Yield Address',
        propertyType: 'RESIDENTIAL' as const,
        totalValue: '1000000',
        tokenPrice: '1000',
        totalTokens: '1000',
        availableTokens: '1000',
      });

      const purchaseRequest = await realEstateService.createPurchaseRequest(
        property.propertyId,
        'investor-123',
        100,
        {
          method: 'CRYPTO',
          walletAddress: '0x1234567890abcdef',
          kycLevel: 'RETAIL',
        }
      );

      await realEstateService.approvePurchaseRequest(
        purchaseRequest.requestId,
        'approver-123',
        '0xabcdef1234567890',
        12345
      );

      const distribution = await realEstateService.distributeRentalYield(
        property.propertyId,
        '5000',
        '2025-01'
      );

      expect(distribution).toBeDefined();
      expect(distribution.distributionId).toBeDefined();
      expect(distribution.propertyId).toBe(property.propertyId);
      expect(distribution.totalYield).toBe('5000');
    });

    it('should get property valuation', async () => {
      const property = await realEstateService.createProperty({
        name: 'Valuation Test Property',
        address: 'Valuation Address',
        propertyType: 'RESIDENTIAL' as const,
        totalValue: '1000000',
        tokenPrice: '1000',
        totalTokens: '1000',
      });

      const valuation = await realEstateService.getPropertyValuation(property.propertyId);

      expect(valuation).toBeDefined();
      expect(valuation.propertyId).toBe(property.propertyId);
      expect(valuation.estimatedValue).toBeDefined();
    });

    it('should create sell order for property tokens', async () => {
      const property = await realEstateService.createProperty({
        name: 'Sell Test Property',
        address: 'Sell Address',
        propertyType: 'RESIDENTIAL' as const,
        totalValue: '1000000',
        tokenPrice: '1000',
        totalTokens: '1000',
        availableTokens: '1000',
      });

      const purchaseRequest = await realEstateService.createPurchaseRequest(
        property.propertyId,
        'investor-456',
        50,
        {
          method: 'CRYPTO',
          walletAddress: '0x1234567890abcdef',
          kycLevel: 'RETAIL',
        }
      );

      const holding = await realEstateService.approvePurchaseRequest(
        purchaseRequest.requestId,
        'approver-123',
        '0xabcdef1234567890',
        12345
      );

      const sellOrder = await realEstateService.createSellOrder(
        holding.holdingId,
        25,
        '1050.00',
        'LIMIT'
      );

      expect(sellOrder).toBeDefined();
      expect(sellOrder.orderId).toBeDefined();
      expect(sellOrder.holdingId).toBe(holding.holdingId);
      expect(sellOrder.status).toBe('OPEN');
    });
  });

  describe('RealEstate Service Events', () => {
    it('should emit property_created event', async () => {
      const eventSpy = vi.fn();
      realEstateService.on('property_created', eventSpy);

      await realEstateService.createProperty({
        name: 'Event Property',
        address: 'Event Address',
        propertyType: 'RESIDENTIAL' as const,
        totalValue: '1000000',
        tokenPrice: '1000',
        totalTokens: '1000',
      });

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should emit purchase_request_created event', async () => {
      const property = await realEstateService.createProperty({
        name: 'Purchase Event Property',
        address: 'Purchase Event Address',
        propertyType: 'RESIDENTIAL' as const,
        totalValue: '1000000',
        tokenPrice: '1000',
        totalTokens: '1000',
      });

      const eventSpy = vi.fn();
      realEstateService.on('purchase_request_created', eventSpy);

      await realEstateService.createPurchaseRequest(
        property.propertyId,
        'investor-123',
        10,
        {
          method: 'CRYPTO',
          walletAddress: '0x1234567890abcdef',
          kycLevel: 'RETAIL',
        }
      );

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should emit holding_created event', async () => {
      const property = await realEstateService.createProperty({
        name: 'Holding Event Property',
        address: 'Holding Event Address',
        propertyType: 'RESIDENTIAL' as const,
        totalValue: '1000000',
        tokenPrice: '1000',
        totalTokens: '1000',
      });

      const purchaseRequest = await realEstateService.createPurchaseRequest(
        property.propertyId,
        'investor-456',
        5,
        {
          method: 'CRYPTO',
          walletAddress: '0x1234567890abcdef',
          kycLevel: 'RETAIL',
        }
      );

      const eventSpy = vi.fn();
      realEstateService.on('holding_created', eventSpy);

      await realEstateService.approvePurchaseRequest(
        purchaseRequest.requestId,
        'approver-123',
        '0xabcdef1234567890',
        12345
      );

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should emit rental_yield_distributed event', async () => {
      const property = await realEstateService.createProperty({
        name: 'Yield Event Property',
        address: 'Yield Event Address',
        propertyType: 'RESIDENTIAL' as const,
        totalValue: '1000000',
        tokenPrice: '1000',
        totalTokens: '1000',
      });

      const purchaseRequest = await realEstateService.createPurchaseRequest(
        property.propertyId,
        'investor-789',
        100,
        {
          method: 'CRYPTO',
          walletAddress: '0x1234567890abcdef',
          kycLevel: 'RETAIL',
        }
      );

      await realEstateService.approvePurchaseRequest(
        purchaseRequest.requestId,
        'approver-123',
        '0xabcdef1234567890',
        12345
      );

      const eventSpy = vi.fn();
      realEstateService.on('rental_yield_distributed', eventSpy);

      await realEstateService.distributeRentalYield(
        property.propertyId,
        '5000',
        '2025-01'
      );

      expect(eventSpy).toHaveBeenCalled();
    });
  });
});
