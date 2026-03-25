# Экспертная оценка стека и предлагаемой реализации Canton OTC / Canton OmniChain SDK

**Версия:** 1.0  
**Дата:** 2026-01-28  
**Основа:** промпт `docs/prompts/STACK_AND_IMPLEMENTATION_EXPERTISE_PROMPT.md`, анализ реальных артефактов проекта.

---

## Перечень проанализированных артефактов

**Текущий стек (canton-otc):** `package.json`, `next.config.js`, `tailwind.config.ts`, `src/middleware.ts`; `src/lib/canton/services/damlIntegrationService.ts`, `cantonBridgeService.ts`, `cantonAuthService.ts`; `treasuryBillsService.ts`, `privacyVaultService.ts`, `realEstateService.ts`, `zkProofService.ts`, `oracleService.ts`, `complianceService.ts`; хуки `useTreasuryBills.ts`, `usePrivacyVaults.ts`, `useCantonBridge.ts`, `useCantonNetwork.ts`, `realCantonIntegration.ts`; `cantonStore.ts`, `wagmi.ts`, `realBridgeConfig.ts`; `TreasuryBillsPanel.tsx`, `PrivacyVaultsPanel.tsx`, `RealEstatePanel.tsx` (фрагменты); `src/app/api/defi/treasury/bills/route.ts`; `supabase/migrations/001_canton_wealth_platform_schema.sql`; `config/kubernetes/`, `k8s/`; `README.md`.

**Целевая реализация (cantonnet-omnichain-sdk):** `DEVELOPMENT_PROMPT.md`, `research/08-sdk-architecture-design.md`, `01-canton-network-architecture.md`, `02-omnichain-integration-patterns.md`, `03-rust-sdk-best-practices-2025.md`, `04-daml-ledger-api.md`, `05-grpc-protobuf-rust.md`, `06-cryptographic-requirements.md`, `07-production-ready-patterns.md`.

**Не анализировались (указаны в промпте, но отсутствуют или не открыты):** `docs/PRD_CANTON_DEFI_2026/`, `docs/reports/ARCHITECTURE_ANALYSIS.md`, `docs/reports/PRODUCTION_READINESS_AUDIT.md`, `docs/reports/DEX_PRODUCTION_READINESS_AUDIT.md`, `docs/analysis/`, `contracts/CantonBridge.sol` — по ним в отчёте «недостаточно данных».

---

## 2. Критерии оценки

### 2.1 Текущий стек (canton-otc)

| Критерий | Оценка (1–5) | Краткое обоснование |
|----------|--------------|----------------------|
| Актуальность и уместность технологий | 4 | Next 15, React 19, TanStack Query 5, wagmi 3, viem 2, Supabase 2.78, @daml/ledger 2.9 — стек свежий и подходит под SPA/API + Canton. Нет отдельного «Rust SDK», всё на TypeScript/Node. |
| Связность UI → API → Canton/Daml → БД | 3 | UI (TreasuryBillsPanel и др.) вызывает хуки → сервисы (TreasuryBillsService и т.д.) → DamlIntegrationService/CantonBridgeService; API routes инициализируют те же сервисы и режут данные в JSON. Связь есть, но: Daml по коду — в основном mock/fallback (`createMockLedger`, `NEXT_PUBLIC_DAML_USE_REAL_LEDGER`), LayerZero в bridge — симуляция; персистентность — Supabase schema + in-memory в сервисах; цепочка «реальный Canton participant → контракты → БД» в коде не замкнута. |
| Готовность к enterprise (resilience, observability, security) | 2–3 | Есть: CSP, security headers, JWT + EVM-signature в CantonAuthService, prom-client в `monitoring.ts`, rate-limiter. Нет или слабо: централизованный tracing (OpenTelemetry), circuit breaker/retry вокруг Canton/Daml и API, структурированное логирование, health/readiness для Canton; middleware только для `/admin` (cookie JWT). |
| Качество абстракций (сервисы, хуки, типы) | 4 | Чёткое разделение: сервисы (Daml, Bridge, Treasury, Privacy, RealEstate, Oracle, Compliance, ZK), хуки инкапсулируют данные и вызовы, типы (Decimal, ContractId, CantonBridgeRequest и т.д.) согласованы. Дубли типов между хуком и сервисом (например, TreasuryBill в useTreasuryBills vs TreasuryBillsService). |
| Соответствие заявленным целям (OTC, wealth, multichain) | 4 | OTC/wealth: Treasury Bills, Privacy Vaults, Real Estate, compliance/KYC, портфолио — покрыты. Multichain: wagmi (mainnet, bsc, polygon, optimism, arbitrum, cantonNetwork), realBridgeConfig, CantonBridgeService с LayerZero-семантикой; без реальных контрактов и кросс-чейн proof — концептуально на месте, реализация заглушками. |

**Сильные стороны стека:** (1) Единый modern frontend/API на Next 15 + React 19 + TypeScript. (2) Полноценный набор доменных сервисов (Treasury, Privacy, RealEstate, Oracle, Compliance, ZK) и связка с Daml/Canton по контрактам. (3) Supabase-схема под users/KYC/AML/audit и Canton wealth — логичная. (4) Wagmi/viem + RainbowKit и конфиг цепочек готовы к мультичейну. (5) В коде заложены пути к «настоящему» Canton (participant URL, JWT, party, mock fallback).

**Слабые стороны и риски:** (1) Реальный Ledger/Canton используется только при `NEXT_PUBLIC_DAML_USE_REAL_LEDGER` и наличии @daml/ledger; по умолчанию — mock. (2) Нет retry/circuit breaker вокруг Canton и внешних API — один сбой тянет 500. (3) Observability точечная (prom-client в monitoring.ts), без единого трейсинга и корреляции запросов. (4) В `TreasuryBillsPanel.tsx` вызывается несуществующий `useTreasuryBillsService` вместо экспортированного `useTreasuryBills` — ошибка в коде. (5) API routes создают сервисы через глобальный синглтон (`getTreasuryService()`), без DI и без контейнеризации жизненного цикла — усложняет тесты и масштабирование.

**Рекомендации по эволюции стека:** (1) Ввести retry + circuit breaker (например, `cockatiel` или обёртки fetch/axios) для вызовов Canton participant и внешних оракулов. (2) Добавить OpenTelemetry (или как минимум trace-id в логах) для API и Canton-вызовов. (3) Заменить вызов несуществующего хука в TreasuryBillsPanel на `useTreasuryBills`. (4) Описать и поддерживать один контур «real Canton»: от env (participant URL, JWT, party) до создания/чтения контрактов и, при необходимости, синхронизации с Supabase. (5) Вынести инициализацию сервисов в фабрику/DI (или Route Handlers с явным контекстом), чтобы уйти от глобальных синглтонов в API.

---

### 2.2 Предлагаемая реализация (документы cantonnet-omnichain-sdk)

| Критерий | Оценка (1–5) | Краткое обоснование |
|----------|--------------|----------------------|
| Соответствие Canton/Daml best practices и Ledger API v2 | 5 | В `04-daml-ledger-api.md` и DEVELOPMENT_PROMPT перечислены CommandService, CommandSubmission/Completion, Transaction, ActiveContracts, Party, Package, LedgerIdentity; proto и структура сообщений совпадают с Ledger API v2. |
| Передовость выбора технологий (Rust, Tokio, Tonic, observability) | 5 | Rust 2024, Tokio, Tonic/Prost, OpenTelemetry, circuit breaker, rate limit, retry — в доке явно заданы; в `07-production-ready-patterns.md` есть код-circuit breaker, метрики, что соответствует практикам 2024–2026. |
| Зрелость OmniChain-архитектуры относительно индустрии | 4 | В `02-omnichain-integration-patterns.md`: Bridge, Adapter, Router, proof/state sync; Canton как hub, адаптеры под Ethereum/Cosmos/Substrate. Сопоставимо с паттернами IBC, LayerZero, CCIP; явных отличий по ZK/optimistic proof в документе меньше, чем в типичных ZK-bridge спеках. |
| Полнота и применимость production-требований | 4 | Reliability, observability, crypto (HSM, zeroize), тесты, deny/clippy — описаны. Не хватает явных сценариев: онбординг party, multi-tenant, пошаговый upgrade, регуляторные сценарии (blocklist, лимиты по юрисдикциям). |
| Реалистичность воплощения в срок и с разумными ресурсами | 3 | Спека и слои понятны; реализация с нуля всего в Rust (canton-ledger-api, transport, reliability, omnichain adapters) — объёмная. Реалистично как поэтапный SDK (сначала Ledger API + core, потом reliability/observability, потом omnichain), а не «всё сразу». |

**Что уже на уровне/выше индустрии:** (1) Чёткое разделение крейтов (core, ledger-api, transport, crypto, reliability, observability, omnichain). (2) Явные типы ошибок (SdkError с Connection, Authentication, Transaction, Validation, RateLimited, CircuitOpen, CrossChain). (3) Production-паттерны с кодом (circuit breaker, метрики). (4) Ссылки на Ledger API v2 proto и список сервисов. (5) HSM, zeroize, feature flags в требованиях.

**Что отстаёт или противоречит трендам 2024–2026:** (1) «Rust 2024 Edition, MSRV 1.85» — на момент отчёта стабильного Rust 1.85 нет; в доке по сути заложена текущая stable. (2) Онбординг пользователя/party, мультитенантность и регуляторные сценарии почти не развернуты. (3) Конкретики по формату proof (ZK vs optimistic) и по интеграции с существующими сетями (LayerZero, IBC) мало — больше абстрактные Bridge/Adapter.

**Критичные пробелы в документации:** (1) Пошаговый онбординг: выделение party, привязка к идентитету, хранение ключей. (2) Upgrade-стратегия SDK и обратная совместимость. (3) Multi-tenant и изоляция данных/ключей. (4) Регуляторные требования: блок-листы, лимиты, отчётность по юрисдикциям. (5) Конкретные форматы интеграции с одной выбранной L2/bridge (например, LayerZero или IBC) и порядок внедрения.

---

### 2.3 Сравнение «как есть» vs «как в документах»

- **Где согласованы:** Концепции Canton как hub, Daml-контракты для институциональных активов и мультичейн, разделение на домен (Treasury/Privacy/RealEstate), compliance и оракулы — и в коде, и в cantonnet-omnichain-sdk. Роли Bridge/Adapter в документах соответствуют роли CantonBridgeService и конфигу realBridgeConfig в коде. Типы операций (create, exercise, query, stream) и идея Ledger API v2 совпадают с тем, что заложено в DamlIntegrationService.

- **Где документы задают уровень выше кода:** (1) Resilience: в доке — circuit breaker, rate limit, retry; в коде — почти ничего вокруг Canton/API. (2) Observability: в доке — OpenTelemetry, метрики, трейсинг; в коде — только prom-client и точечные счётчики. (3) Транспорт: в доке — gRPC/Tonic, отдельный слой; в коде — HTTP/WS через @daml/ledger и симуляции. (4) Перенести в первую очередь: retry + circuit breaker для Canton-вызовов и API, затем единый trace-id/OpenTelemetry, затем явное описание «реального» контура (env, participant, создание/чтение контрактов).

- **Конфликты:** Документы предполагают нативный Rust SDK и gRPC к Ledger API; код использует TypeScript и @daml/ledger (HTTP/JSON или свой транспорт). Это не противоречие по целям, а различие реализации: доки задают целевую платформу (Rust SDK), код — текущую (TS/Next.js). Выравнивание: либо (a) довести TS-интеграцию до «реального» Canton по тем же концепциям (Ledger API v2, те же сервисы), либо (b) вводить Rust SDK как отдельный backend/библиотеку и вызывать его из Next.js (RPC/FFI/отдельный сервис).

- **Параллельный Rust SDK vs эволюция текущего стека:** Имеет смысл и то и другое: (1) Rust SDK по cantonnet-omnichain-sdk — как отдельный продукт для встраивания в другие системы и для тяжёлой нагрузки (participant, bridge, crypto). (2) Текущий TypeScript/Next.js — оставить как основной UI и B2B-точку входа, но усилить его resilience и observability по образцу документов и по возможности переиспользовать один и тот же контур данных (например, один «source of truth» — Canton, а TS либо через прямой Ledger API, либо через будущий Rust SDK как сервис). Документы тогда играют роль целевой архитектуры и набора практик, которые постепенно воплощаются и в Rust SDK, и в TS-стеке (retry, circuit breaker, трейсинг, проверенное использование Ledger API v2).

---

## 3. Итоговые выводы

### 3.1 Насколько хорош наш стек

Стек в целом сильный для заявленных целей OTC и wealth platform: современный фронт и API, осмысленный набор сервисов (Treasury, Privacy, RealEstate, Oracle, Compliance, ZK), интеграция с Canton/Daml и мультичейном через wagmi и bridge-конфиг, Supabase под KYC/AML и аудит. Главные ограничения — реальный Canton в коде по умолчанию не включён (mock/fallback), почти нет устойчивости к сбоям (retry, circuit breaker) и единого observability (трейсинг, корреляция), а также есть обходимая, но реальная ошибка в UI (вызов несуществующего хука в TreasuryBillsPanel). Для заявленных целей стек достаточен как основа, но до enterprise-уровня не хватает устойчивости и наблюдаемости. Приоритетные улучшения: включить и документировать один контур «real Canton», ввести retry/circuit breaker и единый trace-id/OpenTelemetry, исправить использование хука в TreasuryBillsPanel и по возможности вынести инициализацию сервисов из глобальных синглтонов в DI/фабрику.

### 3.2 Насколько передовая и прогрессивная предлагаемая реализация

Описание в cantonnet-omnichain-sdk по архитектуре (слои, крейты, Ledger API v2, Bridge/Adapter/Router) и по технологиям (Rust, Tokio, Tonic, circuit breaker, OpenTelemetry, HSM) приближается к индустриальному уровню 2024–2026 и по части практик опережает типичные проекты. Существенные пробелы: онбординг и мультитенантность, upgrade-стратегия, регуляторные сценарии, конкретика по форматам proof и по интеграции с одной выбранной сетью (LayerZero/IBC). Чтобы считать реализацию действительно передовой и пригодной к production без доработок, в документацию нужно добавить разделы по онбордингу party/identity, multi-tenant изоляции, upgrade и обратной совместимости, а также уточнить интеграцию с одной конкретной OmniChain-средой (например, LayerZero или IBC) и порядок внедрения компонентов.

### 3.3 Три приоритетных действия

1. **По стеку:** Ввести retry и circuit breaker для вызовов Canton participant и внешних оракулов (например, через обёртки вокруг fetch/axios или библиотеку вроде `cockatiel`), и зафиксировать это в коде и в конфиге (пороги, таймауты).

2. **По документации/архитектуре:** Добавить в cantonnet-omnichain-sdk раздел «Онбординг и идентичность»: выделение party, привязка к идентитету пользователя/системы, хранение и ротация ключей, и при необходимости — кратко multi-tenant и регуляторные ограничения (blocklist, лимиты по юрисдикциям).

3. **По связи код ↔ документы:** Синхронизировать практики устойчивости и наблюдаемости: в коде canton-otc внедрить те же идеи, что в документе (retry, circuit breaker, единый trace-id или OpenTelemetry), и в документации явно указать, что эти практики относятся и к «текущему TS-стеку», а не только к целевому Rust SDK. В первую очередь перенести из документов в код: описание одного целевого контура «real Canton» (env, participant URL, JWT, party, какие вызовы Ledger API считаются обязательными) и минимальный набор метрик/трейсов для этого контура.

---

**Артефакт с ошибкой:** В `src/components/defi/treasury/TreasuryBillsPanel.tsx` вызов `useTreasuryBillsService(address)` исправлен на `useTreasuryBills(address)` из `@/lib/canton/hooks/useTreasuryBills`. Дальнейшие пункты по коду и PRD собраны в `docs/PRD_CANTON_DEFI_2026/ALIGNMENT_WITH_STACK_REPORT_AND_DEV_BACKLOG.md`.
