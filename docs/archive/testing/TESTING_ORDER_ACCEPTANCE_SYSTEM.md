# 🔧 ПРОВЕРКА И ТЕСТИРОВАНИЕ СИСТЕМЫ ПРИНЯТИЯ ОРДЕРОВ CANTON OTC

## 📋 ТЕКУЩЕЕ СОСТОЯНИЕ (ПОСЛЕ ДЕПЛОЯ)

✅ **Настроено и работает:**
- API: https://1otc.cc (HTTP/2 200)
- Webhook: https://1otc.cc/api/telegram-mediator/webhook
- Telegram Bot: @CantonOTC_Bot (один бот для всего)
- Группа операторов (TELEGRAM_CHAT_ID): -4872025335 "1OTC.cc | Notifications"
- Группа клиентов (TELEGRAM_CLIENT_GROUP_CHAT_ID): -5039619304 "1OTC_ORDERS"

---

## 🔍 АВТОМАТИЧЕСКАЯ ПРОВЕРКА

Запустите скрипт для автоматической проверки:

```bash
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc
./scripts/test-order-acceptance-system.sh
```

Скрипт проверит:
1. ✅ ENV переменные в K8s
2. ✅ Логи приложения
3. ✅ Webhook endpoint
4. ✅ Создание тестовой заявки
5. ✅ Логи после создания заявки

---

## 📝 РУЧНАЯ ПРОВЕРКА

### 1. Проверка ENV переменных в K8s

```bash
# Проверить все Telegram переменные
kubectl exec -n canton-otc deployment/canton-otc -- env | grep -E "TELEGRAM|SUPABASE"

# Должны быть установлены:
# - TELEGRAM_BOT_TOKEN
# - TELEGRAM_CHAT_ID (группа операторов)
# - TELEGRAM_CLIENT_GROUP_CHAT_ID (группа клиентов)
# - NEXT_PUBLIC_SUPABASE_URL (если используется Supabase)
# - SUPABASE_SERVICE_ROLE_KEY (если используется Supabase)
```

### 2. Проверка логов

```bash
# Общие логи
kubectl logs -n canton-otc deployment/canton-otc --tail=100

# Логи связанные с Telegram
kubectl logs -n canton-otc deployment/canton-otc --tail=100 | grep -iE "telegram|accept|public"

# Логи sendPublicOrderNotification
kubectl logs -n canton-otc deployment/canton-otc --tail=200 | grep -iE "sendPublicOrderNotification|Publishing order|client group"
```

### 3. Тест webhook

```bash
curl -X POST "https://1otc.cc/api/telegram-mediator/webhook" \
  -H "Content-Type: application/json" \
  -d '{"message": {"text": "test", "chat": {"id": 123, "type": "private"}, "from": {"id": 123, "first_name": "Test"}}}' | jq .
```

### 4. Тест создания ордера

```bash
curl -X POST https://1otc.cc/api/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "cantonAddress": "04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "usdtAmount": 700,
    "cantonAmount": 1591,
    "email": "test@example.com",
    "exchangeDirection": "buy"
  }' | jq .
```

**Ожидаемый результат:**
```json
{
  "success": true,
  "orderId": "XXX-XXX-XXX",
  "message": "Order created successfully...",
  "status": "awaiting-deposit"
}
```

---

## 🧪 ТЕСТИРОВАНИЕ ПУБЛИКАЦИИ ЗАЯВКИ В ГРУППУ КЛИЕНТОВ

### Шаг 1: Создать тестовую заявку

Используйте команду из раздела "4. Тест создания ордера" выше.

### Шаг 2: Проверить группу клиентов в Telegram

1. Откройте группу **"1OTC_ORDERS"** в Telegram
2. Найдите сообщение с новой заявкой
3. Проверьте наличие кнопки **"✅ Принять заявку"**

**Ожидаемое сообщение:**
```
🔔 НОВАЯ ЗАЯВКА OTC

📊 Тип: 🛒 ПОКУПКА Canton Coin
💰 Оплата: $700.00 USDT
📊 Получение: 1591.00 Canton Coin

💵 Цена: $0.XXXX (рыночная)
📈 Комиссия: 3%
📋 ID заявки: XXX-XXX-XXX
🕐 Создана: XX.XX.XXXX XX:XX (МСК)

📞 СВЯЗЬ С ОПЕРАТОРОМ:
💬 @TECH_HY_Customer_Service_bot
👤 @hypov

⚡️ Нажмите "Принять заявку" для начала сделки
```

### Шаг 3: Проверить логи публикации

```bash
# Замените ORDER_ID на реальный ID заявки
ORDER_ID="YOUR-ORDER-ID"

kubectl logs -n canton-otc deployment/canton-otc --tail=200 | grep -iE "$ORDER_ID|sendPublicOrderNotification|Publishing order|Order published"
```

**Ожидаемые логи:**
```
🔍 sendPublicOrderNotification debug: {
  orderId: "XXX-XXX-XXX",
  clientGroupChatId: "-5039619304",
  finalChatId: "-5039619304",
  isClientGroup: true
}
📤 Publishing order to client group: {
  orderId: "XXX-XXX-XXX",
  chatId: "-5039619304"
}
✅ Order published to channel: {
  orderId: "XXX-XXX-XXX",
  messageId: 12345
}
```

---

## 🧪 ТЕСТИРОВАНИЕ КНОПКИ "ПРИНЯТЬ ЗАЯВКУ"

### Шаг 1: Нажать кнопку в группе клиентов

1. Откройте группу **"1OTC_ORDERS"** в Telegram
2. Найдите сообщение с заявкой
3. Нажмите кнопку **"✅ Принять заявку"**

### Шаг 2: Проверить логи обработки callback

```bash
# Замените ORDER_ID на реальный ID заявки
ORDER_ID="YOUR-ORDER-ID"

kubectl logs -n canton-otc deployment/canton-otc --tail=100 | grep -iE "accept|$ORDER_ID|callback"
```

**Ожидаемые логи:**
```
🔍 Processing accept_order callback: {
  orderId: "XXX-XXX-XXX",
  operatorId: 123456789,
  operatorUsername: "operator_username"
}
📋 Order found - Client Info: {
  orderId: "XXX-XXX-XXX",
  customerEmail: "test@example.com",
  status: "pending"
}
✅ Order accepted successfully: {
  orderId: "XXX-XXX-XXX",
  operatorId: 123456789,
  operatorUsername: "operator_username",
  status: "accepted"
}
```

### Шаг 3: Проверить обновление сообщения в группе

После принятия заявки сообщение в группе должно обновиться:

```
🔔 НОВАЯ ЗАЯВКА OTC

📊 Тип: 🛒 ПОКУПКА Canton Coin
💰 Оплата: $700.00 USDT
📊 Получение: 1591.00 Canton Coin

💵 Цена: $0.XXXX (рыночная)
📈 Комиссия: 3%
📋 ID заявки: XXX-XXX-XXX

✅ ЗАЯВКА ПРИНЯТА
👤 Оператор: @operator_username
💬 Связь: https://t.me/TECH_HY_Customer_Service_bot?start=order_XXX-XXX-XXX

⚡️ Обработка заявки начата
```

### Шаг 4: Проверить статус в базе данных (Supabase)

Если Supabase настроен, проверьте статус заявки:

```sql
SELECT 
  order_id,
  status,
  operator_username,
  accepted_at,
  chat_link
FROM public_orders 
WHERE order_id = 'YOUR-ORDER-ID';
```

**Ожидаемый результат:**
```
order_id          | status   | operator_username | accepted_at           | chat_link
------------------+---------+------------------+-----------------------+------------------------------------------
XXX-XXX-XXX       | accepted| operator_username | 2024-XX-XX XX:XX:XX   | https://t.me/...?start=order_XXX-XXX-XXX
```

---

## 🔧 ПРОВЕРКА SUPABASE

### Проверка наличия переменных

```bash
kubectl exec -n canton-otc deployment/canton-otc -- env | grep SUPABASE
```

**Должны быть:**
- `NEXT_PUBLIC_SUPABASE_URL` - URL вашего Supabase проекта
- `SUPABASE_SERVICE_ROLE_KEY` - Service Role Key (секретный ключ)

### Проверка таблицы public_orders

Если Supabase настроен, проверьте наличие таблицы:

```sql
-- Проверить структуру таблицы
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'public_orders'
ORDER BY ordinal_position;

-- Проверить наличие колонки is_private
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'public_orders' 
AND column_name = 'is_private';
```

**Если колонка `is_private` отсутствует**, примените миграцию:

```bash
# Применить миграцию через Supabase CLI или Dashboard
supabase migration up
```

Или вручную:

```sql
ALTER TABLE public_orders 
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_public_orders_is_private 
ON public_orders(is_private);
```

### Проверка RLS политик

```sql
-- Проверить RLS политики
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'public_orders';
```

**Должны быть политики:**
- `Public orders are viewable by everyone` (SELECT)
- `Only service role can insert` (INSERT)
- `Only service role can update` (UPDATE)

---

## 🐛 ДИАГНОСТИКА ПРОБЛЕМ

### Проблема: Заявка не публикуется в группу клиентов

**Проверьте:**

1. **ENV переменная TELEGRAM_CLIENT_GROUP_CHAT_ID:**
   ```bash
   kubectl exec -n canton-otc deployment/canton-otc -- env | grep TELEGRAM_CLIENT_GROUP_CHAT_ID
   ```
   
   Если отсутствует, добавьте в секреты:
   ```bash
   kubectl create secret generic canton-otc-secrets \
     --from-literal=TELEGRAM_CLIENT_GROUP_CHAT_ID="-5039619304" \
     -n canton-otc --dry-run=client -o yaml | kubectl apply -f -
   ```

2. **Логи sendPublicOrderNotification:**
   ```bash
   kubectl logs -n canton-otc deployment/canton-otc --tail=500 | grep "sendPublicOrderNotification debug"
   ```
   
   Проверьте значение `clientGroupChatId` и `finalChatId`.

3. **Права бота в группе:**
   - Бот должен быть администратором группы
   - Бот должен иметь право отправлять сообщения

### Проблема: Кнопка "Принять заявку" не работает

**Проверьте:**

1. **Логи callback query:**
   ```bash
   kubectl logs -n canton-otc deployment/canton-otc --tail=200 | grep -iE "callback|accept_order"
   ```

2. **Формат callback_data:**
   - Должен быть: `accept_order:ORDER_ID`
   - Проверьте в коде `telegram.ts` строка 399

3. **Supabase подключение:**
   ```bash
   kubectl logs -n canton-otc deployment/canton-otc --tail=200 | grep -iE "supabase|public_orders"
   ```
   
   Если ошибки подключения, проверьте переменные `NEXT_PUBLIC_SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY`.

### Проблема: Статус не обновляется в базе

**Проверьте:**

1. **Миграция применена:**
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'public_orders' 
   AND column_name IN ('status', 'operator_id', 'operator_username', 'accepted_at');
   ```

2. **RLS политики:**
   ```sql
   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'public_orders';
   ```
   
   Должна быть политика для UPDATE с `auth.role() = 'service_role'`.

3. **Логи обновления:**
   ```bash
   kubectl logs -n canton-otc deployment/canton-otc --tail=200 | grep -iE "update.*public_orders|Order accepted"
   ```

---

## 📊 ЧЕКЛИСТ ПРОВЕРКИ

- [ ] ENV переменные настроены в K8s
- [ ] TELEGRAM_CLIENT_GROUP_CHAT_ID установлена
- [ ] NEXT_PUBLIC_SUPABASE_URL установлена (если используется Supabase)
- [ ] SUPABASE_SERVICE_ROLE_KEY установлена (если используется Supabase)
- [ ] Таблица public_orders создана в Supabase
- [ ] Колонка is_private существует в public_orders
- [ ] RLS политики настроены правильно
- [ ] Webhook отвечает на запросы
- [ ] Создание заявки работает
- [ ] Заявка публикуется в группу клиентов
- [ ] Кнопка "Принять заявку" отображается
- [ ] Кнопка "Принять заявку" работает
- [ ] Статус обновляется в базе данных
- [ ] Сообщение обновляется после принятия заявки
- [ ] Оператор получает уведомление о принятии заявки

---

## 📞 ПОДДЕРЖКА

Если возникли проблемы:

1. Проверьте логи: `kubectl logs -n canton-otc deployment/canton-otc --tail=500`
2. Проверьте ENV переменные: `kubectl exec -n canton-otc deployment/canton-otc -- env | grep -E "TELEGRAM|SUPABASE"`
3. Проверьте статус подов: `kubectl get pods -n canton-otc`
4. Проверьте webhook: `curl -X POST "https://1otc.cc/api/telegram-mediator/webhook" -H "Content-Type: application/json" -d '{"message": {"text": "test"}}'`

---

## 📝 ФАЙЛЫ ДЛЯ ИЗУЧЕНИЯ

- `src/lib/services/telegram.ts` - метод `sendPublicOrderNotification()` (строка 346)
- `src/lib/services/telegramMediator.ts` - метод `handleCallbackQuery()` (строка 369)
- `src/app/api/telegram-mediator/webhook/route.ts` - обработка webhook
- `src/app/api/create-order/route.ts` - создание заявки (строка 393)
- `supabase/migrations/003_create_public_orders.sql` - схема таблицы
- `supabase/migrations/004_add_is_private.sql` - добавление колонки is_private
