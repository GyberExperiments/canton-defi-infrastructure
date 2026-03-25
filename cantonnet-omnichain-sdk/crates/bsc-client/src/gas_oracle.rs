//! Gas price estimation for BSC txs.

use bridge_core::BridgeError;

/// Get suggested gas price (wei).
pub async fn suggest_gas_price(_rpc_url: &str) -> Result<ethers::types::U256, BridgeError> {
    // TODO: provider.get_gas_price().await
    Ok(ethers::types::U256::zero())
}
