# Canton OTC Platform: Full Audit, Bug Fix & Hardening Prompt

---

# SECTION A: EXECUTIVE REVIEW (READ BEFORE EXECUTING)

This section is a human-readable summary of every critical finding across the entire Canton OTC codebase. Read it first, make corrections or priorities, then hand off Section B as a self-contained execution prompt.

---

## A.1 Platform Overview

Canton OTC is a **hybrid OTC trading platform** with two parallel operational modes:

1. **Decentralized DeFi Layer** - Daml smart contracts on Canton Network for trustless treasury bill trading, real estate tokenization, privacy vaults, and multi-party workflows.
2. **Centralized Customer Service Layer** - Next.js 15 API routes handling order creation, Supabase storage, Telegram/Intercom notifications, Google Sheets backup, and manual operator workflows.

### Technology Stack
- **Smart Contracts**: Daml (5 contracts: OtcOffer, Settlement, Collateral, Escrow, OtcTypes)
- **Backend**: Next.js 15 + TypeScript 5.9 (54 API routes)
- **Frontend**: React 19 + Tailwind CSS + Framer Motion
- **Database**: Supabase (PostgreSQL) as primary, Google Sheets as legacy backup
- **Rust SDK**: `cantonnet-omnichain-sdk` with 12 crates (bridge, crypto, wallet, ledger-api)
- **Deployment**: Kubernetes + Docker + GitHub Actions CI/CD
- **Multi-chain**: Ethereum, BSC, TRON, Solana, Optimism (USDT stablecoins)

---

## A.2 Critical Findings Summary

### P0 - IMMEDIATE (Production Blockers)

| # | Finding | Location | Impact |
|---|---------|----------|--------|
| 1 | **Mock ledger fallback in production** - If `@daml/ledger` not installed or `NEXT_PUBLIC_DAML_USE_REAL_LEDGER` not set, the service silently falls back to a mock that creates fake contracts. Orders execute against non-existent ledger. | `damlIntegrationService.ts:600-700` | **Fund loss**: Orders appear confirmed but no real contract exists |
| 2 | **No unique payment address per order** - API returns `paymentAddress: null`. Customer gets no deposit address. Current flow requires manual support to provide address. | `create-order/route.ts:130` | **Broken OTC flow**: Customer cannot complete payment without manual intervention |
| 3 | **All oracle/price feeds are mock data** - OracleService returns hardcoded prices (BTC=95000, ETH=3500). Treasury yields are static. No real API integration. | `oracleService.ts` (all fetch methods) | **Incorrect pricing**: All yield calculations, portfolio values, and price displays are fabricated |
| 4 | **All Canton Network endpoints disabled** - `realCantonIntegration.ts` has all external API URLs commented out. Returns mock data only. | `realCantonIntegration.ts` | **No real blockchain connectivity** |
| 5 | **Privacy vault proof generation is stubbed** - `generateProof()` returns null. `validateVaultConfig()`, `validateDepositPermissions()`, `generateAssetComplianceProofs()` are empty functions. | `privacyVaultService.ts`, `usePrivacyVaults.ts` | **Privacy features non-functional** |

### P1 - URGENT (Security & Financial Risk)

| # | Finding | Location | Impact |
|---|---------|----------|--------|
| 6 | **0.5% exchange rate tolerance exploitable** - Attacker can systematically extract ~$50 per $10K order by sending slightly off-rate calculations that pass tolerance check. | `create-order/route.ts:520-600` | **Financial leakage**: Accumulates over time |
| 7 | **Compliance service has no real provider integration** - `isMixerAddress()` and `isHighRiskExchange()` always return false. Sanctions check always returns `isMatch: false`. | `complianceService.ts:400-420` | **Regulatory violation**: No actual AML/sanctions screening |
| 8 | **Rate limiter is in-memory only** - Resets on server restart. No distributed state for multi-pod K8s deployment. | `rateLimiter.ts` | **Bypassable**: Restart pod to clear limits |
| 9 | **Dividend calculation uses 365 days/year** - Ignores leap years. Over 4 years, accumulated error = ~1 day of yield per investor. | `treasuryBillsService.ts` (`distributeYield()`) | **Financial miscalculation** |
| 10 | **Exchange rate monitor has no circuit breaker** - Only logs warnings. Trading continues even during critical rate manipulation. | `exchange-rate-monitor.ts` | **No protection against rate manipulation** |
| 11 | **No settlement timeout in Daml contracts** - If buyer never confirms payment, settlement stays pending forever. | `Settlement.daml` | **Indefinite fund lock** |
| 12 | **Buy/sell direction can be manipulated** - Frontend sends `exchangeDirection` which determines price. If attacker sends opposite direction, different price is applied. | `create-order/route.ts:400-450` | **Price manipulation** |

### P2 - IMPORTANT (Architecture & Reliability)

| # | Finding | Location | Impact |
|---|---------|----------|--------|
| 13 | **Supabase connection test on every order** - Adds extra DB query before every insert. | `create-order/route.ts:900` | **Performance**: 2x DB calls per order |
| 14 | **Google Sheets as legacy backup inconsistent** - Async save can fail silently. No reconciliation job exists. | `create-order/route.ts` (processNotificationsAsync) | **Data inconsistency** |
| 15 | **No order expiration/timeout** - "awaiting-deposit" orders never auto-cancel. | `create-order/route.ts` | **Zombie orders accumulate** |
| 16 | **No idempotency key for order creation** - Double-submit creates duplicate orders. | `create-order/route.ts` | **Duplicate orders** |
| 17 | **Order status endpoint has no auth** - Any user can query any orderId. | `order-status/[orderId]/route.ts` | **Information disclosure** |
| 18 | **Session tokens stored in-memory Map** - AuthService sessions lost on restart. | `authService.ts` | **Session loss on restart** |
| 19 | **Escrow has no partial release** - Only full release or full refund. | `Escrow.daml` | **Inflexible escrow** |
| 20 | **Multi-party workflow has no rejection** - Transactions can only be approved or stall forever. | `useMultiPartyWorkflowService.ts` | **Workflow deadlock** |
| 21 | **Receiving addresses are hardcoded hot wallets** - ETH/BSC/TRON addresses in config are single-sig. | `otc.ts` | **Single point of failure** |
| 22 | **Real estate service uses all mock integrations** - GoldmanSachsRealEstateAPI, CantonRealEstateIntegration, ComplianceEngine, AIPropertyValuation are all mock classes. | `realEstateService.ts` | **Non-functional feature** |

### P3 - NICE TO HAVE (Improvements)

| # | Finding | Location | Impact |
|---|---------|----------|--------|
| 23 | **Canton address validation has no checksum** - 4 formats validated by regex only. | `cantonValidation.ts` | **Address typo risk** |
| 24 | **useCantonPortfolio hardcoded 125.80 conversion rate** | `useCantonPortfolio.ts` | **Incorrect portfolio value** |
| 25 | **Treasury yield accrual only at purchase time** - No daily/hourly compounding. | `useTreasuryBills.ts` | **Inaccurate yield display** |
| 26 | **Bridge fee calculation hardcoded** - 0.1% base fee, no oracle. | `useCantonBridge.ts` | **Static fees** |

---

## A.3 Architectural Diagram (Current State)

```
USER (Browser)
  │
  ├─► [Next.js Frontend] ──────────────────────────────────┐
  │     React 19 + Tailwind                                  │
  │     Components: TreasuryBillsPanel, CCPurchaseWidget,    │
  │     StablecoinSelector, PrivacyVaultsPanel,              │
  │     RealEstatePanel, MultiPartyDashboard                 │
  │                                                          │
  │     React Hooks (8):                                     │
  │     useTreasuryBills, usePrivacyVaults, useRealEstate,   │
  │     useCantonBridge, useCantonNetwork,                   │
  │     useCantonPortfolio, useMultiPartyWorkflowService,    │
  │     realCantonIntegration                                │
  │                                                          │
  ├─► [Next.js API Routes] (54 endpoints)                    │
  │     POST /api/create-order ──────► Supabase (primary)    │
  │     GET  /api/order-status/[id]     Google Sheets (legacy)│
  │     POST /api/defi/auth/login       Telegram Bot          │
  │     POST /api/defi/compliance/kyc   Intercom              │
  │     GET  /api/defi/oracle/prices                          │
  │     POST /api/defi/treasury/purchases                     │
  │                                                          │
  ├─► [Backend Services Layer]                               │
  │     DamlIntegrationService ──► Canton Participant (gRPC)  │
  │       ⚠️ Falls back to MOCK if SDK missing               │
  │     TreasuryBillsService (in-memory Maps)                │
  │     ComplianceService (⚠️ stub providers)                │
  │     OracleService (⚠️ all mock prices)                   │
  │     AuthService (Supabase Auth + in-memory sessions)     │
  │     RealEstateService (⚠️ all mock integrations)         │
  │     PrivacyVaultService (⚠️ stub proof generation)       │
  │                                                          │
  ├─► [Daml Smart Contracts]                                 │
  │     OtcOffer.daml  ── Accept/Cancel/Settle/Dispute       │
  │     Settlement.daml ── ConfirmPayment/Complete/Fail      │
  │     Collateral.daml ── Lock/Release/Forfeit/AutoRelease  │
  │     Escrow.daml ── Deposit/Release/Refund/Arbitrate      │
  │     OtcTypes.daml ── Shared types                        │
  │                                                          │
  └─► [Rust SDK] (cantonnet-omnichain-sdk)                   │
        12 crates: bridge-core, canton-core, canton-ledger-api│
        canton-crypto, canton-wallet, canton-observability,   │
        canton-reliability, canton-transport, bsc-client,     │
        bridge-orchestrator, bridge-db, bridge-api            │
```

---

## A.4 File Inventory (Key Files to Audit & Fix)

### Smart Contracts
- `canton/daml/OtcOffer.daml` - Main OTC template
- `canton/daml/Settlement.daml` - Settlement lifecycle
- `canton/daml/Collateral.daml` - Collateral management
- `canton/daml/Escrow.daml` - Escrow with arbitration
- `canton/daml/OtcTypes.daml` - Shared types

### Core Services (TypeScript)
- `src/lib/canton/services/damlIntegrationService.ts` - Daml SDK wrapper (mock fallback risk)
- `src/lib/canton/services/treasuryBillsService.ts` - Treasury bill CRUD + yield distribution
- `src/lib/canton/services/complianceService.ts` - KYC/AML (stub providers)
- `src/lib/canton/services/oracleService.ts` - Price feeds (all mock)
- `src/lib/canton/services/authService.ts` - Auth + sessions (in-memory)
- `src/lib/canton/services/realEstateService.ts` - Real estate tokenization (all mock)
- `src/lib/canton/services/privacyVaultService.ts` - Privacy vaults (stub proofs)

### API Routes
- `src/app/api/create-order/route.ts` - Main OTC order creation (~500 lines)
- `src/app/api/order-status/[orderId]/route.ts` - Order status query
- `src/app/api/defi/auth/login/route.ts` - Authentication
- `src/app/api/defi/treasury/purchases/route.ts` - Treasury purchases
- `src/app/api/defi/compliance/kyc/route.ts` - KYC submission

### Integration Services
- `src/lib/services/rateLimiter.ts` - Rate limiting (in-memory)
- `src/lib/services/antiSpamService.ts` - Spam detection (in-memory)
- `src/lib/services/cantonValidation.ts` - Address validation (4 formats)
- `src/lib/services/googleSheets.ts` - Legacy order backup
- `src/lib/services/telegram.ts` - Notification service
- `src/lib/services/intercom.ts` - Customer support integration
- `src/lib/monitoring/exchange-rate-monitor.ts` - Rate deviation tracking

### React Hooks
- `src/lib/canton/hooks/useTreasuryBills.ts`
- `src/lib/canton/hooks/usePrivacyVaults.ts`
- `src/lib/canton/hooks/useRealEstate.ts`
- `src/lib/canton/hooks/useCantonBridge.ts`
- `src/lib/canton/hooks/useCantonNetwork.ts`
- `src/lib/canton/hooks/useCantonPortfolio.ts`
- `src/lib/canton/hooks/useMultiPartyWorkflowService.ts`
- `src/lib/canton/hooks/realCantonIntegration.ts`

### Configuration
- `src/config/otc.ts` - OTC config, prices, tokens, discount tiers

---

## A.5 Correction Checklist (For Human Review Before Execution)

Before executing Section B, verify or update these items:

- [ ] **Priority Override**: Reorder P0-P3 items if your business needs differ
- [ ] **Mock vs Real Decision**: Which services should stay mock for now vs get real providers?
  - [ ] Oracle prices: Keep mock or integrate CoinGecko/Pyth?
  - [ ] Compliance: Keep mock or integrate Chainalysis/SumSub?
  - [ ] Canton Network: Keep mock or connect to testnet?
  - [ ] Real Estate: Keep mock or defer to later phase?
- [ ] **Payment Address**: Is manual support flow intentional or should HD wallet address generation be implemented?
- [ ] **Receiving Addresses**: Should hot wallets be upgraded to multi-sig?
- [ ] **Rate Limiter**: Should Redis be introduced for distributed limiting?
- [ ] **Test Coverage**: What coverage target? (Currently targets 85%)
- [ ] **Deployment**: Are K8s ConfigMaps and Secrets properly configured?

---

# SECTION B: EXECUTION PROMPT

---

You are a senior full-stack blockchain engineer specializing in Daml smart contracts, TypeScript/Node.js backend systems, React frontends, and enterprise OTC trading platforms. You have deep expertise in financial security, compliance (KYC/AML), and smart contract auditing.

## Your Mission

Perform a **comprehensive audit, bug fix, and hardening** of the Canton OTC platform. Work through every layer systematically: smart contracts, backend services, API routes, frontend hooks, and integration services.

## Context

This is a hybrid OTC trading platform:
- **Decentralized**: Daml smart contracts on Canton Network for treasury bills, real estate tokens, privacy vaults
- **Centralized**: Next.js API for order creation, Supabase storage, Telegram/Intercom notifications
- **Multi-chain**: USDT on Ethereum, BSC, TRON, Solana, Optimism

The codebase has multiple services using in-memory Maps for state, mock integrations for external providers, and some critical flows that are incomplete.

## Execution Plan

Work through these phases in order. For each phase, read the relevant files, identify all issues, fix them, and write tests.

---

### Phase 1: Smart Contract Hardening (Daml)

**Files**: `canton/daml/*.daml`

**Tasks**:
1. **OtcOffer.daml**: Add `ensure initiator /= counterparty` guard. Verify all state transitions are valid and complete. Add expiry timestamp validation (cannot be in past, max 90 days future). Verify quantity bounds on Accept choice.

2. **Settlement.daml**: Add automatic timeout - if payment not confirmed within `settlementDeadline`, settlement auto-fails. Add guard against double-confirmation by same party. Ensure `CompleteSettlement` checks all required confirmations.

3. **Collateral.daml**: Verify `AutoRelease` correctly frees expired locks. Add validation that `Forfeit` can only be called by operator. Ensure `TopUp` amount is positive.

4. **Escrow.daml**: Add partial release mechanism. Add deadline validation (cannot extend past maximum). Verify arbiter cannot self-deal.

5. **OtcTypes.daml**: Add numeric range validation on Price (positive, max 1e12), VolumeLimits (min < max, both positive).

**Tests to write**: Create Daml scenario tests for each contract covering:
- Happy path (create, accept, settle)
- Edge case (partial fill, cancel after accept, expire during settlement)
- Attack vector (double-accept, self-trade, price overflow)

---

### Phase 2: Critical Backend Service Fixes

**Files**: `src/lib/canton/services/*.ts`

#### 2.1 DamlIntegrationService.ts - CRITICAL

**Fix mock fallback risk**:
```
Current (DANGEROUS):
if (useRealLedger && Ledger) { ... } else { this.ledger = await this.createMockLedger(); }

Required:
- In production, if Ledger is not available, THROW ERROR instead of falling back to mock
- Add health check endpoint that reports if using real or mock ledger
- Add startup validation that refuses to start in production with mock
- Log clearly: "PRODUCTION MODE: Using REAL Daml Ledger" or FAIL
```

**Fix cache invalidation**: Add TTL to all Maps (assetContracts, holdingContracts, purchaseRequests). Stale cache can cause double-spend.

**Fix deduplication**: Add command ID tracking to prevent duplicate contract execution on retry.

#### 2.2 TreasuryBillsService.ts

**Fix dividend calculation**: Replace `/365` with proper day-count convention. Use `Decimal` for all yield calculations. Add duplicate distribution check (per-period, per-bill).

**Fix supply race condition**: In `createPurchaseRequest()`, check-then-create has race condition. Add optimistic locking or Daml contract-level atomicity.

**Fix ID generation**: `Math.random().toString(36).substr(2, 9)` is not cryptographically secure. Use `crypto.randomUUID()`.

#### 2.3 ComplianceService.ts

**Mark stub methods clearly**: `isMixerAddress()` and `isHighRiskExchange()` always return false. Add `// TODO: Integrate with {provider}` comments and a health check that reports "STUB" vs "LIVE" for each provider.

**Add sanctions list caching**: Even if stub, structure the code to accept real OFAC/EU lists. Add update frequency tracking.

#### 2.4 OracleService.ts

**Mark all mock prices clearly**: Every mock method should log `MOCK_DATA` level warning. Add a `getDataSourceStatus()` method that reports which providers are real vs mock.

**Add price staleness detection**: If cache is > 5 minutes old for crypto, log warning. If > 1 hour for treasury yields, log warning.

#### 2.5 AuthService.ts

**Fix in-memory session store**: Sessions in `Map<string, Session>` are lost on restart. Either persist to Supabase or use JWT-only validation (Supabase already handles this).

**Add password strength validation**: Currently no enforcement on registration.

**Add account lockout**: After 5 failed login attempts, lock for 15 minutes.

---

### Phase 3: API Route Security & Validation

**Files**: `src/app/api/**/*.ts`

#### 3.1 POST /api/create-order

**Fix tolerance exploitation**: Reduce tolerance from 0.5% to 0.1% or implement server-side price calculation (ignore client-sent cantonAmount, compute it server-side).

**Add idempotency key**: Accept `X-Idempotency-Key` header. If duplicate key within 5 minutes, return cached response.

**Remove connection test overhead**: Remove `testSupabaseConnection()` call before every insert. Use connection pool health check instead.

**Add order expiration**: Set `expires_at` = now + 24 hours. Add cron job or DB trigger to auto-cancel expired orders.

**Fix exchange direction validation**: Server must independently validate that `exchangeDirection` matches the price being used. Do not trust client.

**Add circuit breaker**: If exchange rate monitor detects > 5 critical deviations in 1 hour, pause order creation and alert admin.

#### 3.2 GET /api/order-status/[orderId]

**Add authentication**: Require either session token or email verification to query order.

**Add rate limiting**: Max 10 queries per minute per IP.

**Sanitize response**: Remove internal fields. Only return: orderId, status, createdAt, paymentNetwork, paymentToken.

#### 3.3 Auth endpoints

**Add email verification**: Require email confirmation before allowing order creation.

**Add CSRF protection**: For state-changing operations.

---

### Phase 4: Integration Service Hardening

#### 4.1 Rate Limiter (`rateLimiter.ts`)

**Add persistence**: Store rate limit counters in Supabase or Redis instead of in-memory Map. If Redis not available, use Supabase with upsert.

**Add distributed awareness**: In K8s multi-pod setup, share limits via database.

#### 4.2 Anti-Spam Service (`antiSpamService.ts`)

**Add database persistence**: Move spam records from in-memory to Supabase. Add `spam_events` table.

**Add configurable blocking duration**: Currently hardcoded. Make configurable via env.

#### 4.3 Exchange Rate Monitor (`exchange-rate-monitor.ts`)

**Add circuit breaker**: When `checkSuspiciousPatterns()` detects anomaly, set a flag that `create-order` checks before processing. Export `isCircuitBreakerOpen()` function.

**Add Supabase logging**: Store deviation history in `rate_deviations` table for audit.

#### 4.4 Canton Validation (`cantonValidation.ts`)

**Add checksum validation**: For Ethereum-format addresses, validate checksum (EIP-55). For Canton addresses, validate namespace format.

**Restrict refund address formats**: Only accept addresses matching the payment token network. If paying with TRON USDT, refund address must be TRON format.

---

### Phase 5: Frontend Hook Fixes

**Files**: `src/lib/canton/hooks/*.ts`

#### 5.1 useCantonPortfolio.ts
**Fix**: Remove hardcoded 125.80 conversion rate. Fetch from ConfigManager or OracleService.

#### 5.2 usePrivacyVaults.ts
**Fix**: Connect `generateProof` to PrivacyVaultService implementation. If service is stub, return clear error message instead of null.

#### 5.3 useTreasuryBills.ts
**Fix**: Add yield accrual tracking. Calculate accumulated yield based on time held, not just purchase-time snapshot.

#### 5.4 useCantonBridge.ts
**Fix**: Make bridge fee configurable via ConfigManager instead of hardcoded 0.1%.

---

### Phase 6: Testing & Validation

**Write tests for every fix above using the existing test infrastructure**:

1. **Unit Tests** (Vitest):
   - DamlIntegrationService: Test that production mode refuses mock fallback
   - TreasuryBillsService: Test dividend calculation precision with leap year
   - ComplianceService: Test that stub status is reported correctly
   - AuthService: Test session persistence and lockout
   - Rate Limiter: Test concurrent access and limit enforcement

2. **Integration Tests**:
   - End-to-end order creation: create-order -> Supabase -> Telegram -> status query
   - Exchange rate validation: Test tolerance enforcement
   - Idempotency: Test duplicate order prevention

3. **API Tests**:
   - create-order with invalid exchange direction
   - create-order with tolerance exploitation attempt
   - order-status without authentication (should fail)
   - Rate limit enforcement (send 4 orders in 1 hour, 4th should fail)

4. **Build Verification**:
   - Run `pnpm build` and fix any TypeScript compilation errors
   - Run `pnpm test` and ensure all tests pass
   - Run `pnpm lint` and fix linting issues

---

### Phase 7: Documentation & Health Checks

1. **Add `/api/health` endpoint** that reports:
   - Supabase connection status
   - Daml ledger status (REAL vs MOCK)
   - Oracle data source status (REAL vs MOCK per provider)
   - Compliance provider status (REAL vs MOCK)
   - Rate limiter type (MEMORY vs REDIS vs SUPABASE)
   - Last rate deviation alert timestamp

2. **Add TODO comments** to every stub/mock method with format:
   ```typescript
   // TODO [P0]: Replace mock with real Chainalysis integration
   // Current: Always returns false (no screening)
   // Required: API call to Chainalysis with wallet address
   // Ticket: CANTON-XXX
   ```

---

## Output Format

For each fix, provide:
1. **File path** and line numbers
2. **Before** code (what exists)
3. **After** code (what you changed)
4. **Rationale** (why this fix is needed)
5. **Test** (how to verify the fix)

Group fixes by phase. After all fixes, run the full test suite and build to verify no regressions.

---

## Constraints

- Do NOT break existing API contracts. All current request/response formats must remain backward compatible.
- Do NOT add new npm dependencies unless absolutely necessary. Prefer built-in Node.js APIs.
- Do NOT modify Kubernetes manifests or CI/CD pipelines unless a service change requires it.
- Preserve all existing working functionality. Fix bugs, don't rewrite features.
- Use `Decimal` (from decimal.js, already installed) for all financial calculations. Never use JavaScript `Number` for money.
- Follow existing code style: TypeScript strict mode, ESLint + Prettier formatting.
- All IDs should use `crypto.randomUUID()` instead of `Math.random()`.

---

## Success Criteria

- [ ] All P0 issues have clear error messages or fixes (no silent mock fallback in production)
- [ ] All P1 issues are fixed with tests proving the fix
- [ ] All P2 issues are addressed or have TODO tickets
- [ ] `pnpm build` succeeds with 0 TypeScript errors
- [ ] `pnpm test` passes with >85% coverage on critical paths
- [ ] `/api/health` endpoint accurately reports system status
- [ ] No new security vulnerabilities introduced (no hardcoded secrets, no SQL injection, no XSS)
