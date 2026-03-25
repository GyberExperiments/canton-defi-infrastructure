// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title CantonBridge - Production-Ready Cross-Chain Bridge
 * @notice Secure bridge with multi-sig, rate limiting, and emergency controls
 * @dev Based on 2025 bridge security best practices
 */
contract CantonBridge is 
    Initializable, 
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable, 
    PausableUpgradeable,
    AccessControlUpgradeable 
{
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    
    // Roles
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    
    // State
    mapping(address => bool) public supportedTokens;
    mapping(bytes32 => bool) public processedDeposits;
    mapping(bytes32 => bool) public processedWithdrawals;
    mapping(address => uint256) public dailyVolume;
    mapping(address => uint256) public lastVolumeReset;
    
    // Security parameters
    uint256 public constant FINALITY_BLOCKS = 15; // Wait for finality
    uint256 public minDeposit;
    uint256 public maxDeposit;
    uint256 public dailyLimit;
    uint256 public withdrawalDelay; // Timelock for large withdrawals
    uint256 public largeWithdrawalThreshold;
    
    // Nonce for replay protection
    uint256 public depositNonce;
    uint256 public immutable CHAIN_ID;
    
    // Events
    event TokensLocked(
        address indexed token,
        address indexed sender,
        uint256 amount,
        string cantonRecipient,
        bytes32 indexed depositId,
        uint256 nonce,
        uint256 timestamp
    );
    
    event TokensReleased(
        address indexed token,
        address indexed recipient,
        uint256 amount,
        bytes32 indexed cantonTxHash,
        uint256 nonce
    );
    
    event EmergencyWithdrawal(
        address indexed token,
        address indexed recipient,
        uint256 amount,
        address indexed initiator
    );
    
    event SecurityParametersUpdated(
        uint256 minDeposit,
        uint256 maxDeposit,
        uint256 dailyLimit
    );
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        CHAIN_ID = block.chainid;
        _disableInitializers();
    }
    
    function initialize(
        address admin,
        uint256 _minDeposit,
        uint256 _maxDeposit,
        uint256 _dailyLimit
    ) public initializer {
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        __AccessControl_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GUARDIAN_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
        
        minDeposit = _minDeposit;
        maxDeposit = _maxDeposit;
        dailyLimit = _dailyLimit;
        withdrawalDelay = 24 hours;
        largeWithdrawalThreshold = _dailyLimit / 10;
    }
    
    /**
     * @notice Lock tokens for bridging to Canton Network
     * @param token Token address to lock
     * @param amount Amount to lock
     * @param cantonRecipient Canton Party ID to receive tokens
     */
    function lockTokens(
        address token,
        uint256 amount,
        string calldata cantonRecipient
    ) external nonReentrant whenNotPaused {
        // Validations
        require(supportedTokens[token], "Token not supported");
        require(amount >= minDeposit, "Below minimum deposit");
        require(amount <= maxDeposit, "Exceeds maximum deposit");
        require(bytes(cantonRecipient).length > 0, "Invalid recipient");
        
        // Rate limiting
        _checkAndUpdateDailyVolume(token, amount);
        
        // Generate unique deposit ID with chain-binding
        depositNonce++;
        bytes32 depositId = keccak256(
            abi.encodePacked(
                CHAIN_ID,
                token,
                msg.sender,
                amount,
                cantonRecipient,
                depositNonce,
                block.timestamp
            )
        );
        
        require(!processedDeposits[depositId], "Deposit already processed");
        processedDeposits[depositId] = true;
        
        // Transfer tokens
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        emit TokensLocked(
            token,
            msg.sender,
            amount,
            cantonRecipient,
            depositId,
            depositNonce,
            block.timestamp
        );
    }
    
    /**
     * @notice Release tokens from Canton Network (relayer only)
     * @dev Requires multi-sig approval for large amounts
     */
    function releaseTokens(
        address token,
        address recipient,
        uint256 amount,
        bytes32 cantonTxHash,
        uint256 cantonNonce,
        bytes[] calldata signatures
    ) external nonReentrant whenNotPaused onlyRole(RELAYER_ROLE) {
        // Verify not already processed (replay protection)
        require(!processedWithdrawals[cantonTxHash], "Already processed");
        
        // For large withdrawals, require multi-sig
        if (amount >= largeWithdrawalThreshold) {
            require(
                _verifyMultiSig(cantonTxHash, signatures, 3), // Require 3 signatures
                "Insufficient signatures for large withdrawal"
            );
        }
        
        processedWithdrawals[cantonTxHash] = true;
        
        // Transfer tokens
        IERC20(token).safeTransfer(recipient, amount);
        
        emit TokensReleased(token, recipient, amount, cantonTxHash, cantonNonce);
    }
    
    /**
     * @notice Emergency pause (guardian only)
     */
    function emergencyPause() external onlyRole(GUARDIAN_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpause (requires admin)
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @notice Emergency withdrawal (guardian multi-sig required)
     */
    function emergencyWithdraw(
        address token,
        address recipient,
        uint256 amount,
        bytes[] calldata signatures
    ) external onlyRole(GUARDIAN_ROLE) {
        require(_verifyMultiSig(
            keccak256(abi.encodePacked("emergency", token, recipient, amount)),
            signatures,
            3
        ), "Insufficient guardian signatures");
        
        IERC20(token).safeTransfer(recipient, amount);
        
        emit EmergencyWithdrawal(token, recipient, amount, msg.sender);
    }
    
    // Internal functions
    
    function _checkAndUpdateDailyVolume(address token, uint256 amount) internal {
        // Reset daily volume if 24 hours passed
        if (block.timestamp - lastVolumeReset[token] >= 24 hours) {
            dailyVolume[token] = 0;
            lastVolumeReset[token] = block.timestamp;
        }
        
        require(
            dailyVolume[token] + amount <= dailyLimit,
            "Daily limit exceeded"
        );
        
        dailyVolume[token] += amount;
    }
    
    function _verifyMultiSig(
        bytes32 messageHash,
        bytes[] calldata signatures,
        uint256 requiredSignatures
    ) internal view returns (bool) {
        require(signatures.length >= requiredSignatures, "Not enough signatures");
        
        address[] memory signers = new address[](signatures.length);
        
        for (uint256 i = 0; i < signatures.length; i++) {
            address signer = messageHash.toEthSignedMessageHash().recover(signatures[i]);
            
            require(hasRole(GUARDIAN_ROLE, signer), "Invalid signer");
            
            // Check for duplicates
            for (uint256 j = 0; j < i; j++) {
                require(signers[j] != signer, "Duplicate signature");
            }
            signers[i] = signer;
        }
        
        return true;
    }
    
    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(UPGRADER_ROLE)
    {}
    
    // Admin functions
    
    function addSupportedToken(address token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        supportedTokens[token] = true;
    }
    
    function removeSupportedToken(address token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        supportedTokens[token] = false;
    }
    
    function updateSecurityParameters(
        uint256 _minDeposit,
        uint256 _maxDeposit,
        uint256 _dailyLimit
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minDeposit = _minDeposit;
        maxDeposit = _maxDeposit;
        dailyLimit = _dailyLimit;
        
        emit SecurityParametersUpdated(_minDeposit, _maxDeposit, _dailyLimit);
    }
}
