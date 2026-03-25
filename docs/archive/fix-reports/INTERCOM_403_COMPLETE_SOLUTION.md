# 🔐 Полное решение проблемы Intercom 403 Forbidden

## 📊 Диагностика проблемы

### Текущие ошибки:
```
❌ POST https://api-iam.intercom.io/messenger/web/ping → 403 (Forbidden)
❌ POST https://api-iam.intercom.io/messenger/web/open → 403 (Forbidden)
❌ POST https://api-iam.intercom.io/messenger/web/events → 403 (Forbidden)
❌ POST https://api-iam.intercom.io/messenger/web/metrics → ERR_BLOCKED_BY_CLIENT
```

### ✅ Что работает:
- Intercom виджет загружается
- APP_ID корректный (a131dwle)
- Заказ создаётся успешно
- Сообщение формируется правильно

### ❌ Почему не работает передача данных:
**403 Forbidden** означает, что Intercom API **отклоняет запросы** из-за:
1. ✅ Домен `stage.minimal.build.infra.1otc.cc` НЕ в whitelist
2. ✅ Identity Verification включена, но user_hash не передаётся
3. ✅ CSP настроен (исправили), но Intercom всё равно блокирует

---

## 🎯 РЕШЕНИЕ (3 шага)

### ШАГ 1: Настройка Intercom Dashboard (КРИТИЧНО!)

#### 1.1. Добавить домен в Allowed Origins

**Путь:** https://app.intercom.com/a/apps/a131dwle/settings/installation

1. Войдите в Intercom Dashboard
2. Перейдите: **Settings** → **Installation** → **Web**
3. Найдите секцию **"Domains"** или **"Allowed origins"**
4. Добавьте домены:
   ```
   https://stage.minimal.build.infra.1otc.cc
   http://stage.minimal.build.infra.1otc.cc
   ```
5. Нажмите **Save**

#### 1.2. Отключить Identity Verification (для stage)

**Путь:** https://app.intercom.com/a/apps/a131dwle/settings/security

1. Перейдите: **Settings** → **Security** → **Identity verification**
2. Найдите переключатель **"Enable identity verification"**
3. **ОТКЛЮЧИТЕ** его (для stage окружения)
4. Нажмите **Save changes**

**⚠️ Почему это важно:**
- Identity Verification требует HMAC подпись для каждого пользователя
- Без подписи все API запросы возвращают 403
- Для stage окружения это излишне

#### 1.3. Проверить API Access Token

**Путь:** https://app.intercom.com/a/apps/a131dwle/developers/app-packages

1. Перейдите: **Settings** → **Developers** → **Developer Hub**
2. Проверьте **Access Token** (должен быть в `.env.local`)
3. Убедитесь что есть права:
   - ✅ **Read users**
   - ✅ **Write users**
   - ✅ **Read conversations**
   - ✅ **Write conversations**
   - ✅ **Read events**
   - ✅ **Write events**

---

### ШАГ 2: Применить изменения в Kubernetes

Обновлённый Ingress уже готов, но нужно применить его:

```bash
# 1. Применить обновлённый Ingress
kubectl apply -f config/kubernetes/k8s/minimal-stage/ingress.yaml

# 2. Проверить что Middleware обновился
kubectl get middleware -n canton-otc-minimal-stage \
  canton-otc-minimal-stage-security-headers -o yaml | grep -A 5 "customResponseHeaders"

# 3. Перезапустить приложение
kubectl rollout restart deployment/canton-otc -n canton-otc-minimal-stage

# 4. Проверить статус
kubectl rollout status deployment/canton-otc -n canton-otc-minimal-stage

# 5. Проверить логи
kubectl logs -n canton-otc-minimal-stage -l app=canton-otc --tail=50
```

---

### ШАГ 3: Проверка после настройки

#### 3.1. Проверка через DevTools

1. Откройте: https://stage.minimal.build.infra.1otc.cc
2. Откройте **DevTools** → **Console**
3. Проверьте логи Intercom:
   ```javascript
   // Должно быть:
   ✅ Intercom loaded successfully
   ✅ Intercom user updated: email@example.com
   
   // НЕ должно быть:
   ❌ POST https://api-iam.intercom.io/.../ping 403
   ```

#### 3.2. Тестовый заказ

1. Создайте тестовый заказ
2. Нажмите **"Contact Customer Support"**
3. **Проверьте:**
   - ✅ Чат открывается БЕЗ ошибок 403
   - ✅ Сообщение с деталями заказа предзаполнено
   - ✅ В Network tab все запросы возвращают **200 OK**

#### 3.3. Проверка в Intercom Dashboard

1. Откройте: https://app.intercom.com/a/apps/a131dwle/inbox
2. **Должны видеть:**
   - ✅ Нового пользователя (email)
   - ✅ Сообщение с Order ID
   - ✅ Custom attributes:
     ```
     last_order_id: MH57TZFF-45RUJ2
     last_order_amount: 1000000000000
     canton_address: ...
     payment_token: USDT
     ```

---

## 🔍 Диагностика (если всё ещё не работает)

### Проблема: Всё ещё 403

**Причины:**
1. **Домен не сохранился в Intercom**
   - Решение: Проверьте ещё раз Settings → Installation
   - Попробуйте добавить wildcard: `*.1otc.cc`

2. **Identity Verification всё ещё включена**
   - Решение: Проверьте Settings → Security
   - Убедитесь что переключатель ВЫКЛЮЧЕН

3. **Кэш Intercom**
   - Решение: Подождите 5-10 минут
   - Или перезагрузите страницу с Ctrl+Shift+R

4. **Неправильный APP_ID**
   - Проверьте `.env.local`:
     ```bash
     NEXT_PUBLIC_INTERCOM_APP_ID=a131dwle
     ```

### Проблема: ERR_BLOCKED_BY_CLIENT

**Причина:** uBlock Origin или другой ad-blocker

**Решение:**
1. Отключите ad-blocker для домена
2. Или добавьте исключение для `*.intercom.io`

---

## 📝 Дополнительные улучшения

### Добавить fallback для 403

Можно добавить автоматический fallback если Intercom заблокирован:

```typescript
// src/components/IntercomProvider.tsx

// Добавить в useEffect после инициализации
useEffect(() => {
  let errorCount = 0
  
  const checkIntercomHealth = async () => {
    try {
      // Пробуем вызвать Intercom API
      if (window.Intercom) {
        window.Intercom('getVisitorId')
      }
    } catch (error) {
      errorCount++
      
      if (errorCount > 3) {
        console.warn('🚫 Intercom API blocked, showing fallback')
        setShowFallback(true)
      }
    }
  }
  
  const healthCheckInterval = setInterval(checkIntercomHealth, 5000)
  
  return () => clearInterval(healthCheckInterval)
}, [])
```

---

## ✅ Checklist финальной проверки

### В Intercom Dashboard:
- [ ] Домен `stage.minimal.build.infra.1otc.cc` добавлен в Settings → Installation
- [ ] Identity Verification ОТКЛЮЧЕНА в Settings → Security
- [ ] API Access Token имеет все необходимые права
- [ ] App ID корректный: `a131dwle`

### В Kubernetes:
- [ ] Ingress применён: `kubectl apply -f ...`
- [ ] Middleware обновился с новым CSP
- [ ] Приложение перезапущено
- [ ] Логи не показывают ошибок

### В браузере:
- [ ] Нет ошибок 403 в Console
- [ ] Чат Intercom открывается
- [ ] Сообщение с Order ID отправляется
- [ ] В Intercom Dashboard видны данные клиента

---

## 📚 Полезные ссылки

- [Intercom Installation Guide](https://www.intercom.com/help/en/articles/167-install-intercom-on-your-product-or-site)
- [Intercom Identity Verification](https://www.intercom.com/help/en/articles/183-enable-identity-verification-for-web-and-mobile)
- [Intercom API Reference](https://developers.intercom.com/docs/references/rest-api/)
- [Intercom Security Settings](https://app.intercom.com/a/apps/a131dwle/settings/security)

---

## 🎯 Почему данные не передавались в чат

**Проблема:** Intercom API блокировал все запросы из-за:
1. Домен не в whitelist
2. Identity Verification включена без HMAC
3. API не может создать/обновить пользователя

**Что происходило:**
```javascript
// Код пытался обновить пользователя
window.Intercom('update', {
  user_id: 'email@example.com',
  email: 'email@example.com',
  custom_attributes: {
    last_order_id: 'MH57TZFF-45RUJ2',
    // ...
  }
})

// НО Intercom API отклонял запрос с 403
❌ POST /messenger/web/ping → 403 Forbidden

// Результат: пользователь не обновляется, данные не передаются
```

**После исправления:**
```javascript
// 1. Домен авторизован → запросы проходят
// 2. Identity Verification отключена → не требуется HMAC
// 3. API принимает запросы → данные передаются

✅ POST /messenger/web/ping → 200 OK
✅ Пользователь обновлён
✅ Custom attributes сохранены
✅ Администратор видит Order ID, сумму, адрес
```

---

**Время выполнения:** 
- Настройка Intercom: ~3 минуты
- Применение Kubernetes: ~2 минуты
- Проверка: ~2 минуты
- **Всего: ~7 минут**

**Статус:** 
- ✅ Код готов
- ⏳ Требуется настройка Intercom Dashboard (ручная операция)
- ⏳ Требуется применение Kubernetes Ingress

