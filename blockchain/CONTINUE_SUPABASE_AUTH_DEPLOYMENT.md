# 🚀 ПРОМПТ: Продолжение развертывания Supabase Auth для Canton Validator

**Дата создания**: 28 ноября 2025  
**Приоритет**: КРИТИЧЕСКИЙ  
**Статус**: В процессе развертывания

---

## 📋 КОНТЕКСТ И ТЕКУЩАЯ СИТУАЦИЯ

### Сервер и окружение:
- **Сервер валидатора**: 65.108.15.30
- **SSH ключ**: `~/.ssh/id_rsa_canton`
- **Директория валидатора**: `/opt/canton-validator`
- **Kubernetes кластер**: Доступен через kubectl
- **Нода для Supabase**: `canton-node-65-108-15-30` (IP: 65.108.15.30)
- **Namespace Supabase**: `supabase` (создан)

### Что уже сделано:

1. ✅ **Создан namespace `supabase`** в Kubernetes
2. ✅ **Настроен nodeSelector** для всех сервисов Supabase на ноду `canton-node-65-108-15-30`
3. ✅ **Kong Service** настроен с `externalIPs: [65.108.15.30]` и `type: LoadBalancer`
4. ✅ **Kong Deployment** имеет nodeSelector и увеличенные лимиты памяти (1Gi)
5. ✅ **Все Deployment'ы Supabase** имеют nodeSelector для нужной ноды
6. ✅ **PostgreSQL StatefulSet** имеет nodeSelector и securityContext
7. ✅ **Ingress** создан для `api.1otc.cc`
8. ✅ **Canton Validator .env** настроен с правильными auth переменными

### Текущие проблемы:

1. ❌ **PostgreSQL** - CrashLoopBackOff
   - Ошибка: `data directory "/var/lib/postgresql/data" has wrong ownership`
   - Причина: PVC создан с неправильными правами доступа
   - Решение: Удалить PVC и пересоздать с правильными правами

2. ❌ **Kong** - OOMKilled (было, сейчас перезапускается с увеличенной памятью)
   - Решение: Уже увеличена память до 1Gi

3. ❌ **supabase-auth** - Error
   - Ошибка: Не может подключиться к PostgreSQL (потому что PostgreSQL не запущен)
   - Решение: Запустится автоматически после исправления PostgreSQL

---

## 🎯 ЗАДАЧА

**Завершить развертывание Supabase Auth и обеспечить доступность для Canton Validator.**

### Критерии успеха:
1. ✅ PostgreSQL запущен и работает (Ready 1/1)
2. ✅ Kong запущен и работает (Ready 1/1)
3. ✅ supabase-auth запущен и работает (Ready 1/1)
4. ✅ JWKS endpoint доступен: `https://api.1otc.cc/auth/v1/jwks` или `http://65.108.15.30:8000/auth/v1/jwks`
5. ✅ Canton Validator контейнеры запускаются без ошибок auth
6. ✅ Все сервисы Supabase работают на ноде `canton-node-65-108-15-30`

---

## 🔧 ПЛАН РЕШЕНИЯ

### Шаг 1: Исправить PostgreSQL

**Проблема**: PVC имеет неправильные права доступа

**Решение**:
```bash
# 1. Удалить StatefulSet (это удалит pod, но не PVC)
kubectl delete statefulset postgres -n supabase

# 2. Удалить PVC (ВАЖНО: это удалит данные!)
kubectl delete pvc postgres-storage-postgres-0 -n supabase

# 3. Применить исправленный StatefulSet
kubectl apply -f k8s/supabase/postgres-statefulset.yaml

# 4. Подождать готовности
kubectl wait --for=condition=ready pod -l app=postgres -n supabase --timeout=300s

# 5. Проверить логи
kubectl logs -n supabase postgres-0 --tail=20
```

**Ожидаемый результат**: PostgreSQL запускается без ошибок прав доступа

---

### Шаг 2: Проверить Kong

```bash
# 1. Проверить статус
kubectl get pods -n supabase -l app=kong

# 2. Если не запущен, проверить логи
kubectl logs -n supabase -l app=kong --tail=30

# 3. Проверить Service
kubectl get svc -n supabase kong
# Должен показать: externalIPs: [65.108.15.30]
```

**Ожидаемый результат**: Kong работает и доступен на 65.108.15.30:8000

---

### Шаг 3: Проверить supabase-auth

```bash
# 1. Подождать запуска PostgreSQL
# 2. Проверить статус auth
kubectl get pods -n supabase -l app=supabase-auth

# 3. Если ошибки, проверить логи
kubectl logs -n supabase -l app=supabase-auth --tail=30

# 4. Проверить подключение к PostgreSQL
kubectl exec -n supabase -it $(kubectl get pod -n supabase -l app=supabase-auth -o jsonpath='{.items[0].metadata.name}') -- \
  nc -zv postgres 5432
```

**Ожидаемый результат**: supabase-auth подключается к PostgreSQL и запускается

---

### Шаг 4: Проверить доступность JWKS endpoint

```bash
# С сервера 65.108.15.30
ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30

# Проверить через localhost (Kong на той же ноде)
curl -v http://localhost:8000/auth/v1/jwks

# Или через внешний IP
curl -v http://65.108.15.30:8000/auth/v1/jwks

# Проверить через домен (если DNS настроен)
curl -v https://api.1otc.cc/auth/v1/jwks
```

**Ожидаемый результат**: 
- HTTP 200 OK
- JSON с ключами JWKS

---

### Шаг 5: Перезапустить Canton Validator

```bash
# На сервере 65.108.15.30
ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30
cd /opt/canton-validator

# 1. Проверить конфигурацию
cat .env | grep -E '(AUTH_JWKS_URL|LEDGER_API_AUTH_AUDIENCE)'

# Должно быть:
# AUTH_JWKS_URL=https://api.1otc.cc/auth/v1/jwks
# или
# AUTH_JWKS_URL=http://65.108.15.30:8000/auth/v1/jwks
# LEDGER_API_AUTH_AUDIENCE=authenticated

# 2. Перезапустить контейнеры
docker compose -f compose.yaml down
docker compose -f compose.yaml up -d

# 3. Проверить статус
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep splice-validator

# 4. Проверить логи
docker logs splice-validator-participant-1 2>&1 | tail -20
docker logs splice-validator-validator-1 2>&1 | tail -20
```

**Ожидаемый результат**: 
- Все контейнеры запущены (Status: Up)
- Нет ошибок auth в логах
- participant и validator работают

---

## 📝 КОНФИГУРАЦИИ

### Текущая конфигурация Canton Validator (.env):

```bash
# Auth Configuration (Supabase Auth)
AUTH_WELLKNOWN_URL=https://api.1otc.cc/auth/v1/.well-known/openid-configuration
AUTH_JWKS_URL=https://api.1otc.cc/auth/v1/jwks
AUTH_URL=https://api.1otc.cc/auth/v1
LEDGER_API_AUTH_AUDIENCE=authenticated
VALIDATOR_AUTH_AUDIENCE=authenticated
```

**ВАЖНО**: Если домен `api.1otc.cc` не резолвится, можно использовать:
```bash
AUTH_JWKS_URL=http://65.108.15.30:8000/auth/v1/jwks
AUTH_WELLKNOWN_URL=http://65.108.15.30:8000/auth/v1/.well-known/openid-configuration
AUTH_URL=http://65.108.15.30:8000/auth/v1
```

---

### Файлы конфигурации:

1. **Kong**: `k8s/supabase/kong-deployment.yaml`
   - Service type: LoadBalancer
   - externalIPs: [65.108.15.30]
   - nodeSelector: canton-node-65-108-15-30
   - Memory: 1Gi limit

2. **PostgreSQL**: `k8s/supabase/postgres-statefulset.yaml`
   - securityContext: runAsUser: 999, fsGroup: 999
   - nodeSelector: canton-node-65-108-15-30

3. **Supabase Services**: `k8s/supabase/supabase-services.yaml`
   - Все Deployment'ы имеют nodeSelector: canton-node-65-108-15-30
   - auth-config: API_EXTERNAL_URL=https://api.1otc.cc

4. **Ingress**: `k8s/supabase/ingress.yaml`
   - Host: api.1otc.cc
   - Backend: kong:8000

---

## 🔍 ДИАГНОСТИЧЕСКИЕ КОМАНДЫ

### Проверка статуса всех компонентов:

```bash
# 1. Проверить все поды Supabase
kubectl get pods -n supabase -o wide

# 2. Проверить все сервисы
kubectl get svc -n supabase

# 3. Проверить Ingress
kubectl get ingress -n supabase

# 4. Проверить, что все на нужной ноде
kubectl get pods -n supabase -o wide | grep -v 'canton-node-65-108-15-30' | grep -v '^NAME'
# Должно быть пусто

# 5. Проверить Kong Service
kubectl get svc -n supabase kong -o yaml | grep -A 5 externalIPs
# Должно быть: externalIPs: [65.108.15.30]
```

### Проверка логов проблемных сервисов:

```bash
# PostgreSQL
kubectl logs -n supabase postgres-0 --tail=50

# Kong
kubectl logs -n supabase -l app=kong --tail=50

# supabase-auth
kubectl logs -n supabase -l app=supabase-auth --tail=50
```

### Проверка доступности с сервера валидатора:

```bash
ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30

# Проверить Kong через localhost
curl -v http://localhost:8000/auth/v1/jwks

# Проверить через внешний IP
curl -v http://65.108.15.30:8000/auth/v1/jwks

# Проверить DNS (если настроен)
nslookup api.1otc.cc
curl -v https://api.1otc.cc/auth/v1/jwks
```

---

## ⚠️ ВАЖНЫЕ ЗАМЕЧАНИЯ

1. **DNS для api.1otc.cc**:
   - Если домен не настроен, использовать IP: `http://65.108.15.30:8000`
   - Обновить `.env` файл Canton Validator соответственно

2. **Права доступа PostgreSQL**:
   - PostgreSQL требует пользователя 999 (postgres)
   - PVC должен быть создан с правильными правами
   - Если проблема сохраняется, удалить PVC и пересоздать

3. **Память Kong**:
   - Увеличена до 1Gi limit
   - Если все еще OOMKilled, можно увеличить до 2Gi

4. **Все сервисы на одной ноде**:
   - Все поды должны быть на `canton-node-65-108-15-30`
   - Это обеспечивает, что трафик идет через нужный IP

5. **Порты**:
   - Kong слушает на 8000 (HTTP) и 8443 (HTTPS)
   - Доступен через externalIP: 65.108.15.30:8000

---

## 🚨 ТИПИЧНЫЕ ПРОБЛЕМЫ И РЕШЕНИЯ

### Проблема 1: PostgreSQL не запускается

**Симптомы**: CrashLoopBackOff, ошибка "wrong ownership"

**Решение**:
```bash
# Удалить PVC и пересоздать
kubectl delete statefulset postgres -n supabase
kubectl delete pvc postgres-storage-postgres-0 -n supabase
kubectl apply -f k8s/supabase/postgres-statefulset.yaml
```

### Проблема 2: Kong OOMKilled

**Симптомы**: Pod перезапускается, статус OOMKilled

**Решение**: Уже исправлено - память увеличена до 1Gi. Если проблема сохраняется:
```bash
# Увеличить до 2Gi в kong-deployment.yaml
# limits: memory: "2Gi"
```

### Проблема 3: supabase-auth не может подключиться к PostgreSQL

**Симптомы**: Error, "connection refused" в логах

**Решение**: 
- Убедиться, что PostgreSQL запущен: `kubectl get pods -n supabase postgres-0`
- Проверить Service: `kubectl get svc -n supabase postgres`
- Проверить DNS внутри кластера: `kubectl exec -n supabase -it <auth-pod> -- nslookup postgres`

### Проблема 4: JWKS endpoint недоступен

**Симптомы**: curl возвращает ошибку или таймаут

**Решение**:
```bash
# 1. Проверить, что Kong работает
kubectl get pods -n supabase -l app=kong

# 2. Проверить Service
kubectl get svc -n supabase kong

# 3. Проверить доступность с ноды
ssh root@65.108.15.30 "curl -v http://localhost:8000/auth/v1/jwks"

# 4. Если Kong работает, но endpoint недоступен, проверить конфигурацию Kong
kubectl get configmap -n supabase kong-declarative-config -o yaml
```

### Проблема 5: Canton Validator все еще не запускается

**Симптомы**: participant/validator в статусе Created или Restarting

**Решение**:
```bash
# 1. Проверить, что JWKS доступен
curl http://65.108.15.30:8000/auth/v1/jwks

# 2. Обновить .env с правильным URL (если нужно)
# AUTH_JWKS_URL=http://65.108.15.30:8000/auth/v1/jwks

# 3. Перезапустить контейнеры
cd /opt/canton-validator
docker compose down
docker compose up -d

# 4. Проверить логи
docker logs splice-validator-participant-1 2>&1 | grep -i auth
docker logs splice-validator-validator-1 2>&1 | grep -i auth
```

---

## ✅ ЧЕКЛИСТ ЗАВЕРШЕНИЯ

- [ ] PostgreSQL запущен и работает (Ready 1/1)
- [ ] Kong запущен и работает (Ready 1/1)
- [ ] supabase-auth запущен и работает (Ready 1/1)
- [ ] Все поды Supabase на ноде `canton-node-65-108-15-30`
- [ ] Kong Service имеет externalIPs: [65.108.15.30]
- [ ] JWKS endpoint доступен: `http://65.108.15.30:8000/auth/v1/jwks`
- [ ] .env файл Canton Validator обновлен с правильным AUTH_JWKS_URL
- [ ] Canton Validator контейнеры запущены (participant, validator)
- [ ] Нет ошибок auth в логах Canton Validator
- [ ] Все health checks проходят

---

## 📊 ТЕКУЩИЙ СТАТУС (на момент создания промпта)

```bash
# Выполнить для получения актуального статуса:
kubectl get pods -n supabase -o wide
kubectl get svc -n supabase
kubectl get ingress -n supabase
ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30 "cd /opt/canton-validator && docker ps -a | grep splice-validator"
```

---

## 🔗 ССЫЛКИ И ПУТИ

- **Kubernetes конфигурации**: `k8s/supabase/`
- **Canton Validator**: `/opt/canton-validator/` на сервере 65.108.15.30
- **SSH**: `ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30`
- **Namespace**: `supabase`
- **Нода**: `canton-node-65-108-15-30` (IP: 65.108.15.30)
- **Kong Service**: `kong.supabase:8000` (внутри кластера) или `65.108.15.30:8000` (снаружи)

---

## 🎯 ФИНАЛЬНАЯ ЦЕЛЬ

**Полностью работоспособный Supabase Auth, доступный для Canton Validator через IP 65.108.15.30, с запущенными и работающими контейнерами Canton Validator без ошибок аутентификации.**

---

**Дата создания**: 28 ноября 2025  
**Приоритет**: КРИТИЧЕСКИЙ  
**Следующий шаг**: Исправить PostgreSQL (удалить PVC и пересоздать)





