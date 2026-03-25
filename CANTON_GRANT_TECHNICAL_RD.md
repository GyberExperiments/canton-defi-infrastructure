# Canton OTC — Technical R&D Expertise for Grant Application

**Версия:** 1.0  
**Дата:** 2026-02-24  
**Проект:** Canton OTC — DeFi OTC Trading Platform  
**URL:** https://1otc.cc

---

## 1. Почему мы — правильные партнёры для Canton Foundation

### 1.1 Мы уже работаем с Canton

Мы не просим деньги на "идею" — мы уже построили production-ready платформу на Canton Network и имеем глубокую экспертизу в:

1. **Canton Ledger API v2** — полная интеграция
2. **DAML Smart Contracts** — 5 production-ready templates
3. **Rust SDK** — собственный canton-otc-api сервер
4. **Participant Node** — running в production

### 1.2 Наш вклад в экосистему

| Компонент           | Status        | Description                                    |
| ------------------- | ------------- | ---------------------------------------------- |
| **OtcOffer.daml**   | ✅ Production | Main OTC trading contract с complex invariants |
| **Escrow.daml**     | ✅ Production | Escrow для безопасных расчётов                 |
| **Collateral.daml** | ✅ Production | Collateral management                          |
| **Settlement.daml** | ✅ Production | Settlement tracking                            |
| **canton-otc-api**  | ✅ Production | Rust gRPC client для Ledger API                |
| **Production Node** | ✅ Active     | Participant node на 65.108.15.30               |

---

## 2. Deep Technical Expertise

### 2.1 Canton Ledger API v2 Integration

Мы полностью интегрированы с Ledger API v2:

**Command Services:**

- `CommandService` — sync submit + wait
- `CommandSubmissionService` — async submit
- `CommandCompletionService` — completion tracking

**Query Services:**

- `TransactionService` — filtered transaction fetch
- `ActiveContractsService` — ACS queries
- `TransactionTreeService` — full tree access

**Management:**

- `PartyManagementService` — party allocation
- `PackageService` — DAR deployment
- `LedgerIdentityService` — ledger discovery

**Code Reference:** `cantonnet-omnichain-sdk/research/04-daml-ledger-api.md` (1615 строк)

### 2.2 DAML Contract Expertise

**OtcOffer Template — 277 строк DAML кода:**

```daml
template OtcOffer
  with
    offerId : Text
    operator : Party
    initiator : Party
    counterparty : Optional Party
    asset : Asset
    price : Price
    quantity : Decimal
    side : OtcSide
    limits : VolumeLimits
    status : OtcStatus
    timestamps : Timestamps
    collateral : Optional CollateralInfo
    settlementInfo : Optional SettlementInfo
    minComplianceLevel : Text
    allowedJurisdictions : [Text]
    auditors : [Party]
  where
    signatory initiator, operator
    observer ...
    key (operator, offerId) : (Party, Text)
    maintainer key._1
    ensure quantity > 0.0 && ...
```

**Key Features:**

- Contract keys для deduplication
- Complex invariants (quantity, price, time validation)
- Observer pattern для auditors
- Optional counterparty (public vs private offers)
- Multi-jurisdiction compliance

### 2.3 Rust SDK Architecture

**Crate Structure:**

```
canton-sdk/
├── canton-sdk/          # Main facade
├── canton-core/         # Types: DamlValue, Identifier, ContractId, Command
├── canton-ledger-api/   # gRPC client implementation
├── canton-transport/    # gRPC/HTTP transport layer
├── canton-crypto/       # Cryptographic operations
├── canton-reliability/  # Retry, circuit breaker, rate limit
├── canton-observability/# Metrics, tracing, logging
└── canton-omnichain/    # Cross-chain adapters
```

**Key Technologies:**

- Rust 2024 Edition
- Tokio async runtime
- Tonic + Prost для gRPC
- OpenTelemetry для observability
- HSM integration для key management

**Code Reference:** `cantonnet-omnichain-sdk/research/08-sdk-architecture-design.md` (1454 строки)

### 2.4 Production Infrastructure

```
65.108.15.30 (Production)
├── Canton Participant Node
│   └── Ledger API v2 endpoint
├── canton-otc-api (Rust)
│   ├── Axum HTTP server
│   ├── Tonic gRPC
│   └── Health/readiness probes
├── Next.js Application
│   └── Next.js 15 + React 19
├── PostgreSQL (Supabase)
│   └── User data, KYC, audit logs
└── Kubernetes
    ├── Auto-scaling
    ├── TLS termination
    └── Monitoring (Prometheus)
```

---

## 3. Research & Documentation

### 3.1 Architecture Research Documents

| Document                               | Lines | Topic                                  |
| -------------------------------------- | ----- | -------------------------------------- |
| `01-canton-network-architecture.md`    | 365   | Canton protocol, domains, participants |
| `04-daml-ledger-api.md`                | 1615  | Full Ledger API specification          |
| `08-sdk-architecture-design.md`        | 1454  | Rust SDK crate structure               |
| `02-omnichain-integration-patterns.md` | -     | Cross-chain patterns                   |
| `06-cryptographic-requirements.md`     | -     | Crypto implementation                  |
| `07-production-ready-patterns.md`      | -     | Production patterns                    |

### 3.2 Technical Analysis

**STACK_AND_IMPLEMENTATION_EXPERTISE_REPORT.md:**

- Deep analysis текущего стека
- Оценка 8/10 для production readiness
- Рекомендации по улучшению

---

## 4. Grant Request — что мы хотим сделать

### 4.1 Core R&D — Ledger API Enhancement

**Milestone 1: Advanced Command Processing**

- Batch commands support
- Parallel submission
- Transaction deduplication

**Milestone 2: Privacy Enhancements**

- Sub-transaction privacy implementation
- Zero-knowledge proof integration
- Confidential computing

### 4.2 Developer Tools

**Milestone 3: SDK Completion**

- Full CRUD operations for all DAML templates
- CLI tools for local development
- VS Code extension
- Tutorial documentation

### 4.3 Security

**Milestone 4: Security Audit**

- Third-party security audit
- Formal verification of DAML contracts
- Bug bounty program

### 4.4 Reference Implementation

**Milestone 5: Open Source Release**

- Public GitHub repository
- Comprehensive documentation
- Example applications
- Community support

---

## 5. Evaluation Alignment

### 5.1 Как оценивает Canton Foundation

| Criteria                | Our Match                                   |
| ----------------------- | ------------------------------------------- |
| **Impact & Value**      | Real utility для институциональных клиентов |
| **Protocol Alignment**  | 100% — Ledger API v2, DAML                  |
| **Scope & Feasibility** | Уже работает — не с нуля                    |
| **Quality & Cost**      | Production-tested                           |
| **Security**            | Audit-ready practices                       |
| **Long-term**           | Коммиттимся к поддержке                     |

### 5.2 Public Good

Наш код — это public good:

- Open-source DAML templates
- Rust SDK для интеграторов
- Production deployment как reference
- Documentation для разработчиков

---

## 6. Roadmap

### Phase 1 (Month 1-2): Core Development

- [ ] Enhanced Ledger API client
- [ ] New DAML templates
- [ ] Performance optimization

### Phase 2 (Month 3-4): Tools & Security

- [ ] SDK completion
- [ ] CLI tools
- [ ] Security audit

### Phase 3 (Month 5-6): Ecosystem

- [ ] Open source release
- [ ] Documentation
- [ ] Community building

---

## 7. Contact

**Email:** dev-fund@canton.foundation  
**Apply:** https://github.com/canton-foundation/canton-dev-fund/pulls

---

## Appendix: Key Technical References

### A.1 DAML Contracts

- `canton/daml/OtcOffer.daml` — Main contract (277 lines)
- `canton/daml/Escrow.daml` — Escrow logic
- `canton/daml/Collateral.daml` — Collateral management
- `canton/daml/Settlement.daml` — Settlement tracking
- `canton/daml/OtcTypes.daml` — Type definitions

### A.2 Rust SDK

- `cantonnet-omnichain-sdk/research/08-sdk-architecture-design.md` — Architecture
- `cantonnet-omnichain-sdk/research/04-daml-ledger-api.md` — API spec

### A.3 Infrastructure

- Production: 65.108.15.30
- Kubernetes manifests: `k8s/`, `config/kubernetes/`

---

_Мы — команда с production-ready проектом на Canton. Мы не просим деньги на эксперименты — мы просим поддержку для масштабирования уже доказанной работы._
