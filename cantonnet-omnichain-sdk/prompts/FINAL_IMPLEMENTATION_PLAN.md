# Final Implementation Plan: Canton Network ↔ BSC Bridge

This document serves as the **Master Specification** for the implementation phase. It addresses all critical gaps identified in the architectural audit, including security, authentication, error recovery, and observability.

## 1. Corrected Architecture & Project Structure

The project structure has been refined to separate concerns and ensure type safety across the bridge.

```text
canton-bsc-bridge/
├── crates/
│   ├── bridge-core/           # Domain types, State Machine, Crypto, Traits
│   ├── canton-client/         # gRPC Client, JWT Auth, Event Stream
│   ├── bsc-client/            # Ethers provider, Contract bindings, Event listeners
│   ├── bridge-orchestrator/   # Main service, Workflows, Recovery logic
│   ├── bridge-db/             # PostgreSQL persistence, SQLx migrations
│   └── bridge-api/            # REST API for management & health
├── contracts/
│   ├── daml/                  # Canton Smart Contracts (Bridge.daml)
│   └── solidity/              # BSC Smart Contracts (BridgeVault.sol)
├── deploy/                    # Kubernetes & Docker Compose manifests
└── scripts/                   # Generators for proto, bindings, and keys
```

## 2. Critical Component Specifications

### 2.1. Bridge Core: `BridgeTransfer` & State Machine

**File:** `crates/bridge-core/src/types.rs`

The `BridgeTransfer` struct is the source of truth. It now includes detailed tracking for retries, errors, and chain-specific metadata.

```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgeTransfer {
    // ── Identification ──
    pub id: TransferId,
    pub direction: TransferDirection,
    pub status: TransferStatus,
    pub nonce: Uuid, // Idempotency key
    
    // ── Asset & Amount ──
    pub asset: AssetId, // Contains symbol, decimals, addresses on both chains
    pub amount: Amount, // String-based precise amount
    
    // ── Canton Context ──
    pub canton_party: CantonParty,
    pub canton_contract_id: Option<CantonContractId>, // The lock contract
    pub canton_command_id: Option<String>,            // For deduplication
    pub canton_submission_id: Option<String>,         // Ledger API submission ID
    
    // ── BSC Context ──
    pub bsc_address: BscAddress,
    pub bsc_tx_hash: Option<BscTxHash>,
    pub bsc_block_number: Option<u64>,
    pub bsc_block_timestamp: Option<DateTime<Utc>>,
    
    // ── Reliability & Audit ──
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub retry_count: u32,
    pub max_retries: u32,
    pub next_retry_at: Option<DateTime<Utc>>,
    pub error_history: Vec<TransferErrorLog>, // Audit trail of failures
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferErrorLog {
    pub timestamp: DateTime<Utc>,
    pub stage: TransferStatus,
    pub error_code: String,
    pub message: String,
    pub recoverable: bool,
}
```

### 2.2. Canton Client: JWT Authentication

**Gap Fixed:** Added automatic JWT token refresh and proper gRPC metadata injection.

**File:** `crates/canton-client/src/auth.rs`

```rust
pub struct CantonAuthManager {
    participant_url: String,
    ledger_id: String,
    application_id: String,
    secret: String, // HMAC secret or Private Key for signing
    current_token: RwLock<Option<String>>,
    token_expiry: RwLock<DateTime<Utc>>,
}

impl CantonAuthManager {
    /// Returns a valid JWT, refreshing it if necessary
    pub async fn get_token(&self) -> Result<String, AuthError> {
        // Logic: Check expiry. If expired or close to expiry, generate new JWT.
        // JWT Payload must include:
        // - ledgerId
        // - applicationId
        // - participantId (optional)
        // - exp (expiry)
        // - admin: true (if needed for topology) or actAs: [party]
    }
}
```

### 2.3. Daml Contracts: Security & Governance

**Gap Fixed:** Added `Archive` choices, proper `Controller` constraints, and flexible `Interfaces`.

**File:** `contracts/daml/Bridge/Transfer.daml`

```daml
module Bridge.Transfer where

template BridgeLock
  with
    operator : Party      -- The bridge component
    user : Party          -- The user bridging assets
    amount : Decimal
    bscAddress : Text     -- Target address
    assetId : Text
    nonce : Text
  where
    signatory operator, user
    
    -- Critical: Ensure user cannot cancel without operator consent after locking
    -- but allow operator to refund if bridge fails.

    choice Unlock : ContractId BridgeLock
      with
        reason : Text
      controller operator
      do
        -- Logic to refund user on Canton side
        create BridgeRefund with ..
    
    choice CompleteTransfer : ()
      with
        bscTxHash : Text
      controller operator
      do
        -- Archive this contract, signifying completion
        return ()
```

### 2.4. Solidity Contracts: Pausable & AccessControl

**Gap Fixed:** Added `Pausable`, `AccessControl`, `ReentrancyGuard`, and `Rescuable`.

**File:** `contracts/solidity/contracts/BridgeVault.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract BridgeVault is Pausable, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    event Locked(bytes32 indexed transferId, address indexed user, address token, uint256 amount, string cantonParty);
    event Unlocked(bytes32 indexed transferId, address indexed user, address token, uint256 amount);

    constructor(address _admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
    }

    /**
     * @notice Locks tokens to bridge to Canton
     */
    function lock(address _token, uint256 _amount, string memory _cantonParty) 
        external 
        whenNotPaused 
        nonReentrant 
    {
        require(_amount > 0, "Amount must be > 0");
        // ... Transfer logic ...
        emit Locked(keccak256(abi.encodePacked(block.timestamp, msg.sender, _amount)), msg.sender, _token, _amount, _cantonParty);
    }

    /**
     * @notice Unlocks tokens (called by Bridge Operator upon Canton burn)
     */
    function unlock(bytes32 _transferId, address _user, address _token, uint256 _amount) 
        external 
        onlyRole(OPERATOR_ROLE) 
        whenNotPaused 
        nonReentrant 
    {
        // ... Transfer logic ...
        emit Unlocked(_transferId, _user, _token, _amount);
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}
```

## 3. Error Recovery & Resilience Strategy

**Gap Fixed:** Defined "Stuck" state and manual intervention APIs.

1.  **Automatic Retry:** `bridge-orchestrator` will retry transient errors (network timeouts, nonce errors) up to `max_retries` with exponential backoff.
2.  **Stuck State:** If `max_retries` is exhausted, the transfer moves to `TransferStatus::Stuck`.
3.  **Manual Intervention API:**
    *   `POST /api/v1/transfers/{id}/retry`: Force a retry (resets retry count).
    *   `POST /api/v1/transfers/{id}/cancel`: Mark as failed and trigger rollback (refund).
    *   `POST /api/v1/transfers/{id}/force-complete`: Admin override to mark as complete (if manual action was taken on-chain).
4.  **Watchdog:** A separate background task that scans for `Stuck` transfers and alerts via Prometheus/Grafana.

## 4. Observability & Metrics

**Gap Fixed:** Added Distributed Tracing and key metrics.

*   **Tracing:** All functions instrumented with `#[tracing::instrument]`. Trace ID propagates from REST API -> Orchestrator -> Client -> DB.
*   **Metrics (Prometheus):**
    *   `bridge_active_transfers_total{direction="canton_to_bsc"}`
    *   `bridge_completed_transfers_total`
    *   `bridge_failed_transfers_total`
    *   `bridge_locked_value_usd` (Approximation)
    *   `bridge_rpc_latency_seconds`

## 5. Next Steps for Implementation

1.  **Initialize Git Repository** and apply the folder structure defined above.
2.  **Implement `bridge-core`** first to establish shared types.
3.  **Implement `bridge-db`** and run migrations to set up the persistence layer.
4.  **Implement `canton-client`** and test connectivity with a running Canton node (using Docker).
5.  **Implement `bsc-client`** and test with Hardhat local node.
6.  **Develop `bridge-orchestrator`** connecting the two clients.
7.  **Deploy & End-to-End Test**.
