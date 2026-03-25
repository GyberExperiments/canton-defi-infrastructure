# Canton Network ↔ BSC Bridge — Самодостаточный мастер-промпт (2025)

**Версия:** 2.1  
**Дата:** 2026-02-09  
**Стандарт:** Prompt Engineering Best Practices 2025 — самодостаточность, строгость, воспроизводимость.

---

## Как использовать этот промпт

- **Исполнитель (человек или LLM):** перед началом работы прочитать Часть 0 целиком; затем выполнять части 1–13 по порядку; каждую часть считать завершённой только при выполнении DoD (Definition of Done) в конце секции. Части 14–15 — критерии готовности к продакшену и сводка изменений.
- **Самодостаточность:** все критические решения (типы, SQL, контракты, API, конфиг, метрики) заданы в теле документа. Не заменять их отсылками к внешним файлам без явного указания в тексте.
- **Строгость:** MUST — обязательны; SHOULD — желательны; при отклонении — зафиксировать причину (например в комментарии или в runbook).
- **Воспроизводимость:** по этому документу другой разработчик или модель должна суметь воспроизвести мост без доступа к другим спецификациям (кроме контекста репо и DevNet из упомянутых в конце документов).

---

# ЧАСТЬ 0: РОЛЬ И ОГРАНИЧЕНИЯ (ОБЯЗАТЕЛЬНО К ВЫПОЛНЕНИЮ)

## 0.1 Роль исполнителя

Ты — senior backend/SDK-разработчик, реализующий production-ready мост Canton Network ↔ BNB Smart Chain (BSC) в репозитории **cantonnet-omnichain-sdk**. Все решения должны соответствовать best practices: идемпотентность, аудит, безопасность контрактов, observability, строгая конечная автоматная модель переводов.

## 0.2 Обязательные правила (MUST)

- **Суммы:** никогда не использовать `f32`/`f64` для денежных величин. Только строки или `u128`/`NUMERIC(78,0)` в базе.
- **Идемпотентность:** каждый вызов к Canton — с уникальным `command_id`; каждый unlock на BSC — с проверкой `processedTransfers[transferId]`; в БД — уникальность по `canton_command_id` и `bsc_tx_hash`.
- **Секреты:** не хардкодить. Только env (например `BRIDGE_BSC_PRIVATE_KEY`, `CANTON_JWT_SECRET`) или внешний store (Vault).
- **Переходы статусов:** менять статус перевода только через проверку `TransferStatus::can_transition_to`; при недопустимом переходе — логировать и возвращать ошибку.
- **Логирование:** структурированное (JSON), с полями `trace_id`, `transfer_id`, `status`, `level`, `message`; один `trace_id` на весь жизненный цикл перевода.

## 0.3 Желательные правила (SHOULD)

- Использовать Ledger API **только v2** (`com.daml.ledger.api.v2`).
- В production — mTLS к Canton participant и WSS/HTTPS к BSC.
- Все внешние вызовы (Canton gRPC, BSC RPC) оборачивать в circuit breaker и retry с exponential backoff.

## 0.4 Критерий готовности секции (Definition of Done)

Для каждой секции ниже: реализация считается завершённой, когда (1) код/конфиг/схема соответствуют спецификации в этом документе, (2) нет отсылок вида «см. другой документ» для критичных деталей реализации, (3) тесты/ручные проверки по чеклисту секции пройдены.

---

# ЧАСТЬ 1: РЕПОЗИТОРИЙ И WORKSPACE

## 1.1 Текущее состояние репо

Репозиторий: **cantonnet-omnichain-sdk**. Корень проекта — каталог с `Cargo.toml` workspace.

**Существующие крейты (не удалять):**

| Крейт | Путь | Назначение |
|-------|------|------------|
| bridge-core | crates/bridge-core | Доменные типы, ошибки, конфиг, traits, state machine, fees, rate_limit, crypto, audit |
| canton-core | crates/canton-core | Типы, конфиг, ошибки (SdkError), traits |
| canton-ledger-api | crates/canton-ledger-api | gRPC-клиент Ledger API v2, proto в proto/com/daml/ledger/api/v2/ |
| canton-crypto | crates/canton-crypto | Ключи, keystore |
| canton-wallet | crates/canton-wallet | Wallet, derivation, party_id |
| canton-observability | crates/canton-observability | Логирование, метрики, трейсинг |
| canton-reliability | crates/canton-reliability | Retry, circuit breaker |
| canton-transport | crates/canton-transport | Транспорт (gRPC channel) |

**Крейты, которые нужно добавить (создать):**

| Крейт | Путь | Назначение |
|-------|------|------------|
| bsc-client | crates/bsc-client | Ethers Provider, контракты (abigen), события, gas, nonce, tx lifecycle |
| bridge-orchestrator | crates/bridge-orchestrator | Главный сервис: потоки Canton↔BSC, recovery, health, metrics |
| bridge-db | crates/bridge-db | PostgreSQL, SQLx, миграции, репозиторий, audit log |
| bridge-api | crates/bridge-api | REST API v1, handlers, middleware (auth, request_id, logging) |

Опционально: **canton-client** (crates/canton-client) — обёртка над canton-ledger-api с JWT и command builders для моста; если не создаётся, логику разместить в bridge-orchestrator.

## 1.2 Workspace Cargo.toml (целевой фрагмент)

В корневом `Cargo.toml` в `[workspace]` members должны быть перечислены все крейты (существующие + новые после их создания):

```toml
[workspace]
resolver = "2"
members = [
    "crates/bridge-core",
    "crates/canton-core",
    "crates/canton-ledger-api",
    "crates/canton-crypto",
    "crates/canton-wallet",
    "crates/canton-observability",
    "crates/canton-reliability",
    "crates/canton-transport",
    "crates/bsc-client",
    "crates/bridge-orchestrator",
    "crates/bridge-db",
    "crates/bridge-api",
]
```

Workspace dependencies для общих зависимостей (tokio, serde, tracing, tonic, ethers, sqlx, axum, и т.д.) — по необходимости; внутренние крейты подключать через `path = "crates/..."`.

## 1.3 Целевая структура каталогов (полная)

```
cantonnet-omnichain-sdk/
├── Cargo.toml
├── config/
│   ├── example.yaml
│   ├── example-production.yaml
│   └── bridge.yaml
├── crates/
│   ├── bridge-core/src/{lib,types,errors,config,traits,state_machine,fees,rate_limit,crypto,audit}.rs
│   ├── canton-core/...
│   ├── canton-ledger-api/...
│   ├── bsc-client/src/{lib,provider,contracts,bridge_contract,token_contract,event_listener,gas_oracle,tx_manager,nonce_manager}.rs
│   ├── bridge-orchestrator/src/{main,orchestrator,canton_to_bsc,bsc_to_canton,recovery,health,metrics}.rs
│   ├── bridge-db/src/{lib,models,repository}.rs + migrations/
│   └── bridge-api/src/{lib,routes,handlers,middleware}.rs
├── contracts/
│   ├── daml/daml.yaml, daml/Bridge/{Types,Asset,Lock,Transfer}.daml
│   └── solidity/{hardhat.config.ts, contracts/, test/, scripts/}
├── docker/{Dockerfile.bridge, docker-compose.yml, docker-compose.infra.yml}
├── scripts/{generate-proto.sh, run-tests.sh}
├── monitoring/{prometheus.yml, grafana/dashboards/, alerting/rules.yml}
└── docs/{architecture.md, deployment.md, security.md, runbook.md}
```

**DoD секции 1:** В репо есть перечисленные крейты и каталоги; `cargo build --workspace` успешен (или сборка только существующих крейтов до добавления новых).

---

# ЧАСТЬ 2: ДОМЕННАЯ МОДЕЛЬ (bridge-core)

## 2.1 Перечень типов (обязательные)

Все типы должны находиться в `crates/bridge-core/src/` в модулях согласно таблице.

| Тип | Модуль | Описание |
|-----|--------|----------|
| TransferId | types | Newtype над UUID (предпочтительно UUIDv7). Display, FromStr, Serialize, Deserialize. |
| TransferDirection | types | Enum: CantonToBsc, BscToCanton. sqlx::Type для transfer_direction. |
| TransferStatus | types | Enum всех состояний ФСМ (см. матрицу переходов ниже). sqlx::Type для transfer_status. |
| CantonParty, CantonContractId, CantonOffset, CantonCommandId, CantonWorkflowId, CantonTemplateId | types | Строковые newtype с валидацией при необходимости. |
| BscAddress, BscTxHash, BscBlock | types | BscAddress: 0x + 40 hex; BscTxHash: 0x + 64 hex; валидация в методе validate(). |
| Amount | types | Поля: raw: String (base units), decimals: u8. Методы: from_base_units, from_human, to_u128, to_human, is_zero. Никаких float. |
| AmountParseError | types | thiserror enum: InvalidFormat, Overflow, TooManyDecimals. |
| AssetId | types | id, canton_template_id, bsc_token_address (BscAddress), symbol, name, decimals, min_transfer, max_transfer, daily_limit (Amount), enabled. |
| BridgeFee | types | fixed_fee, proportional_bps, estimated_gas_bnb, total_fee, net_amount (все Amount где применимо). |
| BridgeTransfer | types | Полная структура (см. ниже). Конструкторы new_canton_to_bsc, new_bsc_to_canton. |
| BridgeError | errors | thiserror enum: Config, Canton, Bsc, Db, InvalidTransition, Validation, Other. |
| BridgeConfig, CantonConfig, BscConfig, DbConfig, LimitsConfig | config | Serde (De)serialize для YAML/env. |
| CantonClient, BscClient | traits | async_trait с методами по контракту ниже. |
| TransferStateMachine, apply_transition | state_machine | Проверка can_transition_to; применение перехода только при успехе. |
| TransferEventLog | audit | transfer_id, at, old_status, new_status, actor, reason. |
| TransferErrorLog | types или audit | timestamp, stage (TransferStatus), error_code, message, recoverable: bool — для истории ошибок при retry; опционально поле error_history в BridgeTransfer. |
| RateLimitConfig, RateLimitState | rate_limit | Конфиг лимитов; состояние (in_flight, daily_volume_used, window_start). |
| compute_fee | fees | (amount, fixed_raw, proportional_bps) -> BridgeFee. |
| sha256_hex, is_valid_address_hex, is_valid_tx_hash_hex | crypto | Утилиты без зависимости от ethers. |

## 2.2 Матрица допустимых переходов TransferStatus

Переход разрешён только если пара (from, to) есть в таблице. Реализация — в `TransferStatus::can_transition_to(&self, next: &TransferStatus) -> bool`.

| from \ to | Initiated | CantonLocking | CantonLocked | BscMinting | BscMinted | BscBurned | BscBurnFinalized | CantonUnlocking | CantonUnlocked | Completed | Failed | RollingBack | RolledBack | Stuck |
|-----------|---|---:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| Initiated | — | ✓ (C→B) | | | | ✓ (B→C) | | | | | ✓ | | | |
| CantonLocking | | — | ✓ | | | | | | | | ✓ | | | |
| CantonLocked | | | — | ✓ | | | | | | | ✓ | | | |
| BscMinting | | | | — | ✓ | | | | | | ✓ | | | |
| BscMinted | | | | | — | | | | ✓ | | ✓ | | | |
| BscBurned | | | | | | — | ✓ | | | | ✓ | | | |
| BscBurnFinalized | | | | | | | — | ✓ | | | ✓ | | | |
| CantonUnlocking | | | | | | | | — | ✓ | | ✓ | | | |
| CantonUnlocked | | | | | | | | | — | ✓ | ✓ | | | |
| Failed | | ✓ | | ✓ | | | | ✓ | | | — | ✓ | | ✓ |
| RollingBack | | | | | | | | | | | ✓ | — | ✓ | |
| Stuck | | | | | | | | | | | | ✓ | — | |

(C→B) = только для направления CantonToBsc; (B→C) = только для BscToCanton. Остальные переходы допустимы при совпадении direction.

## 2.3 Структура BridgeTransfer (каноническая)

```rust
pub struct BridgeTransfer {
    pub id: TransferId,
    pub direction: TransferDirection,
    pub status: TransferStatus,
    pub asset_id: String,
    pub amount: Amount,
    pub canton_party: CantonParty,
    pub canton_contract_id: Option<CantonContractId>,
    pub canton_tx_id: Option<String>,
    pub canton_command_id: Option<String>,
    pub bsc_address: BscAddress,
    pub bsc_tx_hash: Option<BscTxHash>,
    pub bsc_block_number: Option<u64>,
    pub bsc_confirmations: Option<u64>,
    pub retry_count: u32,
    pub max_retries: u32,
    pub error_message: Option<String>,
    pub nonce: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}
```

Допускается расширение полями `trace_id`, `next_retry_at`, `error_history: Vec<TransferErrorLog>` по необходимости; минимально — указанный набор.

## 2.4 Контракт traits (сигнатуры)

```rust
#[async_trait]
pub trait CantonClient: Send + Sync {
    async fn lock_for_bsc(&self, party: &CantonParty, amount: &str, asset_id: &str,
        bsc_recipient: &BscAddress, command_id: &str) -> Result<CantonContractId, BridgeError>;
    async fn unlock_from_bsc(&self, contract_id: &CantonContractId, command_id: &str,
        bsc_tx_hash: &BscTxHash) -> Result<(), BridgeError>;
    async fn stream_events(&self, from_offset: &str) -> Result<Vec<BridgeTransfer>, BridgeError>;
}

#[async_trait]
pub trait BscClient: Send + Sync {
    /// Логическая «выдача» получателю при Canton→BSC. Реализация: вызов BridgeVault.unlock(transferId, recipient, token, amount).
    async fn mint(&self, recipient: &BscAddress, token: &BscAddress, amount: &str,
        transfer_id: &str) -> Result<BscTxHash, BridgeError>;
    /// Запускает фоновую подписку на события Burn (BSC→Canton). События доставляются в канал или callback; метод возвращает Ok(()) после успешного старта подписки.
    async fn subscribe_burns(&self) -> Result<(), BridgeError>;
}
```

**DoD секции 2:** Все перечисленные типы и методы реализованы; unit-тесты на `can_transition_to` для всех пар из матрицы; проход `cargo test -p bridge-core`.

---

# ЧАСТЬ 3: ПЕРСИСТЕНТНОСТЬ (bridge-db)

## 3.1 Миграция 001_init.sql (полный текст)

Выполнять в порядке: расширение → enum'ы → таблицы → индексы. Имя файла: `crates/bridge-db/migrations/001_init.sql`.

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE transfer_direction AS ENUM ('canton_to_bsc', 'bsc_to_canton');

CREATE TYPE transfer_status AS ENUM (
  'initiated',
  'canton_locking', 'canton_locked',
  'bsc_minting', 'bsc_minted',
  'bsc_burned', 'bsc_burn_finalized',
  'canton_unlocking', 'canton_unlocked',
  'completed', 'failed', 'rolling_back', 'rolled_back', 'stuck'
);

CREATE TABLE transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trace_id TEXT NOT NULL,
  direction transfer_direction NOT NULL,
  status transfer_status NOT NULL,
  asset_id TEXT NOT NULL,
  amount_raw NUMERIC(78, 0) NOT NULL,
  decimals SMALLINT NOT NULL,
  canton_party TEXT NOT NULL,
  canton_contract_id TEXT,
  canton_command_id TEXT,
  canton_tx_id TEXT,
  bsc_address CHAR(42) NOT NULL,
  bsc_tx_hash CHAR(66),
  bsc_block_number BIGINT,
  bsc_confirmations BIGINT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 5,
  error_message TEXT,
  nonce TEXT NOT NULL,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Уникальность при не-NULL: один command_id / один bsc_tx_hash на запись (для идемпотентности)
CREATE UNIQUE INDEX idx_transfers_canton_command_id ON transfers (canton_command_id) WHERE canton_command_id IS NOT NULL;
CREATE UNIQUE INDEX idx_transfers_bsc_tx_hash ON transfers (bsc_tx_hash) WHERE bsc_tx_hash IS NOT NULL;

CREATE INDEX idx_transfers_status_next_retry
  ON transfers (status, next_retry_at)
  WHERE status NOT IN ('completed', 'failed', 'rolled_back', 'stuck');

CREATE INDEX idx_transfers_direction_created
  ON transfers (direction, created_at DESC);

CREATE INDEX idx_transfers_bsc_block
  ON transfers (bsc_block_number) WHERE bsc_block_number IS NOT NULL;
```

## 3.2 Миграция 002_audit_indexes.sql

```sql
CREATE TABLE transfer_audit_log (
  id BIGSERIAL PRIMARY KEY,
  transfer_id UUID NOT NULL REFERENCES transfers(id) ON DELETE RESTRICT,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  old_status transfer_status NOT NULL,
  new_status transfer_status NOT NULL,
  actor TEXT NOT NULL,
  reason TEXT
);

CREATE INDEX idx_audit_transfer_id ON transfer_audit_log (transfer_id, at DESC);

-- Checkpoint для потока Canton (продолжение после рестарта)
CREATE TABLE bridge_checkpoints (
  direction transfer_direction PRIMARY KEY,
  offset_value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Методы репозитория: `get_checkpoint_offset(direction)`, `set_checkpoint_offset(direction, offset)` — чтение/запись таблицы bridge_checkpoints.

## 3.3 Репозиторий (обязательные операции)

- `insert(transfer: &BridgeTransfer) -> Result<(), BridgeError>`
- `get_by_id(id: &TransferId) -> Result<Option<BridgeTransfer>, BridgeError>`
- `update_status(id: &TransferId, new_status: TransferStatus, error_message: Option<&str>) -> Result<(), BridgeError>` (и обновление updated_at, completed_at при терминальных статусах)
- `list_pending(limit: u32) -> Result<Vec<BridgeTransfer>, BridgeError>` — статусы в (canton_locking, canton_locked, bsc_minting, bsc_burned, bsc_burn_finalized, canton_unlocking), ORDER BY next_retry_at NULLS FIRST, updated_at ASC
- `append_audit(transfer_id: &TransferId, old_status: TransferStatus, new_status: TransferStatus, actor: &str, reason: Option<&str>) -> Result<(), BridgeError>`
- `get_checkpoint_offset(direction: TransferDirection) -> Result<Option<String>, BridgeError>` / `set_checkpoint_offset(direction: TransferDirection, offset: &str) -> Result<(), BridgeError>` — чтение/запись таблицы bridge_checkpoints (или аналога).

Модели в `models.rs`: маппинг строк БД ↔ BridgeTransfer (включая конвертацию amount_raw в Amount, enum'ы в TransferStatus/TransferDirection).

**DoD секции 3:** Миграции 001 и 002 применяются через `sqlx migrate run`; таблица bridge_checkpoints используется для offset; репозиторий покрыт тестами (можно с testcontainers или in-memory SQLite для изолированных unit-тестов).

---

# ЧАСТЬ 4: CANTON — LEDGER API V2 И АУТЕНТИФИКАЦИЯ

## 4.1 Протокол и сервисы

- Использовать **только** Ledger API v2. Proto-файлы в репо: `crates/canton-ledger-api/proto/com/daml/ledger/api/v2/`.
- Ключевые сервисы: CommandSubmissionService (отправка команд), CommandCompletionService (completion stream), TransactionService или аналог для потока транзакций (TransactionTree). Точные имена — по актуальным .proto в репо.

## 4.2 JWT и metadata

- Участник может требовать JWT в gRPC metadata: ключ `Authorization`, значение `Bearer <token>`.
- В payload JWT должны быть: `ledgerId`, `applicationId`, `exp`; для действий от имени партии — `actAs: [party]`; для админ-операций — `admin: true` (если поддерживается конфигом участника).
- Алгоритм: RS256 или HS256 по конфигу участника. Секрет/приватный ключ — из env (например `CANTON_JWT_SECRET` или `CANTON_JWT_PRIVATE_KEY`) или Vault.
- Обновление: перед истечением `exp` (например за 60 секунд) получать новый токен и подставлять в последующие запросы. Реализация в модуле auth (canton-client или bridge-orchestrator).

## 4.3 Идемпотентность команд Canton

- При каждой отправке команды указывать `command_id` и `deduplication_period` (например 24 часа).
- Формат command_id: `bridge-{transfer_id}-{step}`, где step — например `lock` или `unlock`. Один и тот же command_id при повторной отправке (retry) не должен создавать дубликат на ledger.

## 4.4 mTLS (production)

- В production рекомендуется mutual TLS между мостом и participant. В конфиге: пути к client certificate, client key, CA certificate. Подключение к каналу — через canton-transport или напрямую tonic с TLS.

## 4.5 Поток транзакций Canton → события моста

- **Сервис:** из Ledger API v2 использовать поток транзакций (например `GetUpdates` / `TransactionService` / аналог по .proto в репо). Подписка с фильтром по template ID шаблона LockedAsset (или аналога).
- **Маппинг:** при появлении в потоке события создания контракта (CreatedEvent) с нужным template_id извлечь: contract_id, party (user), amount, assetType, bscRecipient, lockId. Сформировать BridgeTransfer: direction = CantonToBsc, status = CantonLocked (или CantonLocked — в зависимости от того, считаем ли мы «инициацию» со стороны Canton уже lock’ом). Поля: canton_contract_id, canton_party, amount, asset_id, bsc_address (из bscRecipient), nonce/lockId. Сохранить в БД и записать checkpoint offset после успешной обработки.
- **Идемпотентность:** по (canton_contract_id или lockId) не создавать дубликат перевода; при повторной доставке того же события (reconnect) — игнорировать или обновить только при необходимости.

**DoD секции 4:** Клиент подключается к участнику по Ledger API v2; JWT передаётся в metadata и обновляется по таймеру; при повторной отправке с тем же command_id дубликат не создаётся; поток событий маппится в BridgeTransfer и пишется в БД с сохранением offset.

---

# ЧАСТЬ 5: DAML-КОНТРАКТЫ

## 5.1 Шаблон LockedAsset (канонический)

Файл: `contracts/daml/daml/Bridge/Lock.daml`.

```daml
module Bridge.Lock where

template LockedAsset
  with
    operator : Party
    user : Party
    amount : Decimal
    assetType : Text
    bscRecipient : Text
    lockId : Text
  where
    signatory user, operator
    key (operator, user, lockId) : (Party, Party, Text)
    maintainer key._1

    choice Unlock : ()
      with reason : Text
      controller operator
      do return ()

    choice CompleteTransfer : ()
      with bscTxHash : Text
      controller operator
      do return ()
```

- Contract key обеспечивает уникальность и поиск по (operator, user, lockId).
- Unlock — возврат/refund на Canton (controller operator).
- CompleteTransfer — завершение перевода после успешного mint на BSC (controller operator). **MUST:** при выполнении CompleteTransfer контракт архивируется (exercise Archive или выбор, который архивирует LockedAsset), чтобы один lock не завершался дважды.

## 5.2 Типы и модуль Transfer

- В `Types.daml` — общие типы (при необходимости).
- В `Transfer.daml` — при необходимости шаблон запроса перевода или интерфейс; для минимальной реализации достаточно Lock.daml выше.
- Версионирование .dar и стратегию обновления контрактов описать в docs/deployment.md.

**DoD секции 5:** `daml build` успешен; шаблон развёрнут на participant; тест Daml script создаёт LockedAsset и выполняет Unlock/CompleteTransfer.

---

# ЧАСТЬ 6: BSC-КОНТРАКТЫ (SOLIDITY)

## 6.1 Требования к BridgeVault

- Наследование: Pausable, AccessControl, ReentrancyGuard (OpenZeppelin).
- Роли: DEFAULT_ADMIN_ROLE, ADMIN_ROLE, OPERATOR_ROLE. OPERATOR_ROLE — только для вызова unlock (и при необходимости mint).
- События: Locked(transferId, user, token, amount, cantonParty), Unlocked(transferId, user, token, amount).
- Маппинг `processedTransfers[bytes32 transferId]` — для защиты от повторного unlock; перед unlock проверять `require(!processedTransfers[transferId])` и выставлять `processedTransfers[transferId] = true`.
- Перед переводом токенов: `require(IERC20(token).balanceOf(address(this)) >= amount)`.
- Все переводы токенов — через SafeERC20.
- Методы pause/unpause — только ADMIN_ROLE.

## 6.2 Сигнатуры методов (минимальный контракт)

```solidity
function lock(address _token, uint256 _amount, string calldata _cantonParty)
    external whenNotPaused nonReentrant;

function unlock(bytes32 _transferId, address _user, address _token, uint256 _amount)
    external onlyRole(OPERATOR_ROLE) whenNotPaused nonReentrant;
```

## 6.3 Семантика BSC для Canton→BSC

- На BSC стороне «выдача» пользователю при переводе Canton→BSC реализуется вызовом **BridgeVault.unlock(transferId, user, token, amount)**. В trait BscClient метод `mint` означает логическую операцию «выдать получателю»; реализация — вызов этого unlock на BridgeVault. Имя метода в коде можно оставить mint или переименовать в release_for_canton_to_bsc по желанию; контракт — один и тот же unlock.

## 6.4 Дополнительно

- BridgeRegistry: allowlist токенов (адрес → разрешён); при необходимости лимиты на уровне контракта (daily limit по токену).
- ChainId: при необходимости проверять в контракте или в подписях (EIP-712) для защиты от replay.

**DoD секции 6:** Контракт компилируется (Hardhat); unit-тесты на lock, unlock, pause, dedup (повторный unlock с тем же transferId ревертится).

---

# ЧАСТЬ 7: ФИНАЛЬНОСТЬ И ВОССТАНОВЛЕНИЕ

## 7.1 Canton

- Финальность: транзакция считается финальной после подтверждения участником/доменом. После рестарта оркестратора продолжать чтение потока с последнего сохранённого offset (checkpoint в БД); один offset не обрабатывать дважды.

## 7.2 BSC

- Целевое число подтверждений: настраиваемый параметр (например 12 или 15 блоков). Поле в конфиге: `required_confirmations`.
- Не переводить статус в BscMinted / не считать BSC→Canton финальным для разблокировки на Canton, пока `bsc_confirmations >= required_confirmations`. При обнаружении reorg — не считать блок стабильным (при необходимости проверять хэш блока при следующей высоте).

## 7.3 Orphaned / Stuck

- При старте оркестратора: выбирать записи со статусами canton_locking, bsc_minting, canton_unlocking и `updated_at` старше N минут (параметр конфига `orphan_in_flight_minutes`, по умолчанию 15) — считать «подвисшими». Действие: перевести в failed или сбросить в предыдущий «повторяемый» статус и увеличить retry; в зависимости от политики — выставлять next_retry_at.
- После исчерпания max_retries переводить в stuck; алертить (Prometheus, алерт-правила). Ручное разрешение — через API (retry / cancel / force-complete).

## 7.4 Ручные операции API

- `POST /api/v1/transfers/:id/retry` — сброс retry_count и повторная постановка в очередь (только для failed/stuck). Требуется роль admin.
- `POST /api/v1/transfers/:id/cancel` — перевод в failed и запуск rollback (refund на Canton). Требуется роль admin.
- `POST /api/v1/transfers/:id/force-complete` — принудительно пометить перевод completed (только если оператор вручную завершил операцию на цепях). Требуется роль admin.

## 7.5 Retry и backoff

- При повторной попытке (retry) использовать exponential backoff. Формула: `delay = min(base_delay_sec * 2^retry_count, max_delay_sec)`. Параметры в конфиге: `retry_base_delay_sec` (например 5), `retry_max_delay_sec` (например 300). Поле `next_retry_at` в БД = updated_at + delay.
- Транзиентные ошибки (сетевой таймаут, временная недоступность Canton/BSC, nonce too low) — повторять; перманентные (invalid party, insufficient balance) — переводить в Failed без исчерпания всех retry.

## 7.6 Graceful shutdown (SIGTERM)

1. Остановить приём новых переводов (не брать новые из Canton stream и BSC subscription).
2. Дождаться завершения текущих обработок (in-flight): те, что в статусах canton_locking, bsc_minting, canton_unlocking — либо дождаться ответа от Canton/BSC, либо таймаут (например 30 сек).
3. Сохранить текущий offset потока Canton в bridge_checkpoints.
4. Закрыть gRPC и WS соединения, пул БД.
5. Выход с кодом 0.

**DoD секции 7:** После рестарта оркестратор продолжает с checkpoint; BSC-финальность учитывает required_confirmations; ручные эндпоинты защищены и задокументированы; retry с backoff по конфигу; при SIGTERM выполняется graceful shutdown.

---

# ЧАСТЬ 8: FEE, ЛИМИТЫ, УГРОЗЫ

## 8.1 Fee

- BSC gas платит мост (оператор). Кошелёк пополняется по процедуре из runbook.
- Bridge fee (опционально): fixed + proportional_bps; расчёт в bridge-core (compute_fee); в API возвращать net_amount и total_fee.

## 8.2 Лимиты (конфиг)

- max_concurrent_transfers: usize
- max_retries: u32 (по умолчанию 5)
- required_confirmations: u64 (BSC)
- per_asset_daily_limit, per_party_daily_limit (опционально) — в конфиге или в БД (asset_registry). Проверка в оркестраторе перед созданием перевода.

## 8.3 Threat model (документировать в docs/security.md)

- Rogue operator: multi-sig/timelock; мониторинг крупных выводов.
- Скомпрометированный participant: изоляция ключей, mTLS, ротация JWT.
- Утечка BSC ключа: один кошелёк, лимиты, алерты; процедура ротации в runbook.
- Griefing (лок на Canton без завершения на BSC): таймаут и автоматический Unlock/refund; лимит «висящих» переводов на партию.

**DoD секции 8:** Конфиг содержит перечисленные поля; security.md заполнен; лимиты проверяются в коде.

---

# ЧАСТЬ 9: API (bridge-api)

## 9.1 Базовый путь и версионирование

- Префикс всех маршрутов моста: `/api/v1`.

## 9.2 Обязательные маршруты

| Метод | Путь | Описание | Тело запроса | Ответ |
|-------|------|----------|--------------|--------|
| GET | /api/v1/health | Health check (Canton, BSC, DB) | — | 200 JSON: { "canton": "ok"\|"degraded"\|"down", "bsc": "...", "db": "..." }; 503 если любой критичный down |
| GET | /api/v1/transfers | Список переводов | — | 200 JSON: { "items": [...], "next_cursor": optional } |
| GET | /api/v1/transfers?limit=20&cursor=:cursor | Пагинация | — | то же |
| GET | /api/v1/transfers/:id | Один перевод по id | — | 200 BridgeTransfer JSON или 404 |
| POST | /api/v1/transfers/:id/retry | Принудительный retry | {} или { "reason": "..." } | 200 или 4xx |
| POST | /api/v1/transfers/:id/cancel | Отмена и rollback | {} или { "reason": "..." } | 200 или 4xx |
| POST | /api/v1/transfers/:id/force-complete | Принудительное completed | {} или { "reason": "..." } | 200 или 4xx |
| GET | /metrics | Prometheus метрики | — | 200 text/plain |

Опционально (SHOULD): **WebSocket** `GET /api/v1/transfers/stream?transfer_id=:id` или без параметра (все обновления) — для real-time уведомлений об изменении статуса перевода(ов). Формат сообщений: JSON с полями transfer_id, status, updated_at.

## 9.3 Middleware

- request_id: присвоить каждому запросу X-Request-Id (или из заголовка), прокидывать в логи и при необходимости в trace.
- logging: структурированный лог (JSON) для каждого запроса (method, path, status, duration, request_id).
- auth для POST /api/v1/transfers/:id/*: проверка роли admin (API key в заголовке `X-API-Key` или `Authorization: Bearer <token>` — по конфигу).
- OpenAPI: MUST предоставить спецификацию OpenAPI 3.0 по адресу `GET /api/v1/openapi.json` или в статическом файле `docs/openapi.yaml`; описать все маршруты и схемы ответов.

## 9.4 Примеры ответов API

**GET /api/v1/health** (200):
```json
{
  "canton": "ok",
  "bsc": "ok",
  "db": "ok"
}
```
При деградации: `"canton": "degraded"` или `"bsc": "down"`. 503 — если любой из критичных компонентов down.

**GET /api/v1/transfers?limit=20&cursor=** (200):
```json
{
  "items": [
    {
      "id": "uuid",
      "direction": "canton_to_bsc",
      "status": "canton_locked",
      "asset_id": "...",
      "amount": { "raw": "1000000000000000000", "decimals": 18 },
      "canton_party": "...",
      "bsc_address": "0x...",
      "created_at": "ISO8601",
      "updated_at": "ISO8601"
    }
  ],
  "next_cursor": "optional-uuid-or-timestamp"
}
```

**GET /api/v1/transfers/:id** (200): один объект перевода в том же формате, что элемент items выше; (404) при отсутствии.

**DoD секции 9:** Все маршруты реализованы; пагинация по cursor; health отражает состояние Canton/BSC/DB; метрики доступны на /metrics; OpenAPI 3.0 доступна по /api/v1/openapi.json или в docs.

---

# ЧАСТЬ 10: НАБЛЮДАЕМОСТЬ

## 10.1 Метрики Prometheus (обязательные)

- `bridge_active_transfers_total{direction="canton_to_bsc"|"bsc_to_canton"}` — gauge, число переводов в нефинальных статусах.
- `bridge_completed_transfers_total` — counter.
- `bridge_failed_transfers_total` — counter.
- `bridge_stuck_transfers_total` — gauge.
- `bridge_retry_total{stage="..."}` — counter.
- `bridge_rpc_latency_seconds{target="canton"|"bsc"}` — histogram.
- `bridge_operations_total{operation="lock"|"unlock"|"mint", status="success"|"error"}` — counter.

## 10.2 Логирование

- Формат: JSON. Поля как минимум: timestamp, level, message, trace_id, transfer_id (если есть), status, error (при ошибке). Не логировать секреты и полные ключи.

## 10.3 Трейсинг

- Один trace_id на перевод (от первого события до завершения). Прокидывать trace_id в вызовы Canton/BSC и в БД (поле trace_id в transfers). При наличии OTLP — экспорт спанов.

## 10.4 Алерты (пример правил)

- Срабатывание: stuck_transfers > 0 в течение 5 минут.
- Срабатывание: rate(bridge_failed_transfers_total[5m]) > порог.
- Срабатывание: health endpoint возвращает 503.

**DoD секции 10:** Метрики экспортируются; логи в JSON; дашборд Grafana (опционально) и alerting rules описаны/созданы.

---

# ЧАСТЬ 11: ТЕСТЫ И ДЕПЛОЙ

## 11.1 Тесты

- bridge-core: unit-тесты на can_transition_to (все пары из матрицы); proptest для генерации допустимых последовательностей (опционально).
- bridge-db: интеграционные тесты с PostgreSQL (testcontainers или dev DB); вставка, обновление статуса, audit log.
- Canton: интеграция с Canton Sandbox (Docker) для потока событий и отправки команд — скрипт в scripts/.
- BSC: Hardhat тесты контрактов; при необходимости fork BSC testnet.
- E2E: минимум один сценарий Canton→BSC и один BSC→Canton на тестовых сетях с таймаутами и retry.
- Опционально: chaos — отключение Canton participant или BSC RPC на время перевода, проверка recovery и перехода в Failed/retry; property-based (proptest) для допустимых последовательностей TransferStatus.

## 11.2 Деплой

- Docker: Dockerfile.bridge (multi-stage Rust build); docker-compose.yml для dev (postgres, redis при необходимости, оркестратор, api).
- Миграции: только вперёд (sqlx migrate); откат — отдельный скрипт при необходимости.
- Runbook: backup/restore БД, key rotation (BSC, Canton JWT), шаги при падении participant/BSC RPC, при переполнении очереди.

**DoD секции 11:** CI запускает unit и интеграционные тесты; E2E сценарии задокументированы и выполняются перед релизом; runbook заполнен.

---

# ЧАСТЬ 12: КОНФИГУРАЦИЯ

## 12.1 Пример bridge.yaml (полный)

```yaml
canton:
  grpc_url: "http://127.0.0.1:30501"
  ledger_id: "participant"
  application_id: "bridge-service"
  operator_party: "bridge-operator::..."
  tls: false

bsc:
  rpc_url: "https://bsc-dataseed.binance.org/"
  ws_url: "wss://bsc-ws-node.nariox.org:443"
  bridge_contract_address: "0x..."
  required_confirmations: 12
  chain_id: 56

db:
  url: "postgres://user:pass@localhost:5432/bridge"
  max_connections: 10

limits:
  max_concurrent_transfers: 50
  max_retries: 5
  daily_volume_limit: null  # или строка в base units

recovery:
  retry_base_delay_sec: 5
  retry_max_delay_sec: 300
  orphan_in_flight_minutes: 15  # записи в in-flight старше N минут считать подвисшими

api:
  listen: "0.0.0.0:8080"
  admin_api_key_env: "BRIDGE_ADMIN_API_KEY"
```

Секреты (пароль БД, приватный ключ BSC, JWT secret) — из переменных окружения или Vault; в YAML только имена переменных или пути.

## 12.2 Переменные окружения (обязательные и опциональные)

Файл `.env.example` в корне проекта MUST содержать следующий шаблон (значения пустые или placeholder):

```bash
# Database (обязательно для bridge-db, bridge-orchestrator)
DATABASE_URL=postgres://user:password@localhost:5432/bridge

# BSC (обязательно для bsc-client, bridge-orchestrator)
BRIDGE_BSC_PRIVATE_KEY=0x...
# Опционально: BSC_RPC_URL, BSC_WS_URL — переопределяют config

# Canton (обязательно при включённой аутентификации)
CANTON_JWT_SECRET=...
# или CANTON_JWT_PRIVATE_KEY= для RS256
# Опционально: CANTON_GRPC_URL — переопределяет config

# API (для admin-эндпоинтов)
BRIDGE_ADMIN_API_KEY=...

# Retry/backoff (опционально, иначе из bridge.yaml)
# RETRY_BASE_DELAY_SEC=5
# RETRY_MAX_DELAY_SEC=300

# Observability (опционально)
# RUST_LOG=info
# OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
```

Приложение при старте MUST читать секреты из env (или Vault по конфигу); отсутствие обязательных переменных — ошибка старта с понятным сообщением.

## 12.3 DevNet (пример для разработки)

Для подключения к DevNet participant (docs DEFI_CONNECT_DEVNET):

- gRPC: `http://65.108.15.30:30501`
- HTTP Ledger API (JSON): `http://65.108.15.30:30757`

В `config/example.yaml` или `config/bridge.yaml` для dev указать:

```yaml
canton:
  grpc_url: "http://65.108.15.30:30501"
  ledger_id: "participant"
  application_id: "bridge-service"
  operator_party: "..."   # выданная партия оператора
  tls: false
```

## 12.4 Circuit breaker и таймауты

В конфиге (или env) задать параметры для внешних вызовов:

- `canton_grpc_timeout_sec`: таймаут gRPC вызовов к Canton (например 30).
- `bsc_rpc_timeout_sec`: таймаут JSON-RPC к BSC (например 15).
- `circuit_breaker_failure_threshold`: число ошибок подряд до перехода в open (например 5).
- `circuit_breaker_half_open_after_sec`: через сколько секунд пробовать снова (например 60).

**DoD секции 12:** Приложение стартует с config из файла + env; все обязательные поля валидируются при старте; .env.example присутствует и задокументирован; пример DevNet и circuit breaker параметры описаны.

---

# ЧАСТЬ 13: ПОРЯДОК РЕАЛИЗАЦИИ И ПОТОК ДАННЫХ

## 13.1 Поток данных оркестратора (обязательная логика)

Оркестратор реализует следующий цикл. Порядок шагов — рекомендация; допускается параллельное выполнение потоков (Canton stream, BSC subscription, worker по pending).

1. **Старт:** Загрузить конфиг, подключиться к БД, Canton, BSC. Восстановить checkpoint offset для каждого direction из bridge_checkpoints. Запустить recovery: выбрать записи в in-flight статусах с updated_at старше `orphan_in_flight_minutes` → перевести в failed или сбросить retry и next_retry_at (по политике).
2. **Поток Canton:** Подписаться на поток транзакций с offset из checkpoint. Для каждого CreatedEvent по шаблону LockedAsset: распарсить в BridgeTransfer (direction = **CantonToBsc**, status = **CantonLocked** — лок уже произошёл на Canton), проверить дубликат по canton_contract_id/lockId, insert в transfers, append_audit, обновить checkpoint.
3. **Поток BSC:** Запустить подписку на события Locked контракта BridgeVault (пользователь залочил токены на BSC для получения на Canton). При новом событии: сформировать BridgeTransfer (direction = **BscToCanton**, status = Initiated), проверить дубликат по bsc_tx_hash или (tx_hash, log_index), insert в transfers, append_audit. Метод `subscribe_burns` возвращает Ok(()) после успешного старта подписки; события доставляются в канал или callback, откуда оркестратор читает и пишет в БД.
4. **Worker pending:** В цикле (или по таймеру) вызывать list_pending(limit). Для каждой записи в зависимости от (direction, status): если CantonToBsc и CantonLocked — вызвать BscClient.mint (реализация: BridgeVault.unlock), при успехе обновить bsc_tx_hash, status = BscMinting; если BscMinting — проверить подтверждения, при достаточных — status = BscMinted → Completed; если BscToCanton и BscBurnFinalized — вызвать CantonClient.unlock_from_bsc, при успехе status = CantonUnlocked → Completed. При ошибке: увеличить retry_count, записать error_message, next_retry_at; при retry_count >= max_retries перевести в Failed, затем при необходимости в Stuck. Перед каждым изменением статуса проверять can_transition_to и вызывать append_audit.
5. **Finality worker (опционально):** Отдельная задача проверяет записи в BscMinting/BscBurned: обновляет bsc_confirmations по текущему блоку; при bsc_confirmations >= required_confirmations переводит в BscMinted или BscBurnFinalized соответственно.
6. **Shutdown:** По SIGTERM выполнить graceful shutdown (см. 7.6).

## 13.2 Строгий чеклист реализации

Выполнять строго по шагам. Каждый шаг считается выполненным только при выполнении DoD соответствующей секции.

1. **bridge-core** — все модули и типы по Части 2; тесты на state machine.
2. **bridge-db** — миграции 001, 002; модели; репозиторий и audit; тесты.
3. **Canton-клиент** — Ledger API v2, auth (JWT), command_id/dedup, поток транзакций → события в виде BridgeTransfer (в canton-client или в orchestrator).
4. **bsc-client** — Provider (HTTP/WS), abigen контракты, event listener (burn), gas oracle, nonce manager, tx manager (send, confirm, retry).
5. **bridge-orchestrator** — main (graceful shutdown по SIGTERM), цикл: чтение Canton/BSC → запись в DB; обработка pending → вызов Canton/BSC → обновление статуса; recovery при старте; health и metrics.
6. **bridge-api** — маршруты по Части 9, middleware, подключение к репозиторию и (при необходимости) к оркестратору.
7. **Daml** — Lock.daml и сборка; деплой на Sandbox/participant.
8. **Solidity** — BridgeVault (и при необходимости Registry); Hardhat тесты; деплой на testnet.
9. **Docker и runbook** — Dockerfile.bridge, docker-compose, docs/runbook.md с шагами по backup, key rotation, инцидентам.
10. **Документация** — architecture.md, deployment.md, security.md; обновить DEFI_CONNECT_DEVNET при смене эндпоинтов.

## 13.3 Makefile (рекомендуемые цели)

В корне проекта или в scripts обеспечить цели (напрямую или через `cargo`/`docker`):

- `build` — `cargo build --release -p bridge-orchestrator -p bridge-api`
- `test` — `cargo test --workspace`
- `migrate` — применение миграций (например `cargo run -p bridge-db -- migrate` или `sqlx migrate run`)
- `run-orchestrator` — запуск оркестратора (с конфигом из env/config)
- `run-api` — запуск bridge-api
- `docker-build` — сборка Docker-образов (Dockerfile.bridge)
- `lint` — `cargo clippy --workspace`

## 13.4 Asset Registry (реестр активов)

Маппинг canton_template_id ↔ bsc_token_address и лимиты по активу хранить либо в конфиге (список assets в bridge.yaml), либо в БД. Вариант миграции для БД:

```sql
-- 003_asset_registry.sql (опционально)
CREATE TABLE asset_registry (
  id TEXT PRIMARY KEY,
  canton_template_id TEXT NOT NULL,
  bsc_token_address CHAR(42) NOT NULL,
  symbol TEXT NOT NULL,
  decimals SMALLINT NOT NULL,
  min_transfer_raw NUMERIC(78,0) NOT NULL DEFAULT 0,
  max_transfer_raw NUMERIC(78,0),
  daily_limit_raw NUMERIC(78,0),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Оркестратор при создании перевода MUST проверять, что asset_id есть в реестре и enabled; при лимитах — проверять min/max/daily. Если реестр в конфиге — структура `assets: [{ id, canton_template_id, bsc_token_address, symbol, decimals, min_transfer, max_transfer, daily_limit, enabled }]`.

---

# ЧАСТЬ 14: КРИТЕРИИ ГОТОВНОСТИ К ПРОДАКШЕНУ

- Все миграции применены; в БД нет «подвисших» переводов без алерта (stuck мониторится).
- GET /api/v1/health возвращает 200 при доступности Canton, BSC и DB.
- Метрики из Части 10 экспортируются; алерт-правила настроены; runbook заполнен.
- Выполнен минимум один E2E сценарий Canton→BSC и один BSC→Canton на тестовой среде.
- Секреты не хранятся в коде; конфиг production использует env или Vault.

---

---

# ЧАСТЬ 15: ИТОГ ПРОДОЛЖЕНИЙ И ИСПРАВЛЕНИЙ

В этой версии промпта добавлено и уточнено:

- **Персистентность:** partial unique indexes по canton_command_id и bsc_tx_hash (идемпотентность при NULL); таблица bridge_checkpoints в 002; ON DELETE RESTRICT для audit_log.
- **Домен:** тип TransferErrorLog для истории ошибок при retry.
- **Canton:** маппинг потока транзакций (CreatedEvent → BridgeTransfer), сохранение offset, идемпотентность по contract_id/lockId.
- **Daml:** явное требование архивировать контракт при CompleteTransfer.
- **BSC:** семантика mint = BridgeVault.unlock для Canton→BSC; уточнение subscribe_burns (фоновая подписка, события в канал/callback).
- **Восстановление:** формула retry backoff (base * 2^retry_count, cap); graceful shutdown (SIGTERM) по шагам; различение транзиентных и перманентных ошибок.
- **API:** примеры JSON для health, GET /transfers, GET /transfers/:id; требование OpenAPI 3.0; опциональный WebSocket для real-time статусов.
- **Конфиг:** полный список переменных окружения (.env.example); пример DevNet (65.108.15.30:30501, 30757); параметры circuit breaker и таймаутов.
- **Оркестратор:** пошаговый поток данных (старт, поток Canton, поток BSC, worker pending, finality worker, shutdown).
- **Реализация:** Makefile-цели; Asset Registry (таблица 003 или конфиг); chaos/proptest в тестах.
- **Исправления v2.1:** Синтаксис SQL (запятая перед `);` в 001); направление потока Canton (CreatedEvent LockedAsset = CantonToBsc, CantonLocked); поток BSC (события Locked на BridgeVault = BscToCanton); секция recovery в bridge.yaml (retry_base_delay_sec, retry_max_delay_sec, orphan_in_flight_minutes); DoD секции 9 (OpenAPI).

**Конец документа.** Этот файл самодостаточен для реализации и развёртывания моста: все критические решения, схемы, контракты и API заданы явно. Дополнительные ссылки (CANTON_BSC_BRIDGE_MASTER_SPEC, FINAL_IMPLEMENTATION_PLAN, CANTON_DEFI_ARCHITECTURE_BEST_PRACTICES, DEFI_CONNECT_DEVNET) используются только для контекста окружения и DevNet, но не подменяют спецификации выше.
