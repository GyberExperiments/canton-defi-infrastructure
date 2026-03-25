# 🔍 CANTON DEFI MIGRATION VERIFICATION PROMPT

> **Дата создания:** 2026-01-20  
> **Версия:** 1.0 — Complete Migration Verification  
> **Цель:** Проверить и сравнить CantonDeFi из tech-hy-ecosystem с миграцией в canton-otc/defi

---

## 📋 EXECUTIVE SUMMARY

**Задача:** Убедиться, что все компоненты, функциональность и зависимости CantonDeFi из проекта `tech-hy-ecosystem` корректно перенесены в проект `canton-otc` на роут `/defi`, и что UX/UI соответствует реальному функционалу для production-ready состояния.

**Контекст:** Подготовка к презентации для Canton Foundation с фокусом на:
- Институциональные продукты (аккредитивы, даркпул)
- Конфиденциальность и модульность
- Production-ready состояние всех модулей
- Соответствие UI реальному функционалу

**Критические проверки:**
- ✅ Все файлы перенесены без потерь
- ✅ Функциональность сохранена 100%
- ✅ Зависимости установлены
- ✅ Импорты работают корректно
- ✅ Конфигурация адаптирована под Next.js
- ✅ Нет потерянных функций или компонентов
- ✅ **UX/UI соответствует реальному функционалу**
- ✅ **Production-ready best practices**
- ✅ **Готовность к презентации Canton Foundation**

**Оценка времени:** 4-5 часов детальной проверки (включая UX/UI verification)

---

## 🎯 CONTEXT FOR AI

Ты **senior full-stack разработчик**, **QA engineer** и **UX/UI expert** со специализацией в:
- Code review и миграции
- TypeScript/React/Next.js
- DeFi интеграциях
- Сравнительном анализе кода
- **Production-ready UX/UI best practices**
- **Institutional DeFi products**

**Твоя задача:** Методично проверить каждый компонент, сервис, хук и утилиту, убедившись что:
1. Миграция выполнена полностью и корректно
2. **UX/UI соответствует реальному функционалу**
3. **Продукт готов к production и презентации Canton Foundation**
4. Все функции работают для институционалов, конфиденциальности и модульности

---

## 📁 PROJECT LOCATIONS (ABSOLUTE PATHS)

### 🔵 SOURCE PROJECT (tech-hy-ecosystem)

```
/Users/Gyber/GYBERNATY-ECOSYSTEM/tech-hy-ecosystem/frontend/src/
├── app/
│   └── CantonDeFi.tsx                           # 1188 lines - MAIN COMPONENT
│
├── entities/Canton/
│   ├── api/
│   │   ├── realCantonIntegration.ts             # 1372 lines - Canton Network hooks
│   │   ├── useCantonBridge.ts                   # Bridge operations hook
│   │   ├── useCantonNetwork.ts                  # Network connection hook
│   │   └── useInstitutionalAssets.ts            # Assets fetching hook
│   │
│   ├── config/
│   │   ├── realCantonConfig.ts                  # Network config
│   │   ├── productionCantonConfig.ts            # Production env config
│   │   └── stablecoins.ts                       # USDT/USDC/USD1 config
│   │
│   ├── hooks/
│   │   └── useCantonPortfolio.ts                # Portfolio data hook
│   │
│   ├── security/
│   │   └── securityAuditService.ts              # Security audit logic
│   │
│   ├── services/
│   │   ├── cantonBridgeService.ts              # Cross-chain bridge
│   │   ├── CantonServiceManager.ts              # Service orchestration
│   │   ├── damlIntegrationService.ts            # DAML contract calls
│   │   ├── multiPartyWorkflowService.ts         # Multi-party transactions
│   │   ├── performanceOptimizationService.ts    # Performance optimization
│   │   ├── privacyVaultService.ts               # 1337 lines - Privacy vaults
│   │   ├── propertyValuationAPI.ts              # Real estate valuation
│   │   ├── realEstateService.ts                 # 1127 lines - Real estate tokenization
│   │   └── zkProofService.ts                    # Zero-knowledge proofs
│   │
│   └── ui/
│       ├── MultiPartyAuthPanel.tsx              # Multi-party authorization
│       ├── MultiPartyDashboard.tsx              # Dashboard for multi-party
│       └── StablecoinSelector.tsx               # Stablecoin dropdown
│
├── entities/AI/services/
│   ├── grok4PortfolioService.ts                 # Grok-4 API integration
│   ├── portfolioOptimizer.ts                   # Base optimizer
│   └── portfolioOptimizerGrok4.ts               # 676 lines - AI optimizer hook
│
├── widgets/CCPurchaseWidget/
│   └── ui/
│       └── CCPurchaseWidget.tsx                 # Canton Coin purchase widget
│
└── shared/
    ├── store/
    │   └── cantonStore.ts                       # Zustand store
    └── lib/
        └── decimalFormatter.ts                  # Decimal formatting utils
```

### 🟢 TARGET PROJECT (canton-otc)

```
/Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/
├── src/
│   ├── app/
│   │   └── defi/
│   │       └── page.tsx                         # DeFi page wrapper
│   │
│   ├── components/
│   │   └── defi/
│   │       ├── CantonDeFi.tsx                  # 1179 lines - MAIN COMPONENT
│   │       ├── CCPurchaseWidget.tsx             # Canton Coin purchase widget
│   │       ├── MultiPartyAuthPanel.tsx          # Multi-party authorization
│   │       ├── MultiPartyDashboard.tsx          # Dashboard for multi-party
│   │       └── StablecoinSelector.tsx           # Stablecoin dropdown
│   │
│   └── lib/
│       └── canton/
│           ├── config/
│           │   ├── realBridgeConfig.ts          # Bridge config
│           │   ├── stablecoins.ts               # Stablecoin config
│           │   └── wagmi.ts                     # Wagmi config
│           │
│           ├── hooks/
│           │   ├── realCantonIntegration.ts     # Canton Network hooks
│           │   ├── useCantonBridge.ts           # Bridge operations hook
│           │   └── useCantonNetwork.ts          # Network connection hook
│           │
│           ├── services/
│           │   ├── ai/
│           │   │   ├── grok4PortfolioService.ts # Grok-4 API integration
│           │   │   ├── portfolioOptimizer.ts   # Base optimizer
│           │   │   └── portfolioOptimizerGrok4.ts # AI optimizer hook
│           │   ├── cantonAuthService.ts         # Auth service
│           │   ├── cantonBridgeService.ts       # Cross-chain bridge
│           │   ├── CantonServiceManager.ts      # Service orchestration
│           │   ├── damlIntegrationService.ts    # DAML contract calls
│           │   ├── grok4PortfolioService.ts     # Grok-4 service (duplicate?)
│           │   ├── monitoring.ts                # Monitoring service
│           │   ├── multiPartyWorkflowService.ts # Multi-party transactions
│           │   ├── performanceOptimizationService.ts # Performance optimization
│           │   ├── privacyVaultService.ts        # Privacy vaults
│           │   ├── propertyValuationAPI.ts      # Real estate valuation
│           │   ├── realEstateService.ts          # Real estate tokenization
│           │   └── zkProofService.ts            # Zero-knowledge proofs
│           │
│           ├── store/
│           │   └── cantonStore.ts               # Zustand store
│           │
│           ├── types/                            # Type definitions
│           │
│           ├── utils/
│           │   ├── decimalFormatter.ts           # Decimal formatting utils
│           │   └── errorHandler.ts               # Error handling utils
│           │
│           └── index.ts                          # Re-exports
```

---

## 🔍 VERIFICATION CHECKLIST

### PHASE 1: File Structure Comparison

#### Step 1: Main Component Verification

**Source:**
- `/Users/Gyber/GYBERNATY-ECOSYSTEM/tech-hy-ecosystem/frontend/src/app/CantonDeFi.tsx` (1188 lines)

**Target:**
- `/Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/components/defi/CantonDeFi.tsx` (1179 lines)

**Проверки:**
1. ✅ Сравнить количество строк (допустимо небольшое расхождение из-за адаптации под Next.js)
2. ✅ Проверить все импорты - должны быть адаптированы под новую структуру
3. ✅ Проверить все функции и хуки - должны быть идентичны
4. ✅ Проверить все состояния (useState, useMemo, useEffect)
5. ✅ Проверить все обработчики событий
6. ✅ Проверить все UI компоненты и секции

**Команды для проверки:**
```bash
# Сравнить основные функции
diff -u \
  /Users/Gyber/GYBERNATY-ECOSYSTEM/tech-hy-ecosystem/frontend/src/app/CantonDeFi.tsx \
  /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/components/defi/CantonDeFi.tsx \
  | grep -E "^\+|^-" | grep -v "^+++\|^---" | head -100

# Проверить количество функций
grep -c "const.*=.*(" /Users/Gyber/GYBERNATY-ECOSYSTEM/tech-hy-ecosystem/frontend/src/app/CantonDeFi.tsx
grep -c "const.*=.*(" /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/components/defi/CantonDeFi.tsx

# Проверить количество хуков
grep -c "use[A-Z]" /Users/Gyber/GYBERNATY-ECOSYSTEM/tech-hy-ecosystem/frontend/src/app/CantonDeFi.tsx
grep -c "use[A-Z]" /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/components/defi/CantonDeFi.tsx
```

#### Step 2: Services Verification

**Проверить каждый сервис:**

| Source File | Target File | Status | Notes |
|------------|------------|--------|-------|
| `entities/Canton/api/realCantonIntegration.ts` | `lib/canton/hooks/realCantonIntegration.ts` | ⬜ | Проверить все хуки |
| `entities/Canton/services/cantonBridgeService.ts` | `lib/canton/services/cantonBridgeService.ts` | ⬜ | Проверить bridge логику |
| `entities/Canton/services/realEstateService.ts` | `lib/canton/services/realEstateService.ts` | ⬜ | Проверить все методы |
| `entities/Canton/services/privacyVaultService.ts` | `lib/canton/services/privacyVaultService.ts` | ⬜ | Проверить ZK-proofs |
| `entities/Canton/services/damlIntegrationService.ts` | `lib/canton/services/damlIntegrationService.ts` | ⬜ | Проверить DAML интеграцию |
| `entities/Canton/services/CantonServiceManager.ts` | `lib/canton/services/CantonServiceManager.ts` | ⬜ | Проверить оркестрацию |
| `entities/Canton/services/multiPartyWorkflowService.ts` | `lib/canton/services/multiPartyWorkflowService.ts` | ⬜ | Проверить workflow |
| `entities/Canton/services/performanceOptimizationService.ts` | `lib/canton/services/performanceOptimizationService.ts` | ⬜ | Проверить оптимизации |
| `entities/Canton/services/propertyValuationAPI.ts` | `lib/canton/services/propertyValuationAPI.ts` | ⬜ | Проверить valuation |
| `entities/Canton/services/zkProofService.ts` | `lib/canton/services/zkProofService.ts` | ⬜ | Проверить ZK-proofs |
| `entities/AI/services/grok4PortfolioService.ts` | `lib/canton/services/ai/grok4PortfolioService.ts` | ⬜ | Проверить Grok-4 |
| `entities/AI/services/portfolioOptimizer.ts` | `lib/canton/services/ai/portfolioOptimizer.ts` | ⬜ | Проверить optimizer |
| `entities/AI/services/portfolioOptimizerGrok4.ts` | `lib/canton/services/ai/portfolioOptimizerGrok4.ts` | ⬜ | Проверить Grok-4 hook |

**Команды для проверки:**
```bash
# Для каждого сервиса проверить:
# 1. Количество экспортируемых функций/классов
# 2. Все методы/функции присутствуют
# 3. Типы и интерфейсы идентичны

# Пример для realEstateService:
grep -E "export (const|function|class|interface|type)" \
  /Users/Gyber/GYBERNATY-ECOSYSTEM/tech-hy-ecosystem/frontend/src/entities/Canton/services/realEstateService.ts

grep -E "export (const|function|class|interface|type)" \
  /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/lib/canton/services/realEstateService.ts

# Сравнить количество методов
grep -c "async.*(" /Users/Gyber/GYBERNATY-ECOSYSTEM/tech-hy-ecosystem/frontend/src/entities/Canton/services/realEstateService.ts
grep -c "async.*(" /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/lib/canton/services/realEstateService.ts
```

#### Step 3: Hooks Verification

**Проверить все хуки:**

| Source File | Target File | Status | Notes |
|------------|------------|--------|-------|
| `entities/Canton/api/useCantonBridge.ts` | `lib/canton/hooks/useCantonBridge.ts` | ⬜ | Проверить bridge хуки |
| `entities/Canton/api/useCantonNetwork.ts` | `lib/canton/hooks/useCantonNetwork.ts` | ⬜ | Проверить network хуки |
| `entities/Canton/hooks/useCantonPortfolio.ts` | ❓ | ⬜ | Проверить наличие |

**Команды для проверки:**
```bash
# Проверить все экспортируемые хуки
for file in useCantonBridge.ts useCantonNetwork.ts; do
  echo "=== Checking $file ==="
  grep -E "export (const|function) use" \
    /Users/Gyber/GYBERNATY-ECOSYSTEM/tech-hy-ecosystem/frontend/src/entities/Canton/api/$file
  grep -E "export (const|function) use" \
    /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/lib/canton/hooks/$file
done
```

#### Step 4: UI Components Verification

**Проверить все UI компоненты:**

| Source File | Target File | Status | Notes |
|------------|------------|--------|-------|
| `entities/Canton/ui/CCPurchaseWidget.tsx` | `components/defi/CCPurchaseWidget.tsx` | ⬜ | Проверить widget |
| `entities/Canton/ui/StablecoinSelector.tsx` | `components/defi/StablecoinSelector.tsx` | ⬜ | Проверить selector |
| `entities/Canton/ui/MultiPartyAuthPanel.tsx` | `components/defi/MultiPartyAuthPanel.tsx` | ⬜ | Проверить auth panel |
| `entities/Canton/ui/MultiPartyDashboard.tsx` | `components/defi/MultiPartyDashboard.tsx` | ⬜ | Проверить dashboard |

**Команды для проверки:**
```bash
# Проверить размеры файлов
for component in CCPurchaseWidget StablecoinSelector MultiPartyAuthPanel MultiPartyDashboard; do
  echo "=== $component ==="
  wc -l /Users/Gyber/GYBERNATY-ECOSYSTEM/tech-hy-ecosystem/frontend/src/entities/Canton/ui/${component}.tsx 2>/dev/null
  wc -l /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/components/defi/${component}.tsx 2>/dev/null
done
```

#### Step 5: Store & Utils Verification

**Проверить store и утилиты:**

| Source File | Target File | Status | Notes |
|------------|------------|--------|-------|
| `shared/store/cantonStore.ts` | `lib/canton/store/cantonStore.ts` | ⬜ | Проверить Zustand store |
| `shared/lib/decimalFormatter.ts` | `lib/canton/utils/decimalFormatter.ts` | ⬜ | Проверить форматирование |

**Команды для проверки:**
```bash
# Проверить store структуру
grep -E "create<|defineStore|useStore" \
  /Users/Gyber/GYBERNATY-ECOSYSTEM/tech-hy-ecosystem/frontend/src/shared/store/cantonStore.ts

grep -E "create<|defineStore|useStore" \
  /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/lib/canton/store/cantonStore.ts

# Проверить все экспортируемые функции из decimalFormatter
grep -E "export (const|function)" \
  /Users/Gyber/GYBERNATY-ECOSYSTEM/tech-hy-ecosystem/frontend/src/shared/lib/decimalFormatter.ts

grep -E "export (const|function)" \
  /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/lib/canton/utils/decimalFormatter.ts
```

#### Step 6: Config Files Verification

**Проверить конфигурационные файлы:**

| Source File | Target File | Status | Notes |
|------------|------------|--------|-------|
| `entities/Canton/config/stablecoins.ts` | `lib/canton/config/stablecoins.ts` | ⬜ | Проверить stablecoins |
| `entities/Canton/config/realCantonConfig.ts` | `lib/canton/config/wagmi.ts` | ⬜ | Проверить конфигурацию |

**Команды для проверки:**
```bash
# Проверить stablecoins конфигурацию
diff -u \
  /Users/Gyber/GYBERNATY-ECOSYSTEM/tech-hy-ecosystem/frontend/src/entities/Canton/config/stablecoins.ts \
  /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/lib/canton/config/stablecoins.ts
```

---

### PHASE 2: Functionality Verification

#### Step 7: Feature Comparison Matrix

**Проверить каждую фичу:**

| Feature | Source Implementation | Target Implementation | Status | Notes |
|---------|----------------------|----------------------|--------|-------|
| **Real Estate Tokenization** | `realEstateService.ts` | `realEstateService.ts` | ⬜ | Проверить все методы |
| **Privacy Vaults** | `privacyVaultService.ts` | `privacyVaultService.ts` | ⬜ | Проверить ZK-proofs |
| **Cross-Chain Bridge** | `cantonBridgeService.ts` | `cantonBridgeService.ts` | ⬜ | Проверить bridge логику |
| **AI Portfolio Optimizer** | `portfolioOptimizerGrok4.ts` | `portfolioOptimizerGrok4.ts` | ⬜ | Проверить Grok-4 интеграцию |
| **Canton Coin Purchase** | `CCPurchaseWidget.tsx` | `CCPurchaseWidget.tsx` | ⬜ | Проверить widget |
| **Multi-Party Workflows** | `multiPartyWorkflowService.ts` | `multiPartyWorkflowService.ts` | ⬜ | Проверить workflow |
| **DAML Integration** | `damlIntegrationService.ts` | `damlIntegrationService.ts` | ⬜ | Проверить DAML вызовы |
| **Performance Optimization** | `performanceOptimizationService.ts` | `performanceOptimizationService.ts` | ⬜ | Проверить оптимизации |

**Для каждой фичи проверить:**
1. ✅ Все публичные методы присутствуют
2. ✅ Сигнатуры методов идентичны
3. ✅ Логика работы сохранена
4. ✅ Обработка ошибок идентична
5. ✅ Типы и интерфейсы совпадают

#### Step 8: Import Path Verification

**Проверить все импорты в главном компоненте:**

```bash
# Извлечь все импорты из исходного файла
grep "^import" /Users/Gyber/GYBERNATY-ECOSYSTEM/tech-hy-ecosystem/frontend/src/app/CantonDeFi.tsx > /tmp/source_imports.txt

# Извлечь все импорты из целевого файла
grep "^import" /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/components/defi/CantonDeFi.tsx > /tmp/target_imports.txt

# Сравнить
diff /tmp/source_imports.txt /tmp/target_imports.txt
```

**Проверить что все импорты адаптированы:**
- ✅ `@/lib/canton/...` вместо `entities/Canton/...`
- ✅ `@/components/defi/...` вместо `entities/Canton/ui/...`
- ✅ `@/shared/...` заменены на `@/lib/canton/...`

#### Step 9: Dependencies Verification

**Проверить package.json зависимости:**

```bash
# Сравнить зависимости
diff -u \
  /Users/Gyber/GYBERNATY-ECOSYSTEM/tech-hy-ecosystem/frontend/package.json \
  /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/package.json \
  | grep -E "^\+|^-" | grep -E "\"(wagmi|viem|@rainbow|decimal|zustand|framer|@daml)" | head -30
```

**Критические зависимости для проверки:**
- ✅ `wagmi` и `viem` (Web3)
- ✅ `@rainbow-me/rainbowkit` (Wallet connection)
- ✅ `decimal.js` (Точные вычисления)
- ✅ `zustand` (State management)
- ✅ `framer-motion` (Анимации)
- ✅ `@daml/ledger`, `@daml/types`, `@daml/react` (DAML интеграция)
- ✅ `snarkjs`, `circomlibjs` (ZK-proofs)

---

### PHASE 3: Code Quality & Best Practices

#### Step 10: TypeScript Errors Check

**Проверить что нет TypeScript ошибок:**

```bash
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc
NODE_OPTIONS='--max-old-space-size=8192' pnpm run type-check 2>&1 | grep -E "error TS|Found [0-9]+ error" | head -20
```

**Ожидаемый результат:** 0 ошибок

#### Step 11: Build Verification

**Проверить что проект собирается:**

```bash
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc
NODE_OPTIONS='--max-old-space-size=8192' pnpm run build 2>&1 | tail -30
```

**Ожидаемый результат:** Успешная сборка без ошибок

#### Step 12: Runtime Verification

**Проверить что приложение запускается:**

```bash
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc
pnpm run dev
# Открыть http://localhost:3000/defi
# Проверить в консоли браузера на наличие ошибок
```

**Проверки в браузере:**
1. ✅ Страница `/defi` загружается без ошибок
2. ✅ Все секции отображаются (Hero, Products, AI, Security)
3. ✅ Wallet connection работает
4. ✅ Нет ошибок в консоли
5. ✅ Все интерактивные элементы работают

---

### PHASE 4: Missing Components Detection

#### Step 13: Find Missing Files

**Найти файлы которые не были перенесены:**

```bash
# Список всех файлов в исходном проекте
find /Users/Gyber/GYBERNATY-ECOSYSTEM/tech-hy-ecosystem/frontend/src/entities/Canton \
  -type f \( -name "*.ts" -o -name "*.tsx" \) \
  -exec basename {} \; | sort > /tmp/source_files.txt

# Список всех файлов в целевом проекте
find /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/lib/canton \
  -type f \( -name "*.ts" -o -name "*.tsx" \) \
  -exec basename {} \; | sort > /tmp/target_files.txt

# Найти отсутствующие файлы
comm -23 /tmp/source_files.txt /tmp/target_files.txt
```

#### Step 14: Find Missing Functions

**Найти функции которые не были перенесены:**

```bash
# Для каждого сервиса проверить экспортируемые функции
for service in realEstateService privacyVaultService cantonBridgeService; do
  echo "=== Checking $service ==="
  
  # Исходный файл
  grep -E "export (const|function|class|interface|type) [A-Z]" \
    /Users/Gyber/GYBERNATY-ECOSYSTEM/tech-hy-ecosystem/frontend/src/entities/Canton/services/${service}.ts \
    | sed 's/export //' | sed 's/[=:].*//' | sort > /tmp/source_${service}.txt
  
  # Целевой файл
  grep -E "export (const|function|class|interface|type) [A-Z]" \
    /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/lib/canton/services/${service}.ts \
    | sed 's/export //' | sed 's/[=:].*//' | sort > /tmp/target_${service}.txt
  
  # Найти отсутствующие
  comm -23 /tmp/source_${service}.txt /tmp/target_${service}.txt
done
```

---

### PHASE 5: UX/UI & Production-Ready Verification

> **Критическая фаза для презентации Canton Foundation**

#### Step 15: UI Component Functionality Mapping

**Проверить что каждый UI элемент соответствует реальному функционалу:**

**Команды для проверки:**

```bash
# Извлечь все UI секции из главного компонента
grep -E "(Section|Card|Widget|Panel|Modal|Button|Input)" \
  /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/components/defi/CantonDeFi.tsx \
  | grep -E "const|function|=>" | head -50

# Проверить что все кнопки имеют обработчики
grep -E "onClick|onSubmit|onChange" \
  /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/components/defi/CantonDeFi.tsx \
  | wc -l

# Проверить что все формы связаны с реальными функциями
grep -E "(investInAsset|purchaseRealEstateTokens|createPrivacyVault|optimizePortfolio)" \
  /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/components/defi/CantonDeFi.tsx
```

**Чеклист UI → Functionality:**

| UI Element | Expected Functionality | Real Implementation | Status | Notes |
|-----------|----------------------|-------------------|--------|-------|
| **Hero Section** | Display platform value proposition | ✅ Present | ⬜ | Проверить что текст актуален для институционалов |
| **Canton Coin Purchase Widget** | Buy Canton Coin with stablecoins | `CCPurchaseWidget` component | ⬜ | Проверить что widget работает |
| **Products Tab** | Show DeFi products (Real Estate, Privacy Vault, AI) | `institutionalProducts` array | ⬜ | Проверить что все продукты отображаются |
| **Real Estate Card** | Invest in real estate tokens | `purchaseRealEstateTokens` function | ⬜ | Проверить что кнопка "Invest" вызывает функцию |
| **Privacy Vault Card** | Create privacy vault | `createPrivacyVault` function | ⬜ | Проверить что кнопка "Create Vault" работает |
| **AI Portfolio Card** | Optimize portfolio with AI | `useAIPortfolioOptimizer` hook | ⬜ | Проверить что AI функции доступны |
| **AI Features Tab** | Show AI optimization features | AI section with Grok-4 | ⬜ | Проверить что все AI функции отображаются |
| **Security Tab** | Show security features | Security section | ⬜ | Проверить что security информация актуальна |
| **Wallet Connection** | Connect wallet via RainbowKit | `useAccount` from wagmi | ⬜ | Проверить что wallet connection работает |
| **Portfolio Display** | Show user portfolio | `userPortfolio` from store | ⬜ | Проверить что portfolio данные отображаются |
| **Notifications** | Show transaction notifications | `useNotifications` from store | ⬜ | Проверить что notifications работают |
| **Loading States** | Show loading indicators | `useLoadingState` from store | ⬜ | Проверить что loading states корректны |

#### Step 16: Production-Ready UX/UI Best Practices

**Проверить соответствие production-ready стандартам:**

**1. Error Handling & User Feedback:**

```bash
# Проверить наличие error handling
grep -E "(try|catch|error|Error|handleError)" \
  /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/components/defi/CantonDeFi.tsx \
  | wc -l

# Проверить наличие toast notifications
grep -E "(toast|notification|addNotification)" \
  /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/components/defi/CantonDeFi.tsx \
  | wc -l
```

**Чеклист Production-Ready UX:**

- [ ] **Error Handling:**
  - [ ] Все async функции обернуты в try/catch
  - [ ] Пользователю показываются понятные сообщения об ошибках
  - [ ] Нет технических ошибок в консоли при нормальном использовании

- [ ] **Loading States:**
  - [ ] Все асинхронные операции показывают loading индикаторы
  - [ ] Кнопки disabled во время выполнения операций
  - [ ] Skeleton loaders для долгих операций

- [ ] **User Feedback:**
  - [ ] Toast notifications для успешных операций
  - [ ] Toast notifications для ошибок
  - [ ] Визуальная обратная связь для всех действий

- [ ] **Accessibility:**
  - [ ] Все интерактивные элементы имеют aria-labels
  - [ ] Keyboard navigation работает
  - [ ] Цветовой контраст соответствует WCAG AA

- [ ] **Responsive Design:**
  - [ ] Мобильная версия работает корректно
  - [ ] Tablet версия оптимизирована
  - [ ] Desktop версия использует доступное пространство

- [ ] **Performance:**
  - [ ] Нет лишних ре-рендеров
  - [ ] Используется мемоизация где необходимо
  - [ ] Lazy loading для тяжелых компонентов

#### Step 17: Canton Foundation Presentation Readiness

**Проверить готовность для презентации Canton Foundation:**

**Ключевые требования из контекста:**

1. **Институциональные продукты:**
   - [ ] Real Estate Tokenization отображается и работает
   - [ ] Privacy Vaults функциональны
   - [ ] Multi-party workflows работают
   - [ ] Аккредитив решение (OTC платформа) интегрировано

2. **Конфиденциальность:**
   - [ ] Privacy Vaults с ZK-proofs работают
   - [ ] Конфиденциальные транзакции поддерживаются
   - [ ] Privacy level настройки доступны

3. **Модульность:**
   - [ ] Все модули работают независимо
   - [ ] API для интеграции доступен
   - [ ] Смарт-контракты готовы к интеграции

4. **Демонстрация функционала:**
   - [ ] Все ключевые функции можно продемонстрировать
   - [ ] Нет placeholder данных где нужны реальные
   - [ ] Все кнопки и формы функциональны

**Команды для проверки:**

```bash
# Проверить наличие placeholder/mock данных
grep -E "(mock|placeholder|demo|fake|test)" \
  /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/components/defi/CantonDeFi.tsx \
  -i | head -20

# Проверить что используются реальные сервисы
grep -E "(useRealEstateService|usePrivacyVaultService|useAIPortfolioOptimizer|useRealCantonNetwork)" \
  /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/components/defi/CantonDeFi.tsx

# Проверить что нет TODO/FIXME для критических функций
grep -E "(TODO|FIXME|XXX|HACK)" \
  /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/components/defi/CantonDeFi.tsx \
  -i | head -10
```

#### Step 18: Functional Testing Checklist

**Ручное тестирование всех функций:**

**Сценарии тестирования:**

1. **Wallet Connection:**
   - [ ] Подключение кошелька работает
   - [ ] Отключение кошелька работает
   - [ ] Смена сети обрабатывается корректно
   - [ ] Ошибки подключения показываются пользователю

2. **Real Estate Investment:**
   - [ ] Список доступных properties отображается
   - [ ] Детали property показываются корректно
   - [ ] Покупка tokens работает
   - [ ] Транзакция подтверждается
   - [ ] Уведомление о покупке показывается

3. **Privacy Vault:**
   - [ ] Создание vault работает
   - [ ] Список vaults отображается
   - [ ] Детали vault показываются
   - [ ] Privacy level настройки работают
   - [ ] ZK-proofs генерируются (если реализовано)

4. **AI Portfolio Optimizer:**
   - [ ] AI optimizer инициализируется
   - [ ] Оптимизация портфеля запускается
   - [ ] Результаты оптимизации отображаются
   - [ ] Рекомендации показываются

5. **Canton Coin Purchase:**
   - [ ] Widget отображается
   - [ ] Выбор stablecoin работает
   - [ ] Ввод суммы работает
   - [ ] Покупка выполняется
   - [ ] Подтверждение транзакции работает

6. **Navigation & UI:**
   - [ ] Переключение между табами работает
   - [ ] Анимации плавные
   - [ ] Модальные окна открываются/закрываются
   - [ ] Формы валидируются корректно
   - [ ] Ошибки валидации показываются

**Команды для автоматической проверки:**

```bash
# Запустить dev server
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc
pnpm run dev

# В браузере открыть http://localhost:3000/defi
# Выполнить все сценарии тестирования выше
# Записать результаты в отчёт
```

#### Step 19: Content & Messaging Verification

**Проверить что контент актуален для Canton Foundation:**

#### Step 20: Cross-Chain Wallet Integration Verification

> **Критично для мультичейн кошелька (приоритетный продукт для Canton Foundation)**

**Проверить интеграцию кроссчейн кошелька для поддержки актуального функционала платформы:**

**1. Wallet Provider Configuration:**

**Команды для проверки:**

```bash
# Проверить wagmi конфигурацию
cat /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/lib/canton/config/wagmi.ts

# Проверить поддерживаемые сети
grep -E "(chains|SUPPORTED_CHAINS|mainnet|bsc|polygon|optimism|arbitrum)" \
  /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/lib/canton/config/wagmi.ts

# Проверить что Canton Network добавлен
grep -E "(cantonNetwork|CANTON|7575)" \
  /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/lib/canton/config/wagmi.ts
```

**Чеклист Wallet Integration:**

- [ ] **Поддерживаемые сети:**
  - [ ] Ethereum Mainnet (chainId: 1)
  - [ ] BSC (chainId: 56)
  - [ ] Polygon (chainId: 137)
  - [ ] Optimism (chainId: 10)
  - [ ] Arbitrum (chainId: 42161)
  - [ ] **Canton Network (chainId: 7575) - КРИТИЧНО**

- [ ] **Wallet Providers:**
  - [ ] MetaMask подключение работает
  - [ ] WalletConnect работает
  - [ ] Coinbase Wallet работает
  - [ ] RainbowKit UI отображается корректно

- [ ] **Network Switching:**
  - [ ] Переключение между сетями работает
  - [ ] Пользователь может выбрать сеть
  - [ ] UI показывает текущую сеть
  - [ ] Ошибки неподдерживаемой сети обрабатываются

**2. Cross-Chain Bridge Integration:**

**Команды для проверки:**

```bash
# Проверить bridge сервис
grep -E "export (class|interface|type|const)" \
  /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/lib/canton/services/cantonBridgeService.ts \
  | head -20

# Проверить bridge хуки
grep -E "export (const|function) use" \
  /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/lib/canton/hooks/useCantonBridge.ts

# Проверить bridge конфигурацию
grep -E "(BSC|ETHEREUM|POLYGON|CANTON)" \
  /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/lib/canton/config/realBridgeConfig.ts
```

**Чеклист Cross-Chain Bridge:**

- [ ] **Bridge Service:**
  - [ ] `CantonBridgeService` реализован
  - [ ] Поддержка BSC → Canton Network
  - [ ] Поддержка Ethereum → Canton Network
  - [ ] Поддержка Polygon → Canton Network
  - [ ] Обратный bridge (Canton → EVM chains)

- [ ] **Bridge Hooks:**
  - [ ] `useCantonBridge` хук работает
  - [ ] `bridgeToCanton` функция реализована
  - [ ] `bridgeFromCanton` функция реализована
  - [ ] Bridge статус отслеживается

- [ ] **Bridge Configuration:**
  - [ ] Контракт адреса настроены
  - [ ] RPC endpoints настроены
  - [ ] Gas settings настроены
  - [ ] Security settings настроены (multi-sig, timelock)

- [ ] **Bridge UI:**
  - [ ] Bridge интерфейс отображается
  - [ ] Выбор source chain работает
  - [ ] Выбор destination chain работает
  - [ ] Ввод суммы работает
  - [ ] Bridge транзакция инициируется
  - [ ] Bridge статус отображается в реальном времени

**3. Multi-Chain Asset Support:**

**Команды для проверки:**

```bash
# Проверить stablecoin конфигурацию для разных сетей
grep -E "(BSC_MAINNET|ETHEREUM_MAINNET|POLYGON_MAINNET)" \
  /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/lib/canton/config/realBridgeConfig.ts

# Проверить stablecoin selector
grep -E "(USDT|USDC|DAI)" \
  /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/components/defi/StablecoinSelector.tsx
```

**Чеклист Multi-Chain Assets:**

- [ ] **Stablecoins по сетям:**
  - [ ] USDT на BSC поддерживается
  - [ ] USDC на BSC поддерживается
  - [ ] USDT на Ethereum поддерживается
  - [ ] USDC на Ethereum поддерживается
  - [ ] USDT на Polygon поддерживается
  - [ ] USDC на Polygon поддерживается

- [ ] **Asset Selection:**
  - [ ] Пользователь может выбрать сеть
  - [ ] Пользователь может выбрать токен
  - [ ] Баланс токена отображается
  - [ ] Approval для токенов работает

**4. Wallet State Management:**

**Команды для проверки:**

```bash
# Проверить использование useAccount
grep -E "useAccount|isConnected|address|chainId" \
  /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/components/defi/CantonDeFi.tsx

# Проверить wallet state в store
grep -E "(wallet|account|chain|network)" \
  /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/lib/canton/store/cantonStore.ts \
  -i | head -20
```

**Чеклист Wallet State:**

- [ ] **Wallet Connection:**
  - [ ] Состояние подключения отслеживается
  - [ ] Адрес кошелька доступен
  - [ ] Chain ID отслеживается
  - [ ] Wallet disconnect обрабатывается

- [ ] **State Persistence:**
  - [ ] Wallet connection сохраняется между сессиями
  - [ ] Выбранная сеть сохраняется
  - [ ] Zustand store синхронизирован с wagmi

**5. Integration with Platform Features:**

**Проверить что кроссчейн кошелёк интегрирован со всеми функциями платформы:**

- [ ] **Real Estate Investment:**
  - [ ] Покупка tokens работает с любой EVM сети
  - [ ] Bridge для real estate работает
  - [ ] Платежи обрабатываются корректно

- [ ] **Privacy Vault:**
  - [ ] Создание vault работает с любой сети
  - [ ] Депозиты в vault работают
  - [ ] Cross-chain deposits поддерживаются

- [ ] **AI Portfolio Optimizer:**
  - [ ] Оптимизация работает с мультичейн активами
  - [ ] Балансы из разных сетей учитываются
  - [ ] Рекомендации учитывают кроссчейн активы

- [ ] **Canton Coin Purchase:**
  - [ ] Покупка CC работает с любой сети
  - [ ] Bridge для CC работает
  - [ ] Конверсия stablecoins работает

**6. Production-Ready Cross-Chain Features:**

**Чеклист Production-Ready:**

- [ ] **Error Handling:**
  - [ ] Ошибки неподдерживаемой сети обрабатываются
  - [ ] Ошибки bridge транзакций обрабатываются
  - [ ] Ошибки wallet connection обрабатываются
  - [ ] Пользователю показываются понятные сообщения

- [ ] **Loading States:**
  - [ ] Bridge транзакции показывают loading
  - [ ] Network switching показывает loading
  - [ ] Wallet connection показывает loading

- [ ] **Transaction Tracking:**
  - [ ] Bridge транзакции отслеживаются
  - [ ] Статус транзакций отображается
  - [ ] История транзакций сохраняется
  - [ ] Уведомления о статусе транзакций

- [ ] **Security:**
  - [ ] Multi-sig для больших транзакций
  - [ ] Timelock для withdrawals
  - [ ] Rate limiting для bridge операций
  - [ ] Emergency pause механизм

**Команды для функционального тестирования:**

```bash
# Запустить dev server
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc
pnpm run dev

# В браузере открыть http://localhost:3000/defi
# Выполнить тесты:
# 1. Подключить MetaMask
# 2. Переключиться на BSC
# 3. Переключиться на Polygon
# 4. Переключиться на Ethereum
# 5. Попробовать bridge транзакцию
# 6. Проверить что все функции работают с разными сетями
```

**7. Canton Foundation Requirements:**

**Проверить соответствие требованиям для мультичейн кошелька:**

- [ ] **Мультичейн поддержка:**
  - [ ] Поддержка всех необходимых сетей
  - [ ] Canton Network интегрирован
  - [ ] Bridge между сетями работает

- [ ] **Интеграция с продуктами:**
  - [ ] Кошелёк интегрирован с DEX
  - [ ] Кошелёк интегрирован с лендингом
  - [ ] Кошелёк интегрирован с ОТС платформой
  - [ ] Кошелёк интегрирован с DeFi продуктами

- [ ] **Модульность:**
  - [ ] Кошелёк работает как независимый модуль
  - [ ] API для интеграции доступен
  - [ ] Можно использовать в других продуктах

**Команды для проверки интеграции:**

```bash
# Проверить что кошелёк используется во всех компонентах
grep -r "useAccount\|wagmi\|rainbowkit" \
  /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/components/defi/ \
  | wc -l

# Проверить что bridge используется в нужных местах
grep -r "useCantonBridge\|bridgeToCanton\|bridgeFromCanton" \
  /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/ \
  | wc -l
```

---

#### Step 19: Content & Messaging Verification

**Проверить что контент актуален для Canton Foundation:**

**Чеклист контента:**

- [ ] **Hero Section:**
  - [ ] Текст описывает институциональные продукты
  - [ ] Упоминается конфиденциальность
  - [ ] Упоминается модульность
  - [ ] Нет устаревшей информации

- [ ] **Product Descriptions:**
  - [ ] Real Estate описание актуально
  - [ ] Privacy Vault описание корректно
  - [ ] AI Portfolio описание соответствует функционалу
  - [ ] Все APY и риски указаны корректно

- [ ] **Technical Information:**
  - [ ] Упоминается Canton Network
  - [ ] Упоминается DAML
  - [ ] Упоминается multi-party workflows
  - [ ] Технические детали корректны

**Команды для проверки:**

```bash
# Извлечь весь текст из компонента
grep -E '"[^"]{20,}"' \
  /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/components/defi/CantonDeFi.tsx \
  | head -30

# Проверить наличие ключевых слов
grep -E "(Canton|DAML|institutional|privacy|confidential|multi-party)" \
  /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/src/components/defi/CantonDeFi.tsx \
  -i | head -20
```

---

## 📊 VERIFICATION REPORT TEMPLATE

После выполнения всех проверок создать отчёт:

```markdown
# CantonDeFi Migration Verification Report

## Дата проверки: [DATE]
## Проверяющий: [NAME]

### 1. File Structure (Phase 1)
- [ ] Main Component: ✅/❌
- [ ] Services: X/13 проверено
- [ ] Hooks: X/3 проверено
- [ ] UI Components: X/4 проверено
- [ ] Store & Utils: X/2 проверено
- [ ] Config Files: X/2 проверено

### 2. Functionality (Phase 2)
- [ ] Real Estate Tokenization: ✅/❌
- [ ] Privacy Vaults: ✅/❌
- [ ] Cross-Chain Bridge: ✅/❌
- [ ] AI Portfolio Optimizer: ✅/❌
- [ ] Canton Coin Purchase: ✅/❌
- [ ] Multi-Party Workflows: ✅/❌
- [ ] DAML Integration: ✅/❌
- [ ] Performance Optimization: ✅/❌

### 3. Code Quality (Phase 3)
- [ ] TypeScript Errors: 0/X
- [ ] Build Status: ✅/❌
- [ ] Runtime Status: ✅/❌

### 4. Missing Components (Phase 4)
- [ ] Missing Files: [LIST]
- [ ] Missing Functions: [LIST]

### 5. UX/UI & Production-Ready (Phase 5)
- [ ] UI → Functionality Mapping: X/12 проверено
- [ ] Production-Ready UX: X/6 категорий проверено
- [ ] Canton Foundation Readiness: X/4 требования проверено
- [ ] Functional Testing: X/6 сценариев проверено
- [ ] Content & Messaging: X/3 категории проверено
- [ ] **Cross-Chain Wallet Integration: X/7 категорий проверено**

### Итоговый статус: ✅ COMPLETE / ⚠️ PARTIAL / ❌ INCOMPLETE

### Найденные проблемы:
1. [PROBLEM 1]
2. [PROBLEM 2]
...

### Рекомендации:
1. [RECOMMENDATION 1]
2. [RECOMMENDATION 2]
...
```

---

## 🚀 EXECUTION PLAN

### Шаг 1: Подготовка
```bash
# Создать директорию для отчётов
mkdir -p /tmp/canton-defi-verification

# Сохранить текущее состояние
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc
git status > /tmp/canton-defi-verification/git_status.txt
```

### Шаг 2: Выполнить все проверки Phase 1-5
Выполнить все команды из чеклиста выше и сохранить результаты.
**Внимание:** 
- Phase 5 (UX/UI Verification) критична для презентации Canton Foundation!
- **Step 20 (Cross-Chain Wallet Integration) критичен для мультичейн кошелька - приоритетный продукт!**

### Шаг 3: Создать детальный отчёт
Создать файл `CANTON_DEFI_MIGRATION_VERIFICATION_REPORT.md` с результатами.

### Шаг 4: Исправить найденные проблемы
Если найдены проблемы, создать задачи для их исправления.

---

## ✅ SUCCESS CRITERIA

Миграция считается **ПОЛНОСТЬЮ ЗАВЕРШЁННОЙ** когда:

1. ✅ Все файлы перенесены (0 missing files)
2. ✅ Все функции перенесены (0 missing functions)
3. ✅ Все зависимости установлены
4. ✅ TypeScript ошибок: 0
5. ✅ Build проходит успешно
6. ✅ Runtime работает без ошибок
7. ✅ Все фичи функционируют идентично исходной версии
8. ✅ **UX/UI соответствует реальному функционалу (100% mapping)**
9. ✅ **Production-ready best practices соблюдены**
10. ✅ **Готовность к презентации Canton Foundation подтверждена**
11. ✅ **Все UI элементы функциональны (нет placeholder кнопок)**
12. ✅ **Контент актуален для институционалов, конфиденциальности, модульности**
13. ✅ **Кроссчейн кошелёк интегрирован и работает (мультичейн поддержка)**
14. ✅ **Bridge функционал работает для всех поддерживаемых сетей**
15. ✅ **Canton Network интегрирован в wallet provider**

---

## 📝 NOTES

- **Допустимые различия:**
  - Адаптация импортов под Next.js структуру
  - Изменения в путях (`@/lib/canton/...` вместо `entities/Canton/...`)
  - Добавление `'use client'` директив
  - Адаптация под Next.js 15 App Router

- **Недопустимые различия:**
  - Потеря функциональности
  - Отсутствующие методы/функции
  - Изменение логики работы
  - Потеря типов или интерфейсов

---

---

## 🎯 CANTON FOUNDATION PRESENTATION CONTEXT

### Ключевые требования для презентации:

**Приоритетные продукты:**
1. **ОТС платформа** (самый приоритетный)
   - Полностью на смарт-контрактах
   - Самодостаточный продукт
   - MVP для аккредитив решения
   - Интеграция с банком через оффчейн оракул

2. **Лендинг платформа**
   - Позиционирование как лендинг протокол
   - Поддержка RWA / акций
   - Модуль для даркпул биржи

3. **Кошелек**
   - Необходимый элемент для всех продуктов
   - Мультичейн поддержка
   - Интеграция с AMM и лендингом

4. **DEX**
   - Может быть отдельным продуктом
   - Или элементом других продуктов (AMM внутри кошелька)

**Ключевые ценности для Canton Foundation:**
- Институционалы (institutional investors)
- Конфиденциальность (privacy-preserving)
- Модульность (modular architecture)
- Пользователи, транзакции, ликвидность, юзкейсы

**Что нужно показать:**
- Что есть (текущее состояние)
- Сколько потрачено времени/ресурсов
- Роадмап до MVP и готового продукта
- Наличие аудита, клиентов
- Возможности интеграции (API, смарт-контракты)
- Технический стек
- Командные и финансовые ресурсы

---

**Document Version:** 2.0  
**Last Updated:** 2026-01-20  
**Estimated Effort:** 4-5 hours (включая UX/UI verification)  
**Confidence Level:** HIGH - Comprehensive verification checklist + Production-ready UX/UI
