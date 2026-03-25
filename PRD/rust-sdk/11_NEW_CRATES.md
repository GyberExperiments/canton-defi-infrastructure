# 11 — New Crates: canton-defi, canton-matching, canton-oracle

## 1. canton-defi — Rust Bindings for DeFi DAML Templates

**Purpose:** Type-safe Rust wrappers for all 6 new DAML templates. Handles proto value construction, choice exercise, and response parsing.

### Cargo.toml
```toml
[package]
name = "canton-defi"
version = "1.0.0"
edition = "2021"

[dependencies]
canton-core = { path = "../canton-core" }
canton-ledger-api = { path = "../canton-ledger-api" }
serde = { workspace = true, features = ["derive"] }
serde_json = { workspace = true }
chrono = { workspace = true }
rust_decimal = { workspace = true }
tracing = { workspace = true }
```

### Module Structure
```
canton-defi/src/
├── lib.rs                  # Public exports
├── types.rs                # Shared DeFi types
├── matching_engine.rs      # MatchingEngine + Order bindings
├── liquidity_pool.rs       # LiquidityPool bindings
├── price_oracle.rs         # PriceOracle bindings
├── atomic_swap.rs          # AtomicSwap bindings
├── multi_party_settlement.rs # MultiPartySettlement bindings
├── compliance_gateway.rs   # ComplianceGateway bindings
├── otc_offer.rs            # Existing OtcOffer bindings (type-safe)
├── escrow.rs               # Existing Escrow bindings
├── collateral.rs           # Existing Collateral bindings
├── settlement.rs           # Existing Settlement bindings
└── proto_builders.rs       # Shared proto construction helpers
```

### Core Pattern (example: MatchingEngine)

```rust
// canton-defi/src/matching_engine.rs

use canton_core::{types::*, error::SdkError};
use canton_ledger_api::LedgerClient;
use rust_decimal::Decimal;
use serde::{Serialize, Deserialize};

/// Rust representation of MatchingEngine DAML template
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchingEngine {
    pub engine_id: String,
    pub operator: String,
    pub pair: String,
    pub base_asset: String,
    pub quote_asset: String,
    pub fee_rate_bps: i64,
    pub min_order_size: Decimal,
    pub max_order_size: Decimal,
    pub is_active: bool,
}

/// Rust representation of Order DAML template
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Order {
    pub order_id: String,
    pub operator: String,
    pub maker: String,
    pub side: Side,
    pub limit_price: Decimal,
    pub quantity: Decimal,
    pub filled_qty: Decimal,
    pub remaining_qty: Decimal,
    pub status: OrderStatus,
    pub min_fill_qty: Decimal,
    pub post_only: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Side { Buy, Sell }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OrderStatus { Open, PartialFill, FullyFilled, OrderCancelled, OrderExpired }

/// Fill result from ExecuteMatch
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FillResult {
    pub fill_id: String,
    pub maker_order_id: String,
    pub taker_order_id: String,
    pub fill_quantity: Decimal,
    pub fill_price: Decimal,
    pub maker_party: String,
    pub taker_party: String,
}

/// Type-safe client for MatchingEngine operations
pub struct MatchingEngineClient<'a> {
    ledger: &'a LedgerClient,
    package_id: String,
}

impl<'a> MatchingEngineClient<'a> {
    pub fn new(ledger: &'a LedgerClient, package_id: &str) -> Self {
        Self { ledger, package_id: package_id.to_string() }
    }

    /// Create a new matching engine
    pub async fn create_engine(&self, engine: &MatchingEngine) -> Result<ContractId, SdkError> {
        let fields = vec![
            ("engineId", DamlValue::Text(engine.engine_id.clone())),
            ("operator", DamlValue::Party(engine.operator.clone())),
            ("pair", DamlValue::Text(engine.pair.clone())),
            ("baseAsset", DamlValue::Text(engine.base_asset.clone())),
            ("quoteAsset", DamlValue::Text(engine.quote_asset.clone())),
            ("feeRateBps", DamlValue::Int64(engine.fee_rate_bps)),
            ("minOrderSize", DamlValue::Numeric(engine.min_order_size)),
            ("maxOrderSize", DamlValue::Numeric(engine.max_order_size)),
            ("isActive", DamlValue::Bool(engine.is_active)),
            // ... timestamps, auditors
        ];
        // Build and submit CreateCommand
        todo!("Implement with proto builders from canton-otc-api pattern")
    }

    /// Place an order into the matching engine
    pub async fn place_order(
        &self,
        engine_cid: &ContractId,
        maker: &str,
        order_id: &str,
        side: Side,
        limit_price: Decimal,
        quantity: Decimal,
    ) -> Result<ContractId, SdkError> {
        // Exercise PlaceOrder choice on MatchingEngine contract
        todo!()
    }

    /// Execute a match between two crossing orders
    pub async fn execute_match(
        &self,
        engine_cid: &ContractId,
        buy_order_cid: &ContractId,
        sell_order_cid: &ContractId,
        match_qty: Decimal,
    ) -> Result<FillResult, SdkError> {
        // Exercise ExecuteMatch choice
        todo!()
    }

    /// Cancel an order
    pub async fn cancel_order(
        &self,
        order_cid: &ContractId,
        canceller: &str,
    ) -> Result<(), SdkError> {
        // Exercise CancelOrder choice
        todo!()
    }

    /// Query all open orders for a given engine
    pub async fn get_orderbook(
        &self,
        engine_id: &str,
    ) -> Result<(Vec<Order>, Vec<Order>), SdkError> {
        // ACS query for Order templates, split into bids/asks
        todo!()
    }
}
```

### Same pattern for all templates:
- `LiquidityPoolClient` — add_liquidity, remove_liquidity, swap, get_pool_stats
- `PriceOracleClient` — submit_price, query_price, get_history
- `AtomicSwapClient` — initiate_swap, execute_swap, refund_swap
- `MultiPartySettlementClient` — add_obligation, execute_netting, cancel_batch
- `ComplianceGatewayClient` — register_attestation, check_compliance

---

## 2. canton-matching — Off-Chain Matching Engine

**Purpose:** High-performance off-chain order matching that syncs state with on-ledger MatchingEngine contracts. This handles the compute-intensive matching logic off-chain, then submits matched pairs to the ledger for atomic settlement.

### Architecture

```
                     ┌──────────────────┐
Trader A ──REST──→   │  canton-matching  │   ──gRPC──→  Canton Ledger
Trader B ──REST──→   │                  │               (MatchingEngine.daml)
Trader C ──WS───→    │  In-memory book  │
                     │  Price-time sort │
                     │  Match detection │
                     └────────┬─────────┘
                              │
                     ┌────────┴─────────┐
                     │ Matched pairs    │
                     │ submitted to     │
                     │ ledger as        │
                     │ ExecuteMatch     │
                     └──────────────────┘
```

### Key Types

```rust
// canton-matching/src/lib.rs

pub mod orderbook;
pub mod engine;
pub mod sync;

/// In-memory order book with price-time priority
pub struct OrderBook {
    pair: String,
    bids: BTreeMap<OrderPriority, Vec<OrderEntry>>,  // Sorted descending by price
    asks: BTreeMap<OrderPriority, Vec<OrderEntry>>,  // Sorted ascending by price
}

impl OrderBook {
    pub fn new(pair: &str) -> Self;
    pub fn add_order(&mut self, order: OrderEntry) -> Vec<Match>;
    pub fn cancel_order(&mut self, order_id: &str) -> Option<OrderEntry>;
    pub fn best_bid(&self) -> Option<Decimal>;
    pub fn best_ask(&self) -> Option<Decimal>;
    pub fn spread(&self) -> Option<Decimal>;
    pub fn depth(&self, levels: usize) -> (Vec<PriceLevel>, Vec<PriceLevel>);
    pub fn mid_price(&self) -> Option<Decimal>;
}

/// Match result to submit to ledger
pub struct Match {
    pub buy_order_id: String,
    pub sell_order_id: String,
    pub quantity: Decimal,
    pub price: Decimal,
}

/// Sync with Canton ledger (ACS query → rebuild book)
pub struct LedgerSync {
    client: LedgerClient,
    book: Arc<RwLock<OrderBook>>,
    last_offset: Option<LedgerOffset>,
}

impl LedgerSync {
    /// Rebuild order book from ACS (cold start)
    pub async fn rebuild_from_acs(&self) -> Result<(), SdkError>;

    /// Subscribe to transaction stream and apply updates
    pub async fn start_streaming(&self) -> Result<(), SdkError>;
}
```

---

## 3. canton-oracle — Price Feed Aggregator

**Purpose:** Collects prices from multiple sources (REST APIs, WebSocket feeds, manual input), aggregates them, and publishes to PriceOracle DAML contract.

```rust
// canton-oracle/src/lib.rs

pub mod sources;
pub mod aggregator;
pub mod publisher;

/// Price source trait — implement for each data provider
#[async_trait]
pub trait PriceSource: Send + Sync {
    fn name(&self) -> &str;
    fn asset(&self) -> &str;
    async fn fetch_price(&self) -> Result<PricePoint, SdkError>;
}

/// Built-in sources
pub mod sources {
    pub struct ManualSource { /* admin-set prices */ }
    pub struct RestApiSource { /* HTTP polling */ }
    pub struct WebSocketSource { /* streaming price feed */ }
}

/// Aggregates multiple sources into a single price
pub struct PriceAggregator {
    sources: Vec<Box<dyn PriceSource>>,
    strategy: AggregationStrategy,
}

pub enum AggregationStrategy {
    Median,               // Use median price (most robust)
    WeightedMean,         // Weight by confidence score
    VWAP,                 // Volume-weighted average price
}

impl PriceAggregator {
    pub fn new(strategy: AggregationStrategy) -> Self;
    pub fn add_source(&mut self, source: Box<dyn PriceSource>);
    pub async fn aggregate(&self) -> Result<AggregatedPrice, SdkError>;
}

/// Publishes aggregated price to PriceOracle DAML contract
pub struct OraclePublisher {
    client: LedgerClient,
    oracle_cid: ContractId,
    aggregator: PriceAggregator,
    interval: Duration,         // Publish interval (e.g. 60s)
}

impl OraclePublisher {
    pub async fn start(&self) -> Result<(), SdkError> {
        loop {
            let price = self.aggregator.aggregate().await?;
            // Exercise SubmitPrice choice on PriceOracle contract
            self.publish(price).await?;
            tokio::time::sleep(self.interval).await;
        }
    }
}
```

---

## Crate Dependency Graph (After Completion)

```
canton-cli
  └── canton-sdk
        ├── canton-core
        ├── canton-ledger-api
        │     └── canton-core
        ├── canton-defi
        │     ├── canton-core
        │     └── canton-ledger-api
        ├── canton-matching
        │     ├── canton-core
        │     ├── canton-ledger-api
        │     └── canton-defi
        ├── canton-oracle
        │     ├── canton-core
        │     ├── canton-ledger-api
        │     └── canton-defi
        ├── canton-reliability
        │     └── canton-core
        ├── canton-observability
        │     └── canton-core
        └── canton-crypto
              └── canton-core
```
