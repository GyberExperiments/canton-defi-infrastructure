// Store
export { 
  useCantonStore, 
  useHydrateCantonStore,
  useUser,
  usePortfolios,
  useActivePortfolio,
  useAIOptimizer,
  useRealEstate,
  usePrivacyVaults,
  useNotifications,
  useLoadingState,
  useMarketData,
} from './store/cantonStore';

export type {
  UserProfile,
  Portfolio,
  Holding,
  AIOptimizerState,
  RiskMetrics,
  RealEstateProperty,
  RealEstateHolding,
  PrivacyVault,
  Notification,
  LoadingState,
} from './store/cantonStore';

// Hooks
export { useRealCantonNetwork, useCantonBridge } from './hooks/realCantonIntegration';
export { useCantonBridge as useCantonBridgeHook } from './hooks/useCantonBridge';
export { useCantonNetwork } from './hooks/useCantonNetwork';
export { useCantonPortfolio } from './hooks/useCantonPortfolio';

// Services — PRODUCTION VERSION
export { DamlIntegrationService } from './services/damlIntegrationService';
export { CantonServiceManager } from './services/CantonServiceManager';
export { CantonAuthService } from './services/cantonAuthService';
export { ZKProofService } from './services/zkProofService';
export { Grok4PortfolioService } from './services/grok4PortfolioService';
export { useRealEstateService } from './services/realEstateService';
export { usePrivacyVaultService } from './services/privacyVaultService';
export { CantonBridgeService } from './services/cantonBridgeService';
export { SecurityAuditService } from './services/securityAuditService';

// AI Services
export { useAIPortfolioOptimizer } from './services/ai/portfolioOptimizerGrok4';

// Utils
export * from './utils/decimalFormatter';
export * from './utils/errorHandler';

// Config
export { wagmiConfig, SUPPORTED_CHAINS } from './config/wagmi';
export { 
  STABLECOINS, 
  CC_PURCHASE_CONFIG, 
  CANTON_BRIDGE_CONFIG,
  getStablecoinDropdownOptions,
  getStablecoinBySymbol,
  getStablecoinAddress,
} from './config/stablecoins';

export type {
  NetworkType,
  StablecoinConfig,
} from './config/stablecoins';

// Monitoring & Metrics
export * from './services/monitoring';

// Types
export type { CantonAsset, CantonPortfolio, CantonNetworkConfig } from './hooks/realCantonIntegration';
export type { CantonPortfolioData } from './hooks/useCantonPortfolio';
export type { ZKProof, ZKCircuit } from './services/zkProofService';
export type { OptimizationResult, PortfolioOptimizationRequest } from './services/grok4PortfolioService';
export type { 
  SecurityAuditResult, 
  SecurityAuditSummary, 
  SecurityMetrics,
  AuditType,
  SecuritySeverity,
  SecurityCategory 
} from './services/securityAuditService';