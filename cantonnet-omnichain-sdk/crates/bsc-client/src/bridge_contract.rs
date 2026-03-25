//! BridgeVault contract interface. Real implementation uses abigen + unlock(transferId, user, token, amount).

use async_trait::async_trait;
use bridge_core::{BscAddress, BscTxHash, BridgeError};

#[async_trait]
pub trait BridgeVaultContract: Send + Sync {
    /// Unlock tokens to recipient (Canton→BSC flow). Maps to BridgeVault.unlock(transferId, user, token, amount).
    async fn unlock(
        &self,
        transfer_id: [u8; 32],
        user: &BscAddress,
        token: &BscAddress,
        amount: &str,
    ) -> Result<BscTxHash, BridgeError>;
}
