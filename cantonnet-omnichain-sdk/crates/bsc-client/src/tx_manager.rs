//! Submit tx, wait confirmations, retry (nonce/gas).

use bridge_core::{BscTxHash, BridgeError};

/// Send raw tx and optionally wait for confirmations.
pub async fn send_and_confirm(
    _rpc_url: &str,
    _required_confirmations: u64,
) -> Result<BscTxHash, BridgeError> {
    // TODO: signer.send_transaction().await, wait for blocks
    Err(BridgeError::Other("tx_manager: not implemented".into()))
}
