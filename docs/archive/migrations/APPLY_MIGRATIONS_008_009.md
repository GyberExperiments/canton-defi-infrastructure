# 📦 Применение миграций 008 и 009

**Дата**: 2026-01-03  
**Статус**: Готово к применению  
**Миграции**: 
- `008_add_is_market_price.sql` - Добавление поля `is_market_price`
- `009_add_market_price_discount.sql` - Добавление поля `market_price_discount_percent`

---

## 🚀 Быстрое применение

### Вариант 1: Автоматический скрипт (рекомендуется)

```bash
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc
./scripts/apply-migrations-008-009.sh
```

Скрипт автоматически:
- ✅ Проверяет что pod готов
- ✅ Получает пароль из секрета
- ✅ Применяет обе миграции
- ✅ Проверяет структуру таблицы

### Вариант 2: Ручное применение

```bash
# 1. Получить пароль из секрета
POSTGRES_PASSWORD=$(kubectl get secret postgres-secret -n supabase -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d)

# 2. Применить миграцию 008
kubectl cp supabase/migrations/008_add_is_market_price.sql \
  supabase/postgres-0:/tmp/migration_008.sql -n supabase

kubectl exec postgres-0 -n supabase -- bash -c \
  "PGPASSWORD='$POSTGRES_PASSWORD' psql -h localhost -U supabase -d supabase -f /tmp/migration_008.sql"

# 3. Применить миграцию 009
kubectl cp supabase/migrations/009_add_market_price_discount.sql \
  supabase/postgres-0:/tmp/migration_009.sql -n supabase

kubectl exec postgres-0 -n supabase -- bash -c \
  "PGPASSWORD='$POSTGRES_PASSWORD' psql -h localhost -U supabase -d supabase -f /tmp/migration_009.sql"
```

---

## 🔍 Проверка применения

### 1. Проверить что колонки созданы

```sql
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'public_orders' 
  AND column_name IN ('is_market_price', 'market_price_discount_percent')
ORDER BY column_name;
```

**Ожидаемый результат:**
```
column_name                  | data_type | column_default | is_nullable
----------------------------|-----------|----------------|-------------
is_market_price             | boolean   | false          | YES
market_price_discount_percent| numeric   | 0              | YES
```

### 2. Проверить индексы

```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'public_orders' 
  AND indexname LIKE '%market_price%' OR indexname LIKE '%discount%';
```

**Ожидаемые индексы:**
- `idx_public_orders_is_market_price`
- `idx_public_orders_discount`

### 3. Проверить комментарии к колонкам

```sql
SELECT 
    c.column_name,
    obj_description(c.oid, 'pg_class') as table_comment,
    col_description(c.oid, c.ordinal_position) as column_comment
FROM information_schema.columns c
JOIN pg_class ON pg_class.relname = c.table_name
WHERE c.table_name = 'public_orders' 
  AND c.column_name IN ('is_market_price', 'market_price_discount_percent');
```

---

## 🧪 Тестирование функциональности

### 1. Тест создания заявки с market price (без дисконта)

```bash
curl -X POST https://1otc.cc/api/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "cantonAddress": "04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "refundAddress": "bron::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "paymentAmount": 700,
    "paymentAmountUSD": 700,
    "cantonAmount": 4421,
    "email": "test@example.com",
    "exchangeDirection": "buy",
    "isMarketPrice": true,
    "marketPriceDiscountPercent": 0,
    "paymentToken": {
      "symbol": "USDT",
      "network": "TRON",
      "networkName": "TRON (TRC-20)"
    }
  }' | jq .
```

**Ожидаемый результат:** HTTP 200, заявка создана успешно

### 2. Тест создания заявки с market price и дисконтом 2%

```bash
curl -X POST https://1otc.cc/api/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "cantonAddress": "04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "refundAddress": "bron::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "paymentAmount": 700,
    "paymentAmountUSD": 700,
    "cantonAmount": 4510,
    "email": "test2@example.com",
    "exchangeDirection": "buy",
    "isMarketPrice": true,
    "marketPriceDiscountPercent": 2,
    "paymentToken": {
      "symbol": "USDT",
      "network": "TRON",
      "networkName": "TRON (TRC-20)"
    }
  }' | jq .
```

**Ожидаемый результат:** HTTP 200, заявка создана с ценой на 2% ниже рыночной

### 3. Проверить данные в БД

```sql
SELECT 
    order_id,
    exchange_direction,
    price,
    is_market_price,
    market_price_discount_percent,
    created_at
FROM public_orders
WHERE email IN ('test@example.com', 'test2@example.com')
ORDER BY created_at DESC
LIMIT 2;
```

**Ожидаемый результат:**
- Первая заявка: `is_market_price = true`, `market_price_discount_percent = 0`
- Вторая заявка: `is_market_price = true`, `market_price_discount_percent = 2.00`

---

## ⚠️ Откат миграций (если нужно)

```sql
-- Откат миграции 009
ALTER TABLE public_orders DROP COLUMN IF EXISTS market_price_discount_percent;
DROP INDEX IF EXISTS idx_public_orders_discount;

-- Откат миграции 008
ALTER TABLE public_orders DROP COLUMN IF EXISTS is_market_price;
DROP INDEX IF EXISTS idx_public_orders_is_market_price;
```

---

## 📝 Чеклист после применения

- [ ] Миграции применены без ошибок
- [ ] Колонки `is_market_price` и `market_price_discount_percent` существуют
- [ ] Индексы созданы
- [ ] Тест создания заявки с market price проходит
- [ ] Тест создания заявки с discount проходит
- [ ] Данные сохраняются в БД корректно
- [ ] Логи не показывают ошибок DATABASE_ERROR

---

**Автор**: AI Assistant  
**Дата**: 2026-01-03
