# Canton OmniChain SDK — Краткий бриф

**By Gybernaty Community** 🌐  
**Версия документа:** 1.0 | **Дата:** 3 февраля 2026

---


---

## 🎯 Обзор

**Canton OmniChain SDK** — профессиональный Rust SDK для интеграции с Canton Network и построения кроссчейн-решений (Canton ↔ EVM/Cosmos/Substrate).

### Назначение

- **Институциональные DeFi приложения** — казначейские облигации, токенизация недвижимости и токенизация ценных бумаг, приватные хранилища,
- **Кроссчейн интеграции** — мосты между Canton Network и EVM/Cosmos/Substrate
- **Enterprise-grade решения** —  compliance, KYC/AML, регуляторные требования,

### Целевая аудитория

- Финансовые институты
- DeFi разработчики
- Enterprise blockchain команды
- Системные интеграторы

---

##  Ключевые особенности

### 1. Модульная архитектура крейтов

| Крейт | Назначение |
|-------|------------|
| `canton-core` | Типы, ошибки, трейты (identifier, value, event, command, transaction, filter, offset) |
| `canton-ledger-api` | gRPC-клиент Ledger API v2 с полной поддержкой протокола |
| `canton-crypto` | KeyStore, криптографические подписи (Ed25519, P-256, secp256k1) |
| `canton-wallet` | Wallet, гибкая деривация (Unified/PerChain), PartyId, MultiIdentityWallet |
| `canton-transport` | gRPC transport на базе tonic |
| `canton-reliability` | Retry, circuit breaker, fault tolerance |
| `canton-observability` | OpenTelemetry, трассировка, метрики |

### 2. Ledger API v2

- **Асинхронная архитектура** — command submission, completion streams
- **Все сервисы** — Command Submission, Transaction, Active Contracts, State, Event Query
- **Потоковая обработка** — стримы событий и транзакций
- **Дедупликация команд** — change ID, command_id, idempotent retries

### 3. Кроссчейн функциональность

- **OmniChain мосты** — Canton ↔ EVM, Cosmos, Substrate
- **Гибкая деривация** — Unified и PerChain стратегии
- **Multi-Identity Wallet** — единый кошелек для множества сетей

### 4. DeFi-ready компоненты

- Treasury Bills (токенизированные гособлигации)
- Real Estate (дробное владение недвижимостью)
- Privacy Vaults (ZK-proof приватные хранилища)
- Oracle интеграции (ценовые фиды, рыночные данные)

---

##  Преимущества

### Для разработчиков

| Преимущество | Описание |
|--------------|----------|
| **Type-safe API** | Полная типизация Rust, compile-time проверки |
| **Async-first** | Tokio runtime, неблокирующие операции |
| **Zero-cost abstractions** | Производительность на уровне C/C++ |
| **Ergonomic API** | Builder pattern, fluent interfaces |
| **Comprehensive docs** | Документация с примерами и doctests |

### Для бизнеса

| Преимущество | Описание |
|--------------|----------|
| **Institutional-grade** | Соответствие требованиям финансовых регуляторов |
| **Privacy by design** | Встроенная приватность Canton Network |
| **Compliance ready** | KYC/AML, Travel Rule, MiCA support |
| **24/7 settlement** | Атомарные расчеты в реальном времени |
| **Multi-jurisdiction** | Поддержка различных юрисдикций |

### Технические преимущества

```
┌─────────────────────────────────────────────────────────┐
│                    Rust Ecosystem                        │
├──────────────────┬──────────────────┬───────────────────┤
│  Memory Safety   │  Thread Safety   │  Performance      │
│  (no GC)         │  (Send/Sync)     │  (zero-cost)      │
├──────────────────┼──────────────────┼───────────────────┤
│  Error Handling  │  Extensibility   │  Testability      │
│  (Result/thiserror)│ (traits/DI)    │  (mocks/stubs)    │
└──────────────────┴──────────────────┴───────────────────┘
```

---

##  Архитектура

### Высокоуровневая схема

```
┌─────────────────────────────────────────────────────────┐
│                   Your Application                       │
└────────────────────────────┬────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────┐
│                 Canton OmniChain SDK                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ canton-core  │  │ canton-wallet│  │canton-crypto │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ledger-api    │  │ transport    │  │observability │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└────────────────────────────┬────────────────────────────┘
                             │ gRPC/Tonic
┌────────────────────────────▼────────────────────────────┐
│              Canton Network (Participant)                │
│           Ledger API v2 + State Management               │
└────────────────────────────┬────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────┐
│               Global Synchronizer                        │
│      Super Validators │ Sequencers │ Mediators          │
└─────────────────────────────────────────────────────────┘
```

### Слои SDK

1. **Core Layer** — базовые типы, конфигурация, ошибки
2. **Transport Layer** — gRPC (tonic), TLS, keep-alive
3. **Service Layer** — Ledger API сервисы, стримы
4. **Domain Layer** — Treasury, RealEstate, Privacy, Oracle
5. **Wallet Layer** — ключи, подписи, деривация

---

##  Технологический стек

### SDK (Rust)

| Компонент | Технология | Версия |
|-----------|-----------|--------|
| **Язык** | Rust | 1.85.0 (stable) |
| **gRPC** | tonic | 0.13.0 |
| **HTTP/2** | hyper | 1.5.0 |
| **Async runtime** | tokio | 1.42.0 |
| **Middleware** | tower | 0.5.2 |
| **Сериализация** | serde | 1.0.217 |
| **Конфигурация** | config-rs | 0.15.0 |
| **Ошибки** | thiserror | 2.0.9 |
| **Observability** | opentelemetry | 0.27.1 |
| **Крипто** | ed25519-dalek 2.1.1, k256 0.13.4 | latest |
| **Protobuf** | prost | 0.13.0 |
| **Tracing** | tracing | 0.1.41 |
| **Tracing subscriber** | tracing-subscriber | 0.3.19 |
| **Futures** | futures | 0.3.31 |
| **Async utilities** | tokio-util | 0.7.13 |
| **Async streams** | tokio-stream | 0.1.17 |
| **Error handling** | anyhow | 1.0.95 |
| **Concurrent map** | dashmap | 6.1.0 |
| **Locking** | parking_lot | 0.12.3 |
| **Bytes** | bytes | 1.9.0 |
| **Async trait** | async-trait | 0.1.83 |
| **SHA2** | sha2 | 0.10.8 |
| **Random** | rand | 0.8.5 |
| **Zeroize** | zeroize | 1.8.1 |


### Canton Network

| Компонент | Технология | Версия |
|-----------|-----------|--------|
| **Canton** | Canton Open Source | 3.7.0 |
| **Splice** | Global Synchronizer | 0.5.5 |
| **Protocol** | Canton Protocol | 34 |
| **Daml SDK** | Daml | 2.10.0 |


---

##  DeFi модули

### 1. Treasury Bills (Казначейские облигации)

```
┌─────────────────────────────────────────┐
│           Treasury Bills Module          │
├─────────────────────────────────────────┤
│ • Токенизация гособлигаций              │
│ • Фракционное владение                  │
│ • Автоматический yield                   │
│ • KYC-gated доступ                       │
│ • Compliance integration                 │
└─────────────────────────────────────────┘
```

**Возможности:**
- Создание и управление T-Bills
- Покупка/продажа токенизированных долей
- Автоматический расчет доходности
- Интеграция с compliance провайдерами

### 2. Real Estate (Токенизация недвижимости)

**Возможности:**
- Дробное владение недвижимостью
- Governance и голосование
- Дивидендные выплаты
- Вторичный рынок токенов

### 3. Privacy Vaults (Приватные хранилища)

**Возможности:**
- Zero-knowledge proof хранение
- Multi-sig управление
- Timelock механизмы
- Приватные транзакции

### 4. Oracle Services

**Возможности:**
- Ценовые фиды в реальном времени
- Рыночные индексы
- Оценка недвижимости
- Treasury yields

---

##  Безопасность и Compliance

### Уровни безопасности

```
┌────────────────────────────────────────────────────────┐
│ Level 5: Network Security                               │
│ • TLS/mTLS для всех соединений                         │
│ • JWT/JWKS авторизация                                 │
├────────────────────────────────────────────────────────┤
│ Level 4: Ledger Security                               │
│ • Canton privacy model                                  │
│ • Sub-transaction privacy                              │
├────────────────────────────────────────────────────────┤
│ Level 3: SDK Security                                  │
│ • Минимальные act_as/read_as права                     │
│ • Секреты из env/secret manager                        │
├────────────────────────────────────────────────────────┤
│ Level 2: API Security                                  │
│ • Rate limiting                                        │
│ • Input validation                                     │
├────────────────────────────────────────────────────────┤
│ Level 1: Frontend Security                             │
│ • HTTPS only                                           │
│ • Content Security Policy                              │
└────────────────────────────────────────────────────────┘
```
