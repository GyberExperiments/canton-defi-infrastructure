//! Proto builders for all DAML templates on Canton Ledger API v2.
//!
//! Provides functions to construct protobuf `Record`, `Value`, and `Command`
//! messages that match the DAML contract schemas for:
//! - OtcOffer (exercise choices: Accept, Cancel, Expire, Settle, Dispute, Activate)
//! - Collateral (CREATE + exercise choices: Lock, Release, Forfeit, Withdraw, TopUp, AutoRelease)
//! - Escrow (CREATE + exercise choices: Deposit, Release, PartialRelease, Refund,
//!   Dispute, Arbitrate, ExecuteArbitration, CancelEscrow, ExtendDeadline, AutoExpire)
//! - Settlement (CREATE + exercise choices: ConfirmPayment, AddConfirmation,
//!   CompleteSettlement, DisputeSettlement, ResolveDispute, FailSettlement,
//!   ExtendDeadline, TimeoutSettlement)

use canton_ledger_api::generated::com::daml::ledger::api::v2 as proto;
use chrono::Utc;

// ============================================================================
// Proto value helpers (mirrors handlers.rs helpers, made public for reuse)
// ============================================================================

/// Build a DAML Text value.
pub fn proto_text(s: impl Into<String>) -> Option<proto::Value> {
    Some(proto::Value {
        sum: Some(proto::value::Sum::Text(s.into())),
    })
}

/// Build a DAML Party value.
pub fn proto_party(s: impl Into<String>) -> Option<proto::Value> {
    Some(proto::Value {
        sum: Some(proto::value::Sum::Party(s.into())),
    })
}

/// Build a DAML Numeric (Decimal) value from a string representation.
pub fn proto_numeric(v: &str) -> Option<proto::Value> {
    Some(proto::Value {
        sum: Some(proto::value::Sum::Numeric(v.to_string())),
    })
}

/// Build a DAML Int64 value.
pub fn proto_int64(v: i64) -> Option<proto::Value> {
    Some(proto::Value {
        sum: Some(proto::value::Sum::Int64(v)),
    })
}

/// Build a DAML Timestamp value from microseconds since epoch.
pub fn proto_timestamp(micros: i64) -> Option<proto::Value> {
    Some(proto::Value {
        sum: Some(proto::value::Sum::Timestamp(micros)),
    })
}

/// Build a DAML Timestamp value set to the current UTC time.
pub fn proto_timestamp_now() -> Option<proto::Value> {
    proto_timestamp(current_time_micros())
}

/// Build a DAML Bool value.
pub fn proto_bool(v: bool) -> Option<proto::Value> {
    Some(proto::Value {
        sum: Some(proto::value::Sum::Bool(v)),
    })
}

/// Build a DAML Unit value (used as the payload for enum-style Variants).
pub fn proto_unit() -> Option<proto::Value> {
    Some(proto::Value {
        sum: Some(proto::value::Sum::Unit(())),
    })
}

/// Build a DAML Enum value (for DAML SDK 3.x enum types without fields).
///
/// In DAML SDK 3.x, data types like `data Side = Buy | Sell` are encoded
/// as `Enum { constructor }` rather than `Variant { constructor, value: Unit }`.
pub fn proto_enum(constructor: &str) -> Option<proto::Value> {
    Some(proto::Value {
        sum: Some(proto::value::Sum::Enum(proto::Enum {
            enum_id: None,
            constructor: constructor.into(),
        })),
    })
}

/// Build a DAML RecordField with a label and optional value.
pub fn proto_field(label: &str, value: Option<proto::Value>) -> proto::RecordField {
    proto::RecordField {
        label: label.into(),
        value,
    }
}

/// Build a DAML Record value (nested struct).
pub fn proto_record(fields: Vec<proto::RecordField>) -> Option<proto::Value> {
    Some(proto::Value {
        sum: Some(proto::value::Sum::Record(proto::Record {
            record_id: None,
            fields,
        })),
    })
}

/// Build a DAML Variant value (enum constructor).
///
/// `Variant.value` is `Option<Box<Value>>`, so the inner value is boxed.
pub fn proto_variant(constructor: &str, value: Option<proto::Value>) -> Option<proto::Value> {
    Some(proto::Value {
        sum: Some(proto::value::Sum::Variant(Box::new(proto::Variant {
            variant_id: None,
            constructor: constructor.into(),
            value: value.map(Box::new),
        }))),
    })
}

/// Build a DAML Optional with no value (`None`).
///
/// `Optional.value` is `Option<Box<Value>>`.
pub fn proto_optional_none() -> Option<proto::Value> {
    Some(proto::Value {
        sum: Some(proto::value::Sum::Optional(Box::new(proto::Optional {
            value: None,
        }))),
    })
}

/// Build a DAML Optional with a value (`Some`).
///
/// `Optional.value` is `Option<Box<Value>>`.
pub fn proto_optional_some(inner: Option<proto::Value>) -> Option<proto::Value> {
    Some(proto::Value {
        sum: Some(proto::value::Sum::Optional(Box::new(proto::Optional {
            value: inner.map(Box::new),
        }))),
    })
}

/// Build a DAML List value from a vector of values.
pub fn proto_list(elements: Vec<proto::Value>) -> Option<proto::Value> {
    Some(proto::Value {
        sum: Some(proto::value::Sum::List(proto::List { elements })),
    })
}

/// Build a DAML List of Text values.
pub fn proto_text_list(items: &[String]) -> Option<proto::Value> {
    let elements: Vec<proto::Value> = items
        .iter()
        .map(|s| proto::Value {
            sum: Some(proto::value::Sum::Text(s.clone())),
        })
        .collect();
    proto_list(elements)
}

/// Build a DAML List of Party values.
pub fn proto_party_list(items: &[String]) -> Option<proto::Value> {
    let elements: Vec<proto::Value> = items
        .iter()
        .map(|s| proto::Value {
            sum: Some(proto::value::Sum::Party(s.clone())),
        })
        .collect();
    proto_list(elements)
}

/// Return the current UTC timestamp in microseconds since epoch.
pub fn current_time_micros() -> i64 {
    Utc::now().timestamp_micros()
}

// ============================================================================
// Shared sub-record builders (Asset, Price)
// ============================================================================

/// Build a DAML Asset record.
///
/// Fields: symbol (Text), amount (Numeric), chain (Text), contractAddress (Optional Text)
pub fn build_asset_record(
    symbol: &str,
    amount: &str,
    chain: &str,
    contract_address: Option<&str>,
) -> Option<proto::Value> {
    let mut fields = vec![
        proto_field("symbol", proto_text(symbol)),
        proto_field("amount", proto_numeric(amount)),
        proto_field("chain", proto_text(chain)),
    ];

    fields.push(proto_field(
        "contractAddress",
        match contract_address {
            Some(addr) => proto_optional_some(proto_text(addr)),
            None => proto_optional_none(),
        },
    ));

    proto_record(fields)
}

/// Build a DAML Price record.
///
/// Fields: rate (Numeric), currency (Text)
pub fn build_price_record(rate: &str, currency: &str) -> Option<proto::Value> {
    proto_record(vec![
        proto_field("rate", proto_numeric(rate)),
        proto_field("currency", proto_text(currency)),
    ])
}

// ============================================================================
// OtcOffer exercise choice argument builders
// ============================================================================

/// Build the argument record for the OtcOffer `Activate` choice.
///
/// DAML fields: activator (Party), currentTime (Time)
pub fn build_activate_args(activator: &str) -> Option<proto::Value> {
    proto_record(vec![
        proto_field("activator", proto_party(activator)),
        proto_field("currentTime", proto_timestamp_now()),
    ])
}

/// Build the argument record for the OtcOffer `Accept` choice.
///
/// DAML fields: acceptor (Party), requestedQuantity (Decimal),
///              complianceOk (Bool), currentTime (Time), paymentProof (Text)
pub fn build_accept_args(
    acceptor: &str,
    requested_quantity: &str,
    compliance_ok: bool,
    payment_proof: &str,
) -> Option<proto::Value> {
    proto_record(vec![
        proto_field("acceptor", proto_party(acceptor)),
        proto_field("requestedQuantity", proto_numeric(requested_quantity)),
        proto_field("complianceOk", proto_bool(compliance_ok)),
        proto_field("currentTime", proto_timestamp_now()),
        proto_field("paymentProof", proto_text(payment_proof)),
    ])
}

/// Build the argument record for the OtcOffer `Cancel` choice.
///
/// DAML fields: canceller (Party), reason (Text), currentTime (Time)
pub fn build_cancel_args(canceller: &str, reason: &str) -> Option<proto::Value> {
    proto_record(vec![
        proto_field("canceller", proto_party(canceller)),
        proto_field("reason", proto_text(reason)),
        proto_field("currentTime", proto_timestamp_now()),
    ])
}

/// Build the argument record for the OtcOffer `Expire` choice.
///
/// DAML fields: currentTime (Time)
/// Controller: operator (implicit from template)
pub fn build_expire_args() -> Option<proto::Value> {
    proto_record(vec![
        proto_field("currentTime", proto_timestamp_now()),
    ])
}

/// Build the argument record for the OtcOffer `Settle` choice.
///
/// DAML fields: settler (Party), confirmationCount (Int), currentTime (Time)
pub fn build_settle_args(settler: &str, confirmation_count: i64) -> Option<proto::Value> {
    proto_record(vec![
        proto_field("settler", proto_party(settler)),
        proto_field("confirmationCount", proto_int64(confirmation_count)),
        proto_field("currentTime", proto_timestamp_now()),
    ])
}

/// Build the argument record for the OtcOffer `Dispute` choice.
///
/// DAML fields: disputer (Party), reason (Text), currentTime (Time)
pub fn build_dispute_args(disputer: &str, reason: &str) -> Option<proto::Value> {
    proto_record(vec![
        proto_field("disputer", proto_party(disputer)),
        proto_field("reason", proto_text(reason)),
        proto_field("currentTime", proto_timestamp_now()),
    ])
}

// ============================================================================
// Collateral builders
// ============================================================================

/// Request struct for creating a Collateral contract on the ledger.
#[derive(Debug, Clone)]
pub struct CreateCollateralRequest {
    pub collateral_id: String,
    pub offer_id: Option<String>,
    pub operator: String,
    pub owner: String,
    pub beneficiary: Option<String>,
    /// Asset fields
    pub asset_symbol: String,
    pub asset_amount: String,
    pub asset_chain: String,
    pub asset_contract_address: Option<String>,
    pub initial_amount: String,
    pub current_amount: String,
    pub locked_amount: String,
    /// Lock expiration in microseconds since epoch (None if not locked)
    pub locked_until: Option<i64>,
    /// One of: CollateralAvailable, CollateralLocked, CollateralReleased,
    /// CollateralForfeited, CollateralLiquidated
    pub status: String,
    /// Creation time in microseconds since epoch (None = use current time)
    pub created_at: Option<i64>,
    /// Update time in microseconds since epoch (None = use current time)
    pub updated_at: Option<i64>,
    pub auditors: Vec<String>,
}

/// Build a proto Record for the DAML Collateral template (16 fields).
///
/// Fields: collateralId, offerId, operator, owner, beneficiary, asset,
///         initialAmount, currentAmount, lockedAmount, lockedUntil,
///         status, createdAt, updatedAt, auditors
pub fn build_create_collateral_record(req: &CreateCollateralRequest) -> proto::Record {
    let now = current_time_micros();
    let created_at = req.created_at.unwrap_or(now);
    let updated_at = req.updated_at.unwrap_or(now);

    proto::Record {
        record_id: None,
        fields: vec![
            // === Identification ===
            proto_field("collateralId", proto_text(&req.collateral_id)),
            proto_field(
                "offerId",
                match &req.offer_id {
                    Some(id) => proto_optional_some(proto_text(id)),
                    None => proto_optional_none(),
                },
            ),
            // === Parties ===
            proto_field("operator", proto_party(&req.operator)),
            proto_field("owner", proto_party(&req.owner)),
            proto_field(
                "beneficiary",
                match &req.beneficiary {
                    Some(b) => proto_optional_some(proto_party(b)),
                    None => proto_optional_none(),
                },
            ),
            // === Collateral Details ===
            proto_field(
                "asset",
                build_asset_record(
                    &req.asset_symbol,
                    &req.asset_amount,
                    &req.asset_chain,
                    req.asset_contract_address.as_deref(),
                ),
            ),
            proto_field("initialAmount", proto_numeric(&req.initial_amount)),
            proto_field("currentAmount", proto_numeric(&req.current_amount)),
            // === Lock Details ===
            proto_field("lockedAmount", proto_numeric(&req.locked_amount)),
            proto_field(
                "lockedUntil",
                match req.locked_until {
                    Some(micros) => proto_optional_some(proto_timestamp(micros)),
                    None => proto_optional_none(),
                },
            ),
            // === Status & Timing ===
            proto_field("status", proto_enum(&req.status)),
            proto_field("createdAt", proto_timestamp(created_at)),
            proto_field("updatedAt", proto_timestamp(updated_at)),
            // === Observers ===
            proto_field("auditors", proto_party_list(&req.auditors)),
        ],
    }
}

/// Build the argument record for the Collateral `Lock` choice.
///
/// DAML fields: locker (Party), amount (Decimal), lockOfferId (Text),
///              lockDuration (RelTime), currentTime (Time)
///
/// Note: `lock_duration_micros` is the lock duration in microseconds (DAML RelTime).
pub fn build_collateral_lock_args(
    locker: &str,
    amount: &str,
    lock_offer_id: &str,
    lock_duration_micros: i64,
) -> Option<proto::Value> {
    proto_record(vec![
        proto_field("locker", proto_party(locker)),
        proto_field("amount", proto_numeric(amount)),
        proto_field("lockOfferId", proto_text(lock_offer_id)),
        proto_field("lockDuration", proto_int64(lock_duration_micros)),
        proto_field("currentTime", proto_timestamp_now()),
    ])
}

/// Build the argument record for the Collateral `Release` choice.
///
/// DAML fields: releaser (Party), amount (Decimal), currentTime (Time)
pub fn build_collateral_release_args(releaser: &str, amount: &str) -> Option<proto::Value> {
    proto_record(vec![
        proto_field("releaser", proto_party(releaser)),
        proto_field("amount", proto_numeric(amount)),
        proto_field("currentTime", proto_timestamp_now()),
    ])
}

/// Build the argument record for the Collateral `Forfeit` choice.
///
/// DAML fields: forfeiter (Party), forfeitAmount (Decimal), reason (Text),
///              toBeneficiary (Party), currentTime (Time)
pub fn build_collateral_forfeit_args(
    forfeiter: &str,
    forfeit_amount: &str,
    reason: &str,
    to_beneficiary: &str,
) -> Option<proto::Value> {
    proto_record(vec![
        proto_field("forfeiter", proto_party(forfeiter)),
        proto_field("forfeitAmount", proto_numeric(forfeit_amount)),
        proto_field("reason", proto_text(reason)),
        proto_field("toBeneficiary", proto_party(to_beneficiary)),
        proto_field("currentTime", proto_timestamp_now()),
    ])
}

/// Build the argument record for the Collateral `Withdraw` choice.
///
/// DAML fields: withdrawer (Party), amount (Decimal), currentTime (Time)
pub fn build_collateral_withdraw_args(withdrawer: &str, amount: &str) -> Option<proto::Value> {
    proto_record(vec![
        proto_field("withdrawer", proto_party(withdrawer)),
        proto_field("amount", proto_numeric(amount)),
        proto_field("currentTime", proto_timestamp_now()),
    ])
}

/// Build the argument record for the Collateral `TopUp` choice.
///
/// DAML fields: topper (Party), additionalAmount (Decimal),
///              depositProof (Text), currentTime (Time)
pub fn build_collateral_topup_args(
    topper: &str,
    additional_amount: &str,
    deposit_proof: &str,
) -> Option<proto::Value> {
    proto_record(vec![
        proto_field("topper", proto_party(topper)),
        proto_field("additionalAmount", proto_numeric(additional_amount)),
        proto_field("depositProof", proto_text(deposit_proof)),
        proto_field("currentTime", proto_timestamp_now()),
    ])
}

/// Build the argument record for the Collateral `AutoRelease` choice.
///
/// DAML fields: releaser (Party), currentTime (Time)
pub fn build_collateral_auto_release_args(releaser: &str) -> Option<proto::Value> {
    proto_record(vec![
        proto_field("releaser", proto_party(releaser)),
        proto_field("currentTime", proto_timestamp_now()),
    ])
}

// ============================================================================
// Escrow builders
// ============================================================================

/// Request struct for creating an Escrow contract on the ledger.
#[derive(Debug, Clone)]
pub struct CreateEscrowRequest {
    pub escrow_id: String,
    pub offer_id: String,
    pub trade_id: Option<String>,
    pub operator: String,
    pub buyer: String,
    pub seller: String,
    pub arbiter: String,
    /// Asset fields
    pub asset_symbol: String,
    pub asset_amount: String,
    pub asset_chain: String,
    pub asset_contract_address: Option<String>,
    pub amount: String,
    pub deposited_amount: String,
    pub release_conditions: String,
    pub refund_conditions: String,
    /// One of: Created, Deposited, Released, Refunded, Disputed, Arbitrated
    pub status: String,
    /// Creation time in microseconds since epoch (None = use current time)
    pub created_at: Option<i64>,
    /// Update time in microseconds since epoch (None = use current time)
    pub updated_at: Option<i64>,
    /// Deadline in microseconds since epoch
    pub deadline: i64,
    pub extension_count: i64,
    pub max_extensions: i64,
    pub dispute_reason: Option<String>,
    pub arbitration_decision: Option<String>,
    pub arbiter_favors_buyer: Option<bool>,
    pub auditors: Vec<String>,
}

/// Build a proto Record for the DAML Escrow template (22 fields).
///
/// Fields: escrowId, offerId, tradeId, operator, buyer, seller, arbiter,
///         asset, amount, depositedAmount, releaseConditions, refundConditions,
///         status, createdAt, updatedAt, deadline, extensionCount, maxExtensions,
///         disputeReason, arbitrationDecision, arbiterFavorsBuyer, auditors
pub fn build_create_escrow_record(req: &CreateEscrowRequest) -> proto::Record {
    let now = current_time_micros();
    let created_at = req.created_at.unwrap_or(now);
    let updated_at = req.updated_at.unwrap_or(now);

    proto::Record {
        record_id: None,
        fields: vec![
            // === Identification ===
            proto_field("escrowId", proto_text(&req.escrow_id)),
            proto_field("offerId", proto_text(&req.offer_id)),
            proto_field(
                "tradeId",
                match &req.trade_id {
                    Some(t) => proto_optional_some(proto_text(t)),
                    None => proto_optional_none(),
                },
            ),
            // === Parties ===
            proto_field("operator", proto_party(&req.operator)),
            proto_field("buyer", proto_party(&req.buyer)),
            proto_field("seller", proto_party(&req.seller)),
            proto_field("arbiter", proto_party(&req.arbiter)),
            // === Escrow Details ===
            proto_field(
                "asset",
                build_asset_record(
                    &req.asset_symbol,
                    &req.asset_amount,
                    &req.asset_chain,
                    req.asset_contract_address.as_deref(),
                ),
            ),
            proto_field("amount", proto_numeric(&req.amount)),
            proto_field("depositedAmount", proto_numeric(&req.deposited_amount)),
            // === Terms ===
            proto_field("releaseConditions", proto_text(&req.release_conditions)),
            proto_field("refundConditions", proto_text(&req.refund_conditions)),
            // === Status & Timing ===
            proto_field("status", proto_enum(&req.status)),
            proto_field("createdAt", proto_timestamp(created_at)),
            proto_field("updatedAt", proto_timestamp(updated_at)),
            proto_field("deadline", proto_timestamp(req.deadline)),
            proto_field("extensionCount", proto_int64(req.extension_count)),
            proto_field("maxExtensions", proto_int64(req.max_extensions)),
            // === Dispute Management ===
            proto_field(
                "disputeReason",
                match &req.dispute_reason {
                    Some(r) => proto_optional_some(proto_text(r)),
                    None => proto_optional_none(),
                },
            ),
            proto_field(
                "arbitrationDecision",
                match &req.arbitration_decision {
                    Some(d) => proto_optional_some(proto_text(d)),
                    None => proto_optional_none(),
                },
            ),
            proto_field(
                "arbiterFavorsBuyer",
                match req.arbiter_favors_buyer {
                    Some(b) => proto_optional_some(proto_bool(b)),
                    None => proto_optional_none(),
                },
            ),
            // === Observers ===
            proto_field("auditors", proto_party_list(&req.auditors)),
        ],
    }
}

/// Build the argument record for the Escrow `Deposit` choice.
///
/// DAML fields: depositor (Party), depositAmount (Decimal),
///              depositProof (Text), currentTime (Time)
pub fn build_escrow_deposit_args(
    depositor: &str,
    deposit_amount: &str,
    deposit_proof: &str,
) -> Option<proto::Value> {
    proto_record(vec![
        proto_field("depositor", proto_party(depositor)),
        proto_field("depositAmount", proto_numeric(deposit_amount)),
        proto_field("depositProof", proto_text(deposit_proof)),
        proto_field("currentTime", proto_timestamp_now()),
    ])
}

/// Build the argument record for the Escrow `Release` choice.
///
/// DAML fields: releaser (Party), releaseProof (Text), currentTime (Time)
pub fn build_escrow_release_args(releaser: &str, release_proof: &str) -> Option<proto::Value> {
    proto_record(vec![
        proto_field("releaser", proto_party(releaser)),
        proto_field("releaseProof", proto_text(release_proof)),
        proto_field("currentTime", proto_timestamp_now()),
    ])
}

/// Build the argument record for the Escrow `PartialRelease` choice.
///
/// DAML fields: releaser (Party), releaseAmount (Decimal),
///              releaseProof (Text), currentTime (Time)
pub fn build_escrow_partial_release_args(
    releaser: &str,
    release_amount: &str,
    release_proof: &str,
) -> Option<proto::Value> {
    proto_record(vec![
        proto_field("releaser", proto_party(releaser)),
        proto_field("releaseAmount", proto_numeric(release_amount)),
        proto_field("releaseProof", proto_text(release_proof)),
        proto_field("currentTime", proto_timestamp_now()),
    ])
}

/// Build the argument record for the Escrow `Refund` choice.
///
/// DAML fields: refunder (Party), refundReason (Text), currentTime (Time)
pub fn build_escrow_refund_args(refunder: &str, refund_reason: &str) -> Option<proto::Value> {
    proto_record(vec![
        proto_field("refunder", proto_party(refunder)),
        proto_field("refundReason", proto_text(refund_reason)),
        proto_field("currentTime", proto_timestamp_now()),
    ])
}

/// Build the argument record for the Escrow `Dispute` choice.
///
/// DAML fields: disputer (Party), reason (Text), currentTime (Time)
pub fn build_escrow_dispute_args(disputer: &str, reason: &str) -> Option<proto::Value> {
    proto_record(vec![
        proto_field("disputer", proto_party(disputer)),
        proto_field("reason", proto_text(reason)),
        proto_field("currentTime", proto_timestamp_now()),
    ])
}

/// Build the argument record for the Escrow `Arbitrate` choice.
///
/// DAML fields: arbitrator (Party), decision (Text),
///              favorBuyer (Bool), currentTime (Time)
pub fn build_escrow_arbitrate_args(
    arbitrator: &str,
    decision: &str,
    favor_buyer: bool,
) -> Option<proto::Value> {
    proto_record(vec![
        proto_field("arbitrator", proto_party(arbitrator)),
        proto_field("decision", proto_text(decision)),
        proto_field("favorBuyer", proto_bool(favor_buyer)),
        proto_field("currentTime", proto_timestamp_now()),
    ])
}

/// Build the argument record for the Escrow `ExecuteArbitration` choice.
///
/// DAML fields: executor (Party), currentTime (Time)
pub fn build_escrow_execute_arbitration_args(executor: &str) -> Option<proto::Value> {
    proto_record(vec![
        proto_field("executor", proto_party(executor)),
        proto_field("currentTime", proto_timestamp_now()),
    ])
}

/// Build the argument record for the Escrow `CancelEscrow` choice.
///
/// DAML fields: canceller (Party), reason (Text), currentTime (Time)
pub fn build_escrow_cancel_args(canceller: &str, reason: &str) -> Option<proto::Value> {
    proto_record(vec![
        proto_field("canceller", proto_party(canceller)),
        proto_field("reason", proto_text(reason)),
        proto_field("currentTime", proto_timestamp_now()),
    ])
}

/// Build the argument record for the Escrow `ExtendDeadline` choice.
///
/// DAML fields: extender (Party), newDeadline (Time), currentTime (Time)
///
/// `new_deadline_micros` is the new deadline as microseconds since epoch.
pub fn build_escrow_extend_deadline_args(
    extender: &str,
    new_deadline_micros: i64,
) -> Option<proto::Value> {
    proto_record(vec![
        proto_field("extender", proto_party(extender)),
        proto_field("newDeadline", proto_timestamp(new_deadline_micros)),
        proto_field("currentTime", proto_timestamp_now()),
    ])
}

/// Build the argument record for the Escrow `AutoExpire` choice.
///
/// DAML fields: expirer (Party), currentTime (Time)
pub fn build_escrow_auto_expire_args(expirer: &str) -> Option<proto::Value> {
    proto_record(vec![
        proto_field("expirer", proto_party(expirer)),
        proto_field("currentTime", proto_timestamp_now()),
    ])
}

// ============================================================================
// Settlement builders
// ============================================================================

/// Request struct for creating a Settlement contract on the ledger.
#[derive(Debug, Clone)]
pub struct CreateSettlementRequest {
    pub settlement_id: String,
    pub offer_id: String,
    pub trade_id: String,
    pub operator: String,
    pub buyer: String,
    pub seller: String,
    /// Asset fields
    pub asset_symbol: String,
    pub asset_amount: String,
    pub asset_chain: String,
    pub asset_contract_address: Option<String>,
    pub quantity: String,
    /// Price fields
    pub price_rate: String,
    pub price_currency: String,
    pub total_amount: String,
    pub payment_proof: String,
    pub confirmations: i64,
    pub required_confirmations: i64,
    /// One of: PendingPayment, PaymentReceived, Confirming, Completed, Disputed, Failed
    pub status: String,
    /// Creation time in microseconds since epoch (None = use current time)
    pub created_at: Option<i64>,
    /// Update time in microseconds since epoch (None = use current time)
    pub updated_at: Option<i64>,
    /// Completion time in microseconds since epoch (None if not completed)
    pub completed_at: Option<i64>,
    /// Deadline in microseconds since epoch
    pub deadline: i64,
    pub extension_count: i64,
    pub auditors: Vec<String>,
}

/// Build a proto Record for the DAML Settlement template (20 fields).
///
/// Fields: settlementId, offerId, tradeId, operator, buyer, seller,
///         asset, quantity, price, totalAmount, paymentProof,
///         confirmations, requiredConfirmations, status,
///         createdAt, updatedAt, completedAt, deadline,
///         extensionCount, auditors
pub fn build_create_settlement_record(req: &CreateSettlementRequest) -> proto::Record {
    let now = current_time_micros();
    let created_at = req.created_at.unwrap_or(now);
    let updated_at = req.updated_at.unwrap_or(now);

    proto::Record {
        record_id: None,
        fields: vec![
            // === Identification ===
            proto_field("settlementId", proto_text(&req.settlement_id)),
            proto_field("offerId", proto_text(&req.offer_id)),
            proto_field("tradeId", proto_text(&req.trade_id)),
            // === Parties ===
            proto_field("operator", proto_party(&req.operator)),
            proto_field("buyer", proto_party(&req.buyer)),
            proto_field("seller", proto_party(&req.seller)),
            // === Settlement Details ===
            proto_field(
                "asset",
                build_asset_record(
                    &req.asset_symbol,
                    &req.asset_amount,
                    &req.asset_chain,
                    req.asset_contract_address.as_deref(),
                ),
            ),
            proto_field("quantity", proto_numeric(&req.quantity)),
            proto_field(
                "price",
                build_price_record(&req.price_rate, &req.price_currency),
            ),
            proto_field("totalAmount", proto_numeric(&req.total_amount)),
            // === Payment Tracking ===
            proto_field("paymentProof", proto_text(&req.payment_proof)),
            proto_field("confirmations", proto_int64(req.confirmations)),
            proto_field(
                "requiredConfirmations",
                proto_int64(req.required_confirmations),
            ),
            // === Status & Timing ===
            proto_field("status", proto_enum(&req.status)),
            proto_field("createdAt", proto_timestamp(created_at)),
            proto_field("updatedAt", proto_timestamp(updated_at)),
            proto_field(
                "completedAt",
                match req.completed_at {
                    Some(micros) => proto_optional_some(proto_timestamp(micros)),
                    None => proto_optional_none(),
                },
            ),
            proto_field("deadline", proto_timestamp(req.deadline)),
            proto_field("extensionCount", proto_int64(req.extension_count)),
            // === Observers ===
            proto_field("auditors", proto_party_list(&req.auditors)),
        ],
    }
}

/// Build the argument record for the Settlement `ConfirmPayment` choice.
///
/// DAML fields: confirmer (Party), paymentTxHash (Text), currentTime (Time)
pub fn build_settlement_confirm_args(
    confirmer: &str,
    payment_tx_hash: &str,
) -> Option<proto::Value> {
    proto_record(vec![
        proto_field("confirmer", proto_party(confirmer)),
        proto_field("paymentTxHash", proto_text(payment_tx_hash)),
        proto_field("currentTime", proto_timestamp_now()),
    ])
}

/// Build the argument record for the Settlement `AddConfirmation` choice.
///
/// DAML fields: confirmer (Party), currentTime (Time)
pub fn build_settlement_add_confirmation_args(confirmer: &str) -> Option<proto::Value> {
    proto_record(vec![
        proto_field("confirmer", proto_party(confirmer)),
        proto_field("currentTime", proto_timestamp_now()),
    ])
}

/// Build the argument record for the Settlement `CompleteSettlement` choice.
///
/// DAML fields: completer (Party), currentTime (Time)
pub fn build_settlement_complete_args(completer: &str) -> Option<proto::Value> {
    proto_record(vec![
        proto_field("completer", proto_party(completer)),
        proto_field("currentTime", proto_timestamp_now()),
    ])
}

/// Build the argument record for the Settlement `DisputeSettlement` choice.
///
/// DAML fields: disputer (Party), reason (Text), currentTime (Time)
pub fn build_settlement_dispute_args(disputer: &str, reason: &str) -> Option<proto::Value> {
    proto_record(vec![
        proto_field("disputer", proto_party(disputer)),
        proto_field("reason", proto_text(reason)),
        proto_field("currentTime", proto_timestamp_now()),
    ])
}

/// Build the argument record for the Settlement `ResolveDispute` choice.
///
/// DAML fields: resolver (Party), resolution (Text),
///              continueSettlement (Bool), currentTime (Time)
pub fn build_settlement_resolve_dispute_args(
    resolver: &str,
    resolution: &str,
    continue_settlement: bool,
) -> Option<proto::Value> {
    proto_record(vec![
        proto_field("resolver", proto_party(resolver)),
        proto_field("resolution", proto_text(resolution)),
        proto_field("continueSettlement", proto_bool(continue_settlement)),
        proto_field("currentTime", proto_timestamp_now()),
    ])
}

/// Build the argument record for the Settlement `FailSettlement` choice.
///
/// DAML fields: failer (Party), reason (Text), currentTime (Time)
pub fn build_settlement_fail_args(failer: &str, reason: &str) -> Option<proto::Value> {
    proto_record(vec![
        proto_field("failer", proto_party(failer)),
        proto_field("reason", proto_text(reason)),
        proto_field("currentTime", proto_timestamp_now()),
    ])
}

/// Build the argument record for the Settlement `ExtendDeadline` choice.
///
/// DAML fields: extender (Party), newDeadline (Time), currentTime (Time)
///
/// `new_deadline_micros` is the new deadline as microseconds since epoch.
pub fn build_settlement_extend_deadline_args(
    extender: &str,
    new_deadline_micros: i64,
) -> Option<proto::Value> {
    proto_record(vec![
        proto_field("extender", proto_party(extender)),
        proto_field("newDeadline", proto_timestamp(new_deadline_micros)),
        proto_field("currentTime", proto_timestamp_now()),
    ])
}

/// Build the argument record for the Settlement `TimeoutSettlement` choice.
///
/// DAML fields: timeoutOperator (Party), currentTime (Time)
pub fn build_settlement_timeout_args(timeout_operator: &str) -> Option<proto::Value> {
    proto_record(vec![
        proto_field("timeoutOperator", proto_party(timeout_operator)),
        proto_field("currentTime", proto_timestamp_now()),
    ])
}

// ============================================================================
// Generic exercise command builder
// ============================================================================

/// Build a proto `Command` for exercising a choice on a DAML contract.
///
/// This constructs a single `ExerciseCommand` that can be included in a
/// `Commands` message for submission to the Canton Ledger API.
///
/// # Arguments
/// * `package_id` - The DAML package ID (hex hash)
/// * `module_name` - The DAML module name (e.g., "OtcOffer", "Collateral")
/// * `entity_name` - The DAML entity/template name (e.g., "OtcOffer", "Escrow")
/// * `contract_id` - The contract ID to exercise the choice on
/// * `choice_name` - The choice name (e.g., "Accept", "Lock", "Deposit")
/// * `choice_args` - The choice argument record
pub fn build_exercise_command(
    package_id: &str,
    module_name: &str,
    entity_name: &str,
    contract_id: &str,
    choice_name: &str,
    choice_args: Option<proto::Value>,
) -> proto::Command {
    let template_id = proto::Identifier {
        package_id: package_id.into(),
        module_name: module_name.into(),
        entity_name: entity_name.into(),
    };

    proto::Command {
        command: Some(proto::command::Command::Exercise(proto::ExerciseCommand {
            template_id: Some(template_id),
            contract_id: contract_id.into(),
            choice: choice_name.into(),
            choice_argument: choice_args,
        })),
    }
}

/// Build a proto `Command` for creating a DAML contract.
///
/// # Arguments
/// * `package_id` - The DAML package ID (hex hash)
/// * `module_name` - The DAML module name (e.g., "Collateral", "Escrow", "Settlement")
/// * `entity_name` - The DAML entity/template name
/// * `record` - The create arguments record
pub fn build_create_command(
    package_id: &str,
    module_name: &str,
    entity_name: &str,
    record: proto::Record,
) -> proto::Command {
    let template_id = proto::Identifier {
        package_id: package_id.into(),
        module_name: module_name.into(),
        entity_name: entity_name.into(),
    };

    let mut record_with_id = record;
    record_with_id.record_id = Some(template_id.clone());

    proto::Command {
        command: Some(proto::command::Command::Create(proto::CreateCommand {
            template_id: Some(template_id),
            create_arguments: Some(record_with_id),
        })),
    }
}
