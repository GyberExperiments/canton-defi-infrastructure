/**
 * 🌉 REAL BRIDGE CONFIGURATION — PRODUCTION VERSION
 * 
 * Production-ready конфигурация для Cross-Chain Bridge:
 * - BSC, Ethereum, Polygon → Canton Network
 * - Real contract addresses (placeholder until deployed)
 * - Production stablecoin addresses
 * - Gas settings и rate limits
 */

// ========================================
// BRIDGE CONTRACT CONFIGURATION
// ========================================

export const REAL_BRIDGE_CONFIG = {
  // Bridge Contract Addresses (to be replaced with real deployed addresses)
  contracts: {
    BSC_MAINNET: process.env.NEXT_PUBLIC_BRIDGE_BSC_ADDRESS || '0x0000000000000000000000000000000000000000',
    ETHEREUM_MAINNET: process.env.NEXT_PUBLIC_BRIDGE_ETH_ADDRESS || '0x0000000000000000000000000000000000000000',
    POLYGON_MAINNET: process.env.NEXT_PUBLIC_BRIDGE_POLYGON_ADDRESS || '0x0000000000000000000000000000000000000000',
  },
  
  // Chain IDs
  chainIds: {
    BSC_MAINNET: 56,
    ETHEREUM_MAINNET: 1,
    POLYGON_MAINNET: 137,
    CANTON_NETWORK: 0, // Canton doesn't use EVM chain IDs
  },
  
  // RPC Endpoints
  rpcEndpoints: {
    BSC_MAINNET: 'https://bsc-dataseed.binance.org/',
    ETHEREUM_MAINNET: 'https://eth.llamarpc.com',
    POLYGON_MAINNET: 'https://polygon-rpc.com',
  },
  
  // Bridge Parameters
  parameters: {
    minDeposit: parseInt(process.env.BRIDGE_MIN_DEPOSIT || '10'), // USD
    maxDeposit: parseInt(process.env.BRIDGE_MAX_DEPOSIT || '100000'), // USD
    dailyLimit: parseInt(process.env.BRIDGE_DAILY_LIMIT || '1000000'), // USD
    bridgeFeePercent: 0.1, // 0.1%
    finality: {
      BSC_MAINNET: 15, // blocks
      ETHEREUM_MAINNET: 32, // blocks (2 epochs)
      POLYGON_MAINNET: 256, // blocks
    },
  },
  
  // Security Settings
  security: {
    multiSigRequired: true,
    requiredSignatures: 3,
    totalSigners: 5,
    timelockDelay: 24 * 60 * 60, // 24 hours for large withdrawals
    largeWithdrawalThreshold: 50000, // USD
  },
  
  // Feature Flags
  features: {
    enabled: process.env.NEXT_PUBLIC_ENABLE_BRIDGE === 'true',
    testMode: process.env.NODE_ENV !== 'production',
    emergencyPause: false,
  },
};

// ========================================
// PRODUCTION STABLECOINS
// ========================================

export const PRODUCTION_STABLECOINS = {
  BSC_MAINNET: {
    USDT: {
      address: '0x55d398326f99059fF775485246999027B3197955',
      decimals: 18,
      symbol: 'USDT',
      name: 'Tether USD',
    },
    USDC: {
      address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      decimals: 18,
      symbol: 'USDC',
      name: 'USD Coin',
    },
    BUSD: {
      address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
      decimals: 18,
      symbol: 'BUSD',
      name: 'Binance USD',
    },
  },
  ETHEREUM_MAINNET: {
    USDT: {
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      decimals: 6,
      symbol: 'USDT',
      name: 'Tether USD',
    },
    USDC: {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      decimals: 6,
      symbol: 'USDC',
      name: 'USD Coin',
    },
    DAI: {
      address: '0x6B175474E89094C44Da98b954EesodcB03Ef84E3',
      decimals: 18,
      symbol: 'DAI',
      name: 'Dai Stablecoin',
    },
  },
  POLYGON_MAINNET: {
    USDT: {
      address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      decimals: 6,
      symbol: 'USDT',
      name: 'Tether USD',
    },
    USDC: {
      address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      decimals: 6,
      symbol: 'USDC',
      name: 'USD Coin',
    },
  },
};

// ========================================
// GAS SETTINGS
// ========================================

export const BRIDGE_GAS_SETTINGS = {
  BSC_MAINNET: {
    gasLimit: 300000,
    maxFeePerGas: BigInt('5000000000'), // 5 gwei
    maxPriorityFeePerGas: BigInt('1000000000'), // 1 gwei
  },
  ETHEREUM_MAINNET: {
    gasLimit: 300000,
    maxFeePerGas: BigInt('30000000000'), // 30 gwei
    maxPriorityFeePerGas: BigInt('2000000000'), // 2 gwei
  },
  POLYGON_MAINNET: {
    gasLimit: 300000,
    maxFeePerGas: BigInt('100000000000'), // 100 gwei
    maxPriorityFeePerGas: BigInt('30000000000'), // 30 gwei
  },
};

// ========================================
// LAYERZERO CONFIGURATION (for cross-chain messaging)
// ========================================

export const LAYERZERO_CONFIG = {
  endpoints: {
    BSC_MAINNET: '0x3c2269811836af69497E5F486A85D7316753cf62',
    ETHEREUM_MAINNET: '0x66A71Dcef29A0fFBDBE3c6a460a3B5BC225Cd675',
    POLYGON_MAINNET: '0x3c2269811836af69497E5F486A85D7316753cf62',
  },
  chainIds: {
    BSC_MAINNET: 102,
    ETHEREUM_MAINNET: 101,
    POLYGON_MAINNET: 109,
  },
};

// ========================================
// HELPER FUNCTIONS
// ========================================

export function getStablecoinAddress(chain: keyof typeof PRODUCTION_STABLECOINS, symbol: string): string | null {
  const chainStables = PRODUCTION_STABLECOINS[chain];
  const stablecoin = Object.values(chainStables).find(s => s.symbol === symbol);
  return stablecoin?.address || null;
}

export function getBridgeContractAddress(chain: keyof typeof REAL_BRIDGE_CONFIG.contracts): string {
  return REAL_BRIDGE_CONFIG.contracts[chain];
}

export function isTestMode(): boolean {
  return REAL_BRIDGE_CONFIG.features.testMode;
}

export function isBridgeEnabled(): boolean {
  return REAL_BRIDGE_CONFIG.features.enabled && !REAL_BRIDGE_CONFIG.features.emergencyPause;
}

console.log('🌉 Real Bridge Configuration loaded');
