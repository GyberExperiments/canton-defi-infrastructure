# 🚀 Быстрая инструкция: Устранение Intercom 403 ошибок

## ✅ Что уже исправлено в коде

- ✅ CSP обновлён для полной поддержки Intercom (все CDN домены)
- ✅ Permissions-Policy исправлен (убран устаревший `browsing-topics`)
- ✅ Security Headers оптимизированы для Intercom
- ✅ Код протестирован и запушен в `minimal-stage` ветку

## ⚠️ КРИТИЧНО: Требуется ручная настройка Intercom

### Проблема
Домен **`stage.minimal.build.infra.1otc.cc`** не авторизован в Intercom, поэтому все API запросы возвращают **403 Forbidden**.

### Решение (займёт 2 минуты)

1. **Зайдите в Intercom Dashboard:**
   ```
   https://app.intercom.com/a/apps/a131dwle/settings/installation
   ```

2. **Добавьте домен в Allowed Origins:**
   - Перейдите: Settings → Installation → Web
   - Найдите секцию "Allowed origins" или "Security settings"
   - Добавьте домен:
     ```
     https://stage.minimal.build.infra.1otc.cc
     ```
   - Нажмите **Save**

3. **Проверьте Identity Verification:**
   - Перейдите: Settings → Security → Identity verification
   - **Отключите** Identity Verification для stage окружения
   - Или настройте HMAC подпись (сложнее, не рекомендуется для stage)

4. **Проверьте API Access Token:**
   - Перейдите: Settings → Developers → Developer Hub
   - Access Token должен иметь права:
     - ✅ Read & Write Users
     - ✅ Read & Write Conversations
     - ✅ Read & Write Events

## 🚢 Deployment в Kubernetes

Примените обновлённый Ingress:

```bash
# 1. Применить изменения
kubectl apply -f config/kubernetes/k8s/minimal-stage/ingress.yaml

# 2. Проверить что Middleware обновился
kubectl get middleware -n canton-otc-minimal-stage \
  canton-otc-minimal-stage-security-headers -o yaml

# 3. Перезапустить приложение (опционально)
kubectl rollout restart deployment/canton-otc -n canton-otc-minimal-stage

# 4. Проверить статус деплоя
kubectl rollout status deployment/canton-otc -n canton-otc-minimal-stage
```

## ✅ Проверка результата

После настройки Intercom и применения изменений в K8s:

1. **Откройте сайт:** https://stage.minimal.build.infra.1otc.cc
2. **Откройте DevTools → Console**
3. **Создайте тестовый заказ**
4. **Нажмите "Contact Customer Service"**
5. **Проверьте:**
   - ✅ Нет ошибок 403 в Console
   - ✅ Чат Intercom открывается
   - ✅ Сообщение с деталями заказа предзаполнено
   - ✅ В Intercom Dashboard видны данные клиента

## 🔍 Диагностика

Если всё ещё видите 403:

```bash
# Проверьте CSP заголовок
curl -I https://stage.minimal.build.infra.1otc.cc/ | grep -i "content-security"

# Проверьте что Middleware применился
kubectl describe middleware -n canton-otc-minimal-stage \
  canton-otc-minimal-stage-security-headers
```

В DevTools → Network:
- Фильтр: `intercom.io`
- Все запросы должны быть **200 OK**
- Если **403** → проверьте Intercom Settings (см. выше)

## 📝 Что изменилось в коде

### 1. `config/kubernetes/k8s/minimal-stage/ingress.yaml`
- Расширен CSP для всех Intercom CDN
- Добавлена поддержка шрифтов, websockets, worker-scripts
- Исправлен Permissions-Policy
- Добавлен X-Frame-Options: SAMEORIGIN

### 2. `next.config.js`
- Синхронизирован Permissions-Policy с K8s
- Убран устаревший `browsing-topics`

## 🎯 Ожидаемый результат

После всех настроек:
- ✅ Intercom виджет загружается без ошибок
- ✅ При создании заказа данные передаются в Intercom
- ✅ Администратор видит в Intercom:
  - Email клиента
  - Order ID (например: MH57AU1N-5N1HCK)
  - Сумму заказа (1,000,000 USDT)
  - Canton адрес
  - Payment Token (USDT/Ethereum)
  - Custom attributes для приоритета

## 📚 Полезные ссылки

- [Intercom Settings](https://app.intercom.com/a/apps/a131dwle/settings)
- [Intercom Installation Guide](https://app.intercom.com/a/apps/a131dwle/settings/installation)
- [Полный отчёт об исправлениях](./INTERCOM_403_FIX_COMPLETE_REPORT.md)

---

**Время выполнения:** ~5 минут (2 мин Intercom + 3 мин K8s deployment)  
**Статус:** ✅ Code Ready | ⏳ Awaiting Manual Configuration

