# ⚡ БЫСТРЫЙ ГАЙД ПО ТЕСТИРОВАНИЮ СИСТЕМЫ ПРИНЯТИЯ ОРДЕРОВ

## 🚀 БЫСТРЫЙ СТАРТ

### 1. Автоматическая проверка (рекомендуется)

```bash
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc
./scripts/test-order-acceptance-system.sh
```

### 2. Ручное тестирование

#### Шаг 1: Создать тестовую заявку

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

**Сохраните `orderId` из ответа!**

#### Шаг 2: Проверить группу клиентов в Telegram

1. Откройте группу **"1OTC_ORDERS"** в Telegram
2. Найдите сообщение с заявкой (по orderId)
3. Должна быть кнопка **"✅ Принять заявку"**

#### Шаг 3: Нажать кнопку "Принять заявку"

1. Нажмите кнопку **"✅ Принять заявку"** в группе
2. Должно появиться уведомление: "✅ Заявка принята! Проверьте личные сообщения."

#### Шаг 4: Проверить логи

```bash
# Замените YOUR-ORDER-ID на реальный orderId
ORDER_ID="YOUR-ORDER-ID"

kubectl logs -n canton-otc deployment/canton-otc --tail=100 | grep -iE "accept|$ORDER_ID"
```

**Ожидаемые логи:**
- `🔍 Processing accept_order callback`
- `✅ Order accepted successfully`
- `📋 Order found - Client Info`

#### Шаг 5: Проверить статус в базе (если Supabase настроен)

```sql
SELECT order_id, status, operator_username, accepted_at 
FROM public_orders 
WHERE order_id = 'YOUR-ORDER-ID';
```

**Ожидаемый результат:** `status = 'accepted'`

---

## 🔍 БЫСТРАЯ ДИАГНОСТИКА

### Проверка ENV переменных

```bash
kubectl exec -n canton-otc deployment/canton-otc -- env | grep -E "TELEGRAM_CLIENT_GROUP_CHAT_ID|SUPABASE"
```

**Должны быть:**
- `TELEGRAM_CLIENT_GROUP_CHAT_ID=-5039619304`
- `NEXT_PUBLIC_SUPABASE_URL=...` (если используется)
- `SUPABASE_SERVICE_ROLE_KEY=...` (если используется)

### Проверка логов публикации

```bash
kubectl logs -n canton-otc deployment/canton-otc --tail=200 | grep -iE "sendPublicOrderNotification|Publishing order|client group"
```

**Ожидаемые логи:**
- `🔍 sendPublicOrderNotification debug`
- `📤 Publishing order to client group`
- `✅ Order published to channel`

### Проверка webhook

```bash
curl -X POST "https://1otc.cc/api/telegram-mediator/webhook" \
  -H "Content-Type: application/json" \
  -d '{"message": {"text": "test"}}' | jq .
```

**Ожидаемый ответ:** `{"success": true, ...}`

---

## ❌ ЧАСТЫЕ ПРОБЛЕМЫ

### Проблема: Заявка не появляется в группе клиентов

**Решение:**
1. Проверьте `TELEGRAM_CLIENT_GROUP_CHAT_ID` в секретах
2. Убедитесь, что бот - администратор группы
3. Проверьте логи: `kubectl logs -n canton-otc deployment/canton-otc --tail=500 | grep "sendPublicOrderNotification"`

### Проблема: Кнопка не работает

**Решение:**
1. Проверьте логи callback: `kubectl logs -n canton-otc deployment/canton-otc --tail=200 | grep "callback"`
2. Проверьте Supabase переменные
3. Убедитесь, что таблица `public_orders` существует

### Проблема: Статус не обновляется

**Решение:**
1. Проверьте миграцию `004_add_is_private.sql` применена
2. Проверьте RLS политики в Supabase
3. Проверьте логи обновления: `kubectl logs -n canton-otc deployment/canton-otc --tail=200 | grep "update.*public_orders"`

---

## 📚 ПОЛНАЯ ДОКУМЕНТАЦИЯ

См. `TESTING_ORDER_ACCEPTANCE_SYSTEM.md` для подробной документации.
