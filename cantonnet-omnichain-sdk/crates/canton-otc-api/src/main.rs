use canton_otc_api::config::AppConfig;
use canton_otc_api::reconnect::{connect_client, reconnect_loop};
use canton_otc_api::routes::create_router;
use canton_otc_api::state::AppState;
use std::net::SocketAddr;
use tokio::net::TcpListener;
use tracing::{info, warn};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    tracing_subscriber::fmt()
        .with_env_filter(
            std::env::var("RUST_LOG")
                .unwrap_or_else(|_| "canton_otc_api=info,tower_http=info".into()),
        )
        .init();

    let config = AppConfig::from_env();
    if let Err(e) = config.validate() {
        eprintln!("Configuration error: {}", e);
        std::process::exit(1);
    }
    let endpoint = config.canton_endpoint();

    info!(
        endpoint = %endpoint,
        application_id = %config.application_id,
        party_id = %config.party_id,
        ledger_id = %config.ledger_id,
        "Starting Canton OTC API Server"
    );

    // Attempt initial connection (non-fatal)
    let ledger_client =
        match connect_client(&endpoint, &config.ledger_id, config.auth_token.clone()).await {
            Ok(l) => {
                info!("Connected to Canton participant at {}", endpoint);
                Some(l)
            }
            Err(e) => {
                warn!(
                    "Initial connection to {} failed: {}. Will retry in background.",
                    endpoint, e
                );
                None
            }
        };

    let state = AppState::new(ledger_client, config.clone());

    // Spawn background reconnection
    let reconnect_state = state.clone();
    tokio::spawn(async move {
        reconnect_loop(reconnect_state).await;
    });

    let app = create_router(state);
    let addr: SocketAddr = format!("0.0.0.0:{}", config.port).parse()?;
    info!(%addr, "canton-otc-api listening");

    let listener = TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
