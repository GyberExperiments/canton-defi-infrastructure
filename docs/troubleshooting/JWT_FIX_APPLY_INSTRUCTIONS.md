# 🔧 ИСПРАВЛЕНИЕ JWT ВАЛИДАЦИИ В POSTGREST

## ✅ ЧТО ИСПРАВЛЕНО

**Проблема:** PostgREST v11.2.0 использует переменную `PGRST_JWT_SECRET` для валидации JWT токенов, а не устаревшую `PGRST_APP_SETTINGS_JWT_SECRET`.

**Решение:** Заменена переменная окружения в конфигурации PostgREST deployment.

**Изменённый файл:** `k8s/supabase/supabase-services.yaml`

### Изменение:
```yaml
# БЫЛО (неправильно):
- name: PGRST_APP_SETTINGS_JWT_SECRET
  valueFrom:
    secretKeyRef:
      name: postgres-secret
      key: JWT_SECRET

# СТАЛО (правильно):
- name: PGRST_JWT_SECRET
  valueFrom:
    secretKeyRef:
      name: postgres-secret
      key: JWT_SECRET
```

---

## 🚀 КОМАНДЫ ДЛЯ ПРИМЕНЕНИЯ

### Шаг 1: Применить исправленную конфигурацию
```bash
kubectl apply -f k8s/supabase/supabase-services.yaml
```

### Шаг 2: Перезапустить PostgREST deployment
```bash
kubectl rollout restart deployment/supabase-rest -n supabase
```

### Шаг 3: Дождаться готовности подов
```bash
kubectl wait --for=condition=ready pod -l app=supabase-rest -n supabase --timeout=120s
```

### Шаг 4: Проверить статус подов
```bash
kubectl get pods -n supabase -l app=supabase-rest
```

---

## 🔍 ПРОВЕРКА ИСПРАВЛЕНИЯ

### 1. Проверить переменные окружения в поде PostgREST
```bash
# Получить имя пода
POD=$(kubectl get pods -n supabase -l app=supabase-rest -o jsonpath='{.items[0].metadata.name}')

# Проверить что PGRST_JWT_SECRET установлена
kubectl exec -n supabase $POD -- sh -c 'echo "PGRST_JWT_SECRET length: $(echo $PGRST_JWT_SECRET | wc -c)"'
# Должно быть: 65 (64 символа + символ новой строки)
```

### 2. Проверить что старой переменной нет
```bash
kubectl exec -n supabase $POD -- sh -c 'echo "PGRST_APP_SETTINGS_JWT_SECRET: ${PGRST_APP_SETTINGS_JWT_SECRET:-NOT_SET}"'
# Должно быть: NOT_SET
```

### 3. Тест прямого подключения к PostgREST
```bash
# Получить SERVICE_ROLE_KEY
SERVICE_ROLE_KEY=$(kubectl get secret canton-otc-secrets -n canton-otc -o jsonpath='{.data.SUPABASE_SERVICE_ROLE_KEY}' | base64 -d)

# Port-forward к PostgREST
kubectl port-forward -n supabase svc/supabase-rest 3000:3000 &
PF_PID=$!

# Подождать немного
sleep 2

# Тестовый запрос
curl -v "http://localhost:3000/public_orders?select=order_id&limit=1" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY"

# Остановить port-forward
kill $PF_PID

# Ожидаемый результат: HTTP 200 с данными, а не 401
```

### 4. Проверить логи PostgREST
```bash
kubectl logs -n supabase deployment/supabase-rest --tail=50 | grep -i "jwt\|error\|401"
```

### 5. Тест через приложение
После применения исправления, попробуйте принять заявку через Telegram бота:
- Должно работать без ошибки `JWSError JWSInvalidSignature`
- Заявка должна успешно находиться в базе данных

---

## 📋 ОБЪЯСНЕНИЕ ПРОБЛЕМЫ

### Почему `PGRST_APP_SETTINGS_JWT_SECRET` не работает?

1. **Устаревший подход:** `PGRST_APP_SETTINGS_JWT_SECRET` использовался для настройки JWT секрета через PostgreSQL `app.settings`, что было удалено из соображений безопасности.

2. **Правильная переменная:** PostgREST v11.2.0 использует `PGRST_JWT_SECRET` для прямой валидации JWT токенов.

3. **Документация:** Согласно официальной документации PostgREST, `PGRST_JWT_SECRET` - это стандартная переменная для JWT валидации.

### Почему Python валидация проходила успешно?

Python скрипт проверял подпись JWT напрямую с использованием `JWT_SECRET`, что правильно. Проблема была в том, что PostgREST не мог использовать этот секрет для валидации, потому что переменная окружения была неправильной.

---

## ⚠️ ВАЖНЫЕ ЗАМЕЧАНИЯ

1. **Перезапуск обязателен:** PostgREST загружает переменные окружения при старте, поэтому перезапуск deployment необходим.

2. **Проверка синхронизации:** Убедитесь, что `JWT_SECRET` в `postgres-secret` совпадает с тем, который использовался для генерации `SERVICE_ROLE_KEY`.

3. **Kong не модифицирует заголовки:** Kong просто проксирует запросы, не изменяя заголовки `Authorization` и `apikey`.

4. **Время применения:** После перезапуска поды должны быть готовы в течение 30-60 секунд.

---

## 🎯 ОЖИДАЕМЫЙ РЕЗУЛЬТАТ

После применения исправления:
- ✅ PostgREST успешно валидирует JWT токены
- ✅ Запросы через Supabase JS SDK работают корректно
- ✅ Telegram бот может находить заявки в базе данных
- ✅ Нет ошибок `JWSError JWSInvalidSignature`

---

**Дата создания:** 2025-12-10  
**Статус:** Готово к применению
