# Требования к Rust SDK для автономной OTC-платформы

**Версия:** 1.0  
**Дата:** 2026-02-11  
**Роль документа:** единственный источник истины для проектирования и реализации production-ready Rust SDK для OTC-платформы на Canton Network.  
**Стандарт:** Rust best practices 2025, Canton Ledger API v2, Clean Architecture.

---

## 0. EXECUTIVE SUMMARY

### Что мы строим

**Rust SDK для автономной OTC-платформы** - библиотека для взаимодействия с Canton Network и OTC smart contracts. Обеспечивает type-safe API для создания, управления и мониторинга OTC офер.

### Ключевые характеристики

- **Type Safety:** Полная типизация Daml ↔ Rust конвертации
- **Async/Await:** Современный асинхронный Rust (tokio runtime)
- **Модульность:** Четкое разделение ответственности между крейтами
- **Production-Ready:** Error handling, retries, observability, testing
- **Автономность:** SDK не зависит от DeFi или других external систем

### Архитектура

```
┌──────────────────────────────────────────────────┐
│         APPLICATION LAYER                        │
│  (OTC API, Workers, Adapters)                    │
└────────────────┬─────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────┐
│         OTC SDK (NEW)                            │
│  ┌────────────────────────────────────────────┐ │
│  │  otc-service                                │ │
│  │  - OtcService (create/accept/list offers) │ │
│  │  - Domain types (OtcOffer, AcceptResult)  │ │
│  │  - Converters (Daml ↔ Rust)               │ │
│  └────────────┬───────────────────────────────┘ │
└───────────────┼──────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────┐
│         CANTON SDK (EXISTING)                    │
│  ┌─────────────────┐  ┌───────────────────────┐ │
│  │ canton-ledger-  │  │ canton-core           │ │
│  │ api             │  │ - Types, Errors       │ │
│  │ - LedgerClient  │  │ - Command, Value      │ │
│  │ - gRPC services │  │ - Traits              │ │
│  └────────┬────────┘  └───────────┬───────────┘ │
│           │                        │             │
│  ┌────────▼────────┐  ┌───────────▼───────────┐ │
│  │ canton-crypto   │  │ canton-observability  │ │
│  │ - Keys, Signing │  │ - Metrics, Tracing    │ │
│  └─────────────────┘  └───────────────────────┘ │
└────────────────┬─────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────┐
│         CANTON NETWORK                           │
│  (Daml Ledger API v2 via gRPC)                   │
└──────────────────────────────────────────────────┘
```

### Компоненты SDK

| Крейт | Статус | Описание | Для OTC |
|-------|--------|----------|---------|
| **canton-core** | ✅ Есть | Базовые типы, ошибки, трейты | Используется как foundation |
| **canton-ledger-api** | ✅ Есть | gRPC клиент для Ledger API v2 | Расширить для OTC операций |
| **canton-crypto** | ✅ Есть | Криптография, ключи | Используется для signing |
| **canton-observability** | ✅ Есть | Metrics, tracing | Расширить OTC метриками |
| **canton-wallet** | ✅ Есть | Party management | Используется для party derivation |
| **otc-service** | ❌ Нужен | **НОВЫЙ:** Доменная логика OTC | **Основной компонент для реализации** |
| **otc-types** | ❌ Нужен | **НОВЫЙ:** Rust типы для OTC контрактов | Конвертация Daml ↔ Rust |

### Временные рамки

- **Фаза 1 (otc-types):** 1 неделя - Создание Rust типов и конвертеров
- **Фаза 2 (otc-service):** 2 недели - Реализация OtcService с методами CRUD
- **Фаза 3 (Integration):** 1 неделя - Интеграция с canton-ledger-api и тесты
- **Фаза 4 (Workers):** 1 неделя - Expire worker, monitoring
- **Итого:** 5-6 недель

### Ключевые риски

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| **Несовместимость типов** Daml ↔ Rust | Medium | High | Extensive testing, property-based tests |
| **gRPC connectivity issues** | Low | Critical | Retry logic, circuit breakers |
| **Performance bottleneck** при конвертации | Low | Medium | Benchmarks, optimization |
| **Breaking changes** в Canton Ledger API | Low | High | Version pinning, compatibility tests |

### Success Criteria

- ✅ OtcService может создавать/принимать оферты на Canton DevNet
- ✅ Все Daml типы корректно конвертируются в Rust и обратно
- ✅ 100% test coverage для конвертеров
- ✅ <100ms latency для операций (p95)
- ✅ Integration tests проходят на Canton DevNet
- ✅ Документация (rustdoc) полная и понятная

---

## 1. ТЕКУЩЕЕ СОСТОЯНИЕ SDK

### 1.1 Существующие крейты (анализ)

#### canton-core

**Путь:** `crates/canton-core/`

**Содержит:**
- `error.rs`: [`SdkError`](crates/canton-core/src/error.rs:1), [`SdkResult`](crates/canton-core/src/error.rs:1)
- `config.rs`: Конфигурация SDK
- `types/`: Базовые типы Canton (Command, Value, Event, etc.)
- `traits/`: Трейты для расширения

**Оценка для OTC:** ✅ **Готов**
- Используем как foundation
- Возможно нужны дополнительные error variants для OTC

#### canton-ledger-api

**Путь:** `crates/canton-ledger-api/`

**Содержит:**
- `client.rs`: [`LedgerClient`](crates/canton-ledger-api/src/client.rs:16) - базовый gRPC клиент
  - `connect()`: Подключение к participant
  - `submit()`: Отправка команд
  - `get_ledger_end()`: Получение offset

**Текущее API:**
```rust
pub struct LedgerClient {
    channel: Channel,
    ledger_id: String,
    state: StateServiceClient<Channel>,
    command_submission: CommandSubmissionServiceClient<Channel>,
}

impl LedgerClient {
    pub async fn connect(endpoint: impl AsRef<str>, ledger_id: impl Into<String>) -> SdkResult<Self>;
    pub async fn submit(&mut self, commands: Commands) -> SdkResult<()>;
    pub async fn get_ledger_end(&mut self) -> SdkResult<LedgerOffset>;
}
```

**Оценка для OTC:** ⚠️ **Недостаточно**

**Что есть:**
- ✅ Базовое подключение к Canton
- ✅ Отправка команд (submit)
- ✅ gRPC инфраструктура

**Чего не хватает для OTC:**
- ❌ **UpdateService client** (для подписки на события)
- ❌ **GetActiveContracts** (для запроса активных офер)
- ❌ **ExerciseByKey** (для exercise choice по contract key)
- ❌ Высокоуровневые методы (`create_contract`, `exercise_choice`, `query_contracts`)
- ❌ Типизированные конвертеры (DamlRecord ↔ Rust struct)

### 1.2 Пробелы для OTC

| Функциональность | Текущее состояние | Требуется для OTC |
|------------------|-------------------|-------------------|
| **Создание контракта** | Через `submit(Commands)` (low-level) | `LedgerClient::create_contract<T>(template_id, payload)` |
| **Exercise choice** | Через `submit(Commands)` (low-level) | `LedgerClient::exercise_choice<T, R>(contract_id, choice, args)` |
| **Query активных контрактов** | ❌ Нет | `LedgerClient::get_active_contracts<T>(filter)` |
| **Подписка на события** | ❌ Нет | `LedgerClient::subscribe_updates<T>(offset)` → Stream |
| **Конвертация типов** | ❌ Нет | `DamlRecord ↔ OtcOffer`, `DamlValue ↔ Decimal`, etc. |
| **OTC доменная логика** | ❌ Нет | **Новый крейт `otc-service`** |

---

## 2. ТРЕБОВАНИЯ К SDK ДЛЯ OTC

### 2.1 Функциональные требования

#### FR1: Создание OTC оферты

**API:**
```rust
pub async fn create_offer(&mut self, input: CreateOfferInput) -> SdkResult<OtcOffer>
```

**Детали:**
- Принимает `CreateOfferInput` (Rust struct)
- Конвертирует в `DamlRecord` for [`OtcOffer`](docs/OTC_AUTOMATED_DAML_CONTRACT_REQUIREMENTS.md:545) template
- Создаёт Canton Commands с `create` command
- Отправляет через `LedgerClient::submit()`
- Ждёт подтверждения через completion stream
- Возвращает `OtcOffer` с `contract_id`

**Зависимости:**
- `LedgerClient::create_contract<T>()` (нужно добавить)
- Конвертер `CreateOfferInput → DamlRecord`
- Генератор `command_id` (идемпотентность)

#### FR2: Принятие оферты

**API:**
```rust
pub async fn accept_offer(
    &mut self,
    offer_contract_id: &ContractId,
    input: AcceptOfferInput,
) -> SdkResult<AcceptResult>
```

**Детали:**
- Конвертирует `AcceptOfferInput` в DamlRecord для choice [`Accept`](docs/OTC_AUTOMATED_DAML_CONTRACT_REQUIREMENTS.md:576)
- Создает `exercise` команду
- Парсит результат choice (AcceptResult)
- Возвращает typed `AcceptResult`

**Зависимости:**
- `LedgerClient::exercise_choice<T, R>()`
- Конвертер `AcceptOfferInput → DamlRecord`
- Парсер `DamlValue → AcceptResult`

#### FR3: Список активных офер

**API:**
```rust
pub async fn list_offers(&self, filter: Option<OfferFilter>) -> SdkResult<Vec<OtcOffer>>
```

**Детали:**
- Вызывает `GetActiveContracts` через StateService
- Фильтрует по template_id `OTC:OtcOffer`
- Парсит каждый контракт в `OtcOffer`
- Применяет дополнительные фильтры (по maker, status, etc.)

**Зависимости:**
- `StateService::get_active_contracts()` (добавить в LedgerClient)
- Парсер `CreatedEvent → OtcOffer`

#### FR4: Отмена/отклонение оферты

**API:**
```rust
pub async fn cancel_offer(
    &mut self,
    offer_contract_id: &ContractId,
    canceller: &PartyId,
    reason: &str,
) -> SdkResult<()>

pub async fn reject_offer(
    &mut self,
    offer_contract_id: &ContractId,
    rejecter: &PartyId,
    reason: &str,
) -> SdkResult<()>
```

**Детали:** Аналогично `accept_offer`, но для choices [`Cancel`](docs/OTC_AUTOMATED_DAML_CONTRACT_REQUIREMENTS.md:622) и [`Reject`](docs/OTC_AUTOMATED_DAML_CONTRACT_REQUIREMENTS.md:604)

#### FR5: Подписка на события

**API:**
```rust
pub async fn subscribe_offers(
    &mut self,
    from_offset: LedgerOffset,
) -> SdkResult<impl Stream<Item = SdkResult<OfferEvent>>>
```

**Детали:**
- Подписывается на UpdateService stream
- Фильтрует события по template [`OtcOffer`](docs/OTC_AUTOMATED_DAML_CONTRACT_REQUIREMENTS.md:545)
- Классифицирует события: `OfferCreated`, `OfferAccepted`, `OfferArchived`
- Возвращает typed stream

**Зависимости:**
- `UpdateService::subscribe_updates()` (добавить в LedgerClient)
- Event parsers

### 2.2 Нефункциональные требования

#### NFR1: Type Safety

**Требование:** Все Daml типы должны иметь соответствующие Rust типы

**Реализация:**
```rust
// Daml: OtcOffer template
// Rust:
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OtcOffer {
    pub offer_id: String,
    pub operator: PartyId,
    pub maker: PartyId,
    pub taker: Option<PartyId>,
    pub asset_id: String,
    pub side: OtcSide,
    pub quantity: Decimal,
    pub price: Price,
    pub limits: VolumeLimits,
    pub created_at: DateTime<Utc>,
    pub expiry_at: DateTime<Utc>,
    pub auto_accept: bool,
    pub contract_id: Option<ContractId>,
}

// Trait для конвертации
pub trait FromDamlRecord: Sized {
    fn from_daml_record(record: &DamlRecord) -> SdkResult<Self>;
}

pub trait ToDamlRecord {
    fn to_daml_record(&self) -> SdkResult<DamlRecord>;
}
```

#### NFR2: Error Handling

**Требование:** Детальные типизированные ошибки

**Реализация:**
```rust
#[derive(Debug, thiserror::Error)]
pub enum OtcError {
    #[error("Offer not found: {offer_id}")]
    OfferNotFound { offer_id: String },
    
    #[error("Offer expired: {offer_id}, expiry: {expiry}")]
    OfferExpired {
        offer_id: String,
        expiry: DateTime<Utc>,
    },
    
    #[error("Invalid quantity: {quantity}, limits: [{min}, {max}]")]
    InvalidQuantity {
        quantity: Decimal,
        min: Decimal,
        max: Decimal,
    },
    
    #[error("Compliance check failed: {reasons:?}")]
    ComplianceFailed { reasons: Vec<String> },
    
    #[error("SDK error: {0}")]
    Sdk(#[from] SdkError),
}

pub type OtcResult<T> = Result<T, OtcError>;
```

#### NFR3: Performance

**Требования:**
- Конвертация Daml ↔ Rust: <1ms (p99)
- `create_offer()`: <200ms (p95) без network
- `list_offers()`: <500ms для 1000 офер (p95)

**Митигация:**
- Zero-copy десериализация где возможно
- Lazy parsing (парсить только нужные поля)
- Кэширование template_id и party_id

#### NFR4: Observability

**Требование:** Полная трассировка всех операций

**Реализация:**
```rust
use tracing::{instrument, info, warn};

impl OtcService {
    #[instrument(skip(self), fields(offer_id = %input.maker))]
    pub async fn create_offer(&mut self, input: CreateOfferInput) -> OtcResult<OtcOffer> {
        info!("Creating OTC offer");
        
        let offer_id = uuid::Uuid::new_v4().to_string();
        
        let record = input.to_daml_record()?;
        
        let contract_id = self.ledger
            .create_contract(&self.template_ids.otc_offer, record, &offer_id)
            .await?;
        
        info!(
            contract_id = %contract_id,
            asset_id = %input.asset_id,
            "OTC offer created"
        );
        
        Ok(OtcOffer {
            offer_id,
            contract_id: Some(contract_id),
            // ...
        })
    }
}
```

#### NFR5: Testability

**Требование:** 100% покрытие тестами для критичных компонентов

**Типы тестов:**
1. **Unit tests:** Конвертеры, валидация
2. **Property-based tests:** Roundtrip Daml ↔ Rust
3. **Integration tests:** Реальное взаимодействие с Canton DevNet
4. **Mock tests:** Подмена gRPC для быстрых тестов

---

## 3. АРХИТЕКТУРА OTC SDK

### 3.1 Крейт `otc-types`

**Назначение:** Rust типы для OTC контрактов

**Структура:**
```
crates/otc-types/
├── Cargo.toml
└── src/
    ├── lib.rs
    ├── offer.rs       -- OtcOffer, CreateOfferInput
    ├── trade.rs       -- OtcTrade, AcceptResult
    ├── common.rs      -- OtcSide, Price, VolumeLimits
    ├── converters/
    │   ├── mod.rs
    │   ├── offer.rs   -- FromDamlRecord/ToDamlRecord для OtcOffer
    │   ├── value.rs   -- DamlValue конвертеры
    │   └── decimal.rs -- Decimal ↔ DamlValue
    └── events.rs      -- OfferCreated, OfferAccepted

```

**Пример `offer.rs`:**
```rust
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use canton_core::types::{ContractId, PartyId};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OtcOffer {
    pub offer_id: String,
    pub operator: PartyId,
    pub maker: PartyId,
    pub taker: Option<PartyId>,
    pub asset_id: String,
    pub side: OtcSide,
    pub quantity: Decimal,
    pub price: Price,
    pub limits: VolumeLimits,
    pub created_at: DateTime<Utc>,
    pub expiry_at: DateTime<Utc>,
    pub auto_accept: bool,
    pub min_compliance_level: String,
    pub contract_id: Option<ContractId>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateOfferInput {
    pub maker: PartyId,
    pub taker: Option<PartyId>,
    pub asset_id: String,
    pub side: OtcSide,
    pub quantity: Decimal,
    pub price: Decimal,
    pub currency: Option<String>,
    pub min_amount: Decimal,
    pub max_amount: Decimal,
    pub expiry_duration: chrono::Duration,
    pub auto_accept: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OtcSide {
    Buy,
    Sell,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Price {
    pub rate: Decimal,
    pub currency: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VolumeLimits {
    pub min_amount: Decimal,
    pub max_amount: Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcceptResult {
    pub trade_id: String,
    pub actual_quantity: Decimal,
    pub actual_price: Decimal,
    pub settlement_time: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcceptOfferInput {
    pub acceptor: PartyId,
    pub requested_quantity: Decimal,
    pub compliance_ok: bool,
}
```

### 3.2 Крейт `otc-service`

**Назначение:** Доменная логика OTC

**Структура:**
```
crates/otc-service/
├── Cargo.toml
└── src/
    ├── lib.rs
    ├── service.rs     -- OtcService (main API)
    ├── config.rs      -- OtcConfig
    ├── filters.rs     -- OfferFilter для query
    ├── events.rs      -- Event subscription API
    └── workers/
        ├── mod.rs
        └── expire.rs  -- Expire worker
```

**Пример `service.rs`:**
```rust
use canton_ledger_api::LedgerClient;
use canton_core::{SdkResult, types::{ContractId, PartyId, Identifier}};
use otc_types::*;

pub struct OtcService {
    ledger: LedgerClient,
    template_ids: OtcTemplateIds,
    operator_party: PartyId,
}

#[derive(Debug, Clone)]
pub struct OtcTemplateIds {
    pub otc_offer: Identifier,
    pub otc_trade: Option<Identifier>,
}

impl OtcService {
    pub fn new(
        ledger: LedgerClient,
        template_ids: OtcTemplateIds,
        operator_party: PartyId,
    ) -> Self {
        Self {
            ledger,
            template_ids,
            operator_party,
        }
    }
    
    #[tracing::instrument(skip(self), fields(asset_id = %input.asset_id))]
    pub async fn create_offer(&mut self, input: CreateOfferInput) -> OtcResult<OtcOffer> {
        let now = Utc::now();
        let expiry_at = now + input.expiry_duration;
        let offer_id = uuid::Uuid::new_v4().to_string();
        
        // Build DamlRecord
        let offer_record = build_offer_record(&offer_id, &input, &self.operator_party, now, expiry_at)?;
        
        // Create contract
        let command_id = format!("otc-create-{}", offer_id);
        let contract_id = self.ledger.create_contract(
            &self.template_ids.otc_offer,
            offer_record,
            &command_id
        ).await?;
        
        tracing::info!(
            offer_id = %offer_id,
            contract_id = %contract_id,
            "OTC offer created"
        );
        
        Ok(OtcOffer {
            offer_id,
            operator: self.operator_party.clone(),
            maker: input.maker,
            taker: input.taker,
            asset_id: input.asset_id,
            side: input.side,
            quantity: input.quantity,
            price: Price {
                rate: input.price,
                currency: input.currency.unwrap_or_else(|| "USD".to_string()),
            },
            limits: VolumeLimits {
                min_amount: input.min_amount,
                max_amount: input.max_amount,
            },
            created_at: now,
            expiry_at,
            auto_accept: input.auto_accept,
            min_compliance_level: "BASIC".to_string(),
            contract_id: Some(contract_id),
        })
    }
    
    #[tracing::instrument(skip(self))]
    pub async fn accept_offer(
        &mut self,
        offer_contract_id: &ContractId,
        input: AcceptOfferInput,
    ) -> OtcResult<AcceptResult> {
        let now = Utc::now();
        let command_id = format!("otc-accept-{}-{}", offer_contract_id.0, now.timestamp());
        
        // Build choice arguments
        let accept_args = build_accept_args(&input, now)?;
        
        // Exercise Accept choice
        let result = self.ledger.exercise_choice(
            offer_contract_id,
            "Accept",
            accept_args,
            &command_id
        ).await?;
        
        // Parse result
        let accept_result = parse_accept_result(result)?;
        
        tracing::info!(
            contract_id = %offer_contract_id.0,
            trade_id = %accept_result.trade_id,
            quantity = %accept_result.actual_quantity,
            "OTC offer accepted"
        );
        
        Ok(accept_result)
    }
    
    #[tracing::instrument(skip(self))]
    pub async fn list_offers(&self, filter: Option<OfferFilter>) -> OtcResult<Vec<OtcOffer>> {
        let contracts = self.ledger.get_active_contracts(
            &self.template_ids.otc_offer,
            Some(build_transaction_filter(&self.operator_party, filter)?)
        ).await?;
        
        contracts.into_iter()
            .map(|contract| parse_offer_contract(contract))
            .collect()
    }
    
    // Остальные методы: reject_offer, cancel_offer, expire_offer ...
}
```

### 3.3 Расширение `canton-ledger-api`

**Требуемые дополнения:**

```rust
// crates/canton-ledger-api/src/client.rs

impl LedgerClient {
    // NEW: Высокоуровневое создание контракта
    pub async fn create_contract<T: ToDamlRecord>(
        &mut self,
        template_id: &Identifier,
        payload: T,
        command_id: &str,
    ) -> SdkResult<ContractId> {
        let record = payload.to_daml_record()?;
        let commands = build_create_commands(template_id, record, command_id);
        self.submit(commands).await?;
        
        // Wait for completion and extract contract_id
        let contract_id = self.wait_for_contract_created(command_id).await?;
        Ok(contract_id)
    }
    
    // NEW: Exercise choice
    pub async fn exercise_choice<A: ToDamlRecord, R: FromDamlValue>(
        &mut self,
        contract_id: &ContractId,
        choice_name: &str,
        args: A,
        command_id: &str,
    ) -> SdkResult<R> {
        let args_record = args.to_daml_record()?;
        let commands = build_exercise_commands(contract_id, choice_name, args_record, command_id);
        self.submit(commands).await?;
        
        // Wait for completion and extract result
        let result_value = self.wait_for_choice_result(command_id).await?;
        R::from_daml_value(&result_value)
    }
    
    // NEW: Get active contracts
    pub async fn get_active_contracts<T: FromDamlRecord>(
        &mut self,
        template_id: &Identifier,
        filter: Option<TransactionFilter>,
    ) -> SdkResult<Vec<ActiveContract<T>>> {
        // Call StateService::get_active_contracts
        // Parse each contract into T
        todo!()
    }
    
    // NEW: Subscribe to updates
    pub async fn subscribe_updates(
        &mut self,
        from_offset: LedgerOffset,
        filter: TransactionFilter,
    ) -> SdkResult<impl Stream<Item = SdkResult<Update>>> {
        // Call UpdateService::subscribe_updates
        // Return stream of events
        todo!()
    }
}
```

---

## 4. КОНВЕРТЕРЫ DAML ↔ RUST

### 4.1 Трейты для конвертации

```rust
// crates/otc-types/src/converters/mod.rs

use canton_core::types::{DamlRecord, DamlValue};
use canton_core::SdkResult;

/// Convert Rust type to Daml record
pub trait ToDamlRecord {
    fn to_daml_record(&self) -> SdkResult<DamlRecord>;
}

/// Convert Daml record to Rust type
pub trait FromDamlRecord: Sized {
    fn from_daml_record(record: &DamlRecord) -> SdkResult<Self>;
}

/// Convert Rust type to Daml value
pub trait ToDamlValue {
    fn to_daml_value(&self) -> SdkResult<DamlValue>;
}

/// Convert Daml value to Rust type
pub trait FromDamlValue: Sized {
    fn from_daml_value(value: &DamlValue) -> SdkResult<Self>;
}
```

### 4.2 Реализация для OtcOffer

```rust
// crates/otc-types/src/converters/offer.rs

use super::*;
use crate::{OtcOffer, OtcSide, Price, VolumeLimits};

impl ToDamlRecord for CreateOfferInput {
    fn to_daml_record(&self) -> SdkResult<DamlRecord> {
        let mut record = DamlRecord::new();
        
        record.insert("maker", self.maker.to_daml_value()?);
        record.insert("assetId", DamlValue::text(&self.asset_id));
        record.insert("side", self.side.to_daml_value()?);
        record.insert("quantity", self.quantity.to_daml_value()?);
        
        // Price record
        let price_record = DamlRecord::from([
            ("rate", self.price.to_daml_value()?),
            ("currency", DamlValue::text(self.currency.as_deref().unwrap_or("USD"))),
        ]);
        record.insert("price", DamlValue::record(price_record));
        
        // Limits record
        let limits_record = DamlRecord::from([
            ("minAmount", self.min_amount.to_daml_value()?),
            ("maxAmount", self.max_amount.to_daml_value()?),
        ]);
        record.insert("limits", DamlValue::record(limits_record));
        
        // Taker (optional)
        record.insert("taker", match &self.taker {
            Some(t) => DamlValue::optional(Some(t.to_daml_value()?)),
            None => DamlValue::optional(None),
        });
        
        record.insert("autoAccept", DamlValue::bool(self.auto_accept));
        
        Ok(record)
    }
}

impl FromDamlRecord for OtcOffer {
    fn from_daml_record(record: &DamlRecord) -> SdkResult<Self> {
        Ok(Self {
            offer_id: record.get_text("offerId")?.to_string(),
            operator: PartyId::from_daml_value(record.get("operator")?)?,
            maker: PartyId::from_daml_value(record.get("maker")?)?,
            taker: {
                let opt = record.get("taker")?;
                if let DamlValue::Optional(Some(v)) = opt {
                    Some(PartyId::from_daml_value(v)?)
                } else {
                    None
                }
            },
            asset_id: record.get_text("assetId")?.to_string(),
            side: OtcSide::from_daml_value(record.get("side")?)?,
            quantity: Decimal::from_daml_value(record.get("quantity")?)?,
            price: {
                let price_rec = record.get_record("price")?;
                Price {
                    rate: Decimal::from_daml_value(price_rec.get("rate")?)?,
                    currency: price_rec.get_text("currency")?.to_string(),
                }
            },
            limits: {
                let limits_rec = record.get_record("limits")?;
                VolumeLimits {
                    min_amount: Decimal::from_daml_value(limits_rec.get("minAmount")?)?,
                    max_amount: Decimal::from_daml_value(limits_rec.get("maxAmount")?)?,
                }
            },
            created_at: DateTime::from_daml_value(record.get("createdAt")?)?,
            expiry_at: DateTime::from_daml_value(record.get("expiryAt")?)?,
            auto_accept: record.get_bool("autoAccept")?,
            min_compliance_level: record.get_text("minComplianceLevel")?.to_string(),
            contract_id: None, // заполняется отдельно из CreatedEvent
        })
    }
}

impl ToDamlValue for OtcSide {
    fn to_daml_value(&self) -> SdkResult<DamlValue> {
        Ok(DamlValue::variant(match self {
            OtcSide::Buy => "Buy",
            OtcSide::Sell => "Sell",
        }))
    }
}

impl FromDamlValue for OtcSide {
    fn from_daml_value(value: &DamlValue) -> SdkResult<Self> {
        match value {
            DamlValue::Variant { constructor, .. } => match constructor.as_str() {
                "Buy" => Ok(OtcSide::Buy),
                "Sell" => Ok(OtcSide::Sell),
                other => Err(SdkError::Conversion(format!("Unknown OtcSide variant: {}", other))),
            },
            _ => Err(SdkError::Conversion("Expected variant for OtcSide".to_string())),
        }
    }
}
```

### 4.3 Decimal ↔ DamlValue

```rust
// crates/otc-types/src/converters/decimal.rs

use rust_decimal::Decimal;
use canton_core::types::DamlValue;
use canton_core::SdkResult;

impl ToDamlValue for Decimal {
    fn to_daml_value(&self) -> SdkResult<DamlValue> {
        // Daml Decimal: string representation with 10 decimal places
        Ok(DamlValue::numeric(self.to_string()))
    }
}

impl FromDamlValue for Decimal {
    fn from_daml_value(value: &DamlValue) -> SdkResult<Self> {
        match value {
            DamlValue::Numeric(s) => s.parse::<Decimal>()
                .map_err(|e| SdkError::Conversion(format!("Invalid Decimal: {}", e))),
            _ => Err(SdkError::Conversion("Expected numeric value for Decimal".to_string())),
        }
    }
}
```

---

## 5. ТЕСТИРОВАНИЕ SDK

### 5.1 Unit тесты для конвертеров

```rust
// crates/otc-types/src/converters/tests.rs

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;
    
    #[test]
    fn test_otc_side_roundtrip() {
        let buy = OtcSide::Buy;
        let daml_value = buy.to_daml_value().unwrap();
        let back = OtcSide::from_daml_value(&daml_value).unwrap();
        assert_eq!(buy, back);
        
        let sell = OtcSide::Sell;
        let daml_value = sell.to_daml_value().unwrap();
        let back = OtcSide::from_daml_value(&daml_value).unwrap();
        assert_eq!(sell, back);
    }
    
    #[test]
    fn test_decimal_roundtrip() {
        let values = vec![
            dec!(0),
            dec!(1.5),
            dec!(100.123456789),
            dec!(9999999999.9999999999), // max precision
        ];
        
        for val in values {
            let daml_value = val.to_daml_value().unwrap();
            let back = Decimal::from_daml_value(&daml_value).unwrap();
            assert_eq!(val, back, "Failed roundtrip for {}", val);
        }
    }
    
    #[test]
    fn test_create_offer_input_to_daml() {
        let input = CreateOfferInput {
            maker: PartyId::new("Alice").unwrap(),
            taker: None,
            asset_id: "ASSET-001".to_string(),
            side: OtcSide::Buy,
            quantity: dec!(100),
            price: dec!(50.5),
            currency: Some("USD".to_string()),
            min_amount: dec!(10),
            max_amount: dec!(100),
            expiry_duration: chrono::Duration::days(7),
            auto_accept: false,
        };
        
        let record = input.to_daml_record().unwrap();
        
        // Verify fields
        assert_eq!(record.get_text("assetId").unwrap(), "ASSET-001");
        assert_eq!(record.get_bool("autoAccept").unwrap(), false);
        
        // Verify nested price
        let price = record.get_record("price").unwrap();
        let rate = Decimal::from_daml_value(price.get("rate").unwrap()).unwrap();
        assert_eq!(rate, dec!(50.5));
    }
}
```

### 5.2 Property-based тесты

```rust
// crates/otc-types/tests/proptest.rs

use proptest::prelude::*;

proptest! {
    #[test]
    fn prop_otc_side_roundtrip(side in prop::bool::ANY) {
        let otc_side = if side { OtcSide::Buy } else { OtcSide::Sell };
        let daml_value = otc_side.to_daml_value().unwrap();
        let back = OtcSide::from_daml_value(&daml_value).unwrap();
        prop_assert_eq!(otc_side, back);
    }
    
    #[test]
    fn prop_decimal_roundtrip(
        integral in 0i64..10000000000,
        fractional in 0u32..10000000000,
    ) {
        let decimal = Decimal::new(integral * 10000000000 + fractional as i64, 10);
        let daml_value = decimal.to_daml_value().unwrap();
        let back = Decimal::from_daml_value(&daml_value).unwrap();
        prop_assert_eq!(decimal, back);
    }
}
```

### 5.3 Integration тесты с Canton DevNet

```rust
// crates/otc-service/tests/integration.rs

#[cfg(feature = "integration")]
mod integration_tests {
    use otc_service::*;
    use canton_ledger_api::LedgerClient;
    
    #[tokio::test]
    async fn test_create_and_list_offers() {
        // 1. Connect to DevNet
        let mut ledger = LedgerClient::connect(
            "http://localhost:5011",
            "participant1"
        ).await.unwrap();
        
        // 2. Setup OtcService
        let template_ids = OtcTemplateIds {
            otc_offer: Identifier::new("OTC", "OtcOffer").unwrap(),
            otc_trade: None,
        };
        let operator = PartyId::new("Operator").unwrap();
        let mut otc = OtcService::new(ledger, template_ids, operator.clone());
        
        // 3. Create offer
        let input = CreateOfferInput {
            maker: PartyId::new("Alice").unwrap(),
            taker: None,
            asset_id: "BTC".to_string(),
            side: OtcSide::Buy,
            quantity: dec!(1.0),
            price: dec!(50000),
            currency: Some("USD".to_string()),
            min_amount: dec!(0.1),
            max_amount: dec!(1.0),
            expiry_duration: chrono::Duration::days(7),
            auto_accept: false,
        };
        
        let offer = otc.create_offer(input).await.unwrap();
        assert!(offer.contract_id.is_some());
        
        // 4. List offers
        let offers = otc.list_offers(None).await.unwrap();
        assert!(!offers.is_empty());
        
        // 5. Verify created offer is in the list
        let found = offers.iter().find(|o| o.offer_id == offer.offer_id);
        assert!(found.is_some());
    }
    
    #[tokio::test]
    async fn test_accept_offer_flow() {
        // Similar to above, but tests full accept flow
        // 1. Create offer
        // 2. Accept offer
        // 3. Verify offer archived
        // 4. Verify AcceptResult correct
    }
}
```

### 5.4 Тестовая стратегия

| Тип теста | Coverage | CI | Частота |
|-----------|----------|----|---------| 
| **Unit tests** | 100% конвертеров | ✅ Да | Each commit |
| **Property tests** | Roundtrip conversions | ✅ Да | Each commit |
| **Integration tests** | Core flows (create/accept) | ⚠️ Nightly | Daily |
| **E2E tests** | Full OTC workflow | ❌ Manual | Before release |
| **Benchmarks** | Performance | ⚠️ Weekly | Weekly |

---

## 6. РИСКИ И МИТИГАЦИИ (SDK-специфичные)

### 6.1 Risk Matrix

| # | Риск | Вероятность | Влияние | Митигация |
|---|------|-------------|---------|-----------|
| **SDK-R1** | **Type mismatches** между Daml и Rust | High | Critical | Property-based tests для roundtrip<br>Exhaustive enum matching<br>Strict validation |
| **SDK-R2** | **Breaking changes** в Canton Ledger API v2 | Low | High | Version pinning<br>Compatibility tests<br>Deprecation warnings |
| **SDK-R3** | **Performance regression** в конвертерах | Medium | Medium | Benchmarks в CI<br>Performance budgets<br>Profiling |
| **SDK-R4** | **Memory leaks** в long-lived streams | Low | High | Memory profiling<br>Bounded buffers<br>Resource limits |
| **SDK-R5** | **Timezone handling** errors для DateTime | Medium | Medium | Always use UTC<br>Explicit timezone tests<br>Documentation |
| **SDK-R6** | **Decimal precision loss** | Low | Critical | Use rust_decimal (exact)<br>Validate ranges<br>Roundtrip tests |

### 6.2 Митигации

**SDK-R1: Type mismatches**

```rust
// Всегда используем exhaustive matching
impl FromDamlValue for OtcSide {
    fn from_daml_value(value: &DamlValue) -> SdkResult<Self> {
        match value {
            DamlValue::Variant { constructor, .. } => match constructor.as_str() {
                "Buy" => Ok(OtcSide::Buy),
                "Sell" => Ok(OtcSide::Sell),
                unknown => Err(SdkError::Conversion(
                    format!("Unknown OtcSide variant: '{}'. Expected 'Buy' or 'Sell'", unknown)
                )),
            },
            other => Err(SdkError::Conversion(
                format!("Expected Variant for OtcSide, got {:?}", other)
            )),
        }
    }
}

// Property-based тесты ловят несоответствия
proptest! {
    #[test]
    fn roundtrip_never_fails(/* generate random valid Daml values */) {
        // ...
    }
}
```

**SDK-R3: Performance regression**

```rust
// Benchmark в CI
#[bench]
fn bench_offer_to_daml_record(b: &mut Bencher) {
    let input = CreateOfferInput { /* ... */ };
    b.iter(|| {
        black_box(input.to_daml_record().unwrap())
    });
}

// Performance budget: <1ms для конвертации
assert!(elapsed < Duration::from_millis(1));
```

---

## 7. ПЛАН РЕАЛИЗАЦИИ SDK

### Фаза 1: Foundation (1 неделя)

**Цель:** Базовая инфраструктура для OTC типов

**Задачи:**
- [ ] Создать `crates/otc-types/`
- [ ] Реализовать Rust типы: `OtcOffer`, `OtcSide`, `Price`, `VolumeLimits`, `AcceptResult`
- [ ] Реализовать трейты `ToDamlRecord`, `FromDamlRecord`
- [ ] Написать unit тесты для всех конвертеров (target: 100% coverage)
- [ ] Написать property-based тесты для roundtrip

**Acceptance Criteria:**
- ✅ `cargo test --package otc-types` проходит
- ✅ Coverage ≥ 95%
- ✅ Все типы из OTC Daml контракта имеют Rust аналоги

---

### Фаза 2: OtcService Core (2 недели)

**Цель:** Реализовать основной сервис для OTC операций

**Задачи:**
- [ ] Создать `crates/otc-service/`
- [ ] Реализовать `OtcService` struct с методами:
  - `create_offer()`
  - `accept_offer()`
  - `list_offers()`
  - `cancel_offer()`, `reject_offer()`, `expire_offer()`
- [ ] Добавить конфигурацию (`OtcConfig`)
- [ ] Реализовать `OfferFilter` для query
- [ ] Добавить tracing для всех методов

**Acceptance Criteria:**
- ✅ Все методы реализованы
- ✅ Unit тесты с mock `LedgerClient`
- ✅ Документация (rustdoc) полная

---

### Фаза 3: Canton Integration (1 неделя)

**Цель:** Расширить `canton-ledger-api` для OTC

**Задачи:**
- [ ] В `LedgerClient` добавить:
  - `create_contract<T>()`
  - `exercise_choice<A, R>()`
  - `get_active_contracts<T>()`
  - `subscribe_updates()`
- [ ] Добавить `CommandCompletionService` client (для ожидания confirmations)
- [ ] Добавить `UpdateService` client (для event stream)
- [ ] Реализовать retry logic и error handling

**Acceptance Criteria:**
- ✅ Integration тесты проходят на Canton DevNet
- ✅ Create + Accept + List workflow работает end-to-end

---

### Фаза 4: Workers & Observability (1 неделя)

**Цель:** Автоматизация и мониторинг

**Задачи:**
- [ ] Реализовать `expire_worker` в `otc-service/src/workers/`
- [ ] Добавить OTC метрики в `canton-observability`:
  - `otc_offers_created_total`
  - `otc_offers_accepted_total`
  - `otc_offers_active` (gauge)
  - `otc_accept_latency_seconds` (histogram)
- [ ] Добавить структурированное логирование (tracing)
- [ ] Создать примеры конфигурации

**Acceptance Criteria:**
- ✅ Expire worker корректно архивирует истёкшие оферты
- ✅ Метрики экспонируются в `/metrics`
- ✅ Логи structured (JSON format)

---

### Фаза 5: Testing & Documentation (1 неделя)

**Цель:** Финализация перед production

**Задачи:**
- [ ] Написать integration тесты для всех сценариев:
  - Happy path (create → accept)
  - Reject flow
  - Cancel flow
  - Expire flow
  - Error cases (invalid quantity, expired offer, etc.)
- [ ] Benchmarks для performance validation
- [ ] Написать `examples/` с кодом:
  - `basic_otc_flow.rs`
  - `expire_worker_example.rs`
- [ ] Обновить README с OTC примерами
- [ ] Review кода (security, best practices)

**Acceptance Criteria:**
- ✅ Integration tests: 100% pass rate на DevNet
- ✅ Benchmarks: <1ms для конвертеров, <200ms для create_offer
- ✅ Documentation complete (rustdoc + examples)
- ✅ Security review: no critical issues

---

## 8. FINALIZATION

### 8.1 Checklist перед релизом

**Code Quality:**
- [ ] `cargo clippy` без warnings
- [ ] `cargo fmt --check` проходит
- [ ] `cargo test --all` проходит
- [ ] `cargo bench` показывает приемлемую производительность
- [ ] Dependencies обновлены (проверить `cargo outdated`)

**Documentation:**
- [ ] README.md обновлен с разделом "OTC SDK"
- [ ] Rustdoc для всех public API
- [ ] Examples работают и понятны
- [ ] CHANGELOG.md заполнен

**Testing:**
- [ ] Unit tests: ≥95% coverage
- [ ] Integration tests проходят на DevNet
- [ ] Property tests выполняются в CI
- [ ] Security audit пройден

**Deployment:**
- [ ] Versioning: 0.1.0 (pre-release)
- [ ] crates.io publish (если планируется)
- [ ] Docker images (если нужны для workers)

---

## 9. АРХИТЕКТУРНЫЕ РЕШЕНИЯ

### 9.1 Почему отдельный крейт `otc-service`?

**Принятое решение:** OTC логика в отдельном крейте, не в `canton-ledger-api`

**Обоснование:**
- ✅ **Автономность:** OTC - специфичный use case, не generic Canton API
- ✅ **Независимость:** Другие проекты могут использовать `canton-ledger-api` без OTC
- ✅ **Модульность:** Легче тестировать и развивать отдельно
- ✅ **Размер:** Не раздувать core крейты

**Альтернатива отложена:** Встроить OTC в `canton-ledger-api` (слишком специфично)

---

### 9.2 Почему `rust_decimal` для Decimal?

**Принятое решение:** Использовать [`rust_decimal`](https://crates.io/crates/rust-decimal)

**Обоснование:**
- ✅ **Точность:** Exact decimal arithmetic (как Daml Decimal)
- ✅ **Совместимость:** 10+10 digits precision (Daml compatible)
- ✅ **Сериализация:** Serde support
- ✅ **Популярность:** Battle-tested, widely used

**Альтернативы:**
- ❌ `f64`: Потеря точности (неприемлемо для финансов)
- ❌ `bigdecimal`: Более медленный, overflow issues

---

### 9.3 Async/Await vs Sync API

**Принятое решение:** Async API (tokio runtime)

**Обоснование:**
- ✅ **Современность:** Rust async ecosystem зрелый
- ✅ **Производительность:** Non-blocking I/O для gRPC
- ✅ **Совместимость:** Canton Ledger API v2 - gRPC (async)
- ✅ **Workers:** Естественный fit для background tasks

**Требование:** Пользователи должны использовать tokio runtime

---

**КОНЕЦ ДОКУМЕНТА ТРЕБОВАНИЙ К SDK**

**Готовность:** Документ готов к использованию для разработки production-ready Rust SDK для автономной OTC-платформы на Canton Network.
