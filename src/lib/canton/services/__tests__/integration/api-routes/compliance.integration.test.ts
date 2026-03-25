import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ComplianceService } from '@/lib/canton/services/complianceService';
import { DamlIntegrationService } from '@/lib/canton/services/damlIntegrationService';

// Mock dependencies
vi.mock('@/lib/canton/services/damlIntegrationService', () => ({
  DamlIntegrationService: vi.fn().mockImplementation(() => ({
    createComplianceRecord: vi.fn(),
    updateComplianceStatus: vi.fn(),
  })),
}));

describe('Compliance API Integration', () => {
  let complianceService: ComplianceService;
  let damlService: DamlIntegrationService;

  beforeEach(() => {
    vi.clearAllMocks();

    damlService = new DamlIntegrationService();

    complianceService = new ComplianceService(
      {
        enabled: true,
        requireKYC: true,
        requireAML: true,
        maxTransactionAmount: '10000000',
        sanctionedCountries: ['XX', 'YY'],
      },
      damlService
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('ComplianceService Integration', () => {
    it('should validate transaction for compliant user', async () => {
      const result = await complianceService.validateTransaction(
        'user-123',
        '5000',
        'TREASURY_BILL',
        '0x1234567890abcdef'
      );

      expect(result).toBeDefined();
      expect(result.compliant).toBe(true);
      expect(result.reasons).toEqual([]);
    });

    it('should reject transaction for sanctioned country', async () => {
      const result = await complianceService.validateTransaction(
        'user-sanctioned',
        '5000',
        'TREASURY_BILL',
        '0x1234567890abcdef',
        'XX'
      );

      expect(result).toBeDefined();
      expect(result.compliant).toBe(false);
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it('should reject transaction above maximum amount', async () => {
      const result = await complianceService.validateTransaction(
        'user-456',
        '20000000',
        'TREASURY_BILL',
        '0x1234567890abcdef'
      );

      expect(result).toBeDefined();
      expect(result.compliant).toBe(false);
      expect(result.reasons.some(reason => reason.includes('amount'))).toBe(true);
    });

    it('should create compliance record', async () => {
      const record = await complianceService.createComplianceRecord({
        userId: 'user-789',
        transactionType: 'TREASURY_BILL_PURCHASE',
        amount: '10000',
        status: 'APPROVED',
        reasons: [],
      });

      expect(record).toBeDefined();
      expect(record.recordId).toBeDefined();
      expect(record.userId).toBe('user-789');
      expect(record.status).toBe('APPROVED');
    });

    it('should get compliance record by ID', async () => {
      const createdRecord = await complianceService.createComplianceRecord({
        userId: 'user-123',
        transactionType: 'REAL_ESTATE_PURCHASE',
        amount: '50000',
        status: 'PENDING',
        reasons: [],
      });

      const retrievedRecord = complianceService.getComplianceRecord(createdRecord.recordId);

      expect(retrievedRecord).toBeDefined();
      expect(retrievedRecord?.recordId).toBe(createdRecord.recordId);
    });

    it('should get compliance records for user', async () => {
      await complianceService.createComplianceRecord({
        userId: 'user-456',
        transactionType: 'TREASURY_BILL_PURCHASE',
        amount: '10000',
        status: 'APPROVED',
        reasons: [],
      });

      await complianceService.createComplianceRecord({
        userId: 'user-456',
        transactionType: 'REAL_ESTATE_PURCHASE',
        amount: '25000',
        status: 'APPROVED',
        reasons: [],
      });

      const userRecords = complianceService.getUserComplianceRecords('user-456');

      expect(userRecords.length).toBeGreaterThanOrEqual(2);
      expect(userRecords.every(record => record.userId === 'user-456')).toBe(true);
    });

    it('should update compliance record status', async () => {
      const record = await complianceService.createComplianceRecord({
        userId: 'user-789',
        transactionType: 'TREASURY_BILL_PURCHASE',
        amount: '15000',
        status: 'PENDING',
        reasons: [],
      });

      const updatedRecord = await complianceService.updateComplianceRecord(
        record.recordId,
        {
          status: 'APPROVED',
          reviewedBy: 'compliance-officer-123',
          reviewedAt: new Date().toISOString(),
        }
      );

      expect(updatedRecord).toBeDefined();
      expect(updatedRecord.status).toBe('APPROVED');
      expect(updatedRecord.reviewedBy).toBe('compliance-officer-123');
    });

    it('should check user KYC status', async () => {
      const kycStatus = await complianceService.checkKYCStatus('user-123');

      expect(kycStatus).toBeDefined();
      expect(kycStatus.userId).toBe('user-123');
      expect(['VERIFIED', 'PENDING', 'NOT_STARTED']).toContain(kycStatus.status);
    });

    it('should update user KYC status', async () => {
      const updatedStatus = await complianceService.updateKYCStatus('user-456', {
        status: 'VERIFIED',
        level: 'ACCREDITED',
        verifiedAt: new Date().toISOString(),
        verifiedBy: 'kyc-officer-123',
      });

      expect(updatedStatus).toBeDefined();
      expect(updatedStatus.status).toBe('VERIFIED');
      expect(updatedStatus.level).toBe('ACCREDITED');
    });

    it('should perform AML check', async () => {
      const amlResult = await complianceService.performAMLCheck('user-789', '0x1234567890abcdef');

      expect(amlResult).toBeDefined();
      expect(amlResult.userId).toBe('user-789');
      expect(['CLEAN', 'SUSPICIOUS', 'REQUIRES_REVIEW']).toContain(amlResult.status);
    });

    it('should get compliance statistics', async () => {
      await complianceService.createComplianceRecord({
        userId: 'user-1',
        transactionType: 'TREASURY_BILL_PURCHASE',
        amount: '10000',
        status: 'APPROVED',
        reasons: [],
      });

      await complianceService.createComplianceRecord({
        userId: 'user-2',
        transactionType: 'REAL_ESTATE_PURCHASE',
        amount: '50000',
        status: 'REJECTED',
        reasons: ['Sanctioned country'],
      });

      const stats = complianceService.getComplianceStatistics();

      expect(stats).toBeDefined();
      expect(stats.totalRecords).toBeGreaterThan(0);
      expect(stats.approvedRecords).toBeGreaterThan(0);
      expect(stats.rejectedRecords).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Compliance Service Events', () => {
    it('should emit compliance_record_created event', async () => {
      const eventSpy = vi.fn();
      complianceService.on('compliance_record_created', eventSpy);

      await complianceService.createComplianceRecord({
        userId: 'user-123',
        transactionType: 'TREASURY_BILL_PURCHASE',
        amount: '10000',
        status: 'APPROVED',
        reasons: [],
      });

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should emit compliance_record_updated event', async () => {
      const record = await complianceService.createComplianceRecord({
        userId: 'user-456',
        transactionType: 'REAL_ESTATE_PURCHASE',
        amount: '25000',
        status: 'PENDING',
        reasons: [],
      });

      const eventSpy = vi.fn();
      complianceService.on('compliance_record_updated', eventSpy);

      await complianceService.updateComplianceRecord(record.recordId, {
        status: 'APPROVED',
        reviewedBy: 'compliance-officer-123',
        reviewedAt: new Date().toISOString(),
      });

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should emit kyc_status_updated event', async () => {
      const eventSpy = vi.fn();
      complianceService.on('kyc_status_updated', eventSpy);

      await complianceService.updateKYCStatus('user-789', {
        status: 'VERIFIED',
        level: 'ACCREDITED',
        verifiedAt: new Date().toISOString(),
        verifiedBy: 'kyc-officer-123',
      });

      expect(eventSpy).toHaveBeenCalled();
    });
  });
});
