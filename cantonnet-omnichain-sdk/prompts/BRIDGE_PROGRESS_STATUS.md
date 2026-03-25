# Canton↔BSC Bridge — Текущий прогресс (WIP)

**Дата:** 2026-02-09  
**Репозиторий:** `cantonnet-omnichain-sdk`  
**Назначение файла:** зафиксировать реальное текущее состояние проекта, чтобы можно было **продолжить работу по мастер‑промпту v3**, не потеряв детали.

---

## 0. Где лежат спецификация и прогресс

- **Главный мастер‑промпт v3:**  
  `prompts/BSC_CANTON_BRIDGE_READE_PROMT_V3.md`
- **Документ прогресса (этот файл):**  
  `prompts/BRIDGE_PROGRESS_STATUS.md`

---

## 1. Общий статус по крейтам

- **Собранные / частично реализованные крейты:**
  - `bridge-core` — доменная модель, FSM, конфиг, трейты клиентов.
  - `bridge-db` — миграции, репозиторий, audit/event sourcing.
  - `bridge-orchestrator` — основной сервис с воркерами и stub‑клиентами.
  - `canton-ledger-api` — gRPC клиент Ledger API v2 (базовый, без полной обвязки под наш трейт).
  - `bsc-client` — структура модулей есть, реальная имплементация `BscClient` ещё не привязана.
  - `bridge-api` — есть каркас (файлы `handlers.rs`, `routes.rs`, `middleware.rs`), но пока не подогнан под API из промпта v3.

- **Workspace `Cargo.toml`:**
  - `members` включает все нужные крейты (bridge-*, canton-*, bsc-client).
  - В `[workspace.dependencies]` добавлены все внутренние path‑зависимости.
  - Обновлены фичи:
    - `tokio-util` с `"rt", "codec"`.
    - `opentelemetry` с `"trace", "metrics"`.

---

## 2. `bridge-core` — доменная модель (реализовано)

**Файл:** `crates/bridge-core/src/types.rs`

- **TransferId**
  - Newtype над `Uuid` (используем `Uuid::now_v7()` для time‑ordered id).

- **TransferDirection**
  - `CantonToBsc`, `BscToCanton`, `sqlx::Type` с `type_name = "transfer_direction"`.

- **TransferStatus**
  - Полный enum FSM: `Initiated`, `CantonLocking`, `CantonLocked`, `BscMinting`, `BscMinted`, `BscBurned`, `BscBurnFinalized`, `CantonUnlocking`, `CantonUnlocked`, `Completed`, `Failed`, `RollingBack`, `RolledBack`, `Stuck`.
  - Методы:
    - `is_terminal()` → сейчас `Completed | RolledBack`.
    - `needs_intervention()` → `Failed | Stuck`.
    - `is_in_flight()`, `is_retryable()`.
    - `can_transition_to()` — матрица переходов без учёта направления.
    - `can_transition_to_with_direction(next, direction)` — запрещает `Initiated→CantonLocking` для `BscToCanton` и `Initiated→BscBurned` для `CantonToBsc`.

- **Canton‑типы:**
  - `CantonParty(String)` с простой валидацией `contains("::")`.
  - `CantonContractId`, `CantonOffset { pub 0: String }` (есть `begin()`).
  - `CantonCommandId::for_transfer(TransferId, step)`.
  - `CantonTemplateId { package_id, module_name, entity_name }` + `qualified_name()`.

- **BSC‑типы:**
  - `BscAddress(String)` с нормализацией к `0x` + lowercase и валидацией 40 hex символов.
  - `BscTxHash(String)` с валидацией 64 hex символов.
  - `BscBlock { number, hash, timestamp }`.

- **Amount**
  - Хранится как `raw: String`, `decimals: u8`, без float.
  - Методы:
    - `from_base_units(raw, decimals)`.
    - `from_human("1.5", decimals) -> Result<Amount, AmountParseError>`.
    - `to_u128()`, `to_human()`, `is_zero()`, `is_positive()`.
  - Ошибки: `AmountParseError::{InvalidFormat, Overflow, TooManyDecimals}`.

- **TransferErrorLog**
  - `timestamp: DateTime<Utc>`, `stage: TransferStatus`, `error_code`, `message`, `recoverable`, `retry_count: u32`.

- **AssetId**
  - Поля: `id`, `canton_template_id`, `bsc_token_address: BscAddress`, `symbol`, `name`, `decimals`, `min_transfer`, `max_transfer`, `daily_limit`, `enabled`.
  - `validate_limits()` делает базовую проверку id, template_id, валидности адреса.

- **BridgeFee**
  - `fixed_fee: Amount`, `proportional_bps: u32`, `estimated_gas_bnb: String`, `total_fee: Amount`, `net_amount: Amount`.

- **BridgeTransfer**
  - Поля:
    - Идентификация: `id: TransferId`, `trace_id: String`, `direction: TransferDirection`, `status: TransferStatus`, `asset_id: String`, `amount: Amount`, `fee: Option<BridgeFee>`.
    - Canton: `canton_party: CantonParty`, `canton_contract_id: Option<CantonContractId>`, `canton_command_id: Option<String>`, `canton_tx_id: Option<String>`, `canton_offset: Option<CantonOffset>`.
    - BSC: `bsc_address: BscAddress`, `bsc_tx_hash: Option<BscTxHash>`, `bsc_block_number: Option<u64>`, `bsc_confirmations: Option<u64>`.
    - Retry/metadata: `retry_count: u32`, `max_retries: u32`, `error_message: Option<String>`, `error_history: Vec<TransferErrorLog>`, `nonce: String`, `next_retry_at: Option<DateTime<Utc>>`.
    - Timestamps: `created_at`, `updated_at`, `completed_at`.
  - Конструкторы:
    - `new_canton_to_bsc(canton_party, bsc_address, asset_id, amount)` → direction `CantonToBsc`, `status = Initiated`, `fee = None`, `canton_offset = None`, `error_history = Vec::new()`.
    - `new_bsc_to_canton(bsc_address, canton_party, asset_id, amount, bsc_tx_hash, bsc_block_number)` → direction `BscToCanton`, `status = Initiated`, `fee = None`, `bsc_tx_hash`/`bsc_block_number` заполнены, `bsc_confirmations = Some(0)`, `error_history = Vec::new()`.
  - Методы:
    - `update_status(new_status, reason) -> Result<(), BridgeError>`:
      - проверяет `can_transition_to_with_direction`;
      - обновляет `updated_at`;
      - при `is_terminal() || needs_intervention()` ставит `completed_at = now`;
      - меняет `status`.
    - `increment_retry(backoff_sec)` → увеличивает `retry_count`, задаёт `next_retry_at = now + backoff_sec`.
    - `mark_stuck()` → статус `Stuck`, обновляет `updated_at` и `completed_at`.

**Файл:** `crates/bridge-core/src/audit.rs`

- `TransferEventLog` расширен полем `metadata: Option<serde_json::Value>` — под event sourcing/audit.

---

## 3. `bridge-db` — миграции и репозиторий

### 3.1. Миграции (состояние каталога)

Каталог `crates/bridge-db/migrations` содержит:

- `001_init.sql` — базовая таблица `transfers` + enum‑типы.
- `002_audit_indexes.sql` — `transfer_audit_log`, `bridge_checkpoints`.
- **Добавлено:**
  - `003_transfer_fee_offset.sql`
  - `004_audit_metadata_event_log.sql`
  - `005_asset_registry.sql`

**003_transfer_fee_offset.sql**

- Добавляет:
  - `ALTER TABLE transfers ADD COLUMN IF NOT EXISTS fee_raw NUMERIC(78, 0);`
  - `ALTER TABLE transfers ADD COLUMN IF NOT EXISTS canton_offset TEXT;`
  - `CREATE INDEX IF NOT EXISTS idx_transfers_trace_id ON transfers (trace_id);`

**004_audit_metadata_event_log.sql**

- Добавляет:
  - `ALTER TABLE transfer_audit_log ADD COLUMN IF NOT EXISTS metadata JSONB;`
  - Индекс `idx_audit_at` по `at DESC`.
  - Таблицу `transfer_event_log` с индексами по `(transfer_id, at DESC)` и `at`.

**005_asset_registry.sql**

- Соответствует промпту:
  - `asset_registry` со всеми лимитами и fee (`fixed_fee_raw`, `proportional_bps`).
  - `asset_daily_volumes` + индекс `idx_asset_volumes_date`.

### 3.2. `models.rs`

**Файл:** `crates/bridge-db/src/models.rs`

- `AuditLogRow` — для `get_audit_history`:
  - `at`, `old_status`, `new_status`, `actor`, `reason`, `metadata: Option<serde_json::Value>`.

- `TransferRow`:
  - включает все поля из таблицы `transfers`, включая `canton_offset: Option<String>` и `fee_raw: Option<String>`.

- `row_to_transfer(...) -> BridgeTransfer`:
  - Собирает `BridgeTransfer`:
    - `amount` из `amount_raw + decimals`;
    - `fee: None` (из `fee_raw` сейчас не восстанавливаем полную структуру);
    - `canton_offset` из `canton_offset.map(CantonOffset::new)`;
    - `error_history: Vec::new()` (история ошибок пока off‑DB, в памяти или audit логом).

### 3.3. `repository.rs` (TransferRepository)

**Файл:** `crates/bridge-db/src/repository.rs`

- **insert(&BridgeTransfer)**:
  - Пишет полный набор полей, включая:
    - `fee_raw` из `transfer.fee.as_ref().map(|f| f.total_fee.raw.as_str())`.
    - `canton_offset` (`transfer.canton_offset.as_ref().map(|o| o.0.as_str())`).

- **get_by_canton_command_id(&str) -> Option<BridgeTransfer>**:
  - Использует `canton_command_id` для идемпотентности Canton.

- **get_by_bsc_tx_hash(&str) -> Option<BridgeTransfer>**:
  - Строковая версия (не использует `BscTxHash`), удобна для оркестратора.

- **get_by_id(&TransferId)** — возвращает `Option<BridgeTransfer>`.

- **update_status(...)**:
  - Обновляет `status`, `error_message`, `updated_at`.
  - `completed_at` ставится, если `new_status.is_terminal() || new_status.needs_intervention()`.

- **list_pending(limit)**:

  - Тянет активные статусы из `transfers`:

    ```sql
    WHERE status IN (
      'canton_locking', 'canton_locked',
      'bsc_minting', 'bsc_burned', 'bsc_burn_finalized',
      'canton_unlocking'
    )
    ORDER BY next_retry_at NULLS FIRST, updated_at ASC
    LIMIT $1
    ```

- **НОВЫЕ методы, реализованные по промпту:**

  - `list_orphaned(orphan_threshold_minutes: u32)`:
    - Берёт in‑flight статусы (`canton_locking`, `canton_locked`, `bsc_minting`, `canton_unlocking`, `rolling_back`), у которых `updated_at` старше порога.
    - Используется recovery‑воркером оркестратора.

  - `get_audit_history(&TransferId) -> Vec<AuditLogRow>`:
    - Читает `transfer_audit_log` по `transfer_id`, сортировка `ORDER BY at DESC`.

  - `append_audit(...)`:
    - Сигнатура: `(transfer_id, old_status, new_status, actor, reason, metadata: Option<serde_json::Value>)`.
    - Соответствует миграции `004` (`metadata JSONB`).

  - `append_event(transfer_id, event_type, event_data)`:
    - Пишет JSON‑события в `transfer_event_log` (event sourcing).

  - `get_checkpoint_offset` / `set_checkpoint_offset`:
    - Работают через таблицу `bridge_checkpoints`, как в промпте (offset для Canton stream).

---

## 4. `bridge-orchestrator` — каркас сервиса

### 4.1. Структура модуля

**Файл:** `crates/bridge-orchestrator/src/lib.rs`

- Экспортирует:

```rust
pub mod orchestrator;
pub mod recovery;
pub mod health;
pub mod metrics;
pub mod clients_stub;

pub use orchestrator::*;
pub use recovery::*;
pub use health::*;
pub use metrics::*;
pub use clients_stub::*;
```

### 4.2. Orchestrator (boilerplate + FSM‑каркас)

**Файл:** `crates/bridge-orchestrator/src/orchestrator.rs`

- `Orchestrator`:

```rust
pub struct Orchestrator {
    pub config: BridgeConfig,
    pub repo: Arc<TransferRepository>,
    pub canton: Arc<dyn CantonClient>,
    pub bsc: Arc<dyn BscClient>,
}
```

- `run(self) -> Result<(), BridgeError>`:
  - Создаёт `Arc<Self>` и спавнит 4 задачи:
    - `pending_worker_loop()`
    - `recovery_loop()`
    - `canton_stream_loop()`
    - `bsc_burn_loop()`
  - Через `tokio::select!` ждёт завершения любой задачи (panic/ошибка) через `join_worker(...)`.

- **pending_worker_loop**:
  - Берёт `max_concurrent_transfers` из `config.limits` (по промпту).
  - На каждом тике:
    - `list_pending(limit)` из `TransferRepository`.
    - Для каждого `BridgeTransfer`:

      ```rust
      match (transfer.direction, transfer.status) {
          (CantonToBsc, CantonLocked) => { /* TODO: BSC mint (BridgeVault.unlock) */ }
          (CantonToBsc, BscMinting)   => { /* TODO: finality check, BscMinted/Completed */ }
          (BscToCanton, BscBurned)    => { /* TODO: Canton unlock */ }
          (BscToCanton, CantonUnlocking) => { /* TODO: CantonUnlocked/Completed */ }
          _ => warn!("unexpected pending transfer in worker")
      }
      ```

    - Сейчас внутри только `tracing::info!/warn!` — места помечены как `TODO`, туда нужно будет вставить реальный вызов `self.bsc.mint(...)`, `self.canton.unlock_from_bsc(...)`, `update_status`, `append_audit`, `append_event`.

- **recovery_loop**:
  - Использует `config.recovery.orphan_in_flight_minutes` (или `(15, 60)` по умолчанию).
  - Периодически (раз в 60 сек):
    - `list_orphaned(threshold_minutes)` из БД.
    - Для каждого найденного:
      - `transfer.mark_stuck()`.
      - `repo.update_status(..., TransferStatus::Stuck, "orphaned - marked stuck")`.
      - `repo.append_audit(..., old = Failed, new = Stuck, actor = "recovery", reason = "orphaned - marked stuck", metadata = None)`.
    - Это соответствует секции про orphaned/stuck + recovery.

- **canton_stream_loop / bsc_burn_loop**:
  - Пока бесконечные лупы с `sleep(5s)` и `TODO` — нужно будет позже заменить на:
    - `canton.stream_events(from_offset)` + создание `BridgeTransfer` из Daml событий;
    - `bsc.subscribe_burns()` + создание `BridgeTransfer` для BSC→Canton.

- **join_worker**:
  - Оборачивает `JoinHandle<Result<(), BridgeError>>` → `Result<(), BridgeError>`, даёт понятную ошибку, если таск упал или был отменён.

### 4.3. Stub‑клиенты (Canton/BSC)

**Файл:** `crates/bridge-orchestrator/src/clients_stub.rs`

- `NoopCantonClient` реализует `CantonClient`:
  - Все методы (`lock_for_bsc`, `unlock_from_bsc`, `stream_events`) только логируют `warn!` и возвращают `BridgeError::Canton("NoopCantonClient")` или `Ok(Vec::new())` для `stream_events`.

- `NoopBscClient` реализует `BscClient`:

  - `mint(...)` → `warn!(...)` + `Err(BridgeError::Bsc("NoopBscClient"))`.
  - `subscribe_burns()` → `warn!` + `Ok(())`.

Эти заглушки позволяют **запустить оркестратор как сервис** уже сейчас, не имея настроенных реальных RPC/ledger, и постепенно менять их на настоящий клиентский код.

### 4.4. Entrypoint `main.rs`

**Файл:** `crates/bridge-orchestrator/src/main.rs`

- Делает:
  - Настройку трейсинга (`JSON`, `RUST_LOG` с дефолтом `info,bridge_orchestrator=debug`).
  - Читает `BRIDGE_CONFIG` или `config/bridge.yaml` и парсит в `BridgeConfig` (из `bridge-core`).
  - Создаёт `TransferRepository` с `config.db.url` и `config.db.max_connections`.
  - Создаёт `Arc<NoopCantonClient>` и `Arc<NoopBscClient>`.
  - Создаёт `Orchestrator::new(config, repo, canton_client, bsc_client)` и вызывает `run()`.

---

## 5. BSC‑клиент и следующие шаги

### 5.1 `bsc-client` — текущее состояние

- В `crates/bsc-client/src/lib.rs` реализован тип `EthersBscClient`, который **реализует трейт `bridge_core::BscClient`**:
  - `mint(...)`:
    - принимает `recipient: &BscAddress`, `token: &BscAddress`, `amount: &str`, `transfer_id: &str`;
    - строит детерминированный `bytes32 transferId` как `sha256_hex(transfer_id.as_bytes())` (через `bridge_core::crypto::sha256_hex`) и декодирует его в `[u8; 32]`;
    - делегирует в `BridgeVaultContract::unlock(transfer_id_bytes32, recipient, token, amount)` и возвращает `BscTxHash`.
  - `subscribe_burns()`:
    - использует `config.bsc.ws_url` (если `None` — возвращает `BridgeError::Bsc("ws_url is not configured for EthersBscClient")`);
    - создаёт `mpsc::unbounded_channel()` и вызывает `event_listener::subscribe_locked_events(ws_url, bridge_address, tx)`;
    - сейчас это только проверка возможности старта подписки; сама обработка событий и запись `BridgeTransfer` в БД будет реализована в `bridge-orchestrator::bsc_burn_loop`.
- `EthersBscClient` хранит:
  - `bridge_address: BscAddress` (адрес BridgeVault из `BridgeConfig.bsc.bridge_contract_address`);
  - `bridge_vault: Arc<dyn BridgeVaultContract>` — абстракция над реальным abigen‑контрактом;
  - `rpc_url: String`, `ws_url: Option<String>`.
- Модуль `bridge_contract.rs` по‑прежнему определяет только трейт `BridgeVaultContract` (обёртка над `unlock`); `contracts.rs` остаётся placeholder под abigen‑генерацию (`BridgeVault.json` ещё не подключен).

### 5.2 Интеграция `EthersBscClient` в оркестратор

- В `crates/bridge-orchestrator/src/main.rs`:
  - `NoopBscClient` **заменён** на `EthersBscClient`:
    - `bridge_address` берётся из `config.bsc.bridge_contract_address` и оборачивается в `BscAddress::new(...)`;
    - `rpc_url` и `ws_url` передаются из `config.bsc.rpc_url` / `config.bsc.ws_url`.
  - До появления реального abigen‑контракта временно используется локальная реализация `UnimplementedBridgeVaultContract`, которая реализует `bsc-client::BridgeVaultContract` и в `unlock(...)` возвращает:
    - `Err(BridgeError::Bsc("BridgeVault.unlock not implemented yet".into()))`.
  - Это позволяет:
    - уже сейчас **подключить реальный тип клиента** (`EthersBscClient`) в `Orchestrator` и протестировать wiring/config;
    - не менять FSM и не вызывать реальный `mint` до тех пор, пока не будет добавлен Solidity‑контракт и abigen‑обёртка.
- FSM‑логика в `pending_worker_loop` и `bsc_burn_loop` **пока остаётся stub‑овой** (только логи и `TODO`), поэтому текущее изменение **не меняет поведение** и не нарушает матрицу `TransferStatus`.

### 5.3 Следующие шаги (что ещё НЕ сделано, но нужно по промпту)

Эти пункты **ещё не реализованы полностью**, но кодовая база уже подготовлена так, чтобы их можно встраивать по частям, с учётом появления `EthersBscClient`:

1. **Завершить BSC‑слой (bsc-client + Solidity):**
   - Добавить ABI `BridgeVault.json`, сгенерировать контракт через `abigen!` и реализовать конкретный `BridgeVaultContract` поверх него (map `unlock` → `BridgeVault.unlock`).
   - Интегрировать `gas_oracle`, `nonce_manager`, `tx_manager` в `mint(...)`:
     - расчёт gas price, установка nonce, отправка транзакции и ожидание `required_confirmations` (см. Части 7 и 8);
     - корректная обработка ошибок и retry с backoff.
   - В `event_listener` дописать реальную WS‑подписку на события `Locked`/`Burned` и прокидывать их в оркестратор через канал.
   - После появления реального `BridgeVaultContract` удалить временный `UnimplementedBridgeVaultContract` из `main.rs` и создавать `EthersBscClient` на основе настоящего контракта.

2. **Адаптер над `canton-ledger-api` для `CantonClient`:**
   - Реализовать `CantonClient`:
     - `lock_for_bsc(...)` → через Ledger API v2 `CommandService` создаёт Daml‑контракт `LockedAsset`;
     - `unlock_from_bsc(...)` → exercise `CompleteTransfer`/`Unlock` на Canton;
     - `stream_events(from_offset)` → нормальный стрим Daml‑событий → маппинг в `BridgeTransfer` + обновление `bridge_checkpoints`.

3. **Заполнение FSM‑логики в оркестраторе:**
   - В `pending_worker_loop`:
     - `CantonLocked` → рассчитать fee/лимиты, вызвать `bsc.mint`, проставить `BscMinting`, записать audit/event.
     - `BscMinting` → финальность по BSC (`bsc_confirmations`, `required_confirmations`), переход в `BscMinted`/`Completed`.
     - `BscBurned` → вызвать `canton.unlock_from_bsc`, переход в `CantonUnlocking`.
     - `CantonUnlocking` → на успешный completion Canton → `CantonUnlocked` → `Completed`.

4. **`bridge-api` (REST/WebSocket) по ЧАСТИ 9:**
   - `GET /api/v1/health`, `/api/v1/transfers`, `/api/v1/transfers/:id`, admin‑эндпоинты `retry/cancel/force-complete`.
   - WebSocket `/api/v1/transfers/stream` для real‑time обновлений.

5. **Реальные DAML+Solidity контракты:**
   - Daml: `LockedAsset` и прочие модули из ЧАСТИ 5.
   - Solidity: `BridgeVault`, `BridgeRegistry` и т.д., с UUPS, AccessControl, Pausable, как в ЧАСТИ 6.

---

## 6. Как продолжать работу, не теряя контекст

- **Этот файл** (`prompts/BRIDGE_PROGRESS_STATUS.md`) — источник правды по текущему прогрессу.
- Перед новыми изменениями:
  - Проверять здесь, какие слои уже готовы (`core`, `db`, `orchestrator`).
  - Сверяться с оригинальным мастер‑промптом `BSC_CANTON_BRIDGE_READE_PROMT_V3.md` по номеру секции.
- После значимых шагов (например, реализация `BscClient` или API) **обновлять этот файл**:
  - Дописывать новые реализованные части (секция 7+).
  - Отмечать, что ещё осталось по шагам промпта.

Так мы сохраняем **непрерывность работы** и можем в любой момент продолжить реализацию с точного места, не перелопачивая весь промпт заново.

