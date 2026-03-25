//! Unit tests for models, config, and error types.

use crate::config::AppConfig;
use crate::error::ApiError;
use crate::models::{new_contract_store, new_escrow_store, new_settlement_store, ContractStatus};

// ─── Config tests ──

#[test]
fn test_config_canton_endpoint() {
    let config = AppConfig {
        canton_host: "myhost".into(),
        canton_port: 9000,
        application_id: "app".into(),
        party_id: "party".into(),
        ledger_id: "ledger".into(),
        port: 8080,
        otc_package_id: "pkg-123".into(),
        auth_token: None,
        synchronizer_id: String::new(),
        trader_party_id: String::new(),
    };
    assert_eq!(config.canton_endpoint(), "http://myhost:9000");
}

#[test]
fn test_config_validate_ok() {
    let config = AppConfig {
        canton_host: "localhost".into(),
        canton_port: 5001,
        application_id: "app".into(),
        party_id: "party".into(),
        ledger_id: "ledger".into(),
        port: 8080,
        otc_package_id: "pkg-123".into(),
        auth_token: None,
        synchronizer_id: String::new(),
        trader_party_id: String::new(),
    };
    assert!(config.validate().is_ok());
}

#[test]
fn test_config_validate_empty_package_id() {
    let config = AppConfig {
        canton_host: "localhost".into(),
        canton_port: 5001,
        application_id: "app".into(),
        party_id: "party".into(),
        ledger_id: "ledger".into(),
        port: 8080,
        otc_package_id: "".into(),
        auth_token: None,
        synchronizer_id: String::new(),
        trader_party_id: String::new(),
    };
    let err = config.validate().unwrap_err();
    assert!(err.contains("OTC_PACKAGE_ID"));
}

#[test]
fn test_config_validate_empty_party_id() {
    let config = AppConfig {
        canton_host: "localhost".into(),
        canton_port: 5001,
        application_id: "app".into(),
        party_id: "".into(),
        ledger_id: "ledger".into(),
        port: 8080,
        otc_package_id: "pkg-123".into(),
        auth_token: None,
        synchronizer_id: String::new(),
        trader_party_id: String::new(),
    };
    let err = config.validate().unwrap_err();
    assert!(err.contains("CANTON_PARTY_ID"));
}

// ─── Model tests ──

#[test]
fn test_contract_status_serialization() {
    let status = ContractStatus::Active;
    let json = serde_json::to_string(&status).unwrap();
    assert_eq!(json, "\"active\"");

    let status = ContractStatus::PartiallyFilled;
    let json = serde_json::to_string(&status).unwrap();
    assert_eq!(json, "\"partially_filled\"");
}

#[test]
fn test_contract_status_deserialization() {
    let status: ContractStatus = serde_json::from_str("\"accepted\"").unwrap();
    assert_eq!(status, ContractStatus::Accepted);

    let status: ContractStatus = serde_json::from_str("\"cancelled\"").unwrap();
    assert_eq!(status, ContractStatus::Cancelled);
}

#[test]
fn test_contract_status_roundtrip() {
    let variants = vec![
        ContractStatus::Pending,
        ContractStatus::Active,
        ContractStatus::PartiallyFilled,
        ContractStatus::Filled,
        ContractStatus::Cancelled,
        ContractStatus::Expired,
        ContractStatus::Disputed,
        ContractStatus::Rejected,
        ContractStatus::Accepted,
    ];
    for status in variants {
        let json = serde_json::to_string(&status).unwrap();
        let back: ContractStatus = serde_json::from_str(&json).unwrap();
        assert_eq!(status, back);
    }
}

#[test]
fn test_new_contract_store_empty() {
    let store = new_contract_store();
    let rt = tokio::runtime::Builder::new_current_thread()
        .build()
        .unwrap();
    rt.block_on(async {
        assert!(store.read().await.is_empty());
    });
}

#[test]
fn test_new_settlement_store_empty() {
    let store = new_settlement_store();
    let rt = tokio::runtime::Builder::new_current_thread()
        .build()
        .unwrap();
    rt.block_on(async {
        assert!(store.read().await.is_empty());
    });
}

#[test]
fn test_new_escrow_store_empty() {
    let store = new_escrow_store();
    let rt = tokio::runtime::Builder::new_current_thread()
        .build()
        .unwrap();
    rt.block_on(async {
        assert!(store.read().await.is_empty());
    });
}

// ─── Error tests ──

#[test]
fn test_api_error_new() {
    let err = ApiError::new("test error", "TEST_CODE");
    assert_eq!(err.error, "test error");
    assert_eq!(err.code, "TEST_CODE");
}

#[test]
fn test_api_error_bad_request() {
    let (status, json) = ApiError::bad_request("bad input");
    assert_eq!(status, axum::http::StatusCode::BAD_REQUEST);
    assert_eq!(json.0.code, "VALIDATION_ERROR");
}

#[test]
fn test_api_error_not_found() {
    let (status, json) = ApiError::not_found("missing");
    assert_eq!(status, axum::http::StatusCode::NOT_FOUND);
    assert_eq!(json.0.code, "NOT_FOUND");
}

#[test]
fn test_api_error_unavailable() {
    let (status, json) = ApiError::unavailable("down");
    assert_eq!(status, axum::http::StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(json.0.code, "CANTON_UNAVAILABLE");
}
