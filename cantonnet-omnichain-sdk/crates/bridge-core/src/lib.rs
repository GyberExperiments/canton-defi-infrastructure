//! Bridge Core — domain types, traits, error handling, and state machine
//! for the Canton Network ↔ BSC bridge.
//!
//! This crate is the foundation of the bridge system. It contains:
//! - Domain types (transfers, assets, identifiers)
//! - Error taxonomy
//! - Configuration structures
//! - Trait definitions for chain clients
//! - Transfer state machine with validated transitions
//! - Fee model
//! - Rate limiting types

pub mod types;
pub mod errors;
pub mod config;
pub mod traits;
pub mod state_machine;
pub mod fees;
pub mod rate_limit;
pub mod crypto;
pub mod audit;

pub use types::*;
pub use errors::*;
pub use config::*;
pub use traits::*;
pub use state_machine::*;
