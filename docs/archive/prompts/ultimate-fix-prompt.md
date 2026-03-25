# Canton OTC Platform: Ultimate Audit, Fix & DevNet Deployment Prompt

> **Version**: 2.0 | **Date**: 2026-02-16 | **Scope**: Full-stack audit + fix + devnet deployment
> **Methodology**: Chain-of-Thought Decomposition + Structured Output + Self-Verification Gates

---

## META-INSTRUCTIONS (Prompt Engineering Framework)

<system>
You are a **composite expert team** embodying the following roles simultaneously:
- **Smart Contract Auditor** (Daml/Canton specialist, 10+ years formal verification)
- **Full-Stack Security Engineer** (OWASP Top 10, financial systems hardening)
- **DeFi Protocol Architect** (settlement systems, escrow, multi-party workflows)
- **DevOps/SRE Lead** (Kubernetes, Helm, Canton Network deployment)
- **Financial Systems Engineer** (fixed-income math, day-count conventions, decimal precision)

**Execution Protocol:**
1. Read each phase completely before writing any code
2. For each file: READ → ANALYZE → PLAN → IMPLEMENT → VERIFY
3. After each phase: run `pnpm build` and `pnpm test` — do NOT proceed if either fails
4. Use `<scratchpad>` mental model: think step-by-step before complex changes
5. When uncertain between two approaches, choose the one that **fails loudly** over the one that **fails silently**
6. Apply the **Principle of Least Surprise**: maintain existing API contracts, naming conventions, and code style

**Self-Verification Gates (mandatory checkpoints):**
- [ ] After Phase 1: `daml build` succeeds, all Daml tests pass
- [ ] After Phase 2: `pnpm build` succeeds, no TypeScript errors
- [ ] After Phase 3: All API routes respond correctly to curl tests
- [ ] After Phase 4: Integration services have persistence layer
- [ ] After Phase 5: Frontend hooks use real service connections
- [ ] After Phase 6: `pnpm test` >85% coverage on critical paths
- [ ] After Phase 7: `/api/health` returns accurate system status
- [ ] After Phase 8: Canton validator healthy, Ledger API responsive on devnet
</system>

---

# SECTION A: PROJECT CONTEXT & ARCHITECTURE

## A.1 What This Platform Is

Canton OTC is a **hybrid decentralized OTC trading platform** with two operational layers:

| Layer | Purpose | Tech |
|-------|---------|------|
| **Decentralized DeFi** | Trustless treasury bill trading, real estate tokenization, privacy vaults, multi-party workflows | Daml smart contracts on Canton Network |
| **Centralized Service** | Order creation, customer management, notifications, backup | Next.js 15 API + Supabase + Telegram/Intercom |

### Full Technology Stack

```
Frontend:     Next.js 15.5.7 (App Router) + React 19.2.1 + TypeScript 5.9.3 + Tailwind CSS 3.4.18
Backend:      Next.js API Routes (57 endpoints) + Supabase (PostgreSQL)
Contracts:    Daml 2.9.0 (5 contracts: OtcOffer, Settlement, Collateral, Escrow, OtcTypes)
Blockchain:   Canton Network + Ethereum + BSC + TRON + Solana + Optimism (USDT)
Rust SDK:     cantonnet-omnichain-sdk (12 crates)
Auth:         NextAuth 5.0.0-beta.25 + Supabase Auth + JWT
Crypto:       ethers 6.15, viem 2.44, wagmi 3.3, TronWeb 6.0, snarkjs 0.7
Caching:      ioredis 5.8.2 + redis 5.8.3 + lru-cache 11.2.2
Monitoring:   prom-client 15.1.0 (Prometheus metrics)
Testing:      Vitest 4.0.18 + Playwright 1.48 + @testing-library/react 16.3.2
Deployment:   Docker + Kubernetes (k3s) + Helm + GitHub Actions
```

## A.2 File Map (Critical Files Only)

### Smart Contracts
```
canton/daml/OtcTypes.daml        — Shared types (82 lines)
canton/daml/OtcOffer.daml        — Main OTC template (236 lines)
canton/daml/Settlement.daml      — Settlement lifecycle (271 lines)
canton/daml/Collateral.daml      — Collateral management (271 lines)
canton/daml/Escrow.daml          — Escrow with arbitration (296 lines)
```

### Core Services
```
src/lib/canton/services/damlIntegrationService.ts    — Daml SDK wrapper (MOCK FALLBACK RISK)
src/lib/canton/services/treasuryBillsService.ts      — Treasury bill CRUD + yield
src/lib/canton/services/complianceService.ts         — KYC/AML (ALL STUBS)
src/lib/canton/services/oracleService.ts             — Price feeds (ALL MOCK)
src/lib/canton/services/authService.ts               — Auth + sessions (IN-MEMORY)
src/lib/canton/services/privacyVaultService.ts       — Privacy vaults (STUB PROOFS)
src/lib/canton/services/realEstateService.ts         — Real estate (ALL MOCK)
src/lib/canton/services/cantonBridgeService.ts       — Cross-chain bridge (MOCK)
src/lib/canton/services/multiPartyWorkflowService.ts — Multi-party workflows
src/lib/canton/services/zkProofService.ts            — ZK proofs
```

### API Routes (Critical)
```
src/app/api/create-order/route.ts              — Main OTC order creation (~1000 lines)
src/app/api/order-status/[orderId]/route.ts    — Order status (NO AUTH)
src/app/api/defi/auth/login/route.ts           — Authentication
src/app/api/defi/treasury/purchases/route.ts   — Treasury purchases
src/app/api/health/route.ts                    — Health check (73 lines)
```

### Frontend Hooks
```
src/lib/canton/hooks/useCantonPortfolio.ts               — Hardcoded 125.80 rate
src/lib/canton/hooks/usePrivacyVaults.ts                 — Stub proof generation
src/lib/canton/hooks/useTreasuryBills.ts                 — No yield accrual
src/lib/canton/hooks/useCantonBridge.ts                  — Hardcoded 0.1% fee
src/lib/canton/hooks/useCantonNetwork.ts                 — All RPC calls fail
src/lib/canton/hooks/realCantonIntegration.ts            — Returns mock data (1500+ lines)
src/lib/canton/hooks/useMultiPartyWorkflowService.ts     — No rejection flow
```

### Integration Services
```
src/lib/services/rateLimiter.ts                — In-memory rate limiting
src/lib/monitoring/exchange-rate-monitor.ts     — No circuit breaker
src/lib/services/cantonValidation.ts            — No checksum validation
src/config/otc.ts                               — Hardcoded prices, addresses
```

### Deployment
```
Dockerfile                                              — Multi-stage production build
docker-compose.local.example.yml                        — Local dev setup
blockchain/config/canton.conf                           — Canton node config
blockchain/config/validator.conf                        — Validator config
blockchain/config/docker-compose.canton-validator.yml    — Validator Docker Compose
blockchain/k8s/helm-devnet/*.yaml                       — Helm values for devnet
blockchain/scripts/*.sh                                 — Deployment scripts
config/kubernetes/k8s/                                  — K8s manifests
```

---

## A.3 Vulnerability Registry (149 findings, deduplicated & prioritized)

### P0 — CRITICAL: Production Blockers (15 findings)

| ID | Finding | File | Lines | Impact |
|----|---------|------|-------|--------|
| P0-01 | Mock ledger fallback in production — silently creates fake contracts | `damlIntegrationService.ts` | 72-97, 313-379 | Fund loss: orders confirmed against non-existent ledger |
| P0-02 | All oracle prices are hardcoded mock data (BTC=95000, ETH=3500) | `oracleService.ts` | 398-461 | Incorrect pricing for all calculations |
| P0-03 | All Canton Network endpoints disabled, returns mock portfolios ($75K fake) | `realCantonIntegration.ts` | 200-250, 400-500 | Users see fabricated balances |
| P0-04 | Privacy vault proof generation stubbed — `generateProof()` returns null | `privacyVaultService.ts` | 540-588 | Privacy features non-functional |
| P0-05 | Encryption is base64, not real encryption | `privacyVaultService.ts` | 880-883 | No actual privacy |
| P0-06 | Compliance KYC/AML always returns "pass" — `isMixerAddress()` returns false | `complianceService.ts` | 199-338 | No regulatory screening |
| P0-07 | Bridge transactions don't execute — `executeLayerZeroBridge()` returns fake hash | `cantonBridgeService.ts` | 263-292 | Funds not actually bridged |
| P0-08 | Bridge rollback unimplemented — failed bridges never refund | `cantonBridgeService.ts` | 214-244 | Fund loss on bridge failure |
| P0-09 | Signature verification always returns true | `multiPartyWorkflowService.ts` | 637-639 | Any party can forge signatures |
| P0-10 | Settlement.daml `ResolveDispute` logic INVERTED: `status /= Disputed` | `Settlement.daml` | 191-196 | Can only resolve non-disputes |
| P0-11 | Escrow.daml `Arbitrate` logic INVERTED: `status /= Disputed` | `Escrow.daml` | 190-200 | Arbitration impossible when needed |
| P0-12 | Escrow.daml `ExecuteArbitration` logic INVERTED + `favorBuyer` param unused | `Escrow.daml` | 207-220 | Arbitration decisions not enacted |
| P0-13 | Collateral `Forfeit` doesn't transfer to beneficiary — funds vanish | `Collateral.daml` | 156-178 | Complete loss of forfeited collateral |
| P0-14 | `Withdraw` on Collateral violates invariant — contract breaks after withdraw | `Collateral.daml` | 71-72, 179-192 | Contract creation failure post-withdraw |
| P0-15 | No authentication on order-status endpoint — PII exposed | `order-status/[orderId]/route.ts` | 40-50 | Anyone can query any order data |

### P1 — URGENT: Security & Financial Risk (22 findings)

| ID | Finding | File | Lines | Impact |
|----|---------|------|-------|--------|
| P1-01 | 0.5% exchange rate tolerance exploitable (~$50 per $10K order) | `create-order/route.ts` | 380-420 | Systematic financial extraction |
| P1-02 | No idempotency key — duplicate submit creates duplicate orders | `create-order/route.ts` | 800-850 | Duplicate orders |
| P1-03 | Exchange direction client-controlled — attacker sends opposite direction | `create-order/route.ts` | 440-480 | Price manipulation |
| P1-04 | `Number` type used for financial calculations instead of `Decimal` | `create-order/route.ts` | various | Precision loss >15 digits |
| P1-05 | No CORS/CSRF protection on state-changing routes | `create-order/route.ts` | 156-170 | Cross-site request forgery |
| P1-06 | Admin API key compared in plain text (timing attack) | `order-status/route.ts` | 900-920 | Key extraction via timing |
| P1-07 | MFA never actually verified — `mfaCode` is optional | `authService.ts` | 65-110 | Authentication bypass |
| P1-08 | Password reset without token validation | `authService.ts` | 190-219 | Account takeover |
| P1-09 | No rate limiting on login — brute force possible | `authService.ts` + `login/route.ts` | throughout | Credential stuffing |
| P1-10 | Session tokens in-memory Map — lost on restart | `authService.ts` | 249-263 | Session invalidation on deploy |
| P1-11 | Rate limiter in-memory only — bypass by hitting different K8s pod | `rateLimiter.ts` | 40-80 | 3x rate limit per pod instance |
| P1-12 | Dividend calculation uses `/365` — ignores leap years | `treasuryBillsService.ts` | 340-375 | Yield miscalculation over time |
| P1-13 | Treasury purchase race condition — concurrent check-then-create | `treasuryBillsService.ts` | 215-260 | Double-spend on supply |
| P1-14 | `Math.random()` for ID generation — not cryptographically secure | `treasuryBillsService.ts` | 377-391 | Predictable/collision-prone IDs |
| P1-15 | Exchange rate monitor has no circuit breaker — trading continues during manipulation | `exchange-rate-monitor.ts` | throughout | No protection against rate attacks |
| P1-16 | OtcOffer allows self-trade (initiator == acceptor) | `OtcOffer.daml` | 109-113 | Market manipulation |
| P1-17 | No settlement timeout — payment pending indefinitely | `Settlement.daml` | throughout | Indefinite fund lock |
| P1-18 | Buyer self-confirms own payment — no independent verification | `Settlement.daml` | 89-101 | Payment fraud |
| P1-19 | Partial fill creates offer with wrong settlementInfo | `OtcOffer.daml` | 185-195 | Data corruption on partial fills |
| P1-20 | Collateral `AutoRelease` uses `>` instead of `>=` | `Collateral.daml` | 216-232 | Off-by-one on expiry |
| P1-21 | No order expiration — `awaiting-deposit` orders never auto-cancel | `create-order/route.ts` | throughout | Zombie orders accumulate |
| P1-22 | Treasury purchases endpoint has no authentication | `defi/treasury/purchases/route.ts` | 75-130 | Anyone can create purchases |

### P2 — IMPORTANT: Architecture & Reliability (18 findings)

| ID | Finding | File | Impact |
|----|---------|------|--------|
| P2-01 | Supabase connection test on every order | `create-order/route.ts` | 2x DB calls per order |
| P2-02 | Google Sheets async save can fail silently | `create-order/route.ts` | Data inconsistency |
| P2-03 | Audit log stored in-memory, never cleaned up | `complianceService.ts` | Memory leak |
| P2-04 | Oracle returns `price: '0'` on provider failure | `oracleService.ts` | Zero-price calculations |
| P2-05 | Escrow has no partial release mechanism | `Escrow.daml` | Inflexible escrow |
| P2-06 | Multi-party workflow has no rejection — only approve or stall | `multiPartyWorkflowService.ts` | Workflow deadlock |
| P2-07 | Notification service is console.log only | `multiPartyWorkflowService.ts` | Parties never notified |
| P2-08 | Bridge request expiry never enforced | `cantonBridgeService.ts` | Expired requests execute |
| P2-09 | Real estate service uses all mock integrations | `realEstateService.ts` | Non-functional feature |
| P2-10 | `usePrivacyVaults` creates new service instances on every render | `usePrivacyVaults.ts` | Memory leak |
| P2-11 | `useCantonBridge` has no nonce/replay protection | `useCantonBridge.ts` | Bridge replay attacks |
| P2-12 | Canton address validation has no checksum | `cantonValidation.ts` | Address typo risk |
| P2-13 | Refund address accepts wrong network format | `cantonValidation.ts` | Funds sent to wrong chain |
| P2-14 | Hardcoded receiving addresses in git-tracked config | `otc.ts` | Secret exposure risk |
| P2-15 | Sync/async price getter mismatch | `otc.ts` | Different prices in different routes |
| P2-16 | `OtcTypes.daml` `CollateralInfo.status` is Text, not enum | `OtcTypes.daml` | Typo-prone status values |
| P2-17 | OtcOffer volume limits violated after partial fill | `OtcOffer.daml` | Invalid offer state |
| P2-18 | ExtendDeadline has no max extension limit | `Settlement.daml`, `Escrow.daml` | Indefinite extensions |

### P3 — IMPROVEMENT (12 findings)

| ID | Finding | File | Impact |
|----|---------|------|--------|
| P3-01 | Hardcoded 125.80 conversion rate | `useCantonPortfolio.ts` | Incorrect portfolio value |
| P3-02 | Treasury yield only calculated at purchase time | `useTreasuryBills.ts` | Inaccurate yield display |
| P3-03 | Bridge fee hardcoded at 0.1% | `useCantonBridge.ts` | Static fees |
| P3-04 | `$1` minimum order amount too low | `otc.ts` | High fraud-per-transaction risk |
| P3-05 | Auto-execute after 5s delay — no final review | `multiPartyWorkflowService.ts` | Human error risk |
| P3-06 | Discount tiers hardcoded — require redeploy to change | `otc.ts` | Business inflexibility |
| P3-07 | Historical price data generated randomly each call | `oracleService.ts` | Non-deterministic |
| P3-08 | Weak email validation regex | `create-order/route.ts` | Accepts invalid emails |
| P3-09 | Error messages expose DB schema | `create-order/route.ts` | Information disclosure |
| P3-10 | No health check for Canton validator connectivity | `health/route.ts` | Incomplete health report |
| P3-11 | No DevNet onboarding secret auto-rotation | `blockchain/` | Validator stops after 1 hour |
| P3-12 | No Prometheus/Grafana deployed | `blockchain/` | No operational monitoring |

---

# SECTION B: EXECUTION PLAN (Self-Contained)

<role>
You are a senior full-stack blockchain engineer specializing in Daml smart contracts, TypeScript/Node.js, React, and enterprise OTC trading platforms. You have deep expertise in financial security, compliance (KYC/AML), smart contract auditing, and Canton Network deployment.
</role>

<objective>
Fix ALL P0 and P1 vulnerabilities, address P2 issues, implement P3 improvements where feasible, and deploy the platform to DevNet on our node (IP: 65.108.15.30). Every fix must preserve backward compatibility with existing API contracts.
</objective>

<constraints>
- Do NOT break existing API request/response formats
- Do NOT add npm dependencies unless absolutely necessary (prefer built-in Node.js APIs)
- Do NOT modify K8s manifests unless a service change requires it
- Use `Decimal` (from decimal.js, already installed) for ALL financial calculations
- Use `crypto.randomUUID()` for ALL ID generation (replace Math.random)
- Follow existing code style: TypeScript strict mode, ESLint + Prettier
- Fail LOUDLY in production, fail GRACEFULLY in development
- Every mock/stub must be explicitly marked and report its status via `/api/health`
</constraints>

---

## Phase 1: Smart Contract Hardening (Daml)

**Scope**: `canton/daml/*.daml`
**Goal**: Fix all logic inversions, add missing guards, implement timeouts

### 1.1 OtcTypes.daml — Type Safety

```
TASK: Add validation constraints and missing enum values

CHANGES:
1. Add `Rejected` to OtcStatus enum
2. Add CollateralStatus enum: Available | Locked | Released | Forfeited | Liquidated
   — Replace Text-based status in CollateralInfo with this enum
3. Add ensure constraints:
   — Asset: amount >= 0.0
   — Price: rate > 0.0
   — VolumeLimits: minAmount > 0.0, maxAmount > 0.0, minAmount <= maxAmount
4. Remove unused fields (signature, publicKey in PartyInfo) OR add actual verification logic
5. Add AcceptResult.slippageBps : Int field for price deviation tracking
```

### 1.2 OtcOffer.daml — Critical Guards

```
TASK: Fix self-trade, partial fill, and state transition bugs

CHANGES:
1. Add `ensure initiator /= fromSome "No counterparty" counterparty` when counterparty is Some
2. Add in Accept choice (line ~109):
   — `assertMsg "Cannot trade with yourself" (acceptor /= initiator)`
   — Move designated counterparty check to TOP of validation
   — Only allow Accept when status == Active (not Pending)
3. Fix partial fill (line ~185-195):
   — Do NOT copy settlementInfo to reduced offer
   — Recalculate volume limits for remaining quantity:
     let newMaxAmount = min limits.maxAmount remainingQuantity
     let newLimits = limits with { maxAmount = newMaxAmount }
4. Fix trade ID generation:
   — Use offerId <> "-" <> partyToText acceptor <> "-" <> show currentTime
5. Add self-trade prevention in ensure block:
   — initiator /= fromSome initiator counterparty
6. Add explicit state machine:
   — Pending → Active (operator activates)
   — Active → PartiallyFilled | Filled (Accept)
   — Active → Cancelled (Cancel)
   — Active | Pending → Expired (Expire)
   — Any except Filled → Disputed (Dispute)
```

### 1.3 Settlement.daml — Fix Inversions & Add Timeout

```
TASK: Fix ResolveDispute inversion, add settlement timeout, fix buyer self-confirmation

CHANGES:
1. FIX CRITICAL BUG (line ~194):
   — BEFORE: assertMsg "Settlement not in disputed status" (status /= Disputed)
   — AFTER:  assertMsg "Settlement must be in disputed status" (status == Disputed)

2. Add settlement timeout mechanism:
   — In ConfirmPayment: assertMsg "Settlement deadline passed" (currentTime <= deadline)
   — Add new choice `TimeoutSettlement`:
     controller operator can
       TimeoutSettlement : ContractId Settlement
         do
           currentTime <- getTime
           assertMsg "Deadline not yet passed" (currentTime > deadline)
           assertMsg "Not in pending state" (status == Pending || status == PaymentReceived)
           create this with status = Failed, completedAt = Some currentTime

3. Fix buyer self-confirmation (line ~89-101):
   — Add paymentTxHash validation (non-empty, reasonable length)
   — Add comment: "// TODO: Add oracle-based on-chain payment verification"
   — Store both original proof and confirmation proof

4. Add maximum extension limit in ExtendDeadline:
   — assertMsg "Max 3 extensions" (extensionCount < 3)
   — Add extensionCount : Int field to template

5. Fix FailSettlement: require mutual agreement OR dispute timeout, not just operator
```

### 1.4 Collateral.daml — Fix Invariant & Forfeit

```
TASK: Fix withdraw invariant violation, implement forfeit beneficiary transfer

CHANGES:
1. FIX CRITICAL INVARIANT BUG:
   — Problem: After Withdraw, (currentAmount + lockedAmount) != initialAmount
   — Fix Withdraw choice: update initialAmount = initialAmount - amount (already done)
   — ALSO: verify invariant holds: assertMsg "Invariant maintained" ((currentAmount - amount + lockedAmount) == (initialAmount - amount))

2. FIX FORFEIT (line ~156-178):
   — BEFORE: Just archives self (beneficiary receives nothing)
   — AFTER: Create a new ForfeitedCollateral contract owned by toBeneficiary:
     template ForfeitedCollateral with
       beneficiary : Party
       asset : Asset
       amount : Decimal
       sourceCollateralId : Text
       forfeitedAt : Time
     where
       signatory beneficiary
       observer []
   — In Forfeit choice: archive self, then create ForfeitedCollateral for toBeneficiary

3. Fix AutoRelease timing:
   — BEFORE: currentTime > expiry (strictly greater)
   — AFTER: currentTime >= expiry (allow exact match)

4. Add lock duration bounds:
   — assertMsg "Lock duration must be positive" (lockDuration > hours 0)
   — assertMsg "Lock duration max 365 days" (lockDuration <= days 365)

5. Fix TopUp: add deposit proof parameter (txHash : Text)
```

### 1.5 Escrow.daml — Fix All Inversions

```
TASK: Fix 3 inverted assertions, implement arbitration logic

CHANGES:
1. FIX Arbitrate (line ~197):
   — BEFORE: assertMsg "Escrow not in disputed status" (status /= Disputed)
   — AFTER:  assertMsg "Escrow must be in disputed status" (status == Disputed)

2. FIX ExecuteArbitration (line ~211):
   — BEFORE: assertMsg "Escrow not arbitrated" (status /= Arbitrated)
   — AFTER:  assertMsg "Escrow must be arbitrated" (status == Arbitrated)

3. IMPLEMENT favorBuyer logic in Arbitrate:
   — Currently favorBuyer : Bool is unused
   — After: Store arbiterDecision = if favorBuyer then "REFUND" else "RELEASE"
   — In ExecuteArbitration: Use decision to determine fund destination:
     if arbiterDecision == "REFUND"
       then create this with status = Refunded, ...
       else create this with status = Released, ...

4. FIX AutoExpire (line ~272):
   — BEFORE: status /= Deposited (can only auto-expire when NOT deposited)
   — AFTER:  status == Deposited || status == Created
   — Logic: Auto-expire only active (Created or Deposited) escrows past deadline

5. Add partial release mechanism:
   — New choice PartialRelease with releaseAmount : Decimal
   — assertMsg "Amount within bounds" (releaseAmount > 0.0 && releaseAmount <= depositedAmount)
   — Create new escrow with reduced depositedAmount

6. Add maximum deadline extension (max 30 days total extension):
   — Add extensionCount : Int, maxExtensions : Int to template
```

### 1.6 Daml Tests

```
TASK: Write comprehensive Daml scenario tests

CREATE: canton/daml/tests/OtcTests.daml

TEST CASES:
1. Happy path: Create offer → Accept → Confirm payment → Complete settlement
2. Partial fill: Accept 50% → Verify remaining offer has correct limits
3. Self-trade prevention: Attempt self-trade → Assert failure
4. Settlement timeout: Create settlement → Wait past deadline → TimeoutSettlement
5. Escrow arbitration: Deposit → Dispute → Arbitrate (favorBuyer=True) → Execute → Verify refund
6. Escrow arbitration: Deposit → Dispute → Arbitrate (favorBuyer=False) → Execute → Verify release
7. Collateral forfeit: Lock → Forfeit → Verify ForfeitedCollateral created for beneficiary
8. Collateral withdraw: Lock partial → Withdraw → Verify invariant holds
9. ResolveDispute: Create disputed settlement → Resolve → Verify status transition
10. Double-accept prevention: Accept offer → Try accept again → Assert failure
```

---

## Phase 2: Backend Service Critical Fixes

**Scope**: `src/lib/canton/services/*.ts`
**Gate**: `pnpm build` must succeed after this phase

### 2.1 DamlIntegrationService.ts — Eliminate Silent Mock

```
TASK: Production MUST fail if mock is used. Development uses mock with clear warnings.

CHANGES:
1. Replace mock fallback logic (lines 72-97):

   const isProduction = process.env.NODE_ENV === 'production';

   try {
     const { Ledger } = await import('@daml/ledger');
     // ... real ledger setup
     console.log('[DAML] ✅ Connected to REAL Canton Ledger');
   } catch (error) {
     if (isProduction) {
       throw new Error(
         '[DAML] FATAL: @daml/ledger not available in PRODUCTION. ' +
         'Install Daml SDK or set DAML_ALLOW_MOCK=true (NOT recommended).'
       );
     }
     console.warn('[DAML] ⚠️ DEVELOPMENT MODE: Using MOCK Ledger');
     this.ledger = this.createMockLedger();
     this.isMock = true;  // Add this field to class
   }

2. Add `isMock: boolean` field to class, default false
3. Add `getStatus()` method returning { mode: 'REAL' | 'MOCK', contractCount, cacheSize }
4. Add cache TTL: all Map entries expire after 5 minutes (use lru-cache from dependencies)
5. Replace Math.random() ID generation with crypto.randomUUID()
6. Add command deduplication: Map<commandId, timestamp> to prevent retry double-execution
```

### 2.2 TreasuryBillsService.ts — Financial Precision

```
TASK: Fix yield calculations, race conditions, and ID generation

CHANGES:
1. Replace ALL Number-based financial math with Decimal:
   — import Decimal from 'decimal.js';
   — All yield, price, amount calculations use new Decimal(value)

2. Fix dividend calculation (line ~340-375):
   — BEFORE: yieldRate / 365
   — AFTER:
     const isLeapYear = (year: number) => (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
     const daysInYear = isLeapYear(new Date().getFullYear()) ? 366 : 365;
     const dailyRate = new Decimal(yieldRate).div(daysInYear);
     const accruedYield = dailyRate.mul(daysHeld).mul(faceValue);

3. Fix race condition in purchase approval (lines 215-260):
   — Add Supabase-level optimistic locking:
     const { data, error } = await supabase
       .from('treasury_bills')
       .update({ available_supply: bill.availableSupply - amount })
       .eq('id', bill.id)
       .eq('available_supply', bill.availableSupply)  // Optimistic lock
       .select();
     if (!data?.length) throw new Error('Supply changed, retry');

4. Replace all ID generation:
   — BEFORE: Date.now() + Math.random().toString(36)
   — AFTER:  crypto.randomUUID()

5. Add per-period yield distribution tracking to prevent double-distribution
```

### 2.3 ComplianceService.ts — Mark Stubs, Prepare Real Integration

```
TASK: Make stub status explicit, structure for real provider integration

CHANGES:
1. Add ProviderStatus type: { name: string, status: 'STUB' | 'LIVE', lastCheck: Date }
2. Add getProviderStatuses() method returning all provider statuses
3. Mark every stub method with:
   // TODO [P0]: Replace with real {ProviderName} integration
   // Current: Always returns {value} (no screening)
   // Provider: Chainalysis (AML), SumSub (KYC), WorldCheck (sanctions)
   console.warn(`[COMPLIANCE] STUB: ${methodName} - no real screening`);

4. Add audit log cleanup: implement retention based on auditLogRetentionDays config
5. Add concurrent verification lock using Map<string, Promise>
6. Add health check method for `/api/health` integration
```

### 2.4 OracleService.ts — Mark Mock, Add Staleness Detection

```
TASK: Make mock prices explicit, add staleness warnings, fix zero-price fallback

CHANGES:
1. Fix zero-price fallback (line ~181-189):
   — BEFORE: returns { price: '0', confidence: 0 }
   — AFTER:  throw new Error(`All price providers failed for ${symbol}`);
   — Add circuit breaker: if >3 provider failures in 5 minutes, flag in health check

2. Add staleness detection:
   — Crypto prices: warn if >60 seconds old
   — Treasury yields: warn if >1 hour old
   — Log level: WARN in dev, ERROR in production

3. Mark all mock methods:
   console.warn(`[ORACLE] MOCK DATA: ${methodName} returning hardcoded value`);

4. Add getDataSourceStatus() returning Map<provider, { status, lastUpdate, isStale }>

5. Fix cache: remove expired entries on access (not just check expiry)
```

### 2.5 AuthService.ts — Session Persistence & Security

```
TASK: Fix session storage, add security controls

CHANGES:
1. Move sessions to Supabase:
   — Create table: auth_sessions (id, user_id, token, expires_at, created_at, ip_address)
   — Replace in-memory Map with Supabase queries
   — Add session cleanup: DELETE WHERE expires_at < NOW()

2. Add login rate limiting:
   — Track failed attempts per email in Supabase: auth_failed_attempts (email, count, locked_until)
   — After 5 failures: lock for 15 minutes
   — Return generic error: "Invalid credentials" (don't reveal if email exists)

3. Fix MFA:
   — If user.mfaEnabled, REQUIRE mfaCode (throw if missing)
   — Validate TOTP code against user's secret

4. Fix password reset:
   — Generate time-limited reset token (1 hour)
   — Store in Supabase: password_resets (email, token_hash, expires_at)
   — Validate token before allowing password change

5. Add constant-time comparison for all secret comparisons:
   import { timingSafeEqual } from 'crypto';
```

### 2.6 PrivacyVaultService.ts — Honest Stub Implementation

```
TASK: Make stubs fail explicitly, fix memory leaks

CHANGES:
1. Replace base64 "encryption" with clear error:
   — In production: throw new Error('Encryption service not configured. Set ENCRYPTION_KEY env var.');
   — In development: log warning, use AES-256-GCM with a dev key

2. Fix `generateBalanceProof()` to return explicit error:
   — Return { success: false, error: 'ZK proof generation not configured' }
   — Instead of returning null/fake proof

3. Fix `validateDepositPermissions()`:
   — Add basic permission check: verify vault.owner === depositor
   — Log warning about stub implementation

4. Add null checks before all `.get()` calls on Maps

5. Wrap service instantiation in singleton pattern to prevent memory leaks
```

### 2.7 CantonBridgeService.ts — Safe Stub

```
TASK: Make bridge non-functional safely (don't pretend to work)

CHANGES:
1. In production mode, ALL bridge operations should:
   — Return { success: false, error: 'Bridge service not configured for production' }
   — Instead of returning fake transaction hashes

2. In development mode:
   — Log clear warning: "MOCK BRIDGE: No real funds transferred"
   — Return mock data with `isMock: true` flag

3. Add bridge status endpoint for health check:
   — { status: 'MOCK' | 'LIVE', supportedChains: [...], lastHealthCheck: Date }
```

### 2.8 MultiPartyWorkflowService.ts — Security Fixes

```
TASK: Fix signature verification, add rejection flow

CHANGES:
1. Replace stub signature verification (line ~637-639):
   — Import crypto verification library
   — Verify Ed25519 or ECDSA signatures
   — If crypto verification not yet implemented, REJECT all signatures with clear error

2. Add rejection flow:
   — New method: rejectTransaction(txId, partyId, reason)
   — Transitions workflow to "Rejected" status
   — Notifies all parties

3. Add authorization level checking:
   — Verify party's approval limit >= transaction amount
   — Reject with clear error if insufficient authorization

4. Replace console.log notifications with actual service call:
   — If Telegram configured: send via Telegram
   — If not: store in notification queue table in Supabase
```

---

## Phase 3: API Route Security

**Scope**: `src/app/api/**/*.ts`
**Gate**: All routes respond correctly to manual curl tests

### 3.1 create-order — Core Hardening

```
TASK: Fix tolerance, add idempotency, remove connection test overhead

CHANGES:
1. Reduce tolerance from 0.5% to 0.1%:
   — OR better: compute cantonAmount server-side, ignore client value
   — const serverCantonAmount = new Decimal(usdtAmount).div(await getCantonCoinBuyPrice());
   — Use server-computed value, log if client value differs by >0.1%

2. Add idempotency key:
   — Accept X-Idempotency-Key header
   — Store in Supabase: idempotency_keys (key, response_json, created_at)
   — If duplicate key within 24 hours, return cached response
   — CREATE TABLE idempotency_keys (key TEXT PRIMARY KEY, response JSONB, created_at TIMESTAMPTZ DEFAULT NOW());

3. Remove testSupabaseConnection() before every insert

4. Add order expiration:
   — Set expires_at = NOW() + INTERVAL '24 hours'
   — Background: periodic cleanup of expired orders (mark as 'expired')

5. Fix exchange direction:
   — Server determines price based on operation type
   — Ignore client-sent exchangeDirection for pricing
   — Use it only for UI display purposes

6. Add circuit breaker integration:
   — import { isCircuitBreakerOpen } from '@/lib/monitoring/exchange-rate-monitor';
   — if (isCircuitBreakerOpen()) return 503 with "Trading temporarily paused"

7. Use Decimal for ALL financial calculations in the route
```

### 3.2 order-status — Add Authentication

```
TASK: Protect order data, add rate limiting

CHANGES:
1. GET endpoint: Require authentication
   — Option A: Session cookie validation
   — Option B: Email + order verification code (sent to email on order creation)
   — Minimum: require email query param matching order email

2. Rate limit: 10 requests per minute per IP (use existing rateLimiter)

3. Sanitize response: only return:
   { orderId, status, createdAt, paymentNetwork, paymentToken, expiresAt }
   — Remove: email, addresses, amounts, internal fields

4. Admin route: Use constant-time comparison for API key:
   import { timingSafeEqual } from 'crypto';
   const isAdmin = timingSafeEqual(Buffer.from(providedKey), Buffer.from(process.env.ADMIN_API_KEY));

5. Add status transition validation:
   — Define valid transitions: awaiting-deposit → paid | expired | cancelled
   — Reject invalid transitions
```

### 3.3 Auth Routes — Hardening

```
TASK: Secure authentication endpoints

CHANGES:
1. Login route:
   — Add rate limiting: 5 attempts per 5 minutes per IP
   — Return generic error on failure (don't reveal if email exists)
   — Set secure cookie flags: httpOnly, secure, sameSite=strict, path=/

2. Register route:
   — Add email verification requirement
   — Add password strength validation (min 8 chars, mixed case, number)
   — Add CAPTCHA or proof-of-work for registration

3. Add CSRF protection for all POST/PUT/DELETE routes:
   — Generate CSRF token on page load
   — Validate on every state-changing request
```

### 3.4 Treasury Purchases Route — Add Auth

```
TASK: Require authentication for treasury operations

CHANGES:
1. GET endpoint: Require valid session
2. POST endpoint:
   — Require valid session
   — Verify session user matches investor address
   — Add input validation: numberOfTokens > 0, numberOfTokens <= maxPurchase
   — Add KYC check before allowing purchase
```

---

## Phase 4: Integration Service Hardening

### 4.1 Rate Limiter — Distributed Persistence

```
TASK: Move rate limits to Redis or Supabase

CHANGES:
1. Check if REDIS_URL is configured:
   — If yes: use ioredis (already in dependencies) for distributed rate limiting
   — If no: use Supabase table as fallback

2. Redis approach:
   import Redis from 'ioredis';
   const redis = new Redis(process.env.REDIS_URL);
   // Use Redis INCR with EXPIRE for rate limiting

3. Supabase fallback:
   — Table: rate_limits (key TEXT PRIMARY KEY, count INT, window_start TIMESTAMPTZ)
   — Use upsert with conditional increment

4. Add distributed duplicate detection:
   — Move duplicateOrderCache to Redis/Supabase
   — Key: sha256(email + amount + network + token)
   — TTL: 10 minutes
```

### 4.2 Exchange Rate Monitor — Circuit Breaker

```
TASK: Implement real circuit breaker that halts trading

CHANGES:
1. Add circuit breaker state:
   — CLOSED (normal), OPEN (halted), HALF_OPEN (testing)
   — Open after: 5 critical deviations in 1 hour
   — Half-open after: 5 minutes
   — Close after: 3 successful checks in half-open

2. Export `isCircuitBreakerOpen()` for use in create-order route

3. Store deviation history in Supabase:
   — Table: rate_deviations (id, deviation_percent, direction, timestamp, details)

4. Add Telegram alert when circuit breaker opens:
   — Send to admin Telegram chat
```

### 4.3 Canton Validation — Checksum & Network Match

```
TASK: Add EIP-55 checksum, network matching for refund addresses

CHANGES:
1. Add EIP-55 checksum validation for Ethereum-format addresses:
   import { getAddress } from 'ethers';
   try { getAddress(address); } catch { return { isValid: false, error: 'Invalid checksum' }; }

2. Add network matching for refund addresses:
   — If paymentToken is USDT-ERC20, refund address must be Ethereum format
   — If paymentToken is USDT-TRC20, refund address must be TRON format
   — If paymentToken is USDT-BEP20, refund address must be Ethereum format (BSC uses same format)

3. Validate Canton-format addresses:
   — Check namespace existence against known participant list (if available)
```

---

## Phase 5: Frontend Hook Fixes

**Scope**: `src/lib/canton/hooks/*.ts`

### 5.1 All Hooks — Common Fixes

```
TASK: Fix service instantiation, error handling, type safety

CHANGES (apply to ALL hooks):
1. Wrap service instantiation in useMemo():
   — BEFORE: const service = new SomeService(new DamlIntegrationService({...}));
   — AFTER:  const service = useMemo(() => new SomeService(...), []);

2. Remove all `as any` type casts — define proper types or use unknown

3. Add error boundaries: wrap async operations in try-catch
   — Return user-friendly error messages instead of crashing
```

### 5.2 Specific Hook Fixes

```
useCantonPortfolio.ts:
— Replace hardcoded 125.80 with dynamic fetch from ConfigManager
— const price = await configManager.get('CANTON_COIN_PRICE_USD');

usePrivacyVaults.ts:
— If generateProof returns null, set error state with clear message
— Fix: "Privacy proofs are not yet available in this environment"

useTreasuryBills.ts:
— Add yield accrual calculation based on time held:
  const accruedYield = new Decimal(holding.yieldRate)
    .div(365)
    .mul(daysSincePurchase)
    .mul(holding.faceValue);

useCantonBridge.ts:
— Make fee configurable: fetch from ConfigManager instead of 0.1% hardcode
— Add nonce to bridge requests: nonce: Date.now()
— Add max slippage check

useCantonNetwork.ts:
— Add retry logic (3 attempts with exponential backoff)
— Add graceful degradation: if Canton not available, show banner "Canton Network: Connecting..."

realCantonIntegration.ts:
— Mark all mock data clearly with isMock: true flag in returned objects
— In production: return error state instead of mock data
— Remove hardcoded Goldman Sachs / BlackRock fake portfolio data

useMultiPartyWorkflowService.ts:
— Add rejection capability to UI
— Add notification polling (or WebSocket) for pending approvals
```

---

## Phase 6: Testing

**Scope**: New and updated test files
**Gate**: `pnpm test` passes with >85% coverage on critical paths

### 6.1 Unit Tests (Vitest)

```
WRITE these test files:

tests/unit/damlIntegrationService.test.ts:
— Test: production mode throws if Daml SDK missing
— Test: development mode creates mock with isMock=true
— Test: getStatus() returns correct mode
— Test: cache TTL expires entries after 5 minutes
— Test: duplicate command detection prevents re-execution

tests/unit/treasuryBillsService.test.ts:
— Test: yield calculation with 365-day year
— Test: yield calculation with 366-day year (leap year)
— Test: Decimal precision maintained through calculation chain
— Test: ID generation uses crypto.randomUUID()
— Test: duplicate distribution prevention

tests/unit/authService.test.ts:
— Test: session stored in Supabase (mock Supabase client)
— Test: session retrieved correctly
— Test: expired session rejected
— Test: account lockout after 5 failures
— Test: lockout expires after 15 minutes
— Test: constant-time comparison used for secrets

tests/unit/rateLimiter.test.ts:
— Test: Redis-backed limiter counts correctly
— Test: Supabase fallback works when Redis unavailable
— Test: distributed deduplication detects duplicates
— Test: rate limit resets after window
```

### 6.2 Integration Tests

```
WRITE these test files:

tests/integration/create-order.test.ts:
— Test: valid order creation end-to-end
— Test: idempotency key prevents duplicate order
— Test: tolerance exploitation rejected (>0.1% deviation)
— Test: exchange direction ignored for pricing
— Test: circuit breaker returns 503 when open
— Test: expired orders auto-cancelled

tests/integration/order-status.test.ts:
— Test: unauthenticated request rejected
— Test: authenticated request returns sanitized data
— Test: admin can update status with valid transition
— Test: invalid status transition rejected

tests/integration/auth-flow.test.ts:
— Test: login → session cookie → authenticated request → logout
— Test: brute force protection (6th attempt locked)
— Test: MFA required when enabled
```

### 6.3 Build Verification

```
RUN after all changes:
1. pnpm build — fix any TypeScript errors
2. pnpm test — ensure all tests pass
3. pnpm lint — fix linting issues
4. Verify no new security vulnerabilities: check for hardcoded secrets, SQL injection, XSS
```

---

## Phase 7: Health Check & Observability

### 7.1 Comprehensive Health Endpoint

```
TASK: Rewrite /api/health to report full system status

FILE: src/app/api/health/route.ts

RESPONSE FORMAT:
{
  "status": "healthy" | "degraded" | "unhealthy",
  "timestamp": "ISO-8601",
  "version": "from package.json",
  "uptime": seconds,
  "components": {
    "supabase": { "status": "up" | "down", "latency_ms": number },
    "daml_ledger": { "status": "REAL" | "MOCK" | "DOWN", "contractCount": number },
    "oracle": {
      "status": "MOCK" | "LIVE" | "STALE",
      "providers": {
        "pyth": "STUB",
        "chainlink": "STUB",
        "band": "STUB"
      },
      "lastPriceUpdate": "ISO-8601"
    },
    "compliance": {
      "status": "STUB" | "LIVE",
      "providers": { "chainalysis": "STUB", "sumsub": "STUB", "worldcheck": "STUB" }
    },
    "rate_limiter": { "type": "MEMORY" | "REDIS" | "SUPABASE" },
    "bridge": { "status": "MOCK" | "LIVE", "supportedChains": [] },
    "canton_validator": { "status": "connected" | "disconnected", "endpoint": "..." },
    "circuit_breaker": { "status": "CLOSED" | "OPEN" | "HALF_OPEN", "lastAlert": "ISO-8601" }
  },
  "warnings": [
    "Daml ledger running in MOCK mode",
    "All oracle prices are MOCK data",
    "Compliance screening is STUB — no real AML/KYC"
  ]
}

LOGIC:
— status = "healthy" if all components up and no MOCK in production
— status = "degraded" if any component MOCK or STALE
— status = "unhealthy" if any component DOWN
```

### 7.2 TODO Annotation Standard

```
TASK: Add standardized TODO comments to every stub/mock

FORMAT:
// TODO [PRIORITY]: DESCRIPTION
// Current: WHAT IT DOES NOW
// Required: WHAT IT SHOULD DO
// Provider: RECOMMENDED INTEGRATION
// Effort: S/M/L

EXAMPLE:
// TODO [P0]: Replace mock with real Chainalysis AML screening
// Current: isMixerAddress() always returns false (no screening)
// Required: API call to Chainalysis with wallet address, check against mixer database
// Provider: Chainalysis KYT API (https://www.chainalysis.com/kyt/)
// Effort: M (2-3 days, API key + integration + testing)
```

---

## Phase 8: DevNet Deployment

**Scope**: Deploy Canton Validator + OTC Platform to DevNet on node 65.108.15.30
**Prerequisites**: Phases 1-7 complete, `pnpm build` succeeds

### 8.1 Canton Validator Deployment

```
TASK: Deploy Canton Validator to DevNet using Helm

SERVER: 65.108.15.30
KUBERNETES: k3s cluster (node: canton-node-65-108-15-30)
NAMESPACE: validator

STEPS:

1. SSH and verify cluster:
   ssh root@65.108.15.30
   kubectl get nodes
   kubectl get ns

2. Create namespace and secrets:
   kubectl create namespace validator || true

   # Get fresh onboarding secret (1-hour validity for DevNet)
   ./blockchain/scripts/get-onboarding-secret.sh devnet --save

   # Create secrets
   kubectl create secret generic postgres-secrets \
     --from-literal=postgresPassword="$(openssl rand -base64 32)" \
     -n validator || true

   kubectl create secret generic splice-app-validator-onboarding-validator \
     --from-literal=secret="$(grep DEVNET_ONBOARDING_SECRET blockchain/config/onboarding-secrets.env | cut -d= -f2)" \
     -n validator || true

3. Download Canton Helm charts:
   export CHART_VERSION=0.5.7
   curl -sL -o /tmp/splice-node.tar.gz \
     "https://github.com/digital-asset/decentralized-canton-sync/releases/download/v${CHART_VERSION}/${CHART_VERSION}_splice-node.tar.gz"
   mkdir -p /tmp/splice-node
   tar xzf /tmp/splice-node.tar.gz -C /tmp/splice-node
   SV_HELM=$(find /tmp/splice-node -name "postgres-values-validator-participant.yaml" -path "*/sv-helm/*" | xargs dirname)

4. Install PostgreSQL:
   helm install postgres oci://ghcr.io/digital-asset/decentralized-canton-sync/helm/splice-postgres \
     -n validator --version ${CHART_VERSION} \
     -f ${SV_HELM}/postgres-values-validator-participant.yaml \
     -f blockchain/k8s/helm-devnet/postgres-values-devnet.yaml \
     --wait --timeout 5m

5. Install Participant:
   helm install participant oci://ghcr.io/digital-asset/decentralized-canton-sync/helm/splice-participant \
     -n validator --version ${CHART_VERSION} \
     -f ${SV_HELM}/participant-values.yaml \
     -f ${SV_HELM}/standalone-participant-values.yaml \
     -f blockchain/k8s/helm-devnet/participant-values-devnet.yaml \
     -f blockchain/k8s/helm-devnet/standalone-participant-values-devnet.yaml \
     --wait --timeout 10m

6. Install Validator:
   helm install validator oci://ghcr.io/digital-asset/decentralized-canton-sync/helm/splice-validator \
     -n validator --version ${CHART_VERSION} \
     -f ${SV_HELM}/validator-values.yaml \
     -f ${SV_HELM}/standalone-validator-values.yaml \
     -f blockchain/k8s/helm-devnet/validator-values-devnet.yaml \
     -f blockchain/k8s/helm-devnet/standalone-validator-values-devnet.yaml \
     --wait --timeout 10m

7. Verify:
   kubectl get pods -n validator
   curl http://65.108.15.30:8081/health
   curl http://65.108.15.30:6865/v1/version  # Ledger API

KEY CONFIG:
— Sponsor SV: https://sv.sv-1.dev.global.canton.network.sync.global
— Scan URL: https://scan.sv-1.dev.global.canton.network.sync.global
— Validator Name: gyber-validator
— Party Hint: gyber-validator
— Auth: disabled for DevNet (disableAuth: true)
— Ports: 8080 (metrics), 8081 (health), 8082 (admin), 6865 (Ledger API)
```

### 8.2 Onboarding Secret Auto-Rotation

```
TASK: Create CronJob for automatic DevNet secret refresh

FILE: blockchain/k8s/helm-devnet/devnet-secret-rotation-cronjob.yaml

apiVersion: batch/v1
kind: CronJob
metadata:
  name: devnet-secret-rotation
  namespace: validator
spec:
  schedule: "0 * * * *"  # Every hour
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: secret-rotator
            image: bitnami/kubectl:latest
            command:
            - /bin/sh
            - -c
            - |
              # Fetch new onboarding secret from Canton DevNet
              NEW_SECRET=$(curl -s https://sv.sv-1.dev.global.canton.network.sync.global/api/validator/onboarding | jq -r '.secret')
              if [ -n "$NEW_SECRET" ]; then
                kubectl delete secret splice-app-validator-onboarding-validator -n validator --ignore-not-found
                kubectl create secret generic splice-app-validator-onboarding-validator \
                  --from-literal=secret="$NEW_SECRET" -n validator
                # Restart validator to pick up new secret
                kubectl rollout restart deployment validator-validator -n validator
                echo "Secret rotated successfully at $(date)"
              fi
          restartPolicy: OnFailure
          serviceAccountName: canton-validator
```

### 8.3 OTC Platform Deployment

```
TASK: Deploy Next.js OTC platform connected to DevNet validator

STEPS:

1. Build Docker image:
   docker build -t ghcr.io/themacroeconomicdao/cantonotc:devnet \
     --build-arg NODE_ENV=production .

2. Push to registry:
   docker push ghcr.io/themacroeconomicdao/cantonotc:devnet

3. Create platform secrets:
   kubectl create secret generic canton-otc-secrets -n validator \
     --from-env-file=.env.production

4. Deploy platform (modify existing deployment.yaml):
   — Set image: ghcr.io/themacroeconomicdao/cantonotc:devnet
   — Add environment variables:
     NEXT_PUBLIC_DAML_USE_REAL_LEDGER: "true"
     DAML_LEDGER_HOST: "participant-participant"  # K8s service name
     DAML_LEDGER_PORT: "6865"
     CANTON_VALIDATOR_URL: "http://validator-validator:8082"
     NODE_ENV: "production"
   — Mount secrets as environment variables

5. Apply deployment:
   kubectl apply -f config/kubernetes/k8s/deployment.yaml -n validator

6. Verify:
   kubectl get pods -n validator
   kubectl logs -f deployment/canton-otc -n validator
   curl http://65.108.15.30:3000/api/health
```

### 8.4 DevNet Integration Verification

```
TASK: Verify end-to-end flow on DevNet

VERIFICATION STEPS:

1. Health check:
   curl http://65.108.15.30:3000/api/health | jq .
   — Verify: daml_ledger.status == "REAL"
   — Verify: canton_validator.status == "connected"

2. Canton connectivity:
   curl http://65.108.15.30:6865/v1/version
   — Should return Ledger API version

3. Create test order:
   curl -X POST http://65.108.15.30:3000/api/create-order \
     -H "Content-Type: application/json" \
     -H "X-Idempotency-Key: test-$(date +%s)" \
     -d '{
       "email": "test@example.com",
       "exchangeDirection": "buy",
       "usdtAmount": 100,
       "paymentNetwork": "ethereum",
       "paymentToken": "USDT-ERC20"
     }'

4. Check order status:
   curl http://65.108.15.30:3000/api/order-status/{orderId}

5. Verify Daml contract created:
   — Check DamlIntegrationService logs for "Created OtcOffer contract"
   — Verify contract visible on Canton Scan:
     https://scan.sv-1.dev.global.canton.network.sync.global
```

---

## Phase 9: Post-Deployment Monitoring Setup

### 9.1 Prometheus & Grafana (Optional but Recommended)

```
TASK: Deploy monitoring stack

FILES: config/kubernetes/k8s/monitoring-stack.yaml (exists, apply it)

kubectl apply -f config/kubernetes/k8s/monitoring-stack.yaml -n validator

VERIFY:
— Prometheus: http://65.108.15.30:9090
— Grafana: http://65.108.15.30:3001 (default: admin/admin)
— Add Canton OTC dashboard showing:
  — Order creation rate
  — Error rate by endpoint
  — Daml contract creation latency
  — Circuit breaker status
  — Rate limiter hit rate
```

### 9.2 Telegram Alerts

```
TASK: Configure Telegram alerts for critical events

TRIGGERS:
— Circuit breaker opened
— Daml ledger disconnected
— Supabase connection failed
— >10 failed login attempts in 5 minutes
— Order creation error rate >5%
— Canton validator health check failed

IMPLEMENTATION:
— Use existing telegram.ts service
— Add new function: sendAdminAlert(severity, message)
— Configure TELEGRAM_ADMIN_CHAT_ID in .env
```

---

# SECTION C: SUCCESS CRITERIA & VERIFICATION

## Final Checklist

### Code Quality
- [ ] `pnpm build` succeeds with 0 TypeScript errors
- [ ] `pnpm test` passes with >85% coverage on critical paths
- [ ] `pnpm lint` passes with 0 errors
- [ ] No `as any` type casts in modified code
- [ ] All financial calculations use Decimal
- [ ] All IDs use crypto.randomUUID()

### Security
- [ ] All P0 issues fixed with tests
- [ ] All P1 issues fixed or have explicit mitigation
- [ ] No silent mock fallback in production
- [ ] Authentication required on all data endpoints
- [ ] Rate limiting distributed (Redis/Supabase)
- [ ] Constant-time comparison for all secret checks
- [ ] No hardcoded secrets in code

### Smart Contracts
- [ ] All 3 inverted assertions fixed (Settlement, Escrow x2)
- [ ] Collateral forfeit transfers to beneficiary
- [ ] Collateral withdraw maintains invariant
- [ ] Settlement timeout implemented
- [ ] Self-trade prevention in OtcOffer
- [ ] Daml test suite passes

### DevNet Deployment
- [ ] Canton Validator healthy on 65.108.15.30
- [ ] Ledger API responsive on port 6865
- [ ] OTC Platform connected to real ledger
- [ ] `/api/health` reports accurate system status
- [ ] End-to-end order creation verified on DevNet
- [ ] Onboarding secret rotation CronJob active

### Observability
- [ ] `/api/health` reports all component statuses
- [ ] Every stub/mock has standardized TODO comment
- [ ] Warning logs emitted for all mock/stub usage
- [ ] Circuit breaker status visible in health check

---

# SECTION D: ENVIRONMENT VARIABLES REFERENCE

```env
# === REQUIRED FOR PRODUCTION ===
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Auth
NEXTAUTH_SECRET=<random-64-chars>
JWT_SECRET=<random-64-chars>

# Canton / Daml
NEXT_PUBLIC_DAML_USE_REAL_LEDGER=true
DAML_LEDGER_HOST=participant-participant
DAML_LEDGER_PORT=6865
CANTON_VALIDATOR_URL=http://validator-validator:8082

# Receiving Addresses (move to K8s secrets, not .env)
ETH_RECEIVING_ADDRESS=0x...
BSC_RECEIVING_ADDRESS=0x...
TRON_RECEIVING_ADDRESS=T...
SOLANA_RECEIVING_ADDRESS=...
OPTIMISM_RECEIVING_ADDRESS=0x...

# Pricing
CANTON_COIN_BUY_PRICE_USD=0.77
CANTON_COIN_SELL_PRICE_USD=0.22

# Limits
MIN_USDT_AMOUNT=10
MAX_USDT_AMOUNT=100000

# Redis (for distributed rate limiting)
REDIS_URL=redis://redis:6379

# Telegram
TELEGRAM_BOT_TOKEN=<token>
TELEGRAM_CHAT_ID=<chat-id>
TELEGRAM_ADMIN_CHAT_ID=<admin-chat-id>

# Google Sheets (legacy)
GOOGLE_SHEET_ID=<sheet-id>
GOOGLE_SERVICE_ACCOUNT_EMAIL=<email>
GOOGLE_PRIVATE_KEY=<key>

# Admin
ADMIN_API_KEY=<random-64-chars>
ADMIN_EMAIL=admin@your-domain.com

# === OPTIONAL ===
# Intercom
NEXT_PUBLIC_INTERCOM_APP_ID=<app-id>
INTERCOM_ACCESS_TOKEN=<token>

# Monitoring
MONITORING_ENABLED=true
ALERT_EMAIL=alerts@your-domain.com

# NEAR (for DEX features)
NEXT_PUBLIC_NEAR_NETWORK=testnet
NEAR_RPC_URL=https://rpc.testnet.near.org
```

---

# SECTION E: DATABASE MIGRATIONS

```sql
-- Run these migrations on Supabase before deployment

-- 1. Idempotency keys for order creation
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_idempotency_created ON idempotency_keys (created_at);
-- Auto-cleanup: DELETE FROM idempotency_keys WHERE created_at < NOW() - INTERVAL '24 hours';

-- 2. Auth sessions (replace in-memory Map)
CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);
CREATE INDEX idx_sessions_token ON auth_sessions (token);
CREATE INDEX idx_sessions_expires ON auth_sessions (expires_at);

-- 3. Failed login attempts (for account lockout)
CREATE TABLE IF NOT EXISTS auth_failed_attempts (
  email TEXT PRIMARY KEY,
  attempt_count INT DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_attempt TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Rate limit counters (distributed)
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INT DEFAULT 0,
  window_start TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_rate_limits_window ON rate_limits (window_start);

-- 5. Rate deviation history (audit trail)
CREATE TABLE IF NOT EXISTS rate_deviations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deviation_percent DECIMAL NOT NULL,
  direction TEXT NOT NULL,
  expected_rate DECIMAL,
  actual_rate DECIMAL,
  order_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_deviations_created ON rate_deviations (created_at);

-- 6. Order expiration support
ALTER TABLE orders ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
UPDATE orders SET expires_at = created_at + INTERVAL '24 hours' WHERE expires_at IS NULL;

-- 7. Password reset tokens
CREATE TABLE IF NOT EXISTS password_resets (
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_password_resets_email ON password_resets (email);

-- 8. Spam events (replace in-memory spam tracking)
CREATE TABLE IF NOT EXISTS spam_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT,
  email TEXT,
  event_type TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_spam_events_ip ON spam_events (ip_address);
CREATE INDEX idx_spam_events_created ON spam_events (created_at);

-- 9. Cleanup policies (run via pg_cron or application cron)
-- DELETE FROM idempotency_keys WHERE created_at < NOW() - INTERVAL '24 hours';
-- DELETE FROM auth_sessions WHERE expires_at < NOW();
-- DELETE FROM auth_failed_attempts WHERE locked_until < NOW() - INTERVAL '1 hour';
-- DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '2 hours';
-- UPDATE orders SET status = 'expired' WHERE status = 'awaiting-deposit' AND expires_at < NOW();
```

---

# SECTION F: CRITICAL GAPS FOUND IN SECONDARY AUDIT

> These findings were discovered during a second-pass gap analysis and are **not covered** in Phases 1-9 above. They must be addressed as part of the execution.

---

## F.1 EMERGENCY: Exposed Secrets in Git History (P0-IMMEDIATE)

**CRITICAL**: `.env.production` and `.env.local` contain **real production secrets** and are committed to the repository. Even if `.gitignore` blocks future commits, the secrets exist in git history.

### Exposed Credentials (MUST ROTATE IMMEDIATELY):
```
.env.production:
— Google Service Account private key (full RSA key in plaintext)
— TELEGRAM_BOT_TOKEN=8475223066:AAEy...
— ADMIN_API_KEY=canton-admin-2025-super-secure-key
— NEXTAUTH_SECRET=j9koDQJDXidtSU1XTaqkD6j+BZ7YN1gqx2dpYBIP6Bo=
— ETH/BSC/TRON receiving wallet addresses

.env.local:
— TELEGRAM_SESSION_STRING (full account session — allows account takeover)
— TELEGRAM_API_ID + TELEGRAM_API_HASH
— GOOGLE_SHEET_ID + GOOGLE_SERVICE_ACCOUNT_EMAIL
```

### Required Actions (Phase 0 — Before ANY Code Changes):
```
TASK: Rotate ALL compromised secrets

STEPS:
1. Revoke Google Service Account key → create new one in Google Cloud Console
2. Revoke Telegram Bot Token → BotFather /revoke, create new token
3. Regenerate Telegram Session String
4. Generate new ADMIN_API_KEY: openssl rand -base64 48
5. Generate new NEXTAUTH_SECRET: openssl rand -base64 48
6. Generate new JWT_SECRET: openssl rand -base64 48
7. Sweep any funds from exposed wallet addresses → generate new addresses
8. Remove secrets from git history:
   git filter-branch --force --index-filter \
     'git rm --cached --ignore-unmatch .env.production .env.local .env.fixed .env.clean' \
     --prune-empty --tag-name-filter cat -- --all
   git push origin --force --all
9. Verify .gitignore includes: .env*, !.env.example, !env.template
10. Store all production secrets ONLY in:
    — GitHub Secrets (for CI/CD)
    — Kubernetes Secrets (for runtime)
    — NEVER in files committed to git
```

---

## F.2 Admin Routes: Missing RBAC (P0)

**ALL admin API routes** use `session` auth but have **no role check**. Any authenticated user can access admin endpoints.

### Affected Files (12 routes):
```
src/app/api/admin/customers/route.ts          — Lists ALL customers (PII)
src/app/api/admin/customers/[email]/route.ts   — Individual customer data
src/app/api/admin/customers/analytics/route.ts — Aggregated customer data
src/app/api/admin/orders/route.ts              — ALL orders
src/app/api/admin/orders/[orderId]/route.ts    — Order CRUD (including DELETE)
src/app/api/admin/addresses/route.ts           — Wallet addresses
src/app/api/admin/monitoring/route.ts          — System monitoring
src/app/api/admin/settings/route.ts            — Platform settings
src/app/api/admin/stats/route.ts               — Statistics
src/app/api/admin/rate-limit/route.ts          — Rate limiter control
src/app/api/admin/test-intercom/route.ts       — Intercom testing
src/app/api/admin/test-mediator/route.ts       — Mediator testing
```

### Required Fix:
```typescript
// ADD to EVERY admin route handler:
import { auth } from '@/auth';

const session = await auth();
if (!session?.user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// RBAC check — add admin role to user model
const userRole = (session.user as { role?: string }).role;
if (userRole !== 'admin') {
  return NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403 });
}
```

### Additional Admin Issues:
- API key passed in **query parameters** (visible in logs, browser history) → move to `Authorization` header
- No rate limiting on 10 admin endpoints → add rate limiting
- Admin key compared with `!==` (timing attack) → use `crypto.timingSafeEqual()`

---

## F.3 XSS Vulnerabilities (P0)

### 3 confirmed XSS vectors:

**1. Blog content injection:**
```
File: src/app/blog/[slug]/page.tsx
Code: dangerouslySetInnerHTML={{ __html: post.content }}
Risk: Stored XSS if blog content contains malicious scripts
Fix:  Use DOMPurify.sanitize(post.content) before rendering
```

**2. Teletype sync HTML injection:**
```
File: src/app/api/teletype-sync/route.ts (line ~75-124)
Code: .replace(/\[([^\]]+)\]\(([^\)]+)\)/gim, '<a href="$2" target="_blank">$1</a>')
Risk: javascript: URLs in Teletype articles → XSS
Fix:  Sanitize HTML output: import DOMPurify from 'isomorphic-dompurify';
      Add URL validation: only allow https:// URLs in href
```

**3. JSON-LD injection:**
```
File: src/app/layout.tsx
Code: dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(data) }}
Risk: If any user data reaches JSON-LD schema → stored XSS
Fix:  Verify safeJsonLdStringify escapes all HTML entities, add test
```

---

## F.4 DEX/NEAR Intents Security (P1)

### localStorage Exposure (7 components):
```
Affected: SwapInterface, BridgeInterface, PortfolioTracker,
          LimitOrderPanel, PriceAlerts, NearWalletButton, IntentHistory

Code: localStorage.getItem('near_wallet_account')
      localStorage.setItem('near_wallet_account', account.accountId)

Risk: Any XSS vulnerability allows stealing wallet account IDs
Fix:
1. Use sessionStorage instead (cleared on tab close)
2. Or encrypt values:
   const encrypted = await crypto.subtle.encrypt(key, accountId);
   localStorage.setItem('near_wallet_account', encrypted);
3. Add CSP headers preventing inline scripts
```

### SwapInterface.tsx Issues:
```
— No input validation for swap amounts (accepts NaN, Infinity, negative)
— Hardcoded fee: const fee = 0.003 → make configurable
— No debouncing on price/balance fetching → DoS on own API
— No nonce on bridge requests → replay attacks possible
— No slippage protection → sandwich attacks possible

Fix: Add comprehensive input validation, rate limiting, and nonce generation
```

### NearWalletButton.tsx:
```
— Mock account fallback in development: localStorage.setItem('near_wallet_account', mockAccount)
— If NODE_ENV check fails, mock account persists → security risk
Fix: Remove mock account fallback, use proper test accounts
```

---

## F.5 TypeScript Safety: `ignoreBuildErrors: true` (P1)

**File**: `next.config.js` (line ~27-30)
```javascript
typescript: {
  ignoreBuildErrors: true,  // ❌ ALL TypeScript errors silently ignored
},
eslint: {
  ignoreDuringBuilds: true, // ❌ ALL ESLint errors silently ignored
},
```

### Impact:
- Type errors don't block deployment
- Security-relevant type mismatches silently pass
- `as any` casts hide data flow issues
- **30+ instances of `as any`** found across components

### Required Fix:
```javascript
// Phase 1: Fix all TypeScript errors, then:
typescript: {
  ignoreBuildErrors: false,
},
eslint: {
  ignoreDuringBuilds: false,
},
```

---

## F.6 CI/CD Security Gaps (P1)

### Missing from GitHub Actions:

```
1. No SAST (Static Application Security Testing)
   — Add: CodeQL, Semgrep, or SonarQube scan step

2. No dependency vulnerability scanning
   — Add: npm audit, Snyk, or Dependabot alerts

3. No container image scanning
   — Add: Trivy scan before push to GHCR

4. Integration tests fail silently (continue-on-error: true)
   — Fix: Remove continue-on-error, fail the pipeline

5. No coverage thresholds enforced
   — Fix: Add --coverage.thresholds.lines 80 to vitest config

6. No approval gates for production deploys
   — Fix: Add required reviewers via GitHub branch protection

7. Manual deploy override (force_deploy: true) has no audit trail
   — Fix: Require issue/ticket reference for force deploys

8. No signed commits required
   — Fix: Enable branch protection rule: "Require signed commits"
```

### Add to CI pipeline:
```yaml
# .github/workflows/security-scan.yml
- name: Run npm audit
  run: pnpm audit --audit-level=high

- name: Run Trivy container scan
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ghcr.io/themacroeconomicdao/cantonotc:${{ github.sha }}
    severity: 'CRITICAL,HIGH'
    exit-code: '1'

- name: Run CodeQL
  uses: github/codeql-action/analyze@v3
```

---

## F.7 Security Middleware Gaps (P1)

**File**: `src/lib/security/security-middleware.ts`

### Missing protections:
```
1. CSRF protection not implemented
   — No CSRF token generation or validation
   — No double-submit cookie pattern
   Fix: Add CSRF middleware for all POST/PUT/DELETE routes

2. XSS pattern detection incomplete (lines ~398-430)
   Missing patterns:
   — SVG-based XSS: <svg onload=...>
   — iframe injection: <iframe src=javascript:...>
   — HTML5 event handlers: onfocus, onmouseover, onerror
   — data: URI scheme attacks
   Fix: Add comprehensive XSS pattern library or use DOMPurify

3. Prototype pollution detection weak (lines ~445-470)
   — Only checks __proto__, constructor, prototype
   — Doesn't detect indirect attacks via getters/setters
   Fix: Use Object.freeze() on critical objects, add Proxy-based validation

4. Input validation limited to JSON and URL params
   — Missing: multipart/form-data, XML, base64 payloads
   Fix: Add Content-Type whitelist, reject unexpected formats
```

---

## F.8 Config Manager Race Condition (P2)

**File**: `src/lib/config-manager.ts` (lines ~180-220)

```typescript
// Current (RACE CONDITION):
if (this.isRefreshing) {
  return false;  // Returns stale data
}
this.isRefreshing = true;  // Not atomic with check above

// Fix: Use promise-based deduplication:
private refreshPromise: Promise<boolean> | null = null;

async refreshConfig(): Promise<boolean> {
  if (this.refreshPromise) return this.refreshPromise;
  this.refreshPromise = this._doRefresh().finally(() => {
    this.refreshPromise = null;
  });
  return this.refreshPromise;
}
```

---

## F.9 Solidity Bridge Contract Issues (P2)

**File**: `contracts/CantonBridge.sol`

```
1. lockTokens() — deposit ID vulnerable to timestamp prediction
   — Uses block.timestamp for ID generation (~160K combinations/sec)
   Fix: Use keccak256(abi.encodePacked(msg.sender, amount, nonce, block.timestamp))

2. releaseTokens() — no nonce ordering
   — Out-of-order releases possible
   — Multi-sig signatures reusable across chains
   Fix: Add sequential nonce requirement, include chainId in signature

3. Daily volume tracking — block.timestamp manipulation
   — Miners can shift timestamp ±900 seconds
   — Allows bypassing daily limits near midnight
   Fix: Use block number ranges instead of timestamps for period tracking
```

---

## F.10 Cron Job Authentication Bypass (P2)

**File**: `src/app/api/cron/check-telegram-session/route.ts` (line ~19)

```typescript
// Current (BYPASS if env var missing):
if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  // Only checks IF cronSecret is set → public if not configured
}

// Fix:
if (!cronSecret) {
  return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
}
if (!authHeader || !crypto.timingSafeEqual(
  Buffer.from(authHeader), Buffer.from(`Bearer ${cronSecret}`)
)) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

---

## F.11 Log Sanitization Incomplete (P2)

**File**: `src/lib/utils/logSanitizer.ts`

### Missing patterns to mask:
```typescript
// ADD these patterns:
/(?:0x)?[a-fA-F0-9]{64}/gi,                    // Private key hex strings
/eyJ[a-zA-Z0-9._-]{50,}/g,                     // JWT tokens
/mongodb(\+srv)?:\/\/[^:]+:[^@]+@/g,           // MongoDB connection strings
/postgres(ql)?:\/\/[^:]+:[^@]+@/g,             // PostgreSQL connection strings
/-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/g, // Private keys
/(?:sk|pk)_(?:live|test)_[a-zA-Z0-9]{20,}/g,   // Stripe-style API keys
/xox[bpas]-[a-zA-Z0-9-]{10,}/g,                // Slack tokens
```

---

## F.12 Missing Webhook Signature Verification (P2)

**File**: `src/lib/middleware/telegramWebhookAuth.ts`

```
Issue: Rate limiting exists but no HMAC-SHA256 signature verification
       of incoming Telegram webhook payload

Fix: Validate using Telegram's secret_token mechanism:
     const hash = crypto.createHmac('sha256', botToken)
       .update(rawBody)
       .digest('hex');
     if (hash !== request.headers.get('x-telegram-bot-api-secret-token')) {
       return 401;
     }
```

**File**: `src/lib/services/intercom.ts`

```
Issue: No webhook signature verification for incoming Intercom webhooks
Fix:  Verify X-Hub-Signature header with INTERCOM_WEBHOOK_SECRET
```

---

## F.13 Console Debug Statements (P3)

**436 `console.log`/`console.error` statements** across production services.

```
TASK: Replace with structured logging

CHANGES:
1. Create src/lib/utils/logger.ts:
   — Use pino (lightweight) or winston
   — Log levels: error, warn, info, debug
   — In production: info+ only
   — In development: debug+
   — Structured format: { timestamp, level, service, message, ...context }

2. Replace all console.log → logger.info
3. Replace all console.error → logger.error
4. Replace all console.warn → logger.warn
5. Remove all console.debug
6. Ensure NO sensitive data in log messages (use logSanitizer)
```

---

## F.14 Missing Type Definitions (P3)

**File**: `src/types/` — contains only `crypto.d.ts` (23 lines)

```
TASK: Add missing type definitions

CREATE these files:
src/types/order.ts     — OrderCreateRequest, OrderResponse, OrderStatus enum
src/types/defi.ts      — TreasuryBill, PrivacyVault, RealEstateToken, BridgeRequest
src/types/admin.ts     — AdminUser, AdminAction, AuditLogEntry
src/types/canton.ts    — CantonAsset, CantonTransaction, CantonParticipant
src/types/near.ts      — NearIntent, NearSwapParams, NearBridgeParams
src/types/compliance.ts — KYCResult, AMLCheck, SanctionsResult

THEN: Replace all `as any` casts with proper types (30+ instances)
```

---

## F.15 Missing E2E Tests for Critical Flows (P3)

```
TASK: Add Playwright E2E tests for untested flows

CREATE:
e2e/dex/swap.spec.ts         — NEAR swap end-to-end
e2e/dex/bridge.spec.ts       — Cross-chain bridge flow
e2e/defi/treasury.spec.ts    — Treasury bill purchase flow
e2e/defi/privacy-vault.spec.ts — Privacy vault creation
e2e/admin/orders.spec.ts     — Admin order management
e2e/otc/full-flow.spec.ts    — Complete OTC buy/sell flow

EXISTING (keep):
e2e/auth/login.spec.ts
e2e/auth/logout.spec.ts
e2e/auth/registration.spec.ts
```

---

## F.16 Zustand Store Serialization Bug (P3)

**File**: `src/lib/canton/store/cantonStore.ts` (lines ~320-380)

```
Issue: Decimal.js objects lose methods when serialized to localStorage
       via Zustand persist middleware. After page reload, mathematical
       operations on Decimal values throw errors.

Fix: Add custom serializer:
  persist(
    (set, get) => ({ ... }),
    {
      name: 'canton-store',
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const parsed = JSON.parse(str);
          // Rehydrate Decimal instances
          return rehydrateDecimals(parsed);
        },
        setItem: (name, value) => {
          // Convert Decimals to strings before storing
          localStorage.setItem(name, JSON.stringify(dehydrateDecimals(value)));
        },
        removeItem: (name) => localStorage.removeItem(name),
      }
    }
  )
```

---

# SECTION G: UPDATED VULNERABILITY REGISTRY

> Total findings after secondary audit: **~195 vulnerabilities** (was 149)

### New P0 findings added:
| ID | Finding | Source |
|----|---------|--------|
| P0-16 | **Production secrets committed to git** — API keys, private keys, bot tokens | F.1 |
| P0-17 | **All admin routes lack RBAC** — any auth user = admin | F.2 |
| P0-18 | **3 XSS vulnerabilities** — blog, teletype, JSON-LD | F.3 |

### New P1 findings added:
| ID | Finding | Source |
|----|---------|--------|
| P1-23 | DEX localStorage stores wallet IDs unencrypted | F.4 |
| P1-24 | `ignoreBuildErrors: true` hides type errors in production | F.5 |
| P1-25 | CI/CD has no SAST, no container scanning, no dependency audit | F.6 |
| P1-26 | Security middleware missing CSRF, incomplete XSS detection | F.7 |
| P1-27 | SwapInterface: no input validation, no slippage protection | F.4 |

### New P2 findings added:
| ID | Finding | Source |
|----|---------|--------|
| P2-19 | Config manager race condition on concurrent refreshes | F.8 |
| P2-20 | Solidity bridge: timestamp-predictable IDs, no nonce ordering | F.9 |
| P2-21 | Cron endpoint public if CRON_SECRET env var not set | F.10 |
| P2-22 | Log sanitizer misses JWT, private keys, DB connection strings | F.11 |
| P2-23 | Telegram webhook auth: no HMAC signature verification | F.12 |

### New P3 findings added:
| ID | Finding | Source |
|----|---------|--------|
| P3-13 | 436 console.log statements in production services | F.13 |
| P3-14 | Only 23 lines of type definitions for entire project | F.14 |
| P3-15 | Zero E2E tests for DEX, DeFi, admin flows | F.15 |
| P3-16 | Zustand Decimal.js serialization bug on page reload | F.16 |

---

# SECTION H: UPDATED SUCCESS CRITERIA

## Phase 0 (NEW — Before Any Code Changes)
- [ ] All compromised secrets rotated (Google, Telegram, admin key, wallets)
- [ ] `.env.production` and `.env.local` purged from git history
- [ ] `.gitignore` verified to block all `.env*` files except templates

## Code Quality (Updated)
- [ ] `ignoreBuildErrors` set to `false` in next.config.js
- [ ] `ignoreDuringBuilds` set to `false` for ESLint
- [ ] All `as any` casts replaced with proper types
- [ ] `pnpm build` succeeds with **strict TypeScript** (no ignoring errors)
- [ ] No `dangerouslySetInnerHTML` without DOMPurify sanitization

## Security (Updated)
- [ ] All admin routes have RBAC (role === 'admin' check)
- [ ] Admin API keys sent in Authorization header, not query params
- [ ] CSRF protection on all state-changing routes
- [ ] XSS vectors fixed (blog, teletype, JSON-LD)
- [ ] DEX localStorage encrypted or moved to sessionStorage
- [ ] Cron endpoints fail-closed when CRON_SECRET missing
- [ ] Webhook signature verification for Telegram and Intercom
- [ ] Log sanitizer covers JWT, private keys, connection strings

## CI/CD (New)
- [ ] SAST scanning added (CodeQL or Semgrep)
- [ ] Container image scanning added (Trivy)
- [ ] `pnpm audit` step in CI with `--audit-level=high`
- [ ] Integration tests no longer use `continue-on-error: true`
- [ ] Coverage thresholds enforced (80% lines minimum)

---

# SECTION I — THIRD AUDIT PASS: CONFIGURATION, DEPENDENCIES, AND REMAINING SERVICES

> Added in v3.0. This section covers 40 additional findings from areas not previously audited:
> package.json dependencies, vitest/playwright configs, middleware.ts, enhanced-route.ts,
> price-oracle, performance services, Zustand stores, advanced-rate-limiter, and auth.ts.

---

## Phase 10 — Dependency Security & Configuration Hardening

### I-1. Fix Known CVEs in Transitive Dependencies (CRITICAL)
**Action**: Run `pnpm audit fix` and update vulnerable parent packages.

**Vulnerable packages**:
| Package | Via | CVE |
|---------|-----|-----|
| jws | googleapis | CVE-1111243 |
| lodash | @daml/types | CVE-1112455 |
| js-yaml | @kubernetes/client-node | CVE-1112715 |
| jsonpath | snarkjs>bfj | CVE-1112974, CVE-1113157 |
| qs | googleapis-common | CVE-1113132, CVE-1113161 |
| fast-xml-parser | @types/nodemailer>@aws-sdk | CVE-1113153 |

```bash
pnpm audit fix
# If transitive, add overrides in package.json:
# "pnpm": { "overrides": { "qs": ">=6.13.0", "lodash": ">=4.17.21" } }
```

**Self-verification**: `pnpm audit --audit-level=high` returns 0 vulnerabilities.

### I-2. Move @types/* from dependencies to devDependencies (HIGH)
**File**: `package.json`

Move these from `dependencies` to `devDependencies`:
```
@types/bcryptjs, @types/bip32, @types/bip39, @types/jsonwebtoken,
@types/nodemailer, @types/qrcode, @types/uuid
```

```bash
pnpm remove @types/bcryptjs @types/bip32 @types/bip39 @types/jsonwebtoken @types/nodemailer @types/qrcode @types/uuid
pnpm add -D @types/bcryptjs @types/bip32 @types/bip39 @types/jsonwebtoken @types/nodemailer @types/qrcode @types/uuid
```

### I-3. Fix NEAR Wallet Selector Version Mismatch (HIGH)
**File**: `package.json`

```diff
- "@near-wallet-selector/near-wallet": "^8.9.3"
+ "@near-wallet-selector/near-wallet": "^10.1.0"
```

All other `@near-wallet-selector/*` packages are `^10.1.0`. This mismatch can cause wallet connection failures.

### I-4. Clean Up Redundant Environment Files (MEDIUM)
**Root directory** contains:
- `.env.production` (active)
- `.env.production.backup` (stale)
- `.env.clean` (stale)
- `.env.fixed` (stale)

**Action**: Delete `.env.production.backup`, `.env.clean`, `.env.fixed`. Keep only `.env.production` and `.env.example`.

### I-5. Add Missing Variables to .env.example (MEDIUM)
**File**: `.env.example`

Add these missing required variables:
```env
NEXTAUTH_SECRET=         # REQUIRED: Generate with openssl rand -base64 32
ADMIN_PASSWORD_HASH=     # REQUIRED: bcrypt hash of admin password
ADMIN_EMAIL=             # REQUIRED: Admin login email
ADMIN_NAME=              # REQUIRED: Admin display name
```

### I-6. Remove Hardcoded HD Wallet Test Mnemonic (HIGH)
**File**: `.env.local` line 42

```diff
- HD_WALLET_SEED=abandon abandon abandon abandon...
+ HD_WALLET_SEED=        # REQUIRED: Generate a new BIP39 mnemonic. NEVER use test mnemonics.
```

The "abandon" mnemonic is well-known and funds sent to its addresses will be stolen.

---

## Phase 11 — Auth, Middleware & Route Hardening

### I-7. Enforce NEXTAUTH_SECRET — No Fallback Allowed (CRITICAL)
**File**: `src/lib/auth.ts` line ~149

```diff
- secret: process.env.NEXTAUTH_SECRET || 'build-time-placeholder'
+ secret: (() => {
+   const secret = process.env.NEXTAUTH_SECRET;
+   if (!secret && process.env.NODE_ENV === 'production') {
+     throw new Error('FATAL: NEXTAUTH_SECRET must be set in production');
+   }
+   return secret || 'dev-only-placeholder-not-for-production';
+ })()
```

**Self-verification**: Deploy without NEXTAUTH_SECRET → app crashes at startup with clear error.

### I-8. Remove 14 console.log Statements from auth.ts (HIGH)
**File**: `src/lib/auth.ts`

Remove all `console.log`, `console.warn`, `console.error` statements that log:
- Email addresses
- Password validation results
- Hash lengths
- Login attempt details

Replace with structured logger that sanitizes PII:
```typescript
import { logger } from '@/lib/utils/logSanitizer';
// Replace: console.log('Login attempt for:', email)
// With: logger.info('Login attempt', { email: '[REDACTED]' })
```

### I-9. Fix Middleware Cookie Validation (HIGH)
**File**: `src/middleware.ts` lines 14-15

Current code checks cookie existence but doesn't validate JWT:
```typescript
const token = request.cookies.get('__Secure-authjs.session-token') ||
              request.cookies.get('authjs.session-token');
```

**Fix**: Add JWT signature verification:
```typescript
import { getToken } from 'next-auth/jwt';

const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
if (!token && isProtectedRoute(request.nextUrl.pathname)) {
  return NextResponse.redirect(new URL('/login', request.url));
}
```

### I-10. Resolve Duplicate Middleware Files (MEDIUM)
**Files**: `middleware.ts` (root) AND `src/middleware.ts`

Next.js only uses one. Determine which is canonical and delete the other.

**Check**: `ls -la middleware.ts src/middleware.ts` — keep the one with correct matcher config.

### I-11. Fix CORS — Ensure Localhost Not Allowed in Production (HIGH)
**File**: `middleware.ts` lines 18-25

```diff
  corsOrigins: [
    'https://1otc.cc',
    'https://stage.minimal.build.infra.1otc.cc',
-   ...(process.env.NODE_ENV === 'development' ? [
+   ...(process.env.NODE_ENV === 'development' && !process.env.VERCEL_URL ? [
      'http://localhost:3000',
      'http://localhost:3001'
    ] : [])
  ],
```

### I-12. Fix CSP — Remove unsafe-inline for Scripts (HIGH)
**File**: `next.config.js` line ~229

```diff
- script-src 'self' 'unsafe-inline' ${isDevelopment ? "'unsafe-eval'" : ''}
+ script-src 'self' 'nonce-${nonce}' ${isDevelopment ? "'unsafe-eval'" : ''}
```

Implement nonce-based CSP with `next/headers` to allow only known inline scripts.

### I-13. Reduce Memory Allocation for Build (MEDIUM)
**File**: `package.json` lines 8, 10

```diff
- "build": "NODE_OPTIONS=--max-old-space-size=4096 next build"
+ "build": "next build"
```

4GB allocation masks memory leaks. Fix the root cause instead.

---

## Phase 12 — Price Oracle, Performance, and Remaining Services

### I-14. Add Price Oracle Fallback (CRITICAL for Business Continuity)
**File**: `src/lib/price-oracle/index.ts` lines 23-59

Currently returns `null` if both REF Finance and Pyth fail. Add cached fallback:

```typescript
import { redis } from '@/lib/redis';

const PRICE_CACHE_KEY = 'price_oracle:last_known';

export async function getPrice(tokenIn: string, tokenOut: string, amountIn: string) {
  const [refQuote, pythRate] = await Promise.all([
    getRefFinanceQuote(tokenIn, tokenOut, amountIn).catch(() => null),
    getSwapRateFromPyth(tokenIn, tokenOut).catch(() => null),
  ]);

  let result;
  if (refQuote) {
    result = { source: 'ref', ...refQuote };
  } else if (pythRate) {
    result = { source: 'pyth', rate: pythRate };
  } else {
    // Fallback: last known good price (max 5 min old)
    const cached = await redis.get(`${PRICE_CACHE_KEY}:${tokenIn}:${tokenOut}`);
    if (cached) {
      result = { source: 'cache', ...JSON.parse(cached), stale: true };
    } else {
      return null; // Truly no price available
    }
  }

  // Cache successful price
  if (result.source !== 'cache') {
    await redis.setex(`${PRICE_CACHE_KEY}:${tokenIn}:${tokenOut}`, 300, JSON.stringify(result));
  }
  return result;
}
```

### I-15. Fix Path Traversal in async-io-service.ts (HIGH)
**File**: `src/lib/performance/async-io-service.ts` lines 197-254

```typescript
import path from 'path';
const ALLOWED_BASE = process.cwd();

async readFile(filePath: string, options = {}) {
  const safePath = path.resolve(filePath);
  if (!safePath.startsWith(ALLOWED_BASE)) {
    throw new Error('Path traversal attempt blocked');
  }

  const stats = await fs.stat(safePath);
  if (stats.size > 10 * 1024 * 1024) { // 10MB max
    throw new Error('File exceeds maximum allowed size');
  }
  // ... rest of implementation
}
```

### I-16. Fix Performance Monitor Memory Leak in Middleware (MEDIUM)
**File**: `middleware.ts` lines 52-102

The metrics Map grows unbounded. Add LRU eviction:

```typescript
private static readonly MAX_METRICS = 500;

static startTimer(path: string): string {
  if (this.metrics.size > this.MAX_METRICS) {
    const oldestKey = this.metrics.keys().next().value;
    this.metrics.delete(oldestKey);
  }
  // ...
}
```

### I-17. Make Redis Mandatory in Production for Rate Limiter (HIGH)
**File**: `src/lib/security/advanced-rate-limiter.ts` lines 66-75

```diff
  private async initializeRedis(): Promise<void> {
    try {
      if (process.env.REDIS_URL) {
        this.redis = new Redis(process.env.REDIS_URL);
        await this.redis.ping();
-       console.info('✅ Rate limiter connected to Redis');
+       logger.info('Rate limiter connected to Redis');
      }
+     else if (process.env.NODE_ENV === 'production') {
+       throw new Error('REDIS_URL is required in production for distributed rate limiting');
+     }
    } catch (error) {
-     console.warn('⚠️ Rate limiter falling back to memory storage:', error);
+     if (process.env.NODE_ENV === 'production') throw error;
+     logger.warn('Rate limiter falling back to memory storage (dev only)');
    }
  }
```

### I-18. Fix Exchange Rate Tolerance (MEDIUM)
**File**: `src/app/api/create-order/enhanced-route.ts` line 296

```diff
- const tolerance = expectedCantonAmount * 0.001 // 0.1% tolerance
+ const tolerance = Math.max(expectedCantonAmount * 0.005, new Decimal('0.01').toNumber()) // 0.5% or 0.01 CC minimum
```

0.1% is too strict and causes legitimate orders to fail due to floating-point rounding and race conditions.

### I-19. Remove Mock Data from securityAuditService.ts (MEDIUM)
**File**: `src/lib/canton/services/securityAuditService.ts`

Replace all mock/fake vulnerability reports with real audit logic or remove the service entirely. Mock security data causes alert fatigue and confusion.

### I-20. Fix Zustand Store Hydration Enforcement (MEDIUM)
**File**: `src/lib/canton/store/cantonStore.ts` line 462

Add runtime dev check:
```typescript
if (process.env.NODE_ENV === 'development') {
  setTimeout(() => {
    if (!useCantonStore.persist.hasHydrated()) {
      console.error('HYDRATION WARNING: useHydrateCantonStore() was not called. State may be stale.');
    }
  }, 3000);
}
```

### I-21. Persist Circuit Breaker State (MEDIUM)
**File**: `src/lib/performance/async-io-service.ts` lines 495-534

Circuit breaker state resets on restart, causing immediate hammering of failed services. Store state in Redis:
```typescript
async getCircuitState(name: string): Promise<CircuitState> {
  const cached = await redis.get(`circuit:${name}`);
  return cached ? JSON.parse(cached) : { state: 'CLOSED', failures: 0 };
}
```

---

## Phase 13 — Test Infrastructure & Build Quality

### I-22. Raise Vitest Coverage Thresholds (MEDIUM)
**File**: `vitest.config.ts` lines 24-28

```diff
  thresholds: {
-   lines: 50,
-   functions: 50,
-   branches: 50,
-   statements: 50
+   lines: 80,
+   functions: 75,
+   branches: 70,
+   statements: 80
  }
```

### I-23. Fix Vitest Integration Config Environment (MEDIUM)
**File**: `vitest.integration.config.ts` line 6

```diff
- environment: 'jsdom'
+ environment: 'node'
```

Integration tests for API routes need Node environment, not browser emulation.

### I-24. Increase Image Cache TTL (LOW)
**File**: `next.config.js` line 35

```diff
- minimumCacheTTL: 60
+ minimumCacheTTL: 3600
```

60 seconds forces excessive revalidation. 1 hour is standard.

### I-25. Fix Supabase Connection Test (MEDIUM)
**File**: `src/app/api/create-order/route.ts` lines 279-307

Current test only checks read permission. Must also verify write:
```typescript
// Test write permission too
const { error: writeError } = await supabase
  .from('public_orders')
  .insert({ order_id: 'connection-test', status: 'test' })
  .select();
if (!writeError) {
  // Clean up test row
  await supabase.from('public_orders').delete().eq('order_id', 'connection-test');
}
```

### I-26. Add RLS Policy Verification Script (HIGH)
**New file**: `scripts/verify-rls.sql`

```sql
-- Verify RLS is enabled on all critical tables
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('public_orders', 'users', 'wallets', 'transactions')
  AND rowsecurity = false;

-- Should return 0 rows. Any row means RLS is not enabled.
```

Add to CI/CD pipeline as deployment gate.

---

## UPDATED VULNERABILITY REGISTRY (v3.0)

### New findings in this pass: 26 items

| ID | Severity | File | Issue |
|----|----------|------|-------|
| I-1 | CRITICAL | package.json | 6 known CVEs in transitive deps |
| I-2 | HIGH | package.json | @types/* in production dependencies |
| I-3 | HIGH | package.json | NEAR wallet selector version mismatch |
| I-4 | MEDIUM | root/ | 3 stale .env files causing confusion |
| I-5 | MEDIUM | .env.example | Missing 4 required auth variables |
| I-6 | HIGH | .env.local | Hardcoded test mnemonic (well-known "abandon") |
| I-7 | CRITICAL | src/lib/auth.ts | NEXTAUTH_SECRET falls back to placeholder |
| I-8 | HIGH | src/lib/auth.ts | 14 console.logs leak auth PII |
| I-9 | HIGH | src/middleware.ts | Cookie existence check without JWT validation |
| I-10 | MEDIUM | root + src/ | Duplicate middleware.ts files |
| I-11 | HIGH | middleware.ts | CORS may allow localhost in production |
| I-12 | HIGH | next.config.js | CSP allows unsafe-inline for scripts |
| I-13 | MEDIUM | package.json | 4GB memory allocation masks build issues |
| I-14 | CRITICAL | src/lib/price-oracle/index.ts | No fallback when both oracles fail |
| I-15 | HIGH | src/lib/performance/async-io-service.ts | Path traversal vulnerability |
| I-16 | MEDIUM | middleware.ts | Performance metrics Map grows unbounded |
| I-17 | HIGH | src/lib/security/advanced-rate-limiter.ts | Redis fallback to memory in production |
| I-18 | MEDIUM | enhanced-route.ts | Exchange rate tolerance too strict (0.1%) |
| I-19 | MEDIUM | securityAuditService.ts | Mock vulnerability data causes confusion |
| I-20 | MEDIUM | cantonStore.ts | No hydration enforcement |
| I-21 | MEDIUM | async-io-service.ts | Circuit breaker resets on restart |
| I-22 | MEDIUM | vitest.config.ts | Coverage thresholds at 50% (should be 80%) |
| I-23 | MEDIUM | vitest.integration.config.ts | Wrong env: jsdom instead of node |
| I-24 | LOW | next.config.js | Image cache TTL only 60 seconds |
| I-25 | MEDIUM | create-order/route.ts | Supabase test checks read but not write |
| I-26 | HIGH | deployment | No RLS policy verification script |

---

## UPDATED SUCCESS CRITERIA (v3.0)

## Dependencies & Build
- [ ] `pnpm audit --audit-level=high` returns 0 vulnerabilities
- [ ] All `@types/*` packages in devDependencies, not dependencies
- [ ] `@near-wallet-selector/near-wallet` version matches other wallet-selector packages
- [ ] No stale `.env.*` files in project root (only `.env.example` and `.env.production`)
- [ ] `.env.example` documents ALL required environment variables
- [ ] No test mnemonics or well-known seeds in any env file

## Auth & Middleware
- [ ] NEXTAUTH_SECRET throws on missing in production (no fallback)
- [ ] No console.log/warn/error in auth.ts (use structured logger)
- [ ] Middleware validates JWT signature, not just cookie existence
- [ ] Single middleware.ts file (no duplicates)
- [ ] CORS whitelist does not include localhost in production
- [ ] CSP uses nonces instead of unsafe-inline for scripts

## Services & Infrastructure
- [ ] Price oracle has cached fallback when both sources fail
- [ ] async-io-service validates paths against traversal
- [ ] Rate limiter requires Redis in production
- [ ] Performance metrics Map has max size / LRU eviction
- [ ] Circuit breaker state persisted to Redis
- [ ] Exchange rate tolerance is 0.5% (not 0.1%)
- [ ] securityAuditService has no mock data
- [ ] RLS policies verified in CI/CD pipeline

## Tests
- [ ] Vitest coverage thresholds ≥80% lines
- [ ] Integration tests use Node environment, not jsdom
- [ ] Supabase connection test verifies write permissions

---

# END OF PROMPT

**Total Vulnerability Count**: ~221 findings across all audit passes (v1.0: 149, v2.0: +46, v3.0: +26)
**Estimated Execution Time**: 7-9 hours for an expert-level AI agent
**Execution Order**: Phase 0 (secrets) → Phase 1 (Daml) → Phases 2-7 (parallel-capable) → Phase 8 (DevNet) → Phases 10-13 (parallel-capable, can run with 2-7)
**Critical Dependency**: Phase 0 MUST complete before any deployment
