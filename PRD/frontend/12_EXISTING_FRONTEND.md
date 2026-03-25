# 12 — Existing Frontend State

## Technology Stack

| Package | Version | Role |
|---------|---------|------|
| next | 15.5.7 | App Router, RSC, API routes |
| react | 19.2.1 | UI framework |
| typescript | 5.x | Type safety |
| tailwindcss | 4.x | Styling |
| wagmi | 3.3.4 | EVM wallet connection |
| @rainbow-me/rainbowkit | latest | Wallet UI |
| viem | latest | Ethereum interaction |
| ethers | 6.15.0 | EVM utilities |
| @daml/ledger | 2.9.0 | DAML SDK integration |
| @daml/react | 2.9.0 | React hooks for DAML |
| zustand | 5.x | State management |
| framer-motion | latest | Animations |
| decimal.js | latest | Decimal arithmetic |
| snarkjs | latest | ZK proofs (imported, not fully used) |

## Application Structure

```
src/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Landing + 3-step exchange form
│   ├── order/[orderId]/page.tsx  # Order tracking
│   ├── admin/                    # Admin dashboard (5 pages)
│   ├── about/                    # Content pages
│   ├── how-it-works/
│   ├── faq/
│   ├── blog/
│   ├── dex/                      # PLACEHOLDER
│   ├── defi/                     # PARTIAL (treasury has API, no full UI)
│   └── api/                      # 15+ API routes
├── components/                   # React components
│   ├── ExchangeFormCompact.tsx   # Main trading form
│   ├── WalletDetailsForm.tsx     # Address + contact inputs
│   ├── OrderSummary.tsx          # Confirmation + API call
│   ├── TokenSelector.tsx         # Network/token dropdown
│   ├── IntegratedLandingPage.tsx # Hero + form composition
│   ├── admin/                    # Admin dashboard components
│   └── ui/                       # Shared UI primitives
├── lib/
│   ├── canton/services/          # Canton/DAML integration
│   │   ├── damlIntegrationService.ts    # Core DAML client
│   │   ├── CantonServiceManager.ts      # Singleton lifecycle
│   │   ├── cantonAuthService.ts         # JWT + EVM auth
│   │   ├── cantonBridgeService.ts       # Bridge integration
│   │   └── ...                          # Other services
│   └── services/                 # Business services
│       ├── antiSpamService.ts
│       ├── rateLimiter.ts
│       ├── monitoringService.ts
│       └── ...
├── config/
│   └── otc.ts                    # Token configs, prices, discounts
└── stores/                       # Zustand state stores
```

## Trading Flow (What Users See Today)

### Step 1: Exchange Form
- Select USDT network (Ethereum, BSC, TRON, Solana, Optimism)
- Enter payment amount in USDT
- See calculated CC amount at current price ($0.77 buy / $0.12 sell)
- Toggle buy/sell direction
- Optional: set manual price, enable private deal
- See service commission (1-3%)

### Step 2: Wallet Details
- Enter Canton address (receiving for buy, sending for sell)
- Enter receiving address (for sell — where to get USDT)
- Enter email (required), WhatsApp/Telegram (optional)
- Enter refund address (optional)

### Step 3: Order Summary
- Review all details
- Submit → POST /api/create-order
- Receive order ID and tracking link
- Redirect to /order/{orderId}

### Order Tracking (/order/{orderId})
- Real-time status: awaiting-deposit → awaiting-confirmation → exchanging → sending → completed
- Payment instructions (wallet addresses)
- Share link
- Contact support (Intercom)

## Canton Integration Points

### DamlIntegrationService (damlIntegrationService.ts)
```typescript
// Connects to Canton participant at http://65.108.15.30:30757
// Methods:
create<T>(templateId, payload)       // Create DAML contract
exercise<T,R>(contractId, choice, arg) // Exercise choice
query<T>(templateId, filter)           // Query ACS
streamQuery<T>(templateId, filter)     // Real-time stream

// Domain methods:
createInstitutionalAsset()
createPurchaseRequest()
approvePurchase()
distributeDividends()
getTreasuryBillTokens()
exercisePurchaseTokens()
```

### CantonAuthService (cantonAuthService.ts)
```typescript
// EVM signature → JWT → Canton Party
authenticateWithEVMSignature(address, signature, message)
allocateParty(partyHint)
getPartyInfo(partyId)
verifyToken(jwt)
generateAuthMessage(address)
```

## What's Missing (Gaps for Grant Work)

1. **No real-time orderbook UI** — current flow is request-based, not live
2. **No portfolio view** — users can't see their holdings/P&L
3. **No liquidity pool interface** — AMM not yet built
4. **No price chart** — no oracle visualization
5. **DEX page is empty** — layout placeholder only
6. **DeFi pages are stubs** — treasury has API but incomplete UI
7. **No CIP-0103 wallet integration** — uses custom auth, not standard
8. **No WebSocket streaming** — all data is polling-based
