# 04 — Acceptance Criteria

Measurable, verifiable criteria for each milestone. The Tech & Ops Committee evaluates these.

---

## Milestone 1: DeFi DAML Primitives

### M1-AC-1: All 6 templates compile and pass `daml build`
```bash
cd canton/daml && daml build
# Exit code 0, produces .dar file containing:
#   MatchingEngine, LiquidityPool, PriceOracle,
#   AtomicSwap, MultiPartySettlement, ComplianceGateway
```

### M1-AC-2: 20+ test scenarios pass via `daml test`
```bash
cd canton/daml && daml test
# All scenarios pass:
#   testMatchingEngine_LimitOrderMatch
#   testMatchingEngine_PartialFill
#   testMatchingEngine_PriceTimePriority
#   testMatchingEngine_CancelOrder
#   testLiquidityPool_AddLiquidity
#   testLiquidityPool_RemoveLiquidity
#   testLiquidityPool_Swap
#   testLiquidityPool_SlippageProtection
#   testPriceOracle_SubmitPrice
#   testPriceOracle_MedianAggregation
#   testPriceOracle_StaleDataRejection
#   testAtomicSwap_HappyPath
#   testAtomicSwap_Timeout
#   testAtomicSwap_RefundOnFailure
#   testMultiPartySettlement_TwoPartyNetting
#   testMultiPartySettlement_ThreePartyNetting
#   testMultiPartySettlement_PartialSettle
#   testComplianceGateway_AccreditedPass
#   testComplianceGateway_RetailReject
#   testComplianceGateway_JurisdictionBlock
```

### M1-AC-3: Composability demonstration
- Test script that creates OtcOffer → matches via MatchingEngine → settles via MultiPartySettlement → all in one workflow

### M1-AC-4: DAR published as GitHub Release
- Downloadable .dar artifact attached to tagged release
- README with import instructions for third-party DAML projects

### M1-AC-5: CIP-0056 compatibility
- All new templates accept CIP-0056 token identifiers as asset references
- Test script demonstrates trading CIP-0056 token via MatchingEngine

---

## Milestone 2: Rust SDK v1.0

### M2-AC-1: `cargo check` passes for all crates
```bash
cd cantonnet-omnichain-sdk && cargo check --workspace
# Zero errors, zero warnings (deny(warnings) in CI)
```

### M2-AC-2: Published on crates.io
```bash
cargo install canton-cli
canton-cli --version
# canton-cli 1.0.0

# In any Rust project:
# Cargo.toml:
# [dependencies]
# canton-sdk = "1.0"
# canton-defi = "1.0"
```

### M2-AC-3: docs.rs documentation live
- https://docs.rs/canton-sdk — all public APIs documented
- Code examples for: connect, create contract, exercise choice, query ACS
- Code examples for: create order, match, swap, add liquidity

### M2-AC-4: Integration test suite against Canton Sandbox
```bash
docker compose -f docker-compose.local-test.yml up -d
cargo test --package canton-sdk --features integration
# 30+ integration tests pass:
#   test_connect_to_sandbox
#   test_create_otc_offer
#   test_accept_otc_offer
#   test_cancel_otc_offer
#   test_create_escrow
#   test_deposit_escrow
#   test_matching_engine_place_order
#   test_matching_engine_match
#   test_liquidity_pool_add
#   test_liquidity_pool_swap
#   test_price_oracle_submit
#   test_price_oracle_query
#   test_atomic_swap_execute
#   test_atomic_swap_timeout
#   ...
```

### M2-AC-5: CLI tool functional
```bash
canton-cli connect --host localhost --port 5011
canton-cli parties list
canton-cli contracts list --template OtcOffer
canton-cli offer create --initiator alice --asset USDT --quantity 1000 --price 0.77
canton-cli offer accept --contract-id <cid> --acceptor bob
canton-cli pool add-liquidity --pool-id pool1 --amount-a 1000 --amount-b 770
canton-cli oracle price --asset CC/USDT
```

### M2-AC-6: Reliability patterns verified
- Circuit breaker test: disconnect Canton → SDK returns CircuitOpen error within 5s → reconnects automatically when Canton returns
- Retry test: transient gRPC UNAVAILABLE → 3 retries with exponential backoff → succeeds
- Rate limiter test: 100 requests burst → governor limits to configured rate

---

## Milestone 3: REST API v2 + Reference dApp

### M3-AC-1: OpenAPI 3.1 spec passes validation
```bash
npx @redocly/cli lint openapi.yaml
# No errors
# 35+ endpoints documented
# All request/response schemas defined
```

### M3-AC-2: All API endpoints respond correctly
```bash
# DeFi endpoints:
POST   /api/v2/orders           → 201 Created (order placed)
GET    /api/v2/orders           → 200 OK (paginated list)
DELETE /api/v2/orders/{id}      → 200 OK (order cancelled)
GET    /api/v2/orderbook/{pair} → 200 OK (real-time book)
POST   /api/v2/swap             → 201 Created (atomic swap)
GET    /api/v2/pools            → 200 OK (pool list)
POST   /api/v2/pools/{id}/add   → 201 Created (add liquidity)
POST   /api/v2/pools/{id}/remove → 200 OK (remove liquidity)
GET    /api/v2/oracle/price/{asset} → 200 OK (latest price)
GET    /api/v2/oracle/history/{asset} → 200 OK (price history)
POST   /api/v2/settle/batch     → 201 Created (batch settlement)
GET    /api/v2/portfolio/{party} → 200 OK (holdings + P&L)
WS     /api/v2/stream/orderbook → Streaming orderbook updates
WS     /api/v2/stream/trades    → Streaming trade events
WS     /api/v2/stream/prices    → Streaming oracle prices
```

### M3-AC-3: Frontend renders all views
- Orderbook: bids/asks with depth visualization, updated via WebSocket
- Pool dashboard: TVL, APY, add/remove liquidity forms
- Portfolio: token balances, trade history, P&L calculation
- Price chart: TradingView-compatible candlestick chart from oracle data

### M3-AC-4: E2E test on Canton testnet
```
1. Alice connects wallet (CIP-0103)
2. Alice places limit buy order: 1000 CC at $0.75
3. Bob connects wallet
4. Bob places limit sell order: 500 CC at $0.75
5. MatchingEngine matches → 500 CC trade
6. Escrow locks both sides
7. Settlement confirms (2 confirmations)
8. Alice receives 500 CC, Bob receives 375 USDT
9. Alice's remaining 500 CC order stays in book
10. CIP-0047 activity markers emitted for both parties
```

### M3-AC-5: CIP-0047 integration
- Every trade emits activity marker parseable by Canton Featured App infrastructure
- Demonstrated by querying activity via Ledger API after E2E test

---

## Milestone 4: Production Hardening + Documentation

### M4-AC-1: Security audit report
- All DAML contracts reviewed for:
  - Authorization bypass (every choice checks controller)
  - Self-trade prevention
  - Integer overflow/underflow on Decimal operations
  - Time-based attacks (expiry manipulation)
  - Re-entrancy via nested exercises
  - Observer information leakage
- Report published in repository with findings + resolutions

### M4-AC-2: Load test results
```
Tool: k6 or custom Rust load generator
Target: Canton testnet via REST API v2
Scenario: 100 concurrent users placing/matching/settling orders
Metrics:
  - p50 latency < 200ms (order placement)
  - p99 latency < 2s (order placement)
  - p50 latency < 500ms (matching + settlement)
  - Zero failed settlements under load
  - Zero data inconsistencies (ACS matches expected state)
```

### M4-AC-3: Mainnet deployment verified
```bash
curl https://1otc.cc/api/health
# {"status":"healthy","connected":true,"mode":"daml-ledger-api-v2","version":"2.0.0"}

curl https://1otc.cc/api/v2/oracle/price/CC-USDT
# {"asset":"CC-USDT","price":"0.77","confidence":0.95,"timestamp":"...","sources":3}
```

### M4-AC-4: Documentation complete
- `docs/getting-started.md` — 0-to-running in <15 minutes
- `docs/tutorials/` — 5 tutorials (create offer, match, pool, oracle, settle)
- `docs/api-reference/` — auto-generated from OpenAPI
- `docs/architecture/` — ADRs for key decisions
- `docs/contributing.md` — how to contribute
- `README.md` — project overview with badges (build, test, docs, crates.io)

### M4-AC-5: Open-source release
- Apache 2.0 LICENSE file
- All code on public GitHub repository
- CI/CD green on main branch
- GitHub Issues template for bug reports and feature requests
- CHANGELOG.md with all releases

### M4-AC-6: Maintenance commitment
- Signed statement: 12-month maintenance window
- Quarterly dependency updates
- Bug fix SLA: critical < 48h, major < 1 week
- Canton SDK version tracking (update within 2 weeks of new Canton release)
