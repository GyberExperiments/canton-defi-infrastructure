# 01 — Vision, Strategy & Architecture

## 1. Executive Summary

Canton DeFi Infrastructure Layer (CDIL) is an open-source suite of **reusable DeFi primitives** built natively on Canton Network using DAML smart contracts and a production-grade Rust SDK. It transforms the existing Canton OTC platform (https://1otc.cc) — already live and processing trades — into shared infrastructure that any Canton participant can integrate.

**What exists today:**
- 10 DAML templates (OTC trading, escrow, collateral, settlement, treasury bills)
- 14-crate Rust SDK with Ledger API v2 gRPC integration
- Production Next.js 15 application with live OTC trading
- Kubernetes deployment on dedicated infrastructure
- 6 test scenarios with Daml Script

**What this grant delivers:**
- 6 new DAML DeFi primitives (matching engine, liquidity pools, price oracle, atomic swaps, multi-party settlement, compliance gateway)
- Rust SDK published to crates.io as the first Rust Canton SDK
- OpenAPI 3.1 specification for all DeFi endpoints
- Reference DeFi dApp demonstrating all primitives
- Full CIP compliance (CIP-0056, CIP-0047, CIP-0082, CIP-0100, CIP-0103)

---

## 2. Strategic Positioning

### 2.1 Why DeFi Infrastructure, Not Just an App

Canton Network has 20+ grant proposals (Feb 2026). Analysis reveals:
- **4 bridge projects** (Asterizm, Cast, SVM, Multi-VM) — connect Canton to other chains
- **4 security projects** (Sherlock, Daml Security Framework, B-Method, CARA) — audit and verify
- **4 developer tools** (DAML LSP, Code Assistant, Smelt CI/CD, DevKit) — help developers build
- **3 wallet projects** (CC Bot, PartyLayer, Unified Canton Connect) — user access
- **2 RWA projects** (Zoniqx, DPMC) — institutional asset tokenization
- **0 DeFi infrastructure projects** — **this is our unique niche**

Every bridge needs something to bridge *to*. Every wallet needs something to *do*. Every RWA token needs somewhere to *trade*. We are that missing layer.

### 2.2 Ecosystem Synergies

```
Zoniqx RWA tokens ($25B pipeline)  ─┐
DPMC stablecoins                    ─┤
Asterizm bridge (Solana assets)     ─┼──→  Canton DeFi Infrastructure Layer
Cast bridge (any DAR assets)        ─┤     (OTC + Matching + Pools + Oracle)
CC Bot Wallet (950M Telegram users) ─┤
PartyLayer SDK (5 wallets)          ─┘
```

### 2.3 CIP Alignment

| CIP Standard | How We Comply |
|--------------|---------------|
| **CIP-0056** (Token Standard) | All DeFi primitives work with CIP-0056 tokens natively |
| **CIP-0047** (Activity Markers) | Trading activity emits CIP-0047 markers for Featured App tracking |
| **CIP-0082** (Governance) | Open-source governance model, Foundation can fork/maintain |
| **CIP-0100** (Transparency) | Public dashboards, on-chain verifiable metrics |
| **CIP-0103** (Wallet Standard) | SDK integrates with any CIP-0103 wallet |

---

## 3. Architecture

### 3.1 Layer Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    CONSUMER APPLICATIONS                     │
│  CC Bot Wallet │ PartyLayer │ Any CIP-0103 dApp │ 1otc.cc  │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────┐
│                   CANTON DeFi REST API v2                     │
│  POST /v2/orders  │  GET /v2/pools  │  GET /v2/oracle/price │
│  POST /v2/swap    │  POST /v2/settle │  WebSocket /v2/stream│
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────┐
│                     RUST SDK (crates.io)                      │
│  canton-sdk       │ canton-defi     │ canton-matching        │
│  canton-core      │ canton-oracle   │ canton-ledger-api      │
│  canton-transport │ canton-crypto   │ canton-reliability     │
└─────────────────────────┬───────────────────────────────────┘
                          │ gRPC (Ledger API v2)
┌─────────────────────────┴───────────────────────────────────┐
│                   DAML SMART CONTRACTS                        │
│  [EXISTING]                    [NEW]                         │
│  OtcOffer (277 LOC)            MatchingEngine                │
│  Escrow (357 LOC)              LiquidityPool                 │
│  Collateral (308 LOC)          PriceOracle                   │
│  Settlement (307 LOC)          AtomicSwap                    │
│  TreasuryBillToken             MultiPartySettlement           │
│  TreasuryBillHolding           ComplianceGateway             │
│  OtcTypes, Common.Types                                      │
│  Common.Compliance                                           │
│  YieldDistribution                                           │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────┐
│              CANTON NETWORK (Global Synchronizer)             │
│  Participant Node  │  Sequencer  │  Mediator                │
│  Sub-transaction privacy  │  Atomic multi-party workflows   │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Data Flow — Trade Lifecycle

```
1. PRICE DISCOVERY
   PriceOracle.daml receives price updates from authorized feeders
   → Stores (asset, price, timestamp, confidence) on-ledger
   → Any contract can query via nonconsuming choice

2. ORDER PLACEMENT
   User submits order via REST API or SDK
   → Rust SDK validates, builds DAML command
   → Creates OtcOffer contract (or MatchingEngine.Order)
   → Emits CIP-0047 activity marker

3. MATCHING
   MatchingEngine.daml attempts match:
   → Price-time priority (limit orders)
   → Pro-rata matching (RFQ/block trades)
   → If match found → creates AtomicSwap contract
   → If no match → order stays in book

4. SETTLEMENT
   AtomicSwap.daml executes:
   → Locks both sides via Escrow
   → Verifies Collateral sufficiency
   → Calls Settlement.daml for confirmation tracking
   → On N confirmations → releases funds atomically

5. POST-TRADE
   MultiPartySettlement.daml handles:
   → Netting across multiple trades
   → T+0 settlement finality (Canton advantage)
   → Compliance reporting via ComplianceGateway
```

### 3.3 Technology Stack

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| **Smart Contracts** | DAML | 2.9.3 | Canton-native, sub-transaction privacy |
| **SDK** | Rust | 1.77+ (2021 Edition) | Performance, safety, crates.io ecosystem |
| **gRPC** | Tonic + Prost | 0.13 | Best Rust gRPC stack, async-native |
| **HTTP** | Axum | 0.7 | Tokio-native, tower middleware |
| **Frontend** | Next.js + React | 15 + 19 | App Router, RSC, streaming |
| **Styling** | Tailwind CSS | 4.x | Utility-first, design system |
| **State** | Zustand | 5.x | Minimal, TypeScript-first |
| **Wallet** | Wagmi + RainbowKit | 3.x | Multi-chain EVM + Canton |
| **Database** | PostgreSQL (Supabase) | 15 | Optional — ledger is source of truth |
| **Cache** | Redis | 7.x | Rate limiting, session, pub/sub |
| **Container** | Docker | Multi-stage | Node 20-slim runtime |
| **Orchestration** | Kubernetes | 1.28+ | Auto-scaling, rolling updates |
| **CI/CD** | GitHub Actions | — | Build, test, deploy pipeline |
| **Monitoring** | Prometheus + Grafana + Loki | — | Metrics, dashboards, logs |
| **Crypto** | ed25519-dalek, p256, k256 | — | Canton key types + EVM |

### 3.4 Security Model

```
Authentication:
  CIP-0103 wallet → EVM signature → JWT → Canton Party → Ledger API

Authorization:
  DAML signatory/observer model enforces:
  - Only initiator+operator can create offers
  - Only authorized counterparty can accept
  - Only operator can settle
  - Only arbiter can arbitrate disputes
  - Self-trade prevention (initiator != acceptor)

Privacy:
  Canton sub-transaction privacy ensures:
  - Counterparties see only their side
  - Auditors see only what they're observers on
  - Oracle prices are public, trade details are private
  - Compliance checks happen without PII on-ledger

Transport:
  - mTLS between SDK and participant node
  - Bearer token authentication for Ledger API
  - HTTPS/TLS for REST API
  - Rate limiting per IP and per party
```

---

## 4. Competitive Advantages

| Advantage | Details |
|-----------|---------|
| **Already live** | https://1otc.cc processes real trades today |
| **Only Rust SDK** | No other Rust SDK for Canton exists (DevKit=#18 is CLI, Nexus=#15 is TypeScript) |
| **Only DeFi primitives** | No other grant builds reusable DeFi contracts |
| **Full vertical stack** | DAML → Rust SDK → REST API → Frontend — complete reference |
| **Production infrastructure** | K8s with monitoring, CI/CD, auto-scaling — not a prototype |
| **Institutional focus** | Compliance, escrow, collateral, multi-jurisdiction — what Canton FIs need |
| **Composable** | Each primitive (oracle, matching, pool) works independently or together |

---

## 5. Out of Scope

- Modifications to Canton protocol or Daml interpreter
- Building a centralized exchange (CEX)
- Fiat on/off ramp (regulated, separate entity)
- Mobile native applications (web-first, PWA later)
- Cross-chain bridge implementation (use Asterizm/Cast from other grants)
- Token issuance (use Zoniqx/CIP-0056 standard tokens)
