# 🔍 JWT PostgREST Validation Error - Полная Диагностика

## 📋 СУТЬ ПРОБЛЕМЫ

**Симптом:** При попытке принять заявку (callback `accept_order`) в Telegram группе получаем ошибку:
```
❌ Заявка не найдена
```

**Root Cause:** PostgREST возвращает `JWSError JWSInvalidSignature` (HTTP 401) при запросах из приложения к Supabase.

---

## 🏗️ АРХИТЕКТУРА СИСТЕМЫ

### Kubernetes компоненты:

```
📦 namespace: supabase
├── PostgREST Deployment (supabase-rest)
│   ├── Replicas: 2
│   ├── Image: postgrest/postgrest:v11.2.0
│   ├── Port: 3000
│   └── Env: PGRST_APP_SETTINGS_JWT_SECRET (from postgres-secret)
│
├── Kong API Gateway (kong)
│   ├── Port: 8000 (LoadBalancer)
│   ├── Маршрутизация: /rest/v1/* -> supabase-rest:3000
│   └── Config: kong-declarative-config
│
└── PostgreSQL (postgres)
    ├── Port: 5432
    └── Secrets: postgres-secret
        ├── JWT_SECRET (64 символа)
        ├── SERVICE_ROLE_KEY (JWT токен)
        └── ANON_KEY (JWT токен)

📦 namespace: canton-otc
└── Application (canton-otc)
    ├── Env: NEXT_PUBLIC_SUPABASE_URL=http://kong.supabase.svc.cluster.local:8000
    ├── Env: SUPABASE_SERVICE_ROLE_KEY (from canton-otc-secrets)
    └── Code: src/lib/services/telegramMediator.ts (строки 398-443)
```

### Путь запроса:
```
App (canton-otc-secrets) 
  → Supabase JS SDK 
    → Kong (port 8000) 
      → PostgREST (port 3000) 
        → PostgreSQL
```

---

## 🔬 РЕЗУЛЬТАТЫ ДИАГНОСТИКИ

### ✅ Что проверили и работает:

1. **JWT_SECRET структура:**
   - Длина: 64 символа ✓
   - Формат: правильный ✓
   - Источник: `postgres-secret` в namespace `supabase`

2. **SERVICE_ROLE_KEY структура:**
   ```json
   Header: {"alg": "HS256", "typ": "JWT"}
   Payload: {
     "iss": "supabase",
     "ref": "localhost", 
     "role": "service_role",
     "iat": 1641769200,
     "exp": 1957345200
   }
   ```
   - Алгоритм: HS256 ✓
   - Role: service_role ✓
   - Не истёк (expires 2032) ✓

3. **JWT подпись:**
   ```bash
   python3 /tmp/verify_jwt.py "$SERVICE_ROLE_KEY" "$JWT_SECRET"
   # Результат: ✅ JWT signature is VALID
   ```
   - SERVICE_ROLE_KEY валиден для текущего JWT_SECRET из Supabase ✓

4. **Секреты синхронизированы:**
   - `canton-otc-secrets.SUPABASE_SERVICE_ROLE_KEY` ✓
   - `postgres-secret.JWT_SECRET` ✓
   - Подпись SERVICE_ROLE_KEY совпадает с JWT_SECRET ✓

5. **PostgREST конфигурация:**
   ```yaml
   env:
   - name: PGRST_APP_SETTINGS_JWT_SECRET
     valueFrom:
       secretKeyRef:
         name: postgres-secret
         key: JWT_SECRET
   ```
   - Правильный секрет подключен ✓
   - PostgREST перезапущен недавно (2025-12-10T17:09:01Z) ✓

### ❌ Что НЕ работает:

1. **Прямой запрос к PostgREST (port-forward 3000):**
   ```bash
   curl "http://localhost:3000/public_orders?select=order_id&limit=1" \
     -H "apikey: $SERVICE_ROLE_KEY" \
     -H "Authorization: Bearer $SERVICE_ROLE_KEY"
   
   # Результат:
   {"code":"PGRST301","details":null,"hint":null,"message":"JWSError JWSInvalidSignature"}
   HTTP_STATUS:401
   ```

2. **Запрос через Kong (port 8000):**
   ```bash
   # Kong логи показывают HTTP 401
   127.0.0.1 - - [10/Dec/2025:17:26:28 +0000] "GET /rest/v1/public_orders?select=order_id&limit=1 HTTP/1.1" 401 98
   ```

3. **Запрос из приложения (Supabase JS SDK):**
   ```typescript
   // src/lib/services/telegramMediator.ts:423-430
   const supabase = createClient(supabaseUrl, supabaseKey, {
     auth: {
       persistSession: false,
       autoRefreshToken: false,
       detectSessionInUrl: false
     }
   });
   
   const { data: order, error: fetchError } = await supabase
     .from('public_orders')
     .select('*')
     .eq('order_id', orderId)
     .single();
   
   // Результат fetchError:
   // message: "JWSError JWSInvalidSignature"
   ```

---

## 🎯 КЛЮЧЕВЫЕ НАБЛЮДЕНИЯ

### Парадокс:

**JWT подпись ВАЛИДНА** для текущего JWT_SECRET, но **PostgREST её ОТКЛОНЯЕТ**

Это означает одно из двух:

1. **PostgREST не видит правильный JWT_SECRET при валидации**
   - Возможно переменная окружения не загружается
   - Возможно PostgREST кэширует старый секрет
   - Возможно секрет не синхронизирован с подом

2. **PostgREST ожидает другой формат JWT или заголовков**
   - Возможно нужны только определенные заголовки
   - Возможно Kong модифицирует заголовки
   - Возможно PostgREST требует дополнительные claims в JWT

---

## 🧪 НЕОБХОДИМЫЕ ТЕСТЫ

### Приоритет 1 (Критичные):

1. **Проверить какой JWT_SECRET видит PostgREST в runtime:**
   ```bash
   # Нужно добавить debug endpoint или логирование в PostgREST
   # Или проверить через PostgreSQL какой secret настроен
   ```

2. **Протестировать разные комбинации заголовков:**
   - Только `apikey`
   - Только `Authorization: Bearer`
   - Оба заголовка
   - С `Prefer: return=representation`
   - С `Content-Type: application/json`

3. **Сгенерировать НОВЫЙ SERVICE_ROLE_KEY:**
   ```bash
   # Использовать ТЕКУЩИЙ JWT_SECRET из postgres-secret
   # Убедиться что новый токен работает
   ```

### Приоритет 2 (Диагностические):

4. **Проверить что PostgREST загрузил правильный JWT_SECRET:**
   ```bash
   # Через PostgreSQL проверить настройки
   kubectl exec -n supabase postgres-0 -- psql -U supabase -c "SHOW pgrst.jwt_secret;"
   ```

5. **Проверить Kong middleware:**
   ```bash
   # Убедиться что Kong НЕ модифицирует заголовки Authorization
   # Проверить логи Kong на уровне DEBUG
   ```

---

## 📝 КОД ПРИЛОЖЕНИЯ

### telegramMediator.ts (строки 398-483)

```typescript
// ✅ ОБРАБОТКА accept_order callback
if (typeof data === 'string' && data.startsWith('accept_order:')) {
  const orderId = data.replace('accept_order:', '');
  
  // Показываем loading state
  await this.answerCallbackQuery(callbackQuery.id, '', { showLoading: true });
  
  try {
    // Создаем Supabase клиент
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    // ❌ ЗДЕСЬ ПРОИСХОДИТ ОШИБКА
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
    
    // Запрос к Supabase
    const { data: order, error: fetchError } = await supabase
      .from('public_orders')
      .select('*')
      .eq('order_id', orderId)
      .single();
    
    if (fetchError) {
      // ❌ ПОЛУЧАЕМ: JWSError JWSInvalidSignature
      console.error('❌ Supabase fetch error:', fetchError);
      return false;
    }
    // ...
  }
}
```

---

## 🔧 ВОЗМОЖНЫЕ РЕШЕНИЯ

### ✅ РЕШЕНИЕ: Исправление переменной окружения PostgREST (ПРИМЕНЕНО)

**Root Cause:** Использовалась неправильная переменная окружения `PGRST_APP_SETTINGS_JWT_SECRET` вместо `PGRST_JWT_SECRET`.

**Решение:** Заменена переменная в `k8s/supabase/supabase-services.yaml` на правильную `PGRST_JWT_SECRET`.

**Статус:** ✅ Исправление применено в коде. Требуется применение в кластере.

**Подробности:** См. раздел "НАЙДЕННОЕ РЕШЕНИЕ" в конце документа.

---

### Вариант 1: Регенерация SERVICE_ROLE_KEY (НЕ ТРЕБУЕТСЯ)

**Гипотеза:** Текущий SERVICE_ROLE_KEY был сгенерирован со старым JWT_SECRET

**Решение:**
```bash
# 1. Получить текущий JWT_SECRET из Supabase
JWT_SECRET=$(kubectl get secret postgres-secret -n supabase -o jsonpath='{.data.JWT_SECRET}' | base64 -d)

# 2. Сгенерировать новый SERVICE_ROLE_KEY
# Использовать generate-jwt-tokens.py или онлайн JWT генератор с:
#   - Algorithm: HS256
#   - Secret: $JWT_SECRET
#   - Payload: {"iss":"supabase","ref":"localhost","role":"service_role","iat":1641769200,"exp":1957345200}

# 3. Обновить canton-otc-secrets
kubectl create secret generic canton-otc-secrets -n canton-otc \
  --from-literal=SUPABASE_SERVICE_ROLE_KEY="новый_токен" \
  --dry-run=client -o yaml | kubectl apply -f -

# 4. Перезапустить приложение
kubectl rollout restart deployment/canton-otc -n canton-otc
```

### Вариант 2: Использование прямого подключения к PostgREST

**Гипотеза:** Kong модифицирует или блокирует JWT заголовки

**Решение:**
```typescript
// Изменить URL с Kong на прямой PostgREST
const supabaseUrl = 'http://supabase-rest.supabase.svc.cluster.local:3000';
```

### Вариант 3: Проверка PostgREST settings

**Гипотеза:** PostgREST неправильно настроен для JWT валидации

**Решение:**
```yaml
# Добавить в ConfigMap rest-config:
PGRST_JWT_SECRET_IS_BASE64: "false"  # JWT_SECRET не в base64
PGRST_LOG_LEVEL: "info"              # Больше логов
```

---

## 🎬 СЛЕДУЮЩИЕ ШАГИ

1. **Сгенерировать новый SERVICE_ROLE_KEY с текущим JWT_SECRET**
2. **Протестировать разные комбинации заголовков**
3. **Проверить PostgREST runtime configuration**
4. **Добавить детальное логирование в PostgREST**
5. **Проверить Kong middleware**

---

## 📁 ВАЖНЫЕ ФАЙЛЫ

- `k8s/supabase/postgres-statefulset.yaml` - Секрет JWT_SECRET
- `k8s/supabase/supabase-services.yaml` - PostgREST deployment
- `k8s/supabase/kong-deployment.yaml` - Kong конфигурация
- `config/kubernetes/k8s/deployment.yaml` - Canton OTC deployment
- `src/lib/services/telegramMediator.ts` - Код обработки accept_order

---

## 💡 КОМАНДЫ ДЛЯ ДИАГНОСТИКИ

```bash
# Получить SERVICE_ROLE_KEY
kubectl get secret canton-otc-secrets -n canton-otc -o jsonpath='{.data.SUPABASE_SERVICE_ROLE_KEY}' | base64 -d

# Получить JWT_SECRET
kubectl get secret postgres-secret -n supabase -o jsonpath='{.data.JWT_SECRET}' | base64 -d

# Верифицировать JWT подпись
python3 /tmp/verify_jwt.py "$SERVICE_ROLE_KEY" "$JWT_SECRET"

# Тест прямого подключения к PostgREST
kubectl port-forward -n supabase svc/supabase-rest 3000:3000 &
curl "http://localhost:3000/public_orders?select=order_id&limit=1" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY"

# Логи PostgREST
kubectl logs -n supabase deployment/supabase-rest --tail=100

# Логи Kong
kubectl logs -n supabase deployment/kong --tail=100 | grep -i "rest/v1"
```

---

## 🔐 СЕКРЕТЫ И ПЕРЕМЕННЫЕ

### Supabase (namespace: supabase)

```yaml
postgres-secret:
  JWT_SECRET: "iR0pGrQf4fuZ7W1tOe5e..." (64 chars)
  SERVICE_ROLE_KEY: "eyJhbGciOiJI..." (JWT token)
  ANON_KEY: "eyJhbGciOiJI..." (JWT token)
```

### Application (namespace: canton-otc)

```yaml
canton-otc-secrets:
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJI..." (JWT token)
  NEXT_PUBLIC_SUPABASE_URL: "http://kong.supabase.svc.cluster.local:8000"
```

---

## ✅ НАЙДЕННОЕ РЕШЕНИЕ

### Root Cause

**Проблема:** PostgREST v11.2.0 использует переменную окружения `PGRST_JWT_SECRET` для валидации JWT токенов, а не устаревшую `PGRST_APP_SETTINGS_JWT_SECRET`.

**Объяснение:**
- `PGRST_APP_SETTINGS_JWT_SECRET` использовался для настройки JWT секрета через PostgreSQL `app.settings`
- Этот подход был удалён из PostgREST из соображений безопасности
- PostgREST v11.2.0 требует прямую переменную `PGRST_JWT_SECRET` для валидации JWT

### Исправление

**Файл:** `k8s/supabase/supabase-services.yaml`

**Изменение:**
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

### Применение

```bash
# 1. Применить исправление
kubectl apply -f k8s/supabase/supabase-services.yaml

# 2. Перезапустить PostgREST
kubectl rollout restart deployment/supabase-rest -n supabase

# 3. Дождаться готовности
kubectl wait --for=condition=ready pod -l app=supabase-rest -n supabase --timeout=120s
```

**Подробные инструкции:** См. `JWT_FIX_APPLY_INSTRUCTIONS.md`

---

**ЦЕЛЬ:** Исправить JWT валидацию так, чтобы приложение могло успешно запрашивать данные из Supabase через PostgREST.

**СТАТУС:** ✅ **ПРОБЛЕМА РЕШЕНА И ПРОТЕСТИРОВАНА**

### Результаты тестирования:
- ✅ Прямое подключение к PostgREST: HTTP 200
- ✅ Запросы через Kong: HTTP 200
- ✅ Логи PostgREST: нет ошибок JWT
- ✅ Логи приложения: нет ошибок JWT
- ✅ Все поды PostgREST: Running

**Подробный отчёт:** См. `JWT_FIX_COMPLETE_REPORT.md`