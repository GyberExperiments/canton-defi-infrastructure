# 🎯 Система проверки готовности сделок

**Дата реализации**: 3 декабря 2025  
**Статус**: ✅ РЕАЛИЗОВАНО

---

## 📋 Описание функционала

Система автоматически проверяет готовность сделки после принятия заявки оператором. Когда есть и покупатель, и продавец с подходящими параметрами, администратор получает уведомление.

---

## ✅ Реализованные функции

### 1. Обработка принятия заявки

**Файл**: `src/lib/services/telegramMediator.ts`

**Что происходит:**
1. Оператор нажимает "Принять" в Telegram
2. Система получает callback с `accept_order:{orderId}`
3. Проверяется статус заявки в базе данных
4. Заявка блокируется для оператора (race condition protection)
5. Обновляется статус на `accepted`
6. Сохраняется информация об операторе:
   - `operator_id` - Telegram ID оператора
   - `operator_username` - Username оператора
   - `accepted_at` - Время принятия

**Логирование:**
```typescript
console.log('✅ Order accepted successfully:', {
  orderId: updatedOrder.order_id,
  operatorId,
  operatorUsername,
  customerEmail: updatedOrder.email,
  customerTelegram: updatedOrder.telegram,
  customerId: updatedOrder.email, // Intercom customer ID
  status: updatedOrder.status,
  acceptedAt: updatedOrder.accepted_at,
  timestamp: new Date().toISOString()
});
```

### 2. Проверка готовности сделки

**Метод**: `checkDealReadiness()`

**Логика:**
1. Определяется направление текущей заявки (buy/sell)
2. Ищутся противоположные принятые заявки:
   - Если текущая заявка `buy`, ищутся `sell` заявки
   - Если текущая заявка `sell`, ищутся `buy` заявки
3. Учитывается отклонение до 10% по сумме для гибкости
4. Выбирается лучшая пара (ближайшая по сумме)
5. Если найдена пара - отправляется уведомление администратору

**Параметры поиска:**
- `exchange_direction` - противоположное направление
- `status = 'accepted'` - только принятые заявки
- `payment_amount_usd` в диапазоне ±10%
- Сортировка по `accepted_at` (очередь принятия)

### 3. Уведомление администратору

**Когда отправляется:**
- Когда найдена пара заявок (buy + sell) с подходящими параметрами

**Содержание уведомления:**
```
🎯 СДЕЛКА ГОТОВА К ИСПОЛНЕНИЮ!

📊 Пара заявок:
🛒 Покупка: #ORDER_ID
   💰 Сумма: $XXX.XX USDT
   📊 Получение: XXX.XX CC
   👤 Оператор: @username
   📧 Клиент: email@example.com

💸 Продажа: #ORDER_ID
   📊 Продажа: XXX.XX CC
   💰 Получение: $XXX.XX USDT
   👤 Оператор: @username
   📧 Клиент: email@example.com

⏰ Время принятия:
   Покупка: DD.MM.YYYY HH:MM
   Продажа: DD.MM.YYYY HH:MM

✅ Обе стороны приняты операторами - можно начинать сделку!
```

### 4. Обновление статуса в базе

После нахождения пары:
- Обе заявки обновляются на статус `in_progress`
- Это означает, что сделка готова к исполнению

---

## 🔍 Информация о клиенте в ответе

**Endpoint**: `POST /api/telegram-mediator/webhook`

**Ответ при принятии заявки:**
```json
{
  "success": true,
  "handled": true,
  "type": "callback_query",
  "orderInfo": {
    "orderId": "ORDER_ID",
    "email": "customer@example.com",
    "telegram": "@username",
    "whatsapp": "+1234567890",
    "status": "accepted",
    "operatorId": 123456789,
    "operatorUsername": "operator_username",
    "customerId": "customer@example.com",  // ✅ ID клиента (email)
    "intercomUserId": "customer@example.com"  // Для Intercom API
  },
  "operator": {
    "id": 123456789,
    "username": "operator_username",
    "firstName": "Operator"
  },
  "timestamp": "2025-12-03T20:00:00.000Z"
}
```

**Важно:**
- `customerId` = `email` (используется как user_id в Intercom)
- `intercomUserId` = `email` (для поиска в Intercom API)

---

## 📊 Очередь принятия заявок

**Механизм:**
1. Используется race condition protection через Supabase:
   ```typescript
   .eq('order_id', orderId)
   .eq('status', 'pending') // Проверка на race condition
   ```
2. Только первый оператор, который успешно обновит статус, примет заявку
3. Остальные получат сообщение: "⚠️ Заявка уже принята другим оператором"
4. Время принятия сохраняется в `accepted_at` для отслеживания очереди

**Сортировка при поиске пары:**
- Заявки сортируются по `accepted_at` (ascending)
- Первая принятая заявка имеет приоритет

---

## 🗄️ Структура базы данных

**Таблица**: `public_orders`

**Поля для отслеживания принятия:**
- `status` - статус заявки (`pending`, `accepted`, `in_progress`, `completed`, `cancelled`)
- `operator_id` - Telegram ID оператора
- `operator_username` - Username оператора
- `accepted_at` - Время принятия заявки
- `exchange_direction` - направление (`buy` или `sell`)
- `payment_amount_usd` - сумма в USD
- `canton_amount` - количество Canton Coin

**Индексы:**
- `idx_public_orders_status` - для быстрого поиска по статусу
- `idx_public_orders_created_at` - для сортировки по времени создания
- `idx_public_orders_operator` - для поиска заявок оператора

---

## 🔔 Уведомления

### 1. Оператору
После принятия заявки оператор получает:
- Подтверждение в callback query
- Сообщение в приватном канале с деталями заявки
- Ссылку на сервисный чат с клиентом

### 2. Клиенту
Клиент получает уведомление:
- О том, что его заявка принята
- Информацию об операторе
- Ссылку на сервисный чат

### 3. Администратору
Администратор получает уведомление:
- Когда найдена пара заявок (buy + sell)
- С полной информацией о обеих заявках
- О времени принятия каждой заявки

---

## 🧪 Тестирование

### Проверка принятия заявки:
1. Создать заявку через API
2. Нажать "Принять" в Telegram
3. Проверить логи:
   ```
   ✅ Order accepted successfully: {
     orderId: "...",
     customerId: "email@example.com",
     ...
   }
   ```
4. Проверить ответ webhook - должен содержать `orderInfo.customerId`

### Проверка готовности сделки:
1. Создать заявку на покупку (buy)
2. Принять её оператором
3. Создать заявку на продажу (sell) с похожей суммой
4. Принять её другим оператором
5. Проверить логи:
   ```
   ✅ Found matching order for deal: {
     buyOrder: "...",
     sellOrder: "...",
     ...
   }
   ```
6. Проверить уведомление администратору в Telegram

---

## 📝 Логирование

Все действия логируются с подробной информацией:

**Принятие заявки:**
- Order ID
- Operator ID и username
- Customer email, telegram, whatsapp
- Customer ID (email)
- Timestamp

**Поиск пары:**
- Текущая заявка
- Направление поиска
- Диапазон сумм
- Найденные заявки
- Выбранная пара

**Уведомление администратору:**
- Buy order ID
- Sell order ID
- Timestamp

---

## 🔧 Конфигурация

**Environment Variables:**
- `TELEGRAM_CHAT_ID` - ID приватного канала для уведомлений администратору
- `NEXT_PUBLIC_SUPABASE_URL` - URL Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key для доступа к базе

---

## ✅ Чеклист функционала

- [x] Обработка callback `accept_order:{orderId}`
- [x] Получение информации о клиенте из базы
- [x] Сохранение ID клиента в ответе webhook
- [x] Фиксация принятия в базе данных
- [x] Очередь принятия (race condition protection)
- [x] Проверка готовности сделки
- [x] Поиск противоположных заявок
- [x] Уведомление администратору о готовности
- [x] Обновление статуса заявок на `in_progress`
- [x] Логирование всех действий

---

**Автор**: AI Assistant  
**Версия**: 1.0
