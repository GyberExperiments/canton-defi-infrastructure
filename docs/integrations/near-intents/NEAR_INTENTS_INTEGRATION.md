# NEAR Intents Integration Documentation

## Обзор

Интеграция NEAR Intents протокола для предоставления функционала Swap и Bridge на странице `/dex`. Протокол позволяет пользователям создавать интенты (intents) для обмена токенов, а маркет-мейкерам конкурировать за их выполнение.

## Архитектура

### Компоненты

1. **Страница DEX** (`/app/dex/page.tsx`)
   - Главная страница с переключателем между Swap и Bridge режимами
   - Ультрасовременный дизайн в стиле проекта

2. **Swap Interface** (`/components/dex/SwapInterface.tsx`)
   - Интерфейс для обмена токенов внутри одной или между разными сетями
   - Поддержка: NEAR, USDT, USDC, ETH и другие
   - Комиссия DEX: 0.3% (настраивается)

3. **Bridge Interface** (`/components/dex/BridgeInterface.tsx`)
   - Интерфейс для мостовых операций между блокчейнами
   - Поддержка: NEAR, Aurora, Ethereum, Polygon, BSC
   - Комиссия DEX: 0.5% (настраивается)

4. **NEAR Wallet Integration** (`/components/dex/NearWalletButton.tsx`)
   - Подключение NEAR кошелька
   - Поддержка @near-wallet-selector и прямого подключения

### API Routes

1. **POST `/api/near-intents/swap`**
   - Создание swap intent
   - Параметры: fromToken, fromChain, toToken, toChain, amount, dexFee

2. **POST `/api/near-intents/bridge`**
   - Создание bridge intent
   - Параметры: fromChain, toChain, amount, dexFee

3. **GET `/api/near-intents/status/[intentId]`**
   - Получение статуса intent

## Комиссии и Монетизация

### Настройка комиссий

Комиссии настраиваются в компонентах:
- **Swap**: `fee = 0.003` (0.3%) в `SwapInterface.tsx`
- **Bridge**: `fee = 0.005` (0.5%) в `BridgeInterface.tsx`

### Получение комиссий

Комиссия передается через параметр `app_fees` в смарт-контракт verifier и автоматически зачисляется на адрес, указанный в `NEAR_DEX_FEE_RECIPIENT` (ConfigMap). Сумма транзакции остается полной, комиссия не вычитается из суммы пользователя.

### Изменение комиссий

Для изменения комиссий отредактируйте значения в соответствующих компонентах:

```typescript
// SwapInterface.tsx
const [fee, setFee] = useState<number>(0.003) // 0.3%

// BridgeInterface.tsx  
const [fee, setFee] = useState<number>(0.005) // 0.5%
```

Или создайте конфигурационный файл для централизованного управления комиссиями.

## Интеграция с NEAR Intents

### Текущее состояние

✅ **Реализовано:**
- Работа через NEAR RPC и смарт-контракты
- Формирование intent'ов с параметрами `app_fees` и `fee_recipient`
- Подписание транзакций через NEAR Wallet (Wallet Selector или redirect)
- Получение статуса intent через view методы контракта
- Интеграция на фронтенде для Swap и Bridge

### Конфигурация для production

1. **Настроить environment variables (ConfigMap):**
   ```yaml
   NEXT_PUBLIC_NEAR_NETWORK: "mainnet"  # или "testnet"
   NEAR_INTENTS_VERIFIER_CONTRACT: "verifier.mainnet"  # ⚠️ Уточнить адрес контракта
   NEAR_RPC_URL: "https://rpc.mainnet.near.org"
   NEAR_DEX_FEE_RECIPIENT: "your-dex-account.near"  # Адрес для получения комиссий
   ```

**⚠️ Важно:** 
- NEAR Intents работает **только через смарт-контракты** через NEAR RPC
- REST API не используется, секреты не требуются
- Все переменные хранятся в ConfigMap и могут изменяться из админки

### Интеграция через смарт-контракты

NEAR Intents работает напрямую через смарт-контракты NEAR. Используются методы контракта verifier:

- `create_swap_intent` - создание swap intent (подписание на клиенте)
- `create_bridge_intent` - создание bridge intent (подписание на клиенте)
- `get_intent_status` - получение статуса intent (view метод)

### Подписание транзакций

Транзакции подписываются на фронтенде через:
1. **NEAR Wallet Selector** (если доступен) - через `src/lib/near-wallet-utils.ts`
2. **Redirect на wallet.near.org** (fallback) - для пользователей без Wallet Selector

Реализация: `src/lib/near-wallet-utils.ts` → `signTransaction()`

Все вызовы выполняются через NEAR RPC используя `@near-js/client`. См. реализацию в:
- `/app/api/near-intents/swap/route.ts` - формирование intent данных
- `/app/api/near-intents/bridge/route.ts` - формирование intent данных
- `/app/api/near-intents/status/[intentId]/route.ts` - получение статуса
- `/lib/near-wallet-utils.ts` - подписание транзакций
- `/components/dex/SwapInterface.tsx` - интеграция Swap
- `/components/dex/BridgeInterface.tsx` - интеграция Bridge

## Разработка

### Запуск в development режиме

1. Страница доступна по адресу: `http://localhost:3000/dex`
2. Wallet подключение:
   - В development режиме использует mock аккаунт `user.testnet`
   - В production работает через NEAR Wallet Selector или redirect
3. API endpoints возвращают данные для подписания транзакций

### Тестирование

1. **Тест Swap:**
   - Выбрать токен "отдаете"
   - Выбрать токен "получаете"
   - Ввести количество
   - Нажать "Выполнить Swap"

2. **Тест Bridge:**
   - Выбрать сеть "откуда"
   - Выбрать сеть "куда"
   - Ввести количество
   - Нажать "Выполнить Bridge"

## Безопасность

1. **Wallet Connection:**
   - Все операции требуют подключенного кошелька
   - Используется localStorage для сохранения состояния подключения

2. **API Security:**
   - API routes защищены валидацией входных данных
   - Комиссии валидируются на сервере

3. **Best Practices:**
   - Все суммы проверяются на положительные значения
   - Chain validation предотвращает bridge в ту же сеть
   - Error handling для всех async операций

## Дальнейшие улучшения

1. ✅ **Интеграция с NEAR Intents** - реализовано
2. ✅ **Подписание транзакций** - реализовано
3. ✅ **Интеграция с price oracles** для реальных курсов обмена - реализовано
4. ✅ **Отслеживание статуса intents** в реальном времени (polling) - реализовано
5. ✅ **История транзакций** пользователя - реализовано
6. ✅ **Улучшенная валидация** и обработка decimals токенов - реализовано
7. **Расширенная аналитика** для DEX
8. **Поддержка большего количества токенов и сетей**
9. **Slippage tolerance настройки**
10. **Интеграция с NEAR балансами**

## Проверка перед production

⚠️ **Перед развертыванием:**

1. Уточнить адрес `NEAR_INTENTS_VERIFIER_CONTRACT` для mainnet/testnet
2. Указать `NEAR_DEX_FEE_RECIPIENT` в ConfigMap (ваш NEAR аккаунт)
3. Протестировать на testnet, проверить формат параметров контракта
4. После первого теста может потребоваться корректировка названий полей в `intentData` (сейчас используются: `from_token`, `app_fees`, `fee_recipient` и т.д.)

## Новые функции

### Price Oracle интеграция

Реализована интеграция с price oracles для получения реальных курсов обмена:
- **Файл**: `src/lib/near-intents-price.ts`
- **Функции**: `getSwapRate()`, `getTokenPrice()`, `calculateWithSlippage()`
- Показывает: курс обмена, estimated time, price impact

### Отслеживание статуса Intents

Автоматическое отслеживание статуса intents в реальном времени:
- **Файл**: `src/lib/intent-tracker.ts`
- Показывает статусы: pending, filled, expired, cancelled
- Обновления каждые 10 секунд для pending intents

### История транзакций

История всех транзакций пользователя:
- **Компонент**: `src/components/dex/IntentHistory.tsx`
- Сохранение в localStorage
- Показ последних 10 транзакций
- Ссылки на NEAR Explorer

### Улучшенная обработка Tokens

Правильная обработка decimals для разных токенов:
- NEAR: 24 decimals
- USDT/USDC: 6 decimals
- ETH: 18 decimals
- Правильная конвертация сумм

## Полезные ссылки

- [NEAR Intents Documentation](https://docs.near-intents.org/near-intents)
- [NEAR Protocol Docs](https://docs.near.org)
- [NEAR Wallet Selector](https://github.com/near/wallet-selector)
- [@near-js/client Documentation](https://github.com/near/near-api-js)

