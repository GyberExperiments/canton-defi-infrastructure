//! Error taxonomy for the Canton-BSC bridge.
//! Expand with concrete variants as implementation progresses.

use thiserror::Error;

#[derive(Debug, Error)]
pub enum BridgeError {
    #[error("Configuration: {0}")]
    Config(String),

    #[error("Canton: {0}")]
    Canton(String),

    #[error("BSC: {0}")]
    Bsc(String),

    #[error("Database: {0}")]
    Db(String),

    #[error("Invalid state transition: {0}")]
    InvalidTransition(String),

    #[error("Validation: {0}")]
    Validation(String),

    #[error("{0}")]
    Other(String),
}
