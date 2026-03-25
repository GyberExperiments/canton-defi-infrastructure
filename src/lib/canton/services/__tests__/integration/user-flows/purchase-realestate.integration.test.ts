import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
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

describe('Purchase Real Estate Tokens Flow Integration', () => {
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

  describe('Complete Real Estate Purchase Flow', () => {
    it('should complete full real estate token purchase process', async () => {
      // Step 1: Browse available properties
      const property = await realEstateService.createProperty({
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
      });

      expect(property).toBeDefined();
      expect(property.propertyId).toBeDefined();
      expect(property.name).toBe('Manhattan Luxury Apartment');
      expect(property.status).toBe('ACTIVE');

      // Step 2: Get property valuation
      const valuation = await realEstateService.getPropertyValuation(property.propertyId);

      expect(valuation).toBeDefined();
      expect(valuation.propertyId).toBe(property.propertyId);
      expect(valuation.estimatedValue).toBe('500000');

      // Step 3: Create purchase request
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
      expect(purchaseRequest.status).toBe('PENDING');
      expect(purchaseRequest.complianceCheck.passed).toBe(true);

      // Step 4: Approve purchase request
      const holding = await realEstateService.approvePurchaseRequest(
        purchaseRequest.requestId,
        'approver-123',
        '0xabcdef1234567890',
        12345
      );

      expect(holding).toBeDefined();
      expect(holding.status).toBe('ACTIVE');
      expect(holding.tokensOwned).toBe('10');
      expect(holding.currentMarketValue).toBe('10000');

      // Step 5: Verify holding in user portfolio
      const holdings = realEstateService.getUserHoldings('investor-123');

      expect(holdings.length).toBeGreaterThan(0);
      expect(holdings[0].holdingId).toBe(holding.holdingId);
    });

    it('should handle purchase with minimum investment', async () => {
      const property = await realEstateService.createProperty({
        name: 'Brooklyn Studio',
        address: '456 Park Place, Brooklyn, NY 11216',
        propertyType: 'RESIDENTIAL',
        totalValue: '500000',
        tokenPrice: '1000',
        totalTokens: '500',
      });

      const purchaseRequest = await realEstateService.createPurchaseRequest(
        property.propertyId,
        'investor-456',
        1, // 1 token = $1000 (minimum)
        {
          method: 'CRYPTO',
          walletAddress: '0x1234567890abcdef',
          kycLevel: 'RETAIL',
        }
      );

      expect(purchaseRequest).toBeDefined();
      expect(purchaseRequest.totalAmount).toBe('1000');
    });

    it('should handle purchase with maximum investment', async () => {
      const property = await realEstateService.createProperty({
        name: 'Manhattan Penthouse',
        address: '789 5th Avenue, New York, NY 10001',
        propertyType: 'RESIDENTIAL',
        totalValue: '10000000',
        tokenPrice: '1000',
        totalTokens: '10000',
      });

      const purchaseRequest = await realEstateService.createPurchaseRequest(
        property.propertyId,
        'investor-789',
        10000, // 10000 tokens = $10,000,000 (maximum)
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

  describe('Property Browsing Flow', () => {
    it('should browse all available properties', async () => {
      await realEstateService.createProperty({
        name: 'Property 1',
        address: 'Address 1',
        propertyType: 'RESIDENTIAL',
        totalValue: '1000000',
        tokenPrice: '1000',
        totalTokens: '1000',
      });

      await realEstateService.createProperty({
        name: 'Property 2',
        address: 'Address 2',
        propertyType: 'COMMERCIAL',
        totalValue: '2000000',
        tokenPrice: '1000',
        totalTokens: '2000',
      });

      const allProperties = realEstateService.getAllProperties();

      expect(allProperties.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter properties by type', async () => {
      await realEstateService.createProperty({
        name: 'Residential Property',
        address: 'Residential Address',
        propertyType: 'RESIDENTIAL',
        totalValue: '1000000',
        tokenPrice: '1000',
        totalTokens: '1000',
      });

      await realEstateService.createProperty({
        name: 'Commercial Property',
        address: 'Commercial Address',
        propertyType: 'COMMERCIAL',
        totalValue: '2000000',
        tokenPrice: '1000',
        totalTokens: '2000',
      });

      const activeProperties = realEstateService.getActiveProperties();

      expect(activeProperties.length).toBeGreaterThan(0);
      expect(activeProperties.every(p => p.status === 'ACTIVE')).toBe(true);
    });

    it('should get property details', async () => {
      const property = await realEstateService.createProperty({
        name: 'Detail Property',
        address: 'Detail Address',
        propertyType: 'RESIDENTIAL',
        totalValue: '1500000',
        tokenPrice: '1000',
        totalTokens: '1500',
      });

      const retrievedProperty = realEstateService.getProperty(property.propertyId);

      expect(retrievedProperty).toBeDefined();
      expect(retrievedProperty?.propertyId).toBe(property.propertyId);
      expect(retrievedProperty?.name).toBe('Detail Property');
    });
  });

  describe('Purchase Validation Flow', () => {
    it('should reject purchase below minimum investment', async () => {
      const property = await realEstateService.createProperty({
        name: 'Minimum Test Property',
        address: 'Minimum Address',
        propertyType: 'RESIDENTIAL',
        totalValue: '1000000',
        tokenPrice: '1000',
        totalTokens: '1000',
      });

      await expect(
        realEstateService.createPurchaseRequest(
          property.propertyId,
          'investor-123',
          0.5, // 0.5 token = $500 (below minimum)
          {
            method: 'CRYPTO',
            walletAddress: '0x1234567890abcdef',
            kycLevel: 'RETAIL',
          }
        )
      ).rejects.toThrow('below minimum');
    });

    it('should reject purchase above maximum investment', async () => {
      const property = await realEstateService.createProperty({
        name: 'Maximum Test Property',
        address: 'Maximum Address',
        propertyType: 'RESIDENTIAL',
        totalValue: '10000000',
        tokenPrice: '1000',
        totalTokens: '10000',
      });

      await expect(
        realEstateService.createPurchaseRequest(
          property.propertyId,
          'investor-456',
          20000, // 20000 tokens = $20,000,000 (above maximum)
          {
            method: 'CRYPTO',
            walletAddress: '0x1234567890abcdef',
            kycLevel: 'INSTITUTIONAL',
          }
        )
      ).rejects.toThrow('above maximum');
    });

    it('should reject purchase with insufficient tokens', async () => {
      const property = await realEstateService.createProperty({
        name: 'Insufficient Tokens Property',
        address: 'Insufficient Address',
        propertyType: 'RESIDENTIAL',
        totalValue: '1000000',
        tokenPrice: '1000',
        totalTokens: '1000',
        availableTokens: '500',
      });

      await expect(
        realEstateService.createPurchaseRequest(
          property.propertyId,
          'investor-789',
          1000, // Requesting more than available
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
        reasons: ['Sanctioned address', 'High risk transaction'],
      });

      const property = await realEstateService.createProperty({
        name: 'Compliance Fail Property',
        address: 'Compliance Address',
        propertyType: 'RESIDENTIAL',
        totalValue: '1000000',
        tokenPrice: '1000',
        totalTokens: '1000',
      });

      await expect(
        realEstateService.createPurchaseRequest(
          property.propertyId,
          'investor-sanctioned',
          10,
          {
            method: 'CRYPTO',
            walletAddress: '0x1234567890abcdef',
            kycLevel: 'RETAIL',
          }
        )
      ).rejects.toThrow('Compliance check failed');
    });
  });

  describe('Rental Yield Distribution Flow', () => {
    it('should distribute rental yield to token holders', async () => {
      const property = await realEstateService.createProperty({
        name: 'Yield Distribution Property',
        address: 'Yield Address',
        propertyType: 'RESIDENTIAL',
        totalValue: '1000000',
        tokenPrice: '1000',
        totalTokens: '1000',
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

      // Distribute rental yield
      const distribution = await realEstateService.distributeRentalYield(
        property.propertyId,
        '5000',
        '2025-01'
      );

      expect(distribution).toBeDefined();
      expect(distribution.distributionId).toBeDefined();
      expect(distribution.propertyId).toBe(property.propertyId);
      expect(distribution.totalYield).toBe('5000');
      expect(distribution.period.startDate).toBeDefined();
      expect(distribution.period.endDate).toBeDefined();
    });

    it('should calculate yield per token correctly', async () => {
      const property = await realEstateService.createProperty({
        name: 'Yield Calculation Property',
        address: 'Yield Calculation Address',
        propertyType: 'RESIDENTIAL',
        totalValue: '1000000',
        tokenPrice: '1000',
        totalTokens: '1000',
      });

      const purchaseRequest = await realEstateService.createPurchaseRequest(
        property.propertyId,
        'investor-456',
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
        '10000',
        '2025-01'
      );

      // $10,000 / 1000 tokens = $10 per token
      expect(distribution.yieldPerToken).toBe('10');
    });
  });

  describe('Secondary Market Flow', () => {
    it('should create sell order for property tokens', async () => {
      const property = await realEstateService.createProperty({
        name: 'Secondary Market Property',
        address: 'Secondary Market Address',
        propertyType: 'RESIDENTIAL',
        totalValue: '1000000',
        tokenPrice: '1000',
        totalTokens: '1000',
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

      const holding = await realEstateService.approvePurchaseRequest(
        purchaseRequest.requestId,
        'approver-123',
        '0xabcdef1234567890',
        12345
      );

      const sellOrder = await realEstateService.createSellOrder(
        holding.holdingId,
        50,
        '1050.00',
        'LIMIT'
      );

      expect(sellOrder).toBeDefined();
      expect(sellOrder.orderId).toBeDefined();
      expect(sellOrder.holdingId).toBe(holding.holdingId);
      expect(sellOrder.numberOfTokens).toBe('50');
      expect(sellOrder.pricePerToken).toBe('1050.00');
      expect(sellOrder.status).toBe('OPEN');
    });

    it('should create buy order for property tokens', async () => {
      const property = await realEstateService.createProperty({
        name: 'Buy Order Property',
        address: 'Buy Order Address',
        propertyType: 'RESIDENTIAL',
        totalValue: '1000000',
        tokenPrice: '1000',
        totalTokens: '1000',
      });

      const buyOrder = await realEstateService.createBuyOrder(
        property.propertyId,
        'investor-456',
        100,
        '950.00',
        'LIMIT'
      );

      expect(buyOrder).toBeDefined();
      expect(buyOrder.orderId).toBeDefined();
      expect(buyOrder.propertyId).toBe(property.propertyId);
      expect(buyOrder.numberOfTokens).toBe('100');
      expect(buyOrder.pricePerToken).toBe('950.00');
      expect(buyOrder.status).toBe('OPEN');
    });
  });

  describe('Portfolio Management Flow', () => {
    it('should track multiple property holdings', async () => {
      const property1 = await realEstateService.createProperty({
        name: 'Portfolio Property 1',
        address: 'Portfolio Address 1',
        propertyType: 'RESIDENTIAL',
        totalValue: '1000000',
        tokenPrice: '1000',
        totalTokens: '1000',
      });

      const property2 = await realEstateService.createProperty({
        name: 'Portfolio Property 2',
        address: 'Portfolio Address 2',
        propertyType: 'COMMERCIAL',
        totalValue: '2000000',
        tokenPrice: '1000',
        totalTokens: '2000',
      });

      // Purchase first property
      const request1 = await realEstateService.createPurchaseRequest(
        property1.propertyId,
        'investor-123',
        10,
        {
          method: 'CRYPTO',
          walletAddress: '0x1234567890abcdef',
          kycLevel: 'RETAIL',
        }
      );

      await realEstateService.approvePurchaseRequest(
        request1.requestId,
        'approver-123',
        '0xabcdef1234567890',
        12345
      );

      // Purchase second property
      const request2 = await realEstateService.createPurchaseRequest(
        property2.propertyId,
        'investor-123',
        5,
        {
          method: 'CRYPTO',
          walletAddress: '0x1234567890abcdef',
          kycLevel: 'RETAIL',
        }
      );

      await realEstateService.approvePurchaseRequest(
        request2.requestId,
        'approver-123',
        '0xabcdef1234567890',
        12346
      );

      // Verify portfolio
      const holdings = realEstateService.getUserHoldings('investor-123');

      expect(holdings.length).toBe(2);
      expect(holdings.some(h => h.propertyId === property1.propertyId)).toBe(true);
      expect(holdings.some(h => h.propertyId === property2.propertyId)).toBe(true);
    });

    it('should calculate portfolio value correctly', async () => {
      const property = await realEstateService.createProperty({
        name: 'Portfolio Value Property',
        address: 'Portfolio Value Address',
        propertyType: 'RESIDENTIAL',
        totalValue: '1000000',
        tokenPrice: '1000',
        totalTokens: '1000',
      });

      const request = await realEstateService.createPurchaseRequest(
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
        request.requestId,
        'approver-123',
        '0xabcdef1234567890',
        12345
      );

      expect(holding.currentMarketValue).toBe('50000');
      expect(holding.averageCostBasis).toBe('1000');
    });
  });

  describe('Error Handling Flow', () => {
    it('should handle network errors during purchase', async () => {
      vi.spyOn(realEstateService as any, 'createPurchaseRequest').mockRejectedValueOnce(
        new Error('Network error')
      );

      const property = await realEstateService.createProperty({
        name: 'Network Error Property',
        address: 'Network Error Address',
        propertyType: 'RESIDENTIAL',
        totalValue: '1000000',
        tokenPrice: '1000',
        totalTokens: '1000',
      });

      await expect(
        realEstateService.createPurchaseRequest(
          property.propertyId,
          'investor-123',
          10,
          {
            method: 'CRYPTO',
            walletAddress: '0x1234567890abcdef',
            kycLevel: 'RETAIL',
          }
        )
      ).rejects.toThrow('Network error');
    });

    it('should handle concurrent purchase requests', async () => {
      const property = await realEstateService.createProperty({
        name: 'Concurrent Property',
        address: 'Concurrent Address',
        propertyType: 'RESIDENTIAL',
        totalValue: '1000000',
        tokenPrice: '1000',
        totalTokens: '1000',
      });

      const purchasePromises = [
        realEstateService.createPurchaseRequest(
          property.propertyId,
          'investor-1',
          10,
          {
            method: 'CRYPTO',
            walletAddress: '0x1234567890abcdef',
            kycLevel: 'RETAIL',
          }
        ),
        realEstateService.createPurchaseRequest(
          property.propertyId,
          'investor-2',
          10,
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
