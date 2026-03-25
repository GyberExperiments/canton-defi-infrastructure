# 🧪 Руководство по тестированию системы принятия заявок

**Дата**: 3 декабря 2025

---

## 📋 Что тестируем

1. ✅ Создание заявок (buy/sell)
2. ✅ Принятие заявок операторами
3. ✅ Получение ответа с customerId
4. ✅ Фиксация в базе данных
5. ✅ Очередь принятия
6. ✅ Проверка готовности сделки
7. ✅ Уведомление администратору

---

## 🚀 Быстрый старт

### 1. Создать тестовые заявки

```bash
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc
bash scripts/test-deal-readiness.sh
```

Скрипт создаст:
- Заявку на покупку (BUY)
- Заявку на продажу (SELL)
- Выведет Order ID для тестирования

### 2. Принять заявки в Telegram

1. Откройте публичный Telegram канал с заявками
2. Найдите созданные заявки по Order ID
3. Нажмите "✅ Принять" на каждой заявке
4. Проверьте ответ в логах

### 3. Проверить логи

```bash
bash scripts/check-deal-logs.sh
```

Или вручную:
```bash
kubectl logs -n canton-otc deployment/canton-otc --tail=200 | grep -E "Order accepted|matching orders|deal readiness"
```

---

## 🔍 Что проверять

### В логах сервера должны быть:

1. **При принятии заявки:**
   ```
   ✅ Order accepted successfully: {
     orderId: "...",
     customerEmail: "...",
     customerId: "...",
     operatorId: ...,
     operatorUsername: "...",
     acceptedAt: "..."
   }
   ```

2. **При проверке готовности:**
   ```
   🔍 Checking for matching orders: {
     currentOrder: "...",
     direction: "buy",
     lookingFor: "sell",
     amountRange: { min: ..., max: ... }
   }
   ```

3. **При нахождении пары:**
   ```
   ✅ Found matching order for deal: {
     buyOrder: "...",
     sellOrder: "...",
     buyOperator: "...",
     sellOperator: "..."
   }
   ```

4. **При уведомлении администратора:**
   ```
   ✅ Admin notified about ready deal: {
     buyOrderId: "...",
     sellOrderId: "..."
   }
   ```

### В Telegram канале администратора:

Должно прийти сообщение:
```
🎯 СДЕЛКА ГОТОВА К ИСПОЛНЕНИЮ!

📊 Пара заявок:
🛒 Покупка: #ORDER_ID
   💰 Сумма: $XXX.XX USDT
   👤 Оператор: @username
   📧 Клиент: email@example.com

💸 Продажа: #ORDER_ID
   📊 Продажа: XXX.XX CC
   👤 Оператор: @username
   📧 Клиент: email@example.com

✅ Обе стороны приняты операторами - можно начинать сделку!
```

### В ответе webhook:

При нажатии "Принять" webhook должен вернуть:
```json
{
  "success": true,
  "handled": true,
  "type": "callback_query",
  "orderInfo": {
    "orderId": "...",
    "email": "...",
    "customerId": "...",  // ✅ Должен быть!
    "status": "accepted",
    "operatorId": ...,
    "operatorUsername": "..."
  }
}
```

---

## 🧪 Тестовые сценарии

### Сценарий 1: Принятие одной заявки

1. Создать заявку на покупку
2. Принять её оператором
3. Проверить:
   - ✅ Логи содержат "Order accepted successfully"
   - ✅ В логах есть customerId
   - ✅ Статус в базе = "accepted"
   - ✅ Webhook вернул orderInfo с customerId

### Сценарий 2: Готовность сделки

1. Создать заявку на покупку ($500)
2. Принять её оператором
3. Создать заявку на продажу (~$500)
4. Принять её другим оператором
5. Проверить:
   - ✅ Логи содержат "Checking for matching orders"
   - ✅ Логи содержат "Found matching order for deal"
   - ✅ Администратор получил уведомление
   - ✅ Обе заявки в статусе "in_progress"

### Сценарий 3: Очередь принятия

1. Создать заявку
2. Два оператора одновременно нажимают "Принять"
3. Проверить:
   - ✅ Только первый оператор принял заявку
   - ✅ Второй получил сообщение "Заявка уже принята"
   - ✅ В базе только один operator_id

---

## 📊 Проверка базы данных

### Через Supabase:

```sql
-- Проверить принятые заявки
SELECT 
  order_id,
  exchange_direction,
  email,
  status,
  operator_username,
  accepted_at
FROM public_orders
WHERE status = 'accepted'
ORDER BY accepted_at DESC;

-- Проверить готовые сделки
SELECT 
  order_id,
  exchange_direction,
  status,
  operator_username
FROM public_orders
WHERE status = 'in_progress'
ORDER BY accepted_at DESC;
```

---

## 🐛 Отладка

### Проблема: Заявка не принимается

**Проверить:**
1. Логи на наличие ошибок
2. Статус заявки в базе (должен быть "pending")
3. Webhook настроен правильно
4. Telegram бот имеет права на редактирование сообщений

### Проблема: Не приходит уведомление администратору

**Проверить:**
1. `TELEGRAM_CHAT_ID` установлен в env
2. Логи содержат "Admin notified about ready deal"
3. Telegram бот имеет доступ к каналу администратора
4. Найдена ли пара заявок (логи "Found matching order")

### Проблема: customerId отсутствует в ответе

**Проверить:**
1. Заявка существует в базе `public_orders`
2. В заявке есть поле `email`
3. Логи содержат "Order found - Client Info"
4. Webhook правильно формирует ответ

---

## 📝 Чеклист тестирования

- [ ] Созданы тестовые заявки (buy и sell)
- [ ] Заявки видны в публичном Telegram канале
- [ ] Кнопка "Принять" работает
- [ ] При принятии логируется customerId
- [ ] Webhook возвращает orderInfo с customerId
- [ ] Статус заявки обновляется в базе
- [ ] Оператор получает уведомление
- [ ] Клиент получает уведомление
- [ ] При наличии пары администратор получает уведомление
- [ ] Обе заявки переходят в статус "in_progress"

---

## 🔗 Полезные команды

```bash
# Создать тестовые заявки
bash scripts/test-deal-readiness.sh

# Проверить логи
bash scripts/check-deal-logs.sh

# Посмотреть все логи
kubectl logs -n canton-otc deployment/canton-otc --tail=500 -f

# Проверить статус заявки
curl https://1otc.cc/api/order-status/ORDER_ID

# Проверить health webhook
curl https://1otc.cc/api/telegram-mediator/webhook
```

---

**Автор**: AI Assistant  
**Версия**: 1.0
