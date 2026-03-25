# 🔧 CANTON DEFI BUILD FIX & DEPLOYMENT PROMPT

## КОНТЕКСТ

Проект `canton-otc` интегрирован с CantonDeFi на роуте `/defi`. Все production-ready сервисы созданы, но сборка падает из-за ошибок TypeScript. Нужно исправить все ошибки типов и добиться успешного деплоя в Kubernetes через GitHub Actions.

## ТЕКУЩИЙ СТАТУС

- ✅ Production сервисы созданы (cantonAuthService, grok4PortfolioService, zkProofService, monitoring, damlIntegrationService)
- ✅ Исправлен конфликт `dynamic` в `/defi/page.tsx`
- ✅ Исправлен `manifest.json`
- ✅ Создан `realBridgeConfig.ts`
- ❌ **Сборка падает** из-за ошибок TypeScript
- ❌ **GitHub Actions деплой не проходит** (build stage fails)

## СПИСОК ВСЕХ ОШИБОК TYPESCRIPT

Выполни `pnpm run type-check` и исправь ВСЕ ошибки:

### 1. Framer Motion Variants (ease property)
**Файлы:**
- `src/components/defi/CCPurchaseWidget.tsx:622` - variants с ease: string
- `src/components/defi/CantonDeFi.tsx:302` - heroVariants с ease

**Решение:** Убрать `ease` из всех `transition` объектов в variants, оставить только `duration`.

### 2. BigInt Literals (ES2017 target)
**Файлы:**
- `src/lib/canton/config/realBridgeConfig.ts:136-147` - BigInt literals (5000000000n)
- `src/lib/canton/services/zkProofService.ts:720` - BigInt literal (0n)

**Решение:** Заменить `5000000000n` на `BigInt('5000000000')`, `0n` на `BigInt(0)`.

### 3. StablecoinConfig.network не существует
**Файлы:**
- `src/components/defi/CCPurchaseWidget.tsx:658` - `selectedStablecoin.network`
- `src/components/defi/CCPurchaseWidget.tsx:112` - `stablecoin.network`

**Решение:** Использовать `stablecoin.networks[0]` вместо `stablecoin.network`, добавить type assertion.

### 4. Duplicate OptimizationResult
**Файл:** `src/lib/canton/index.ts:22,74`

**Решение:** Убрать дубликат экспорта `OptimizationResult` из store, оставить только из grok4PortfolioService.

### 5. Monitoring Registry может быть undefined
**Файл:** `src/lib/canton/services/monitoring.ts:43,215,222`

**Решение:** Добавить проверки на существование Registry перед использованием.

### 6. Отсутствующие свойства/методы
**Файлы:**
- `src/lib/canton/services/cantonBridgeService.ts:365` - `damlService.exercise` не существует
- `src/lib/canton/services/cantonBridgeService.ts:457` - `ETHEREUM_TO_BSC` не существует в gas settings
- `src/lib/canton/services/cantonBridgeService.ts:665-667` - `bsc`, `ethereum`, `polygon` не существуют
- `src/lib/canton/services/cantonBridgeService.ts:687-688` - `BSC_USDT`, `BSC_USDC` не существуют
- `src/lib/canton/services/damlIntegrationService.ts:704` - `ASSET_HOLDING_TEMPLATE` не существует
- `src/lib/canton/services/privacyVaultService.ts:521,590,630,642,737,866` - отсутствующие методы ZKProofService
- `src/lib/canton/hooks/useCantonBridge.ts:204` - `TOKEN_INFO` не определен
- `src/lib/canton/hooks/useCantonNetwork.ts:63-64,160-162` - отсутствующие константы

**Решение:** Либо добавить недостающие свойства/методы, либо закомментировать/удалить неиспользуемый код.

### 7. Импорты
**Файлы:**
- `src/components/defi/MultiPartyDashboard.tsx:36` - `multiPartyWorkflowService` не найден
- `src/lib/canton/services/ai/portfolioOptimizer.ts:17` - `@tensorflow/tfjs` не установлен

**Решение:** Либо установить зависимости, либо удалить неиспользуемые импорты.

### 8. Type Assertions
**Файлы:**
- `src/lib/canton/services/damlIntegrationService.ts:545,563,582` - `Contract<unknown>` не совместим с типизированными контрактами
- `src/lib/canton/store/cantonStore.ts:657,681` - проблемы с типами Zustand middleware

**Решение:** Добавить правильные type assertions или исправить типы.

### 9. StablecoinSelector TRON
**Файл:** `src/components/defi/StablecoinSelector.tsx:33,40`

**Решение:** Убрать `TRON` из конфига или добавить в `NetworkType`.

### 10. PropertyValuationAPI
**Файл:** `src/lib/canton/services/propertyValuationAPI.ts:407,898-902`

**Решение:** Инициализировать `goldmanSachsAPI` или сделать optional, исправить типы PropertyType.

## ПЛАН ДЕЙСТВИЙ

### ШАГ 1: Исправить все TypeScript ошибки
```bash
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc
pnpm run type-check > /tmp/typecheck-errors.log 2>&1
```

Исправь ВСЕ ошибки из лога, начиная с самых критичных:
1. BigInt literals
2. Framer Motion ease
3. Отсутствующие свойства
4. Дубликаты типов
5. Импорты

### ШАГ 2: Проверить сборку локально
```bash
NODE_OPTIONS='--max-old-space-size=8192' pnpm run build
```

Убедись что сборка проходит без ошибок (warnings допустимы).

### ШАГ 3: Коммит и пуш
```bash
git add -A
git commit -m "fix: Resolve all TypeScript errors for production build

- Fixed BigInt literals (ES2017 compatibility)
- Removed ease from framer-motion variants
- Fixed StablecoinConfig.network -> networks[0]
- Removed duplicate OptimizationResult export
- Fixed monitoring Registry undefined checks
- Added missing type assertions
- Fixed all import errors

Ready for production deployment"
git push origin main
```

### ШАГ 4: Мониторинг GitHub Actions
```bash
gh run watch
```

Дождись успешного завершения workflow и проверь деплой в Kubernetes.

### ШАГ 5: Проверка в проде
После успешного деплоя проверь:
- https://1otc.cc/defi - страница загружается
- Нет ошибок в консоли браузера
- Все компоненты рендерятся корректно

## КРИТИЧЕСКИЕ ФАЙЛЫ ДЛЯ ИСПРАВЛЕНИЯ

1. `src/lib/canton/config/realBridgeConfig.ts` - BigInt literals
2. `src/lib/canton/services/zkProofService.ts:720` - BigInt literal
3. `src/components/defi/CCPurchaseWidget.tsx` - network, ease, variants
4. `src/components/defi/CantonDeFi.tsx` - variants ease
5. `src/lib/canton/index.ts` - duplicate OptimizationResult
6. `src/lib/canton/services/monitoring.ts` - Registry undefined
7. `src/lib/canton/services/cantonBridgeService.ts` - отсутствующие свойства
8. `src/lib/canton/services/damlIntegrationService.ts` - type assertions
9. `src/lib/canton/hooks/useCantonBridge.ts` - TOKEN_INFO
10. `src/lib/canton/hooks/useCantonNetwork.ts` - отсутствующие константы

## ПРИОРИТЕТЫ

**КРИТИЧНО (блокирует сборку):**
1. BigInt literals → BigInt()
2. Framer Motion ease → убрать
3. network → networks[0]
4. Duplicate exports → убрать дубликаты

**ВАЖНО (может сломать runtime):**
5. Отсутствующие методы/свойства → добавить или удалить использование
6. Type assertions → исправить типы

**ЖЕЛАТЕЛЬНО (warnings):**
7. Импорты → установить или удалить
8. Optional properties → инициализировать

## ОЖИДАЕМЫЙ РЕЗУЛЬТАТ

После исправления всех ошибок:
- ✅ `pnpm run type-check` проходит без ошибок
- ✅ `pnpm run build` успешно компилируется
- ✅ GitHub Actions деплой проходит успешно
- ✅ Приложение доступно на https://1otc.cc/defi
- ✅ Все компоненты работают корректно

## ПРИМЕЧАНИЯ

- Warnings о missing peer dependencies (@wagmi/connectors) можно игнорировать - это опциональные зависимости
- Используй `NODE_OPTIONS='--max-old-space-size=8192'` для type-check и build
- Все изменения должны быть production-ready, без временных решений
- Следуй best practices TypeScript 2025

## ТЕКУЩИЙ ПРОГРЕСС

✅ **ИСПРАВЛЕНО (большая часть критичных ошибок):**
- BigInt literals → BigInt() 
- Framer Motion ease убран
- network → networks[0]
- Duplicate exports убраны
- Monitoring Registry checks добавлены
- TOKEN_INFO, getCurrentNetwork заменены
- WebSocket headers исправлено
- MultiPartyDashboard типы исправлены
- StablecoinSelector TRON/SOLANA убраны
- PropertyType расширен
- PrivacyVault ZKProof конфликт решен

❌ **ОСТАЛОСЬ ~53 ОШИБКИ:**
- Отсутствующие методы в privacyVaultService (initializeCircuits, generateCreationProof, generateOwnershipProof, createPedersenCommitment, generateAnalyticsProofs)
- Отсутствующие методы в cantonBridgeService (exercise, ETHEREUM_TO_BSC, bsc/ethereum/polygon properties, BSC_USDT/BSC_USDC)
- Отсутствующие методы в damlIntegrationService (create, isConnected, ASSET_HOLDING_TEMPLATE)
- Type assertions в damlIntegrationService (Contract<unknown> → типизированные контракты)
- Zustand store middleware types (cantonStore.ts:657,681)
- PropertyValuationAPI goldmanSachsAPI инициализация
- grok4PortfolioService отсутствующие методы (extractCantonYield, enhanceReasoningWithCantonContext, generateCantonScenarios)
- portfolioOptimizer @tensorflow/tfjs импорт
- cantonBridgeService PROCESSING_TIME_ESTIMATES индексация

**РЕШЕНИЕ:** Либо добавить недостающие методы/свойства, либо закомментировать/удалить их использование если они не критичны для сборки.

---

**НАЧНИ С:** `pnpm run type-check` → исправь оставшиеся 53 ошибки → `pnpm run build` → коммит → пуш → мониторинг деплоя
