//! API routes: /api/v1/health, /transfers, /transfers/:id, /transfers/:id/retry|cancel|force-complete, /metrics.

use axum::extract::Path;
use axum::http::StatusCode;
use axum::Json;
use serde::Serialize;
use std::collections::HashMap;

#[derive(Serialize)]
pub struct HealthResponse {
    pub canton: String,
    pub bsc: String,
    pub db: String,
}

pub async fn health() -> Result<Json<HealthResponse>, StatusCode> {
    Ok(Json(HealthResponse {
        canton: "ok".to_string(),
        bsc: "ok".to_string(),
        db: "ok".to_string(),
    }))
}

#[derive(Serialize)]
pub struct ListTransfersResponse {
    pub items: Vec<TransferItem>,
    pub next_cursor: Option<String>,
}

#[derive(Serialize)]
pub struct TransferItem {
    pub id: String,
    pub direction: String,
    pub status: String,
    pub asset_id: String,
    pub amount: HashMap<String, serde_json::Value>,
    pub canton_party: String,
    pub bsc_address: String,
    pub created_at: String,
    pub updated_at: String,
}

pub async fn list_transfers() -> Result<Json<ListTransfersResponse>, StatusCode> {
    Ok(Json(ListTransfersResponse {
        items: vec![],
        next_cursor: None,
    }))
}

pub async fn get_transfer(Path(_id): Path<String>) -> Result<Json<TransferItem>, StatusCode> {
    Err(StatusCode::NOT_FOUND)
}

pub async fn metrics() -> Result<String, StatusCode> {
    Ok("# bridge metrics placeholder\n".to_string())
}
