# Canton OmniChain SDK -- Техническая документация

**By Gybernaty Community**
**Версия:** 1.0 | **Дата:** Февраль 2026



## 1. Обзор

**Canton OmniChain SDK** -- профессиональный Rust SDK для интеграции с Canton Network и построения кроссчейн-решений на уровне институционального финансового сектора.

SDK обеспечивает полную интеграцию с Canton Network, поддерживая обмен данными и активами между Canton и другими блокчейн-экосистемами (EVM, Cosmos, Substrate).

### Целевые сценарии использования

- Токенизация финансовых инструментов (облигации, ценные бумаги, недвижимость)
- Кроссчейн расчеты и расчеты в реальном времени (RTGS)
- Приватные транзакции с сохранением конфиденциальности
- Enterprise-grade решения с compliance (KYC/AML, Travel Rule, MiCA)



## 2. Архитектура

### Высокоуровневая структура

```
+-------------------------------------------------------------+
|                   Your Application                          |
+---------------------------+---------------------------------+
                            |
+---------------------------v---------------------------------+
|                 Canton OmniChain SDK                        |
|  +--------------+  +--------------+  +--------------+       |
|  | canton-core |  | canton-wallet|  |canton-crypto |        |
|  +--------------+  +--------------+  +--------------+       |
|  +--------------+  +--------------+  +--------------+       |
|  |ledger-api    |  | transport    |  |observability |       |
|  +--------------+  +--------------+  +--------------+       |
+---------------------------+---------------------------------+
                            | gRPC/HTTP
+---------------------------v---------------------------------+
|                    Canton Network                           |
|           Ledger API v2 + Privacy Layer                     |
+---------------------------+---------------------------------+
                            |
+---------------------------v---------------------------------+
|                    Global Synchronizer                      |
|         Super Validators | Sequencers | Mediators           |
+-------------------------------------------------------------+
```

### Слои SDK

| Слой | Назначение |
|------|------------|
| Core Layer | Базовые типы, конфигурация, система ошибок |
| Transport Layer | gRPC/HTTP транспорт, TLS, keep-alive |
| Service Layer | Ledger API сервисы, потоки данных |
| Domain Layer | DeFi модули (Treasury, Real Estate, Privacy) |
| Wallet Layer | Управление ключами, подписи, деривация |



## 3. Модульная структура (крейты)

| Крейт | Назначение | Статус |
|-------|------------|--------|
| canton-core | Базовые типы, трейты, ошибки | Production |
| canton-ledger-api | gRPC Ledger API v2 клиент | Production |
| canton-crypto | Криптографические операции | Production |
| canton-wallet | Управление кошельками | Beta |
| canton-transport | Транспортный слой (tonic) | Production |
| canton-reliability | Retry, circuit breaker | Beta |
| canton-observability | OpenTelemetry, метрики | Beta |



## 4. Ledger API v2

SDK полностью поддерживает Ledger API v2 для взаимодействия с Canton Network.

### Основные сервисы

| Сервис | Описание |
|--------|----------|
| Command Submission | Отправка команд создания и exercise контрактов |
| Transaction Service | Потоки транзакций с фильтрацией |
| Active Contracts Service | Получение активных контрактов (ACS) |
| Party Management | Управление участниками сети |
| Event Query | Запрос событий по фильтрам |
| State Service | Доступ к состоянию контрактов |

### Жизненный цикл команды

```
CREATE -> SUBMIT -> COMPLETION -> TRANSACTION -> EVENT
```

- **CREATE**: Формирование команды с уникальным command_id
- **SUBMIT**: Отправка через gRPC
- **COMPLETION**: Получение статуса через асинхронный стрим
- **TRANSACTION**: Персистенция в ledger
- **EVENT**: Уведомление подписчиков

### Дедупликация

SDK автоматически обрабатывает дедупликацию команд:

- Генерация уникального command_id
- Idempotent retry при сбоях сети
- Поддержка change_id для точной дедупликации



## 5. Технологический стек

| Компонент | Технология | Версия |
|-----------|-----------|--------|
| Язык | Rust | 1.93+ |
| gRPC framework | tonic | 0.14+ |
| HTTP/2 | hyper | 1.x |
| Async runtime | tokio | 1.x |
| Middleware | tower | 0.5+ |
| Сериализация | serde | 1.x |
| Конфигурация | config-rs | 0.14+ |
| Ошибки | thiserror | 1.x |
| Observability | opentelemetry | 0.28+ |
| Криптография | ed25519-dalek, k256 | latest |

### Canton Network

| Компонент | Версия |
|-----------|--------|
| Canton | 3.4 |
| Canton Protocol | 4 |
| Daml SDK | 3.4+ |



## 6. Кроссчейн функциональность

### OmniChain мосты

SDK поддерживает интеграцию со следующими экосистемами:

| Экосистема | Тип | Статус |
|------------|-----|--------|
| EVM (Ethereum, L2) | Smart Contract Bridge | Beta |
| Cosmos SDK | IBC Protocol | Beta |
| Substrate | Parachain Bridge | Alpha |

### Деривация ключей

| Стратегия | Описание |
|-----------|----------|
| Unified | Единый ключ для всех сетей |
| PerChain | Отдельные ключи на цепочку |
| Hierarchical | HD-wallet совместимая деривация |



## 7. DeFi модули

### Treasury Bills

Токенизация государственных облигаций и казначейских инструментов.

```
TreasuryBillToken: issuer, faceValue, currency, maturityDate, owners
TreasuryBillHolding: holder, quantity, purchaseDate, yield
```

### Real Estate

Дробное владение недвижимостью.

```
RealEstateToken: propertyId, totalShares, owners, valuation, governance
ShareHolding: owner, shares, dividendRights, votingRights
```

### Privacy Vaults

Приватные хранилища с ZK-подтверждениями.

```
PrivacyVault: owner, assetId, zkProof, timelock
VaultAccess: parties, permissions, expiration
```



## 8. Безопасность

### Модель безопасности

| Уровень | Механизмы |
|---------|-----------|
| Network | TLS/mTLS, certificate pinning |
| Ledger | Canton privacy model, sub-transaction privacy |
| API | Minimal act_as/read_as rights, scope validation |
| Application | Secrets management, HSM integration |

### Аутентификация

- JWT-based авторизация через JWKS
- Поддержка OIDC провайдеров
- Audience и scope валидация



## 9. Observability

### Трассировка

OpenTelemetry совместимая трассировка:

- Distributed tracing через все слои
- Span attributes для бизнес-операций
- Context propagation

### Метрики

| Категория | Метрики |
|-----------|----------|
| Commands | submitted, completed, failed, latency |
| Transactions | total, per-template, size |
| Ledger | ledger_id, offset, lag |
| System | memory, connections, errors |



## 10. Преимущества

### Для разработчиков

| Преимущество | Описание |
|--------------|----------|
| Type-safety | Полная типизация на уровне компиляции |
| Async-first | Неблокирующие операции, high concurrency |
| Zero-cost | Производительность на уровне C/C++ |
| Ergonomic | Builder pattern, fluent interfaces |
| Documented | Comprehensive documentation, examples |

### Для бизнеса

| Преимущество | Описание |
|--------------|----------|
| Institutional | Соответствие финансовым стандартам |
| Privacy | Встроенная конфиденциальность Canton |
| Compliance | KYC/AML, MiCA, Travel Rule support |
| Settlement | RTGS расчеты в реальном времени |
| Global | Multi-jurisdiction поддержка |



## 13. Статус проекта

| Компонент | Статус |
|-----------|--------|
| Core Types | Production |
| Ledger API | Production |
| Crypto | Production |
| Wallet | Beta |
| Cross-chain | Beta |
| Observability | Beta |

---

**Gybernaty Community** -- Building Institutional DeFi on Canton Network
