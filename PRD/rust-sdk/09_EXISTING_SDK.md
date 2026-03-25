# 09 — Existing Rust SDK Architecture

## Workspace Layout (14 crates)

```
cantonnet-omnichain-sdk/
├── Cargo.toml              # Workspace root, resolver 2, edition 2021
├── crates/
│   ├── canton-otc-api/     # ★ REST API server (PRODUCTION) — 2,058 LOC
│   ├── canton-ledger-api/  # ★ gRPC Ledger API v2 client — 265 LOC
│   ├── canton-core/        # ★ Core types & errors — 800 LOC
│   ├── canton-wallet/      # ★ Multi-chain key derivation — 415 LOC
│   ├── canton-crypto/      #   Key type stubs — 80 LOC
│   ├── canton-transport/   #   gRPC abstraction — 27 LOC
│   ├── canton-observability/# Logging stub — 27 LOC
│   ├── canton-reliability/ #   CircuitBreaker stub — 5 LOC
│   ├── bridge-core/        # ★ Bridge domain types — 630 LOC
│   ├── bridge-db/          # ★ PostgreSQL repository — 500 LOC
│   ├── bridge-orchestrator/# Bridge engine (scaffolded) — 800 LOC
│   ├── bridge-api/         #   Bridge REST stubs — 80 LOC
│   └── bsc-client/         #   BSC integration (partial) — 450 LOC
├── contracts/daml/         # DAML bridge contracts (empty)
├── proto/                  # Shared proto definitions
└── research/               # 10 architecture research docs (~8,000 LOC)
```

★ = Production-ready code

## Canton-OTC-API — The Production Crate

### Architecture
```
main.rs
  ├── Load AppConfig from env
  ├── Validate config
  ├── Try initial Canton connection (non-fatal)
  ├── Spawn reconnect_loop (background, 15s interval)
  └── Bind Axum HTTP server

routes.rs → 15 endpoints (see 02_CURRENT_STATE.md)

handlers.rs (1,884 LOC — largest file)
  ├── Proto value builders (15 functions)
  │   proto_text, proto_party, proto_numeric, proto_int64,
  │   proto_timestamp, proto_bool, proto_unit, proto_field,
  │   proto_record, proto_variant, proto_optional_none,
  │   proto_optional_some, proto_list, proto_text_list,
  │   proto_party_list
  │
  ├── Health endpoint (ledger_end, connection status, mode)
  │
  ├── Create Offer (builds 17-field DAML Record)
  │   └── Nested builders: build_asset_record, build_price_record,
  │       build_limits_record, build_side_variant, build_timestamps_record,
  │       build_status_variant
  │
  ├── Accept Offer (5-field exercise argument)
  ├── Cancel Offer (3-field exercise argument)
  ├── List/Get Contracts (in-memory store with filtering)
  ├── Active Contracts (ACS query with ledger fallback)
  ├── Settlement handlers (ConfirmPayment, CompleteSettlement)
  ├── Escrow handlers (Create 20-field, Deposit, Release)
  └── 33 unit tests

state.rs
  └── AppState: Arc<RwLock<Option<LedgerClient>>> + stores + config
      └── create_command_client() → tonic CommandServiceClient with auth
      └── create_state_client() → tonic StateServiceClient with auth

models.rs
  └── OtcContract, SettlementContract, EscrowContract
  └── ContractStore, SettlementStore, EscrowStore (Arc<RwLock<HashMap>>)
```

### How DAML Commands Are Built (actual code pattern)

```rust
// Building a DAML CreateCommand for OtcOffer template
let create_cmd = Command {
    command: Some(command::Command::Create(CreateCommand {
        template_id: Some(Identifier {
            package_id: config.otc_package_id.clone(),
            module_name: "OtcOffer".to_string(),
            entity_name: "OtcOffer".to_string(),
        }),
        create_arguments: Some(Record {
            record_id: None,
            fields: vec![
                proto_field("offerId", proto_text(&req.order_id)),
                proto_field("operator", proto_party(&config.party_id)),
                proto_field("initiator", proto_party(&req.initiator)),
                proto_field("counterparty", proto_optional_none()),
                proto_field("asset", build_asset_record(&req.asset)),
                proto_field("price", build_price_record(&req.price)),
                proto_field("quantity", proto_numeric(&req.quantity)),
                proto_field("side", build_side_variant(&req.side)),
                proto_field("limits", build_limits_record(&req.limits)),
                proto_field("status", build_status_variant("Active")),
                proto_field("timestamps", build_timestamps_record(now)),
                proto_field("collateral", proto_optional_none()),
                proto_field("settlementInfo", proto_optional_none()),
                proto_field("minComplianceLevel", proto_text(&req.min_compliance_level)),
                proto_field("allowedJurisdictions", proto_text_list(&req.allowed_jurisdictions)),
                proto_field("auditors", proto_party_list(&[])),
            ],
        }),
    })),
};
```

### How Exercises Are Built

```rust
// Exercising Accept choice on OtcOffer
let exercise_cmd = Command {
    command: Some(command::Command::Exercise(ExerciseCommand {
        template_id: Some(Identifier {
            package_id: config.otc_package_id.clone(),
            module_name: "OtcOffer".to_string(),
            entity_name: "OtcOffer".to_string(),
        }),
        contract_id: req.contract_id.clone(),
        choice: "Accept".to_string(),
        choice_argument: Some(Value {
            sum: Some(value::Sum::Record(Record {
                record_id: None,
                fields: vec![
                    proto_field("acceptor", proto_party(&req.acceptor)),
                    proto_field("requestedQuantity", proto_numeric(&req.requested_quantity)),
                    proto_field("complianceOk", proto_bool(req.compliance_ok)),
                    proto_field("currentTime", proto_timestamp(now)),
                    proto_field("paymentProof", proto_text(&req.payment_proof)),
                ],
            })),
        }),
    })),
};
```

## Canton-Ledger-API — gRPC Client

```rust
pub struct LedgerClient {
    channel: Channel,
    state_client: StateServiceClient<InterceptedService<Channel, AuthInterceptor>>,
    command_client: CommandSubmissionServiceClient<InterceptedService<Channel, AuthInterceptor>>,
}

impl LedgerClient {
    pub async fn connect(endpoint: &str) -> Result<Self, SdkError>;
    pub async fn connect_with_auth(endpoint: &str, token: &str) -> Result<Self, SdkError>;
    pub async fn get_ledger_end(&mut self) -> Result<LedgerOffset, SdkError>;
    pub async fn get_active_contracts(&mut self, filter: TransactionFilter)
        -> Result<Vec<CreatedEvent>, SdkError>;
    pub async fn submit(&mut self, commands: Commands) -> Result<(), SdkError>;
}

struct AuthInterceptor { token: String }
// Adds "Authorization: Bearer {token}" to gRPC metadata
```

## Proto Files — Complete Ledger API v2

```
crates/canton-ledger-api/proto/com/daml/ledger/api/v2/
├── command_service.proto
├── command_submission_service.proto
├── command_completion_service.proto
├── state_service.proto
├── update_service.proto
├── transaction.proto
├── event.proto
├── value.proto
├── commands.proto
├── package_service.proto
├── version_service.proto
└── admin/
    └── party_management_service.proto

google/
├── protobuf/ (timestamp, duration, any, empty, field_mask, wrappers)
└── rpc/status.proto
```
