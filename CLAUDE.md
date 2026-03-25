# Canton OTC — Claude Code Instructions

## Project
DeFi OTC trading platform on Canton Network. Production: https://1otc.cc

## Tech Stack
- **Frontend:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- **Smart Contracts:** DAML 2.9.0 (Canton Network)
- **API Server:** Rust (Axum + Tonic gRPC)
- **Database:** Supabase (PostgreSQL) — optional for decentralized mode
- **Infrastructure:** Kubernetes on 65.108.15.30

## Key Directories
- `src/` — Next.js application (pages, API routes, components, services)
- `canton/daml/` — DAML smart contracts (OtcOffer, Escrow, Collateral, Settlement)
- `cantonnet-omnichain-sdk/` — Rust SDK (git submodule)
- `cantonnet-omnichain-sdk/crates/canton-otc-api/` — Rust REST API server
- `daml/` — DAML build config (daml.yaml)
- `k8s/` — Kubernetes manifests
- `contracts/` — Solidity contracts (CantonBridge — future feature)
- `services/solver-node/` — NEAR Intent Solver microservice
- `docs/` — All documentation (see docs/README.md for index)
- `scripts/` — Organized into: deployment/, testing/, k8s-ops/, security/, telegram/

## Commands
- `pnpm dev` — Start Next.js dev server
- `pnpm build` — Production build
- `cd cantonnet-omnichain-sdk && cargo check --package canton-otc-api` — Check Rust API
- `docker compose -f docker-compose.local-test.yml up` — Local Canton Sandbox
- `cd daml && daml build` — Build DAML contracts

## Conventions
- Use `String` (not `f64`) for financial amounts in Rust
- DAML module names match file names: OtcOffer.daml → module OtcOffer
- Canton Ledger API v2 uses nested proto Record/Variant types
- Proto `Variant.value` and `Optional.value` use `Option<Box<Value>>` not `Option<Value>`
- Server-side TypeScript must NOT have `"use client"` directive
- React hooks go in separate `"use client"` files when service is also imported server-side
- Singleton pattern for DamlIntegrationService: use `getDamlService()` from damlIntegrationService.ts
- Choice names in DAML: "Accept", "Cancel" (not "AcceptOffer", "CancelOffer")

## Environment
- Primary env template: `env.template` (113 variables, comprehensive)
- Copy to `.env.local` for development
- Canton config vars: `CANTON_PARTICIPANT_URL`, `CANTON_PARTY_ID`, `CANTON_AUTH_TOKEN`

## Testing
- Unit tests: `pnpm test` (Vitest)
- E2E tests: `pnpm test:e2e` (Playwright)
- Rust tests: `cd cantonnet-omnichain-sdk && cargo test`
