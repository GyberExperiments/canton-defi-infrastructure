use crate::state::AppState;
use canton_ledger_api::LedgerClient;
use std::time::Duration;
use tracing::{debug, info};

pub async fn connect_client(
    endpoint: &str,
    ledger_id: &str,
    auth_token: Option<String>,
) -> Result<LedgerClient, Box<dyn std::error::Error + Send + Sync>> {
    let ledger = LedgerClient::connect_with_auth(endpoint, ledger_id, auth_token).await?;
    Ok(ledger)
}

pub async fn reconnect_loop(state: AppState) {
    let mut interval = tokio::time::interval(Duration::from_secs(15));
    loop {
        interval.tick().await;
        if state.is_connected().await {
            continue;
        }

        let endpoint = state.config.canton_endpoint();
        match connect_client(
            &endpoint,
            &state.config.ledger_id,
            state.config.auth_token.clone(),
        )
        .await
        {
            Ok(ledger) => {
                info!("Reconnected to Canton participant at {}", endpoint);
                state.set_ledger_client(ledger).await;
            }
            Err(e) => {
                debug!("Reconnection attempt failed: {}", e);
            }
        }
    }
}
