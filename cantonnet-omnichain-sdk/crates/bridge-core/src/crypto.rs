//! Crypto helpers (hashing, verification). No chain-specific types.

use sha2::{Sha256, Digest};
use hex;

/// SHA256 hash of input; returns hex string.
pub fn sha256_hex(input: &[u8]) -> String {
    let mut h = Sha256::new();
    h.update(input);
    hex::encode(h.finalize())
}

/// Verify 0x-prefixed hex string is 20 bytes (address).
pub fn is_valid_address_hex(s: &str) -> bool {
    let s = s.strip_prefix("0x").unwrap_or(s);
    s.len() == 40 && s.chars().all(|c| c.is_ascii_hexdigit())
}

/// Verify 0x-prefixed hex string is 32 bytes (tx hash).
pub fn is_valid_tx_hash_hex(s: &str) -> bool {
    let s = s.strip_prefix("0x").unwrap_or(s);
    s.len() == 64 && s.chars().all(|c| c.is_ascii_hexdigit())
}
