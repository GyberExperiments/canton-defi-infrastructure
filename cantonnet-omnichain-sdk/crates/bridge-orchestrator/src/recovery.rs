//! Recovery: orphan in-flight detection, retry backoff, stuck handling.

use bridge_core::BridgeError;

pub async fn run_recovery_on_start(
    _orphan_in_flight_minutes: u64,
) -> Result<(), BridgeError> {
    // TODO: list in-flight, filter by updated_at, mark failed or reset retry
    Ok(())
}
