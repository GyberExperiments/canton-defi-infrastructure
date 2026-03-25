ейты
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── types.rs                # BridgeTransfer, BridgeStatus, etc.
│   │       ├── errors.rs               # BridgeError enum
│   │       ├── config.rs               # BridgeConfig struct
│   │       ├── traits.rs               # CantonClient, BscClient traits
│   │       └── state_machine.rs        # TransferStateMachine
│   ├── canton-client/                  # Canton Ledger API client
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── grpc_client.rs          # gRPC Ledger API (tonic generated)
│   │       ├── json_client.rs          # JSON API HTTP client (fallback)
│   │       ├── commands.rs             # Daml command builders
│   │       ├── transactions.rs         # Transaction stream processor
│   │       ├── auth.rs                 # JWT token management
│   │       └── proto/                  # .proto файлы Canton Ledger API
│   │           └── com.daml.ledger.api.v2/  # v2 proto definitions
│   ├── bsc-client/                     # BSC Web3 client
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── provider.rs            # ethers Provider setup (HTTP + WS)
│   │       ├── contracts.rs           # Generated contract bindings
│   │       ├── bridge_contract.rs     # Bridge.sol interactions
│   │       ├── token_contract.rs      # BEP20 token interactions
│   │       ├── event_listener.rs      # Event subscription & processing
│   │       ├── gas_oracle.rs          # Gas price estimation
│   │       ├── tx_manager.rs          # Transaction lifecycle (send, confirm, retry)
│   │       └── nonce_manager.rs       # Thread-safe nonce tracking
│   ├── bridge-orchestrator/           # главный сервис, координация
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── main.rs                # entry point, graceful shutdown
│   │       ├── orchestrator.rs        # BridgeOrchestrator struct
│   │       ├── canton_to_bsc.rs       # Canton→BSC flow handler
│   │       ├── bsc_to_canton.rs       # BSC→Canton flow handler
│   │       ├── recovery.rs            # Recovery from failures/restarts
│   │       ├── health.rs              # Health check HTTP endpoint
│   │       └── metrics.rs            # Prometheus metrics
│   ├── bridge-db/                     # PostgreSQL persistence
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── models.rs             # DB models
│   │       ├── repository.rs         # CRUD operations
│   │       └── migrations/           # SQL migrations
│   │           ├── 001_create_tables.sql
│   │           └── 002_create_indexes.sql
│   └── bridge-api/                    # REST API для мониторинга и управления
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs
│           ├── routes.rs             # axum routes
│           ├── handlers.rs           # request handlers
│           └── middleware.rs         # auth, logging middleware
├── contracts/
│   ├── daml/                          # Daml smart contracts
│   │   ├── daml.yaml
│   │   └── daml/
│   │       ├── Bridge/
│   │       │   ├── Asset.daml         # Asset template
│   │       │   ├── Lock.daml          # Lock/Unlock templates
│   │       │   ├── Transfer.daml      # CrossChainTransfer template
│   │       │   └── Types.daml         # Shared types
│   │       └── Test/
│   │           └── BridgeTest.daml    # Daml script tests
│   └── solidity/                      # Solidity smart contracts
│       ├── hardhat.config.ts
│       ├── package.json
│       ├── contracts/
│       │   ├── BridgeVault.sol        # Main bridge contract
│       │   ├── BridgedToken.sol       # Wrapped Canton asset (BEP-20)
│       │   ├── BridgeRegistry.sol     # Asset registry & mapping
│       │   ├── MultiSigValidator.sol  # Multi-sig validation
│       │   └── interfaces/
│       │       ├── IBridgeVault.sol
│       │       └── IBridgedToken.sol
│       ├── test/
│       │   ├── BridgeVault.test.ts
│       │   ├── BridgedToken.test.ts
│       │   └── integration.test.ts
│       └── scripts/
│           ├── deploy.ts
│           └── verify.ts
├── docker/
│   ├── Dockerfile.bridge              # Multi-stage Rust build
│   ├── Dockerfile.canton              # Canton participant setup
│   ├── docker-compose.yml             # Full dev environment
│   └── docker-compose.infra.yml       # Infrastructure only
├── scripts/
│   ├── setup.sh                       # Development setup script
│   ├── generate-proto.sh              # gRPC proto generation
│   └── run-tests.sh                   # Full test suite
├── monitoring/
│   ├── prometheus.yml
│   ├── grafana/
│   │   └── dashboards/
│   │       └── bridge-dashboard.json
│   └── alerting/
│       └── rules.yml
└── docs/
├── architecture.md
├── deployment.md
├── security.md
└── runbook.md


Makefile

## ДЕТАЛЬНЫЕ СПЕЦИФИКАЦИИ ДЛЯ КАЖДОГО ФАЙЛА

### 1. WORKSPACE ROOT — Cargo.toml

```toml
[workspace]
resolver = "2"
members = [
    "crates/bridge-core",
    "crates/canton-client", 
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

[workspace.dependencies]
# Async runtime
tokio = { version = "1.37", features = ["full"] }
tokio-stream = "0.1"

# Serialization
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

# Error handling
thiserror = "1.0"
anyhow = "1.0"

# Logging & Tracing
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter", "json"] }
tracing-opentelemetry = "0.23"

# gRPC (Canton)
tonic = "0.11"
prost = "0.12"
prost-types = "0.12"

# HTTP
reqwest = { version = "0.12", features = ["json", "rustls-tls"] }
axum = "0.7"
tower = "0.4"
tower-http = { version = "0.5", features = ["cors", "trace", "auth"] }

# Ethereum / BSC
ethers = { version = "2.0", features = ["ws", "rustls", "abigen"] }

# Database
sqlx = { version = "0.7", features = ["runtime-tokio-rustls", "postgres", "uuid", "chrono", "migrate"] }

# Redis
deadpool-redis = "0.15"
redis = { version = "0.25", features = ["tokio-comp"] }

# Config
config = "0.14"

# Crypto
sha2 = "0.10"
hex = "0.4"

# Time
chrono = { version = "0.4", features = ["serde"] }

# UUID
uuid = { version = "1.8", features = ["v4", "serde"] }

# Metrics
prometheus-client = "0.22"

# Testing
mockall = "0.12"
2. bridge-core/src/types.rs

Rust
//! Core domain types for the Canton-BSC bridge.
//!
//! These types represent the fundamental domain objects that flow through
//! the bridge system. They are chain-agnostic and represent the bridge's
//! internal state model.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Unique identifier for a bridge transfer operation.
/// Generated by the bridge when a transfer is initiated on either chain.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct TransferId(pub Uuid);

impl TransferId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }
    
    pub fn from_string(s: &str) -> Result<Self, uuid::Error> {
        Ok(Self(Uuid::parse_str(s)?))
    }
}

impl std::fmt::Display for TransferId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Direction of the cross-chain transfer
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "transfer_direction", rename_all = "snake_case")]
pub enum TransferDirection {
    /// Asset locked on Canton, minted on BSC
    CantonToBsc,
    /// Asset burned on BSC, unlocked on Canton  
    BscToCanton,
}

/// Current status of a bridge transfer.
/// Represents a finite state machine with well-defined transitions.
///
/// State transitions for Canton→BSC:
///   Initiated → CantonLocked → BscMinting → BscMinted → Completed
///                    ↘                                      ↗
///                     → Failed (from any intermediate state)
///
/// State transitions for BSC→Canton:
///   Initiated → BscBurned → CantonUnlocking → CantonUnlocked → Completed
///                    ↘                                            ↗
///                     → Failed (from any intermediate state)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "transfer_status", rename_all = "snake_case")]
pub enum TransferStatus {
    /// Transfer request detected on source chain
    Initiated,
    
    // Canton → BSC states
    /// Asset locked in Canton Daml contract
    CantonLocked,
    /// BSC mint transaction submitted
    BscMinting,
    /// BSC mint confirmed with sufficient block confirmations
    BscMinted,
    
    // BSC → Canton states  
    /// Asset burned on BSC
    BscBurned,
    /// BSC burn has achieved finality (sufficient confirmations)
    BscBurnFinalized,
    /// Canton unlock command submitted
    CantonUnlocking,
    /// Canton unlock confirmed
    CantonUnlocked,
    
    /// Transfer completed successfully on both chains
    Completed,
    /// Transfer failed — requires manual intervention
    Failed,
    /// Transfer is being rolled back
    RollingBack,
    /// Rollback completed
    RolledBack,
}

impl TransferStatus {
    /// Returns true if this status represents a terminal state
    pub fn is_terminal(&self) -> bool {
        matches!(self, Self::Completed | Self::Failed | Self::RolledBack)
    }
    
    /// Returns true if this status allows retry
    pub fn is_retryable(&self) -> bool {
        matches!(self, Self::BscMinting | Self::CantonUnlocking)
    }
    
    /// Validates whether a transition from self to `next` is valid
    pub fn can_transition_to(&self, next: &TransferStatus) -> bool {
        use TransferStatus::*;
        matches!(
            (self, next),
            // Canton → BSC flow
            (Initiated, CantonLocked)
            | (CantonLocked, BscMinting)
            | (BscMinting, BscMinted)
            | (BscMinted, Completed)
            // BSC → Canton flow
            | (Initiated, BscBurned)
            | (BscBurned, BscBurnFinalized)
            | (BscBurnFinalized, CantonUnlocking)
            | (CantonUnlocking, CantonUnlocked)
            | (CantonUnlocked, Completed)
            // Error transitions (any non-terminal → Failed)
            | (Initiated, Failed)
            | (CantonLocked, Failed)
            | (BscMinting, Failed)
            | (BscBurned, Failed)
            | (BscBurnFinalized, Failed)
            | (CantonUnlocking, Failed)
            // Rollback transitions
            | (Failed, RollingBack)
            | (RollingBack, RolledBack)
        )
    }
}

/// Represents a Canton party identifier
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct CantonParty(pub String);

/// Represents a Canton contract identifier
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct CantonContractId(pub String);

/// Represents a BSC (Ethereum-compatible) address
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct BscAddress(pub String);

impl BscAddress {
    /// Validates that the address is a valid hex-encoded 20-byte address
    pub fn validate(&self) -> bool {
        let s = self.0.strip_prefix("0x").unwrap_or(&self.0);
        s.len() == 40 && s.chars().all(|c| c.is_ascii_hexdigit())
    }
}

/// Represents a BSC transaction hash
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct BscTxHash(pub String);

/// Amount representation with decimal precision.
/// Uses string internally to avoid floating-point precision issues.
/// Canton and BSC both need precise decimal handling.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Amount {
    /// Raw amount as string to preserve precision
    pub value: String,
    /// Number of decimal places
    pub decimals: u8,
}

impl Amount {
    pub fn new(value: impl Into<String>, decimals: u8) -> Self {
        Self {
            value: value.into(),
            decimals,
        }
    }
    
    /// Convert to the smallest unit (e.g., wei for 18 decimals)
    pub fn to_base_units(&self) -> Result<u128, std::num::ParseIntError> {
        // Handle decimal point in value
        let parts: Vec<&str> = self.value.split('.').collect();
        match parts.len() {
            1 => {
                let base: u128 = 10u128.pow(self.decimals as u32);
                let whole: u128 = parts[0].parse()?;
                Ok(whole * base)
            }
            2 => {
                let base: u128 = 10u128.pow(self.decimals as u32);
                let whole: u128 = parts[0].parse()?;
                let frac_str = parts[1];
                let frac_decimals = frac_str.len() as u32;
                let frac: u128 = frac_str.parse()?;
                let frac_base = 10u128.pow(self.decimals as u32 - frac_decimals);
                Ok(whole * base + frac * frac_base)
            }
            _ => Ok(0),
        }
    }
}

/// Identifies an asset across both chains
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssetId {
    /// Canton template qualified name (e.g., "Bridge.Asset:Token")
    pub canton_template_id: String,
    /// BSC BEP-20 token contract address
    pub bsc_token_address: BscAddress,
    /// Human-readable symbol
    pub symbol: String,
    /// Decimal precision
    pub decimals: u8,
}

/// The core transfer record that tracks a cross-chain transfer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgeTransfer {
    /// Unique bridge transfer ID
    pub id: TransferId,
    /// Direction of transfer
    pub direction: TransferDirection,
    /// Current status
    pub status: TransferStatus,
    /// Asset being transferred
    pub asset_id: String,
    /// Transfer amount
    pub amount: Amount,
    
    // Canton side
    /// Canton party initiating or receiving
    pub canton_party: CantonParty,
    /// Canton contract ID (lock/unlock contract)
    pub canton_contract_id: Option<CantonContractId>,
    /// Canton transaction ID (from Ledger API)
    pub canton_tx_id: Option<String>,
    
    // BSC side
    /// BSC address sending or receiving
    pub bsc_address: BscAddress,
    /// BSC transaction hash (mint/burn)
    pub bsc_tx_hash: Option<BscTxHash>,
    /// BSC block number where the relevant tx was included
    pub bsc_block_number: Option<u64>,
    /// Number of BSC confirmations received
    pub bsc_confirmations: Option<u64>,
    
    // Metadata
    /// Number of retry attempts for current step
    pub retry_count: u32,
    /// Maximum retries before marking as failed
    pub max_retries: u32,
    /// Human-readable error message if failed
    pub error_message: Option<String>,
    /// Nonce used for idempotency/dedup
    pub nonce: String,
    
    // Timestamps
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

impl BridgeTransfer {
    /// Create a new Canton→BSC transfer
    pub fn new_canton_to_bsc(
        canton_party: CantonParty,
        bsc_address: BscAddress,
        asset_id: String,
        amount: Amount,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: TransferId::new(),
            direction: TransferDirection::CantonToBsc,
            status: TransferStatus::Initiated,
            asset_id,
            amount,
            canton_party,
            canton_contract_id: None,
            canton_tx_id: None,
            bsc_address,
            bsc_tx_hash: None,
            bsc_block_number: None,
            bsc_confirmations: None,
            retry_count: 0,
            max_retries: 5,
            error_message: None,
            nonce: Uuid::new_v4().to_string(),
            created_at: now,
            updated_at: now,
            completed_at: None,
        }
    }
    
    /// Create a new BSC→Canton transfer  
    pub fn new_bsc_to_canton(
        bsc_address: BscAddress,
        canton_party: CantonParty,
        asset_id: String,
        amount: Amount,
        bsc_tx_hash: BscTxHash,
        bsc_block_number: u64,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: TransferId::new(),
            direction: TransferDirection::BscToCanton,
            status: TransferStatus::Initiated,
            asset_id,
            amount,
            canton_party,
            canton_contract_id: None,
            canton_tx_id: None,
            bsc_address,
            bsc_tx_hash: Some(bsc_tx_hash),
            bsc_block_number: Some(bsc_block_number),
            bsc_confirmations: Some(0),
            retry_count: 0,
            max_retries: 5,
            error_message: None,
            nonce: Uuid::new_v4().to_string(),
            created_at: now,
            updated_at: now,
09.02.2026 02:36
ничего и мы не упустили при проектированиии и выводе промта ?
09.02.2026 02:40
Аудит полноты проектирования — Canton Network ↔ BSC Bridge
Отличный вопрос. Давайте проведём систематический аудит по всем измерениям. Я буду честен — мы упустили существенное количество критических аспектов.

🔴 КРИТИЧЕСКИЕ ПРОПУСКИ
1. Canton Ledger API — Proto-спецификация неполная
Мы объявили proto/ директорию, но не специфицировали:

Какую именно версию Ledger API используем (v1 deprecated, v2 current)
Canton Participant API vs Ledger API — это разные вещи
Canton Admin API — нужен для health checks participant node
Canton Sequencer/Mediator API — если мы деплоим свой sync domain
Daml Package Upload API — как загружать .dar файлы на participant
Identity Management — Canton topology transactions для party allocation
2. Canton Authentication — JWT Token Flow
Промт упоминает JWT, но не описывает:

Canton Auth middleware — как именно Canton аутентифицирует запросы
JWKS endpoint — Canton participant может требовать RS256 JWT
User/Party mapping — как bridge service аутентифицируется как party
Token refresh logic — JWT expiry и renewal
mTLS — Canton production рекомендует mutual TLS между participant и клиентами
3. Daml Contract Model — Глубина недостаточна
Наши Daml-контракты слишком поверхностные:

Нет Authorization Model — кто signatory, кто observer, кто controller на каждом choice
Нет Daml Interfaces (Daml 2.x feature) для полиморфизма
Нет Contract Key definitions для lookup
Нет Divulgence/Disclosure модели — кто что видит
Нет Upgrade Strategy — как обновлять Daml контракты в production
Нет Multi-domain consideration — что если asset на одном domain, bridge на другом
4. BSC Contract Security — Incomplete
Нет Pausable — нужен emergency stop
Нет Upgradeable Proxy (UUPS или Transparent) — как обновлять contracts
Нет Rate Limiting на уровне контракта (max transfer per epoch)
Нет Timelock для admin operations
Нет Access Control (OpenZeppelin AccessControl vs Ownable)
Нет Reentrancy Guard специфицирован
Нет EIP-712 typed signatures для meta-transactions
Нет проверки chain ID (replay protection cross-chain)
5. Consensus & Finality — Недоисследовано
Canton finality model — Canton transactions final после confirmation от domain, но нужно учитывать conflict detection и timeouts
BSC finality — с BEP-126 fast finality (~1 block), но нужен fallback на probabilistic finality
Что происходит при BSC reorg? — bridge должен обрабатывать re-orgs до 12 блоков
Canton domain disconnect — participant может быть offline, reconnect с разными offset-ами
6. Нет Formal Threat Model
Мы не описали:

Attack vectors: bridge operator goes rogue, Canton participant compromised, BSC key leaked
Sybil attacks на bridge
Front-running на BSC стороне
MEV extraction — кто-то может sandwich-атаковать bridge transactions
Censorship resistance — что если BSC validators цензурируют bridge txs
Griefing attacks — кто-то лочит на Canton но не завершает на BSC
7. Нет Fee Model
Кто платит BSC gas?
Есть ли bridge fee?
Как bridge пополняет gas wallet?
Fee estimation и dynamic fee adjustment
Что делать при gas price spike?
8. Нет Rate Limiting & Capacity Planning
Max concurrent transfers
Max daily volume
Per-party limits
Global TVL limits
Cooldown periods
🟡 СУЩЕСТВЕННЫЕ ПРОПУСКИ
9. Error Recovery — Неполная
Orphaned transfers — начаты но не завершены (crash recovery)
Idempotency tokens — как именно работает dedup
Dead letter queue — куда уходят irrecoverable failures
Manual intervention API — operator endpoint для ручного resolve
Compensating transactions — если mint прошёл на BSC но Canton lock не confirm
10. Event Sourcing / Audit Trail
Нет event log для каждого state transition
Нет audit table с immutable записями
Нет compliance reporting — KYC/AML considerations
Canton Network — institutional grade, значит regulatory compliance обязателен
11. Multi-Asset Support
Промт упоминает assets абстрактно, но нет:
Asset Registry — mapping Canton template → BSC token
Dynamic asset onboarding workflow
Different decimal handling per asset
Asset-specific validation rules
12. Observability — Недостаточная
Нет distributed tracing correlation (Canton tx → bridge → BSC tx)
Нет structured logging стандарта
Нет alerting rules definition
Нет SLO/SLI definitions
Нет dashboards specification для Grafana
13. Testing Strategy — Неполная
Нет Canton Sandbox integration test setup
Нет BSC Hardhat fork тестирования
Нет end-to-end test scenario
Нет chaos engineering (что если Canton participant упал mid-transfer?)
Нет load testing плана
Нет property-based testing для state machine
14. Deployment & Operations
Нет Blue/Green deployment стратегии
Нет Database migration стратегии при обновлениях
Нет Backup/Restore процедуры
Нет Key rotation процедуры
Нет Incident response runbook
🟢 МЕЛКИЕ ПРОПУСКИ
15. Конфигурация
Нет secret injection механизма (Vault integration)
Нет feature flags для gradual rollout
Нет environment-specific Canton participant endpoints
16. API Design
Bridge API не имеет versioning (v1/v2)
Нет WebSocket endpoint для real-time transfer status
Нет pagination на list endpoints
Нет OpenAPI/Swagger spec
17. Canton-Specific
Canton Time Model — Daml ledger time vs record time, bridge должен корректно использовать
Canton Command Deduplication — Ledger API имеет встроенную dedup через command_id
Canton Package Management — версионирование .dar файлов
Canton Party Allocation — автоматическая или ручная
18. Cross-cutting
Graceful degradation — что bridge делает когда одна из chain недоступна
Circuit breaker параметры и стратегия
Backpressure — если BSC газ высок, замедляем приём от Canton
Queue overflow — bounded queues для в-процессе transfers









ейты
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── types.rs                # BridgeTransfer, BridgeStatus, etc.
│   │       ├── errors.rs               # BridgeError enum
│   │       ├── config.rs               # BridgeConfig struct
│   │       ├── traits.rs               # CantonClient, BscClient traits
│   │       └── state_machine.rs        # TransferStateMachine
│   ├── canton-client/                  # Canton Ledger API client
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── grpc_client.rs          # gRPC Ledger API (tonic generated)
│   │       ├── json_client.rs          # JSON API HTTP client (fallback)
│   │       ├── commands.rs             # Daml command builders
│   │       ├── transactions.rs         # Transaction stream processor
│   │       ├── auth.rs                 # JWT token management
│   │       └── proto/                  # .proto файлы Canton Ledger API
│   │           └── com.daml.ledger.api.v2/  # v2 proto definitions
│   ├── bsc-client/                     # BSC Web3 client
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── provider.rs            # ethers Provider setup (HTTP + WS)
│   │       ├── contracts.rs           # Generated contract bindings
│   │       ├── bridge_contract.rs     # Bridge.sol interactions
│   │       ├── token_contract.rs      # BEP20 token interactions
│   │       ├── event_listener.rs      # Event subscription & processing
│   │       ├── gas_oracle.rs          # Gas price estimation
│   │       ├── tx_manager.rs          # Transaction lifecycle (send, confirm, retry)
│   │       └── nonce_manager.rs       # Thread-safe nonce tracking
│   ├── bridge-orchestrator/           # главный сервис, координация
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── main.rs                # entry point, graceful shutdown
│   │       ├── orchestrator.rs        # BridgeOrchestrator struct
│   │       ├── canton_to_bsc.rs       # Canton→BSC flow handler
│   │       ├── bsc_to_canton.rs       # BSC→Canton flow handler
│   │       ├── recovery.rs            # Recovery from failures/restarts
│   │       ├── health.rs              # Health check HTTP endpoint
│   │       └── metrics.rs            # Prometheus metrics
│   ├── bridge-db/                     # PostgreSQL persistence
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── models.rs             # DB models
│   │       ├── repository.rs         # CRUD operations
│   │       └── migrations/           # SQL migrations
│   │           ├── 001_create_tables.sql
│   │           └── 002_create_indexes.sql
│   └── bridge-api/                    # REST API для мониторинга и управления
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs
│           ├── routes.rs             # axum routes
│           ├── handlers.rs           # request handlers
│           └── middleware.rs         # auth, logging middleware
├── contracts/
│   ├── daml/                          # Daml smart contracts
│   │   ├── daml.yaml
│   │   └── daml/
│   │       ├── Bridge/
│   │       │   ├── Asset.daml         # Asset template
│   │       │   ├── Lock.daml          # Lock/Unlock templates
│   │       │   ├── Transfer.daml      # CrossChainTransfer template
│   │       │   └── Types.daml         # Shared types
│   │       └── Test/
│   │           └── BridgeTest.daml    # Daml script tests
│   └── solidity/                      # Solidity smart contracts
│       ├── hardhat.config.ts
│       ├── package.json
│       ├── contracts/
│       │   ├── BridgeVault.sol        # Main bridge contract
│       │   ├── BridgedToken.sol       # Wrapped Canton asset (BEP-20)
│       │   ├── BridgeRegistry.sol     # Asset registry & mapping
│       │   ├── MultiSigValidator.sol  # Multi-sig validation
│       │   └── interfaces/
│       │       ├── IBridgeVault.sol
│       │       └── IBridgedToken.sol
│       ├── test/
│       │   ├── BridgeVault.test.ts
│       │   ├── BridgedToken.test.ts
│       │   └── integration.test.ts
│       └── scripts/
│           ├── deploy.ts
│           └── verify.ts
├── docker/
│   ├── Dockerfile.bridge              # Multi-stage Rust build
│   ├── Dockerfile.canton              # Canton participant setup
│   ├── docker-compose.yml             # Full dev environment
│   └── docker-compose.infra.yml       # Infrastructure only
├── scripts/
│   ├── setup.sh                       # Development setup script
│   ├── generate-proto.sh              # gRPC proto generation
│   └── run-tests.sh                   # Full test suite
├── monitoring/
│   ├── prometheus.yml
│   ├── grafana/
│   │   └── dashboards/
│   │       └── bridge-dashboard.json
│   └── alerting/
│       └── rules.yml
└── docs/
├── architecture.md
├── deployment.md
├── security.md
└── runbook.md


Makefile

## ДЕТАЛЬНЫЕ СПЕЦИФИКАЦИИ ДЛЯ КАЖДОГО ФАЙЛА

### 1. WORKSPACE ROOT — Cargo.toml

```toml
[workspace]
resolver = "2"
members = [
    "crates/bridge-core",
    "crates/canton-client", 
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

[workspace.dependencies]
# Async runtime
tokio = { version = "1.37", features = ["full"] }
tokio-stream = "0.1"

# Serialization
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

# Error handling
thiserror = "1.0"
anyhow = "1.0"

# Logging & Tracing
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter", "json"] }
tracing-opentelemetry = "0.23"

# gRPC (Canton)
tonic = "0.11"
prost = "0.12"
prost-types = "0.12"

# HTTP
reqwest = { version = "0.12", features = ["json", "rustls-tls"] }
axum = "0.7"
tower = "0.4"
tower-http = { version = "0.5", features = ["cors", "trace", "auth"] }

# Ethereum / BSC
ethers = { version = "2.0", features = ["ws", "rustls", "abigen"] }

# Database
sqlx = { version = "0.7", features = ["runtime-tokio-rustls", "postgres", "uuid", "chrono", "migrate"] }

# Redis
deadpool-redis = "0.15"
redis = { version = "0.25", features = ["tokio-comp"] }

# Config
config = "0.14"

# Crypto
sha2 = "0.10"
hex = "0.4"

# Time
chrono = { version = "0.4", features = ["serde"] }

# UUID
uuid = { version = "1.8", features = ["v4", "serde"] }

# Metrics
prometheus-client = "0.22"

# Testing
mockall = "0.12"
2. bridge-core/src/types.rs

Rust
//! Core domain types for the Canton-BSC bridge.
//!
//! These types represent the fundamental domain objects that flow through
//! the bridge system. They are chain-agnostic and represent the bridge's
//! internal state model.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Unique identifier for a bridge transfer operation.
/// Generated by the bridge when a transfer is initiated on either chain.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct TransferId(pub Uuid);

impl TransferId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }
    
    pub fn from_string(s: &str) -> Result<Self, uuid::Error> {
        Ok(Self(Uuid::parse_str(s)?))
    }
}

impl std::fmt::Display for TransferId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Direction of the cross-chain transfer
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "transfer_direction", rename_all = "snake_case")]
pub enum TransferDirection {
    /// Asset locked on Canton, minted on BSC
    CantonToBsc,
    /// Asset burned on BSC, unlocked on Canton  
    BscToCanton,
}

/// Current status of a bridge transfer.
/// Represents a finite state machine with well-defined transitions.
///
/// State transitions for Canton→BSC:
///   Initiated → CantonLocked → BscMinting → BscMinted → Completed
///                    ↘                                      ↗
///                     → Failed (from any intermediate state)
///
/// State transitions for BSC→Canton:
///   Initiated → BscBurned → CantonUnlocking → CantonUnlocked → Completed
///                    ↘                                            ↗
///                     → Failed (from any intermediate state)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "transfer_status", rename_all = "snake_case")]
pub enum TransferStatus {
    /// Transfer request detected on source chain
    Initiated,
    
    // Canton → BSC states
    /// Asset locked in Canton Daml contract
    CantonLocked,
    /// BSC mint transaction submitted
    BscMinting,
    /// BSC mint confirmed with sufficient block confirmations
    BscMinted,
    
    // BSC → Canton states  
    /// Asset burned on BSC
    BscBurned,
    /// BSC burn has achieved finality (sufficient confirmations)
    BscBurnFinalized,
    /// Canton unlock command submitted
    CantonUnlocking,
    /// Canton unlock confirmed
    CantonUnlocked,
    
    /// Transfer completed successfully on both chains
    Completed,
    /// Transfer failed — requires manual intervention
    Failed,
    /// Transfer is being rolled back
    RollingBack,
    /// Rollback completed
    RolledBack,
}

impl TransferStatus {
    /// Returns true if this status represents a terminal state
    pub fn is_terminal(&self) -> bool {
        matches!(self, Self::Completed | Self::Failed | Self::RolledBack)
    }
    
    /// Returns true if this status allows retry
    pub fn is_retryable(&self) -> bool {
        matches!(self, Self::BscMinting | Self::CantonUnlocking)
    }
    
    /// Validates whether a transition from self to `next` is valid
    pub fn can_transition_to(&self, next: &TransferStatus) -> bool {
        use TransferStatus::*;
        matches!(
            (self, next),
            // Canton → BSC flow
            (Initiated, CantonLocked)
            | (CantonLocked, BscMinting)
            | (BscMinting, BscMinted)
            | (BscMinted, Completed)
            // BSC → Canton flow
            | (Initiated, BscBurned)
            | (BscBurned, BscBurnFinalized)
            | (BscBurnFinalized, CantonUnlocking)
            | (CantonUnlocking, CantonUnlocked)
            | (CantonUnlocked, Completed)
            // Error transitions (any non-terminal → Failed)
            | (Initiated, Failed)
            | (CantonLocked, Failed)
            | (BscMinting, Failed)
            | (BscBurned, Failed)
            | (BscBurnFinalized, Failed)
            | (CantonUnlocking, Failed)
            // Rollback transitions
            | (Failed, RollingBack)
            | (RollingBack, RolledBack)
        )
    }
}

/// Represents a Canton party identifier
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct CantonParty(pub String);

/// Represents a Canton contract identifier
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct CantonContractId(pub String);

/// Represents a BSC (Ethereum-compatible) address
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct BscAddress(pub String);

impl BscAddress {
    /// Validates that the address is a valid hex-encoded 20-byte address
    pub fn validate(&self) -> bool {
        let s = self.0.strip_prefix("0x").unwrap_or(&self.0);
        s.len() == 40 && s.chars().all(|c| c.is_ascii_hexdigit())
    }
}

/// Represents a BSC transaction hash
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct BscTxHash(pub String);

/// Amount representation with decimal precision.
/// Uses string internally to avoid floating-point precision issues.
/// Canton and BSC both need precise decimal handling.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Amount {
    /// Raw amount as string to preserve precision
    pub value: String,
    /// Number of decimal places
    pub decimals: u8,
}

impl Amount {
    pub fn new(value: impl Into<String>, decimals: u8) -> Self {
        Self {
            value: value.into(),
            decimals,
        }
    }
    
    /// Convert to the smallest unit (e.g., wei for 18 decimals)
    pub fn to_base_units(&self) -> Result<u128, std::num::ParseIntError> {
        // Handle decimal point in value
        let parts: Vec<&str> = self.value.split('.').collect();
        match parts.len() {
            1 => {
                let base: u128 = 10u128.pow(self.decimals as u32);
                let whole: u128 = parts[0].parse()?;
                Ok(whole * base)
            }
            2 => {
                let base: u128 = 10u128.pow(self.decimals as u32);
                let whole: u128 = parts[0].parse()?;
                let frac_str = parts[1];
                let frac_decimals = frac_str.len() as u32;
                let frac: u128 = frac_str.parse()?;
                let frac_base = 10u128.pow(self.decimals as u32 - frac_decimals);
                Ok(whole * base + frac * frac_base)
            }
            _ => Ok(0),
        }
    }
}

/// Identifies an asset across both chains
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssetId {
    /// Canton template qualified name (e.g., "Bridge.Asset:Token")
    pub canton_template_id: String,
    /// BSC BEP-20 token contract address
    pub bsc_token_address: BscAddress,
    /// Human-readable symbol
    pub symbol: String,
    /// Decimal precision
    pub decimals: u8,
}

/// The core transfer record that tracks a cross-chain transfer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgeTransfer {
    /// Unique bridge transfer ID
    pub id: TransferId,
    /// Direction of transfer
    pub direction: TransferDirection,
    /// Current status
    pub status: TransferStatus,
    /// Asset being transferred
    pub asset_id: String,
    /// Transfer amount
    pub amount: Amount,
    
    // Canton side
    /// Canton party initiating or receiving
    pub canton_party: CantonParty,
    /// Canton contract ID (lock/unlock contract)
    pub canton_contract_id: Option<CantonContractId>,
    /// Canton transaction ID (from Ledger API)
    pub canton_tx_id: Option<String>,
    
    // BSC side
    /// BSC address sending or receiving
    pub bsc_address: BscAddress,
    /// BSC transaction hash (mint/burn)
    pub bsc_tx_hash: Option<BscTxHash>,
    /// BSC block number where the relevant tx was included
    pub bsc_block_number: Option<u64>,
    /// Number of BSC confirmations received
    pub bsc_confirmations: Option<u64>,
    
    // Metadata
    /// Number of retry attempts for current step
    pub retry_count: u32,
    /// Maximum retries before marking as failed
    pub max_retries: u32,
    /// Human-readable error message if failed
    pub error_message: Option<String>,
    /// Nonce used for idempotency/dedup
    pub nonce: String,
    
    // Timestamps
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

impl BridgeTransfer {
    /// Create a new Canton→BSC transfer
    pub fn new_canton_to_bsc(
        canton_party: CantonParty,
        bsc_address: BscAddress,
        asset_id: String,
        amount: Amount,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: TransferId::new(),
            direction: TransferDirection::CantonToBsc,
            status: TransferStatus::Initiated,
            asset_id,
            amount,
            canton_party,
            canton_contract_id: None,
            canton_tx_id: None,
            bsc_address,
            bsc_tx_hash: None,
            bsc_block_number: None,
            bsc_confirmations: None,
            retry_count: 0,
            max_retries: 5,
            error_message: None,
            nonce: Uuid::new_v4().to_string(),
            created_at: now,
            updated_at: now,
            completed_at: None,
        }
    }
    
    /// Create a new BSC→Canton transfer  
    pub fn new_bsc_to_canton(
        bsc_address: BscAddress,
        canton_party: CantonParty,
        asset_id: String,
        amount: Amount,
        bsc_tx_hash: BscTxHash,
        bsc_block_number: u64,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: TransferId::new(),
            direction: TransferDirection::BscToCanton,
            status: TransferStatus::Initiated,
            asset_id,
            amount,
            canton_party,
            canton_contract_id: None,
            canton_tx_id: None,
            bsc_address,
            bsc_tx_hash: Some(bsc_tx_hash),
            bsc_block_number: Some(bsc_block_number),
            bsc_confirmations: Some(0),
            retry_count: 0,
            max_retries: 5,
            error_message: None,
            nonce: Uuid::new_v4().to_string(),
            created_at: now,
            updated_at: now,
09.02.2026 02:36
ничего и мы не упустили при проектированиии и выводе промта ?
09.02.2026 02:40
Аудит полноты проектирования — Canton Network ↔ BSC Bridge
Отличный вопрос. Давайте проведём систематический аудит по всем измерениям. Я буду честен — мы упустили существенное количество критических аспектов.

🔴 КРИТИЧЕСКИЕ ПРОПУСКИ
1. Canton Ledger API — Proto-спецификация неполная
Мы объявили proto/ директорию, но не специфицировали:

Какую именно версию Ledger API используем (v1 deprecated, v2 current)
Canton Participant API vs Ledger API — это разные вещи
Canton Admin API — нужен для health checks participant node
Canton Sequencer/Mediator API — если мы деплоим свой sync domain
Daml Package Upload API — как загружать .dar файлы на participant
Identity Management — Canton topology transactions для party allocation
2. Canton Authentication — JWT Token Flow
Промт упоминает JWT, но не описывает:

Canton Auth middleware — как именно Canton аутентифицирует запросы
JWKS endpoint — Canton participant может требовать RS256 JWT
User/Party mapping — как bridge service аутентифицируется как party
Token refresh logic — JWT expiry и renewal
mTLS — Canton production рекомендует mutual TLS между participant и клиентами
3. Daml Contract Model — Глубина недостаточна
Наши Daml-контракты слишком поверхностные:

Нет Authorization Model — кто signatory, кто observer, кто controller на каждом choice
Нет Daml Interfaces (Daml 2.x feature) для полиморфизма
Нет Contract Key definitions для lookup
Нет Divulgence/Disclosure модели — кто что видит
Нет Upgrade Strategy — как обновлять Daml контракты в production
Нет Multi-domain consideration — что если asset на одном domain, bridge на другом
4. BSC Contract Security — Incomplete
Нет Pausable — нужен emergency stop
Нет Upgradeable Proxy (UUPS или Transparent) — как обновлять contracts
Нет Rate Limiting на уровне контракта (max transfer per epoch)
Нет Timelock для admin operations
Нет Access Control (OpenZeppelin AccessControl vs Ownable)
Нет Reentrancy Guard специфицирован
Нет EIP-712 typed signatures для meta-transactions
Нет проверки chain ID (replay protection cross-chain)
5. Consensus & Finality — Недоисследовано
Canton finality model — Canton transactions final после confirmation от domain, но нужно учитывать conflict detection и timeouts
BSC finality — с BEP-126 fast finality (~1 block), но нужен fallback на probabilistic finality
Что происходит при BSC reorg? — bridge должен обрабатывать re-orgs до 12 блоков
Canton domain disconnect — participant может быть offline, reconnect с разными offset-ами
6. Нет Formal Threat Model
Мы не описали:

Attack vectors: bridge operator goes rogue, Canton participant compromised, BSC key leaked
Sybil attacks на bridge
Front-running на BSC стороне
MEV extraction — кто-то может sandwich-атаковать bridge transactions
Censorship resistance — что если BSC validators цензурируют bridge txs
Griefing attacks — кто-то лочит на Canton но не завершает на BSC
7. Нет Fee Model
Кто платит BSC gas?
Есть ли bridge fee?
Как bridge пополняет gas wallet?
Fee estimation и dynamic fee adjustment
Что делать при gas price spike?
8. Нет Rate Limiting & Capacity Planning
Max concurrent transfers
Max daily volume
Per-party limits
Global TVL limits
Cooldown periods
🟡 СУЩЕСТВЕННЫЕ ПРОПУСКИ
9. Error Recovery — Неполная
Orphaned transfers — начаты но не завершены (crash recovery)
Idempotency tokens — как именно работает dedup
Dead letter queue — куда уходят irrecoverable failures
Manual intervention API — operator endpoint для ручного resolve
Compensating transactions — если mint прошёл на BSC но Canton lock не confirm
10. Event Sourcing / Audit Trail
Нет event log для каждого state transition
Нет audit table с immutable записями
Нет compliance reporting — KYC/AML considerations
Canton Network — institutional grade, значит regulatory compliance обязателен
11. Multi-Asset Support
Промт упоминает assets абстрактно, но нет:
Asset Registry — mapping Canton template → BSC token
Dynamic asset onboarding workflow
Different decimal handling per asset
Asset-specific validation rules
12. Observability — Недостаточная
Нет distributed tracing correlation (Canton tx → bridge → BSC tx)
Нет structured logging стандарта
Нет alerting rules definition
Нет SLO/SLI definitions
Нет dashboards specification для Grafana
13. Testing Strategy — Неполная
Нет Canton Sandbox integration test setup
Нет BSC Hardhat fork тестирования
Нет end-to-end test scenario
Нет chaos engineering (что если Canton participant упал mid-transfer?)
Нет load testing плана
Нет property-based testing для state machine
14. Deployment & Operations
Нет Blue/Green deployment стратегии
Нет Database migration стратегии при обновлениях
Нет Backup/Restore процедуры
Нет Key rotation процедуры
Нет Incident response runbook
🟢 МЕЛКИЕ ПРОПУСКИ
15. Конфигурация
Нет secret injection механизма (Vault integration)
Нет feature flags для gradual rollout
Нет environment-specific Canton participant endpoints
16. API Design
Bridge API не имеет versioning (v1/v2)
Нет WebSocket endpoint для real-time transfer status
Нет pagination на list endpoints
Нет OpenAPI/Swagger spec
17. Canton-Specific
Canton Time Model — Daml ledger time vs record time, bridge должен корректно использовать
Canton Command Deduplication — Ledger API имеет встроенную dedup через command_id
Canton Package Management — версионирование .dar файлов
Canton Party Allocation — автоматическая или ручная
18. Cross-cutting
Graceful degradation — что bridge делает когда одна из chain недоступна
Circuit breaker параметры и стратегия
Backpressure — если BSC газ высок, замедляем приём от Canton
Queue overflow — bounded queues для в-процессе transfers


















│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── types.rs                # BridgeTransfer, BridgeStatus, etc.
│   │       ├── errors.rs               # BridgeError enum
│   │       ├── config.rs               # BridgeConfig struct
│   │       ├── traits.rs               # CantonClient, BscClient traits
│   │       └── state_machine.rs        # TransferStateMachine
│   ├── canton-client/                  # Canton Ledger API client
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── grpc_client.rs          # gRPC Ledger API (tonic generated)
│   │       ├── json_client.rs          # JSON API HTTP client (fallback)
│   │       ├── commands.rs             # Daml command builders
│   │       ├── transactions.rs         # Transaction stream processor
│   │       ├── auth.rs                 # JWT token management
│   │       └── proto/                  # .proto файлы Canton Ledger API
│   │           └── com.daml.ledger.api.v2/  # v2 proto definitions
│   ├── bsc-client/                     # BSC Web3 client
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── provider.rs            # ethers Provider setup (HTTP + WS)
│   │       ├── contracts.rs           # Generated contract bindings
│   │       ├── bridge_contract.rs     # Bridge.sol interactions
│   │       ├── token_contract.rs      # BEP20 token interactions
│   │       ├── event_listener.rs      # Event subscription & processing
│   │       ├── gas_oracle.rs          # Gas price estimation
│   │       ├── tx_manager.rs          # Transaction lifecycle (send, confirm, retry)
│   │       └── nonce_manager.rs       # Thread-safe nonce tracking
│   ├── bridge-orchestrator/           # главный сервис, координация
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── main.rs                # entry point, graceful shutdown
│   │       ├── orchestrator.rs        # BridgeOrchestrator struct
│   │       ├── canton_to_bsc.rs       # Canton→BSC flow handler
│   │       ├── bsc_to_canton.rs       # BSC→Canton flow handler
│   │       ├── recovery.rs            # Recovery from failures/restarts
│   │       ├── health.rs              # Health check HTTP endpoint
│   │       └── metrics.rs            # Prometheus metrics
│   ├── bridge-db/                     # PostgreSQL persistence
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── models.rs             # DB models
│   │       ├── repository.rs         # CRUD operations
│   │       └── migrations/           # SQL migrations
│   │           ├── 001_create_tables.sql
│   │           └── 002_create_indexes.sql
│   └── bridge-api/                    # REST API для мониторинга и управления
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs
│           ├── routes.rs             # axum routes
│           ├── handlers.rs           # request handlers
│           └── middleware.rs         # auth, logging middleware
├── contracts/
│   ├── daml/                          # Daml smart contracts
│   │   ├── daml.yaml
│   │   └── daml/
│   │       ├── Bridge/
│   │       │   ├── Asset.daml         # Asset template
│   │       │   ├── Lock.daml          # Lock/Unlock templates
│   │       │   ├── Transfer.daml      # CrossChainTransfer template
│   │       │   └── Types.daml         # Shared types
│   │       └── Test/
│   │           └── BridgeTest.daml    # Daml script tests
│   └── solidity/                      # Solidity smart contracts
│       ├── hardhat.config.ts
│       ├── package.json
│       ├── contracts/
│       │   ├── BridgeVault.sol        # Main bridge contract
│       │   ├── BridgedToken.sol       # Wrapped Canton asset (BEP-20)
│       │   ├── BridgeRegistry.sol     # Asset registry & mapping
│       │   ├── MultiSigValidator.sol  # Multi-sig validation
│       │   └── interfaces/
│       │       ├── IBridgeVault.sol
│       │       └── IBridgedToken.sol
│       ├── test/
│       │   ├── BridgeVault.test.ts
│       │   ├── BridgedToken.test.ts
│       │   └── integration.test.ts
│       └── scripts/
│           ├── deploy.ts
│           └── verify.ts
├── docker/
│   ├── Dockerfile.bridge              # Multi-stage Rust build
│   ├── Dockerfile.canton              # Canton participant setup
│   ├── docker-compose.yml             # Full dev environment
│   └── docker-compose.infra.yml       # Infrastructure only
├── scripts/
│   ├── setup.sh                       # Development setup script
│   ├── generate-proto.sh              # gRPC proto generation
│   └── run-tests.sh                   # Full test suite
├── monitoring/
│   ├── prometheus.yml
│   ├── grafana/
│   │   └── dashboards/
│   │       └── bridge-dashboard.json
│   └── alerting/
│       └── rules.yml
└── docs/
├── architecture.md
├── deployment.md
├── security.md
└── runbook.md


Makefile

## ДЕТАЛЬНЫЕ СПЕЦИФИКАЦИИ ДЛЯ КАЖДОГО ФАЙЛА

### 1. WORKSPACE ROOT — Cargo.toml

```toml
[workspace]
resolver = "2"
members = [
    "crates/bridge-core",
    "crates/canton-client", 
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

[workspace.dependencies]
# Async runtime
tokio = { version = "1.37", features = ["full"] }
tokio-stream = "0.1"

# Serialization
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

# Error handling
thiserror = "1.0"
anyhow = "1.0"

# Logging & Tracing
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter", "json"] }
tracing-opentelemetry = "0.23"

# gRPC (Canton)
tonic = "0.11"
prost = "0.12"
prost-types = "0.12"

# HTTP
reqwest = { version = "0.12", features = ["json", "rustls-tls"] }
axum = "0.7"
tower = "0.4"
tower-http = { version = "0.5", features = ["cors", "trace", "auth"] }

# Ethereum / BSC
ethers = { version = "2.0", features = ["ws", "rustls", "abigen"] }

# Database
sqlx = { version = "0.7", features = ["runtime-tokio-rustls", "postgres", "uuid", "chrono", "migrate"] }

# Redis
deadpool-redis = "0.15"
redis = { version = "0.25", features = ["tokio-comp"] }

# Config
config = "0.14"

# Crypto
sha2 = "0.10"
hex = "0.4"

# Time
chrono = { version = "0.4", features = ["serde"] }

# UUID
uuid = { version = "1.8", features = ["v4", "serde"] }

# Metrics
prometheus-client = "0.22"

# Testing
mockall = "0.12"
2. bridge-core/src/types.rs

Rust
//! Core domain types for the Canton-BSC bridge.
//!
//! These types represent the fundamental domain objects that flow through
//! the bridge system. They are chain-agnostic and represent the bridge's
//! internal state model.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Unique identifier for a bridge transfer operation.
/// Generated by the bridge when a transfer is initiated on either chain.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct TransferId(pub Uuid);

impl TransferId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }
    
    pub fn from_string(s: &str) -> Result<Self, uuid::Error> {
        Ok(Self(Uuid::parse_str(s)?))
    }
}

impl std::fmt::Display for TransferId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Direction of the cross-chain transfer
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "transfer_direction", rename_all = "snake_case")]
pub enum TransferDirection {
    /// Asset locked on Canton, minted on BSC
    CantonToBsc,
    /// Asset burned on BSC, unlocked on Canton  
    BscToCanton,
}

/// Current status of a bridge transfer.
/// Represents a finite state machine with well-defined transitions.
///
/// State transitions for Canton→BSC:
///   Initiated → CantonLocked → BscMinting → BscMinted → Completed
///                    ↘                                      ↗
///                     → Failed (from any intermediate state)
///
/// State transitions for BSC→Canton:
///   Initiated → BscBurned → CantonUnlocking → CantonUnlocked → Completed
///                    ↘                                            ↗
///                     → Failed (from any intermediate state)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "transfer_status", rename_all = "snake_case")]
pub enum TransferStatus {
    /// Transfer request detected on source chain
    Initiated,
    
    // Canton → BSC states
    /// Asset locked in Canton Daml contract
    CantonLocked,
    /// BSC mint transaction submitted
    BscMinting,
    /// BSC mint confirmed with sufficient block confirmations
    BscMinted,
    
    // BSC → Canton states  
    /// Asset burned on BSC
    BscBurned,
    /// BSC burn has achieved finality (sufficient confirmations)
    BscBurnFinalized,
    /// Canton unlock command submitted
    CantonUnlocking,
    /// Canton unlock confirmed
    CantonUnlocked,
    
    /// Transfer completed successfully on both chains
    Completed,
    /// Transfer failed — requires manual intervention
    Failed,
    /// Transfer is being rolled back
    RollingBack,
    /// Rollback completed
    RolledBack,
}

impl TransferStatus {
    /// Returns true if this status represents a terminal state
    pub fn is_terminal(&self) -> bool {
        matches!(self, Self::Completed | Self::Failed | Self::RolledBack)
    }
    
    /// Returns true if this status allows retry
    pub fn is_retryable(&self) -> bool {
        matches!(self, Self::BscMinting | Self::CantonUnlocking)
    }
    
    /// Validates whether a transition from self to `next` is valid
    pub fn can_transition_to(&self, next: &TransferStatus) -> bool {
        use TransferStatus::*;
        matches!(
            (self, next),
            // Canton → BSC flow
            (Initiated, CantonLocked)
            | (CantonLocked, BscMinting)
            | (BscMinting, BscMinted)
            | (BscMinted, Completed)
            // BSC → Canton flow
            | (Initiated, BscBurned)
            | (BscBurned, BscBurnFinalized)
            | (BscBurnFinalized, CantonUnlocking)
            | (CantonUnlocking, CantonUnlocked)
            | (CantonUnlocked, Completed)
            // Error transitions (any non-terminal → Failed)
            | (Initiated, Failed)
            | (CantonLocked, Failed)
            | (BscMinting, Failed)
            | (BscBurned, Failed)
            | (BscBurnFinalized, Failed)
            | (CantonUnlocking, Failed)
            // Rollback transitions
            | (Failed, RollingBack)
            | (RollingBack, RolledBack)
        )
    }
}

/// Represents a Canton party identifier
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct CantonParty(pub String);

/// Represents a Canton contract identifier
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct CantonContractId(pub String);

/// Represents a BSC (Ethereum-compatible) address
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct BscAddress(pub String);

impl BscAddress {
    /// Validates that the address is a valid hex-encoded 20-byte address
    pub fn validate(&self) -> bool {
        let s = self.0.strip_prefix("0x").unwrap_or(&self.0);
        s.len() == 40 && s.chars().all(|c| c.is_ascii_hexdigit())
    }
}

/// Represents a BSC transaction hash
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct BscTxHash(pub String);

/// Amount representation with decimal precision.
/// Uses string internally to avoid floating-point precision issues.
/// Canton and BSC both need precise decimal handling.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Amount {
    /// Raw amount as string to preserve precision
    pub value: String,
    /// Number of decimal places
    pub decimals: u8,
}

impl Amount {
    pub fn new(value: impl Into<String>, decimals: u8) -> Self {
        Self {
            value: value.into(),
            decimals,
        }
    }
    
    /// Convert to the smallest unit (e.g., wei for 18 decimals)
    pub fn to_base_units(&self) -> Result<u128, std::num::ParseIntError> {
        // Handle decimal point in value
        let parts: Vec<&str> = self.value.split('.').collect();
        match parts.len() {
            1 => {
                let base: u128 = 10u128.pow(self.decimals as u32);
                let whole: u128 = parts[0].parse()?;
                Ok(whole * base)
            }
            2 => {
                let base: u128 = 10u128.pow(self.decimals as u32);
                let whole: u128 = parts[0].parse()?;
                let frac_str = parts[1];
                let frac_decimals = frac_str.len() as u32;
                let frac: u128 = frac_str.parse()?;
                let frac_base = 10u128.pow(self.decimals as u32 - frac_decimals);
                Ok(whole * base + frac * frac_base)
            }
            _ => Ok(0),
        }
    }
}

/// Identifies an asset across both chains
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssetId {
    /// Canton template qualified name (e.g., "Bridge.Asset:Token")
    pub canton_template_id: String,
    /// BSC BEP-20 token contract address
    pub bsc_token_address: BscAddress,
    /// Human-readable symbol
    pub symbol: String,
    /// Decimal precision
    pub decimals: u8,
}

/// The core transfer record that tracks a cross-chain transfer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgeTransfer {
    /// Unique bridge transfer ID
    pub id: TransferId,
    /// Direction of transfer
    pub direction: TransferDirection,
    /// Current status
    pub status: TransferStatus,
    /// Asset being transferred
    pub asset_id: String,
    /// Transfer amount
    pub amount: Amount,
    
    // Canton side
    /// Canton party initiating or receiving
    pub canton_party: CantonParty,
    /// Canton contract ID (lock/unlock contract)
    pub canton_contract_id: Option<CantonContractId>,
    /// Canton transaction ID (from Ledger API)
    pub canton_tx_id: Option<String>,
    
    // BSC side
    /// BSC address sending or receiving
    pub bsc_address: BscAddress,
    /// BSC transaction hash (mint/burn)
    pub bsc_tx_hash: Option<BscTxHash>,
    /// BSC block number where the relevant tx was included
    pub bsc_block_number: Option<u64>,
    /// Number of BSC confirmations received
    pub bsc_confirmations: Option<u64>,
    
    // Metadata
    /// Number of retry attempts for current step
    pub retry_count: u32,
    /// Maximum retries before marking as failed
    pub max_retries: u32,
    /// Human-readable error message if failed
    pub error_message: Option<String>,
    /// Nonce used for idempotency/dedup
    pub nonce: String,
    
    // Timestamps
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

impl BridgeTransfer {
    /// Create a new Canton→BSC transfer
    pub fn new_canton_to_bsc(
        canton_party: CantonParty,
        bsc_address: BscAddress,
        asset_id: String,
        amount: Amount,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: TransferId::new(),
            direction: TransferDirection::CantonToBsc,
            status: TransferStatus::Initiated,
            asset_id,
            amount,
            canton_party,
            canton_contract_id: None,
            canton_tx_id: None,
            bsc_address,
            bsc_tx_hash: None,
            bsc_block_number: None,
            bsc_confirmations: None,
            retry_count: 0,
            max_retries: 5,
            error_message: None,
            nonce: Uuid::new_v4().to_string(),
            created_at: now,
            updated_at: now,
            completed_at: None,
        }
    }
    
    /// Create a new BSC→Canton transfer  
    pub fn new_bsc_to_canton(
        bsc_address: BscAddress,
        canton_party: CantonParty,
        asset_id: String,
        amount: Amount,
        bsc_tx_hash: BscTxHash,
        bsc_block_number: u64,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: TransferId::new(),
            direction: TransferDirection::BscToCanton,
            status: TransferStatus::Initiated,
            asset_id,
            amount,
            canton_party,
            canton_contract_id: None,
            canton_tx_id: None,
            bsc_address,
            bsc_tx_hash: Some(bsc_tx_hash),
            bsc_block_number: Some(bsc_block_number),
            bsc_confirmations: Some(0),
            retry_count: 0,
            max_retries: 5,
            error_message: None,
            nonce: Uuid::new_v4().to_string(),
            created_at: now,
            updated_at: now,
09.02.2026 02:36
ничего и мы не упустили при проектированиии и выводе промта ?
09.02.2026 02:40
Аудит полноты проектирования — Canton Network ↔ BSC Bridge
Отличный вопрос. Давайте проведём систематический аудит по всем измерениям. Я буду честен — мы упустили существенное количество критических аспектов.

🔴 КРИТИЧЕСКИЕ ПРОПУСКИ
1. Canton Ledger API — Proto-спецификация неполная
Мы объявили proto/ директорию, но не специфицировали:

Какую именно версию Ledger API используем (v1 deprecated, v2 current)
Canton Participant API vs Ledger API — это разные вещи
Canton Admin API — нужен для health checks participant node
Canton Sequencer/Mediator API — если мы деплоим свой sync domain
Daml Package Upload API — как загружать .dar файлы на participant
Identity Management — Canton topology transactions для party allocation
2. Canton Authentication — JWT Token Flow
Промт упоминает JWT, но не описывает:

Canton Auth middleware — как именно Canton аутентифицирует запросы
JWKS endpoint — Canton participant может требовать RS256 JWT
User/Party mapping — как bridge service аутентифицируется как party
Token refresh logic — JWT expiry и renewal
mTLS — Canton production рекомендует mutual TLS между participant и клиентами
3. Daml Contract Model — Глубина недостаточна
Наши Daml-контракты слишком поверхностные:

Нет Authorization Model — кто signatory, кто observer, кто controller на каждом choice
Нет Daml Interfaces (Daml 2.x feature) для полиморфизма
Нет Contract Key definitions для lookup
Нет Divulgence/Disclosure модели — кто что видит
Нет Upgrade Strategy — как обновлять Daml контракты в production
Нет Multi-domain consideration — что если asset на одном domain, bridge на другом
4. BSC Contract Security — Incomplete
Нет Pausable — нужен emergency stop
Нет Upgradeable Proxy (UUPS или Transparent) — как обновлять contracts
Нет Rate Limiting на уровне контракта (max transfer per epoch)
Нет Timelock для admin operations
Нет Access Control (OpenZeppelin AccessControl vs Ownable)
Нет Reentrancy Guard специфицирован
Нет EIP-712 typed signatures для meta-transactions
Нет проверки chain ID (replay protection cross-chain)
5. Consensus & Finality — Недоисследовано
Canton finality model — Canton transactions final после confirmation от domain, но нужно учитывать conflict detection и timeouts
BSC finality — с BEP-126 fast finality (~1 block), но нужен fallback на probabilistic finality
Что происходит при BSC reorg? — bridge должен обрабатывать re-orgs до 12 блоков
Canton domain disconnect — participant может быть offline, reconnect с разными offset-ами
6. Нет Formal Threat Model
Мы не описали:

Attack vectors: bridge operator goes rogue, Canton participant compromised, BSC key leaked
Sybil attacks на bridge
Front-running на BSC стороне
MEV extraction — кто-то может sandwich-атаковать bridge transactions
Censorship resistance — что если BSC validators цензурируют bridge txs
Griefing attacks — кто-то лочит на Canton но не завершает на BSC
7. Нет Fee Model
Кто платит BSC gas?
Есть ли bridge fee?
Как bridge пополняет gas wallet?
Fee estimation и dynamic fee adjustment
Что делать при gas price spike?
8. Нет Rate Limiting & Capacity Planning
Max concurrent transfers
Max daily volume
Per-party limits
Global TVL limits
Cooldown periods
🟡 СУЩЕСТВЕННЫЕ ПРОПУСКИ
9. Error Recovery — Неполная
Orphaned transfers — начаты но не завершены (crash recovery)
Idempotency tokens — как именно работает dedup
Dead letter queue — куда уходят irrecoverable failures
Manual intervention API — operator endpoint для ручного resolve
Compensating transactions — если mint прошёл на BSC но Canton lock не confirm
10. Event Sourcing / Audit Trail
Нет event log для каждого state transition
Нет audit table с immutable записями
Нет compliance reporting — KYC/AML considerations
Canton Network — institutional grade, значит regulatory compliance обязателен
11. Multi-Asset Support
Промт упоминает assets абстрактно, но нет:
Asset Registry — mapping Canton template → BSC token
Dynamic asset onboarding workflow
Different decimal handling per asset
Asset-specific validation rules
12. Observability — Недостаточная
Нет distributed tracing correlation (Canton tx → bridge → BSC tx)
Нет structured logging стандарта
Нет alerting rules definition
Нет SLO/SLI definitions
Нет dashboards specification для Grafana
13. Testing Strategy — Неполная
Нет Canton Sandbox integration test setup
Нет BSC Hardhat fork тестирования
Нет end-to-end test scenario
Нет chaos engineering (что если Canton participant упал mid-transfer?)
Нет load testing плана
Нет property-based testing для state machine
14. Deployment & Operations
Нет Blue/Green deployment стратегии
Нет Database migration стратегии при обновлениях
Нет Backup/Restore процедуры
Нет Key rotation процедуры
Нет Incident response runbook
🟢 МЕЛКИЕ ПРОПУСКИ
15. Конфигурация
Нет secret injection механизма (Vault integration)
Нет feature flags для gradual rollout
Нет environment-specific Canton participant endpoints
16. API Design
Bridge API не имеет versioning (v1/v2)
Нет WebSocket endpoint для real-time transfer status
Нет pagination на list endpoints
Нет OpenAPI/Swagger spec
17. Canton-Specific
Canton Time Model — Daml ledger time vs record time, bridge должен корректно использовать
Canton Command Deduplication — Ledger API имеет встроенную dedup через command_id
Canton Package Management — версионирование .dar файлов
Canton Party Allocation — автоматическая или ручная
18. Cross-cutting
Graceful degradation — что bridge делает когда одна из chain недоступна
Circuit breaker параметры и стратегия
Backpressure — если BSC газ высок, замедляем приём от Canton
Queue overflow — bounded queues для в-процессе transfers
09.02.2026 03:05
Полный анализ и исправленная архитектура Canton ↔ BSC Bridge
Вижу, что вы провели серьёзный аудит и нашли множество пропусков. Давайте я систематически закрою все выявленные gaps и создам полную, production-ready спецификацию.

Начну с создания всей структуры проекта с исправлениями:

Сначала создам корневую структуру и все файлы. Это масштабная работа — пойдём по порядку.


Bash
# Создаю полную структуру проекта
mkdir -p canton-bsc-bridge/{crates/{bridge-core/src,canton-client/src/proto,bsc-client/src,bridge-orchestrator/src,bridge-db/src/migrations,bridge-api/src},contracts/{daml/daml/{Bridge,Test},solidity/{contracts/interfaces,test,scripts}},docker,scripts,monitoring/{grafana/dashboards,alerting},docs,config}
1. Workspace Root

Toml, also ini
# Cargo.toml (workspace root)
[workspace]
resolver = "2"
members = [
    "crates/bridge-core",
    "crates/canton-client",
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
repository = "https://github.com/org/canton-bsc-bridge"

[workspace.dependencies]
# Async runtime
tokio = { version = "1.37", features = ["full"] }
tokio-stream = "0.1"
tokio-util = { version = "0.7", features = ["rt"] }
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
opentelemetry = { version = "0.22", features = ["trace"] }
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
tower = { version = "0.4", features = ["timeout", "limit", "load-shed"] }
tower-http = { version = "0.5", features = ["cors", "trace", "auth", "compression-gzip", "request-id"] }

# Ethereum / BSC
ethers = { version = "2.0", features = ["ws", "rustls", "abigen"] }
ethers-contract = "2.0"
ethers-signers = { version = "2.0", features = ["aws"] }

# Database
sqlx = { version = "0.7", features = ["runtime-tokio-rustls", "postgres", "uuid", "chrono", "migrate", "json"] }
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

# Metrics & Health
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
canton-client = { path = "crates/canton-client" }
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
2. bridge-core crate

Toml, also ini
# crates/bridge-core/Cargo.toml
[package]
name = "bridge-core"
version.workspace = true
edition.workspace = true

[dependencies]
serde = { workspace = true }
serde_json = { workspace = true }
thiserror = { workspace = true }
anyhow = { workspace = true }
chrono = { workspace = true }
uuid = { workspace = true }
tracing = { workspace = true }
validator = { workspace = true }
sha2 = { workspace = true }
hex = { workspace = true }
tokio = { workspace = true }
async-trait = "0.1"
sqlx = { workspace = true }
prometheus-client = { workspace = true }

[dev-dependencies]
mockall = { workspace = true }
proptest = { workspace = true }
assert_matches = { workspace = true }
tokio-test = { workspace = true }

Rust
// crates/bridge-core/src/lib.rs
//! Bridge Core — domain types, traits, error handling, and state machine
//! for the Canton Network ↔ BSC bridge.
//!
//! This crate is the foundation of the bridge system. It contains:
//! - Domain types (transfers, assets, identifiers)
//! - Error taxonomy
//! - Configuration structures
//! - Trait definitions for chain clients
//! - Transfer state machine with validated transitions
//! - Fee model
//! - Rate limiting types

pub mod types;
pub mod errors;
pub mod config;
pub mod traits;
pub mod state_machine;
pub mod fees;
pub mod rate_limit;
pub mod crypto;
pub mod audit;

pub use types::*;
pub use errors::*;
pub use config::*;
pub use traits::*;
pub use state_machine::*;

Rust
// crates/bridge-core/src/types.rs
//! Core domain types for the Canton-BSC bridge.
//!
//! These types represent the fundamental domain objects that flow through
//! the bridge system. They are chain-agnostic and represent the bridge's
//! internal state model.
//!
//! Design decisions:
//! - Amount uses string representation to avoid floating-point precision loss
//! - All IDs are newtypes for type safety
//! - Canton and BSC types are kept separate to prevent mixing
//! - Timestamps use UTC consistently

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;
use std::fmt;

// ─────────────────────────────────────────────────────────────
// Transfer Identification
// ─────────────────────────────────────────────────────────────

/// Unique identifier for a bridge transfer operation.
/// Uses UUIDv7 for time-ordered generation (better for DB indexing).
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct TransferId(pub Uuid);

impl TransferId {
    pub fn new() -> Self {
        Self(Uuid::now_v7())
    }

    pub fn from_string(s: &str) -> Result<Self, uuid::Error> {
        Ok(Self(Uuid::parse_str(s)?))
    }

    pub fn as_bytes(&self) -> &[u8; 16] {
        self.0.as_bytes()
    }
}

impl Default for TransferId {
    fn default() -> Self {
        Self::new()
    }
}

impl fmt::Display for TransferId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl From<Uuid> for TransferId {
    fn from(u: Uuid) -> Self {
        Self(u)
    }
}

// ─────────────────────────────────────────────────────────────
// Transfer Direction
// ─────────────────────────────────────────────────────────────

/// Direction of the cross-chain transfer.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "transfer_direction", rename_all = "snake_case")]
pub enum TransferDirection {
    /// Asset locked on Canton, minted/released on BSC
    CantonToBsc,
    /// Asset burned on BSC, unlocked on Canton
    BscToCanton,
}

impl fmt::Display for TransferDirection {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::CantonToBsc => write!(f, "Canton→BSC"),
            Self::BscToCanton => write!(f, "BSC→Canton"),
        }
    }
}

// ─────────────────────────────────────────────────────────────
// Transfer Status (State Machine States)
// ─────────────────────────────────────────────────────────────

/// Current status of a bridge transfer.
///
/// This is the state in a well-defined finite state machine.
/// All valid transitions are enforced by `TransferStateMachine`.
///
/// ## Canton→BSC Flow
/// ```text
/// Initiated → CantonLocking → CantonLocked → BscMinting → BscMinted → Completed
///     ↓            ↓               ↓              ↓            ↓
///   Failed       Failed          Failed         Failed      Failed
///     ↓
///   RollingBack → RolledBack
/// ```
///
/// ## BSC→Canton Flow
/// ```text
/// Initiated → BscBurned → BscBurnFinalized → CantonUnlocking → CantonUnlocked → Completed
///     ↓           ↓              ↓                  ↓                ↓
///   Failed      Failed         Failed             Failed          Failed
///     ↓
///   RollingBack → RolledBack
/// ```
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type, Hash)]
#[sqlx(type_name = "transfer_status", rename_all = "snake_case")]
pub enum TransferStatus {
    /// Transfer request detected and validated on source chain
    Initiated,

    // Canton → BSC states
    /// Canton lock command submitted (in-flight)
    CantonLocking,
    /// Asset confirmed locked in Canton Daml contract
    CantonLocked,
    /// BSC mint transaction submitted (in-flight)
    BscMinting,
    /// BSC mint confirmed with sufficient block confirmations
    BscMinted,

    // BSC → Canton states
    /// Asset burn detected on BSC (event received)
    BscBurned,
    /// BSC burn has achieved finality (sufficient confirmations, no reorg)
    BscBurnFinalized,
    /// Canton unlock command submitted (in-flight)
    CantonUnlocking,
    /// Canton unlock confirmed on ledger
    CantonUnlocked,

    /// Transfer completed successfully on both chains
    Completed,
    /// Transfer failed — may require manual intervention or rollback
    Failed,
    /// Rollback in progress (compensating transaction executing)
    RollingBack,
    /// Rollback completed — source chain state restored
    RolledBack,
    /// Stuck — exceeded max retries, needs operator attention
    Stuck,
}

impl TransferStatus {
    /// Returns true if this status represents a terminal state
    pub fn is_terminal(&self) -> bool {
        matches!(self, Self::Completed | Self::RolledBack)
    }

    /// Returns true if this status requires operator intervention
    pub fn needs_intervention(&self) -> bool {
        matches!(self, Self::Failed | Self::Stuck)
    }

    /// Returns true if this status represents an in-flight operation
    pub fn is_in_flight(&self) -> bool {
        matches!(
            self,
            Self::CantonLocking | Self::BscMinting | Self::CantonUnlocking | Self::RollingBack
        )
    }

    /// Returns true if this status allows automated retry
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            Self::CantonLocking | Self::BscMinting | Self::CantonUnlocking
        )
    }

    /// Validates whether a transition from `self` to `next` is valid
    pub fn can_transition_to(&self, next: &TransferStatus) -> bool {
        use TransferStatus::*;
        matches!(
            (self, next),
            // Canton → BSC flow
            (Initiated, CantonLocking)
                | (CantonLocking, CantonLocked)
                | (CantonLocked, BscMinting)
                | (BscMinting, BscMinted)
                | (BscMinted, Completed)
                // BSC → Canton flow
                | (Initiated, BscBurned)
                | (BscBurned, BscBurnFinalized)
                | (BscBurnFinalized, CantonUnlocking)
                | (CantonUnlocking, CantonUnlocked)
                | (CantonUnlocked, Completed)
                // Failure transitions (any non-terminal, non-stuck → Failed)
                | (Initiated, Failed)
                | (CantonLocking, Failed)
                | (CantonLocked, Failed)
                | (BscMinting, Failed)
                | (BscMinted, Failed)
                | (BscBurned, Failed)
                | (BscBurnFinalized, Failed)
                | (CantonUnlocking, Failed)
                | (CantonUnlocked, Failed)
                // Retry transitions (back to in-flight from failed)
                | (Failed, CantonLocking)
                | (Failed, BscMinting)
                | (Failed, CantonUnlocking)
                // Stuck after max retries
                | (Failed, Stuck)
                // Rollback
                | (Failed, RollingBack)
                | (Stuck, RollingBack)
                | (RollingBack, RolledBack)
                | (RollingBack, Failed) // rollback itself can fail
        )
    }

    /// Returns a human-readable description of this status
    pub fn description(&self) -> &'static str {
        match self {
            Self::Initiated => "Transfer initiated, pending source chain action",
            Self::CantonLocking => "Locking asset on Canton (command submitted)",
            Self::CantonLocked => "Asset locked on Canton, pending BSC mint",
            Self::BscMinting => "Minting on BSC (transaction submitted)",
            Self::BscMinted => "Minted on BSC with sufficient confirmations",
            Self::BscBurned => "Burn detected on BSC, awaiting finality",
            Self::BscBurnFinalized => "BSC burn finalized, pending Canton unlock",
            Self::CantonUnlocking => "Unlocking on Canton (command submitted)",
            Self::CantonUnlocked => "Asset unlocked on Canton",
            Self::Completed => "Transfer completed successfully",
            Self::Failed => "Transfer failed — may be retried or rolled back",
            Self::RollingBack => "Rollback in progress",
            Self::RolledBack => "Rollback completed",
            Self::Stuck => "Transfer stuck — requires operator intervention",
        }
    }
}

impl fmt::Display for TransferStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:?}", self)
    }
}

// ─────────────────────────────────────────────────────────────
// Canton Types
// ─────────────────────────────────────────────────────────────

/// Canton party identifier (e.g., "Alice::1220abcdef...")
/// Format: displayName::fingerprint
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct CantonParty(pub String);

impl CantonParty {
    pub fn new(party: impl Into<String>) -> Self {
        Self(party.into())
    }

    /// Validate Canton party format
    pub fn validate(&self) -> bool {
        // Canton party format: hint::fingerprint
        // fingerprint is a hex-encoded hash
        self.0.contains("::")
    }
}

impl fmt::Display for CantonParty {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Canton contract identifier (hash-based, from Ledger API)
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct CantonContractId(pub String);

impl CantonContractId {
    pub fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }
}

impl fmt::Display for CantonContractId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Canton Ledger API offset — used for transaction stream checkpointing
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct CantonOffset(pub String);

impl CantonOffset {
    pub fn new(offset: impl Into<String>) -> Self {
        Self(offset.into())
    }

    /// The beginning offset (start of ledger)
    pub fn begin() -> Self {
        Self(String::new())
    }
}

/// Canton command ID for deduplication (Ledger API built-in dedup)
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct CantonCommandId(pub String);

impl CantonCommandId {
    /// Generate a deterministic command ID from transfer ID and step
    /// This ensures Canton-level deduplication for retries
    pub fn for_transfer(transfer_id: &TransferId, step: &str) -> Self {
        Self(format!("bridge-{}-{}", transfer_id, step))
    }
}

/// Canton workflow ID for correlating commands and completions
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct CantonWorkflowId(pub String);

/// Canton Daml template identifier
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct CantonTemplateId {
    /// Package ID (hash of the .dar)
    pub package_id: String,
    /// Module path (e.g., "Bridge.Asset")
    pub module_name: String,
    /// Template name (e.g., "LockedAsset")
    pub entity_name: String,
}

impl CantonTemplateId {
    pub fn qualified_name(&self) -> String {
        format!("{}:{}:{}", self.package_id, self.module_name, self.entity_name)
    }
}

// ─────────────────────────────────────────────────────────────
// BSC Types
// ─────────────────────────────────────────────────────────────

/// BSC (Ethereum-compatible) address — 20 bytes, hex-encoded with 0x prefix
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct BscAddress(pub String);

impl BscAddress {
    pub fn new(addr: impl Into<String>) -> Self {
        let s = addr.into();
        // Normalize to lowercase with 0x prefix
        let normalized = if s.starts_with("0x") || s.starts_with("0X") {
            format!("0x{}", &s[2..].to_lowercase())
        } else {
            format!("0x{}", s.to_lowercase())
        };
        Self(normalized)
    }

    /// Validates that the address is a valid hex-encoded 20-byte address
    pub fn validate(&self) -> bool {
        let s = self.0.strip_prefix("0x").unwrap_or(&self.0);
        s.len() == 40 && s.chars().all(|c| c.is_ascii_hexdigit())
    }

    /// Convert to ethers Address type
    pub fn to_ethers(&self) -> Result<ethers::types::Address, rustc_hex::FromHexError> {
        self.0.parse()
    }

    /// Zero address (used for burn detection)
    pub fn zero() -> Self {
        Self("0x0000000000000000000000000000000000000000".to_string())
    }
}

impl fmt::Display for BscAddress {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// BSC transaction hash — 32 bytes, hex-encoded with 0x prefix
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct BscTxHash(pub String);

impl BscTxHash {
    pub fn new(hash: impl Into<String>) -> Self {
        Self(hash.into())
    }

    pub fn validate(&self) -> bool {
        let s = self.0.strip_prefix("0x").unwrap_or(&self.0);
        s.len() == 64 && s.chars().all(|c| c.is_ascii_hexdigit())
    }
}

impl fmt::Display for BscTxHash {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// BSC block reference
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BscBlock {
    pub number: u64,
    pub hash: String,
    pub timestamp: DateTime<Utc>,
}

// ─────────────────────────────────────────────────────────────
// Amount & Asset Types
// ─────────────────────────────────────────────────────────────

/// Precise amount representation.
///
/// Uses u256-compatible string internally to avoid floating-point
/// precision issues. Both Canton (Daml Decimal) and BSC (uint256)
/// require exact precision.
///
/// Canton Daml uses `Decimal` type with 10 integer + 10 fractional digits.
/// BSC uses uint256 in smallest unit (e.g., wei = 10^-18).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Amount {
    /// Raw amount in the smallest unit (base units).
    /// e.g., for 18 decimals: "1000000000000000000" = 1.0 token
    pub raw: String,
    /// Number of decimal places for display
    pub decimals: u8,
}

impl Amount {
    /// Create from base units (smallest denomination)
    pub fn from_base_units(raw: impl Into<String>, decimals: u8) -> Self {
        Self {
            raw: raw.into(),
            decimals,
        }
    }

    /// Create from human-readable amount (e.g., "1.5" with 18 decimals)
    pub fn from_human(value: &str, decimals: u8) -> Result<Self, AmountParseError> {
        let parts: Vec<&str> = value.split('.').collect();
        match parts.len() {
            1 => {
                // Integer only
                let whole: u128 = parts[0]
                    .parse()
                    .map_err(|_| AmountParseError::InvalidFormat(value.to_string()))?;
                let base = 10u128
                    .checked_pow(decimals as u32)
                    .ok_or(AmountParseError::Overflow)?;
                let raw = whole
                    .checked_mul(base)
                    .ok_or(AmountParseError::Overflow)?;
                Ok(Self {
                    raw: raw.to_string(),
                    decimals,
                })
            }
            2 => {
                let whole: u128 = parts[0]
                    .parse()
                    .map_err(|_| AmountParseError::InvalidFormat(value.to_string()))?;
                let frac_str = parts[1];

                if frac_str.len() > decimals as usize {
                    return Err(AmountParseError::TooManyDecimals {
                        got: frac_str.len() as u8,
                        max: decimals,
                    });
                }

                let base = 10u128
                    .checked_pow(decimals as u32)
                    .ok_or(AmountParseError::Overflow)?;
                let frac_base = 10u128
                    .checked_pow((decimals as u32) - (frac_str.len() as u32))
                    .ok_or(AmountParseError::Overflow)?;
                let frac: u128 = frac_str
                    .parse()
                    .map_err(|_| AmountParseError::InvalidFormat(value.to_string()))?;

                let raw = whole
                    .checked_mul(base)
                    .ok_or(AmountParseError::Overflow)?
                    .checked_add(
                        frac.checked_mul(frac_base)
                            .ok_or(AmountParseError::Overflow)?,
                    )
                    .ok_or(AmountParseError::Overflow)?;

                Ok(Self {
                    raw: raw.to_string(),
                    decimals,
                })
            }
            _ => Err(AmountParseError::InvalidFormat(value.to_string())),
        }
    }

    /// Get raw amount as u128
    pub fn to_u128(&self) -> Result<u128, std::num::ParseIntError> {
        self.raw.parse()
    }

    /// Get human-readable representation
    pub fn to_human(&self) -> String {
        let raw: u128 = match self.raw.parse() {
            Ok(v) => v,
            Err(_) => return self.raw.clone(),
        };
        let base = 10u128.pow(self.decimals as u32);
        let whole = raw / base;
        let frac = raw % base;
        if frac == 0 {
            format!("{}.0", whole)
        } else {
            let frac_str = format!("{:0>width$}", frac, width = self.decimals as usize);
            let trimmed = frac_str.trim_end_matches('0');
            format!("{}.{}", whole, trimmed)
        }
    }

    /// Check if amount is zero
    pub fn is_zero(&self) -> bool {
        self.raw == "0" || self.raw.chars().all(|c| c == '0')
    }

    /// Check if amount is positive (> 0)
    pub fn is_positive(&self) -> bool {
        !self.is_zero()
            && self
                .raw
                .parse::<u128>()
                .map(|v| v > 0)
                .unwrap_or(false)
    }
}

impl fmt::Display for Amount {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.to_human())
    }
}

/// Errors from Amount parsing
#[derive(Debug, Clone, thiserror::Error)]
pub enum AmountParseError {
    #[error("Invalid amount format: {0}")]
    InvalidFormat(String),
    #[error("Amount overflow")]
    Overflow,
    #[error("Too many decimals: got {got}, max {max}")]
    TooManyDecimals { got: u8, max: u8 },
}

/// Identifies an asset that can be bridged between Canton and BSC.
///
/// Each bridgeable asset has a representation on both chains:
/// - Canton: a Daml template with specific contract key structure
/// - BSC: a BEP-20 token contract (either wrapped or native)
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Validate)]
pub struct AssetId {
    /// Internal unique identifier for this asset mapping
    pub id: String,
    /// Canton Daml template qualified name (e.g., "Bridge.Asset:Token")
    pub canton_template_id: String,
    /// BSC BEP-20 token contract address
    pub bsc_token_address: BscAddress,
    /// Human-readable symbol (e.g., "cUSD")
    pub symbol: String,
    /// Display name (e.g., "Canton USD")
    pub name: String,
    /// Decimal precision (must match on both chains)
    pub decimals: u8,
    /// Minimum transfer amount (in base units)
    pub min_transfer: Amount,
    /// Maximum transfer amount per transaction (in base units)
    pub max_transfer: Amount,
    /// Maximum daily volume (in base units), 0 = unlimited
    pub daily_limit: Amount,
    /// Whether this asset is currently enabled for bridging
    pub enabled: bool,
}

// ─────────────────────────────────────────────────────────────
// Fee Types
// ─────────────────────────────────────────────────────────────

/// Fee charged for a bridge transfer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgeFee {
    /// Fixed component of the fee (in transfer asset base units)
    pub fixed_fee: Amount,
    /// Proportional fee in basis points (1 bp = 0.01%)
    pub proportional_bps: u32,
    /// Estimated gas cost in BNB (for BSC operations)
    pub estimated_gas_bnb: String,
    /// Total fee in transfer asset base units
    pub total_fee: Amount,
    /// Net amount after fees (what recipient gets)
    pub net_amount: Amount,
}

// ─────────────────────────────────────────────────────────────
// Core Transfer Record
// ─────────────────────────────────────────────────────────────

/// The core transfer record that tracks a cross-chain transfer.
///
/// This is the central data structure of the bridge. Each field is
/// documented with when it gets populated during the transfer lifecycle.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgeTransfer {
    // ── Identification ──
    
