//! Bridge REST API: health, transfers list/get, retry/cancel/force-complete, metrics.
//! See CANTON_BSC_BRIDGE_READY_PROMPT Part 9.

use axum::Router;
use std::net::SocketAddr;
use tracing::info;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    tracing_subscriber::fmt()
        .with_env_filter(std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()))
        .init();

    let app = Router::new()
        .route("/api/v1/health", axum::routing::get(crate::routes::health))
        .route("/api/v1/transfers", axum::routing::get(crate::routes::list_transfers))
        .route("/api/v1/transfers/:id", axum::routing::get(crate::routes::get_transfer))
        .route("/metrics", axum::routing::get(crate::routes::metrics));

    let addr: SocketAddr = "0.0.0.0:8080".parse()?;
    info!(%addr, "bridge-api listening");
    axum::serve(tokio::net::TcpListener::bind(addr).await?, app).await?;
    Ok(())
}
