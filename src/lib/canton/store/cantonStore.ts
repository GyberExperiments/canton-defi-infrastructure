'use client';

/**
 * 🎯 CANTON WEALTH GLOBAL STATE MANAGEMENT
 * 
 * Centralized Zustand store for Canton DeFi platform with real-time sync
 * Управляет всем состоянием приложения: портфолио, AI, недвижимость, privacy vaults
 * 
 * SSR-safe implementation for Next.js
 */

import { useState, useEffect } from 'react';
import { create, StateCreator } from 'zustand';
import { persist, createJSONStorage, PersistOptions } from 'zustand/middleware';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import Decimal from 'decimal.js';

// ========================================
// TYPES DEFINITIONS
// ========================================

export interface UserProfile {
  id: string;
  address: string;
  kyc_status: 'VERIFIED' | 'PENDING' | 'REJECTED';
  risk_tolerance: number; // 0-1 scale
  investment_experience: 'BEGINNER' | 'INTERMEDIATE' | 'EXPERT';
  total_portfolio_value: Decimal;
  preferred_assets: string[];
  notification_preferences: NotificationPreferences;
  created_at: Date;
  updated_at: Date;
}

export interface Portfolio {
  id: string;
  user_id: string;
  name: string;
  total_value: Decimal;
  performance_24h: number;
  performance_7d: number;
  performance_30d: number;
  holdings: Holding[];
  rebalance_frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  ai_managed: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Holding {
  asset_id: string;
  symbol: string;
  name: string;
  quantity: Decimal;
  current_price: Decimal;
  current_value: Decimal;
  weight: number; // percentage of portfolio
  cost_basis: Decimal;
  unrealized_pnl: Decimal;
}

export interface AIOptimizerState {
  is_active: boolean;
  last_optimization: Date | null;
  next_rebalance: Date | null;
  optimization_score: number; // 0-100
  settings: {
    risk_tolerance: number;
    rebalance_frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    aggressiveness: number; // 0-1
    max_drawdown_limit: number;
  };
  performance_metrics: {
    sharpe_ratio: number;
    max_drawdown: number;
    total_return: number;
    win_rate: number;
  };
}

export interface RiskMetrics {
  var_95: number; // Value at Risk 95%
  var_99: number; // Value at Risk 99%
  beta: number;
  volatility: number;
  correlation_matrix: number[][];
  risk_score: number; // 0-100
  last_calculated: Date;
}

export interface OptimizationResult {
  id: string;
  portfolio_id: string;
  recommended_allocation: AllocationRecommendation[];
  expected_return: number;
  expected_risk: number;
  sharpe_ratio: number;
  confidence: number; // 0-1
  created_at: Date;
  executed: boolean;
}

export interface AllocationRecommendation {
  asset_symbol: string;
  current_weight: number;
  target_weight: number;
  action: 'BUY' | 'SELL' | 'HOLD';
  amount: Decimal;
  reason: string;
}

export interface RealEstateProperty {
  id: string;
  name: string;
  address: string;
  property_type: 'RESIDENTIAL' | 'COMMERCIAL' | 'INDUSTRIAL';
  total_value: Decimal;
  available_shares: number;
  total_shares: number;
  price_per_share: Decimal;
  expected_dividend_yield: number;
  last_dividend_date: Date | null;
  next_dividend_date: Date | null;
  images: string[];
  description: string;
  manager: string;
  location: {
    city: string;
    country: string;
    coordinates: [number, number];
  };
}

export interface RealEstateHolding {
  property_id: string;
  property_name: string;
  shares_owned: number;
  total_investment: Decimal;
  current_value: Decimal;
  dividends_earned: Decimal;
  purchase_date: Date;
  performance: number;
}

export interface PrivacyVault {
  id: string;
  name: string;
  owner: string;
  custodian: string;
  total_value: Decimal;
  compliance_level: 'KYC' | 'KYC_AML' | 'INSTITUTIONAL';
  privacy_level: 'BASIC' | 'ENHANCED' | 'MAXIMUM';
  encrypted_assets: PrivateAsset[];
  zk_proofs: ZKProof[];
  created_at: Date;
}

export interface PrivateAsset {
  id: string;
  type: string;
  amount: Decimal;
  encrypted_metadata: string;
  proof_hash: string;
}

export interface ZKProof {
  id: string;
  proof_type: 'OWNERSHIP' | 'BALANCE' | 'COMPLIANCE';
  proof_data: string;
  verification_key: string;
  created_at: Date;
  verified: boolean;
}

export interface ComplianceReport {
  id: string;
  vault_id: string;
  regulator: string;
  disclosure_level: 'MINIMAL' | 'AGGREGATED' | 'FULL';
  disclosed_assets: any[];
  generated_at: Date;
  expires_at: Date;
}

export interface MarketData {
  timestamp: Date;
  prices: Map<string, Decimal>;
  volumes: Map<string, Decimal>;
  market_caps: Map<string, Decimal>;
  price_changes_24h: Map<string, number>;
}

export interface Notification {
  id: string;
  type: 'SUCCESS' | 'WARNING' | 'ERROR' | 'INFO';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  action_url?: string;
}

export interface NotificationPreferences {
  portfolio_alerts: boolean;
  rebalance_notifications: boolean;
  dividend_alerts: boolean;
  security_alerts: boolean;
  email_enabled: boolean;
  push_enabled: boolean;
}

export interface LoadingState {
  canton: boolean;
  portfolio: boolean;
  transactions: boolean;
  ai_optimization: boolean;
  real_estate: boolean;
  privacy_vaults: boolean;
}

// ========================================
// MAIN STORE INTERFACE
// ========================================

interface CantonStore {
  // ===== USER STATE =====
  user: UserProfile | null;
  is_authenticated: boolean;
  onboarding_completed: boolean;
  
  // ===== PORTFOLIO STATE =====
  portfolios: Portfolio[];
  active_portfolio_id: string | null;
  total_portfolio_value: Decimal;
  
  // ===== AI STATE =====
  ai_optimizer: AIOptimizerState;
  risk_metrics: RiskMetrics | null;
  optimization_history: OptimizationResult[];
  
  // ===== REAL ESTATE STATE =====
  available_properties: RealEstateProperty[];
  user_real_estate_holdings: RealEstateHolding[];
  dividend_history: any[];
  
  // ===== PRIVACY VAULT STATE =====
  privacy_vaults: PrivacyVault[];
  compliance_reports: ComplianceReport[];
  
  // ===== MARKET DATA =====
  market_data: MarketData;
  price_history: any[];
  
  // ===== UI STATE =====
  active_tab: string;
  is_loading: LoadingState;
  notifications: Notification[];
  
  // ===== SYNC ACTIONS =====
  setUser: (user: UserProfile) => void;
  updatePortfolio: (portfolio: Portfolio) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'read'>) => void;
  clearNotifications: () => void;
  setMarketData: (data: MarketData) => void;
  setActiveTab: (tab: string) => void;
  setLoading: (key: keyof LoadingState, loading: boolean) => void;
  
  // ===== ASYNC ACTIONS =====
  initializeCantonConnection: () => Promise<void>;
  fetchUserData: (userId: string) => Promise<void>;
  refreshPortfolioData: () => Promise<void>;
  optimizePortfolio: (portfolioId: string) => Promise<OptimizationResult | null>;
  purchaseRealEstateShares: (propertyId: string, shares: number) => Promise<boolean>;
  createPrivacyVault: (config: any) => Promise<PrivacyVault | null>;
}

// ========================================
// SSR-SAFE STORAGE
// ========================================

const getStorage = () => {
  if (typeof window === 'undefined') {
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
  }
  return localStorage;
};

// ========================================
// STORE IMPLEMENTATION
// ========================================

type CantonStoreSlice = StateCreator<
  CantonStore,
  [['zustand/immer', never], ['zustand/subscribeWithSelector', never]],
  [],
  CantonStore
>;

const createCantonSlice: CantonStoreSlice = (set, get) => ({
  // ===== INITIAL STATE =====
  user: null,
  is_authenticated: false,
  onboarding_completed: false,
  
  portfolios: [],
  active_portfolio_id: null,
  total_portfolio_value: new Decimal(0),
  
  ai_optimizer: {
    is_active: false,
    last_optimization: null,
    next_rebalance: null,
    optimization_score: 0,
    settings: {
      risk_tolerance: 0.5,
      rebalance_frequency: 'WEEKLY',
      aggressiveness: 0.7,
      max_drawdown_limit: 0.15,
    },
    performance_metrics: {
      sharpe_ratio: 0,
      max_drawdown: 0,
      total_return: 0,
      win_rate: 0,
    },
  },
  
  risk_metrics: null,
  optimization_history: [],
  
  available_properties: [],
  user_real_estate_holdings: [],
  dividend_history: [],
  
  privacy_vaults: [],
  compliance_reports: [],
  
  market_data: {
    timestamp: new Date(),
    prices: new Map(),
    volumes: new Map(),
    market_caps: new Map(),
    price_changes_24h: new Map(),
  },
  
  price_history: [],
  active_tab: 'products',
  
  is_loading: {
    canton: false,
    portfolio: false,
    transactions: false,
    ai_optimization: false,
    real_estate: false,
    privacy_vaults: false,
  },
  
  notifications: [],

  // ===== SYNC ACTIONS =====
  setUser: (user) => set((state) => {
    state.user = user;
    state.is_authenticated = true;
  }),

  updatePortfolio: (portfolio) => set((state) => {
    const index = state.portfolios.findIndex(p => p.id === portfolio.id);
    if (index >= 0) {
      state.portfolios[index] = portfolio;
    } else {
      state.portfolios.push(portfolio);
    }
    
    // Update total portfolio value
    state.total_portfolio_value = state.portfolios.reduce(
      (sum, p) => sum.plus(p.total_value),
      new Decimal(0)
    );
  }),

  addNotification: (notification) => set((state) => {
    const newNotification: Notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      read: false,
      ...notification,
    };
    
    state.notifications.unshift(newNotification);
    
    // Keep only last 100 notifications
    if (state.notifications.length > 100) {
      state.notifications = state.notifications.slice(0, 100);
    }
  }),

  clearNotifications: () => set((state) => {
    state.notifications = [];
  }),

  setMarketData: (data) => set((state) => {
    state.market_data = data;
    
    // Update price history
    const priceEntry = {
      timestamp: data.timestamp,
      prices: Object.fromEntries(data.prices),
      volumes: Object.fromEntries(data.volumes),
    };
    
    state.price_history.push(priceEntry);
    
    // Keep only last 1440 entries (24 hours of minute data)
    if (state.price_history.length > 1440) {
      state.price_history = state.price_history.slice(-1440);
    }
  }),

  setActiveTab: (tab) => set((state) => {
    state.active_tab = tab;
  }),

  setLoading: (key, loading) => set((state) => {
    state.is_loading[key] = loading;
  }),

  // ===== ASYNC ACTIONS =====
  initializeCantonConnection: async () => {
    set((state) => { state.is_loading.canton = true; });
    
    try {
      console.log('🏛️ Initializing Canton Network connection...');
      
      set((state) => { 
        state.is_loading.canton = false;
        state.is_authenticated = true;
      });
      
      get().addNotification({
        type: 'SUCCESS',
        title: 'Canton Network Connected',
        message: 'Successfully connected to Canton Network',
        timestamp: new Date(),
      });
      
    } catch (error) {
      console.error('❌ Canton connection failed:', error);
      set((state) => { state.is_loading.canton = false; });
      
      get().addNotification({
        type: 'ERROR',
        title: 'Connection Failed',
        message: 'Failed to connect to Canton Network',
        timestamp: new Date(),
      });
    }
  },

  fetchUserData: async (userId: string) => {
    set((state) => { state.is_loading.portfolio = true; });
    
    try {
      console.log('📊 Fetching user data for:', userId);
      
      const mockUserProfile: UserProfile = {
        id: userId,
        address: userId,
        kyc_status: 'VERIFIED',
        risk_tolerance: 0.6,
        investment_experience: 'INTERMEDIATE',
        total_portfolio_value: new Decimal(50000),
        preferred_assets: ['CANTON', 'ETH', 'BTC'],
        notification_preferences: {
          portfolio_alerts: true,
          rebalance_notifications: true,
          dividend_alerts: true,
          security_alerts: true,
          email_enabled: true,
          push_enabled: true,
        },
        created_at: new Date(),
        updated_at: new Date(),
      };

      set((state) => {
        state.user = mockUserProfile;
        state.is_loading.portfolio = false;
      });
      
    } catch (error) {
      console.error('❌ User data fetch failed:', error);
      set((state) => { state.is_loading.portfolio = false; });
    }
  },

  refreshPortfolioData: async () => {
    const { user } = get();
    if (!user) return;
    
    set((state) => { state.is_loading.portfolio = true; });
    
    try {
      console.log('🔄 Refreshing portfolio data...');
      
      set((state) => { state.is_loading.portfolio = false; });
    } catch (error) {
      console.error('❌ Portfolio refresh failed:', error);
      set((state) => { state.is_loading.portfolio = false; });
    }
  },

  optimizePortfolio: async (portfolioId: string) => {
    set((state) => { state.is_loading.ai_optimization = true; });
    
    try {
      console.log('🤖 Optimizing portfolio:', portfolioId);
      
      const portfolio = get().portfolios.find(p => p.id === portfolioId);
      if (!portfolio) {
        throw new Error('Portfolio not found');
      }

      const mockOptimization: OptimizationResult = {
        id: `opt_${Date.now()}`,
        portfolio_id: portfolioId,
        recommended_allocation: [],
        expected_return: 14.2,
        expected_risk: 8.5,
        sharpe_ratio: 1.67,
        confidence: 0.85,
        created_at: new Date(),
        executed: false,
      };

      set((state) => {
        state.optimization_history.unshift(mockOptimization);
        state.ai_optimizer.last_optimization = new Date();
        state.is_loading.ai_optimization = false;
      });

      get().addNotification({
        type: 'SUCCESS',
        title: 'Portfolio Optimized',
        message: `Expected return improved to ${mockOptimization.expected_return}%`,
        timestamp: new Date(),
      });

      return mockOptimization;

    } catch (error) {
      console.error('❌ Portfolio optimization failed:', error);
      set((state) => { state.is_loading.ai_optimization = false; });
      
      get().addNotification({
        type: 'ERROR',
        title: 'Optimization Failed',
        message: 'Failed to optimize portfolio',
        timestamp: new Date(),
      });
      
      return null;
    }
  },

  purchaseRealEstateShares: async (propertyId: string, shares: number) => {
    set((state) => { state.is_loading.real_estate = true; });
    
    try {
      console.log(`🏠 Purchasing ${shares} shares of property ${propertyId}`);
      
      set((state) => { state.is_loading.real_estate = false; });
      
      get().addNotification({
        type: 'SUCCESS',
        title: 'Real Estate Purchase Successful',
        message: `Purchased ${shares} shares of property ${propertyId}`,
        timestamp: new Date(),
      });
      
      return true;
      
    } catch (error) {
      console.error('❌ Real estate purchase failed:', error);
      set((state) => { state.is_loading.real_estate = false; });
      
      get().addNotification({
        type: 'ERROR',
        title: 'Purchase Failed',
        message: 'Failed to purchase real estate shares',
        timestamp: new Date(),
      });
      
      return false;
    }
  },

  createPrivacyVault: async (config: any) => {
    set((state) => { state.is_loading.privacy_vaults = true; });
    
    try {
      console.log('🔐 Creating privacy vault with config:', config);
      
      const mockVault: PrivacyVault = {
        id: `vault_${Date.now()}`,
        name: config.name || 'Personal Vault',
        owner: config.owner,
        custodian: config.custodian,
        total_value: new Decimal(0),
        compliance_level: config.compliance_level || 'KYC',
        privacy_level: config.privacy_level || 'ENHANCED',
        encrypted_assets: [],
        zk_proofs: [],
        created_at: new Date(),
      };
      
      set((state) => {
        state.privacy_vaults.push(mockVault);
        state.is_loading.privacy_vaults = false;
      });
      
      get().addNotification({
        type: 'SUCCESS',
        title: 'Privacy Vault Created',
        message: `Created privacy vault: ${mockVault.name}`,
        timestamp: new Date(),
      });
      
      return mockVault;
      
    } catch (error) {
      console.error('❌ Privacy vault creation failed:', error);
      set((state) => { state.is_loading.privacy_vaults = false; });
      
      get().addNotification({
        type: 'ERROR',
        title: 'Vault Creation Failed', 
        message: 'Failed to create privacy vault',
        timestamp: new Date(),
      });
      
      return null;
    }
  },
});

type CantonStorePersist = (
  config: any,
  options: PersistOptions<CantonStore>
) => any;

export const useCantonStore = create<CantonStore>()(
  (persist as CantonStorePersist)(
    subscribeWithSelector(
      immer(createCantonSlice)
    ),
    {
      name: 'canton-wealth-store',
      storage: createJSONStorage(() => getStorage()),
      skipHydration: true, // Important for Next.js SSR!
      partialize: (state) => {
        return {
          user: state.user ?? null,
          onboarding_completed: state.onboarding_completed,
          portfolios: state.portfolios,
          ai_optimizer: state.ai_optimizer,
          active_tab: state.active_tab,
          privacy_vaults: state.privacy_vaults,
        } as any;
      },
    }
  )
);

// Rehydration hook for client-side
export const useHydrateCantonStore = () => {
  const [hydrated, setHydrated] = useState(false);
  
  useEffect(() => {
    const store = useCantonStore as any;
    if (store.persist?.rehydrate) {
      store.persist.rehydrate();
    }
    setHydrated(true);
  }, []);
  
  return hydrated;
};

// ========================================
// STORE SELECTORS (для удобства использования)
// ========================================

export const useUser = () => useCantonStore((state) => state.user);
export const usePortfolios = () => useCantonStore((state) => state.portfolios);
export const useActivePortfolio = () => useCantonStore((state) => {
  const { portfolios, active_portfolio_id } = state;
  return portfolios.find(p => p.id === active_portfolio_id) || null;
});
export const useAIOptimizer = () => useCantonStore((state) => state.ai_optimizer);
export const useRealEstate = () => useCantonStore((state) => ({
  properties: state.available_properties,
  holdings: state.user_real_estate_holdings,
}));
export const usePrivacyVaults = () => useCantonStore((state) => state.privacy_vaults);
export const useNotifications = () => useCantonStore((state) => state.notifications);
export const useLoadingState = () => useCantonStore((state) => state.is_loading);
export const useMarketData = () => useCantonStore((state) => state.market_data);
