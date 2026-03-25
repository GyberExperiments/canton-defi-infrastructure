use crate::config::AppConfig;
use crate::models::{
    new_collateral_store, new_contract_store, new_escrow_store, new_settlement_store,
    CollateralStore, ContractStore, EscrowStore, SettlementStore,
};
use canton_ledger_api::generated::com::daml::ledger::api::v2::command_service_client::CommandServiceClient;
use canton_ledger_api::generated::com::daml::ledger::api::v2::state_service_client::StateServiceClient;
use canton_ledger_api::LedgerClient;
use std::sync::Arc;
use tokio::sync::RwLock;
use tonic::transport::Channel;

#[derive(Clone)]
pub struct AppState {
    pub ledger_client: Arc<RwLock<Option<LedgerClient>>>,
    pub contracts: ContractStore,
    pub settlements: SettlementStore,
    pub escrows: EscrowStore,
    pub collaterals: CollateralStore,
    pub config: AppConfig,
}

impl AppState {
    pub fn new(ledger_client: Option<LedgerClient>, config: AppConfig) -> Self {
        Self {
            ledger_client: Arc::new(RwLock::new(ledger_client)),
            contracts: new_contract_store(),
            settlements: new_settlement_store(),
            escrows: new_escrow_store(),
            collaterals: new_collateral_store(),
            config,
        }
    }

    pub async fn is_connected(&self) -> bool {
        self.ledger_client.read().await.is_some()
    }

    pub async fn get_ledger_client(&self) -> Option<LedgerClient> {
        self.ledger_client.read().await.clone()
    }

    pub async fn set_ledger_client(&self, ledger: LedgerClient) {
        *self.ledger_client.write().await = Some(ledger);
    }

    pub async fn clear_ledger_client(&self) {
        *self.ledger_client.write().await = None;
    }

    /// Returns the list of parties to act as (delegates to config).
    pub fn act_as_parties(&self) -> Vec<String> {
        self.config.act_as_parties()
    }

    /// Create a CommandServiceClient with auth interceptor
    pub async fn create_command_client(
        &self,
    ) -> Result<
        CommandServiceClient<
            tonic::service::interceptor::InterceptedService<
                Channel,
                impl tonic::service::Interceptor,
            >,
        >,
        Box<dyn std::error::Error + Send + Sync>,
    > {
        let endpoint = self.config.canton_endpoint();
        let channel = Channel::from_shared(endpoint.clone())?.connect().await?;

        let auth_token = self.config.auth_token.clone();
        let interceptor = move |mut req: tonic::Request<()>| {
            if let Some(ref token) = auth_token {
                if let Ok(metadata_value) = format!("Bearer {}", token).parse() {
                    req.metadata_mut().insert("authorization", metadata_value);
                }
            }
            Ok(req)
        };

        Ok(CommandServiceClient::with_interceptor(channel, interceptor))
    }

    /// Create a StateServiceClient with auth interceptor
    pub async fn create_state_client(
        &self,
    ) -> Result<
        StateServiceClient<
            tonic::service::interceptor::InterceptedService<
                Channel,
                impl tonic::service::Interceptor,
            >,
        >,
        Box<dyn std::error::Error + Send + Sync>,
    > {
        let endpoint = self.config.canton_endpoint();
        let channel = Channel::from_shared(endpoint.clone())?.connect().await?;

        let auth_token = self.config.auth_token.clone();
        let interceptor = move |mut req: tonic::Request<()>| {
            if let Some(ref token) = auth_token {
                if let Ok(metadata_value) = format!("Bearer {}", token).parse() {
                    req.metadata_mut().insert("authorization", metadata_value);
                }
            }
            Ok(req)
        };

        Ok(StateServiceClient::with_interceptor(channel, interceptor))
    }
}
