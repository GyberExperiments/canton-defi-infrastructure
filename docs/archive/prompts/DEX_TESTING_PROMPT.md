# 🧪 ПРОМПТ: Тестирование DEX компонента

**Используй этот промпт в новом чате для тестирования DEX функционала**

---

## 📋 КОНТЕКСТ ПРОЕКТА

Проект: **Canton OTC Exchange** - платформа для OTC обмена криптовалют с интегрированным DEX на базе NEAR Intents протокола.

**Расположение проекта**: `/Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc`

**Технологии**:
- Next.js 15.5.7 (App Router)
- TypeScript
- NEAR Protocol (NEAR Intents SDK)
- Price Oracle (REF Finance + Pyth Network)

---

## 🎯 ЗАДАЧА: ПРОТЕСТИРОВАТЬ DEX КОМПОНЕНТ

### Что нужно протестировать:

1. **API Endpoints**:
   - `POST /api/near-intents/swap` - создание swap intent
   - `POST /api/near-intents/bridge` - создание bridge intent
   - `GET /api/near-intents/status/[intentId]` - получение статуса intent
   - `GET /api/near-intents/user/[accountId]` - получение intents пользователя

2. **Rate Limiting**:
   - Проверить что rate limiting работает для DEX endpoints
   - Лимит: 20 запросов за 5 минут (настраивается через `RATE_LIMIT_DEX_POINTS`)

3. **Валидация**:
   - Валидация параметров swap intent
   - Валидация параметров bridge intent
   - Проверка баланса перед созданием intent
   - Валидация формата NEAR account ID

4. **Price Oracle**:
   - Получение цен через REF Finance
   - Fallback на Pyth Network
   - Расчет price impact
   - Расчет min receive с учетом slippage

5. **NEAR Intents SDK**:
   - Валидация параметров
   - Подготовка транзакций
   - Получение статуса intent

---

## 📁 КЛЮЧЕВЫЕ ФАЙЛЫ ДЛЯ ТЕСТИРОВАНИЯ

### API Endpoints:
- `src/app/api/near-intents/swap/route.ts` - Swap endpoint
- `src/app/api/near-intents/bridge/route.ts` - Bridge endpoint
- `src/app/api/near-intents/status/[intentId]/route.ts` - Status endpoint
- `src/app/api/near-intents/user/[accountId]/route.ts` - User intents endpoint

### Core Libraries:
- `src/lib/near-intents-sdk.ts` - NEAR Intents SDK
- `src/lib/price-oracle/index.ts` - Unified Price Oracle
- `src/lib/price-oracle/ref-finance.ts` - REF Finance integration
- `src/lib/price-oracle/pyth-network.ts` - Pyth Network integration
- `src/lib/near-balance.ts` - Balance checking utilities
- `src/lib/dex-config.ts` - DEX configuration

### Rate Limiting:
- `src/lib/services/rateLimiter.ts` - Rate limiting service (метод `checkDexLimit`)

### Тесты:
- `tests/unit/test-near-intents-sdk.js` - Unit тесты для SDK
- `tests/unit/test-price-oracle.js` - Unit тесты для price oracle
- `tests/integration/test-dex-api.js` - Integration тесты для rate limiting

---

## 🧪 ИНСТРУКЦИИ ПО ТЕСТИРОВАНИЮ

### 1. Запуск существующих тестов

```bash
# Unit тесты для NEAR Intents SDK
node tests/unit/test-near-intents-sdk.js

# Unit тесты для Price Oracle
node tests/unit/test-price-oracle.js

# Integration тесты для rate limiting
node tests/integration/test-dex-api.js
```

### 2. Тестирование API endpoints (требует запущенный сервер)

```bash
# Запустить dev сервер
npm run dev

# В другом терминале - тестировать endpoints
# Пример теста swap:
curl -X POST http://localhost:3000/api/near-intents/swap \
  -H "Content-Type: application/json" \
  -H "x-forwarded-for: 192.168.1.100" \
  -d '{
    "fromToken": "NEAR",
    "fromChain": "NEAR",
    "toToken": "USDT",
    "toChain": "NEAR",
    "amount": "1.0",
    "userAccount": "test.near"
  }'
```

### 3. Тестирование rate limiting

```bash
# Отправить 21 запрос подряд (лимит 20)
for i in {1..21}; do
  curl -X POST http://localhost:3000/api/near-intents/swap \
    -H "Content-Type: application/json" \
    -H "x-forwarded-for: 192.168.1.100" \
    -d '{
      "fromToken": "NEAR",
      "fromChain": "NEAR",
      "toToken": "USDT",
      "toChain": "NEAR",
      "amount": "1.0",
      "userAccount": "test.near"
    }'
  echo "Request $i"
done

# 21-й запрос должен вернуть 429 (Rate Limit Exceeded)
```

### 4. Тестирование валидации

**Тест 1: Недостающие поля**
```bash
curl -X POST http://localhost:3000/api/near-intents/swap \
  -H "Content-Type: application/json" \
  -d '{}'
# Ожидается: 400 Bad Request с кодом MISSING_FIELDS
```

**Тест 2: Нулевая сумма**
```bash
curl -X POST http://localhost:3000/api/near-intents/swap \
  -H "Content-Type: application/json" \
  -d '{
    "fromToken": "NEAR",
    "fromChain": "NEAR",
    "toToken": "USDT",
    "toChain": "NEAR",
    "amount": "0",
    "userAccount": "test.near"
  }'
# Ожидается: 400 Bad Request с кодом INVALID_AMOUNT
```

**Тест 3: Одинаковые токены**
```bash
curl -X POST http://localhost:3000/api/near-intents/swap \
  -H "Content-Type: application/json" \
  -d '{
    "fromToken": "NEAR",
    "fromChain": "NEAR",
    "toToken": "NEAR",
    "toChain": "NEAR",
    "amount": "1.0",
    "userAccount": "test.near"
  }'
# Ожидается: 400 Bad Request с кодом VALIDATION_ERROR
```

**Тест 4: Невалидный NEAR account ID**
```bash
curl -X POST http://localhost:3000/api/near-intents/swap \
  -H "Content-Type: application/json" \
  -d '{
    "fromToken": "NEAR",
    "fromChain": "NEAR",
    "toToken": "USDT",
    "toChain": "NEAR",
    "amount": "1.0",
    "userAccount": "INVALID_ACCOUNT!!!"
  }'
# Ожидается: 400 Bad Request с кодом VALIDATION_ERROR
```

### 5. Тестирование price oracle

```bash
# Тест получения цены (требует сетевого доступа)
curl -X GET "http://localhost:3000/api/near-intents/swap" \
  -H "Content-Type: application/json"
# Проверить логи сервера на наличие price quote
```

### 6. Тестирование проверки баланса

```bash
# Тест с недостаточным балансом (если аккаунт существует)
curl -X POST http://localhost:3000/api/near-intents/swap \
  -H "Content-Type: application/json" \
  -d '{
    "fromToken": "NEAR",
    "fromChain": "NEAR",
    "toToken": "USDT",
    "toChain": "NEAR",
    "amount": "1000000.0",
    "userAccount": "test.near"
  }'
# Ожидается: 400 Bad Request с кодом INSUFFICIENT_BALANCE (если баланс недостаточен)
```

---

## ✅ ЧЕКЛИСТ ТЕСТИРОВАНИЯ

### Unit тесты:
- [ ] Запустить `test-near-intents-sdk.js` - все тесты должны пройти
- [ ] Запустить `test-price-oracle.js` - все тесты должны пройти
- [ ] Запустить `test-dex-api.js` - все тесты должны пройти

### API Endpoints:
- [ ] Swap endpoint возвращает корректные данные при валидных параметрах
- [ ] Swap endpoint валидирует обязательные поля
- [ ] Swap endpoint валидирует суммы (> 0)
- [ ] Swap endpoint валидирует что токены разные
- [ ] Swap endpoint проверяет баланс пользователя
- [ ] Bridge endpoint возвращает корректные данные при валидных параметрах
- [ ] Bridge endpoint валидирует что сети разные
- [ ] Status endpoint возвращает статус intent
- [ ] User endpoint возвращает список intents пользователя

### Rate Limiting:
- [ ] Первые 20 запросов проходят успешно
- [ ] 21-й запрос возвращает 429 (Rate Limit Exceeded)
- [ ] Rate limit headers присутствуют в ответе
- [ ] Rate limiting работает для разных IP адресов независимо
- [ ] Rate limiting работает для разных user accounts независимо

### Валидация:
- [ ] Валидация NEAR account ID формата
- [ ] Валидация deadline (должен быть в будущем)
- [ ] Валидация min_receive > 0
- [ ] Валидация amount > 0

### Price Oracle:
- [ ] Получение цены через REF Finance работает
- [ ] Fallback на Pyth Network работает при недоступности REF
- [ ] Расчет price impact работает
- [ ] Расчет min receive с slippage работает

### Обработка ошибок:
- [ ] Ошибки возвращают правильные HTTP статусы
- [ ] Ошибки содержат понятные сообщения
- [ ] Ошибки содержат коды ошибок
- [ ] Секретные данные не попадают в error messages

---

## 🔍 ЧТО ПРОВЕРИТЬ ОСОБЕННО ВНИМАТЕЛЬНО

1. **Rate Limiting**:
   - Проверить что метод `checkDexLimit` вызывается в обоих endpoints
   - Проверить что лимит настраивается через env переменные
   - Проверить что разные IP/account имеют независимые лимиты

2. **Валидация баланса**:
   - Проверить что баланс проверяется перед созданием intent
   - Проверить что учитывается комиссия + gas reserve
   - Проверить что для native NEAR и FT токенов проверка работает по-разному

3. **Price Oracle**:
   - Проверить что fallback работает корректно
   - Проверить что price impact рассчитывается правильно
   - Проверить что min_receive учитывает slippage

4. **Обработка ошибок**:
   - Проверить что все ошибки обрабатываются gracefully
   - Проверить что не происходит утечки секретных данных
   - Проверить что логирование работает корректно

---

## 📊 ОЖИДАЕМЫЕ РЕЗУЛЬТАТЫ

После тестирования должно быть подтверждено:

1. ✅ Все unit тесты проходят
2. ✅ Rate limiting работает корректно
3. ✅ Валидация параметров работает
4. ✅ Проверка баланса работает
5. ✅ Price oracle работает с fallback
6. ✅ Обработка ошибок корректна
7. ✅ API endpoints возвращают правильные ответы

---

## 📝 ОТЧЕТ О ТЕСТИРОВАНИИ

После тестирования создай отчет с:
- Результатами всех тестов
- Найденными проблемами (если есть)
- Рекомендациями по улучшению
- Оценкой готовности DEX к продакшену

---

## 🚀 КОМАНДЫ ДЛЯ БЫСТРОГО СТАРТА

```bash
# 1. Перейти в проект
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc

# 2. Запустить unit тесты
node tests/unit/test-near-intents-sdk.js
node tests/unit/test-price-oracle.js
node tests/integration/test-dex-api.js

# 3. Запустить dev сервер (в отдельном терминале)
npm run dev

# 4. Протестировать endpoints через curl или Postman
# (см. примеры выше)
```

---

**ВАЖНО**: 
- Все тесты должны проходить успешно
- Rate limiting должен работать
- Валидация должна быть строгой
- Ошибки должны обрабатываться gracefully

**Если найдешь проблемы** - опиши их детально с примерами запросов/ответов и предложи исправления.




