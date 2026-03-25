//! Audit trail types for transfer state changes.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use crate::TransferStatus;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferEventLog {
    pub transfer_id: String,
    pub at: DateTime<Utc>,
    pub old_status: TransferStatus,
    pub new_status: TransferStatus,
    pub actor: String,
    pub reason: Option<String>,
    /// Дополнительные данные (error_code, tx_hash, etc.)
    pub metadata: Option<serde_json::Value>,
}
