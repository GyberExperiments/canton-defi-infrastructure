//! Prometheus metrics: active_transfers, completed/failed/stuck, retry, latency, operations.

use prometheus_client::registry::Registry;

pub fn register_metrics(_registry: &mut Registry) {
    // TODO: bridge_active_transfers_total, bridge_completed_transfers_total, etc.
}
