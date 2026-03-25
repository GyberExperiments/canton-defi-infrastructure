# ⚡ БЫСТРЫЙ ПРОМПТ: Исправление DATABASE_ERROR

**Контекст**: После деплоя production-ready fixes (образ `3a5250b2`) возникла ошибка `DATABASE_ERROR` при создании заявок.

## 🐛 ПРОБЛЕМА

```
POST /api/create-order → 500
{
  "error": "Failed to create order. Please try again.",
  "code": "DATABASE_ERROR"
}
```

Валидация цены проходит ✅, но сохранение в Supabase падает ❌.

## 🔍 ДИАГНОСТИКА

```bash
# 1. Логи ошибок
kubectl logs -n canton-otc deployment/canton-otc --tail=100 | \
  grep -E "Supabase|DATABASE|Failed to save" -A 5

# 2. Env переменные
kubectl exec -n canton-otc deployment/canton-otc -- env | grep SUPABASE

# 3. Секреты
kubectl get secret canton-otc-secrets -n canton-otc
```

## ✅ РЕШЕНИЕ

### Шаг 1: Применить миграции

```bash
# Миграция 006: RLS для приватных заявок
kubectl cp supabase/migrations/006_fix_private_orders_rls.sql \
  supabase/postgres-0:/tmp/migration_006.sql -n supabase

kubectl exec postgres-0 -n supabase -- bash -c \
  "PGPASSWORD='password' psql -U supabase -d supabase -f /tmp/migration_006.sql"

# Миграция 007: Atomic order matching
kubectl cp supabase/migrations/007_atomic_order_matching.sql \
  supabase/postgres-0:/tmp/migration_007.sql -n supabase

kubectl exec postgres-0 -n supabase -- bash -c \
  "PGPASSWORD='password' psql -U supabase -d supabase -f /tmp/migration_007.sql"
```

### Шаг 2: Проверить структуру таблицы

```sql
-- В Supabase SQL Editor или через psql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'public_orders' 
  AND column_name IN (
    'order_id', 'exchange_direction', 'payment_amount_usd', 
    'canton_amount', 'price', 'status', 'is_private',
    'matched_order_id', 'matched_at'
  );
```

### Шаг 3: Проверить/создать секреты

```bash
# Если секретов нет:
kubectl create secret generic canton-otc-secrets \
  --from-literal=NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co" \
  --from-literal=SUPABASE_SERVICE_ROLE_KEY="eyJ..." \
  --from-literal=NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..." \
  -n canton-otc
```

### Шаг 4: Перезапустить deployment

```bash
kubectl rollout restart deployment/canton-otc -n canton-otc
kubectl rollout status deployment/canton-otc -n canton-otc
```

## 🧪 ТЕСТ

```bash
curl -X POST https://1otc.cc/api/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "cantonAddress": "04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "paymentAmount": 700,
    "paymentAmountUSD": 700,
    "cantonAmount": 4421,
    "email": "test@example.com",
    "exchangeDirection": "buy",
    "paymentToken": {"symbol": "USDT", "network": "TRON"}
  }' | jq .
```

**Ожидаемый результат**: `{"success": true, "orderId": "..."}`

## 📁 ФАЙЛЫ

- `src/app/api/create-order/route.ts` (строки 886-989)
- `supabase/migrations/006_fix_private_orders_rls.sql`
- `supabase/migrations/007_atomic_order_matching.sql`
