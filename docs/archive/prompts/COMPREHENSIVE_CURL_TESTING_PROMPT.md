# 🧪 Comprehensive API Testing Prompt via cURL

**Цель**: Полное тестирование всего функционала Canton OTC через cURL команды

**Production URL**: https://1otc.cc  
**Namespace**: canton-otc  
**Last Updated**: 2025-01-27

**⚠️ ВАЖНО**: Перед запуском тестов проверьте конфигурацию production:
- **Минимальная сумма**: Настраивается через админку (`/admin/settings` → Limits → Min Amount)
  - Проверить: `curl -s https://1otc.cc/api/admin/settings | jq '.minAmount'`
  - Или через ConfigMap: `kubectl get configmap canton-otc-config -n canton-otc -o jsonpath='{.data.MIN_USDT_AMOUNT}'`
- Некоторые тесты могут потребовать корректировки значений в зависимости от настроек production

---

## 📋 ПРЕДВАРИТЕЛЬНАЯ ПРОВЕРКА

```bash
# 1. Проверка доступности API
curl -I https://1otc.cc

# Ожидаемый результат: HTTP/2 200

# 2. Проверка статуса подов в Kubernetes
kubectl get pods -n canton-otc -l app=canton-otc

# Ожидаемый результат: минимум 2/2 Running

# 3. Проверка текущего образа
kubectl get deployment canton-otc -n canton-otc -o jsonpath='{.spec.template.spec.containers[0].image}'

# Ожидаемый результат: ghcr.io/themacroeconomicdao/cantonotc:6df7492e (или последний)

# 4. Проверка минимальной суммы (ВАЖНО для теста 7)
# Минимальная сумма настраивается через админку: https://1otc.cc/admin/settings
# Проверить текущее значение можно через API или ConfigMap:
MIN_AMOUNT=$(curl -s https://1otc.cc/api/admin/settings | jq -r '.minAmount // empty' 2>/dev/null || \
  kubectl get configmap canton-otc-config -n canton-otc -o jsonpath='{.data.MIN_USDT_AMOUNT}')
echo "Минимальная сумма: \$${MIN_AMOUNT:-1} USDT"
echo "Настроить через админку: https://1otc.cc/admin/settings (раздел Limits -> Min Amount)"
# Если значение отличается от ожидаемого в тестах, обновите тест 7 соответственно
```

---

## 🧪 ТЕСТ 1: Создание заявки BUY с рыночной ценой (isMarketPrice)

**Цель**: Проверить что флаг isMarketPrice работает корректно

```bash
curl -X POST https://1otc.cc/api/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "cantonAddress": "04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "refundAddress": "bron::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "usdtAmount": 1000,
    "cantonAmount": 12000,
    "email": "test-market-price-'$(date +%s)'@example.com",
    "exchangeDirection": "buy",
    "isMarketPrice": true
  }' \
  -s | jq '{
    success,
    orderId,
    isMarketPrice,
    isPrivateDeal,
    validation: .validation.cantonAddress
  }'

# Ожидаемый результат:
# {
#   "success": true,
#   "orderId": "XXXXX-XXXXX",
#   "isMarketPrice": true,
#   "isPrivateDeal": false,
#   "validation": {
#     "cantonAddress": "Canton Network HEX::HEX format (participant_id::party_hint) - MOST COMMON",
#     "addressValid": true
#   }
# }
```

**Проверка в логах**:
```bash
kubectl logs -n canton-otc deployment/canton-otc --tail=100 | grep -i "isMarketPrice\|market price" | tail -5
```

---

## 🧪 ТЕСТ 2: Создание заявки BUY с ручной ценой (без isMarketPrice)

**Цель**: Проверить что ручная цена работает

```bash
curl -X POST https://1otc.cc/api/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "cantonAddress": "04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "refundAddress": "bron::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "usdtAmount": 1000,
    "cantonAmount": 12000,
    "email": "test-manual-price-'$(date +%s)'@example.com",
    "exchangeDirection": "buy",
    "manualPrice": 0.082,
    "isMarketPrice": false
  }' \
  -s | jq '{
    success,
    orderId,
    isMarketPrice,
    validation: .validation.cantonAddress
  }'

# Ожидаемый результат:
# {
#   "success": true,
#   "orderId": "XXXXX-XXXXX",
#   "isMarketPrice": false
# }
```

---

## 🧪 ТЕСТ 3: Создание приватной заявки (isPrivateDeal)

**Цель**: Проверить что приватные заявки не публикуются в Telegram

```bash
curl -X POST https://1otc.cc/api/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "cantonAddress": "04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "refundAddress": "bron::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "usdtAmount": 1000,
    "cantonAmount": 12000,
    "email": "test-private-'$(date +%s)'@example.com",
    "exchangeDirection": "buy",
    "isPrivateDeal": true,
    "isMarketPrice": true
  }' \
  -s | jq '{
    success,
    orderId,
    isPrivateDeal,
    isMarketPrice
  }'

# Ожидаемый результат:
# {
#   "success": true,
#   "orderId": "XXXXX-XXXXX",
#   "isPrivateDeal": true,
#   "isMarketPrice": true
# }
```

**Проверка в логах** (должно быть "Skipped (private deal)"):
```bash
kubectl logs -n canton-otc deployment/canton-otc --tail=100 | grep -i "private deal\|isPrivateDeal" | tail -3
```

---

## 🧪 ТЕСТ 4: Создание заявки SELL

**Цель**: Проверить направление продажи

```bash
curl -X POST https://1otc.cc/api/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "cantonAddress": "04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "refundAddress": "bron::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "receivingAddress": "TXYZabcdefghijklmnopqrstuvwxyz123456",
    "cantonAmount": 10000,
    "paymentAmount": 1200,
    "paymentAmountUSD": 1200,
    "usdtAmount": 1200,
    "email": "test-sell-'$(date +%s)'@example.com",
    "exchangeDirection": "sell",
    "isMarketPrice": true
  }' \
  -s | jq '{
    success,
    orderId,
    exchangeDirection: "sell",
    isMarketPrice
  }'

# Ожидаемый результат:
# {
#   "success": true,
#   "orderId": "XXXXX-XXXXX",
#   "exchangeDirection": "sell",
#   "isMarketPrice": true
# }
```

---

## 🧪 ТЕСТ 5: Валидация Canton адреса (HEX::HEX формат)

**Цель**: Проверить что валидация адресов работает

```bash
curl -X POST https://1otc.cc/api/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "cantonAddress": "04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "refundAddress": "bron::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "usdtAmount": 1000,
    "cantonAmount": 12000,
    "email": "test-validation-'$(date +%s)'@example.com",
    "exchangeDirection": "buy"
  }' \
  -s | jq '.validation'

# Ожидаемый результат:
# {
#   "cantonAddress": "Canton Network HEX::HEX format (participant_id::party_hint) - MOST COMMON",
#   "addressValid": true
# }
```

---

## 🧪 ТЕСТ 6: Проверка Rate Limiting

**Цель**: Проверить защиту от спама

```bash
# Отправляем 10 запросов подряд
for i in {1..10}; do
  echo "Request $i:"
  curl -X POST https://1otc.cc/api/create-order \
    -H "Content-Type: application/json" \
    -d "{
      \"cantonAddress\": \"04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8\",
      \"refundAddress\": \"bron::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8\",
      \"usdtAmount\": 1000,
      \"cantonAmount\": 12000,
      \"email\": \"test-ratelimit-$i-'$(date +%s)'@example.com\",
      \"exchangeDirection\": \"buy\"
    }" \
    -s -w "\nHTTP: %{http_code}\n" | jq -r '.success // .error // .code' | head -1
  sleep 0.5
done

# Ожидаемый результат:
# Первые несколько запросов: success: true
# После лимита: RATE_LIMIT_EXCEEDED или HTTP 429
```

---

## 🧪 ТЕСТ 7: Проверка минимальной суммы

**Цель**: Проверить валидацию минимальной суммы

```bash
curl -X POST https://1otc.cc/api/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "cantonAddress": "04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "refundAddress": "bron::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "usdtAmount": 0.5,
    "cantonAmount": 5,
    "email": "test-min-amount-'$(date +%s)'@example.com",
    "exchangeDirection": "buy"
  }' \
  -s | jq '{error, code}'

# Ожидаемый результат:
# {
#   "error": "Minimum order amount is $<MIN_AMOUNT>",
#   "code": "VALIDATION_ERROR"
# }
# 
# ПРИМЕЧАНИЕ: Минимальная сумма настраивается через админку: https://1otc.cc/admin/settings
# Админка обновляет ConfigMap (MIN_USDT_AMOUNT) и изменения применяются мгновенно.
# По умолчанию: $1, но в production может быть установлено другое значение (например, $700).
# 
# Проверить текущее значение:
# 1. Через админку: https://1otc.cc/admin/settings (раздел Limits -> Min Amount)
# 2. Через API: curl -s https://1otc.cc/api/admin/settings | jq '.minAmount'
# 3. Через ConfigMap: kubectl get configmap canton-otc-config -n canton-otc -o jsonpath='{.data.MIN_USDT_AMOUNT}'
# 
# Если минимальная сумма в production отличается, используйте значение меньше минимального для этого теста.
```

---

## 🧪 ТЕСТ 8: Проверка валидации email

**Цель**: Проверить валидацию email адреса

```bash
curl -X POST https://1otc.cc/api/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "cantonAddress": "04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "refundAddress": "bron::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "usdtAmount": 1000,
    "cantonAmount": 12000,
    "email": "invalid-email",
    "exchangeDirection": "buy"
  }' \
  -s | jq '{error, code}'

# Ожидаемый результат:
# {
#   "error": "Invalid email address",
#   "code": "VALIDATION_ERROR"
# }
```

---

## 🧪 ТЕСТ 9: Проверка Telegram публикации (публичная заявка)

**Цель**: Проверить что публичные заявки публикуются в Telegram

```bash
ORDER_RESPONSE=$(curl -X POST https://1otc.cc/api/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "cantonAddress": "04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "refundAddress": "bron::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "usdtAmount": 1000,
    "cantonAmount": 12000,
    "email": "test-telegram-public-'$(date +%s)'@example.com",
    "exchangeDirection": "buy",
    "isPrivateDeal": false,
    "isMarketPrice": true
  }' -s)

ORDER_ID=$(echo $ORDER_RESPONSE | jq -r '.orderId')

echo "Order ID: $ORDER_ID"
echo "Response:"
echo $ORDER_RESPONSE | jq '{success, orderId, isPrivateDeal, isMarketPrice}'

# Проверка в логах что заявка опубликована
sleep 3
kubectl logs -n canton-otc deployment/canton-otc --tail=100 | grep -i "sendPublicOrderNotification\|Order published\|NEW OTC ORDER" | tail -3
```

---

## 🧪 ТЕСТ 10: Проверка формата Telegram сообщения (английский язык)

**Цель**: Проверить что Telegram сообщения на английском

```bash
# Создаем заявку и проверяем логи
curl -X POST https://1otc.cc/api/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "cantonAddress": "04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "refundAddress": "bron::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "usdtAmount": 1000,
    "cantonAmount": 12000,
    "email": "test-english-format-'$(date +%s)'@example.com",
    "exchangeDirection": "buy",
    "isMarketPrice": true
  }' -s > /dev/null

# Проверяем логи (должны быть английские ключевые слова)
sleep 3
kubectl logs -n canton-otc deployment/canton-otc --tail=200 | grep -E "NEW OTC ORDER|Price CC|Order ID|Created|BUY|SELL|market" | head -5

# Ожидаемый результат: английские слова в логах
```

---

## 🧪 ТЕСТ 11: Проверка условного отображения "(market)"

**Цель**: Проверить что "(market)" показывается только при isMarketPrice=true

```bash
# Тест 1: С isMarketPrice=true (должно быть "(market)")
echo "=== Test with isMarketPrice=true ==="
curl -X POST https://1otc.cc/api/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "cantonAddress": "04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "refundAddress": "bron::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "usdtAmount": 1000,
    "cantonAmount": 12000,
    "email": "test-market-true-'$(date +%s)'@example.com",
    "exchangeDirection": "buy",
    "isMarketPrice": true
  }' -s > /dev/null

sleep 3
kubectl logs -n canton-otc deployment/canton-otc --tail=200 | grep -i "Price CC.*market" | head -1

# Тест 2: С isMarketPrice=false (НЕ должно быть "(market)")
echo ""
echo "=== Test with isMarketPrice=false ==="
curl -X POST https://1otc.cc/api/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "cantonAddress": "04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "refundAddress": "bron::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "usdtAmount": 1000,
    "cantonAmount": 12000,
    "email": "test-market-false-'$(date +%s)'@example.com",
    "exchangeDirection": "buy",
    "isMarketPrice": false,
    "manualPrice": 0.082
  }' -s > /dev/null

sleep 3
kubectl logs -n canton-otc deployment/canton-otc --tail=200 | grep -i "Price CC" | grep -v "market" | head -1
```

---

## 🧪 ТЕСТ 12: Проверка Telegram Mediator webhook

**Цель**: Проверить что webhook обрабатывает команды

```bash
# Проверка health endpoint
curl -X GET https://1otc.cc/api/telegram-mediator/webhook -s | jq '.'

# Ожидаемый результат:
# {
#   "status": "healthy",
#   "endpoint": "telegram-mediator-webhook",
#   "features": [...]
# }
```

---

## 🧪 ТЕСТ 12.1: Проверка минимальной суммы через админку

**Цель**: Проверить что минимальная сумма настраивается через админку

```bash
# 1. Получить текущую минимальную сумму через API админки
CURRENT_MIN=$(curl -s https://1otc.cc/api/admin/settings | jq -r '.minAmount // empty')

if [ -z "$CURRENT_MIN" ]; then
  echo "⚠️ Не удалось получить минимальную сумму через API"
  echo "Проверьте через ConfigMap:"
  kubectl get configmap canton-otc-config -n canton-otc -o jsonpath='{.data.MIN_USDT_AMOUNT}'
  echo ""
else
  echo "✅ Текущая минимальная сумма: \$$CURRENT_MIN USDT"
  echo "Настроить через админку: https://1otc.cc/admin/settings"
fi

# 2. Проверить что значение соответствует ConfigMap
CONFIGMAP_MIN=$(kubectl get configmap canton-otc-config -n canton-otc -o jsonpath='{.data.MIN_USDT_AMOUNT}' 2>/dev/null || echo "")

if [ -n "$CONFIGMAP_MIN" ] && [ -n "$CURRENT_MIN" ]; then
  if [ "$CONFIGMAP_MIN" = "$CURRENT_MIN" ]; then
    echo "✅ Значения совпадают: API и ConfigMap = \$$CURRENT_MIN"
  else
    echo "⚠️ Несоответствие: API=\$$CURRENT_MIN, ConfigMap=\$$CONFIGMAP_MIN"
  fi
fi

# Ожидаемый результат:
# ✅ Текущая минимальная сумма: $<значение> USDT
# ✅ Значения совпадают: API и ConfigMap = $<значение>
```

---

## 🧪 ТЕСТ 13: Комплексный тест - полный флоу

**Цель**: Проверить весь флоу создания заявки с всеми флагами

```bash
COMPLETE_TEST=$(curl -X POST https://1otc.cc/api/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "cantonAddress": "04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "refundAddress": "bron::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "usdtAmount": 1000,
    "cantonAmount": 12000,
    "email": "complete-test-'$(date +%s)'@example.com",
    "telegram": "@testuser",
    "whatsapp": "+1234567890",
    "exchangeDirection": "buy",
    "isMarketPrice": true,
    "isPrivateDeal": false
  }' -s)

echo "=== Complete Test Response ==="
echo $COMPLETE_TEST | jq '{
  success,
  orderId,
  isMarketPrice,
  isPrivateDeal,
  validation: {
    cantonAddress: .validation.cantonAddress,
    addressValid: .validation.addressValid
  },
  spamCheck: {
    passed: .spamCheck.passed,
    riskLevel: .spamCheck.riskLevel
  }
}'

ORDER_ID=$(echo $COMPLETE_TEST | jq -r '.orderId')
echo ""
echo "Order ID: $ORDER_ID"
echo ""
echo "=== Checking logs for this order ==="
sleep 3
kubectl logs -n canton-otc deployment/canton-otc --tail=200 | grep "$ORDER_ID" | head -10
```

---

## 📊 ИТОГОВАЯ ПРОВЕРКА

```bash
echo "=== Final Status Check ==="
echo ""
echo "1. API Health:"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" https://1otc.cc
echo ""
echo "2. Kubernetes Pods:"
kubectl get pods -n canton-otc -l app=canton-otc --no-headers | grep -v "auto-update" | awk '{print "  " $1 ": " $3 " (" $2 ")"}'
echo ""
echo "3. Current Image:"
kubectl get deployment canton-otc -n canton-otc -o jsonpath='{.spec.template.spec.containers[0].image}'
echo ""
echo "4. Recent Orders (last 5 minutes):"
kubectl logs -n canton-otc deployment/canton-otc --tail=500 --since=5m | grep -i "Order created\|orderId" | tail -5
echo ""
echo "5. Telegram Notifications (last 5 minutes):"
kubectl logs -n canton-otc deployment/canton-otc --tail=500 --since=5m | grep -i "sendPublicOrderNotification\|Order published" | tail -3
```

---

## ✅ CHECKLIST ТЕСТИРОВАНИЯ

- [ ] Тест 1: isMarketPrice=true - заявка создается
- [ ] Тест 2: Ручная цена - заявка создается
- [ ] Тест 3: isPrivateDeal=true - заявка НЕ публикуется в Telegram
- [ ] Тест 4: SELL direction - заявка создается
- [ ] Тест 5: Валидация адресов - HEX::HEX формат принимается
- [ ] Тест 6: Rate limiting - защита работает
- [ ] Тест 7: Минимальная сумма - валидация работает
- [ ] Тест 8: Email валидация - работает
- [ ] Тест 9: Публичная заявка - публикуется в Telegram
- [ ] Тест 10: Telegram формат - английский язык
- [ ] Тест 11: "(market)" - показывается только при isMarketPrice=true
- [ ] Тест 12: Telegram webhook - health check работает
- [ ] Тест 12.1: Минимальная сумма - настраивается через админку
- [ ] Тест 13: Комплексный тест - весь флоу работает

---

## 🐛 ДИАГНОСТИКА ПРОБЛЕМ

### Если заявка не создается:

```bash
# Проверить логи ошибок
kubectl logs -n canton-otc deployment/canton-otc --tail=100 | grep -i "error\|failed\|exception" | tail -10

# Проверить валидацию
kubectl logs -n canton-otc deployment/canton-otc --tail=100 | grep -i "validation\|invalid" | tail -10
```

### Если Telegram не публикует:

```bash
# Проверить конфигурацию Telegram
kubectl logs -n canton-otc deployment/canton-otc --tail=100 | grep -i "telegram\|sendPublicOrderNotification" | tail -10

# Проверить env переменные
kubectl get deployment canton-otc -n canton-otc -o jsonpath='{.spec.template.spec.containers[0].env}' | jq '.[] | select(.name | contains("TELEGRAM"))'
```

### Если isMarketPrice не работает:

```bash
# Проверить логи обработки флага
kubectl logs -n canton-otc deployment/canton-otc --tail=200 | grep -i "isMarketPrice\|market price" | tail -10
```

---

## 📝 ПРИМЕЧАНИЯ

1. **Все тесты используют уникальные email** через `$(date +%s)` для избежания конфликтов
2. **Canton адрес** использует HEX::HEX формат (самый распространенный): `04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8`
3. **Минимальная сумма**: Настраивается через **админку** (`/admin/settings` → раздел Limits → Min Amount)
   - Админка обновляет ConfigMap (`MIN_USDT_AMOUNT`) и изменения применяются мгновенно
   - По умолчанию: $1, но в production может быть установлено другое значение (например, $700)
   - Проверить значение:
     - Через админку: https://1otc.cc/admin/settings
     - Через API: `curl -s https://1otc.cc/api/admin/settings | jq '.minAmount'`
     - Через ConfigMap: `kubectl get configmap canton-otc-config -n canton-otc -o jsonpath='{.data.MIN_USDT_AMOUNT}'`
4. **Telegram публикация** происходит только для публичных заявок (isPrivateDeal=false)
5. **Формат Telegram** должен быть на английском языке согласно REQ-007 (NEW OTC ORDER, BUY, SELL)
6. **"(market)"** показывается только при isMarketPrice=true согласно REQ-008
7. **Формат валидации адреса**: Возвращает полное описание формата, например "Canton Network HEX::HEX format (participant_id::party_hint) - MOST COMMON"

---

**Автор**: AI Assistant  
**Дата создания**: $(date +%Y-%m-%d)  
**Версия**: 1.0
