# 02 — Current State Audit

Complete inventory of everything that exists and works today.

---

## 1. DAML Smart Contracts

**Location:** `canton/daml/` (core OTC) + `daml/src/` (treasury/common)
**SDK:** DAML 2.9.3, LF 1.15
**Total:** 11 source files, 1,666 LOC (core OTC) + ~400 LOC (treasury)

### 1.1 Core OTC Templates

#### OtcTypes.daml (105 LOC)
```
Enums: OtcSide (Buy|Sell), OtcStatus (8 states), CollateralStatus (5 states)
Records: Asset (4 fields), Price (2), VolumeLimits (2), PartyInfo (3),
         Timestamps (3), SettlementInfo (4), CollateralInfo (4), AcceptResult (7)
Validators: ensureAsset, ensurePrice, ensureVolumeLimits
```

#### OtcOffer.daml (277 LOC)
```
Template: OtcOffer (17 fields)
Signatories: initiator, operator
Observers: counterparty (optional) + auditors
Key: (operator, offerId) — maintainer operator
Choices: Activate, Accept (→AcceptResult), Cancel, Expire, Settle, Dispute
Invariants: 10 ensure clauses (quantity, price, limits, self-trade, expiry)
```

#### Escrow.daml (357 LOC)
```
Template: Escrow (20 fields)
Signatories: operator
Observers: buyer, seller, arbiter, auditors
Key: (operator, escrowId) — maintainer operator
Choices: Deposit, Release, PartialRelease, Refund, Dispute,
         Arbitrate, ExecuteArbitration, CancelEscrow, ExtendDeadline, AutoExpire
Status: Created → Deposited → Released/Refunded/Disputed → Arbitrated
```

#### Collateral.daml (308 LOC)
```
Templates: Collateral (14 fields), ForfeitedCollateral (7 fields)
Signatories: owner+operator (Collateral), beneficiary+operator (Forfeited)
Key: (operator, collateralId) — maintainer operator
Choices: Lock, Release, Forfeit, Withdraw, TopUp, AutoRelease
Invariant: (currentAmount + lockedAmount) == initialAmount
```

#### Settlement.daml (307 LOC)
```
Template: Settlement (18 fields)
Signatories: operator
Observers: buyer, seller, auditors
Key: (operator, settlementId) — maintainer operator
Choices: ConfirmPayment, AddConfirmation, CompleteSettlement,
         DisputeSettlement, ResolveDispute, FailSettlement,
         ExtendDeadline, TimeoutSettlement
Invariant: totalAmount == quantity * price.rate
```

#### Test.daml (312 LOC)
```
6 test scenarios using Daml.Script:
1. testOfferLifecycle — full create→accept→verify
2. testPartialFill — 3/10 partial fill, verify remainder
3. testCancelOffer — create→cancel by initiator
4. testCollateralLifecycle — create→lock→release
5. testSelfTradePrevention — self-trade correctly fails
6. testOfferExpiry — create with expiry→expire after deadline
```

### 1.2 Treasury/Common Templates

#### Common.Types (daml/src/Common/Types.daml)
```
Enums: AssetClass (6), RiskRating (10, ordered), ComplianceLevel (4, ordered),
       KYCStatus (4, ordered), TxStatus (4), Jurisdiction (7)
Records: Money (2 fields), Address (5), DateRange (2)
```

#### Common.Compliance (daml/src/Common/Compliance.daml)
```
Record: ComplianceRecord (9 fields)
Functions: checkCompliance (validates KYC + level), checkJurisdiction
```

#### Treasury.TreasuryBillToken (daml/src/Treasury/TreasuryBillToken.daml)
```
Template: TreasuryBillToken (17 fields)
Signatories: issuer, custodian
Nonconsuming: PurchaseTokens (→TreasuryBillHolding), DistributeYield (→[YieldPayment]),
              RedeemAtMaturity (→RedemptionReceipt)
Consuming: UpdatePrice (→TreasuryBillToken)
```

#### Treasury.TreasuryBillHolding (daml/src/Treasury/TreasuryBillHolding.daml)
```
Template: TreasuryBillHolding (7 fields)
Choices: TransferHolding (partial/full), PartialRedeem
```

#### Treasury.YieldDistribution (daml/src/Treasury/YieldDistribution.daml)
```
Templates: YieldPayment, RedemptionReceipt, RedemptionRequest
Choices: ClaimYield (→YieldPayment with CONFIRMED)
```

---

## 2. Rust SDK

**Location:** `cantonnet-omnichain-sdk/`
**Edition:** Rust 2021, MSRV 1.77
**Total:** 14 crates, 70 .rs files, 6,894 LOC

### 2.1 Production-Ready Crates

#### canton-otc-api (crates/canton-otc-api/) — 1,884 LOC + 174 test LOC
```
Status: PRODUCTION-READY
Files: 11 source files
Server: Axum 0.7 HTTP on configurable port (default 8080)

Endpoints (15 total):
  GET  /health                    — ledger connectivity, offset, mode
  GET  /api/v1/contracts          — list with ?status=&initiator= filters
  POST /api/v1/contracts/offer    — create OtcOffer (17-field DAML record)
  GET  /api/v1/contracts/{id}     — single contract lookup
  POST /api/v1/contracts/accept   — exercise Accept choice
  POST /api/v1/contracts/cancel   — exercise Cancel choice
  GET  /api/v1/contracts/active   — ACS query (ledger fallback to in-memory)
  GET  /api/v1/settlements        — list settlements
  GET  /api/v1/settlements/{id}   — single settlement
  POST /api/v1/settlements/confirm   — exercise ConfirmPayment
  POST /api/v1/settlements/complete  — exercise CompleteSettlement
  POST /api/v1/escrow/create      — create Escrow (20-field DAML record)
  GET  /api/v1/escrow/{id}        — single escrow
  POST /api/v1/escrow/deposit     — exercise Deposit
  POST /api/v1/escrow/release     — exercise Release

Proto helpers: 15 builder functions (proto_text, proto_party, proto_numeric,
               proto_record, proto_variant, proto_optional_*, proto_list, etc.)

State: AppState with Arc<RwLock<Option<LedgerClient>>>, in-memory stores
Reconnect: Background loop every 15s with connect_with_auth()
Auth: Bearer token interceptor on gRPC calls
Tests: 33 tests covering proto builders, JSON conversion, config, models
```

#### canton-ledger-api (crates/canton-ledger-api/) — 235 LOC
```
Status: WORKING
LedgerClient: connect(), connect_with_auth(), get_ledger_end(),
              get_active_contracts() (streaming), submit()
AuthInterceptor: Bearer token injection into gRPC metadata
Proto: ~30 .proto files (full Ledger API v2)
Build: Conditional compilation via tonic-build (proto_compiled cfg)
Services compiled: CommandService, CommandSubmissionService,
                   CommandCompletionService, UpdateService, StateService,
                   PartyManagementService, PackageService, VersionService
```

#### canton-core (crates/canton-core/) — 800 LOC
```
Status: WORKING
SdkError: 12 variants (Connection, Authentication, Transaction, Validation,
          Config, Serialization, Crypto, Timeout, RateLimited, CircuitOpen,
          CrossChain, Internal)
Types: Identifier, DamlValue, Command (Create/Exercise/ExerciseByKey/CreateAndExercise),
       LedgerOffset, Event, Transaction, Filter
Config: CantonConfig, ConnectionConfig, SecurityConfig
Traits: LedgerService, CommandService, QueryService
```

#### bridge-core (crates/bridge-core/) — 630 LOC
```
Status: WORKING
TransferStatus: 14-state machine with can_transition_to() validation
BridgeTransfer: 20+ field model with SQLx postgres bindings
BridgeConfig: YAML-based configuration
Crypto: sha256_hex helper
```

#### bridge-db (crates/bridge-db/) — 500 LOC
```
Status: WORKING
TransferRepository: create, get_by_id, list_pending, update_status, list_by_status
SQLx: PostgreSQL async with connection pooling
```

#### canton-wallet (crates/canton-wallet/) — 415 LOC
```
Status: WORKING
MultiIdentityWallet: BIP-44 key derivation for Canton + EVM
DerivationStrategy: Slip0044, BIP44, Custom
Canton party ID generation from key fingerprints
```

### 2.2 Scaffolded Crates (structure ready, logic TODO)

```
bridge-orchestrator  — 800 LOC, worker loops are TODO stubs
bsc-client           — 450 LOC, awaits ethers contract abigen
bridge-api           — 80 LOC, endpoint stubs
canton-reliability   — 5 LOC, CircuitBreaker/RateLimiter/Retry TODO
canton-observability — 27 LOC, logging stub
canton-transport     — 27 LOC, gRPC abstraction stub
canton-crypto        — 80 LOC, key type stubs
```

### 2.3 Workspace Dependencies

```toml
# Async
tokio = "1.37"           # Full async runtime
futures = "0.3"          # Async primitives

# HTTP
axum = "0.7"             # HTTP framework
tower = "0.5"            # Middleware
tower-http = "0.6"       # CORS, tracing, compression

# gRPC
tonic = "0.13"           # gRPC framework
prost = "0.13"           # Protobuf codegen

# Blockchain
ethers = "2.0"           # BSC/EVM integration

# Database
sqlx = "0.7"             # PostgreSQL async
deadpool-redis = "0.18"  # Redis pooling

# Crypto
ed25519-dalek = "2.1"    # Canton key type
p256 = "0.13"            # NIST P-256
k256 = "0.13"            # secp256k1
sha2 = "0.10"            # SHA-256
ring = "0.17"            # TLS

# Observability
tracing = "0.1"          # Structured logging
opentelemetry = "0.22"   # Telemetry
prometheus-client = "0.22" # Metrics

# Resilience
governor = "0.7"         # Rate limiting
backon = "0.4"           # Retry
```

---

## 3. Frontend (Next.js 15 + React 19)

**Location:** `src/`
**Dependencies:** 50+ packages in package.json

### 3.1 Pages (App Router)

```
IMPLEMENTED:
  /                           — Landing + 3-step exchange form (buy/sell CC)
  /order/[orderId]            — Order tracking with status updates
  /admin                      — Dashboard (KPIs, recent orders)
  /admin/login                — Admin authentication
  /admin/orders               — Order management table
  /admin/customers            — Customer analytics
  /admin/settings             — Dynamic configuration
  /admin/logs                 — Activity logs
  /about, /how-it-works, /faq — Content pages
  /blog, /blog/[slug]         — Blog

PARTIALLY IMPLEMENTED:
  /defi/treasury              — Treasury Bills UI (API exists, UI incomplete)

PLACEHOLDER:
  /dex                        — DEX (layout only)
  /defi/privacy               — Privacy Vaults (placeholder)
  /defi/realestate            — Real Estate Tokenization (placeholder)
```

### 3.2 API Routes (15 implemented)

```
POST /api/create-order          — Main order creation (validates, creates DAML contract,
                                  stores in Supabase, notifies via Telegram/Intercom)
GET  /api/order/[orderId]       — Fetch order by ID
GET  /api/order-status/[orderId] — Status check
GET  /api/my-orders             — User's orders (email-based)
GET  /api/config                — System config (prices, limits)
POST /api/config/refresh        — Refresh config from ConfigMap
GET  /api/canton/status         — Canton participant health
GET  /api/daml/health           — DAML ledger health
GET  /api/health                — Service health check
GET  /api/metrics               — Prometheus metrics
POST /api/telegram-mediator/webhook — Telegram webhook
POST /api/intercom/webhook      — Intercom webhook
POST /api/intercom/ai-agent     — AI customer service
GET  /api/metrics/prometheus    — Prometheus format
POST /api/intercom/generate-jwt — Intercom JWT
```

### 3.3 Services

```
PRODUCTION:
  DamlIntegrationService    — DAML SDK 2.9.0 integration (create, exercise, query, stream)
  CantonServiceManager      — Singleton lifecycle management with lazy init + auto-cleanup
  CantonAuthService         — JWT via EVM signature verification, party allocation
  AntiSpamService           — Multi-layer fraud/spam detection
  RateLimiterService        — Per-IP and per-email rate limiting
  MonitoringService         — Prometheus metrics collection
  TelegramService           — Admin notifications
  IntercomService           — Customer messaging
  GoogleSheetsService       — Legacy order storage

PARTIAL:
  MarketPriceService        — Price feed integration (exists, not fully wired)
  IntercomAIAgent           — AI customer support (basic)
```

### 3.4 Trading Flow

```
Step 1: Token/Network Selection → Amount Input → Price Setting
Step 2: Canton Address → Receiving Address → Email/Contact
Step 3: Order Summary → POST /api/create-order → Order ID

Supported tokens: USDT on 5 networks (Ethereum, BSC, TRON, Solana, Optimism)
Buy price: $0.77/CC (from ConfigMap, dynamic)
Sell price: $0.12/CC (from ConfigMap, dynamic)
Commission: 1-3% (configurable)
Volume discounts: Bronze(5k)=+0.5%, Silver(25k)=+1%, Gold(50k)=+1.5%
Min order: $100 USDT (buy), 5 CC (sell)
```

---

## 4. Infrastructure

### 4.1 Production (65.108.15.30)

```
Kubernetes namespace: canton-otc
Deployment: 2 replicas, RollingUpdate (maxSurge=1, maxUnavailable=0)
Image: ghcr.io/themacroeconomicdao/cantonotc:main
Resources: 100-500m CPU, 256-512Mi RAM per pod
Health: liveness + readiness probes on /api/health
SSL: cert-manager + Let's Encrypt
Domain: https://1otc.cc

Canton Validator: Docker Nginx → Traefik Ingress → K8s Service
DevNet SNAT Fix: DaemonSet resolving 21 Canton domains every 60s
```

### 4.2 CI/CD (GitHub Actions)

```
deploy.yml:
  Trigger: push to main
  Steps: Checkout → Docker Build → Push GHCR → kubectl config →
         Secrets (50+ vars) → Update deployment → Rollout wait (180s) →
         Verify pods → Health check curl

build-canton-api-server.yml:
  Trigger: changes to crates/canton-otc-api/**
  Steps: Checkout → Buildx → Push ghcr.io/themacroeconomicdao/canton-api-server
```

### 4.3 Monitoring Stack

```
Prometheus + Grafana         — Metrics & dashboards
Loki                         — Log aggregation
Velero                       — Disaster recovery backups
Redis Sentinel               — HA cache
HPA + PDB                    — Auto-scaling + disruption budget
```

### 4.4 Local Development

```
docker-compose.local-test.yml:
  canton-sandbox (digitalasset/canton-open-source:2.7.9) → ports 5011, 5012
  daml-deploy (builds & uploads DARs)
  canton-otc-api (Rust server → port 8080)
```

---

## 5. Code Metrics Summary

| Component | Files | LOC | Status |
|-----------|-------|-----|--------|
| DAML Core OTC | 6 | 1,666 | Production |
| DAML Treasury/Common | 5 | ~400 | Working |
| Rust canton-otc-api | 11 | 2,058 | Production |
| Rust canton-ledger-api | 5 | 265 | Working |
| Rust canton-core | 13 | 800 | Working |
| Rust bridge-* | 18 | 2,010 | Partial |
| Rust other crates | 12 | 574 | Scaffolded |
| Proto files | ~30 | — | Complete |
| Next.js pages | 15+ | — | Production |
| Next.js API routes | 15 | — | Production |
| Next.js services | 10+ | — | Production |
| K8s manifests | 20+ | — | Production |
| GitHub workflows | 6 | — | Production |
| Scripts | 40+ | — | Production |
| Research docs | 10 | ~8,000 | Complete |
| **Total** | **200+** | **~16,000** | — |
