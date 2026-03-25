//! Ethers Provider (HTTP/WS) for BSC.

use ethers::providers::{Provider, Http, Ws};
use std::sync::Arc;
use bridge_core::BridgeError;

pub type HttpProvider = Provider<Http>;
pub type WsProvider = Provider<Ws>;

/// Build HTTP provider from RPC URL.
pub fn http_provider(rpc_url: &str) -> Result<Arc<HttpProvider>, BridgeError> {
    let p = Provider::<Http>::try_from(rpc_url)
        .map_err(|e| BridgeError::Bsc(e.to_string()))?;
    Ok(Arc::new(p))
}

/// Build WS provider from WS URL (for event subscription).
pub async fn ws_provider(ws_url: &str) -> Result<Arc<WsProvider>, BridgeError> {
    let p = Provider::<Ws>::connect(ws_url).await
        .map_err(|e| BridgeError::Bsc(e.to_string()))?;
    Ok(Arc::new(p))
}
