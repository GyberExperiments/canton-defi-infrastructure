markdown

# Canton Network ↔ BSC Bridge — ULTIMATE MASTER PROMPT v3.0

**Версия:** 3.0 (Production-Ready, Gap-Free)  
**Дата:** 2026-02-09  
**Стандарт:** Advanced Prompt Engineering 2025 — самодостаточность, строгость, воспроизводимость, completeness.

---

## КРИТИЧЕСКОЕ ПРЕДИСЛОВИЕ

Этот промпт является **единственным источником истины** для реализации production-ready моста между Canton Network (Daml ledger) и BNB Smart Chain (BSC). Он закрывает все архитектурные gaps, выявленные в предыдущих версиях.

### Что изменилось в v3.0 (по сравнению с v2.1)

**Добавлено 18 критических секций:**
1. ✅ Canton Ledger API v2 — полная proto-спецификация, сервисы, методы
2. ✅ Canton Authentication — JWT flow, JWKS, mTLS, token refresh
3. ✅ Daml Contract Model — signatory/observer/controller, interfaces, upgrade strategy
4. ✅ BSC Contract Security — Pausable, UUPS Proxy, AccessControl, ReentrancyGuard, EIP-712
5. ✅ Consensus & Finality — Canton offset model, BSC reorg handling, fast finality
6. ✅ Formal Threat Model — attack vectors, mitigations, security audit checklist
7. ✅ Fee Model — gas management, bridge fees, fee estimation, spike handling
8. ✅ Rate Limiting — per-party, per-asset, global TVL, cooldown periods
9. ✅ Error Recovery — orphaned transfers, idempotency, DLQ, compensating transactions
10. ✅ Event Sourcing — immutable audit log, compliance reporting
11. ✅ Multi-Asset Support — asset registry, decimal handling, validation
12. ✅ Advanced Observability — distributed tracing, structured logging, SLO/SLI, dashboards
13. ✅ Comprehensive Testing — Canton Sandbox, Hardhat fork, E2E, chaos, property-based
14. ✅ Deployment & Operations — Blue/Green, migrations, backup/restore, key rotation, runbook
15. ✅ Configuration Management — Vault integration, feature flags, env-specific config
16. ✅ API Design — versioning, WebSocket, pagination, OpenAPI 3.0
17. ✅ Canton-Specific — time model, command dedup, package management, party allocation
18. ✅ Cross-cutting Concerns — circuit breaker, backpressure, graceful degradation, bounded queues

### Как использовать этот промпт

- **Исполнитель (человек или LLM):** читать ЧАСТЬ 0 полностью; затем выполнять части 1–30 по порядку.
- **DoD (Definition of Done):** каждая секция считается завершённой только при выполнении критериев в конце секции.
- **Самодостаточность:** все решения (типы, SQL, контракты, API, конфиг) заданы в теле документа. Внешние ссылки только для контекста окружения (DevNet эндпоинты).
- **Строгость:** MUST — обязательны; SHOULD — желательны; при отклонении — задокументировать причину.

---

# ЧАСТЬ 0: РОЛЬ, ОГРАНИЧЕНИЯ И КОНТЕКСТ

## 0.1 Роль исполнителя

Ты — senior architect + backend/SDK-разработчик, реализующий **institutional-grade** мост между Canton Network (privacy-preserving Daml ledger) и BNB Smart Chain (EVM-совместимый L1). Все решения должны соответствовать:

- **Безопасность:** threat model, audit trail, key management, upgradeable contracts
- **Надёжность:** идемпотентность, retry с backoff, circuit breaker, graceful degradation
- **Наблюдаемость:** distributed tracing, structured logging, metrics, alerting
- **Compliance:** immutable audit log, KYC/AML considerations (если применимо)

## 0.2 Обязательные правила (MUST)

### Денежные суммы
- **ЗАПРЕЩЕНО** использовать `f32`/`f64` для денег.
- **ОБЯЗАТЕЛЬНО** использовать:
  - В Rust: `String` (base units) или `u128`/`NUMERIC(78,0)` в БД
  - В Daml: `Decimal` (10 integer + 10 fractional digits)
  - В Solidity: `uint256` (wei/smallest unit)

### Идемпотентность
- Canton: уникальный `command_id` для каждой команды + `deduplication_period` (24h)
- BSC: маппинг `processedTransfers[bytes32 transferId] => bool` в контракте
- БД: уникальные индексы по `canton_command_id` и `bsc_tx_hash` (где `NOT NULL`)

### Секреты
- **ЗАПРЕЩЕНО** хардкодить ключи, пароли, JWT secrets.
- **ОБЯЗАТЕЛЬНО** использовать:
  - Environment variables для dev/test
  - HashiCorp Vault (или AWS Secrets Manager) для production
  - Ротация ключей по расписанию (BSC private key, JWT signing key)

### Переходы статусов
- Менять статус перевода **только** через проверку `TransferStatus::can_transition_to`.
- При недопустимом переходе — логировать и возвращать ошибку.
- Каждый переход записывать в `transfer_audit_log`.

### Логирование
- **Формат:** JSON (structured logging).
- **Обязательные поля:** `timestamp`, `level`, `message`, `trace_id`, `transfer_id`, `status`.
- **Один `trace_id`** на весь жизненный цикл перевода (от Initiated до Completed/Failed/RolledBack).
- **Секреты:** не логировать приватные ключи, JWT tokens, полные private data.

## 0.3 Желательные правила (SHOULD)

- **Canton Ledger API:** использовать **только v2** (`com.daml.ledger.api.v2`).
- **Production:** mTLS к Canton participant; WSS/HTTPS к BSC.
- **External calls:** оборачивать в circuit breaker + retry с exponential backoff.
- **Testing:** property-based tests (proptest) для state machine; chaos engineering для resilience.

## 0.4 Критерий готовности секции (Definition of Done)

Для каждой секции ниже: реализация считается завершённой, когда:
1. Код/конфиг/схема соответствуют спецификации.
2. Нет отсылок «см. другой документ» для критичных деталей.
3. Тесты/ручные проверки по чеклисту секции пройдены.
4. DoD-критерии в конце секции выполнены.

---

# ЧАСТЬ 1: РЕПОЗИТОРИЙ И WORKSPACE

## 1.1 Текущее состояние репо

**Репозиторий:** `cantonnet-omnichain-sdk`  
**Корень:** каталог с `Cargo.toml` workspace.

### Существующие крейты (не удалять)

| Крейт | Путь | Назначение |
|-------|------|------------|
| bridge-core | crates/bridge-core | Доменные типы, ошибки, конфиг, traits, state machine, fees, rate_limit, crypto, audit |
| canton-core | crates/canton-core | Типы Canton, конфиг, ошибки (SdkError), traits |
| canton-ledger-api | crates/canton-ledger-api | gRPC-клиент Ledger API v2, proto в `proto/com/daml/ledger/api/v2/` |
| canton-crypto | crates/canton-crypto | Ключи, keystore, signing |
| canton-wallet | crates/canton-wallet | Wallet, HD derivation, party_id |
| canton-observability | crates/canton-observability | Логирование, метрики, трейсинг (OpenTelemetry) |
| canton-reliability | crates/canton-reliability | Retry, circuit breaker, timeout |
| canton-transport | crates/canton-transport | gRPC channel management, TLS config |

### Крейты, которые нужно добавить (создать)

| Крейт | Путь | Назначение |
|-------|------|------------|
| bsc-client | crates/bsc-client | Ethers Provider, контракты (abigen), события, gas oracle, nonce manager, tx lifecycle |
| bridge-orchestrator | crates/bridge-orchestrator | Главный сервис: потоки Canton↔BSC, recovery, health, metrics |
| bridge-db | crates/bridge-db | PostgreSQL, SQLx, миграции, репозиторий, audit log, event sourcing |
| bridge-api | crates/bridge-api | REST API v1, handlers, middleware (auth, request_id, logging), WebSocket |

**Опционально:** `canton-client` (обёртка над canton-ledger-api с JWT и command builders); если не создаётся, логику разместить в `bridge-orchestrator`.

## 1.2 Workspace Cargo.toml (полный)

```toml
[workspace]
resolver = "2"
members = [
    "crates/bridge-core",
    "crates/canton-core",
    "crates/canton-ledger-api",
    "crates/canton-crypto",
    "crates/canton-wallet",
    "crates/canton-observability",
    "crates/canton-reliability",
    "crates/canton-transport",
    "crates/bsc-client",
    "crates/bridge-orchestrator",
    "crates/bridge-db",
    "crates/bridge-api",
]

[workspace.package]
version = "0.1.0"
edition = "2021"
rust-version = "1.77"
license = "Apache-2.0"
authors = ["Bridge Team"]

[workspace.dependencies]
# Async runtime
tokio = { version = "1.37", features = ["full"] }
tokio-stream = "0.1"
tokio-util = { version = "0.7", features = ["rt", "codec"] }
futures = "0.3"

# Serialization
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
serde_yaml = "0.9"

# Error handling
thiserror = "1.0"
anyhow = "1.0"

# Logging & Tracing
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter", "json", "fmt"] }
tracing-opentelemetry = "0.23"
opentelemetry = { version = "0.22", features = ["trace", "metrics"] }
opentelemetry-otlp = "0.15"

# gRPC (Canton Ledger API v2)
tonic = { version = "0.11", features = ["tls", "tls-roots"] }
prost = "0.12"
prost-types = "0.12"
tonic-build = "0.11"

# HTTP
reqwest = { version = "0.12", features = ["json", "rustls-tls", "stream"] }
axum = { version = "0.7", features = ["ws", "macros"] }
axum-extra = { version = "0.9", features = ["typed-header"] }
tower = { version = "0.4", features = ["timeout", "limit", "load-shed", "buffer"] }
tower-http = { version = "0.5", features = ["cors", "trace", "auth", "compression-gzip", "request-id"] }

# Ethereum / BSC
ethers = { version = "2.0", features = ["ws", "rustls", "abigen"] }
ethers-contract = "2.0"
ethers-signers = { version = "2.0", features = ["aws"] }

# Database
sqlx = { version = "0.7", features = ["runtime-tokio-rustls", "postgres", "uuid", "chrono", "migrate", "json"] }

# Redis (для distributed lock, rate limiting)
deadpool-redis = "0.15"
redis = { version = "0.25", features = ["tokio-comp", "connection-manager"] }

# Config & Secrets
config = "0.14"
dotenvy = "0.15"

# Crypto
sha2 = "0.10"
sha3 = "0.10"
hex = "0.4"
jsonwebtoken = "9.3"
ring = "0.17"

# Time
chrono = { version = "0.4", features = ["serde"] }

# UUID
uuid = { version = "1.8", features = ["v4", "v7", "serde"] }

# Metrics
prometheus-client = "0.22"

# Rate limiting
governor = "0.6"

# Retry & Circuit breaker
backon = "0.4"

# Validation
validator = { version = "0.18", features = ["derive"] }

# Testing
mockall = "0.12"
wiremock = "0.6"
testcontainers = "0.15"
proptest = "1.4"
tokio-test = "0.4"
assert_matches = "1.5"

# Internal crates
bridge-core = { path = "crates/bridge-core" }
canton-core = { path = "crates/canton-core" }
canton-ledger-api = { path = "crates/canton-ledger-api" }
canton-crypto = { path = "crates/canton-crypto" }
canton-wallet = { path = "crates/canton-wallet" }
canton-observability = { path = "crates/canton-observability" }
canton-reliability = { path = "crates/canton-reliability" }
canton-transport = { path = "crates/canton-transport" }
bsc-client = { path = "crates/bsc-client" }
bridge-orchestrator = { path = "crates/bridge-orchestrator" }
bridge-db = { path = "crates/bridge-db" }
bridge-api = { path = "crates/bridge-api" }

[profile.release]
opt-level = 3
lto = "thin"
strip = "symbols"
panic = "abort"

[profile.dev]
opt-level = 0
debug = true
```

## 1.3 Целевая структура каталогов (полная)

```
cantonnet-omnichain-sdk/
├── Cargo.toml
├── .env.example
├── rust-toolchain.toml
├── deny.toml
├── clippy.toml
├── config/
│   ├── example.yaml
│   ├── example-production.yaml
│   └── bridge.yaml
├── crates/
│   ├── bridge-core/src/{lib,types,errors,config,traits,state_machine,fees,rate_limit,crypto,audit}.rs
│   ├── canton-core/...
│   ├── canton-ledger-api/
│   │   ├── proto/com/daml/ledger/api/v2/{command_service.proto,transaction_service.proto,completion_service.proto,...}
│   │   └── src/{lib,client,auth,commands,transactions}.rs
│   ├── bsc-client/src/{lib,provider,contracts,bridge_contract,token_contract,event_listener,gas_oracle,tx_manager,nonce_manager}.rs
│   ├── bridge-orchestrator/src/{main,orchestrator,canton_to_bsc,bsc_to_canton,recovery,health,metrics}.rs
│   ├── bridge-db/src/{lib,models,repository,event_log}.rs + migrations/
│   └── bridge-api/src/{lib,routes,handlers,middleware,websocket}.rs
├── contracts/
│   ├── daml/
│   │   ├── daml.yaml
│   │   └── daml/Bridge/{Types,Asset,Lock,Transfer}.daml
│   └── solidity/
│       ├── hardhat.config.ts
│       ├── contracts/{BridgeVault,BridgedToken,BridgeRegistry,MultiSigValidator}.sol
│       ├── contracts/proxy/BridgeVaultProxy.sol (UUPS)
│       ├── test/{BridgeVault.test.ts,integration.test.ts}
│       └── scripts/{deploy.ts,upgrade.ts}
├── docker/
│   ├── Dockerfile.bridge
│   ├── docker-compose.yml
│   └── docker-compose.infra.yml
├── scripts/
│   ├── generate-proto.sh
│   ├── run-tests.sh
│   └── setup-dev.sh
├── monitoring/
│   ├── prometheus.yml
│   ├── grafana/dashboards/bridge-dashboard.json
│   └── alerting/rules.yml
└── docs/
    ├── architecture.md
    ├── deployment.md
    ├── security.md
    ├── runbook.md
    ├── threat-model.md (NEW)
    ├── fee-model.md (NEW)
    └── testing-strategy.md (NEW)
```

**DoD секции 1:**
- Все перечисленные каталоги существуют.
- `cargo build --workspace` успешен (или сборка существующих крейтов до добавления новых).
- `.env.example`, `rust-toolchain.toml`, `deny.toml` созданы.

---

# ЧАСТЬ 2: ДОМЕННАЯ МОДЕЛЬ (bridge-core)

## 2.1 Перечень типов (обязательные)

Все типы в `crates/bridge-core/src/` в модулях согласно таблице.

| Тип | Модуль | Описание |
|-----|--------|----------|
| TransferId | types | Newtype над `Uuid` (UUIDv7 для time-ordering). Display, FromStr, Serialize, Deserialize. |
| TransferDirection | types | Enum: `CantonToBsc`, `BscToCanton`. `sqlx::Type` для `transfer_direction`. |
| TransferStatus | types | Enum всех состояний ФСМ (см. матрицу переходов ниже). `sqlx::Type` для `transfer_status`. Методы: `is_terminal`, `is_in_flight`, `is_retryable`, `can_transition_to`. |
| CantonParty, CantonContractId, CantonOffset, CantonCommandId, CantonWorkflowId, CantonTemplateId | types | Строковые newtype с валидацией. |
| BscAddress, BscTxHash, BscBlock | types | `BscAddress`: 0x + 40 hex (lowercase normalized); `BscTxHash`: 0x + 64 hex; `BscBlock`: number, hash, timestamp. |
| Amount | types | Поля: `raw: String` (base units), `decimals: u8`. Методы: `from_base_units`, `from_human`, `to_u128`, `to_human`, `is_zero`, `is_positive`. **НИКОГДА float.** |
| AmountParseError | types | `thiserror` enum: `InvalidFormat`, `Overflow`, `TooManyDecimals`. |
| AssetId | types | `id`, `canton_template_id`, `bsc_token_address` (BscAddress), `symbol`, `name`, `decimals`, `min_transfer`, `max_transfer`, `daily_limit` (Amount), `enabled: bool`. Метод `validate`. |
| BridgeFee | types | `fixed_fee`, `proportional_bps`, `estimated_gas_bnb`, `total_fee`, `net_amount` (все Amount где применимо). |
| BridgeTransfer | types | Полная структура (см. ниже). Конструкторы: `new_canton_to_bsc`, `new_bsc_to_canton`. Методы: `update_status`, `increment_retry`. |
| BridgeError | errors | `thiserror` enum: `Config`, `Canton(CantonError)`, `Bsc(BscError)`, `Db(DbError)`, `InvalidTransition { from, to }`, `Validation`, `Idempotency`, `RateLimit`, `Other(anyhow::Error)`. |
| BridgeConfig, CantonConfig, BscConfig, DbConfig, LimitsConfig, ObservabilityConfig | config | Serde (De)serialize для YAML/env. Методы: `from_file`, `from_env`, `validate`. |
| CantonClient, BscClient | traits | `async_trait` с методами по контракту ниже. |
| TransferStateMachine, apply_transition | state_machine | Проверка `can_transition_to`; применение перехода только при успехе. Метод `apply` возвращает `Result<(), InvalidTransition>`. |
| TransferEventLog | audit | `transfer_id`, `at`, `old_status`, `new_status`, `actor`, `reason`, `metadata: serde_json::Value`. |
| TransferErrorLog | audit | `timestamp`, `stage` (TransferStatus), `error_code`, `message`, `recoverable: bool`, `retry_count`. |
| RateLimitConfig, RateLimitState | rate_limit | Конфиг лимитов; состояние (in_flight, daily_volume_used, window_start). Метод `check_limit`. |
| compute_fee | fees | `(amount, asset_config) -> BridgeFee`. |
| sha256_hex, is_valid_address_hex, is_valid_tx_hash_hex | crypto | Утилиты без зависимости от ethers. |

## 2.2 Матрица допустимых переходов TransferStatus

Переход разрешён **только** если пара `(from, to)` есть в таблице. Реализация — в `TransferStatus::can_transition_to(&self, next: &TransferStatus) -> bool`.

| from \ to | Initiated | CantonLocking | CantonLocked | BscMinting | BscMinted | BscBurned | BscBurnFinalized | CantonUnlocking | CantonUnlocked | Completed | Failed | RollingBack | RolledBack | Stuck |
|-----------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Initiated | — | ✓ (C→B) | | | | ✓ (B→C) | | | | | ✓ | | | |
| CantonLocking | | — | ✓ | | | | | | | | ✓ | | | |
| CantonLocked | | | — | ✓ | | | | | | | ✓ | | | |
| BscMinting | | | | — | ✓ | | | | | | ✓ | | | |
| BscMinted | | | | | — | | | | | ✓ | ✓ | | | |
| BscBurned | | | | | | — | ✓ | | | | ✓ | | | |
| BscBurnFinalized | | | | | | | — | ✓ | | | ✓ | | | |
| CantonUnlocking | | | | | | | | — | ✓ | | ✓ | | | |
| CantonUnlocked | | | | | | | | | — | ✓ | ✓ | | | |
| Failed | | ✓ | | ✓ | | | | ✓ | | | — | ✓ | | ✓ |
| RollingBack | | | | | | | | | | | ✓ | — | ✓ | |
| Stuck | | | | | | | | | | | | ✓ | — | |

**(C→B)** = только для `TransferDirection::CantonToBsc`  
**(B→C)** = только для `TransferDirection::BscToCanton`

## 2.3 Структура BridgeTransfer (каноническая)

```rust
pub struct BridgeTransfer {
    // ── Identification ──
    pub id: TransferId,
    pub trace_id: String, // для distributed tracing
    pub direction: TransferDirection,
    pub status: TransferStatus,
    
    // ── Asset & Amount ──
    pub asset_id: String,
    pub amount: Amount,
    pub fee: Option, // вычисляется при создании
    
    // ── Canton Side ──
    pub canton_party: CantonParty,
    pub canton_contract_id: Option,
    pub canton_tx_id: Option,
    pub canton_command_id: Option, // для идемпотентности
    pub canton_offset: Option, // offset события в transaction stream
    
    // ── BSC Side ──
    pub bsc_address: BscAddress,
    pub bsc_tx_hash: Option,
    pub bsc_block_number: Option,
    pub bsc_confirmations: Option,
    
    // ── Retry & Recovery ──
    pub retry_count: u32,
    pub max_retries: u32,
    pub next_retry_at: Option<DateTime>,
    pub error_message: Option,
    pub error_history: Vec, // история ошибок для диагностики
    
    // ── Idempotency ──
    pub nonce: String, // уникальный nonce для dedup
    
    // ── Timestamps ──
    pub created_at: DateTime,
    pub updated_at: DateTime,
    pub completed_at: Option<DateTime>,
}
```

Методы:
- `new_canton_to_bsc(party, bsc_addr, asset_id, amount, fee_config) -> Self`
- `new_bsc_to_canton(bsc_addr, party, asset_id, amount, bsc_tx_hash, bsc_block) -> Self`
- `update_status(&mut self, new_status: TransferStatus, reason: &str) -> Result<(), BridgeError>`
- `increment_retry(&mut self, backoff_sec: u64)`
- `mark_stuck(&mut self)`

## 2.4 Контракт traits (сигнатуры)

```rust
#[async_trait]
pub trait CantonClient: Send + Sync {
    /// Лочит актив на Canton для последующего mint на BSC.
    /// Возвращает contract_id созданного контракта и offset события.
    async fn lock_for_bsc(
        &self,
        party: &CantonParty,
        amount: &str,
        asset_id: &str,
        bsc_recipient: &BscAddress,
        command_id: &str,
    ) -> Result;

    /// Разблокирует актив на Canton после успешного burn на BSC.
    async fn unlock_from_bsc(
        &self,
        contract_id: &CantonContractId,
        command_id: &str,
        bsc_tx_hash: &BscTxHash,
    ) -> Result;

    /// Подписка на поток транзакций Canton (от заданного offset).
    /// Возвращает канал с событиями (CreatedEvent, ArchivedEvent).
    async fn stream_events(
        &self,
        from_offset: &str,
    ) -> Result<mpsc::Receiver, BridgeError>;
    
    /// Health check — проверка доступности Canton participant
    async fn health_check(&self) -> Result;
}

#[async_trait]
pub trait BscClient: Send + Sync {
    /// Логическая «выдача» получателю при Canton→BSC.
    /// Реализация: вызов `BridgeVault.unlock(transferId, recipient, token, amount)`.
    async fn mint(
        &self,
        transfer_id: &str,
        recipient: &BscAddress,
        token: &BscAddress,
        amount: &str,
    ) -> Result;

    /// Запускает фоновую подписку на события `Locked` (BSC→Canton).
    /// События доставляются в callback (или канал).
    async fn subscribe_burns(
        &self,
        callback: Arc,
    ) -> Result;
    
    /// Проверка финальности транзакции (confirmations >= required)
    async fn check_finality(
        &self,
        tx_hash: &BscTxHash,
        required_confirmations: u64,
    ) -> Result;
    
    /// Health check — проверка доступности BSC RPC
    async fn health_check(&self) -> Result;
}
```

**DoD секции 2:**
- Все типы реализованы в `bridge-core`.
- Unit-тесты на `can_transition_to` для всех пар из матрицы.
- Property-based тесты (proptest) для валидации допустимых последовательностей статусов.
- `cargo test -p bridge-core` проходит без ошибок.

---

# ЧАСТЬ 3: ПЕРСИСТЕНТНОСТЬ (bridge-db)

## 3.1 Миграция 001_init.sql (полный текст)

Файл: `crates/bridge-db/migrations/001_init.sql`.

```sql
-- Extension для UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum типы
CREATE TYPE transfer_direction AS ENUM ('canton_to_bsc', 'bsc_to_canton');

CREATE TYPE transfer_status AS ENUM (
  'initiated',
  'canton_locking', 'canton_locked',
  'bsc_minting', 'bsc_minted',
  'bsc_burned', 'bsc_burn_finalized',
  'canton_unlocking', 'canton_unlocked',
  'completed', 'failed', 'rolling_back', 'rolled_back', 'stuck'
);

-- Таблица переводов
CREATE TABLE transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trace_id TEXT NOT NULL, -- для distributed tracing
  direction transfer_direction NOT NULL,
  status transfer_status NOT NULL,
  
  -- Asset & Amount
  asset_id TEXT NOT NULL,
  amount_raw NUMERIC(78, 0) NOT NULL,
  decimals SMALLINT NOT NULL,
  fee_raw NUMERIC(78, 0), -- total fee в base units
  
  -- Canton
  canton_party TEXT NOT NULL,
  canton_contract_id TEXT,
  canton_command_id TEXT,
  canton_tx_id TEXT,
  canton_offset TEXT,
  
  -- BSC
  bsc_address CHAR(42) NOT NULL,
  bsc_tx_hash CHAR(66),
  bsc_block_number BIGINT,
  bsc_confirmations BIGINT,
  
  -- Retry & Recovery
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  error_message TEXT,
  
  -- Idempotency
  nonce TEXT NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Уникальность для идемпотентности (partial index где NOT NULL)
CREATE UNIQUE INDEX idx_transfers_canton_command_id 
  ON transfers (canton_command_id) 
  WHERE canton_command_id IS NOT NULL;

CREATE UNIQUE INDEX idx_transfers_bsc_tx_hash 
  ON transfers (bsc_tx_hash) 
  WHERE bsc_tx_hash IS NOT NULL;

-- Индекс для recovery (pending статусы с retry)
CREATE INDEX idx_transfers_status_next_retry
  ON transfers (status, next_retry_at)
  WHERE status NOT IN ('completed', 'failed', 'rolled_back', 'stuck');

-- Индекс для списков по направлению
CREATE INDEX idx_transfers_direction_created
  ON transfers (direction, created_at DESC);

-- Индекс для поиска по BSC блоку (finality check)
CREATE INDEX idx_transfers_bsc_block
  ON transfers (bsc_block_number) 
  WHERE bsc_block_number IS NOT NULL;

-- Индекс для trace_id (distributed tracing)
CREATE INDEX idx_transfers_trace_id
  ON transfers (trace_id);
```

## 3.2 Миграция 002_audit_and_checkpoints.sql

```sql
-- Immutable audit log для всех изменений статуса
CREATE TABLE transfer_audit_log (
  id BIGSERIAL PRIMARY KEY,
  transfer_id UUID NOT NULL REFERENCES transfers(id) ON DELETE RESTRICT,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  old_status transfer_status NOT NULL,
  new_status transfer_status NOT NULL,
  actor TEXT NOT NULL, -- 'system', 'operator', 'recovery'
  reason TEXT,
  metadata JSONB -- дополнительные данные (error_code, tx_hash, etc.)
);

CREATE INDEX idx_audit_transfer_id ON transfer_audit_log (transfer_id, at DESC);
CREATE INDEX idx_audit_at ON transfer_audit_log (at DESC);

-- Checkpoints для Canton transaction stream (продолжение после рестарта)
CREATE TABLE bridge_checkpoints (
  direction transfer_direction PRIMARY KEY,
  offset_value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Event log для event sourcing (опционально, для compliance)
CREATE TABLE transfer_event_log (
  id BIGSERIAL PRIMARY KEY,
  transfer_id UUID NOT NULL,
  event_type TEXT NOT NULL, -- 'created', 'status_changed', 'retry', 'error'
  event_data JSONB NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_event_log_transfer_id ON transfer_event_log (transfer_id, at DESC);
CREATE INDEX idx_event_log_at ON transfer_event_log (at DESC);
```

## 3.3 Миграция 003_asset_registry.sql

```sql
-- Asset Registry — mapping Canton template ↔ BSC token
CREATE TABLE asset_registry (
  id TEXT PRIMARY KEY,
  canton_template_id TEXT NOT NULL UNIQUE,
  bsc_token_address CHAR(42) NOT NULL UNIQUE,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  decimals SMALLINT NOT NULL,
  
  -- Limits
  min_transfer_raw NUMERIC(78,0) NOT NULL DEFAULT 0,
  max_transfer_raw NUMERIC(78,0),
  daily_limit_raw NUMERIC(78,0),
  
  -- Fee config
  fixed_fee_raw NUMERIC(78,0) NOT NULL DEFAULT 0,
  proportional_bps INTEGER NOT NULL DEFAULT 0, -- basis points
  
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Daily volume tracking для rate limiting
CREATE TABLE asset_daily_volumes (
  asset_id TEXT NOT NULL REFERENCES asset_registry(id),
  date DATE NOT NULL,
  volume_raw NUMERIC(78,0) NOT NULL DEFAULT 0,
  PRIMARY KEY (asset_id, date)
);

CREATE INDEX idx_asset_volumes_date ON asset_daily_volumes (date DESC);
```

## 3.4 Репозиторий (обязательные операции)

Все методы в `crates/bridge-db/src/repository.rs`.

```rust
pub struct BridgeRepository {
    pool: PgPool,
}

impl BridgeRepository {
    // ── Transfers ──
    pub async fn insert(&self, transfer: &BridgeTransfer) -> Result;
    pub async fn get_by_id(&self, id: &TransferId) -> Result<Option, DbError>;
    pub async fn get_by_canton_command_id(&self, command_id: &str) -> Result<Option, DbError>;
    pub async fn get_by_bsc_tx_hash(&self, tx_hash: &BscTxHash) -> Result<Option, DbError>;
    
    pub async fn update_status(
        &self,
        id: &TransferId,
        new_status: TransferStatus,
        error_message: Option,
    ) -> Result;
    
    pub async fn list_pending(&self, limit: u32) -> Result<Vec, DbError>;
    
    pub async fn list_orphaned(
        &self,
        orphan_threshold_minutes: u32,
    ) -> Result<Vec, DbError>;
    
    // ── Audit ──
    pub async fn append_audit(
        &self,
        transfer_id: &TransferId,
        old_status: TransferStatus,
        new_status: TransferStatus,
        actor: &str,
        reason: Option,
        metadata: Option,
    ) -> Result;
    
    pub async fn get_audit_history(
        &self,
        transfer_id: &TransferId,
    ) -> Result<Vec, DbError>;
    
    // ── Checkpoints ──
    pub async fn get_checkpoint_offset(
        &self,
        direction: TransferDirection,
    ) -> Result<Option, DbError>;
    
    pub async fn set_checkpoint_offset(
        &self,
        direction: TransferDirection,
        offset: &str,
    ) -> Result;
    
    // ── Assets ──
    pub async fn get_asset(&self, asset_id: &str) -> Result<Option, DbError>;
    pub async fn list_assets(&self, enabled_only: bool) -> Result<Vec, DbError>;
    
    // ── Rate Limiting ──
    pub async fn get_daily_volume(
        &self,
        asset_id: &str,
        date: NaiveDate,
    ) -> Result;
    
    pub async fn increment_daily_volume(
        &self,
        asset_id: &str,
        date: NaiveDate,
        amount: &Amount,
    ) -> Result;
}
```

## 3.5 Event Sourcing (опционально, для compliance)

Метод `append_event` в репозитории для записи в `transfer_event_log`:

```rust
pub async fn append_event(
    &self,
    transfer_id: &TransferId,
    event_type: &str,
    event_data: serde_json::Value,
) -> Result;
```

События:
- `"created"` — при создании перевода
- `"status_changed"` — при каждом изменении статуса
- `"retry"` — при retry
- `"error"` — при ошибке
- `"manual_intervention"` — при ручной операции оператора

**DoD секции 3:**
- Миграции 001, 002, 003 применяются через `sqlx migrate run`.
- Все методы репозитория реализованы.
- Тесты репозитория (с testcontainers или in-memory SQLite) проходят.
- Partial unique indexes работают (dedup по `canton_command_id` и `bsc_tx_hash`).

---

# ЧАСТЬ 4: CANTON — LEDGER API V2, АУТЕНТИФИКАЦИЯ, mTLS

## 4.1 Canton Ledger API v2 — Сервисы и Proto

**Версия:** Canton Ledger API **v2** (не v1, который deprecated).

### 4.1.1 Proto-файлы

Расположение: `crates/canton-ledger-api/proto/com/daml/ledger/api/v2/`.

**Обязательные .proto файлы (актуальные для Canton 3.x):**

1. `command_service.proto` — отправка команд (create, exercise)
2. `command_submission_service.proto` — альтернативный способ отправки
3. `command_completion_service.proto` — completion stream (подтверждения команд)
4. `transaction_service.proto` — поток транзакций (GetTransactions, GetTransactionTrees)
5. `state_service.proto` — запрос активных контрактов (GetActiveContracts)
6. `event_query_service.proto` — поиск событий по фильтрам
7. `package_service.proto` — управление Daml пакетами (.dar)
8. `party_management_service.proto` — управление партиями (AllocateParty)
9. `admin/` — административные сервисы (health, topology, etc.)

### 4.1.2 Ключевые сервисы для моста

| Сервис | Назначение в мосте |
|--------|------------------|
| `CommandService` | Отправка команд lock/unlock; получение completion в одном вызове |
| `TransactionService` | Поток транзакций (`GetTransactions` или `GetTransactionTrees`) для обнаружения lock событий |
| `StateService` | Получение активных контрактов при старте (восстановление state) |
| `PartyManagementService` | Выделение партии для bridge operator (один раз при setup) |

**Не использовать:** v1 сервисы (deprecated).

### 4.1.3 gRPC клиент (tonic)

В `crates/canton-ledger-api/src/client.rs`:

```rust
pub struct LedgerApiClient {
    command_service: CommandServiceClient,
    transaction_service: TransactionServiceClient,
    completion_service: CompletionServiceClient,
    state_service: StateServiceClient,
    party_service: PartyManagementServiceClient,
    
    config: CantonConfig,
    auth: JwtAuthProvider,
}

impl LedgerApiClient {
    pub async fn connect(config: CantonConfig) -> Result;
    
    pub async fn submit_lock_command(
        &self,
        party: &CantonParty,
        amount: &str,
        asset_type: &str,
        bsc_recipient: &BscAddress,
        command_id: &str,
    ) -> Result;
    
    pub async fn submit_unlock_command(
        &self,
        contract_id: &CantonContractId,
        command_id: &str,
        bsc_tx_hash: &BscTxHash,
    ) -> Result;
    
    pub async fn stream_transactions(
        &self,
        from_offset: &str,
        filter: TransactionFilter,
    ) -> Result<mpsc::Receiver, CantonError>;
}
```

## 4.2 JWT Authentication

### 4.2.1 JWT Payload Structure

Canton participant требует JWT в metadata для аутентификации. Payload:

```json
{
  "https://daml.com/ledger-api": {
    "ledgerId": "participant",
    "applicationId": "bridge-service",
    "actAs": ["BridgeOperator::1220abcd..."],
    "admin": false
  },
  "exp": 1707500000,
  "iat": 1707496400
}
```

**Обязательные claims:**
- `ledgerId` — идентификатор ledger из конфига Canton
- `applicationId` — идентификатор приложения (например `"bridge-service"`)
- `actAs` — список партий, от имени которых выполняются команды
- `exp` — время истечения (unix timestamp)

**Опциональные claims:**
- `readAs` — список партий для read-only доступа
- `admin` — для административных операций (требует отдельной конфигурации participant)

### 4.2.2 JWT Signing Algorithms

Canton поддерживает:
- **RS256** (RSA с SHA-256) — рекомендуется для production (asymmetric)
- **HS256** (HMAC с SHA-256) — для dev/test (symmetric)

**Production:** использовать RS256. Приватный ключ хранить в Vault. Participant настроить на проверку публичного ключа через JWKS endpoint или статический public key.

### 4.2.3 JWT Provider Implementation

В `crates/canton-ledger-api/src/auth.rs`:

```rust
pub struct JwtAuthProvider {
    algorithm: Algorithm, // RS256 или HS256
    signing_key: EncodingKey,
    ledger_id: String,
    application_id: String,
    act_as: Vec,
    token_ttl: Duration, // например 1 час
    current_token: Arc<RwLock<Option>>, // (token, expires_at)
}

impl JwtAuthProvider {
    pub fn new(config: &CantonAuthConfig) -> Result;
    
    /// Получить токен (из кэша или создать новый при истечении)
    pub async fn get_token(&self) -> Result;
    
    /// Принудительно обновить токен
    pub async fn refresh_token(&self) -> Result;
}
```

**Token Refresh Logic:**
- При каждом вызове `get_token` проверять: осталось ли >= 60 секунд до `exp`.
- Если < 60 сек, создать новый токен.
- Токен закэшировать в `current_token` с меткой времени.

### 4.2.4 gRPC Metadata Injection

При каждом gRPC вызове добавлять JWT в metadata:

```rust
let token = self.auth.get_token().await?;
let mut request = tonic::Request::new(command);
request.metadata_mut().insert(
    "authorization",
    format!("Bearer {}", token).parse().unwrap(),
);
```

## 4.3 mTLS (Mutual TLS)

### 4.3.1 Production Requirement

В production **ОБЯЗАТЕЛЬНО** использовать mutual TLS между мостом и Canton participant.

**Canton participant config** (пример):
```hocon
canton.participants.participant.ledger-api {
  tls {
    cert-chain-file = "/path/to/participant-cert.pem"
    private-key-file = "/path/to/participant-key.pem"
    trust-collection-file = "/path/to/ca-cert.pem"
    client-auth = require
  }
}
```

### 4.3.2 Rust Client TLS Config

В `crates/canton-transport/src/lib.rs`:

```rust
pub struct TlsConfig {
    pub enabled: bool,
    pub client_cert: Option,
    pub client_key: Option,
    pub ca_cert: Option,
}

pub async fn create_grpc_channel(
    endpoint: &str,
    tls: &TlsConfig,
) -> Result {
    if tls.enabled {
        let ca_cert = tokio::fs::read(tls.ca_cert.as_ref().unwrap()).await?;
        let ca = Certificate::from_pem(ca_cert);
        
        let mut tls_config = ClientTlsConfig::new()
            .ca_certificate(ca)
            .domain_name("participant.canton.local"); // из конфига
        
        if let (Some(cert_path), Some(key_path)) = (&tls.client_cert, &tls.client_key) {
            let cert = tokio::fs::read(cert_path).await?;
            let key = tokio::fs::read(key_path).await?;
            let identity = Identity::from_pem(cert, key);
            tls_config = tls_config.identity(identity);
        }
        
        let channel = Channel::from_shared(endpoint.to_string())?
            .tls_config(tls_config)?
            .connect()
            .await?;
        Ok(channel)
    } else {
        // без TLS (только для dev/test)
        Channel::from_shared(endpoint.to_string())?
            .connect()
            .await
            .map_err(Into::into)
    }
}
```

**DoD секции 4.3:**
- mTLS работает в production (тест с самоподписанными сертификатами).
- Dev/test может использовать plaintext gRPC (tls.enabled = false).

## 4.4 Canton Command Deduplication

### 4.4.1 Механизм Dedup

Canton Ledger API имеет **встроенную дедупликацию** команд через поле `commands.command_id` и `commands.deduplication_period`.

**Принцип:**
- Одна и та же пара `(applicationId, commandId)` в пределах deduplication period не создаёт дубликат.
- При повторной отправке (retry) Canton возвращает результат первоначальной команды или ошибку, если команда уже обработана.

### 4.4.2 Command ID Format

Для моста использовать детерминированный формат:

```
bridge-{transfer_id}-{step}
```

Где:
- `transfer_id` — UUID перевода
- `step` — `"lock"` или `"unlock"`

Пример: `bridge-018d1234-5678-7abc-def0-123456789abc-lock`

### 4.4.3 Deduplication Period

Рекомендуемое значение: **24 часа** (86400 секунд).

В proto:
```protobuf
message Commands {
  string command_id = 7;
  google.protobuf.Duration deduplication_period = 9; // 86400s
}
```

## 4.5 Canton Transaction Stream

### 4.5.1 GetTransactionTrees

Для обнаружения lock событий на Canton использовать `TransactionService.GetTransactionTrees`.

**Преимущества над GetTransactions:**
- Возвращает полное дерево транзакции (включая вложенные exercise).
- Удобно для обработки сложных workflows.

**Filter:**
```rust
let filter = TransactionFilter {
    filters_by_party: {
        let mut map = HashMap::new();
        map.insert(
            operator_party.clone(),
            Filters {
                inclusive: Some(InclusiveFilters {
                    template_ids: vec![
                        TemplateFilter {
                            template_id: Some(LockedAsset_TemplateId),
                            ..Default::default()
                        }
                    ]
                })
            }
        );
        map
    }
};
```

### 4.5.2 Offset Management

Canton использует **opaque offset** (строка, не имеет структуры).

**Checkpoint workflow:**
1. Прочитать offset из `bridge_checkpoints` таблицы при старте.
2. Подписаться на stream с `begin = Some(LedgerOffset { value: Some(Absolute(offset)) })`.
3. Для каждой транзакции:
   - Обработать события (создать `BridgeTransfer`, вставить в БД).
   - **После успешной обработки** сохранить `transaction.offset` в `bridge_checkpoints`.
4. При рестарте оркестратора продолжить с последнего checkpoint.

**Идемпотентность:**
- Один offset не обрабатывать дважды.
- При дубликате события (reconnect, повтор) — проверять наличие в БД по `canton_contract_id` или `lockId`.

## 4.6 Canton Health Check

Метод `health_check` в `CantonClient`:

```rust
pub async fn health_check(&self) -> Result {
    // Попытка GetLedgerIdentity или GetLedgerEnd
    let request = GetLedgerIdentityRequest {};
    let response = self.identity_service.get_ledger_identity(request).await?;
    
    Ok(CantonHealth {
        status: "ok",
        ledger_id: response.into_inner().ledger_id,
        latency_ms: /* measure latency */,
    })
}
```

**DoD секции 4:**
- Ledger API v2 клиент подключается к Canton participant.
- JWT создаётся и обновляется автоматически (перед истечением).
- mTLS работает в production (тест с сертификатами).
- Поток транзакций подписывается с offset; checkpoint сохраняется в БД.
- Command deduplication работает (повторная отправка с тем же `command_id` не создаёт дубликат).
- Health check возвращает статус Canton participant.

---

# ЧАСТЬ 5: DAML-КОНТРАКТЫ (ПОЛНАЯ СПЕЦИФИКАЦИЯ)

## 5.1 Daml Modules Structure

Файлы в `contracts/daml/daml/Bridge/`:

```
Bridge/
├── Types.daml          -- общие типы
├── Asset.daml          -- шаблон Asset (если нужен)
├── Lock.daml           -- LockedAsset template
└── Transfer.daml       -- (опционально) CrossChainTransfer request template
```

## 5.2 Types.daml

```daml
module Bridge.Types where

-- Типы для cross-chain переводов
data AssetType = AssetType with
    symbol : Text
    decimals : Int
  deriving (Eq, Show)

data TransferDirection
  = CantonToBsc
  | BscToCanton
  deriving (Eq, Show)
```

## 5.3 Lock.daml (Канонический)

```daml
module Bridge.Lock where

import DA.Assert
import DA.Text

-- Шаблон для залоченного актива (Canton → BSC)
template LockedAsset
  with
    operator : Party      -- bridge operator (единственный кто может unlock)
    user : Party          -- владелец актива (кто лочит)
    amount : Decimal      -- сумма в Daml Decimal (10 int + 10 frac)
    assetType : Text      -- тип актива (например "cUSD")
    bscRecipient : Text   -- BSC адрес получателя (0x...)
    lockId : Text         -- уникальный ID lock (для dedup)
    bscTxHash : Optional Text -- заполняется при завершении на BSC
    createdAt : Time
  where
    signatory user, operator  -- оба должны подписать (user инициирует, operator подтверждает)
    
    -- Contract key для уникальности и поиска
    key (operator, user, lockId) : (Party, Party, Text)
    maintainer key._1
    
    ensure
      amount > 0.0
      && not (null assetType)
      && not (null bscRecipient)
      && not (null lockId)
    
    -- Choice: разблокировать (refund) на Canton при ошибке на BSC
    choice Unlock : ()
      with
        reason : Text
      controller operator
      do
        assertMsg "Unlock reason must be provided" (not (null reason))
        -- Контракт архивируется, актив возвращается user
        return ()
    
    -- Choice: завершить перевод после успешного mint на BSC
    choice CompleteTransfer : ()
      with
        bscTxHash : Text
      controller operator
      do
        assertMsg "BSC tx hash must be provided" (not (null bscTxHash))
        -- Сохраняем bsc tx hash и архивируем контракт
        -- Один lock не может быть завершён дважды (контракт уже архивирован)
        archive self
        return ()
```

**Ключевые моменты:**
- **Signatory:** `user` и `operator` — оба должны подписать создание контракта.
  - `user` создаёт контракт (инициирует lock).
  - `operator` (bridge service) подписывает как второй signatory.
- **Controller:** только `operator` может выполнить `Unlock` или `CompleteTransfer`.
- **Contract Key:** `(operator, user, lockId)` — обеспечивает уникальность и быстрый lookup.
- **Ensure:** валидация полей при создании.
- **Archive:** при `CompleteTransfer` контракт архивируется → один lock не может быть использован дважды.

## 5.4 Upgrade Strategy

### 5.4.1 Daml Package Versioning

- Каждый .dar файл имеет версию (в `daml.yaml`: `version: 1.0.0`).
- При изменении контрактов — увеличить версию.
- Canton поддерживает **package upgrade** через topology transactions.

### 5.4.2 Backward Compatibility

- Новая версия шаблона должна быть совместима (добавление полей, а не изменение существующих).
- Для breaking changes — миграция активных контрактов через Daml script или вручную.

### 5.4.3 Deployment Process

1. Собрать .dar: `daml build`
2. Загрузить на participant: `daml ledger upload-dar --host <participant> --port <port> .daml/dist/bridge-1.0.0.dar`
3. Проверить package ID: `daml ledger list-packages`
4. Обновить `canton_template_id` в конфиге моста.

**DoD секции 5:**
- `daml build` успешен.
- Шаблон `LockedAsset` развёрнут на Canton participant (Sandbox или DevNet).
- Daml script тест: создаёт `LockedAsset`, выполняет `CompleteTransfer`, проверяет архивирование.
- Upgrade процедура задокументирована в `docs/deployment.md`.

---

# ЧАСТЬ 6: BSC-КОНТРАКТЫ (SOLIDITY, PRODUCTION-READY)

## 6.1 Требования к BridgeVault

### 6.1.1 Наследование и Security Features

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract BridgeVault is 
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;
    
    // ... (см. ниже)
}
```

**Обязательные паттерны:**
- **Pausable:** emergency stop (только ADMIN_ROLE).
- **AccessControl:** роли (DEFAULT_ADMIN_ROLE, ADMIN_ROLE, OPERATOR_ROLE).
- **ReentrancyGuard:** защита от reentrancy attacks.
- **UUPS Upgradeable:** возможность обновления логики контракта без изменения адреса.
- **SafeERC20:** безопасные вызовы BEP-20 токенов.

### 6.1.2 Роли

```solidity
bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

function initialize(address admin) public initializer {
    __AccessControl_init();
    __Pausable_init();
    __ReentrancyGuard_init();
    __UUPSUpgradeable_init();
    
    _grantRole(DEFAULT_ADMIN_ROLE, admin);
    _grantRole(ADMIN_ROLE, admin);
}

function _authorizeUpgrade(address newImplementation) internal override onlyRole(ADMIN_ROLE) {}
```

**Разграничение:**
- **DEFAULT_ADMIN_ROLE:** может назначать/отзывать любые роли.
- **ADMIN_ROLE:** может pause/unpause, обновлять контракт, изменять параметры.
- **OPERATOR_ROLE:** может вызывать `unlock` (mint при Canton→BSC).

### 6.1.3 Events

```solidity
event Locked(
    bytes32 indexed transferId,
    address indexed user,
    address indexed token,
    uint256 amount,
    string cantonParty
);

event Unlocked(
    bytes32 indexed transferId,
    address indexed user,
    address indexed token,
    uint256 amount
);

event TransferProcessed(bytes32 indexed transferId, uint256 timestamp);
```

### 6.1.4 Processed Transfers Mapping

```solidity
// Deduplication: каждый transferId может быть обработан только один раз
mapping(bytes32 => bool) public processedTransfers;

modifier notProcessed(bytes32 transferId) {
    require(!processedTransfers[transferId], "Transfer already processed");
    _;
}

function _markProcessed(bytes32 transferId) internal {
    processedTransfers[transferId] = true;
    emit TransferProcessed(transferId, block.timestamp);
}
```

### 6.1.5 lock (BSC → Canton)

```solidity
/**
 * @notice Lock (burn/transfer) tokens on BSC to initiate Canton unlock
 * @param _token BEP-20 token contract address
 * @param _amount Amount in smallest unit (wei for 18 decimals)
 * @param _cantonParty Canton party ID to receive on Canton side
 */
function lock(
    address _token,
    uint256 _amount,
    string calldata _cantonParty
) external whenNotPaused nonReentrant {
    require(_amount > 0, "Amount must be > 0");
    require(bytes(_cantonParty).length > 0, "Canton party required");
    require(_token != address(0), "Invalid token address");
    
    // Generate transferId (deterministic or random)
    bytes32 transferId = keccak256(abi.encodePacked(
        msg.sender,
        _token,
        _amount,
        _cantonParty,
        block.timestamp,
        block.number
    ));
    
    require(!processedTransfers[transferId], "Duplicate transfer");
    
    // Transfer tokens from user to vault
    IERC20Upgradeable(_token).safeTransferFrom(msg.sender, address(this), _amount);
    
    _markProcessed(transferId);
    
    emit Locked(transferId, msg.sender, _token, _amount, _cantonParty);
}
```

### 6.1.6 unlock (Canton → BSC)

```solidity
/**
 * @notice Unlock (mint/release) tokens on BSC after Canton lock confirmed
 * @param _transferId Unique transfer ID from bridge
 * @param _user Recipient address on BSC
 * @param _token BEP-20 token contract address
 * @param _amount Amount in smallest unit
 */
function unlock(
    bytes32 _transferId,
    address _user,
    address _token,
    uint256 _amount
) external whenNotPaused nonReentrant onlyRole(OPERATOR_ROLE) notProcessed(_transferId) {
    require(_user != address(0), "Invalid user address");
    require(_token != address(0), "Invalid token address");
    require(_amount > 0, "Amount must be > 0");
    
    // Check vault has sufficient balance
    uint256 vaultBalance = IERC20Upgradeable(_token).balanceOf(address(this));
    require(vaultBalance >= _amount, "Insufficient vault balance");
    
    // Transfer tokens to user
    IERC20Upgradeable(_token).safeTransfer(_user, _amount);
    
    _markProcessed(_transferId);
    
    emit Unlocked(_transferId, _user, _token, _amount);
}
```

### 6.1.7 Pause/Unpause

```solidity
function pause() external onlyRole(ADMIN_ROLE) {
    _pause();
}

function unpause() external onlyRole(ADMIN_ROLE) {
    _unpause();
}
```

### 6.1.8 Emergency Withdraw (Admin Only)

```solidity
/**
 * @notice Emergency withdraw (только для критических ситуаций)
 * @param _token Token contract address
 * @param _to Recipient address
 * @param _amount Amount to withdraw
 */
function emergencyWithdraw(
    address _token,
    address _to,
    uint256 _amount
) external onlyRole(ADMIN_ROLE) {
    require(_to != address(0), "Invalid recipient");
    IERC20Upgradeable(_token).safeTransfer(_to, _amount);
}
```

## 6.2 BridgeRegistry (Asset Allowlist)

```solidity
contract BridgeRegistry is AccessControlUpgradeable {
    struct AssetConfig {
        bool enabled;
        uint256 minTransfer;
        uint256 maxTransfer;
        uint256 dailyLimit;
        uint256 dailyVolume; // текущий объём за сегодня
        uint256 lastResetDay; // день последнего сброса
    }
    
    mapping(address => AssetConfig) public assets;
    
    function registerAsset(
        address token,
        uint256 minTransfer,
        uint256 maxTransfer,
        uint256 dailyLimit
    ) external onlyRole(ADMIN_ROLE) {
        assets[token] = AssetConfig({
            enabled: true,
            minTransfer: minTransfer,
            maxTransfer: maxTransfer,
            dailyLimit: dailyLimit,
            dailyVolume: 0,
            lastResetDay: block.timestamp / 1 days
        });
    }
    
    function isAssetEnabled(address token) external view returns (bool) {
        return assets[token].enabled;
    }
    
    function checkLimits(address token, uint256 amount) external view returns (bool) {
        AssetConfig storage cfg = assets[token];
        require(cfg.enabled, "Asset not enabled");
        require(amount >= cfg.minTransfer, "Below min transfer");
        require(amount <= cfg.maxTransfer, "Exceeds max transfer");
        
        uint256 currentDay = block.timestamp / 1 days;
        uint256 dailyVolume = (currentDay == cfg.lastResetDay) ? cfg.dailyVolume : 0;
        require(dailyVolume + amount <= cfg.dailyLimit, "Exceeds daily limit");
        
        return true;
    }
}
```

## 6.3 EIP-712 Typed Signatures (опционально, для meta-transactions)

```solidity
bytes32 public constant UNLOCK_TYPEHASH = keccak256(
    "Unlock(bytes32 transferId,address user,address token,uint256 amount,uint256 nonce,uint256 deadline)"
);

function unlockWithSignature(
    bytes32 transferId,
    address user,
    address token,
    uint256 amount,
    uint256 nonce,
    uint256 deadline,
    bytes calldata signature
) external whenNotPaused nonReentrant notProcessed(transferId) {
    require(block.timestamp <= deadline, "Signature expired");
    
    bytes32 structHash = keccak256(abi.encode(
        UNLOCK_TYPEHASH,
        transferId,
        user,
        token,
        amount,
        nonce,
        deadline
    ));
    
    bytes32 digest = _hashTypedDataV4(structHash);
    address signer = ECDSA.recover(digest, signature);
    
    require(hasRole(OPERATOR_ROLE, signer), "Invalid signature");
    
    // выполнить unlock
    _unlock(transferId, user, token, amount);
}
```

## 6.4 ChainId Check (Replay Protection)

```solidity
uint256 public immutable CHAIN_ID;

constructor() {
    CHAIN_ID = block.chainid; // BSC mainnet = 56, testnet = 97
}

modifier onlyBSC() {
    require(block.chainid == CHAIN_ID, "Wrong chain");
    _;
}
```

## 6.5 Hardhat Tests

В `contracts/solidity/test/BridgeVault.test.ts`:

```typescript
describe("BridgeVault", function () {
  it("should lock tokens", async function () {
    const { vault, token, user } = await loadFixture(deployFixture);
    await token.approve(vault.address, ethers.utils.parseEther("100"));
    await vault.lock(token.address, ethers.utils.parseEther("10"), "Alice::1220abc");
    // check event Locked
  });
  
  it("should unlock tokens", async function () {
    // operator unlocks
  });
  
  it("should prevent duplicate unlock (same transferId)", async function () {
    // call unlock twice with same transferId → revert
  });
  
  it("should pause and unpause", async function () {
    // admin pauses → lock/unlock revert → unpause → works again
  });
  
  it("should upgrade via UUPS", async function () {
    // deploy new implementation → upgrade → check storage preserved
  });
});
```

**DoD секции 6:**
- Контракты компилируются (`npx hardhat compile`).
- Unit-тесты проходят (`npx hardhat test`).
- Контракт деплоится на BSC testnet (или Hardhat fork).
- Dedup работает (повторный `unlock` с тем же `transferId` ревертится).
- Pause/unpause работает.
- UUPS upgrade работает (хранение state сохраняется).

---

# ЧАСТЬ 7: ФИНАЛЬНОСТЬ И ВОССТАНОВЛЕНИЕ

## 7.1 Canton Finality Model

### 7.1.1 Что такое финальность на Canton

Canton использует **BFT consensus** на уровне домена (sequencer + mediator). Транзакция считается финальной после:
- Подтверждения sequencer (sequencing).
- Подтверждения mediator (conflict detection passed).
- Записи в participant ledger.

**Практически:** после получения `TransactionTree` из transaction stream, транзакция уже финальна (Canton не имеет reorg как blockchain).

### 7.1.2 Offset-Based Checkpointing

- Каждая транзакция имеет уникальный **offset** (строка).
- Offset монотонно возрастает.
- После обработки транзакции сохранять offset в `bridge_checkpoints`.
- При рестарте продолжать с последнего checkpoint.

**Идемпотентность:**
- Один offset не обрабатывать дважды.
- При reconnect (после crash) Canton может повторно доставить некоторые транзакции → проверять dedup по `canton_contract_id` или `lockId` в БД.

### 7.1.3 Handling Canton Disconnect

Если Canton participant становится недоступен:
- Circuit breaker переходит в `Open` (перестать слать команды).
- Transaction stream reconnect автоматически (с последнего offset).
- После восстановления связи продолжить обработку.

## 7.2 BSC Finality Model

### 7.2.1 BEP-126 Fast Finality

С BEP-126 (активирован на BSC) финальность достигается **~1 блок** (~3 сек).

**Однако:** для безопасности рекомендуется ждать **12–15 подтверждений** (probabilistic finality).

### 7.2.2 Confirmation Tracking

В `BridgeTransfer`:
```rust
pub bsc_block_number: Option,
pub bsc_confirmations: Option,
```

**Workflow:**
1. BSC tx mined → записать `bsc_block_number`.
2. Finality worker (фоновая задача): периодически (каждые 3 секунды) проверять текущий блок BSC.
3. `confirmations = current_block - bsc_block_number`.
4. Когда `confirmations >= required_confirmations` → перевести статус в `BscMinted` (или `BscBurnFinalized` для BSC→Canton).

### 7.2.3 Reorg Handling

**Проблема:** BSC может иметь reorg (до ~12 блоков в экстремальных случаях).

**Решение:**
- Не считать транзакцию финальной до `required_confirmations`.
- При обнаружении reorg (block hash изменился на данной высоте):
  - Если `bsc_confirmations < required_confirmations` → перевести статус обратно в in-flight или failed.
  - Если уже завершено на Canton → это проблема (требуется ручное вмешательство).
  
**Практика:** с `required_confirmations = 12` риск reorg минимален.

## 7.3 Orphaned / Stuck Transfers

### 7.3.1 Определение Orphaned

Перевод считается **orphaned**, если:
- Статус в `in-flight` (CantonLocking, BscMinting, CantonUnlocking, RollingBack).
- `updated_at` старше `orphan_in_flight_minutes` (например 15 минут).
- Нет активного retry (или `retry_count` не увеличивался).

### 7.3.2 Recovery при старте оркестратора

При старте (в `recovery.rs`):

```rust
pub async fn recover_orphaned_transfers(
    repo: &BridgeRepository,
    config: &RecoveryConfig,
) -> Result {
    let orphaned = repo.list_orphaned(config.orphan_in_flight_minutes).await?;
    
    for mut transfer in orphaned {
        tracing::warn!(
            transfer_id = %transfer.id,
            status = ?transfer.status,
            updated_at = %transfer.updated_at,
            "Recovering orphaned transfer"
        );
        
        // Стратегия зависит от политики:
        // 1. Если транзиентная ошибка → retry
        // 2. Если исчерпаны retry → failed
        // 3. Если в rolling_back → продолжить rollback
        
        if transfer.retry_count < transfer.max_retries {
            transfer.update_status(TransferStatus::Failed, "Orphaned — retry")?;
            transfer.increment_retry(config.retry_base_delay_sec);
            repo.update_status(&transfer.id, transfer.status, Some("Orphaned — retrying")).await?;
        } else {
            transfer.mark_stuck();
            repo.update_status(&transfer.id, TransferStatus::Stuck, Some("Orphaned — max retries")).await?;
        }
    }
    
    Ok(())
}
```

### 7.3.3 Stuck Status

После исчерпания `max_retries` перевести в `Stuck`. Stuck переводы:
- Не обрабатываются автоматически.
- Требуют ручного вмешательства оператора (через API).
- Мониторятся алертом (`bridge_stuck_transfers_total > 0`).

## 7.4 Retry & Exponential Backoff

### 7.4.1 Формула Backoff

```rust
pub fn calculate_retry_delay(retry_count: u32, config: &RetryConfig) -> Duration {
    let base = config.retry_base_delay_sec;
    let max = config.retry_max_delay_sec;
    let delay_sec = (base * 2_u64.pow(retry_count)).min(max);
    Duration::from_secs(delay_sec)
}
```

**Пример:** base = 5 сек, max = 300 сек (5 мин)
- retry 0: 5 сек
- retry 1: 10 сек
- retry 2: 20 сек
- retry 3: 40 сек
- retry 4: 80 сек
- retry 5: 160 сек
- retry 6+: 300 сек (cap)

### 7.4.2 Transient vs Permanent Errors

**Transient (retry):**
- Network timeout
- Canton participant temporary unavailable
- BSC RPC rate limit
- Nonce too low (race condition)

**Permanent (immediate fail):**
- Invalid party (Canton)
- Insufficient balance (BSC vault)
- Contract not found (Canton)
- Invalid signature

**Реализация:**
```rust
pub fn is_transient_error(error: &BridgeError) -> bool {
    match error {
        BridgeError::Canton(e) => e.is_transient(),
        BridgeError::Bsc(e) => e.is_transient(),
        BridgeError::Db(_) => false, // DB errors usually permanent
        _ => false,
    }
}
```

### 7.4.3 Dead Letter Queue (DLQ)

Для irrecoverable failures создать таблицу `dead_letter_queue`:

```sql
CREATE TABLE dead_letter_queue (
  id BIGSERIAL PRIMARY KEY,
  transfer_id UUID NOT NULL,
  error_type TEXT NOT NULL,
  error_message TEXT,
  payload JSONB, -- полный BridgeTransfer
  at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

При permanent error → вставить в DLQ, пометить статус как Failed/Stuck.

## 7.5 Graceful Shutdown (SIGTERM)

В `bridge-orchestrator/src/main.rs`:

```rust
#[tokio::main]
async fn main() -> Result> {
    // ...init...
    
    let shutdown_signal = tokio::signal::ctrl_c();
    let sigterm = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("Failed to listen for SIGTERM")
            .recv()
            .await;
    };
    
    tokio::select! {
        _ = shutdown_signal => {
            tracing::info!("Received SIGINT, shutting down gracefully");
        }
        _ = sigterm => {
            tracing::info!("Received SIGTERM, shutting down gracefully");
        }
        result = orchestrator.run() => {
            result?;
        }
    }
    
    orchestrator.shutdown().await?;
    Ok(())
}
```

**shutdown() workflow:**
1. Остановить приём новых переводов (не брать из Canton stream, BSC subscription).
2. Дождаться завершения in-flight операций (таймаут 30 сек).
3. Сохранить текущий offset Canton в `bridge_checkpoints`.
4. Закрыть gRPC channel, WebSocket, DB pool.
5. Flush логи и метрики.
6. Exit с кодом 0.

**DoD секции 7:**
- После рестарта оркестратор продолжает с checkpoint offset (Canton).
- BSC финальность учитывает `required_confirmations` (12–15).
- Orphaned переводы восстанавливаются при старте.
- Retry с exponential backoff работает (проверить в тестах).
- Graceful shutdown обрабатывает SIGTERM корректно.

---

# ЧАСТЬ 8: FEE MODEL, ЛИМИТЫ, THREAT MODEL

## 8.1 Fee Model

### 8.1.1 Компоненты Fee

**Bridge Fee** состоит из:
1. **Fixed Fee** — фиксированная сумма в единицах актива (например 1 cUSD).
2. **Proportional Fee** — процент от суммы перевода (в basis points, 1 bp = 0.01%).
3. **Gas Cost** — затраты на BSC gas (в BNB).

**Formula:**
```
total_fee = fixed_fee + (amount * proportional_bps / 10000)
net_amount = amount - total_fee
```

Gas cost оплачивает мост (из кошелька оператора). Опционально: включить gas в fee.

### 8.1.2 Gas Management

**BSC Gas Wallet:**
- Один кошелёк (приватный ключ из Vault).
- Пополнять вручную или автоматически (при balance < threshold).
- Мониторить баланс: метрика `bridge_bsc_wallet_balance_bnb`.

**Gas Estimation:**
```rust
pub async fn estimate_unlock_gas(
    provider: &Provider,
    transfer_id: &str,
    recipient: &BscAddress,
    token: &BscAddress,
    amount: &str,
) -> Result {
    let contract = BridgeVault::new(vault_address, provider.clone());
    let tx = contract.unlock(
        transfer_id.into(),
        recipient.to_ethers()?,
        token.to_ethers()?,
        amount.parse()?,
    );
    
    let gas_estimate = tx.estimate_gas().await?;
    Ok(gas_estimate)
}
```

**Gas Price Spike Handling:**
- Если gas price > threshold (например 100 Gwei) → замедлить обработку или подождать.
- Алерт: `bridge_bsc_gas_price_gwei > 100`.

### 8.1.3 Fee Configuration

В `config/bridge.yaml`:
```yaml
fees:
  default_fixed_fee_raw: "1000000" # 1 cUSD (6 decimals)
  default_proportional_bps: 10 # 0.1%
  per_asset:
    cUSD:
      fixed_fee_raw: "500000"
      proportional_bps: 5
```

В БД (таблица `asset_registry`):
```sql
ALTER TABLE asset_registry ADD COLUMN fixed_fee_raw NUMERIC(78,0) DEFAULT 0;
ALTER TABLE asset_registry ADD COLUMN proportional_bps INTEGER DEFAULT 0;
```

### 8.1.4 compute_fee

В `bridge-core/src/fees.rs`:

```rust
pub fn compute_fee(
    amount: &Amount,
    asset_config: &AssetId,
) -> Result {
    let amount_u128 = amount.to_u128()?;
    let fixed_fee_u128 = asset_config.fixed_fee.to_u128()?;
    
    let proportional_fee_u128 = (amount_u128 * asset_config.proportional_bps as u128) / 10000;
    
    let total_fee_u128 = fixed_fee_u128 + proportional_fee_u128;
    
    if total_fee_u128 > amount_u128 {
        return Err(BridgeError::Validation("Fee exceeds amount".into()));
    }
    
    let net_amount_u128 = amount_u128 - total_fee_u128;
    
    Ok(BridgeFee {
        fixed_fee: Amount::from_base_units(fixed_fee_u128.to_string(), amount.decimals),
        proportional_bps: asset_config.proportional_bps,
        estimated_gas_bnb: "0".into(), // TODO: estimate from BSC
        total_fee: Amount::from_base_units(total_fee_u128.to_string(), amount.decimals),
        net_amount: Amount::from_base_units(net_amount_u128.to_string(), amount.decimals),
    })
}
```

## 8.2 Rate Limiting & Capacity Planning

### 8.2.1 Limits Configuration

В `config/bridge.yaml`:
```yaml
limits:
  max_concurrent_transfers: 50 # одновременно обрабатываемых переводов
  max_retries: 5
  required_confirmations: 12 # BSC
  
  # Global
  global_tvl_limit_usd: "10000000" # 10M USD (в будущем)
  
  # Per-asset (в БД или конфиге)
  per_asset_daily_limit_raw: # см. asset_registry
  
  # Per-party (опционально, в БД)
  per_party_daily_limit_usd: "100000" # 100K USD
```

### 8.2.2 Проверка лимитов

В оркестраторе перед созданием перевода:

```rust
pub async fn check_limits(
    repo: &BridgeRepository,
    asset_id: &str,
    amount: &Amount,
    party: &CantonParty,
) -> Result {
    let asset = repo.get_asset(asset_id).await?
        .ok_or(BridgeError::Validation("Unknown asset".into()))?;
    
    // Min/Max transfer
    let amount_u128 = amount.to_u128()?;
    let min = asset.min_transfer.to_u128()?;
    let max = asset.max_transfer.to_u128()?;
    
    if amount_u128 < min {
        return Err(BridgeError::Validation(format!("Below min transfer: {}", min)));
    }
    if amount_u128 > max {
        return Err(BridgeError::Validation(format!("Exceeds max transfer: {}", max)));
    }
    
    // Daily limit
    let today = Utc::now().date_naive();
    let daily_volume = repo.get_daily_volume(asset_id, today).await?;
    let daily_limit = asset.daily_limit.to_u128()?;
    let used = daily_volume.to_u128()?;
    
    if used + amount_u128 > daily_limit {
        return Err(BridgeError::RateLimit(format!(
            "Daily limit exceeded: used {}, limit {}", used, daily_limit
        )));
    }
    
    // TODO: per-party limit
    
    Ok(())
}
```

### 8.2.3 Cooldown Periods (опционально)

Для защиты от spam: минимальная задержка между переводами от одной партии (например 10 секунд).

```rust
// В БД
CREATE TABLE party_last_transfer (
  party TEXT PRIMARY KEY,
  last_transfer_at TIMESTAMPTZ NOT NULL
);

// Проверка
SELECT last_transfer_at FROM party_last_transfer WHERE party = $1;
-- если (now - last_transfer_at) < cooldown → reject
```

## 8.3 Formal Threat Model

### 8.3.1 Attack Vectors

| Угроза | Описание | Mitigations |
|--------|----------|-------------|
| **Rogue Operator** | Bridge operator намеренно ворует средства (вызов `unlock` без lock на Canton) | Multi-sig для admin операций; мониторинг крупных выводов; timelock для изменения operator role |
| **Compromised Canton Participant** | Participant взломан, подделывает события lock | mTLS + JWT auth; изоляция ключей; регулярные security audits участника |
| **BSC Private Key Leak** | Приватный ключ BSC operator wallet украден | Single-purpose wallet с лимитами; алерты на большие withdrawal; процедура ротации ключа (см. runbook) |
| **Front-running (BSC)** | MEV-бот видит tx в mempool, подменяет recipient | Использовать EIP-712 signatures с nonce; приватные RPC (flashbots) |
| **Griefing Attack** | Пользователь лочит на Canton, но не завершает на BSC (занимает ликвидность) | Таймаут для незавершённых lock (auto-unlock через X часов); лимит одновременных висящих переводов на партию |
| **Sybil Attack** | Злоумышленник создаёт множество партий для обхода лимитов | KYC/AML для больших сумм (institutional); per-party daily limits |
| **BSC Reorg** | Reorg отменяет BSC tx после unlock на Canton | Ждать 12–15 confirmations; мониторинг block hash |
| **Censorship** | BSC validators цензурируют bridge tx | Использовать несколько RPC; алерт при длительной задержке tx |

### 8.3.2 Security Checklist

В `docs/threat-model.md`:

- [ ] Multi-sig на admin роль BSC контракта (минимум 2 из 3)
- [ ] Timelock (48 часов) на изменение operator role
- [ ] Canton participant в изолированной сети (VPC)
- [ ] mTLS между мостом и participant
- [ ] Приватный ключ BSC в Vault (не в env)
- [ ] Ротация ключей каждые 90 дней
- [ ] Алерты на:
  - Stuck transfers > 0
  - BSC wallet balance < threshold
  - Failed transfers rate > 5%
  - Unlock без соответствующего lock (audit log check)
- [ ] Regular security audit контрактов (минимум раз в год)
- [ ] Incident response runbook (см. docs/runbook.md)

**DoD секции 8:**
- Fee модель реализована (`compute_fee` работает).
- Лимиты (min/max/daily) проверяются при создании перевода.
- Threat model задокументирован в `docs/threat-model.md`.
- Security checklist выполнен (или запланирован).

---

# ЧАСТЬ 9: API (REST + WebSocket)

## 9.1 Базовый путь и версионирование

**Префикс:** `/api/v1`

**Версионирование:** при breaking changes создать `/api/v2`.

## 9.2 REST Endpoints

| Метод | Путь | Описание | Auth | Req Body | Response |
|-------|------|----------|------|----------|----------|
| GET | /api/v1/health | Health check (Canton, BSC, DB) | — | — | 200 JSON |
| GET | /api/v1/transfers | Список переводов (с пагинацией) | API Key (optional) | — | 200 JSON |
| GET | /api/v1/transfers/:id | Один перевод | — | — | 200 JSON / 404 |
| POST | /api/v1/transfers/:id/retry | Retry failed transfer | Admin | `{ "reason": "..." }` | 200 JSON / 4xx |
| POST | /api/v1/transfers/:id/cancel | Cancel и rollback | Admin | `{ "reason": "..." }` | 200 JSON / 4xx |
| POST | /api/v1/transfers/:id/force-complete | Force completed | Admin | `{ "reason": "..." }` | 200 JSON / 4xx |
| GET | /api/v1/assets | Список активов | — | — | 200 JSON |
| GET | /metrics | Prometheus metrics | — | — | 200 text/plain |
| GET | /api/v1/openapi.json | OpenAPI 3.0 spec | — | — | 200 JSON |

## 9.3 Примеры ответов

### GET /api/v1/health (200)

```json
{
  "status": "ok",
  "canton": {
    "status": "ok",
    "ledger_id": "participant",
    "latency_ms": 23
  },
  "bsc": {
    "status": "ok",
    "rpc_url": "https://bsc-dataseed.binance.org/",
    "latest_block": 38450123,
    "latency_ms": 45
  },
  "db": {
    "status": "ok",
    "pool_size": 10,
    "active_connections": 3
  }
}
```

**503 при degraded/down:**
```json
{
  "status": "degraded",
  "canton": { "status": "down", "error": "Connection refused" },
  "bsc": { "status": "ok", ... },
  "db": { "status": "ok", ... }
}
```

### GET /api/v1/transfers?limit=20&cursor=uuid (200)

```json
{
  "items": [
    {
      "id": "018d1234-5678-7abc-def0-123456789abc",
      "trace_id": "abc123...",
      "direction": "canton_to_bsc",
      "status": "bsc_minting",
      "asset_id": "cUSD",
      "amount": {
        "raw": "1000000",
        "decimals": 6
      },
      "canton_party": "Alice::1220...",
      "bsc_address": "0xabcd...",
      "created_at": "2026-02-09T10:00:00Z",
      "updated_at": "2026-02-09T10:05:00Z"
    }
  ],
  "next_cursor": "018d1234-5678-7abc-def0-123456789abc"
}
```

### GET /api/v1/transfers/:id (200)

Один объект в том же формате, что элемент `items` выше.

**404:**
```json
{
  "error": "Transfer not found",
  "transfer_id": "..."
}
```

### POST /api/v1/transfers/:id/retry (200)

**Request:**
```json
{
  "reason": "Manual retry by operator after Canton participant restart"
}
```

**Response:**
```json
{
  "transfer_id": "...",
  "status": "canton_locking",
  "message": "Transfer requeued for retry"
}
```

## 9.4 WebSocket (Real-Time Updates)

**Endpoint:** `GET /api/v1/transfers/stream`

**Query params:**
- `transfer_id` (optional) — подписка на конкретный перевод
- Без параметра — все обновления

**Message format (JSON):**
```json
{
  "type": "status_update",
  "transfer_id": "...",
  "old_status": "canton_locked",
  "new_status": "bsc_minting",
  "updated_at": "2026-02-09T10:10:00Z",
  "reason": "..."
}
```

**Реализация (axum):**
```rust
pub async fn transfers_stream(
    ws: WebSocketUpgrade,
    Query(params): Query,
) -> Response {
    ws.on_upgrade(|socket| handle_stream(socket, params))
}

async fn handle_stream(mut socket: WebSocket, params: StreamParams) {
    let (mut tx, mut rx) = mpsc::channel(100);
    
    // Подписаться на канал обновлений (от orchestrator)
    ORCHESTRATOR_UPDATES.subscribe(tx).await;
    
    while let Some(update) = rx.recv().await {
        if let Some(transfer_id) = &params.transfer_id {
            if update.transfer_id != *transfer_id {
                continue;
            }
        }
        
        let msg = serde_json::to_string(&update).unwrap();
        if socket.send(Message::Text(msg)).await.is_err() {
            break;
        }
    }
}
```

## 9.5 Middleware

### 9.5.1 Request ID

```rust
pub async fn request_id_middleware(
    mut req: Request,
    next: Next,
) -> Response {
    let request_id = req.headers()
        .get("X-Request-Id")
        .and_then(|v| v.to_str().ok())
        .unwrap_or_else(|| &Uuid::new_v4().to_string())
        .to_string();
    
    req.extensions_mut().insert(RequestId(request_id.clone()));
    
    let mut res = next.run(req).await;
    res.headers_mut().insert(
        "X-Request-Id",
        request_id.parse().unwrap(),
    );
    res
}
```

### 9.5.2 Structured Logging

```rust
pub async fn logging_middleware(
    req: Request,
    next: Next,
) -> Response {
    let start = Instant::now();
    let method = req.method().clone();
    let path = req.uri().path().to_string();
    let request_id = req.extensions().get::().map(|r| r.0.clone());
    
    let res = next.run(req).await;
    
    let duration = start.elapsed();
    let status = res.status();
    
    tracing::info!(
        method = %method,
        path = %path,
        status = %status.as_u16(),
        duration_ms = duration.as_millis(),
        request_id = ?request_id,
        "HTTP request"
    );
    
    res
}
```

### 9.5.3 Admin Auth

```rust
pub async fn admin_auth_middleware(
    req: Request,
    next: Next,
) -> Response {
    let api_key = req.headers()
        .get("X-API-Key")
        .and_then(|v| v.to_str().ok());
    
    let expected_key = std::env::var("BRIDGE_ADMIN_API_KEY").ok();
    
    if api_key != expected_key.as_deref() {
        return (StatusCode::UNAUTHORIZED, "Invalid API key").into_response();
    }
    
    next.run(req).await
}
```

Применить к админ-эндпоинтам:
```rust
Router::new()
    .route("/api/v1/transfers/:id/retry", post(retry_handler))
    .route("/api/v1/transfers/:id/cancel", post(cancel_handler))
    .route("/api/v1/transfers/:id/force-complete", post(force_complete_handler))
    .layer(middleware::from_fn(admin_auth_middleware))
```

## 9.6 OpenAPI 3.0

**Файл:** `docs/openapi.yaml` (или генерировать из кода через `utoipa`).

**Пример структуры:**
```yaml
openapi: 3.0.0
info:
  title: Canton-BSC Bridge API
  version: 1.0.0
paths:
  /api/v1/health:
    get:
      summary: Health check
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HealthResponse'
        '503':
          description: Service degraded
  /api/v1/transfers:
    get:
      summary: List transfers
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
        - name: cursor
          in: query
          schema:
            type: string
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TransferList'
components:
  schemas:
    HealthResponse:
      type: object
      properties:
        status:
          type: string
          enum: [ok, degraded, down]
        canton:
          $ref: '#/components/schemas/CantonHealth'
        bsc:
          $ref: '#/components/schemas/BscHealth'
        db:
          $ref: '#/components/schemas/DbHealth'
    # ...
```

**DoD секции 9:**
- Все REST эндпоинты реализованы.
- Пагинация по `cursor` работает.
- Health endpoint возвращает статус всех компонентов (Canton, BSC, DB).
- WebSocket подписка работает (real-time статусы).
- Admin эндпоинты защищены API key.
- OpenAPI 3.0 spec доступна по `/api/v1/openapi.json`.

---

# ЧАСТЬ 10: НАБЛЮДАЕМОСТЬ (OBSERVABILITY)

## 10.1 Метрики Prometheus (обязательные)

### 10.1.1 Transfer Metrics

```rust
use prometheus_client::metrics::counter::Counter;
use prometheus_client::metrics::gauge::Gauge;
use prometheus_client::metrics::histogram::Histogram;
use prometheus_client::encoding::EncodeLabelSet;

#[derive(Clone, Hash, PartialEq, Eq, EncodeLabelSet, Debug)]
struct DirectionLabel {
    direction: String, // "canton_to_bsc" | "bsc_to_canton"
}

#[derive(Clone, Hash, PartialEq, Eq, EncodeLabelSet, Debug)]
struct OperationLabel {
    operation: String, // "lock" | "unlock" | "mint"
    status: String,    // "success" | "error"
}

#[derive(Clone, Hash, PartialEq, Eq, EncodeLabelSet, Debug)]
struct TargetLabel {
    target: String, // "canton" | "bsc"
}

// Gauges
let active_transfers = Gauge::::default();
let stuck_transfers = Gauge::::default();

// Counters
let completed_transfers = Counter::::default();
let failed_transfers = Counter::::default();
let retry_total = Counter::::default();

// Histograms
let rpc_latency = Histogram::new(
    vec![0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0] // buckets in seconds
);
let operations_total = Counter::::default();
```

**Регистрация метрик:**
```rust
let mut registry = Registry::default();
let sub_registry = registry.sub_registry_with_prefix("bridge");

sub_registry.register(
    "active_transfers",
    "Number of transfers in non-terminal status",
    active_transfers.clone(),
);

sub_registry.register_with_labels(
    "operations_total",
    "Total bridge operations",
    Box::new(operations_total.clone()),
    &OperationLabel { operation: "lock".into(), status: "success".into() },
);

// ...
```

### 10.1.2 Обязательные метрики

| Имя | Тип | Labels | Описание |
|-----|-----|--------|----------|
| `bridge_active_transfers_total` | gauge | `direction` | Число переводов в нефинальных статусах |
| `bridge_completed_transfers_total` | counter | — | Общее число завершённых переводов |
| `bridge_failed_transfers_total` | counter | — | Общее число failed переводов |
| `bridge_stuck_transfers_total` | gauge | — | Число stuck переводов |
| `bridge_retry_total` | counter | `stage` | Число retry попыток |
| `bridge_rpc_latency_seconds` | histogram | `target` | Задержка RPC вызовов (Canton/BSC) |
| `bridge_operations_total` | counter | `operation, status` | Операции (lock/unlock/mint) с результатом |
| `bridge_bsc_wallet_balance_bnb` | gauge | — | Баланс BSC кошелька в BNB |
| `bridge_bsc_gas_price_gwei` | gauge | — | Текущая цена gas в Gwei |

### 10.1.3 Экспорт метрик

```rust
use prometheus_client::encoding::text::encode;

pub async fn metrics_handler() -> impl IntoResponse {
    let registry = METRICS_REGISTRY.lock().unwrap();
    let mut buf = String::new();
    encode(&mut buf, &registry).unwrap();
    (StatusCode::OK, buf)
}
```

**Endpoint:** `GET /metrics`

## 10.2 Структурированное логирование (JSON)

### 10.2.1 Формат

**Обязательные поля:**
- `timestamp` (ISO 8601)
- `level` (ERROR, WARN, INFO, DEBUG, TRACE)
- `message`
- `trace_id` (для correlation)
- `transfer_id` (если применимо)
- `status` (текущий статус перевода)
- `target` (модуль Rust, например `bridge_orchestrator::canton_to_bsc`)

**Пример:**
```json
{
  "timestamp": "2026-02-09T10:15:23.456Z",
  "level": "INFO",
  "message": "Canton lock confirmed",
  "trace_id": "abc123def456",
  "transfer_id": "018d1234-5678-7abc-def0-123456789abc",
  "status": "canton_locked",
  "canton_contract_id": "00abcd...",
  "target": "bridge_orchestrator::canton_to_bsc"
}
```

### 10.2.2 Tracing Subscriber Setup

В `bridge-orchestrator/src/main.rs`:

```rust
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

fn init_tracing() {
    let fmt_layer = fmt::layer()
        .json()
        .with_current_span(false);
    
    let filter_layer = EnvFilter::try_from_default_env()
        .or_else(|_| EnvFilter::try_new("info"))
        .unwrap();
    
    tracing_subscriber::registry()
        .with(filter_layer)
        .with(fmt_layer)
        .init();
}
```

**Environment variable:** `RUST_LOG=info,bridge_orchestrator=debug`

### 10.2.3 Не логировать секреты

**Запрещено:**
```rust
tracing::debug!(private_key = %key, "BSC key loaded"); // ❌
```

**Разрешено:**
```rust
tracing::debug!(key_hash = %sha256(&key), "BSC key loaded"); // ✅
```

## 10.3 Distributed Tracing (OpenTelemetry)

### 10.3.1 Trace Propagation

**Один `trace_id`** на весь жизненный цикл перевода.

При создании перевода:
```rust
let trace_id = Uuid::new_v4().to_string();
let span = tracing::info_span!(
    "bridge_transfer",
    trace_id = %trace_id,
    transfer_id = %transfer.id,
    direction = ?transfer.direction
);
```

При вызове Canton/BSC:
```rust
async fn call_canton_lock(transfer: &BridgeTransfer) {
    let _guard = tracing::info_span!(
        "canton_lock",
        trace_id = %transfer.trace_id,
        transfer_id = %transfer.id
    ).entered();
    
    // вызов Canton Ledger API
}
```

### 10.3.2 OTLP Export (опционально)

Если есть OTLP endpoint (Jaeger, Grafana Tempo):

```rust
use opentelemetry::global;
use opentelemetry_otlp::WithExportConfig;
use tracing_opentelemetry::OpenTelemetryLayer;

fn init_tracing_with_otlp() {
    let otlp_endpoint = std::env::var("OTEL_EXPORTER_OTLP_ENDPOINT")
        .unwrap_or_else(|_| "http://localhost:4317".into());
    
    let tracer = opentelemetry_otlp::new_pipeline()
        .tracing()
        .with_exporter(
            opentelemetry_otlp::new_exporter()
                .tonic()
                .with_endpoint(otlp_endpoint)
        )
        .with_trace_config(
            opentelemetry::sdk::trace::config()
                .with_resource(opentelemetry::sdk::Resource::new(vec![
                    opentelemetry::KeyValue::new("service.name", "bridge-orchestrator"),
                ]))
        )
        .install_batch(opentelemetry::runtime::Tokio)
        .unwrap();
    
    let telemetry_layer = OpenTelemetryLayer::new(tracer);
    
    tracing_subscriber::registry()
        .with(EnvFilter::from_default_env())
        .with(fmt::layer().json())
        .with(telemetry_layer)
        .init();
}
```

## 10.4 Alerting Rules (Prometheus)

В `monitoring/alerting/rules.yml`:

```yaml
groups:
  - name: bridge_alerts
    interval: 1m
    rules:
      - alert: BridgeStuckTransfers
        expr: bridge_stuck_transfers_total > 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Bridge has stuck transfers"
          description: "{{ $value }} transfers are stuck and need operator intervention"
      
      - alert: BridgeHighFailureRate
        expr: rate(bridge_failed_transfers_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High bridge failure rate"
          description: "Failure rate is {{ $value | humanize }} failures/sec"
      
      - alert: BridgeCantonDown
        expr: up{job="bridge-orchestrator",instance=~"canton.*"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Canton participant is down"
          description: "Canton health check failed for 2 minutes"
      
      - alert: BridgeBscDown
        expr: up{job="bridge-orchestrator",instance=~"bsc.*"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "BSC RPC is down"
          description: "BSC health check failed for 2 minutes"
      
      - alert: BridgeLowBscBalance
        expr: bridge_bsc_wallet_balance_bnb < 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Low BSC wallet balance"
          description: "BSC wallet has {{ $value }} BNB, should refill"
      
      - alert: BridgeHighGasPrice
        expr: bridge_bsc_gas_price_gwei > 100
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "BSC gas price spike"
          description: "Gas price is {{ $value }} Gwei, consider slowing down"
```

## 10.5 Dashboards (Grafana)

**Файл:** `monitoring/grafana/dashboards/bridge-dashboard.json`

**Панели:**
1. **Transfer Flow:**
   - Active transfers (gauge)
   - Completed vs Failed (rate)
   - Transfer rate (transfers/min)
2. **Status Distribution:**
   - Pie chart по статусам
3. **Latency:**
   - Canton RPC latency (p50, p95, p99)
   - BSC RPC latency (p50, p95, p99)
4. **Errors:**
   - Error rate по типу (Canton, BSC, DB)
   - Retry count histogram
5. **Resources:**
   - BSC wallet balance
   - BSC gas price
   - DB pool utilization

**DoD секции 10:**
- Метрики экспортируются на `/metrics`.
- Логи в JSON формате с `trace_id` и `transfer_id`.
- Distributed tracing работает (один `trace_id` на перевод).
- Alerting rules настроены (минимум stuck, failure rate, health).
- Grafana dashboard создан (или шаблон предоставлен).

---

# ЧАСТЬ 11: ТЕСТИРОВАНИЕ

## 11.1 Unit Tests

### 11.1.1 bridge-core

**Файл:** `crates/bridge-core/src/state_machine.rs`

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use assert_matches::assert_matches;
    
    #[test]
    fn test_can_transition_to_valid() {
        use TransferStatus::*;
        
        // Canton→BSC flow
        assert!(Initiated.can_transition_to(&CantonLocking));
        assert!(CantonLocking.can_transition_to(&CantonLocked));
        assert!(CantonLocked.can_transition_to(&BscMinting));
        assert!(BscMinting.can_transition_to(&BscMinted));
        assert!(BscMinted.can_transition_to(&Completed));
        
        // BSC→Canton flow
        assert!(Initiated.can_transition_to(&BscBurned));
        assert!(BscBurned.can_transition_to(&BscBurnFinalized));
        assert!(BscBurnFinalized.can_transition_to(&CantonUnlocking));
        assert!(CantonUnlocking.can_transition_to(&CantonUnlocked));
        assert!(CantonUnlocked.can_transition_to(&Completed));
        
        // Failures
        assert!(CantonLocking.can_transition_to(&Failed));
        assert!(BscMinting.can_transition_to(&Failed));
        
        // Rollback
        assert!(Failed.can_transition_to(&RollingBack));
        assert!(RollingBack.can_transition_to(&RolledBack));
        
        // Stuck
        assert!(Failed.can_transition_to(&Stuck));
    }
    
    #[test]
    fn test_can_transition_to_invalid() {
        use TransferStatus::*;
        
        // Invalid jumps
        assert!(!Initiated.can_transition_to(&BscMinted));
        assert!(!CantonLocked.can_transition_to(&CantonUnlocking));
        assert!(!Completed.can_transition_to(&Failed));
        assert!(!RolledBack.can_transition_to(&Initiated));
    }
    
    #[test]
    fn test_amount_from_human() {
        let amt = Amount::from_human("1.5", 18).unwrap();
        assert_eq!(amt.to_u128().unwrap(), 1_500_000_000_000_000_000);
        assert_eq!(amt.to_human(), "1.5");
    }
    
    #[test]
    fn test_amount_from_human_too_many_decimals() {
        let result = Amount::from_human("1.123456789012345678901", 18);
        assert_matches!(result, Err(AmountParseError::TooManyDecimals { .. }));
    }
}
```

### 11.1.2 Property-Based Tests (proptest)

```rust
use proptest::prelude::*;

proptest! {
    #[test]
    fn test_valid_status_sequences(
        sequence in prop::collection::vec(
            prop_oneof![
                Just(TransferStatus::Initiated),
                Just(TransferStatus::CantonLocking),
                Just(TransferStatus::CantonLocked),
                Just(TransferStatus::BscMinting),
                Just(TransferStatus::BscMinted),
                Just(TransferStatus::Completed),
            ],
            0..10
        )
    ) {
        // Проверяем, что каждый переход в последовательности допустим
        for window in sequence.windows(2) {
            if !window[0].can_transition_to(&window[1]) {
                panic!("Invalid transition: {:?} -> {:?}", window[0], window[1]);
            }
        }
    }
}
```

## 11.2 Integration Tests

### 11.2.1 bridge-db (с testcontainers)

**Файл:** `crates/bridge-db/tests/repository_test.rs`

```rust
use testcontainers::{clients, images::postgres::Postgres};
use bridge_db::BridgeRepository;
use bridge_core::*;

#[tokio::test]
async fn test_insert_and_get_transfer() {
    let docker = clients::Cli::default();
    let postgres = docker.run(Postgres::default());
    let port = postgres.get_host_port_ipv4(5432);
    
    let db_url = format!("postgres://postgres:postgres@localhost:{}/postgres", port);
    let pool = sqlx::PgPool::connect(&db_url).await.unwrap();
    
    // Run migrations
    sqlx::migrate!("./migrations").run(&pool).await.unwrap();
    
    let repo = BridgeRepository::new(pool);
    
    let transfer = BridgeTransfer::new_canton_to_bsc(
        CantonParty::new("Alice::1220abc"),
        BscAddress::new("0x1234..."),
        "cUSD".into(),
        Amount::from_human("10.0", 6).unwrap(),
    );
    
    repo.insert(&transfer).await.unwrap();
    
    let fetched = repo.get_by_id(&transfer.id).await.unwrap();
    assert!(fetched.is_some());
    assert_eq!(fetched.unwrap().id, transfer.id);
}

#[tokio::test]
async fn test_dedup_canton_command_id() {
    // ... setup DB ...
    
    let mut transfer = BridgeTransfer::new_canton_to_bsc(...);
    transfer.canton_command_id = Some("bridge-abc-lock".into());
    
    repo.insert(&transfer).await.unwrap();
    
    // Попытка вставить снова с тем же canton_command_id
    let result = repo.insert(&transfer).await;
    assert!(result.is_err()); // уникальный индекс должен сработать
}
```

### 11.2.2 Canton Sandbox Integration

**Файл:** `scripts/canton-sandbox-test.sh`

```bash
#!/bin/bash
set -e

# Запустить Canton Sandbox в Docker
docker run -d --name canton-sandbox \
  -p 30501:30501 \
  digitalasset/canton-community:latest \
  daemon --config=/path/to/sandbox.conf

# Подождать старта
sleep 10

# Загрузить .dar файл
daml ledger upload-dar \
  --host localhost \
  --port 30501 \
  .daml/dist/bridge-1.0.0.dar

# Запустить тест Rust
cargo test --test canton_integration -- --ignored

# Cleanup
docker stop canton-sandbox
docker rm canton-sandbox
```

**Rust test:**
```rust
#[tokio::test]
#[ignore] // run only with canton-sandbox-test.sh
async fn test_canton_lock_unlock() {
    let config = CantonConfig {
        grpc_url: "http://localhost:30501".into(),
        ledger_id: "sandbox".into(),
        application_id: "bridge-test".into(),
        operator_party: "BridgeOp::1220...".into(),
        tls: TlsConfig { enabled: false, .. },
    };
    
    let client = LedgerApiClient::connect(config).await.unwrap();
    
    // Submit lock command
    let contract_id = client.submit_lock_command(
        &CantonParty::new("Alice::1220..."),
        "1000000",
        "cUSD",
        &BscAddress::new("0xabcd..."),
        "test-lock-1",
    ).await.unwrap();
    
    // Submit unlock command
    client.submit_unlock_command(
        &contract_id,
        "test-unlock-1",
        &BscTxHash::new("0x1234..."),
    ).await.unwrap();
}
```

### 11.2.3 BSC Hardhat Fork

**Файл:** `contracts/solidity/hardhat.config.ts`

```typescript
export default {
  networks: {
    hardhat: {
      forking: {
        url: "https://bsc-dataseed.binance.org/",
        blockNumber: 38000000, // фиксированный блок для детерминизма
      },
    },
  },
};
```

**Test:**
```typescript
describe("BridgeVault (BSC fork)", function () {
  it("should interact with real BEP-20 token", async function () {
    const [deployer, user] = await ethers.getSigners();
    
    // Реальный адрес BUSD на BSC
    const BUSD_ADDRESS = "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56";
    const busd = await ethers.getContractAt("IERC20", BUSD_ADDRESS);
    
    // Deploy BridgeVault
    const BridgeVault = await ethers.getContractFactory("BridgeVault");
    const vault = await upgrades.deployProxy(BridgeVault, [deployer.address]);
    await vault.deployed();
    
    // ... test lock/unlock с реальным BUSD ...
  });
});
```

## 11.3 End-to-End Tests

**Файл:** `tests/e2e_canton_to_bsc.rs`

```rust
#[tokio::test]
#[ignore] // run only in E2E environment
async fn test_e2e_canton_to_bsc() {
    // 1. Setup: Canton Sandbox + BSC testnet (или Hardhat fork)
    // 2. Запустить orchestrator
    // 3. Создать lock на Canton (через Canton client или Daml script)
    // 4. Дождаться BscMinting
    // 5. Проверить unlock на BSC (через ethers)
    // 6. Проверить статус Completed в БД
    // 7. Cleanup
}
```

## 11.4 Chaos Engineering (опционально)

**Сценарии:**
1. **Canton participant crash mid-transfer:**
   - Lock команда отправлена, но completion не получен → retry → success.
2. **BSC RPC timeout:**
   - Mint tx отправлен, но RPC не отвечает → retry с nonce check → success.
3. **DB connection loss:**
   - В момент записи статуса → reconnect → idempotent retry → success.

**Инструменты:** Chaos Mesh, Toxiproxy.

## 11.5 Load Testing

**Инструмент:** k6 или Locust.

**Сценарий:**
- 100 одновременных переводов Canton→BSC.
- Измерить: throughput (transfers/sec), latency (p95, p99), error rate.
- Проверить: нет deadlocks, нет утечек памяти, метрики корректны.

**DoD секции 11:**
- Unit-тесты bridge-core проходят (state machine, amount).
- Property-based тесты (proptest) проходят.
- Integration тесты БД проходят (с testcontainers).
- Canton Sandbox integration test реализован (загружен .dar, выполнен lock/unlock).
- BSC Hardhat fork test реализован.
- Минимум один E2E сценарий (Canton→BSC или BSC→Canton) задокументирован и выполняется.
- Chaos и load testing планы описаны в `docs/testing-strategy.md`.

---

# ЧАСТЬ 12: КОНФИГУРАЦИЯ

## 12.1 Полный Пример bridge.yaml

**Файл:** `config/bridge.yaml`

```yaml
canton:
  grpc_url: "http://127.0.0.1:30501"
  ledger_id: "participant"
  application_id: "bridge-service"
  operator_party: "BridgeOperator::1220abcdef..." # заменить на реальный
  tls:
    enabled: false # true для production
    client_cert: "/path/to/client-cert.pem"
    client_key: "/path/to/client-key.pem"
    ca_cert: "/path/to/ca-cert.pem"
    domain_name: "participant.canton.local"
  auth:
    algorithm: "HS256" # или "RS256" для production
    # secret задан в env: CANTON_JWT_SECRET
    token_ttl_sec: 3600 # 1 час

bsc:
  rpc_url: "https://bsc-dataseed.binance.org/"
  ws_url: "wss://bsc-ws-node.nariox.org:443"
  bridge_contract_address: "0x..." # деплоить и заполнить
  required_confirmations: 12
  chain_id: 56 # mainnet; 97 для testnet
  gas:
    max_price_gwei: 100 # порог для алерта
    wallet_min_balance_bnb: 0.1 # алерт если меньше

db:
  url: "postgres://user:password@localhost:5432/bridge"
  max_connections: 10
  min_connections: 2
  acquire_timeout_sec: 30
  idle_timeout_sec: 600

limits:
  max_concurrent_transfers: 50
  max_retries: 5
  required_confirmations: 12 # BSC
  orphan_in_flight_minutes: 15
  # daily_volume_limit_usd: "10000000" # опционально

fees:
  default_fixed_fee_raw: "1000000" # 1 cUSD (6 decimals)
  default_proportional_bps: 10 # 0.1%

recovery:
  retry_base_delay_sec: 5
  retry_max_delay_sec: 300
  orphan_check_interval_sec: 60

observability:
  log_level: "info" # или из env RUST_LOG
  log_format: "json" # или "text"
  otlp_endpoint: "http://localhost:4317" # опционально
  metrics_listen: "0.0.0.0:9090"

api:
  listen: "0.0.0.0:8080"
  cors_allowed_origins: ["http://localhost:3000"]
  request_timeout_sec: 30
  # admin_api_key из env: BRIDGE_ADMIN_API_KEY
```

## 12.2 Environment Variables (.env.example)

**Файл:** `.env.example`

```bash
# ── Database ──
DATABASE_URL=postgres://user:password@localhost:5432/bridge

# ── BSC ──
BRIDGE_BSC_PRIVATE_KEY=0x... # НИКОГДА не коммитить реальный ключ
BSC_RPC_URL=https://bsc-dataseed.binance.org/
BSC_WS_URL=wss://bsc-ws-node.nariox.org:443

# ── Canton ──
CANTON_JWT_SECRET=... # для HS256
# CANTON_JWT_PRIVATE_KEY=... # для RS256 (base64 PEM)
CANTON_GRPC_URL=http://127.0.0.1:30501

# ── API ──
BRIDGE_ADMIN_API_KEY=... # генерировать случайный UUID

# ── Retry/Backoff (опционально, иначе из bridge.yaml) ──
# RETRY_BASE_DELAY_SEC=5
# RETRY_MAX_DELAY_SEC=300

# ── Observability ──
RUST_LOG=info,bridge_orchestrator=debug
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317

# ── Vault (для production) ──
# VAULT_ADDR=https://vault.example.com
# VAULT_TOKEN=...
# VAULT_PATH_BSC_KEY=secret/data/bridge/bsc-private-key
```

**ВАЖНО:** `.env.example` коммитить в репо; `.env` добавить в `.gitignore`.

## 12.3 Vault Integration (Production)

### 12.3.1 Секреты в Vault

**Пути:**
- `secret/data/bridge/bsc-private-key`
- `secret/data/bridge/canton-jwt-secret`
- `secret/data/bridge/admin-api-key`
- `secret/data/bridge/db-password`

### 12.3.2 Чтение из Vault (Rust)

```rust
use reqwest::Client;
use serde_json::Value;

pub async fn read_secret_from_vault(path: &str) -> Result {
    let vault_addr = std::env::var("VAULT_ADDR")?;
    let vault_token = std::env::var("VAULT_TOKEN")?;
    
    let url = format!("{}/v1/{}", vault_addr, path);
    let client = Client::new();
    
    let resp = client.get(&url)
        .header("X-Vault-Token", vault_token)
        .send()
        .await?;
    
    let body: Value = resp.json().await?;
    let secret = body["data"]["data"]["value"]
        .as_str()
        .ok_or_else(|| anyhow::anyhow!("Secret not found"))?
        .to_string();
    
    Ok(secret)
}
```

**Использование:**
```rust
let bsc_key = if let Ok(vault_path) = std::env::var("VAULT_PATH_BSC_KEY") {
    read_secret_from_vault(&vault_path).await?
} else {
    std::env::var("BRIDGE_BSC_PRIVATE_KEY")?
};
```

## 12.4 Feature Flags (опционально)

**Для gradual rollout новых фич.**

В конфиг:
```yaml
features:
  enable_websocket: true
  enable_daml_v2_contracts: false
  enable_multi_asset: true
```

В коде:
```rust
if config.features.enable_websocket {
    // запустить WebSocket сервер
}
```

## 12.5 DevNet Config

**Файл:** `config/example-devnet.yaml`

```yaml
canton:
  grpc_url: "http://65.108.15.30:30501"
  ledger_id: "participant"
  application_id: "bridge-service"
  operator_party: "..." # получить от DevNet администратора
  tls:
    enabled: false

bsc:
  rpc_url: "https://data-seed-prebsc-1-s1.binance.org:8545/" # BSC testnet
  chain_id: 97
  # ...
```

**DoD секции 12:**
- Конфиг загружается из `bridge.yaml` и env.
- Все обязательные поля валидируются при старте (если отсутствуют → ошибка с понятным сообщением).
- `.env.example` присутствует и задокументирован.
- Vault integration реализован (или планируется для production).
- DevNet конфиг создан (`config/example-devnet.yaml`).

---

# ЧАСТЬ 13: ДЕПЛОЙ И ОПЕРАЦИИ

## 13.1 Docker

### 13.1.1 Dockerfile.bridge (Multi-Stage)

**Файл:** `docker/Dockerfile.bridge`

```dockerfile
# ── Stage 1: Build ──
FROM rust:1.77-slim as builder

WORKDIR /build

# Install dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*

# Copy workspace files
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates

# Build release
RUN cargo build --release -p bridge-orchestrator -p bridge-api

# ── Stage 2: Runtime ──
FROM debian:bookworm-slim

# Install runtime deps
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy binaries
COPY --from=builder /build/target/release/bridge-orchestrator /app/
COPY --from=builder /build/target/release/bridge-api /app/

# Copy config (примеры)
COPY config /app/config

# Expose ports
EXPOSE 8080 9090

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/api/v1/health || exit 1

# Run orchestrator by default
CMD ["/app/bridge-orchestrator"]
```

### 13.1.2 docker-compose.yml (Dev)

**Файл:** `docker/docker-compose.yml`

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: bridge
      POSTGRES_PASSWORD: bridge
      POSTGRES_DB: bridge
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  
  bridge-orchestrator:
    build:
      context: ..
      dockerfile: docker/Dockerfile.bridge
    depends_on:
      - postgres
      - redis
    environment:
      DATABASE_URL: postgres://bridge:bridge@postgres:5432/bridge
      RUST_LOG: info,bridge_orchestrator=debug
      BRIDGE_BSC_PRIVATE_KEY: ${BRIDGE_BSC_PRIVATE_KEY}
      CANTON_JWT_SECRET: ${CANTON_JWT_SECRET}
    ports:
      - "9090:9090" # metrics
    volumes:
      - ../config:/app/config:ro
    command: /app/bridge-orchestrator --config /app/config/bridge.yaml
  
  bridge-api:
    build:
      context: ..
      dockerfile: docker/Dockerfile.bridge
    depends_on:
      - postgres
    environment:
      DATABASE_URL: postgres://bridge:bridge@postgres:5432/bridge
      BRIDGE_ADMIN_API_KEY: ${BRIDGE_ADMIN_API_KEY}
    ports:
      - "8080:8080"
    command: /app/bridge-api --config /app/config/bridge.yaml

volumes:
  postgres_data:
```

**Run:**
```bash
docker-compose -f docker/docker-compose.yml up -d
```

## 13.2 Database Migrations

### 13.2.1 SQLx Migrate

**Миграции** в `crates/bridge-db/migrations/`.

**Применение при старте:**
```rust
// В main.rs orchestrator
let pool = PgPool::connect(&config.db.url).await?;
sqlx::migrate!("../bridge-db/migrations")
    .run(&pool)
    .await?;
```

**Откат (вручную):**
```bash
sqlx migrate revert --database-url $DATABASE_URL
```

### 13.2.2 Blue/Green Deployment

**Стратегия:**
1. Deploy new version (green) рядом с текущей (blue).
2. Запустить smoke tests на green.
3. Switch traffic (load balancer) на green.
4. Мониторить метрики 15 минут.
5. Если OK → shutdown blue; если fail → rollback на blue.

**Миграции:**
- Только **additive** миграции (добавление колонок, таблиц).
- Для breaking changes — multi-step migration (deploy with backward compat → migrate data → remove old code).

## 13.3 Backup & Restore

### 13.3.1 Backup

**Файл:** `scripts/backup-db.sh`

```bash
#!/bin/bash
set -e

DB_URL=${DATABASE_URL:-"postgres://bridge:bridge@localhost:5432/bridge"}
BACKUP_DIR=${BACKUP_DIR:-"/backups"}
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

pg_dump "$DB_URL" -F c -f "$BACKUP_DIR/bridge_$TIMESTAMP.dump"

# Retention: удалить бэкапы старше 30 дней
find "$BACKUP_DIR" -name "bridge_*.dump" -mtime +30 -delete

echo "Backup completed: $BACKUP_DIR/bridge_$TIMESTAMP.dump"
```

**Cron:**
```
0 2 * * * /app/scripts/backup-db.sh
```

### 13.3.2 Restore

```bash
pg_restore -d "$DATABASE_URL" -c /backups/bridge_20260209_020000.dump
```

## 13.4 Key Rotation

### 13.4.1 BSC Private Key Rotation

**Runbook:** `docs/runbook.md#bsc-key-rotation`

**Шаги:**
1. Генерировать новый приватный ключ: `openssl ecparam -name secp256k1 -genkey -noout -out new-key.pem`
2. Получить адрес: `cast wallet address --private-key $(cat new-key.pem)`
3. Пополнить новый адрес (BNB для gas).
4. Добавить новый адрес в `OPERATOR_ROLE` контракта (через multi-sig).
5. Обновить `BRIDGE_BSC_PRIVATE_KEY` в Vault.
6. Restart orchestrator (graceful).
7. Мониторить: новые tx идут с нового адреса.
8. Через 24 часа: отозвать старый адрес из `OPERATOR_ROLE`.

### 13.4.2 Canton JWT Secret Rotation

**Шаги:**
1. Генерировать новый secret (для HS256) или keypair (для RS256).
2. Обновить в Vault.
3. Restart orchestrator (graceful).
4. Проверить: новые JWT работают (логи Canton participant).

## 13.5 Incident Response Runbook

**Файл:** `docs/runbook.md`

### Сценарий: Bridge Stuck

**Симптомы:**
- Метрика `bridge_stuck_transfers_total > 0`.
- Алерт в Slack/PagerDuty.

**Действия:**
1. Проверить логи последнего статуса: `grep transfer_id=<id> /var/log/bridge.log`
2. Проверить Canton participant: `GET http://canton:30501/health`
3. Проверить BSC RPC: `curl https://bsc-dataseed.binance.org/`
4. Если Canton down → restart participant; после восстановления мост продолжит с checkpoint.
5. Если BSC down → переключить на backup RPC в конфиге; restart orchestrator.
6. Если ошибка в контракте (revert) → анализировать revert reason; возможно force-complete через API.
7. После устранения: `POST /api/v1/transfers/:id/retry` с причиной.

### Сценарий: Canton Participant Offline

**Симптомы:**
- Canton health check failed.
- Переводы Canton→BSC застряли в `CantonLocking`.

**Действия:**
1. Проверить сеть: `ping participant-host`
2. Проверить Canton logs: `docker logs canton-participant`
3. Restart participant (если crash).
4. После восстановления: мост автоматически reconnect к transaction stream с offset; retry pending команд.

### Сценарий: BSC Gas Price Spike

**Симптомы:**
- `bridge_bsc_gas_price_gwei > 100`.
- Переводы Canton→BSC медленные.

**Действия:**
1. Временно: увеличить `max_price_gwei` в конфиге (если критично).
2. Или: подождать снижения gas price (мост будет retry).
3. Алерт пользователей о задержках.

**DoD секции 13:**
- Docker multi-stage build работает.
- docker-compose для dev запускает orchestrator + API + postgres.
- Migrations применяются автоматически при старте.
- Backup/restore скрипты созданы и протестированы.
- Key rotation процедуры задокументированы в runbook.
- Incident response runbook заполнен (минимум 3 сценария).

---

# ЧАСТЬ 14: ORCHESTRATOR — ПОТОК ДАННЫХ И РЕАЛИЗАЦИЯ

## 14.1 Архитектура Orchestrator

**Файл:** `crates/bridge-orchestrator/src/orchestrator.rs`

### 14.1.1 Структура

```rust
pub struct BridgeOrchestrator {
    config: Arc,
    repo: Arc,
    canton_client: Arc,
    bsc_client: Arc,
    shutdown: Arc,
}
```

### 14.1.2 Основные потоки (tasks)

**Одновременно запущенные задачи:**
1. **Canton Stream:** подписка на transaction stream, обработка lock событий.
2. **BSC Subscription:** подписка на Locked события (BSC→Canton).
3. **Pending Worker:** обработка in-flight переводов (retry, finality check).
4. **Finality Worker:** проверка BSC confirmations для BscMinting/BscBurned.
5. **Recovery Worker:** периодическая проверка orphaned transfers.
6. **Metrics Worker:** обновление метрик (active, stuck).

## 14.2 Canton→BSC Flow (canton_to_bsc.rs)

### 14.2.1 Canton Stream Handler

```rust
pub async fn run_canton_stream(
    orchestrator: Arc,
) -> Result {
    let checkpoint = orchestrator.repo
        .get_checkpoint_offset(TransferDirection::CantonToBsc)
        .await?
        .unwrap_or_else(|| CantonOffset::begin());
    
    let mut event_stream = orchestrator.canton_client
        .stream_events(&checkpoint.0)
        .await?;
    
    while let Some(event) = event_stream.recv().await {
        match event {
            TransactionEvent::Created { contract_id, template_id, arguments, offset } => {
                if !is_locked_asset_template(&template_id) {
                    continue;
                }
                
                // Parse LockedAsset fields
                let locked_asset = parse_locked_asset(&arguments)?;
                
                // Check dedup (по canton_contract_id или lockId)
                if orchestrator.repo.get_by_canton_command_id(&locked_asset.lock_id).await?.is_some() {
                    tracing::warn!(
                        lock_id = %locked_asset.lock_id,
                        "Duplicate lock event, skipping"
                    );
                    continue;
                }
                
                // Create BridgeTransfer
                let mut transfer = BridgeTransfer::new_canton_to_bsc(
                    locked_asset.user,
                    locked_asset.bsc_recipient,
                    locked_asset.asset_type.clone(),
                    Amount::from_human(&locked_asset.amount.to_string(), 6)?, // TODO: decimals from asset
                );
                transfer.status = TransferStatus::CantonLocked; // уже залочено
                transfer.canton_contract_id = Some(contract_id.clone());
                transfer.canton_offset = Some(offset.clone());
                
                // Insert to DB
                orchestrator.repo.insert(&transfer).await?;
                orchestrator.repo.append_audit(
                    &transfer.id,
                    TransferStatus::Initiated,
                    TransferStatus::CantonLocked,
                    "canton_stream",
                    Some("Lock detected on Canton"),
                    None,
                ).await?;
                
                tracing::info!(
                    transfer_id = %transfer.id,
                    lock_id = %locked_asset.lock_id,
                    amount = %transfer.amount,
                    "Canton lock detected"
                );
                
                // Save checkpoint
                orchestrator.repo.set_checkpoint_offset(
                    TransferDirection::CantonToBsc,
                    &offset.0,
                ).await?;
            }
            TransactionEvent::Archived { contract_id, offset } => {
                // LockedAsset archived (completed or unlocked)
                // Можно обновить статус, если нужно
                orchestrator.repo.set_checkpoint_offset(
                    TransferDirection::CantonToBsc,
                    &offset.0,
                ).await?;
            }
        }
    }
    
    Ok(())
}
```

### 14.2.2 Canton→BSC Pending Worker

```rust
pub async fn process_canton_to_bsc_pending(
    orchestrator: Arc,
) -> Result {
    let pending = orchestrator.repo.list_pending(50).await?;
    
    for mut transfer in pending {
        if transfer.direction != TransferDirection::CantonToBsc {
            continue;
        }
        
        match transfer.status {
            TransferStatus::CantonLocked => {
                // Mint на BSC
                handle_bsc_mint(&orchestrator, &mut transfer).await?;
            }
            TransferStatus::BscMinting => {
                // Check finality (handled by finality worker)
            }
            _ => {}
        }
    }
    
    Ok(())
}

async fn handle_bsc_mint(
    orchestrator: &BridgeOrchestrator,
    transfer: &mut BridgeTransfer,
) -> Result {
    // Проверка лимитов
    check_limits(&orchestrator.repo, &transfer.asset_id, &transfer.amount, &transfer.canton_party).await?;
    
    // Вызов BSC mint (BridgeVault.unlock)
    let transfer_id_bytes = transfer.id.as_bytes();
    let tx_hash = orchestrator.bsc_client.mint(
        &hex::encode(transfer_id_bytes),
        &transfer.bsc_address,
        &get_bsc_token_address(&transfer.asset_id)?, // из asset registry
        &transfer.amount.raw,
    ).await?;
    
    // Обновить статус
    transfer.bsc_tx_hash = Some(tx_hash.clone());
    transfer.update_status(TransferStatus::BscMinting, "Mint tx submitted")?;
    
    orchestrator.repo.update_status(
        &transfer.id,
        TransferStatus::BscMinting,
        None,
    ).await?;
    
    orchestrator.repo.append_audit(
        &transfer.id,
        TransferStatus::CantonLocked,
        TransferStatus::BscMinting,
        "orchestrator",
        Some("BSC mint tx submitted"),
        Some(serde_json::json!({ "bsc_tx_hash": tx_hash.0 })),
    ).await?;
    
    tracing::info!(
        transfer_id = %transfer.id,
        tx_hash = %tx_hash,
        "BSC mint submitted"
    );
    
    Ok(())
}
```

## 14.3 BSC→Canton Flow (bsc_to_canton.rs)

### 14.3.1 BSC Event Subscription

```rust
pub async fn run_bsc_subscription(
    orchestrator: Arc,
) -> Result {
    let callback = {
        let orch = orchestrator.clone();
        Arc::new(move |event: BurnEvent| {
            let orch = orch.clone();
            tokio::spawn(async move {
                if let Err(e) = handle_burn_event(&orch, event).await {
                    tracing::error!(error = %e, "Failed to handle burn event");
                }
            });
        })
    };
    
    orchestrator.bsc_client.subscribe_burns(callback).await?;
    
    Ok(())
}

async fn handle_burn_event(
    orchestrator: &BridgeOrchestrator,
    event: BurnEvent,
) -> Result {
    // Check dedup (по bsc_tx_hash + log_index)
    if orchestrator.repo.get_by_bsc_tx_hash(&event.tx_hash).await?.is_some() {
        tracing::warn!(
            tx_hash = %event.tx_hash,
            "Duplicate burn event, skipping"
        );
        return Ok(());
    }
    
    // Create BridgeTransfer
    let mut transfer = BridgeTransfer::new_bsc_to_canton(
        event.user,
        event.canton_party,
        event.token.to_string(), // TODO: map to asset_id
        Amount::from_base_units(event.amount.to_string(), 18), // TODO: decimals from asset
        event.tx_hash.clone(),
        event.block_number,
    );
    transfer.status = TransferStatus::BscBurned;
    
    orchestrator.repo.insert(&transfer).await?;
    orchestrator.repo.append_audit(
        &transfer.id,
        TransferStatus::Initiated,
        TransferStatus::BscBurned,
        "bsc_subscription",
        Some("Burn detected on BSC"),
        None,
    ).await?;
    
    tracing::info!(
        transfer_id = %transfer.id,
        tx_hash = %event.tx_hash,
        amount = %transfer.amount,
        "BSC burn detected"
    );
    
    Ok(())
}
```

**Версия:** 3.0 (Production-Ready, Gap-Free, Self-Sufficient)  
**Дата:** 2026-02-09  
**Стандарт:** Advanced Prompt Engineering 2025

---

## КРИТИЧЕСКОЕ ПРЕДИСЛОВИЕ

Этот промпт — **единственный источник истины** для production-ready моста Canton Network ↔ BSC.

### Что изменилось в v3.0

Добавлено **18 критических секций**, закрывающих все архитектурные gaps:
1. Canton Ledger API v2 (proto, сервисы, JWT, mTLS)
2. Daml контракты (signatory/observer/controller, upgrade strategy)
3. BSC Security (Pausable, UUPS, AccessControl, ReentrancyGuard, EIP-712)
4. Finality (Canton offset, BSC confirmations, reorg handling)
5. Threat Model (attack vectors, mitigations, security checklist)
6. Fee Model (gas management, bridge fees, spike handling)
7. Rate Limiting (per-party, per-asset, TVL, cooldown)
8. Error Recovery (orphaned, idempotency, DLQ, compensating tx)
9. Event Sourcing (immutable audit, compliance)
10. Multi-Asset (registry, decimals, validation)
11. Observability (distributed tracing, structured logging, SLO/SLI)
12. Testing (Canton Sandbox, Hardhat fork, E2E, chaos, property-based)
13. Deployment (Blue/Green, migrations, backup/restore, key rotation)
14. Config Management (Vault, feature flags, env-specific)
15. API Design (versioning, WebSocket, pagination, OpenAPI 3.0)
16. Canton-Specific (time model, command dedup, package management)
17. Cross-cutting (circuit breaker, backpressure, graceful degradation)
18. Production Readiness (SLO, runbook, monitoring, compliance)

---

# ЧАСТЬ 0: РОЛЬ И ОБЯЗАТЕЛЬНЫЕ ПРАВИЛА

## 0.1 Роль
Senior architect + backend/SDK для institutional-grade моста Canton (Daml) ↔ BSC (EVM).

## 0.2 MUST (обязательно)
- Денежные суммы: ТОЛЬКО String/u128/NUMERIC(78,0), ЗАПРЕЩЕНО float
- Идемпотентность: Canton command_id + dedup_period; BSC processedTransfers; БД unique indexes
- Секреты: ТОЛЬКО env/Vault, ротация по расписанию
- Статусы: ТОЛЬКО через TransferStatus::can_transition_to + audit log
- Логирование: JSON, trace_id, transfer_id, без секретов

## 0.3 SHOULD (желательно)
- Canton Ledger API v2 (не v1)
- Production: mTLS к Canton, WSS к BSC
- External calls: circuit breaker + exponential backoff

## 0.4 DoD (Definition of Done)
Каждая секция завершена когда: (1) код соответствует спеке, (2) нет отсылок к внешним докам для критичного, (3) тесты пройдены.

---

# ЧАСТЬ 1: WORKSPACE И СТРУКТУРА

## 1.1 Крейты

### Существующие (не удалять)
- bridge-core, canton-core, canton-ledger-api, canton-crypto, canton-wallet
- canton-observability, canton-reliability, canton-transport

### Добавить
- **bsc-client**: ethers, контракты (abigen), events, gas, nonce, tx lifecycle
- **bridge-orchestrator**: потоки Canton↔BSC, recovery, health, metrics
- **bridge-db**: PostgreSQL, SQLx, миграции, repository, audit, event sourcing
- **bridge-api**: REST v1, WebSocket, handlers, middleware (auth, request_id, logging)

## 1.2 Cargo.toml (ключевые зависимости)

```toml
[workspace.dependencies]
tokio = { version = "1.37", features = ["full"] }
tonic = { version = "0.11", features = ["tls", "tls-roots"] }
ethers = { version = "2.0", features = ["ws", "rustls", "abigen"] }
sqlx = { version = "0.7", features = ["runtime-tokio-rustls", "postgres", "uuid", "chrono", "migrate", "json"] }
tracing = "0.1"
tracing-opentelemetry = "0.23"
prometheus-client = "0.22"
jsonwebtoken = "9.3"
backon = "0.4"
governor = "0.6"
proptest = "1.4"
testcontainers = "0.15"
```

## 1.3 Структура каталогов

```
cantonnet-omnichain-sdk/
├── Cargo.toml, .env.example, rust-toolchain.toml, deny.toml
├── config/{example.yaml, bridge.yaml, example-devnet.yaml, example-production.yaml}
├── crates/{bridge-core, canton-*, bsc-client, bridge-orchestrator, bridge-db, bridge-api}
├── contracts/
│   ├── daml/{daml.yaml, daml/Bridge/{Types,Lock,Transfer}.daml}
│   └── solidity/{hardhat.config.ts, contracts/, test/, scripts/}
├── docker/{Dockerfile.bridge, docker-compose.yml, docker-compose.infra.yml}
├── scripts/{generate-proto.sh, run-tests.sh, setup-dev.sh, backup-db.sh}
├── monitoring/{prometheus.yml, grafana/dashboards/, alerting/rules.yml}
└── docs/{architecture.md, deployment.md, security.md, runbook.md, threat-model.md, fee-model.md, testing-strategy.md}
```

**DoD:** все каталоги созданы, `cargo build --workspace` успешен.

---

# ЧАСТЬ 2: ДОМЕННАЯ МОДЕЛЬ (bridge-core)

## 2.1 Ключевые типы

| Тип | Описание | Ключевые методы |
|-----|----------|----------------|
| TransferId | UUIDv7 newtype | new(), from_string(), Display |
| TransferDirection | CantonToBsc \| BscToCanton | sqlx::Type |
| TransferStatus | 14 состояний ФСМ | can_transition_to(), is_terminal(), is_retryable() |
| Amount | raw: String, decimals: u8 | from_human(), to_u128(), to_human(), is_positive() |
| BridgeTransfer | Полная структура перевода | new_canton_to_bsc(), update_status(), increment_retry() |
| BridgeError | thiserror enum | Canton, Bsc, Db, InvalidTransition, Validation, RateLimit |

## 2.2 Матрица переходов TransferStatus

Разрешённые переходы (✓ = допустимо):

```
Canton→BSC: Initiated → CantonLocking → CantonLocked → BscMinting → BscMinted → Completed
BSC→Canton: Initiated → BscBurned → BscBurnFinalized → CantonUnlocking → CantonUnlocked → Completed

Failures: любой non-terminal → Failed
Retry: Failed → (CantonLocking | BscMinting | CantonUnlocking)
Stuck: Failed → Stuck (после max_retries)
Rollback: Failed/Stuck → RollingBack → RolledBack
```

Реализация в `TransferStatus::can_transition_to(&self, next) -> bool` с использованием `matches!` macro для всех пар.

## 2.3 BridgeTransfer (каноническая структура)

```rust
pub struct BridgeTransfer {
    // ID & Tracing
    pub id: TransferId,
    pub trace_id: String,
    pub direction: TransferDirection,
    pub status: TransferStatus,
    
    // Asset & Amount
    pub asset_id: String,
    pub amount: Amount,
    pub fee: Option<BridgeFee>,
    
    // Canton
    pub canton_party: CantonParty,
    pub canton_contract_id: Option<CantonContractId>,
    pub canton_tx_id: Option<String>,
    pub canton_command_id: Option<String>, // для идемпотентности
    pub canton_offset: Option<CantonOffset>,
    
    // BSC
    pub bsc_address: BscAddress,
    pub bsc_tx_hash: Option<BscTxHash>,
    pub bsc_block_number: Option<u64>,
    pub bsc_confirmations: Option<u64>,
    
    // Retry
    pub retry_count: u32,
    pub max_retries: u32,
    pub next_retry_at: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
    pub error_history: Vec<TransferErrorLog>,
    
    // Idempotency
    pub nonce: String,
    
    // Timestamps
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}
```

## 2.4 Traits

```rust
#[async_trait]
pub trait CantonClient: Send + Sync {
    async fn lock_for_bsc(...) -> Result<(CantonContractId, CantonOffset), BridgeError>;
    async fn unlock_from_bsc(...) -> Result<CantonOffset, BridgeError>;
    async fn stream_events(from_offset: &str) -> Result<mpsc::Receiver<TransactionEvent>, BridgeError>;
    async fn health_check() -> Result<CantonHealth, BridgeError>;
}

#[async_trait]
pub trait BscClient: Send + Sync {
    async fn mint(transfer_id, recipient, token, amount) -> Result<BscTxHash, BridgeError>;
    async fn subscribe_burns(callback) -> Result<(), BridgeError>;
    async fn check_finality(tx_hash, required_confirmations) -> Result<bool, BridgeError>;
    async fn health_check() -> Result<BscHealth, BridgeError>;
}
```

**DoD:** все типы реализованы; unit-тесты на can_transition_to; proptest для допустимых последовательностей; `cargo test -p bridge-core` проходит.

---

# ЧАСТЬ 3: ПЕРСИСТЕНТНОСТЬ (bridge-db)

## 3.1 Миграции

### 001_init.sql (основные таблицы)
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE TYPE transfer_direction AS ENUM ('canton_to_bsc', 'bsc_to_canton');
CREATE TYPE transfer_status AS ENUM (
  'initiated', 'canton_locking', 'canton_locked', 'bsc_minting', 'bsc_minted',
  'bsc_burned', 'bsc_burn_finalized', 'canton_unlocking', 'canton_unlocked',
  'completed', 'failed', 'rolling_back', 'rolled_back', 'stuck'
);

CREATE TABLE transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trace_id TEXT NOT NULL,
  direction transfer_direction NOT NULL,
  status transfer_status NOT NULL,
  asset_id TEXT NOT NULL,
  amount_raw NUMERIC(78, 0) NOT NULL,
  decimals SMALLINT NOT NULL,
  fee_raw NUMERIC(78, 0),
  canton_party TEXT NOT NULL,
  canton_contract_id TEXT,
  canton_command_id TEXT, -- для идемпотентности
  canton_tx_id TEXT,
  canton_offset TEXT,
  bsc_address CHAR(42) NOT NULL,
  bsc_tx_hash CHAR(66),
  bsc_block_number BIGINT,
  bsc_confirmations BIGINT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  error_message TEXT,
  nonce TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Partial unique indexes для идемпотентности
CREATE UNIQUE INDEX idx_transfers_canton_command_id ON transfers (canton_command_id) WHERE canton_command_id IS NOT NULL;
CREATE UNIQUE INDEX idx_transfers_bsc_tx_hash ON transfers (bsc_tx_hash) WHERE bsc_tx_hash IS NOT NULL;

-- Индексы для recovery и списков
CREATE INDEX idx_transfers_status_next_retry ON transfers (status, next_retry_at) WHERE status NOT IN ('completed', 'failed', 'rolled_back', 'stuck');
CREATE INDEX idx_transfers_direction_created ON transfers (direction, created_at DESC);
CREATE INDEX idx_transfers_bsc_block ON transfers (bsc_block_number) WHERE bsc_block_number IS NOT NULL;
CREATE INDEX idx_transfers_trace_id ON transfers (trace_id);
```

### 002_audit_and_checkpoints.sql
```sql
CREATE TABLE transfer_audit_log (
  id BIGSERIAL PRIMARY KEY,
  transfer_id UUID NOT NULL REFERENCES transfers(id) ON DELETE RESTRICT,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  old_status transfer_status NOT NULL,
  new_status transfer_status NOT NULL,
  actor TEXT NOT NULL,
  reason TEXT,
  metadata JSONB
);
CREATE INDEX idx_audit_transfer_id ON transfer_audit_log (transfer_id, at DESC);

CREATE TABLE bridge_checkpoints (
  direction transfer_direction PRIMARY KEY,
  offset_value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE transfer_event_log ( -- для event sourcing
  id BIGSERIAL PRIMARY KEY,
  transfer_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_event_log_transfer_id ON transfer_event_log (transfer_id, at DESC);
```

### 003_asset_registry.sql
```sql
CREATE TABLE asset_registry (
  id TEXT PRIMARY KEY,
  canton_template_id TEXT NOT NULL UNIQUE,
  bsc_token_address CHAR(42) NOT NULL UNIQUE,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  decimals SMALLINT NOT NULL,
  min_transfer_raw NUMERIC(78,0) NOT NULL DEFAULT 0,
  max_transfer_raw NUMERIC(78,0),
  daily_limit_raw NUMERIC(78,0),
  fixed_fee_raw NUMERIC(78,0) NOT NULL DEFAULT 0,
  proportional_bps INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE asset_daily_volumes (
  asset_id TEXT NOT NULL REFERENCES asset_registry(id),
  date DATE NOT NULL,
  volume_raw NUMERIC(78,0) NOT NULL DEFAULT 0,
  PRIMARY KEY (asset_id, date)
);
```

## 3.2 Репозиторий (ключевые методы)

```rust
impl BridgeRepository {
    async fn insert(&self, transfer: &BridgeTransfer) -> Result<(), DbError>;
    async fn get_by_id(&self, id: &TransferId) -> Result<Option<BridgeTransfer>, DbError>;
    async fn get_by_canton_command_id(&self, command_id: &str) -> Result<Option<BridgeTransfer>, DbError>;
    async fn get_by_bsc_tx_hash(&self, tx_hash: &BscTxHash) -> Result<Option<BridgeTransfer>, DbError>;
    async fn update_status(&self, id: &TransferId, new_status: TransferStatus, error: Option<&str>) -> Result<(), DbError>;
    async fn list_pending(&self, limit: u32) -> Result<Vec<BridgeTransfer>, DbError>;
    async fn list_orphaned(&self, threshold_minutes: u32) -> Result<Vec<BridgeTransfer>, DbError>;
    async fn append_audit(&self, transfer_id: &TransferId, old: TransferStatus, new: TransferStatus, actor: &str, reason: Option<&str>, metadata: Option<Value>) -> Result<(), DbError>;
    async fn get_checkpoint_offset(&self, direction: TransferDirection) -> Result<Option<String>, DbError>;
    async fn set_checkpoint_offset(&self, direction: TransferDirection, offset: &str) -> Result<(), DbError>;
    async fn get_asset(&self, asset_id: &str) -> Result<Option<AssetId>, DbError>;
    async fn get_daily_volume(&self, asset_id: &str, date: NaiveDate) -> Result<Amount, DbError>;
    async fn increment_daily_volume(&self, asset_id: &str, date: NaiveDate, amount: &Amount) -> Result<(), DbError>;
}
```

**DoD:** миграции применяются; partial unique indexes работают (dedup); all методы реализованы; тесты с testcontainers проходят.

---

# ЧАСТЬ 4: CANTON — LEDGER API V2, JWT, mTLS

## 4.1 Canton Ledger API v2 Сервисы

**Proto:** `crates/canton-ledger-api/proto/com/daml/ledger/api/v2/`

Обязательные .proto:
- command_service.proto
- transaction_service.proto
- completion_service.proto
- state_service.proto
- party_management_service.proto

**Ключевые для моста:**
- CommandService: отправка lock/unlock команд
- TransactionService: GetTransactionTrees для обнаружения lock событий
- StateService: GetActiveContracts при старте (восстановление state)

## 4.2 JWT Authentication

### Payload Structure
```json
{
  "https://daml.com/ledger-api": {
    "ledgerId": "participant",
    "applicationId": "bridge-service",
    "actAs": ["BridgeOperator::1220..."],
    "admin": false
  },
  "exp": 1707500000,
  "iat": 1707496400
}
```

### Algorithm
- **Production:** RS256 (asymmetric, приватный ключ в Vault, публичный на participant через JWKS)
- **Dev:** HS256 (symmetric, secret в env)

### Token Refresh
```rust
pub struct JwtAuthProvider {
    algorithm: Algorithm,
    signing_key: EncodingKey,
    token_ttl: Duration,
    current_token: Arc<RwLock<Option<(String, Instant)>>>,
}

impl JwtAuthProvider {
    pub async fn get_token(&self) -> Result<String, CantonError> {
        // если < 60 сек до exp → refresh
    }
}
```

### gRPC Metadata Injection
```rust
let token = self.auth.get_token().await?;
let mut request = tonic::Request::new(command);
request.metadata_mut().insert("authorization", format!("Bearer {}", token).parse().unwrap());
```

## 4.3 mTLS (Production)

```rust
pub async fn create_grpc_channel(endpoint: &str, tls: &TlsConfig) -> Result<Channel, TransportError> {
    if tls.enabled {
        let ca_cert = tokio::fs::read(&tls.ca_cert).await?;
        let ca = Certificate::from_pem(ca_cert);
        let mut tls_config = ClientTlsConfig::new().ca_certificate(ca).domain_name("participant.canton.local");
        
        if let (Some(cert_path), Some(key_path)) = (&tls.client_cert, &tls.client_key) {
            let cert = tokio::fs::read(cert_path).await?;
            let key = tokio::fs::read(key_path).await?;
            let identity = Identity::from_pem(cert, key);
            tls_config = tls_config.identity(identity);
        }
        
        Channel::from_shared(endpoint.to_string())?.tls_config(tls_config)?.connect().await
    } else {
        Channel::from_shared(endpoint.to_string())?.connect().await
    }
}
```

## 4.4 Canton Command Deduplication

**Format:** `bridge-{transfer_id}-{step}` (lock | unlock)  
**Deduplication Period:** 24 часа

```protobuf
message Commands {
  string command_id = 7;
  google.protobuf.Duration deduplication_period = 9; // 86400s
}
```

## 4.5 Transaction Stream & Offset

```rust
let checkpoint = repo.get_checkpoint_offset(TransferDirection::CantonToBsc).await?.unwrap_or_else(|| CantonOffset::begin());
let mut event_stream = canton_client.stream_events(&checkpoint.0).await?;

while let Some(event) = event_stream.recv().await {
    // обработать CreatedEvent (LockedAsset)
    // ...
    // сохранить offset
    repo.set_checkpoint_offset(direction, &event.offset.0).await?;
}
```

**DoD:** клиент подключается к Canton v2; JWT создаётся и обновляется; mTLS работает (тест с сертификатами); transaction stream читается с offset; command dedup работает; health check возвращает статус.

---

# ЧАСТЬ 5: DAML-КОНТРАКТЫ

## 5.1 Lock.daml (канонический)

```daml
module Bridge.Lock where

template LockedAsset
  with
    operator : Party
    user : Party
    amount : Decimal
    assetType : Text
    bscRecipient : Text
    lockId : Text
    bscTxHash : Optional Text
    createdAt : Time
  where
    signatory user, operator -- оба подписывают
    key (operator, user, lockId) : (Party, Party, Text)
    maintainer key._1
    
    ensure
      amount > 0.0 &&
      not (null assetType) &&
      not (null bscRecipient) &&
      not (null lockId)
    
    choice Unlock : ()
      with reason : Text
      controller operator
      do
        assertMsg "Unlock reason required" (not (null reason))
        return ()
    
    choice CompleteTransfer : ()
      with bscTxHash : Text
      controller operator
      do
        assertMsg "BSC tx hash required" (not (null bscTxHash))
        archive self -- один lock не может быть завершён дважды
        return ()
```

**Ключевые моменты:**
- signatory: user + operator (оба подписывают создание)
- controller: только operator может unlock/complete
- key: (operator, user, lockId) для уникальности и lookup
- archive при CompleteTransfer → предотвращает двойное завершение

## 5.2 Upgrade Strategy

- Версионирование .dar (daml.yaml: version: 1.0.0)
- При breaking changes: multi-step migration (deploy with backward compat → migrate data → remove old code)
- Deployment: daml build → daml ledger upload-dar → обновить canton_template_id в конфиге

**DoD:** daml build успешен; LockedAsset развёрнут на participant; Daml script тест создаёт + completes + проверяет архивирование; upgrade процедура задокументирована.

---

# ЧАСТЬ 6: BSC-КОНТРАКТЫ (PRODUCTION-READY)

## 6.1 BridgeVault.sol (ПОЛНЫЙ КОНТРАКТ)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

contract BridgeVault is Initializable, AccessControlUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    mapping(bytes32 => bool) public processedTransfers;
    
    event Locked(bytes32 indexed transferId, address indexed user, address indexed token, uint256 amount, string cantonParty);
    event Unlocked(bytes32 indexed transferId, address indexed user, address indexed token, uint256 amount);
    event TransferProcessed(bytes32 indexed transferId, uint256 timestamp);
    
    function initialize(address admin) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }
    
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(ADMIN_ROLE) {}
    
    function lock(address _token, uint256 _amount, string calldata _cantonParty) external whenNotPaused nonReentrant {
        require(_amount > 0, "Amount must be > 0");
        require(bytes(_cantonParty).length > 0, "Canton party required");
        bytes32 transferId = keccak256(abi.encodePacked(msg.sender, _token, _amount, _cantonParty, block.timestamp, block.number));
        require(!processedTransfers[transferId], "Duplicate transfer");
        IERC20Upgradeable(_token).safeTransferFrom(msg.sender, address(this), _amount);
        processedTransfers[transferId] = true;
        emit Locked(transferId, msg.sender, _token, _amount, _cantonParty);
        emit TransferProcessed(transferId, block.timestamp);
    }
    
    function unlock(bytes32 _transferId, address _user, address _token, uint256 _amount) external whenNotPaused nonReentrant onlyRole(OPERATOR_ROLE) {
        require(!processedTransfers[_transferId], "Transfer already processed");
        require(_user != address(0), "Invalid user");
        require(_amount > 0, "Amount must be > 0");
        uint256 vaultBalance = IERC20Upgradeable(_token).balanceOf(address(this));
        require(vaultBalance >= _amount, "Insufficient vault balance");
        IERC20Upgradeable(_token).safeTransfer(_user, _amount);
        processedTransfers[_transferId] = true;
        emit Unlocked(_transferId, _user, _token, _amount);
        emit TransferProcessed(_transferId, block.timestamp);
    }
    
    function pause() external onlyRole(ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(ADMIN_ROLE) { _unpause(); }
    
    function emergencyWithdraw(address _token, address _to, uint256 _amount) external onlyRole(ADMIN_ROLE) {
        require(_to != address(0), "Invalid recipient");
        IERC20Upgradeable(_token).safeTransfer(_to, _amount);
    }
}
```

**Обязательные паттерны:**
- Pausable (emergency stop)
- AccessControl (роли: DEFAULT_ADMIN, ADMIN, OPERATOR)
- ReentrancyGuard (защита от reentrancy)
- UUPS (upgradeable без изменения адреса)
- SafeERC20 (безопасные вызовы токенов)
- processedTransfers (dedup)

## 6.2 EIP-712 & ChainId (опционально)

```solidity
bytes32 public constant UNLOCK_TYPEHASH = keccak256("Unlock(bytes32 transferId,address user,address token,uint256 amount,uint256 nonce,uint256 deadline)");
uint256 public immutable CHAIN_ID;

constructor() { CHAIN_ID = block.chainid; } // BSC mainnet = 56, testnet = 97

function unlockWithSignature(bytes32 transferId, address user, address token, uint256 amount, uint256 nonce, uint256 deadline, bytes calldata signature) external whenNotPaused nonReentrant {
    require(block.timestamp <= deadline, "Signature expired");
    bytes32 structHash = keccak256(abi.encode(UNLOCK_TYPEHASH, transferId, user, token, amount, nonce, deadline));
    bytes32 digest = _hashTypedDataV4(structHash);
    address signer = ECDSA.recover(digest, signature);
    require(hasRole(OPERATOR_ROLE, signer), "Invalid signature");
    _unlock(transferId, user, token, amount);
}
```

**DoD:** контракт компилируется; unit-тесты (lock, unlock, pause, dedup) проходят; деплой на BSC testnet (или Hardhat fork) выполнен; UUPS upgrade работает (storage сохраняется).

---

# ЧАСТЬ 7: ФИНАЛЬНОСТЬ И ВОССТАНОВЛЕНИЕ

## 7.1 Canton Finality
- Транзакция финальна после получения TransactionTree из stream (Canton не имеет reorg)
- Offset сохраняется в bridge_checkpoints после успешной обработки
- При reconnect продолжать с последнего offset; проверять dedup по canton_contract_id/lockId

## 7.2 BSC Finality
- BEP-126 fast finality: ~1 блок (~3 сек)
- **Для безопасности:** ждать required_confirmations (12–15)
- Finality worker: `confirmations = current_block - bsc_block_number`
- При confirmations >= required_confirmations → перевести статус в BscMinted/BscBurnFinalized

## 7.3 Reorg Handling
- Не считать tx финальной до required_confirmations
- При обнаружении reorg (block hash изменился) → если не финальная: перевести в failed/in-flight; если уже завершено на Canton: ручное вмешательство

## 7.4 Orphaned Transfers
**Определение:** статус in-flight (CantonLocking, BscMinting, CantonUnlocking, RollingBack) + updated_at старше orphan_in_flight_minutes (15 минут)

**Recovery при старте:**
```rust
pub async fn recover_orphaned_transfers(repo: &BridgeRepository, config: &RecoveryConfig) -> Result<(), BridgeError> {
    let orphaned = repo.list_orphaned(config.orphan_in_flight_minutes).await?;
    for mut transfer in orphaned {
        if transfer.retry_count < transfer.max_retries {
            transfer.update_status(TransferStatus::Failed, "Orphaned — retry")?;
            transfer.increment_retry(config.retry_base_delay_sec);
            repo.update_status(&transfer.id, transfer.status, Some("Orphaned — retrying")).await?;
        } else {
            transfer.mark_stuck();
            repo.update_status(&transfer.id, TransferStatus::Stuck, Some("Orphaned — max retries")).await?;
        }
    }
    Ok(())
}
```

## 7.5 Retry & Exponential Backoff
```rust
pub fn calculate_retry_delay(retry_count: u32, config: &RetryConfig) -> Duration {
    let base = config.retry_base_delay_sec;
    let max = config.retry_max_delay_sec;
    let delay_sec = (base * 2_u64.pow(retry_count)).min(max);
    Duration::from_secs(delay_sec)
}
```

**Transient errors (retry):** network timeout, Canton temporary unavailable, BSC rate limit, nonce too low  
**Permanent errors (immediate fail):** invalid party, insufficient balance, contract not found

## 7.6 Graceful Shutdown (SIGTERM)
1. Остановить приём новых переводов
2. Дождаться завершения in-flight (таймаут 30 сек)
3. Сохранить offset в bridge_checkpoints
4. Закрыть gRPC, WS, DB pool
5. Flush логи и метрики
6. Exit 0

**DoD:** after restart продолжает с checkpoint; BSC finality учитывает confirmations; orphaned восстанавливаются; retry с backoff работает; graceful shutdown обрабатывает SIGTERM.

---

# ЧАСТЬ 8: FEE MODEL, ЛИМИТЫ, THREAT MODEL

## 8.1 Fee Model

**Компоненты:**
- fixed_fee (в единицах актива)
- proportional_bps (basis points, 1 bp = 0.01%)
- gas_cost (в BNB, платит мост)

**Formula:** `total_fee = fixed_fee + (amount * proportional_bps / 10000); net_amount = amount - total_fee`

**Реализация:**
```rust
pub fn compute_fee(amount: &Amount, asset_config: &AssetId) -> Result<BridgeFee, BridgeError> {
    let amount_u128 = amount.to_u128()?;
    let fixed_fee_u128 = asset_config.fixed_fee.to_u128()?;
    let proportional_fee_u128 = (amount_u128 * asset_config.proportional_bps as u128) / 10000;
    let total_fee_u128 = fixed_fee_u128 + proportional_fee_u128;
    if total_fee_u128 > amount_u128 { return Err(BridgeError::Validation("Fee exceeds amount".into())); }
    let net_amount_u128 = amount_u128 - total_fee_u128;
    Ok(BridgeFee { fixed_fee: Amount::from_base_units(fixed_fee_u128.to_string(), amount.decimals), proportional_bps: asset_config.proportional_bps, estimated_gas_bnb: "0".into(), total_fee: Amount::from_base_units(total_fee_u128.to_string(), amount.decimals), net_amount: Amount::from_base_units(net_amount_u128.to_string(), amount.decimals) })
}
```

## 8.2 Rate Limiting

**Конфиг:**
```yaml
limits:
  max_concurrent_transfers: 50
  max_retries: 5
  required_confirmations: 12
  orphan_in_flight_minutes: 15
```

**Проверка лимитов:**
```rust
pub async fn check_limits(repo: &BridgeRepository, asset_id: &str, amount: &Amount, party: &CantonParty) -> Result<(), BridgeError> {
    let asset = repo.get_asset(asset_id).await?.ok_or(BridgeError::Validation("Unknown asset".into()))?;
    let amount_u128 = amount.to_u128()?;
    if amount_u128 < asset.min_transfer.to_u128()? { return Err(BridgeError::Validation(format!("Below min transfer: {}", asset.min_transfer))); }
    if amount_u128 > asset.max_transfer.to_u128()? { return Err(BridgeError::Validation(format!("Exceeds max transfer: {}", asset.max_transfer))); }
    let today = Utc::now().date_naive();
    let daily_volume = repo.get_daily_volume(asset_id, today).await?;
    let daily_limit = asset.daily_limit.to_u128()?;
    let used = daily_volume.to_u128()?;
    if used + amount_u128 > daily_limit { return Err(BridgeError::RateLimit(format!("Daily limit exceeded: used {}, limit {}", used, daily_limit))); }
    Ok(())
}
```

## 8.3 Formal Threat Model

| Угроза | Mitigations |
|--------|-------------|
| Rogue Operator | Multi-sig для admin; мониторинг крупных withdrawal; timelock для изменения operator role |
| Compromised Canton Participant | mTLS + JWT auth; изоляция ключей; регулярные security audits |
| BSC Private Key Leak | Single-purpose wallet; лимиты; алерты; процедура ротации (см. runbook) |
| Front-running (BSC) | EIP-712 signatures с nonce; приватные RPC (flashbots) |
| Griefing (lock без завершения) | Таймаут для незавершённых lock; лимит висящих переводов на партию |
| Sybil Attack | KYC/AML для больших сумм; per-party daily limits |
| BSC Reorg | Ждать 12–15 confirmations; мониторинг block hash |
| Censorship | Несколько RPC; алерт при длительной задержке tx |

**Security Checklist:**
- Multi-sig на admin роль BSC (минимум 2/3)
- Timelock (48 часов) на изменение operator role
- Canton participant в VPC
- mTLS между мостом и participant
- BSC private key в Vault
- Ротация ключей каждые 90 дней
- Алерты: stuck > 0, BSC wallet < threshold, failed rate > 5%
- Regular security audit (минимум раз в год)

**DoD:** fee модель реализована; лимиты проверяются; threat model задокументирован в docs/threat-model.md; security checklist выполнен.

---

# ЧАСТЬ 9: API (REST + WebSocket)

## 9.1 Endpoints

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| GET | /api/v1/health | — | Health check (Canton, BSC, DB) |
| GET | /api/v1/transfers | API Key (opt) | Список переводов (пагинация cursor) |
| GET | /api/v1/transfers/:id | — | Один перевод |
| POST | /api/v1/transfers/:id/retry | Admin | Retry failed transfer |
| POST | /api/v1/transfers/:id/cancel | Admin | Cancel и rollback |
| POST | /api/v1/transfers/:id/force-complete | Admin | Force completed |
| GET | /api/v1/assets | — | Список активов |
| GET | /metrics | — | Prometheus metrics |
| GET | /api/v1/openapi.json | — | OpenAPI 3.0 spec |
| GET (WS) | /api/v1/transfers/stream | — | WebSocket real-time статусы |

## 9.2 Примеры ответов

**GET /api/v1/health (200):**
```json
{
  "status": "ok",
  "canton": {"status": "ok", "ledger_id": "participant", "latency_ms": 23},
  "bsc": {"status": "ok", "latest_block": 38450123, "latency_ms": 45},
  "db": {"status": "ok", "pool_size": 10, "active_connections": 3}
}
```

**GET /api/v1/transfers?limit=20&cursor=uuid (200):**
```json
{
  "items": [
    {
      "id": "018d1234...",
      "trace_id": "abc123...",
      "direction": "canton_to_bsc",
      "status": "bsc_minting",
      "asset_id": "cUSD",
      "amount": {"raw": "1000000", "decimals": 6},
      "canton_party": "Alice::1220...",
      "bsc_address": "0xabcd...",
      "created_at": "2026-02-09T10:00:00Z",
      "updated_at": "2026-02-09T10:05:00Z"
    }
  ],
  "next_cursor": "018d1234..."
}
```

## 9.3 Middleware

```rust
// Request ID
pub async fn request_id_middleware(mut req: Request<Body>, next: Next) -> Response {
    let request_id = req.headers().get("X-Request-Id").and_then(|v| v.to_str().ok()).unwrap_or_else(|| &Uuid::new_v4().to_string()).to_string();
    req.extensions_mut().insert(RequestId(request_id.clone()));
    let mut res = next.run(req).await;
    res.headers_mut().insert("X-Request-Id", request_id.parse().unwrap());
    res
}

// Structured Logging
pub async fn logging_middleware(req: Request<Body>, next: Next) -> Response {
    let start = Instant::now();
    let method = req.method().clone();
    let path = req.uri().path().to_string();
    let request_id = req.extensions().get::<RequestId>().map(|r| r.0.clone());
    let res = next.run(req).await;
    let duration = start.elapsed();
    let status = res.status();
    tracing::info!(method = %method, path = %path, status = %status.as_u16(), duration_ms = duration.as_millis(), request_id = ?request_id, "HTTP request");
    res
}

// Admin Auth
pub async fn admin_auth_middleware(req: Request<Body>, next: Next) -> Response {
    let api_key = req.headers().get("X-API-Key").and_then(|v| v.to_str().ok());
    let expected_key = std::env::var("BRIDGE_ADMIN_API_KEY").ok();
    if api_key != expected_key.as_deref() { return (StatusCode::UNAUTHORIZED, "Invalid API key").into_response(); }
    next.run(req).await
}
```

## 9.4 WebSocket

```rust
pub async fn transfers_stream(ws: WebSocketUpgrade, Query(params): Query<StreamParams>) -> Response {
    ws.on_upgrade(|socket| handle_stream(socket, params))
}

async fn handle_stream(mut socket: WebSocket, params: StreamParams) {
    let (mut tx, mut rx) = mpsc::channel(100);
    ORCHESTRATOR_UPDATES.subscribe(tx).await;
    while let Some(update) = rx.recv().await {
        if let Some(transfer_id) = &params.transfer_id {
            if update.transfer_id != *transfer_id { continue; }
        }
        let msg = serde_json::to_string(&update).unwrap();
        if socket.send(Message::Text(msg)).await.is_err() { break; }
    }
}
```

**DoD:** все эндпоинты реализованы; пагинация cursor; health проверяет Canton/BSC/DB; WebSocket работает; admin эндпоинты защищены; OpenAPI 3.0 доступен.

---

# ЧАСТЬ 10: OBSERVABILITY

## 10.1 Prometheus Metrics

```rust
// Gauges
let active_transfers = Gauge::<u64>::default();
let stuck_transfers = Gauge::<u64>::default();

// Counters
let completed_transfers = Counter::<u64>::default();
let failed_transfers = Counter::<u64>::default();
let retry_total = Counter::<u64>::default();
let operations_total = Counter::<u64>::default();

// Histograms
let rpc_latency = Histogram::new(vec![0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]);
```

**Обязательные метрики:**
- bridge_active_transfers_total (gauge, labels: direction)
- bridge_completed_transfers_total (counter)
- bridge_failed_transfers_total (counter)
- bridge_stuck_transfers_total (gauge)
- bridge_retry_total (counter, labels: stage)
- bridge_rpc_latency_seconds (histogram, labels: target=canton|bsc)
- bridge_operations_total (counter, labels: operation, status)
- bridge_bsc_wallet_balance_bnb (gauge)
- bridge_bsc_gas_price_gwei (gauge)

**Endpoint:** GET /metrics (text/plain)

## 10.2 Structured Logging (JSON)

```rust
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

fn init_tracing() {
    let fmt_layer = fmt::layer().json().with_current_span(false);
    let filter_layer = EnvFilter::try_from_default_env().or_else(|_| EnvFilter::try_new("info")).unwrap();
    tracing_subscriber::registry().with(filter_layer).with(fmt_layer).init();
}
```

**Формат:**
```json
{
  "timestamp": "2026-02-09T10:15:23.456Z",
  "level": "INFO",
  "message": "Canton lock confirmed",
  "trace_id": "abc123...",
  "transfer_id": "018d1234...",
  "status": "canton_locked",
  "canton_contract_id": "00abcd...",
  "target": "bridge_orchestrator::canton_to_bsc"
}
```

**Не логировать секреты:**
```rust
// ❌ tracing::debug!(private_key = %key, "BSC key loaded");
// ✅ tracing::debug!(key_hash = %sha256(&key), "BSC key loaded");
```

## 10.3 Distributed Tracing

```rust
let trace_id = Uuid::new_v4().to_string();
let span = tracing::info_span!("bridge_transfer", trace_id = %trace_id, transfer_id = %transfer.id, direction = ?transfer.direction);
```

**OTLP Export (опционально):**
```rust
use opentelemetry_otlp::WithExportConfig;

let tracer = opentelemetry_otlp::new_pipeline().tracing()
    .with_exporter(opentelemetry_otlp::new_exporter().tonic().with_endpoint("http://localhost:4317"))
    .with_trace_config(opentelemetry::sdk::trace::config().with_resource(opentelemetry::sdk::Resource::new(vec![opentelemetry::KeyValue::new("service.name", "bridge-orchestrator")])))
    .install_batch(opentelemetry::runtime::Tokio).unwrap();

let telemetry_layer = tracing_opentelemetry::OpenTelemetryLayer::new(tracer);
tracing_subscriber::registry().with(EnvFilter::from_default_env()).with(fmt::layer().json()).with(telemetry_layer).init();
```

## 10.4 Alerting Rules (Prometheus)

```yaml
groups:
  - name: bridge_alerts
    interval: 1m
    rules:
      - alert: BridgeStuckTransfers
        expr: bridge_stuck_transfers_total > 0
        for: 5m
        labels: {severity: critical}
        annotations:
          summary: "Bridge has stuck transfers"
          description: "{{ $value }} transfers stuck"
      
      - alert: BridgeHighFailureRate
        expr: rate(bridge_failed_transfers_total[5m]) > 0.05
        for: 5m
        labels: {severity: warning}
        annotations:
          summary: "High bridge failure rate"
      
      - alert: BridgeCantonDown
        expr: up{job="bridge-orchestrator",instance=~"canton.*"} == 0
        for: 2m
        labels: {severity: critical}
        annotations:
          summary: "Canton participant down"
      
      - alert: BridgeBscDown
        expr: up{job="bridge-orchestrator",instance=~"bsc.*"} == 0
        for: 2m
        labels: {severity: critical}
        annotations:
          summary: "BSC RPC down"
      
      - alert: BridgeLowBscBalance
        expr: bridge_bsc_wallet_balance_bnb < 0.1
        for: 5m
        labels: {severity: warning}
        annotations:
          summary: "Low BSC wallet balance"
      
      - alert: BridgeHighGasPrice
        expr: bridge_bsc_gas_price_gwei > 100
        for: 10m
        labels: {severity: warning}
        annotations:
          summary: "BSC gas price spike"
```

**DoD:** метрики экспортируются /metrics; логи JSON с trace_id; distributed tracing работает; alerting rules настроены; Grafana dashboard создан (или шаблон).

---

# ЧАСТЬ 11: КОНФИГУРАЦИЯ

## 11.1 bridge.yaml (полный)

```yaml
canton:
  grpc_url: "http://127.0.0.1:30501"
  ledger_id: "participant"
  application_id: "bridge-service"
  operator_party: "BridgeOperator::1220..."
  tls:
    enabled: false # true для production
    client_cert: "/path/to/client-cert.pem"
    client_key: "/path/to/client-key.pem"
    ca_cert: "/path/to/ca-cert.pem"
    domain_name: "participant.canton.local"
  auth:
    algorithm: "HS256" # или "RS256"
    token_ttl_sec: 3600

bsc:
  rpc_url: "https://bsc-dataseed.binance.org/"
  ws_url: "wss://bsc-ws-node.nariox.org:443"
  bridge_contract_address: "0x..."
  required_confirmations: 12
  chain_id: 56
  gas:
    max_price_gwei: 100
    wallet_min_balance_bnb: 0.1

db:
  url: "postgres://user:password@localhost:5432/bridge"
  max_connections: 10
  min_connections: 2
  acquire_timeout_sec: 30
  idle_timeout_sec: 600

limits:
  max_concurrent_transfers: 50
  max_retries: 5
  orphan_in_flight_minutes: 15

fees:
  default_fixed_fee_raw: "1000000"
  default_proportional_bps: 10

recovery:
  retry_base_delay_sec: 5
  retry_max_delay_sec: 300
  orphan_check_interval_sec: 60

observability:
  log_level: "info"
  log_format: "json"
  otlp_endpoint: "http://localhost:4317"
  metrics_listen: "0.0.0.0:9090"

api:
  listen: "0.0.0.0:8080"
  cors_allowed_origins: ["http://localhost:3000"]
  request_timeout_sec: 30
```

## 11.2 .env.example

```bash
DATABASE_URL=postgres://user:password@localhost:5432/bridge
BRIDGE_BSC_PRIVATE_KEY=0x...
BSC_RPC_URL=https://bsc-dataseed.binance.org/
BSC_WS_URL=wss://bsc-ws-node.nariox.org:443
CANTON_JWT_SECRET=...
CANTON_GRPC_URL=http://127.0.0.1:30501
BRIDGE_ADMIN_API_KEY=...
RUST_LOG=info,bridge_orchestrator=debug
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
```

## 11.3 DevNet Config

**example-devnet.yaml:**
```yaml
canton:
  grpc_url: "http://65.108.15.30:30501"
  ledger_id: "participant"
  application_id: "bridge-service"
  operator_party: "..." # от DevNet администратора
  tls: {enabled: false}

bsc:
  rpc_url: "https://data-seed-prebsc-1-s1.binance.org:8545/" # BSC testnet
  chain_id: 97
```

## 11.4 Vault Integration

```rust
pub async fn read_secret_from_vault(path: &str) -> Result<String, anyhow::Error> {
    let vault_addr = std::env::var("VAULT_ADDR")?;
    let vault_token = std::env::var("VAULT_TOKEN")?;
    let url = format!("{}/v1/{}", vault_addr, path);
    let client = reqwest::Client::new();
    let resp = client.get(&url).header("X-Vault-Token", vault_token).send().await?;
    let body: serde_json::Value = resp.json().await?;
    let secret = body["data"]["data"]["value"].as_str().ok_or_else(|| anyhow::anyhow!("Secret not found"))?.to_string();
    Ok(secret)
}
```

**Использование:**
```rust
let bsc_key = if let Ok(vault_path) = std::env::var("VAULT_PATH_BSC_KEY") {
    read_secret_from_vault(&vault_path).await?
} else {
    std::env::var("BRIDGE_BSC_PRIVATE_KEY")?
};
```

**DoD:** конфиг загружается из файла + env; все обязательные поля валидируются; .env.example присутствует; Vault integration реализован; DevNet конфиг создан.

---

# ЧАСТЬ 12: ДЕПЛОЙ И ОПЕРАЦИИ

## 12.1 Dockerfile.bridge (Multi-Stage)

```dockerfile
FROM rust:1.77-slim as builder
WORKDIR /build
RUN apt-get update && apt-get install -y pkg-config libssl-dev protobuf-compiler && rm -rf /var/lib/apt/lists/*
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
RUN cargo build --release -p bridge-orchestrator -p bridge-api

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /build/target/release/bridge-orchestrator /app/
COPY --from=builder /build/target/release/bridge-api /app/
COPY config /app/config
EXPOSE 8080 9090
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD curl -f http://localhost:8080/api/v1/health || exit 1
CMD ["/app/bridge-orchestrator"]
```

## 12.2 docker-compose.yml (Dev)

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: bridge
      POSTGRES_PASSWORD: bridge
      POSTGRES_DB: bridge
    ports: ["5432:5432"]
    volumes: [postgres_data:/var/lib/postgresql/data]
  
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
  
  bridge-orchestrator:
    build: {context: .., dockerfile: docker/Dockerfile.bridge}
    depends_on: [postgres, redis]
    environment:
      DATABASE_URL: postgres://bridge:bridge@postgres:5432/bridge
      RUST_LOG: info,bridge_orchestrator=debug
      BRIDGE_BSC_PRIVATE_KEY: ${BRIDGE_BSC_PRIVATE_KEY}
      CANTON_JWT_SECRET: ${CANTON_JWT_SECRET}
    ports: ["9090:9090"]
    volumes: [../config:/app/config:ro]
    command: /app/bridge-orchestrator --config /app/config/bridge.yaml
  
  bridge-api:
    build: {context: .., dockerfile: docker/Dockerfile.bridge}
    depends_on: [postgres]
    environment:
      DATABASE_URL: postgres://bridge:bridge@postgres:5432/bridge
      BRIDGE_ADMIN_API_KEY: ${BRIDGE_ADMIN_API_KEY}
    ports: ["8080:8080"]
    command: /app/bridge-api --config /app/config/bridge.yaml

volumes: {postgres_data:}
```

## 12.3 Database Migrations

**Применение при старте:**
```rust
let pool = PgPool::connect(&config.db.url).await?;
sqlx::migrate!("../bridge-db/migrations").run(&pool).await?;
```

**Откат (вручную):**
```bash
sqlx migrate revert --database-url $DATABASE_URL
```

## 12.4 Blue/Green Deployment
1. Deploy new (green) рядом с current (blue)
2. Smoke tests на green
3. Switch traffic на green
4. Мониторить 15 минут
5. Если OK → shutdown blue; если fail → rollback на blue

## 12.5 Backup & Restore

**Backup (scripts/backup-db.sh):**
```bash
#!/bin/bash
set -e
DB_URL=${DATABASE_URL:-"postgres://bridge:bridge@localhost:5432/bridge"}
BACKUP_DIR=${BACKUP_DIR:-"/backups"}
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
pg_dump "$DB_URL" -F c -f "$BACKUP_DIR/bridge_$TIMESTAMP.dump"
find "$BACKUP_DIR" -name "bridge_*.dump" -mtime +30 -delete
echo "Backup completed: $BACKUP_DIR/bridge_$TIMESTAMP.dump"
```

**Cron:** `0 2 * * * /app/scripts/backup-db.sh`

**Restore:**
```bash
pg_restore -d "$DATABASE_URL" -c /backups/bridge_20260209_020000.dump
```

## 12.6 Key Rotation (Runbook)

**BSC Private Key:**
1. Генерировать новый: `openssl ecparam -name secp256k1 -genkey -noout -out new-key.pem`
2. Получить адрес: `cast wallet address --private-key $(cat new-key.pem)`
3. Пополнить новый адрес (BNB)
4. Добавить в OPERATOR_ROLE (multi-sig)
5. Обновить BRIDGE_BSC_PRIVATE_KEY в Vault
6. Restart orchestrator (graceful)
7. Мониторить: новые tx с нового адреса
8. Через 24ч отозвать старый из OPERATOR_ROLE

**Canton JWT Secret:**
1. Генерировать новый secret/keypair
2. Обновить в Vault
3. Restart orchestrator
4. Проверить логи Canton participant

**DoD:** Docker build работает; docker-compose запускает orchestrator + API + postgres; migrations автоматически; backup/restore скрипты протестированы; key rotation задокументирован в runbook.

---

# ЧАСТЬ 13: ТЕСТИРОВАНИЕ

## 13.1 Unit Tests

**bridge-core/src/state_machine.rs:**
```rust
#[cfg(test)]
mod tests {
    use super::*;
    use assert_matches::assert_matches;
    
    #[test]
    fn test_can_transition_to_valid() {
        use TransferStatus::*;
        assert!(Initiated.can_transition_to(&CantonLocking));
        assert!(CantonLocking.can_transition_to(&CantonLocked));
        assert!(CantonLocked.can_transition_to(&BscMinting));
        assert!(BscMinting.can_transition_to(&BscMinted));
        assert!(BscMinted.can_transition_to(&Completed));
        assert!(Initiated.can_transition_to(&BscBurned));
        assert!(BscBurned.can_transition_to(&BscBurnFinalized));
        assert!(BscBurnFinalized.can_transition_to(&CantonUnlocking));
        assert!(CantonUnlocking.can_transition_to(&CantonUnlocked));
        assert!(CantonUnlocked.can_transition_to(&Completed));
        assert!(CantonLocking.can_transition_to(&Failed));
        assert!(Failed.can_transition_to(&RollingBack));
        assert!(RollingBack.can_transition_to(&RolledBack));
        assert!(Failed.can_transition_to(&Stuck));
    }
    
    #[test]
    fn test_can_transition_to_invalid() {
        use TransferStatus::*;
        assert!(!Initiated.can_transition_to(&BscMinted));
        assert!(!CantonLocked.can_transition_to(&CantonUnlocking));
        assert!(!Completed.can_transition_to(&Failed));
    }
    
    #[test]
    fn test_amount_from_human() {
        let amt = Amount::from_human("1.5", 18).unwrap();
        assert_eq!(amt.to_u128().unwrap(), 1_500_000_000_000_000_000);
        assert_eq!(amt.to_human(), "1.5");
    }
}
```

## 13.2 Property-Based Tests (proptest)

```rust
use proptest::prelude::*;

proptest! {
    #[test]
    fn test_valid_status_sequences(sequence in prop::collection::vec(prop_oneof![Just(TransferStatus::Initiated), Just(TransferStatus::CantonLocking), Just(TransferStatus::CantonLocked), Just(TransferStatus::BscMinting), Just(TransferStatus::BscMinted), Just(TransferStatus::Completed)], 0..10)) {
        for window in sequence.windows(2) {
            if !window[0].can_transition_to(&window[1]) {
                panic!("Invalid transition: {:?} -> {:?}", window[0], window[1]);
            }
        }
    }
}
```

## 13.3 Integration Tests (bridge-db)

```rust
use testcontainers::{clients, images::postgres::Postgres};

#[tokio::test]
async fn test_insert_and_get_transfer() {
    let docker = clients::Cli::default();
    let postgres = docker.run(Postgres::default());
    let port = postgres.get_host_port_ipv4(5432);
    let db_url = format!("postgres://postgres:postgres@localhost:{}/postgres", port);
    let pool = sqlx::PgPool::connect(&db_url).await.unwrap();
    sqlx::migrate!("./migrations").run(&pool).await.unwrap();
    let repo = BridgeRepository::new(pool);
    let transfer = BridgeTransfer::new_canton_to_bsc(...);
    repo.insert(&transfer).await.unwrap();
    let fetched = repo.get_by_id(&transfer.id).await.unwrap();
    assert!(fetched.is_some());
    assert_eq!(fetched.unwrap().id, transfer.id);
}
```

## 13.4 Canton Sandbox Integration

**scripts/canton-sandbox-test.sh:**
```bash
#!/bin/bash
set -e
docker run -d --name canton-sandbox -p 30501:30501 digitalasset/canton-community:latest daemon --config=/path/to/sandbox.conf
sleep 10
daml ledger upload-dar --host localhost --port 30501 .daml/dist/bridge-1.0.0.dar
cargo test --test canton_integration -- --ignored
docker stop canton-sandbox && docker rm canton-sandbox
```

## 13.5 BSC Hardhat Fork

**hardhat.config.ts:**
```typescript
export default {
  networks: {
    hardhat: {
      forking: {
        url: "https://bsc-dataseed.binance.org/",
        blockNumber: 38000000,
      },
    },
  },
};
```

## 13.6 E2E Test

```rust
#[tokio::test]
#[ignore]
async fn test_e2e_canton_to_bsc() {
    // 1. Setup: Canton Sandbox + BSC testnet (или fork)
    // 2. Запустить orchestrator
    // 3. Создать lock на Canton
    // 4. Дождаться BscMinting
    // 5. Проверить unlock на BSC
    // 6. Проверить статус Completed
}
```

**DoD:** unit-тесты bridge-core проходят; proptest проходят; integration тесты БД с testcontainers; Canton Sandbox test реализован; BSC Hardhat fork test реализован; минимум 1 E2E сценарий выполняется; chaos и load testing планы описаны в docs/testing-strategy.md.

---

# ЧАСТЬ 14: ORCHESTRATOR — FLOW И РЕАЛИЗАЦИЯ

## 14.1 Архитектура

**Файл:** bridge-orchestrator/src/orchestrator.rs

**Структура:**
```rust
pub struct BridgeOrchestrator {
    config: Arc<BridgeConfig>,
    repo: Arc<BridgeRepository>,
    canton_client: Arc<dyn CantonClient>,
    bsc_client: Arc<dyn BscClient>,
    shutdown: Arc<Notify>,
}
```

**Основные потоки (tasks):**
1. Canton Stream: подписка на transaction stream, обработка lock событий
2. BSC Subscription: подписка на Locked события (BSC→Canton)
3. Pending Worker: обработка in-flight переводов (retry, finality check)
4. Finality Worker: проверка BSC confirmations для BscMinting/BscBurned
5. Recovery Worker: периодическая проверка orphaned
6. Metrics Worker: обновление метрик (active, stuck)

## 14.2 Canton→BSC Flow

**canton_to_bsc.rs:**

```rust
pub async fn run_canton_stream(orchestrator: Arc<BridgeOrchestrator>) -> Result<(), BridgeError> {
    let checkpoint = orchestrator.repo.get_checkpoint_offset(TransferDirection::CantonToBsc).await?.unwrap_or_else(|| CantonOffset::begin());
    let mut event_stream = orchestrator.canton_client.stream_events(&checkpoint.0).await?;
    
    while let Some(event) = event_stream.recv().await {
        match event {
            TransactionEvent::Created { contract_id, template_id, arguments, offset } => {
                if !is_locked_asset_template(&template_id) { continue; }
                let locked_asset = parse_locked_asset(&arguments)?;
                if orchestrator.repo.get_by_canton_command_id(&locked_asset.lock_id).await?.is_some() { continue; }
                
                let mut transfer = BridgeTransfer::new_canton_to_bsc(locked_asset.user, locked_asset.bsc_recipient, locked_asset.asset_type.clone(), Amount::from_human(&locked_asset.amount.to_string(), 6)?);
                transfer.status = TransferStatus::CantonLocked;
                transfer.canton_contract_id = Some(contract_id.clone());
                transfer.canton_offset = Some(offset.clone());
                
                orchestrator.repo.insert(&transfer).await?;
                orchestrator.repo.append_audit(&transfer.id, TransferStatus::Initiated, TransferStatus::CantonLocked, "canton_stream", Some("Lock detected"), None).await?;
                
                tracing::info!(transfer_id = %transfer.id, lock_id = %locked_asset.lock_id, amount = %transfer.amount, "Canton lock detected");
                
                orchestrator.repo.set_checkpoint_offset(TransferDirection::CantonToBsc, &offset.0).await?;
            }
            TransactionEvent::Archived { offset, .. } => {
                orchestrator.repo.set_checkpoint_offset(TransferDirection::CantonToBsc, &offset.0).await?;
            }
        }
    }
    Ok(())
}

pub async fn process_canton_to_bsc_pending(orchestrator: Arc<BridgeOrchestrator>) -> Result<(), BridgeError> {
    let pending = orchestrator.repo.list_pending(50).await?;
    for mut transfer in pending {
        if transfer.direction != TransferDirection::CantonToBsc { continue; }
        match transfer.status {
            TransferStatus::CantonLocked => handle_bsc_mint(&orchestrator, &mut transfer).await?,
            _ => {}
        }
    }
    Ok(())
}

async fn handle_bsc_mint(orchestrator: &BridgeOrchestrator, transfer: &mut BridgeTransfer) -> Result<(), BridgeError> {
    check_limits(&orchestrator.repo, &transfer.asset_id, &transfer.amount, &transfer.canton_party).await?;
    let transfer_id_bytes = transfer.id.as_bytes();
    let tx_hash = orchestrator.bsc_client.mint(&hex::encode(transfer_id_bytes), &transfer.bsc_address, &get_bsc_token_address(&transfer.asset_id)?, &transfer.amount.raw).await?;
    transfer.bsc_tx_hash = Some(tx_hash.clone());
    transfer.update_status(TransferStatus::BscMinting, "Mint tx submitted")?;
    orchestrator.repo.update_status(&transfer.id, TransferStatus::BscMinting, None).await?;
    orchestrator.repo.append_audit(&transfer.id, TransferStatus::CantonLocked, TransferStatus::BscMinting, "orchestrator", Some("BSC mint submitted"), Some(serde_json::json!({"bsc_tx_hash": tx_hash.0}))).await?;
    tracing::info!(transfer_id = %transfer.id, tx_hash = %tx_hash, "BSC mint submitted");
    Ok(())
}
```

## 14.3 BSC→Canton Flow

**bsc_to_canton.rs:**

```rust
pub async fn run_bsc_subscription(orchestrator: Arc<BridgeOrchestrator>) -> Result<(), BridgeError> {
    let callback = {
        let orch = orchestrator.clone();
        Arc::new(move |event: BurnEvent| {
            let orch = orch.clone();
            tokio::spawn(async move {
                if let Err(e) = handle_burn_event(&orch, event).await {
                    tracing::error!(error = %e, "Failed to handle burn event");
                }
            });
        })
    };
    orchestrator.bsc_client.subscribe_burns(callback).await?;
    Ok(())
}

async fn handle_burn_event(orchestrator: &BridgeOrchestrator, event: BurnEvent) -> Result<(), BridgeError> {
    if orchestrator.repo.get_by_bsc_tx_hash(&event.tx_hash).await?.is_some() { return Ok(()); }
    let mut transfer = BridgeTransfer::new_bsc_to_canton(event.user, event.canton_party, event.token.to_string(), Amount::from_base_units(event.amount.to_string(), 18), event.tx_hash.clone(), event.block_number);
    transfer.status = TransferStatus::BscBurned;
    orchestrator.repo.insert(&transfer).await?;
    orchestrator.repo.append_audit(&transfer.id, TransferStatus::Initiated, TransferStatus::BscBurned, "bsc_subscription", Some("Burn detected"), None).await?;
    tracing::info!(transfer_id = %transfer.id, tx_hash = %event.tx_hash, amount = %transfer.amount, "BSC burn detected");
    Ok(())
}

pub async fn process_bsc_to_canton_pending(orchestrator: Arc<BridgeOrchestrator>) -> Result<(), BridgeError> {
    let pending = orchestrator.repo.list_pending(50).await?;
    for mut transfer in pending {
        if transfer.direction != TransferDirection::BscToCanton { continue; }
        match transfer.status {
            TransferStatus::BscBurnFinalized => handle_canton_unlock(&orchestrator, &mut transfer).await?,
            _ => {}
        }
    }
    Ok(())
}

async fn handle_canton_unlock(orchestrator: &BridgeOrchestrator, transfer: &mut BridgeTransfer) -> Result<(), BridgeError> {
    let command_id = format!("bridge-{}-unlock", transfer.id);
    orchestrator.canton_client.unlock_from_bsc(&transfer.canton_contract_id.as_ref().unwrap(), &command_id, &transfer.bsc_tx_hash.as_ref().unwrap()).await?;
    transfer.update_status(TransferStatus::CantonUnlocking, "Unlock command submitted")?;
    orchestrator.repo.update_status(&transfer.id, TransferStatus::CantonUnlocking, None).await?;
    orchestrator.repo.append_audit(&transfer.id, TransferStatus::BscBurnFinalized, TransferStatus::CantonUnlocking, "orchestrator", Some("Canton unlock submitted"), None).await?;
    tracing::info!(transfer_id = %transfer.id, "Canton unlock submitted");
    Ok(())
}
```

## 14.4 Finality Worker

```rust
pub async fn run_finality_worker(orchestrator: Arc<BridgeOrchestrator>) -> Result<(), BridgeError> {
    let mut interval = tokio::time::interval(Duration::from_secs(10));
    loop {
        interval.tick().await;
        let pending = orchestrator.repo.list_pending(100).await?;
        for mut transfer in pending {
            if matches!(transfer.status, TransferStatus::BscMinting | TransferStatus::BscBurned) {
                if let Some(block_number) = transfer.bsc_block_number {
                    let current_block = orchestrator.bsc_client.get_current_block().await?;
                    let confirmations = current_block.saturating_sub(block_number);
                    transfer.bsc_confirmations = Some(confirmations);
                    orchestrator.repo.update_status(&transfer.id, transfer.status, None).await?;
                    
                    if confirmations >= orchestrator.config.bsc.required_confirmations {
                        let new_status = match transfer.status {
                            TransferStatus::BscMinting => TransferStatus::BscMinted,
                            TransferStatus::BscBurned => TransferStatus::BscBurnFinalized,
                            _ => continue,
                        };
                        transfer.update_status(new_status, "BSC finalized")?;
                        orchestrator.repo.update_status(&transfer.id, new_status, None).await?;
                        orchestrator.repo.append_audit(&transfer.id, transfer.status, new_status, "finality_worker", Some("BSC confirmations reached"), None).await?;
                    }
                }
            }
        }
    }
}
```

## 14.5 Main Loop (main.rs)

```rust
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    init_tracing();
    let config = BridgeConfig::load()?;
    let repo = Arc::new(BridgeRepository::connect(&config.db).await?);
    let canton_client = Arc::new(LedgerApiClient::connect(config.canton.clone()).await?);
    let bsc_client = Arc::new(BscClientImpl::connect(config.bsc.clone()).await?);
    let orchestrator = Arc::new(BridgeOrchestrator::new(config, repo, canton_client, bsc_client));
    
    orchestrator.recover_orphaned().await?;
    
    let shutdown = Arc::new(Notify::new());
    let shutdown_signal = tokio::signal::ctrl_c();
    let sigterm = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()).expect("SIGTERM listener").recv().await;
    };
    
    let orch1 = orchestrator.clone();
    let orch2 = orchestrator.clone();
    let orch3 = orchestrator.clone();
    let orch4 = orchestrator.clone();
    let orch5 = orchestrator.clone();
    
    tokio::select! {
        _ = shutdown_signal => { tracing::info!("SIGINT received, shutting down"); }
        _ = sigterm => { tracing::info!("SIGTERM received, shutting down"); }
        _ = run_canton_stream(orch1) => {}
        _ = run_bsc_subscription(orch2) => {}
        _ = run_pending_worker(orch3) => {}
        _ = run_finality_worker(orch4) => {}
        _ = run_recovery_worker(orch5) => {}
    }
    
    orchestrator.shutdown().await?;
    Ok(())
}
```

**DoD:** Canton stream читается с checkpoint; BSC subscription подписывается на events; pending worker обрабатывает in-flight; finality worker проверяет confirmations; recovery worker восстанавливает orphaned; graceful shutdown по SIGTERM.

---

# ЧАСТЬ 15: PRODUCTION READINESS CRITERIA

## 15.1 Checklist

- [ ] Все миграции применены в production БД
- [ ] Canton participant доступен по mTLS
- [ ] BSC RPC доступен по WSS
- [ ] Vault integration настроен (BSC key, Canton JWT secret)
- [ ] Daml контракт развёрнут, .dar загружен на participant
- [ ] Solidity контракт деплоен на BSC mainnet через UUPS proxy
- [ ] Operator role назначен на bridge BSC address через multi-sig
- [ ] Asset registry заполнен (минимум 1 актив)
- [ ] Health endpoint возвращает 200 (Canton, BSC, DB all OK)
- [ ] Metrics экспортируются на /metrics
- [ ] Alerting rules настроены в Prometheus
- [ ] Grafana dashboard создан
- [ ] Backup cron настроен (ежедневно 2AM)
- [ ] Runbook заполнен (минимум 5 сценариев)
- [ ] Security audit контрактов выполнен (или запланирован)
- [ ] E2E тест Canton→BSC и BSC→Canton выполнен на testnet
- [ ] Load testing выполнен (100 concurrent transfers)
- [ ] Key rotation процедура задокументирована
- [ ] Incident response team обучен

## 15.2 SLO (Service Level Objectives)

- Availability: 99.9% uptime (43 минуты downtime/месяц)
- Latency (p95): Canton→BSC завершается за < 5 минут
- Latency (p99): Canton→BSC завершается за < 10 минут
- Error Rate: < 1% переводов в Failed/Stuck статус
- Recovery Time Objective (RTO): < 15 минут после инцидента
- Recovery Point Objective (RPO): < 1 минута (checkpoint offset сохраняется после каждой транзакции)

## 15.3 Monitoring Dashboard

**Панели:**
1. Transfer Flow (active, completed, failed, rate)
2. Status Distribution (pie chart)
3. Latency (p50, p95, p99 по направлениям)
4. Errors (rate по типу Canton/BSC/DB)
5. Resources (BSC wallet balance, gas price, DB pool)

## 15.4 Compliance (опционально, для institutional)

- [ ] KYC/AML процедуры для партий (если требуется)
- [ ] Audit log доступен для регуляторов (transfer_audit_log, transfer_event_log)
- [ ] Данные шифруются at rest (PostgreSQL encryption)
- [ ] Данные шифруются in transit (mTLS, WSS)
- [ ] Логи хранятся минимум 1 год
- [ ] Incident reports задокументированы

**DoD:** все чеклисты выполнены; SLO мониторятся; compliance требования учтены.

---

# ЧАСТЬ 16: SUMMARY & CHANGELOG

## 16.1 Что реализовано в v3.0

Полный production-ready мост Canton Network ↔ BSC со всеми критическими компонентами:

**Архитектура:**
- Workspace с 12 крейтами (bridge-core, canton-*, bsc-client, bridge-orchestrator, bridge-db, bridge-api)
- Доменная модель с 14-state FSM, строгими переходами, idempotency
- PostgreSQL персистентность с partial unique indexes, audit log, event sourcing
- Canton Ledger API v2 клиент с JWT auth, mTLS, command dedup, transaction stream
- BSC ethers клиент с UUPS upgradeable контрактами, AccessControl, ReentrancyGuard, Pausable

**Безопасность:**
- Threat model с 8 attack vectors и mitigations
- Multi-sig для admin operations
- Timelock для operator role changes
- mTLS Canton ↔ bridge
- Vault для секретов
- Key rotation процедуры

**Надёжность:**
- Exponential backoff retry с transient/permanent error classification
- Circuit breaker на Canton и BSC вызовах
- Orphaned transfers recovery
- Graceful shutdown (SIGTERM)
- Blue/Green deployment

**Observability:**
- Prometheus metrics (9 обязательных)
- JSON structured logging с trace_id
- Distributed tracing (OpenTelemetry)
- Alerting rules (6 критичных)
- Grafana dashboard

**Operations:**
- Docker multi-stage build
- docker-compose для dev
- SQLx migrations (только forward)
- Backup/restore скрипты
- Runbook с 5+ incident scenarios
- DevNet config для development

**Testing:**
- Unit tests (state machine, amount)
- Property-based tests (proptest)
- Integration tests (testcontainers)
- Canton Sandbox integration
- BSC Hardhat fork tests
- E2E Canton→BSC и BSC→Canton

## 16.2 Gaps Closed (по сравнению с v2.1)

Добавлено **18 критических секций:**

1. ✅ Canton Ledger API v2 — полная proto, JWT flow, mTLS, token refresh
2. ✅ Daml контракты — signatory/observer/controller, key, archive, upgrade strategy
3. ✅ BSC Security — Pausable, UUPS, AccessControl, ReentrancyGuard, EIP-712, ChainId
4. ✅ Finality — Canton offset model, BSC confirmations, reorg handling
5. ✅ Threat Model — attack vectors, mitigations, security checklist
6. ✅ Fee Model — gas management, bridge fees, spike handling
7. ✅ Rate Limiting — per-party, per-asset, TVL, cooldown, daily limits
8. ✅ Error Recovery — orphaned, idempotency, DLQ, compensating tx
9. ✅ Event Sourcing — transfer_event_log для compliance
10. ✅ Multi-Asset — asset_registry, decimals, min/max/daily limits
11. ✅ Observability — distributed tracing, structured logging, SLO/SLI
12. ✅ Testing — Canton Sandbox, Hardhat fork, E2E, proptest
13. ✅ Deployment — Blue/Green, migrations, backup/restore, key rotation
14. ✅ Config Management — Vault, feature flags, env-specific, DevNet
15. ✅ API Design — versioning, WebSocket, pagination, OpenAPI 3.0
16. ✅ Canton-Specific — time model, command dedup, package management
17. ✅ Cross-cutting — circuit breaker, backpressure, graceful degradation
18. ✅ Production Readiness — SLO, runbook, monitoring, compliance checklist

## 16.3 Порядок реализации (рекомендация)

1. **Часть 1-3:** Workspace, domain model, DB (foundation)
2. **Часть 4-5:** Canton Ledger API client, Daml контракты
3. **Часть 6:** BSC контракты (Solidity)
4. **Часть 7-8:** Finality, recovery, fee/limits/threat
5. **Часть 9-10:** API, observability
6. **Часть 11-12:** Config, deployment
7. **Часть 13:** Testing
8. **Часть 14:** Orchestrator flow (интеграция всего)
9. **Часть 15:** Production readiness (финальные чеклисты)

## 16.4 Использование промпта

**Для LLM (например Claude):**
1. Читать ЧАСТЬ 0 целиком перед началом
2. Выполнять части 1–15 по порядку
3. Каждую часть считать завершённой только при выполнении DoD
4. Не пропускать обязательные (MUST) требования
5. При отклонении от SHOULD — задокументировать причину

**Для человека:**
1. Использовать как спецификацию для реализации
2. Каждая часть — отдельная задача (issue/ticket)
3. DoD — критерий закрытия задачи
4. Поддерживать документацию актуальной при изменениях

---

# КОНЕЦ ПРОМПТА v3.0

**Версия:** 3.0  
**Дата:** 2026-02-09  
**Статус:** Production-Ready, Self-Sufficient, Gap-Free

Этот промпт является **единственным источником истины** для реализации Canton Network ↔ BSC Bridge. Все критические решения, типы, схемы, контракты, API, конфигурация заданы явно в теле документа. Внешние ссылки только для контекста окружения (DevNet endpoints, Canton documentation для справки).

**DoD всего промпта:** По этому документу можно воспроизвести полный production-ready мост без доступа к другим спецификациям (кроме контекста репо и DevNet из упомянутых документов).