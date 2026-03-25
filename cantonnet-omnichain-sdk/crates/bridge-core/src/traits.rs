//! Traits for Canton and BSC clients. Implement in canton-client and bsc-client.

use async_trait::async_trait;
use crate::{BridgeTransfer, CantonContractId, CantonParty, BscAddress, BscTxHash};
use crate::errors::BridgeError;

#[async_trait]
pub trait CantonClient: Send + Sync {
    /// Submit lock command for Canton→BSC; returns contract id when created.
    async fn lock_for_bsc(
        &self,
        party: &CantonParty,
        amount: &str,
        asset_id: &str,
        bsc_recipient: &BscAddress,
        command_id: &str,
    ) -> Result<CantonContractId, BridgeError>;

    /// Submit unlock command for BSC→Canton.
    async fn unlock_from_bsc(
        &self,
        contract_id: &CantonContractId,
        command_id: &str,
        bsc_tx_hash: &BscTxHash,
    ) -> Result<(), BridgeError>;

    /// Stream transactions (e.g. LockedAsset created); implementation uses Ledger API v2.
    async fn stream_events(&self, from_offset: &str) -> Result<Vec<BridgeTransfer>, BridgeError>;
}

#[async_trait]
pub trait BscClient: Send + Sync {
    /// Mint/release tokens on BSC (Canton→BSC flow).
    async fn mint(
        &self,
        recipient: &BscAddress,
        token: &BscAddress,
        amount: &str,
        transfer_id: &str,
    ) -> Result<BscTxHash, BridgeError>;

    /// Listen for burn events (BSC→Canton). Implementation uses event subscription.
    async fn subscribe_burns(&self) -> Result<(), BridgeError>;
}
