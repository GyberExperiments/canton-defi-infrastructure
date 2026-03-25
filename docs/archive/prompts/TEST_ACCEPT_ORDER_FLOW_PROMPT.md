# 🧪 Тестирование полного флоу принятия заявок через cURL

**Цель**: Полное тестирование флоу принятия заявок тейкером и оператором через Telegram

**Production URL**: https://1otc.cc  
**Namespace**: canton-otc  
**Last Updated**: 2025-01-27

---

## 📋 ПРЕДВАРИТЕЛЬНАЯ ПРОВЕРКА

```bash
# 1. Проверка доступности API
curl -I https://1otc.cc

# Ожидаемый результат: HTTP/2 200

# 2. Проверка статуса подов
kubectl get pods -n canton-otc -l app=canton-otc

# Ожидаемый результат: минимум 2/2 Running

# 3. Проверка переменных окружения
kubectl exec -n canton-otc deployment/canton-otc -- env | grep -E "TELEGRAM_CLIENT_GROUP_CHAT_ID|TELEGRAM_CHAT_ID|NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY" | head -4

# Должны быть:
# TELEGRAM_CLIENT_GROUP_CHAT_ID=-5039619304
# TELEGRAM_CHAT_ID=-4872025335
# NEXT_PUBLIC_SUPABASE_URL=http://kong.supabase.svc.cluster.local:8000
# SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# 4. ⚠️ ВАЖНО: Rate Limiting
# Если получаете "Rate limit exceeded", подождите или используйте другой IP/email
# Проверка текущего лимита:
curl -X POST https://1otc.cc/api/create-order \
  -H "Content-Type: application/json" \
  -d '{"test": "rate_limit_check"}' -s | jq '{error, code}'
```

---

## 🧪 ТЕСТ 1: Создание публичной заявки (для тейкера)

**Цель**: Создать публичную заявку, которая будет опубликована в клиентскую группу

```bash
# Получаем текущие цены
CONFIG=$(curl -s https://1otc.cc/api/config)
BUY_PRICE=$(echo "$CONFIG" | jq -r '.cantonCoinBuyPrice')
USDT_AMOUNT=1000

# Рассчитываем правильную сумму Canton
BASE=$(echo "scale=10; $USDT_AMOUNT / $BUY_PRICE" | bc)
CANTON_AMOUNT=$(echo "scale=0; $BASE * 0.99" | bc)  # С учетом комиссии 1%

echo "=== Создание публичной заявки ==="
echo "USDT: $USDT_AMOUNT, Buy Price: $BUY_PRICE, Canton: $CANTON_AMOUNT"

PUBLIC_ORDER=$(curl -X POST https://1otc.cc/api/create-order \
  -H "Content-Type: application/json" \
  -d "{
    \"cantonAddress\": \"04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8\",
    \"refundAddress\": \"bron::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8\",
    \"usdtAmount\": $USDT_AMOUNT,
    \"cantonAmount\": $CANTON_AMOUNT,
    \"email\": \"test-public-$(date +%s)@example.com\",
    \"exchangeDirection\": \"buy\",
    \"isMarketPrice\": true,
    \"isPrivateDeal\": false
  }" -s)

PUBLIC_ORDER_ID=$(echo "$PUBLIC_ORDER" | jq -r '.orderId')

echo "Response:"
echo "$PUBLIC_ORDER" | jq '{
  success,
  orderId,
  isPrivateDeal,
  isMarketPrice,
  validation: .validation.cantonAddress
}'

echo ""
echo "✅ Public Order ID: $PUBLIC_ORDER_ID"

# Ожидаемый результат:
# {
#   "success": true,
#   "orderId": "XXXXX-XXXXX",
#   "isPrivateDeal": false,
#   "isMarketPrice": true
# }
```

**Проверка в логах** (должно быть опубликовано в Telegram):
```bash
sleep 3
kubectl logs -n canton-otc deployment/canton-otc --tail=200 | grep -i "sendPublicOrderNotification\|Order published\|NEW OTC ORDER" | tail -3
```

---

## 🧪 ТЕСТ 2: Создание приватной заявки (для админа)

**Цель**: Создать приватную заявку, которая НЕ будет опубликована в клиентскую группу

```bash
CONFIG=$(curl -s https://1otc.cc/api/config)
BUY_PRICE=$(echo "$CONFIG" | jq -r '.cantonCoinBuyPrice')
USDT_AMOUNT=1000
BASE=$(echo "scale=10; $USDT_AMOUNT / $BUY_PRICE" | bc)
CANTON_AMOUNT=$(echo "scale=0; $BASE * 0.99" | bc)

echo "=== Создание приватной заявки ==="

PRIVATE_ORDER=$(curl -X POST https://1otc.cc/api/create-order \
  -H "Content-Type: application/json" \
  -d "{
    \"cantonAddress\": \"04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8\",
    \"refundAddress\": \"bron::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8\",
    \"usdtAmount\": $USDT_AMOUNT,
    \"cantonAmount\": $CANTON_AMOUNT,
    \"email\": \"test-private-$(date +%s)@example.com\",
    \"exchangeDirection\": \"buy\",
    \"isMarketPrice\": true,
    \"isPrivateDeal\": true
  }" -s)

PRIVATE_ORDER_ID=$(echo "$PRIVATE_ORDER" | jq -r '.orderId')

echo "Response:"
echo "$PRIVATE_ORDER" | jq '{
  success,
  orderId,
  isPrivateDeal,
  isMarketPrice
}'

echo ""
echo "✅ Private Order ID: $PRIVATE_ORDER_ID"

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
sleep 3
kubectl logs -n canton-otc deployment/canton-otc --tail=200 | grep -i "private deal\|Skipped.*private" | tail -3
```

---

## 🧪 ТЕСТ 3: Проверка заявок в Supabase и через API

**Цель**: Убедиться что заявки сохранены в базе данных и доступны через API

```bash
# Проверка через логи (если есть доступ к Supabase)
echo "=== Проверка сохранения в Supabase ==="
echo "Public Order ID: $PUBLIC_ORDER_ID"
echo "Private Order ID: $PRIVATE_ORDER_ID"

# Проверка в логах
kubectl logs -n canton-otc deployment/canton-otc --tail=500 | grep -E "Inserting order to Supabase|Supabase insert|order_id.*$PUBLIC_ORDER_ID|order_id.*$PRIVATE_ORDER_ID" | tail -5

# Проверка через API
echo ""
echo "=== Проверка через API ==="
echo "Public Order:"
curl -s "https://1otc.cc/api/order/$PUBLIC_ORDER_ID" | jq '{
  orderId: .orderId,
  status: .status,
  isPrivateDeal: .isPrivateDeal,
  email: .email
}'

echo ""
echo "Private Order:"
curl -s "https://1otc.cc/api/order/$PRIVATE_ORDER_ID" | jq '{
  orderId: .orderId,
  status: .status,
  isPrivateDeal: .isPrivateDeal,
  email: .email
}'
```

---

## 🧪 ТЕСТ 4: Симуляция принятия тейкером (клиентская группа)

**Цель**: Проверить что происходит когда тейкер нажимает "Принять" в клиентской группе

**ВАЖНО**: Этот тест требует реального нажатия кнопки в Telegram клиентской группе.
Но можно проверить логику через проверку статуса в базе:

```bash
echo "=== Симуляция принятия тейкером ==="
echo ""
echo "Что должно произойти:"
echo "1. Тейкер нажимает 'Принять заявку' в клиентской группе (-5039619304)"
echo "2. Статус обновляется: pending → client_accepted"
echo "3. Сообщение в группе обновляется (показывает 'TAKEN BY: @username')"
echo "4. Тейкеру отправляется сообщение в личный чат с кнопкой"
echo "5. Кнопка ведет на: https://t.me/TECH_HY_Customer_Service_bot?start=order_ORDER_ID"
echo "6. Оператор получает уведомление в админский чат"
echo ""
echo "Для проверки:"
echo "1. Откройте клиентскую группу в Telegram"
echo "2. Найдите заявку с Order ID: $PUBLIC_ORDER_ID"
echo "3. Нажмите 'Принять заявку'"
echo "4. Проверьте логи ниже"
```

**Проверка логов после нажатия**:
```bash
echo "=== Проверка логов после принятия тейкером ==="
kubectl logs -n canton-otc deployment/canton-otc --tail=500 | grep -E "accept_order|Client accepted|Taker redirected|Processing accept_order callback|isClientGroup.*true" | tail -20
```

---

## 🧪 ТЕСТ 5: Симуляция принятия админом (публичная заявка)

**Цель**: Проверить что админ может принять заявку после тейкера

```bash
echo "=== Симуляция принятия админом (публичная заявка) ==="
echo ""
echo "Что должно произойти:"
echo "1. Админ нажимает 'Принять заявку' в админском чате (-4872025335)"
echo "2. Проверка: статус должен быть client_accepted (тейкер уже принял)"
echo "3. Статус обновляется: client_accepted → accepted"
echo "4. Сообщение в группе обновляется (показывает оператора)"
echo "5. Клиент получает уведомление через Intercom"
echo ""
echo "ВАЖНО: Админ НЕ может принять публичную заявку без тейкера!"
echo "Сначала тейкер должен принять в клиентской группе."
```

**Проверка логов**:
```bash
kubectl logs -n canton-otc deployment/canton-otc --tail=500 | grep -E "Admin accepted|isAdminChat.*true|status.*accepted" | tail -10
```

---

## 🧪 ТЕСТ 6: Симуляция принятия админом (приватная заявка)

**Цель**: Проверить что админ может принять приватную заявку напрямую

```bash
echo "=== Симуляция принятия админом (приватная заявка) ==="
echo ""
echo "Что должно произойти:"
echo "1. Админ нажимает 'Принять заявку' в админском чате"
echo "2. Проверка: статус может быть pending ИЛИ client_accepted"
echo "   (для приватных заявок админ может принять из любого статуса)"
echo "3. Статус обновляется: pending/client_accepted → accepted"
echo "4. Создается сервисный чат для связи с клиентом"
echo "5. Клиент получает уведомление через Intercom"
echo ""
echo "ВАЖНО: Для приватных заявок админ может принять напрямую!"
echo "Тейкер не требуется, так как заявка не публикуется в клиентскую группу."
echo "Админ может принять из статуса pending ИЛИ client_accepted (если тейкер случайно принял)."
```

**Проверка статуса через API**:
```bash
# Проверка статуса приватной заявки
curl -s "https://1otc.cc/api/order/$PRIVATE_ORDER_ID" | jq '{
  orderId: .orderId,
  status: .status,
  isPrivateDeal: .isPrivateDeal
}'
```

---

## 🧪 ТЕСТ 7: Проверка флоу перенаправления тейкера

**Цель**: Проверить что тейкер правильно перенаправляется в личный чат

```bash
echo "=== Проверка флоу перенаправления тейкера ==="
echo ""
echo "После нажатия 'Принять' тейкером должно произойти:"
echo ""
echo "1. ✅ Статус обновлен: pending → client_accepted"
echo "2. ✅ Сообщение в группе обновлено (TAKEN BY: @username)"
echo "3. ✅ Тейкеру отправлено сообщение в личный чат:"
echo "   Текст: '✅ Заявка принята! Номер заявки: ORDER_ID'"
echo "   Кнопка: '💬 Перейти в чат с оператором'"
echo "   Ссылка: https://t.me/TECH_HY_Customer_Service_bot?start=order_ORDER_ID"
echo ""
echo "4. ✅ При клике на кнопку:"
echo "   - Открывается чат с ботом"
echo "   - Автоматически отправляется: /start order_ORDER_ID"
echo "   - Бот отвечает: '✅ Заявка №ORDER_ID. Хочу принять сделку.'"
echo ""
echo "5. ✅ Оператор получает уведомление в админский чат:"
echo "   '🔔 Тейкер откликнулся на заявку'"
echo "   '👤 Тейкер: @username'"
echo "   '💬 Тейкер переброшен в личный чат: [ссылка]'"
```

**Проверка в логах**:
```bash
kubectl logs -n canton-otc deployment/canton-otc --tail=500 | grep -E "Taker redirected|sendMessage.*chat_id|answerCallbackQuery|Processing /start command" | tail -15
```

---

## 🧪 ТЕСТ 8: Проверка обновления сообщения в группе

**Цель**: Убедиться что сообщение в клиентской группе обновляется после принятия

```bash
echo "=== Проверка обновления сообщения ==="
echo ""
echo "После принятия тейкером сообщение должно обновиться:"
echo ""
echo "ДО:"
echo "🔔 NEW OTC ORDER"
echo "..."
echo "[✅ Принять заявку]"
echo ""
echo "ПОСЛЕ:"
echo "🔔 NEW OTC ORDER"
echo "..."
echo "✅ TAKEN BY: @username"
echo ""
echo "Кнопка 'Принять заявку' больше не активна"
```

**Проверка в логах**:
```bash
kubectl logs -n canton-otc deployment/canton-otc --tail=500 | grep -E "editMessageText|Message updated in client group|TAKEN BY" | tail -10
```

---

## 🧪 ТЕСТ 9: Проверка валидации статусов

**Цель**: Убедиться что валидация статусов работает правильно

```bash
echo "=== Проверка валидации статусов ==="
echo ""
echo "Публичная заявка:"
echo "  - pending → тейкер принимает → client_accepted"
echo "  - client_accepted → админ принимает → accepted"
echo "  - ❌ Админ НЕ может принять pending (требуется тейкер)"
echo ""
echo "Приватная заявка:"
echo "  - pending → админ может принять напрямую → accepted"
echo "  - ✅ Админ может принять pending (тейкер не требуется)"
echo ""
echo "Проверка в логах ошибок:"
kubectl logs -n canton-otc deployment/canton-otc --tail=500 | grep -E "Клиент еще не откликнулся|Заявка уже принята|Order already processed" | tail -5
```

---

## 🧪 ТЕСТ 10: Комплексный тест - полный флоу

**Цель**: Протестировать весь флоу от создания до принятия

```bash
echo "=== КОМПЛЕКСНЫЙ ТЕСТ: ПОЛНЫЙ ФЛОУ ==="
echo ""

# 1. Создание публичной заявки
CONFIG=$(curl -s https://1otc.cc/api/config)
BUY_PRICE=$(echo "$CONFIG" | jq -r '.cantonCoinBuyPrice')
USDT=1000
BASE=$(echo "scale=10; $USDT / $BUY_PRICE" | bc)
CANTON=$(echo "scale=0; $BASE * 0.99" | bc)

FULL_ORDER=$(curl -X POST https://1otc.cc/api/create-order \
  -H "Content-Type: application/json" \
  -d "{
    \"cantonAddress\": \"04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8\",
    \"refundAddress\": \"bron::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8\",
    \"usdtAmount\": $USDT,
    \"cantonAmount\": $CANTON,
    \"email\": \"full-flow-test-$(date +%s)@example.com\",
    \"telegram\": \"@testuser\",
    \"exchangeDirection\": \"buy\",
    \"isMarketPrice\": true,
    \"isPrivateDeal\": false
  }" -s)

FULL_ORDER_ID=$(echo "$FULL_ORDER" | jq -r '.orderId')

echo "✅ Заявка создана: $FULL_ORDER_ID"
echo "$FULL_ORDER" | jq '{success, orderId, isPrivateDeal, isMarketPrice}'

echo ""
echo "📋 Следующие шаги (вручную в Telegram):"
echo "1. Откройте клиентскую группу Telegram"
echo "2. Найдите заявку $FULL_ORDER_ID"
echo "3. Нажмите 'Принять заявку' (как тейкер)"
echo "4. Проверьте что сообщение обновилось"
echo "5. Проверьте что получили сообщение в личный чат"
echo "6. Откройте админский чат"
echo "7. Нажмите 'Принять заявку' (как оператор)"
echo "8. Проверьте что статус обновился"
```

---

## 📊 ИТОГОВАЯ ПРОВЕРКА

```bash
echo "=== ИТОГОВАЯ ПРОВЕРКА ==="
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
echo "5. Recent Accept Actions (last 5 minutes):"
kubectl logs -n canton-otc deployment/canton-otc --tail=500 --since=5m | grep -i "accept_order\|Client accepted\|Admin accepted" | tail -5
echo ""
echo "6. Telegram Notifications (last 5 minutes):"
kubectl logs -n canton-otc deployment/canton-otc --tail=500 --since=5m | grep -i "sendPublicOrderNotification\|Taker redirected\|editMessageText" | tail -5
```

---

## ✅ CHECKLIST ТЕСТИРОВАНИЯ

- [ ] Тест 1: Публичная заявка создается и публикуется в Telegram
- [ ] Тест 2: Приватная заявка создается и НЕ публикуется в Telegram
- [ ] Тест 3: Заявки сохраняются в Supabase
- [ ] Тест 4: Тейкер может принять заявку в клиентской группе
- [ ] Тест 5: Админ НЕ может принять публичную заявку без тейкера
- [ ] Тест 6: Админ может принять приватную заявку напрямую
- [ ] Тест 7: Тейкер перенаправляется в личный чат с ботом
- [ ] Тест 8: Сообщение в группе обновляется после принятия тейкером
- [ ] Тест 9: Валидация статусов работает корректно
- [ ] Тест 10: Полный флоу работает от начала до конца

---

## 🐛 ДИАГНОСТИКА ПРОБЛЕМ

### Если заявка не создается:

```bash
# Проверить логи ошибок
kubectl logs -n canton-otc deployment/canton-otc --tail=100 | grep -i "error\|failed\|exception" | tail -10

# Проверить валидацию
kubectl logs -n canton-otc deployment/canton-otc --tail=100 | grep -i "validation\|invalid" | tail -10
```

### Если кнопка "Принять" не работает:

```bash
# Проверить логи callback
kubectl logs -n canton-otc deployment/canton-otc --tail=200 | grep -i "accept_order\|callback\|Processing accept_order" | tail -20

# Проверить конфигурацию Supabase
kubectl exec -n canton-otc deployment/canton-otc -- env | grep -E "NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY"
```

### Если тейкер не перенаправляется:

```bash
# Проверить логи перенаправления
kubectl logs -n canton-otc deployment/canton-otc --tail=200 | grep -i "Taker redirected\|sendMessage.*chat_id\|answerCallbackQuery" | tail -15

# Проверить переменные Telegram
kubectl exec -n canton-otc deployment/canton-otc -- env | grep -E "TELEGRAM_BOT_TOKEN|TELEGRAM_SERVICE_BOT_USERNAME"
```

### Если сообщение не обновляется:

```bash
# Проверить логи обновления сообщения
kubectl logs -n canton-otc deployment/canton-otc --tail=200 | grep -i "editMessageText\|Message updated\|Failed to edit message" | tail -10
```

---

## 📝 ПРИМЕЧАНИЯ

1. **Публичные заявки**:
   - Публикуются в клиентскую группу (-5039619304)
   - Тейкер должен принять первым (pending → client_accepted)
   - Затем админ может принять (client_accepted → accepted)

2. **Приватные заявки**:
   - НЕ публикуются в клиентскую группу
   - Админ может принять напрямую из pending ИЛИ client_accepted → accepted
   - Тейкер не требуется (но если случайно принял, админ все равно может принять)
   - После принятия админом создается сервисный чат для связи с клиентом

3. **Перенаправление тейкера**:
   - После принятия тейкер получает сообщение в личный чат
   - Кнопка ведет на deep link: `https://t.me/TECH_HY_Customer_Service_bot?start=order_ORDER_ID`
   - При клике автоматически отправляется `/start order_ORDER_ID`
   - Бот отвечает приветственным сообщением

4. **Обновление сообщений**:
   - Сообщение в клиентской группе обновляется после принятия тейкером
   - Показывает "TAKEN BY: @username"
   - Кнопка "Принять заявку" больше не активна

---

**Автор**: AI Assistant  
**Дата создания**: 2025-01-27  
**Версия**: 1.0
