# 🧪 ПРОМПТ: Тестирование Telegram Client API уведомлений

## 📋 КОНТЕКСТ ПРОЕКТА

**Проект**: Canton OTC Exchange  
**Репозиторий**: https://github.com/TheMacroeconomicDao/CantonOTC  
**Production**: https://1otc.cc  
**Namespace**: `canton-otc`  
**Ветка**: `main`

**Архитектура**:
- Next.js 15.5.7 (App Router)
- Kubernetes на production
- GitHub Actions для CI/CD
- Telegram Bot API + Telegram Client API (MTProto)

**Текущий образ**: `ghcr.io/themacroeconomicdao/cantonotc:c3d41e2c` (откат на предыдущий рабочий)

---

## ✅ ЧТО УЖЕ РАБОТАЕТ

### 1. Создание заявок
- ✅ API `/api/create-order` работает
- ✅ Заявки сохраняются в Supabase (`public_orders`)
- ✅ Уведомления отправляются в группу клиентов (`TELEGRAM_CLIENT_GROUP_CHAT_ID`)
- ✅ Уведомления отправляются в группу операторов (`TELEGRAM_CHAT_ID`)

### 2. Принятие заявок
- ✅ Кнопка "✅ Принять заявку" работает в группе клиентов
- ✅ Callback `accept_order:{orderId}` обрабатывается
- ✅ Статус заявки обновляется в Supabase (`status: 'accepted'`)
- ✅ Информация об операторе сохраняется (`operator_id`, `operator_username`)
- ✅ Создаётся сервисный чат с оператором
- ✅ Уведомления оператору отправляются

### 3. Telegram Client API настройка
- ✅ Переменные окружения установлены:
  - `TELEGRAM_API_ID=38052547`
  - `TELEGRAM_API_HASH=cb6e8dec7c4ecb28c860e41f40b18d36`
  - `TELEGRAM_SESSION_STRING=1AgAOMTQ5...` (369 символов)
- ✅ Переменные доступны в runtime подов
- ✅ Secret содержит 62 ключа
- ✅ Поды работают (2/2 Running)

---

## ⚠️ ПРОБЛЕМА

**После нажатия кнопки "✅ Принять заявку" клиент НЕ получает сообщение от администратора через Telegram Client API.**

### Ожидаемое поведение:
1. Клиент нажимает "✅ Принять заявку" в группе клиентов
2. Система вызывает `telegramClientService.notifyTakerAboutAcceptedOrder()`
3. Клиент получает личное сообщение от администратора с деталями заявки
4. Push-уведомление приходит даже без `/start`

### Текущее поведение:
- Заявка принимается успешно
- Статус обновляется в базе
- Но сообщение от администратора НЕ отправляется

**ВАЖНО**: Вся остальная логика работала на прошлом коммите. Проблема только с получением сообщения от администратора в Telegram.

---

## 🔍 ЧТО НУЖНО ПРОВЕРИТЬ

### 1. Инициализация Telegram Client API
**Файл**: `src/lib/services/telegramClient.ts`

Проверить:
- ✅ Конфигурация загружается при старте (`initializeConfig()`)
- ✅ Логи: `📱 Telegram Client Service Config: { hasApiId: true, hasApiHash: true, hasSession: true }`
- ✅ Подключение работает (`checkConnection()` возвращает `true`)

**Команда для проверки**:
```bash
kubectl logs -n canton-otc deployment/canton-otc --tail=500 | grep -i "Telegram Client Service Config"
```

### 2. Вызов метода в медиаторе
**Файл**: `src/lib/services/telegramMediator.ts` (строки 724-760)

Проверить:
- ✅ Метод `getTelegramClientService()` возвращает сервис
- ✅ Метод `notifyTakerAboutAcceptedOrder()` вызывается
- ✅ Передаются правильные параметры:
  - `userId` (Telegram user_id тейкера)
  - `userUsername` (Telegram username тейкера)
  - `order` (полные данные ордера)
  - `operatorUsername` (username оператора)
  - `chatLink` (ссылка на чат)

**Логи для проверки**:
```bash
kubectl logs -n canton-otc deployment/canton-otc --tail=500 | grep -iE "getTelegramClientService|notifyTakerAboutAcceptedOrder|Telegram Client API initialized"
```

### 3. Отправка сообщения
**Файл**: `src/lib/services/telegramClient.ts` (строки 248-361)

Проверить:
- ✅ Метод `notifyTakerAboutAcceptedOrder()` выполняется
- ✅ Подключение к Telegram работает (`connect()`)
- ✅ Сообщение формируется правильно
- ✅ `sendMessage()` вызывается с правильными параметрами
- ✅ Результат: `{ success: true, messageId }` или ошибка

**Логи для проверки**:
```bash
kubectl logs -n canton-otc deployment/canton-otc --tail=500 | grep -iE "Taker notified via Telegram Client|Message sent via Telegram Client|Failed to send message via Telegram Client"
```

### 4. Обработка ошибок
Проверить:
- ❌ Есть ли ошибки в логах?
- ❌ Fallback на Bot API срабатывает?
- ❌ Какие ошибки возвращает Telegram Client API?

**Логи для проверки**:
```bash
kubectl logs -n canton-otc deployment/canton-otc --tail=500 | grep -iE "error.*telegram|Telegram Client.*not available|Telegram Client.*failed|fallback"
```

---

## 🎯 ЗАДАЧА

**Протестировать и исправить отправку сообщений через Telegram Client API:**

1. **Создать тестовую заявку**
2. **Принять заявку через кнопку в группе**
3. **Проверить логи** - вызывается ли `notifyTakerAboutAcceptedOrder()`
4. **Найти проблему** - почему сообщение не отправляется
5. **Исправить** - убедиться что сообщение отправляется
6. **Проверить** - клиент получает сообщение в Telegram

---

## 📁 КЛЮЧЕВЫЕ ФАЙЛЫ

1. **`src/lib/services/telegramClient.ts`**
   - Метод `notifyTakerAboutAcceptedOrder()` (строки 248-361)
   - Метод `sendMessage()` (строки 140-202)
   - Метод `connect()` (строки 78-132)
   - Инициализация конфигурации (строки 50-73)

2. **`src/lib/services/telegramMediator.ts`**
   - Обработка `accept_order` callback (строки 440-1141)
   - Вызов `notifyTakerAboutAcceptedOrder()` (строки 730-760)
   - Метод `getTelegramClientService()` (строки 34-54)

3. **`config/kubernetes/k8s/deployment.yaml`**
   - Переменные окружения Telegram Client API (строки 81-95)

4. **`config/kubernetes/k8s/secret.template.yaml`**
   - Секреты Telegram Client API (строки 87-89)

---

## 🧪 ПЛАН ТЕСТИРОВАНИЯ

### Шаг 1: Создать тестовую заявку

```bash
# Получить актуальную цену
BUY_PRICE=$(kubectl get configmap canton-otc-config -n canton-otc -o jsonpath='{.data.CANTON_COIN_BUY_PRICE_USD}')

# Рассчитать правильный Canton amount
USDT_AMOUNT=1000
BASE_AMOUNT=$(python3 -c "print($USDT_AMOUNT / float('$BUY_PRICE'))")
CANTON_AMOUNT=$(python3 -c "print(round($BASE_AMOUNT * 0.99, 6))")

# Создать заявку
curl -s -X POST https://1otc.cc/api/create-order \
  -H "Content-Type: application/json" \
  -d "{
    \"cantonAddress\": \"04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8\",
    \"refundAddress\": \"bron::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8\",
    \"usdtAmount\": $USDT_AMOUNT,
    \"cantonAmount\": $CANTON_AMOUNT,
    \"email\": \"test-telegram-$(date +%s)@example.com\",
    \"exchangeDirection\": \"buy\"
  }" | jq -r '.orderId'
```

**Сохранить Order ID!**

### Шаг 2: Принять заявку

1. Открыть группу клиентов в Telegram (ID: `-5039619304`)
2. Найти заявку по Order ID
3. Нажать кнопку "✅ Принять заявку"

### Шаг 3: Проверить логи

```bash
ORDER_ID="YOUR_ORDER_ID"

# Проверить обработку accept_order
kubectl logs -n canton-otc deployment/canton-otc --tail=500 --since=5m | \
  grep -iE "accept_order.*${ORDER_ID}|Processing accept_order.*${ORDER_ID}"

# Проверить Telegram Client API
kubectl logs -n canton-otc deployment/canton-otc --tail=500 --since=5m | \
  grep -iE "Taker notified via Telegram Client.*${ORDER_ID}|notifyTakerAboutAcceptedOrder.*${ORDER_ID}|Telegram Client API.*${ORDER_ID}"

# Проверить отправку сообщения
kubectl logs -n canton-otc deployment/canton-otc --tail=500 --since=5m | \
  grep -iE "Message sent via Telegram Client.*${ORDER_ID}|sendMessage.*${ORDER_ID}"

# Проверить ошибки
kubectl logs -n canton-otc deployment/canton-otc --tail=500 --since=5m | \
  grep -iE "error.*${ORDER_ID}|failed.*${ORDER_ID}|Telegram Client.*not available"
```

### Шаг 4: Проверить результат

**Ожидаемые логи**:
```
✅ Telegram Client API initialized in mediator
🔍 Processing accept_order callback: { orderId: '...', userId: ..., userUsername: '...' }
✅ Order accepted successfully: { orderId: '...', operatorId: ..., operatorUsername: '...' }
✅ Taker notified via Telegram Client API: { orderId: '...', takerId: ..., takerUsername: '...' }
✅ Message sent via Telegram Client: { recipient: ..., messageId: ... }
```

**Если не работает, возможные ошибки**:
```
⚠️ Telegram Client API not available, will use Bot API fallback
❌ Failed to send message via Telegram Client: ...
⚠️ Telegram Client API failed, trying Bot API fallback: ...
```

---

## 🔧 ЧТО НУЖНО ИСПРАВИТЬ

### Если Telegram Client API не инициализируется:

1. Проверить переменные в подах:
```bash
kubectl exec -n canton-otc deployment/canton-otc -- env | grep "^TELEGRAM_API"
```

2. Проверить логи инициализации:
```bash
kubectl logs -n canton-otc deployment/canton-otc --tail=200 | grep -i "Telegram Client Service Config"
```

3. Если переменные отсутствуют - обновить Secret и перезапустить поды

### Если метод не вызывается:

1. Проверить что `getTelegramClientService()` возвращает сервис
2. Проверить что `notifyTakerAboutAcceptedOrder()` вызывается
3. Проверить передаваемые параметры (особенно `userId` и `order`)

### Если сообщение не отправляется:

1. Проверить подключение к Telegram:
```bash
# В поде проверить подключение
kubectl exec -n canton-otc deployment/canton-otc -- node -e "
const { telegramClientService } = require('./src/lib/services/telegramClient');
telegramClientService.checkConnection().then(connected => {
  console.log('Connected:', connected);
  if (connected) {
    return telegramClientService.getMe();
  }
}).then(me => {
  if (me) console.log('User:', me.firstName, me.lastName, '@' + me.username);
}).catch(err => console.error('Error:', err.message));
"
```

2. Проверить ошибки отправки в логах
3. Проверить что `userId` правильный (число, не строка)
4. Проверить что сессия не истекла

---

## 📊 ТЕКУЩЕЕ СОСТОЯНИЕ

**Коммит**: `c3d41e2c` (откат на предыдущий рабочий)  
**Образ**: `ghcr.io/themacroeconomicdao/cantonotc:c3d41e2c`  
**Поды**: 2/2 Running  
**Secret**: 62 ключа  
**Telegram Client API переменные**: доступны в runtime

---

## 🎯 ОЖИДАЕМЫЙ РЕЗУЛЬТАТ

После исправления:

1. ✅ Клиент нажимает "✅ Принять заявку"
2. ✅ В логах: `✅ Taker notified via Telegram Client API: { orderId, takerId, takerUsername }`
3. ✅ В логах: `✅ Message sent via Telegram Client: { recipient, messageId }`
4. ✅ Клиент получает личное сообщение от администратора в Telegram
5. ✅ Push-уведомление приходит (работает без `/start`)
6. ✅ Сообщение содержит:
   - Order ID
   - Тип сделки (BUY/SELL)
   - Суммы (Payment/Receiving)
   - Цена CC
   - Адреса (Canton, Receiving)
   - Контакты (Email, Telegram инициатора)
   - Ссылка на чат с оператором

---

## 📝 ИНСТРУКЦИИ ДЛЯ AI

1. **Прочитай ключевые файлы** перед исправлениями
2. **Создай тестовую заявку** и прими её
3. **Проверь логи** - найди где именно проблема
4. **Исправь проблему** - убедись что Telegram Client API вызывается и работает
5. **Протестируй** - создай новую заявку и проверь что сообщение приходит
6. **Объясни что было исправлено** и почему

**ВАЖНО**: 
- Не ломай существующую логику (она работала)
- Проблема только в отправке сообщения от администратора
- Остальная логика (принятие заявки, обновление статуса) работает
- Образ откачен на `c3d41e2c` (предыдущий рабочий)

---

## 🔍 ДИАГНОСТИКА

### Команды для диагностики:

```bash
# 1. Проверить переменные в подах
kubectl exec -n canton-otc deployment/canton-otc -- env | grep "^TELEGRAM_API"

# 2. Проверить инициализацию Telegram Client API
kubectl logs -n canton-otc deployment/canton-otc --tail=500 | grep -i "Telegram Client Service Config"

# 3. Проверить подключение к Telegram
kubectl exec -n canton-otc deployment/canton-otc -- node -e "
const { telegramClientService } = require('./src/lib/services/telegramClient');
telegramClientService.checkConnection().then(c => console.log('Connected:', c));
telegramClientService.getMe().then(m => console.log('User:', m?.firstName, '@' + m?.username));
"

# 4. Проверить логи после принятия заявки
ORDER_ID="YOUR_ORDER_ID"
kubectl logs -n canton-otc deployment/canton-otc --tail=1000 --since=10m | \
  grep -iE "${ORDER_ID}|Taker notified|Telegram Client|notifyTaker" | \
  tail -50
```

---

**Начни с создания тестовой заявки, принятия её и проверки логов. Найди где именно проблема и исправь её.**





