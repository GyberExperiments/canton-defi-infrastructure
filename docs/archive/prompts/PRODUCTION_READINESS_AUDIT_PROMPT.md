# 🔍 ПРОМПТ: Полная проверка готовности проекта Canton OTC к продакшену

**Цель**: Провести комплексную проверку всех компонентов системы, убедиться что всё реализовано в реально рабочем боевом режиме и корректно настроено.

---

## 📋 ИНСТРУКЦИИ ДЛЯ AI АССИСТЕНТА

Ты - senior full-stack разработчик и DevOps инженер, который проводит финальную проверку готовности проекта **Canton OTC Exchange** к продакшену.

**Твоя задача**: Провести детальный аудит всех компонентов системы и убедиться что:
1. ✅ Все функции реализованы и работают
2. ✅ Всё настроено корректно для боевого режима
3. ✅ Безопасность на должном уровне
4. ✅ Интеграции работают
5. ✅ Конфигурация правильная
6. ✅ Документация актуальна

**Принципы работы**:
- Читай реальные файлы проекта, не фантазируй
- Проверяй код, конфигурацию, документацию
- Ищи проблемы и несоответствия
- Предлагай конкретные исправления
- Отвечай на русском языке
- Будь тщательным и внимательным

---

## 🎯 ЧТО ПРОВЕРИТЬ

### 1. 🏗️ АРХИТЕКТУРА И СТРУКТУРА ПРОЕКТА

#### 1.1. Структура проекта
- [ ] Проверить структуру директорий (`src/`, `services/`, `config/`, `docs/`)
- [ ] Убедиться что все основные компоненты на месте
- [ ] Проверить наличие всех необходимых конфигурационных файлов

**Файлы для проверки**:
- `package.json` - зависимости, скрипты
- `tsconfig.json` - конфигурация TypeScript
- `tailwind.config.ts` - конфигурация стилей
- `next.config.js` - конфигурация Next.js
- Структура `src/app/` - роуты и страницы
- Структура `src/components/` - компоненты
- Структура `src/lib/` - библиотеки и утилиты

#### 1.2. Основные компоненты системы
- [ ] **OTC Exchange** - обмен Canton Coin ↔ USDT
- [ ] **DEX (Decentralized Exchange)** - NEAR Intents интеграция
- [ ] **Solver Node** - автоматический исполнитель интентов
- [ ] **Admin Panel** - панель управления
- [ ] **CRM System** - управление клиентами

---

### 2. 🔄 OTC EXCHANGE (Основной функционал)

#### 2.1. Frontend компоненты
- [ ] `src/components/ExchangeForm.tsx` - основная форма обмена
- [ ] `src/components/ExchangeFormCompact.tsx` - компактная форма
- [ ] `src/components/TokenSelector.tsx` - выбор токенов
- [ ] Проверить валидацию адресов Canton (4 формата)
- [ ] Проверить расчеты сумм (BUY/SELL направления)
- [ ] Проверить отображение комиссий

**Что проверить**:
- Корректность расчетов сумм
- Валидация всех полей
- Обработка ошибок
- UI/UX соответствие дизайну

#### 2.2. API Endpoints
- [ ] `POST /api/create-order` - создание ордера
- [ ] `GET /api/order/[orderId]` - получение ордера
- [ ] `PATCH /api/order/[orderId]` - обновление статуса
- [ ] Проверить валидацию входных данных
- [ ] Проверить обработку ошибок
- [ ] Проверить rate limiting

**Файлы**:
- `src/app/api/create-order/route.ts`
- `src/app/api/order/[orderId]/route.ts`

#### 2.3. Интеграции
- [ ] **Google Sheets** - сохранение ордеров
  - Файл: `src/lib/services/googleSheets.ts`
  - Проверить credentials, API ключи
  - Проверить формат данных
  
- [ ] **Intercom** - чат поддержки
  - Файл: `src/lib/services/intercom.ts`
  - Проверить APP_ID, токены
  - Проверить интеграцию на страницах
  
- [ ] **Telegram** - уведомления (если используется)
  - Файл: `src/lib/services/telegram.ts`
  - Проверить BOT_TOKEN, CHAT_ID

- [ ] **Email (SMTP)** - отправка писем
  - Файл: `src/lib/services/email.ts`
  - Проверить SMTP настройки

---

### 3. 🔄 DEX (Decentralized Exchange)

#### 3.1. Frontend компоненты DEX
- [ ] `src/components/dex/SwapInterface.tsx` - интерфейс swap
- [ ] `src/components/dex/BridgeInterface.tsx` - интерфейс bridge
- [ ] `src/components/dex/NearWalletButton.tsx` - подключение кошелька
- [ ] `src/components/dex/IntentHistory.tsx` - история транзакций
- [ ] `src/components/dex/PriceChart.tsx` - графики цен
- [ ] `src/components/dex/AnalyticsDashboard.tsx` - аналитика
- [ ] Проверить интеграцию с NEAR Wallet Selector
- [ ] Проверить отображение цен в реальном времени
- [ ] Проверить расчет slippage

#### 3.2. API Endpoints DEX
- [ ] `POST /api/near-intents/swap` - создание swap intent
- [ ] `POST /api/near-intents/bridge` - создание bridge intent
- [ ] `GET /api/near-intents/status/[intentId]` - статус intent
- [ ] `GET /api/near-intents/user/[accountId]` - история пользователя

**Что проверить**:
- Валидация параметров (токены, суммы, сети)
- Проверка баланса пользователя
- Расчет комиссий DEX
- Передача `fee_recipient` адреса
- Обработка ошибок
- Интеграция с price oracle

**Файлы**:
- `src/app/api/near-intents/swap/route.ts`
- `src/app/api/near-intents/bridge/route.ts`
- `src/app/api/near-intents/status/[intentId]/route.ts`
- `src/app/api/near-intents/user/[accountId]/route.ts`

#### 3.3. NEAR Intents SDK
- [ ] `src/lib/near-intents-sdk.ts` - основной SDK
- [ ] Проверить все методы (swap, bridge, status, user)
- [ ] Проверить валидацию
- [ ] Проверить обработку ошибок
- [ ] Проверить интеграцию с NEAR RPC

#### 3.4. Price Oracle System
- [ ] `src/lib/price-oracle/index.ts` - единый oracle
- [ ] `src/lib/price-oracle/ref-finance.ts` - REF Finance
- [ ] `src/lib/price-oracle/pyth-network.ts` - Pyth Network
- [ ] Проверить fallback механизм
- [ ] Проверить кэширование
- [ ] Проверить расчет slippage

#### 3.5. Конфигурация DEX
- [ ] `src/lib/dex-config.ts` - конфигурация DEX
- [ ] Проверить чтение из ConfigMap
- [ ] Проверить fallback на env переменные
- [ ] Проверить адрес `fee_recipient` (должен быть: `7cf1dafc0445bd9f8646ea27d8c7d1f99c68d61cbc524756a33c95710d274ccb`)

---

### 4. 🤖 SOLVER NODE

#### 4.1. Структура Solver Node
- [ ] `services/solver-node/src/index.ts` - точка входа
- [ ] `services/solver-node/src/intent-monitor.ts` - мониторинг интентов
- [ ] `services/solver-node/src/profitability.ts` - расчет прибыльности
- [ ] `services/solver-node/src/executor.ts` - исполнение интентов
- [ ] `services/solver-node/src/near-signer.ts` - подписание транзакций
- [ ] `services/solver-node/src/ref-finance-swap.ts` - интеграция с REF
- [ ] `services/solver-node/src/price-oracle.ts` - получение цен

**Что проверить**:
- Логика мониторинга (polling интервал)
- Расчет прибыльности с учетом gas
- Исполнение через REF Finance
- Подписание транзакций
- Обработка ошибок и retry логика

#### 4.2. Конфигурация Solver Node
- [ ] `services/solver-node/package.json` - зависимости
- [ ] `services/solver-node/.env.example` - пример конфигурации
- [ ] Проверить что все необходимые env переменные описаны
- [ ] Проверить Kubernetes deployment манифесты

**Файлы**:
- `services/solver-node/k8s/deployment.yaml`
- Проверить использование секретов из External Secrets

#### 4.3. Тесты Solver Node
- [ ] `services/solver-node/__tests__/` - unit тесты
- [ ] Проверить покрытие тестами
- [ ] Проверить что тесты актуальны

---

### 5. 🔐 БЕЗОПАСНОСТЬ

#### 5.1. Secret Management
- [ ] Проверить что все секреты в GitHub Secrets (не в коде)
- [ ] Проверить External Secrets Operator конфигурацию
- [ ] Проверить что `NEAR_DEX_FEE_RECIPIENT` добавлен в GitHub Secrets
- [ ] Проверить что solver private key в секретах

**Файлы**:
- `config/kubernetes/k8s/minimal-stage/external-secret.yaml`
- Проверить что все критические секреты там

#### 5.2. Валидация и проверки
- [ ] Проверить валидацию адресов Canton (4 формата)
- [ ] Проверить валидацию сумм (мин/макс лимиты)
- [ ] Проверить валидацию токенов и сетей
- [ ] Проверить проверку баланса перед созданием intent
- [ ] Проверить tolerance для exchange rate (должен быть 0.1%, не 1%)

**Файлы для проверки**:
- `src/lib/validators.ts`
- `src/app/api/create-order/route.ts` - проверка tolerance
- `src/app/api/near-intents/swap/route.ts` - проверка баланса

#### 5.3. Rate Limiting
- [ ] Проверить настройки rate limiting
- [ ] Проверить anti-spam механизмы
- [ ] Проверить Redis для rate limiting (если используется)

**Файлы**:
- `src/lib/services/rateLimiter.ts`
- `src/lib/services/antiSpamService.ts`
- `src/lib/security/advanced-rate-limiter.ts`

#### 5.4. Error Handling
- [ ] Проверить что секретные данные не попадают в error messages
- [ ] Проверить логирование (без секретов)
- [ ] Проверить обработку всех типов ошибок

---

### 6. ⚙️ КОНФИГУРАЦИЯ

#### 6.1. Environment Variables
- [ ] `env.template` - проверить что все переменные описаны
- [ ] Проверить что `NEAR_DEX_FEE_RECIPIENT` указан в template
- [ ] Проверить что нет хардкода секретов в коде

#### 6.2. ConfigMap и Secrets
- [ ] `config/kubernetes/k8s/configmap.yaml` - production
- [ ] `config/kubernetes/k8s/minimal-stage/configmap.yaml` - staging
- [ ] Проверить что критические секреты НЕ в ConfigMap
- [ ] Проверить что все необходимые переменные есть

#### 6.3. Kubernetes Deployment
- [ ] `config/kubernetes/k8s/deployment.yaml` - production
- [ ] `config/kubernetes/k8s/minimal-stage/deployment.yaml` - staging
- [ ] Проверить использование секретов
- [ ] Проверить resource limits
- [ ] Проверить health checks
- [ ] Проверить namespace

#### 6.4. External Secrets
- [ ] `config/kubernetes/k8s/minimal-stage/external-secret.yaml`
- [ ] Проверить что все секреты синхронизируются из GitHub
- [ ] Проверить что `NEAR_DEX_FEE_RECIPIENT` есть в списке

---

### 7. 📊 ADMIN PANEL

#### 7.1. Страницы админки
- [ ] `src/app/admin/login/page.tsx` - авторизация
- [ ] `src/app/admin/dashboard/page.tsx` - дашборд
- [ ] `src/app/admin/orders/page.tsx` - управление ордерами
- [ ] `src/app/admin/customers/page.tsx` - управление клиентами
- [ ] `src/app/admin/settings/page.tsx` - настройки
- [ ] `src/app/admin/logs/page.tsx` - логи

#### 7.2. API для админки
- [ ] `src/app/api/admin/settings/route.ts` - настройки
- [ ] Проверить авторизацию
- [ ] Проверить права доступа
- [ ] Проверить обновление ConfigMap

#### 7.3. Функциональность
- [ ] Управление ордерами (статусы, редактирование)
- [ ] Управление клиентами (CRM)
- [ ] Настройки (цены, лимиты, комиссии)
- [ ] Просмотр логов
- [ ] Статистика и аналитика

---

### 8. 🗄️ БАЗА ДАННЫХ

#### 8.1. Supabase
- [ ] Проверить миграции в `supabase/migrations/`
- [ ] Проверить схему для intents
- [ ] Проверить схему для ордеров
- [ ] Проверить индексы
- [ ] Проверить RLS (Row Level Security) политики

**Файлы**:
- `supabase/migrations/001_create_intents_schema.sql`
- `supabase/migrations/002_add_dex_features.sql`
- `supabase/migrations/003_create_public_orders.sql`

#### 8.2. Интеграция с Supabase
- [ ] `src/lib/supabase.ts` - клиент Supabase
- [ ] Проверить подключение
- [ ] Проверить использование в API

---

### 9. 🎨 UI/UX И ДИЗАЙН

#### 9.1. Design System
- [ ] `src/app/globals.css` - глобальные стили
- [ ] Проверить glassmorphism эффекты
- [ ] Проверить цветовую схему
- [ ] Проверить типографику
- [ ] Проверить responsive design

#### 9.2. Компоненты
- [ ] Проверить консистентность дизайна
- [ ] Проверить мобильную версию
- [ ] Проверить accessibility
- [ ] Проверить анимации

---

### 10. 📚 ДОКУМЕНТАЦИЯ

#### 10.1. Основная документация
- [ ] `README.md` - актуальность информации
- [ ] `docs/README.md` - структура документации
- [ ] Проверить что все фичи задокументированы

#### 10.2. Deployment документация
- [ ] `docs/deployment/DEPLOY_INSTRUCTIONS.md`
- [ ] `docs/NEAR_INTENTS_DEPLOYMENT_GUIDE.md`
- [ ] `services/solver-node/DEPLOYMENT_GUIDE.md`
- [ ] Проверить актуальность инструкций

#### 10.3. Security документация
- [ ] `docs/security/PRODUCTION_SECURITY_FIXES.md`
- [ ] Проверить что все исправления задокументированы

---

### 11. 🔗 ИНТЕГРАЦИИ И СЕРВИСЫ

#### 11.1. NEAR Blockchain
- [ ] Проверить конфигурацию сети (testnet/mainnet)
- [ ] Проверить RPC endpoints
- [ ] Проверить контракты (verifier contract)
- [ ] Проверить wallet integration

#### 11.2. Внешние сервисы
- [ ] REF Finance API - получение цен
- [ ] Pyth Network - price oracle
- [ ] Google Sheets API
- [ ] Intercom API
- [ ] Telegram Bot API (если используется)

---

### 12. 🧪 ТЕСТИРОВАНИЕ

#### 12.1. Unit тесты
- [ ] Проверить наличие тестов
- [ ] Проверить покрытие
- [ ] Проверить что тесты актуальны

#### 12.2. Integration тесты
- [ ] Проверить наличие integration тестов
- [ ] Проверить тесты API endpoints

#### 12.3. E2E тесты
- [ ] Проверить наличие E2E тестов (если есть)

---

## 📝 ФОРМАТ ОТЧЕТА

После проверки создай подробный отчет в формате:

```markdown
# 🔍 ОТЧЕТ: Проверка готовности Canton OTC к продакшену

**Дата проверки**: [дата]
**Проверяющий**: AI Assistant

## ✅ ЧТО РАБОТАЕТ КОРРЕКТНО

1. [Компонент] - [описание что работает]
2. ...

## ⚠️ НАЙДЕННЫЕ ПРОБЛЕМЫ

1. [Проблема] - [описание, файл, строка]
   - **Решение**: [как исправить]

## 🔧 РЕКОМЕНДАЦИИ

1. [Рекомендация] - [описание]

## 📊 ОБЩАЯ ОЦЕНКА

- **Готовность к продакшену**: [X/10]
- **Критичные проблемы**: [количество]
- **Некритичные проблемы**: [количество]
- **Рекомендации**: [количество]

## ✅ ИТОГОВЫЙ ВЕРДИКТ

[Готов/Не готов] к продакшену. [Обоснование]
```

---

## 🎯 КРИТЕРИИ УСПЕХА

Проект считается готовым к продакшену если:

1. ✅ Все основные функции реализованы и работают
2. ✅ Безопасность на должном уровне (секреты в GitHub Secrets, валидация, rate limiting)
3. ✅ Конфигурация корректна (env переменные, ConfigMap, Secrets)
4. ✅ Интеграции работают (NEAR, Google Sheets, Intercom)
5. ✅ DEX функционал полностью реализован (swap, bridge, solver)
6. ✅ Адрес комиссий настроен (`NEAR_DEX_FEE_RECIPIENT`)
7. ✅ Документация актуальна
8. ✅ Нет критичных проблем безопасности
9. ✅ Kubernetes deployment настроен
10. ✅ Обработка ошибок на должном уровне

---

## 🚀 НАЧНИ ПРОВЕРКУ

Начни с чтения основных файлов проекта:
1. `README.md` - общее понимание проекта
2. `package.json` - зависимости и скрипты
3. Структура `src/` - основные компоненты
4. `config/kubernetes/` - конфигурация деплоя
5. `docs/` - документация

Затем проведи детальную проверку каждого компонента согласно чеклисту выше.

**ВАЖНО**: Читай реальные файлы, не фантазируй. Если что-то не нашел - укажи это в отчете.

---

**Удачи в проверке! 🎯**




