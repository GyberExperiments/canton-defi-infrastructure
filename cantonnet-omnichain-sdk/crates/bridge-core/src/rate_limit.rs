//! Rate limiting types. Enforcement in bridge-orchestrator.

use crate::Amount;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitConfig {
    pub max_concurrent_transfers: usize,
    pub max_daily_volume: Option<Amount>,
    pub per_party_daily_limit: Option<Amount>,
    pub cooldown_seconds: Option<u64>,
}

#[derive(Debug, Clone)]
pub struct RateLimitState {
    pub current_in_flight: usize,
    pub daily_volume_used: Amount,
    pub window_start: DateTime<Utc>,
}

impl RateLimitState {
    pub fn new(decimals: u8) -> Self {
        Self {
            current_in_flight: 0,
            daily_volume_used: Amount::from_base_units("0", decimals),
            window_start: Utc::now(),
        }
    }
}
