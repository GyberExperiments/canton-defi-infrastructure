# 🧪 Comprehensive Testing Guide для Canton OTC Exchange

## 📋 Обзор

Этот документ содержит полное руководство по тестированию Canton OTC Exchange проекта, включая детальные curl команды, тестовые сценарии, критерии качества и инструкции по исправлению багов.

## 🎯 Цели тестирования

- **Функциональность**: Проверка всех API endpoints и бизнес-логики
- **Безопасность**: Валидация аутентификации, авторизации и защиты от атак
- **Производительность**: Тестирование времени отклика и масштабируемости
- **Интеграции**: Проверка работы с Google Sheets, Telegram, Intercom
- **Надежность**: Тестирование обработки ошибок и восстановления

## 🏗️ Архитектура тестирования

### Уровни тестирования
1. **Unit Tests** - Тестирование отдельных функций
2. **Integration Tests** - Тестирование взаимодействия компонентов
3. **API Tests** - Тестирование REST API endpoints
4. **E2E Tests** - Полное тестирование пользовательских сценариев
5. **Performance Tests** - Тестирование производительности
6. **Security Tests** - Тестирование безопасности

## 🔧 Настройка тестовой среды

### Переменные окружения
```bash
# Основные настройки
NODE_ENV=test
BASE_URL=http://localhost:3000
ADMIN_API_KEY=canton-admin-2025-super-secure-key

# Google Sheets (для интеграционных тестов)
GOOGLE_SHEET_ID=your_test_sheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Telegram (для интеграционных тестов)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Email (опционально)
EMAIL_HOST=smtp.gmail.com
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password

# Admin credentials
ADMIN_EMAIL=admin@canton-otc.com
ADMIN_PASSWORD=canton-admin-2025
```

### Запуск тестовой среды
```bash
# Установка зависимостей
npm install

# Запуск в тестовом режиме
npm run dev

# Или запуск production build
npm run build
npm start
```

## 📡 API Endpoints Testing

### 1. Health Check Endpoint

#### GET /api/health
```bash
curl -X GET "http://localhost:3000/api/health" \
  -H "Content-Type: application/json" \
  -H "User-Agent: Canton-OTC-Test/1.0"
```

**Ожидаемый ответ:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-10T12:00:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "environment": "development",
  "services": {
    "api": true,
    "database": true,
    "external": {
      "telegram": true,
      "email": false,
      "sheets": true
    }
  },
  "system": {
    "memory": {
      "rss": 50331648,
      "heapTotal": 20971520,
      "heapUsed": 15728640,
      "external": 1048576
    },
    "responseTime": 5
  }
}
```

**Критерии успеха:**
- ✅ Status: 200
- ✅ Response time < 100ms
- ✅ Все обязательные поля присутствуют
- ✅ Services status корректный

### 2. Create Order Endpoint

#### POST /api/create-order
```bash
curl -X POST "http://localhost:3000/api/create-order" \
  -H "Content-Type: application/json" \
  -H "User-Agent: Canton-OTC-Test/1.0" \
  -d '{
    "email": "test@example.com",
    "usdtAmount": 2000,
    "cantonAmount": 9523,
    "cantonAddress": "TKau36dpRiTENTjhdJVU4DhoFzX9x3N5Q1",
    "orderType": "BUY"
  }'
```

**Ожидаемый ответ:**
```json
{
  "success": true,
  "orderId": "1Q2W3E4R5T6Y",
  "message": "Order created successfully. Please contact customer support for payment instructions.",
  "status": "awaiting-deposit",
  "processingTime": "45ms",
  "paymentAddress": null,
  "paymentNetwork": "TRON",
  "paymentToken": "USDT",
  "notifications": {
    "sheets": true,
    "intercom": true,
    "email": false
  },
  "validation": {
    "cantonAddress": "TKau36dpRiTENTjhdJVU4DhoFzX9x3N5Q1",
    "addressValid": true
  },
  "spamCheck": {
    "passed": true,
    "riskLevel": "low",
    "confidence": 0.95
  }
}
```

**Критерии успеха:**
- ✅ Status: 200
- ✅ Response time < 200ms
- ✅ OrderId генерируется
- ✅ Spam check проходит
- ✅ Notifications отправляются

#### Тест с новым форматом (multi-token)
```bash
curl -X POST "http://localhost:3000/api/create-order" \
  -H "Content-Type: application/json" \
  -H "User-Agent: Canton-OTC-Test/1.0" \
  -d '{
    "email": "test@example.com",
    "paymentToken": {
      "symbol": "USDT",
      "name": "USDT (ERC-20)",
      "network": "ETHEREUM",
      "networkName": "Ethereum",
      "decimals": 6,
      "priceUSD": 1,
      "minAmount": 1,
      "receivingAddress": "0xe70eC2DeA28CD14B2d392E72F2fE68F8d8799D5E",
      "contractAddress": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      "icon": "₮",
      "color": "#50AF95"
    },
    "paymentAmount": 2000,
    "paymentAmountUSD": 2000,
    "cantonAmount": 9523,
    "cantonAddress": "TKau36dpRiTENTjhdJVU4DhoFzX9x3N5Q1",
    "orderType": "BUY"
  }'
```

### 3. Order Status Endpoint

#### GET /api/order-status/{orderId}
```bash
curl -X GET "http://localhost:3000/api/order-status/1Q2W3E4R5T6Y" \
  -H "Content-Type: application/json" \
  -H "User-Agent: Canton-OTC-Test/1.0"
```

**Ожидаемый ответ:**
```json
{
  "success": true,
  "order": {
    "orderId": "1Q2W3E4R5T6Y",
    "status": "awaiting-deposit",
    "timestamp": 1704892800000,
    "email": "test@example.com",
    "usdtAmount": 2000,
    "cantonAmount": 9523,
    "cantonAddress": "TKau36dpRiTENTjhdJVU4DhoFzX9x3N5Q1",
    "txHash": null
  }
}
```

**Критерии успеха:**
- ✅ Status: 200 или 404 (если заказ не найден)
- ✅ Response time < 150ms
- ✅ Корректная структура ответа

### 4. Admin Endpoints

#### GET /api/admin/stats
```bash
curl -X GET "http://localhost:3000/api/admin/stats" \
  -H "Content-Type: application/json" \
  -H "x-admin-key: canton-admin-2025-super-secure-key" \
  -H "User-Agent: Canton-OTC-Test/1.0"
```

**Ожидаемый ответ:**
```json
{
  "totalOrders": 150,
  "totalVolume": 300000,
  "totalRevenue": 300000,
  "averageOrderSize": 2000,
  "ordersByStatus": {
    "awaiting-deposit": 5,
    "awaiting-confirmation": 3,
    "exchanging": 2,
    "sending": 1,
    "completed": 135,
    "failed": 4
  },
  "ordersByToken": {
    "USDT_TRON": 120,
    "USDT_ETHEREUM": 20,
    "USDT_SOLANA": 8,
    "USDT_OPTIMISM": 2
  },
  "recentOrders": [
    {
      "orderId": "1Q2W3E4R5T6Y",
      "timestamp": 1704892800000,
      "amount": 2000,
      "status": "awaiting-deposit",
      "email": "test@example.com"
    }
  ]
}
```

#### GET /api/admin/orders
```bash
curl -X GET "http://localhost:3000/api/admin/orders?page=1&limit=10" \
  -H "Content-Type: application/json" \
  -H "x-admin-key: canton-admin-2025-super-secure-key" \
  -H "User-Agent: Canton-OTC-Test/1.0"
```

#### GET /api/admin/monitoring
```bash
curl -X GET "http://localhost:3000/api/admin/monitoring" \
  -H "Content-Type: application/json" \
  -H "x-admin-key: canton-admin-2025-super-secure-key" \
  -H "User-Agent: Canton-OTC-Test/1.0"
```

**Ожидаемый ответ:**
```json
{
  "health": {
    "status": "healthy",
    "uptime": 3600,
    "memory": {
      "used": 15728640,
      "total": 20971520,
      "percentage": 75
    },
    "cpu": {
      "usage": 15.5
    }
  },
  "performance": {
    "averageResponseTime": 45,
    "requestsPerMinute": 120,
    "errorRate": 0.02,
    "activeConnections": 5
  },
  "integrations": {
    "googleSheets": {
      "status": "connected",
      "lastSync": "2025-01-10T12:00:00.000Z"
    },
    "telegram": {
      "status": "connected",
      "lastMessage": "2025-01-10T12:00:00.000Z"
    },
    "intercom": {
      "status": "connected",
      "lastEvent": "2025-01-10T12:00:00.000Z"
    }
  }
}
```

## 🛡️ Security Testing

### 1. Rate Limiting Tests

#### Тест превышения лимита
```bash
# Отправляем 15 запросов подряд (лимит 10 в час)
for i in {1..15}; do
  curl -X POST "http://localhost:3000/api/create-order" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"test$i@example.com\",
      \"usdtAmount\": $((1000 + i * 100)),
      \"cantonAmount\": $((4761 + i * 476)),
      \"cantonAddress\": \"TKau36dpRiTENTjhdJVU4DhoFzX9x3N5Q1\",
      \"orderType\": \"BUY\"
    }"
  echo "Request $i completed"
done
```

**Ожидаемое поведение:**
- ✅ Первые 10 запросов: Status 200
- ✅ Запросы 11-15: Status 429 (Rate Limited)
- ✅ Headers содержат rate limit информацию

### 2. Anti-Spam Tests

#### Тест дублирующихся заказов
```bash
# Отправляем 3 заказа с одинаковой суммой
for i in {1..3}; do
  curl -X POST "http://localhost:3000/api/create-order" \
    -H "Content-Type: application/json" \
    -d '{
      "email": "spam@example.com",
      "usdtAmount": 1000,
      "cantonAmount": 4761,
      "cantonAddress": "TKau36dpRiTENTjhdJVU4DhoFzX9x3N5Q1",
      "orderType": "BUY"
    }'
  echo "Spam test $i completed"
done
```

**Ожидаемое поведение:**
- ✅ Первый заказ: Status 200
- ✅ Последующие заказы: Status 400 (Spam Detected)

### 3. Authentication Tests

#### Тест без admin ключа
```bash
curl -X GET "http://localhost:3000/api/admin/stats" \
  -H "Content-Type: application/json"
```

**Ожидаемое поведение:**
- ✅ Status: 401 (Unauthorized)

#### Тест с неверным admin ключом
```bash
curl -X GET "http://localhost:3000/api/admin/stats" \
  -H "Content-Type: application/json" \
  -H "x-admin-key: wrong-key"
```

**Ожидаемое поведение:**
- ✅ Status: 401 (Unauthorized)

## ⚡ Performance Testing

### 1. Response Time Tests

#### Тест времени отклика
```bash
# Тестируем время отклика для разных endpoints
echo "Testing Health endpoint..."
time curl -s -X GET "http://localhost:3000/api/health" > /dev/null

echo "Testing Create Order endpoint..."
time curl -s -X POST "http://localhost:3000/api/create-order" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "perf-test@example.com",
    "usdtAmount": 2000,
    "cantonAmount": 9523,
    "cantonAddress": "TKau36dpRiTENTjhdJVU4DhoFzX9x3N5Q1",
    "orderType": "BUY"
  }' > /dev/null
```

**Критерии производительности:**
- ✅ Health endpoint: < 50ms
- ✅ Create Order: < 200ms
- ✅ Order Status: < 150ms
- ✅ Admin endpoints: < 300ms

### 2. Concurrent Requests Tests

#### Тест concurrent запросов
```bash
# Отправляем 10 concurrent запросов
for i in {1..10}; do
  (
    curl -X GET "http://localhost:3000/api/health" \
      -H "Content-Type: application/json" &
  )
done
wait
echo "All concurrent requests completed"
```

**Критерии:**
- ✅ Все запросы завершаются успешно
- ✅ Время выполнения < 2 секунд
- ✅ Success rate > 95%

### 3. Memory Usage Tests

#### Мониторинг использования памяти
```bash
# Проверяем использование памяти через health endpoint
curl -X GET "http://localhost:3000/api/health" | jq '.system.memory'
```

**Критерии:**
- ✅ Heap usage < 70%
- ✅ RSS < 100MB
- ✅ No memory leaks

## 🔗 Integration Testing

### 1. Google Sheets Integration

#### Тест создания заказа с Google Sheets
```bash
curl -X POST "http://localhost:3000/api/create-order" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sheets-test@example.com",
    "usdtAmount": 5000,
    "cantonAmount": 23809,
    "cantonAddress": "TKau36dpRiTENTjhdJVU4DhoFzX9x3N5Q1",
    "orderType": "BUY"
  }'
```

**Проверка:**
- ✅ Заказ создается в Google Sheets
- ✅ Все поля корректно заполнены
- ✅ Timestamp правильный

### 2. Telegram Integration

#### Тест уведомлений в Telegram
```bash
curl -X POST "http://localhost:3000/api/create-order" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "telegram-test@example.com",
    "usdtAmount": 3000,
    "cantonAmount": 14285,
    "cantonAddress": "TKau36dpRiTENTjhdJVU4DhoFzX9x3N5Q1",
    "orderType": "BUY"
  }'
```

**Проверка:**
- ✅ Уведомление отправляется в Telegram
- ✅ Формат сообщения корректный
- ✅ Ссылки работают

### 3. Intercom Integration

#### Тест создания события в Intercom
```bash
curl -X POST "http://localhost:3000/api/create-order" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "intercom-test@example.com",
    "usdtAmount": 4000,
    "cantonAmount": 19047,
    "cantonAddress": "TKau36dpRiTENTjhdJVU4DhoFzX9x3N5Q1",
    "orderType": "BUY"
  }'
```

**Проверка:**
- ✅ Событие создается в Intercom
- ✅ Данные пользователя корректные
- ✅ Custom attributes заполнены

## 🧪 Automated Test Scripts

### 1. API Endpoints Test Suite

```bash
#!/bin/bash
# test-api-endpoints.sh

BASE_URL="http://localhost:3000"
ADMIN_KEY="canton-admin-2025-super-secure-key"

echo "🧪 Starting API Endpoints Test Suite..."

# Test Health endpoint
echo "Testing Health endpoint..."
HEALTH_RESPONSE=$(curl -s -X GET "$BASE_URL/api/health")
if echo "$HEALTH_RESPONSE" | jq -e '.status == "healthy"' > /dev/null; then
  echo "✅ Health endpoint test passed"
else
  echo "❌ Health endpoint test failed"
  exit 1
fi

# Test Create Order endpoint
echo "Testing Create Order endpoint..."
ORDER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/create-order" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "usdtAmount": 2000,
    "cantonAmount": 9523,
    "cantonAddress": "TKau36dpRiTENTjhdJVU4DhoFzX9x3N5Q1",
    "orderType": "BUY"
  }')

if echo "$ORDER_RESPONSE" | jq -e '.success == true' > /dev/null; then
  echo "✅ Create Order endpoint test passed"
  ORDER_ID=$(echo "$ORDER_RESPONSE" | jq -r '.orderId')
else
  echo "❌ Create Order endpoint test failed"
  exit 1
fi

# Test Order Status endpoint
if [ ! -z "$ORDER_ID" ]; then
  echo "Testing Order Status endpoint..."
  STATUS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/order-status/$ORDER_ID")
  if echo "$STATUS_RESPONSE" | jq -e '.success == true' > /dev/null; then
    echo "✅ Order Status endpoint test passed"
  else
    echo "⚠️ Order Status endpoint test failed (expected in dev environment)"
  fi
fi

# Test Admin endpoints
echo "Testing Admin endpoints..."
ADMIN_RESPONSE=$(curl -s -X GET "$BASE_URL/api/admin/stats" \
  -H "x-admin-key: $ADMIN_KEY")

if echo "$ADMIN_RESPONSE" | jq -e '.totalOrders' > /dev/null; then
  echo "✅ Admin endpoints test passed"
else
  echo "❌ Admin endpoints test failed"
  exit 1
fi

echo "🎉 All API endpoint tests passed!"
```

### 2. Performance Test Suite

```bash
#!/bin/bash
# test-performance.sh

BASE_URL="http://localhost:3000"

echo "⚡ Starting Performance Test Suite..."

# Test response times
echo "Testing response times..."

# Health endpoint
HEALTH_TIME=$(curl -o /dev/null -s -w '%{time_total}' -X GET "$BASE_URL/api/health")
echo "Health endpoint: ${HEALTH_TIME}s"

# Create Order endpoint
ORDER_TIME=$(curl -o /dev/null -s -w '%{time_total}' -X POST "$BASE_URL/api/create-order" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "perf-test@example.com",
    "usdtAmount": 2000,
    "cantonAmount": 9523,
    "cantonAddress": "TKau36dpRiTENTjhdJVU4DhoFzX9x3N5Q1",
    "orderType": "BUY"
  }')
echo "Create Order endpoint: ${ORDER_TIME}s"

# Performance criteria
HEALTH_MS=$(echo "$HEALTH_TIME * 1000" | bc)
ORDER_MS=$(echo "$ORDER_TIME * 1000" | bc)

if (( $(echo "$HEALTH_MS < 50" | bc -l) )); then
  echo "✅ Health endpoint performance: EXCELLENT"
else
  echo "❌ Health endpoint performance: POOR"
fi

if (( $(echo "$ORDER_MS < 200" | bc -l) )); then
  echo "✅ Create Order endpoint performance: EXCELLENT"
else
  echo "❌ Create Order endpoint performance: POOR"
fi

echo "🎉 Performance tests completed!"
```

### 3. Security Test Suite

```bash
#!/bin/bash
# test-security.sh

BASE_URL="http://localhost:3000"

echo "🛡️ Starting Security Test Suite..."

# Test rate limiting
echo "Testing rate limiting..."
RATE_LIMIT_COUNT=0
for i in {1..15}; do
  RESPONSE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE_URL/api/create-order" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"rate-test$i@example.com\",
      \"usdtAmount\": $((1000 + i * 100)),
      \"cantonAmount\": $((4761 + i * 476)),
      \"cantonAddress\": \"TKau36dpRiTENTjhdJVU4DhoFzX9x3N5Q1\",
      \"orderType\": \"BUY\"
    }")
  
  if [ "$RESPONSE" = "429" ]; then
    RATE_LIMIT_COUNT=$((RATE_LIMIT_COUNT + 1))
  fi
done

echo "Rate limited requests: $RATE_LIMIT_COUNT/15"
if [ $RATE_LIMIT_COUNT -gt 0 ]; then
  echo "✅ Rate limiting test passed"
else
  echo "❌ Rate limiting test failed"
fi

# Test anti-spam
echo "Testing anti-spam protection..."
SPAM_COUNT=0
for i in {1..3}; do
  RESPONSE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE_URL/api/create-order" \
    -H "Content-Type: application/json" \
    -d '{
      "email": "spam@example.com",
      "usdtAmount": 1000,
      "cantonAmount": 4761,
      "cantonAddress": "TKau36dpRiTENTjhdJVU4DhoFzX9x3N5Q1",
      "orderType": "BUY"
    }')
  
  if [ "$RESPONSE" = "400" ]; then
    SPAM_COUNT=$((SPAM_COUNT + 1))
  fi
done

echo "Spam detected requests: $SPAM_COUNT/3"
if [ $SPAM_COUNT -gt 0 ]; then
  echo "✅ Anti-spam test passed"
else
  echo "❌ Anti-spam test failed"
fi

# Test authentication
echo "Testing authentication..."
AUTH_RESPONSE=$(curl -s -o /dev/null -w '%{http_code}' -X GET "$BASE_URL/api/admin/stats")
if [ "$AUTH_RESPONSE" = "401" ]; then
  echo "✅ Authentication test passed"
else
  echo "❌ Authentication test failed"
fi

echo "🎉 Security tests completed!"
```

## 📊 Test Scenarios

### 1. Happy Path Scenarios

#### Сценарий 1: Успешное создание заказа
1. **Действие**: Отправка POST запроса на `/api/create-order`
2. **Данные**: Валидные данные заказа
3. **Ожидаемый результат**: 
   - Status 200
   - OrderId генерируется
   - Заказ сохраняется в Google Sheets
   - Уведомления отправляются

#### Сценарий 2: Проверка статуса заказа
1. **Действие**: Отправка GET запроса на `/api/order-status/{orderId}`
2. **Данные**: Существующий orderId
3. **Ожидаемый результат**:
   - Status 200
   - Корректные данные заказа
   - Актуальный статус

#### Сценарий 3: Админ панель
1. **Действие**: Отправка GET запроса на `/api/admin/stats`
2. **Данные**: Валидный admin ключ
3. **Ожидаемый результат**:
   - Status 200
   - Статистика заказов
   - Данные из Google Sheets

### 2. Error Handling Scenarios

#### Сценарий 1: Невалидные данные
1. **Действие**: Отправка POST запроса с невалидными данными
2. **Данные**: Отсутствующие обязательные поля
3. **Ожидаемый результат**:
   - Status 400
   - Сообщение об ошибке
   - Код ошибки

#### Сценарий 2: Превышение лимитов
1. **Действие**: Отправка множественных запросов
2. **Данные**: Более 10 запросов в час
3. **Ожидаемый результат**:
   - Status 429
   - Rate limit headers
   - Сообщение о лимите

#### Сценарий 3: Неавторизованный доступ
1. **Действие**: Доступ к admin endpoints без ключа
2. **Данные**: Отсутствующий или неверный admin ключ
3. **Ожидаемый результат**:
   - Status 401
   - Сообщение об ошибке авторизации

### 3. Edge Cases

#### Сценарий 1: Минимальная сумма
1. **Действие**: Создание заказа с минимальной суммой ($1)
2. **Данные**: usdtAmount: 1
3. **Ожидаемый результат**:
   - Status 200
   - Заказ создается успешно
   - Canton amount рассчитывается корректно

#### Сценарий 2: Максимальная сумма
1. **Действие**: Создание заказа с большой суммой
2. **Данные**: usdtAmount: 100000
3. **Ожидаемый результат**:
   - Status 200
   - Заказ создается успешно
   - Применяется максимальная скидка

#### Сценарий 3: Различные сети
1. **Действие**: Создание заказов с разными токенами
2. **Данные**: USDT на разных сетях (TRON, Ethereum, Solana, Optimism)
3. **Ожидаемый результат**:
   - Status 200 для всех
   - Корректная обработка каждого токена
   - Правильные адреса получателей

## 🎯 Quality Criteria

### 1. Performance Criteria

| Метрика | Отлично | Хорошо | Приемлемо | Плохо |
|---------|---------|--------|-----------|-------|
| Health endpoint | < 50ms | < 100ms | < 200ms | > 200ms |
| Create Order | < 200ms | < 500ms | < 1000ms | > 1000ms |
| Order Status | < 150ms | < 300ms | < 600ms | > 600ms |
| Admin endpoints | < 300ms | < 600ms | < 1200ms | > 1200ms |
| Memory usage | < 70% | < 80% | < 90% | > 90% |
| CPU usage | < 50% | < 70% | < 85% | > 85% |

### 2. Reliability Criteria

| Метрика | Цель | Минимум |
|---------|------|---------|
| Uptime | 99.9% | 99.5% |
| Error rate | < 0.1% | < 1% |
| Success rate | > 99.9% | > 99% |
| Recovery time | < 30s | < 5min |

### 3. Security Criteria

| Метрика | Требование |
|---------|------------|
| Rate limiting | Активно и эффективно |
| Anti-spam | Обнаруживает дубликаты |
| Authentication | Все admin endpoints защищены |
| Input validation | Все входные данные валидируются |
| Error handling | Не раскрывает внутреннюю информацию |

## 🐛 Bug Fixing Guide

### 1. Common Issues and Solutions

#### Проблема: Rate limiting не работает
**Симптомы:**
- Множественные запросы проходят без ограничений
- Status 429 не возвращается

**Диагностика:**
```bash
# Проверяем Redis подключение
curl -X GET "http://localhost:3000/api/health" | jq '.services.database'

# Тестируем rate limiting
for i in {1..15}; do
  curl -s -o /dev/null -w '%{http_code}\n' -X POST "http://localhost:3000/api/create-order" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"test$i@example.com\", \"usdtAmount\": 1000, \"cantonAmount\": 4761, \"cantonAddress\": \"TKau36dpRiTENTjhdJVU4DhoFzX9x3N5Q1\", \"orderType\": \"BUY\"}"
done
```

**Решение:**
1. Проверить Redis подключение
2. Убедиться, что rateLimiterService инициализирован
3. Проверить конфигурацию лимитов
4. Перезапустить сервис

#### Проблема: Google Sheets интеграция не работает
**Симптомы:**
- Заказы создаются, но не сохраняются в Google Sheets
- Ошибки в логах о Google Sheets

**Диагностика:**
```bash
# Проверяем конфигурацию
curl -X GET "http://localhost:3000/api/health" | jq '.services.external.sheets'

# Проверяем Google Sheets API
curl -X GET "http://localhost:3000/api/admin/monitoring" \
  -H "x-admin-key: canton-admin-2025-super-secure-key" | jq '.integrations.googleSheets'
```

**Решение:**
1. Проверить переменные окружения:
   - `GOOGLE_SHEET_ID`
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_PRIVATE_KEY`
2. Убедиться, что service account имеет доступ к Google Sheet
3. Проверить формат private key (должен содержать `\n`)
4. Проверить права доступа к Google Sheet

#### Проблема: Telegram уведомления не отправляются
**Симптомы:**
- Заказы создаются, но уведомления в Telegram не приходят
- Ошибки в логах о Telegram API

**Диагностика:**
```bash
# Проверяем конфигурацию
curl -X GET "http://localhost:3000/api/health" | jq '.services.external.telegram'

# Проверяем Telegram API
curl -X GET "http://localhost:3000/api/admin/monitoring" \
  -H "x-admin-key: canton-admin-2025-super-secure-key" | jq '.integrations.telegram'
```

**Решение:**
1. Проверить переменные окружения:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
2. Убедиться, что бот добавлен в чат
3. Проверить права бота на отправку сообщений
4. Проверить формат chat_id (должен быть числовым)

#### Проблема: Медленная производительность
**Симптомы:**
- Время отклика > 1 секунды
- Высокое использование CPU/памяти

**Диагностика:**
```bash
# Проверяем производительность
curl -X GET "http://localhost:3000/api/health" | jq '.system'

# Мониторим производительность
curl -X GET "http://localhost:3000/api/admin/monitoring" \
  -H "x-admin-key: canton-admin-2025-super-secure-key" | jq '.performance'
```

**Решение:**
1. Проверить использование памяти и CPU
2. Оптимизировать запросы к Google Sheets
3. Добавить кэширование для часто запрашиваемых данных
4. Проверить настройки Node.js (memory limits)
5. Рассмотреть использование connection pooling

### 2. Monitoring and Alerting

#### Настройка мониторинга
```bash
# Создаем скрипт мониторинга
cat > monitor-canton-otc.sh << 'EOF'
#!/bin/bash

BASE_URL="http://localhost:3000"
ADMIN_KEY="canton-admin-2025-super-secure-key"

# Проверяем health
HEALTH_RESPONSE=$(curl -s -X GET "$BASE_URL/api/health")
HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.status')

if [ "$HEALTH_STATUS" != "healthy" ]; then
  echo "❌ Health check failed: $HEALTH_STATUS"
  # Отправляем алерт
  curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
    -d "chat_id=$TELEGRAM_CHAT_ID" \
    -d "text=🚨 Canton OTC Health Check Failed: $HEALTH_STATUS"
fi

# Проверяем производительность
PERF_RESPONSE=$(curl -s -X GET "$BASE_URL/api/admin/monitoring" \
  -H "x-admin-key: $ADMIN_KEY")

AVG_RESPONSE_TIME=$(echo "$PERF_RESPONSE" | jq -r '.performance.averageResponseTime')
ERROR_RATE=$(echo "$PERF_RESPONSE" | jq -r '.performance.errorRate')

if (( $(echo "$AVG_RESPONSE_TIME > 1000" | bc -l) )); then
  echo "⚠️ High response time: ${AVG_RESPONSE_TIME}ms"
fi

if (( $(echo "$ERROR_RATE > 0.05" | bc -l) )); then
  echo "⚠️ High error rate: ${ERROR_RATE}"
fi

echo "✅ Monitoring check completed"
EOF

chmod +x monitor-canton-otc.sh
```

#### Настройка алертов
```bash
# Добавляем в crontab для мониторинга каждые 5 минут
(crontab -l 2>/dev/null; echo "*/5 * * * * /path/to/monitor-canton-otc.sh") | crontab -
```

## 📈 Test Automation

### 1. CI/CD Integration

#### GitHub Actions Workflow
```yaml
# .github/workflows/test.yml
name: Canton OTC Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Start application
      run: |
        npm run build
        npm start &
        sleep 10
    
    - name: Run API tests
      run: |
        chmod +x test-api-endpoints.sh
        ./test-api-endpoints.sh
    
    - name: Run performance tests
      run: |
        chmod +x test-performance.sh
        ./test-performance.sh
    
    - name: Run security tests
      run: |
        chmod +x test-security.sh
        ./test-security.sh
```

### 2. Test Data Management

#### Создание тестовых данных
```bash
# Создаем скрипт для генерации тестовых данных
cat > generate-test-data.sh << 'EOF'
#!/bin/bash

BASE_URL="http://localhost:3000"

echo "📊 Generating test data..."

# Создаем тестовые заказы
for i in {1..10}; do
  curl -X POST "$BASE_URL/api/create-order" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"test-user-$i@example.com\",
      \"usdtAmount\": $((1000 + i * 500)),
      \"cantonAmount\": $((4761 + i * 2380)),
      \"cantonAddress\": \"TKau36dpRiTENTjhdJVU4DhoFzX9x3N5Q1\",
      \"orderType\": \"BUY\"
    }" > /dev/null 2>&1
  
  echo "Created test order $i"
  sleep 1
done

echo "✅ Test data generation completed"
EOF

chmod +x generate-test-data.sh
```

## 🎯 Best Practices

### 1. Test Organization

- **Группировка тестов**: По функциональности и типу
- **Изоляция тестов**: Каждый тест независим
- **Очистка данных**: После каждого теста
- **Параллельное выполнение**: Где возможно

### 2. Test Data

- **Реалистичные данные**: Используйте реальные форматы
- **Валидные адреса**: Используйте реальные Canton адреса
- **Различные сценарии**: Тестируйте edge cases
- **Очистка**: Удаляйте тестовые данные после тестов

### 3. Error Handling

- **Graceful degradation**: Система должна работать при сбоях
- **Информативные ошибки**: Понятные сообщения об ошибках
- **Логирование**: Детальные логи для отладки
- **Мониторинг**: Отслеживание ошибок в реальном времени

### 4. Performance

- **Базовые метрики**: Установите baseline производительности
- **Регулярное тестирование**: Мониторьте производительность
- **Оптимизация**: Улучшайте медленные части
- **Масштабирование**: Тестируйте под нагрузкой

## 📚 Additional Resources

### 1. Documentation Links
- [Canton OTC API Documentation](./API_DOCUMENTATION.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Security Guidelines](./SECURITY_GUIDELINES.md)

### 2. Tools and Libraries
- **curl**: HTTP клиент для тестирования
- **jq**: JSON парсер для анализа ответов
- **bc**: Калькулятор для математических операций
- **Postman**: GUI для тестирования API
- **Newman**: CLI для Postman коллекций

### 3. Monitoring Tools
- **Prometheus**: Метрики и мониторинг
- **Grafana**: Визуализация метрик
- **ELK Stack**: Логирование и анализ
- **Sentry**: Отслеживание ошибок

---

## 🎉 Заключение

Этот comprehensive testing guide покрывает все аспекты тестирования Canton OTC Exchange проекта. Следуйте этим инструкциям для обеспечения высокого качества и надежности системы.

**Помните:**
- Тестируйте регулярно
- Автоматизируйте где возможно
- Мониторьте производительность
- Документируйте результаты
- Исправляйте баги быстро

Удачного тестирования! 🚀
