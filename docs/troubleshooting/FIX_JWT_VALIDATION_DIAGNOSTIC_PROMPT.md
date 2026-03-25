# 🔐 ПОЛНАЯ ДИАГНОСТИКА И ИСПРАВЛЕНИЕ JWT ВАЛИДАЦИИ В SUPABASE

## 📊 ТЕКУЩАЯ СИТУАЦИЯ

### ✅ Что РАБОТАЕТ
1. JWT токены успешно сгенерированы с текущим `JWT_SECRET`
2. Python-валидация токенов проходит успешно
3. Токены обновлены в Kubernetes секретах:
   - `postgres-secret` в namespace `supabase`
   - `canton-otc-secrets` в namespace `canton-otc`
4. GitHub Secrets обновлены
5. Сервисы PostgREST и GoTrue перезапущены

### ❌ Что НЕ РАБОТАЕТ
PostgREST возвращает ошибку:
```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer error="invalid_token", error_description="JWSError JWSInvalidSignature"
```

## 🔍 ПРОВЕРЕННЫЕ ФАКТЫ

### JWT_SECRET
```bash
kubectl get secret postgres-secret -n supabase -o jsonpath='{.data.JWT_SECRET}' | base64 -D
# Результат: iR0pGrQf4fuZ7W1tOe5eUqnNhNoiTWIog_ajjRly-ZnPA0jZUFVwu_QSB5jtee2W
# Длина: 64 символа ✅
```

### Сгенерированные токены
```bash
# ANON_KEY
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvY2FsaG9zdCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjE5NTczNDUyMDB9.GkkBWWTio58UEKXyw-1XvFd0wMY2GEf2TyKMqlPU2mY

# SERVICE_ROLE_KEY
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvY2FsaG9zdCIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTk1NzM0NTIwMH0.P6BLC1Q0_eACFDCy2pRDcO90TA4iw_VK3RwX-l2CSZg
```

### Python валидация (УСПЕШНА)
```python
import jwt
jwt_secret = "iR0pGrQf4fuZ7W1tOe5eUqnNhNoiTWIog_ajjRly-ZnPA0jZUFVwu_QSB5jtee2W"
service_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvY2FsaG9zdCIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTk1NzM0NTIwMH0.P6BLC1Q0_eACFDCy2pRDcO90TA4iw_VK3RwX-l2CSZg"

decoded = jwt.decode(service_key, jwt_secret, algorithms=["HS256"])
# ✅ Результат: {'iss': 'supabase', 'ref': 'localhost', 'role': 'service_role', 'iat': 1641769200, 'exp': 1957345200}
```

### Конфигурация PostgREST (k8s/supabase/supabase-services.yaml)
```yaml
env:
- name: PGRST_DB_URI
  valueFrom:
    secretKeyRef:
      name: postgres-secret
      key: PGRST_DB_URI
- name: PGRST_APP_SETTINGS_JWT_SECRET
  valueFrom:
    secretKeyRef:
      name: postgres-secret
      key: JWT_SECRET
```

## 🎯 ВОЗМОЖНЫЕ ПРИЧИНЫ ПРОБЛЕМЫ

### 1. Неправильная переменная окружения для PostgREST
PostgREST v11.2.0 может использовать другую переменную для JWT валидации:
- `PGRST_JWT_SECRET` (стандартная) вместо `PGRST_APP_SETTINGS_JWT_SECRET`
- Или требуется prefix для app.settings

### 2. Проблема с форматом или кодировкой секрета
- Возможны скрытые символы переноса строки
- Base64 кодировка может содержать лишние символы

### 3. PostgREST кэширует старую конфигурацию
- Даже после рестарта может использовать кэш схемы БД
- Требуется полное пересоздание подов

### 4. Несоответствие payload токена ожиданиям PostgREST
- Поле `ref` может быть проблемой
- Поле `iss` должно соответствовать конфигурации

### 5. Проблема с ролями в базе данных
- Роль `anon` может не существовать в PostgreSQL
- Роль `service_role` может не иметь нужных прав

## 🔧 ПЛАН ДЕТАЛЬНОЙ ДИАГНОСТИКИ И ИСПРАВЛЕНИЯ

### Шаг 1: Проверка переменных окружения PostgREST
```bash
# Получить имя пода
POD=$(kubectl get pods -n supabase -l app=supabase-rest -o jsonpath='{.items[0].metadata.name}')

# Проверить переменные окружения внутри контейнера
kubectl exec -n supabase $POD -- sh -c 'echo "PGRST_APP_SETTINGS_JWT_SECRET: $PGRST_APP_SETTINGS_JWT_SECRET" | head -c 100'

# Проверить логи на наличие информации о JWT конфигурации
kubectl logs -n supabase $POD | grep -i "jwt\|secret\|config"
```

### Шаг 2: Исправление переменной окружения
Попробовать стандартную переменную `PGRST_JWT_SECRET`:

```yaml
# В k8s/supabase/supabase-services.yaml
env:
- name: PGRST_DB_URI
  valueFrom:
    secretKeyRef:
      name: postgres-secret
      key: PGRST_DB_URI
- name: PGRST_JWT_SECRET  # <-- ИЗМЕНИТЬ ТУТ
  valueFrom:
    secretKeyRef:
      name: postgres-secret
      key: JWT_SECRET
```

### Шаг 3: Проверка формата JWT_SECRET в секрете
```bash
# Проверить что нет лишних символов
kubectl get secret postgres-secret -n supabase -o jsonpath='{.data.JWT_SECRET}' | base64 -D | od -c

# Должно быть ровно 64 символа без переносов строк
kubectl get secret postgres-secret -n supabase -o jsonpath='{.data.JWT_SECRET}' | base64 -D | wc -c
```

### Шаг 4: Проверка ролей в PostgreSQL
```bash
# Подключиться к PostgreSQL
POD=$(kubectl get pods -n supabase -l app=postgres -o jsonpath='{.items[0].metadata.name}')

kubectl exec -it -n supabase $POD -- psql -U supabase -d supabase -c "\du"
# Проверить наличие ролей: anon, service_role, authenticator
```

### Шаг 5: Создание ролей если их нет
```sql
-- Выполнить в PostgreSQL
CREATE ROLE anon NOINHERIT;
CREATE ROLE service_role NOINHERIT;
CREATE ROLE authenticator LOGIN PASSWORD 'your-password' NOINHERIT;
GRANT anon TO authenticator;
GRANT service_role TO authenticator;
```

### Шаг 6: Альтернативная конфигурация с JWT_ISSUER
Проверить нужна ли дополнительная конфигурация issuer:

```yaml
# В ConfigMap rest-config
data:
  PGRST_DB_SCHEMAS: "public,storage,graphql_public"
  PGRST_DB_ANON_ROLE: "anon"
  PGRST_JWT_ISSUER: "supabase"  # <-- ДОБАВИТЬ
  PGRST_JWT_AUD: "authenticated"  # <-- ДОБАВИТЬ
```

### Шаг 7: Перегенерация токенов с правильным payload
Возможно нужно изменить payload:

```python
# Убрать поле ref или изменить issuer
anon_payload = {
    "role": "anon",
    "iat": 1641769200,
    "exp": 1957345200
}

service_payload = {
    "role": "service_role",
    "iat": 1641769200,
    "exp": 1957345200
}
```

### Шаг 8: Полная перезагрузка с очисткой
```bash
# Удалить деплоймент полностью
kubectl delete deployment supabase-rest -n supabase

# Применить снова
kubectl apply -f k8s/supabase/supabase-services.yaml

# Подождать поднятия
kubectl rollout status deployment/supabase-rest -n supabase --timeout=180s
```

### Шаг 9: Тестирование с детальными логами
```bash
# Включить debug логи PostgREST если возможно
kubectl set env deployment/supabase-rest -n supabase PGRST_LOG_LEVEL=debug

# Проверить логи
kubectl logs -f -n supabase deployment/supabase-rest

# В другом терминале сделать запрос
curl -v "http://localhost:8000/rest/v1/public_orders?select=order_id&limit=1" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY"
```

## 📋 КОНТРОЛЬНЫЙ СПИСОК

- [ ] Проверить правильность переменной окружения (`PGRST_JWT_SECRET`)
- [ ] Убедиться что JWT_SECRET не содержит лишних символов
- [ ] Проверить наличие ролей `anon` и `service_role` в PostgreSQL
- [ ] Создать роли если их нет
- [ ] Попробовать упрощенный payload токенов (без `iss` и `ref`)
- [ ] Добавить `PGRST_JWT_ISSUER` в конфигурацию
- [ ] Полностью пересоздать deployment PostgREST
- [ ] Проверить логи PostgREST на детали ошибки
- [ ] Тестировать с debug логами

## 🎯 ОЖИДАЕМЫЙ РЕЗУЛЬТАТ

После исправления:
```bash
curl -s "http://localhost:8000/rest/v1/public_orders?select=order_id&limit=1" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY"

# HTTP 200 OK
# Response: [] или [{"order_id": "..."}]
# NO JWSInvalidSignature errors
```

## 📚 СПРАВОЧНАЯ ИНФОРМАЦИЯ

- PostgREST v11.2.0 Documentation: https://postgrest.org/en/v11.2/
- PostgREST JWT Configuration: https://postgrest.org/en/v11.2/references/auth.html
- Supabase JWT Implementation: https://supabase.com/docs/guides/auth/jwts

## 🚨 КРИТИЧЕСКИ ВАЖНО

1. Переменная окружения для JWT в PostgREST v11.2.0 - скорее всего `PGRST_JWT_SECRET`, а не `PGRST_APP_SETTINGS_JWT_SECRET`
2. Роли `anon` и `service_role` ДОЛЖНЫ существовать в PostgreSQL
3. JWT_SECRET должен быть ровно 64 символа без переносов строк
4. После изменения конфигурации требуется ПОЛНЫЙ рестарт подов

## 📞 СЛЕДУЮЩИЕ ШАГИ

1. Начать с проверки переменной окружения (Шаг 1-2)
2. Если не помогло - проверить роли в PostgreSQL (Шаг 4-5)
3. Если не помогло - попробовать упрощенный payload (Шаг 7)
4. В крайнем случае - полное пересоздание с debug логами (Шаг 8-9)