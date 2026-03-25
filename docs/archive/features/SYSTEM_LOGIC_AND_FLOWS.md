# 🧠 ЛОГИКА И FLOW СИСТЕМЫ CANTON OTC

## 📋 СОДЕРЖАНИЕ

1. [OTC Order Creation Flow](#1-otc-order-creation-flow)
2. [Ценообразование и расчеты](#2-ценообразование-и-расчеты)
3. [Валидации и проверки](#3-валидации-и-проверки)
4. [Anti-Spam и Rate Limiting](#4-anti-spam-и-rate-limiting)
5. [DEX Swap Flow (NEAR Intents)](#5-dex-swap-flow-near-intents)
6. [Solver Node Flow](#6-solver-node-flow)
7. [Интеграции и уведомления](#7-интеграции-и-уведомления)
8. [Order Status Management](#8-order-status-management)

---

## 1. OTC ORDER CREATION FLOW

### 1.1. Полный цикл создания ордера

#### ШАГ 1: Пользователь заполняет форму (Frontend)

**Механика расчета на фронтенде:**

1. **Выбор направления обмена:**
   - `buy` - Покупка Canton за USDT/другие токены
   - `sell` - Продажа Canton за USDT/другие токены

2. **Выбор токена оплаты:**
   - Поддерживаемые токены: USDT (TRC-20, ERC-20, BEP-20), USDC, ETH
   - Каждый токен имеет: `symbol`, `network`, `priceUSD`, `minAmount`

3. **Ввод суммы оплаты:**
   - Пользователь вводит количество токена (например, 100 USDT)
   - Система автоматически рассчитывает количество Canton

4. **Расчет Canton amount (BUY):**
   ```
   usdValue = paymentAmount * token.priceUSD
   priceWithCommission = buyPrice * (1 + serviceCommission / 100)
   baseAmount = usdValue / priceWithCommission
   tier = getDiscountTier(usdValue)
   discountMultiplier = 1 + tier.discount
   cantonAmount = baseAmount * discountMultiplier
   ```
   - **Комиссия сервиса**: добавляется к цене покупки (пользователь платит больше за Canton)
   - **Объемная скидка**: пользователь получает БОЛЬШЕ Canton токенов при больших суммах

5. **Расчет USDT amount (SELL):**
   ```
   priceWithCommission = sellPrice * (1 - serviceCommission / 100)
   usdValue = cantonAmount * priceWithCommission
   tier = getDiscountTier(usdValue)
   discountMultiplier = 1 + tier.discount
   usdtWithBonus = usdValue * discountMultiplier
   usdtAmount = usdtWithBonus / token.priceUSD
   ```
   - **Комиссия сервиса**: вычитается из цены продажи (пользователь получает меньше USDT)
   - **Объемная скидка**: пользователь получает БОЛЬШЕ USDT при больших суммах

6. **Ручная цена (Manual Price):**
   - Пользователь может предложить свою цену
   - Валидация: цена должна быть в диапазоне ±10% от рыночной
   - Если валидна, используется для расчета вместо рыночной

7. **Ввод Canton адреса:**
   - Для BUY: адрес для получения Canton
   - Для SELL: адрес для получения USDT (receivingAddress)

8. **Опциональные поля:**
   - `refundAddress` - адрес для возврата средств при ошибке
   - `email` - обязательное
   - `whatsapp`, `telegram` - опциональные контакты

#### ШАГ 2: Отправка запроса на API

**Endpoint:** `POST /api/create-order`

**Payload:**
```json
{
  "exchangeDirection": "buy" | "sell",
  "paymentToken": { "symbol": "USDT", "network": "TRON", ... },
  "paymentAmount": 100,
  "paymentAmountUSD": 100,
  "cantonAmount": 250,
  "cantonAddress": "alice::1234...",
  "receivingAddress": "T...", // только для SELL
  "refundAddress": "alice::5678...", // опционально
  "email": "user@example.com",
  "whatsapp": "+1234567890", // опционально
  "telegram": "@username", // опционально
  "manualPrice": 0.44 // опционально, если пользователь предложил свою цену
}
```

#### ШАГ 3: Обработка на Backend

**Последовательность проверок:**

1. **Rate Limiting (первая линия защиты):**
   - Проверка IP: максимум N запросов в минуту
   - Проверка email: максимум M запросов в час
   - Если превышен лимит → 429 ошибка с заголовками `X-RateLimit-*`

2. **Парсинг и базовая валидация:**
   - Проверка JSON формата
   - Проверка обязательных полей: `cantonAmount`, `cantonAddress`, `email`
   - Проверка формата email (regex)
   - Проверка числовых значений > 0
   - Проверка минимальной суммы (MIN_USDT_AMOUNT)

3. **Anti-Spam Detection:**
   - Проверка дублирующихся сумм (5 минут окно)
   - Проверка дублирующихся адресов (5 минут окно)
   - Проверка быстрых заявок (1 минута окно, максимум 3 заявки)
   - Проверка подозрительных IP (блокированные IP, много заявок за 24 часа)
   - Анализ паттернов поведения
   - Если спам обнаружен → 400 ошибка с `riskLevel` и `confidence`

4. **Валидация Canton адреса:**
   - Проверка формата: `name::fingerprint` или hex-only
   - Длина: минимум 32 символа, максимум 150
   - Поддерживаемые форматы:
     - `HEX::HEX` (64+ символов) - самый распространенный
     - `namespace::fingerprint` (40+ символов)
     - `name:fingerprint` (классический формат)
     - `hex-only` (32+ символов)
   - Если невалиден → 400 ошибка

5. **Валидация refund адреса (если указан):**
   - Сначала проверка как Canton адрес
   - Если не Canton, проверка других форматов (TRON, Ethereum, Bitcoin, Solana)
   - Опциональное поле, но если указан - должен быть валидным

6. **Валидация receiving адреса (только для SELL):**
   - Обязательное поле при продаже Canton
   - Валидация в зависимости от network токена:
     - TRON: формат `T[A-Za-z1-9]{33}`
     - ETHEREUM/BSC/OPTIMISM: формат `0x[a-fA-F0-9]{40}`
   - Если невалиден → 400 ошибка

7. **Валидация курса обмена (критическая проверка):**

   **Для BUY:**
   ```
   buyPrice = await getCantonCoinBuyPrice() // Динамическая цена из ConfigManager
   baseAmount = paymentAmountUSD / buyPrice
   tier = getDiscountTier(paymentAmountUSD)
   discountMultiplier = 1 + tier.discount
   expectedCantonAmount = baseAmount * discountMultiplier
   tolerance = expectedCantonAmount * 0.05 // 5% допуск
   
   if (Math.abs(cantonAmount - expectedCantonAmount) > tolerance) {
     throw Error('Invalid exchange rate calculation')
   }
   ```

   **Для SELL:**
   ```
   sellPrice = await getCantonCoinSellPrice() // Динамическая цена из ConfigManager
   baseUsdValue = cantonAmount * sellPrice
   tier = getDiscountTier(baseUsdValue)
   discountMultiplier = 1 + tier.discount
   expectedUsdtAmount = baseUsdValue * discountMultiplier
   actualUsdtAmount = paymentAmount
   tolerance = expectedUsdtAmount * 0.05
   
   if (Math.abs(actualUsdtAmount - expectedUsdtAmount) > tolerance) {
     throw Error('Invalid exchange rate calculation')
   }
   ```
   
   - **Механика:** Проверяет, что пользователь не пытается обмануть систему, подставив неправильные суммы
   - **Допуск 5%:** Учитывает возможные расхождения из-за округлений и ручных цен
   - Если невалиден → 400 ошибка

8. **Генерация Order ID:**
   ```
   timestamp = Date.now().toString(36)
   randomPart = Math.random().toString(36).substring(2, 8)
   orderId = `${timestamp}-${randomPart}`.toUpperCase()
   ```
   - Формат: `TIMESTAMP-RANDOM` (например, `LXP123-ABC456`)

9. **Создание объекта Order:**
   ```typescript
   order = {
     orderId,
     paymentToken,
     paymentAmount,
     paymentAmountUSD,
     cantonAmount,
     cantonAddress,
     receivingAddress, // только для SELL
     refundAddress,
     email: email.toLowerCase(),
     whatsapp,
     telegram,
     exchangeDirection,
     timestamp: Date.now(),
     status: 'awaiting-deposit',
     usdtAmount // Legacy compatibility
   }
   ```

10. **Асинхронная обработка (не блокирует ответ):**
    - Запускается в фоне через `processOrderAsync()`
    - Параллельно выполняются:
      - Сохранение в Google Sheets
      - Отправка уведомления в Intercom
      - Отправка уведомления в Telegram
    - Ошибки логируются, но не влияют на ответ API

11. **Немедленный ответ пользователю:**
    ```json
    {
      "success": true,
      "orderId": "LXP123-ABC456",
      "message": "Order created successfully. Please contact customer support for payment instructions.",
      "status": "awaiting-deposit",
      "processingTime": "45ms",
      "paymentAddress": null, // В минимальной версии адрес получается через поддержку
      "paymentNetwork": "TRON",
      "paymentToken": "USDT",
      "notifications": {
        "sheets": true,
        "intercom": true,
        "email": false
      },
      "validation": {
        "cantonAddress": "alice::1234...",
        "refundAddress": "alice::5678...",
        "addressValid": true
      },
      "spamCheck": {
        "passed": true,
        "riskLevel": "LOW",
        "confidence": 0
      }
    }
    ```

#### ШАГ 4: Фоновые интеграции

**Параллельное выполнение:**

1. **Google Sheets:**
   - Аутентификация через Service Account (email + private key)
   - Поиск последней заполненной строки в колонке A
   - Запись в следующую строку (A:P):
     ```
     [orderId, timestamp, usdtAmount, cantonAmount, cantonAddress, refundAddress, 
      email, whatsapp, telegram, status, txHash, createdAt, uniqueAddress, 
      addressPath, paymentNetwork, paymentToken]
     ```
   - Если ошибка → логируется, но не блокирует другие интеграции

2. **Intercom:**
   - Создание/обновление пользователя по email
   - Создание conversation с деталями заказа
   - Форматирование сообщения:
     - Тип операции (BUY/SELL)
     - Суммы и токены
     - Адреса
     - Контакты
   - Если ошибка → fallback на локальное логирование

3. **Telegram:**
   - Отправка сообщения в группу/канал
   - Форматирование с HTML разметкой
   - Inline кнопки для операторов:
     - "✅ Принять заказ"
     - "📧 Написать клиенту"
     - "📊 Открыть в админке"
     - "💳 Отправить реквизиты"
   - Если ошибка → fallback на локальное логирование

---

## 2. ЦЕНООБРАЗОВАНИЕ И РАСЧЕТЫ

### 2.1. Источники цен

**Статический режим (USE_DYNAMIC_PRICING = false):**
- Цены берутся из Kubernetes ConfigMap:
  - `CANTON_COIN_BUY_PRICE_USD` (например, 0.44)
  - `CANTON_COIN_SELL_PRICE_USD` (например, 0.12)
- Используются синхронные геттеры: `getCantonCoinBuyPriceSync()`, `getCantonCoinSellPriceSync()`

**Динамический режим (USE_DYNAMIC_PRICING = true):**
- Цены рассчитываются на основе рыночных данных:
  - Источник: `marketPriceService` (интеграция с внешними API)
  - Применяются маржи:
    - `BUY_MARKUP_PERCENT` (например, 3%) - добавляется к рыночной цене
    - `SELL_MARKUP_PERCENT` (например, 5%) - добавляется к рыночной цене
- Используются асинхронные геттеры: `getCantonCoinBuyPrice()`, `getCantonCoinSellPrice()`

**Логика выбора:**
```typescript
if (USE_DYNAMIC_PRICING) {
  marketPrice = await marketPriceService.getCantonPrice()
  buyPrice = marketPrice * (1 + BUY_MARKUP_PERCENT / 100)
  sellPrice = marketPrice * (1 + SELL_MARKUP_PERCENT / 100)
} else {
  buyPrice = CANTON_COIN_BUY_PRICE_USD
  sellPrice = CANTON_COIN_SELL_PRICE_USD
}
```

### 2.2. Объемные скидки (Discount Tiers)

**Таблица скидок:**
```typescript
DISCOUNT_TIERS = [
  { minAmount: 0, maxAmount: 100, discount: 0, label: "Standard" },
  { minAmount: 100, maxAmount: 500, discount: 0.02, label: "Bronze" }, // +2%
  { minAmount: 500, maxAmount: 1000, discount: 0.05, label: "Silver" }, // +5%
  { minAmount: 1000, maxAmount: 5000, discount: 0.10, label: "Gold" }, // +10%
  { minAmount: 5000, maxAmount: Infinity, discount: 0.15, label: "Platinum" } // +15%
]
```

**Механика применения:**

**Для BUY (покупка Canton):**
- Пользователь платит фиксированную сумму в USD
- Система рассчитывает базовое количество Canton: `baseAmount = usdValue / buyPrice`
- Применяется скидка: `cantonAmount = baseAmount * (1 + tier.discount)`
- **Результат:** Пользователь получает БОЛЬШЕ Canton токенов при больших суммах

**Для SELL (продажа Canton):**
- Пользователь продает фиксированное количество Canton
- Система рассчитывает базовую стоимость в USD: `baseUsdValue = cantonAmount * sellPrice`
- Применяется скидка: `usdtAmount = baseUsdValue * (1 + tier.discount)`
- **Результат:** Пользователь получает БОЛЬШЕ USDT при больших суммах

**Пример расчета (BUY):**
```
Пользователь платит: $1000
Buy Price: $0.44
Tier: Gold (+10% bonus)

baseAmount = 1000 / 0.44 = 2272.73 Canton
discountMultiplier = 1 + 0.10 = 1.10
cantonAmount = 2272.73 * 1.10 = 2500 Canton

Пользователь получает 2500 Canton вместо 2272.73 (бонус 227.27 Canton)
```

### 2.3. Комиссия сервиса (Service Commission)

**Настройка:**
- Берется из ConfigMap: `SERVICE_COMMISSION` (по умолчанию 3%)
- Может быть переопределена через API `/api/config`

**Применение:**

**Для BUY:**
```
priceWithCommission = buyPrice * (1 + serviceCommission / 100)
baseAmount = usdValue / priceWithCommission
```
- Комиссия УВЕЛИЧИВАЕТ цену покупки (пользователь платит больше)

**Для SELL:**
```
priceWithCommission = sellPrice * (1 - serviceCommission / 100)
usdValue = cantonAmount * priceWithCommission
```
- Комиссия УМЕНЬШАЕТ цену продажи (пользователь получает меньше)

**Пример (BUY, commission = 3%):**
```
Buy Price: $0.44
Service Commission: 3%

priceWithCommission = 0.44 * 1.03 = $0.4532
Пользователь платит $0.4532 за 1 Canton вместо $0.44
```

### 2.4. Ручная цена (Manual Price)

**Механика:**
1. Пользователь включает чекбокс "Suggest your price"
2. Вводит свою цену
3. Система валидирует: цена должна быть в диапазоне ±10% от рыночной
4. Если валидна, используется для расчета вместо рыночной

**Валидация:**
```typescript
if (price < marketPrice * 0.9) {
  return { valid: false, error: 'Price too low (min -10% from market)' }
}
if (price > marketPrice * 1.1) {
  return { valid: false, error: 'Price too high (max +10% from market)' }
}
```

**Применение:**
- Используется вместо `buyPrice` или `sellPrice` в расчетах
- Все остальные механики (комиссия, скидки) применяются к ручной цене

---

## 3. ВАЛИДАЦИИ И ПРОВЕРКИ

### 3.1. Валидация Canton адреса

**Форматы адресов:**
1. **HEX::HEX** (64+ символов):
   - Паттерн: `^[a-fA-F0-9]{32,}::[a-fA-F0-9]{32,}$`
   - Пример: `1234567890abcdef1234567890abcdef::deadbeef12345678abcdef1234567890abcdef`
   - **Самый распространенный формат**

2. **Namespace::Fingerprint** (40+ символов):
   - Паттерн: `^[a-zA-Z][a-zA-Z0-9_]*::[a-fA-F0-9]{32,}$`
   - Пример: `bron::1234567890abcdef1234567890abcdef12345678`

3. **Name:Fingerprint** (классический):
   - Паттерн: `^[a-zA-Z][a-zA-Z0-9_-]{2,49}::[a-fA-F0-9]{32,80}$`
   - Пример: `alice::1234567890abcdef1234567890abcdef12345678`

4. **Hex-only** (32+ символов):
   - Паттерн: `^[a-fA-F0-9]{32,80}$`
   - Пример: `1234567890abcdef1234567890abcdef12345678`

**Проверки:**
- Длина: минимум 32 символа, максимум 150
- Формат должен соответствовать одному из паттернов
- Если невалиден → ошибка с описанием формата

### 3.2. Валидация receiving адреса (для SELL)

**TRON адреса:**
- Паттерн: `^T[A-Za-z1-9]{33}$`
- Пример: `TNaRAoLUyYEV15ZF9FvWs6StdMdRCCMK3f`

**Ethereum/BSC/Optimism адреса:**
- Паттерн: `^0x[a-fA-F0-9]{40}$`
- Пример: `0x742d35Cc6634C0532925a3B8D000B47E0e`

**Валидация:**
- Проверяется формат в зависимости от `paymentToken.network`
- Если невалиден → ошибка с указанием сети

### 3.3. Валидация refund адреса

**Последовательность проверок:**
1. Сначала проверка как Canton адрес
2. Если не Canton, проверка других форматов:
   - TRON
   - Bitcoin (Legacy, SegWit, Bech32)
   - Ethereum
   - Binance Chain
   - Solana
3. Опциональное поле, но если указан - должен быть валидным

### 3.4. Валидация курса обмена

**Механика:**
- Проверяет, что пользователь не пытается обмануть систему
- Сравнивает переданные суммы с расчетными на основе текущих цен
- Допуск: 5% (учитывает округления и ручные цены)

**Для BUY:**
```
expectedCantonAmount = (paymentAmountUSD / buyPrice) * (1 + tier.discount)
tolerance = expectedCantonAmount * 0.05

if (Math.abs(cantonAmount - expectedCantonAmount) > tolerance) {
  throw Error('Invalid exchange rate calculation')
}
```

**Для SELL:**
```
expectedUsdtAmount = (cantonAmount * sellPrice) * (1 + tier.discount)
tolerance = expectedUsdtAmount * 0.05

if (Math.abs(paymentAmount - expectedUsdtAmount) > tolerance) {
  throw Error('Invalid exchange rate calculation')
}
```

---

## 4. ANTI-SPAM И RATE LIMITING

### 4.1. Rate Limiting

**Уровни ограничений:**

1. **Order Creation Limit (IP-based):**
   - Лимит: `RATE_LIMIT_ORDER_CREATION` (по умолчанию 5 запросов)
   - Окно: 1 минута
   - При превышении → 429 ошибка

2. **Order Creation Limit (Email-based):**
   - Лимит: `RATE_LIMIT_EMAIL` (по умолчанию 10 запросов)
   - Окно: 1 час
   - При превышении → 429 ошибка

3. **General API Limit:**
   - Лимит: `RATE_LIMIT_GENERAL` (по умолчанию 100 запросов)
   - Окно: 1 минута
   - Используется для статус-проверок и других API

**Заголовки ответа:**
```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 3
X-RateLimit-Reset: 1634567890
```

### 4.2. Anti-Spam Detection

**Паттерны обнаружения:**

1. **Дублирующиеся суммы (DUPLICATE_AMOUNT):**
   - Окно: 5 минут
   - Проверка: 2+ заявки с одинаковой суммой (точность до цента)
   - Confidence: `duplicateCount * 30` (макс. 100)
   - Severity: CRITICAL (5+), HIGH (3+), MEDIUM (2+)

2. **Дублирующиеся адреса (DUPLICATE_ADDRESS):**
   - Окно: 5 минут
   - Проверка: 2+ заявки на один Canton адрес
   - Confidence: `duplicateCount * 25` (макс. 100)
   - Severity: CRITICAL (4+), HIGH (3+), MEDIUM (2+)

3. **Быстрые заявки (RAPID_ORDERS):**
   - Окно: 1 минута
   - Лимит: 3 заявки с одного IP
   - Confidence: `rapidCount * 20` (макс. 100)
   - Severity: CRITICAL (5+), HIGH (4+), MEDIUM (3+)

4. **Подозрительные IP (SUSPICIOUS_IP):**
   - Проверка блокированных IP (временная блокировка)
   - Проверка истории: 10+ заявок за 24 часа
   - Проверка множественных email: 5+ разных email с одного IP за 24 часа
   - Confidence: зависит от паттерна

5. **Анализ паттернов поведения:**
   - Комбинированный анализ всех паттернов
   - Вычисление общего risk level

**Блокировка:**
- При обнаружении спама → временная блокировка IP
- Время блокировки зависит от severity:
  - CRITICAL: 24 часа
  - HIGH: 6 часов
  - MEDIUM: 1 час

**Результат:**
```typescript
{
  isSpam: boolean,
  confidence: number, // 0-100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
  reason: string,
  patterns: SpamPattern[]
}
```

---

## 5. DEX SWAP FLOW (NEAR INTENTS)

### 5.1. Создание Swap Intent

#### ШАГ 1: Пользователь инициирует swap

**Параметры:**
- `fromToken` - токен отправки (например, "NEAR", "USDT")
- `fromChain` - сеть отправки (например, "NEAR", "ETHEREUM")
- `toToken` - токен получения (например, "USDT", "NEAR")
- `toChain` - сеть получения
- `amount` - количество токена отправки
- `userAccount` - NEAR account ID пользователя
- `dexFee` - комиссия DEX (опционально, берется из конфига)

#### ШАГ 2: Получение цены через Price Oracle

**Источники цен:**
1. **REF Finance** - основной DEX на NEAR
2. **Pyth Network** - оракул цен

**Механика:**
```typescript
priceQuote = await getBestPriceQuote(fromToken, toToken, amount)
// Возвращает:
{
  estimatedOut: number, // Ожидаемое количество токена получения
  swapRate: number, // Курс обмена
  source: 'REF_FINANCE' | 'PYTH',
  route: string[] // Маршрут обмена (для multi-hop swaps)
}
```

**Расчет slippage protection:**
```typescript
minReceive = calculateMinReceive(priceQuote.estimatedOut, 0.005) // 0.5% slippage
priceImpact = await calculatePriceImpact(fromToken, toToken, amount)
```

#### ШАГ 3: Проверка баланса пользователя

**Для fungible tokens (FT):**
```typescript
tokenContract = getTokenContract(fromToken, fromChain)
balance = await getTokenBalance(userAccount, tokenContract, fromToken, decimals, network)
requiredAmount = amountBN + dexFeeAmount

if (balance < requiredAmount) {
  return Error('Insufficient balance')
}
```

**Для native NEAR:**
```typescript
balance = await getNearBalance(userAccount, network)
gasReserve = 0.1 NEAR // Резерв на gas
requiredAmount = amountBN + dexFeeAmount + gasReserve

if (balance < requiredAmount) {
  return Error('Insufficient NEAR balance (including gas reserve)')
}
```

#### ШАГ 4: Расчет комиссии DEX

**Механика:**
```typescript
dexFeePercent = dexFee || 0.003 // 0.3% по умолчанию
fromTokenDecimals = getTokenDecimals(fromToken)
amountBN = BigInt(Math.floor(amount * Math.pow(10, fromTokenDecimals)))
dexFeeAmount = amountBN * BigInt(Math.floor(dexFeePercent * 1e6)) / BigInt(1e6)
```

**Получатель комиссии:**
- `NEAR_DEX_FEE_RECIPIENT` - адрес для получения комиссий

#### ШАГ 5: Создание Intent данных

**Структура Intent:**
```typescript
intentArgs = {
  from_token: fromToken,
  from_chain: fromChain,
  to_token: toToken,
  to_chain: toChain,
  amount: amountBN.toString(), // В наименьших единицах токена
  min_receive: minReceiveBN.toString(), // Защита от slippage
  user_account: userAccount,
  deadline: Math.floor(Date.now() / 1000) + 3600, // 1 час на исполнение
  app_fees: dexFeeAmount.toString(), // Комиссия DEX
  fee_recipient: feeRecipient // Адрес получателя комиссии
}
```

#### ШАГ 6: Валидация через SDK

```typescript
validation = sdk.validateSwapIntent(intentArgs)
if (!validation.valid) {
  return Error(validation.error)
}
```

#### ШАГ 7: Подготовка транзакции

```typescript
transactionData = sdk.prepareSwapIntentTransaction(intentArgs)
```

**Возврат пользователю:**
```json
{
  "success": true,
  "status": "pending",
  "intent": intentArgs,
  "message": "Swap intent готов к подписанию. Подпишите транзакцию в кошельке.",
  "transactionData": {...},
  "feeInfo": {
    "percent": 0.3,
    "amount": "3000000",
    "recipient": "fee-recipient.near"
  },
  "priceInfo": {
    "estimatedOut": 100.5,
    "swapRate": 1.005,
    "priceImpact": 0.2,
    "source": "REF_FINANCE",
    "route": ["NEAR", "USDT"]
  }
}
```

#### ШАГ 8: Подписание транзакции пользователем

- Пользователь подписывает транзакцию через NEAR Wallet
- Транзакция отправляется в блокчейн
- Intent создается в смарт-контракте

### 5.2. Исполнение Intent (Solver Node)

**См. раздел 6. Solver Node Flow**

---

## 6. SOLVER NODE FLOW

### 6.1. Мониторинг Intents

**Цикл polling:**
1. Интервал: `SOLVER_POLLING_INTERVAL` (по умолчанию 2000ms)
2. Получение pending intents из контракта:
   ```typescript
   intentsData = await view({
     account: contractId,
     method: 'get_pending_intents',
     args: { from_block: lastCheckedBlock }
   })
   ```
3. Обработка каждого intent

### 6.2. Обработка Intent

**ШАГ 1: Валидация Intent**

```typescript
isValid = profitabilityCalculator.isValidIntent(intent)
// Проверки:
// - intent_id, from_token, to_token присутствуют
// - from_token !== to_token
// - amount > 0
// - min_receive > 0
```

**ШАГ 2: Проверка прибыльности**

```typescript
profitability = await profitabilityCalculator.checkProfitability(intent)
```

**Расчет прибыльности:**

1. **Проверка deadline:**
   ```typescript
   if (intent.deadline <= now) {
     return { isProfitable: false, reason: 'Deadline expired' }
   }
   ```

2. **Получение текущей цены:**
   ```typescript
   priceQuote = await priceOracle.getBestPrice(fromToken, toToken, amount)
   ```

3. **Расчет прибыли:**
   ```typescript
   estimatedOutput = parseFloat(priceQuote.amountOut)
   profit = estimatedOutput - minReceive
   gasCost = 0.01 NEAR // Примерно
   netProfit = profit - gasCost
   profitPercent = (netProfit / minReceive) * 100
   ```

4. **Проверка threshold:**
   ```typescript
   minProfitThreshold = SOLVER_MIN_PROFIT_THRESHOLD // 0.1 по умолчанию
   isProfitable = netProfit > minProfitThreshold && netProfit > 0
   ```

**Результат:**
```typescript
{
  isProfitable: boolean,
  profit: number,
  profitPercent: number,
  estimatedOutput: number,
  minReceive: number,
  gasCost: number,
  netProfit: number,
  reason: string
}
```

**ШАГ 3: Исполнение Intent**

```typescript
if (profitability.isProfitable) {
  executionResult = await executor.executeIntent(intent, profitability)
}
```

**Механика исполнения:**
1. Выполнение swap на DEX (REF Finance)
2. Получение токенов получателя
3. Отправка токенов пользователю
4. Получение комиссии DEX
5. Обновление статуса intent в контракте

**Результат:**
```typescript
{
  success: boolean,
  transactionHash: string,
  error?: string
}
```

### 6.3. Логика прибыльности

**Условия прибыльности:**
1. `deadline > now` - Intent не истек
2. `priceQuote` доступен - Оракул цен работает
3. `estimatedOutput > minReceive` - Ожидаемый выход больше минимального
4. `netProfit > minProfitThreshold` - Чистая прибыль превышает порог
5. `netProfit > 0` - Прибыль положительная

**Расчет чистой прибыли:**
```
netProfit = (estimatedOutput - minReceive) - gasCost
```

**Где:**
- `estimatedOutput` - ожидаемое количество токена получения (из price oracle)
- `minReceive` - минимальное количество, которое пользователь готов принять
- `gasCost` - стоимость газа для исполнения транзакции

**Пример:**
```
Intent: NEAR -> USDT, amount = 10 NEAR, min_receive = 1000 USDT
Price Oracle: 10 NEAR = 1010 USDT
Gas Cost: 0.01 NEAR = 1 USDT

profit = 1010 - 1000 = 10 USDT
netProfit = 10 - 1 = 9 USDT
profitPercent = (9 / 1000) * 100 = 0.9%

Если minProfitThreshold = 0.1 USDT, то intent прибылен
```

---

## 7. ИНТЕГРАЦИИ И УВЕДОМЛЕНИЯ

### 7.1. Google Sheets

**Механика сохранения:**

1. **Аутентификация:**
   - Service Account (email + private key из env)
   - JWT токен для доступа к Google Sheets API

2. **Поиск последней строки:**
   ```typescript
   // Получаем все значения колонки A
   lastRowResponse = await sheets.spreadsheets.values.get({
     spreadsheetId,
     range: 'Sheet1!A:A'
   })
   
   // Находим последнюю непустую строку (пропускаем заголовок)
   lastRowIndex = findLastNonEmptyRow(rows)
   nextRowIndex = lastRowIndex <= 1 ? 2 : lastRowIndex + 1
   ```

3. **Запись данных:**
   ```typescript
   rowData = [
     orderId,
     timestamp,
     usdtAmount,
     cantonAmount,
     cantonAddress,
     refundAddress,
     email,
     whatsapp,
     telegram,
     status,
     txHash,
     createdAt,
     uniqueAddress,
     addressPath,
     paymentNetwork,
     paymentToken
   ]
   
   await sheets.spreadsheets.values.update({
     spreadsheetId,
     range: `Sheet1!A${nextRowIndex}:P${nextRowIndex}`,
     valueInputOption: 'RAW',
     requestBody: { values: [rowData] }
   })
   ```

4. **Обновление статуса:**
   ```typescript
   // Поиск строки по orderId
   rowIndex = findRowByOrderId(orderId)
   
   // Обновление колонки J (status) и K (txHash)
   await sheets.spreadsheets.values.batchUpdate({
     spreadsheetId,
     requestBody: {
       valueInputOption: 'RAW',
       data: [
         { range: `Sheet1!J${rowIndex}`, values: [[status]] },
         { range: `Sheet1!K${rowIndex}`, values: [[txHash]] }
       ]
     }
   })
   ```

### 7.2. Intercom

**Механика уведомлений:**

1. **Создание/обновление пользователя:**
   ```typescript
   user = await axios.post('/contacts', {
     email: order.email,
     custom_attributes: {
       total_orders: count,
       last_order_date: timestamp,
       preferred_contact: 'email'
     }
   })
   ```

2. **Создание conversation:**
   ```typescript
   conversation = await axios.post('/conversations', {
     from: { type: 'contact', id: user.id },
     body: formatOrderMessage(order)
   })
   ```

3. **Форматирование сообщения:**
   - Тип операции (BUY/SELL)
   - Суммы и токены
   - Адреса
   - Контакты пользователя
   - Order ID и timestamp

4. **Отправка ответа оператора:**
   ```typescript
   await axios.post(`/conversations/${conversationId}/parts`, {
     message_type: 'note',
     type: 'admin',
     body: `**${operatorName}:** ${message}`
   })
   ```

### 7.3. Telegram

**Механика уведомлений:**

1. **Отправка сообщения:**
   ```typescript
   await axios.post(`/bot${botToken}/sendMessage`, {
     chat_id: chatId,
     text: formatOrderMessage(order),
     parse_mode: 'HTML',
     reply_markup: {
       inline_keyboard: [
         [{ text: '✅ Принять заказ', callback_data: `accept_${orderId}` }],
         [{ text: '📧 Написать клиенту', callback_data: `contact_${orderId}` }],
         [{ text: '📊 Открыть в админке', url: adminUrl }],
         [{ text: '💳 Отправить реквизиты', callback_data: `payment_${orderId}` }]
       ]
     }
   })
   ```

2. **Форматирование сообщения:**
   - HTML разметка для читаемости
   - Тип операции (BUY/SELL) с эмодзи
   - Суммы и токены
   - Адреса (с форматированием)
   - Контакты
   - Order ID и timestamp

3. **Обновление статуса:**
   ```typescript
   await axios.post(`/bot${botToken}/sendMessage`, {
     chat_id: chatId,
     text: formatStatusUpdateMessage(order, newStatus, additionalInfo),
     parse_mode: 'HTML'
   })
   ```

---

## 8. ORDER STATUS MANAGEMENT

### 8.1. Статусы ордера

**Жизненный цикл:**

1. **`awaiting-deposit`** (начальный):
   - Ордер создан
   - Ожидается депозит от пользователя
   - Progress: 1/5 (20%)

2. **`awaiting-confirmation`**:
   - Депозит получен
   - Ожидается подтверждение транзакции
   - Progress: 2/5 (40%)
   - Estimated completion: 15-30 минут

3. **`exchanging`**:
   - Транзакция подтверждена
   - Происходит обмен Canton Coin
   - Progress: 3/5 (60%)
   - Estimated completion: 30-60 минут

4. **`sending`**:
   - Обмен завершен
   - Отправка Canton Coin на адрес пользователя
   - Progress: 4/5 (80%)
   - Estimated completion: 15-30 минут

5. **`completed`**:
   - Ордер успешно завершен
   - Canton Coin доставлен
   - Progress: 5/5 (100%)

6. **`failed`**:
   - Ошибка при обработке
   - Progress: 0/5 (0%)
   - Требуется контакт с поддержкой

### 8.2. Проверка статуса

**Endpoint:** `GET /api/order-status/[orderId]`

**Механика:**
1. Rate limiting (более мягкий для статус-проверок)
2. Поиск ордера в Google Sheets по `orderId`
3. Парсинг данных ордера
4. Расчет progress на основе статуса
5. Формирование next steps для пользователя

**Ответ:**
```json
{
  "success": true,
  "order": {
    "orderId": "LXP123-ABC456",
    "status": "awaiting-confirmation",
    "cantonAmount": 250,
    "usdtAmount": 100,
    ...
  },
  "progress": {
    "current": 2,
    "total": 5,
    "percentage": 40
  },
  "estimatedCompletion": "15-30 minutes",
  "nextSteps": [
    "We are verifying your USDT payment",
    "This usually takes 15-30 minutes",
    "You will receive an email update soon"
  ]
}
```

### 8.3. Обновление статуса (Admin)

**Endpoint:** `PUT /api/order-status/[orderId]`

**Механика:**
1. Проверка `adminKey` (простая аутентификация)
2. Валидация статуса (должен быть из списка valid statuses)
3. Обновление в Google Sheets
4. Отправка уведомления в Intercom

**Payload:**
```json
{
  "status": "exchanging",
  "txHash": "0x1234...",
  "adminKey": "secret-admin-key"
}
```

---

## 🔄 ВЗАИМОДЕЙСТВИЕ КОМПОНЕНТОВ

### Схема потока данных

```
[Frontend Form]
    ↓
[API: POST /api/create-order]
    ↓
[Rate Limiter] → [Anti-Spam] → [Canton Validator] → [Exchange Rate Validator]
    ↓
[Order Created]
    ↓
[Background Processing (async)]
    ├─→ [Google Sheets] (save order)
    ├─→ [Intercom] (create conversation)
    └─→ [Telegram] (send notification)
    ↓
[Response to User] (immediate)
    ↓
[User checks status] → [GET /api/order-status/[orderId]]
    ↓
[Admin updates status] → [PUT /api/order-status/[orderId]]
    ↓
[Status notifications] → [Intercom] + [Telegram]
```

### Схема DEX Flow

```
[User initiates swap]
    ↓
[API: POST /api/near-intents/swap]
    ↓
[Price Oracle] → [Balance Check] → [Intent Creation]
    ↓
[Transaction Data returned]
    ↓
[User signs transaction] → [NEAR Wallet]
    ↓
[Intent created on-chain]
    ↓
[Solver Node monitors]
    ↓
[Profitability Check] → [Execution] → [Swap on DEX]
    ↓
[Tokens sent to user] → [Fee collected]
```

---

## 📊 КЛЮЧЕВЫЕ МЕХАНИКИ

### 1. Асинхронная обработка
- API отвечает немедленно (не ждет интеграций)
- Интеграции выполняются в фоне через `Promise.allSettled()`
- Ошибки интеграций не влияют на ответ API

### 2. Толерантность к ошибкам
- Если Google Sheets недоступен → логируется, но ордер создан
- Если Intercom недоступен → fallback на локальное логирование
- Если Telegram недоступен → fallback на локальное логирование

### 3. Валидация на нескольких уровнях
- Frontend: предварительная валидация и расчеты
- Backend: полная валидация всех данных
- Exchange Rate: защита от манипуляций с ценами

### 4. Защита от спама
- Многоуровневая система детекции
- Временные блокировки IP
- Confidence scoring для оценки риска

### 5. Динамическое ценообразование
- Поддержка статических и динамических цен
- Автоматическое применение маржи
- Интеграция с внешними price oracles

### 6. Объемные скидки
- Прогрессивная система бонусов
- Применяется автоматически на основе суммы
- Работает для BUY и SELL операций

---

## 🎯 ЗАКЛЮЧЕНИЕ

Система построена на принципах:
- **Быстрота**: Асинхронная обработка для мгновенных ответов
- **Надежность**: Множественные проверки и валидации
- **Безопасность**: Anti-spam, rate limiting, exchange rate validation
- **Гибкость**: Поддержка множества токенов и сетей
- **Прозрачность**: Детальное логирование всех операций

Все flow спроектированы для минимизации задержек для пользователя при максимальной защите от злоупотреблений и ошибок.



