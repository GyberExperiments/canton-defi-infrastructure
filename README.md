# Canton OTC Platform

Decentralized OTC trading platform on [Canton Network](https://canton.network) with DAML smart contracts, cross-chain settlement, and institutional-grade compliance.

**Production:** [1otc.cc](https://1otc.cc)

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Next.js Frontend                │
│              (App Router, React 19)              │
├─────────────────────────────────────────────────┤
│              Next.js API Routes                  │
│         /api/create-order, /api/daml/*           │
├──────────────────┬──────────────────────────────┤
│   Rust Canton    │      Canton Sandbox          │
│   API Server     │   (DAML Ledger API v2)       │
│   (Axum + Tonic) │                              │
├──────────────────┴──────────────────────────────┤
│            Canton Network (DevNet)               │
│         DAML Smart Contracts (DAR)               │
│  OtcOffer · Escrow · Collateral · Settlement     │
└─────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 20+ / pnpm
- Rust 1.75+ (for Canton API Server)
- Docker & Docker Compose (for local Canton Sandbox)
- DAML SDK 2.9.0 (for contract compilation)

### Local Development

```bash
# Install dependencies
pnpm install

# Start Next.js dev server
pnpm dev

# Start Canton Sandbox + DAML deploy + Rust API (requires Docker)
docker compose -f docker-compose.local-test.yml up
```

### Environment

Copy `env.template` to `.env.local` and fill in your values:

```bash
cp env.template .env.local
```

Key variables:
- `CANTON_PARTICIPANT_URL` — Canton Ledger API endpoint
- `CANTON_PARTY_ID` — Your party on the Canton Network
- `CANTON_API_SERVER_URL` — Rust API server URL
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase for order storage (optional)

## Project Structure

```
canton-otc/
├── src/                          # Next.js application
│   ├── app/                      # App Router pages & API routes
│   ├── components/               # React components
│   ├── lib/                      # Services, hooks, utilities
│   │   └── canton/               # Canton integration layer
│   └── config/                   # Application configuration
├── canton/
│   └── daml/                     # DAML smart contracts
│       ├── OtcOffer.daml         # Main OTC offer template
│       ├── OtcTypes.daml         # Shared types (Asset, Price, etc.)
│       ├── Escrow.daml           # Escrow management
│       ├── Collateral.daml       # Collateral handling
│       └── Settlement.daml       # Settlement lifecycle
├── cantonnet-omnichain-sdk/      # Rust SDK (git submodule)
│   └── crates/canton-otc-api/    # Axum REST API + gRPC Canton client
├── contracts/                    # Solidity contracts (CantonBridge)
├── services/                     # Microservices (NEAR Solver)
├── daml/                         # DAML build config (daml.yaml)
├── k8s/                          # Kubernetes manifests
├── scripts/                      # Deployment, testing, ops scripts
├── local-test/                   # Local sandbox config & scripts
├── docker-compose.local-test.yml # Local test environment
└── docs/                         # Documentation (see docs/README.md)
```

## DAML Smart Contracts

Five interconnected templates implementing the OTC trading lifecycle:

| Template | Purpose |
|----------|---------|
| **OtcOffer** | Main offer with Accept, Cancel, Expire, Settle, Dispute choices |
| **OtcTypes** | Shared types: Asset, Price, VolumeLimits, Timestamps, CollateralStatus |
| **Escrow** | Two-party escrow with arbitration |
| **Collateral** | Collateral locking, release, and forfeiture |
| **Settlement** | Payment verification and dispute resolution |

Build and deploy:

```bash
cd daml && daml build
# Upload to Canton participant:
daml ledger upload-dar .daml/dist/canton-otc-1.0.0.dar --host HOST --port PORT
```

## Rust API Server

REST API bridging Next.js frontend to Canton Ledger API v2 (gRPC):

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check with ledger connectivity |
| `/api/v1/contracts/offer` | POST | Create OtcOffer contract |
| `/api/v1/contracts/:id` | GET | Get contract by ID |
| `/api/v1/contracts/:id/accept` | POST | Accept offer (exercise Accept choice) |
| `/api/v1/contracts/:id/cancel` | POST | Cancel offer (exercise Cancel choice) |

## Deployment

See [docs/guides/quick-deploy.md](docs/guides/quick-deploy.md) for production deployment.

## Documentation

Full documentation index: [docs/README.md](docs/README.md)

## License

See [LICENSE](LICENSE).
