//! Stub implementations of CantonClient and BscClient for early wiring.

use async_trait::async_trait;
use bridge_core::{
    BscAddress, BscClient, BscTxHash, BridgeError, BridgeTransfer,
    CantonClient, CantonContractId, CantonParty,
};
use tracing::warn;

/// Заглушка CantonClient — логирует вызовы, не трогает сеть.
pub struct NoopCantonClient;

#[async_trait]
impl CantonClient for NoopCantonClient {
    async fn lock_for_bsc(
        &self,
        party: &CantonParty,
        amount: &str,
        asset_id: &str,
        bsc_recipient: &BscAddress,
        command_id: &str,
    ) -> Result<CantonContractId, BridgeError> {
        warn!(
            party = %party,
            amount = amount,
            asset_id = asset_id,
            bsc_recipient = %bsc_recipient,
            command_id = command_id,
            "NoopCantonClient.lock_for_bsc called (stub)"
        );
        Err(BridgeError::Canton("NoopCantonClient".into()))
    }

    async fn unlock_from_bsc(
        &self,
        contract_id: &CantonContractId,
        command_id: &str,
        bsc_tx_hash: &BscTxHash,
    ) -> Result<(), BridgeError> {
        warn!(
            contract_id = %contract_id,
            command_id = command_id,
            bsc_tx_hash = %bsc_tx_hash,
            "NoopCantonClient.unlock_from_bsc called (stub)"
        );
        Err(BridgeError::Canton("NoopCantonClient".into()))
    }

    async fn stream_events(
        &self,
        _from_offset: &str,
    ) -> Result<Vec<BridgeTransfer>, BridgeError> {
        // Пока ничего не стримим
        Ok(Vec::new())
    }
}

/// Заглушка BscClient — логирует вызовы, не трогает сеть.
pub struct NoopBscClient;

#[async_trait]
impl BscClient for NoopBscClient {
    async fn mint(
        &self,
        recipient: &BscAddress,
        token: &BscAddress,
        amount: &str,
        transfer_id: &str,
    ) -> Result<BscTxHash, BridgeError> {
        warn!(
            recipient = %recipient,
            token = %token,
            amount = amount,
            transfer_id = transfer_id,
            "NoopBscClient.mint called (stub)"
        );
        Err(BridgeError::Bsc("NoopBscClient".into()))
    }

    async fn subscribe_burns(&self) -> Result<(), BridgeError> {
        warn!("NoopBscClient.subscribe_burns called (stub)");
        Ok(())
    }
}

