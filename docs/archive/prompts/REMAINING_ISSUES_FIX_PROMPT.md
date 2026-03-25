# 🔧 ПРОМПТ: Исправление оставшихся проблем Canton OTC Platform

**Дата**: 2026-01-03  
**Версия**: 1.0  
**Статус**: ⚠️ Требуется исправление  
**Контекст**: Production deployment после всех production-ready fixes

---

## 📋 КОНТЕКСТ

### ✅ Что уже сделано:
- ✅ Все 12/12 production-ready fixes задеплоены (образ `3a5250b2`)
- ✅ Рыночная цена работает (MarketPriceService получает из Binance: 0.15567)
- ✅ Dynamic pricing включен (USE_DYNAMIC_PRICING=true)
- ✅ Валидация цен проходит успешно
- ✅ Deployment работает (3/3 pods Running)

### ⚠️ Оставшиеся проблемы:

---

## 🐛 ПРОБЛЕМА #1: DATABASE_ERROR при создании заявок

### Симптомы:
```json
POST /api/create-order → 500
{
  "error": "Failed to create order. Please try again.",
  "code": "DATABASE_ERROR"
}
```

### Контекст:
- Валидация цены проходит успешно ✅
- Ошибка возникает при сохранении в Supabase ❌
- Функция `saveOrderToSupabaseSync()` в `src/app/api/create-order/route.ts:886-989`

### Возможные причины:
1. **Миграции не применены** - таблица `public_orders` может не иметь нужных колонок
2. **Supabase недоступен** - проблемы с подключением
3. **RLS policies блокируют** - нужны миграции 006 и 007
4. **Env переменные не настроены** - NEXT_PUBLIC_SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY

### Файлы для проверки:
- `src/app/api/create-order/route.ts` (строки 461-563, функция `saveOrderToSupabaseSync`)
- `supabase/migrations/006_fix_private_orders_rls.sql`
- `supabase/migrations/007_atomic_order_matching.sql`
- `supabase/migrations/008_add_is_market_price.sql` ✅ **НОВАЯ МИГРАЦИЯ**

### Диагностика:

```bash
# 1. Проверить env переменные в deployment
kubectl get deployment canton-otc -n canton-otc -o jsonpath='{.spec.template.spec.containers[0].env}' | jq '.[] | select(.name | contains("SUPABASE"))'

# 2. Проверить логи ошибок
kubectl logs -n canton-otc deployment/canton-otc --tail=100 | grep -E "Supabase|DATABASE|Failed to save"

# 3. Проверить подключение к Supabase
kubectl exec -n canton-otc deployment/canton-otc -- env | grep SUPABASE

# 4. Проверить существование таблицы public_orders
# (нужно подключиться к Supabase и выполнить)
```

### Решение:

#### ✅ ИСПРАВЛЕНО: Добавлена миграция 008 для поля is_market_price

**Проблема**: Код пытался вставить поле `is_market_price`, которого не было в таблице.

**Решение**: 
1. ✅ Создана миграция `008_add_is_market_price.sql`
2. ✅ Улучшена обработка ошибок с детальным логированием
3. ✅ Добавлена функция тестирования подключения к Supabase

#### Шаг 1: Применить миграцию 008

```bash
# Применить миграцию 008 (is_market_price column)
# Вариант 1: Через kubectl (если Supabase в Kubernetes)
kubectl cp supabase/migrations/008_add_is_market_price.sql \
  supabase/postgres-0:/tmp/migration_008.sql -n supabase

kubectl exec postgres-0 -n supabase -- bash -c \
  "PGPASSWORD='your-password' psql -h localhost -U supabase -d supabase -f /tmp/migration_008.sql"

# Вариант 2: Через Supabase CLI (рекомендуется)
supabase db push

# Вариант 3: Через Supabase Dashboard SQL Editor
# Скопировать содержимое supabase/migrations/008_add_is_market_price.sql и выполнить
```

#### Шаг 2: Проверить и применить остальные миграции (если не применены)

```bash
# Проверить какие миграции уже применены
# (нужен доступ к Supabase PostgreSQL)

# Применить миграцию 006 (RLS для приватных заявок)
kubectl cp supabase/migrations/006_fix_private_orders_rls.sql \
  supabase/postgres-0:/tmp/migration_006.sql -n supabase

kubectl exec postgres-0 -n supabase -- bash -c \
  "PGPASSWORD='your-password' psql -h localhost -U supabase -d supabase -f /tmp/migration_006.sql"

# Применить миграцию 007 (Atomic order matching)
kubectl cp supabase/migrations/007_atomic_order_matching.sql \
  supabase/postgres-0:/tmp/migration_007.sql -n supabase

kubectl exec postgres-0 -n supabase -- bash -c \
  "PGPASSWORD='your-password' psql -h localhost -U supabase -d supabase -f /tmp/migration_007.sql"
```

#### Шаг 2: Проверить структуру таблицы

```sql
-- Проверить что все колонки существуют
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'public_orders' 
  AND column_name IN (
    'order_id', 'exchange_direction', 'payment_amount_usd', 
    'canton_amount', 'price', 'status', 'is_private', 'is_market_price',
    'matched_order_id', 'matched_at'
  )
ORDER BY column_name;

-- Проверить что RLS включен
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'public_orders';

-- Проверить что миграция 008 применена (is_market_price существует)
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns 
  WHERE table_name = 'public_orders' 
    AND column_name = 'is_market_price'
) AS has_is_market_price;
```

#### Шаг 3: Проверить env переменные

```bash
# Проверить что секреты существуют
kubectl get secret canton-otc-secrets -n canton-otc

# Проверить значения (заменить на реальные имена ключей)
kubectl get secret canton-otc-secrets -n canton-otc -o jsonpath='{.data}' | jq 'keys'

# Если секретов нет - создать:
kubectl create secret generic canton-otc-secrets \
  --from-literal=NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co" \
  --from-literal=SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" \
  --from-literal=NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key" \
  -n canton-otc
```

#### Шаг 4: Проверить подключение

```typescript
// Тест подключения к Supabase
// Добавить в src/app/api/create-order/route.ts перед saveOrderToSupabaseSync

async function testSupabaseConnection(): Promise<boolean> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Supabase env variables not set');
      return false;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Простой тест запрос
    const { data, error } = await supabase
      .from('public_orders')
      .select('order_id')
      .limit(1);
    
    if (error) {
      console.error('❌ Supabase connection test failed:', error);
      return false;
    }
    
    console.log('✅ Supabase connection successful');
    return true;
  } catch (error) {
    console.error('❌ Supabase connection error:', error);
    return false;
  }
}
```

---

## 🐛 ПРОБЛЕМА #2: Несоответствие цен (уже исправлено, но проверить)

### Статус: ✅ Исправлено
- MarketPriceService работает
- Dynamic pricing включен
- Цены актуальные (0.15567 из Binance)

### Но проверить:
- Правильно ли работает fallback при недоступности API
- Обновляется ли цена автоматически

---

## 📝 ЧЕКЛИСТ ИСПРАВЛЕНИЯ

### 1. Диагностика
- [ ] Проверить логи ошибок Supabase
- [ ] Проверить env переменные в deployment
- [ ] Проверить подключение к Supabase
- [ ] Проверить структуру таблицы public_orders

### 2. Миграции
- [ ] Проверить какие миграции применены
- [ ] Применить миграцию 006 (RLS для приватных заявок)
- [ ] Применить миграцию 007 (Atomic order matching)
- [ ] **Применить миграцию 008 (is_market_price column)** ✅ **КРИТИЧНО**
- [ ] Проверить что колонки созданы (is_private, is_market_price, matched_order_id, matched_at)

### 3. Конфигурация
- [ ] Проверить что секреты Supabase существуют
- [ ] Проверить что env переменные правильные
- [ ] Проверить RLS policies

### 4. Тестирование
- [ ] Протестировать создание заявки (buy)
- [ ] Протестировать создание заявки (sell)
- [ ] Проверить что заявка сохраняется в Supabase
- [ ] Проверить логи на ошибки

---

## 🔍 ДЕТАЛЬНАЯ ДИАГНОСТИКА

### Команды для диагностики:

```bash
# 1. Проверить логи последних ошибок
kubectl logs -n canton-otc deployment/canton-otc --tail=200 | \
  grep -E "Supabase|DATABASE|Failed to save|insert failed" -A 5

# 2. Проверить env переменные
kubectl exec -n canton-otc deployment/canton-otc -- env | \
  grep SUPABASE

# 3. Проверить структуру deployment
kubectl describe deployment canton-otc -n canton-otc | \
  grep -A 10 "Environment:"

# 4. Проверить секреты
kubectl get secret canton-otc-secrets -n canton-otc -o yaml

# 5. Тест API с детальным логированием
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
    "paymentToken": {
      "symbol": "USDT",
      "network": "TRON",
      "networkName": "TRON (TRC-20)"
    }
  }' -v
```

---

## 🎯 ОЖИДАЕМЫЙ РЕЗУЛЬТАТ

После исправления:
1. ✅ Заявки успешно создаются (HTTP 200)
2. ✅ Заявки сохраняются в Supabase
3. ✅ Нет ошибок DATABASE_ERROR в логах
4. ✅ Миграции 006 и 007 применены
5. ✅ RLS policies работают корректно

---

## 📚 ССЫЛКИ НА ФАЙЛЫ

- **Код сохранения**: `src/app/api/create-order/route.ts` (строки 461-563)
- **Миграция 006**: `supabase/migrations/006_fix_private_orders_rls.sql`
- **Миграция 007**: `supabase/migrations/007_atomic_order_matching.sql`
- **Миграция 008**: `supabase/migrations/008_add_is_market_price.sql` ✅ **НОВАЯ**
- **Config Manager**: `src/lib/config-manager.ts` (строки 201-280)
- **Market Price Service**: `src/lib/services/marketPriceService.ts`

## ✅ ВЫПОЛНЕННЫЕ ИСПРАВЛЕНИЯ

1. ✅ **Создана миграция 008** для добавления поля `is_market_price` в таблицу `public_orders`
2. ✅ **Улучшена обработка ошибок** в `saveOrderToSupabaseSync()`:
   - Детальное логирование с кодом ошибки, hint, details
   - Специальная обработка для schema errors и permission errors
   - Логирование конфигурации Supabase
3. ✅ **Добавлена функция тестирования подключения** `testSupabaseConnection()`:
   - Проверка env переменных
   - Тестовый запрос к таблице для проверки прав доступа
   - Детальные сообщения об ошибках

---

## 🚀 БЫСТРЫЙ СТАРТ

```bash
# 1. Перейти в проект
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc

# 2. Проверить логи ошибок
kubectl logs -n canton-otc deployment/canton-otc --tail=100 | \
  grep -E "Supabase|DATABASE|Failed" -A 3

# 3. Проверить env переменные
kubectl exec -n canton-otc deployment/canton-otc -- env | grep SUPABASE

# 4. Применить миграции (если не применены)
# (см. инструкции выше)

# 5. Протестировать создание заявки
curl -X POST https://1otc.cc/api/create-order \
  -H "Content-Type: application/json" \
  -d '{...}' | jq .
```

---

**Автор**: AI Assistant  
**Дата**: 2026-01-03  
**Версия**: 1.0
