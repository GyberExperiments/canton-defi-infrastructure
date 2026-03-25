import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ComplianceService, ComplianceConfig, KYCVerification, AMLCheck, SanctionsCheck } from '../complianceService';

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

describe('ComplianceService', () => {
  let service: ComplianceService;
  let config: Partial<ComplianceConfig>;
  
  beforeEach(() => {
    config = {
      enabled: true,
      strictMode: false,
      kycProvider: 'sumsub',
      amlProvider: 'chainalysis',
      sanctionsProvider: 'worldcheck',
      auditLogRetentionDays: 2555,
      autoRejectThreshold: 80
    };
    
    service = new ComplianceService(config);
  });

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      const defaultService = new ComplianceService();
      expect(defaultService).toBeInstanceOf(ComplianceService);
      expect(defaultService['config'].enabled).toBe(true);
      expect(defaultService['config'].kycProvider).toBe('sumsub');
    });

    it('should initialize with custom configuration', () => {
      expect(service['config'].enabled).toBe(true);
      expect(service['config'].strictMode).toBe(false);
      expect(service['config'].kycProvider).toBe('sumsub');
      expect(service['config'].amlProvider).toBe('chainalysis');
      expect(service['config'].sanctionsProvider).toBe('worldcheck');
    });

    it('should initialize KYC levels correctly', () => {
      const levels = service['KYC_LEVELS'];
      expect(levels.RETAIL).toBeDefined();
      expect(levels.ACCREDITED).toBeDefined();
      expect(levels.INSTITUTIONAL).toBeDefined();
      expect(levels.ULTRA_HNW).toBeDefined();
    });

    it('should initialize high-risk jurisdictions list', () => {
      const jurisdictions = service['HIGH_RISK_JURISDICTIONS'];
      expect(jurisdictions).toContain('AF');
      expect(jurisdictions).toContain('IR');
      expect(jurisdictions).toContain('KP');
    });

    it('should initialize sanctions lists', () => {
      const sanctionsLists = service['SANCTIONS_LISTS'];
      expect(sanctionsLists).toContain('OFAC_SDN');
      expect(sanctionsLists).toContain('EU_SANCTIONS');
      expect(sanctionsLists).toContain('UN_SANCTIONS');
    });
  });

  describe('startKYCVerification', () => {
    it('should start KYC verification successfully', async () => {
      const personalInfo = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        nationality: 'US',
        countryOfResidence: 'US'
      };

      const result = await service.startKYCVerification('user1', personalInfo, 'RETAIL');
      
      expect(result).toBeDefined();
      expect(result.userId).toBe('user1');
      expect(result.level).toBe('RETAIL');
      expect(result.status).toBe('PENDING');
      expect(result.verificationId).toBeDefined();
    });

    it('should create verification with correct expiry date', async () => {
      const personalInfo = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        nationality: 'US',
        countryOfResidence: 'US'
      };

      const result = await service.startKYCVerification('user1', personalInfo);
      const expiryDate = new Date(result.expiresAt);
      const now = new Date();
      const daysDiff = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      
      expect(daysDiff).toBeCloseTo(30, 0);
    });

    it('should throw error when user already has pending verification', async () => {
      const personalInfo = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        nationality: 'US',
        countryOfResidence: 'US'
      };

      await service.startKYCVerification('user1', personalInfo);
      
      await expect(
        service.startKYCVerification('user1', personalInfo)
      ).rejects.toThrow('User already has pending KYC verification');
    });

    it('should emit kyc_started event', async () => {
      const personalInfo = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        nationality: 'US',
        countryOfResidence: 'US'
      };

      const eventSpy = vi.fn();
      service.on('kyc_started', eventSpy);

      await service.startKYCVerification('user1', personalInfo);
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          verificationId: expect.any(String),
          userId: 'user1'
        })
      );
    });

    it('should add audit entry', async () => {
      const personalInfo = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        nationality: 'US',
        countryOfResidence: 'US'
      };

      await service.startKYCVerification('user1', personalInfo);
      
      const auditLog = service.getAuditLog('user1');
      expect(auditLog.length).toBeGreaterThan(0);
      expect(auditLog[0].eventType).toBe('KYC_STARTED');
    });
  });

  describe('submitKYCDocument', () => {
    let verificationId: string;

    beforeEach(async () => {
      const personalInfo = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        nationality: 'US',
        countryOfResidence: 'US'
      };
      const verification = await service.startKYCVerification('user1', personalInfo);
      verificationId = verification.verificationId;
    });

    it('should submit KYC document successfully', async () => {
      const document = {
        documentType: 'PASSPORT' as const,
        documentNumber: 'A12345678',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      };

      const result = await service.submitKYCDocument(verificationId, document);
      
      expect(result).toBeDefined();
      expect(result.documentId).toBeDefined();
      expect(result.status).toBe('PENDING');
      expect(result.documentType).toBe('PASSPORT');
    });

    it('should throw error when verification not found', async () => {
      const document = {
        documentType: 'PASSPORT' as const,
        documentNumber: 'A12345678',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      };

      await expect(
        service.submitKYCDocument('non-existent', document)
      ).rejects.toThrow('Verification not found');
    });

    it('should add document to verification', async () => {
      const document = {
        documentType: 'PASSPORT' as const,
        documentNumber: 'A12345678',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      };

      await service.submitKYCDocument(verificationId, document);
      
      const verification = service['kycVerifications'].get(verificationId);
      expect(verification?.documents.length).toBe(1);
      expect(verification?.documents[0].documentType).toBe('PASSPORT');
    });

    it('should emit document_submitted event', async () => {
      const document = {
        documentType: 'PASSPORT' as const,
        documentNumber: 'A12345678',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      };

      const eventSpy = vi.fn();
      service.on('document_submitted', eventSpy);

      await service.submitKYCDocument(verificationId, document);
      
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('verifyKYCDocument', () => {
    let verificationId: string;
    let documentId: string;

    beforeEach(async () => {
      const personalInfo = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        nationality: 'US',
        countryOfResidence: 'US'
      };
      const verification = await service.startKYCVerification('user1', personalInfo);
      verificationId = verification.verificationId;
      
      const document = {
        documentType: 'PASSPORT' as const,
        documentNumber: 'A12345678',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      };
      const doc = await service.submitKYCDocument(verificationId, document);
      documentId = doc.documentId;
    });

    it('should verify document successfully', async () => {
      await service.verifyKYCDocument(verificationId, documentId, 'VERIFIED', 'sumsub');
      
      const verification = service['kycVerifications'].get(verificationId);
      const document = verification?.documents.find(d => d.documentId === documentId);
      
      expect(document?.status).toBe('VERIFIED');
      expect(document?.verificationProvider).toBe('sumsub');
      expect(document?.verifiedAt).toBeDefined();
    });

    it('should reject document successfully', async () => {
      await service.verifyKYCDocument(verificationId, documentId, 'REJECTED', 'manual', 'Invalid document');
      
      const verification = service['kycVerifications'].get(verificationId);
      const document = verification?.documents.find(d => d.documentId === documentId);
      
      expect(document?.status).toBe('REJECTED');
    });

    it('should throw error when verification not found', async () => {
      await expect(
        service.verifyKYCDocument('non-existent', documentId, 'VERIFIED')
      ).rejects.toThrow('Verification not found');
    });

    it('should throw error when document not found', async () => {
      await expect(
        service.verifyKYCDocument(verificationId, 'non-existent', 'VERIFIED')
      ).rejects.toThrow('Document not found');
    });

    it('should emit document_verified event', async () => {
      const eventSpy = vi.fn();
      service.on('document_verified', eventSpy);

      await service.verifyKYCDocument(verificationId, documentId, 'VERIFIED');
      
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('performAMLCheck', () => {
    it('should perform AML check successfully', async () => {
      const result = await service.performAMLCheck('user1', '0x1234567890abcdef');
      
      expect(result).toBeDefined();
      expect(result.userId).toBe('user1');
      expect(result.walletAddress).toBe('0x1234567890abcdef');
      expect(result.checkId).toBeDefined();
      expect(result.status).toBe('CLEAN');
      expect(result.riskLevel).toBe('LOW');
    });

    it('should calculate risk score correctly', async () => {
      const result = await service.performAMLCheck('user1', '0x1234567890abcdef');
      
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(100);
    });

    it('should emit aml_check_completed event', async () => {
      const eventSpy = vi.fn();
      service.on('aml_check_completed', eventSpy);

      await service.performAMLCheck('user1', '0x1234567890abcdef');
      
      expect(eventSpy).toHaveBeenCalled();
    });

    it('should add audit entry', async () => {
      await service.performAMLCheck('user1', '0x1234567890abcdef');
      
      const auditLog = service.getAuditLog('user1');
      expect(auditLog.length).toBeGreaterThan(0);
      expect(auditLog[auditLog.length - 1].eventType).toBe('AML_CHECK_PERFORMED');
    });
  });

  describe('checkSanctions', () => {
    it('should check sanctions successfully', async () => {
      const result = await service.checkSanctions('John Doe', 'INDIVIDUAL');
      
      expect(result).toBeDefined();
      expect(result.entityName).toBe('John Doe');
      expect(result.entityType).toBe('INDIVIDUAL');
      expect(result.checkId).toBeDefined();
      expect(result.isMatch).toBe(false);
    });

    it('should return empty matched lists for clean entity', async () => {
      const result = await service.checkSanctions('John Doe', 'INDIVIDUAL');
      
      expect(result.matchedLists).toEqual([]);
      expect(result.matchedPrograms).toEqual([]);
      expect(result.confidence).toBe(0);
    });

    it('should emit sanctions_check_completed event', async () => {
      const eventSpy = vi.fn();
      service.on('sanctions_check_completed', eventSpy);

      await service.checkSanctions('John Doe', 'INDIVIDUAL');
      
      expect(eventSpy).toHaveBeenCalled();
    });

    it('should add audit entry', async () => {
      await service.checkSanctions('John Doe', 'INDIVIDUAL');
      
      const auditLog = service.getAuditLog('SYSTEM');
      expect(auditLog.length).toBeGreaterThan(0);
      expect(auditLog[auditLog.length - 1].eventType).toBe('SANCTIONS_CHECK_PERFORMED');
    });
  });

  describe('validateTransaction', () => {
    beforeEach(async () => {
      const personalInfo = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        nationality: 'US',
        countryOfResidence: 'US'
      };
      const verification = await service.startKYCVerification('user1', personalInfo, 'RETAIL');
      
      // Submit and verify required documents
      const document1 = {
        documentType: 'PASSPORT' as const,
        documentNumber: 'A12345678',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      };
      const doc1 = await service.submitKYCDocument(verification.verificationId, document1);
      await service.verifyKYCDocument(verification.verificationId, doc1.documentId, 'VERIFIED');
      
      const document2 = {
        documentType: 'PROOF_OF_ADDRESS' as const,
        documentNumber: 'ADDR123',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      };
      const doc2 = await service.submitKYCDocument(verification.verificationId, document2);
      await service.verifyKYCDocument(verification.verificationId, doc2.documentId, 'VERIFIED');
    });

    it('should validate transaction successfully for approved user', async () => {
      const result = await service.validateTransaction('user1', '5000', 'TREASURY_BILL', '0x123');
      
      expect(result.compliant).toBe(true);
      expect(result.reasons).toEqual([]);
    });

    it('should reject transaction for non-approved user', async () => {
      const result = await service.validateTransaction('user2', '5000', 'TREASURY_BILL', '0x123');
      
      expect(result.compliant).toBe(false);
      expect(result.reasons).toContain('KYC_NOT_APPROVED');
    });

    it('should reject transaction below minimum investment', async () => {
      const result = await service.validateTransaction('user1', '50', 'TREASURY_BILL', '0x123');
      
      expect(result.compliant).toBe(false);
      expect(result.reasons).toContain('AMOUNT_BELOW_MINIMUM');
    });

    it('should reject transaction above maximum investment', async () => {
      const result = await service.validateTransaction('user1', '20000', 'TREASURY_BILL', '0x123');
      
      expect(result.compliant).toBe(false);
      expect(result.reasons).toContain('AMOUNT_ABOVE_MAXIMUM');
    });

    it('should emit transaction_validated event', async () => {
      const eventSpy = vi.fn();
      service.on('transaction_validated', eventSpy);

      await service.validateTransaction('user1', '5000', 'TREASURY_BILL', '0x123');
      
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('getAuditLog', () => {
    it('should return empty array for non-existent user', () => {
      const result = service.getAuditLog('non-existent');
      expect(result).toEqual([]);
    });

    it('should return audit log for user', async () => {
      const personalInfo = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        nationality: 'US',
        countryOfResidence: 'US'
      };
      await service.startKYCVerification('user1', personalInfo);
      
      const result = service.getAuditLog('user1');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return audit log for transaction ID', async () => {
      await service.performAMLCheck('user1', '0x123');
      
      const result = service.getAuditLog('user1');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('generateReport', () => {
    it('should generate KYC summary report', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';
      
      const result = await service.generateReport('KYC_SUMMARY', startDate, endDate);
      
      expect(result).toBeDefined();
      expect(result.reportType).toBe('KYC_SUMMARY');
      expect(result.period.startDate).toBe(startDate);
      expect(result.period.endDate).toBe(endDate);
      expect(result.status).toBe('DRAFT');
    });

    it('should generate AML summary report', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';
      
      const result = await service.generateReport('AML_SUMMARY', startDate, endDate);
      
      expect(result.reportType).toBe('AML_SUMMARY');
      expect(result.data).toBeDefined();
    });

    it('should generate transaction monitoring report', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';
      
      const result = await service.generateReport('TRANSACTION_MONITORING', startDate, endDate);
      
      expect(result.reportType).toBe('TRANSACTION_MONITORING');
    });

    it('should generate regulatory filing report', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';
      
      const result = await service.generateReport('REGULATORY_FILING', startDate, endDate);
      
      expect(result.reportType).toBe('REGULATORY_FILING');
    });

    it('should emit report_generated event', async () => {
      const eventSpy = vi.fn();
      service.on('report_generated', eventSpy);

      await service.generateReport('KYC_SUMMARY', '2024-01-01', '2024-12-31');
      
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle underage user correctly', async () => {
      const personalInfo = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '2015-01-01', // Under 18
        nationality: 'US',
        countryOfResidence: 'US'
      };
      const verification = await service.startKYCVerification('user1', personalInfo);
      
      const doc1 = await service.submitKYCDocument(verification.verificationId, {
        documentType: 'PASSPORT',
        documentNumber: 'A12345678',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      });
      const doc2 = await service.submitKYCDocument(verification.verificationId, {
        documentType: 'PROOF_OF_ADDRESS',
        documentNumber: 'ADDR123',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      });
      await service.verifyKYCDocument(verification.verificationId, doc1.documentId, 'VERIFIED');
      await service.verifyKYCDocument(verification.verificationId, doc2.documentId, 'VERIFIED');
      
      const updatedVerification = service['kycVerifications'].get(verification.verificationId);
      expect(updatedVerification?.status).toBe('REJECTED');
      expect(updatedVerification?.riskFactors).toContain('UNDERAGE');
    });

    it('should handle high-risk jurisdiction correctly', async () => {
      const personalInfo = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        nationality: 'US',
        countryOfResidence: 'AF' // Afghanistan - high risk
      };
      const verification = await service.startKYCVerification('user1', personalInfo);
      
      const doc1 = await service.submitKYCDocument(verification.verificationId, {
        documentType: 'PASSPORT',
        documentNumber: 'A12345678',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      });
      const doc2 = await service.submitKYCDocument(verification.verificationId, {
        documentType: 'PROOF_OF_ADDRESS',
        documentNumber: 'ADDR123',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      });
      await service.verifyKYCDocument(verification.verificationId, doc1.documentId, 'VERIFIED');
      await service.verifyKYCDocument(verification.verificationId, doc2.documentId, 'VERIFIED');
      
      const updatedVerification = service['kycVerifications'].get(verification.verificationId);
      expect(updatedVerification?.riskFactors).toContain('HIGH_RISK_JURISDICTION');
    });

    it('should handle rejected documents correctly', async () => {
      const personalInfo = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        nationality: 'US',
        countryOfResidence: 'US'
      };
      const verification = await service.startKYCVerification('user1', personalInfo);
      
      const document = {
        documentType: 'PASSPORT' as const,
        documentNumber: 'A12345678',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      };
      const doc = await service.submitKYCDocument(verification.verificationId, document);
      await service.verifyKYCDocument(verification.verificationId, doc.documentId, 'REJECTED');
      
      const updatedVerification = service['kycVerifications'].get(verification.verificationId);
      expect(updatedVerification?.documents.find(d => d.documentId === doc.documentId)?.status).toBe('REJECTED');
    });

    it('should handle different KYC levels', async () => {
      const levels = ['RETAIL', 'ACCREDITED', 'INSTITUTIONAL', 'ULTRA_HNW'] as const;
      
      for (const level of levels) {
        const personalInfo = {
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          nationality: 'US',
          countryOfResidence: 'US'
        };
        const verification = await service.startKYCVerification(`user_${level}`, personalInfo, level);
        
        expect(verification.level).toBe(level);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid verification ID gracefully', async () => {
      const document = {
        documentType: 'PASSPORT' as const,
        documentNumber: 'A12345678',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      };

      await expect(
        service.submitKYCDocument('invalid-id', document)
      ).rejects.toThrow('Verification not found');
    });

    it('should handle invalid document ID gracefully', async () => {
      const personalInfo = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        nationality: 'US',
        countryOfResidence: 'US'
      };
      const verification = await service.startKYCVerification('user1', personalInfo);

      await expect(
        service.verifyKYCDocument(verification.verificationId, 'invalid-doc-id', 'VERIFIED')
      ).rejects.toThrow('Document not found');
    });
  });

  describe('Event Emission', () => {
    it('should emit audit_entry_added event', async () => {
      const eventSpy = vi.fn();
      service.on('audit_entry_added', eventSpy);

      const personalInfo = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        nationality: 'US',
        countryOfResidence: 'US'
      };
      await service.startKYCVerification('user1', personalInfo);
      
      expect(eventSpy).toHaveBeenCalled();
    });

    it('should emit kyc_completed event', async () => {
      const eventSpy = vi.fn();
      service.on('kyc_completed', eventSpy);

      const personalInfo = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        nationality: 'US',
        countryOfResidence: 'US'
      };
      const verification = await service.startKYCVerification('user1', personalInfo);
      
      const doc1 = await service.submitKYCDocument(verification.verificationId, {
        documentType: 'PASSPORT',
        documentNumber: 'A12345678',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      });
      const doc2 = await service.submitKYCDocument(verification.verificationId, {
        documentType: 'PROOF_OF_ADDRESS',
        documentNumber: 'ADDR123',
        issuingCountry: 'US',
        expiryDate: '2030-01-01'
      });
      await service.verifyKYCDocument(verification.verificationId, doc1.documentId, 'VERIFIED');
      await service.verifyKYCDocument(verification.verificationId, doc2.documentId, 'VERIFIED');
      
      expect(eventSpy).toHaveBeenCalled();
    });
  });
});
