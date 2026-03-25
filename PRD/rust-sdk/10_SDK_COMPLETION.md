# 10 — SDK Completion: canton-sdk Facade + Reliability + Observability

## Goal

Transform the existing 14-crate workspace into a **publishable Rust SDK** that any developer can `cargo add canton-sdk` and immediately interact with Canton Network.

---

## 1. canton-sdk — Facade Crate

**Purpose:** Single entry point. Re-exports core types, provides high-level `Client` and `DeFiClient`.

### Cargo.toml
```toml
[package]
name = "canton-sdk"
version = "1.0.0"
edition = "2021"
rust-version = "1.77"
license = "Apache-2.0"
description = "Rust SDK for Canton Network — DeFi primitives, Ledger API v2, DAML contract interaction"
repository = "https://github.com/gybernaty/canton-sdk"
documentation = "https://docs.rs/canton-sdk"
keywords = ["canton", "daml", "defi", "blockchain", "grpc"]
categories = ["api-bindings", "cryptography::cryptocurrencies"]

[features]
default = ["defi", "reliability"]
defi = ["canton-defi"]
matching = ["canton-matching"]
oracle = ["canton-oracle"]
reliability = ["canton-reliability"]
observability = ["canton-observability"]
full = ["defi", "matching", "oracle", "reliability", "observability"]

[dependencies]
canton-core = { path = "../canton-core", version = "1.0" }
canton-ledger-api = { path = "../canton-ledger-api", version = "1.0" }
canton-defi = { path = "../canton-defi", version = "1.0", optional = true }
canton-matching = { path = "../canton-matching", version = "1.0", optional = true }
canton-oracle = { path = "../canton-oracle", version = "1.0", optional = true }
canton-reliability = { path = "../canton-reliability", version = "1.0", optional = true }
canton-observability = { path = "../canton-observability", version = "1.0", optional = true }
canton-crypto = { path = "../canton-crypto", version = "1.0" }
tokio = { workspace = true }
tracing = { workspace = true }
```

### Public API Surface

```rust
// canton-sdk/src/lib.rs

/// Re-export core types
pub use canton_core::{
    error::SdkError,
    types::{DamlValue, Identifier, ContractId, Command, LedgerOffset},
    config::CantonConfig,
};

/// Re-export ledger client
pub use canton_ledger_api::LedgerClient;

/// DeFi primitives (feature-gated)
#[cfg(feature = "defi")]
pub use canton_defi;

#[cfg(feature = "matching")]
pub use canton_matching;

#[cfg(feature = "oracle")]
pub use canton_oracle;

pub mod client;
pub mod builder;

/// High-level Canton client with connection management
pub struct CantonClient {
    config: CantonConfig,
    ledger: LedgerClient,
    #[cfg(feature = "reliability")]
    circuit_breaker: canton_reliability::CircuitBreaker,
}

impl CantonClient {
    /// Connect to a Canton participant node
    pub async fn connect(config: CantonConfig) -> Result<Self, SdkError>;

    /// Connect with automatic retry and circuit breaker
    pub async fn connect_resilient(config: CantonConfig) -> Result<Self, SdkError>;

    /// Get the underlying ledger client for advanced usage
    pub fn ledger(&self) -> &LedgerClient;

    /// Create a DAML contract
    pub async fn create_contract(
        &self,
        template: Identifier,
        arguments: Vec<(String, DamlValue)>,
    ) -> Result<ContractId, SdkError>;

    /// Exercise a choice on a contract
    pub async fn exercise_choice(
        &self,
        template: Identifier,
        contract_id: ContractId,
        choice: &str,
        argument: Vec<(String, DamlValue)>,
    ) -> Result<DamlValue, SdkError>;

    /// Query active contracts
    pub async fn query_contracts(
        &self,
        template: Identifier,
    ) -> Result<Vec<(ContractId, DamlValue)>, SdkError>;

    /// Get the current ledger end offset
    pub async fn ledger_end(&self) -> Result<LedgerOffset, SdkError>;

    /// Check connection health
    pub async fn health(&self) -> Result<bool, SdkError>;
}
```

### Builder Pattern for Commands

```rust
// canton-sdk/src/builder.rs

/// Fluent builder for DAML commands
pub struct CommandBuilder {
    application_id: String,
    act_as: Vec<String>,
    commands: Vec<Command>,
}

impl CommandBuilder {
    pub fn new(application_id: &str) -> Self;
    pub fn act_as(self, party: &str) -> Self;
    pub fn read_as(self, party: &str) -> Self;

    /// Add a CreateCommand
    pub fn create(self, template: &str, module: &str, fields: Vec<(&str, DamlValue)>) -> Self;

    /// Add an ExerciseCommand
    pub fn exercise(
        self,
        template: &str,
        module: &str,
        contract_id: &str,
        choice: &str,
        args: Vec<(&str, DamlValue)>,
    ) -> Self;

    /// Submit and wait for transaction
    pub async fn submit(self, client: &CantonClient) -> Result<TransactionResult, SdkError>;
}

// Usage example:
// let result = CommandBuilder::new("my-app")
//     .act_as("alice")
//     .create("OtcOffer", "OtcOffer", vec![
//         ("offerId", DamlValue::Text("offer-1".into())),
//         ("operator", DamlValue::Party("operator".into())),
//         ...
//     ])
//     .submit(&client)
//     .await?;
```

---

## 2. canton-reliability — Completion

**Current state:** 5 LOC stub with TODO comments
**Target:** Production-grade resilience patterns

### CircuitBreaker

```rust
// canton-reliability/src/circuit_breaker.rs

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CircuitState {
    Closed,     // Normal operation
    Open,       // Failing, reject immediately
    HalfOpen,   // Testing if service recovered
}

pub struct CircuitBreaker {
    state: Arc<RwLock<CircuitState>>,
    failure_count: AtomicU64,
    success_count: AtomicU64,
    failure_threshold: u64,       // Failures before opening (default: 5)
    success_threshold: u64,       // Successes in half-open to close (default: 3)
    timeout: Duration,            // How long to stay open (default: 30s)
    last_failure: Arc<RwLock<Option<Instant>>>,
}

impl CircuitBreaker {
    pub fn new(failure_threshold: u64, success_threshold: u64, timeout: Duration) -> Self;

    /// Execute a function through the circuit breaker
    pub async fn call<F, T, E>(&self, f: F) -> Result<T, SdkError>
    where
        F: Future<Output = Result<T, E>>,
        E: Into<SdkError>;

    pub async fn state(&self) -> CircuitState;
    pub fn failure_count(&self) -> u64;
    pub async fn reset(&self);
}
```

### RetryPolicy

```rust
// canton-reliability/src/retry.rs

use backon::{ExponentialBuilder, Retryable};

pub struct RetryPolicy {
    max_retries: usize,          // Default: 3
    initial_delay: Duration,     // Default: 100ms
    max_delay: Duration,         // Default: 10s
    jitter: bool,                // Default: true
}

impl RetryPolicy {
    pub fn default() -> Self;
    pub fn aggressive() -> Self;  // 5 retries, 50ms start
    pub fn conservative() -> Self; // 2 retries, 1s start

    /// Execute with retry
    pub async fn execute<F, Fut, T>(&self, f: F) -> Result<T, SdkError>
    where
        F: Fn() -> Fut,
        Fut: Future<Output = Result<T, SdkError>>;
}
```

### RateLimiter

```rust
// canton-reliability/src/rate_limiter.rs

use governor::{Quota, RateLimiter as GovernorLimiter, state::keyed::DefaultKeyedStateStore};
use std::num::NonZeroU32;

pub struct RateLimiter {
    limiter: GovernorLimiter<String, DefaultKeyedStateStore<String>, ...>,
}

impl RateLimiter {
    /// Create with N requests per second
    pub fn per_second(n: u32) -> Self;

    /// Create with N requests per minute
    pub fn per_minute(n: u32) -> Self;

    /// Check if request is allowed for a given key (e.g. party ID)
    pub fn check(&self, key: &str) -> Result<(), SdkError>;

    /// Wait until request is allowed
    pub async fn wait(&self, key: &str);
}
```

---

## 3. canton-observability — Completion

### OpenTelemetry Integration

```rust
// canton-observability/src/lib.rs

use opentelemetry::trace::TracerProvider;
use opentelemetry_otlp::WithExportConfig;
use tracing_subscriber::layer::SubscriberExt;

pub struct ObservabilityConfig {
    pub service_name: String,
    pub otlp_endpoint: Option<String>,   // e.g. "http://localhost:4317"
    pub log_level: String,               // e.g. "info"
    pub metrics_port: Option<u16>,       // Prometheus scrape port
}

/// Initialize tracing + metrics + OTLP export
pub fn init(config: &ObservabilityConfig) -> Result<(), SdkError>;

/// Prometheus metrics registry
pub mod metrics {
    use prometheus_client::metrics::{counter::Counter, histogram::Histogram, gauge::Gauge};

    pub struct SdkMetrics {
        pub commands_submitted: Counter,
        pub commands_failed: Counter,
        pub command_latency: Histogram,
        pub active_connections: Gauge,
        pub circuit_breaker_state: Gauge,  // 0=closed, 1=open, 2=half-open
        pub acs_query_latency: Histogram,
        pub contracts_created: Counter,
        pub choices_exercised: Counter,
    }

    impl SdkMetrics {
        pub fn new() -> Self;
        pub fn register(registry: &mut Registry);
    }
}
```

---

## 4. canton-cli — Developer CLI Tool

```
canton-cli 1.0.0
Rust CLI for Canton Network interaction

USAGE:
    canton-cli [OPTIONS] <COMMAND>

COMMANDS:
    connect     Test connection to Canton participant
    parties     Manage parties (list, allocate)
    contracts   Query and manage contracts
    offer       OTC offer operations
    pool        Liquidity pool operations
    oracle      Price oracle operations
    match       Matching engine operations
    health      Check system health
    config      Show/set configuration

OPTIONS:
    --host <HOST>       Canton participant host [default: localhost]
    --port <PORT>       Ledger API port [default: 5011]
    --token <TOKEN>     Auth token [env: CANTON_AUTH_TOKEN]
    --party <PARTY>     Acting party [env: CANTON_PARTY_ID]
    --package <PKG>     DAML package ID [env: OTC_PACKAGE_ID]
    --json              Output as JSON
    -v, --verbose       Verbose output
```

### Implementation

```rust
// canton-cli/src/main.rs
use clap::{Parser, Subcommand};
use canton_sdk::CantonClient;

#[derive(Parser)]
#[command(name = "canton-cli", version, about)]
struct Cli {
    #[arg(long, default_value = "localhost")]
    host: String,
    #[arg(long, default_value_t = 5011)]
    port: u16,
    #[arg(long, env = "CANTON_AUTH_TOKEN")]
    token: Option<String>,
    #[arg(long, env = "CANTON_PARTY_ID")]
    party: Option<String>,
    #[arg(long)]
    json: bool,
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    Connect,
    Parties { #[command(subcommand)] cmd: PartiesCmd },
    Contracts { #[command(subcommand)] cmd: ContractsCmd },
    Offer { #[command(subcommand)] cmd: OfferCmd },
    Pool { #[command(subcommand)] cmd: PoolCmd },
    Oracle { #[command(subcommand)] cmd: OracleCmd },
    Health,
}
```
