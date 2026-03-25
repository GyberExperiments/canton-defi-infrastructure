//! Nonce management for bridge wallet (sequential, no gaps on retry).

use std::sync::atomic::{AtomicU64, Ordering};

/// In-memory nonce for single signer. Production: persist or fetch from chain.
pub struct NonceManager {
    next: AtomicU64,
}

impl NonceManager {
    pub fn new(initial: u64) -> Self {
        Self { next: AtomicU64::new(initial) }
    }

    pub fn next(&self) -> u64 {
        self.next.fetch_add(1, Ordering::SeqCst)
    }

    pub fn set(&self, value: u64) {
        self.next.store(value, Ordering::SeqCst);
    }
}
