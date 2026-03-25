//! Bridge configuration structures.
//! Load from YAML/env; see prompts/CANTON_BSC_BRIDGE_READY_PROMPT.md.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgeConfig {
    pub canton: CantonConfig,
    pub bsc: BscConfig,
    pub db: DbConfig,
    #[serde(default)]
    pub limits: Option<LimitsConfig>,
    #[serde(default)]
    pub recovery: Option<RecoveryConfig>,
    #[serde(default)]
    pub api: Option<ApiConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecoveryConfig {
    pub retry_base_delay_sec: u64,
    pub retry_max_delay_sec: u64,
    pub orphan_in_flight_minutes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiConfig {
    pub listen: String,
    pub admin_api_key_env: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CantonConfig {
    pub grpc_url: String,
    pub ledger_id: String,
    pub application_id: String,
    pub operator_party: String,
    pub tls: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BscConfig {
    pub rpc_url: String,
    pub ws_url: Option<String>,
    pub bridge_contract_address: String,
    pub required_confirmations: u64,
    pub chain_id: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbConfig {
    pub url: String,
    pub max_connections: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LimitsConfig {
    pub max_concurrent_transfers: usize,
    pub max_retries: u32,
    pub daily_volume_limit: Option<String>,
}
