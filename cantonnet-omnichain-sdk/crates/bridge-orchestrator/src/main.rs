//! Bridge orchestrator: entrypoint binary.
//! Загружает конфиг, поднимает DB, создает клиентов и запускает Orchestrator::run.

use std::sync::Arc;

use bridge_core::{BridgeConfig, BscAddress};
use bridge_db::TransferRepository;
use bridge_orchestrator::{NoopCantonClient, Orchestrator};
use bsc-client::EthersBscClient;
use tracing::info;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    tracing_subscriber::fmt()
        .with_env_filter(
            std::env::var("RUST_LOG")
                .unwrap_or_else(|_| "info,bridge_orchestrator=debug".into()),
        )
        .with_target(true)
        .json()
        .init();

    let config_path =
        std::env::var("BRIDGE_CONFIG").unwrap_or_else(|_| "config/bridge.yaml".into());
    let raw = std::fs::read_to_string(&config_path)?;
    let config: BridgeConfig = serde_yaml::from_str(&raw)?;

    info!(path = %config_path, "bridge config loaded");

    let repo = Arc::new(
        TransferRepository::from_config(&config.db.url, config.db.max_connections).await?,
    );

    let canton_client: Arc<NoopCantonClient> = Arc::new(NoopCantonClient);

    // BSC client: боевой EthersBscClient поверх BridgeVault.
    // Пока контрактная обёртка (BridgeVaultContract) не реализована, оставляем минимальный
    // конструктора‑заглушку, чтобы не ломать воркфлоу; реальный signer/contract будут добавлены
    // в bsc-client при подключении abigen.
    //
    // Для совместимости используем адрес из конфига как BscAddress.
    let bridge_address = BscAddress::new(config.bsc.bridge_contract_address.clone());

    // Временная заглушка BridgeVaultContract: паника при вызове, чтобы явно подсветить,
    // что unlock ещё не реализован. Это лучше тихой no-op, но не ломает старт оркестратора,
    // пока pending_worker_loop не вызывает mint().
    struct UnimplementedBridgeVaultContract;
    #[async_trait::async_trait]
    impl bsc-client::BridgeVaultContract for UnimplementedBridgeVaultContract {
        async fn unlock(
            &self,
            _transfer_id: [u8; 32],
            _user: &BscAddress,
            _token: &BscAddress,
            _amount: &str,
        ) -> Result<bridge_core::BscTxHash, bridge_core::BridgeError> {
            Err(bridge_core::BridgeError::Bsc(
                "BridgeVault.unlock not implemented yet".into(),
            ))
        }
    }

    let bridge_vault = Arc::new(UnimplementedBridgeVaultContract);
    let bsc_client = Arc::new(EthersBscClient::new(
        bridge_address,
        bridge_vault,
        config.bsc.rpc_url.clone(),
        config.bsc.ws_url.clone(),
    ));

    let orchestrator = Orchestrator::new(config, repo, canton_client, bsc_client);

    info!("starting bridge orchestrator");
    if let Err(e) = orchestrator.run().await {
        eprintln!("orchestrator terminated with error: {e}");
    }

    Ok(())
}

