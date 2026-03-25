//! Main orchestrator: Canton stream, BSC subscription, pending worker, recovery.

use std::sync::Arc;

use bridge_core::{
    BridgeConfig, BridgeError, BridgeTransfer, CantonClient, BscClient,
    TransferDirection, TransferStatus,
};
use bridge_db::TransferRepository;
use tokio::task::JoinHandle;
use tokio::time::{sleep, Duration};
use tracing::{error, info, warn};

/// Главный оркестратор моста.
/// Внутри: конфиг, репозиторий, клиенты Canton/BSC.
pub struct Orchestrator {
    pub config: BridgeConfig,
    pub repo: Arc<TransferRepository>,
    pub canton: Arc<dyn CantonClient>,
    pub bsc: Arc<dyn BscClient>,
}

impl Orchestrator {
    pub fn new(
        config: BridgeConfig,
        repo: Arc<TransferRepository>,
        canton: Arc<dyn CantonClient>,
        bsc: Arc<dyn BscClient>,
    ) -> Self {
        Self {
            config,
            repo,
            canton,
            bsc,
        }
    }

    /// Запуск всех фоновых воркеров.
    pub async fn run(self) -> Result<(), BridgeError> {
        let this = Arc::new(self);

        let pending_handle = {
            let o = this.clone();
            tokio::spawn(async move { o.pending_worker_loop().await })
        };

        let recovery_handle = {
            let o = this.clone();
            tokio::spawn(async move { o.recovery_loop().await })
        };

        let canton_stream_handle = {
            let o = this.clone();
            tokio::spawn(async move { o.canton_stream_loop().await })
        };

        let bsc_burn_handle = {
            let o = this.clone();
            tokio::spawn(async move { o.bsc_burn_loop().await })
        };

        info!("bridge-orchestrator workers spawned");

        tokio::select! {
            res = join_worker(pending_handle) => res?,
            res = join_worker(recovery_handle) => res?,
            res = join_worker(canton_stream_handle) => res?,
            res = join_worker(bsc_burn_handle) => res?,
        }

        Ok(())
    }

    /// Воркeр обработки pending переводов.
    async fn pending_worker_loop(self: Arc<Self>) -> Result<(), BridgeError> {
        let limit = self
            .config
            .limits
            .as_ref()
            .map(|l| l.max_concurrent_transfers as u32)
            .unwrap_or(50);

        loop {
            let pending = match self.repo.list_pending(limit).await {
                Ok(p) => p,
                Err(e) => {
                    error!(error = %e, "list_pending failed");
                    sleep(Duration::from_secs(5)).await;
                    continue;
                }
            };

            if pending.is_empty() {
                sleep(Duration::from_millis(500)).await;
                continue;
            }

            for mut transfer in pending {
                match (transfer.direction, transfer.status) {
                    (TransferDirection::CantonToBsc, TransferStatus::CantonLocked) => {
                        // TODO: реальный вызов self.handle_canton_locked()
                        info!(
                            transfer_id = %transfer.id,
                            "CantonLocked → подготовка к BscMinting (stub)"
                        );
                    }
                    (TransferDirection::CantonToBsc, TransferStatus::BscMinting) => {
                        // TODO: финальность BSC, переход в BscMinted/Completed
                        info!(
                            transfer_id = %transfer.id,
                            "BscMinting → финальность (stub)"
                        );
                    }
                    (TransferDirection::BscToCanton, TransferStatus::BscBurned) => {
                        // TODO: BscBurned → CantonUnlocking через CantonClient
                        info!(
                            transfer_id = %transfer.id,
                            "BscBurned → подготовка к CantonUnlocking (stub)"
                        );
                    }
                    (TransferDirection::BscToCanton, TransferStatus::CantonUnlocking) => {
                        // TODO: CantonUnlocking → CantonUnlocked/Completed
                        info!(
                            transfer_id = %transfer.id,
                            "CantonUnlocking → финализация (stub)"
                        );
                    }
                    _ => {
                        warn!(
                            transfer_id = %transfer.id,
                            direction = ?transfer.direction,
                            status = ?transfer.status,
                            "unexpected pending transfer in worker"
                        );
                    }
                }
            }

            sleep(Duration::from_millis(200)).await;
        }
    }

    /// Воркeр восстановления orphaned переводов.
    async fn recovery_loop(self: Arc<Self>) -> Result<(), BridgeError> {
        let (threshold_minutes, interval_sec) = self
            .config
            .recovery
            .as_ref()
            .map(|r| (r.orphan_in_flight_minutes as u32, 60u64))
            .unwrap_or((15, 60));

        loop {
            match self.repo.list_orphaned(threshold_minutes).await {
                Ok(orphaned) if !orphaned.is_empty() => {
                    for mut transfer in orphaned {
                        warn!(
                            transfer_id = %transfer.id,
                            status = ?transfer.status,
                            updated_at = %transfer.updated_at,
                            "orphaned transfer detected, marking stuck"
                        );

                        transfer.mark_stuck();

                        if let Err(e) = self
                            .repo
                            .update_status(
                                &transfer.id,
                                transfer.status,
                                Some("orphaned - marked stuck"),
                            )
                            .await
                        {
                            error!(error = %e, transfer_id = %transfer.id, "update_status failed");
                        }

                        if let Err(e) = self
                            .repo
                            .append_audit(
                                &transfer.id,
                                TransferStatus::Failed,
                                TransferStatus::Stuck,
                                "recovery",
                                Some("orphaned - marked stuck"),
                                None,
                            )
                            .await
                        {
                            error!(error = %e, transfer_id = %transfer.id, "append_audit failed");
                        }
                    }
                }
                Ok(_) => { /* нет orphaned */ }
                Err(e) => {
                    error!(error = %e, "list_orphaned failed");
                }
            }

            sleep(Duration::from_secs(interval_sec)).await;
        }
    }

    /// Поток Canton — заглушка до реализации Ledger API стрима.
    async fn canton_stream_loop(self: Arc<Self>) -> Result<(), BridgeError> {
        // TODO: использовать self.canton.stream_events + bridge_checkpoints
        loop {
            sleep(Duration::from_secs(5)).await;
        }
    }

    /// Подписка на burn на BSC — заглушка до реализации клиента.
    async fn bsc_burn_loop(self: Arc<Self>) -> Result<(), BridgeError> {
        // TODO: self.bsc.subscribe_burns() + создание BridgeTransfer BscToCanton
        loop {
            sleep(Duration::from_secs(5)).await;
        }
    }
}

async fn join_worker(handle: JoinHandle<Result<(), BridgeError>>) -> Result<(), BridgeError> {
    match handle.await {
        Ok(res) => res,
        Err(e) => {
            if e.is_cancelled() {
                Err(BridgeError::Other("worker task cancelled".into()))
            } else {
                Err(BridgeError::Other("worker task panicked".into()))
            }
        }
    }
}
