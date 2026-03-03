# Canton DeFi Infrastructure Layer

Open-source DeFi primitives built natively on Canton Network.
The missing execution layer for institutional digital asset trading.

**From OTC to AMM. From Oracle to Settlement. Production-ready. Open-source.**

---

## What Is This

Canton DeFi Infrastructure Layer is the shared DeFi execution layer for Canton Network. It provides reusable DAML smart contracts (primitives), a Rust SDK, REST/gRPC APIs that any Canton dApp can integrate with.

## Architecture

```
        CONSUMER APPLICATIONS
┌────────────────────────────────────┐
│  Wallets  │  dApps  │  Bots  │ SDK│
└──────────────────┬─────────────────┘
                   │
       ┌───────────┴───────────┐
       │   REST API + gRPC     │
       │   15+ endpoints       │
       └───────────┬───────────┘
                   │
       ┌───────────┴───────────┐
       │   Rust SDK (14 crates)│
       │   cargo add canton-sdk│
       └───────────┬───────────┘
                   │ gRPC
       ┌───────────┴───────────┐
       │   DAML Templates      │
       │   OTC / Escrow / etc. │
       └───────────┬───────────┘
                   │
       ┌───────────┴───────────┐
       │   Canton Network      │
       │   Sub-tx privacy      │
       └───────────────────────┘
```

## DAML Contracts

| Contract | Description | LOC |
|----------|-------------|-----|
| `OtcTypes.daml` | Core data types — Asset, Price, OtcStatus, CollateralInfo | 106 |
| `OtcOffer.daml` | OTC trading template — create/accept/cancel/settle offers with partial fills | 278 |
| `Escrow.daml` | Three-party escrow — deposit/release/refund/arbitrate with 10 choices | 358 |
| `Collateral.daml` | Collateral management — lock/release/forfeit with invariant proof | 309 |
| `Settlement.daml` | Settlement process — multi-confirmation tracking with dispute resolution | 308 |
| `Test.daml` | Test scenarios — lifecycle, partial fill, cancellation, expiry | 313 |

## Planned Primitives

- **Matching Engine** — on-chain order book with price-time priority
- **Liquidity Pools** — constant-product AMM (x*y=k) for DAML
- **Price Oracle** — multi-source feeds with median aggregation
- **Atomic Swaps** — two-phase cross-asset swaps with timeout
- **Multi-Party Settlement** — batch netting across N parties
- **Compliance Gateway** — pluggable per-jurisdiction checks

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | DAML 2.9.3 |
| SDK | Rust (2021 Edition) |
| gRPC | Tonic 0.13 + Prost |
| HTTP | Axum 0.7 |
| Network | Canton Network (sub-transaction privacy) |
| Orchestration | Kubernetes |
| Monitoring | Prometheus + Grafana + Loki |

## CIP Compliance

- **CIP-0056** Token Standard — all primitives accept CIP-0056 tokens
- **CIP-0047** Activity Markers — trade events for Featured App tracking
- **CIP-0082** Governance — open-source, Foundation can fork/maintain
- **CIP-0103** Wallet Standard — SDK integrates with compliant wallets

## Project Structure

```
├── daml/                    # DAML smart contracts
│   ├── daml.yaml            # DAML project config (SDK 2.9.3)
│   └── OTC/
│       ├── OtcTypes.daml
│       ├── OtcOffer.daml
│       ├── Escrow.daml
│       ├── Collateral.daml
│       ├── Settlement.daml
│       └── Test.daml
├── docs/
│   ├── architecture/        # Canton network & integration patterns
│   ├── sdk/                 # Rust SDK design & prerequisites
│   └── roadmap/             # Implementation roadmap
└── LICENSE                  # GPL v3
```

## Build

```bash
# DAML contracts
cd daml
daml build
daml test
```

## Documentation

- [Canton Network Architecture](docs/architecture/01-canton-network-architecture.md)
- [OmniChain Integration Patterns](docs/architecture/02-omnichain-integration-patterns.md)
- [DAML Ledger API](docs/architecture/04-daml-ledger-api.md)
- [SDK Architecture Design](docs/sdk/08-sdk-architecture-design.md)
- [Implementation Roadmap](docs/roadmap/06_IMPLEMENTATION_ROADMAP.md)

## Related Repositories

- [canton-primitives](https://github.com/GyberExperiments/canton-primitives) — Core DAML primitives package

## Contributors

- [GyberExperiment](https://github.com/GyberExperiments)
- [zalomax](https://github.com/zalomax)

## License

GPL v3 — copyleft, all derivatives must remain open-source under the same license.

---

Built by [Gybernaty](https://github.com/TheMacroeconomicDao) for Canton Network.
