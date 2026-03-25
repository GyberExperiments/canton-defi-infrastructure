# CANTON OTC — ПОЛНАЯ РЕОРГАНИЗАЦИЯ ПРОЕКТА

## КОНТЕКСТ

Проект Canton OTC — DeFi OTC платформа на Canton Network. За время активной разработки накопился значительный технический долг в структуре файлов:
- **29 markdown-файлов** в корне проекта (434 KB) — промты, отчёты, гайды
- **400+ файлов документации** в /docs/ без чёткой иерархии
- **Секреты и сессии** в git (.env.production, .telegram-session)
- **Build-артефакты** в репозитории (логи, кеши, .DS_Store)
- **Пустые директории** и дубликаты
- **README.md в корне** — оказался README от lazygit, а не от проекта

Цель: превратить хаос в чистый, навигируемый проект, где любой разработчик мгновенно находит нужное.

---

## ФАЗА 1: УДАЛЕНИЕ МУСОРА И СЕКРЕТОВ (КРИТИЧНО)

### 1.1 Удалить build-артефакты и кеши

```bash
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc

# Build logs
git rm -f docker-build.log build-errors.log build.log deploy-fix.log 2>/dev/null

# TypeScript build cache
git rm -f tsconfig.tsbuildinfo 2>/dev/null

# macOS system files
git rm -f .DS_Store 2>/dev/null
find . -name '.DS_Store' -not -path './node_modules/*' -delete

# VSCode workspace file
git rm -f canton-otc.code-workspace 2>/dev/null

# next-env.d.ts (auto-generated)
git rm -f next-env.d.ts 2>/dev/null
```

### 1.2 Удалить секреты из git-истории (БЕЗОПАСНОСТЬ)

**ВАЖНО:** Эти файлы содержат credentials и НЕ ДОЛЖНЫ быть в репозитории.

```bash
# Удалить env-файлы с секретами
git rm -f .env.local .env.clean .env.fixed .env.production .env.production.backup 2>/dev/null

# Удалить session token
git rm -f .telegram-session 2>/dev/null
```

Оставить ТОЛЬКО:
- `.env.example` — шаблон без реальных значений
- `env.template` — расширенный шаблон (проверить что нет реальных ключей, если есть — вычистить)

### 1.3 Удалить пустые директории

```bash
rm -rf data/
rm -rf backup/20260115_230402/
rm -rf blockchain/logs/
rm -rf ~/  # тильда-директория (артефакт)
```

### 1.4 Обновить .gitignore

Открыть `.gitignore` и ДОБАВИТЬ в конец следующие строки (если их ещё нет):

```gitignore
# === Build caches ===
tsconfig.tsbuildinfo
next-env.d.ts

# === IDE/Editor ===
*.code-workspace
.claude/
.cursor/
.playwright-mcp/

# === Secrets (extra protection) ===
.env.local
.env.production
.env.production.backup
.env.clean
.env.fixed
.telegram-session

# === Build logs ===
docker-build.log
build-errors.log
build.log
deploy-fix.log

# === macOS ===
**/.DS_Store
```

---

## ФАЗА 2: СОЗДАНИЕ СТРУКТУРЫ ДОКУМЕНТАЦИИ

### 2.1 Целевая структура `/docs/`

```
docs/
├── README.md                          # Навигационный INDEX всей документации
├── architecture/                      # Архитектура системы
│   ├── README.md                      # Обзор архитектуры
│   ├── system-overview.md             # Из docs/analysis/
│   ├── daml-contracts.md              # Спецификация DAML контрактов
│   ├── rust-api.md                    # Архитектура Rust API
│   ├── frontend.md                    # Next.js архитектура
│   └── infrastructure.md              # K8s, DevNet, ноды
│
├── guides/                            # Практические гайды (HOW-TO)
│   ├── README.md                      # Индекс гайдов
│   ├── quick-start.md                 # Быстрый старт для нового разработчика
│   ├── local-development.md           # Локальная разработка (Docker Compose)
│   ├── deployment.md                  # Деплой на production/DevNet
│   ├── canton-sandbox.md              # Локальный Canton Sandbox
│   ├── daml-integration.md            # DAML интеграция
│   └── testing.md                     # Тестирование (unit, integration, e2e)
│
├── api/                               # API Reference
│   ├── README.md
│   ├── rest-api.md                    # Rust REST API endpoints
│   ├── create-order.md                # OTC order creation flow
│   └── health-checks.md              # Health и monitoring endpoints
│
├── security/                          # Безопасность (консолидировано)
│   ├── README.md
│   ├── audit-report.md                # Сводный аудит безопасности
│   └── compliance.md                  # KYC/AML compliance
│
├── prd/                               # Product Requirements (из PRD_CANTON_DEFI_2026)
│   └── ... (оставить как есть, только переименовать папку)
│
├── changelog/                         # История изменений
│   ├── README.md
│   ├── daml-integration.md            # Из CHANGELOG_DAML_INTEGRATION.md
│   └── platform-releases.md           # Релизы платформы
│
├── reports/                           # Отчёты о статусе (исторические)
│   ├── README.md
│   ├── phase-1-completion.md
│   ├── devnet-deployment.md
│   ├── canton-api-server.md
│   └── critical-fixes.md
│
├── troubleshooting/                   # Проблемы и решения
│   ├── README.md
│   └── ... (консолидировать из docs/troubleshooting/ и docs/fix-reports/)
│
└── archive/                           # Устаревшие документы (НЕ УДАЛЯТЬ, архивировать)
    ├── README.md                      # "Эти документы устарели, хранятся для истории"
    ├── prompts/                       # Все AI-промты (историческая ценность)
    │   ├── README.md                  # Индекс промтов с описанием каждого
    │   ├── ultimate-fix-prompt.md     # CANTON_OTC_ULTIMATE_FIX_PROMPT.md
    │   ├── comprehensive-audit.md     # COMPREHENSIVE_OTC_AUDIT_PROMPT.md
    │   ├── full-audit-fix.md          # CANTON_OTC_FULL_AUDIT_AND_FIX_PROMPT.md
    │   ├── rust-sdk-integration.md    # INTEGRATE_RUST_SDK_PROMPT.md
    │   ├── frontend-upgrade.md        # FRONTEND_ARCHITECTURE_UPGRADE_PROMPT.md
    │   ├── devnet-deployment.md       # DEVNET_DEPLOYMENT_PROMPT.md
    │   ├── domain-connection.md       # CANTON_DOMAIN_CONNECTION_MASTER_PROMPT.md
    │   ├── synchronizer-connection.md # CANTON_SYNCHRONIZER_CONNECTION_PROMPT.md
    │   ├── fix-unit-tests.md          # FIX_UNIT_TESTS_PROMPT.md
    │   └── ... (все остальные промты из docs/prompts/)
    │
    ├── battle-tests/                  # Battle-test серия (5 частей)
    │   ├── README.md
    │   ├── part1-overview.md
    │   ├── part2-rust-api.md
    │   ├── part3-typescript.md
    │   ├── part4-local-sandbox.md
    │   └── part5-e2e-testing.md
    │
    ├── fix-reports/                   # Из docs/fix-reports/ (45 файлов)
    │   └── ...
    │
    └── old-docs/                      # Всё остальное устаревшее
        └── ...
```

### 2.2 Переместить файлы из корня

Выполнить следующие команды. Каждая команда — одно перемещение. Выполнять ПОСЛЕДОВАТЕЛЬНО.

```bash
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc

# Создать целевые директории
mkdir -p docs/archive/prompts
mkdir -p docs/archive/battle-tests
mkdir -p docs/archive/reports
mkdir -p docs/changelog
mkdir -p docs/reports

# --- ПРОМТЫ → docs/archive/prompts/ ---
git mv CANTON_OTC_ULTIMATE_FIX_PROMPT.md docs/archive/prompts/ultimate-fix-prompt.md
git mv COMPREHENSIVE_OTC_AUDIT_PROMPT.md docs/archive/prompts/comprehensive-audit.md
git mv CANTON_OTC_FULL_AUDIT_AND_FIX_PROMPT.md docs/archive/prompts/full-audit-fix.md
git mv INTEGRATE_RUST_SDK_PROMPT.md docs/archive/prompts/rust-sdk-integration.md
git mv FRONTEND_ARCHITECTURE_UPGRADE_PROMPT.md docs/archive/prompts/frontend-upgrade.md
git mv DEVNET_DEPLOYMENT_PROMPT.md docs/archive/prompts/devnet-deployment.md
git mv CANTON_DOMAIN_CONNECTION_MASTER_PROMPT.md docs/archive/prompts/domain-connection.md
git mv CANTON_SYNCHRONIZER_CONNECTION_PROMPT.md docs/archive/prompts/synchronizer-connection.md
git mv FIX_UNIT_TESTS_PROMPT.md docs/archive/prompts/fix-unit-tests.md
git mv PROMPT_TO_EXECUTE.txt docs/archive/prompts/prompt-to-execute.txt

# --- BATTLE-TESTS → docs/archive/battle-tests/ ---
git mv BATTLE_TEST_PART1_OVERVIEW.md docs/archive/battle-tests/part1-overview.md
git mv BATTLE_TEST_PART2_RUST_API_FIX.md docs/archive/battle-tests/part2-rust-api.md
git mv BATTLE_TEST_PART3_TYPESCRIPT_FIX.md docs/archive/battle-tests/part3-typescript.md
git mv BATTLE_TEST_PART4_LOCAL_SANDBOX.md docs/archive/battle-tests/part4-local-sandbox.md
git mv BATTLE_TEST_PART5_E2E_TESTING.md docs/archive/battle-tests/part5-e2e-testing.md

# --- ОТЧЁТЫ → docs/reports/ ---
git mv DEPLOYMENT_SUCCESS_REPORT.md docs/reports/deployment-success.md
git mv DEVNET_SUCCESS_REPORT.md docs/reports/devnet-success.md
git mv CANTON_API_SERVER_DEPLOYMENT_SUMMARY.md docs/reports/canton-api-server.md
git mv CRITICAL_FIXES_SUMMARY.md docs/reports/critical-fixes.md
git mv DAML_INTEGRATION_SUMMARY.md docs/reports/daml-integration.md
git mv PHASE_1_COMPLETION_SUMMARY.md docs/reports/phase-1-completion.md
git mv SECURITY_AUDIT_REPORT.md docs/reports/security-audit.md

# --- ГАЙДЫ → docs/guides/ ---
git mv CANTON_DAML_INTEGRATION_GUIDE.md docs/guides/daml-integration.md
git mv DEPLOY_CANTON_API_SERVER.md docs/guides/deploy-canton-api.md
git mv QUICK_DEPLOY_GUIDE.md docs/guides/quick-deploy.md

# --- CHANGELOG → docs/changelog/ ---
git mv CHANGELOG_DAML_INTEGRATION.md docs/changelog/daml-integration.md

# --- ПРОЧИЕ → docs/ ---
git mv NEXT_STEPS.md docs/NEXT_STEPS.md
git mv LAZYGIT_SETUP.md docs/archive/lazygit-setup.md
git mv SCHEMA_DTS_SETUP.md docs/archive/schema-dts-setup.md
git mv SUPPORT_EMAIL_TEMPLATE.txt docs/archive/support-email-template.txt
```

### 2.3 Проверить env.template

Открыть `env.template` и убедиться что в нём НЕТ реальных API ключей, паролей, токенов. Если есть — заменить на плейсхолдеры:

```
# Пример правильного формата:
CANTON_AUTH_TOKEN=your-auth-token-here
SUPABASE_SERVICE_ROLE_KEY=your-supabase-key-here
TELEGRAM_BOT_TOKEN=your-telegram-bot-token-here
```

---

## ФАЗА 3: НАПИСАТЬ НОВЫЙ README.md

**ВАЖНО:** Текущий README.md в корне — это README от lazygit (33 KB), а НЕ от проекта Canton OTC. Нужно написать настоящий README.

Заменить содержимое `README.md` следующим:

```markdown
# Canton OTC Platform

Decentralized OTC trading platform on [Canton Network](https://canton.network) with DAML smart contracts, cross-chain settlement, and institutional-grade compliance.

**Production:** [1otc.cc](https://1otc.cc)

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Next.js Frontend                │
│              (App Router, React 19)              │
├─────────────────────────────────────────────────┤
│              Next.js API Routes                  │
│         /api/create-order, /api/daml/*           │
├──────────────────┬──────────────────────────────┤
│   Rust Canton    │      Canton Sandbox          │
│   API Server     │   (DAML Ledger API v2)       │
│   (Axum + Tonic) │                              │
├──────────────────┴──────────────────────────────┤
│            Canton Network (DevNet)               │
│         DAML Smart Contracts (DAR)               │
│  OtcOffer · Escrow · Collateral · Settlement     │
└─────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 20+ / pnpm
- Rust 1.75+ (for Canton API Server)
- Docker & Docker Compose (for local Canton Sandbox)
- DAML SDK 2.9.0 (for contract compilation)

### Local Development

```bash
# Install dependencies
pnpm install

# Start Next.js dev server
pnpm dev

# Start Canton Sandbox + DAML deploy + Rust API (requires Docker)
docker compose -f docker-compose.local-test.yml up
```

### Environment

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Key variables:
- `CANTON_PARTICIPANT_URL` — Canton Ledger API endpoint
- `CANTON_PARTY_ID` — Your party on the Canton Network
- `CANTON_API_SERVER_URL` — Rust API server URL
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase for order storage (optional)

## Project Structure

```
canton-otc/
├── src/                          # Next.js application
│   ├── app/                      # App Router pages & API routes
│   ├── components/               # React components
│   ├── lib/                      # Services, hooks, utilities
│   │   └── canton/               # Canton integration layer
│   └── config/                   # Application configuration
├── canton/
│   └── daml/                     # DAML smart contracts
│       ├── OtcOffer.daml         # Main OTC offer template
│       ├── OtcTypes.daml         # Shared types (Asset, Price, etc.)
│       ├── Escrow.daml           # Escrow management
│       ├── Collateral.daml       # Collateral handling
│       └── Settlement.daml       # Settlement lifecycle
├── cantonnet-omnichain-sdk/      # Rust SDK (git submodule)
│   └── crates/canton-otc-api/    # Axum REST API + gRPC Canton client
├── daml/                         # DAML build config (daml.yaml)
├── k8s/                          # Kubernetes manifests
├── local-test/                   # Local sandbox config & scripts
├── docker-compose.local-test.yml # Local test environment
└── docs/                         # Documentation (see docs/README.md)
```

## DAML Smart Contracts

Five interconnected templates implementing the OTC trading lifecycle:

| Template | Purpose |
|----------|---------|
| **OtcOffer** | Main offer with Accept, Cancel, Expire, Settle, Dispute choices |
| **OtcTypes** | Shared types: Asset, Price, VolumeLimits, Timestamps, CollateralStatus |
| **Escrow** | Two-party escrow with arbitration |
| **Collateral** | Collateral locking, release, and forfeiture |
| **Settlement** | Payment verification and dispute resolution |

Build and deploy:

```bash
cd daml && daml build
# Upload to Canton participant:
daml ledger upload-dar .daml/dist/canton-otc-1.0.0.dar --host HOST --port PORT
```

## Rust API Server

REST API bridging Next.js frontend to Canton Ledger API v2 (gRPC):

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check with ledger connectivity |
| `/api/v1/contracts/offer` | POST | Create OtcOffer contract |
| `/api/v1/contracts/:id` | GET | Get contract by ID |
| `/api/v1/contracts/:id/accept` | POST | Accept offer (exercise Accept choice) |
| `/api/v1/contracts/:id/cancel` | POST | Cancel offer (exercise Cancel choice) |

## Deployment

See [docs/guides/quick-deploy.md](docs/guides/quick-deploy.md) for production deployment.

## Documentation

Full documentation index: [docs/README.md](docs/README.md)

## License

See [LICENSE](LICENSE).
```

---

## ФАЗА 4: СОЗДАТЬ ИНДЕКС ДОКУМЕНТАЦИИ docs/README.md

Заменить содержимое `docs/README.md`:

```markdown
# Canton OTC — Documentation Index

## For New Developers
- **[Quick Start](guides/quick-start.md)** — Setup and run locally
- **[Local Development](guides/local-development.md)** — Docker Compose sandbox
- **[Project Architecture](architecture/README.md)** — How everything fits together

## Guides
- [DAML Integration](guides/daml-integration.md) — Working with DAML contracts
- [Canton Sandbox](guides/canton-sandbox.md) — Local sandbox for testing
- [Deploy Canton API](guides/deploy-canton-api.md) — Rust API server deployment
- [Quick Deploy](guides/quick-deploy.md) — Production deployment checklist
- [Testing](guides/testing.md) — Unit, integration, and E2E tests

## API Reference
- [REST API](api/rest-api.md) — Rust API endpoints
- [Order Creation Flow](api/create-order.md) — OTC order lifecycle

## Security
- [Security Audit](security/audit-report.md) — Latest security findings
- [Compliance](security/compliance.md) — KYC/AML requirements

## Product
- [PRD Canton DeFi 2026](prd/) — Product requirements document
- [Next Steps](NEXT_STEPS.md) — Current roadmap

## Changelog
- [DAML Integration](changelog/daml-integration.md) — Contract changes

## Reports (Historical)
- [Phase 1 Completion](reports/phase-1-completion.md)
- [Critical Fixes](reports/critical-fixes.md)
- [DevNet Deployment](reports/devnet-success.md)
- [Canton API Server](reports/canton-api-server.md)

## Archive
Development prompts, battle-tests, and historical documents are in [archive/](archive/).
```

---

## ФАЗА 5: СОЗДАТЬ README ДЛЯ АРХИВА ПРОМТОВ

Создать файл `docs/archive/prompts/README.md`:

```markdown
# Development Prompts Archive

AI-generated prompts used during Canton OTC development. These are historical artifacts — the fixes they describe have already been applied.

## Master Prompts (Comprehensive)
| File | Size | Description |
|------|------|-------------|
| [ultimate-fix-prompt.md](ultimate-fix-prompt.md) | 92 KB | 9-phase execution plan with 149 findings (P0-P3) |
| [comprehensive-audit.md](comprehensive-audit.md) | 25 KB | Security & architecture audit |
| [full-audit-fix.md](full-audit-fix.md) | 24 KB | Full-stack audit with line-number references |

## Integration Prompts
| File | Description |
|------|-------------|
| [rust-sdk-integration.md](rust-sdk-integration.md) | Rust SDK + Next.js integration |
| [frontend-upgrade.md](frontend-upgrade.md) | React component refactoring |
| [devnet-deployment.md](devnet-deployment.md) | Canton DevNet deployment |
| [domain-connection.md](domain-connection.md) | Participant-to-Synchronizer connectivity |
| [synchronizer-connection.md](synchronizer-connection.md) | Synchronizer architecture research |
| [fix-unit-tests.md](fix-unit-tests.md) | Vitest unit test implementation |
```

---

## ФАЗА 6: КОНСОЛИДАЦИЯ СУЩЕСТВУЮЩИХ /docs/ ПОДДИРЕКТОРИЙ

### 6.1 Переименовать PRD

```bash
# Если нужно привести к единому стилю (lowercase)
git mv docs/PRD_CANTON_DEFI_2026 docs/prd 2>/dev/null || true
```

### 6.2 Объединить дублирующие директории

```bash
# fix-reports и fixes → archive/fix-reports
mkdir -p docs/archive/fix-reports
git mv docs/fix-reports/* docs/archive/fix-reports/ 2>/dev/null || true
git mv docs/fixes/* docs/archive/fix-reports/ 2>/dev/null || true
rmdir docs/fix-reports docs/fixes 2>/dev/null || true

# prompts и prompts-front → archive/prompts
git mv docs/prompts/* docs/archive/prompts/ 2>/dev/null || true
git mv docs/prompts-front/* docs/archive/prompts/ 2>/dev/null || true
rmdir docs/prompts docs/prompts-front 2>/dev/null || true

# Переименовать analysis → architecture (объединить)
mkdir -p docs/architecture
git mv docs/analysis/* docs/architecture/ 2>/dev/null || true
rmdir docs/analysis 2>/dev/null || true

# deployment → guides (объединить)
git mv docs/deployment/* docs/guides/ 2>/dev/null || true
rmdir docs/deployment 2>/dev/null || true

# setup → guides (объединить)
git mv docs/setup/* docs/guides/ 2>/dev/null || true
rmdir docs/setup 2>/dev/null || true

# testing → guides/testing/ или оставить
mkdir -p docs/guides/testing
git mv docs/testing/* docs/guides/testing/ 2>/dev/null || true
rmdir docs/testing 2>/dev/null || true

# features → archive (исторические)
mkdir -p docs/archive/features
git mv docs/features/* docs/archive/features/ 2>/dev/null || true
rmdir docs/features 2>/dev/null || true

# migrations → archive
mkdir -p docs/archive/migrations
git mv docs/migrations/* docs/archive/migrations/ 2>/dev/null || true
rmdir docs/migrations 2>/dev/null || true

# research остаётся (полезная документация)
```

### 6.3 Убрать ненужные docs из корня docs/

Все файлы из верхнего уровня `/docs/` (25 файлов) которые не являются README.md или NEXT_STEPS.md — переместить в подходящие поддиректории:

```bash
# Промты
git mv docs/AGENT_DAML_SMART_CONTRACT_ANALYST_PROMPT.md docs/archive/prompts/ 2>/dev/null
git mv docs/CURSOR_PROMPT_RU.md docs/archive/prompts/ 2>/dev/null
git mv docs/DESIGN_AUDIT_AND_IMPROVEMENT_PROMPT.md docs/archive/prompts/ 2>/dev/null
git mv docs/DEVOPS_CI_CD_AUDIT_PROMPT.md docs/archive/prompts/ 2>/dev/null
git mv docs/NEAR_INTENTS_CREDENTIALS_AUDIT_PROMPT.md docs/archive/prompts/ 2>/dev/null

# Аудиты и отчёты
git mv docs/DAML_AUDIT_REPORT_AND_PRODUCTION_PLAN.md docs/reports/ 2>/dev/null
git mv docs/DESIGN_AUDIT_RESULTS.md docs/reports/ 2>/dev/null
git mv docs/PHASE2_IMPLEMENTATION_STATUS.md docs/reports/ 2>/dev/null

# SDK briefs → architecture
git mv docs/CANTON_OMNICHAIN_SDK_BRIEF_EXTENDED.md docs/architecture/ 2>/dev/null
git mv docs/CANTON_OMNICHAIN_SDK_BRIEF_EXTERNAL.md docs/architecture/ 2>/dev/null
git mv docs/LONG_TERM_SOLUTION_ARCHITECTURE.md docs/architecture/ 2>/dev/null
git mv docs/DESIGN_SYSTEM.md docs/architecture/ 2>/dev/null

# NEAR Intents → отдельная тема
mkdir -p docs/integrations/near-intents
git mv docs/NEAR_INTENTS_*.md docs/integrations/near-intents/ 2>/dev/null
git mv docs/SOLVER_SYSTEM_*.md docs/integrations/near-intents/ 2>/dev/null

# DEX docs → integrations
mkdir -p docs/integrations/dex
git mv docs/DEX_*.md docs/integrations/dex/ 2>/dev/null

# CSS fix → archive
git mv docs/CSS_DUPLICATE_LOADING_FIX.md docs/archive/ 2>/dev/null

# Gybernaty brief → archive
git mv docs/GYBERNATY_SERVICES_BRIEF.md docs/archive/ 2>/dev/null
```

---

## ФАЗА 7: ЧИСТКА КОРНЯ — ФИНАЛЬНАЯ ПРОВЕРКА

### 7.1 Целевой список файлов в корне после очистки

После выполнения всех фаз, в КОРНЕ проекта должны остаться ТОЛЬКО:

```
canton-otc/
├── .dockerignore
├── .env.example                    # Шаблон env без секретов
├── .gitignore                      # Обновлённый
├── .gitmodules                     # Submodule config
├── .secrets.example                # Шаблон секретов
├── Dockerfile                      # Docker image
├── LICENSE                         # Лицензия
├── README.md                       # НОВЫЙ README (из Фазы 3)
├── docker-compose.local-test.yml   # Локальное тестирование
├── docker-compose.local.example.yml # Шаблон
├── env.template                    # Расширенный шаблон (без секретов!)
├── eslint.config.mjs               # ESLint
├── middleware.ts                    # Next.js middleware
├── next.config.js                  # Next.js config
├── package.json                    # Dependencies
├── playwright.config.ts            # E2E tests
├── pnpm-lock.yaml                  # Lock file
├── postcss.config.mjs              # PostCSS
├── tailwind.config.ts              # Tailwind
├── tsconfig.json                   # TypeScript
├── vitest.config.ts                # Unit tests
│
│ # Скрипты (в отдельную папку или оставить)
├── scripts/                        # ← ПЕРЕМЕСТИТЬ СЮДА:
│   ├── build-and-deploy-stub.sh
│   ├── deploy-canton-api-server.sh
│   ├── deploy-to-main.sh
│   ├── QUICK_DEPLOY_COMMANDS.sh
│   ├── test-all-endpoints.mjs
│   ├── test-create-order.sh
│   └── activate_lazygit.sh
│
│ # Директории
├── src/                            # Next.js application
├── canton/                         # DAML contracts
├── cantonnet-omnichain-sdk/        # Rust SDK (submodule)
├── config/                         # K8s and cluster config
├── daml/                           # DAML build config
├── docs/                           # Вся документация
├── k8s/                            # K8s manifests
├── local-test/                     # Local sandbox config
├── public/                         # Static assets
└── blockchain/                     # Blockchain configs
```

### 7.2 Перенести скрипты из корня

```bash
mkdir -p scripts
git mv build-and-deploy-stub.sh scripts/
git mv deploy-canton-api-server.sh scripts/
git mv deploy-to-main.sh scripts/
git mv QUICK_DEPLOY_COMMANDS.sh scripts/
git mv test-all-endpoints.mjs scripts/
git mv test-create-order.sh scripts/
git mv activate_lazygit.sh scripts/
```

### 7.3 Удалить лишний vitest config (если дубликат)

```bash
# Проверить — если vitest.integration.config.ts не используется в package.json, удалить
grep -q "vitest.integration" package.json || git rm -f vitest.integration.config.ts
```

---

## ФАЗА 8: КОММИТ И ВЕРИФИКАЦИЯ

### 8.1 Проверить что ничего не сломано

```bash
# Проверить что Next.js собирается
pnpm build

# Проверить что Rust компилируется
cd cantonnet-omnichain-sdk && cargo check --package canton-otc-api && cd ..

# Проверить что нет сломанных импортов
grep -r "BATTLE_TEST\|CANTON_OTC_ULTIMATE\|COMPREHENSIVE_OTC" src/ --include="*.ts" --include="*.tsx"
# Ожидаемый результат: пусто (нигде не импортируются md файлы)
```

### 8.2 Проверить что секретов нет в git

```bash
# Поискать потенциальные секреты в оставшихся файлах
grep -rn "sk-\|eyJ\|ghp_\|xoxb-\|AKIA" \
  .env.example env.template .secrets.example \
  --include="*.example" --include="*.template" 2>/dev/null
# Ожидаемый результат: пусто
```

### 8.3 Коммит

```bash
git add -A
git status  # Просмотреть что изменилось

git commit -m "refactor: reorganize project structure and documentation

- Move 29 root-level markdown files to docs/ subdirectories
- Archive development prompts to docs/archive/prompts/
- Archive battle-test series to docs/archive/battle-tests/
- Move reports to docs/reports/
- Move guides to docs/guides/
- Consolidate duplicate docs directories (fix-reports, fixes, deployment, setup)
- Move shell scripts to scripts/
- Remove build artifacts (logs, tsconfig.tsbuildinfo, .DS_Store)
- Remove committed secrets (.env.production, .telegram-session)
- Update .gitignore with comprehensive exclusion rules
- Write new README.md with actual project documentation
- Create docs/README.md navigation index
- Clean project root to essential files only"
```

---

## ФАЗА 9: ПРОПУЩЕННЫЕ ДИРЕКТОРИИ И ФАЙЛЫ (ДОПОЛНЕНИЕ)

Анализ выявил директории и файлы, которые НЕ были в исходном промте.

### 9.1 Удалить артефактные и мусорные директории

```bash
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc

# Тильда-директория (артефакт — случайно создана, содержит github-secrets-admin-manager)
rm -rf '~'

# Пустая директория data/
rm -rf data/

# .playwright-mcp/ — 3.8 MB скриншотов (НЕ нужны в git)
git rm -rf .playwright-mcp/ 2>/dev/null

# .shared/ — UI/UX данные, не используются в коде
# ПРОВЕРИТЬ: если не импортируется нигде → удалить
grep -r ".shared" src/ --include="*.ts" --include="*.tsx" -l 2>/dev/null || git rm -rf .shared/ 2>/dev/null

# canton-api-server-stub/ — заглушка, заменена реальным Rust API
# ПРОВЕРИТЬ: используется ли в docker-compose или CI
grep -r "canton-api-server-stub" . --include="*.yml" --include="*.yaml" --include="*.sh" -l 2>/dev/null
# Если не используется:
git rm -rf canton-api-server-stub/ 2>/dev/null

# design-system/ — одиночный файл MASTER.md → перенести в docs
mkdir -p docs/architecture
git mv design-system/MASTER.md docs/architecture/design-system.md 2>/dev/null
rmdir design-system/ 2>/dev/null

# KIKIMORA/ — одиночный файл CANTON_PRODUCTS.md → перенести в docs
git mv KIKIMORA/CANTON_PRODUCTS.md docs/architecture/canton-products.md 2>/dev/null
rmdir KIKIMORA/ 2>/dev/null

# plans/ — одиночный файл 96KB план → перенести в docs
git mv plans/CANTON_OTC_INTEGRATION_ARCHITECTURE_PLAN.md docs/architecture/integration-plan.md 2>/dev/null
rmdir plans/ 2>/dev/null
```

### 9.2 backup/ — K8s configmaps backup

```bash
# backup/ содержит K8s configmaps дамп (20260115_230439/)
# Это НЕ нужно в git — это инфраструктурный бекап
# Проверить есть ли пустой backup/20260115_230402/ тоже
git rm -rf backup/ 2>/dev/null
```

Добавить в `.gitignore`:
```gitignore
# K8s backups
backup/
```

### 9.3 contracts/ — Solidity контракт

```bash
# contracts/CantonBridge.sol — единственный Solidity файл
# Если используется → оставить
# Если это прототип/черновик → перенести в archive
grep -r "CantonBridge" src/ --include="*.ts" --include="*.tsx" -l 2>/dev/null
# Если не используется:
mkdir -p docs/archive/contracts
git mv contracts/CantonBridge.sol docs/archive/contracts/CantonBridge.sol 2>/dev/null
rmdir contracts/ 2>/dev/null
```

### 9.4 .github/workflows — проверить актуальность

```bash
# Есть 7 workflow файлов. Проверить что все актуальны:
ls .github/workflows/
# deploy-ci.yml
# build-canton-api-server.yml
# test.yml
# simple-deploy.yml
# build-canton-node.yml
# deploy.yml
# deploy-minimal-stage.yml
#
# Если deploy.yml и deploy-ci.yml дублируются — удалить один
# Если simple-deploy.yml устарел — удалить
```

### 9.5 scripts/ — МАССИВНАЯ директория (82 файла!)

Директория `scripts/` уже существует и содержит **82 файла**, включая:
- ~10 вариантов cleanup скриптов (cleanup-*.sh, radical-cleanup-*.sh)
- ~8 вариантов delete-pending-*.sh
- ~12 test-*.sh скриптов
- Множество fix-*.sh скриптов
- README файлы (6 штук в scripts/)

**НЕ ПЕРЕНОСИТЬ shell-скрипты из корня в scripts/** — там уже хаос.

Вместо этого — организовать scripts/:

```bash
cd scripts/

# Создать поддиректории
mkdir -p k8s-ops    # Kubernetes операции
mkdir -p testing    # Тестовые скрипты
mkdir -p deployment # Деплой скрипты
mkdir -p security   # Security скрипты
mkdir -p archive    # Устаревшие скрипты

# K8s операции
git mv cleanup-*.sh k8s-ops/ 2>/dev/null
git mv delete-pending-*.sh k8s-ops/ 2>/dev/null
git mv radical-cleanup-*.sh k8s-ops/ 2>/dev/null
git mv fix-kubernetes-*.sh k8s-ops/ 2>/dev/null
git mv fix-cluster-*.sh k8s-ops/ 2>/dev/null
git mv fix-maximus-*.sh k8s-ops/ 2>/dev/null
git mv fix-node-*.sh k8s-ops/ 2>/dev/null
git mv fix-ingress-*.sh k8s-ops/ 2>/dev/null
git mv fix-iptables-*.sh k8s-ops/ 2>/dev/null
git mv cluster-recovery-*.sh k8s-ops/ 2>/dev/null
git mv complete-cluster-recovery.sh k8s-ops/ 2>/dev/null
git mv diagnose-cluster*.sh k8s-ops/ 2>/dev/null
git mv analyze-control-plane-load.sh k8s-ops/ 2>/dev/null
git mv check-minimal-stage-status.sh k8s-ops/ 2>/dev/null
git mv check-sites-availability.sh k8s-ops/ 2>/dev/null
git mv verify-all-sites.sh k8s-ops/ 2>/dev/null
git mv update-configmap-prices.sh k8s-ops/ 2>/dev/null

# Тестирование
git mv test-*.sh testing/ 2>/dev/null
git mv test-*.js testing/ 2>/dev/null
git mv comprehensive-system-test.sh testing/ 2>/dev/null
git mv full-system-test.sh testing/ 2>/dev/null
git mv quick-test-order.sh testing/ 2>/dev/null
git mv simple-address-test.js testing/ 2>/dev/null

# Деплой
git mv deploy-*.sh deployment/ 2>/dev/null
git mv fix-all-projects-issues.sh deployment/ 2>/dev/null
git mv apply-migrations-*.sh deployment/ 2>/dev/null
git mv backup-critical-data.sh deployment/ 2>/dev/null

# Security
git mv security*.sh security/ 2>/dev/null
git mv scan-*.sh security/ 2>/dev/null
git mv install-production-security.sh security/ 2>/dev/null
git mv quick_security_check.sh security/ 2>/dev/null

# Telegram
mkdir -p telegram
git mv *telegram*.sh telegram/ 2>/dev/null
git mv *telegram*.js telegram/ 2>/dev/null
git mv *telegram*.py telegram/ 2>/dev/null
git mv get-group-id*.sh telegram/ 2>/dev/null

# Archive (lazygit и прочие одноразовые)
git mv setup_lazygit.sh archive/ 2>/dev/null
git mv temporary-fix-endpoints.sh archive/ 2>/dev/null
git mv check-deal-logs.sh archive/ 2>/dev/null

cd ..
```

Теперь скрипты из КОРНЯ переносим в соответствующие поддиректории scripts/:

```bash
# Из корня → scripts/deployment/
git mv build-and-deploy-stub.sh scripts/deployment/ 2>/dev/null
git mv deploy-canton-api-server.sh scripts/deployment/ 2>/dev/null
git mv deploy-to-main.sh scripts/deployment/ 2>/dev/null
git mv QUICK_DEPLOY_COMMANDS.sh scripts/deployment/ 2>/dev/null

# Из корня → scripts/testing/
git mv test-all-endpoints.mjs scripts/testing/ 2>/dev/null
git mv test-create-order.sh scripts/testing/ 2>/dev/null

# Из корня → scripts/archive/
git mv activate_lazygit.sh scripts/archive/ 2>/dev/null
```

### 9.6 docs/ — пропущенные .txt файлы

```bash
# .txt файлы тоже являются документацией/промтами
git mv docs/AGENT_DAML_ANALYST_COMPACT_PROMPT.txt docs/archive/prompts/ 2>/dev/null
git mv docs/NEAR_INTENTS_AUDIT_PROMPT.txt docs/archive/prompts/ 2>/dev/null
git mv docs/guides/FIN_AI_PROMPT_PRODUCTION_READY.txt docs/archive/prompts/ 2>/dev/null
```

### 9.7 env.template — содержит реальный токен

В `env.template` найдено: `NEXT_PUBLIC_CANTON_AUTH_TOKEN=demo_token_2025`

```bash
# Заменить реальное значение на плейсхолдер
sed -i '' 's/NEXT_PUBLIC_CANTON_AUTH_TOKEN=demo_token_2025/NEXT_PUBLIC_CANTON_AUTH_TOKEN=your-canton-auth-token-here/' env.template
```

### 9.8 Объединить env.template и .env.example

Два шаблона env — это путаница. Нужно оставить один.

```bash
# Проверить различия
diff .env.example env.template

# Если env.template — это расширенная версия .env.example:
# Объединить лучшие части в .env.example, удалить env.template
# ИЛИ наоборот — оставить env.template и удалить .env.example

# Рекомендация: оставить .env.example (стандартное название)
# Перенести уникальные переменные из env.template в .env.example
# Затем:
git rm -f env.template 2>/dev/null
```

### 9.9 Сам файл PROJECT_CLEANUP_MASTER_PROMPT.md

После выполнения ВСЕХ фаз — перенести этот промт в архив:

```bash
git mv PROJECT_CLEANUP_MASTER_PROMPT.md docs/archive/prompts/project-cleanup.md 2>/dev/null
```

### 9.10 Добавить CLAUDE.md (для Claude Code)

Создать файл `CLAUDE.md` в корне проекта — это инструкции для Claude Code при работе с проектом:

```bash
cat > CLAUDE.md << 'EOF'
# Canton OTC — Claude Code Instructions

## Project
DeFi OTC trading platform on Canton Network. Production: https://1otc.cc

## Tech Stack
- **Frontend:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- **Smart Contracts:** DAML 2.9.0 (Canton Network)
- **API Server:** Rust (Axum + Tonic gRPC)
- **Database:** Supabase (PostgreSQL) — optional for decentralized mode
- **Infrastructure:** Kubernetes on 65.108.15.30

## Key Directories
- `src/` — Next.js application (pages, API routes, components, services)
- `canton/daml/` — DAML smart contracts (OtcOffer, Escrow, Collateral, Settlement)
- `cantonnet-omnichain-sdk/` — Rust SDK (git submodule)
- `cantonnet-omnichain-sdk/crates/canton-otc-api/` — Rust REST API server
- `daml/` — DAML build config (daml.yaml)
- `k8s/` — Kubernetes manifests
- `docs/` — All documentation

## Commands
- `pnpm dev` — Start Next.js dev server
- `pnpm build` — Production build
- `cd cantonnet-omnichain-sdk && cargo check --package canton-otc-api` — Check Rust API
- `docker compose -f docker-compose.local-test.yml up` — Local Canton Sandbox
- `cd daml && daml build` — Build DAML contracts

## Conventions
- Use `String` (not `f64`) for financial amounts in Rust
- DAML module names match file names: OtcOffer.daml → module OtcOffer
- Canton Ledger API v2 uses nested proto Record/Variant types
- Server-side TypeScript must NOT have `"use client"` directive
- React hooks go in separate `"use client"` files
EOF
```

### 9.11 Обновить .gitignore — финальная версия

Добавить в `.gitignore` (полный блок новых исключений):

```gitignore
# === Build caches ===
tsconfig.tsbuildinfo
next-env.d.ts

# === IDE/Editor ===
*.code-workspace
.claude/
.cursor/
.playwright-mcp/
.shared/

# === Secrets (extra protection) ===
.env.local
.env.production
.env.production.backup
.env.clean
.env.fixed
.telegram-session

# === Build logs ===
docker-build.log
build-errors.log
build.log
deploy-fix.log

# === macOS ===
**/.DS_Store

# === K8s backups ===
backup/

# === Data directories ===
data/
```

---

## ЧЕКЛИСТ ДЛЯ ПРОВЕРКИ ПОСЛЕ ВЫПОЛНЕНИЯ

- [ ] В корне НЕТ файлов `*_PROMPT.md`, `BATTLE_TEST_*`, `*_REPORT.md`, `*_SUMMARY.md`
- [ ] В корне НЕТ `.env.production`, `.env.local`, `.env.clean`, `.env.fixed`
- [ ] В корне НЕТ `.telegram-session`, `.DS_Store`, `*.log`, `tsconfig.tsbuildinfo`
- [ ] `README.md` описывает Canton OTC (а не lazygit)
- [ ] `docs/README.md` — навигационный индекс
- [ ] `docs/archive/prompts/` содержит все промты с README-индексом
- [ ] `docs/archive/battle-tests/` содержит 5 частей battle-test
- [ ] `docs/reports/` содержит все отчёты
- [ ] `docs/guides/` содержит все гайды
- [ ] `.gitignore` обновлён
- [ ] `pnpm build` проходит без ошибок
- [ ] `cargo check` проходит без ошибок
- [ ] Скрипты перенесены в `scripts/`
- [ ] Нет пустых директорий
- [ ] Нет секретов в файлах с расширением `.example` или `.template`
