use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use canton_core::SdkError;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct ApiError {
    pub error: String,
    pub code: String,
}

impl ApiError {
    pub fn new(error: impl Into<String>, code: impl Into<String>) -> Self {
        Self {
            error: error.into(),
            code: code.into(),
        }
    }

    pub fn unavailable(msg: impl Into<String>) -> (StatusCode, Json<Self>) {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(Self::new(msg, "CANTON_UNAVAILABLE")),
        )
    }

    pub fn bad_request(msg: impl Into<String>) -> (StatusCode, Json<Self>) {
        (
            StatusCode::BAD_REQUEST,
            Json(Self::new(msg, "VALIDATION_ERROR")),
        )
    }

    pub fn not_found(msg: impl Into<String>) -> (StatusCode, Json<Self>) {
        (StatusCode::NOT_FOUND, Json(Self::new(msg, "NOT_FOUND")))
    }

    pub fn from_sdk(e: SdkError) -> (StatusCode, Json<ApiError>) {
        let (status, code) = match &e {
            SdkError::Connection { .. } => (StatusCode::SERVICE_UNAVAILABLE, "CANTON_UNAVAILABLE"),
            SdkError::Validation { .. } => (StatusCode::BAD_REQUEST, "VALIDATION_ERROR"),
            SdkError::Transaction { .. } => (StatusCode::UNPROCESSABLE_ENTITY, "TRANSACTION_ERROR"),
            SdkError::Timeout { .. } => (StatusCode::GATEWAY_TIMEOUT, "TIMEOUT"),
            _ => (StatusCode::INTERNAL_SERVER_ERROR, "INTERNAL_ERROR"),
        };
        (status, Json(ApiError::new(e.to_string(), code)))
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(self)).into_response()
    }
}
