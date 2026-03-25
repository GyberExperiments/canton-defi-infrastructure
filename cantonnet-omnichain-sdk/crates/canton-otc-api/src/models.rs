use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

// ─── Structured types matching DAML OtcTypes.daml ───

/// Multi-chain asset (mirrors DAML Asset)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Asset {
    pub symbol: String,
    pub amount: String, // Decimal as string to preserve precision
    pub chain: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub contract_address: Option<String>,
}

/// Price information (mirrors DAML Price)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Price {
    pub rate: String, // Decimal as string
    pub currency: String,
}

/// Volume limits (mirrors DAML VolumeLimits)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VolumeLimits {
    pub min_amount: String,
    pub max_amount: String,
}

/// Timestamps (mirrors DAML Timestamps)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Timestamps {
    pub created: String, // ISO8601 / micros since epoch
    pub updated: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
}

/// Collateral info (mirrors DAML CollateralInfo)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollateralInfo {
    pub collateral_id: String,
    pub asset: Asset,
    pub locked_until: String,
    pub status: String, // CollateralAvailable | CollateralLocked | ...
}

/// Settlement info (mirrors DAML SettlementInfo)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettlementInfo {
    pub settlement_id: String,
    pub payment_proof: String,
    pub confirmations: i32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<String>,
}

// ─── OTC Contract (full model matching DAML OtcOffer) ───

#[derive(Debug, Clone, Serialize)]
pub struct OtcContract {
    pub contract_id: String,
    pub transaction_id: String,

    // Identification
    pub offer_id: String,

    // Parties
    pub operator: String,
    pub initiator: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub counterparty: Option<String>,

    // Asset details
    pub asset: Asset,
    pub price: Price,
    pub quantity: String,

    // Trading terms
    pub side: String, // "Buy" | "Sell"
    pub limits: VolumeLimits,

    // Status & Timing
    pub status: ContractStatus,
    pub timestamps: Timestamps,

    // Settlement
    #[serde(skip_serializing_if = "Option::is_none")]
    pub collateral: Option<CollateralInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub settlement_info: Option<SettlementInfo>,

    // Compliance
    pub min_compliance_level: String,
    pub allowed_jurisdictions: Vec<String>,

    // Observers
    pub auditors: Vec<String>,

    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ContractStatus {
    Pending,
    Active,
    PartiallyFilled,
    Filled,
    Cancelled,
    Expired,
    Disputed,
    Rejected,
    Accepted,
}

pub type ContractStore = Arc<RwLock<HashMap<String, OtcContract>>>;

pub fn new_contract_store() -> ContractStore {
    Arc::new(RwLock::new(HashMap::new()))
}

// ─── Settlement Contract Model ───

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettlementContract {
    pub contract_id: String,
    pub settlement_id: String,
    pub offer_id: String,
    pub trade_id: String,
    pub operator: String,
    pub buyer: String,
    pub seller: String,
    pub asset: Asset,
    pub quantity: String,
    pub price: Price,
    pub total_amount: String,
    pub payment_proof: String,
    pub confirmations: i32,
    pub required_confirmations: i32,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<String>,
    pub deadline: String,
}

pub type SettlementStore = Arc<RwLock<HashMap<String, SettlementContract>>>;

pub fn new_settlement_store() -> SettlementStore {
    Arc::new(RwLock::new(HashMap::new()))
}

// ─── Escrow Contract Model ───

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EscrowContract {
    pub contract_id: String,
    pub escrow_id: String,
    pub offer_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trade_id: Option<String>,
    pub operator: String,
    pub buyer: String,
    pub seller: String,
    pub arbiter: String,
    pub asset: Asset,
    pub amount: String,
    pub deposited_amount: String,
    pub release_conditions: String,
    pub refund_conditions: String,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
    pub deadline: String,
}

pub type EscrowStore = Arc<RwLock<HashMap<String, EscrowContract>>>;

pub fn new_escrow_store() -> EscrowStore {
    Arc::new(RwLock::new(HashMap::new()))
}

// ─── Collateral Contract Model ───

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollateralContract {
    pub contract_id: String,
    pub collateral_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub offer_id: Option<String>,
    pub operator: String,
    pub owner: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub beneficiary: Option<String>,
    pub asset: Asset,
    pub initial_amount: String,
    pub current_amount: String,
    pub locked_amount: String,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

pub type CollateralStore = Arc<RwLock<HashMap<String, CollateralContract>>>;

pub fn new_collateral_store() -> CollateralStore {
    Arc::new(RwLock::new(HashMap::new()))
}
