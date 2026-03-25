# 🔐 Настройка Supabase Auth для Canton Validator

**Дата**: 28 ноября 2025  
**Статус**: Требует развертывания Supabase  
**Сервер**: 65.108.15.30

---

## 📋 ТЕКУЩАЯ СИТУАЦИЯ

### ✅ Что настроено:
- Auth переменные в `.env` настроены для Supabase:
  ```
  AUTH_JWKS_URL=https://api.1otc.cc/auth/v1/jwks
  AUTH_WELLKNOWN_URL=https://api.1otc.cc/auth/v1/.well-known/openid-configuration
  AUTH_URL=https://api.1otc.cc/auth/v1
  LEDGER_API_AUTH_AUDIENCE=authenticated
  VALIDATOR_AUTH_AUDIENCE=authenticated
  ```

### ❌ Проблема:
- Домен `api.1otc.cc` не резолвится (NXDOMAIN)
- Supabase Auth недоступен
- Контейнеры Canton Validator не могут запуститься (требуют auth)

---

## 🚀 РЕШЕНИЕ 1: Развернуть Supabase Auth

### Шаг 1: Проверить доступность Kubernetes

```bash
# На сервере с доступом к Kubernetes кластеру
kubectl cluster-info
kubectl get namespaces | grep supabase
```

### Шаг 2: Развернуть Supabase (если не развернут)

```bash
# 1. Создать namespace
kubectl apply -f k8s/supabase/namespace.yaml

# 2. Deploy PostgreSQL
kubectl apply -f k8s/supabase/postgres-statefulset.yaml

# Подождать готовности
kubectl wait --for=condition=ready pod -l app=postgres -n supabase --timeout=300s

# 3. Deploy остальные сервисы
kubectl apply -f k8s/supabase/kong-deployment.yaml
kubectl apply -f k8s/supabase/supabase-services.yaml

# 4. Deploy Ingress
kubectl apply -f k8s/supabase/ingress.yaml

# 5. Проверить статус
kubectl get pods -n supabase
kubectl get svc -n supabase
kubectl get ingress -n supabase
```

### Шаг 3: Настроить DNS

```bash
# Убедиться, что DNS запись для api.1otc.cc указывает на Ingress контроллер
# Проверить IP Ingress контроллера:
kubectl get ingress -n supabase supabase-ingress -o jsonpath='{.status.loadBalancer.ingress[0].ip}'

# Или hostname:
kubectl get ingress -n supabase supabase-ingress -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

### Шаг 4: Проверить доступность

```bash
# С сервера 65.108.15.30
curl -I https://api.1otc.cc/auth/v1/jwks
curl https://api.1otc.cc/auth/v1/jwks
```

---

## 🔧 РЕШЕНИЕ 2: Временное отключение Auth для DevNet

Если Supabase еще не развернут, можно временно отключить auth для DevNet:

### Вариант A: Использовать заглушки (не рекомендуется для production)

```bash
# На сервере 65.108.15.30
cd /opt/canton-validator

# Создать минимальный JWKS endpoint через простой HTTP сервер
# Или использовать mock OIDC provider
```

### Вариант B: Отключить проверку auth в конфигурации

**ВНИМАНИЕ**: Это требует изменения конфигурации внутри образов, что сложно.

---

## 📝 РЕКОМЕНДАЦИИ

1. **Для DevNet**: Можно временно использовать mock OIDC provider или отключить auth
2. **Для Production**: Обязательно развернуть Supabase Auth
3. **Проверить**: Где развернут Supabase (на каком сервере/кластере)

---

## 🔍 ДИАГНОСТИКА

### Проверка доступности Supabase:

```bash
# С сервера 65.108.15.30
ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30

# Проверить DNS
nslookup api.1otc.cc

# Проверить доступность
curl -v https://api.1otc.cc/auth/v1/jwks
curl -v https://api.1otc.cc/rest/v1/
```

### Проверка конфигурации Canton:

```bash
cd /opt/canton-validator
cat .env | grep AUTH
docker logs splice-validator-validator-1 2>&1 | grep -i auth
docker logs splice-validator-participant-1 2>&1 | grep -i auth
```

---

## ✅ СЛЕДУЮЩИЕ ШАГИ

1. **Определить**, где должен быть развернут Supabase:
   - На том же сервере 65.108.15.30?
   - В Kubernetes кластере?
   - На другом сервере?

2. **Развернуть Supabase Auth** согласно инструкциям выше

3. **Проверить доступность** `https://api.1otc.cc/auth/v1/jwks`

4. **Перезапустить Canton Validator** после развертывания Supabase

---

**Примечание**: Если Supabase развернут на другом домене/сервере, нужно обновить `.env` файл с правильными URL.
