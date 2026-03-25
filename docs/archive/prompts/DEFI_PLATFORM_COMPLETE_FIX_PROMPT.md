# 🏛️ CANTON DEFI PLATFORM — COMPLETE UX/UI FIX PROMPT

> **Дата:** 2026-01-20  
> **Версия:** 2.0.0 — Verification & Completion Phase  
> **Цель:** Проверить все исправления, завершить доработки и привести DeFi платформу в production-ready состояние

---

## 🎯 КРАТКОЕ РЕЗЮМЕ ДЛЯ НОВОГО ЧАТА

**Что было сделано:**
1. ✅ **CCPurchaseWidget** — полностью переработан с реальной интеграцией bridge, валидацией, модалками
2. ✅ **MultiPartyDashboard** — интегрирован с workflow service, добавлены поиск, фильтрация, pagination

**Критические проблемы для исправления:**
1. ⚠️ **CCPurchaseWidget:** `bridgeContractAddress` использует placeholder `0x0000...0000` (строка 99-102) — нужно заменить на реальный адрес из `src/lib/canton/config/realBridgeConfig.ts` используя `getBridgeContractAddress()`
2. ⚠️ Проверить все event listeners и cleanup функции на утечки памяти в MultiPartyDashboard

**Что нужно доработать:**
- MultiPartyAuthPanel (валидация, confirmation, history)
- CantonDeFi (error handling, валидация)
- ProductCard (валидация, confirmation)
- StablecoinSelector (проверка сети, баланс)

**Порядок работы:**
1. Прочитать все измененные файлы полностью (CCPurchaseWidget, MultiPartyDashboard, useMultiPartyWorkflowService)
2. Проверить выполненные исправления по детальным чеклистам в разделе "ШАГ 1"
3. Исправить критические проблемы (placeholder адреса, утечки памяти)
4. Доработать частично выполненные компоненты из раздела "ШАГ 2"

---

## 📊 ТЕКУЩИЙ СТАТУС ВЫПОЛНЕНИЯ

### ✅ ВЫПОЛНЕНО (2026-01-20)

#### 1. **CCPurchaseWidget** — ПОЛНОСТЬЮ ИСПРАВЛЕН (нужна проверка)
- ✅ Убран тестовый режим — заменен на реальную интеграцию с bridge
- ✅ Добавлена валидация баланса через wagmi `useBalance` и `useReadContract`
- ✅ Добавлена проверка достаточности средств (amount + fees)
- ✅ Добавлен confirmation dialog с деталями покупки (встроенный в компонент)
- ✅ Добавлен progress tracking (approving → bridging → success/error) через модальные окна
- ✅ Добавлен success screen с ссылкой на транзакцию (встроенный в компонент)
- ✅ Добавлен retry mechanism (до 3 попыток)
- ✅ Добавлен показ доступного баланса в UI
- ✅ Добавлена обработка ошибок сети и транзакций
- ✅ Добавлена проверка allowance для bridge contract
- ✅ Добавлена автоматическая approval транзакция при необходимости
- ✅ Используется `useCantonBridge` hook для реальной интеграции
- ⚠️ **КРИТИЧНО ДЛЯ ПРОВЕРКИ:** `bridgeContractAddress` использует placeholder `0x0000...0000` (строка 101) — нужно заменить на реальный адрес из конфига
- ⚠️ **ТРЕБУЕТ ПРОВЕРКИ:** Реальная интеграция с bridge может требовать доработки после тестирования

**Детали реализации:**
- Модальные окна (confirmation, progress, success) встроены в компонент через `AnimatePresence`
- Используется `useWriteContract` для approval и bridge транзакций
- Используется `useWaitForTransactionReceipt` для отслеживания статуса транзакций
- Валидация баланса происходит перед показом confirmation modal
- Retry механизм работает через `retryCount` state (максимум 3 попытки)

**Файлы изменены:**
- `src/components/defi/CCPurchaseWidget.tsx` — полностью переработан (993 строки)

#### 2. **MultiPartyDashboard** — ИНТЕГРИРОВАН
- ✅ Создан хук `useMultiPartyWorkflowService` для работы с сервисом
- ✅ Интегрирован с реальным `MultiPartyWorkflowService` через `CantonServiceManager`
- ✅ Добавлен поиск по ID, названию, описанию, инициатору
- ✅ Добавлена фильтрация по статусу и типу транзакций
- ✅ Добавлена pagination (10 транзакций на страницу)
- ✅ Добавлен детальный view транзакций в модальном окне (встроенный в компонент)
- ✅ Добавлен экспорт в CSV
- ✅ Добавлен real-time refresh каждые 30 секунд через `useEffect` с `setInterval`
- ✅ Подписка на события workflow service (`transaction_created`, `signature_collected`, `transaction_executed`)
- ⚠️ **ТРЕБУЕТ ПРОВЕРКИ:** Интеграция с workflow service может требовать тестирования
- ⚠️ **ТРЕБУЕТ ПРОВЕРКИ:** Проверить корректность работы `refreshTransactions` и event listeners

**Детали реализации:**
- Хук `useMultiPartyWorkflowService` управляет lifecycle workflow service через `CantonServiceManager`
- Event listeners подписываются на события и автоматически обновляют список транзакций
- Поиск работает через `useMemo` с фильтрацией по всем полям транзакции
- Pagination реализована через slice массива с вычислением `totalPages`
- CSV экспорт использует `JSON.stringify` и `Blob` для создания файла
- Детальный modal (`TransactionDetailsModal`) встроен в компонент через `AnimatePresence`

**Файлы созданы/изменены:**
- `src/lib/canton/hooks/useMultiPartyWorkflowService.ts` — новый файл (хук для работы с workflow service)
- `src/components/defi/MultiPartyDashboard.tsx` — полностью переработан (559+ строк)

### ⚠️ ИЗВЕСТНЫЕ ПРОБЛЕМЫ И ТРЕБУЕМЫЕ ИСПРАВЛЕНИЯ

#### Критические проблемы в выполненных компонентах:

**CCPurchaseWidget:**
- ⚠️ **КРИТИЧНО:** `bridgeContractAddress` использует placeholder `0x0000000000000000000000000000000000000000` (строка 99-102)
  - **РЕШЕНИЕ:** Использовать функцию `getBridgeContractAddress` из `src/lib/canton/config/realBridgeConfig.ts`
  - Или использовать `REAL_BRIDGE_CONFIG.contracts[network]` из того же файла
  - Нужно определить текущую сеть (BSC, ETHEREUM, POLYGON) и получить соответствующий адрес
  - Без этого approval и bridge транзакции не будут работать корректно
  - Проверить, что адреса в `REAL_BRIDGE_CONFIG.contracts` не являются placeholder'ами (проверить env переменные)

**MultiPartyDashboard:**
- ⚠️ Проверить корректность работы `refreshTransactions` - может потребоваться оптимизация
- ⚠️ Проверить cleanup функций для event listeners - возможны утечки памяти при unmount компонента

### ⚠️ ЧАСТИЧНО ВЫПОЛНЕНО / ТРЕБУЕТ ДОРАБОТКИ

#### 3. **MultiPartyAuthPanel** — ТРЕБУЕТ УЛУЧШЕНИЙ
- ⚠️ Упрощенная реализация (строка 28: "Simplified component")
- ❌ Нет валидации подписи
- ❌ Отсутствие проверки прав пользователя
- ⚠️ Есть базовое подтверждение, но нет детального confirmation modal
- ⚠️ Есть reason для reject, но нет валидации
- ❌ Нет истории действий
- ❌ Отсутствие уведомлений о статусе

#### 4. **CantonDeFi** — ТРЕБУЕТ УЛУЧШЕНИЙ
- ⚠️ Есть базовый error handling, но не везде
- ❌ Нет полной валидации минимальной суммы
- ⚠️ Есть проверка подключения кошелька, но не везде
- ⚠️ Есть loading states, но не для всех операций
- ⚠️ Есть empty states, но можно улучшить
- ❌ Нет error boundaries
- ❌ Нет retry для failed operations

#### 5. **ProductCard** — ТРЕБУЕТ УЛУЧШЕНИЙ
- ❌ Нет валидации перед инвестированием
- ❌ Отсутствие confirmation dialog
- ❌ Нет проверки минимальной суммы
- ⚠️ Есть базовый error handling, но не полный
- ❌ Нет success feedback

#### 6. **StablecoinSelector** — ТРЕБУЕТ УЛУЧШЕНИЙ
- ❌ Нет проверки доступности сети
- ❌ Отсутствие показа баланса
- ❌ Нет фильтрации по доступным сетям
- ❌ Отсутствие loading state

### ❌ НЕ НАЧАТО

#### 7. **Wallet Integration — КРИТИЧНО**
- ❌ Нет поддержки Canton native кошельков (Loop, Bron, Cantor8)
- ❌ Нет WebAuthn/passkey для Canton Wallet
- ❌ Нет поддержки CIP-56 стандарта токенов
- ❌ Нет интеграции с Dfns
- ❌ Нет UnifiedWallet interface
- ❌ Нет ConnectWalletModal с поддержкой всех кошельков

---

## 📋 EXECUTIVE SUMMARY

**Задача:** Проанализировать все виджеты и флоу DeFi платформы, найти все недоделки и доработать фронтенд до production-ready состояния с глубоко продуманным UX/UI.

**Критические проблемы:**
1. ❌ Тестовый режим в CCPurchaseWidget вместо реальной интеграции
2. ❌ Неполная реализация MultiPartyDashboard (TODO комментарии)
3. ❌ Отсутствие обработки ошибок в критических флоу
4. ❌ Нет валидации пользовательского ввода
5. ❌ Отсутствие loading states в некоторых виджетах
6. ❌ Нет empty states для пустых данных
7. ❌ Неполная интеграция между компонентами
8. ❌ Отсутствие feedback для пользовательских действий
9. ❌ **КРИТИЧНО: Неполная интеграция кошельков, особенно Canton Wallet**
10. ❌ **КРИТИЧНО: Отсутствие поддержки native Canton кошельков (Loop, Bron, Cantor8)**
11. ❌ **КРИТИЧНО: Нет WebAuthn/passkey для Canton Wallet**
12. ❌ **КРИТИЧНО: Отсутствие поддержки CIP-56 стандарта токенов**

---

## 🔐 WALLET INTEGRATION — КРИТИЧЕСКИЙ РАЗДЕЛ

### Текущее состояние интеграции кошельков

**Поддерживаемые кошельки (через wagmi/RainbowKit):**
- ✅ MetaMask
- ✅ WalletConnect (мобильные кошельки)
- ✅ Coinbase Wallet
- ✅ Trust Wallet
- ✅ Rainbow Wallet
- ⚠️ Canton Network (частично — только EVM адрес как идентификатор)

**Поддерживаемые сети:**
- ✅ Ethereum Mainnet (chainId: 1)
- ✅ BSC (chainId: 56)
- ✅ Polygon (chainId: 137)
- ✅ Optimism (chainId: 10)
- ✅ Arbitrum (chainId: 42161)
- ⚠️ Canton Network (chainId: 7575) — добавлен в конфиг, но нет native wallet support

**Проблемы текущей реализации:**
1. ❌ **Canton Network использует EVM адрес как идентификатор** — нет native Canton wallet integration
2. ❌ **Нет поддержки Canton native кошельков:**
   - Loop Wallet
   - Bron Wallet
   - Cantor8
3. ❌ **Нет WebAuthn/passkey для Canton Wallet** — только seed-phrase подход
4. ❌ **Нет поддержки CIP-56 стандарта** для токенов на Canton
5. ❌ **Нет интеграции с Dfns** (Tier-1 Canton support provider)
6. ❌ **Hardware wallets (Ledger/Trezor) не поддерживают Canton** официально (но пользователи ждут)

### Исследование: Canton Network Wallet Ecosystem

**Найденные решения:**

1. **Dfns — Tier-1 Canton Support**
   - ✅ Automatic token detection (CIP-56)
   - ✅ On-chain history indexing
   - ✅ Secure signing infrastructure
   - ✅ Webhooks для real-time updates
   - 🔗 https://www.dfns.co/article/canton-tier-1-support

2. **Native Canton Wallets:**
   - **Loop Wallet** — поддерживает Canton native assets и tokenized assets
   - **Bron Wallet** — полная поддержка Canton Network
   - **Cantor8** — enterprise-grade Canton wallet
   - 🔗 https://www.canton.network/ecosystem

3. **Canton Wallet (Send.it)**
   - ✅ WebAuthn/passkey login (без seed-phrase)
   - ✅ Поддержка Canton Network
   - 🔗 https://info.send.it/docs/canton-wallet/overview

4. **CIP-56 Token Standard**
   - Стандарт для токенов на Canton Network
   - Dfns планирует полную поддержку
   - Нужна интеграция для отображения токенов

5. **Hardware Wallets:**
   - ⚠️ Ledger — пока НЕ поддерживает Canton (пользователи ждут)
   - ⚠️ Trezor — пока НЕ поддерживает Canton
   - 🔗 https://www.reddit.com/r/ledgerwallet/comments/1q8f83n/canton_coin_wallet/

6. **Tangem:**
   - ⚠️ Временно НЕ поддерживает Canton
   - 🔗 https://tangem.com/en/cryptocurrencies/canton-network/

### Требования к интеграции кошельков

#### 1. **Canton Native Wallet Integration**

**Необходимо добавить:**

```typescript
// Новый компонент: CantonWalletConnector
interface CantonWalletConnector {
  // Поддержка Loop Wallet
  connectLoopWallet(): Promise<CantonWalletAccount>;
  
  // Поддержка Bron Wallet
  connectBronWallet(): Promise<CantonWalletAccount>;
  
  // Поддержка Cantor8
  connectCantor8(): Promise<CantonWalletAccount>;
  
  // WebAuthn/passkey для Canton Wallet (Send.it)
  connectWithPasskey(): Promise<CantonWalletAccount>;
  
  // Dfns integration
  connectWithDfns(config: DfnsConfig): Promise<CantonWalletAccount>;
}

interface CantonWalletAccount {
  address: string; // Canton address (не EVM)
  publicKey: string;
  network: 'Canton';
  walletType: 'loop' | 'bron' | 'cantor8' | 'passkey' | 'dfns';
  canSign: boolean;
  balance: {
    native: string; // CC balance
    tokens: TokenBalance[]; // CIP-56 tokens
  };
}
```

#### 2. **CIP-56 Token Support**

```typescript
// Поддержка CIP-56 стандарта
interface CIP56Token {
  contractId: string;
  symbol: string;
  name: string;
  decimals: number;
  totalSupply: string;
  balance: string;
  metadata: {
    icon?: string;
    description?: string;
  };
}

// Сервис для работы с CIP-56 токенами
class CIP56TokenService {
  // Получить все токены пользователя
  getUserTokens(address: string): Promise<CIP56Token[]>;
  
  // Получить баланс конкретного токена
  getTokenBalance(address: string, contractId: string): Promise<string>;
  
  // Transfer токена
  transferToken(params: {
    from: string;
    to: string;
    contractId: string;
    amount: string;
  }): Promise<TransactionResult>;
}
```

#### 3. **Unified Wallet Interface**

```typescript
// Единый интерфейс для всех кошельков
interface UnifiedWallet {
  // EVM кошельки (через wagmi)
  evm: {
    connect(): Promise<EVMAccount>;
    disconnect(): void;
    switchChain(chainId: number): Promise<void>;
    signMessage(message: string): Promise<string>;
    sendTransaction(tx: Transaction): Promise<string>;
  };
  
  // NEAR кошельки (через NEAR Wallet Selector)
  near: {
    connect(): Promise<NEARAccount>;
    disconnect(): void;
    signTransaction(tx: NEARTransaction): Promise<string>;
  };
  
  // Canton кошельки (native)
  canton: {
    connect(walletType: CantonWalletType): Promise<CantonAccount>;
    disconnect(): void;
    getBalance(): Promise<CantonBalance>;
    getTokens(): Promise<CIP56Token[]>;
    signTransaction(tx: CantonTransaction): Promise<string>;
  };
}
```

#### 4. **Wallet Connection UI**

**Требования к UI:**

1. **Connect Wallet Modal:**
   ```
   ┌─────────────────────────────────────┐
   │  Connect Wallet                     │
   ├─────────────────────────────────────┤
   │                                     │
   │  EVM Wallets                        │
   │  ┌─────┐ ┌─────┐ ┌─────┐          │
   │  │Meta │ │Coin │ │Trust│          │
   │  │Mask │ │base │ │     │          │
   │  └─────┘ └─────┘ └─────┘          │
   │                                     │
   │  NEAR Wallets                       │
   │  ┌─────┐ ┌─────┐                   │
   │  │Meteor│ │Here │                   │
   │  └─────┘ └─────┘                   │
   │                                     │
   │  Canton Wallets                    │
   │  ┌─────┐ ┌─────┐ ┌─────┐          │
   │  │Loop │ │Bron │ │Cant │          │
   │  │     │ │     │ │or8  │          │
   │  └─────┘ └─────┘ └─────┘          │
   │  ┌─────────────────────────────┐   │
   │  │ Passkey (WebAuthn)          │   │
   │  └─────────────────────────────┘   │
   │                                     │
   │  Hardware Wallets                  │
   │  ┌─────┐ ┌─────┐                   │
   │  │Ledger│ │Trezor│                  │
   │  └─────┘ └─────┘                   │
   │  ⚠️ Canton not supported yet       │
   └─────────────────────────────────────┘
   ```

2. **Wallet Status Indicator:**
   - Показывать все подключенные кошельки
   - Показывать балансы для каждой сети
   - Показывать статус подключения
   - Показывать предупреждения (неправильная сеть, низкий баланс)

3. **Network Switching:**
   - Автоматическое переключение при необходимости
   - Подтверждение пользователя
   - Показ предупреждений о комиссиях

---

## 🎯 CONTEXT FOR AI

Ты **senior full-stack разработчик** со специализацией в:
- DeFi UX/UI design patterns
- React/Next.js best practices
- Error handling и validation
- State management (Zustand)
- Web3 wallet integrations (wagmi)
- TypeScript strict mode

**Твоя задача:** Методично проанализировать все компоненты, найти все недоделки и исправить их, приведя платформу в production-ready состояние.

---

## 🔧 TECHNICAL REQUIREMENTS — WALLET INTEGRATION

### 1. **Canton Native Wallet SDKs**

**Необходимо интегрировать:**

```typescript
// src/lib/canton/wallets/loopWallet.ts
export class LoopWalletConnector {
  async connect(): Promise<CantonAccount>;
  async disconnect(): void;
  async getBalance(): Promise<string>;
  async signTransaction(tx: CantonTransaction): Promise<string>;
  async getTokens(): Promise<CIP56Token[]>;
}

// src/lib/canton/wallets/bronWallet.ts
export class BronWalletConnector {
  async connect(): Promise<CantonAccount>;
  async disconnect(): void;
  async getBalance(): Promise<string>;
  async signTransaction(tx: CantonTransaction): Promise<string>;
  async getTokens(): Promise<CIP56Token[]>;
}

// src/lib/canton/wallets/cantor8Wallet.ts
export class Cantor8WalletConnector {
  async connect(): Promise<CantonAccount>;
  async disconnect(): void;
  async getBalance(): Promise<string>;
  async signTransaction(tx: CantonTransaction): Promise<string>;
  async getTokens(): Promise<CIP56Token[]>;
}

// src/lib/canton/wallets/passkeyWallet.ts
export class PasskeyWalletConnector {
  async connect(): Promise<CantonAccount>; // WebAuthn flow
  async disconnect(): void;
  async getBalance(): Promise<string>;
  async signTransaction(tx: CantonTransaction): Promise<string>;
  async getTokens(): Promise<CIP56Token[]>;
}
```

### 2. **Unified Wallet Hook**

```typescript
// src/lib/canton/hooks/useUnifiedWallet.ts
export const useUnifiedWallet = () => {
  // EVM wallets (через wagmi)
  const evmWallet = useAccount();
  
  // NEAR wallets (через wallet selector)
  const nearWallet = useNearWallet();
  
  // Canton wallets (native)
  const cantonWallet = useCantonWallet();
  
  return {
    // Все подключенные кошельки
    connectedWallets: {
      evm: evmWallet.isConnected ? evmWallet : null,
      near: nearWallet.isConnected ? nearWallet : null,
      canton: cantonWallet.isConnected ? cantonWallet : null,
    },
    
    // Единый баланс для всех сетей
    totalBalance: {
      evm: calculateEVMBalance(evmWallet),
      near: calculateNEARBalance(nearWallet),
      canton: calculateCantonBalance(cantonWallet),
    },
    
    // Единый интерфейс для транзакций
    sendTransaction: async (tx: UnifiedTransaction) => {
      // Автоматически определяет тип и использует правильный кошелек
    },
  };
};
```

### 3. **CIP-56 Token Service**

```typescript
// src/lib/canton/services/cip56TokenService.ts
export class CIP56TokenService {
  // Получить все CIP-56 токены пользователя
  async getUserTokens(cantonAddress: string): Promise<CIP56Token[]>;
  
  // Получить баланс конкретного токена
  async getTokenBalance(
    cantonAddress: string,
    contractId: string
  ): Promise<string>;
  
  // Transfer токена
  async transferToken(params: {
    from: string;
    to: string;
    contractId: string;
    amount: string;
    signer: CantonWalletSigner;
  }): Promise<TransactionResult>;
  
  // Получить метаданные токена
  async getTokenMetadata(contractId: string): Promise<TokenMetadata>;
  
  // Подписаться на обновления баланса
  subscribeToBalance(
    address: string,
    contractId: string,
    callback: (balance: string) => void
  ): () => void;
}
```

### 4. **Connect Wallet Component**

```typescript
// src/components/wallet/ConnectWalletModal.tsx
export const ConnectWalletModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConnect: (wallet: ConnectedWallet) => void;
}> = ({ isOpen, onClose, onConnect }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <WalletSelector
        evmWallets={['metamask', 'walletconnect', 'coinbase', 'trust']}
        nearWallets={['meteor', 'here']}
        cantonWallets={['loop', 'bron', 'cantor8', 'passkey']}
        hardwareWallets={['ledger', 'trezor']}
        onSelect={onConnect}
      />
    </Modal>
  );
};
```

### 5. **Wallet Status Component**

```typescript
// src/components/wallet/WalletStatus.tsx
export const WalletStatus: React.FC = () => {
  const { connectedWallets, totalBalance } = useUnifiedWallet();
  
  return (
    <div className="wallet-status">
      {/* EVM Wallet Status */}
      {connectedWallets.evm && (
        <WalletBadge
          type="evm"
          address={connectedWallets.evm.address}
          balance={totalBalance.evm}
          network={connectedWallets.evm.chain?.name}
        />
      )}
      
      {/* NEAR Wallet Status */}
      {connectedWallets.near && (
        <WalletBadge
          type="near"
          address={connectedWallets.near.accountId}
          balance={totalBalance.near}
        />
      )}
      
      {/* Canton Wallet Status */}
      {connectedWallets.canton && (
        <WalletBadge
          type="canton"
          address={connectedWallets.canton.address}
          balance={totalBalance.canton}
          tokens={connectedWallets.canton.tokens}
        />
      )}
    </div>
  );
};
```

---

## 📁 COMPONENTS TO FIX

### 1. **CCPurchaseWidget** (`src/components/defi/CCPurchaseWidget.tsx`)

#### Проблемы:
- ❌ Тестовый режим вместо реальной интеграции (строки 172-200)
- ❌ Нет валидации баланса пользователя перед покупкой
- ❌ Нет проверки достаточности средств
- ❌ Отсутствие обработки ошибок сети
- ❌ Нет retry механизма для failed transactions
- ❌ Отсутствие confirmation dialog перед покупкой
- ❌ Нет прогресс-бара для multi-step процесса
- ❌ Отсутствие success screen после покупки
- ❌ Нет истории покупок
- ❌ Отсутствие slippage protection

#### Что нужно исправить:
1. **Убрать тестовый режим** — заменить на реальную интеграцию с bridge
2. **Добавить валидацию баланса:**
   ```typescript
   - Проверка баланса выбранного stablecoin
   - Валидация достаточности средств (amount + fees)
   - Показ доступного баланса в UI
   ```
3. **Добавить error handling:**
   ```typescript
   - Network errors (timeout, connection lost)
   - Transaction failures (revert, insufficient gas)
   - Bridge errors (liquidity, slippage)
   - User rejection (wallet cancel)
   ```
4. **Добавить confirmation flow:**
   ```typescript
   - Modal с деталями покупки (amount, fees, final CC amount)
   - Подтверждение пользователем
   - Показ estimated time
   ```
5. **Добавить progress tracking:**
   ```typescript
   - Step 1: Approval (если нужно)
   - Step 2: Bridge transfer
   - Step 3: CC minting
   - Real-time status updates
   ```
6. **Добавить success state:**
   ```typescript
   - Success screen с деталями транзакции
   - Link to transaction explorer
   - Option to view in portfolio
   ```
7. **Добавить retry mechanism:**
   ```typescript
   - Auto-retry для network errors
   - Manual retry button
   - Max retry attempts (3)
   ```

---

### 2. **MultiPartyDashboard** (`src/components/defi/MultiPartyDashboard.tsx`)

#### Проблемы:
- ❌ TODO комментарий: "implement multiPartyWorkflowService" (строка 33)
- ❌ Нет реальной интеграции с workflow service
- ❌ Mock данные вместо реальных транзакций
- ❌ Отсутствие real-time updates
- ❌ Нет фильтрации и поиска
- ❌ Отсутствие pagination для больших списков
- ❌ Нет экспорта данных
- ❌ Отсутствие детального view транзакций

#### Что нужно исправить:
1. **Интегрировать multiPartyWorkflowService:**
   ```typescript
   - Использовать useMultiPartyWorkflowService hook
   - Подключить к реальному API
   - Обработать ошибки подключения
   ```
2. **Добавить real-time updates:**
   ```typescript
   - WebSocket connection для live updates
   - Polling fallback
   - Optimistic updates
   ```
3. **Добавить фильтрацию:**
   ```typescript
   - По статусу (pending, approved, rejected)
   - По типу транзакции
   - По дате
   - По инициатору
   ```
4. **Добавить поиск:**
   ```typescript
   - По transaction ID
   - По party ID
   - По описанию
   ```
5. **Добавить pagination:**
   ```typescript
   - Infinite scroll или page-based
   - Лимит 20 транзакций на страницу
   ```
6. **Добавить детальный view:**
   ```typescript
   - Modal с полной информацией о транзакции
   - История подписей
   - Timeline событий
   ```
7. **Добавить экспорт:**
   ```typescript
   - CSV export
   - PDF report
   - JSON export
   ```

---

### 3. **MultiPartyAuthPanel** (`src/components/defi/MultiPartyAuthPanel.tsx`)

#### Проблемы:
- ❌ Упрощенная реализация (строка 28: "Simplified component")
- ❌ Нет валидации подписи
- ❌ Отсутствие проверки прав пользователя
- ❌ Нет подтверждения перед approve/reject
- ❌ Отсутствие reason для reject
- ❌ Нет истории действий
- ❌ Отсутствие уведомлений о статусе

#### Что нужно исправить:
1. **Добавить валидацию:**
   ```typescript
   - Проверка прав пользователя на подпись
   - Валидация формата подписи
   - Проверка срока действия транзакции
   ```
2. **Улучшить approve/reject flow:**
   ```typescript
   - Confirmation modal с деталями
   - Обязательный reason для reject
   - Подтверждение через wallet (если нужно)
   ```
3. **Добавить history:**
   ```typescript
   - История всех действий пользователя
   - Audit trail
   ```
4. **Добавить уведомления:**
   ```typescript
   - Toast notifications для успешных действий
   - Error notifications
   - Status change notifications
   ```

---

### 4. **CantonDeFi** (`src/components/defi/CantonDeFi.tsx`)

#### Проблемы:
- ❌ Неиспользуемые функции (строки 59, 66)
- ❌ Нет обработки ошибок при инвестировании
- ❌ Отсутствие валидации минимальной суммы
- ❌ Нет проверки подключения кошелька перед действиями
- ❌ Отсутствие loading states для некоторых операций
- ❌ Нет empty states когда нет продуктов
- ❌ Отсутствие error boundaries
- ❌ Нет retry для failed operations

#### Что нужно исправить:
1. **Добавить error handling:**
   ```typescript
   - Try-catch для всех async операций
   - Error boundaries для компонентов
   - User-friendly error messages
   - Retry buttons
   ```
2. **Добавить валидацию:**
   ```typescript
   - Минимальная сумма инвестирования
   - Максимальная сумма (если есть лимиты)
   - Проверка баланса
   - Проверка подключения кошелька
   ```
3. **Улучшить loading states:**
   ```typescript
   - Skeleton loaders для всех async данных
   - Progress indicators для долгих операций
   - Disable buttons во время loading
   ```
4. **Добавить empty states:**
   ```typescript
   - Когда нет доступных продуктов
   - Когда нет портфолио
   - Когда нет транзакций
   ```
5. **Улучшить feedback:**
   ```typescript
   - Toast notifications для всех действий
   - Success/error states
   - Confirmation dialogs для критических действий
   ```

---

### 5. **ProductCard** (`src/components/defi/ProductCard.tsx`)

#### Проблемы:
- ❌ Нет валидации перед инвестированием
- ❌ Отсутствие confirmation dialog
- ❌ Нет проверки минимальной суммы
- ❌ Отсутствие error handling
- ❌ Нет success feedback

#### Что нужно исправить:
1. **Добавить валидацию:**
   ```typescript
   - Проверка минимальной суммы
   - Проверка подключения кошелька
   - Проверка баланса
   ```
2. **Добавить confirmation:**
   ```typescript
   - Modal с деталями инвестирования
   - Показ fees и final amount
   - Подтверждение пользователем
   ```
3. **Улучшить error handling:**
   ```typescript
   - Try-catch в onInvest
   - Показ ошибок пользователю
   - Retry mechanism
   ```

---

### 6. **StablecoinSelector** (`src/components/defi/StablecoinSelector.tsx`)

#### Проблемы:
- ❌ Нет проверки доступности сети
- ❌ Отсутствие показа баланса
- ❌ Нет фильтрации по доступным сетям
- ❌ Отсутствие loading state

#### Что нужно исправить:
1. **Добавить проверку сети:**
   ```typescript
   - Проверка подключенной сети в wallet
   - Показ только доступных сетей
   - Предупреждение о необходимости переключения сети
   ```
2. **Добавить показ баланса:**
   ```typescript
   - Показ баланса для каждого stablecoin
   - Обновление в real-time
   - Форматирование больших чисел
   ```
3. **Добавить фильтрацию:**
   ```typescript
   - По доступным сетям
   - По балансу (только с балансом > 0)
   ```

---

## 🔄 FLOW IMPROVEMENTS

### Purchase Flow (CCPurchaseWidget)
```
1. User selects stablecoin
   → Validate network connection
   → Show balance
   → Enable amount input

2. User enters amount
   → Validate min/max limits
   → Calculate fees
   → Show quote with expiry
   → Enable purchase button

3. User clicks purchase
   → Show confirmation modal
   → User confirms
   → Check balance again
   → Start approval (if needed)
   → Show progress
   → Execute bridge
   → Show success screen
   → Update portfolio
```

### Investment Flow (ProductCard)
```
1. User clicks "Invest"
   → Check wallet connection
   → Show investment modal
   → User enters amount
   → Validate min investment
   → Show fees and final amount
   → User confirms
   → Execute investment
   → Show progress
   → Show success
   → Update portfolio
```

### Multi-Party Flow (MultiPartyAuthPanel)
```
1. Transaction appears
   → Check user permissions
   → Show transaction details
   → User reviews
   → User approves/rejects
   → Confirmation modal
   → Execute action
   → Show result
   → Update dashboard
```

---

## 🎨 UX IMPROVEMENTS

### 1. **Loading States**
- ✅ Skeleton loaders для всех async данных
- ✅ Progress bars для multi-step процессов
- ✅ Spinners для быстрых операций
- ✅ Disable buttons во время loading

### 2. **Error States**
- ✅ User-friendly error messages
- ✅ Retry buttons
- ✅ Error boundaries
- ✅ Fallback UI

### 3. **Empty States**
- ✅ Когда нет данных
- ✅ Когда нет результатов поиска
- ✅ Когда нет транзакций
- ✅ С actionable CTAs

### 4. **Success States**
- ✅ Success screens
- ✅ Confirmation messages
- ✅ Transaction links
- ✅ Next steps suggestions

### 5. **Validation**
- ✅ Real-time validation
- ✅ Clear error messages
- ✅ Visual indicators (red borders, icons)
- ✅ Helper text

### 6. **Feedback**
- ✅ Toast notifications
- ✅ Inline messages
- ✅ Status badges
- ✅ Progress indicators

---

## 🛠️ TECHNICAL REQUIREMENTS

### Error Handling
```typescript
// Все async функции должны иметь:
try {
  // operation
} catch (error) {
  // Log error
  // Show user-friendly message
  // Provide retry option
  // Fallback behavior
}
```

### Validation
```typescript
// Все user inputs должны валидироваться:
- Type checking
- Range validation
- Format validation
- Business rules
- Real-time feedback
```

### State Management
```typescript
// Использовать Zustand store для:
- Global loading states
- Error states
- User preferences
- Cache данных
```

### Type Safety
```typescript
// Строгая типизация:
- Все props типизированы
- Все функции типизированы
- Нет any типов
- Использовать discriminated unions
```

---

## 📝 CHECKLIST

### CCPurchaseWidget
- [ ] Убрать тестовый режим
- [ ] Добавить валидацию баланса
- [ ] Добавить error handling
- [ ] Добавить confirmation flow
- [ ] Добавить progress tracking
- [ ] Добавить success state
- [ ] Добавить retry mechanism
- [ ] Добавить slippage protection

### MultiPartyDashboard
- [ ] Интегрировать workflow service
- [ ] Добавить real-time updates
- [ ] Добавить фильтрацию
- [ ] Добавить поиск
- [ ] Добавить pagination
- [ ] Добавить детальный view
- [ ] Добавить экспорт

### MultiPartyAuthPanel
- [ ] Добавить валидацию
- [ ] Улучшить approve/reject flow
- [ ] Добавить history
- [ ] Добавить уведомления

### CantonDeFi
- [ ] Добавить error handling
- [ ] Добавить валидацию
- [ ] Улучшить loading states
- [ ] Добавить empty states
- [ ] Улучшить feedback

### ProductCard
- [ ] Добавить валидацию
- [ ] Добавить confirmation
- [ ] Улучшить error handling

### StablecoinSelector
- [ ] Добавить проверку сети
- [ ] Добавить показ баланса
- [ ] Добавить фильтрацию

---

## 🚀 EXECUTION PLAN

1. **Phase 1: Wallet Integration (КРИТИЧНО)** (4-6 часов)
   - Исследовать и интегрировать Canton native wallet SDKs
   - Создать UnifiedWallet interface
   - Интегрировать CIP-56 token support
   - Создать ConnectWalletModal с поддержкой всех кошельков
   - Добавить WebAuthn/passkey для Canton
   - Интегрировать Dfns (опционально, для enterprise)

2. **Phase 2: Critical Fixes** (2-3 часа)
   - Убрать тестовый режим из CCPurchaseWidget
   - Добавить базовую валидацию во все компоненты
   - Добавить error handling

3. **Phase 3: UX Improvements** (2-3 часа)
   - Добавить loading states
   - Добавить empty states
   - Улучшить feedback
   - Добавить wallet status indicators

4. **Phase 4: Integration** (2-3 часа)
   - Интегрировать MultiPartyDashboard
   - Улучшить флоу между компонентами
   - Добавить real-time updates
   - Интегрировать wallet state во все компоненты

5. **Phase 5: Security & Analytics** (2-3 часа)
   - Добавить security checks
   - Интегрировать analytics
   - Настроить monitoring
   - Добавить error tracking

6. **Phase 6: User Experience** (2-3 часа)
   - Реализовать notifications system
   - Добавить user settings
   - Создать onboarding flow
   - Добавить help & support

7. **Phase 7: Portfolio & History** (2-3 часа)
   - Создать portfolio dashboard
   - Реализовать transaction history
   - Добавить charts и analytics
   - Экспорт функциональность

8. **Phase 8: Mobile & Accessibility** (2-3 часа)
   - Оптимизировать для мобильных
   - Добавить accessibility features
   - Реализовать PWA
   - Mobile-specific features

9. **Phase 9: i18n & Documentation** (1-2 часа)
   - Добавить поддержку языков
   - Создать документацию
   - Написать user guides

10. **Phase 10: Testing & Polish** (2-3 часа)
    - Написать unit tests
    - Написать integration tests
    - E2E testing
    - Security testing
    - Performance optimization
    - Финальное тестирование всех flows

---

## 📚 REFERENCES

### Design System & Components
- Design System: `design-system/MASTER.md`
- Component Patterns: Existing UI components
- Error Handling: `src/lib/canton/utils/errorHandler.ts`
- State Management: `src/lib/canton/store/cantonStore.ts`

### Wallet Integration
- Current wagmi config: `src/lib/canton/config/wagmi.ts`
- WagmiProvider: `src/components/providers/WagmiProvider.tsx`
- NEAR Wallet Selector: `src/lib/near-wallet-selector.ts`
- Canton Integration: `src/lib/canton/hooks/realCantonIntegration.ts`

### Bridge Configuration
- Bridge config: `src/lib/canton/config/realBridgeConfig.ts` — содержит `REAL_BRIDGE_CONFIG` и `getBridgeContractAddress()`
- Stablecoins config: `src/lib/canton/config/stablecoins.ts` — содержит `CANTON_BRIDGE_CONFIG` и `CC_PURCHASE_CONFIG`
- **ВАЖНО:** Для исправления placeholder в CCPurchaseWidget использовать `getBridgeContractAddress()` из `realBridgeConfig.ts`

### External Resources
- **Canton Network Ecosystem:** https://www.canton.network/ecosystem
- **Dfns Canton Support:** https://www.dfns.co/article/canton-tier-1-support
- **Canton Wallet (Send.it):** https://info.send.it/docs/canton-wallet/overview
- **CIP-56 Token Standard:** (research needed)
- **Loop Wallet:** (SDK documentation needed)
- **Bron Wallet:** (SDK documentation needed)
- **Cantor8:** (SDK documentation needed)

### Research Notes
- **Hardware Wallets:** Ledger/Trezor пока НЕ поддерживают Canton официально
- **Tangem:** Временно НЕ поддерживает Canton
- **Dfns:** Предоставляет Tier-1 support с automatic token detection и on-chain history
- **WebAuthn/Passkey:** Поддерживается Canton Wallet через Send.it
- **CIP-56:** Стандарт для токенов на Canton, нужна интеграция для отображения

---

## ✅ SUCCESS CRITERIA

Платформа считается готовой когда:

### Wallet Integration
- ✅ Поддерживаются все основные EVM кошельки (MetaMask, WalletConnect, Coinbase, Trust)
- ✅ Поддерживаются NEAR кошельки (Meteor, Here)
- ✅ **КРИТИЧНО: Поддерживаются Canton native кошельки (Loop, Bron, Cantor8)**
- ✅ **КРИТИЧНО: Работает WebAuthn/passkey для Canton Wallet**
- ✅ **КРИТИЧНО: Поддерживается CIP-56 стандарт токенов**
- ✅ Единый интерфейс для всех типов кошельков
- ✅ Корректное отображение балансов для всех сетей
- ✅ Работает переключение между сетями
- ✅ Понятные ошибки при неподдерживаемых сетях/кошельках

### Component Quality
- ✅ Все компоненты работают без тестового режима
- ✅ Все ошибки обрабатываются gracefully
- ✅ Все пользовательские действия имеют feedback
- ✅ Все данные валидируются
- ✅ Все async операции имеют loading states
- ✅ Все пустые состояния имеют UI
- ✅ Все компоненты интегрированы между собой

### Technical Quality
- ✅ Нет console errors
- ✅ Нет TypeScript errors
- ✅ Все флоу протестированы
- ✅ Wallet connections работают стабильно
- ✅ Real-time updates работают корректно

### Security & Compliance
- ✅ Security audit пройден
- ✅ Smart contract audits завершены
- ✅ Все транзакции валидируются
- ✅ Rate limiting настроен
- ✅ Data encryption работает

### User Experience
- ✅ Onboarding flow работает
- ✅ Notifications система функционирует
- ✅ User settings сохраняются
- ✅ Help & support доступны
- ✅ Mobile experience оптимизирован

### Analytics & Monitoring
- ✅ Analytics интегрированы
- ✅ Error tracking работает
- ✅ Performance monitoring настроен
- ✅ Business metrics отслеживаются

### Portfolio & History
- ✅ Portfolio dashboard отображает корректные данные
- ✅ Transaction history полная
- ✅ Charts работают корректно
- ✅ Export функциональность работает

### Accessibility & i18n
- ✅ WCAG 2.1 AA compliance
- ✅ Keyboard navigation работает
- ✅ Screen reader support есть
- ✅ Поддержка языков работает
- ✅ Локализация корректная

---

---

## 🔒 SECURITY & AUDIT REQUIREMENTS

### Критические требования безопасности

#### 1. **Transaction Security**
- ✅ Валидация всех транзакций перед подписанием
- ✅ Проверка адресов получателей (whitelist для критических операций)
- ✅ Лимиты на суммы транзакций (daily, monthly)
- ✅ 2FA для критических операций (опционально)
- ✅ Transaction simulation перед execution
- ✅ Slippage protection для всех swaps

#### 2. **Wallet Security**
- ✅ Проверка подлинности кошелька перед подключением
- ✅ Валидация подписей транзакций
- ✅ Защита от phishing (проверка домена)
- ✅ Session management (автоматический disconnect после timeout)
- ✅ Audit log всех wallet операций

#### 3. **Data Security**
- ✅ Шифрование sensitive данных в localStorage
- ✅ Secure storage для private keys (если используются)
- ✅ HTTPS only для всех API calls
- ✅ CSP headers для защиты от XSS
- ✅ Rate limiting для API endpoints

#### 4. **Smart Contract Security**
- ✅ Проверка контрактов перед взаимодействием
- ✅ Audit reports для используемых контрактов
- ✅ Multi-sig для критических операций
- ✅ Timelock для больших транзакций

---

## 📊 ANALYTICS & MONITORING

### Требования к аналитике

#### 1. **User Analytics**
```typescript
// Трекинг пользовательских действий
interface AnalyticsEvent {
  event: string;
  category: 'wallet' | 'transaction' | 'investment' | 'error';
  properties: Record<string, any>;
  userId?: string;
  timestamp: number;
}

// События для трекинга:
- wallet_connected (type, network)
- transaction_initiated (type, amount, token)
- transaction_completed (txHash, duration)
- transaction_failed (error, reason)
- investment_made (product, amount)
- error_occurred (error, context)
```

#### 2. **Performance Monitoring**
- ✅ Web Vitals tracking (LCP, FID, CLS)
- ✅ API response times
- ✅ Error rates по компонентам
- ✅ Wallet connection success rates
- ✅ Transaction success rates

#### 3. **Business Metrics**
- ✅ Daily Active Users (DAU)
- ✅ Total Value Locked (TVL)
- ✅ Transaction volume
- ✅ Revenue metrics
- ✅ User retention

---

## 🔔 NOTIFICATIONS SYSTEM

### Требования к уведомлениям

#### 1. **In-App Notifications**
```typescript
interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible: boolean;
  autoDismiss?: number; // milliseconds
}

// Типы уведомлений:
- Transaction pending
- Transaction confirmed
- Transaction failed
- Wallet connected/disconnected
- Balance updates
- Price alerts
- System maintenance
```

#### 2. **Push Notifications** (опционально)
- ✅ Browser push notifications
- ✅ Mobile push notifications
- ✅ Email notifications для критических событий
- ✅ Telegram notifications (если интегрирован)

#### 3. **Notification Center**
- ✅ Централизованный компонент для всех уведомлений
- ✅ История уведомлений
- ✅ Фильтрация по типу
- ✅ Mark as read/unread
- ✅ Clear all

---

## ⚙️ USER SETTINGS & PREFERENCES

### Настройки пользователя

#### 1. **Wallet Settings**
```typescript
interface WalletSettings {
  // Автоматическое переключение сети
  autoSwitchNetwork: boolean;
  
  // Slippage tolerance
  slippageTolerance: number; // 0.1% - 5%
  
  // Transaction speed
  transactionSpeed: 'slow' | 'standard' | 'fast';
  
  // Gas price preferences
  gasPrice: 'low' | 'medium' | 'high' | 'custom';
  
  // Auto-approve для известных контрактов
  autoApprove: boolean;
  
  // Список доверенных контрактов
  trustedContracts: string[];
}
```

#### 2. **Display Settings**
```typescript
interface DisplaySettings {
  // Тема оформления
  theme: 'dark' | 'light' | 'auto';
  
  // Валюта для отображения
  currency: 'USD' | 'EUR' | 'BTC' | 'ETH';
  
  // Формат чисел
  numberFormat: 'standard' | 'compact' | 'scientific';
  
  // Язык интерфейса
  language: 'en' | 'ru' | 'zh' | 'es';
  
  // Анимации
  animations: boolean;
  reducedMotion: boolean;
}
```

#### 3. **Privacy Settings**
```typescript
interface PrivacySettings {
  // Аналитика
  analyticsEnabled: boolean;
  
  // Cookies
  cookiesAccepted: boolean;
  
  // Персональные данные
  dataSharing: boolean;
  
  // Публичный профиль
  publicProfile: boolean;
}
```

---

## 📱 MOBILE OPTIMIZATION

### Критические улучшения для мобильных

#### 1. **Touch Optimization**
- ✅ Минимальный размер touch targets: 44x44px
- ✅ Adequate spacing между интерактивными элементами
- ✅ Swipe gestures для навигации
- ✅ Pull-to-refresh для списков
- ✅ Bottom sheet для модальных окон

#### 2. **Performance**
- ✅ Lazy loading для изображений
- ✅ Code splitting для мобильных
- ✅ Оптимизация bundle size
- ✅ Service Worker для offline support
- ✅ Image optimization (WebP, responsive images)

#### 3. **Mobile-Specific Features**
- ✅ Deep linking для транзакций
- ✅ Share functionality
- ✅ Add to home screen (PWA)
- ✅ Camera для QR code scanning
- ✅ Biometric authentication (Face ID, Touch ID)

---

## 📈 PORTFOLIO & TRANSACTION HISTORY

### Требования к портфолио

#### 1. **Portfolio Dashboard**
```typescript
interface PortfolioData {
  // Общий баланс
  totalValue: {
    usd: number;
    native: string; // CC, ETH, NEAR
  };
  
  // Распределение по сетям
  byNetwork: {
    evm: number;
    near: number;
    canton: number;
  };
  
  // Распределение по типам активов
  byAsset: {
    tokens: TokenBalance[];
    nfts: NFTBalance[];
    staked: StakedBalance[];
  };
  
  // Performance
  performance: {
    daily: number; // %
    weekly: number;
    monthly: number;
    allTime: number;
  };
}
```

#### 2. **Transaction History**
- ✅ Полная история всех транзакций
- ✅ Фильтрация по типу, сети, статусу, дате
- ✅ Поиск по transaction hash, адресу
- ✅ Экспорт в CSV/PDF
- ✅ Детальный view каждой транзакции
- ✅ Links к block explorers

#### 3. **Analytics & Charts**
- ✅ Графики портфолио over time
- ✅ Распределение активов (pie chart)
- ✅ Performance charts
- ✅ Transaction volume charts

---

## 🧪 TESTING REQUIREMENTS

### Требования к тестированию

#### 1. **Unit Tests**
- ✅ Все utility функции
- ✅ Все hooks
- ✅ Все services
- ✅ Coverage минимум 80%

#### 2. **Integration Tests**
- ✅ Wallet connection flows
- ✅ Transaction flows
- ✅ API integrations
- ✅ State management

#### 3. **E2E Tests**
- ✅ Полные user flows
- ✅ Critical paths (purchase, invest, swap)
- ✅ Error scenarios
- ✅ Cross-browser testing

#### 4. **Security Tests**
- ✅ Penetration testing
- ✅ Smart contract audits
- ✅ Dependency scanning
- ✅ Code review

---

## 🌍 INTERNATIONALIZATION (i18n)

### Поддержка языков

#### 1. **Required Languages**
- ✅ English (en) - default
- ✅ Russian (ru)
- ✅ Chinese (zh)
- ✅ Spanish (es)

#### 2. **Implementation**
```typescript
// Использовать next-intl или react-i18next
// Все тексты должны быть в translation files
// Форматирование дат, чисел, валют по локали
```

#### 3. **Content to Translate**
- ✅ UI labels и buttons
- ✅ Error messages
- ✅ Help text
- ✅ Legal documents
- ✅ Email templates

---

## ♿ ACCESSIBILITY (a11y)

### Требования доступности

#### 1. **WCAG 2.1 AA Compliance**
- ✅ Keyboard navigation для всех элементов
- ✅ Screen reader support (ARIA labels)
- ✅ Color contrast минимум 4.5:1
- ✅ Focus indicators
- ✅ Alt text для всех изображений

#### 2. **Features**
- ✅ Skip to main content
- ✅ Keyboard shortcuts
- ✅ High contrast mode
- ✅ Font size adjustment
- ✅ Reduced motion support

---

## 🚨 ERROR RECOVERY & RESILIENCE

### Восстановление после ошибок

#### 1. **Error Recovery**
- ✅ Auto-retry для network errors
- ✅ Fallback UI для failed components
- ✅ Graceful degradation
- ✅ Offline mode support
- ✅ Data persistence (localStorage, IndexedDB)

#### 2. **Resilience Patterns**
- ✅ Circuit breaker для API calls
- ✅ Request queuing для failed requests
- ✅ Exponential backoff
- ✅ Health checks для services

---

## 📚 DOCUMENTATION REQUIREMENTS

### Документация для разработчиков

#### 1. **Code Documentation**
- ✅ JSDoc для всех публичных функций
- ✅ README для каждого компонента
- ✅ Architecture diagrams
- ✅ API documentation

#### 2. **User Documentation**
- ✅ Getting started guide
- ✅ Wallet connection guide
- ✅ Transaction guide
- ✅ FAQ
- ✅ Video tutorials

---

## 🎯 ONBOARDING FLOW

### Процесс онбординга

#### 1. **First-Time User Experience**
```
1. Welcome screen
   → Explain platform benefits
   → Show key features
   
2. Wallet connection tutorial
   → Step-by-step guide
   → Video demonstration
   
3. First transaction tutorial
   → Guided purchase flow
   → Tips and best practices
   
4. Portfolio setup
   → Add favorite tokens
   → Set up alerts
```

#### 2. **Progressive Disclosure**
- ✅ Показывать информацию постепенно
- ✅ Tooltips для сложных концепций
- ✅ Contextual help
- ✅ Interactive tutorials

---

## 🔄 STATE PERSISTENCE & SYNC

### Сохранение состояния

#### 1. **Local Storage**
- ✅ Wallet connections (encrypted)
- ✅ User preferences
- ✅ Recent transactions cache
- ✅ Portfolio data cache

#### 2. **State Sync**
- ✅ Sync между вкладками (BroadcastChannel)
- ✅ Sync между устройствами (cloud storage)
- ✅ Conflict resolution

---

## 📋 ADDITIONAL CHECKLIST ITEMS

### Security & Audit
- [ ] Security audit проведен
- [ ] Smart contract audits завершены
- [ ] Penetration testing пройден
- [ ] Dependency vulnerabilities исправлены
- [ ] Rate limiting настроен
- [ ] CSP headers настроены

### Analytics & Monitoring
- [ ] Analytics интегрированы
- [ ] Error tracking настроен
- [ ] Performance monitoring работает
- [ ] Business metrics отслеживаются

### Notifications
- [ ] In-app notifications работают
- [ ] Notification center реализован
- [ ] Push notifications настроены (опционально)

### Settings
- [ ] User settings сохранены
- [ ] Wallet preferences работают
- [ ] Display settings применяются
- [ ] Privacy settings функционируют

### Mobile
- [ ] Mobile optimization завершена
- [ ] Touch targets оптимизированы
- [ ] PWA функциональность работает
- [ ] Mobile-specific features реализованы

### Portfolio
- [ ] Portfolio dashboard работает
- [ ] Transaction history полная
- [ ] Charts и analytics отображаются
- [ ] Export функциональность работает

### Testing
- [ ] Unit tests написаны
- [ ] Integration tests пройдены
- [ ] E2E tests завершены
- [ ] Security tests пройдены

### i18n
- [ ] Translation files созданы
- [ ] Все тексты переведены
- [ ] Локализация работает
- [ ] Форматирование корректное

### Accessibility
- [ ] WCAG compliance проверен
- [ ] Keyboard navigation работает
- [ ] Screen reader support есть
- [ ] Color contrast достаточный

### Documentation
- [ ] Code documentation полная
- [ ] User guides написаны
- [ ] API docs обновлены
- [ ] Architecture diagrams созданы

### Onboarding
- [ ] Onboarding flow реализован
- [ ] Tutorials работают
- [ ] Help system интегрирован

---

---

## 🔍 ЗАДАЧА ДЛЯ НОВОГО ЧАТА — VERIFICATION & COMPLETION

### Цель
Проверить все выполненные исправления, найти упущения и упрощения, завершить все доработки до production-ready состояния.

### Шаги выполнения

#### ШАГ 1: ПРОВЕРКА ВЫПОЛНЕННЫХ ИСПРАВЛЕНИЙ (45-60 минут)

**ВАЖНО:** Перед началом работы прочитай все измененные файлы полностью, чтобы понять текущую реализацию.

1. **Проверить CCPurchaseWidget:**
   ```bash
   # Прочитать файл полностью: src/components/defi/CCPurchaseWidget.tsx
   # Проверить:
   - Реальная интеграция с bridge через useCantonBridge hook (не тестовый режим)
   - Валидация баланса работает корректно через useBalance
   - Проверка allowance для bridge contract работает
   - КРИТИЧНО: bridgeContractAddress заменен на реальный адрес из конфига
   - Confirmation dialog отображается правильно с деталями
   - Progress tracking работает для всех шагов (approving, bridging, success)
   - Success screen показывает корректные данные и ссылку на транзакцию
   - Retry mechanism работает (максимум 3 попытки)
   - Обработка всех типов ошибок (network, transaction, user rejection)
   - Approval транзакция выполняется автоматически при необходимости
   ```
   
   **Что проверить:**
   - [ ] Нет упоминаний "TESTING MODE" или "🧪 ТЕСТИРОВАНИЕ"
   - [ ] Используется `useBalance` и `useReadContract` из wagmi
   - [ ] Проверка баланса происходит перед покупкой
   - [ ] **КРИТИЧНО:** `bridgeContractAddress` заменен на реальный адрес из конфига (сейчас placeholder `0x0000...0000`)
   - [ ] Confirmation modal показывает все детали (amount, fees, CC amount, network)
   - [ ] Progress tracking показывает все шаги (approving, bridging, success)
   - [ ] Success screen содержит ссылку на транзакцию в explorer
   - [ ] Retry работает корректно (максимум 3 попытки, счетчик `retryCount`)
   - [ ] Все ошибки обрабатываются с понятными сообщениями через `toast.error`
   - [ ] Approval транзакция выполняется автоматически если allowance недостаточен
   - [ ] `useWaitForTransactionReceipt` корректно отслеживает статус транзакций
   - [ ] Валидация минимальной/максимальной суммы работает (`CC_PURCHASE_CONFIG`)
   - [ ] Quote expiry проверяется перед выполнением транзакции

2. **Проверить MultiPartyDashboard:**
   ```bash
   # Прочитать файлы полностью:
   # - src/components/defi/MultiPartyDashboard.tsx
   # - src/lib/canton/hooks/useMultiPartyWorkflowService.ts
   # Проверить:
   - Хук useMultiPartyWorkflowService работает корректно
   - Интеграция с CantonServiceManager через getWorkflowService()
   - Event listeners подписаны и работают (transaction_created, signature_collected, transaction_executed)
   - Поиск работает по всем полям (ID, title, description, initiator)
   - Фильтрация работает корректно (статус, тип, userPartyId)
   - Pagination работает без багов (10 транзакций на страницу)
   - Детальный view (TransactionDetailsModal) показывает все данные
   - Экспорт CSV работает и содержит все поля
   - Real-time updates работают (refresh каждые 30 секунд)
   - Cleanup функций для event listeners и intervals
   ```
   
   **Что проверить:**
   - [ ] Хук `useMultiPartyWorkflowService` правильно инициализирует workflow service через `CantonServiceManager`
   - [ ] Event listeners (`transaction_created`, `signature_collected`, `transaction_executed`) работают корректно
   - [ ] Поиск работает по ID, названию, описанию, инициатору (case-insensitive)
   - [ ] Фильтры применяются корректно (статус, тип, userPartyId)
   - [ ] Pagination не ломается при изменении фильтров (сбрасывается на страницу 1)
   - [ ] Детальный modal (`TransactionDetailsModal`) показывает все данные транзакции
   - [ ] CSV экспорт содержит все необходимые поля (ID, title, status, type, initiator, etc.)
   - [ ] Real-time refresh каждые 30 секунд не вызывает лишних ререндеров
   - [ ] Cleanup функции для event listeners и intervals работают корректно
   - [ ] `refreshTransactions` вызывается при необходимости и обновляет состояние
   - [ ] Обработка ошибок при инициализации service работает корректно

#### ШАГ 2: ДОРАБОТКА УПУЩЕННЫХ ФУНКЦИЙ (1-2 часа)

1. **Улучшить MultiPartyAuthPanel:**
   - Добавить валидацию подписи
   - Добавить проверку прав пользователя
   - Улучшить confirmation modal (детали транзакции)
   - Добавить валидацию reason для reject
   - Добавить историю действий
   - Добавить toast notifications

2. **Улучшить CantonDeFi:**
   - Добавить полный error handling везде
   - Добавить валидацию минимальной суммы
   - Добавить проверку кошелька перед всеми действиями
   - Добавить loading states для всех операций
   - Улучшить empty states
   - Добавить error boundaries
   - Добавить retry для failed operations

3. **Улучшить ProductCard:**
   - Добавить валидацию перед инвестированием
   - Добавить confirmation dialog
   - Добавить проверку минимальной суммы
   - Улучшить error handling
   - Добавить success feedback

4. **Улучшить StablecoinSelector:**
   - Добавить проверку доступности сети
   - Добавить показ баланса для каждого stablecoin
   - Добавить фильтрацию по доступным сетям
   - Добавить loading state

#### ШАГ 3: КРИТИЧЕСКИЕ ДОРАБОТКИ — WALLET INTEGRATION (2-3 часа)

**ВАЖНО:** Это критический функционал, но может быть сложным. Если нет готовых SDK, создать архитектуру и заглушки для будущей интеграции.

1. **Исследовать доступность SDK:**
   - Проверить наличие SDK для Loop Wallet
   - Проверить наличие SDK для Bron Wallet
   - Проверить наличие SDK для Cantor8
   - Проверить WebAuthn/passkey API для Canton Wallet
   - Проверить CIP-56 стандарт и документацию

2. **Создать архитектуру (если SDK нет):**
   - Создать интерфейсы для Canton wallet connectors
   - Создать UnifiedWallet interface
   - Создать CIP56TokenService (базовая структура)
   - Создать ConnectWalletModal с поддержкой всех типов кошельков
   - Добавить заглушки для будущей интеграции

3. **Если SDK доступны:**
   - Интегрировать Loop Wallet
   - Интегрировать Bron Wallet
   - Интегрировать Cantor8
   - Интегрировать WebAuthn/passkey
   - Интегрировать CIP-56 token support

#### ШАГ 4: ФИНАЛЬНАЯ ПРОВЕРКА (30-45 минут)

1. **Проверить все компоненты:**
   - [ ] Нет console errors
   - [ ] Нет TypeScript errors
   - [ ] Все компоненты работают без тестового режима
   - [ ] Все ошибки обрабатываются gracefully
   - [ ] Все пользовательские действия имеют feedback
   - [ ] Все данные валидируются
   - [ ] Все async операции имеют loading states
   - [ ] Все пустые состояния имеют UI

2. **Проверить интеграции:**
   - [ ] Wallet connections работают стабильно
   - [ ] Real-time updates работают корректно
   - [ ] Все флоу протестированы мысленно
   - [ ] Нет упрощений в ущерб продукту

3. **Проверить качество кода:**
   - [ ] Нет `any` типов
   - [ ] Все функции типизированы
   - [ ] Нет неиспользуемых переменных
   - [ ] Нет закомментированного кода
   - [ ] Все TODO комментарии обработаны
   - [ ] Нет утечек памяти (event listeners, intervals, subscriptions)
   - [ ] Все cleanup функции работают корректно
   - [ ] Нет лишних ререндеров (используется useMemo, useCallback где нужно)
   - [ ] Все async операции имеют proper error handling
   - [ ] Все состояния правильно инициализируются и сбрасываются

### Критерии завершения

Платформа считается готовой когда:

1. ✅ Все компоненты работают без тестового режима
2. ✅ Все ошибки обрабатываются gracefully
3. ✅ Все пользовательские действия имеют feedback
4. ✅ Все данные валидируются
5. ✅ Все async операции имеют loading states
6. ✅ Все пустые состояния имеют UI
7. ✅ Нет TypeScript errors
8. ✅ Нет console errors
9. ✅ Все интеграции работают корректно
10. ⚠️ Wallet integration: либо полностью интегрировано, либо создана архитектура для будущей интеграции

### Приоритеты

1. **ВЫСОКИЙ ПРИОРИТЕТ:**
   - Завершить доработку MultiPartyAuthPanel
   - Завершить доработку CantonDeFi
   - Завершить доработку ProductCard
   - Завершить доработку StablecoinSelector

2. **СРЕДНИЙ ПРИОРИТЕТ:**
   - Wallet Integration (если SDK доступны)
   - CIP-56 token support (если документация доступна)

3. **НИЗКИЙ ПРИОРИТЕТ:**
   - Создание архитектуры для будущей wallet integration (если SDK недоступны)

---

## 📝 ИНСТРУКЦИИ ДЛЯ AI

**Ты senior full-stack разработчик** со специализацией в:
- DeFi UX/UI design patterns
- React/Next.js best practices
- Error handling и validation
- State management (Zustand)
- Web3 wallet integrations (wagmi)
- TypeScript strict mode

**Твоя задача:**
1. **Проверить** все выполненные исправления на качество и полноту
2. **Найти** упущения и упрощения в коде
3. **Доработать** все компоненты до production-ready состояния
4. **Не упрощать** функционал в ущерб продукту
5. **Следовать** best practices во всех исправлениях

**ВАЖНО:**
- Читай все файлы перед изменениями (полностью, не только фрагменты)
- Не удаляй функционал, только улучшай
- Все изменения должны быть production-ready
- Используй реальные интеграции, не заглушки (если возможно)
- Проверяй каждое изменение на ошибки
- **КРИТИЧНО:** Проверь и исправь placeholder для `bridgeContractAddress` в CCPurchaseWidget
- Проверь все event listeners и cleanup функции на утечки памяти
- Убедись, что все модальные окна правильно закрываются и очищают состояние

**ПОРЯДОК РАБОТЫ:**
1. **Сначала прочитай все измененные файлы полностью:**
   - `src/components/defi/CCPurchaseWidget.tsx`
   - `src/components/defi/MultiPartyDashboard.tsx`
   - `src/lib/canton/hooks/useMultiPartyWorkflowService.ts`
   - `src/lib/canton/services/multiPartyWorkflowService.ts` (если нужно понять интерфейс)
   - `src/lib/canton/services/CantonServiceManager.ts` (если нужно понять как работает service manager)

2. **Проверь все выполненные исправления** по чеклистам выше

3. **Найди и исправь все упущения и упрощения:**
   - Placeholder адреса
   - Неполная обработка ошибок
   - Отсутствие валидации
   - Упрощенные реализации

4. **Доработай все компоненты** из раздела "ЧАСТИЧНО ВЫПОЛНЕНО"

**НАЧНИ С ПРОВЕРКИ ВСЕХ ВЫПОЛНЕННЫХ ИСПРАВЛЕНИЙ, ЗАТЕМ МЕТОДИЧНО ДОРАБОТАЙ ВСЁ ЧТО УПУЩЕНО ИЛИ УПРОЩЕНО.**
