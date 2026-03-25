# 🚀 CANTON DEFI — PRODUCTION READINESS PROMPT V2.0

> **Версия:** 2.0 — Enhanced with 2025/2026 Best Practices  
> **Дата:** 2026-01-19  
> **Источники:** Official Canton/DAML docs, snarkjs docs, wagmi v2 docs, cross-chain security research  
> **Оценка работы:** 4-6 недель интенсивной разработки + 1-2 недели аудит  
> **Приоритет:** CRITICAL


> **Цель:** Устранить ВСЕ недоработки упущения незвершенную работу  mock-решения и временные заглушки, подготовить проект к боевому тестированию  
> **Исходный отчёт:** `CANTON_DEFI_TECHNICAL_AUDIT_REPORT.md`  
> **Оценка работы:** 3-4 недели интенсивной разработки  
> **Приоритет:** CRITICAL

---

mock-решения и временные заглушки, подготовить проект к боевому тестированию  

уделить внимание интерфейсу его продуманности и логике всёь должно быть финализировано 

## 📋 CONTEXT

Ты **senior blockchain разработчик** с глубокой экспертизой в:
- Canton Network / DAML smart contracts
- Cross-chain bridges (BSC, Ethereum, Polygon)
- Zero-knowledge proofs (snarkjs, groth16)
- Web3 интеграции (wagmi, viem, ethers.js)
- Institutional DeFi / compliance

**Задача:** Последовательно заменить ВСЕ mock-реализации на production-ready код. Проект должен работать с реальными данными, реальными транзакциями и реальными пользователями.

---

## 📋 EXECUTIVE SUMMARY

### Найденные критические пробелы (из исследования)

| Проблема | Текущее состояние | Требуется |
|----------|-------------------|-----------|
| **Canton API** | `enableRealAPI: false` | TLS + mTLS + JWT auth на production node |
| **DAML Contracts** | Mock ledger | Real participant node + DAR deployment |
| **Bridge** | Placeholder `0x1234...` | Multi-sig + threshold signatures + finality checks |
| **ZK Proofs** | snarkjs imported, not used | Trusted setup ceremony + production zkey |
| **AI Optimizer** | Mock data | Real Grok API + fallback + rate limiting |
| **Input Aliasing** | Not addressed | Public signal validation in ZK verifier |

---

## 🔑 CONTEXT

Ты **senior blockchain разработчик** со специализацией в:
- Canton Network 3.3/3.4 + DAML smart contracts
- Cross-chain bridges с multi-sig и threshold signatures
- Zero-knowledge proofs (Groth16, PLONK) + trusted setup ceremonies
- Web3 интеграции (wagmi v2, viem, ethers.js)
- Institutional DeFi / compliance / HA deployments

**Основной принцип:** Никаких mock-решений. Всё должно работать с реальными данными, реальными транзакциями, реальными участниками.

---

## 🎯 ЗАДАЧИ ПО ПРИОРИТЕТУ

### ФАЗА 1: INFRASTRUCTURE (Неделя 1-2)

---

## TASK 1: Canton Participant Node — Production Deployment

### 1.1 Требования к инфраструктуре

**Минимальные требования (из официальной документации):**
- CPU: 4+ cores
- RAM: 6+ GB
- Storage: PostgreSQL 14+ как backend
- Network: TLS 1.3, mTLS для admin API

### 1.2 Конфигурация Participant Node

**Файл: `canton-participant.conf`**
```hocon
canton {
  participants {
    myParticipant {
      storage {
        type = postgres
        config {
          dataSourceClass = "org.postgresql.ds.PGSimpleDataSource"
          properties = {
            serverName = "localhost"
            portNumber = 5432
            databaseName = "canton_defi"
            user = "canton"
            password = ${CANTON_DB_PASSWORD}
          }
        }
      }
      
      ledger-api {
        address = "0.0.0.0"
        port = 7575
        
        # TLS обязательно для production
        tls {
          cert-chain-file = "/certs/ledger-api.crt"
          private-key-file = "/certs/ledger-api.key"
          trust-collection-file = "/certs/ca.crt"
          client-auth = {
            type = require
            admin-client {
              cert-chain-file = "/certs/admin-client.crt"
              private-key-file = "/certs/admin-client.key"
            }
          }
        }
        
        # JWT Authorization
        auth-services = [{
          type = jwt-rs-256-jwks
          url = "https://auth.canton.network/.well-known/jwks.json"
          audience = "canton-defi"
        }]
      }
      
      admin-api {
        address = "127.0.0.1"  # Только localhost для безопасности
        port = 7576
        
        tls {
          cert-chain-file = "/certs/admin-api.crt"
          private-key-file = "/certs/admin-api.key"
          trust-collection-file = "/certs/ca.crt"
          client-auth = { type = require }
        }
      }
      
      # High Availability
      replication {
        enabled = true
        connection-pool-size = 10
      }
    }
  }
  
  # Monitoring
  monitoring {
    metrics {
      reporter {
        type = prometheus
        port = 9090
      }
    }
    
    logging {
      api-level = INFO
      event-log-level = DEBUG
    }
  }
}
```

### 1.3 Генерация TLS сертификатов

```bash
#!/bin/bash
# generate-certs.sh

# 1. CA Certificate
openssl req -x509 -new -nodes -keyout ca.key -sha256 -days 365 \
  -out ca.crt -subj "/CN=Canton CA/O=CantonDeFi"

# 2. Ledger API Certificate
openssl req -new -nodes -keyout ledger-api.key \
  -out ledger-api.csr -subj "/CN=ledger.canton.network"
openssl x509 -req -in ledger-api.csr -CA ca.crt -CAkey ca.key \
  -CAcreateserial -out ledger-api.crt -days 365 -sha256

# 3. Admin API Certificate (mTLS)
openssl req -new -nodes -keyout admin-api.key \
  -out admin-api.csr -subj "/CN=admin.canton.network"
openssl x509 -req -in admin-api.csr -CA ca.crt -CAkey ca.key \
  -CAcreateserial -out admin-api.crt -days 365 -sha256

# 4. Client Certificates for mTLS
openssl req -new -nodes -keyout admin-client.key \
  -out admin-client.csr -subj "/CN=admin-client"
openssl x509 -req -in admin-client.csr -CA ca.crt -CAkey ca.key \
  -CAcreateserial -out admin-client.crt -days 365 -sha256
```

### 1.4 JWT Token Generation для Party Authentication

```typescript
// cantonAuthService.ts — PRODUCTION VERSION
import jwt from 'jsonwebtoken';
import { ethers } from 'ethers';

interface CantonJWTPayload {
  sub: string;           // Canton Party ID
  aud: string;           // 'canton-defi'
  iss: string;           // 'https://auth.canton.network'
  act: string[];         // ['readAs', 'actAs']
  exp: number;
  evmAddress: string;    // Linked EVM address
}

export class CantonAuthService {
  private privateKey: string;
  private issuer = 'https://auth.canton.network';
  private audience = 'canton-defi';
  
  constructor(jwtPrivateKey: string) {
    this.privateKey = jwtPrivateKey;
  }
  
  /**
   * Authenticate user via EVM signature, return Canton JWT
   */
  async authenticateWithEVMSignature(
    evmAddress: string,
    message: string,
    signature: string,
    partyId: string
  ): Promise<string> {
    // 1. Verify EVM signature
    const recoveredAddress = ethers.verifyMessage(message, signature);
    if (recoveredAddress.toLowerCase() !== evmAddress.toLowerCase()) {
      throw new Error('Invalid EVM signature');
    }
    
    // 2. Verify message is recent (prevent replay)
    const messageData = JSON.parse(message);
    const timestamp = messageData.timestamp;
    if (Date.now() - timestamp > 5 * 60 * 1000) { // 5 minutes max
      throw new Error('Signature expired');
    }
    
    // 3. Generate Canton JWT
    const payload: CantonJWTPayload = {
      sub: partyId,
      aud: this.audience,
      iss: this.issuer,
      act: ['readAs', 'actAs'],
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      evmAddress: evmAddress.toLowerCase(),
    };
    
    return jwt.sign(payload, this.privateKey, { algorithm: 'RS256' });
  }
  
  /**
   * Allocate new Canton Party for EVM address
   */
  async allocateParty(
    evmAddress: string,
    adminToken: string
  ): Promise<{ partyId: string; displayName: string }> {
    const response = await fetch(`${process.env.CANTON_ADMIN_URL}/v1/parties/allocate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        displayName: `user_${evmAddress.slice(0, 8)}`,
        identifierHint: `evm_${evmAddress.toLowerCase()}`,
        localMetadata: {
          evmAddress: evmAddress.toLowerCase(),
          createdAt: new Date().toISOString(),
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Party allocation failed: ${response.statusText}`);
    }
    
    return response.json();
  }
}
```

### 1.5 Обновление Frontend Integration

**Файл: `realCantonIntegration.ts` — PRODUCTION VERSION**

```typescript
// БЫЛО (mock):
const CANTON_API_CONFIG = {
  enableRealAPI: false,
  useMockFallback: true,
  maxRetries: 0,
};

// СТАЛО (production):
const CANTON_API_CONFIG = {
  enableRealAPI: true,
  useMockFallback: process.env.REACT_APP_ENABLE_MOCK_FALLBACK === 'true',
  maxRetries: 3,
  requestTimeout: 30000,
  silentFailure: false,
  
  // TLS Configuration
  tlsConfig: {
    rejectUnauthorized: true,
    ca: process.env.REACT_APP_CANTON_CA_CERT,
  },
  
  // Retry with exponential backoff
  retryConfig: {
    baseDelay: 1000,
    maxDelay: 30000,
    jitter: 0.1,
  }
};
```

**Connection с retry и health checks:**

```typescript
class CantonNetworkClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private healthCheckInterval: NodeJS.Timer | null = null;
  
  async connect(): Promise<void> {
    const { ledgerApiUrl, wsUrl, authToken } = this.config;
    
    // 1. Health check
    await this.healthCheck();
    
    // 2. Establish WebSocket connection
    this.ws = new WebSocket(wsUrl, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
      // TLS options
      rejectUnauthorized: true,
    });
    
    this.ws.onopen = () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.startHealthCheck();
      this.emit('connected');
    };
    
    this.ws.onclose = () => {
      this.isConnected = false;
      this.scheduleReconnect();
    };
    
    this.ws.onmessage = (event) => {
      this.handleRealtimeUpdate(JSON.parse(event.data));
    };
    
    this.ws.onerror = (error) => {
      console.error('Canton WebSocket error:', error);
      this.emit('error', error);
    };
  }
  
  private async healthCheck(): Promise<void> {
    const response = await fetch(`${this.config.ledgerApiUrl}/health`, {
      headers: { 'Authorization': `Bearer ${this.config.authToken}` },
      signal: AbortSignal.timeout(5000),
    });
    
    if (!response.ok) {
      throw new Error(`Canton health check failed: ${response.status}`);
    }
  }
  
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.healthCheck();
      } catch (error) {
        console.warn('Health check failed, triggering reconnect');
        this.ws?.close();
      }
    }, 30000); // Every 30 seconds
  }
  
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxRetries) {
      this.emit('max_retries_exceeded');
      return;
    }
    
    const delay = Math.min(
      this.config.retryConfig.baseDelay * Math.pow(2, this.reconnectAttempts),
      this.config.retryConfig.maxDelay
    ) * (1 + Math.random() * this.config.retryConfig.jitter);
    
    this.reconnectAttempts++;
    setTimeout(() => this.connect(), delay);
  }
}
```

---

## TASK 2: DAML Contracts — Production Deployment

### 2.1 Установка DAML SDK

```bash
# Install DAML SDK (latest stable)
curl -sSL https://get.daml.com/ | sh -s 2.9.0

# Install @daml packages
pnpm add @daml/ledger@2.9.0 @daml/types@2.9.0 @daml/react@2.9.0
```

### 2.2 Компиляция и деплой контрактов

```bash
# В директории contracts/
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/tech-hy-ecosystem/frontend/src/entities/Canton/contracts

# Компиляция
daml build

# Создание DAR архива
daml damlc build -o canton-defi.dar

# Деплой на production participant node
daml ledger upload-dar canton-defi.dar \
  --host participant.canton.network \
  --port 7575 \
  --tls \
  --pem /certs/admin-client.key \
  --crt /certs/admin-client.crt \
  --cacrt /certs/ca.crt
```

### 2.3 Реальный DamlIntegrationService

```typescript
// damlIntegrationService.ts — PRODUCTION VERSION
import Ledger from '@daml/ledger';
import { ContractId } from '@daml/types';

interface DamlConfig {
  ledgerUrl: string;
  token: string;
  tlsConfig?: {
    ca: string;
    cert?: string;
    key?: string;
  };
}

export class DamlIntegrationService extends EventEmitter {
  private ledger: Ledger | null = null;
  private streamSubscriptions: Map<string, { unsubscribe: () => void }> = new Map();
  
  async initialize(config: DamlConfig): Promise<void> {
    // Create real Ledger connection
    this.ledger = new Ledger({
      token: config.token,
      httpBaseUrl: config.ledgerUrl,
      wsBaseUrl: config.ledgerUrl.replace('https', 'wss'),
    });
    
    // Verify connection
    const parties = await this.ledger.getParties();
    console.log(`✅ DAML Ledger connected. Available parties: ${parties.length}`);
    
    this.emit('connected', { parties });
  }
  
  /**
   * Create InstitutionalAsset contract
   */
  async createInstitutionalAsset(
    payload: InstitutionalAssetPayload
  ): Promise<ContractId<InstitutionalAssetPayload>> {
    if (!this.ledger) throw new Error('Ledger not initialized');
    
    const result = await this.ledger.create(
      'CantonDeFi.InstitutionalAsset:InstitutionalAsset',
      {
        assetId: payload.assetId,
        name: payload.name,
        symbol: payload.symbol,
        issuer: payload.issuer,
        custodian: payload.custodian,
        totalSupply: payload.totalSupply.toString(),
        pricePerToken: payload.pricePerToken.toString(),
        riskRating: payload.riskRating,
        complianceLevel: payload.complianceLevel,
        authorizedInvestors: payload.authorizedInvestors,
        observers: payload.observers,
      }
    );
    
    this.emit('asset_created', { contractId: result.contractId, payload });
    return result.contractId;
  }
  
  /**
   * Query active contracts with real-time streaming
   */
  streamContracts<T>(
    templateId: string,
    partyId: string,
    onUpdate: (contracts: Array<{ contractId: string; payload: T }>) => void
  ): () => void {
    if (!this.ledger) throw new Error('Ledger not initialized');
    
    const subscription = this.ledger.streamQuery(
      templateId,
      {},
      (event) => {
        if (event.type === 'LiveContracts') {
          onUpdate(event.contracts.map(c => ({
            contractId: c.contractId,
            payload: c.payload as T
          })));
        } else if (event.type === 'ContractArchived') {
          // Handle archival
          this.emit('contract_archived', event);
        }
      }
    );
    
    // Store subscription for cleanup
    const subscriptionId = `${templateId}_${partyId}`;
    this.streamSubscriptions.set(subscriptionId, subscription);
    
    return () => {
      subscription.unsubscribe();
      this.streamSubscriptions.delete(subscriptionId);
    };
  }
  
  /**
   * Exercise choice on contract
   */
  async exerciseChoice<T, R>(
    contractId: string,
    choiceName: string,
    args: T
  ): Promise<R> {
    if (!this.ledger) throw new Error('Ledger not initialized');
    
    const result = await this.ledger.exercise(
      contractId,
      choiceName,
      args
    );
    
    this.emit('choice_exercised', { contractId, choiceName, result });
    return result as R;
  }
  
  /**
   * Command deduplication (важно для production)
   */
  async submitCommandWithDeduplication<T>(
    command: () => Promise<T>,
    commandId: string,
    deduplicationPeriod: number = 86400 // 24 hours
  ): Promise<T> {
    // Check if command was already processed
    const existingResult = await this.checkDeduplication(commandId);
    if (existingResult) {
      console.log(`Command ${commandId} already processed, returning cached result`);
      return existingResult as T;
    }
    
    // Execute with retries
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await command();
        await this.recordCommandExecution(commandId, result, deduplicationPeriod);
        return result;
      } catch (error: any) {
        if (error.code === 'ALREADY_EXISTS') {
          // Command was processed by another instance
          return this.checkDeduplication(commandId) as T;
        }
        if (attempt === 2) throw error;
        await this.delay(1000 * Math.pow(2, attempt));
      }
    }
    
    throw new Error('Command submission failed after retries');
  }
}
```

---

### ФАЗА 2: BRIDGE & ZK PROOFS (Неделя 2-4)

---

## TASK 3: Cross-Chain Bridge — Security-First Deployment

### 3.1 Улучшенный Bridge Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

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
            address signer = ECDSA.recover(
                ECDSA.toEthSignedMessageHash(messageHash),
                signatures[i]
            );
            
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
```

### 3.2 Frontend Bridge Integration

```typescript
// useCantonBridge.ts — PRODUCTION VERSION
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { parseUnits, encodeFunctionData } from 'viem';

const BRIDGE_ABI = [/* ABI from compiled contract */];

export function useCantonBridge() {
  const { address, chain } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  
  const bridgeTokens = async (
    token: `0x${string}`,
    amount: string,
    decimals: number,
    cantonPartyId: string
  ): Promise<{ hash: string; depositId: string }> => {
    if (!address || !chain) {
      throw new Error('Wallet not connected');
    }
    
    const bridgeAddress = BRIDGE_ADDRESSES[chain.id];
    if (!bridgeAddress) {
      throw new Error(`Bridge not supported on chain ${chain.id}`);
    }
    
    const amountWei = parseUnits(amount, decimals);
    
    // 1. Approve tokens
    const approveHash = await writeContractAsync({
      address: token,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [bridgeAddress, amountWei],
    });
    
    // Wait for approval
    await waitForTransaction(approveHash);
    
    // 2. Lock tokens
    const lockHash = await writeContractAsync({
      address: bridgeAddress,
      abi: BRIDGE_ABI,
      functionName: 'lockTokens',
      args: [token, amountWei, cantonPartyId],
    });
    
    const receipt = await waitForTransaction(lockHash);
    
    // 3. Extract depositId from event
    const depositId = extractDepositIdFromLogs(receipt.logs);
    
    // 4. Wait for Canton confirmation
    await waitForCantonConfirmation(depositId);
    
    return { hash: lockHash, depositId };
  };
  
  return {
    bridgeTokens,
    isPending,
  };
}
```

---

## TASK 4: ZK Proofs — Production Trusted Setup

### 4.1 Trusted Setup Ceremony Pipeline

**Источник:** snarkjs official documentation

```bash
#!/bin/bash
# trusted-setup-ceremony.sh

CIRCUIT_NAME="ownership_proof"
PTAU_SIZE=14  # 2^14 constraints

# ===============================
# PHASE 1: Powers of Tau (Universal)
# ===============================

# Option A: Use existing Powers of Tau (recommended)
wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_14.ptau -O pot14_final.ptau

# Option B: Generate new (for custom ceremonies)
# snarkjs powersoftau new bn128 $PTAU_SIZE pot_0000.ptau -v
# snarkjs powersoftau contribute pot_0000.ptau pot_0001.ptau --name="First contribution" -v
# ... multiple contributions from different parties ...
# snarkjs powersoftau beacon pot_000N.ptau pot_beacon.ptau <random_beacon> 10 -n="Final Beacon"
# snarkjs powersoftau prepare phase2 pot_beacon.ptau pot14_final.ptau -v

# ===============================
# PHASE 2: Circuit-Specific Setup
# ===============================

# 1. Compile Circom circuit
circom circuits/${CIRCUIT_NAME}.circom --r1cs --wasm --sym -o build/

# 2. Initial setup
snarkjs groth16 setup build/${CIRCUIT_NAME}.r1cs pot14_final.ptau build/${CIRCUIT_NAME}_0000.zkey

# 3. Contributions (multiple independent parties!)
# Party 1
snarkjs zkey contribute build/${CIRCUIT_NAME}_0000.zkey build/${CIRCUIT_NAME}_0001.zkey \
  --name="Contributor 1" -v

# Party 2
snarkjs zkey contribute build/${CIRCUIT_NAME}_0001.zkey build/${CIRCUIT_NAME}_0002.zkey \
  --name="Contributor 2" -v

# Party 3
snarkjs zkey contribute build/${CIRCUIT_NAME}_0002.zkey build/${CIRCUIT_NAME}_0003.zkey \
  --name="Contributor 3" -v

# 4. Apply random beacon (finalize)
RANDOM_BEACON=$(openssl rand -hex 32)
snarkjs zkey beacon build/${CIRCUIT_NAME}_0003.zkey build/${CIRCUIT_NAME}_final.zkey \
  $RANDOM_BEACON 10 -n="Final Beacon phase2"

# 5. Verify final zkey
snarkjs zkey verify build/${CIRCUIT_NAME}.r1cs pot14_final.ptau build/${CIRCUIT_NAME}_final.zkey

# 6. Export verification key
snarkjs zkey export verificationkey build/${CIRCUIT_NAME}_final.zkey build/verification_key.json

# 7. Export Solidity verifier
snarkjs zkey export solidityverifier build/${CIRCUIT_NAME}_final.zkey contracts/Verifier.sol

echo "✅ Trusted setup complete!"
echo "Artifacts in build/:"
echo "  - ${CIRCUIT_NAME}_final.zkey (production proving key)"
echo "  - verification_key.json"
echo "  - Verifier.sol"
```

### 4.2 Ownership Proof Circuit

```circom
// circuits/ownership_proof.circom
pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/eddsaposeidon.circom";
include "circomlib/circuits/comparators.circom";

/**
 * Ownership Proof Circuit
 * Proves: "I own asset X without revealing my private key"
 * 
 * Public inputs: assetIdHash, ownerAddressHash
 * Private inputs: assetId, ownerAddress, signature
 */
template OwnershipProof() {
    // Public inputs
    signal input assetIdHash;
    signal input ownerAddressHash;
    signal input currentTimestamp;
    
    // Private inputs
    signal input assetId;
    signal input ownerPrivateKey;
    signal input ownerPublicKey[2];  // EdDSA public key (x, y)
    signal input signature[3];       // EdDSA signature (R8x, R8y, S)
    
    // Output
    signal output valid;
    
    // 1. Verify asset ID hash matches
    component assetHasher = Poseidon(1);
    assetHasher.inputs[0] <== assetId;
    assetIdHash === assetHasher.out;
    
    // 2. Verify owner address hash matches
    component addressHasher = Poseidon(2);
    addressHasher.inputs[0] <== ownerPublicKey[0];
    addressHasher.inputs[1] <== ownerPublicKey[1];
    ownerAddressHash === addressHasher.out;
    
    // 3. Verify EdDSA signature
    component sigVerifier = EdDSAPoseidonVerifier();
    sigVerifier.enabled <== 1;
    sigVerifier.Ax <== ownerPublicKey[0];
    sigVerifier.Ay <== ownerPublicKey[1];
    sigVerifier.R8x <== signature[0];
    sigVerifier.R8y <== signature[1];
    sigVerifier.S <== signature[2];
    
    // Message = hash(assetId, timestamp)
    component msgHasher = Poseidon(2);
    msgHasher.inputs[0] <== assetId;
    msgHasher.inputs[1] <== currentTimestamp;
    sigVerifier.M <== msgHasher.out;
    
    // 4. Output validity
    valid <== 1;
}

component main {public [assetIdHash, ownerAddressHash, currentTimestamp]} = OwnershipProof();
```

### 4.3 ZK Proof Service — Production

```typescript
// zkProofService.ts — PRODUCTION VERSION
import { groth16 } from 'snarkjs';
import * as circomlibjs from 'circomlibjs';

interface ZKConfig {
  circuitWasmPath: string;
  zkeyPath: string;
  verificationKeyPath: string;
}

export class ZKProofService {
  private circuitWasm: ArrayBuffer | null = null;
  private zkey: ArrayBuffer | null = null;
  private verificationKey: any = null;
  private poseidon: any = null;
  
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  
  async initialize(config: ZKConfig): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = this._doInitialize(config);
    await this.initPromise;
    this.initialized = true;
  }
  
  private async _doInitialize(config: ZKConfig): Promise<void> {
    // Load artifacts in parallel
    const [wasmBuffer, zkeyBuffer, vkeyJson, poseidon] = await Promise.all([
      fetch(config.circuitWasmPath).then(r => r.arrayBuffer()),
      fetch(config.zkeyPath).then(r => r.arrayBuffer()),
      fetch(config.verificationKeyPath).then(r => r.json()),
      circomlibjs.buildPoseidon(),
    ]);
    
    this.circuitWasm = wasmBuffer;
    this.zkey = zkeyBuffer;
    this.verificationKey = vkeyJson;
    this.poseidon = poseidon;
    
    console.log('✅ ZK Proof Service initialized');
  }
  
  /**
   * Generate ownership proof
   * @critical Public signals must be validated to prevent input aliasing attack
   */
  async generateOwnershipProof(
    assetId: string,
    ownerPrivateKey: string,
    ownerPublicKey: [bigint, bigint]
  ): Promise<ZKProof> {
    if (!this.initialized) {
      throw new Error('ZK Service not initialized');
    }
    
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Hash inputs using Poseidon
    const assetIdHash = this.poseidon.F.toObject(
      this.poseidon([BigInt(assetId)])
    );
    const ownerAddressHash = this.poseidon.F.toObject(
      this.poseidon([ownerPublicKey[0], ownerPublicKey[1]])
    );
    
    // Generate signature (EdDSA)
    const message = this.poseidon.F.toObject(
      this.poseidon([BigInt(assetId), BigInt(timestamp)])
    );
    const signature = await this.signEdDSA(message, ownerPrivateKey);
    
    // Prepare circuit inputs
    const inputs = {
      assetIdHash: assetIdHash.toString(),
      ownerAddressHash: ownerAddressHash.toString(),
      currentTimestamp: timestamp.toString(),
      assetId: assetId,
      ownerPrivateKey: ownerPrivateKey,
      ownerPublicKey: ownerPublicKey.map(x => x.toString()),
      signature: signature.map(x => x.toString()),
    };
    
    // Generate proof
    const { proof, publicSignals } = await groth16.fullProve(
      inputs,
      new Uint8Array(this.circuitWasm!),
      new Uint8Array(this.zkey!)
    );
    
    // ⚠️ CRITICAL: Validate public signals are in field
    this.validatePublicSignals(publicSignals);
    
    // Verify proof locally before returning
    const isValid = await groth16.verify(
      this.verificationKey,
      publicSignals,
      proof
    );
    
    if (!isValid) {
      throw new Error('Generated proof failed local verification');
    }
    
    return {
      id: `proof_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      proofType: 'OWNERSHIP',
      proof: JSON.stringify(proof),
      publicSignals,
      verificationKey: JSON.stringify(this.verificationKey),
      verified: true,
      createdAt: new Date(),
    };
  }
  
  /**
   * ⚠️ CRITICAL: Prevent input aliasing vulnerability
   * Public signals must be < field modulus to prevent aliased proofs
   */
  private validatePublicSignals(publicSignals: string[]): void {
    // BN128 field modulus
    const FIELD_MODULUS = BigInt(
      '21888242871839275222246405745257275088548364400416034343698204186575808495617'
    );
    
    for (const signal of publicSignals) {
      const value = BigInt(signal);
      if (value < 0n || value >= FIELD_MODULUS) {
        throw new Error(
          `Public signal ${signal} is outside valid field range. ` +
          `Possible input aliasing attack detected.`
        );
      }
    }
  }
  
  /**
   * Verify proof on-chain or off-chain
   */
  async verifyProof(zkProof: ZKProof): Promise<boolean> {
    const proof = JSON.parse(zkProof.proof);
    const vKey = JSON.parse(zkProof.verificationKey);
    
    // Validate public signals first
    this.validatePublicSignals(zkProof.publicSignals);
    
    return await groth16.verify(vKey, zkProof.publicSignals, proof);
  }
  
  /**
   * Generate calldata for on-chain verification
   */
  async generateSolidityCalldata(zkProof: ZKProof): Promise<string> {
    const proof = JSON.parse(zkProof.proof);
    
    return await groth16.exportSolidityCallData(
      proof,
      zkProof.publicSignals
    );
  }
}
```

---

### ФАЗА 3: AI & MONITORING (Неделя 4-5)

---

## TASK 5: AI Portfolio Optimizer — Real Grok Integration

### 5.1 Grok-4 API Service

```typescript
// grok4PortfolioService.ts — PRODUCTION VERSION

interface Grok4Config {
  apiKey: string;
  baseUrl: string;
  model: string;
  maxRetries: number;
  timeout: number;
  rateLimit: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}

export class Grok4PortfolioService {
  private config: Grok4Config;
  private requestCount = 0;
  private tokenCount = 0;
  private lastReset = Date.now();
  
  constructor(config: Partial<Grok4Config> = {}) {
    this.config = {
      apiKey: process.env.GROK_API_KEY!,
      baseUrl: 'https://api.x.ai/v1',
      model: 'grok-2-latest',
      maxRetries: 3,
      timeout: 30000,
      rateLimit: {
        requestsPerMinute: 60,
        tokensPerMinute: 100000,
      },
      ...config,
    };
    
    if (!this.config.apiKey) {
      throw new Error('GROK_API_KEY is required');
    }
  }
  
  /**
   * Optimize portfolio with rate limiting and retries
   */
  async optimizePortfolio(
    request: PortfolioOptimizationRequest
  ): Promise<OptimizationResult> {
    // Check rate limits
    await this.checkRateLimits();
    
    const prompt = this.buildPrompt(request);
    
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const response = await this.callGrokAPI(prompt);
        return this.parseResponse(response, request.portfolioId);
        
      } catch (error: any) {
        if (error.status === 429) {
          // Rate limited - wait and retry
          const retryAfter = parseInt(error.headers?.['retry-after'] || '60');
          await this.delay(retryAfter * 1000);
          continue;
        }
        
        if (error.status >= 500 && attempt < this.config.maxRetries - 1) {
          // Server error - exponential backoff
          await this.delay(1000 * Math.pow(2, attempt));
          continue;
        }
        
        throw error;
      }
    }
    
    throw new Error('Max retries exceeded');
  }
  
  private async callGrokAPI(prompt: string): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.config.timeout
    );
    
    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: PORTFOLIO_OPTIMIZER_SYSTEM_PROMPT,
            },
            {
              role: 'user',
              content: prompt,
            }
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
          max_tokens: 4000,
        }),
        signal: controller.signal,
      });
      
      if (!response.ok) {
        const error: any = new Error(`Grok API error: ${response.status}`);
        error.status = response.status;
        error.headers = Object.fromEntries(response.headers.entries());
        throw error;
      }
      
      const data = await response.json();
      
      // Track token usage
      this.tokenCount += data.usage?.total_tokens || 0;
      this.requestCount++;
      
      return data;
      
    } finally {
      clearTimeout(timeoutId);
    }
  }
  
  private buildPrompt(request: PortfolioOptimizationRequest): string {
    return `
Analyze and optimize this institutional DeFi portfolio:

## Current Holdings
${JSON.stringify(request.holdings, null, 2)}

## Investor Profile
- Risk Tolerance: ${request.riskTolerance}
- Investment Horizon: ${request.investmentHorizon} months
- Target Annual Return: ${request.targetReturn}%
- Compliance Level: ${request.complianceLevel}

## Constraints
- Maximum single position: ${request.constraints.maxSinglePosition}%
- Minimum liquidity requirement: ${request.constraints.minLiquidity}%
- Allowed asset classes: ${request.constraints.allowedAssetClasses.join(', ')}

## Current Market Data
${JSON.stringify(request.marketData, null, 2)}

Provide optimized allocation with:
1. Recommended weights per asset
2. Expected annual return
3. Expected risk (VaR 95%)
4. Sharpe ratio
5. Specific rebalancing actions
6. Detailed reasoning
`;
  }
  
  private parseResponse(
    response: any,
    portfolioId: string
  ): OptimizationResult {
    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('Empty response from Grok API');
    }
    
    const parsed = JSON.parse(content);
    
    // Validate response structure
    this.validateOptimizationResult(parsed);
    
    return {
      id: `opt_${Date.now()}`,
      portfolioId,
      timestamp: new Date(),
      
      recommendedWeights: new Map(Object.entries(parsed.recommendedWeights)),
      expectedReturn: parsed.expectedReturn,
      expectedRisk: parsed.expectedRisk,
      sharpeRatio: parsed.sharpeRatio,
      
      rebalanceActions: parsed.rebalanceActions,
      reasoning: parsed.reasoning,
      
      confidence: parsed.confidence || 0.8,
      modelVersion: this.config.model,
      tokenUsage: response.usage?.total_tokens || 0,
    };
  }
  
  private async checkRateLimits(): Promise<void> {
    const now = Date.now();
    
    // Reset counters every minute
    if (now - this.lastReset > 60000) {
      this.requestCount = 0;
      this.tokenCount = 0;
      this.lastReset = now;
    }
    
    // Check limits
    if (this.requestCount >= this.config.rateLimit.requestsPerMinute) {
      const waitTime = 60000 - (now - this.lastReset);
      await this.delay(waitTime);
    }
    
    if (this.tokenCount >= this.config.rateLimit.tokensPerMinute) {
      const waitTime = 60000 - (now - this.lastReset);
      await this.delay(waitTime);
    }
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

const PORTFOLIO_OPTIMIZER_SYSTEM_PROMPT = `You are an institutional portfolio optimizer specializing in DeFi and tokenized assets.

Your response MUST be valid JSON with this exact structure:
{
  "recommendedWeights": { "asset_id": weight_decimal },
  "expectedReturn": annual_percent,
  "expectedRisk": var_95_percent,
  "sharpeRatio": ratio,
  "rebalanceActions": [
    { "assetId": "...", "action": "BUY|SELL|HOLD", "amount": number, "reason": "..." }
  ],
  "reasoning": "detailed explanation",
  "confidence": 0.0-1.0
}

Apply Modern Portfolio Theory and consider:
- Risk-adjusted returns (Sharpe, Sortino ratios)
- Correlation between assets
- Liquidity constraints
- Compliance requirements
- Market conditions`;
```

---

## TASK 6: Monitoring & Observability

### 6.1 Prometheus Metrics

```typescript
// monitoring.ts
import { Registry, Counter, Histogram, Gauge } from 'prom-client';

export const metricsRegistry = new Registry();

// Canton Network metrics
export const cantonConnectionStatus = new Gauge({
  name: 'canton_connection_status',
  help: 'Canton Network connection status (1=connected, 0=disconnected)',
  registers: [metricsRegistry],
});

export const cantonTransactionDuration = new Histogram({
  name: 'canton_transaction_duration_seconds',
  help: 'Duration of Canton transactions',
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [metricsRegistry],
});

export const cantonTransactionErrors = new Counter({
  name: 'canton_transaction_errors_total',
  help: 'Total Canton transaction errors',
  labelNames: ['error_type'],
  registers: [metricsRegistry],
});

// Bridge metrics
export const bridgeDeposits = new Counter({
  name: 'bridge_deposits_total',
  help: 'Total bridge deposits',
  labelNames: ['token', 'chain'],
  registers: [metricsRegistry],
});

export const bridgeVolume = new Gauge({
  name: 'bridge_volume_usd',
  help: 'Bridge volume in USD (24h)',
  labelNames: ['token', 'chain'],
  registers: [metricsRegistry],
});

// ZK Proof metrics
export const zkProofGenerationTime = new Histogram({
  name: 'zk_proof_generation_seconds',
  help: 'ZK proof generation time',
  buckets: [0.5, 1, 2, 5, 10, 30, 60],
  labelNames: ['circuit_type'],
  registers: [metricsRegistry],
});

export const zkProofVerificationErrors = new Counter({
  name: 'zk_proof_verification_errors_total',
  help: 'Total ZK proof verification errors',
  labelNames: ['circuit_type', 'error_type'],
  registers: [metricsRegistry],
});

// AI Optimizer metrics
export const aiOptimizerLatency = new Histogram({
  name: 'ai_optimizer_latency_seconds',
  help: 'AI optimizer API latency',
  buckets: [1, 2, 5, 10, 20, 30, 60],
  registers: [metricsRegistry],
});

export const aiOptimizerTokenUsage = new Counter({
  name: 'ai_optimizer_tokens_total',
  help: 'Total AI optimizer tokens used',
  registers: [metricsRegistry],
});

export const aiOptimizerErrors = new Counter({
  name: 'ai_optimizer_errors_total',
  help: 'Total AI optimizer errors',
  labelNames: ['error_type'],
  registers: [metricsRegistry],
});
```

### 6.2 Alerting Rules

```yaml
# alerting-rules.yaml
groups:
  - name: canton-defi-alerts
    rules:
      # Canton Network
      - alert: CantonConnectionLost
        expr: canton_connection_status == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Canton Network connection lost"
          description: "Connection to Canton participant node has been down for >1 minute"
      
      - alert: CantonHighTransactionLatency
        expr: histogram_quantile(0.95, canton_transaction_duration_seconds) > 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High Canton transaction latency"
          description: "95th percentile transaction latency is above 10s"
      
      # Bridge
      - alert: BridgeDailyLimitApproaching
        expr: bridge_volume_usd / bridge_daily_limit > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Bridge daily limit approaching (>80%)"
      
      - alert: BridgeUnusualVolume
        expr: rate(bridge_deposits_total[1h]) > 100
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Unusual bridge deposit volume detected"
      
      # ZK Proofs
      - alert: ZKProofGenerationSlow
        expr: histogram_quantile(0.95, zk_proof_generation_seconds) > 30
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "ZK proof generation is slow"
      
      - alert: ZKProofVerificationErrors
        expr: rate(zk_proof_verification_errors_total[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High ZK proof verification error rate"
      
      # AI Optimizer
      - alert: AIOptimizerHighLatency
        expr: histogram_quantile(0.95, ai_optimizer_latency_seconds) > 30
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "AI optimizer high latency"
      
      - alert: AIOptimizerErrors
        expr: rate(ai_optimizer_errors_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "AI optimizer error rate elevated"
```

---

## 📋 PRODUCTION CHECKLIST

### Infrastructure
- [ ] Canton Participant Node deployed with TLS/mTLS
- [ ] PostgreSQL backend configured with backups
- [ ] JWT authentication configured and tested
- [ ] WebSocket connection stable with reconnection logic
- [ ] Health check endpoints working
- [ ] HA setup (minimum 2 participant nodes)

### DAML Contracts
- [ ] All contracts compiled to DAR
- [ ] DAR deployed to production participant node
- [ ] TypeScript bindings generated and tested
- [ ] Command deduplication implemented
- [ ] Party allocation workflow working
- [ ] Contract versioning strategy defined

### Bridge
- [ ] Bridge contracts deployed on BSC
- [ ] Bridge contracts deployed on Ethereum  
- [ ] Multi-sig configured (minimum 3/5)
- [ ] Rate limiting active
- [ ] Emergency pause tested
- [ ] Finality checks implemented
- [ ] Security audit completed

### ZK Proofs
- [ ] Trusted setup ceremony completed (3+ contributors)
- [ ] Production zkey generated and verified
- [ ] Verification key published
- [ ] Solidity verifier deployed and tested
- [ ] Input aliasing protection implemented
- [ ] Performance benchmarks acceptable

### AI Integration
- [ ] Grok API key securely stored
- [ ] Rate limiting implemented
- [ ] Fallback strategy defined
- [ ] Response validation working
- [ ] Token usage monitoring active

### Monitoring
- [ ] Prometheus metrics exposed
- [ ] Grafana dashboards configured
- [ ] Alert rules defined
- [ ] On-call rotation established
- [ ] Incident response playbook written

### Security
- [ ] External security audit completed
- [ ] Penetration testing done
- [ ] Bug bounty program launched
- [ ] Secrets rotated before launch
- [ ] Access controls reviewed

---

## 🔧 ENVIRONMENT VARIABLES (Production)

```bash
# Canton Network
CANTON_PARTICIPANT_HOST=participant.canton.network
CANTON_PARTICIPANT_PORT=7575
CANTON_LEDGER_URL=https://ledger.canton.network/api/v1
CANTON_WS_URL=wss://ledger.canton.network/ws
CANTON_ADMIN_URL=https://admin.canton.network/api/v1
CANTON_JWT_PRIVATE_KEY=<base64_encoded_private_key>
CANTON_PARTICIPANT_ID=<participant_id>
CANTON_DB_PASSWORD=<encrypted_password>

# TLS Certificates (paths or base64)
CANTON_CA_CERT=/certs/ca.crt
CANTON_LEDGER_CERT=/certs/ledger-api.crt
CANTON_LEDGER_KEY=/certs/ledger-api.key
CANTON_ADMIN_CLIENT_CERT=/certs/admin-client.crt
CANTON_ADMIN_CLIENT_KEY=/certs/admin-client.key

# Bridge Contracts
BRIDGE_BSC_ADDRESS=0x...
BRIDGE_ETH_ADDRESS=0x...
BRIDGE_POLYGON_ADDRESS=0x...
BRIDGE_MIN_DEPOSIT=10
BRIDGE_MAX_DEPOSIT=100000
BRIDGE_DAILY_LIMIT=1000000

# ZK Proofs
ZK_CIRCUIT_WASM_URL=/circuits/ownership_proof.wasm
ZK_ZKEY_URL=/circuits/ownership_proof_final.zkey
ZK_VKEY_URL=/circuits/verification_key.json

# AI Services
GROK_API_KEY=xai-...
GROK_MODEL=grok-2-latest
GROK_RATE_LIMIT_RPM=60

# Feature Flags
ENABLE_MOCK_FALLBACK=false
ENABLE_ZK_PROOFS=true
ENABLE_REAL_BRIDGE=true
ENABLE_AI_OPTIMIZER=true

# Monitoring
PROMETHEUS_PORT=9090
GRAFANA_URL=https://grafana.canton-defi.network
ALERT_WEBHOOK_URL=https://alerts.canton-defi.network/webhook
```

---

## 🚀 DEPLOYMENT ORDER

```
Week 1-2:
├── TASK 1: Canton Participant Node setup
├── TASK 2: DAML contracts deployment
└── Infrastructure testing

Week 2-3:
├── TASK 3: Bridge contracts (with audit)
├── TASK 4: ZK trusted setup ceremony
└── Integration testing

Week 4-5:
├── TASK 5: AI optimizer integration
├── TASK 6: Monitoring setup
└── Security audit

Week 5-6:
├── Testnet deployment
├── Load testing
├── Bug fixes
└── Production deployment
```

---

**Ожидаемый результат:** Полностью функциональное institutional DeFi приложение с:
- Real Canton Network integration (no mocks)
- Secure cross-chain bridge with multi-sig
- Production ZK proofs with trusted setup
- AI-powered portfolio optimization
- Enterprise-grade monitoring

**Estimated Time:** 4-6 недель + 1-2 недели audit

---

**Document Version:** 2.0  
**Created:** 2026-01-19  
**Sources:** Canton docs 3.3/3.4, snarkjs official, wagmi v2, cross-chain security research 2025
