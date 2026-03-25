# 03 — Grant Milestones & Funding

## Total Request: 200,000 CC

**Timeline:** 16 weeks (4 months)
**Team:** 3 engineers (1 DAML/Rust, 1 Full-stack, 1 DevOps/Infra)

---

## Milestone 1: DeFi DAML Primitives (Weeks 1-4)

**Funding:** 50,000 CC (25%)
**Trigger:** Tech Committee acceptance

### Deliverables

| # | Deliverable | LOC Est. | Priority |
|---|-------------|----------|----------|
| 1.1 | `MatchingEngine.daml` — on-chain order book with price-time priority | ~350 | CRITICAL |
| 1.2 | `LiquidityPool.daml` — constant-product AMM (x*y=k) for Canton tokens | ~300 | CRITICAL |
| 1.3 | `PriceOracle.daml` — multi-source price feeds with confidence scoring | ~250 | CRITICAL |
| 1.4 | `AtomicSwap.daml` — cross-asset atomic swap with timeout | ~200 | CRITICAL |
| 1.5 | `MultiPartySettlement.daml` — batch netting across N trades | ~250 | CRITICAL |
| 1.6 | `ComplianceGateway.daml` — pluggable compliance checks per jurisdiction | ~200 | CRITICAL |
| 1.7 | Test scripts for all 6 new templates (20+ test scenarios) | ~500 | CRITICAL |
| 1.8 | DAR build artifacts published to releases | — | CRITICAL |

### What This Unlocks
- Any Canton dApp can import and use DeFi primitives
- Composable with existing OtcOffer, Escrow, Collateral, Settlement
- CIP-0056 token-compatible from day one

---

## Milestone 2: Rust SDK v1.0 + crates.io Publish (Weeks 5-8)

**Funding:** 60,000 CC (30%)
**Trigger:** Tech Committee acceptance

### Deliverables

| # | Deliverable | LOC Est. | Priority |
|---|-------------|----------|----------|
| 2.1 | `canton-sdk` facade crate — single entry point for all functionality | ~400 | CRITICAL |
| 2.2 | `canton-defi` crate — Rust bindings for all 6 new DAML templates | ~800 | CRITICAL |
| 2.3 | `canton-matching` crate — off-chain matching engine with ledger sync | ~600 | CRITICAL |
| 2.4 | `canton-oracle` crate — price feed aggregator + publisher | ~400 | CRITICAL |
| 2.5 | Complete `canton-reliability` — circuit breaker, retry, rate limiter | ~300 | CRITICAL |
| 2.6 | Complete `canton-observability` — OpenTelemetry traces + Prometheus metrics | ~200 | CRITICAL |
| 2.7 | CLI tool `canton-cli` for local development and contract interaction | ~500 | CRITICAL |
| 2.8 | Publish to crates.io: canton-sdk, canton-core, canton-ledger-api, canton-defi | — | CRITICAL |
| 2.9 | API documentation on docs.rs | — | CRITICAL |
| 2.10 | Integration tests against Canton Sandbox | ~400 | CRITICAL |

### What This Unlocks
- `cargo add canton-sdk` — any Rust developer can integrate with Canton
- First and only Rust SDK for Canton Network
- Production-grade reliability patterns included

---

## Milestone 3: REST API v2 + Reference DeFi dApp (Weeks 9-12)

**Funding:** 50,000 CC (25%)
**Trigger:** Tech Committee acceptance

### Deliverables

| # | Deliverable | Priority |
|---|-------------|----------|
| 3.1 | REST API v2 with 20+ new DeFi endpoints (see `16_REST_API_V2.md`) | CRITICAL |
| 3.2 | WebSocket streaming for real-time orderbook and price updates | CRITICAL |
| 3.3 | OpenAPI 3.1 specification auto-generated from code | CRITICAL |
| 3.4 | Frontend: Real-time orderbook UI component | CRITICAL |
| 3.5 | Frontend: Liquidity pool dashboard (add/remove liquidity, pool stats) | CRITICAL |
| 3.6 | Frontend: Portfolio view (holdings, P&L, trade history) | CRITICAL |
| 3.7 | Frontend: Price chart with oracle feed integration | CRITICAL |
| 3.8 | CIP-0047 activity marker integration for all trades | CRITICAL |
| 3.9 | CIP-0103 wallet connection flow | CRITICAL |
| 3.10 | E2E tests: order→match→settle full lifecycle on testnet | CRITICAL |

### What This Unlocks
- Production reference DeFi dApp that others can fork
- OpenAPI spec lets any language generate client SDK
- Live demo for Canton Foundation evaluation

---

## Milestone 4: Production Hardening + Documentation (Weeks 13-16)

**Funding:** 40,000 CC (20%)
**Trigger:** Final release and acceptance

### Deliverables

| # | Deliverable | Priority |
|---|-------------|----------|
| 4.1 | Security audit of all DAML contracts (self-audit + peer review) | CRITICAL |
| 4.2 | Load testing: 100 concurrent trades on testnet | CRITICAL |
| 4.3 | Mainnet deployment with monitoring dashboards | CRITICAL |
| 4.4 | Developer documentation: Getting Started, Tutorials, API Reference | CRITICAL |
| 4.5 | Architecture Decision Records (ADRs) for all design choices | CRITICAL |
| 4.6 | Open-source release: Apache 2.0 license, contribution guide | CRITICAL |
| 4.7 | Community support: Discord/Telegram channel, FAQ | NICE-TO-HAVE |
| 4.8 | Video walkthrough of full DeFi workflow | NICE-TO-HAVE |
| 4.9 | 12-month maintenance commitment | CRITICAL |

---

## Funding Schedule

| Milestone | Payment | Trigger | Cumulative |
|-----------|---------|---------|------------|
| M0 — Contract Signing | 0 CC | Signed agreement | 0 |
| M1 — DeFi DAML Primitives | 50,000 CC | Committee acceptance | 50,000 |
| M2 — Rust SDK v1.0 | 60,000 CC | crates.io publish + Committee acceptance | 110,000 |
| M3 — REST API v2 + dApp | 50,000 CC | Live testnet demo + Committee acceptance | 160,000 |
| M4 — Production + Docs | 40,000 CC | Mainnet deploy + Committee acceptance | 200,000 |

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| DAML SDK breaking changes | Low | High | Pin SDK 2.9.3, test against nightly |
| Canton DevNet instability | Medium | Medium | Local sandbox for dev, DevNet for integration |
| Rust compilation of proto files | Low | Medium | Already working, conditional compilation |
| crates.io naming conflict | Low | Low | `canton-sdk` name available (checked) |
| Team availability | Low | High | 3 engineers, overlapping skills |
| Scope creep | Medium | Medium | Fixed 4 milestones, no additional features |

---

## Post-Grant Commitment

- **12 months** active maintenance (bug fixes, dependency updates)
- **6 months** community support (issues, PRs, questions)
- **Quarterly** SDK version updates aligned with Canton releases
- **Permanent** open-source under Apache 2.0
- Transfer ownership to Canton Foundation GitHub if requested
