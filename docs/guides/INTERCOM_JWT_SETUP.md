# 🔐 Настройка Intercom JWT Authentication

## ✅ ЧТО СДЕЛАНО:

1. ✅ Создан API endpoint `/api/intercom/generate-jwt` для серверной генерации JWT
2. ✅ Обновлён `IntercomProvider` для использования JWT токенов
3. ✅ Установлен пакет `jsonwebtoken` для HMAC подписи
4. ✅ Обновлён `env.template` с новой переменной `INTERCOM_API_SECRET`

---

## 🎯 ШАГ 1: Добавить секретный ключ в .env.local

### Создайте файл `.env.local` в корне проекта:

```bash
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc
touch .env.local
```

### Добавьте в `.env.local`:

```bash
# Intercom Configuration
NEXT_PUBLIC_INTERCOM_APP_ID=a131dwle

# 🔐 КРИТИЧНО: Секретный ключ для JWT подписи
INTERCOM_API_SECRET=cQU_M0naeip91PryIYEVr8qZFX2dgGCIXRFkV1P7UBI

# Access Token для серверных API вызовов (если используется)
INTERCOM_ACCESS_TOKEN=ваш_access_token_если_есть

# Admin ID (если используется)
INTERCOM_ADMIN_ID=ваш_admin_id_если_есть
```

---

## 🎯 ШАГ 2: Добавить в Kubernetes ConfigMap

Для production окружения добавьте в ConfigMap:

```yaml
# config/kubernetes/k8s/minimal-stage/configmap.yaml

apiVersion: v1
kind: ConfigMap
metadata:
  name: canton-otc-config
  namespace: canton-otc-minimal-stage
data:
  # ... существующие переменные ...
  
  # Intercom JWT Configuration
  INTERCOM_API_SECRET: "cQU_M0naeip91PryIYEVr8qZFX2dgGCIXRFkV1P7UBI"
```

**⚠️ ВАЖНО:** Для production лучше использовать Secret вместо ConfigMap:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: canton-otc-intercom-secret
  namespace: canton-otc-minimal-stage
type: Opaque
stringData:
  INTERCOM_API_SECRET: "cQU_M0naeip91PryIYEVr8qZFX2dgGCIXRFkV1P7UBI"
```

---

## 🎯 ШАГ 3: Обновить deployment для использования Secret

В `config/kubernetes/k8s/minimal-stage/deployment.yaml`:

```yaml
env:
  # ... существующие переменные ...
  
  - name: INTERCOM_API_SECRET
    valueFrom:
      secretKeyRef:
        name: canton-otc-intercom-secret
        key: INTERCOM_API_SECRET
```

---

## 🧪 ШАГ 4: Тестирование

### Локальное тестирование:

```bash
# 1. Создать .env.local (если ещё не создан)
cat > .env.local << 'EOF'
NEXT_PUBLIC_INTERCOM_APP_ID=a131dwle
INTERCOM_API_SECRET=cQU_M0naeip91PryIYEVr8qZFX2dgGCIXRFkV1P7UBI
EOF

# 2. Запустить dev сервер
pnpm dev

# 3. Открыть http://localhost:3000
# 4. Создать тестовый заказ
# 5. Проверить DevTools Console:
#    ✅ Должно быть: "🔐 Generating JWT for user: email@example.com"
#    ✅ Должно быть: "✅ Intercom user updated with JWT: email@example.com"
#    ❌ НЕ должно быть: "403 Forbidden"
```

### Тестирование API endpoint:

```bash
# Проверка что JWT генерируется
curl -X POST http://localhost:3000/api/intercom/generate-jwt \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test@example.com",
    "email": "test@example.com",
    "name": "Test User",
    "custom_attributes": {
      "last_order_id": "TEST-123",
      "last_order_amount": 1000
    }
  }'

# Ответ должен содержать:
# {
#   "success": true,
#   "token": "eyJhbGciOiJIUzI1NiIs...",
#   "expires_in": 86400
# }
```

---

## 📊 КАК ЭТО РАБОТАЕТ:

### 1. Пользователь создаёт заказ
```javascript
// src/components/OrderSummary.tsx
const order = {
  orderId: 'MH57TZFF-45RUJ2',
  email: 'customer@example.com',
  amount: 1000000,
  // ...
}
```

### 2. Код обновляет Intercom с JWT
```javascript
// Вызывается автоматически после создания заказа
await intercomUtils.updateUser({
  user_id: order.email,
  email: order.email,
  name: order.email.split('@')[0],
  custom_attributes: {
    last_order_id: order.orderId,
    last_order_amount: order.paymentAmountUSD,
    canton_address: order.cantonAddress,
    payment_token: order.paymentToken.symbol,
    // ... все данные заказа
  }
})
```

### 3. Серверная генерация JWT
```javascript
// /api/intercom/generate-jwt
const payload = {
  user_id: 'customer@example.com',
  email: 'customer@example.com',
  name: 'customer',
  last_order_id: 'MH57TZFF-45RUJ2',
  last_order_amount: 1000000,
  canton_address: '0x123...',
  payment_token: 'USDT',
  // ... все custom attributes
}

const token = jwt.sign(payload, INTERCOM_API_SECRET, {
  algorithm: 'HS256',
  expiresIn: '24h'
})
```

### 4. Отправка в Intercom с JWT
```javascript
// Автоматически
window.Intercom('update', {
  intercom_user_jwt: 'eyJhbGciOiJIUzI1NiIs...'
})

// ✅ Intercom проверяет JWT подпись
// ✅ Извлекает все данные из payload
// ✅ Создаёт/обновляет пользователя
// ✅ Администратор видит все данные заказа!
```

---

## 🎯 ЧТО УВИДИТ АДМИНИСТРАТОР В INTERCOM:

После успешной настройки, в Intercom Dashboard будет видно:

```
👤 User: customer@example.com
📧 Email: customer@example.com
📝 Custom Attributes:
   • last_order_id: MH57TZFF-45RUJ2
   • last_order_amount: 1000000.00
   • last_order_status: awaiting-deposit
   • canton_address: 0x1234567890...
   • refund_address: 0xabcdef...
   • payment_token: USDT
   • payment_network: Ethereum
   • total_orders: 1
   • total_volume_usd: 1000000.00
   • customer_since: 2025-10-24T19:00:00.000Z
   • last_order_date: 2025-10-24T19:00:00.000Z
   • support_priority: high
```

---

## ✅ Checklist развертывания:

### Локально (для разработки):
- [ ] Создан `.env.local` с `INTERCOM_API_SECRET`
- [ ] Запущен `pnpm dev`
- [ ] Создан тестовый заказ
- [ ] Проверено что нет 403 в Console
- [ ] Проверено что JWT генерируется (лог: "🔐 Generating JWT")

### Production (Kubernetes):
- [ ] Создан Secret с `INTERCOM_API_SECRET`
- [ ] Обновлён Deployment для использования Secret
- [ ] Применён Secret: `kubectl apply -f ...`
- [ ] Перезапущен deployment: `kubectl rollout restart ...`
- [ ] Проверены логи: `kubectl logs ...`
- [ ] Создан тестовый заказ на stage
- [ ] Проверено в Intercom Dashboard что данные пришли

### В Intercom Dashboard:
- [ ] Включена опция "Enforce JWT Authentication"
- [ ] Проверено что домен `stage.minimal.build.infra.1otc.cc` в whitelist (если требуется)
- [ ] Создан тестовый пользователь через API
- [ ] Проверено что custom attributes видны

---

## 🔍 Troubleshooting:

### Проблема: "INTERCOM_API_SECRET not configured"

**Решение:**
```bash
# Проверьте что .env.local существует
ls -la .env.local

# Проверьте что переменная установлена
grep INTERCOM_API_SECRET .env.local

# Перезапустите dev сервер
pnpm dev
```

### Проблема: "JWT generation failed"

**Решение:**
```bash
# Проверьте логи сервера
# В консоли dev сервера должно быть:
✅ JWT token generated for user: email@example.com

# Или ошибка с деталями
```

### Проблема: Всё ещё 403 в Intercom

**Возможные причины:**
1. JWT токен неправильно подписан (неверный secret)
2. Токен не передаётся в `intercom_user_jwt`
3. В Intercom Dashboard не включен "Enforce JWT"
4. Домен всё ещё не в whitelist

**Решение:**
1. Проверьте что secret совпадает с Intercom Dashboard
2. Проверьте Console: должен быть "✅ Intercom user updated with JWT"
3. Зайдите в Intercom → Security → включите "Enforce JWT Authentication"

---

**Время настройки:** ~5 минут  
**Сложность:** Средняя  
**Результат:** Полная безопасность + передача всех данных заказа в Intercom! 🎉

