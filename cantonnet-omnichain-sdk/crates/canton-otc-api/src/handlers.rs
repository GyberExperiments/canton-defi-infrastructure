use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use canton_core::types::OffsetValue;
use canton_ledger_api::generated::com::daml::ledger::api::v2 as proto;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::config::AppConfig;
use crate::error::ApiError;
use crate::models::{ContractStatus, OtcContract};
use crate::proto_builders;
use crate::state::AppState;

// ─── Proto value helpers ───

fn proto_text(s: impl Into<String>) -> Option<proto::Value> {
    Some(proto::Value {
        sum: Some(proto::value::Sum::Text(s.into())),
    })
}

fn proto_party(s: impl Into<String>) -> Option<proto::Value> {
    Some(proto::Value {
        sum: Some(proto::value::Sum::Party(s.into())),
    })
}

fn proto_numeric(v: &str) -> Option<proto::Value> {
    Some(proto::Value {
        sum: Some(proto::value::Sum::Numeric(v.to_string())),
    })
}

fn proto_int64(v: i64) -> Option<proto::Value> {
    Some(proto::Value {
        sum: Some(proto::value::Sum::Int64(v)),
    })
}

fn proto_timestamp(micros: i64) -> Option<proto::Value> {
    Some(proto::Value {
        sum: Some(proto::value::Sum::Timestamp(micros)),
    })
}

fn proto_timestamp_now() -> Option<proto::Value> {
    proto_timestamp(Utc::now().timestamp_micros())
}

fn proto_bool(v: bool) -> Option<proto::Value> {
    Some(proto::Value {
        sum: Some(proto::value::Sum::Bool(v)),
    })
}

fn proto_unit() -> Option<proto::Value> {
    Some(proto::Value {
        sum: Some(proto::value::Sum::Unit(())),
    })
}

fn proto_field(label: &str, value: Option<proto::Value>) -> proto::RecordField {
    proto::RecordField {
        label: label.into(),
        value,
    }
}

/// Build a DAML Record value (nested struct)
fn proto_record(fields: Vec<proto::RecordField>) -> Option<proto::Value> {
    Some(proto::Value {
        sum: Some(proto::value::Sum::Record(proto::Record {
            record_id: None,
            fields,
        })),
    })
}

/// Build a DAML Optional value
fn proto_optional_none() -> Option<proto::Value> {
    Some(proto::Value {
        sum: Some(proto::value::Sum::Optional(Box::new(proto::Optional {
            value: None,
        }))),
    })
}

fn proto_optional_some(inner: Option<proto::Value>) -> Option<proto::Value> {
    Some(proto::Value {
        sum: Some(proto::value::Sum::Optional(Box::new(proto::Optional {
            value: inner.map(Box::new),
        }))),
    })
}

/// Build a DAML List value
fn proto_list(elements: Vec<proto::Value>) -> Option<proto::Value> {
    Some(proto::Value {
        sum: Some(proto::value::Sum::List(proto::List { elements })),
    })
}

fn proto_text_list(items: &[String]) -> Option<proto::Value> {
    let elements: Vec<proto::Value> = items
        .iter()
        .map(|s| proto::Value {
            sum: Some(proto::value::Sum::Text(s.clone())),
        })
        .collect();
    proto_list(elements)
}

fn proto_party_list(items: &[String]) -> Option<proto::Value> {
    let elements: Vec<proto::Value> = items
        .iter()
        .map(|s| proto::Value {
            sum: Some(proto::value::Sum::Party(s.clone())),
        })
        .collect();
    proto_list(elements)
}

// ─── Health ───

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub connected: bool,
    pub participant: String,
    pub mode: String,
    pub ledger_end: Option<String>,
    pub application_id: String,
    pub version: String,
    pub party_id: String,
    pub timestamp: String,
}

pub async fn health(State(state): State<AppState>) -> Json<HealthResponse> {
    let connected = state.is_connected().await;
    let mut ledger_end = None;

    if let Some(mut client) = state.get_ledger_client().await {
        match client.get_ledger_end().await {
            Ok(offset) => {
                if let OffsetValue::Absolute(s) = offset.value {
                    ledger_end = Some(s);
                }
            }
            Err(e) => {
                warn!("get_ledger_end failed, marking disconnected: {}", e);
                state.clear_ledger_client().await;
            }
        }
    }

    Json(HealthResponse {
        status: if connected { "healthy" } else { "degraded" }.into(),
        connected,
        participant: state.config.canton_endpoint(),
        mode: if connected {
            "daml-ledger-api-v2"
        } else {
            "disconnected"
        }
        .into(),
        ledger_end,
        application_id: state.config.application_id.clone(),
        version: env!("CARGO_PKG_VERSION").into(),
        party_id: state.config.party_id.clone(),
        timestamp: Utc::now().to_rfc3339(),
    })
}

// ─── Create Offer ───
// Matches DAML OtcOffer template with all 17 fields:
//   offerId, operator, initiator, counterparty, asset, price, quantity,
//   side, limits, status, timestamps, collateral, settlementInfo,
//   minComplianceLevel, allowedJurisdictions, auditors

#[derive(Deserialize)]
pub struct CreateOfferAsset {
    pub symbol: String,
    pub amount: String,
    pub chain: String,
    #[serde(default)]
    pub contract_address: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateOfferPrice {
    pub rate: String,
    pub currency: String,
}

#[derive(Deserialize)]
pub struct CreateOfferLimits {
    pub min_amount: String,
    pub max_amount: String,
}

#[derive(Deserialize)]
pub struct CreateOfferRequest {
    pub order_id: String,
    pub initiator: String,
    #[serde(default)]
    pub counterparty: Option<String>,
    pub asset: CreateOfferAsset,
    pub price: CreateOfferPrice,
    pub quantity: String,
    #[serde(default = "default_side")]
    pub side: String,
    pub limits: CreateOfferLimits,
    #[serde(default = "default_compliance")]
    pub min_compliance_level: String,
    #[serde(default)]
    pub allowed_jurisdictions: Vec<String>,
    #[serde(default)]
    pub auditors: Vec<String>,
    #[serde(default)]
    pub expires_at: Option<String>,
}

fn default_side() -> String {
    "Buy".into()
}

fn default_compliance() -> String {
    "RETAIL".into()
}

#[derive(Serialize)]
pub struct CreateOfferResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contract_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transaction_id: Option<String>,
    pub order_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Build proto Record for DAML Asset type
fn build_asset_record(asset: &CreateOfferAsset) -> Option<proto::Value> {
    let mut fields = vec![
        proto_field("symbol", proto_text(&asset.symbol)),
        proto_field("amount", proto_numeric(&asset.amount)),
        proto_field("chain", proto_text(&asset.chain)),
    ];

    // contractAddress : Optional Text
    fields.push(proto_field(
        "contractAddress",
        match &asset.contract_address {
            Some(addr) => proto_optional_some(proto_text(addr)),
            None => proto_optional_none(),
        },
    ));

    proto_record(fields)
}

/// Build proto Record for DAML Price type
fn build_price_record(price: &CreateOfferPrice) -> Option<proto::Value> {
    proto_record(vec![
        proto_field("rate", proto_numeric(&price.rate)),
        proto_field("currency", proto_text(&price.currency)),
    ])
}

/// Build proto Record for DAML VolumeLimits type
fn build_limits_record(limits: &CreateOfferLimits) -> Option<proto::Value> {
    proto_record(vec![
        proto_field("minAmount", proto_numeric(&limits.min_amount)),
        proto_field("maxAmount", proto_numeric(&limits.max_amount)),
    ])
}

/// Build a DAML Enum value (for DAML SDK 3.x enum types without fields).
fn proto_enum(constructor: &str) -> Option<proto::Value> {
    Some(proto::Value {
        sum: Some(proto::value::Sum::Enum(proto::Enum {
            enum_id: None,
            constructor: constructor.into(),
        })),
    })
}

/// Build proto Enum for DAML OtcSide (Buy | Sell)
fn build_side_variant(side: &str) -> Option<proto::Value> {
    let constructor = match side.to_lowercase().as_str() {
        "sell" => "Sell",
        _ => "Buy",
    };
    proto_enum(constructor)
}

/// Build proto Enum for DAML OtcStatus
fn build_status_variant(status: &str) -> Option<proto::Value> {
    proto_enum(status)
}

/// Build proto Record for DAML Timestamps type
fn build_timestamps_record(expires_at: &Option<String>) -> Option<proto::Value> {
    let now_micros = Utc::now().timestamp_micros();

    let mut fields = vec![
        proto_field("created", proto_timestamp(now_micros)),
        proto_field("updated", proto_timestamp(now_micros)),
    ];

    // expiresAt : Optional Time
    fields.push(proto_field(
        "expiresAt",
        match expires_at {
            Some(ts) => {
                // Parse ISO8601 to micros
                let micros = chrono::DateTime::parse_from_rfc3339(ts)
                    .map(|dt| dt.timestamp_micros())
                    .unwrap_or(now_micros + 86_400_000_000 * 7); // default 7 days
                proto_optional_some(proto_timestamp(micros))
            }
            None => proto_optional_none(),
        },
    ));

    proto_record(fields)
}

fn build_create_offer_commands(config: &AppConfig, req: &CreateOfferRequest) -> proto::Commands {
    let template_id = proto::Identifier {
        package_id: config.otc_package_id.clone(),
        module_name: "OtcOffer".into(),
        entity_name: "OtcOffer".into(),
    };

    // Build all 17 fields matching DAML OtcOffer template
    let record = proto::Record {
        record_id: Some(template_id.clone()),
        fields: vec![
            // === Identification ===
            proto_field("offerId", proto_text(&req.order_id)),
            // === Parties ===
            proto_field("operator", proto_party(&config.party_id)),
            proto_field("initiator", proto_party(&req.initiator)),
            proto_field(
                "counterparty",
                match &req.counterparty {
                    Some(cp) => proto_optional_some(proto_party(cp)),
                    None => proto_optional_none(),
                },
            ),
            // === Asset Details ===
            proto_field("asset", build_asset_record(&req.asset)),
            proto_field("price", build_price_record(&req.price)),
            proto_field("quantity", proto_numeric(&req.quantity)),
            // === Trading Terms ===
            proto_field("side", build_side_variant(&req.side)),
            proto_field("limits", build_limits_record(&req.limits)),
            // === Status & Timing ===
            proto_field("status", build_status_variant("Active")),
            proto_field("timestamps", build_timestamps_record(&req.expires_at)),
            // === Settlement ===
            proto_field("collateral", proto_optional_none()),
            proto_field("settlementInfo", proto_optional_none()),
            // === Compliance ===
            proto_field("minComplianceLevel", proto_text(&req.min_compliance_level)),
            proto_field(
                "allowedJurisdictions",
                proto_text_list(&req.allowed_jurisdictions),
            ),
            // === Observers ===
            proto_field("auditors", proto_party_list(&req.auditors)),
        ],
    };

    let create_cmd = proto::Command {
        command: Some(proto::command::Command::Create(proto::CreateCommand {
            template_id: Some(template_id),
            create_arguments: Some(record),
        })),
    };

    proto::Commands {
        workflow_id: format!("otc-{}", req.order_id),
        // Ledger API v2: user_id is the admin user with actAs rights
        user_id: "ledger-api-user".into(),
        command_id: Uuid::new_v4().to_string(),
        act_as: config.act_as_parties(),
        read_as: vec![],
        commands: vec![create_cmd],
        synchronizer_id: config.synchronizer_id.clone(),
        ..Default::default()
    }
}

pub async fn create_offer(
    State(state): State<AppState>,
    Json(req): Json<CreateOfferRequest>,
) -> Result<Json<CreateOfferResponse>, (StatusCode, Json<ApiError>)> {
    // Validate required fields
    if req.order_id.is_empty() || req.initiator.is_empty() || req.asset.symbol.is_empty() {
        return Err(ApiError::bad_request(
            "Missing required fields: order_id, initiator, asset.symbol",
        ));
    }

    // Validate numeric fields (parse as string to preserve DAML Decimal precision)
    let quantity: rust_decimal::Decimal = req
        .quantity
        .parse()
        .map_err(|_| ApiError::bad_request("quantity must be a valid decimal number"))?;
    let price_rate: rust_decimal::Decimal = req
        .price
        .rate
        .parse()
        .map_err(|_| ApiError::bad_request("price.rate must be a valid decimal number"))?;

    if quantity <= rust_decimal::Decimal::ZERO || price_rate <= rust_decimal::Decimal::ZERO {
        return Err(ApiError::bad_request(
            "quantity and price.rate must be positive",
        ));
    }

    let mut command_client = state
        .create_command_client()
        .await
        .map_err(|e| ApiError::unavailable(format!("Failed to create command client: {}", e)))?;

    let commands = build_create_offer_commands(&state.config, &req);
    let now = Utc::now();

    info!(
        order_id = %req.order_id,
        initiator = %req.initiator,
        asset_symbol = %req.asset.symbol,
        quantity = %req.quantity,
        price_rate = %req.price.rate,
        side = %req.side,
        "Creating OtcOffer contract"
    );

    let request = proto::SubmitAndWaitRequest {
        commands: Some(commands),
    };

    let response = command_client
        .submit_and_wait_for_transaction(proto::SubmitAndWaitForTransactionRequest {
            commands: request.commands,
            transaction_format: None,
        })
        .await
        .map_err(|e| {
            error!("DAML submission failed: {}", e);
            ApiError::unavailable(format!("DAML submission failed: {}", e.message()))
        })?;

    let inner = response.into_inner();
    let transaction_id = inner
        .transaction
        .as_ref()
        .map(|t| t.update_id.clone())
        .unwrap_or_default();

    let contract_id = inner
        .transaction
        .as_ref()
        .and_then(|t| {
            t.events.iter().find_map(|event| {
                if let Some(proto::event::Event::Created(created)) = &event.event {
                    Some(created.contract_id.clone())
                } else {
                    None
                }
            })
        })
        .unwrap_or_else(|| format!("pending:{}", req.order_id));

    info!(
        order_id = %req.order_id,
        contract_id = %contract_id,
        transaction_id = %transaction_id,
        "DAML OtcOffer contract created"
    );

    // Store in memory
    let contract = OtcContract {
        contract_id: contract_id.clone(),
        transaction_id: transaction_id.clone(),
        offer_id: req.order_id.clone(),
        operator: state.config.party_id.clone(),
        initiator: req.initiator.clone(),
        counterparty: req.counterparty.clone(),
        asset: crate::models::Asset {
            symbol: req.asset.symbol.clone(),
            amount: req.quantity.clone(),
            chain: req.asset.chain.clone(),
            contract_address: req.asset.contract_address.clone(),
        },
        price: crate::models::Price {
            rate: req.price.rate.clone(),
            currency: req.price.currency.clone(),
        },
        quantity: req.quantity.clone(),
        side: req.side.clone(),
        limits: crate::models::VolumeLimits {
            min_amount: req.limits.min_amount.clone(),
            max_amount: req.limits.max_amount.clone(),
        },
        status: ContractStatus::Active,
        timestamps: crate::models::Timestamps {
            created: now.to_rfc3339(),
            updated: now.to_rfc3339(),
            expires_at: req.expires_at.clone(),
        },
        collateral: None,
        settlement_info: None,
        min_compliance_level: req.min_compliance_level.clone(),
        allowed_jurisdictions: req.allowed_jurisdictions.clone(),
        auditors: req.auditors.clone(),
        created_at: now,
    };
    state
        .contracts
        .write()
        .await
        .insert(contract_id.clone(), contract);

    Ok(Json(CreateOfferResponse {
        success: true,
        contract_id: Some(contract_id),
        transaction_id: Some(transaction_id),
        order_id: req.order_id,
        created_at: Some(now.to_rfc3339()),
        error: None,
    }))
}

// ─── Get Contract ───

pub async fn get_contract(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<OtcContract>, (StatusCode, Json<ApiError>)> {
    let store = state.contracts.read().await;
    store
        .get(&id)
        .cloned()
        .map(Json)
        .ok_or_else(|| ApiError::not_found(format!("Contract {} not found", id)))
}

// ─── Accept Offer ───
// DAML choice name is "Accept" (not "AcceptOffer")

#[derive(Deserialize)]
pub struct AcceptOfferRequest {
    pub contract_id: String,
    pub acceptor: String,
    #[serde(default = "default_quantity")]
    pub requested_quantity: String,
    #[serde(default)]
    pub compliance_ok: Option<bool>,
    #[serde(default)]
    pub payment_proof: Option<String>,
}

fn default_quantity() -> String {
    "0".into()
}

#[derive(Serialize)]
pub struct AcceptOfferResponse {
    pub success: bool,
    pub transaction_id: String,
    pub contract_id: String,
    pub status: String,
}

pub async fn accept_offer(
    State(state): State<AppState>,
    Json(req): Json<AcceptOfferRequest>,
) -> Result<Json<AcceptOfferResponse>, (StatusCode, Json<ApiError>)> {
    if req.contract_id.is_empty() || req.acceptor.is_empty() {
        return Err(ApiError::bad_request(
            "Missing required fields: contract_id, acceptor",
        ));
    }

    let mut command_client = state
        .create_command_client()
        .await
        .map_err(|e| ApiError::unavailable(format!("Failed to create command client: {}", e)))?;

    // Build Accept choice argument matching DAML:
    // Accept { acceptor, requestedQuantity, complianceOk, currentTime, paymentProof }
    let choice_arg = proto_record(vec![
        proto_field("acceptor", proto_party(&req.acceptor)),
        proto_field("requestedQuantity", proto_numeric(&req.requested_quantity)),
        proto_field(
            "complianceOk",
            proto_bool(req.compliance_ok.unwrap_or(true)),
        ),
        proto_field("currentTime", proto_timestamp_now()),
        proto_field(
            "paymentProof",
            proto_text(req.payment_proof.as_deref().unwrap_or("")),
        ),
    ]);

    // Choice name is "Accept" (not "AcceptOffer")
    let commands = build_exercise_commands(&state.config, &req.contract_id, "Accept", choice_arg);

    let response = command_client
        .submit_and_wait(proto::SubmitAndWaitRequest {
            commands: Some(commands),
        })
        .await
        .map_err(|e| {
            error!("Accept offer failed: {}", e);
            ApiError::unavailable(format!("Accept failed: {}", e.message()))
        })?;

    let transaction_id = response.into_inner().update_id;

    if let Some(contract) = state.contracts.write().await.get_mut(&req.contract_id) {
        contract.status = ContractStatus::Accepted;
    }

    Ok(Json(AcceptOfferResponse {
        success: true,
        transaction_id,
        contract_id: req.contract_id,
        status: "accepted".into(),
    }))
}

// ─── Cancel Offer ───
// DAML choice name is "Cancel" (not "CancelOffer")

#[derive(Deserialize)]
pub struct CancelOfferRequest {
    pub contract_id: String,
    #[serde(default)]
    pub reason: Option<String>,
}

#[derive(Serialize)]
pub struct CancelOfferResponse {
    pub success: bool,
    pub transaction_id: String,
    pub contract_id: String,
    pub status: String,
}

pub async fn cancel_offer(
    State(state): State<AppState>,
    Json(req): Json<CancelOfferRequest>,
) -> Result<Json<CancelOfferResponse>, (StatusCode, Json<ApiError>)> {
    if req.contract_id.is_empty() {
        return Err(ApiError::bad_request("Missing required field: contract_id"));
    }

    let mut command_client = state
        .create_command_client()
        .await
        .map_err(|e| ApiError::unavailable(format!("Failed to create command client: {}", e)))?;

    // Build Cancel choice argument matching DAML:
    // Cancel { canceller, reason, currentTime }
    let choice_arg = proto_record(vec![
        proto_field("canceller", proto_party(&state.config.party_id)),
        proto_field(
            "reason",
            proto_text(req.reason.as_deref().unwrap_or("Cancelled by operator")),
        ),
        proto_field("currentTime", proto_timestamp_now()),
    ]);

    // Choice name is "Cancel" (not "CancelOffer")
    let commands = build_exercise_commands(&state.config, &req.contract_id, "Cancel", choice_arg);

    let response = command_client
        .submit_and_wait(proto::SubmitAndWaitRequest {
            commands: Some(commands),
        })
        .await
        .map_err(|e| {
            error!("Cancel offer failed: {}", e);
            ApiError::unavailable(format!("Cancel failed: {}", e.message()))
        })?;

    let transaction_id = response.into_inner().update_id;

    if let Some(contract) = state.contracts.write().await.get_mut(&req.contract_id) {
        contract.status = ContractStatus::Cancelled;
    }

    Ok(Json(CancelOfferResponse {
        success: true,
        transaction_id,
        contract_id: req.contract_id,
        status: "cancelled".into(),
    }))
}

// ─── List Contracts ───

#[derive(Deserialize)]
pub struct ListContractsQuery {
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub initiator: Option<String>,
}

#[derive(Serialize)]
pub struct ListContractsResponse {
    pub contracts: Vec<OtcContract>,
    pub total: usize,
}

pub async fn list_contracts(
    State(state): State<AppState>,
    axum::extract::Query(query): axum::extract::Query<ListContractsQuery>,
) -> Json<ListContractsResponse> {
    let store = state.contracts.read().await;
    let contracts: Vec<OtcContract> = store
        .values()
        .filter(|c| {
            let status_ok = query.status.as_ref().map_or(true, |s| {
                format!("{:?}", c.status).to_lowercase() == s.to_lowercase()
            });
            let initiator_ok = query.initiator.as_ref().map_or(true, |i| c.initiator == *i);
            status_ok && initiator_ok
        })
        .cloned()
        .collect();
    let total = contracts.len();
    Json(ListContractsResponse { contracts, total })
}

// ─── Exercise command builder ───

fn build_exercise_commands(
    config: &AppConfig,
    contract_id: &str,
    choice: &str,
    choice_argument: Option<proto::Value>,
) -> proto::Commands {
    build_exercise_commands_for(
        config,
        contract_id,
        choice,
        choice_argument,
        "OtcOffer",
        "OtcOffer",
    )
}

fn build_exercise_commands_for(
    config: &AppConfig,
    contract_id: &str,
    choice: &str,
    choice_argument: Option<proto::Value>,
    module_name: &str,
    entity_name: &str,
) -> proto::Commands {
    let template_id = proto::Identifier {
        package_id: config.otc_package_id.clone(),
        module_name: module_name.into(),
        entity_name: entity_name.into(),
    };

    let exercise_cmd = proto::Command {
        command: Some(proto::command::Command::Exercise(proto::ExerciseCommand {
            template_id: Some(template_id),
            contract_id: contract_id.into(),
            choice: choice.into(),
            choice_argument,
        })),
    };

    proto::Commands {
        workflow_id: format!("otc-exercise-{}", Uuid::new_v4()),
        // Ledger API v2: user_id is the admin user with actAs rights
        user_id: "ledger-api-user".into(),
        command_id: Uuid::new_v4().to_string(),
        act_as: config.act_as_parties(),
        read_as: vec![],
        commands: vec![exercise_cmd],
        synchronizer_id: config.synchronizer_id.clone(),
        ..Default::default()
    }
}

// ─── Active Contracts (ACS Query) ───

#[derive(Deserialize)]
pub struct ActiveContractsQuery {
    #[serde(default = "default_template")]
    pub template: String,
}

fn default_template() -> String {
    "OtcOffer".into()
}

#[derive(Serialize)]
pub struct ActiveContractsResponse {
    pub contracts: Vec<ActiveContractEntry>,
    pub total: usize,
    pub source: String,
}

#[derive(Serialize)]
pub struct ActiveContractEntry {
    pub contract_id: String,
    pub template_id: String,
    pub create_arguments: serde_json::Value,
    pub signatories: Vec<String>,
    pub observers: Vec<String>,
}

fn proto_record_to_json(record: &proto::Record) -> serde_json::Value {
    let mut map = serde_json::Map::new();
    for field in &record.fields {
        let value = field
            .value
            .as_ref()
            .map(|v| proto_value_to_json(v))
            .unwrap_or(serde_json::Value::Null);
        map.insert(field.label.clone(), value);
    }
    serde_json::Value::Object(map)
}

fn proto_value_to_json(value: &proto::Value) -> serde_json::Value {
    match &value.sum {
        Some(proto::value::Sum::Text(s)) => serde_json::Value::String(s.clone()),
        Some(proto::value::Sum::Party(s)) => serde_json::Value::String(s.clone()),
        Some(proto::value::Sum::Numeric(s)) => serde_json::Value::String(s.clone()),
        Some(proto::value::Sum::Int64(n)) => serde_json::json!(*n),
        Some(proto::value::Sum::Bool(b)) => serde_json::Value::Bool(*b),
        Some(proto::value::Sum::Timestamp(t)) => serde_json::json!(*t),
        Some(proto::value::Sum::Unit(())) => serde_json::Value::Null,
        Some(proto::value::Sum::Record(r)) => proto_record_to_json(r),
        Some(proto::value::Sum::Variant(v)) => {
            let inner = v
                .value
                .as_ref()
                .map(|val| proto_value_to_json(val))
                .unwrap_or(serde_json::Value::Null);
            serde_json::json!({ "constructor": v.constructor, "value": inner })
        }
        Some(proto::value::Sum::Optional(opt)) => opt
            .value
            .as_ref()
            .map(|val| proto_value_to_json(val))
            .unwrap_or(serde_json::Value::Null),
        Some(proto::value::Sum::List(list)) => {
            let items: Vec<serde_json::Value> =
                list.elements.iter().map(proto_value_to_json).collect();
            serde_json::Value::Array(items)
        }
        _ => serde_json::Value::Null,
    }
}

pub async fn get_active_contracts(
    State(state): State<AppState>,
    axum::extract::Query(query): axum::extract::Query<ActiveContractsQuery>,
) -> Result<Json<ActiveContractsResponse>, (StatusCode, Json<ApiError>)> {
    if let Some(mut ledger_client) = state.get_ledger_client().await {
        let template_id = proto::Identifier {
            package_id: state.config.otc_package_id.clone(),
            module_name: query.template.clone(),
            entity_name: query.template.clone(),
        };

        match ledger_client
            .get_active_contracts(template_id, vec![state.config.party_id.clone()])
            .await
        {
            Ok(events) => {
                let contracts: Vec<ActiveContractEntry> = events
                    .iter()
                    .map(|event| {
                        let template_str = event
                            .template_id
                            .as_ref()
                            .map(|t| format!("{}:{}", t.module_name, t.entity_name))
                            .unwrap_or_default();
                        let args = event
                            .create_arguments
                            .as_ref()
                            .map(|r| proto_record_to_json(r))
                            .unwrap_or(serde_json::Value::Null);
                        ActiveContractEntry {
                            contract_id: event.contract_id.clone(),
                            template_id: template_str,
                            create_arguments: args,
                            signatories: event.signatories.clone(),
                            observers: event.observers.clone(),
                        }
                    })
                    .collect();
                let total = contracts.len();
                return Ok(Json(ActiveContractsResponse {
                    contracts,
                    total,
                    source: "ledger".into(),
                }));
            }
            Err(e) => {
                warn!("ACS query failed, falling back to in-memory: {}", e);
            }
        }
    }

    // Fallback: return in-memory contracts
    let store = state.contracts.read().await;
    let contracts: Vec<ActiveContractEntry> = store
        .values()
        .map(|c| ActiveContractEntry {
            contract_id: c.contract_id.clone(),
            template_id: "OtcOffer:OtcOffer".into(),
            create_arguments: serde_json::json!({
                "offerId": c.offer_id,
                "initiator": c.initiator,
                "status": format!("{:?}", c.status),
                "quantity": c.quantity,
                "asset": { "symbol": c.asset.symbol, "chain": c.asset.chain },
            }),
            signatories: vec![c.operator.clone(), c.initiator.clone()],
            observers: c.auditors.clone(),
        })
        .collect();
    let total = contracts.len();
    Ok(Json(ActiveContractsResponse {
        contracts,
        total,
        source: "in-memory".into(),
    }))
}

// ─── Settlement Handlers ───

#[derive(Serialize)]
pub struct ListSettlementsResponse {
    pub settlements: Vec<crate::models::SettlementContract>,
    pub total: usize,
}

pub async fn list_settlements(State(state): State<AppState>) -> Json<ListSettlementsResponse> {
    let store = state.settlements.read().await;
    let settlements: Vec<_> = store.values().cloned().collect();
    let total = settlements.len();
    Json(ListSettlementsResponse { settlements, total })
}

pub async fn get_settlement(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<crate::models::SettlementContract>, (StatusCode, Json<ApiError>)> {
    let store = state.settlements.read().await;
    store
        .get(&id)
        .cloned()
        .map(Json)
        .ok_or_else(|| ApiError::not_found(format!("Settlement {} not found", id)))
}

#[derive(Deserialize)]
pub struct ConfirmPaymentRequest {
    pub contract_id: String,
    pub confirmer: String,
    pub payment_tx_hash: String,
}

#[derive(Serialize)]
pub struct SettlementActionResponse {
    pub success: bool,
    pub transaction_id: String,
    pub contract_id: String,
    pub status: String,
}

pub async fn confirm_payment(
    State(state): State<AppState>,
    Json(req): Json<ConfirmPaymentRequest>,
) -> Result<Json<SettlementActionResponse>, (StatusCode, Json<ApiError>)> {
    if req.contract_id.is_empty() || req.confirmer.is_empty() || req.payment_tx_hash.is_empty() {
        return Err(ApiError::bad_request("Missing required fields"));
    }

    let mut command_client = state
        .create_command_client()
        .await
        .map_err(|e| ApiError::unavailable(format!("Failed to create command client: {}", e)))?;

    let choice_arg = proto_record(vec![
        proto_field("confirmer", proto_party(&req.confirmer)),
        proto_field("paymentTxHash", proto_text(&req.payment_tx_hash)),
        proto_field("currentTime", proto_timestamp_now()),
    ]);

    let commands = build_exercise_commands_for(
        &state.config,
        &req.contract_id,
        "ConfirmPayment",
        choice_arg,
        "Settlement",
        "Settlement",
    );

    let response = command_client
        .submit_and_wait(proto::SubmitAndWaitRequest {
            commands: Some(commands),
        })
        .await
        .map_err(|e| ApiError::unavailable(format!("ConfirmPayment failed: {}", e.message())))?;

    let transaction_id = response.into_inner().update_id;

    if let Some(s) = state.settlements.write().await.get_mut(&req.contract_id) {
        s.status = "PaymentReceived".into();
        s.payment_proof = req.payment_tx_hash;
    }

    Ok(Json(SettlementActionResponse {
        success: true,
        transaction_id,
        contract_id: req.contract_id,
        status: "payment_received".into(),
    }))
}

#[derive(Deserialize)]
pub struct CompleteSettlementRequest {
    pub contract_id: String,
    pub completer: String,
}

pub async fn complete_settlement(
    State(state): State<AppState>,
    Json(req): Json<CompleteSettlementRequest>,
) -> Result<Json<SettlementActionResponse>, (StatusCode, Json<ApiError>)> {
    if req.contract_id.is_empty() || req.completer.is_empty() {
        return Err(ApiError::bad_request("Missing required fields"));
    }

    let mut command_client = state
        .create_command_client()
        .await
        .map_err(|e| ApiError::unavailable(format!("Failed to create command client: {}", e)))?;

    let choice_arg = proto_record(vec![
        proto_field("completer", proto_party(&req.completer)),
        proto_field("currentTime", proto_timestamp_now()),
    ]);

    let commands = build_exercise_commands_for(
        &state.config,
        &req.contract_id,
        "CompleteSettlement",
        choice_arg,
        "Settlement",
        "Settlement",
    );

    let response = command_client
        .submit_and_wait(proto::SubmitAndWaitRequest {
            commands: Some(commands),
        })
        .await
        .map_err(|e| {
            ApiError::unavailable(format!("CompleteSettlement failed: {}", e.message()))
        })?;

    let transaction_id = response.into_inner().update_id;
    state.settlements.write().await.remove(&req.contract_id);

    Ok(Json(SettlementActionResponse {
        success: true,
        transaction_id,
        contract_id: req.contract_id,
        status: "completed".into(),
    }))
}

// ─── Escrow Handlers ───

#[derive(Deserialize)]
pub struct CreateEscrowRequest {
    pub offer_id: String,
    #[serde(default)]
    pub trade_id: Option<String>,
    pub buyer: String,
    pub seller: String,
    pub arbiter: String,
    pub asset: CreateOfferAsset,
    pub amount: String,
    pub release_conditions: String,
    pub refund_conditions: String,
    #[serde(default)]
    pub deadline_hours: Option<i64>,
    #[serde(default)]
    pub auditors: Vec<String>,
}

#[derive(Serialize)]
pub struct CreateEscrowResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contract_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transaction_id: Option<String>,
    pub escrow_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn create_escrow(
    State(state): State<AppState>,
    Json(req): Json<CreateEscrowRequest>,
) -> Result<Json<CreateEscrowResponse>, (StatusCode, Json<ApiError>)> {
    if req.offer_id.is_empty()
        || req.buyer.is_empty()
        || req.seller.is_empty()
        || req.arbiter.is_empty()
    {
        return Err(ApiError::bad_request("Missing required fields"));
    }

    let mut command_client = state
        .create_command_client()
        .await
        .map_err(|e| ApiError::unavailable(format!("Failed to create command client: {}", e)))?;

    let escrow_id = format!("escrow-{}", Uuid::new_v4());
    let now_micros = Utc::now().timestamp_micros();
    let deadline_hours = req.deadline_hours.unwrap_or(72);
    let deadline_micros = now_micros + deadline_hours * 3_600_000_000i64;

    let template_id = proto::Identifier {
        package_id: state.config.otc_package_id.clone(),
        module_name: "Escrow".into(),
        entity_name: "Escrow".into(),
    };

    let record = proto::Record {
        record_id: Some(template_id.clone()),
        fields: vec![
            proto_field("escrowId", proto_text(&escrow_id)),
            proto_field("offerId", proto_text(&req.offer_id)),
            proto_field(
                "tradeId",
                match &req.trade_id {
                    Some(t) => proto_optional_some(proto_text(t)),
                    None => proto_optional_none(),
                },
            ),
            proto_field("operator", proto_party(&state.config.party_id)),
            proto_field("buyer", proto_party(&req.buyer)),
            proto_field("seller", proto_party(&req.seller)),
            proto_field("arbiter", proto_party(&req.arbiter)),
            proto_field("asset", build_asset_record(&req.asset)),
            proto_field("amount", proto_numeric(&req.amount)),
            proto_field("depositedAmount", proto_numeric("0")),
            proto_field("releaseConditions", proto_text(&req.release_conditions)),
            proto_field("refundConditions", proto_text(&req.refund_conditions)),
            proto_field("status", proto_enum("Created")),
            proto_field("createdAt", proto_timestamp(now_micros)),
            proto_field("updatedAt", proto_timestamp(now_micros)),
            proto_field("deadline", proto_timestamp(deadline_micros)),
            proto_field("extensionCount", proto_int64(0)),
            proto_field("maxExtensions", proto_int64(3)),
            proto_field("disputeReason", proto_optional_none()),
            proto_field("arbitrationDecision", proto_optional_none()),
            proto_field("arbiterFavorsBuyer", proto_optional_none()),
            proto_field("auditors", proto_party_list(&req.auditors)),
        ],
    };

    let create_cmd = proto::Command {
        command: Some(proto::command::Command::Create(proto::CreateCommand {
            template_id: Some(template_id),
            create_arguments: Some(record),
        })),
    };

    let commands = proto::Commands {
        workflow_id: format!("otc-escrow-{}", escrow_id),
        // Ledger API v2: user_id is the admin user with actAs rights
        user_id: "ledger-api-user".into(),
        command_id: Uuid::new_v4().to_string(),
        act_as: state.config.act_as_parties(),
        read_as: vec![],
        commands: vec![create_cmd],
        synchronizer_id: state.config.synchronizer_id.clone(),
        ..Default::default()
    };

    let response = command_client
        .submit_and_wait_for_transaction(proto::SubmitAndWaitForTransactionRequest {
            commands: Some(commands),
            transaction_format: None,
        })
        .await
        .map_err(|e| ApiError::unavailable(format!("Escrow creation failed: {}", e.message())))?;

    let inner = response.into_inner();
    let transaction_id = inner
        .transaction
        .as_ref()
        .map(|t| t.update_id.clone())
        .unwrap_or_default();
    let contract_id = inner
        .transaction
        .as_ref()
        .and_then(|t| {
            t.events.iter().find_map(|event| {
                if let Some(proto::event::Event::Created(created)) = &event.event {
                    Some(created.contract_id.clone())
                } else {
                    None
                }
            })
        })
        .unwrap_or_else(|| format!("pending:{}", escrow_id));

    let escrow = crate::models::EscrowContract {
        contract_id: contract_id.clone(),
        escrow_id: escrow_id.clone(),
        offer_id: req.offer_id,
        trade_id: req.trade_id,
        operator: state.config.party_id.clone(),
        buyer: req.buyer,
        seller: req.seller,
        arbiter: req.arbiter,
        asset: crate::models::Asset {
            symbol: req.asset.symbol,
            amount: req.amount.clone(),
            chain: req.asset.chain,
            contract_address: req.asset.contract_address,
        },
        amount: req.amount,
        deposited_amount: "0".into(),
        release_conditions: req.release_conditions,
        refund_conditions: req.refund_conditions,
        status: "Created".into(),
        created_at: Utc::now().to_rfc3339(),
        updated_at: Utc::now().to_rfc3339(),
        deadline: chrono::DateTime::from_timestamp_micros(deadline_micros)
            .map(|d| d.to_rfc3339())
            .unwrap_or_default(),
    };
    state
        .escrows
        .write()
        .await
        .insert(contract_id.clone(), escrow);

    Ok(Json(CreateEscrowResponse {
        success: true,
        contract_id: Some(contract_id),
        transaction_id: Some(transaction_id),
        escrow_id,
        error: None,
    }))
}

pub async fn get_escrow(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<crate::models::EscrowContract>, (StatusCode, Json<ApiError>)> {
    let store = state.escrows.read().await;
    store
        .get(&id)
        .cloned()
        .map(Json)
        .ok_or_else(|| ApiError::not_found(format!("Escrow {} not found", id)))
}

#[derive(Deserialize)]
pub struct DepositRequest {
    pub contract_id: String,
    pub depositor: String,
    pub deposit_amount: String,
    pub deposit_proof: String,
}

pub async fn deposit_escrow(
    State(state): State<AppState>,
    Json(req): Json<DepositRequest>,
) -> Result<Json<SettlementActionResponse>, (StatusCode, Json<ApiError>)> {
    if req.contract_id.is_empty() || req.depositor.is_empty() {
        return Err(ApiError::bad_request("Missing required fields"));
    }

    let mut command_client = state
        .create_command_client()
        .await
        .map_err(|e| ApiError::unavailable(format!("Failed to create command client: {}", e)))?;

    let choice_arg = proto_record(vec![
        proto_field("depositor", proto_party(&req.depositor)),
        proto_field("depositAmount", proto_numeric(&req.deposit_amount)),
        proto_field("depositProof", proto_text(&req.deposit_proof)),
        proto_field("currentTime", proto_timestamp_now()),
    ]);

    let commands = build_exercise_commands_for(
        &state.config,
        &req.contract_id,
        "Deposit",
        choice_arg,
        "Escrow",
        "Escrow",
    );

    let response = command_client
        .submit_and_wait_for_transaction(proto::SubmitAndWaitForTransactionRequest {
            commands: Some(commands),
            transaction_format: None,
        })
        .await
        .map_err(|e| ApiError::unavailable(format!("Deposit failed: {}", e.message())))?;

    let inner = response.into_inner();
    let transaction_id = inner
        .transaction
        .as_ref()
        .map(|t| t.update_id.clone())
        .unwrap_or_default();
    let new_contract_id = inner
        .transaction
        .as_ref()
        .and_then(|t| {
            t.events.iter().find_map(|event| {
                if let Some(proto::event::Event::Created(created)) = &event.event {
                    Some(created.contract_id.clone())
                } else {
                    None
                }
            })
        })
        .unwrap_or_else(|| req.contract_id.clone());

    let mut escrows = state.escrows.write().await;
    if let Some(mut escrow) = escrows.remove(&req.contract_id) {
        escrow.status = "Deposited".into();
        escrow.deposited_amount = req.deposit_amount;
        escrow.contract_id = new_contract_id.clone();
        escrows.insert(new_contract_id.clone(), escrow);
    }
    drop(escrows);

    Ok(Json(SettlementActionResponse {
        success: true,
        transaction_id,
        contract_id: new_contract_id,
        status: "deposited".into(),
    }))
}

#[derive(Deserialize)]
pub struct ReleaseEscrowRequest {
    pub contract_id: String,
    pub releaser: String,
    pub release_proof: String,
}

pub async fn release_escrow(
    State(state): State<AppState>,
    Json(req): Json<ReleaseEscrowRequest>,
) -> Result<Json<SettlementActionResponse>, (StatusCode, Json<ApiError>)> {
    if req.contract_id.is_empty() || req.releaser.is_empty() {
        return Err(ApiError::bad_request("Missing required fields"));
    }

    let mut command_client = state
        .create_command_client()
        .await
        .map_err(|e| ApiError::unavailable(format!("Failed to create command client: {}", e)))?;

    let choice_arg = proto_record(vec![
        proto_field("releaser", proto_party(&req.releaser)),
        proto_field("releaseProof", proto_text(&req.release_proof)),
        proto_field("currentTime", proto_timestamp_now()),
    ]);

    let commands = build_exercise_commands_for(
        &state.config,
        &req.contract_id,
        "Release",
        choice_arg,
        "Escrow",
        "Escrow",
    );

    let response = command_client
        .submit_and_wait(proto::SubmitAndWaitRequest {
            commands: Some(commands),
        })
        .await
        .map_err(|e| ApiError::unavailable(format!("Release failed: {}", e.message())))?;

    let transaction_id = response.into_inner().update_id;
    state.escrows.write().await.remove(&req.contract_id);

    Ok(Json(SettlementActionResponse {
        success: true,
        transaction_id,
        contract_id: req.contract_id,
        status: "released".into(),
    }))
}

// ─── Collateral Handlers ───

#[derive(Deserialize)]
pub struct CreateCollateralApiRequest {
    pub owner: String,
    #[serde(default)]
    pub beneficiary: Option<String>,
    #[serde(default)]
    pub offer_id: Option<String>,
    pub asset_symbol: String,
    pub asset_amount: String,
    pub asset_chain: String,
    #[serde(default)]
    pub asset_contract_address: Option<String>,
    pub amount: String,
    #[serde(default)]
    pub auditors: Vec<String>,
}

#[derive(Serialize)]
pub struct CreateCollateralResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contract_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transaction_id: Option<String>,
    pub collateral_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn create_collateral(
    State(state): State<AppState>,
    Json(req): Json<CreateCollateralApiRequest>,
) -> Result<Json<CreateCollateralResponse>, (StatusCode, Json<ApiError>)> {
    if req.owner.is_empty() || req.asset_symbol.is_empty() || req.amount.is_empty() {
        return Err(ApiError::bad_request(
            "Missing required fields: owner, asset_symbol, amount",
        ));
    }

    let _amount: rust_decimal::Decimal = req
        .amount
        .parse()
        .map_err(|_| ApiError::bad_request("amount must be a valid decimal number"))?;
    if _amount <= rust_decimal::Decimal::ZERO {
        return Err(ApiError::bad_request("amount must be positive"));
    }

    let mut command_client = state
        .create_command_client()
        .await
        .map_err(|e| ApiError::unavailable(format!("Failed to create command client: {}", e)))?;

    let collateral_id = format!("col-{}", Uuid::new_v4());

    let builder_req = proto_builders::CreateCollateralRequest {
        collateral_id: collateral_id.clone(),
        offer_id: req.offer_id.clone(),
        operator: state.config.party_id.clone(),
        owner: req.owner.clone(),
        beneficiary: req.beneficiary.clone(),
        asset_symbol: req.asset_symbol.clone(),
        asset_amount: req.asset_amount.clone(),
        asset_chain: req.asset_chain.clone(),
        asset_contract_address: req.asset_contract_address.clone(),
        initial_amount: req.amount.clone(),
        current_amount: req.amount.clone(),
        locked_amount: "0".into(),
        locked_until: None,
        status: "CollateralAvailable".into(),
        created_at: None,
        updated_at: None,
        auditors: req.auditors.clone(),
    };

    let record = proto_builders::build_create_collateral_record(&builder_req);
    let create_cmd = proto_builders::build_create_command(
        &state.config.otc_package_id,
        "Collateral",
        "Collateral",
        record,
    );

    let commands = proto::Commands {
        workflow_id: format!("otc-collateral-{}", collateral_id),
        user_id: "ledger-api-user".into(),
        command_id: Uuid::new_v4().to_string(),
        act_as: state.config.act_as_parties(),
        read_as: vec![],
        commands: vec![create_cmd],
        synchronizer_id: state.config.synchronizer_id.clone(),
        ..Default::default()
    };

    info!(
        collateral_id = %collateral_id,
        owner = %req.owner,
        asset = %req.asset_symbol,
        amount = %req.amount,
        "Creating Collateral contract"
    );

    let response = command_client
        .submit_and_wait_for_transaction(proto::SubmitAndWaitForTransactionRequest {
            commands: Some(commands),
            transaction_format: None,
        })
        .await
        .map_err(|e| {
            error!("Collateral creation failed: {}", e);
            ApiError::unavailable(format!("Collateral creation failed: {}", e.message()))
        })?;

    let inner = response.into_inner();
    let transaction_id = inner
        .transaction
        .as_ref()
        .map(|t| t.update_id.clone())
        .unwrap_or_default();
    let contract_id = inner
        .transaction
        .as_ref()
        .and_then(|t| {
            t.events.iter().find_map(|event| {
                if let Some(proto::event::Event::Created(created)) = &event.event {
                    Some(created.contract_id.clone())
                } else {
                    None
                }
            })
        })
        .unwrap_or_else(|| format!("pending:{}", collateral_id));

    info!(
        collateral_id = %collateral_id,
        contract_id = %contract_id,
        transaction_id = %transaction_id,
        "DAML Collateral contract created"
    );

    let collateral = crate::models::CollateralContract {
        contract_id: contract_id.clone(),
        collateral_id: collateral_id.clone(),
        offer_id: req.offer_id,
        operator: state.config.party_id.clone(),
        owner: req.owner,
        beneficiary: req.beneficiary,
        asset: crate::models::Asset {
            symbol: req.asset_symbol,
            amount: req.asset_amount,
            chain: req.asset_chain,
            contract_address: req.asset_contract_address,
        },
        initial_amount: req.amount.clone(),
        current_amount: req.amount,
        locked_amount: "0".into(),
        status: "CollateralAvailable".into(),
        created_at: Utc::now().to_rfc3339(),
        updated_at: Utc::now().to_rfc3339(),
    };
    state
        .collaterals
        .write()
        .await
        .insert(contract_id.clone(), collateral);

    Ok(Json(CreateCollateralResponse {
        success: true,
        contract_id: Some(contract_id),
        transaction_id: Some(transaction_id),
        collateral_id,
        error: None,
    }))
}

pub async fn get_collateral(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<crate::models::CollateralContract>, (StatusCode, Json<ApiError>)> {
    let store = state.collaterals.read().await;
    store
        .get(&id)
        .cloned()
        .map(Json)
        .ok_or_else(|| ApiError::not_found(format!("Collateral {} not found", id)))
}

#[derive(Deserialize)]
pub struct LockCollateralRequest {
    pub contract_id: String,
    pub amount: String,
    pub lock_offer_id: String,
    #[serde(default = "default_lock_duration")]
    pub lock_duration_hours: i64,
}

fn default_lock_duration() -> i64 {
    48
}

pub async fn lock_collateral(
    State(state): State<AppState>,
    Json(req): Json<LockCollateralRequest>,
) -> Result<Json<SettlementActionResponse>, (StatusCode, Json<ApiError>)> {
    if req.contract_id.is_empty() || req.amount.is_empty() || req.lock_offer_id.is_empty() {
        return Err(ApiError::bad_request(
            "Missing required fields: contract_id, amount, lock_offer_id",
        ));
    }

    let _amount: rust_decimal::Decimal = req
        .amount
        .parse()
        .map_err(|_| ApiError::bad_request("amount must be a valid decimal number"))?;
    if _amount <= rust_decimal::Decimal::ZERO {
        return Err(ApiError::bad_request("amount must be positive"));
    }

    if req.lock_duration_hours <= 0 {
        return Err(ApiError::bad_request(
            "lock_duration_hours must be positive",
        ));
    }

    let mut command_client = state
        .create_command_client()
        .await
        .map_err(|e| ApiError::unavailable(format!("Failed to create command client: {}", e)))?;

    let lock_duration_micros = req.lock_duration_hours * 3_600_000_000i64;
    let choice_arg = proto_builders::build_collateral_lock_args(
        &state.config.party_id,
        &req.amount,
        &req.lock_offer_id,
        lock_duration_micros,
    );

    let commands = build_exercise_commands_for(
        &state.config,
        &req.contract_id,
        "Lock",
        choice_arg,
        "Collateral",
        "Collateral",
    );

    info!(
        contract_id = %req.contract_id,
        amount = %req.amount,
        lock_offer_id = %req.lock_offer_id,
        lock_duration_hours = %req.lock_duration_hours,
        "Locking collateral"
    );

    let response = command_client
        .submit_and_wait(proto::SubmitAndWaitRequest {
            commands: Some(commands),
        })
        .await
        .map_err(|e| {
            error!("Lock collateral failed: {}", e);
            ApiError::unavailable(format!("Lock failed: {}", e.message()))
        })?;

    let transaction_id = response.into_inner().update_id;

    if let Some(col) = state.collaterals.write().await.get_mut(&req.contract_id) {
        col.locked_amount = req.amount;
        col.status = "CollateralLocked".into();
        col.updated_at = Utc::now().to_rfc3339();
    }

    Ok(Json(SettlementActionResponse {
        success: true,
        transaction_id,
        contract_id: req.contract_id,
        status: "locked".into(),
    }))
}

#[derive(Deserialize)]
pub struct ReleaseCollateralRequest {
    pub contract_id: String,
    pub amount: String,
}

pub async fn release_collateral(
    State(state): State<AppState>,
    Json(req): Json<ReleaseCollateralRequest>,
) -> Result<Json<SettlementActionResponse>, (StatusCode, Json<ApiError>)> {
    if req.contract_id.is_empty() || req.amount.is_empty() {
        return Err(ApiError::bad_request(
            "Missing required fields: contract_id, amount",
        ));
    }

    let _amount: rust_decimal::Decimal = req
        .amount
        .parse()
        .map_err(|_| ApiError::bad_request("amount must be a valid decimal number"))?;
    if _amount <= rust_decimal::Decimal::ZERO {
        return Err(ApiError::bad_request("amount must be positive"));
    }

    let mut command_client = state
        .create_command_client()
        .await
        .map_err(|e| ApiError::unavailable(format!("Failed to create command client: {}", e)))?;

    let choice_arg = proto_builders::build_collateral_release_args(
        &state.config.party_id,
        &req.amount,
    );

    let commands = build_exercise_commands_for(
        &state.config,
        &req.contract_id,
        "Release",
        choice_arg,
        "Collateral",
        "Collateral",
    );

    info!(
        contract_id = %req.contract_id,
        amount = %req.amount,
        "Releasing collateral"
    );

    let response = command_client
        .submit_and_wait(proto::SubmitAndWaitRequest {
            commands: Some(commands),
        })
        .await
        .map_err(|e| {
            error!("Release collateral failed: {}", e);
            ApiError::unavailable(format!("Release failed: {}", e.message()))
        })?;

    let transaction_id = response.into_inner().update_id;

    if let Some(col) = state.collaterals.write().await.get_mut(&req.contract_id) {
        col.locked_amount = "0".into();
        col.status = "CollateralAvailable".into();
        col.updated_at = Utc::now().to_rfc3339();
    }

    Ok(Json(SettlementActionResponse {
        success: true,
        transaction_id,
        contract_id: req.contract_id,
        status: "released".into(),
    }))
}

// ─── Create Settlement ───

#[derive(Deserialize)]
pub struct CreateSettlementApiRequest {
    pub offer_id: String,
    #[serde(default)]
    pub trade_id: Option<String>,
    pub buyer: String,
    pub seller: String,
    pub asset_symbol: String,
    pub asset_amount: String,
    pub asset_chain: String,
    #[serde(default)]
    pub asset_contract_address: Option<String>,
    pub quantity: String,
    pub price_rate: String,
    pub price_currency: String,
    pub total_amount: String,
    #[serde(default = "default_required_confirmations")]
    pub required_confirmations: i64,
    #[serde(default = "default_deadline_hours")]
    pub deadline_hours: i64,
    #[serde(default)]
    pub auditors: Vec<String>,
}

fn default_required_confirmations() -> i64 {
    2
}

fn default_deadline_hours() -> i64 {
    24
}

#[derive(Serialize)]
pub struct CreateSettlementResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contract_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transaction_id: Option<String>,
    pub settlement_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn create_settlement(
    State(state): State<AppState>,
    Json(req): Json<CreateSettlementApiRequest>,
) -> Result<Json<CreateSettlementResponse>, (StatusCode, Json<ApiError>)> {
    if req.offer_id.is_empty() || req.buyer.is_empty() || req.seller.is_empty() {
        return Err(ApiError::bad_request(
            "Missing required fields: offer_id, buyer, seller",
        ));
    }
    if req.quantity.is_empty() || req.total_amount.is_empty() {
        return Err(ApiError::bad_request(
            "Missing required fields: quantity, total_amount",
        ));
    }

    let _qty: rust_decimal::Decimal = req
        .quantity
        .parse()
        .map_err(|_| ApiError::bad_request("quantity must be a valid decimal number"))?;
    if _qty <= rust_decimal::Decimal::ZERO {
        return Err(ApiError::bad_request("quantity must be positive"));
    }

    let mut command_client = state
        .create_command_client()
        .await
        .map_err(|e| ApiError::unavailable(format!("Failed to create command client: {}", e)))?;

    let settlement_id = format!("settlement-{}", Uuid::new_v4());
    let now_micros = Utc::now().timestamp_micros();
    let deadline_micros = now_micros + req.deadline_hours * 3_600_000_000i64;
    let trade_id = req.trade_id.unwrap_or_else(|| settlement_id.clone());

    let builder_req = proto_builders::CreateSettlementRequest {
        settlement_id: settlement_id.clone(),
        offer_id: req.offer_id.clone(),
        trade_id: trade_id.clone(),
        operator: state.config.party_id.clone(),
        buyer: req.buyer.clone(),
        seller: req.seller.clone(),
        asset_symbol: req.asset_symbol.clone(),
        asset_amount: req.asset_amount.clone(),
        asset_chain: req.asset_chain.clone(),
        asset_contract_address: req.asset_contract_address.clone(),
        quantity: req.quantity.clone(),
        price_rate: req.price_rate.clone(),
        price_currency: req.price_currency.clone(),
        total_amount: req.total_amount.clone(),
        payment_proof: "PENDING".into(),
        confirmations: 0,
        required_confirmations: req.required_confirmations,
        status: "PendingPayment".into(),
        created_at: Some(now_micros),
        updated_at: Some(now_micros),
        completed_at: None,
        deadline: deadline_micros,
        extension_count: 0,
        auditors: req.auditors.clone(),
    };

    let record = proto_builders::build_create_settlement_record(&builder_req);
    let create_cmd = proto_builders::build_create_command(
        &state.config.otc_package_id,
        "Settlement",
        "Settlement",
        record,
    );

    let commands = proto::Commands {
        workflow_id: format!("otc-settlement-{}", settlement_id),
        user_id: "ledger-api-user".into(),
        command_id: Uuid::new_v4().to_string(),
        act_as: state.config.act_as_parties(),
        read_as: vec![],
        commands: vec![create_cmd],
        synchronizer_id: state.config.synchronizer_id.clone(),
        ..Default::default()
    };

    info!(
        settlement_id = %settlement_id,
        offer_id = %req.offer_id,
        buyer = %req.buyer,
        seller = %req.seller,
        total_amount = %req.total_amount,
        "Creating Settlement contract"
    );

    let response = command_client
        .submit_and_wait_for_transaction(proto::SubmitAndWaitForTransactionRequest {
            commands: Some(commands),
            transaction_format: None,
        })
        .await
        .map_err(|e| {
            error!("Settlement creation failed: {}", e);
            ApiError::unavailable(format!("Settlement creation failed: {}", e.message()))
        })?;

    let inner = response.into_inner();
    let transaction_id = inner
        .transaction
        .as_ref()
        .map(|t| t.update_id.clone())
        .unwrap_or_default();
    let contract_id = inner
        .transaction
        .as_ref()
        .and_then(|t| {
            t.events.iter().find_map(|event| {
                if let Some(proto::event::Event::Created(created)) = &event.event {
                    Some(created.contract_id.clone())
                } else {
                    None
                }
            })
        })
        .unwrap_or_else(|| format!("pending:{}", settlement_id));

    info!(
        settlement_id = %settlement_id,
        contract_id = %contract_id,
        transaction_id = %transaction_id,
        "DAML Settlement contract created"
    );

    let settlement = crate::models::SettlementContract {
        contract_id: contract_id.clone(),
        settlement_id: settlement_id.clone(),
        offer_id: req.offer_id,
        trade_id,
        operator: state.config.party_id.clone(),
        buyer: req.buyer,
        seller: req.seller,
        asset: crate::models::Asset {
            symbol: req.asset_symbol,
            amount: req.asset_amount,
            chain: req.asset_chain,
            contract_address: req.asset_contract_address,
        },
        quantity: req.quantity,
        price: crate::models::Price {
            rate: req.price_rate,
            currency: req.price_currency,
        },
        total_amount: req.total_amount,
        payment_proof: "PENDING".into(),
        confirmations: 0,
        required_confirmations: req.required_confirmations as i32,
        status: "PendingPayment".into(),
        created_at: Utc::now().to_rfc3339(),
        updated_at: Utc::now().to_rfc3339(),
        completed_at: None,
        deadline: chrono::DateTime::from_timestamp_micros(deadline_micros)
            .map(|d| d.to_rfc3339())
            .unwrap_or_default(),
    };
    state
        .settlements
        .write()
        .await
        .insert(contract_id.clone(), settlement);

    Ok(Json(CreateSettlementResponse {
        success: true,
        contract_id: Some(contract_id),
        transaction_id: Some(transaction_id),
        settlement_id,
        error: None,
    }))
}

// ─── Unit Tests ───

#[cfg(test)]
mod tests {
    use super::*;

    // ── Proto value helper tests ──

    #[test]
    fn test_proto_text() {
        let val = proto_text("hello").unwrap();
        match val.sum.unwrap() {
            proto::value::Sum::Text(s) => assert_eq!(s, "hello"),
            other => panic!("Expected Text, got {:?}", other),
        }
    }

    #[test]
    fn test_proto_party() {
        let val = proto_party("alice").unwrap();
        match val.sum.unwrap() {
            proto::value::Sum::Party(s) => assert_eq!(s, "alice"),
            other => panic!("Expected Party, got {:?}", other),
        }
    }

    #[test]
    fn test_proto_numeric() {
        let val = proto_numeric("123.456").unwrap();
        match val.sum.unwrap() {
            proto::value::Sum::Numeric(s) => assert_eq!(s, "123.456"),
            other => panic!("Expected Numeric, got {:?}", other),
        }
    }

    #[test]
    fn test_proto_int64() {
        let val = proto_int64(42).unwrap();
        match val.sum.unwrap() {
            proto::value::Sum::Int64(n) => assert_eq!(n, 42),
            other => panic!("Expected Int64, got {:?}", other),
        }
    }

    #[test]
    fn test_proto_bool() {
        let val = proto_bool(true).unwrap();
        match val.sum.unwrap() {
            proto::value::Sum::Bool(b) => assert!(b),
            other => panic!("Expected Bool, got {:?}", other),
        }
    }

    #[test]
    fn test_proto_unit() {
        let val = proto_unit().unwrap();
        match val.sum.unwrap() {
            proto::value::Sum::Unit(()) => {}
            other => panic!("Expected Unit, got {:?}", other),
        }
    }

    #[test]
    fn test_proto_timestamp() {
        let val = proto_timestamp(1_000_000).unwrap();
        match val.sum.unwrap() {
            proto::value::Sum::Timestamp(t) => assert_eq!(t, 1_000_000),
            other => panic!("Expected Timestamp, got {:?}", other),
        }
    }

    #[test]
    fn test_proto_field() {
        let field = proto_field("myLabel", proto_text("myValue"));
        assert_eq!(field.label, "myLabel");
        let val = field.value.unwrap();
        match val.sum.unwrap() {
            proto::value::Sum::Text(s) => assert_eq!(s, "myValue"),
            other => panic!("Expected Text, got {:?}", other),
        }
    }

    #[test]
    fn test_proto_record() {
        let rec = proto_record(vec![
            proto_field("a", proto_text("x")),
            proto_field("b", proto_int64(1)),
        ])
        .unwrap();
        match rec.sum.unwrap() {
            proto::value::Sum::Record(r) => {
                assert_eq!(r.fields.len(), 2);
                assert_eq!(r.fields[0].label, "a");
                assert_eq!(r.fields[1].label, "b");
            }
            other => panic!("Expected Record, got {:?}", other),
        }
    }

    #[test]
    fn test_proto_variant() {
        let var = proto_variant("Buy", proto_unit()).unwrap();
        match var.sum.unwrap() {
            proto::value::Sum::Variant(v) => {
                assert_eq!(v.constructor, "Buy");
                assert!(v.value.is_some());
            }
            other => panic!("Expected Variant, got {:?}", other),
        }
    }

    #[test]
    fn test_proto_optional_none() {
        let opt = proto_optional_none().unwrap();
        match opt.sum.unwrap() {
            proto::value::Sum::Optional(o) => assert!(o.value.is_none()),
            other => panic!("Expected Optional, got {:?}", other),
        }
    }

    #[test]
    fn test_proto_optional_some() {
        let opt = proto_optional_some(proto_text("inner")).unwrap();
        match opt.sum.unwrap() {
            proto::value::Sum::Optional(o) => {
                let inner = *o.value.unwrap();
                match inner.sum.unwrap() {
                    proto::value::Sum::Text(s) => assert_eq!(s, "inner"),
                    other => panic!("Expected Text inside Optional, got {:?}", other),
                }
            }
            other => panic!("Expected Optional, got {:?}", other),
        }
    }

    #[test]
    fn test_proto_list() {
        let list = proto_list(vec![
            proto::Value {
                sum: Some(proto::value::Sum::Int64(1)),
            },
            proto::Value {
                sum: Some(proto::value::Sum::Int64(2)),
            },
        ])
        .unwrap();
        match list.sum.unwrap() {
            proto::value::Sum::List(l) => assert_eq!(l.elements.len(), 2),
            other => panic!("Expected List, got {:?}", other),
        }
    }

    #[test]
    fn test_proto_text_list() {
        let items = vec!["US".to_string(), "EU".to_string()];
        let list = proto_text_list(&items).unwrap();
        match list.sum.unwrap() {
            proto::value::Sum::List(l) => {
                assert_eq!(l.elements.len(), 2);
                match l.elements[0].sum.as_ref().unwrap() {
                    proto::value::Sum::Text(s) => assert_eq!(s, "US"),
                    other => panic!("Expected Text, got {:?}", other),
                }
            }
            other => panic!("Expected List, got {:?}", other),
        }
    }

    #[test]
    fn test_proto_party_list() {
        let parties = vec!["alice".to_string(), "bob".to_string()];
        let list = proto_party_list(&parties).unwrap();
        match list.sum.unwrap() {
            proto::value::Sum::List(l) => {
                assert_eq!(l.elements.len(), 2);
                match l.elements[0].sum.as_ref().unwrap() {
                    proto::value::Sum::Party(s) => assert_eq!(s, "alice"),
                    other => panic!("Expected Party, got {:?}", other),
                }
            }
            other => panic!("Expected List, got {:?}", other),
        }
    }

    // ── Proto → JSON conversion tests ──

    #[test]
    fn test_proto_record_to_json() {
        let record = proto::Record {
            record_id: None,
            fields: vec![
                proto_field("name", proto_text("test")),
                proto_field("count", proto_int64(5)),
                proto_field("active", proto_bool(true)),
            ],
        };
        let json = proto_record_to_json(&record);
        assert_eq!(json["name"], "test");
        assert_eq!(json["count"], 5);
        assert_eq!(json["active"], true);
    }

    #[test]
    fn test_proto_value_to_json_nested() {
        let inner_record = proto_record(vec![proto_field("x", proto_numeric("1.5"))]).unwrap();
        let json = proto_value_to_json(&inner_record);
        assert_eq!(json["x"], "1.5");
    }

    #[test]
    fn test_proto_value_to_json_variant() {
        let var = proto_variant("Buy", proto_unit()).unwrap();
        let json = proto_value_to_json(&var);
        assert_eq!(json["constructor"], "Buy");
    }

    #[test]
    fn test_proto_value_to_json_optional_none() {
        let opt = proto_optional_none().unwrap();
        let json = proto_value_to_json(&opt);
        assert!(json.is_null());
    }

    #[test]
    fn test_proto_value_to_json_optional_some() {
        let opt = proto_optional_some(proto_text("hello")).unwrap();
        let json = proto_value_to_json(&opt);
        assert_eq!(json, "hello");
    }

    #[test]
    fn test_proto_value_to_json_list() {
        let list = proto_text_list(&["a".into(), "b".into()]).unwrap();
        let json = proto_value_to_json(&list);
        assert_eq!(json, serde_json::json!(["a", "b"]));
    }

    // ── Builder helpers tests ──

    #[test]
    fn test_build_side_variant_buy() {
        let v = build_side_variant("Buy").unwrap();
        match v.sum.unwrap() {
            proto::value::Sum::Variant(var) => assert_eq!(var.constructor, "Buy"),
            other => panic!("Expected Variant, got {:?}", other),
        }
    }

    #[test]
    fn test_build_side_variant_sell() {
        let v = build_side_variant("sell").unwrap();
        match v.sum.unwrap() {
            proto::value::Sum::Variant(var) => assert_eq!(var.constructor, "Sell"),
            other => panic!("Expected Variant, got {:?}", other),
        }
    }

    #[test]
    fn test_build_side_variant_default() {
        let v = build_side_variant("unknown").unwrap();
        match v.sum.unwrap() {
            proto::value::Sum::Variant(var) => assert_eq!(var.constructor, "Buy"),
            other => panic!("Expected Variant, got {:?}", other),
        }
    }

    #[test]
    fn test_build_asset_record() {
        let asset = CreateOfferAsset {
            symbol: "BTC".into(),
            amount: "1.5".into(),
            chain: "ethereum".into(),
            contract_address: Some("0xabc".into()),
        };
        let val = build_asset_record(&asset).unwrap();
        match val.sum.unwrap() {
            proto::value::Sum::Record(r) => {
                assert_eq!(r.fields.len(), 4);
                assert_eq!(r.fields[0].label, "symbol");
                assert_eq!(r.fields[1].label, "amount");
                assert_eq!(r.fields[2].label, "chain");
                assert_eq!(r.fields[3].label, "contractAddress");
            }
            other => panic!("Expected Record, got {:?}", other),
        }
    }

    #[test]
    fn test_build_asset_record_no_address() {
        let asset = CreateOfferAsset {
            symbol: "ETH".into(),
            amount: "10".into(),
            chain: "ethereum".into(),
            contract_address: None,
        };
        let val = build_asset_record(&asset).unwrap();
        match val.sum.unwrap() {
            proto::value::Sum::Record(r) => {
                // contractAddress should be Optional None
                let addr_field = &r.fields[3];
                assert_eq!(addr_field.label, "contractAddress");
                let addr_val = addr_field.value.as_ref().unwrap();
                match addr_val.sum.as_ref().unwrap() {
                    proto::value::Sum::Optional(opt) => assert!(opt.value.is_none()),
                    other => panic!("Expected Optional, got {:?}", other),
                }
            }
            other => panic!("Expected Record, got {:?}", other),
        }
    }

    #[test]
    fn test_build_price_record() {
        let price = CreateOfferPrice {
            rate: "50000.00".into(),
            currency: "USD".into(),
        };
        let val = build_price_record(&price).unwrap();
        match val.sum.unwrap() {
            proto::value::Sum::Record(r) => {
                assert_eq!(r.fields.len(), 2);
                assert_eq!(r.fields[0].label, "rate");
                assert_eq!(r.fields[1].label, "currency");
            }
            other => panic!("Expected Record, got {:?}", other),
        }
    }

    #[test]
    fn test_build_limits_record() {
        let limits = CreateOfferLimits {
            min_amount: "0.1".into(),
            max_amount: "100".into(),
        };
        let val = build_limits_record(&limits).unwrap();
        match val.sum.unwrap() {
            proto::value::Sum::Record(r) => {
                assert_eq!(r.fields.len(), 2);
                assert_eq!(r.fields[0].label, "minAmount");
                assert_eq!(r.fields[1].label, "maxAmount");
            }
            other => panic!("Expected Record, got {:?}", other),
        }
    }

    // ── Command builder tests ──

    fn test_config() -> AppConfig {
        AppConfig {
            canton_host: "localhost".into(),
            canton_port: 5001,
            application_id: "test-app".into(),
            party_id: "test-party".into(),
            ledger_id: "test-ledger".into(),
            port: 8080,
            otc_package_id: "pkg-abc-123".into(),
            auth_token: None,
            synchronizer_id: String::new(),
            trader_party_id: String::new(),
        }
    }

    #[test]
    fn test_build_create_offer_commands_structure() {
        let config = test_config();
        let req = CreateOfferRequest {
            order_id: "order-1".into(),
            initiator: "alice".into(),
            counterparty: Some("bob".into()),
            asset: CreateOfferAsset {
                symbol: "BTC".into(),
                amount: "1.0".into(),
                chain: "bitcoin".into(),
                contract_address: None,
            },
            price: CreateOfferPrice {
                rate: "50000".into(),
                currency: "USD".into(),
            },
            quantity: "1.0".into(),
            side: "Buy".into(),
            limits: CreateOfferLimits {
                min_amount: "0.1".into(),
                max_amount: "10".into(),
            },
            min_compliance_level: "RETAIL".into(),
            allowed_jurisdictions: vec!["US".into()],
            auditors: vec![],
            expires_at: None,
        };

        let commands = build_create_offer_commands(&config, &req);
        assert_eq!(commands.act_as, vec!["test-party"]);
        assert_eq!(commands.user_id, "ledger-api-user");
        assert_eq!(commands.commands.len(), 1);

        // Verify it's a Create command
        match &commands.commands[0].command {
            Some(proto::command::Command::Create(create)) => {
                let tid = create.template_id.as_ref().unwrap();
                assert_eq!(tid.package_id, "pkg-abc-123");
                assert_eq!(tid.module_name, "OtcOffer");
                assert_eq!(tid.entity_name, "OtcOffer");

                let record = create.create_arguments.as_ref().unwrap();
                // 16 fields in OtcOffer template
                assert_eq!(record.fields.len(), 16);
                assert_eq!(record.fields[0].label, "offerId");
                assert_eq!(record.fields[1].label, "operator");
                assert_eq!(record.fields[2].label, "initiator");
            }
            other => panic!("Expected Create command, got {:?}", other),
        }
    }

    #[test]
    fn test_build_exercise_commands_structure() {
        let config = test_config();
        let choice_arg = proto_record(vec![
            proto_field("canceller", proto_party("test-party")),
            proto_field("reason", proto_text("test")),
            proto_field("currentTime", proto_timestamp(0)),
        ]);

        let commands = build_exercise_commands(&config, "contract-123", "Cancel", choice_arg);
        assert_eq!(commands.act_as, vec!["test-party"]);
        assert_eq!(commands.commands.len(), 1);

        match &commands.commands[0].command {
            Some(proto::command::Command::Exercise(ex)) => {
                let tid = ex.template_id.as_ref().unwrap();
                assert_eq!(tid.module_name, "OtcOffer");
                assert_eq!(ex.contract_id, "contract-123");
                assert_eq!(ex.choice, "Cancel");
            }
            other => panic!("Expected Exercise command, got {:?}", other),
        }
    }

    #[test]
    fn test_build_exercise_commands_for_settlement() {
        let config = test_config();
        let choice_arg = proto_record(vec![proto_field("confirmer", proto_party("alice"))]);

        let commands = build_exercise_commands_for(
            &config,
            "settlement-456",
            "ConfirmPayment",
            choice_arg,
            "Settlement",
            "Settlement",
        );

        match &commands.commands[0].command {
            Some(proto::command::Command::Exercise(ex)) => {
                let tid = ex.template_id.as_ref().unwrap();
                assert_eq!(tid.module_name, "Settlement");
                assert_eq!(tid.entity_name, "Settlement");
                assert_eq!(ex.contract_id, "settlement-456");
                assert_eq!(ex.choice, "ConfirmPayment");
            }
            other => panic!("Expected Exercise command, got {:?}", other),
        }
    }

    #[test]
    fn test_build_exercise_commands_for_escrow() {
        let config = test_config();
        let commands = build_exercise_commands_for(
            &config,
            "escrow-789",
            "Deposit",
            proto_unit(),
            "Escrow",
            "Escrow",
        );

        match &commands.commands[0].command {
            Some(proto::command::Command::Exercise(ex)) => {
                let tid = ex.template_id.as_ref().unwrap();
                assert_eq!(tid.module_name, "Escrow");
                assert_eq!(ex.contract_id, "escrow-789");
                assert_eq!(ex.choice, "Deposit");
            }
            other => panic!("Expected Exercise command, got {:?}", other),
        }
    }
}
