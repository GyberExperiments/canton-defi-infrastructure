//! BSC client: Provider, BridgeVault integration, event listener, gas oracle, nonce/tx manager.
//! Реализация трейта bridge_core::BscClient поверх ethers по мастер‑промпту.

pub mod provider;
pub mod contracts;
pub mod bridge_contract;
pub mod event_listener;
pub mod gas_oracle;
pub mod tx_manager;
pub mod nonce_manager;

use std::sync::Arc;

use async_trait::async_trait;
use bridge_core::{BscAddress, BscClient as BscClientTrait, BscTxHash, BridgeError};
use tracing::instrument;

use crate::bridge_contract::BridgeVaultContract;

/// Боевой BSC‑клиент, реализующий трейт bridge_core::BscClient.
///
/// Семантика:
/// - mint = BridgeVault.unlock(transferId, user, token, amount) для Canton→BSC потока;
/// - subscribe_burns = запуск фоновой подписки на события Locked/ Burned контракта.
pub struct EthersBscClient<C: BridgeVaultContract> {
    /// Адрес BridgeVault контракта (0x‑строка).
    pub bridge_address: BscAddress,
    /// Контрактный адаптер (обёртка над abigen‑генерированным типом).
    pub bridge_vault: Arc<C>,
    /// RPC/WS URL'ы для вспомогательных вызовов (gas, подписки и т.п.).
    pub rpc_url: String,
    pub ws_url: Option<String>,
}

impl<C: BridgeVaultContract> EthersBscClient<C> {
    pub fn new(
        bridge_address: BscAddress,
        bridge_vault: Arc<C>,
        rpc_url: String,
        ws_url: Option<String>,
    ) -> Self {
        Self {
            bridge_address,
            bridge_vault,
            rpc_url,
            ws_url,
        }
    }
}

#[async_trait]
impl<C> BscClientTrait for EthersBscClient<C>
where
    C: BridgeVaultContract + Send + Sync + 'static,
{
    /// Mint/release tokens on BSC (Canton→BSC flow).
    ///
    /// Реализация: вызывает BridgeVault.unlock(transferId, recipient, token, amount).
    /// transfer_id: строковый uuid → приводится к bytes32 через sha256.
    #[instrument(skip_all, fields(recipient = %recipient, token = %token, transfer_id = transfer_id))]
    async fn mint(
        &self,
        recipient: &BscAddress,
        token: &BscAddress,
        amount: &str,
        transfer_id: &str,
    ) -> Result<BscTxHash, BridgeError> {
        // Для bytes32 transferId используем детерминированный sha256(transfer_id).
        let hash = bridge_core::crypto::sha256_hex(transfer_id.as_bytes());
        let mut bytes32 = [0u8; 32];
        // hex‑строка гарантированно 64 символа (32 байта)
        hex::decode_to_slice(hash, &mut bytes32)
            .map_err(|e| BridgeError::Bsc(format!("failed to build transferId bytes32: {e}")))?;

        let tx_hash = self
            .bridge_vault
            .unlock(bytes32, recipient, token, amount)
            .await?;

        Ok(tx_hash)
    }

    /// Подписка на события burn/lock на BSC (BSC→Canton поток).
    ///
    /// Конкретная подписка делается в модуле event_listener, здесь только делегирование.
    #[instrument(skip_all)]
    async fn subscribe_burns(&self) -> Result<(), BridgeError> {
        let ws_url = match &self.ws_url {
            Some(u) => u.clone(),
            None => {
                return Err(BridgeError::Bsc(
                    "ws_url is not configured for EthersBscClient".into(),
                ))
            }
        };

        // Пока только проверяем, что можем стартануть подписку.
        // Детальная интеграция с оркестратором (mpsc канал, callback) реализуется в bridge-orchestrator.
        let (_tx, _rx) = tokio::sync::mpsc::unbounded_channel();
        crate::event_listener::subscribe_locked_events(
            &ws_url,
            self.bridge_address.as_str(),
            _tx,
        )
        .await
    }
}
