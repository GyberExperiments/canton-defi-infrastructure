//! Fee model: fixed + proportional; used by API and orchestrator.

use crate::{Amount, BridgeFee};

/// Compute bridge fee and net amount. Proportional in basis points.
pub fn compute_fee(
    amount: &Amount,
    fixed_raw: &str,
    proportional_bps: u32,
) -> BridgeFee {
    let fixed_fee = Amount::from_base_units(fixed_raw.to_string(), amount.decimals);
    let amount_val = amount.raw.parse::<u128>().unwrap_or(0);
    let proportional = amount_val * (proportional_bps as u128) / 10_000;
    let total_fee_raw = (fixed_fee.raw.parse::<u128>().unwrap_or(0))
        .saturating_add(proportional)
        .to_string();
    let total_fee = Amount::from_base_units(total_fee_raw.clone(), amount.decimals);
    let net = amount_val.saturating_sub(total_fee.raw.parse::<u128>().unwrap_or(0));
    let net_amount = Amount::from_base_units(net.to_string(), amount.decimals);
    BridgeFee {
        fixed_fee,
        proportional_bps,
        estimated_gas_bnb: String::new(),
        total_fee,
        net_amount,
    }
}
