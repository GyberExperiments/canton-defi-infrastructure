//! Transfer state machine: validated transitions only.

use crate::{BridgeError, BridgeTransfer, TransferStatus};

/// Validates a status transition (with direction). Returns error if transition is invalid.
pub fn apply_transition(transfer: &BridgeTransfer, next: TransferStatus) -> Result<(), BridgeError> {
    if transfer
        .status
        .can_transition_to_with_direction(&next, transfer.direction)
    {
        Ok(())
    } else {
        Err(BridgeError::InvalidTransition(format!(
            "Invalid transition from {:?} to {:?} for direction {:?}",
            transfer.status, next, transfer.direction
        )))
    }
}

/// State machine for bridge transfers. Use with repository to load/save.
pub struct TransferStateMachine;

impl TransferStateMachine {
    pub fn can_transition(from: TransferStatus, to: TransferStatus) -> bool {
        from.can_transition_to(&to)
    }
}
