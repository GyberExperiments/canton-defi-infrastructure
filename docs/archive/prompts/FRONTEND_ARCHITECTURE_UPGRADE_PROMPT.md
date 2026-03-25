# Промпт: апгрейд фронтенд-архитектуры Canton OTC / DeFi

Вы — сеньор TypeScript/React/Next.js архитектор, работающий в реальном продакшн‑кодбейсе (Canton OTC / DeFi, уровень качества 2025+).

## Глобальный контекст именно ЭТОГО репозитория

- **Фреймворк:** Next.js App Router (`src/app`), React 19+/Next 16.
- **Язык:** TypeScript, желательно строгая типизация.
- **Стили:**
  - TailwindCSS + кастомные utility‑классы (`glass-ultra`, mesh-gradient-aurora, и т.п.) в globals.css.
  - Emotion должен стать основным способом стилизации JSX‑компонентов.
  - Tailwind — как утилитарный слой и через @apply для семантических классов.
- **Данные / сеть:**
  - @tanstack/react-query v5 уже инициализирован внутри WagmiProvider (`src/components/providers/WagmiProvider.tsx`) через глобальный QueryClientProvider.
  - Есть существующий хук useApiCall (`src/hooks/useApiCall.ts`), который оборачивает fetch с retry, timeout, abort, react-hot-toast и логированием.
- **Обработка ошибок:**
  - API / сервер: централизованный ErrorHandler в src/lib/error-handler.ts (enum ErrorCode, createErrorResponse → `NextResponse<ClientErrorResponse>`).
  - Безопасность / маскирование: SecureErrorHandler и secureErrorHandler в src/lib/security/secure-error-handler.tsx (middleware для API + withSecureErrorBoundary для React).
  - Клиент / сеть / кошелёк / RPC: src/lib/canton/utils/errorHandler.ts (`handleError`, analyzeError, safeAsync, retryWithBackoff, с UX на базе toast‑ов).
  - Админка: src/components/admin/ErrorBoundary.tsx.
  - Общая оптимизация / ErrorBoundary: src/lib/performance/react-optimizations.tsx (там же ErrorBoundary и перф‑утилиты).
- **Нотификации:** react-hot-toast, глобальный `<Toaster>` в src/app/layout.tsx, используется по всему фронту.
- **Роутинг:** Главная: src/app/page.tsx (IntegratedLandingPage, WalletDetailsForm, OrderSummary). Фичевые страницы: src/app/defi/*, src/app/dex/*, src/app/admin/*, src/app/faq/* и т.д.
- **Ключевые компоненты:** IntegratedLandingPage, WalletDetailsForm, dex/SwapInterface, ui/* (Button, Input, ErrorState, EmptyState, Skeleton).
- **Responsive / анимации:** src/hooks/useIsMobile.ts — useIsMobile, useViewportSize, usePrefersReducedMotion, useAnimationConfig. IntegratedLandingPage и WalletDetailsForm уже используют useAnimationConfig.

## Жёсткие ограничения (НЕ нарушать)

1. Всегда полностью читай файл перед редактированием. Понимай назначение, зависимости, сайд‑эффекты (toast, трекинг, метрики).
2. Сохраняй поведение. Не ломай и не ослабляй: OTC‑флоу, NEAR/DEX интеграции, валидацию и защиту, мониторинг/логирование.
3. Держи TypeScript строгим. Не расширяй типы до any/unknown ради «чтоб собиралось».
4. Переиспользуй существующую инфраструктуру: React Query (глобальный QueryClient в WagmiProvider), ErrorHandler/SecureErrorHandler и lib/canton/utils/errorHandler.ts, существующий Toaster, useIsMobile/useViewportSize/usePrefersReducedMotion/useAnimationConfig.
5. Не делай временных костылей. Цель — архитектура уровня 2025+.
6. Тесты (Vitest) должны продолжать проходить. При изменении сигнатур — обновляй импорты/тесты, а не удаляй их.

---

## 0. Переиспользование существующей инфраструктуры (ОБЯЗАТЕЛЬНО)

### React Query

- Глобальный QueryClient и QueryClientProvider находятся в WagmiProvider (`src/components/providers/WagmiProvider.tsx`).
- Любые глобальные настройки (defaultOptions, onError для queryCache/mutationCache, React Query Devtools) должны встраиваться сюда, а не через новый провайдер.

### Обработка ошибок

- API и сервер: src/lib/error-handler.ts, src/lib/security/secure-error-handler.tsx.
- Клиент / сеть / кошелёк / RPC: src/lib/canton/utils/errorHandler.ts (handleError, analyzeError, retryWithBackoff, safeAsync).
- Error Boundaries: админка — src/components/admin/ErrorBoundary.tsx; общий — src/lib/performance/react-optimizations.tsx; безопасный — withSecureErrorBoundary из secure-error-handler.tsx.
- При настройке глобальной обработки ошибок React Query и Error Boundary для публичной части — не изобретать отдельную систему, а собрать единый пайплайн поверх существующих кирпичей.

### Существующий useApiCall

- src/hooks/useApiCall.ts даёт execute(url, options) с AbortController, timeout, retry, локальным state loading/error/data, toast‑нотификациями.
- Стратегия миграции: вводим API‑клиент и React Query‑хуки; постепенно переподключаем места с useApiCall на useQuery/useMutation или обёртку над новым API‑клиентом; сохраняем UX; useApiCall со временем превращаем в совместимую обёртку над новым стеком.

### Responsive / анимации

- src/hooks/useIsMobile.ts: useIsMobile, useViewportSize, usePrefersReducedMotion, useAnimationConfig.
- Любой новый хук «режим устройства» (например useResponsiveDevice) должен строиться поверх useViewportSize/useIsMobile и при желании синхронизироваться с useAnimationConfig.

### Стили / дизайн‑токены

- Глобальные классы в src/app/globals.css. При миграции на Emotion: сохранять эти классы для фона/FX; Emotion — для структурных контейнеров, карточек, layout; Tailwind — utility‑слой через @apply.

---

## 1. Замена прямых fetch на TanStack React Query (с существующим QueryClient)

- Типизированный API‑клиент (get, post, put, delete с timeout, AbortController, JSON, при ошибках — throw нормализованного ApiError).
- Интеграция с существующим QueryClient в WagmiProvider: расширить defaultOptions, добавить queryCache/mutationCache onError с общим хендлером.
- В компонентах: useQuery для чтения, useMutation для команд; для NEAR/DEX read‑хелперов — хуки useNearTokens, useSwapRate, useTokenPrice, useBalances с кешем; для write — backend/off‑chain через useMutation, on‑chain оставить в доменных хуках/компоненте.
- Миграция с useApiCall: каждое использование превращать в useQuery/useMutation или обёртку; сохранять состояния загрузки, тосты, бизнес‑логику; useApiCall со временем переписать поверх нового API‑клиента/React Query.

---

## 2. Глобальная обработка ошибок + нотификации + Error Boundary

- Единый клиентский пайплайн: понимает HTTP‑ошибки API (ClientErrorResponse), ответы SecureErrorHandler, сетевые/офлайн/RPC/кошелёк из lib/canton/utils/errorHandler.ts; локальные/восстанавливаемые — через react-hot-toast, критические — в общий Error Boundary.
- Тип ApiError и normalizeApiError (src/lib/api/errors.ts): kind, statusCode, code, message, details, isNetworkError; распознавать форматы ErrorHandler и SecureErrorHandler, сетевые проблемы; API‑клиент при !ok или сетевой ошибке — throw normalizeApiError.
- Глобальный onError в React Query (queryCache, mutationCache): нормализовать до ApiError, передавать в общий хендлер. REST/API ошибки обрабатывать отдельным handleApiError (маппинг по statusCode/code), не передавать в canton analyzeError/handleError (они для RPC/wallet). Для локально обрабатываемых запросов — meta.suppressGlobalErrorHandler, чтобы не дублировать тосты.
- Общий Error Boundary для публичного приложения: fallback‑UI в стиле продукта (mesh-gradient-aurora, noise-overlay, glass‑карточка), сообщение, errorId, кнопки «Повторить» и «На главную». Критичные page‑level запросы — throw error в Error Boundary; некритичные виджеты — локальный ErrorState/toast, meta.suppressGlobalErrorHandler.

---

## 3. Формы: переход на react-hook-form (начиная с WalletDetailsForm)

- WalletDetailsForm: заменить useState formData/errors/validateForm/validatedFields на useForm (register/Controller, handleSubmit, formState.errors, formState.isSubmitting).
- Поля и валидаторы: cantonAddress, receivingAddress, refundAddress, email, whatsapp, telegram; validateCantonAddress, validateTronAddress, validateEthereumAddress, validateEmail через validate/resolver.
- UX: зелёные/красные подсветки от formState.errors + факта заполнения; Framer Motion остаётся; onNext(formData) по‑прежнему получает валидный WalletDetailsData.

---

## 4. Шаги workflow: константы вместо строк

- Вынести шаги в модуль (например src/bundle/home/steps.ts или src/lib/workflows/homeSteps.ts): HOME_STEPS = { LANDING, WALLET, SUMMARY } as const, тип HomeStep.
- В page.tsx и остальных: useState<HomeStep>(HOME_STEPS.LANDING), сравнения currentStep === HOME_STEPS.WALLET и т.д. Для других флоу — та же стратегия в соответствующих bundle‑модулях.

---

## 5. Стилизация: Emotion как основной способ для JSX, Tailwind через семантические классы

- Подключить @emotion/styled и @emotion/react (css). Вместо длинных className‑цепочек — styled‑компоненты и короткие классы с @apply.
- Тяжёлые цепочки в IntegratedLandingPage, SwapInterface, WalletDetailsForm — перенос в Emotion или в CSS‑классы с @apply (например .landing-glow-ring). Использовать существующие CSS‑переменные и globals.css.

---

## 6. Framer Motion: вынести анимации в переиспользуемые компоненты

- Каталог src/components/animations/: FadeInSection, SlideInUp, ScaleOnHover, GlowLogoWrapper, StepCard и т.д. по паттернам из IntegratedLandingPage и WalletDetailsForm.
- Заменять повторяющиеся motion.div (initial/animate/transition) на эти компоненты (например FadeInSection offsetY={20}). Интегрировать useAnimationConfig (reducedMotion, animationDuration).

---

## 7. Глобальный responsive‑хук: useResponsiveDevice

- useResponsiveDevice (src/hooks/useResponsiveDevice.ts или экспорт из useIsMobile.ts): строить на useViewportSize/useIsMobile; возвращать { isMobile, isTablet, isDesktop, width, height }; SSR‑безопасно (window в useEffect).
- В IntegratedLandingPage, WalletDetailsForm и др. использовать useResponsiveDevice + useAnimationConfig; условия рендера — положительные (isDesktop, isTablet), не !isMobile.

---

## 8. Условный рендеринг: только положительные условия

- Заменить {!isMobile && (...)} на {isDesktop && (...)}. Для нескольких веток: if (isMobile) ... else if (isTablet) ... else (desktop).

---

## 9. Tailwind: короткие семантические классы через @apply

- Тяжёлые utility‑цепочки заменить на короткие классы в CSS через @apply (например .landing-glow-ring). Tailwind — для глобального layout и сборки семантических классов; в комбинации с Emotion: структура — Emotion, переиспользуемые стили — Tailwind‑классы через @apply.

---

## 10. Routing / состояние в URL: IntegratedLandingPage как отдельная страница

- Вынести флоу в отдельный роут (например /order под src/app/order/page.tsx). Состояние из URL: шаг и параметры (направление, сумма, сеть, токен, приватность, комиссия) — в query‑параметрах или динамических сегментах; при загрузке инициализировать React‑состояние из URL (refresh и шаринг ссылки восстанавливают контекст).
- Единственный источник правды для шага — URL; текущий шаг для рендера получать из useSearchParams; при переходе вызывать router.replace с новым step (навигация асинхронна, не полагаться на «синхронное» обновление).
- Навигация — Link или router.push; загрузка данных для роута — React Query + глобальный хендлер ошибок + Error Boundary.

---

## 11. Архитектура компонентов: feature/bundle‑ориентированная

- Структура: src/bundle/home/* (IntegratedLandingPage, WalletDetailsForm, OrderSummary, константы шагов, локальные хуки), src/bundle/defi/*, src/bundle/dex/*, src/bundle/admin/*.
- Перенос: src/components/defi/* → src/bundle/defi/*, src/components/dex/* → src/bundle/dex/*, IntegratedLandingPage, WalletDetailsForm, OrderSummary → src/bundle/home/*.
- Общие компоненты остаются в src/components/ui/*, src/components/providers/*; при необходимости src/components/layout/*. В каждом bundle — index.ts для реэкспорта.

---

## Ожидания по процессу

1. Всегда сначала полностью читай файл, который собираешься менять.
2. Используй и расширяй существующую инфраструктуру: QueryClient в WagmiProvider, ErrorHandler/SecureErrorHandler/handleError, useAnimationConfig/useIsMobile/useViewportSize.
3. Двигайся по шагам: сначала инфраструктура (API‑клиент, ApiError/normalizeApiError, глобальный onError, useResponsiveDevice, Error Boundary), затем компоненты (формы → react-hook-form, анимации → переиспользуемые компоненты, шаги → константы), затем архитектура (bundle/*, отдельный роут /order, Tailwind/Emotion).
4. Отдавай предпочтение коду с понятными именами, позитивными условиями (isDesktop, а не !isMobile), чёткими слоями (API vs состояние vs представление).
5. Не «чинить предупреждения удалением кода»: сначала понять, зачем код был написан, потом привести к архитектурно корректному виду в рамках этих правил.

Задача — аккуратно и последовательно применять всё вышеописанное к этому кодбейсу, сохраняя поведение, улучшая архитектуру и выравнивая UI/UX под лучшие практики 2025 года, используя уже существующие примитивы проекта там, где это возможно.
