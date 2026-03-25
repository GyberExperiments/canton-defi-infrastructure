/**
 * 🏛️ CANTON SERVICE MANAGER - SINGLETON PATTERN
 * 
 * Централизованное управление всеми Canton сервисами
 * Решает проблему множественных инициализаций в React StrictMode
 * 
 * Best Practices:
 * - Singleton pattern для глобального доступа
 * - Lazy initialization - сервисы создаются только при первом запросе
 * - Reference counting - отслеживание активных подписчиков
 * - Proper cleanup - автоматическая очистка неиспользуемых сервисов
 * - Thread-safe initialization - защита от race conditions
 */

import { EventEmitter } from 'events';
import { DamlIntegrationService, type DamlIntegrationConfig } from './damlIntegrationService';
import { CantonBridgeService } from './cantonBridgeService';
import { RealEstateTokenizationService } from './realEstateService';
import { PrivacyVaultService } from './privacyVaultService';
import { MultiPartyWorkflowService } from './multiPartyWorkflowService';
import { ZKProofService } from './zkProofService';

// ========================================
// SERVICE MANAGER CONFIGURATION
// ========================================

interface ServiceReference<T> {
  instance: T | null;
  isInitializing: boolean;
  isInitialized: boolean;
  referenceCount: number;
  lastAccessed: number;
  initPromise: Promise<T> | null;
}

interface CantonServiceConfig {
  // Daml Configuration
  daml: DamlIntegrationConfig;
  
  // Service lifecycle
  enableAutoCleanup: boolean;
  cleanupIdleTime: number; // milliseconds
  enableLogging: boolean;
}

// DevNet defaults (65.108.15.30:30757, participant1, wealth_management_party)
const DEVNET_PARTICIPANT_URL = 'http://65.108.15.30:30757';
const DEVNET_PARTICIPANT_ID = 'participant1';
const DEVNET_PARTY_ID = 'wealth_management_party';

// Default configuration
const DEFAULT_CONFIG: CantonServiceConfig = {
  daml: {
    participantUrl: process.env.NEXT_PUBLIC_CANTON_PARTICIPANT_URL || DEVNET_PARTICIPANT_URL,
    participantId: process.env.NEXT_PUBLIC_CANTON_PARTICIPANT_ID || DEVNET_PARTICIPANT_ID,
    authToken: process.env.NEXT_PUBLIC_CANTON_AUTH_TOKEN || '',
    partyId: process.env.NEXT_PUBLIC_CANTON_PARTY_ID || DEVNET_PARTY_ID,
    tlsEnabled: process.env.NEXT_PUBLIC_CANTON_TLS === 'true',
    certificatePath: process.env.NEXT_PUBLIC_CANTON_CERT_PATH || undefined
  },
  enableAutoCleanup: true,
  cleanupIdleTime: 300000, // 5 minutes
  enableLogging: process.env.NODE_ENV === 'development'
};

// ========================================
// CANTON SERVICE MANAGER CLASS
// ========================================

class CantonServiceManager extends EventEmitter {
  private static instance: CantonServiceManager | null = null;
  private static isCreating = false;
  
  private config: CantonServiceConfig;
  
  // Service references with lazy initialization
  private services = {
    daml: { instance: null, isInitializing: false, isInitialized: false, referenceCount: 0, lastAccessed: 0, initPromise: null } as ServiceReference<DamlIntegrationService>,
    bridge: { instance: null, isInitializing: false, isInitialized: false, referenceCount: 0, lastAccessed: 0, initPromise: null } as ServiceReference<CantonBridgeService>,
    realEstate: { instance: null, isInitializing: false, isInitialized: false, referenceCount: 0, lastAccessed: 0, initPromise: null } as ServiceReference<RealEstateTokenizationService>,
    privacyVault: { instance: null, isInitializing: false, isInitialized: false, referenceCount: 0, lastAccessed: 0, initPromise: null } as ServiceReference<PrivacyVaultService>,
    workflow: { instance: null, isInitializing: false, isInitialized: false, referenceCount: 0, lastAccessed: 0, initPromise: null } as ServiceReference<MultiPartyWorkflowService>,
    zkProof: { instance: null, isInitializing: false, isInitialized: false, referenceCount: 0, lastAccessed: 0, initPromise: null } as ServiceReference<ZKProofService>,
  };
  
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor(config?: Partial<CantonServiceConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    if (this.config.enableAutoCleanup) {
      this.startAutoCleanup();
    }
    
    if (this.config.enableLogging) {
      console.log('🏛️ Canton Service Manager initialized', {
        enableAutoCleanup: this.config.enableAutoCleanup,
        cleanupIdleTime: this.config.cleanupIdleTime
      });
    }
  }

  /**
   * 🎯 Get Singleton Instance
   * Thread-safe singleton implementation
   */
  public static getInstance(config?: Partial<CantonServiceConfig>): CantonServiceManager {
    if (!CantonServiceManager.instance) {
      if (CantonServiceManager.isCreating) {
        // Wait for instance creation to complete
        return new Proxy({} as CantonServiceManager, {
          get: (_, prop) => {
            if (CantonServiceManager.instance) {
              return (CantonServiceManager.instance as any)[prop];
            }
            throw new Error('CantonServiceManager is still initializing');
          }
        });
      }
      
      CantonServiceManager.isCreating = true;
      CantonServiceManager.instance = new CantonServiceManager(config);
      CantonServiceManager.isCreating = false;
    }
    
    return CantonServiceManager.instance;
  }

  /**
   * 🔄 Reset Singleton (for testing)
   */
  public static resetInstance(): void {
    if (CantonServiceManager.instance) {
      CantonServiceManager.instance.cleanup();
      CantonServiceManager.instance = null;
    }
  }

  // ========================================
  // SERVICE GETTERS WITH LAZY INITIALIZATION
  // ========================================

  /**
   * 🏛️ Get Daml Integration Service
   */
  public async getDamlService(): Promise<DamlIntegrationService> {
    return this.getOrCreateService('daml', async () => {
      const service = new DamlIntegrationService(this.config.daml);
      
      // Wait for service to be ready
      await new Promise<void>((resolve) => {
        if (service.isInitialized) {
          resolve();
        } else {
          service.once('connected', resolve);
          // Timeout fallback
          setTimeout(resolve, 5000);
        }
      });
      
      return service;
    });
  }

  /**
   * 🌉 Get Canton Bridge Service
   */
  public async getBridgeService(): Promise<CantonBridgeService> {
    return this.getOrCreateService('bridge', async () => {
      const damlService = await this.getDamlService();
      const service = new CantonBridgeService(damlService);
      
      // Wait for service to be ready
      await new Promise<void>((resolve) => {
        service.once('initialized', resolve);
        setTimeout(resolve, 5000); // Timeout fallback
      });
      
      return service;
    });
  }

  /**
   * 🏠 Get Real Estate Service
   */
  public async getRealEstateService(): Promise<RealEstateTokenizationService> {
    return this.getOrCreateService('realEstate', async () => {
      // Real Estate service initializes itself in constructor
      return new RealEstateTokenizationService();
    });
  }

  /**
   * 🔐 Get Privacy Vault Service
   */
  public async getPrivacyVaultService(): Promise<PrivacyVaultService> {
    return this.getOrCreateService('privacyVault', async () => {
      const damlService = await this.getDamlService();
      return new PrivacyVaultService(damlService);
    });
  }

  /**
   * 🔄 Get Workflow Service
   */
  public async getWorkflowService(): Promise<MultiPartyWorkflowService> {
    return this.getOrCreateService('workflow', async () => {
      const damlService = await this.getDamlService();
      return new MultiPartyWorkflowService(damlService);
    });
  }

  /**
   * 🔒 Get ZK Proof Service
   */
  public async getZKProofService(): Promise<ZKProofService> {
    return this.getOrCreateService('zkProof', async () => {
      // ZK Proof service initializes itself
      return new ZKProofService();
    });
  }

  // ========================================
  // INTERNAL METHODS
  // ========================================

  /**
   * 🏗️ Generic service getter with lazy initialization
   */
  private async getOrCreateService<K extends keyof typeof this.services>(
    serviceName: K,
    factory: () => Promise<any>
  ): Promise<any> {
    const ref = this.services[serviceName];
    
    // Increment reference count
    ref.referenceCount++;
    ref.lastAccessed = Date.now();
    
    // Return existing instance
    if (ref.isInitialized && ref.instance) {
      if (this.config.enableLogging) {
        console.log(`✅ Reusing ${serviceName} service (refs: ${ref.referenceCount})`);
      }
      return ref.instance;
    }
    
    // Wait for ongoing initialization
    if (ref.isInitializing && ref.initPromise) {
      if (this.config.enableLogging) {
        console.log(`⏳ Waiting for ${serviceName} service initialization...`);
      }
      return ref.initPromise;
    }
    
    // Initialize new service
    if (this.config.enableLogging) {
      console.log(`🚀 Initializing ${serviceName} service...`);
    }
    
    ref.isInitializing = true;
    ref.initPromise = (async () => {
      try {
        const instance = await factory();
        ref.instance = instance;
        ref.isInitialized = true;
        
        if (this.config.enableLogging) {
          console.log(`✅ ${serviceName} service initialized successfully`);
        }
        
        this.emit('service:initialized', serviceName);
        return instance;
        
      } catch (error) {
        if (this.config.enableLogging) {
          console.error(`❌ Failed to initialize ${serviceName} service:`, error);
        }
        
        ref.isInitializing = false;
        ref.initPromise = null;
        this.emit('service:error', serviceName, error);
        throw error;
        
      } finally {
        ref.isInitializing = false;
      }
    })();
    
    return ref.initPromise;
  }

  /**
   * 🔓 Release service reference
   * Call this when component unmounts
   */
  public releaseService(serviceName: keyof typeof this.services): void {
    const ref = this.services[serviceName];
    
    if (ref.referenceCount > 0) {
      ref.referenceCount--;
      
      if (this.config.enableLogging) {
        console.log(`🔓 Released ${serviceName} service (refs: ${ref.referenceCount})`);
      }
    }
  }

  /**
   * 🧹 Auto cleanup idle services
   */
  private startAutoCleanup(): void {
    if (this.cleanupInterval) return;
    
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      
      Object.entries(this.services).forEach(([name, ref]) => {
        const serviceName = name as keyof typeof this.services;
        
        // Cleanup if:
        // 1. Service is initialized
        // 2. No active references
        // 3. Not accessed for cleanupIdleTime
        if (
          ref.isInitialized &&
          ref.referenceCount === 0 &&
          now - ref.lastAccessed > this.config.cleanupIdleTime
        ) {
          if (this.config.enableLogging) {
            console.log(`🧹 Cleaning up idle ${serviceName} service`);
          }
          
          // Cleanup service if it has cleanup method
          if (ref.instance && typeof (ref.instance as any).cleanup === 'function') {
            try {
              (ref.instance as any).cleanup();
            } catch (error) {
              console.error(`Failed to cleanup ${serviceName}:`, error);
            }
          }
          
          // Reset reference
          ref.instance = null;
          ref.isInitialized = false;
          ref.initPromise = null;
        }
      });
    }, this.config.cleanupIdleTime / 2); // Check twice per cleanup period
  }

  /**
   * 🛑 Cleanup all services
   */
  public cleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    Object.values(this.services).forEach(ref => {
      if (ref.instance && typeof (ref.instance as any).cleanup === 'function') {
        try {
          (ref.instance as any).cleanup();
        } catch (error) {
          console.error('Service cleanup error:', error);
        }
      }
    });
    
    if (this.config.enableLogging) {
      console.log('🛑 Canton Service Manager cleaned up');
    }
  }

  /**
   * 📊 Get Service Statistics
   */
  public getStats() {
    return Object.entries(this.services).reduce((stats, [name, ref]) => {
      stats[name] = {
        isInitialized: ref.isInitialized,
        isInitializing: ref.isInitializing,
        referenceCount: ref.referenceCount,
        lastAccessed: ref.lastAccessed ? new Date(ref.lastAccessed).toISOString() : 'never',
        idleTime: ref.lastAccessed ? Date.now() - ref.lastAccessed : 0
      };
      return stats;
    }, {} as Record<string, any>);
  }
}

// ========================================
// EXPORTS
// ========================================

// Export singleton instance
export const cantonServiceManager = CantonServiceManager.getInstance();

// Export class for testing
export { CantonServiceManager };

// Export config type
export type { CantonServiceConfig };

// ========================================
// GLOBAL DEBUG ACCESS
// ========================================

if (typeof window !== 'undefined') {
  (window as any).cantonServiceManager = cantonServiceManager;
  (window as any).getCantonStats = () => cantonServiceManager.getStats();
}


