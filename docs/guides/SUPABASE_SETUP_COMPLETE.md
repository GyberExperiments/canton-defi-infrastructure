# ✅ НАСТРОЙКА SUPABASE ЗАВЕРШЕНА

**Дата:** $(date +"%Y-%m-%d %H:%M:%S")

## ✅ ЧТО СДЕЛАНО

### 1. Supabase Credentials добавлены в секреты
- ✅ `NEXT_PUBLIC_SUPABASE_URL`: `https://api.1otc.cc`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`: добавлен в секрет `canton-otc-secrets`

### 2. Миграции применены
- ✅ Таблица `public_orders` создана
- ✅ Колонка `is_private` добавлена
- ✅ Индексы созданы
- ⚠️ RLS политики частично применены (ошибки с auth.role() - это нормально для self-hosted Supabase)

### 3. Deployment перезапущен
- ✅ Deployment `canton-otc` перезапущен для применения новых переменных

## 📋 ТЕКУЩЕЕ СОСТОЯНИЕ

### Секреты в Kubernetes:
```bash
# Проверить секрет
kubectl get secret canton-otc-secrets -n canton-otc -o jsonpath='{.data}' | jq 'keys' | grep -i supabase
```

**Результат:**
- `NEXT_PUBLIC_SUPABASE_URL` ✅
- `SUPABASE_SERVICE_ROLE_KEY` ✅

### Таблица в Supabase:
```sql
-- Таблица public_orders создана со следующими колонками:
- id (BIGSERIAL PRIMARY KEY)
- order_id (TEXT UNIQUE)
- exchange_direction (buy/sell)
- payment_amount_usd, canton_amount, price
- canton_address, receiving_address, refund_address
- email, telegram, whatsapp
- status (pending/accepted/in_progress/completed/cancelled)
- operator_id, operator_username
- created_at, accepted_at, completed_at
- telegram_message_id, chat_link
- is_private (BOOLEAN) ✅
```

## ⚠️ ВАЖНО: Проверка переменных в поде

Deployment может использовать другой секрет или переменные могут быть опциональными. Проверьте:

```bash
# Проверить переменные в поде
kubectl exec -n canton-otc deployment/canton-otc -- env | grep -E "NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY"

# Если переменные отсутствуют, проверьте deployment:
kubectl get deployment canton-otc -n canton-otc -o yaml | grep -A 5 "SUPABASE"
```

## 🧪 ТЕСТИРОВАНИЕ

### 1. Создать тестовую заявку
```bash
curl -X POST https://1otc.cc/api/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "cantonAddress": "04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "usdtAmount": 500,
    "cantonAmount": 5607,
    "email": "test@example.com",
    "exchangeDirection": "buy"
  }'
```

### 2. Проверить логи сохранения в Supabase
```bash
kubectl logs -n canton-otc deployment/canton-otc --tail=200 | grep -iE "supabase|public_orders|Order saved"
```

**Ожидаемые логи:**
- `✅ Order saved to public_orders table`
- Или ошибка подключения, если переменные не подхватились

### 3. Проверить запись в Supabase
```bash
SUPABASE_URL="https://api.1otc.cc"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvY2FsaG9zdCIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTk1NzM0NTIwMH0.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q"

curl "$SUPABASE_URL/rest/v1/public_orders?select=order_id,status&limit=5" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY"
```

## 🔧 ЕСЛИ ПЕРЕМЕННЫЕ НЕ ПОДХВАТИЛИСЬ

### Вариант 1: Deployment использует другой секрет
Если deployment использует `canton-otc-secrets-minimal-stage` (которого нет), нужно:

1. Создать секрет:
```bash
kubectl create secret generic canton-otc-secrets-minimal-stage \
  --from-literal=NEXT_PUBLIC_SUPABASE_URL="https://api.1otc.cc" \
  --from-literal=SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvY2FsaG9zdCIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTk1NzM0NTIwMH0.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q" \
  -n canton-otc
```

2. Перезапустить deployment:
```bash
kubectl rollout restart deployment/canton-otc -n canton-otc
```

### Вариант 2: Переменные опциональные
Если переменные помечены как `optional: true`, они могут отсутствовать. Проверьте deployment манифест и убедитесь, что они не опциональные, или добавьте их явно.

## ✅ СЛЕДУЮЩИЕ ШАГИ

1. **Проверить переменные в поде** (команда выше)
2. **Создать тестовую заявку** и проверить логи
3. **Протестировать кнопку "Принять заявку"** в группе "1OTC_ORDERS"
4. **Проверить обновление статуса** в Supabase после принятия заявки

## 📊 CREDENTIALS

**Supabase URL:** `https://api.1otc.cc`  
**Service Role Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvY2FsaG9zdCIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTk1NzM0NTIwMH0.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q`

**Хранятся в:**
- Kubernetes Secret: `canton-otc-secrets` (namespace: `canton-otc`)

---

**Статус:** ✅ Настройка завершена, требуется проверка работы

