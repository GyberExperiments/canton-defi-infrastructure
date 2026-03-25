# 🚀 Деплой и тестирование новой версии

**Коммит**: `d0887efc`  
**Изменения**: Market price discount feature + исправления типов

---

## 📦 Шаг 1: Проверка сборки

```bash
# Проверить что образ собрался
COMMIT_HASH=$(git rev-parse --short HEAD)
docker images | grep "cantonotc.*$COMMIT_HASH"

# Если образа нет, подождать или проверить логи
tail -50 /tmp/docker-build.log
```

---

## 🚀 Шаг 2: Деплой

```bash
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc

COMMIT_HASH=$(git rev-parse --short HEAD)

# Push в registry
docker push ghcr.io/themacroeconomicdao/cantonotc:$COMMIT_HASH

# Deploy в Kubernetes
kubectl set image deployment/canton-otc \
  canton-otc=ghcr.io/themacroeconomicdao/cantonotc:$COMMIT_HASH \
  -n canton-otc

# Дождаться rollout
kubectl rollout status deployment/canton-otc -n canton-otc --timeout=180s

# Проверить статус
kubectl get pods -n canton-otc -l app=canton-otc
```

---

## 🧪 Шаг 3: Тестирование флоу

### Вариант 1: Быстрый тест (автоматический)

```bash
./scripts/quick-test-order.sh
```

### Вариант 2: Полный тест с интерактивным мониторингом

```bash
./scripts/test-full-flow-with-logs.sh
```

### Вариант 3: Ручной тест через curl

```bash
# Создать заявку
curl -X POST https://1otc.cc/api/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "cantonAddress": "04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "refundAddress": "bron::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "paymentAmount": 100,
    "paymentAmountUSD": 100,
    "cantonAmount": 663,
    "email": "test-'$(date +%s)'@example.com",
    "exchangeDirection": "buy",
    "isMarketPrice": true,
    "marketPriceDiscountPercent": 2,
    "paymentToken": {
      "symbol": "USDT",
      "network": "TRON",
      "networkName": "TRON (TRC-20)"
    }
  }' | jq .

# Мониторинг логов в отдельном терминале
kubectl logs -n canton-otc deployment/canton-otc -f | grep -E "Order|Telegram|Supabase|Error"
```

---

## 📊 Шаг 4: Мониторинг логов

В отдельном терминале:

```bash
# Следить за всеми логами
kubectl logs -n canton-otc deployment/canton-otc -f

# Или фильтровать важные события
kubectl logs -n canton-otc deployment/canton-otc -f | \
  grep -E "Order saved|Telegram|Supabase|Error|Failed|accepted"
```

---

## ✅ Чеклист тестирования

После создания заявки через curl:

1. ✅ **Проверить ответ API** - должен быть `success: true` и `orderId`
2. ✅ **Проверить Telegram клиентскую группу** - должно быть уведомление о новой заявке
3. ✅ **Проверить Telegram админскую группу** - должно быть уведомление о новой заявке
4. ✅ **Нажать "принять ордер" в клиентской группе** - проверить что статус обновился
5. ✅ **Нажать "принять ордер" в админской группе** - проверить что статус обновился
6. ✅ **Проверить логи** - не должно быть ошибок DATABASE_ERROR, Supabase должен сохранить
7. ✅ **Проверить БД** - заявка должна быть в `public_orders` с правильными полями

---

## 🔍 Проверка данных в БД

```bash
# Получить пароль
POSTGRES_PASSWORD=$(kubectl get secret postgres-secret -n supabase -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d)

# Проверить последние заявки
kubectl exec -n supabase postgres-0 -- bash -c \
  "PGPASSWORD='$POSTGRES_PASSWORD' psql -U supabase -d supabase -c \"
    SELECT 
      order_id,
      exchange_direction,
      is_market_price,
      market_price_discount_percent,
      status,
      created_at
    FROM public_orders
    ORDER BY created_at DESC
    LIMIT 5;
  \""
```

---

## 🐛 Если что-то пошло не так

### Проблема: Образ не собрался

```bash
# Проверить логи сборки
tail -100 /tmp/docker-build.log

# Пересобрать
COMMIT_HASH=$(git rev-parse --short HEAD)
docker build -t ghcr.io/themacroeconomicdao/cantonotc:$COMMIT_HASH -f Dockerfile .
```

### Проблема: Ошибка DATABASE_ERROR

```bash
# Проверить логи
kubectl logs -n canton-otc deployment/canton-otc --tail=100 | grep -E "Supabase|DATABASE|Failed"

# Проверить миграции
kubectl exec -n supabase postgres-0 -- bash -c \
  "PGPASSWORD='\$(kubectl get secret postgres-secret -n supabase -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d)' psql -U supabase -d supabase -c \"
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'public_orders' 
      AND column_name IN ('is_market_price', 'market_price_discount_percent');
  \""
```

### Проблема: Telegram уведомления не приходят

```bash
# Проверить логи Telegram
kubectl logs -n canton-otc deployment/canton-otc --tail=100 | grep -E "Telegram|notification"

# Проверить env переменные
kubectl exec -n canton-otc deployment/canton-otc -- env | grep TELEGRAM
```

---

**Готово к тестированию!** 🎉
