# 🏛️ CANTON DEFI INTEGRATION PROMPT — Expert Full-Stack Integration v2.0

> **Дата создания:** 2026-01-19
> **Версия:** 2.0 — Complete & Self-Sufficient
> **Цель:** Интеграция CantonDeFi приложения из tech-hy-ecosystem в canton-otc на роут `/defi`

---

## 📋 EXECUTIVE SUMMARY

**Задача:** Перенести полнофункциональное DeFi приложение `CantonDeFi` из проекта `tech-hy-ecosystem` (Vite + React 18) в проект `canton-otc` (Next.js 15 + React 19) на роут `/defi`.

**Ключевые фичи CantonDeFi:**
- 🏦 Институциональные DeFi продукты (Real Estate, Privacy Vaults)
- 🤖 AI Portfolio Optimizer (Grok-4 integration)
- 🔐 Zero-Knowledge Privacy Vaults
- 🏠 Real Estate Tokenization ($50 minimum)
- 🌉 Cross-Chain Bridge (BSC, ETH, Polygon → Canton)
- 💎 Canton Coin Purchase Widget

**Оценка сложности:** HIGH (~20-30 часов работы)  
**Критический путь:** Wagmi Provider → Canton Store → Services → UI Components

---

## 🎯 CONTEXT FOR AI

Ты **senior full-stack разработчик** со специализацией в:
- DeFi интеграциях и Web3
- Next.js 15 App Router
- Zustand state management
- wagmi/viem/RainbowKit
- TypeScript strict mode

**Твоя задача:** Методично перенести все компоненты CantonDeFi, адаптируя их под архитектуру canton-otc без потери функциональности.

---

## 📁 PROJECT LOCATIONS (ABSOLUTE PATHS)

### 🔵 SOURCE PROJECT (tech-hy-ecosystem)

```
/Users/Gyber/GYBERNATY-ECOSYSTEM/tech-hy-ecosystem/frontend/src/
├── app/
│   └── CantonDeFi.tsx                           # 1189 lines - MAIN COMPONENT
│
├── entities/Canton/
│   ├── api/
│   │   ├── realCantonIntegration.ts             # 1372 lines - Canton Network hooks
│   │   ├── useCantonBridge.ts                   # Bridge operations hook
│   │   ├── useCantonNetwork.ts                  # Network connection hook
│   │   └── useInstitutionalAssets.ts            # Assets fetching hook
│   │
│   ├── config/
│   │   ├── realCantonConfig.ts                  # 134 lines - Network config
│   │   ├── productionCantonConfig.ts            # Production env config
│   │   └── stablecoins.ts                       # 105 lines - USDT/USDC/USD1 config
│   │
│   ├── contracts/                               # DAML Reference (don't port, just docs)
│   │   ├── InstitutionalAsset.daml
│   │   ├── CrossChainBridge.daml
│   │   ├── PrivacyVault.daml
│   │   └── RealEstate.daml
│   │
│   ├── hooks/
│   │   └── useCantonPortfolio.ts                # Portfolio data hook
│   │
│   ├── security/
│   │   └── securityAuditService.ts              # Security audit logic
│   │
│   ├── services/
│   │   ├── cantonBridgeService.ts               # Cross-chain bridge
│   │   ├── CantonServiceManager.ts              # Service orchestration
│   │   ├── damlIntegrationService.ts            # DAML contract calls
│   │   ├── multiPartyWorkflowService.ts         # Multi-party transactions
│   │   ├── performanceOptimizationService.ts    # Performance optimization
│   │   ├── privacyVaultService.ts               # 1337 lines - Privacy vaults
│   │   ├── propertyValuationAPI.ts              # Real estate valuation
│   │   ├── realEstateService.ts                 # 1127 lines - Real estate tokenization
│   │   └── zkProofService.ts                    # Zero-knowledge proofs
│   │
│   ├── ui/
│   │   ├── MultiPartyAuthPanel.tsx              # Multi-party authorization
│   │   ├── MultiPartyDashboard.tsx              # Dashboard for multi-party
│   │   └── StablecoinSelector.tsx               # Stablecoin dropdown
│   │
│   ├── tests/
│   │   └── cantonIntegration.test.ts
│   │
│   └── index.ts                                 # Re-exports
│
├── entities/AI/services/
│   ├── grok4PortfolioService.ts                 # Grok-4 API integration
│   ├── portfolioOptimizer.ts                    # Base optimizer
│   └── portfolioOptimizerGrok4.ts               # 676 lines - AI optimizer hook
│
├── widgets/CCPurchaseWidget/
│   └── ui/
│       └── CCPurchaseWidget.tsx                 # Canton Coin purchase widget
│
├── shared/store/
│   └── cantonStore.ts                           # 734 lines - Zustand global state
│
└── shared/lib/
    ├── cn.ts                                    # clsx + twMerge utility
    ├── decimalFormatter.ts                      # 165 lines - Decimal.js utilities
    ├── errorHandler.ts                          # 350 lines - Error handling + toast
    ├── format.ts                                # Basic formatters
    ├── formatters.ts                            # Number/currency formatters
    └── calculations.ts                          # Math calculations
```

### 🟢 TARGET PROJECT (canton-otc)

```
/Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/
├── src/
│   ├── app/
│   │   ├── layout.tsx                           # Root layout (modify for WagmiProvider)
│   │   ├── page.tsx                             # Landing page
│   │   ├── dex/                                 # Existing DEX (reference)
│   │   │   ├── page.tsx
│   │   │   └── layout.tsx
│   │   └── defi/                                # ✨ CREATE THIS
│   │       ├── page.tsx
│   │       └── layout.tsx
│   │
│   ├── components/
│   │   ├── ui/                                  # Shared UI components
│   │   ├── dex/                                 # DEX-specific components
│   │   └── defi/                                # ✨ CREATE THIS
│   │       ├── CantonDeFi.tsx
│   │       ├── CCPurchaseWidget.tsx
│   │       ├── StablecoinSelector.tsx
│   │       ├── MultiPartyAuthPanel.tsx
│   │       └── MultiPartyDashboard.tsx
│   │
│   ├── lib/
│   │   ├── utils.ts                             # Existing utilities (has cn)
│   │   └── canton/                              # ✨ CREATE THIS
│   │       ├── index.ts
│   │       ├── config.ts
│   │       ├── store/
│   │       │   └── cantonStore.ts
│   │       ├── services/
│   │       │   ├── cantonNetworkClient.ts
│   │       │   ├── realEstateService.ts
│   │       │   ├── privacyVaultService.ts
│   │       │   ├── aiPortfolioService.ts
│   │       │   ├── bridgeService.ts
│   │       │   └── damlIntegration.ts
│   │       ├── hooks/
│   │       │   ├── useCantonNetwork.ts
│   │       │   ├── useCantonPortfolio.ts
│   │       │   └── useCantonBridge.ts
│   │       ├── types/
│   │       │   └── canton.types.ts
│   │       └── utils/
│   │           ├── decimalFormatter.ts
│   │           └── errorHandler.ts
│   │
│   └── hooks/                                   # Existing hooks
│
├── package.json                                 # Add new dependencies here
├── tailwind.config.ts                           # Design tokens
├── next.config.js                               # Next.js config
└── .env.local                                   # Environment variables
```

---

## 📦 DEPENDENCIES TO INSTALL

### Step 1: Install Core Dependencies

```bash
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc

# Web3 & Wallet
pnpm add wagmi@latest viem@latest @rainbow-me/rainbowkit@latest @tanstack/react-query

# State Management  
pnpm add zustand immer

# Utilities
pnpm add decimal.js events react-hot-toast

# Optional: AI Integration (if using Grok-4)
pnpm add eventsource-parser
```

### Step 2: Verify package.json After Install

```json
{
  "dependencies": {
    // ... existing deps ...
    "@rainbow-me/rainbowkit": "^2.x.x",
    "@tanstack/react-query": "^5.x.x",
    "decimal.js": "^10.x.x",
    "events": "^3.x.x",
    "immer": "^10.x.x",
    "react-hot-toast": "^2.x.x",
    "viem": "^2.x.x",
    "wagmi": "^2.x.x",
    "zustand": "^4.x.x"
  }
}
```

---

## 🔧 CRITICAL ARCHITECTURE ADAPTATIONS

### 1. Environment Variables Mapping

| Source (Vite) | Target (Next.js) |
|---------------|------------------|
| `import.meta.env.REACT_APP_*` | `process.env.NEXT_PUBLIC_*` |
| `import.meta.env.DEV` | `process.env.NODE_ENV === 'development'` |
| `import.meta.env.PROD` | `process.env.NODE_ENV === 'production'` |

**Regex для замены:**
```regex
Find: import\.meta\.env\.REACT_APP_(\w+)
Replace: process.env.NEXT_PUBLIC_$1

Find: import\.meta\.env\.DEV
Replace: process.env.NODE_ENV === 'development'
```

### 2. Client Components Directive

**EVERY file that uses:**
- `useState`, `useEffect`, `useCallback`, `useMemo`
- wagmi hooks (`useAccount`, `useConnect`, etc.)
- Zustand store hooks
- `window`, `document`, `localStorage`
- Event handlers (`onClick`, etc.)

**MUST have at the TOP:**
```typescript
'use client';
```

### 3. SSR Safety Patterns

**Pattern for hydration-safe code:**
```typescript
'use client';

import { useState, useEffect } from 'react';

export function useSSRSafe<T>(clientValue: T, serverValue: T): T {
  const [value, setValue] = useState(serverValue);
  
  useEffect(() => {
    setValue(clientValue);
  }, [clientValue]);
  
  return value;
}

// Usage in components:
const isClient = useSSRSafe(true, false);
if (!isClient) return <LoadingSkeleton />;
```

**Pattern for Zustand with persistence:**
```typescript
'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// SSR-safe persist config
const persistConfig = {
  name: 'canton-store',
  skipHydration: true, // Important for Next.js!
};

export const useStore = create(
  persist(
    (set, get) => ({
      // ... store logic
    }),
    persistConfig
  )
);

// In your root component, call:
useEffect(() => {
  useStore.persist.rehydrate();
}, []);
```

### 4. Dynamic Imports for Heavy Components

```typescript
'use client';

import dynamic from 'next/dynamic';

const HeavyComponent = dynamic(
  () => import('@/components/defi/HeavyComponent'),
  { 
    ssr: false,
    loading: () => <div className="animate-pulse">Loading...</div>
  }
);
```

### 5. React 18 → React 19 Migration Notes

**Breaking changes to watch:**
- `useId()` - works the same
- `use()` hook - new in React 19, can use for async
- `forwardRef` - deprecated, use `ref` as prop directly
- `<Context.Provider>` - works but `<Context>` also works now

**If you see `forwardRef` in source:**
```typescript
// Old (React 18):
const Component = forwardRef<HTMLDivElement, Props>((props, ref) => {
  return <div ref={ref} {...props} />;
});

// New (React 19):
const Component = ({ ref, ...props }: Props & { ref?: Ref<HTMLDivElement> }) => {
  return <div ref={ref} {...props} />;
};
```

### 6. Import Path Conversions

```typescript
// Source paths → Target paths
'../../../shared/lib/cn'           → '@/lib/utils'
'../../../shared/lib/decimalFormatter' → '@/lib/canton/utils/decimalFormatter'
'../../../shared/store/cantonStore'    → '@/lib/canton/store/cantonStore'
'../../../entities/Canton/api/*'       → '@/lib/canton/hooks/*'
'../../../entities/Canton/services/*'  → '@/lib/canton/services/*'
'../../../entities/Canton/config/*'    → '@/lib/canton/config'
'../../../entities/AI/services/*'      → '@/lib/canton/services/ai/*'
'../../../widgets/CCPurchaseWidget/*'  → '@/components/defi/CCPurchaseWidget'
```

---

## 📝 STEP-BY-STEP IMPLEMENTATION GUIDE

### PHASE 1: Infrastructure Setup (Steps 1-3)

#### Step 1: Install Dependencies & Create Directory Structure

```bash
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc

# Install dependencies
pnpm add wagmi@latest viem@latest @rainbow-me/rainbowkit@latest @tanstack/react-query zustand immer decimal.js events react-hot-toast

# Create directory structure
mkdir -p src/lib/canton/{store,services,hooks,types,utils,config}
mkdir -p src/components/defi
mkdir -p src/app/defi
```

#### Step 2: Create Wagmi Configuration

**Create `/src/lib/canton/config/wagmi.ts`:**

```typescript
'use client';

import { http, createConfig } from 'wagmi';
import { mainnet, bsc, polygon, optimism, arbitrum } from 'wagmi/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

// Custom Canton Network chain (if needed)
const cantonNetwork = {
  id: 7575,
  name: 'Canton Network',
  nativeCurrency: {
    decimals: 18,
    name: 'Canton Coin',
    symbol: 'CC',
  },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_CANTON_RPC_URL || 'https://rpc.canton.network'] },
  },
  blockExplorers: {
    default: { name: 'Canton Explorer', url: 'https://explorer.canton.network' },
  },
} as const;

export const wagmiConfig = getDefaultConfig({
  appName: '1OTC Canton DeFi',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id',
  chains: [mainnet, bsc, polygon, optimism, arbitrum],
  transports: {
    [mainnet.id]: http(),
    [bsc.id]: http(),
    [polygon.id]: http(),
    [optimism.id]: http(),
    [arbitrum.id]: http(),
  },
  ssr: true,
});

export const SUPPORTED_CHAINS = [mainnet, bsc, polygon, optimism, arbitrum];
```

#### Step 3: Create Wagmi Provider

**Create `/src/components/providers/WagmiProvider.tsx`:**

```typescript
'use client';

import React, { useState, useEffect } from 'react';
import { WagmiProvider as WagmiCoreProvider, State } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { wagmiConfig } from '@/lib/canton/config/wagmi';

interface Props {
  children: React.ReactNode;
  initialState?: State;
}

export function WagmiProvider({ children, initialState }: Props) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000, // 1 minute
          refetchOnWindowFocus: false,
        },
      },
    })
  );

  // Prevent hydration mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <WagmiCoreProvider config={wagmiConfig} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#06B6D4', // cyan-500
            accentColorForeground: 'white',
            borderRadius: 'large',
            fontStack: 'system',
            overlayBlur: 'small',
          })}
          modalSize="compact"
        >
          {mounted ? children : null}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiCoreProvider>
  );
}
```

**Update `/src/app/layout.tsx`:**

```typescript
// Add import at the top
import { WagmiProvider } from '@/components/providers/WagmiProvider';

// Wrap children with WagmiProvider (inside existing providers)
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ConfigProvider>
          <WagmiProvider>
            {/* existing content */}
            {children}
          </WagmiProvider>
        </ConfigProvider>
      </body>
    </html>
  );
}
```

---

### PHASE 2: Core Services & State (Steps 4-6)

#### Step 4: Port Decimal Formatter

**Create `/src/lib/canton/utils/decimalFormatter.ts`:**

Copy the ENTIRE content from:
`/Users/Gyber/GYBERNATY-ECOSYSTEM/tech-hy-ecosystem/frontend/src/shared/lib/decimalFormatter.ts`

Add `'use client';` at the top.

#### Step 5: Port Error Handler

**Create `/src/lib/canton/utils/errorHandler.ts`:**

Copy from source, but replace:
```typescript
// Replace this import:
import { toast } from 'react-hot-toast';

// With this (if using sonner instead):
import { toast } from 'sonner';
// OR keep react-hot-toast if you installed it
```

#### Step 6: Port Canton Store

**Create `/src/lib/canton/store/cantonStore.ts`:**

1. Copy from `/Users/Gyber/GYBERNATY-ECOSYSTEM/tech-hy-ecosystem/frontend/src/shared/store/cantonStore.ts`

2. Apply these modifications:

```typescript
'use client';

import { create, StateCreator } from 'zustand';
import { persist, createJSONStorage, PersistOptions } from 'zustand/middleware';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import Decimal from 'decimal.js';

// ... (copy all interfaces from source)

type CantonStoreSlice = StateCreator<
  CantonStore,
  [['zustand/immer', never], ['zustand/subscribeWithSelector', never]],
  [],
  CantonStore
>;

const createCantonSlice: CantonStoreSlice = (set, get) => ({
  // ... (copy all state and actions)
});

// SSR-safe storage
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

type CantonStorePersist = (
  config: CantonStoreSlice,
  options: PersistOptions<CantonStore>
) => CantonStoreSlice;

export const useCantonStore = create<CantonStore>()(
  (persist as CantonStorePersist)(
    subscribeWithSelector(
      immer(createCantonSlice)
    ),
    {
      name: 'canton-wealth-store',
      storage: createJSONStorage(() => getStorage()),
      skipHydration: true, // Important for Next.js SSR!
      partialize: (state) => ({
        userProfile: state.userProfile,
        portfolio: state.portfolio,
        aiOptimizer: state.aiOptimizer,
        // Don't persist transient state
      }),
    }
  )
);

// Rehydration hook for client-side
export const useHydrateCantonStore = () => {
  const [hydrated, setHydrated] = useState(false);
  
  useEffect(() => {
    useCantonStore.persist.rehydrate();
    setHydrated(true);
  }, []);
  
  return hydrated;
};
```

---

### PHASE 3: Canton Services (Steps 7-9)

#### Step 7: Port Canton Network Client

**Create `/src/lib/canton/services/cantonNetworkClient.ts`:**

1. Copy from `/Users/Gyber/GYBERNATY-ECOSYSTEM/tech-hy-ecosystem/frontend/src/entities/Canton/api/realCantonIntegration.ts`

2. Critical modifications:

```typescript
'use client';

import { EventEmitter } from 'events';
import Decimal from 'decimal.js';
import { useAccount, useChainId, usePublicClient, useWalletClient } from 'wagmi';
import { useState, useEffect, useCallback } from 'react';

// Environment variable adaptation
const CANTON_CONFIG = {
  host: process.env.NEXT_PUBLIC_CANTON_HOST || 'localhost',
  port: parseInt(process.env.NEXT_PUBLIC_CANTON_PORT || '7575'),
  participantId: process.env.NEXT_PUBLIC_CANTON_PARTICIPANT_ID || 'canton_wealth_participant',
  ledgerUrl: process.env.NEXT_PUBLIC_CANTON_LEDGER_URL || 'http://localhost:3001/api/v1',
  wsUrl: process.env.NEXT_PUBLIC_CANTON_WS_URL || 'ws://localhost:3001/ws',
  authToken: process.env.NEXT_PUBLIC_CANTON_AUTH_TOKEN || '',
  domainId: process.env.NEXT_PUBLIC_CANTON_DOMAIN_ID || 'canton_wealth_domain',
};

const isDevelopment = process.env.NODE_ENV === 'development';

// ... rest of the file with env replacements
```

3. Replace ALL `import.meta.env.*` references

#### Step 8: Port Real Estate Service

**Create `/src/lib/canton/services/realEstateService.ts`:**

Copy from source, apply:
- `'use client';` directive
- Environment variable replacements
- Import path fixes

#### Step 9: Port Privacy Vault Service

**Create `/src/lib/canton/services/privacyVaultService.ts`:**

Copy from source, same modifications as Step 8.

---

### PHASE 4: UI Components (Steps 10-13)

#### Step 10: Create DeFi Page

**Create `/src/app/defi/page.tsx`:**

```typescript
'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Loading component
function DeFiLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/50 to-indigo-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <h2 className="text-xl text-white font-medium mb-2">Loading Canton DeFi</h2>
        <p className="text-white/60">Initializing institutional-grade protocols...</p>
      </div>
    </div>
  );
}

// Dynamic import - prevents SSR issues with wagmi
const CantonDeFi = dynamic(
  () => import('@/components/defi/CantonDeFi'),
  { 
    ssr: false,
    loading: () => <DeFiLoadingSkeleton />
  }
);

export default function DeFiPage() {
  return (
    <Suspense fallback={<DeFiLoadingSkeleton />}>
      <CantonDeFi />
    </Suspense>
  );
}
```

**Create `/src/app/defi/layout.tsx`:**

```typescript
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Canton DeFi | Institutional DeFi Platform',
  description: 'Revolutionary institutional DeFi platform with Canton Network integration. Access real estate tokenization, AI portfolio optimization, and privacy-preserving vaults.',
  keywords: [
    'Canton DeFi',
    'Institutional DeFi', 
    'Real Estate Tokenization',
    'AI Portfolio',
    'Privacy Vaults',
    'DAML Smart Contracts',
    'Canton Network'
  ],
  openGraph: {
    title: 'Canton DeFi | Institutional DeFi Platform',
    description: 'Access institutional-grade DeFi products with Canton Network integration',
    type: 'website',
    url: 'https://1otc.cc/defi',
  },
};

export default function DeFiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
```

#### Step 11: Port Main CantonDeFi Component

**Create `/src/components/defi/CantonDeFi.tsx`:**

1. Copy from `/Users/Gyber/GYBERNATY-ECOSYSTEM/tech-hy-ecosystem/frontend/src/app/CantonDeFi.tsx`

2. Apply these modifications at the TOP:

```typescript
'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount, useChainId } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Decimal from 'decimal.js';

// Import from new locations
import { useCantonStore, useHydrateCantonStore } from '@/lib/canton/store/cantonStore';
import { useRealCantonNetwork } from '@/lib/canton/hooks/useCantonNetwork';
import { 
  formatDecimalCurrency, 
  formatDecimalPercentage,
  safeDecimalToNumber 
} from '@/lib/canton/utils/decimalFormatter';
import { cn } from '@/lib/utils';

// Import sub-components (create these too)
import CCPurchaseWidget from './CCPurchaseWidget';
import StablecoinSelector from './StablecoinSelector';
// ... etc
```

3. Replace ALL import paths
4. Add hydration check at component start:

```typescript
export default function CantonDeFi() {
  const hydrated = useHydrateCantonStore();
  
  // ... existing state and hooks
  
  // Add hydration guard
  if (!hydrated) {
    return <DeFiLoadingSkeleton />;
  }
  
  // ... rest of component
}
```

#### Step 12: Port CCPurchaseWidget

**Create `/src/components/defi/CCPurchaseWidget.tsx`:**

Copy from source with same adaptations.

#### Step 13: Port StablecoinSelector

**Create `/src/components/defi/StablecoinSelector.tsx`:**

Copy from source with same adaptations.

Also create `/src/lib/canton/config/stablecoins.ts`:

```typescript
// Copy from /Users/Gyber/GYBERNATY-ECOSYSTEM/tech-hy-ecosystem/frontend/src/entities/Canton/config/stablecoins.ts
```

---

### PHASE 5: Integration & Testing (Steps 14-16)

#### Step 14: Create Canton Module Index

**Create `/src/lib/canton/index.ts`:**

```typescript
// Store
export { useCantonStore, useHydrateCantonStore } from './store/cantonStore';

// Hooks
export { useRealCantonNetwork } from './hooks/useCantonNetwork';
export { useCantonPortfolio } from './hooks/useCantonPortfolio';
export { useCantonBridge } from './hooks/useCantonBridge';

// Services
export { CantonNetworkClient } from './services/cantonNetworkClient';
export { RealEstateService } from './services/realEstateService';
export { PrivacyVaultService } from './services/privacyVaultService';

// Utils
export * from './utils/decimalFormatter';
export * from './utils/errorHandler';

// Config
export { wagmiConfig, SUPPORTED_CHAINS } from './config/wagmi';
export { STABLECOINS, CC_PURCHASE_CONFIG, CANTON_BRIDGE_CONFIG } from './config/stablecoins';

// Types
export * from './types/canton.types';
```

#### Step 15: Add Environment Variables

**Add to `/Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/.env.local`:**

```bash
# ===========================================
# CANTON DEFI CONFIGURATION
# ===========================================

# Canton Network
NEXT_PUBLIC_CANTON_HOST=localhost
NEXT_PUBLIC_CANTON_PORT=7575
NEXT_PUBLIC_CANTON_PARTICIPANT_ID=canton_wealth_participant
NEXT_PUBLIC_CANTON_LEDGER_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_CANTON_WS_URL=ws://localhost:3001/ws
NEXT_PUBLIC_CANTON_ADMIN_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_CANTON_AUTH_TOKEN=demo_token_2025
NEXT_PUBLIC_CANTON_TLS=false
NEXT_PUBLIC_CANTON_DOMAIN_ID=canton_wealth_domain
NEXT_PUBLIC_CANTON_RPC_URL=https://rpc.canton.network

# WalletConnect (REQUIRED - get from https://cloud.walletconnect.com/)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here

# AI Services (optional)
NEXT_PUBLIC_GROK_API_KEY=
NEXT_PUBLIC_PUTER_API_KEY=

# Feature Flags
NEXT_PUBLIC_ENABLE_REAL_ESTATE=true
NEXT_PUBLIC_ENABLE_PRIVACY_VAULTS=true
NEXT_PUBLIC_ENABLE_AI_OPTIMIZER=true
NEXT_PUBLIC_ENABLE_BRIDGE=true
```

#### Step 16: Add Navigation Link

Find the navigation component in canton-otc and add DeFi link:

```typescript
// Find navigation in IntegratedLandingPage.tsx or similar
// Add this to the navigation items:
{
  name: 'DeFi',
  href: '/defi',
  icon: BanknotesIcon, // or similar
}
```

---

## 📋 COMPLETE FILE MAPPING TABLE

| Source Path | Target Path | Lines | Priority |
|-------------|-------------|-------|----------|
| `app/CantonDeFi.tsx` | `src/components/defi/CantonDeFi.tsx` | ~1189 | 🔴 Critical |
| `shared/store/cantonStore.ts` | `src/lib/canton/store/cantonStore.ts` | ~734 | 🔴 Critical |
| `entities/Canton/api/realCantonIntegration.ts` | `src/lib/canton/hooks/useCantonNetwork.ts` | ~1372 | 🔴 Critical |
| `entities/Canton/config/stablecoins.ts` | `src/lib/canton/config/stablecoins.ts` | ~105 | 🔴 Critical |
| `entities/Canton/config/realCantonConfig.ts` | `src/lib/canton/config/network.ts` | ~134 | 🟡 High |
| `entities/Canton/services/realEstateService.ts` | `src/lib/canton/services/realEstateService.ts` | ~1127 | 🟡 High |
| `entities/Canton/services/privacyVaultService.ts` | `src/lib/canton/services/privacyVaultService.ts` | ~1337 | 🟡 High |
| `entities/Canton/services/damlIntegrationService.ts` | `src/lib/canton/services/damlIntegration.ts` | - | 🟡 High |
| `entities/Canton/services/zkProofService.ts` | `src/lib/canton/services/zkProofService.ts` | - | 🟢 Medium |
| `entities/Canton/services/cantonBridgeService.ts` | `src/lib/canton/services/bridgeService.ts` | - | 🟢 Medium |
| `entities/AI/services/portfolioOptimizerGrok4.ts` | `src/lib/canton/services/ai/portfolioOptimizer.ts` | ~676 | 🟢 Medium |
| `entities/AI/services/grok4PortfolioService.ts` | `src/lib/canton/services/ai/grok4Service.ts` | - | 🟢 Medium |
| `shared/lib/decimalFormatter.ts` | `src/lib/canton/utils/decimalFormatter.ts` | ~165 | 🔴 Critical |
| `shared/lib/errorHandler.ts` | `src/lib/canton/utils/errorHandler.ts` | ~350 | 🔴 Critical |
| `widgets/CCPurchaseWidget/ui/CCPurchaseWidget.tsx` | `src/components/defi/CCPurchaseWidget.tsx` | - | 🟡 High |
| `entities/Canton/ui/StablecoinSelector.tsx` | `src/components/defi/StablecoinSelector.tsx` | - | 🟡 High |
| `entities/Canton/ui/MultiPartyAuthPanel.tsx` | `src/components/defi/MultiPartyAuthPanel.tsx` | - | 🟢 Medium |
| `entities/Canton/ui/MultiPartyDashboard.tsx` | `src/components/defi/MultiPartyDashboard.tsx` | - | 🟢 Medium |

---

## ✅ VALIDATION CHECKLIST

### Build & Lint
- [ ] `pnpm install` succeeds
- [ ] `pnpm lint` passes with no errors
- [ ] `pnpm build` completes successfully
- [ ] No TypeScript errors in IDE

### Route Testing
- [ ] `http://localhost:3000/defi` loads without 500/404
- [ ] No hydration mismatch errors in console
- [ ] Loading skeleton shows before main content
- [ ] Page renders all sections

### Wallet Integration
- [ ] RainbowKit ConnectButton renders
- [ ] Clicking "Connect Wallet" opens modal
- [ ] Can connect MetaMask/WalletConnect
- [ ] Address displays after connection
- [ ] Chain switching works

### UI Components
- [ ] Hero section renders with stats
- [ ] Products section shows institutional assets
- [ ] AI Features section renders
- [ ] Security section displays
- [ ] CC Purchase widget functions
- [ ] Stablecoin selector works
- [ ] Animations play smoothly

### Functionality
- [ ] Canton Network status indicator works
- [ ] Portfolio data loads (mock data OK for dev)
- [ ] Real Estate products display
- [ ] Privacy Vaults section works
- [ ] Investment flow initiates (to mock endpoint)

### Existing Routes
- [ ] `/` (landing) still works
- [ ] `/dex` still works
- [ ] `/admin` still works (if exists)
- [ ] Navigation between pages works

### Mobile Responsive
- [ ] 320px (mobile) - layout OK
- [ ] 768px (tablet) - layout OK
- [ ] 1024px (desktop) - layout OK
- [ ] 1920px (large) - layout OK

---

## 🐛 TROUBLESHOOTING GUIDE

### Error: "useAccount must be used within WagmiProvider"
**Cause:** Component using wagmi hooks is outside provider tree  
**Fix:** Ensure `WagmiProvider` wraps the entire app in `layout.tsx`

### Error: "Hydration failed because the initial UI does not match"
**Cause:** SSR rendered different content than client  
**Fix:** 
1. Add `'use client'` directive
2. Use `dynamic()` with `ssr: false`
3. Add mounted state check:
```typescript
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);
if (!mounted) return null;
```

### Error: "Cannot read properties of undefined (reading 'env')"
**Cause:** Using `import.meta.env` instead of `process.env`  
**Fix:** Replace all `import.meta.env.REACT_APP_*` with `process.env.NEXT_PUBLIC_*`

### Error: "Module not found: Can't resolve 'events'"
**Cause:** Node.js `events` module not available in browser  
**Fix:** `pnpm add events` (provides browser polyfill)

### Error: Zustand persist not working
**Cause:** SSR hydration issues  
**Fix:** Add `skipHydration: true` to persist config and call `rehydrate()` in useEffect

### Error: "Objects are not valid as a React child (found: Decimal)"
**Cause:** Rendering Decimal.js object directly  
**Fix:** Use `safeDecimalToString()` or `.toFixed()` before rendering

### Error: Animation stuttering
**Cause:** Heavy re-renders during animation  
**Fix:** 
1. Use `React.memo()` on child components
2. Use `useMemo()` for expensive calculations
3. Check for missing dependency arrays in useEffect

### Error: "NEXT_PUBLIC_* is undefined"
**Cause:** Env var not prefixed with NEXT_PUBLIC_ or not in .env.local  
**Fix:** 
1. Ensure variable starts with `NEXT_PUBLIC_`
2. Restart dev server after adding env vars
3. Check `.env.local` file exists and is readable

---

## 🔗 REFERENCE FILES TO READ FIRST

Before starting, read these files to understand the existing patterns:

### Canton-OTC (target project):
1. `/Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/app/layout.tsx`
2. `/Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/app/dex/page.tsx`
3. `/Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/components/dex/SwapInterface.tsx`
4. `/Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/package.json`
5. `/Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/tailwind.config.ts`
6. `/Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/lib/utils.ts`

### Tech-HY (source project):
1. `/Users/Gyber/GYBERNATY-ECOSYSTEM/tech-hy-ecosystem/frontend/src/app/CantonDeFi.tsx`
2. `/Users/Gyber/GYBERNATY-ECOSYSTEM/tech-hy-ecosystem/frontend/src/shared/store/cantonStore.ts`
3. `/Users/Gyber/GYBERNATY-ECOSYSTEM/tech-hy-ecosystem/frontend/src/entities/Canton/api/realCantonIntegration.ts`
4. `/Users/Gyber/GYBERNATY-ECOSYSTEM/tech-hy-ecosystem/frontend/src/entities/Canton/config/stablecoins.ts`
5. `/Users/Gyber/GYBERNATY-ECOSYSTEM/tech-hy-ecosystem/frontend/src/shared/lib/decimalFormatter.ts`

---

## 🎯 SUCCESS CRITERIA

Integration is **COMPLETE** when:

1. ✅ `https://1otc.cc/defi` loads without errors
2. ✅ All DeFi sections render (Hero, Products, AI, Security)
3. ✅ Wallet connection works via RainbowKit
4. ✅ No console errors in production build
5. ✅ Existing routes (`/`, `/dex`) unchanged
6. ✅ Mobile responsive design works
7. ✅ Build time < 2 minutes
8. ✅ Bundle size increase < 500KB

---

## 🚀 START COMMAND

```
1. READ existing canton-otc files first (layout.tsx, dex/page.tsx, package.json)
2. INSTALL dependencies
3. CREATE infrastructure (wagmi config, provider, directories)
4. PORT files in priority order (Critical → High → Medium)
5. TEST each component after porting
6. FIX any TypeScript/lint errors immediately
7. VERIFY full functionality before marking complete
```

**Git workflow:**
```bash
git checkout -b feature/canton-defi-integration
# Make changes
git add .
git commit -m "feat(defi): integrate CantonDeFi from tech-hy-ecosystem"
```

---

**Document Version:** 2.0  
**Last Updated:** 2026-01-19  
**Estimated Effort:** 20-30 hours  
**Confidence Level:** HIGH - All paths verified, all dependencies identified
