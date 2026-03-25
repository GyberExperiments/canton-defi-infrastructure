# Промпт: Экспертиза стека и предлагаемой реализации Canton OTC / Canton OmniChain SDK

**Цель:** Получить структурированную экспертную оценку:
1. Насколько **хорош наш текущий стек** (фронт, бэк, Canton-интеграция).
2. Насколько **передовая и прогрессивная** реализация, описанная в наших документах (cantonnet-omnichain-sdk и связанные артефакты), по сравнению с индустрией 2024–2026 и best practices.

**Роль исполнителя:** Эксперт по enterprise blockchain, Canton/Daml, OmniChain, modern web stack и production-ready SDK. Опираться только на реально прочитанные файлы и документацию проекта, без домыслов.

---

## 1. Что обязательно проанализировать

### 1.1 Текущий production-стек (кодовая база canton-otc)

**Пути и артефакты:**

| Категория | Пути |
|-----------|------|
| Зависимости и runtime | `package.json`, `next.config.js`, `tailwind.config.ts`, `middleware.ts` |
| Canton/Daml интеграция | `src/lib/canton/services/damlIntegrationService.ts`, `src/lib/canton/services/cantonBridgeService.ts`, `src/lib/canton/services/cantonAuthService.ts` |
| Defi-сервисы | `src/lib/canton/services/treasuryBillsService.ts`, `src/lib/canton/services/privacyVaultService.ts`, `src/lib/canton/services/realEstateService.ts`, `src/lib/canton/services/zkProofService.ts`, `src/lib/canton/services/oracleService.ts`, `src/lib/canton/services/complianceService.ts` |
| Хуки и клиентская логика | `src/lib/canton/hooks/useTreasuryBills.ts`, `src/lib/canton/hooks/usePrivacyVaults.ts`, `src/lib/canton/hooks/useCantonBridge.ts`, `src/lib/canton/hooks/useCantonNetwork.ts`, `src/lib/canton/hooks/realCantonIntegration.ts` |
| Стейт и конфиг | `src/lib/canton/store/cantonStore.ts`, `src/lib/canton/config/wagmi.ts`, `src/lib/canton/config/realBridgeConfig.ts` |
| UI Defi | `src/components/defi/treasury/TreasuryBillsPanel.tsx`, `src/components/defi/privacy/PrivacyVaultsPanel.tsx`, `src/components/defi/realestate/RealEstatePanel.tsx` |
| API и бэкенд | `src/app/api/defi/**/*.ts`, `services/**/*.ts` (если есть серверные сервисы) |
| Схема и персистентность | `supabase/migrations/*.sql`, в т.ч. `001_canton_wealth_platform_schema.sql` |
| Инфраструктура и деплой | `config/kubernetes/**`, `k8s/**`, `.github/**/*.yml` |

**По стеку оценить:**
- Актуальность версий (Next, React, TanStack Query, wagmi/viem, Supabase, @daml/*).
- Уместность выбора технологий под задачу (OTC, wealth platform, Canton, multichain).
- Связность стека: от UI до Canton/Daml и до БД/API.
- Пробелы: что должно быть для enterprise (observability, resilience, security), но отсутствует или слабо отражено в коде.

### 1.2 Документированная «целевая» реализация (cantonnet-omnichain-sdk)

**Пути и артефакты:**

| Документ | Путь | Содержание по смыслу |
|----------|------|----------------------|
| Development Prompt (спека SDK) | `cantonnet-omnichain-sdk/DEVELOPMENT_PROMPT.md` | Миссия, архитектура, крейты, конфиг, acceptance criteria |
| Архитектура SDK | `cantonnet-omnichain-sdk/research/08-sdk-architecture-design.md` | Слои, крейты, типы, OmniChain, ошибки |
| Canton Network | `cantonnet-omnichain-sdk/research/01-canton-network-architecture.md` | Протокол, домены, Ledger API, безопасность |
| OmniChain-паттерны | `cantonnet-omnichain-sdk/research/02-omnichain-integration-patterns.md` | Bridge/Adapter/Router, Canton как hub, ZK/optimistic sync |
| Rust Best Practices | `cantonnet-omnichain-sdk/research/03-rust-sdk-best-practices-2025.md` | Стек, ошибки, async, тесты, observability |
| Daml Ledger API | `cantonnet-omnichain-sdk/research/04-daml-ledger-api.md` | Сервисы, proto, стримы |
| gRPC/Protobuf в Rust | `cantonnet-omnichain-sdk/research/05-grpc-protobuf-rust.md` | Tonic/Prost, транспорт |
| Крипто | `cantonnet-omnichain-sdk/research/06-cryptographic-requirements.md` | Ключи, подпись, HSM, zeroize |
| Production-паттерны | `cantonnet-omnichain-sdk/research/07-production-ready-patterns.md` | Надёжность, наблюдаемость |

**По документам оценить:**
- Соответствие Canton/Daml Ledger API v2 и типичным сценариям OTC/wealth.
- Зрелость OmniChain-модели (Bridge, Adapter, Router, proof/state sync) относительно индустрии (IBC, LayerZero, CCIP, ZK-bridges и т.п.).
- Степень «передовости»: Rust 2024, Tonic/Prost, Tokio, circuit breaker/rate limit/retry, OpenTelemetry, HSM, feature flags.
- Реалистичность: можно ли по этой спецификации реально собрать production-SDK без больших переработок.
- Пробелы документации: что не описано, но критично (например, онбординг, upgrade, multi-tenant, regulatory).

### 1.3 Дополнительный контекст проекта

**По возможности просмотреть:**
- `docs/PRD_CANTON_DEFI_2026/` — продуктовые и архитектурные решения.
- `docs/reports/ARCHITECTURE_ANALYSIS.md`, `docs/reports/PRODUCTION_READINESS_AUDIT.md`, `docs/reports/DEX_PRODUCTION_READINESS_AUDIT.md` — существующие оценки.
- `docs/analysis/` — аналитические заметки по архитектуре и решениям.
- `contracts/CantonBridge.sol` — связь с EVM, если используется в OmniChain-сценариях.
- `README.md`, `docs/README.md` — заявленные цели и стек.

---

## 2. Критерии оценки

### 2.1 Текущий стек (canton-otc)

Оценить по шкале 1–5 (1 — слабо, 5 — образцово) и кратко обосновать:

| Критерий | Оценка (1–5) | Краткое обоснование |
|----------|--------------|----------------------|
| Актуальность и уместность технологий | | |
| Связность UI → API → Canton/Daml → БД | | |
| Готовность к enterprise (resilience, observability, security) | | |
| Качество абстракций (сервисы, хуки, типы) | | |
| Соответствие заявленным целям (OTC, wealth, multichain) | | |

Плюс:
- **Сильные стороны стека** (3–5 пунктов).
- **Слабые стороны и риски** (3–5 пунктов).
- **Рекомендации по эволюции стека** (конкретные технологии или паттерны, без воды).

### 2.2 Предлагаемая реализация (документы cantonnet-omnichain-sdk)

Оценить по шкале 1–5 и обосновать:

| Критерий | Оценка (1–5) | Краткое обоснование |
|----------|--------------|----------------------|
| Соответствие Canton/Daml best practices и Ledger API v2 | | |
| Передовость выбора технологий (Rust, Tokio, Tonic, observability) | | |
| Зрелость OmniChain-архитектуры относительно индустрии | | |
| Полнота и применимость production-требований | | |
| Реалистичность воплощения в срок и с разумными ресурсами | | |

Плюс:
- **Что уже на уровне/выше индустрии** (конкретные решения из документов).
- **Что отстаёт или противоречит трендам 2024–2026** (с примерами из доков).
- **Критичные пробелы в документации** (без чего «передовая» реализация не будет по-настоящему production-ready).

### 2.3 Сравнение «как есть» vs «как в документах»

Кратко ответить:

- Где **текущий стек и документы согласованы** (одни и те же концепции, разный лишь язык/платформа)?
- Где **документы задают уровень выше текущего кода** (и что именно стоит перенести в первую очередь)?
- Есть ли **конфликты** (документы предполагают одно, код делает другое; как лучше выровнять)?
- Имеет ли смысл **параллельный Rust SDK** по cantonnet-omnichain-sdk при сохранении TypeScript/Next.js для UI, или документы скорее задают целевой «образ» архитектуры, который можно постепенно воплощать в текущем стеке?

---

## 3. Итоговые выводы

### 3.1 Один абзац: насколько хорош наш стек

Формулировка в духе: «Стек в целом … (сильные стороны). Главные ограничения … . Для заявленных целей он … . Приоритетные улучшения: … .»

### 3.2 Один абзац: насколько передовая и прогрессивная предлагаемая реализация

Формулировка в духе: «Описание в cantonnet-omnichain-sdk по … приближается к индустриальному уровню 2024–2026, по … опережает типичные проекты. Существенные пробелы: … . Чтобы считать реализацию действительно передовой, нужно … .»

### 3.3 Три приоритетных действия

1. **По стеку:** одно конкретное действие (технология, паттерн, рефакторинг).
2. **По документации/архитектуре:** одно конкретное действие (дописать, изменить, упростить).
3. **По связи код ↔ документы:** одно действие (как синхронизировать, что перенести из доков в код первым делом).

---

## 4. Ограничения и правила для исполнителя

- Опираться **только на реально прочитанные файлы** перечисленных путей. Если файл недоступен — явно указать «не анализировался».
- Не приписывать проекту технологии или решения, которых нет в коде или в указанных документах.
- Избегать общих фраз; каждое утверждение подкреплять отсылкой к файлу/фрагменту или к общедоступной практике/документации.
- Отделять **факт** (что есть в коде/доках) от **оценки** (насколько это хорошо/передово) и от **рекомендаций** (что делать дальше).
- Если по какому-то критерию данных недостаточно — написать «недостаточно данных» и перечислить, какие артефакты нужно добавить в анализ.

---

## 5. Формат ответа

Исполнитель должен выдать структурированный отчёт, в котором есть все секции из пунктов 2 и 3, плюс при необходимости краткий «Перечень проанализированных артефактов» в начале. Объём: ориентировочно 2–4 страницы текста (без списка файлов), без лишней воды.

---

**Версия промпта:** 1.0  
**Дата:** 2026-01-28  
**Проект:** canton-otc / Canton OmniChain SDK (cantonnet-omnichain-sdk)
