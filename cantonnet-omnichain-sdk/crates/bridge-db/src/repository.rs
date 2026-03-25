//! Transfer repository: insert, get_by_id, update_status, list_pending, audit, checkpoints.

use bridge_core::{
    BridgeError, BridgeTransfer, TransferDirection, TransferId, TransferStatus,
};
use chrono::Utc;
use sqlx::postgres::PgPoolOptions;
use sqlx::{PgPool, Row};

use crate::models::{AuditLogRow, TransferRow};

pub struct TransferRepository {
    pool: PgPool,
}

impl TransferRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn from_config(db_url: &str, max_connections: u32) -> Result<Self, BridgeError> {
        let pool = PgPoolOptions::new()
            .max_connections(max_connections)
            .connect(db_url)
            .await
            .map_err(|e| BridgeError::Db(e.to_string()))?;
        Ok(Self::new(pool))
    }

    pub async fn insert(&self, transfer: &BridgeTransfer) -> Result<(), BridgeError> {
        let id = transfer.id.0;
        let fee_raw = transfer
            .fee
            .as_ref()
            .map(|f| f.total_fee.raw.as_str());
        sqlx::query(
            r#"
            INSERT INTO transfers (
                id, trace_id, direction, status, asset_id, amount_raw, decimals,
                fee_raw, canton_party, canton_contract_id, canton_command_id, canton_tx_id, canton_offset,
                bsc_address, bsc_tx_hash, bsc_block_number, bsc_confirmations,
                retry_count, max_retries, error_message, nonce, next_retry_at,
                created_at, updated_at, completed_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
                $18, $19, $20, $21, $22, $23, $24, $25
            )
            "#,
        )
        .bind(id)
        .bind(&transfer.trace_id)
        .bind(&transfer.direction)
        .bind(&transfer.status)
        .bind(&transfer.asset_id)
        .bind(&transfer.amount.raw)
        .bind(transfer.amount.decimals as i16)
        .bind(fee_raw)
        .bind(transfer.canton_party.0.as_str())
        .bind(transfer.canton_contract_id.as_ref().map(|c| c.0.as_str()))
        .bind(transfer.canton_command_id.as_deref())
        .bind(transfer.canton_tx_id.as_deref())
        .bind(transfer.canton_offset.as_ref().map(|o| o.0.as_str()))
        .bind(transfer.bsc_address.0.as_str())
        .bind(transfer.bsc_tx_hash.as_ref().map(|h| h.0.as_str()))
        .bind(transfer.bsc_block_number.map(|n| n as i64))
        .bind(transfer.bsc_confirmations.map(|n| n as i64))
        .bind(transfer.retry_count as i32)
        .bind(transfer.max_retries as i32)
        .bind(transfer.error_message.as_deref())
        .bind(&transfer.nonce)
        .bind(transfer.next_retry_at)
        .bind(transfer.created_at)
        .bind(transfer.updated_at)
        .bind(transfer.completed_at)
        .execute(&self.pool)
        .await
        .map_err(|e| BridgeError::Db(e.to_string()))?;
        Ok(())
    }

    pub async fn get_by_canton_command_id(
        &self,
        command_id: &str,
    ) -> Result<Option<BridgeTransfer>, BridgeError> {
        let row = sqlx::query_as::<_, TransferRow>(
            "SELECT id, trace_id, direction, status, asset_id, amount_raw, decimals,
             canton_party, canton_contract_id, canton_command_id, canton_tx_id, canton_offset, fee_raw,
             bsc_address, bsc_tx_hash, bsc_block_number, bsc_confirmations,
             retry_count, max_retries, error_message, nonce, next_retry_at,
             created_at, updated_at, completed_at
             FROM transfers WHERE canton_command_id = $1",
        )
        .bind(command_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| BridgeError::Db(e.to_string()))?;
        Ok(row.map(BridgeTransfer::from))
    }

    pub async fn get_by_bsc_tx_hash(
        &self,
        tx_hash: &str,
    ) -> Result<Option<BridgeTransfer>, BridgeError> {
        let row = sqlx::query_as::<_, TransferRow>(
            "SELECT id, trace_id, direction, status, asset_id, amount_raw, decimals,
             canton_party, canton_contract_id, canton_command_id, canton_tx_id, canton_offset, fee_raw,
             bsc_address, bsc_tx_hash, bsc_block_number, bsc_confirmations,
             retry_count, max_retries, error_message, nonce, next_retry_at,
             created_at, updated_at, completed_at
             FROM transfers WHERE bsc_tx_hash = $1",
        )
        .bind(tx_hash)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| BridgeError::Db(e.to_string()))?;
        Ok(row.map(BridgeTransfer::from))
    }

    pub async fn get_by_id(&self, id: &TransferId) -> Result<Option<BridgeTransfer>, BridgeError> {
        let row = sqlx::query_as::<_, TransferRow>(
            "SELECT id, trace_id, direction, status, asset_id, amount_raw, decimals,
             canton_party, canton_contract_id, canton_command_id, canton_tx_id, canton_offset, fee_raw,
             bsc_address, bsc_tx_hash, bsc_block_number, bsc_confirmations,
             retry_count, max_retries, error_message, nonce, next_retry_at,
             created_at, updated_at, completed_at
             FROM transfers WHERE id = $1",
        )
        .bind(id.0)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| BridgeError::Db(e.to_string()))?;
        Ok(row.map(BridgeTransfer::from))
    }

    pub async fn update_status(
        &self,
        id: &TransferId,
        new_status: TransferStatus,
        error_message: Option<&str>,
    ) -> Result<(), BridgeError> {
        let now = Utc::now();
        let completed_at = if new_status.is_terminal() || new_status.needs_intervention() {
            Some(now)
        } else {
            None::<chrono::DateTime<Utc>>
        };
        let updated = sqlx::query(
            "UPDATE transfers SET status = $1, error_message = $2, updated_at = $3, completed_at = COALESCE($4, completed_at) WHERE id = $5",
        )
        .bind(&new_status)
        .bind(error_message)
        .bind(now)
        .bind(completed_at)
        .bind(id.0)
        .execute(&self.pool)
        .await
        .map_err(|e| BridgeError::Db(e.to_string()))?;
        if updated.rows_affected() == 0 {
            return Err(BridgeError::Db("transfer not found".into()));
        }
        Ok(())
    }

    pub async fn list_pending(&self, limit: u32) -> Result<Vec<BridgeTransfer>, BridgeError> {
        let rows = sqlx::query_as::<_, TransferRow>(
            r#"
            SELECT id, trace_id, direction, status, asset_id, amount_raw, decimals,
                   canton_party, canton_contract_id, canton_command_id, canton_tx_id, canton_offset, fee_raw,
                   bsc_address, bsc_tx_hash, bsc_block_number, bsc_confirmations,
                   retry_count, max_retries, error_message, nonce, next_retry_at,
                   created_at, updated_at, completed_at
            FROM transfers
            WHERE status IN ('canton_locking', 'canton_locked', 'bsc_minting', 'bsc_burned', 'bsc_burn_finalized', 'canton_unlocking')
            ORDER BY next_retry_at NULLS FIRST, updated_at ASC
            LIMIT $1
            "#,
        )
        .bind(limit as i64)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| BridgeError::Db(e.to_string()))?;
        Ok(rows.into_iter().map(BridgeTransfer::from).collect())
    }

    /// Orphaned transfers — в in-flight статусах, давно не обновлялись.
    pub async fn list_orphaned(
        &self,
        orphan_threshold_minutes: u32,
    ) -> Result<Vec<BridgeTransfer>, BridgeError> {
        let rows = sqlx::query_as::<_, TransferRow>(
            r#"
            SELECT id, trace_id, direction, status, asset_id, amount_raw, decimals,
                   canton_party, canton_contract_id, canton_command_id, canton_tx_id, canton_offset, fee_raw,
                   bsc_address, bsc_tx_hash, bsc_block_number, bsc_confirmations,
                   retry_count, max_retries, error_message, nonce, next_retry_at,
                   created_at, updated_at, completed_at
            FROM transfers
            WHERE status IN ('canton_locking', 'canton_locked', 'bsc_minting', 'canton_unlocking', 'rolling_back')
              AND updated_at < NOW() - ($1::integer || ' minutes')::interval
            ORDER BY updated_at ASC
            "#,
        )
        .bind(orphan_threshold_minutes as i32)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| BridgeError::Db(e.to_string()))?;
        Ok(rows.into_iter().map(BridgeTransfer::from).collect())
    }

    /// История изменений статусов из transfer_audit_log.
    pub async fn get_audit_history(
        &self,
        transfer_id: &TransferId,
    ) -> Result<Vec<AuditLogRow>, BridgeError> {
        let rows = sqlx::query_as::<_, AuditLogRow>(
            "SELECT at, old_status, new_status, actor, reason, metadata \
             FROM transfer_audit_log WHERE transfer_id = $1 ORDER BY at DESC",
        )
        .bind(transfer_id.0)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| BridgeError::Db(e.to_string()))?;
        Ok(rows)
    }

    pub async fn append_audit(
        &self,
        transfer_id: &TransferId,
        old_status: TransferStatus,
        new_status: TransferStatus,
        actor: &str,
        reason: Option<&str>,
        metadata: Option<serde_json::Value>,
    ) -> Result<(), BridgeError> {
        sqlx::query(
            "INSERT INTO transfer_audit_log (transfer_id, old_status, new_status, actor, reason, metadata) VALUES ($1, $2, $3, $4, $5, $6)",
        )
        .bind(transfer_id.0)
        .bind(&old_status)
        .bind(&new_status)
        .bind(actor)
        .bind(reason)
        .bind(metadata)
        .execute(&self.pool)
        .await
        .map_err(|e| BridgeError::Db(e.to_string()))?;
        Ok(())
    }

    /// Append event into transfer_event_log (event sourcing).
    pub async fn append_event(
        &self,
        transfer_id: &TransferId,
        event_type: &str,
        event_data: serde_json::Value,
    ) -> Result<(), BridgeError> {
        sqlx::query(
            "INSERT INTO transfer_event_log (transfer_id, event_type, event_data) \
             VALUES ($1, $2, $3)",
        )
        .bind(transfer_id.0)
        .bind(event_type)
        .bind(event_data)
        .execute(&self.pool)
        .await
        .map_err(|e| BridgeError::Db(e.to_string()))?;
        Ok(())
    }

    pub async fn get_checkpoint_offset(
        &self,
        direction: TransferDirection,
    ) -> Result<Option<String>, BridgeError> {
        let row = sqlx::query(
            "SELECT offset_value FROM bridge_checkpoints WHERE direction = $1",
        )
        .bind(&direction)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| BridgeError::Db(e.to_string()))?;
        Ok(row.map(|r: sqlx::postgres::PgRow| r.get::<String, _>("offset_value")))
    }

    pub async fn set_checkpoint_offset(
        &self,
        direction: TransferDirection,
        offset: &str,
    ) -> Result<(), BridgeError> {
        sqlx::query(
            r#"
            INSERT INTO bridge_checkpoints (direction, offset_value, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (direction) DO UPDATE SET offset_value = $2, updated_at = NOW()
            "#,
        )
        .bind(&direction)
        .bind(offset)
        .execute(&self.pool)
        .await
        .map_err(|e| BridgeError::Db(e.to_string()))?;
        Ok(())
    }

    pub fn pool(&self) -> &PgPool {
        &self.pool
    }
}
