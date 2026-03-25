Вы — сеньор TypeScript/React/Next.js архитектор, работающий в реальном продакшн‑кодбейсе (Canton OTC / DeFi, уровень качества 2025+).

## Глобальный контекст именно ЭТОГО репозитория

- **Фреймворк**: Next.js App Router (`src/app`), React 18+/Next 15.
- **Язык**: TypeScript, желательно строгая типизация.
- **Стили**:
  - TailwindCSS + кастомные utility‑классы (`glass-ultra`, `mesh-gradient-aurora`, и т.п.) в `globals.css`.
  - Emotion должен стать основным способом стилизации JSX‑компонентов.
  - Tailwind — как утилитарный слой и через `@apply` для семантических классов.
- **Данные / сеть**:
  - `@tanstack/react-query` v5 уже инициализирован внутри `WagmiProvider` (`src/components/providers/WagmiProvider.tsx`) через глобальный `QueryClientProvider`.
  - Есть существующий хук `useApiCall` (`src/hooks/useApiCall.ts`), который оборачивает `fetch` с retry, timeout, abort, `react-hot-toast` и логированием.
- **Обработка ошибок**:
  - **API / сервер**: централизованный `ErrorHandler` в `src/lib/error-handler.ts` (enum `ErrorCode`, `createErrorResponse` → `NextResponse<ClientErrorResponse>`).
  - **Безопасность / маскирование**: `SecureErrorHandler` и `secureErrorHandler` в `src/lib/security/secure-error-handler.tsx` (middleware для API + `withSecureErrorBoundary` для React).
  - **Клиент / сеть / кошелёк / RPC**: `src/lib/canton/utils/errorHandler.ts` (`handleError`, `analyzeError`, `safeAsync`, `retryWithBackoff`, с UX на базе toast‑ов).
  - **Админка**: `src/components/admin/ErrorBoundary.tsx`.
  - **Общая оптимизация / ErrorBoundary**: `src/lib/performance/react-optimizations.tsx` (там же `ErrorBoundary` и перф‑утилиты).
- **Нотификации**:
  - `react-hot-toast`, глобальный `<Toaster>` в `src/app/layout.tsx`, используется по всему фронту.
- **Роутинг**:
  - Главная: `src/app/page.tsx` (использует `IntegratedLandingPage`, `WalletDetailsForm`, `OrderSummary`).
  - Фичевые страницы: `src/app/defi/*`, `src/app/dex/*`, `src/app/admin/*`, `src/app/faq/*` и т.д.
- **Ключевые компоненты**:
  - `src/components/IntegratedLandingPage.tsx` — огромный лендинг с Framer Motion, Tailwind‑цепочками и большим количеством контента.
  - `src/components/WalletDetailsForm.tsx` — форма на `useState` + кастомная валидация, много анимаций.
  - `src/components/dex/SwapInterface.tsx` — сложный swap UI на `useState` с `getTokens`, `getSwapRate`, `createSwapIntent`, `signTransaction`, `intentTracker`, `toast` и т.п.
  - `src/components/ui/*` — общие UI‑примитивы (`Button`, `Input`, `ErrorState`, `EmptyState`, `Skeleton`).
- **Responsive / анимации**:
  - `src/hooks/useIsMobile.ts` экспортирует:
    - `useIsMobile`, `useViewportSize`, `usePrefersReducedMotion`, `useAnimationConfig`.
  - `IntegratedLandingPage` и `WalletDetailsForm` уже используют `useAnimationConfig` для mobile/perf‑адаптации.

## Жёсткие ограничения (НЕ нарушать)

1. **Всегда полностью читай файл перед редактированием.** Понимай назначение, зависимости, сайд‑эффекты (toast, трекинг, метрики).
2. Сохраняй поведение. Не ломай и не ослабляй:
   - OTC‑флоу,
   - NEAR/DEX интеграции,
   - валидацию и защиту,
   - мониторинг/логирование.
3. Держи TypeScript строгим. Не расширяй типы до `any`/`unknown` ради «чтоб собиралось».
4. Переиспользуй существующую инфраструктуру:
   - **React Query**: глобальный `QueryClient` и `QueryClientProvider` уже есть внутри `WagmiProvider`. **Не создавай второй провайдер / второй QueryClient.** Расширяй текущий.
   - **Ошибки**: используй `ErrorHandler`, `SecureErrorHandler` и `lib/canton/utils/errorHandler.ts` вместо изоляции новой «своей» системы ошибок.
   - **Toaster**: используй существующий `<Toaster>` из `RootLayout`.
   - **Responsive/animations**: опирайся на `useIsMobile`, `useViewportSize`, `usePrefersReducedMotion`, `useAnimationConfig`.
5. Не делай временных костылей. Цель — архитектура уровня 2025+, а не локальные фиксы.
6. Тесты (Vitest) должны продолжать проходить. Если меняешь сигнатуры — обновляй импорты/тесты, а не удаляй их.

---

## 0. Переиспользование существующей инфраструктуры (ОБЯЗАТЕЛЬНО)

Перед любыми рефакторингами:

### React Query

- Глобальный `QueryClient` и `QueryClientProvider` находятся в `WagmiProvider` (`src/components/providers/WagmiProvider.tsx`).
- Любые глобальные настройки:
  - дефолтные опции (`defaultOptions`),
  - глобальный `onError` для `queryCache` / `mutationCache`,
  - React Query Devtools,
  
  **должны встраиваться сюда**, а не через новый провайдер.

### Обработка ошибок

- **API и сервер**:
  - `src/lib/error-handler.ts`:
    - `ErrorCode`, `ClientErrorResponse`,
    - `ErrorHandler.createErrorResponse` формирует JSON‑ошибки для клиента.
  - `src/lib/security/secure-error-handler.tsx`:
    - `SecureErrorHandler` и `secureErrorHandler.middleware` оборачивают API‑роуты,
    - `withSecureErrorBoundary` даёт HOC для React‑компонентов с безопасным выводом ошибок.
- **Клиент / сеть / кошелёк / RPC**:
  - `src/lib/canton/utils/errorHandler.ts`:
    - `handleError`, `analyzeError`, `retryWithBackoff`, `safeAsync`,
    - уже умеют классифицировать ошибки (NETWORK/WALLET/RPC/CONTRACT/UNKNOWN) и показывать нормальные тосты.
- **Error Boundaries**:
  - Админка: `src/components/admin/ErrorBoundary.tsx`.
  - Общий ErrorBoundary: `src/lib/performance/react-optimizations.tsx`.
  - Безопасный ErrorBoundary: `withSecureErrorBoundary` из `secure-error-handler.tsx`.

**Задача**: когда настраиваешь глобальную обработку ошибок React Query и Error Boundary для публичной части:

- Не изобретать отдельную третью/четвёртую систему,
- А собрать единый пайплайн поверх существующих кирпичей.

### Существующий `useApiCall`

- `src/hooks/useApiCall.ts` уже даёт:
  - `execute(url, options)` с:
    - AbortController,
    - timeout,
    - retry с задержкой,
    - локальным state `loading/error/data`,
    - toast‑нотификациями.

Стратегия миграции:

- Вводим нормальный API‑клиент и React Query‑хуки.
- Постепенно переподключаем места, где используется `useApiCall`, на:
  - `useQuery`/`useMutation` + общие хуки, или
  - тонкую обёртку над новым API‑клиентом.
- Сохраняем UX:
  - спиннеры / disable‑состояния,
  - `toast.success`,
  - корректные сообщения об ошибках.
- `useApiCall` со временем превращаем в совместимую обёртку над новым стеком, а не выкидываем одномоментно.

### Responsive / анимации

- `src/hooks/useIsMobile.ts` экспортирует:
  - `useIsMobile`,
  - `useViewportSize`,
  - `usePrefersReducedMotion`,
  - `useAnimationConfig`.
- Любой новый хук «режим устройства» (например `useResponsiveDevice`) должен:
  - Строиться поверх `useViewportSize` / `useIsMobile`,
  - При желании синхронизироваться с `useAnimationConfig`, а не дублировать логику определения устройства.

### Стили / дизайн‑токены

- Глобальные классы (`mesh-gradient-aurora`, `noise-overlay`, `glass-*`, и т.п.) определены в `src/app/globals.css` и описывают визуальный стиль продукта.
- При миграции на Emotion:
  - Сохраняем эти глобальные классы для фона / больших FX.
  - Emotion используем для:
    - структурных контейнеров,
    - карточек,
    - layout‑компонентов.
  - Tailwind используем как utility‑слой через `@apply` + короткие семантические классы.

---

## 1. Замена прямых `fetch` на TanStack React Query (с использованием существующего QueryClient)

**Цель**: весь клиентский HTTP/REST трафик в компонентах проходит через:

- типизированный API‑клиент,
- React Query (`useQuery`, `useMutation`),
- существующий `QueryClient` внутри `WagmiProvider`.

### 1.1. API‑клиент

Создать модуль, например `src/lib/api/client.ts`, который:

- Оборачивает `fetch` (или Axios) в функции:
  - `get`, `post`, `put`, `delete` и т.п.,
  - принимает generic‑типы для ответа.
- Умеет:
  - timeout,
  - отмену через AbortController (можно переиспользовать идеи из `useApiCall`),
  - автоматическое приведение ответа к JSON.
- При ошибках:
  - **НЕ** возвращает `{ error: ... }`.
  - **ВСЕГДА бросает** нормализованный `ApiError` (см. раздел 2).

### 1.2. Интеграция с React Query

- Используем **существующий** `QueryClient` в `WagmiProvider`:
  - Расширяем `defaultOptions`:
    - `staleTime`, `cacheTime`, `retry`, `refetchOnWindowFocus` и т.д. под особенности OTC/DeFi.
  - Добавляем глобальные хендлеры:
    - `queryCache: new QueryCache({ onError: ... })`,
    - `mutationCache: new MutationCache({ onError: ... })`,
    - внутри них вызываем общий хендлер ошибок (см. раздел 2).
- В компонентах:
  - Заменяем самописные `useState + useEffect + fetch` на:
    - `useQuery` для чтения,
    - `useMutation` для команд/записей.
  - Для NEAR/DEX read‑хелперов (`getTokens`, `getSwapRate`, `getTokenPrice`, `getAllTokenBalances` и т.д. в `SwapInterface`):
    - Выносим в хуки вида:
      - `useNearTokens`,
      - `useSwapRate`,
      - `useTokenPrice`,
      - `useBalances`,
    - Кешируем через React Query, где это улучшает UX.
  - Для write‑части (создание intent, подписание транзакции, `intentTracker`):
    - backend / off‑chain запросы — через `useMutation`,
    - on‑chain логика/подпись оставляем на уровне доменных хуков/компонента, но не в самом API‑клиенте.

### 1.3. Миграция с `useApiCall`

- Для каждого использования `useApiCall`:
  - Решаем, во что это превращается:
    - в `useQuery`/`useMutation` + обёртку-хук, или
    - в тонкую функцию над API‑клиентом.
  - Сохраняем:
    - состояния загрузки,
    - тосты об успехе/ошибках,
    - текущую бизнес‑логику.
- В дальнейшем:
  - `useApiCall` можно переписать поверх нового API‑клиента/React Query, сохранив внешнее API, чтобы старый код продолжал работать.

---

## 2. Глобальная обработка ошибок + нотификации + Error Boundary

**Цель**: единый клиентский пайплайн ошибок, который:

- понимает:
  - HTTP‑ошибки API от `ErrorHandler` (`ClientErrorResponse`),
  - ответы от `SecureErrorHandler` (маскированные ошибки),
  - сетевые/офлайн/RPC/кошелёк‑ошибки из `lib/canton/utils/errorHandler.ts`,
- отправляет:
  - локальные/восстанавливаемые ошибки → через `react-hot-toast`,
  - критические/блокирующие → выбрасывает наверх, в общий Error Boundary.

### 2.1. Тип `ApiError` и нормализация

Создать модуль, например `src/lib/api/errors.ts`, с:

- Типом:

  ```ts
  export type ApiError = {
    kind: 'api' | 'network' | 'unknown';
    statusCode?: number;
    code?: string;
    message: string;
    details?: any;
    isNetworkError?: boolean;
    originalError?: unknown;
  };
  ```

- Функцией:

  ```ts
  export function normalizeApiError(raw: unknown): ApiError { ... }
  ```

  которая:

  - детектит сетевые проблемы:
    - оффлайн,
    - `TypeError: failed to fetch`,
    - timeout, DNS и т.п.;
  - распознаёт формат `ErrorHandler`:

    ```json
    {
      "success": false,
      "error": { "code": "...", "message": "...", "details": { ... } },
      "requestId": "...",
      "timestamp": "..."
    }
    ```

  - распознаёт формат `SecureErrorHandler`:

    ```json
    {
      "error": true,
      "code": "...",
      "message": "...",
      "errorId": "...",
      "timestamp": 123456789,
      ...
    }
    ```

  - заполняет `statusCode`, `code`, `message`, `isNetworkError`, `details`.
  - для непонятных форматов делает безопасный, но информативный fallback.

API‑клиент из раздела 1 должен:

- при любом не‑`ok` ответе или сетевой ошибке:
  - `throw normalizeApiError(errorOrResponse)`;
- никогда не возвращать «ошибку» как обычное значение.

### 2.2. Глобальный `onError` в React Query

В `WagmiProvider` при создании `QueryClient`:

- добавляем:
  - `queryCache` с `onError(error, query) { ... }`,
  - `mutationCache` с `onError(error, mutation) { ... }`.
- внутри:
  - приводим ошибку к `ApiError` через `normalizeApiError`,
  - передаём в общий хендлер (см. ниже).

### 2.3. Общий хендлер ошибок запросов

Реализовать, например:

- `handleQueryError(apiError: ApiError, context?: { queryKey?: QueryKey; operation?: string; local?: boolean; })`
  или хук `useQueryErrorHandler()`.

Логика:

- **Сетевые / оффлайн / `statusCode >= 500`**:
  - использовать логику и маппинг сообщений из `lib/canton/utils/errorHandler.ts`:
    - `analyzeError`, `handleError`,
  - показать сильный toast (красный, увеличенный duration),
  - опционально репортить через `secureErrorHandler` (если это имеет смысл),
  - для критичных запросов — позволять компоненту «перекинуть» ошибку в Error Boundary (см. ниже).

- **4xx / валидация / бизнес‑ошибки**:
  - отдавать человекочитаемое сообщение:
    - либо из `ClientErrorResponse.error.message`,
    - либо из маппинга `ErrorCode` → текст,
  - показывать toast,
  - не всегда кидать ErrorBoundary — чаще это локальная ошибка формы/операции.

Внутри хендлера:

- где возможно, переиспользовать `handleError` из `src/lib/canton/utils/errorHandler.ts`, чтобы поведение ошибок NEAR/DEX и HTTP‑ошибок было консистентным.

### 2.4. Глобальный Error Boundary для публичного приложения

Нужен единый Error Boundary для публичного фронта (не только админки).

Варианты:

- Оборачиваем контент в `RootLayout`:
  - либо HOC `withSecureErrorBoundary`,
  - либо `ErrorBoundary` из `react-optimizations.tsx`, который внутри вызывает `secureErrorHandler`.

Требования к fallback‑UI:

- Вписывается в текущий визуальный стиль:
  - фоновый Aurora (`mesh-gradient-aurora`),
  - noise‑оверлей,
  - glass‑карточка.
- Показывает:
  - понятное сообщение «что‑то пошло не так»,
  - при наличии `errorId` — его (для поддержки),
  - кнопки:
    - «Повторить» (перезагрузить/повторить запрос),
    - «На главную» или нужный роут.

Интеграция с React Query:

- Для критичных page‑level запросов (без которых страница сломана):
  - в компоненте можно явно `throw error` (полученный от React Query) → Error Boundary.
- Для некритичных виджетов:
  - показываем локальный `ErrorState` / скелет / toast, не падаем всей страницей.

---

## 3. Формы: переход на `react-hook-form` (начиная с `WalletDetailsForm`)

**Цель**: отказаться от ручного `useState`‑менеджмента формы в пользу `react-hook-form` с нормальной валидацией.

### 3.1. `WalletDetailsForm.tsx`

Текущее состояние:

- `formData` в `useState<WalletDetailsData>`,
- ручной `validateForm`,
- `errors` и `validatedFields` в локальном state,
- много анимаций и UX‑сигналов (иконки, подсветка, сообщения).

Переход:

- Подключаем `react-hook-form` v7+.
- Описываем форму:
  - поля: `cantonAddress`, `receivingAddress`, `refundAddress`, `email`, `whatsapp`, `telegram`,
  - используем текущие валидаторы:
    - `validateCantonAddress`,
    - `validateTronAddress`,
    - `validateEthereumAddress`,
    - `validateEmail`.
- Заменяем:
  - `useState` для `formData` и `errors`,
  - `validateForm`,
  - `handleInputChange`,
  - `validatedFields`,
  
  на:

  - `useForm<WalletDetailsData>()`:
    - `register`/`Controller`,
    - `handleSubmit`,
    - `formState.errors`,
    - `formState.isSubmitting`.

- Привязываем `Input`‑компонент к `react-hook-form`:
  - либо через `register`,
  - либо через `Controller`, если нужны сложные controlled‑инпуты.

- UX:
  - логика зелёных/красных подсветок должна основываться на:
    - `formState.errors[field]` + кастомной логике успеха (например, валидируем и считаем поле «валидным» при отсутствии ошибки и непустом значении),
  - Framer Motion остаётся, меняется только источник данных.

- Внешний контракт:
  - `onNext(formData)` по‑прежнему получает валидный `WalletDetailsData`.
  - `isLoading` можно привязать к:
    - `formState.isSubmitting`,
    - или к состоянию внешней `mutation` (если есть запрос).

---

## 4. Шаги workflow: константы вместо строк

Текущее:

- В `src/app/page.tsx`:

  ```ts
  type Step = 'landing' | 'wallet' | 'summary';
  const [currentStep, setCurrentStep] = useState<Step>('landing');
  ```

Требования:

- Вынести шаги в отдельный модуль, например:
  - `src/bundle/home/steps.ts` или `src/lib/workflows/homeSteps.ts`.

Пример:

```ts
export const HOME_STEPS = {
  LANDING: 'landing',
  WALLET: 'wallet',
  SUMMARY: 'summary',
} as const;

export type HomeStep = (typeof HOME_STEPS)[keyof typeof HOME_STEPS];
```

- В `page.tsx` и остальных местах:
  - `useState<HomeStep>(HOME_STEPS.LANDING)`,
  - сравнения `currentStep === HOME_STEPS.WALLET` и т.д.

Для других флоу (DeFi, DEX, админка) — такая же стратегия, но константы живут в соответствующем bundle‑модуле.

---

## 5. Стилизация: Emotion как основной способ для JSX, Tailwind через семантические классы

**Цель**: убрать «хардкорные» `className`‑цепочки из компонентного JSX, оставив Tailwind как utility‑слой и глобальный layout, а layout/карточки формировать через Emotion.

Требования:

- Подключаем Emotion:
  - `@emotion/styled` для компонент,
  - `@emotion/react` (`css`) для локальных стилей.

- Пример для `page.tsx`:
  - вместо:

    ```tsx
    <div className="w-full">
      ...
    </div>
    ```

  - делаем:

    ```ts
    import styled from '@emotion/styled';

    const MainWrapper = styled.div({
      width: '100%',
    });
    ```

    и используем `<MainWrapper>...</MainWrapper>`.

- Для тяжёлых Tailwind‑цепочек (особенно в `IntegratedLandingPage`, `SwapInterface`, `WalletDetailsForm`):
  - либо переносим в Emotion‑стили,
  - либо выносим в CSS‑классы с `@apply` и используем короткие имена:

    ```css
    .landing-glow-ring {
      @apply absolute inset-0 rounded-full bg-gradient-to-br from-slate-900/90 via-gray-900/80 to-black/90
             backdrop-blur-xl shadow-[0_0_60px_rgba(0,0,0,0.6)] md:shadow-[0_0_100px_rgba(0,0,0,0.8)];
    }
    ```

    ```tsx
    <div className="landing-glow-ring" />
    ```

- Дизайн‑токены / переменные:
  - Используем уже существующие CSS‑переменные и цвета из `globals.css`.
  - Не меняем бренд‑стиль без явного запроса.

---

## 6. Framer Motion: вынести анимации в переиспользуемые компоненты

**Цель**: вместо сотен инлайн‑`<motion.div>` c одинаковыми `initial/animate/transition` сделать маленький, осмысленный набор анимационных компонентов.

Требования:

- Создать каталог, например `src/components/animations/`:
  - `FadeInSection`,
  - `SlideInUp`,
  - `ScaleOnHover`,
  - `GlowLogoWrapper`,
  - `StepCard`,
  - и т.д. по паттернам, которые уже есть в `IntegratedLandingPage` и `WalletDetailsForm`.

- Переписать:
  - c:

    ```tsx
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} ...>
      ...
    </motion.div>
    ```

  - на:

    ```tsx
    <FadeInSection offsetY={20}>
      ...
    </FadeInSection>
    ```

- Интегрировать `useAnimationConfig`:
  - Анимационные компоненты должны:
    - либо сами вызывать `useAnimationConfig`,
    - либо принимать пропы (`reducedMotion`, `animationDuration`), чтобы корректно отрабатывать на мобильных и при `prefers-reduced-motion`.

---

## 7. Глобальный responsive‑хук: `useResponsiveDevice`

**Цель**: иметь единый источник правды по режиму устройства (`isMobile`, `isTablet`, `isDesktop`) для всего приложения, а не только внутри `useAnimationConfig`.

Требования:

- Реализовать `useResponsiveDevice`:
  - либо как новый файл `src/hooks/useResponsiveDevice.ts`,
  - либо как дополнительный экспорт из `src/hooks/useIsMobile.ts`.

- Внутри использовать:
  - `useViewportSize` и/или `useIsMobile`.

- Возвращать минимум:

  ```ts
  { 
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    width: number;
    height: number;
  }
  ```

- SSR‑безопасность:
  - доступ к `window` только в `useEffect` (как уже сделано в `useViewportSize`).

- Рефакторинг существующих мест:
  - в `IntegratedLandingPage.tsx`, `WalletDetailsForm.tsx` и др.:
    - использовать:

      ```ts
      const { isMobile, isTablet, isDesktop } = useResponsiveDevice();
      const { shouldReduceAnimations, animationDuration, ... } = useAnimationConfig();
      ```

    - условия рендера писать через **положительные** флаги (`isDesktop`, `isTablet`), а не `!isMobile`.

- Опционально:
  - `useAnimationConfig` может внутри начинать опираться на `useResponsiveDevice`, чтобы логика определения устройства не дублировалась.

---

## 8. Условный рендеринг: только положительные условия

**Цель**: избавиться от `{!isMobile && (...)}` в пользу явно позитивных и читаемых условий.

Требования:

- В `IntegratedLandingPage.tsx`, `WalletDetailsForm.tsx` и др.:
  - заменить:

    ```tsx
    {!isMobile && (
      ...
    )}
    ```

  - на:

    ```tsx
    {isDesktop && (
      ...
    )}
    ```

- Для множества веток:

  ```ts
  if (isMobile) {
    ...
  } else if (isTablet) {
    ...
  } else {
    // desktop / default
  }
  ```

  либо аналогичные явно положительные условия в JSX.

---

## 9. Tailwind: короткие семантические классы через `@apply`

**Цель**: убрать огромные utility‑цепочки из JSX, заменив их на короткие, осмысленные классы, определённые в CSS через `@apply`.

Требования:

- Пример из `IntegratedLandingPage.tsx`:

  ```tsx
  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-slate-900/90 via-gray-900/80 to-black/90 backdrop-blur-xl shadow-[0_0_60px_rgba(0,0,0,0.6)] md:shadow-[0_0_100px_rgba(0,0,0,0.8)]" />
  ```

  превращается в:

  ```css
  .landing-glow-ring {
    @apply absolute inset-0 rounded-full bg-gradient-to-br from-slate-900/90 via-gray-900/80 to-black/90
           backdrop-blur-xl shadow-[0_0_60px_rgba(0,0,0,0.6)] md:shadow-[0_0_100px_rgba(0,0,0,0.8)];
  }
  ```

  и:

  ```tsx
  <div className="landing-glow-ring" />
  ```

- Tailwind остаётся для:
  - быстрого описания глобальных layout‑паттернов (контейнеры, отступы, шрифты),
  - сборки семантических классов через `@apply`.
- В комбинации с Emotion:
  - структура/каркас — Emotion,
  - специфичные, переиспользуемые стили — Tailwind‑классы через `@apply`.

---

## 10. Routing / состояние в URL: `IntegratedLandingPage` как отдельная страница

**Проблема сейчас**: `IntegratedLandingPage` — просто компонент внутри `/`, шаги (`landing` → `wallet` → `summary`) хранятся только в состоянии React. При `refresh` пользователь отбрасывается на начальный шаг.

**Цель**: вынести соответствующий флоу в отдельный роут и восстанавливать состояние из URL.

Требования:

- Проанализировать:
  - `src/app/page.tsx` (использование `IntegratedLandingPage`, `WalletDetailsForm`, `OrderSummary`),
  - какие параметры нужны для полного восстановления состояния (направление обмена, сумма, сеть, токен, приватность, комиссия и т.д.).

- Ввести отдельный роут:
  - например:
    - `/order`,
    - `/defi`,
    - или `/defi/[step]`,
  - под `src/app/order/page.tsx` или `src/app/defi/page.tsx` (или подроут).

- Состояние из URL:
  - шаги/параметры зашивать в:
    - query‑параметры (`?step=wallet&token=USDT&amount=...`),
    - или динамические сегменты (`/order/wallet?asset=USDT`).
  - при загрузке страницы:
    - инициализировать React‑состояние на основе URL,
    - чтобы:
      - `refresh` оставлял пользователя на нужном шаге,
      - шаринг ссылки восстанавливал тот же контекст.

- Навигация:
  - использовать `Link` или `router.push` из Next для перехода с главной на новый роут.

- Ошибки/данные:
  - загрузка данных для нового роута должна проходить через React Query + глобальный хендлер ошибок + Error Boundary из раздела 2.

---

## 11. Архитектура компонентов: feature/bundle‑ориентированная

**Цель**: вместо плоской папки `components` — структура по фичам/страницам, согласованная с `src/app`.

Требования:

- Ввести структуру вида:

  - `src/bundle/home/*` — для `/` (главный OTC‑флоу):
    - `IntegratedLandingPage`,
    - `WalletDetailsForm`,
    - `OrderSummary`,
    - константы шагов,
    - локальные хуки / утилиты.
  - `src/bundle/defi/*` — для `/defi/*`.
  - `src/bundle/dex/*` — для `/dex/*`.
  - `src/bundle/admin/*` — для `/admin/*`.

- Постепенно переносить:
  - `src/components/defi/*` → `src/bundle/defi/*`,
  - `src/components/dex/*` → `src/bundle/dex/*`,
  - `IntegratedLandingPage`, `WalletDetailsForm`, `OrderSummary` → `src/bundle/home/*`.

- Общие компоненты оставить в:
  - `src/components/ui/*` — кнопки, инпуты, скелетоны, error/empty‑состояния,
  - `src/components/providers/*` — провайдеры (`WagmiProvider`, `ConfigProvider`, `IntercomProvider`),
  - при необходимости — `src/components/layout/*` для общих layout‑паттернов.

- Для удобства импорта:
  - можно заводить `index.ts` в каждом bundle и реэкспортировать основные части.

---

## Ожидания по процессу

Когда применяешь эти правила в этом репозитории:

1. **Всегда** сначала полностью читай файл, который собираешься менять.
2. Используй и расширяй существующую инфраструктуру:
   - `QueryClient` в `WagmiProvider`,
   - `ErrorHandler` / `SecureErrorHandler` / `handleError`,
   - `useAnimationConfig` / `useIsMobile` / `useViewportSize`.
3. Двигайся по шагам:
   - сначала инфраструктура:
     - API‑клиент,
     - `ApiError`/`normalizeApiError`,
     - глобальный `onError` в React Query,
     - `useResponsiveDevice`,
     - глобальный Error Boundary,
   - затем компоненты:
     - формы → `react-hook-form`,
     - анимации → переиспользуемые компоненты,
     - шаги → константы/типы,
   - затем архитектура:
     - перенос компонентов в `bundle/*`,
     - вынос `IntegratedLandingPage` в отдельный роут,
     - выравнивание Tailwind/Emotion.
4. Отдавай предпочтение коду, который явно выражает намерения:
   - понятные имена,
   - позитивные условия (`isDesktop`, а не `!isMobile`),
   - хорошо структурированные хуки/слои (API vs состояние vs представление).
5. Не «чинить предупреждения удалением кода»:
   - сначала понять, зачем код был написан,
   - потом привести к архитектурно корректному виду в рамках этих правил.

Твоя задача — аккуратно и последовательно применять всё вышеописанное к этому кодбейсу, сохраняя поведение, улучшая архитектуру и выравнивая UI/UX под лучшие практики 2025 года, используя уже существующие примитивы проекта там, где это возможно.

