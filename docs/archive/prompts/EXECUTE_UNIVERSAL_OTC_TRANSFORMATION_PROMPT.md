# 🎯 ПРОМТ: Преобразование 1OTC в Универсальную OTC Платформу

## КОНТЕКСТ
Текущая платформа Canton OTC (canton-otc) специализирована на торговле только Canton Coin (CC). 
Необходимо:
1. **Ребрендинг:** Преобразовать Canton OTC в **1OTC** - универсальную OTC платформу
2. **Начальная поддержка:** Добавить поддержку торговли **Canton Coin (CC)** и **Bron (BRON)** токенами
3. **Система запросов:** Реализовать качественную систему для пользователей по созданию заявок на добавление новых монет
4. **Архитектура:** Подготовить архитектуру для будущего расширения на любые монеты

**ВАЖНО:** Не нужно интегрировать все монеты сразу. Фокус на:
- Качественной реализации для CC и BRON
- Системе запросов на добавление монет
- Ребрендинге платформы

## ТЕКУЩАЯ АРХИТЕКТУРА

### База данных (Supabase)
- Таблица `public_orders` с полями:
  - `canton_amount` DECIMAL(18, 6) - количество Canton Coin
  - `canton_address` TEXT - адрес Canton Network
  - `price` DECIMAL(18, 6) - цена за 1 Canton Coin
- Все поля жестко привязаны к Canton Coin

### Конфигурация
- `src/config/otc.ts`:
  - `TokenSymbol = 'USDT'` - только USDT для оплаты
  - `OTCOrder` интерфейс с `cantonAmount`, `cantonAddress`
  - Функции: `getCantonCoinBuyPrice()`, `getCantonCoinSellPrice()`
  - `calculateCantonAmount()` - расчет количества Canton

### API
- `/api/create-order/route.ts`:
  - Валидация только Canton адресов через `cantonValidationService`
  - Проверка `cantonAmount`
  - Сохранение в БД с полями `canton_amount`, `canton_address`

### Frontend компоненты
- `ExchangeForm.tsx`: состояние `cantonAmount`, UI "Buy Canton", "Sell Canton"
- `ExchangeFormCompact.tsx`: аналогичная логика
- `OrderSummary.tsx`: отображение `cantonAmount` и `cantonAddress`
- `WalletDetailsForm.tsx`: поле для ввода `cantonAddress`

### Сервисы
- `cantonValidation.ts`: валидация только Canton Network адресов
- `telegram.ts`: сообщения содержат "Canton Coin", "CC"
- `ConfigProvider.tsx`: `cantonCoinBuyPrice`, `cantonCoinSellPrice`

### Kubernetes ConfigMap
- `CANTON_COIN_BUY_PRICE_USD`
- `CANTON_COIN_SELL_PRICE_USD`
- `MIN_CANTON_AMOUNT`, `MAX_CANTON_AMOUNT`

## ТРЕБОВАНИЯ

### 1. База данных

#### Создать новые таблицы:

**`supported_coins`** - список поддерживаемых монет:
```sql
CREATE TABLE supported_coins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol TEXT UNIQUE NOT NULL, -- BTC, ETH, USDT, etc.
  name TEXT NOT NULL, -- Bitcoin, Ethereum, etc.
  network TEXT NOT NULL, -- BITCOIN, ETHEREUM, BSC, TRON, SOLANA, CANTON, etc.
  network_name TEXT NOT NULL, -- Bitcoin, Ethereum, BNB Chain, etc.
  decimals INTEGER NOT NULL DEFAULT 18,
  contract_address TEXT, -- Для токенов (ERC-20, BEP-20, etc.)
  icon_url TEXT, -- URL иконки
  color TEXT, -- Цвет для UI (#50AF95, etc.)
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

CREATE INDEX idx_supported_coins_symbol ON supported_coins(symbol);
CREATE INDEX idx_supported_coins_active ON supported_coins(is_active) WHERE is_active = TRUE;
```

**`coin_requests`** - запросы на добавление монет:
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

CREATE INDEX idx_coin_requests_status ON coin_requests(status);
CREATE INDEX idx_coin_requests_email ON coin_requests(requested_by_email);
```

#### Модифицировать `public_orders`:
```sql
-- Добавить новые универсальные поля
ALTER TABLE public_orders ADD COLUMN IF NOT EXISTS coin_id UUID REFERENCES supported_coins(id);
ALTER TABLE public_orders ADD COLUMN IF NOT EXISTS coin_symbol TEXT;
ALTER TABLE public_orders ADD COLUMN IF NOT EXISTS coin_amount DECIMAL(18, 8);
ALTER TABLE public_orders ADD COLUMN IF NOT EXISTS coin_address TEXT;

-- Индексы для новых полей
CREATE INDEX IF NOT EXISTS idx_public_orders_coin_id ON public_orders(coin_id);
CREATE INDEX IF NOT EXISTS idx_public_orders_coin_symbol ON public_orders(coin_symbol);

-- Старые поля (canton_amount, canton_address) остаются для обратной совместимости
-- Они помечаются как deprecated, но не удаляются
```

#### Миграция данных:
- Создать миграцию, которая заполняет `supported_coins` данными Canton Coin
- Мигрировать существующие заказы: заполнить `coin_id`, `coin_symbol`, `coin_amount`, `coin_address` из `canton_amount`, `canton_address`

### 2. Backend API

#### Создать новые endpoints:

**`/api/coins/route.ts`** - GET список всех активных монет:
```typescript
export async function GET() {
  // Вернуть список всех активных монет из supported_coins
  // Включить: id, symbol, name, network, icon_url, color, min_amount, max_amount, buy_price_usd, sell_price_usd
}
```

**`/api/coins/request/route.ts`** - POST запрос на добавление монеты:
```typescript
export async function POST(request: NextRequest) {
  // Принять: symbol, name, network, contract_address, email, telegram, reason
  // Сохранить в coin_requests со статусом 'pending'
  // Отправить уведомление админам
}
```

**`/api/admin/coins/route.ts`** - CRUD операции для монет:
```typescript
// GET - список всех монет (включая неактивные)
// POST - создать новую монету
```

**`/api/admin/coins/[coinId]/route.ts`** - операции с конкретной монетой:
```typescript
// GET - получить монету
// PATCH - обновить монету (цены, статус, etc.)
// DELETE - деактивировать монету
```

**`/api/admin/coins/requests/route.ts`** - управление запросами:
```typescript
// GET - список всех запросов
// PATCH - утвердить/отклонить запрос
```

#### Модифицировать существующие:

**`/api/create-order/route.ts`**:
- Убрать валидацию только Canton адресов
- Принимать `coinId` или `coinSymbol` вместо жесткой привязки к Canton
- Использовать универсальную валидацию адресов на основе конфигурации монеты
- Сохранять в `coin_id`, `coin_symbol`, `coin_amount`, `coin_address`
- Сохранять в старые поля для обратной совместимости (если это Canton Coin)

### 3. Frontend компоненты

#### Создать новые:

**`src/components/CoinSelector.tsx`**:
- Компонент выбора монеты из списка
- Отображение иконок, названий, цен
- Фильтрация по сети
- Поиск по символу/названию

**`src/components/CoinRequestForm.tsx`**:
- Форма для запроса новой монеты
- Поля: symbol, name, network, contract_address, email, reason
- Валидация и отправка запроса

**`src/app/admin/coins/page.tsx`** и **`src/app/admin/coins/CoinsPageContent.tsx`**:
- Админ-панель управления монетами
- Список монет с возможностью редактирования
- Управление ценами, статусом
- Управление запросами на добавление

#### Модифицировать существующие:

**`src/components/ExchangeForm.tsx`**:
- Заменить `cantonAmount` на `coinAmount`
- Заменить `cantonAddress` на `coinAddress`
- Добавить `CoinSelector` в начало формы
- Убрать упоминания "Canton" из UI
- Универсальные тексты: "Buy [Coin]", "Sell [Coin]"
- Динамическая валидация адресов на основе выбранной монеты

**`src/components/ExchangeFormCompact.tsx`**:
- Аналогичные изменения

**`src/components/OrderSummary.tsx`**:
- Универсальное отображение любой монеты
- Динамические иконки и названия
- Отображение `coinAmount` и `coinAddress` вместо `cantonAmount` и `cantonAddress`

**`src/components/WalletDetailsForm.tsx`**:
- Универсальная валидация адресов
- Динамический выбор сети на основе выбранной монеты
- Поле для ввода адреса с валидацией для конкретной сети

### 4. Интеграции с внешними сервисами

#### Google Sheets (`src/lib/services/googleSheets.ts`):
- **Текущее состояние:** Сохраняет заказы с полями `cantonAmount`, `cantonAddress`
- **Требуется:**
  - Обновить структуру строк для универсальных монет
  - Добавить поля: `coin_symbol`, `coin_amount`, `coin_address`
  - Сохранить обратную совместимость со старыми заказами
  - Обновить `saveOrder()` метод

#### Intercom (`src/lib/services/intercom.ts`):
- **Текущее состояние:** Создает пользователей и конверсации с упоминанием Canton Coin
- **Требуется:**
  - Универсальные сообщения для любой монеты
  - Обновить `createOrUpdateUser()` для универсальности
  - Обновить `createConversation()` с динамическими названиями монет
  - Обновить `sendOrderNotification()` для универсальности

#### Market Price Service (`src/lib/services/marketPriceService.ts`):
- **Текущее состояние:** Получает цену только для Canton Coin из Binance, CoinGecko
- **Требуется:**
  - Универсальный метод `getCoinPrice(coinSymbol: string): Promise<number>`
  - Поддержка получения цен для любых монет
  - Интеграция с CoinGecko, Binance, другими API
  - Кэширование цен для разных монет

#### Price Oracle (`src/lib/price-oracle/index.ts`):
- **Текущее состояние:** Интеграция с REF Finance и Pyth Network для NEAR токенов
- **Требуется:**
  - Расширить для поддержки всех монет
  - Универсальный метод получения цен
  - Интеграция с дополнительными источниками цен

#### Config Manager (`src/lib/config-manager.ts`):
- **Текущее состояние:** Управляет ценами Canton Coin из ConfigMap
- **Требуется:**
  - Убрать жесткие привязки к Canton Coin
  - Получать цены из БД (`supported_coins`)
  - Кэширование конфигурации монет
  - Hot reload для изменений цен

#### Metrics Collector (`src/lib/monitoring/metricsCollector.ts`):
- **Требуется:**
  - Универсальные метрики для всех монет
  - Метрики по типам монет
  - Метрики по сетям

### 5. HD Wallet и Unique Addresses

#### Текущее состояние:
- Система генерации уникальных адресов для каждого заказа
- Поля `uniqueAddress` и `addressPath` в заказах
- HD Wallet для TRON сети

#### Требуется:
- **Расширить HD Wallet поддержку:**
  - Bitcoin (BIP44: m/44'/0'/0'/0/index)
  - Ethereum (BIP44: m/44'/60'/0'/0/index)
  - BSC (BIP44: m/44'/60'/0'/0/index, как Ethereum)
  - TRON (BIP44: m/44'/195'/0'/0/index) - уже есть
  - Solana (BIP44: m/44'/501'/0'/0/index)
  - Canton Network - специфичная логика

- **Обновить `addressGeneratorService`:**
  - Универсальная генерация для всех сетей
  - Валидация сгенерированных адресов
  - Безопасное хранение seed phrases

- **Обновить сохранение в БД:**
  - `uniqueAddress` и `addressPath` для всех сетей
  - Обновить Google Sheets структуру

### 6. Сервисы

#### Создать новые:

**`src/lib/services/coinService.ts`**:
```typescript
class CoinService {
  async getAllCoins(): Promise<CoinConfig[]>
  async getCoinById(id: string): Promise<CoinConfig | null>
  async getCoinBySymbol(symbol: string): Promise<CoinConfig | null>
  async requestCoin(data: CoinRequestData): Promise<boolean>
  async updateCoinPrice(coinId: string, buyPrice: number, sellPrice: number): Promise<boolean>
}
```

**`src/lib/services/universalAddressValidator.ts`**:
```typescript
class UniversalAddressValidator {
  // Валидация на основе конфигурации монеты
  validateAddress(address: string, coinConfig: CoinConfig): ValidationResult {
    // 1. Проверить regex из coinConfig.addressValidationRegex (если есть)
    // 2. Проверить стандартные паттерны для сети coinConfig.network
    // 3. Проверить checksum где применимо (validateChecksum)
    // 4. Вернуть детальный результат с типом адреса и возможными ошибками
  }
  
  // Автоматическое определение типа адреса
  detectAddressType(address: string): AddressType {
    // Пробовать все известные форматы для всех сетей
    // Вернуть первый подходящий с указанием сети и формата
  }
  
  // Валидация для конкретной сети
  validateByNetwork(address: string, network: NetworkType): ValidationResult {
    // Специфичная валидация для сети
    // Включая checksum проверки
    // Поддержка всех 34+ сетей из списка монет
  }
  
  // Проверка checksum (где применимо)
  validateChecksum(address: string, network: NetworkType): boolean {
    // Реализовать checksum для всех сетей где это применимо
    // Использовать соответствующие библиотеки (см. раздел "Библиотеки")
  }
}
```

**КРИТИЧНО:** На начальном этапе валидатор должен поддерживать ТОЛЬКО:
- **Canton Network** (для CC и BRON токенов)

**Для Canton Network (CC и BRON):**
1. Реализовать все 4 формата адресов:
   - HEX::HEX: `^[a-fA-F0-9]{32,}::[a-fA-F0-9]{32,}$`
   - Namespace: `^[a-zA-Z][a-zA-Z0-9_]*::[a-fA-F0-9]{32,}$`
   - Classic: `^[a-zA-Z][a-zA-Z0-9_-]{2,49}::[a-fA-F0-9]{32,80}$`
   - Hex-only: `^[a-fA-F0-9]{32,80}$`
2. Длина: 32-150 символов
3. Нет checksum (Canton Network не использует)
4. Добавить понятные сообщения об ошибках
5. Протестировать на реальных адресах CC и BRON

**ВАЖНО:** Архитектура должна быть готова для будущего расширения на другие сети, но сейчас реализуем только Canton Network для CC и BRON.

#### Модифицировать существующие:

**`src/lib/services/cantonValidation.ts`** → **`src/lib/services/addressValidation.ts`**:
- Переименовать сервис
- Добавить валидацию для всех поддерживаемых сетей
- Универсальная валидация на основе конфигурации монеты
- Сохранить валидацию Canton как часть универсальной системы

**`src/lib/services/telegram.ts`**:
- Универсальные сообщения без упоминания "Canton Coin"
- Динамические названия монет
- Универсальное форматирование для любой монеты

**`src/components/ConfigProvider.tsx`**:
- Убрать `cantonCoinBuyPrice`, `cantonCoinSellPrice`
- Добавить универсальные функции получения цен для любой монеты
- Хуки: `useCoinPrice(coinSymbol)`, `useCoinLimits(coinSymbol)`

### 7. Discount Tiers и Volume Pricing

#### Текущее состояние:
- Система скидок на основе объема (`DISCOUNT_TIERS` в `otc.ts`)
- Применяется только для Canton Coin

#### Требуется:
- **Универсальная система скидок:**
  - Настраиваемые скидки для каждой монеты
  - Таблица `coin_discount_tiers` в БД (опционально)
  - Или глобальные скидки, применяемые ко всем монетам
  - Обновить `calculateCoinAmount()` для учета скидок

### 8. Конфигурация

#### `src/config/otc.ts`:

**Создать новые интерфейсы:**
```typescript
export interface CoinConfig {
  id: string;
  symbol: string;
  name: string;
  network: NetworkType;
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

export interface CoinRequest {
  symbol: string;
  name: string;
  network: NetworkType;
  contractAddress?: string;
  requestedByEmail: string;
  requestedByTelegram?: string;
  reason?: string;
}
```

**Модифицировать `OTCOrder`:**
```typescript
export interface OTCOrder {
  // Универсальные поля
  coinId: string;
  coinSymbol: string;
  coinAmount: number;
  coinAddress: string;
  
  // ... остальные поля
  
  // Legacy поля (deprecated)
  cantonAmount?: number;
  cantonAddress?: string;
}
```

**Убрать:**
- `getCantonCoinBuyPrice()`, `getCantonCoinSellPrice()`
- `calculateCantonAmount()`
- Жесткие привязки к Canton

**Добавить:**
- `getCoinPrice(coinSymbol: string, direction: 'buy' | 'sell'): Promise<number>`
- `calculateCoinAmount(paymentAmountUSD: number, coinSymbol: string, direction: 'buy' | 'sell'): Promise<number>`

#### `config/kubernetes/k8s/configmap.yaml`:
- Убрать `CANTON_COIN_BUY_PRICE_USD`, `CANTON_COIN_SELL_PRICE_USD`
- Убрать `MIN_CANTON_AMOUNT`, `MAX_CANTON_AMOUNT`
- Цены и лимиты теперь хранятся в БД (`supported_coins`)

### 9. Начальный список торгуемых монет

#### Монеты для добавления в `supported_coins` при миграции (ТОЛЬКО 2 МОНЕТЫ):

**1. Canton Coin (CC)** - сеть CANTON (уже существует)
- Символ: `CC`
- Название: `Canton Coin`
- Сеть: `CANTON`
- Адреса: Canton Network форматы (HEX::HEX, namespace::fingerprint, classic, hex-only)
- Уже реализовано в системе

**2. Bron (BRON)** - сеть CANTON
- Символ: `BRON`
- Название: `Bron`
- Сеть: `CANTON` (токен на Canton Network)
- Адреса: Canton Network форматы (аналогично CC)
  - HEX::HEX формат: `^[a-fA-F0-9]{32,}::[a-fA-F0-9]{32,}$`
  - Namespace формат: `^[a-zA-Z][a-zA-Z0-9_]*::[a-fA-F0-9]{32,}$`
  - Classic формат: `^[a-zA-Z][a-zA-Z0-9_-]{2,49}::[a-fA-F0-9]{32,80}$`
  - Hex-only формат: `^[a-fA-F0-9]{32,80}$`
- **Требуется реализация:**
  - Валидация адресов (использовать те же функции что для CC)
  - Настройка цен (buy_price_usd, sell_price_usd)
  - Настройка лимитов (min_amount, max_amount)
  - UI элементы (иконка, цвета, названия)
  - Интеграция во все компоненты (ExchangeForm, OrderSummary, etc.)
  - Telegram уведомления с упоминанием BRON
  - Google Sheets сохранение
  - Intercom интеграция

**Примечание:** 
- Начать только с этих 2 монет для качественной реализации
- Остальные монеты будут добавляться через систему запросов пользователей
- Фокус на качестве, а не количестве

### 10. Поддерживаемые сети и валидация адресов

#### Детальная валидация для каждой сети:

**1. BITCOIN (BTC):**
```typescript
// Legacy (P2PKH) - начинается с 1
pattern: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/
examples: ['1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy']

// SegWit (P2SH) - начинается с 3
// Использует тот же паттерн что и Legacy

// Bech32 (Native SegWit) - начинается с bc1
pattern: /^bc1[a-z0-9]{39,59}$/
examples: ['bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4']

// Валидация:
- Проверка checksum для Bech32 (использовать библиотеку bech32)
- Проверка base58 для Legacy/SegWit
- Длина: 26-35 символов для Legacy/SegWit, 42-62 для Bech32
```

**2. ETHEREUM (ETH, ERC-20 токены):**
```typescript
// Стандартный формат
pattern: /^0x[a-fA-F0-9]{40}$/
examples: ['0x742d35Cc6634C0532925a3B8D000B47E0e', '0x0000000000000000000000000000000000000000']

// Валидация:
- Длина: точно 42 символа (0x + 40 hex)
- Checksum validation (EIP-55) - опционально, но рекомендуется
- Case-sensitive для checksum адресов
```

**3. BSC (BNB, BEP-20 токены):**
```typescript
// Тот же формат что Ethereum
pattern: /^0x[a-fA-F0-9]{40}$/
examples: ['0x2170Ed0880ac9A755fd29B2688956BD959F933F8']

// Валидация:
- Аналогично Ethereum
- Можно использовать те же функции валидации
```

**4. TRON (TRX, TRC-20 токены):**
```typescript
// Стандартный формат
pattern: /^T[A-Za-z1-9]{33}$/
examples: ['TNaRAoLUyYEV15ZF9FvWs6StdMdRCCMK3f', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t']

// Валидация:
- Длина: точно 34 символа
- Начинается с T
- Base58 алфавит (без 0, O, I, l)
- Проверка checksum (Base58 decode + verify)
```

**5. SOLANA (SOL, SPL токены):**
```typescript
// Base58 формат
pattern: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
examples: ['9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', 'So11111111111111111111111111111111111111112']

// Валидация:
- Длина: 32-44 символа
- Base58 алфавит
- Проверка checksum (Base58 decode + verify)
```

**6. POLYGON (MATIC, ERC-20 токены):**
```typescript
// Тот же формат что Ethereum
pattern: /^0x[a-fA-F0-9]{40}$/
examples: ['0x0000000000000000000000000000000000001010']

// Валидация:
- Аналогично Ethereum
```

**7. AVALANCHE (AVAX, ERC-20 токены на C-Chain):**
```typescript
// Тот же формат что Ethereum (C-Chain использует EVM)
pattern: /^0x[a-fA-F0-9]{40}$/
examples: ['0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7']

// Валидация:
- Аналогично Ethereum
```

**8. CANTON NETWORK (CC и BRON):**
```typescript
// HEX::HEX формат (самый распространенный)
pattern: /^[a-fA-F0-9]{32,}::[a-fA-F0-9]{32,}$/
examples: ['04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8']

// Namespace формат
pattern: /^[a-zA-Z][a-zA-Z0-9_]*::[a-fA-F0-9]{32,}$/
examples: ['bron::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8']

// Classic формат
pattern: /^[a-zA-Z][a-zA-Z0-9_-]{2,49}::[a-fA-F0-9]{32,80}$/
examples: ['alice::1234567890abcdef1234567890abcdef12345678']

// Hex-only формат
pattern: /^[a-fA-F0-9]{32,80}$/
examples: ['1234567890abcdef1234567890abcdef12345678']

// Валидация:
- Длина: 32-150 символов
- Проверка всех 4 форматов
- Нет checksum (Canton не использует)
- Применимо для CC и BRON (оба на Canton Network)
```

**ВАЖНО:** Bron (BRON) использует те же форматы адресов что и Canton Coin, так как оба токена на Canton Network. Валидация адресов идентична.

**9. CARDANO (ADA):** (для будущего расширения)
```typescript
// Base58 формат (Legacy)
pattern: /^[A-HJ-NP-Za-km-z1-9]{104}$/
// Bech32 формат (современный)
pattern: /^addr1[a-z0-9]{98}$/
examples: ['addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps7zex2k2xt3uqxgjqnnj375vq23r3x3q0p0n2']

// Валидация:
- Bech32 checksum (использовать библиотеку bech32)
- Длина: 104 для Legacy, 103 для Bech32
```

**10. POLKADOT (DOT):**
```typescript
// SS58 формат (Base58 с префиксом)
pattern: /^[1-9A-HJ-NP-Za-km-z]{47,48}$/
examples: ['1FRMM8PEiWXYax7rpS6X4XZX1aAAxSWx1CrKTyrVYhV24fg']

// Валидация:
- SS58 decode + checksum verify
- Префикс зависит от сети (Polkadot = 0, Kusama = 2)
```

**11. COSMOS (ATOM и другие Cosmos SDK сети):**
```typescript
// Bech32 формат
pattern: /^cosmos1[a-z0-9]{38}$/
examples: ['cosmos1hsk6jryyqjfhp5dhc55tc9jtckygx0uh6ysygz']

// Валидация:
- Bech32 checksum
- HRP (Human Readable Part) зависит от сети: cosmos, osmo, juno, etc.
```

**12. LITECOIN (LTC):**
```typescript
// Legacy (начинается с L или M)
pattern: /^[LM][a-km-zA-HJ-NP-Z1-9]{25,34}$/
// Bech32 (начинается с ltc1)
pattern: /^ltc1[a-z0-9]{39,59}$/
examples: ['LTC1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', 'ltc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4']

// Валидация:
- Аналогично Bitcoin
- Bech32 checksum для ltc1
```

**13. BITCOIN CASH (BCH):**
```typescript
// Legacy (начинается с 1)
pattern: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/
// CashAddr (начинается с bitcoincash:)
pattern: /^bitcoincash:[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{42}$/
examples: ['1BpEi6DfNvfFCjKSWTr6T75AJXj7W5LN2', 'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a']

// Валидация:
- CashAddr checksum
- Base58 для Legacy
```

**14. DOGECOIN (DOGE):**
```typescript
// Legacy (начинается с D)
pattern: /^D[5-9A-HJ-NP-U][1-9A-HJ-NP-Za-km-z]{32}$/
examples: ['D7Y55LHP3WDqjYarvpM1kZ2A2fT2F8jRvf']

// Валидация:
- Base58 checksum
- Длина: 34 символа
```

**15. ARBITRUM, OPTIMISM, BASE, POLYGON, AVALANCHE (EVM совместимые):**
```typescript
// Тот же формат что Ethereum
pattern: /^0x[a-fA-F0-9]{40}$/
// Все EVM сети используют одинаковый формат адресов

// Валидация:
- Аналогично Ethereum
- EIP-55 checksum опционально
```

**16. ZKSYNC, STARKNET, LINEA, SCROLL, MANTLE (EVM совместимые):**
```typescript
// Тот же формат что Ethereum
pattern: /^0x[a-fA-F0-9]{40}$/
// Все EVM Layer 2 используют Ethereum формат

// Валидация:
- Аналогично Ethereum
```

**17. XRP LEDGER (XRP):**
```typescript
// Base58 формат
pattern: /^r[1-9A-HJ-NP-Za-km-z]{25,34}$/
examples: ['rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH', 'r3kmLJN5D28dHuH8vZNUZpMC43pEHpaocV']

// Валидация:
- Base58 decode + checksum
- Длина: 25-34 символа
- Начинается с 'r'
```

**18. STELLAR (XLM):**
```typescript
// Base32 формат
pattern: /^G[ABCDEFGHIJKLMNOPQRSTUVWXYZ234567]{55}$/
examples: ['GB6NVEN5HSUBKMYCE5ZOWSK5K23TBWRUQLZY3KNMXUZ3AQ2D5QZ4V4KZ']

// Валидация:
- Base32 decode + checksum
- Длина: 56 символов
- Начинается с 'G'
```

**19. ALGORAND (ALGO):**
```typescript
// Base32 формат
pattern: /^[A-Z2-7]{58}$/
examples: ['AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA']

// Валидация:
- Base32 decode + checksum
- Длина: 58 символов
```

**20. TEZOS (XTZ):**
```typescript
// Base58 формат
pattern: /^tz[1-9A-HJ-NP-Za-km-z]{33}$/
examples: ['tz1KqTpEZ7Yob7QbPE4Hy4Wo8fHG8LhKxZSx']

// Валидация:
- Base58 decode + checksum
- Длина: 36 символов
- Начинается с 'tz1', 'tz2', 'tz3', или 'KT1'
```

**21. NEAR PROTOCOL (NEAR):**
```typescript
// Base58 формат
pattern: /^[a-z0-9_-]{2,64}\.near$|^[a-fA-F0-9]{64}$/
examples: ['alice.near', 'bob.testnet', '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef']

// Валидация:
- Именованные аккаунты: 2-64 символа + .near или .testnet
- Hex адреса: 64 hex символа
```

**22. APTOS (APT):**
```typescript
// Hex формат
pattern: /^0x[a-fA-F0-9]{64}$/
examples: ['0x1', '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef']

// Валидация:
- Длина: 66 символов (0x + 64 hex)
- Может быть короткий формат (0x1, 0x2, etc.)
```

**23. SUI (SUI):**
```typescript
// Base58 формат
pattern: /^0x[a-fA-F0-9]{1,64}$/
examples: ['0x1', '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef']

// Валидация:
- Может быть короткий (0x1) или полный (0x + 64 hex)
- Base58 decode для полных адресов
```

**24. TON (TONCOIN):**
```typescript
// Base64 или hex формат
pattern: /^[A-Za-z0-9_-]{48}$|^0:[a-fA-F0-9]{64}$/
examples: ['EQD__________________________________________0vo', '0:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef']

// Валидация:
- Base64 decode или hex decode
- Проверка checksum
```

**25. HEDERA (HBAR):**
```typescript
// Base32 формат
pattern: /^0\.0\.\d+$/
examples: ['0.0.123456', '0.0.987654321']

// Валидация:
- Формат: 0.0.{account_id}
- Account ID: числовой идентификатор
```

**26. VECHAIN (VET):**
```typescript
// Hex формат
pattern: /^0x[a-fA-F0-9]{40}$/
examples: ['0x0000000000000000000000000000000000000000']

// Валидация:
- Аналогично Ethereum
- EIP-55 checksum опционально
```

**27. FILECOIN (FIL):**
```typescript
// Base32 формат
pattern: /^f[1-9A-HJ-NP-Za-km-z]{40}$/
examples: ['f1abjxfbp274xpdqcpuaylh5omfrffv3c6e7t5p2sy']

// Валидация:
- Base32 decode + checksum
- Длина: 41 символ
- Начинается с 'f1', 'f2', или 'f3'
```

**28. INTERNET COMPUTER (ICP):**
```typescript
// Base32 формат
pattern: /^[a-z0-9]{5}(-[a-z0-9]{5}){10}$/
examples: ['aaaaa-aa', 'rdmx6-jaaaa-aaaaa-aaadq-cai']

// Валидация:
- Base32 decode
- Формат: 5 символов, дефис, повторяется 11 раз
```

**29. THETA (THETA):**
```typescript
// Hex формат
pattern: /^0x[a-fA-F0-9]{40}$/
examples: ['0x0000000000000000000000000000000000000000']

// Валидация:
- Аналогично Ethereum
```

**30. EOS (EOS):**
```typescript
// Именованный аккаунт
pattern: /^[a-z1-5]{1,12}$/
examples: ['eosio', 'helloworld11']

// Валидация:
- Длина: 1-12 символов
- Только строчные буквы и цифры 1-5
```

**31. RONIN (AXS и другие):**
```typescript
// Тот же формат что Ethereum
pattern: /^0x[a-fA-F0-9]{40}$/
examples: ['0x0000000000000000000000000000000000000000']

// Валидация:
- Аналогично Ethereum (EVM совместимая сеть)
```

**32. IMMUTABLE X (IMX):**
```typescript
// Тот же формат что Ethereum
pattern: /^0x[a-fA-F0-9]{40}$/
examples: ['0x0000000000000000000000000000000000000000']

// Валидация:
- Аналогично Ethereum (EVM совместимая сеть)
```

**33. BITTENSOR (TAO):**
```typescript
// Base58 формат
pattern: /^5[1-9A-HJ-NP-Za-km-z]{47}$/
examples: ['5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY']

// Валидация:
- Base58 decode + checksum
- Длина: 48 символов
- Начинается с '5'
```

**34. HELIUM (HNT):**
```typescript
// Base58 формат
pattern: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
examples: ['13mJ8K1p43q1KXJ9K1p43q1KXJ9K1p43q1KXJ']

// Валидация:
- Base58 decode + checksum
- Длина: 32-44 символа
```

#### Универсальная валидация:

**Класс `UniversalAddressValidator`:**
```typescript
class UniversalAddressValidator {
  // Валидация на основе конфигурации монеты
  validateAddress(address: string, coinConfig: CoinConfig): ValidationResult {
    // 1. Если есть кастомный regex в coinConfig.addressValidationRegex - использовать его
    // 2. Иначе использовать стандартные паттерны для сети
    // 3. Проверка checksum где применимо
    // 4. Возврат детального результата с типом адреса
  }
  
  // Автоматическое определение типа адреса
  detectAddressType(address: string): AddressType {
    // Пробовать все известные форматы
    // Вернуть первый подходящий
  }
  
  // Валидация для конкретной сети
  validateByNetwork(address: string, network: NetworkType): ValidationResult {
    // Специфичная валидация для сети
    // Включая checksum проверки
  }
  
  // Проверка checksum (где применимо)
  validateChecksum(address: string, network: NetworkType): boolean {
    // Bitcoin: Bech32 checksum, Base58 checksum
    // Ethereum: EIP-55 checksum (опционально)
    // TRON: Base58 checksum
    // Solana: Base58 checksum
    // Cardano: Bech32 checksum
    // Polkadot: SS58 checksum
    // Cosmos: Bech32 checksum
    // XRP: Base58 checksum
    // Stellar: Base32 checksum
    // Algorand: Base32 checksum
    // Tezos: Base58 checksum
    // Near: Base58 для hex, именованные аккаунты не требуют checksum
    // Aptos: Hex без checksum (но можно проверить валидность через RPC)
    // Sui: Base58 checksum для полных адресов
    // TON: Base64/hex checksum
    // Hedera: Нет checksum (формат 0.0.{id})
    // VeChain: EIP-55 checksum (как Ethereum)
    // Filecoin: Base32 checksum
    // Internet Computer: Base32 checksum
    // Theta: EIP-55 checksum (как Ethereum)
    // EOS: Нет checksum (просто именованный аккаунт)
    // Bittensor: Base58 checksum
    // Helium: Base58 checksum
    // BSC/Polygon/Avalanche/Arbitrum/Optimism/Base/ZkSync/etc.: EIP-55 checksum (как Ethereum)
    // Canton: Нет checksum
  }
}
```

#### Библиотеки для checksum валидации (полный список):
- **Bitcoin/Litecoin/Bitcoin Cash:** `bitcoinjs-lib` для Bech32 и Base58
- **Ethereum/EVM сети (BSC, Polygon, Avalanche, Arbitrum, Optimism, Base, zkSync, Starknet, Linea, Scroll, Mantle, Ronin, Immutable X, VeChain, Theta):** `ethers.js` или `web3.js` для EIP-55
- **TRON:** `tronweb` для Base58 checksum
- **Solana:** `@solana/web3.js` для Base58 checksum
- **Cardano:** `bech32` для Bech32 checksum, `cardano-addresses` для полной валидации
- **Polkadot:** `@polkadot/util-crypto` для SS58 decode и checksum
- **Cosmos SDK:** `bech32` для Bech32 checksum
- **XRP:** `ripple-keypairs` или `xrpl` для Base58 checksum
- **Stellar:** `stellar-sdk` для Base32 checksum
- **Algorand:** `algosdk` для Base32 checksum
- **Tezos:** `@taquito/utils` для Base58 checksum
- **Near:** `near-api-js` для валидации (именованные аккаунты + hex)
- **Aptos:** `aptos` SDK для hex валидации (можно проверить через RPC)
- **Sui:** `@mysten/sui.js` для Base58 checksum
- **TON:** `ton` SDK для Base64/hex checksum
- **Hedera:** `@hashgraph/sdk` для валидации формата (нет checksum)
- **Filecoin:** `@glif/filecoin-address` для Base32 checksum
- **Internet Computer:** `@dfinity/agent` для Base32 checksum
- **EOS:** `eosjs` для валидации именованных аккаунтов (нет checksum)
- **Bittensor:** `substrate` библиотеки для Base58 checksum
- **Helium:** Base58 библиотеки для checksum

**Примечание:** Для некоторых сетей (особенно новых или редко используемых) может потребоваться написание собственных валидаторов или использование RPC вызовов для проверки адресов.

#### Настройка в БД:
```sql
-- Примеры address_validation_regex для всех монет:

-- Bitcoin и форки
UPDATE supported_coins SET address_validation_regex = '^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$' WHERE symbol = 'BTC';
UPDATE supported_coins SET address_validation_regex = '^[LM][a-km-zA-HJ-NP-Z1-9]{25,34}$|^ltc1[a-z0-9]{39,59}$' WHERE symbol = 'LTC';
UPDATE supported_coins SET address_validation_regex = '^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bitcoincash:[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{42}$' WHERE symbol = 'BCH';
UPDATE supported_coins SET address_validation_regex = '^D[5-9A-HJ-NP-U][1-9A-HJ-NP-Za-km-z]{32}$' WHERE symbol = 'DOGE';

-- Ethereum и EVM совместимые сети
UPDATE supported_coins SET address_validation_regex = '^0x[a-fA-F0-9]{40}$' WHERE network IN ('ETHEREUM', 'BSC', 'POLYGON', 'AVALANCHE', 'ARBITRUM', 'OPTIMISM', 'BASE', 'ZKSYNC', 'STARKNET', 'LINEA', 'SCROLL', 'MANTLE', 'RONIN', 'IMMUTABLE_X');

-- TRON
UPDATE supported_coins SET address_validation_regex = '^T[A-Za-z1-9]{33}$' WHERE symbol = 'TRX' OR network = 'TRON';

-- Solana
UPDATE supported_coins SET address_validation_regex = '^[1-9A-HJ-NP-Za-km-z]{32,44}$' WHERE symbol = 'SOL' OR network = 'SOLANA';

-- Cardano
UPDATE supported_coins SET address_validation_regex = '^addr1[a-z0-9]{98}$|^[A-HJ-NP-Za-km-z1-9]{104}$' WHERE symbol = 'ADA' OR network = 'CARDANO';

-- Polkadot
UPDATE supported_coins SET address_validation_regex = '^[1-9A-HJ-NP-Za-km-z]{47,48}$' WHERE symbol = 'DOT' OR network = 'POLKADOT';

-- Cosmos SDK сети
UPDATE supported_coins SET address_validation_regex = '^cosmos1[a-z0-9]{38}$|^osmo1[a-z0-9]{38}$|^juno1[a-z0-9]{38}$' WHERE network = 'COSMOS' OR network LIKE '%COSMOS%';

-- XRP Ledger
UPDATE supported_coins SET address_validation_regex = '^r[1-9A-HJ-NP-Za-km-z]{25,34}$' WHERE symbol = 'XRP' OR network = 'XRP_LEDGER';

-- Stellar
UPDATE supported_coins SET address_validation_regex = '^G[ABCDEFGHIJKLMNOPQRSTUVWXYZ234567]{55}$' WHERE symbol = 'XLM' OR network = 'STELLAR';

-- Algorand
UPDATE supported_coins SET address_validation_regex = '^[A-Z2-7]{58}$' WHERE symbol = 'ALGO' OR network = 'ALGORAND';

-- Tezos
UPDATE supported_coins SET address_validation_regex = '^tz[1-9A-HJ-NP-Za-km-z]{33}$|^KT1[a-zA-Z0-9]{33}$' WHERE symbol = 'XTZ' OR network = 'TEZOS';

-- Near Protocol
UPDATE supported_coins SET address_validation_regex = '^[a-z0-9_-]{2,64}\\.near$|^[a-z0-9_-]{2,64}\\.testnet$|^[a-fA-F0-9]{64}$' WHERE symbol = 'NEAR' OR network = 'NEAR';

-- Aptos
UPDATE supported_coins SET address_validation_regex = '^0x[a-fA-F0-9]{1,64}$' WHERE symbol = 'APT' OR network = 'APTOS';

-- Sui
UPDATE supported_coins SET address_validation_regex = '^0x[a-fA-F0-9]{1,64}$' WHERE symbol = 'SUI' OR network = 'SUI';

-- TON
UPDATE supported_coins SET address_validation_regex = '^[A-Za-z0-9_-]{48}$|^0:[a-fA-F0-9]{64}$' WHERE symbol = 'TON' OR network = 'TON';

-- Hedera
UPDATE supported_coins SET address_validation_regex = '^0\\.0\\.\\d+$' WHERE symbol = 'HBAR' OR network = 'HEDERA';

-- VeChain
UPDATE supported_coins SET address_validation_regex = '^0x[a-fA-F0-9]{40}$' WHERE symbol = 'VET' OR network = 'VECHAIN';

-- Filecoin
UPDATE supported_coins SET address_validation_regex = '^f[1-9A-HJ-NP-Za-km-z]{40}$' WHERE symbol = 'FIL' OR network = 'FILECOIN';

-- Internet Computer
UPDATE supported_coins SET address_validation_regex = '^[a-z0-9]{5}(-[a-z0-9]{5}){10}$' WHERE symbol = 'ICP' OR network = 'INTERNET_COMPUTER';

-- Theta
UPDATE supported_coins SET address_validation_regex = '^0x[a-fA-F0-9]{40}$' WHERE symbol = 'THETA' OR network = 'THETA';

-- EOS
UPDATE supported_coins SET address_validation_regex = '^[a-z1-5]{1,12}$' WHERE symbol = 'EOS' OR network = 'EOS';

-- Bittensor
UPDATE supported_coins SET address_validation_regex = '^5[1-9A-HJ-NP-Za-km-z]{47}$' WHERE symbol = 'TAO' OR network = 'BITTENSOR';

-- Helium
UPDATE supported_coins SET address_validation_regex = '^[1-9A-HJ-NP-Za-km-z]{32,44}$' WHERE symbol = 'HNT' OR network = 'HELIUM';

-- Canton Network
UPDATE supported_coins SET address_validation_regex = '^[a-fA-F0-9]{32,}::[a-fA-F0-9]{32,}$|^[a-zA-Z][a-zA-Z0-9_]*::[a-fA-F0-9]{32,}$|^[a-zA-Z][a-zA-Z0-9_-]{2,49}::[a-fA-F0-9]{32,80}$|^[a-fA-F0-9]{32,80}$' WHERE symbol = 'CC' OR network = 'CANTON';
```

**ВАЖНО:** Для каждой монеты нужно:
1. Установить правильный `address_validation_regex` в БД
2. Реализовать checksum валидацию где применимо (используя соответствующие библиотеки)
3. Добавить обработку ошибок с понятными сообщениями для пользователей
4. Протестировать валидацию на реальных адресах каждой сети

## ЧТО РЕАЛИЗОВАНО ДЛЯ CANTON И НУЖНО ДЛЯ ВСЕХ МОНЕТ

### 1. Валидация адресов
**Для Canton:**
- 4 формата адресов (HEX::HEX, namespace, classic, hex-only)
- Детальная валидация с описанием формата
- Валидация refund адресов (Canton или другие форматы)

**Нужно для всех монет:**
- Универсальный валидатор для всех сетей
- Автоматическое определение типа адреса
- Checksum валидация где применимо
- Детальные сообщения об ошибках

### 2. Иконки и UI элементы
**Для Canton:**
- Компонент `CantonIcon`
- Упоминания "Canton", "CC" в UI
- Специфичные цвета

**Нужно для всех монет:**
- Динамические иконки из `coinConfig.iconUrl`
- Универсальные тексты с подстановкой названия монеты
- Цвета из `coinConfig.color`

### 3. Цены и расчеты
**Для Canton:**
- `getCantonCoinBuyPrice()`, `getCantonCoinSellPrice()`
- `calculateCantonAmount()`
- Динамические цены из ConfigManager
- Market price с дисконтом

**Нужно для всех монет:**
- `getCoinPrice(coinSymbol, direction)`
- `calculateCoinAmount(paymentAmountUSD, coinSymbol, direction)`
- Цены из БД (`supported_coins.buy_price_usd`, `sell_price_usd`)
- Интеграция с price oracles для каждой монеты

### 4. Лимиты
**Для Canton:**
- `minCantonAmount`, `maxCantonAmount`
- Валидация минимальных сумм

**Нужно для всех монет:**
- `minAmount`, `maxAmount` из `coinConfig`
- Универсальная валидация лимитов

### 5. HD Wallet и Unique Addresses
**Для Canton:**
- Поля `uniqueAddress`, `addressPath` в заказах
- HD Wallet для TRON (payment network)

**Нужно для всех монет:**
- HD Wallet поддержка для всех сетей:
  - Bitcoin: BIP44 m/44'/0'/0'/0/index
  - Ethereum: BIP44 m/44'/60'/0'/0/index
  - BSC: как Ethereum
  - TRON: BIP44 m/44'/195'/0'/0/index (уже есть)
  - Solana: BIP44 m/44'/501'/0'/0/index
  - Polygon: как Ethereum
  - Avalanche: как Ethereum
  - Canton: специфичная логика

### 6. Telegram уведомления
**Для Canton:**
- Сообщения с "Canton Coin", "CC"
- Специфичное форматирование

**Нужно для всех монет:**
- Универсальные шаблоны сообщений
- Динамические названия монет
- Универсальное форматирование

### 7. Google Sheets
**Для Canton:**
- Сохранение `cantonAmount`, `cantonAddress`
- Специфичные колонки

**Нужно для всех монет:**
- Универсальные колонки: `coin_symbol`, `coin_amount`, `coin_address`
- Обратная совместимость со старыми заказами

### 8. Intercom
**Для Canton:**
- Создание пользователей с упоминанием Canton
- Конверсации с деталями Canton

**Нужно для всех монет:**
- Универсальные шаблоны сообщений
- Динамические названия монет

### 9. ConfigProvider
**Для Canton:**
- `useCantonPrices()` hook
- `useLimits()` с Canton лимитами

**Нужно для всех монет:**
- `useCoinPrice(coinSymbol)` hook
- `useCoinLimits(coinSymbol)` hook
- Универсальные хуки

### 10. Discount Tiers
**Для Canton:**
- Объемные скидки на основе USD суммы
- Применение к расчетам

**Нужно для всех монет:**
- Универсальная система скидок
- Настраиваемые скидки для каждой монеты (опционально)
- Или глобальные скидки для всех

### 11. Market Price и Price Oracle
**Для Canton:**
- Интеграция с Binance, CoinGecko
- Динамическое ценообразование

**Нужно для всех монет:**
- Универсальный price service
- Интеграция с CoinGecko, Binance, другими API
- Кэширование цен для всех монет
- Fallback на ручные цены

### 12. Anti-Spam
**Для Canton:**
- Проверка дублирующихся адресов
- Проверка паттернов поведения

**Нужно для всех монет:**
- Универсальная проверка для всех типов адресов
- Проверка по сети монеты

## ДОПОЛНИТЕЛЬНЫЕ ВАЖНЫЕ АСПЕКТЫ

### Email уведомления
- Проверить использование email сервиса
- Обновить шаблоны писем для универсальности
- Убрать упоминания Canton Coin из шаблонов

### Админ-панель существующая
- Проверить все админ-страницы на упоминания Canton
- Обновить статистику для всех монет
- Добавить фильтрацию по монетам в списке заказов

### Тесты существующие
- Обновить все unit тесты
- Обновить integration тесты
- Обновить тесты валидации адресов
- Добавить тесты для новых монет

### Мониторинг и логирование
- Обновить логи для универсальности
- Добавить метрики по типам монет
- Обновить дашборды мониторинга

### Безопасность
- Проверить rate limiting для новых API
- Обновить anti-spam для всех монет
- Проверить валидацию для всех сетей
- Обновить проверки прав доступа

## РЕБРЕНДИНГ: CANTON OTC → 1OTC

### 1. Обновление названия и брендинга

**Название платформы:**
- Старое: `Canton OTC`
- Новое: `1OTC` или `1OTC Platform`

**Обновить во всех местах:**
- `package.json`: `"name": "1otc"` или `"1otc-platform"`
- `README.md`: заголовок, описание
- Все компоненты UI: заголовки, мета-теги, SEO
- Telegram бот: название, описание
- Intercom: название приложения
- Email шаблоны: подписи, заголовки
- Документация: все упоминания Canton OTC → 1OTC

### 2. Обновление текстов и UI

**Убрать упоминания "Canton OTC":**
- Заменить на "1OTC" или "1OTC Platform"
- Обновить слоган: "Универсальная OTC платформа для торговли криптовалютами"
- Обновить описания: "Торгуйте Canton Coin, Bron и другими монетами"

**Обновить мета-теги:**
- `title`: "1OTC - Универсальная OTC Платформа"
- `description`: "Безопасная OTC платформа для торговли Canton Coin, Bron и другими криптовалютами"
- Open Graph теги
- Twitter Card теги

### 3. Обновление домена и контактов

**Если меняется домен:**
- Обновить `NEXT_PUBLIC_BASE_URL`
- Обновить все ссылки в коде
- Обновить CORS настройки
- Обновить webhook URLs

**Контактная информация:**
- Email: `support@1otc.cc` (или новый домен)
- Telegram: обновить username если нужно
- Обновить в ConfigMap и env переменных

### 4. Визуальная идентичность

**Логотип и иконки:**
- Создать новый логотип 1OTC
- Обновить favicon
- Обновить иконки в приложении
- Обновить изображения в README

**Цветовая схема:**
- Обновить если нужно (или оставить текущую)
- Убедиться что соответствует новому бренду

### 5. Коммуникация с пользователями

**Уведомления о ребрендинге:**
- Email рассылка существующим пользователям
- Telegram сообщение в группе
- Обновление на главной странице
- Блог пост о ребрендинге (если есть блог)

## СИСТЕМА ЗАПРОСОВ НА ДОБАВЛЕНИЕ МОНЕТ

### Критически важно: Качественная реализация системы запросов

**Требования к системе запросов:**

1. **Frontend - Форма запроса (`CoinRequestForm.tsx`):**
   - Поля: symbol, name, network, contract_address (опционально), email, telegram, reason
   - Валидация всех полей
   - Красивый UI с понятными инструкциями
   - Показ статуса запроса после отправки
   - Возможность отслеживания своего запроса

2. **Backend - API (`/api/coins/request/route.ts`):**
   - Валидация входных данных
   - Сохранение в `coin_requests` таблицу
   - Rate limiting (не более 3 запросов в день с одного email)
   - Отправка уведомлений админам (Telegram, Email)
   - Автоматический ответ пользователю (email confirmation)

3. **Админ-панель - Управление запросами:**
   - Список всех запросов с фильтрацией (pending, approved, rejected)
   - Детальная информация о каждом запросе
   - Возможность утвердить/отклонить запрос
   - При утверждении: автоматическое создание монеты в `supported_coins`
   - Уведомление пользователя о решении
   - Статистика запросов

4. **Уведомления:**
   - Пользователю: подтверждение получения запроса
   - Пользователю: уведомление о решении (approved/rejected)
   - Админам: уведомление о новом запросе
   - Админам: напоминание о pending запросах (если долго не обрабатываются)

5. **Прозрачность:**
   - Публичная страница со списком запросов (опционально)
   - Статус каждого запроса виден пользователю
   - Возможность комментировать запросы (для админов)

**Приоритет реализации:**
- Система запросов должна быть реализована КАЧЕСТВЕННО
- Это ключевая функция для будущего расширения платформы
- Пользователи должны легко создавать запросы
- Админы должны легко управлять запросами

## ВАЖНЫЕ ТРЕБОВАНИЯ

### Обратная совместимость
1. **Старые заказы должны работать:**
   - Поля `canton_amount`, `canton_address` остаются в БД
   - API должен поддерживать старый формат запросов
   - Frontend должен корректно отображать старые заказы

2. **Canton Coin и Bron как начальные монеты:**
   - Canton Coin должна быть автоматически добавлена в `supported_coins` при миграции
   - Bron должна быть добавлена в `supported_coins` при миграции
   - Все существующие заказы должны быть связаны с Canton Coin через `coin_id`
   - Bron должна быть полностью реализована: валидация, цены, лимиты, UI

3. **Миграция данных:**
   - Безопасная миграция существующих заказов
   - Заполнение новых полей из старых
   - Сохранение всех данных

### Безопасность
1. Валидация всех входных данных
2. Проверка прав доступа для админ-операций
3. Rate limiting для API
4. Защита от SQL injection

### Производительность
1. Индексы на всех полях для поиска
2. Кэширование списка монет
3. Оптимизация запросов к БД

## ПЛАН ВЫПОЛНЕНИЯ

### Шаг 1: Ребрендинг (ПРИОРИТЕТ)
1. Обновить название платформы во всех файлах (Canton OTC → 1OTC)
2. Обновить package.json, README.md
3. Обновить все UI компоненты (заголовки, мета-теги)
4. Обновить Telegram бот название
5. Обновить Intercom настройки
6. Обновить email шаблоны
7. Обновить документацию

### Шаг 2: База данных (КРИТИЧНО)
1. Создать миграцию `010_create_supported_coins.sql`
2. Создать миграцию `011_create_coin_requests.sql`
3. Создать миграцию `012_migrate_public_orders_to_universal.sql`
4. Заполнить `supported_coins` данными Canton Coin (CC)
5. Заполнить `supported_coins` данными Bron (BRON)
6. Мигрировать существующие заказы

### Шаг 3: Реализация Bron (BRON)
1. **Исследование Bron токена:**
   - Найти официальную информацию о Bron токене
   - Определить контракт адрес (если есть)
   - Определить decimals (обычно 18 для Canton токенов)
   - Найти иконку и цвета для UI

2. **Добавить Bron в БД:**
   - Добавить в `supported_coins` через миграцию
   - Настроить начальные цены (buy_price_usd, sell_price_usd)
   - Настроить лимиты (min_amount, max_amount)
   - Установить `address_validation_regex` (аналогично CC)

3. **Валидация адресов:**
   - Использовать те же функции валидации что для Canton Coin
   - Все 4 формата Canton Network адресов поддерживаются
   - Протестировать на реальных Bron адресах

4. **UI интеграция:**
   - Добавить Bron в `CoinSelector`
   - Обновить `ExchangeForm` для поддержки Bron
   - Обновить `OrderSummary` для отображения Bron
   - Добавить иконку Bron (или использовать placeholder)
   - Обновить цвета и стили

5. **Интеграции:**
   - Обновить Telegram уведомления для Bron
   - Обновить Google Sheets для Bron
   - Обновить Intercom для Bron
   - Обновить все тексты с упоминанием Bron

6. **Тестирование:**
   - Протестировать создание заказа для Bron
   - Протестировать валидацию адресов Bron
   - Протестировать расчеты цен для Bron
   - Протестировать все интеграции

### Шаг 4: Система запросов на добавление монет (КРИТИЧНО)
1. Создать `CoinRequestForm.tsx` компонент
2. Создать `/api/coins/request/route.ts` API
3. Создать админ-панель для управления запросами
4. Реализовать уведомления (пользователям и админам)
5. Реализовать автоматическое создание монеты при утверждении
6. Добавить rate limiting для запросов
7. Протестировать весь flow запросов

### Шаг 5: TypeScript интерфейсы
1. Создать `CoinConfig` интерфейс
2. Создать `CoinRequest` интерфейс
3. Модифицировать `OTCOrder` интерфейс
4. Обновить все импорты

### Шаг 6: Backend сервисы
1. Создать `coinService.ts`
2. Создать `universalAddressValidator.ts`
3. Модифицировать `cantonValidation.ts` → `addressValidation.ts`
4. Обновить `telegram.ts`

### Шаг 7: Backend API
1. Создать `/api/coins/route.ts`
2. Создать `/api/coins/request/route.ts`
3. Создать `/api/admin/coins/route.ts`
4. Создать `/api/admin/coins/[coinId]/route.ts`
5. Модифицировать `/api/create-order/route.ts`

### Шаг 8: Frontend компоненты
1. Создать `CoinSelector.tsx`
2. Создать `CoinRequestForm.tsx`
3. Создать админ-панель управления монетами
4. Модифицировать `ExchangeForm.tsx`
5. Модифицировать `ExchangeFormCompact.tsx`
6. Модифицировать `OrderSummary.tsx`
7. Модифицировать `WalletDetailsForm.tsx`
8. Модифицировать `ConfigProvider.tsx`

### Шаг 9: Конфигурация
1. Модифицировать `src/config/otc.ts`
2. Обновить `config/kubernetes/k8s/configmap.yaml`

### Шаг 10: Интеграции
1. Обновить `googleSheets.ts` для универсальных монет
2. Обновить `intercom.ts` для универсальных монет
3. Обновить `marketPriceService.ts` для всех монет
4. Обновить `price-oracle/index.ts`
5. Обновить `config-manager.ts`
6. Обновить `metricsCollector.ts`

### Шаг 11: HD Wallet
1. Расширить поддержку HD Wallet для всех сетей
2. Обновить `addressGeneratorService` (если используется)
3. Обновить сохранение `uniqueAddress` и `addressPath`

### Шаг 12: SEO и тексты (частично в ребрендинге)
1. Обновить все тексты на сайте
2. Обновить мета-теги
3. Обновить `SEOLandingContent.tsx`
4. Обновить FAQ и How It Works

### Шаг 13: Тестирование
1. Тесты для миграций БД
2. Тесты для новых API
3. Тесты для валидации адресов
4. Тесты для компонентов
5. Интеграционные тесты

2. Поддержка HD Wallet для всех поддерживаемых блокчейнов
3. Обновить `addressGeneratorService` (если используется)
4. Обновить сохранение `uniqueAddress` и `addressPath` в БД

### Шаг 10: SEO и тексты
1. Обновить все тексты на сайте (убрать упоминания "Canton")
2. Обновить мета-теги и SEO
3. Обновить `SEOLandingContent.tsx`
4. Обновить FAQ и How It Works страницы

### Шаг 11: Тестирование
1. Обновить существующие тесты для универсальности
2. Тесты для миграций БД
3. Тесты для новых API
4. Тесты для валидации адресов всех сетей
5. Тесты для компонентов
6. Интеграционные тесты
7. Тесты для price oracle для разных монет

### Шаг 12: Документация
1. Обновить `README.md`
2. Создать `docs/guides/COIN_MANAGEMENT.md`
3. Создать `docs/guides/ADDING_NEW_COIN.md`
4. Обновить существующую документацию

## КРИТЕРИИ УСПЕХА

1. ✅ Ребрендинг завершен: Canton OTC → 1OTC во всех местах
2. ✅ Пользователь может торговать Canton Coin (CC)
3. ✅ Пользователь может торговать Bron (BRON)
4. ✅ Пользователь может создать запрос на добавление новой монеты
5. ✅ Админ может управлять запросами через админ-панель
6. ✅ Админ может утвердить запрос и монета автоматически добавляется
7. ✅ Валидация адресов работает для CC и BRON (Canton Network)
8. ✅ Старые заказы отображаются корректно
9. ✅ Система запросов работает качественно и удобно
10. ✅ Все тесты проходят
11. ✅ Документация обновлена
12. ✅ SEO тексты обновлены для 1OTC

## НАЧАТЬ ВЫПОЛНЕНИЕ

Изучи текущую структуру проекта, затем выполни все шаги последовательно, 
следуя best practices и сохраняя обратную совместимость.

**ВАЖНО:** Перед началом работы прочитай файл `UNIVERSAL_OTC_PLATFORM_TRANSFORMATION.md` 
для полного понимания архитектуры и требований.
