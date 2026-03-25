# 🚀 Преобразование 1OTC в Универсальную OTC Платформу

## 📋 АНАЛИЗ ТЕКУЩЕЙ АРХИТЕКТУРЫ

### 1. Текущее состояние
Платформа 1OTC (canton-otc) в настоящее время специализирована на торговле **только Canton Coin (CC)**. Все компоненты системы жестко привязаны к этому конкретному токену.

### 2. Ключевые компоненты системы

#### 2.1. База данных (Supabase)
**Таблица: `public_orders`**
- `canton_amount` - количество Canton Coin (DECIMAL)
- `canton_address` - адрес Canton Network (TEXT)
- `price` - цена за 1 Canton Coin
- Все поля жестко привязаны к Canton Coin

**Миграции:**
- `003_create_public_orders.sql` - основная таблица заказов
- Все миграции используют `canton_amount` и `canton_address`

#### 2.2. Конфигурация (`src/config/otc.ts`)
**Текущая структура:**
- `TokenSymbol = 'USDT'` - только USDT для оплаты
- `OTCOrder` интерфейс содержит:
  - `cantonAmount: number`
  - `cantonAddress: string`
  - `paymentToken: TokenConfig` (только USDT на разных сетях)
- Функции цен:
  - `getCantonCoinBuyPrice()`
  - `getCantonCoinSellPrice()`
  - `getCantonCoinPrice()`
- `calculateCantonAmount()` - расчет количества Canton

#### 2.3. API Endpoints
**`src/app/api/create-order/route.ts`:**
- Валидация `cantonAddress` через `cantonValidationService`
- Проверка `cantonAmount`
- Расчет цен на основе Canton Coin
- Сохранение в БД с полями `canton_amount`, `canton_address`

#### 2.4. Frontend компоненты
**`src/components/ExchangeForm.tsx`:**
- Состояние: `cantonAmount`
- Логика расчета: покупка/продажа Canton Coin
- UI элементы: "Buy Canton", "Sell Canton"
- Валидация минимального количества Canton

**`src/components/ExchangeFormCompact.tsx`:**
- Аналогичная логика с Canton Coin
- Компонент `CantonIcon`
- Тексты: "Canton Coin Amount", "Canton Network"

**`src/components/OrderSummary.tsx`:**
- Отображение `cantonAmount` и `cantonAddress`
- Форматирование для Canton Coin

**`src/components/WalletDetailsForm.tsx`:**
- Поле для ввода `cantonAddress`
- Валидация Canton адресов

#### 2.5. Сервисы валидации
**`src/lib/services/cantonValidation.ts`:**
- Специализированная валидация только Canton Network адресов
- Форматы: HEX::HEX, namespace::fingerprint, name:fingerprint, hex-only
- Не поддерживает другие блокчейны

**`src/lib/validators.ts`:**
- `AddressValidator` с типом `'canton' | 'ethereum' | 'tron' | 'solana'`
- Но используется только для Canton в основном коде

#### 2.6. Telegram уведомления
**`src/lib/services/telegram.ts`:**
- Сообщения содержат "Canton Coin", "CC"
- Форматирование для Canton Network
- Упоминания Canton в текстах

#### 2.7. ConfigProvider
**`src/components/ConfigProvider.tsx`:**
- `cantonCoinBuyPrice`, `cantonCoinSellPrice`
- `minCantonAmount`, `maxCantonAmount`
- Хуки: `useCantonPrices()`, `useLimits()`

#### 2.8. Kubernetes ConfigMap
**`config/kubernetes/k8s/configmap.yaml`:**
- `CANTON_COIN_BUY_PRICE_USD`
- `CANTON_COIN_SELL_PRICE_USD`
- `MIN_CANTON_AMOUNT`, `MAX_CANTON_AMOUNT`

---

## 🎯 ТРЕБОВАНИЯ К УНИВЕРСАЛЬНОЙ ПЛАТФОРМЕ

### 1. Функциональные требования
1. **Торговля любыми монетами:**
   - Пользователь выбирает монету для покупки/продажи
   - Поддержка множества блокчейнов и токенов
   - Динамическое добавление новых монет

2. **Запрос на добавление монеты:**
   - Форма для запроса новой монеты
   - Админ-панель для управления запросами
   - Утверждение/отклонение запросов

3. **Универсальная валидация адресов:**
   - Поддержка адресов всех популярных блокчейнов
   - Автоматическое определение типа адреса
   - Валидация в зависимости от выбранной монеты

4. **Универсальная система цен:**
   - Динамические цены для каждой монеты
   - Интеграция с price oracles
   - Настройка цен администратором

### 2. Технические требования
1. **База данных:**
   - Таблица `supported_coins` для списка монет
   - Таблица `coin_requests` для запросов на добавление
   - Модификация `public_orders` для универсальности
   - Миграции для обратной совместимости

2. **API:**
   - `/api/coins` - список доступных монет
   - `/api/coins/request` - запрос на добавление монеты
   - `/api/admin/coins` - управление монетами
   - Модификация `/api/create-order` для любой монеты

3. **Frontend:**
   - Компонент выбора монеты
   - Универсальная форма обмена
   - Форма запроса новой монеты
   - Админ-панель управления монетами

---

## 📝 СПИСОК ВСЕХ ФАЙЛОВ ДЛЯ ИЗМЕНЕНИЯ

### База данных (Supabase)
1. **Новые миграции:**
   - `010_create_supported_coins.sql` - таблица монет
   - `011_create_coin_requests.sql` - запросы на добавление
   - `012_migrate_public_orders_to_universal.sql` - универсализация заказов

2. **Модификация существующих:**
   - `003_create_public_orders.sql` - добавить поля для универсальности

### Конфигурация
3. **`src/config/otc.ts`:**
   - Расширить `TokenSymbol` для любых монет
   - Создать интерфейс `CoinConfig`
   - Универсализировать `OTCOrder` интерфейс
   - Удалить жесткие привязки к Canton

4. **`config/kubernetes/k8s/configmap.yaml`:**
   - Убрать `CANTON_COIN_*` переменные
   - Добавить универсальные настройки

### API Routes
5. **`src/app/api/create-order/route.ts`:**
   - Убрать валидацию только Canton адресов
   - Универсальная валидация адресов
   - Поддержка любых монет

6. **Новые API:**
   - `src/app/api/coins/route.ts` - список монет
   - `src/app/api/coins/request/route.ts` - запрос монеты
   - `src/app/api/admin/coins/route.ts` - управление монетами
   - `src/app/api/admin/coins/[coinId]/route.ts` - CRUD монеты

### Frontend компоненты
7. **`src/components/ExchangeForm.tsx`:**
   - Заменить `cantonAmount` на `coinAmount`
   - Заменить `cantonAddress` на `coinAddress`
   - Универсальный селектор монет
   - Убрать упоминания "Canton"

8. **`src/components/ExchangeFormCompact.tsx`:**
   - Аналогичные изменения

9. **`src/components/OrderSummary.tsx`:**
   - Универсальное отображение любой монеты
   - Динамические иконки и названия

10. **`src/components/WalletDetailsForm.tsx`:**
    - Универсальная валидация адресов
    - Динамический выбор сети

11. **Новые компоненты:**
    - `src/components/CoinSelector.tsx` - выбор монеты
    - `src/components/CoinRequestForm.tsx` - форма запроса
    - `src/components/admin/CoinsManagement.tsx` - админ-панель

### Сервисы
12. **`src/lib/services/cantonValidation.ts`:**
    - Переименовать в `addressValidation.ts`
    - Универсальная валидация всех блокчейнов
    - Автоопределение типа адреса

13. **`src/lib/services/telegram.ts`:**
    - Универсальные сообщения
    - Динамические названия монет

14. **Новые сервисы:**
    - `src/lib/services/coinService.ts` - управление монетами
    - `src/lib/services/priceOracle.ts` - универсальные цены

### ConfigProvider
15. **`src/components/ConfigProvider.tsx`:**
    - Убрать `cantonCoin*` поля
    - Универсальные цены и лимиты
    - Хуки для любой монеты

### Валидаторы
16. **`src/lib/validators.ts`:**
    - Расширить `AddressValidator` для всех сетей
    - Универсальная валидация

### Утилиты
17. **`src/lib/utils.ts`:**
    - Универсальные функции валидации адресов
    - Убрать специфичные для Canton функции

### Документация
18. **`README.md`:**
    - Обновить описание платформы
    - Убрать упоминания только Canton Coin

19. **Новая документация:**
    - `docs/guides/COIN_MANAGEMENT.md` - управление монетами
    - `docs/guides/ADDING_NEW_COIN.md` - добавление монеты

---

## 🏗️ АРХИТЕКТУРА УНИВЕРСАЛЬНОЙ ПЛАТФОРМЫ

### 1. Модель данных

#### Таблица `supported_coins`
```sql
CREATE TABLE supported_coins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol TEXT UNIQUE NOT NULL, -- BTC, ETH, USDT, etc.
  name TEXT NOT NULL, -- Bitcoin, Ethereum, etc.
  network TEXT NOT NULL, -- BITCOIN, ETHEREUM, BSC, TRON, SOLANA, etc.
  network_name TEXT NOT NULL, -- Bitcoin, Ethereum, BNB Chain, etc.
  decimals INTEGER NOT NULL DEFAULT 18,
  contract_address TEXT, -- Для токенов (ERC-20, BEP-20, etc.)
  icon_url TEXT, -- URL иконки
  color TEXT, -- Цвет для UI
  min_amount DECIMAL(18, 8) NOT NULL DEFAULT 0.0001,
  max_amount DECIMAL(18, 8),
  is_active BOOLEAN DEFAULT TRUE,
  buy_price_usd DECIMAL(18, 8), -- Текущая цена покупки
  sell_price_usd DECIMAL(18, 8), -- Текущая цена продажи
  price_source TEXT DEFAULT 'manual', -- manual, oracle, api
  price_api_url TEXT, -- URL для получения цены
  receiving_address TEXT, -- Адрес для получения платежей
  address_validation_regex TEXT, -- Regex для валидации адресов
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Таблица `coin_requests`
```sql
CREATE TABLE coin_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  network TEXT NOT NULL,
  contract_address TEXT,
  requested_by_email TEXT NOT NULL,
  requested_by_telegram TEXT,
  reason TEXT, -- Причина запроса
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by TEXT, -- Email админа
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Модификация `public_orders`
```sql
-- Добавить новые поля
ALTER TABLE public_orders ADD COLUMN coin_id UUID REFERENCES supported_coins(id);
ALTER TABLE public_orders ADD COLUMN coin_symbol TEXT; -- Для быстрого поиска
ALTER TABLE public_orders ADD COLUMN coin_amount DECIMAL(18, 8); -- Универсальное количество
ALTER TABLE public_orders ADD COLUMN coin_address TEXT; -- Универсальный адрес

-- Оставить старые поля для обратной совместимости (deprecated)
-- canton_amount, canton_address остаются, но помечаются как deprecated
```

### 2. Интерфейсы TypeScript

#### `CoinConfig`
```typescript
export interface CoinConfig {
  id: string;
  symbol: string; // BTC, ETH, USDT, etc.
  name: string; // Bitcoin, Ethereum, etc.
  network: NetworkType; // BITCOIN, ETHEREUM, BSC, etc.
  networkName: string;
  decimals: number;
  contractAddress?: string;
  iconUrl?: string;
  color: string;
  minAmount: number;
  maxAmount?: number;
  isActive: boolean;
  buyPriceUSD?: number;
  sellPriceUSD?: number;
  priceSource: 'manual' | 'oracle' | 'api';
  priceApiUrl?: string;
  receivingAddress: string;
  addressValidationRegex?: string;
}
```

#### Универсальный `OTCOrder`
```typescript
export interface OTCOrder {
  orderId: string;
  timestamp: number;
  
  // Универсальные поля монеты
  coinId: string;
  coinSymbol: string;
  coinAmount: number;
  coinAddress: string;
  
  // Платежный токен (обычно USDT)
  paymentToken: TokenConfig;
  paymentAmount: number;
  paymentAmountUSD: number;
  
  // Направление обмена
  exchangeDirection: 'buy' | 'sell';
  
  // Цена и комиссия
  price: number;
  manualPrice?: boolean;
  serviceCommission: number;
  
  // Адреса
  receivingAddress?: string;
  refundAddress?: string;
  
  // Контакты
  email: string;
  telegram?: string;
  whatsapp?: string;
  
  // Статус
  status: OrderStatus;
  
  // Legacy поля (deprecated, для обратной совместимости)
  cantonAmount?: number;
  cantonAddress?: string;
}
```

### 3. Универсальная валидация адресов

#### Поддерживаемые сети
- **Bitcoin**: Legacy, SegWit, Bech32
- **Ethereum**: 0x... (40 hex chars)
- **BSC**: 0x... (40 hex chars)
- **TRON**: T... (34 chars)
- **Solana**: Base58 (32-44 chars)
- **Canton Network**: Все существующие форматы
- **Другие**: Расширяемая система

#### Валидатор
```typescript
class UniversalAddressValidator {
  validateAddress(address: string, coinConfig: CoinConfig): ValidationResult {
    // 1. Проверить regex из coinConfig
    // 2. Проверить стандартные форматы для сети
    // 3. Проверить checksum (если применимо)
    // 4. Вернуть результат с типом адреса
  }
}
```

### 4. Система цен

#### Источники цен
1. **Manual** - ручная установка админом
2. **Oracle** - интеграция с Pyth Network, Chainlink
3. **API** - внешние API (CoinGecko, CoinMarketCap)

#### Price Service
```typescript
class PriceService {
  async getPrice(coinSymbol: string, direction: 'buy' | 'sell'): Promise<number> {
    // 1. Получить конфигурацию монеты
    // 2. Определить источник цены
    // 3. Получить цену из источника
    // 4. Применить маржу (buy/sell spread)
    // 5. Вернуть цену
  }
}
```

---

## 🚀 ПЛАН РЕАЛИЗАЦИИ

### Фаза 1: База данных и миграции
1. Создать таблицы `supported_coins` и `coin_requests`
2. Модифицировать `public_orders` для универсальности
3. Создать миграции с обратной совместимостью
4. Заполнить начальные данные (Canton Coin как первая монета)

### Фаза 2: Backend API
1. Создать API для управления монетами
2. Модифицировать `/api/create-order` для универсальности
3. Создать универсальный валидатор адресов
4. Создать сервис цен

### Фаза 3: Frontend компоненты
1. Создать `CoinSelector` компонент
2. Универсализировать формы обмена
3. Создать форму запроса монеты
4. Создать админ-панель управления монетами

### Фаза 4: Интеграции
1. Обновить Telegram уведомления
2. Обновить Intercom интеграцию
3. Обновить Google Sheets (если используется)

### Фаза 5: Тестирование и документация
1. Тесты для всех новых компонентов
2. Обновить документацию
3. Миграция существующих данных

---

## 📄 ПРОМТ ДЛЯ ВЫПОЛНЕНИЯ В НОВОМ ЧАТЕ

```markdown
# 🎯 ЗАДАЧА: Преобразование 1OTC в Универсальную OTC Платформу

## КОНТЕКСТ
Текущая платформа 1OTC (canton-otc) специализирована на торговле только Canton Coin. 
Необходимо преобразовать её в универсальную OTC платформу для торговли любыми монетами 
с возможностью запроса на добавление новых монет.

## ТЕКУЩАЯ АРХИТЕКТУРА
- База данных: Supabase с таблицей `public_orders` (поля: canton_amount, canton_address)
- Конфигурация: `src/config/otc.ts` с жесткой привязкой к Canton Coin
- API: `/api/create-order` с валидацией только Canton адресов
- Frontend: компоненты ExchangeForm, OrderSummary с упоминаниями "Canton"
- Валидация: `cantonValidation.ts` только для Canton Network
- ConfigProvider: `cantonCoinBuyPrice`, `cantonCoinSellPrice`

## ТРЕБОВАНИЯ

### 1. База данных
Создать:
- Таблица `supported_coins` (id, symbol, name, network, decimals, contract_address, 
  icon_url, color, min_amount, max_amount, is_active, buy_price_usd, sell_price_usd, 
  price_source, price_api_url, receiving_address, address_validation_regex)
- Таблица `coin_requests` (id, symbol, name, network, contract_address, 
  requested_by_email, status, reviewed_by, review_notes)

Модифицировать:
- `public_orders`: добавить coin_id, coin_symbol, coin_amount, coin_address
- Сохранить старые поля (canton_amount, canton_address) для обратной совместимости

### 2. Backend API
Создать:
- `/api/coins` - GET список всех активных монет
- `/api/coins/request` - POST запрос на добавление монеты
- `/api/admin/coins` - CRUD операции для монет
- `/api/admin/coins/requests` - управление запросами

Модифицировать:
- `/api/create-order` - убрать привязку к Canton, использовать coin_id
- Универсальная валидация адресов для всех сетей

### 3. Frontend
Создать:
- `CoinSelector.tsx` - компонент выбора монеты
- `CoinRequestForm.tsx` - форма запроса новой монеты
- `admin/CoinsManagement.tsx` - админ-панель управления монетами

Модифицировать:
- `ExchangeForm.tsx` - заменить cantonAmount на coinAmount, универсальный селектор
- `ExchangeFormCompact.tsx` - аналогично
- `OrderSummary.tsx` - универсальное отображение любой монеты
- `WalletDetailsForm.tsx` - универсальная валидация адресов

### 4. Сервисы
Создать:
- `coinService.ts` - управление монетами, получение цен
- `universalAddressValidator.ts` - валидация адресов всех сетей

Модифицировать:
- `cantonValidation.ts` → `addressValidation.ts` (универсальный)
- `telegram.ts` - универсальные сообщения
- `ConfigProvider.tsx` - убрать cantonCoin*, универсальные цены

### 5. Конфигурация
Модифицировать:
- `src/config/otc.ts` - интерфейсы CoinConfig, универсальный OTCOrder
- `config/kubernetes/k8s/configmap.yaml` - убрать CANTON_COIN_* переменные

## ПОДДЕРЖИВАЕМЫЕ СЕТИ
- Bitcoin (Legacy, SegWit, Bech32)
- Ethereum (0x...)
- BSC (0x...)
- TRON (T...)
- Solana (Base58)
- Canton Network (все форматы)
- Расширяемая система для других сетей

## ВАЖНО
1. Сохранить обратную совместимость - старые заказы должны работать
2. Canton Coin должна быть первой монетой в системе
3. Все изменения должны быть протестированы
4. Обновить документацию
5. Миграция данных должна быть безопасной

## ПРИОРИТЕТЫ
1. База данных и миграции (критично)
2. Backend API (критично)
3. Frontend компоненты (важно)
4. Интеграции (важно)
5. Тестирование и документация

## НАЧАТЬ С
1. Изучить текущую структуру проекта
2. Создать миграции для новых таблиц
3. Модифицировать существующие таблицы
4. Создать интерфейсы TypeScript
5. Реализовать API endpoints
6. Создать frontend компоненты
7. Обновить существующие компоненты
8. Протестировать все изменения

Выполни задачу полностью, следуя best practices и сохраняя обратную совместимость.
```

---

## ✅ ЧЕКЛИСТ ВЫПОЛНЕНИЯ

### База данных
- [ ] Создать миграцию `010_create_supported_coins.sql`
- [ ] Создать миграцию `011_create_coin_requests.sql`
- [ ] Создать миграцию `012_migrate_public_orders_to_universal.sql`
- [ ] Добавить Canton Coin как первую монету в `supported_coins`
- [ ] Протестировать миграции

### Backend
- [ ] Создать `/api/coins/route.ts`
- [ ] Создать `/api/coins/request/route.ts`
- [ ] Создать `/api/admin/coins/route.ts`
- [ ] Создать `/api/admin/coins/[coinId]/route.ts`
- [ ] Модифицировать `/api/create-order/route.ts`
- [ ] Создать `coinService.ts`
- [ ] Создать `universalAddressValidator.ts`
- [ ] Модифицировать `cantonValidation.ts` → `addressValidation.ts`

### Frontend
- [ ] Создать `CoinSelector.tsx`
- [ ] Создать `CoinRequestForm.tsx`
- [ ] Создать `admin/CoinsManagement.tsx`
- [ ] Модифицировать `ExchangeForm.tsx`
- [ ] Модифицировать `ExchangeFormCompact.tsx`
- [ ] Модифицировать `OrderSummary.tsx`
- [ ] Модифицировать `WalletDetailsForm.tsx`
- [ ] Модифицировать `ConfigProvider.tsx`

### Конфигурация
- [ ] Модифицировать `src/config/otc.ts`
- [ ] Обновить `config/kubernetes/k8s/configmap.yaml`

### Интеграции
- [ ] Обновить `telegram.ts`
- [ ] Обновить `intercom.ts` (если используется)

### Тестирование
- [ ] Тесты для новых API
- [ ] Тесты для валидации адресов
- [ ] Тесты для компонентов
- [ ] Интеграционные тесты

### Документация
- [ ] Обновить `README.md`
- [ ] Создать `docs/guides/COIN_MANAGEMENT.md`
- [ ] Создать `docs/guides/ADDING_NEW_COIN.md`

---

**Дата создания:** 2025-01-27
**Версия:** 1.0
**Статус:** Готов к выполнению
