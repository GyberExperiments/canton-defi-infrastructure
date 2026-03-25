//! Core domain types for the Canton-BSC bridge.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;
use std::fmt;
use std::str::FromStr;

// ─────────────────────────────────────────────────────────────
// Transfer Identification
// ─────────────────────────────────────────────────────────────

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

impl FromStr for TransferId {
    type Err = uuid::Error;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Ok(Self(Uuid::parse_str(s)?))
    }
}

// ─────────────────────────────────────────────────────────────
// Transfer Direction
// ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "transfer_direction", rename_all = "snake_case")]
pub enum TransferDirection {
    CantonToBsc,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type, Hash)]
#[sqlx(type_name = "transfer_status", rename_all = "snake_case")]
pub enum TransferStatus {
    Initiated,
    CantonLocking,
    CantonLocked,
    BscMinting,
    BscMinted,
    BscBurned,
    BscBurnFinalized,
    CantonUnlocking,
    CantonUnlocked,
    Completed,
    Failed,
    RollingBack,
    RolledBack,
    Stuck,
}

impl TransferStatus {
    pub fn is_terminal(&self) -> bool {
        matches!(self, Self::Completed | Self::RolledBack)
    }

    pub fn needs_intervention(&self) -> bool {
        matches!(self, Self::Failed | Self::Stuck)
    }

    pub fn is_in_flight(&self) -> bool {
        matches!(
            self,
            Self::CantonLocking | Self::BscMinting | Self::CantonUnlocking | Self::RollingBack
        )
    }

    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            Self::CantonLocking | Self::BscMinting | Self::CantonUnlocking
        )
    }

    pub fn can_transition_to(&self, next: &TransferStatus) -> bool {
        use TransferDirection::*;
        use TransferStatus::*;
        matches!(
            (self, next),
            (Initiated, CantonLocking)
                | (Initiated, BscBurned)
                | (CantonLocking, CantonLocked)
                | (CantonLocked, BscMinting)
                | (BscMinting, BscMinted)
                | (BscMinted, Completed)
                | (BscBurned, BscBurnFinalized)
                | (BscBurnFinalized, CantonUnlocking)
                | (CantonUnlocking, CantonUnlocked)
                | (CantonUnlocked, Completed)
                | (Initiated, Failed)
                | (CantonLocking, Failed)
                | (CantonLocked, Failed)
                | (BscMinting, Failed)
                | (BscMinted, Failed)
                | (BscBurned, Failed)
                | (BscBurnFinalized, Failed)
                | (CantonUnlocking, Failed)
                | (CantonUnlocked, Failed)
                | (Failed, CantonLocking)
                | (Failed, BscMinting)
                | (Failed, CantonUnlocking)
                | (Failed, Stuck)
                | (Failed, RollingBack)
                | (Stuck, RollingBack)
                | (RollingBack, RolledBack)
                | (RollingBack, Failed)
        )
    }

    pub fn can_transition_to_with_direction(
        &self,
        next: &TransferStatus,
        direction: TransferDirection,
    ) -> bool {
        use TransferDirection::*;
        use TransferStatus::*;
        if !self.can_transition_to(next) {
            return false;
        }
        match (self, next, direction) {
            (Initiated, CantonLocking, BscToCanton) => false,
            (Initiated, BscBurned, CantonToBsc) => false,
            _ => true,
        }
    }

    pub fn description(&self) -> &'static str {
        match self {
            Self::Initiated => "Transfer initiated",
            Self::CantonLocking => "Locking asset on Canton",
            Self::CantonLocked => "Asset locked on Canton",
            Self::BscMinting => "Minting on BSC",
            Self::BscMinted => "Minted on BSC",
            Self::BscBurned => "Burn detected on BSC",
            Self::BscBurnFinalized => "BSC burn finalized",
            Self::CantonUnlocking => "Unlocking on Canton",
            Self::CantonUnlocked => "Asset unlocked on Canton",
            Self::Completed => "Completed",
            Self::Failed => "Failed",
            Self::RollingBack => "Rolling back",
            Self::RolledBack => "Rolled back",
            Self::Stuck => "Stuck",
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

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct CantonParty(pub String);

impl CantonParty {
    pub fn new(party: impl Into<String>) -> Self {
        Self(party.into())
    }

    pub fn validate(&self) -> bool {
        self.0.contains("::")
    }
}

impl fmt::Display for CantonParty {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

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

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct CantonOffset(pub String);

impl CantonOffset {
    pub fn new(offset: impl Into<String>) -> Self {
        Self(offset.into())
    }

    pub fn begin() -> Self {
        Self(String::new())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct CantonCommandId(pub String);

impl CantonCommandId {
    pub fn for_transfer(transfer_id: &TransferId, step: &str) -> Self {
        Self(format!("bridge-{}-{}", transfer_id, step))
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct CantonWorkflowId(pub String);

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct CantonTemplateId {
    pub package_id: String,
    pub module_name: String,
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

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct BscAddress(pub String);

impl BscAddress {
    pub fn new(addr: impl Into<String>) -> Self {
        let s = addr.into();
        let normalized = if s.starts_with("0x") || s.starts_with("0X") {
            format!("0x{}", &s[2..].to_lowercase())
        } else {
            format!("0x{}", s.to_lowercase())
        };
        Self(normalized)
    }

    pub fn validate(&self) -> bool {
        let s = self.0.strip_prefix("0x").unwrap_or(&self.0);
        s.len() == 40 && s.chars().all(|c| c.is_ascii_hexdigit())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    pub fn zero() -> Self {
        Self("0x0000000000000000000000000000000000000000".to_string())
    }
}

impl fmt::Display for BscAddress {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BscBlock {
    pub number: u64,
    pub hash: String,
    pub timestamp: DateTime<Utc>,
}

// ─────────────────────────────────────────────────────────────
// Amount & Asset Types
// ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Amount {
    pub raw: String,
    pub decimals: u8,
}

impl Amount {
    pub fn from_base_units(raw: impl Into<String>, decimals: u8) -> Self {
        Self {
            raw: raw.into(),
            decimals,
        }
    }

    pub fn from_human(value: &str, decimals: u8) -> Result<Self, AmountParseError> {
        let parts: Vec<&str> = value.split('.').collect();
        match parts.len() {
            1 => {
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

    pub fn to_u128(&self) -> Result<u128, std::num::ParseIntError> {
        self.raw.parse()
    }

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

    pub fn is_zero(&self) -> bool {
        self.raw == "0" || self.raw.chars().all(|c| c == '0')
    }

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferErrorLog {
    pub timestamp: DateTime<Utc>,
    pub stage: TransferStatus,
    pub error_code: String,
    pub message: String,
    pub recoverable: bool,
    pub retry_count: u32,
}

#[derive(Debug, Clone, thiserror::Error)]
pub enum AmountParseError {
    #[error("Invalid amount format: {0}")]
    InvalidFormat(String),
    #[error("Amount overflow")]
    Overflow,
    #[error("Too many decimals: got {got}, max {max}")]
    TooManyDecimals { got: u8, max: u8 },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Validate)]
pub struct AssetId {
    pub id: String,
    pub canton_template_id: String,
    pub bsc_token_address: BscAddress,
    pub symbol: String,
    pub name: String,
    pub decimals: u8,
    pub min_transfer: Amount,
    pub max_transfer: Amount,
    pub daily_limit: Amount,
    pub enabled: bool,
}

impl AssetId {
    pub fn validate_limits(&self) -> Result<(), String> {
        if self.id.is_empty() || self.canton_template_id.is_empty() {
            return Err("id and canton_template_id required".into());
        }
        if !self.bsc_token_address.validate() {
            return Err("invalid bsc_token_address".into());
        }
        Ok(())
    }
}

// ─────────────────────────────────────────────────────────────
// Fee Types
// ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgeFee {
    pub fixed_fee: Amount,
    pub proportional_bps: u32,
    pub estimated_gas_bnb: String,
    pub total_fee: Amount,
    pub net_amount: Amount,
}

// ─────────────────────────────────────────────────────────────
// Core Transfer Record
// ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgeTransfer {
    pub id: TransferId,
    pub trace_id: String,
    pub direction: TransferDirection,
    pub status: TransferStatus,
    pub asset_id: String,
    pub amount: Amount,
    pub fee: Option<BridgeFee>,

    pub canton_party: CantonParty,
    pub canton_contract_id: Option<CantonContractId>,
    pub canton_command_id: Option<String>,
    pub canton_tx_id: Option<String>,
    pub canton_offset: Option<CantonOffset>,

    pub bsc_address: BscAddress,
    pub bsc_tx_hash: Option<BscTxHash>,
    pub bsc_block_number: Option<u64>,
    pub bsc_confirmations: Option<u64>,

    pub retry_count: u32,
    pub max_retries: u32,
    pub error_message: Option<String>,
    pub error_history: Vec<TransferErrorLog>,
    pub nonce: String,
    pub next_retry_at: Option<DateTime<Utc>>,

    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

impl BridgeTransfer {
    fn trace_id_default() -> String {
        Uuid::new_v4().to_string()
    }

    pub fn new_canton_to_bsc(
        canton_party: CantonParty,
        bsc_address: BscAddress,
        asset_id: String,
        amount: Amount,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: TransferId::new(),
            trace_id: Self::trace_id_default(),
            direction: TransferDirection::CantonToBsc,
            status: TransferStatus::Initiated,
            asset_id,
            amount,
            fee: None,
            canton_party,
            canton_contract_id: None,
            canton_command_id: None,
            canton_tx_id: None,
            canton_offset: None,
            bsc_address,
            bsc_tx_hash: None,
            bsc_block_number: None,
            bsc_confirmations: None,
            retry_count: 0,
            max_retries: 5,
            error_message: None,
            error_history: Vec::new(),
            nonce: Uuid::new_v4().to_string(),
            next_retry_at: None,
            created_at: now,
            updated_at: now,
            completed_at: None,
        }
    }

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
            trace_id: Self::trace_id_default(),
            direction: TransferDirection::BscToCanton,
            status: TransferStatus::Initiated,
            asset_id,
            amount,
            fee: None,
            canton_party,
            canton_contract_id: None,
            canton_command_id: None,
            canton_tx_id: None,
            canton_offset: None,
            bsc_address,
            bsc_tx_hash: Some(bsc_tx_hash),
            bsc_block_number: Some(bsc_block_number),
            bsc_confirmations: Some(0),
            retry_count: 0,
            max_retries: 5,
            error_message: None,
            error_history: Vec::new(),
            nonce: Uuid::new_v4().to_string(),
            next_retry_at: None,
            created_at: now,
            updated_at: now,
            completed_at: None,
        }
    }

    pub fn update_status(
        &mut self,
        new_status: TransferStatus,
        _reason: &str,
    ) -> Result<(), crate::BridgeError> {
        if !self
            .status
            .can_transition_to_with_direction(&new_status, self.direction)
        {
            return Err(crate::BridgeError::InvalidTransition(format!(
                "{:?} -> {:?}",
                self.status, new_status
            )));
        }
        self.updated_at = Utc::now();
        if new_status.is_terminal() || new_status.needs_intervention() {
            self.completed_at = Some(Utc::now());
        }
        self.status = new_status;
        Ok(())
    }

    pub fn increment_retry(&mut self, backoff_sec: u64) {
        self.retry_count += 1;
        self.next_retry_at =
            Some(Utc::now() + chrono::Duration::seconds(backoff_sec as i64));
        self.updated_at = Utc::now();
    }

    pub fn mark_stuck(&mut self) {
        self.status = TransferStatus::Stuck;
        self.updated_at = Utc::now();
        self.completed_at = Some(Utc::now());
    }
}
