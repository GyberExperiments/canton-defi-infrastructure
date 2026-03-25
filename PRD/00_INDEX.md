# Canton DeFi Infrastructure Layer — Product Requirements Document

**Version:** 2.0
**Date:** 2026-02-24
**Status:** Draft for Grant Application
**Project:** Canton DeFi Infrastructure Layer (formerly Canton OTC)
**Production:** https://1otc.cc
**Repository:** canton-otc + cantonnet-omnichain-sdk

---

## Document Structure

This PRD is organized as a self-contained set of files. Each file is independently readable but references others where needed.

### Core Documents

| # | File | Description |
|---|------|-------------|
| 00 | `00_INDEX.md` | This file — master index and navigation |
| 01 | `01_OVERVIEW.md` | Vision, strategy, architecture, positioning |
| 02 | `02_CURRENT_STATE.md` | Complete audit of what exists today (code, infra, metrics) |
| 03 | `03_MILESTONES.md` | Grant milestones, timeline, funding breakdown |
| 04 | `04_ACCEPTANCE_CRITERIA.md` | Measurable acceptance criteria per milestone |

### DAML Smart Contracts

| # | File | Description |
|---|------|-------------|
| 05 | `daml-contracts/05_EXISTING_CONTRACTS.md` | Full spec of 10 existing DAML templates (1,666 LOC) |
| 06 | `daml-contracts/06_NEW_MATCHING_ENGINE.md` | MatchingEngine.daml — on-chain order matching |
| 07 | `daml-contracts/07_NEW_LIQUIDITY_POOL.md` | LiquidityPool.daml — AMM primitive for Canton |
| 08 | `daml-contracts/08_NEW_PRICE_ORACLE.md` | PriceOracle.daml — decentralized price feeds |

### Rust SDK

| # | File | Description |
|---|------|-------------|
| 09 | `rust-sdk/09_EXISTING_SDK.md` | Current 14-crate architecture (6,894 LOC) |
| 10 | `rust-sdk/10_SDK_COMPLETION.md` | Completing canton-sdk as ecosystem crate |
| 11 | `rust-sdk/11_NEW_CRATES.md` | New crates: canton-defi, canton-matching, canton-oracle |

### Frontend

| # | File | Description |
|---|------|-------------|
| 12 | `frontend/12_EXISTING_FRONTEND.md` | Current Next.js 15 application state |
| 13 | `frontend/13_FRONTEND_ENHANCEMENTS.md` | New DeFi UI, real-time orderbook, portfolio |

### Infrastructure

| # | File | Description |
|---|------|-------------|
| 14 | `infrastructure/14_EXISTING_INFRA.md` | Current K8s, CI/CD, monitoring stack |
| 15 | `infrastructure/15_INFRA_ENHANCEMENTS.md` | Canton Sync domain, multi-node, observability |

### API Specifications

| # | File | Description |
|---|------|-------------|
| 16 | `api-specs/16_REST_API_V2.md` | REST API v2 — DeFi endpoints, OpenAPI spec |
| 17 | `api-specs/17_GRPC_SERVICES.md` | gRPC service definitions for SDK consumers |

---

## How to Read This PRD

**For Grant Reviewers:** Start with `01_OVERVIEW.md` → `03_MILESTONES.md` → `04_ACCEPTANCE_CRITERIA.md`

**For Engineers:** Start with `02_CURRENT_STATE.md` → then the specific domain folder

**For Foundation Tech Committee:** `05-08` (DAML), `09-11` (SDK), `16-17` (API specs)

---

## Key Numbers

| Metric | Current | After Grant |
|--------|---------|-------------|
| DAML Templates | 10 | 16 (+6 DeFi primitives) |
| DAML Lines of Code | 1,666 | ~3,500 |
| Rust Crates | 14 | 18 (+4 DeFi crates) |
| Rust LOC (working) | ~4,500 | ~12,000 |
| REST API Endpoints | 15 | 35+ |
| gRPC Services | 3 | 7 |
| Test Coverage | ~40% | 80%+ |
| CIP Compliance | Partial | CIP-0056, CIP-0047, CIP-0082, CIP-0100, CIP-0103 |

---

## Conventions

- **[EXISTING]** — code that exists and works today
- **[ENHANCE]** — modifications to existing code
- **[NEW]** — new code to be written
- **[CRITICAL]** — must-have for grant milestone
- Code blocks contain actual implementable code, not pseudocode
- All DAML code targets SDK 2.9.3, LF 1.15
- All Rust code targets Edition 2021, MSRV 1.77
