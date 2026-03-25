//! Row ↔ BridgeTransfer mapping, audit entries.

use bridge_core::{
    Amount, BridgeTransfer, BscAddress, BscTxHash, CantonContractId, CantonOffset, CantonParty,
    TransferDirection, TransferId, TransferStatus,
};
use chrono::{DateTime, Utc};
use sqlx::FromRow;
use uuid::Uuid;

/// One row from transfer_audit_log for get_audit_history.
#[derive(Debug, FromRow)]
pub struct AuditLogRow {
    pub at: DateTime<Utc>,
    pub old_status: TransferStatus,
    pub new_status: TransferStatus,
    pub actor: String,
    pub reason: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

/// DB row for transfers table (for SQLx decode).
#[derive(Debug, FromRow)]
pub struct TransferRow {
    pub id: Uuid,
    pub trace_id: String,
    pub direction: TransferDirection,
    pub status: TransferStatus,
    pub asset_id: String,
    pub amount_raw: String,
    pub decimals: i16,
    pub canton_party: String,
    pub canton_contract_id: Option<String>,
    pub canton_command_id: Option<String>,
    pub canton_tx_id: Option<String>,
    pub canton_offset: Option<String>,
    pub fee_raw: Option<String>,
    pub bsc_address: String,
    pub bsc_tx_hash: Option<String>,
    pub bsc_block_number: Option<i64>,
    pub bsc_confirmations: Option<i64>,
    pub retry_count: i32,
    pub max_retries: i32,
    pub error_message: Option<String>,
    pub nonce: String,
    pub next_retry_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

impl From<TransferRow> for BridgeTransfer {
    fn from(r: TransferRow) -> Self {
        row_to_transfer(
            r.id,
            &r.trace_id,
            r.direction,
            r.status,
            r.asset_id,
            r.amount_raw,
            r.decimals,
            r.canton_party,
            r.canton_contract_id,
            r.canton_command_id,
            r.canton_tx_id,
            r.canton_offset,
            r.fee_raw,
            r.bsc_address,
            r.bsc_tx_hash,
            r.bsc_block_number,
            r.bsc_confirmations,
            r.retry_count,
            r.max_retries,
            r.error_message,
            r.nonce,
            r.next_retry_at,
            r.created_at,
            r.updated_at,
            r.completed_at,
        )
    }
}

/// Map DB row to BridgeTransfer.
pub fn row_to_transfer(
    id: Uuid,
    trace_id: &str,
    direction: TransferDirection,
    status: TransferStatus,
    asset_id: String,
    amount_raw: String,
    decimals: i16,
    canton_party: String,
    canton_contract_id: Option<String>,
    canton_command_id: Option<String>,
    canton_tx_id: Option<String>,
    canton_offset: Option<String>,
    _fee_raw: Option<String>,
    bsc_address: String,
    bsc_tx_hash: Option<String>,
    bsc_block_number: Option<i64>,
    bsc_confirmations: Option<i64>,
    retry_count: i32,
    max_retries: i32,
    error_message: Option<String>,
    nonce: String,
    next_retry_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    completed_at: Option<DateTime<Utc>>,
) -> BridgeTransfer {
    BridgeTransfer {
        id: TransferId(id),
        trace_id: trace_id.to_string(),
        direction,
        status,
        asset_id,
        amount: Amount::from_base_units(amount_raw, decimals as u8),
        fee: None,
        canton_party: CantonParty::new(canton_party),
        canton_contract_id: canton_contract_id.map(CantonContractId::new),
        canton_command_id: canton_command_id.map(|s| s.into()),
        canton_tx_id,
        canton_offset: canton_offset.map(CantonOffset::new),
        bsc_address: BscAddress::new(bsc_address),
        bsc_tx_hash: bsc_tx_hash.map(BscTxHash::new),
        bsc_block_number: bsc_block_number.map(|n| n as u64),
        bsc_confirmations: bsc_confirmations.map(|n| n as u64),
        retry_count: retry_count as u32,
        max_retries: max_retries as u32,
        error_message,
        error_history: Vec::new(),
        nonce,
        next_retry_at,
        created_at,
        updated_at,
        completed_at,
    }
}
