//! Event subscription: Locked (BSC→Canton), Burn. Delivers to channel/callback.

use bridge_core::BridgeError;
use tokio::sync::mpsc;

/// Event from BridgeVault (e.g. Locked for BSC→Canton).
#[derive(Debug, Clone)]
pub struct BridgeVaultEvent {
    pub transfer_id: [u8; 32],
    pub user: String,
    pub token: String,
    pub amount: String,
    pub canton_party: String,
    pub tx_hash: String,
    pub block_number: u64,
}

/// Start subscription; events sent to `tx`. Returns Ok(()) after subscription started.
pub async fn subscribe_locked_events(
    _ws_url: &str,
    _bridge_address: &str,
    _tx: mpsc::UnboundedSender<BridgeVaultEvent>,
) -> Result<(), BridgeError> {
    // TODO: ethers WS + contract.events().subscribe().await
    Ok(())
}
