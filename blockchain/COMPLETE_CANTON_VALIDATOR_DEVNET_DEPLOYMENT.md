# 🚀 ПОЛНЫЙ ПРОМПТ: Запуск Canton Validator Node в DevNet

**Дата создания**: 28 ноября 2025  
**Приоритет**: КРИТИЧЕСКИЙ  
**Статус**: В процессе развертывания  
**Цель**: Полностью работоспособный Canton Validator Node в DevNet

---

## 📋 КОНТЕКСТ И АРХИТЕКТУРА

### Сервер и окружение:
- **Сервер валидатора**: 65.108.15.30
- **SSH ключ**: `~/.ssh/id_rsa_canton`
- **Директория валидатора**: `/opt/canton-validator`
- **Образ**: `ghcr.io/digital-asset/decentralized-canton-sync/docker/` (tag: 0.5.8)
- **Архитектура**: Запуск напрямую на хосте через Docker Compose (без Docker-in-Docker)
- **Kubernetes кластер**: Доступен через kubectl
- **Нода для Supabase**: `canton-node-65-108-15-30` (IP: 65.108.15.30)

### DevNet конфигурация:
- **SPONSOR_SV_ADDRESS**: `https://sv.sv-1.dev.global.canton.network.sync.global`
- **SCAN_ADDRESS**: `https://scan.sv-1.dev.global.canton.network.sync.global`
- **ONBOARDING_SECRET**: `$ONBOARDING_SECRET`
- **PARTY_HINT**: `gyber-validator`
- **MIGRATION_ID**: `0`

---

## ✅ ЧТО УЖЕ ИСПРАВЛЕНО

### 1. Технические проблемы compose.yaml:
- ✅ **Убран mount postgres-entrypoint.sh** - удален из compose.yaml (вызывал ошибку "is a directory")
- ✅ **Создан nginx.conf** - удалена директория, создан файл с правильной конфигурацией для Canton
- ✅ **compose.yaml валиден** - проходит проверку `docker compose config`
- ✅ **Locale настроен** - в systemd service добавлены `LC_ALL=C.UTF-8` и `LANG=C.UTF-8`

### 2. Конфигурация файлов:
- ✅ **compose.yaml** - исправлен, валиден
- ✅ **nginx.conf** - создан с proxy конфигурацией для wallet-web-ui, ans-web-ui, validator
- ✅ **.env** - очищен, содержит все необходимые переменные
- ✅ **postgres-entrypoint.sh** - существует, но не используется (убрано из compose.yaml)

### 3. Supabase Auth настройка:
- ✅ **Namespace создан** - `supabase` в Kubernetes
- ✅ **nodeSelector настроен** - все сервисы Supabase на ноде `canton-node-65-108-15-30`
- ✅ **Kong Service** - `type: LoadBalancer`, `externalIPs: [65.108.15.30]`
- ✅ **Kong Deployment** - nodeSelector, память увеличена до 1Gi
- ✅ **Все Deployment'ы** - имеют nodeSelector для нужной ноды
- ✅ **PostgreSQL StatefulSet** - nodeSelector и securityContext настроены
- ✅ **Ingress** - создан для `api.1otc.cc`
- ✅ **Canton .env** - настроены auth переменные для Supabase

### 4. Текущий статус контейнеров:
- ✅ **wallet-web-ui** - Running (healthy)
- ✅ **ans-web-ui** - Running (healthy)
- ❌ **postgres-splice** - Created (не запускается)
- ❌ **participant** - Created (не запускается, требует auth)
- ❌ **validator** - Created (не запускается, требует auth)
- ❌ **nginx** - Created (не запускается)

---

## ❌ ТЕКУЩИЕ ПРОБЛЕМЫ И РЕШЕНИЯ

### Проблема 1: PostgreSQL в Supabase не запускается

**Статус**: CrashLoopBackOff  
**Ошибка**: `data directory "/var/lib/postgresql/data" has wrong ownership`  
**Причина**: PVC создан с неправильными правами доступа (root вместо postgres user 999)

**Решение**:
```bash
# 1. Удалить StatefulSet (удалит pod, но не PVC)
kubectl delete statefulset postgres -n supabase

# 2. Удалить PVC (ВАЖНО: удалит данные, но это нормально для первого запуска)
kubectl delete pvc postgres-storage-postgres-0 -n supabase

# 3. Применить исправленный StatefulSet (уже содержит securityContext)
kubectl apply -f k8s/supabase/postgres-statefulset.yaml

# 4. Подождать готовности (до 5 минут)
kubectl wait --for=condition=ready pod -l app=postgres -n supabase --timeout=300s

# 5. Проверить логи
kubectl logs -n supabase postgres-0 --tail=20
```

**Ожидаемый результат**: PostgreSQL запускается, логи показывают "database system is ready to accept connections"

---

### Проблема 2: supabase-auth не может подключиться к PostgreSQL

**Статус**: Error  
**Ошибка**: `failed to connect to host=postgres: dial tcp: connect: connection refused`  
**Причина**: PostgreSQL еще не запущен

**Решение**: 
- Запустится автоматически после исправления PostgreSQL
- Проверить после запуска PostgreSQL:
```bash
kubectl get pods -n supabase -l app=supabase-auth
kubectl logs -n supabase -l app=supabase-auth --tail=30
```

**Ожидаемый результат**: supabase-auth подключается к PostgreSQL и запускается

---

### Проблема 3: Kong может быть OOMKilled

**Статус**: Проверено - память увеличена до 1Gi  
**Решение**: Уже исправлено в конфигурации. Если проблема сохраняется:
```bash
# Увеличить до 2Gi в k8s/supabase/kong-deployment.yaml
# limits: memory: "2Gi"
kubectl apply -f k8s/supabase/kong-deployment.yaml
kubectl delete pod -n supabase -l app=kong
```

---

### Проблема 4: Canton Validator контейнеры не запускаются

**Статус**: Created (не запускаются)  
**Ошибка**: Требуют auth (AUTH_JWKS_URL должен быть доступен)

**Причина**: 
- participant требует `AUTH_JWKS_URL` для `canton.participants.participant.ledger-api.auth-services.0.url`
- validator требует `AUTH_JWKS_URL` для `canton.validator-apps.validator_backend.auth.jwks-url`
- Supabase Auth еще не доступен

**Решение**: 
1. Сначала исправить PostgreSQL и запустить Supabase Auth
2. Проверить доступность JWKS endpoint
3. Обновить .env если нужно (использовать IP вместо домена)
4. Перезапустить контейнеры Canton

---

## 🎯 ПОЛНЫЙ ПЛАН РЕШЕНИЯ

### Этап 1: Исправить и запустить Supabase (КРИТИЧНО)

#### Шаг 1.1: Исправить PostgreSQL
```bash
# Выполнить команды из "Проблема 1" выше
kubectl delete statefulset postgres -n supabase
kubectl delete pvc postgres-storage-postgres-0 -n supabase
kubectl apply -f k8s/supabase/postgres-statefulset.yaml
kubectl wait --for=condition=ready pod -l app=postgres -n supabase --timeout=300s
```

#### Шаг 1.2: Проверить supabase-auth
```bash
# Подождать 30 секунд после запуска PostgreSQL
sleep 30

# Проверить статус
kubectl get pods -n supabase -l app=supabase-auth

# Если ошибки, проверить логи
kubectl logs -n supabase -l app=supabase-auth --tail=30

# Проверить подключение к PostgreSQL
kubectl exec -n supabase -it $(kubectl get pod -n supabase -l app=supabase-auth -o jsonpath='{.items[0].metadata.name}') -- \
  nc -zv postgres 5432
```

#### Шаг 1.3: Проверить Kong
```bash
# Проверить статус
kubectl get pods -n supabase -l app=kong

# Проверить Service
kubectl get svc -n supabase kong
# Должно быть: externalIPs: [65.108.15.30]

# Проверить логи если проблемы
kubectl logs -n supabase -l app=kong --tail=30
```

#### Шаг 1.4: Проверить доступность JWKS endpoint
```bash
# С сервера 65.108.15.30
ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30

# Проверить через localhost (Kong на той же ноде)
curl -v http://localhost:8000/auth/v1/jwks

# Проверить через внешний IP
curl -v http://65.108.15.30:8000/auth/v1/jwks

# Проверить через домен (если DNS настроен)
curl -v https://api.1otc.cc/auth/v1/jwks
```

**Ожидаемый результат**: HTTP 200 OK, JSON с ключами JWKS

---

### Этап 2: Настроить Canton Validator для использования Supabase Auth

#### Шаг 2.1: Обновить .env файл (если нужно)

**Вариант A: Если домен api.1otc.cc доступен:**
```bash
# На сервере 65.108.15.30
ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30
cd /opt/canton-validator

# Проверить текущую конфигурацию
cat .env | grep -E '(AUTH_JWKS_URL|LEDGER_API_AUTH_AUDIENCE)'

# Должно быть:
# AUTH_JWKS_URL=https://api.1otc.cc/auth/v1/jwks
# LEDGER_API_AUTH_AUDIENCE=authenticated
```

**Вариант B: Если домен не доступен, использовать IP:**
```bash
cd /opt/canton-validator

# Создать backup
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

# Обновить AUTH переменные на IP
sed -i 's|AUTH_JWKS_URL=https://api.1otc.cc|AUTH_JWKS_URL=http://65.108.15.30:8000|g' .env
sed -i 's|AUTH_WELLKNOWN_URL=https://api.1otc.cc|AUTH_WELLKNOWN_URL=http://65.108.15.30:8000|g' .env
sed -i 's|AUTH_URL=https://api.1otc.cc|AUTH_URL=http://65.108.15.30:8000|g' .env

# Проверить изменения
cat .env | grep -E '(AUTH_JWKS_URL|AUTH_WELLKNOWN_URL|AUTH_URL)'
```

#### Шаг 2.2: Перезапустить контейнеры Canton Validator
```bash
cd /opt/canton-validator

# 1. Остановить все контейнеры
docker compose -f compose.yaml down

# 2. Запустить заново
docker compose -f compose.yaml up -d

# 3. Подождать 30 секунд
sleep 30

# 4. Проверить статус
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep splice-validator
```

#### Шаг 2.3: Проверить логи на ошибки
```bash
# Participant
docker logs splice-validator-participant-1 2>&1 | tail -30

# Validator
docker logs splice-validator-validator-1 2>&1 | tail -30

# Проверить на ошибки auth
docker logs splice-validator-participant-1 2>&1 | grep -i 'auth\|jwks\|error' | tail -10
docker logs splice-validator-validator-1 2>&1 | grep -i 'auth\|jwks\|error' | tail -10
```

**Ожидаемый результат**: 
- Нет ошибок "empty string" для auth
- Контейнеры запускаются и работают
- Логи показывают успешное подключение

---

### Этап 3: Проверить полную работоспособность

#### Шаг 3.1: Проверить все контейнеры
```bash
cd /opt/canton-validator

# Проверить статус всех контейнеров
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep splice-validator

# Ожидаемый результат:
# splice-validator-postgres-splice-1   Up (healthy)   5432/tcp
# splice-validator-participant-1       Up (healthy)   5001/tcp, 5002/tcp
# splice-validator-validator-1        Up (healthy)   5003/tcp, 10013/tcp
# splice-validator-wallet-web-ui-1    Up (healthy)   8080/tcp
# splice-validator-ans-web-ui-1       Up (healthy)   8080/tcp
# splice-validator-nginx-1            Up             0.0.0.0:80->80/tcp
```

#### Шаг 3.2: Проверить подключение к DevNet
```bash
# Проверить логи validator на подключение к DevNet
docker logs splice-validator-validator-1 2>&1 | grep -i 'sv-1.dev\|scan\|onboard\|connected' | tail -10

# Проверить логи participant
docker logs splice-validator-participant-1 2>&1 | grep -i 'connected\|ready\|started' | tail -10
```

#### Шаг 3.3: Проверить health checks
```bash
# PostgreSQL
docker exec splice-validator-postgres-splice-1 pg_isready -U postgres

# Nginx
curl -I http://localhost:80

# Проверить доступность UI
curl -I http://localhost:80/wallet
curl -I http://localhost:80/ans
```

#### Шаг 3.4: Проверить systemd service
```bash
# Проверить статус
systemctl status canton-validator.service

# Проверить логи
journalctl -u canton-validator.service -n 50 --no-pager

# Включить автозапуск (если еще не включен)
systemctl enable canton-validator.service
```

---

## 📝 КОНФИГУРАЦИИ И ФАЙЛЫ

### Текущая конфигурация .env (на сервере 65.108.15.30):

```bash
# ========================================
# CRITICAL: Docker Image Versions
# ========================================
NGINX_VERSION=1.27.3
SPLICE_POSTGRES_VERSION=16.6
IMAGE_TAG=0.5.8
IMAGE_REPO=ghcr.io/digital-asset/decentralized-canton-sync/docker/

# ========================================
# Canton Core Configuration
# ========================================
SPONSOR_SV_ADDRESS=https://sv.sv-1.dev.global.canton.network.sync.global
SCAN_ADDRESS=https://scan.sv-1.dev.global.canton.network.sync.global
ONBOARDING_SECRET=$ONBOARDING_SECRET
PARTY_HINT=gyber-validator
MIGRATION_ID=0
PARTICIPANT_IDENTIFIER=

# ========================================
# Database Configuration
# ========================================
SPLICE_DB_SERVER=postgres-splice
SPLICE_DB_USER=postgres
SPLICE_DB_PASSWORD=canton_secure_password
SPLICE_DB_PORT=5432

# ========================================
# OAuth/Auth Configuration (Supabase Auth)
# ========================================
AUTH_WELLKNOWN_URL=https://api.1otc.cc/auth/v1/.well-known/openid-configuration
AUTH_JWKS_URL=https://api.1otc.cc/auth/v1/jwks
AUTH_URL=https://api.1otc.cc/auth/v1
LEDGER_API_AUTH_AUDIENCE=authenticated
LEDGER_API_AUTH_SCOPE=
LEDGER_API_ADMIN_USER=admin
WALLET_ADMIN_USER=admin
VALIDATOR_AUTH_CLIENT_ID=
VALIDATOR_AUTH_CLIENT_SECRET=
VALIDATOR_AUTH_AUDIENCE=authenticated
WALLET_UI_CLIENT_ID=
ANS_UI_CLIENT_ID=

# ========================================
# Docker Network
# ========================================
DOCKER_NETWORK=splice_validator
```

**ВАЖНО**: Если домен `api.1otc.cc` не резолвится, заменить на:
```bash
AUTH_JWKS_URL=http://65.108.15.30:8000/auth/v1/jwks
AUTH_WELLKNOWN_URL=http://65.108.15.30:8000/auth/v1/.well-known/openid-configuration
AUTH_URL=http://65.108.15.30:8000/auth/v1
```

---

### Файлы на сервере:

```
/opt/canton-validator/
├── compose.yaml              # ✅ Исправлен (убрано postgres-entrypoint.sh mount)
├── compose.yaml.clean        # Оригинальный из образа
├── compose.yaml.backup.*     # Backup'ы
├── .env                      # ✅ Настроен с auth переменными
├── nginx.conf                # ✅ Создан (proxy для UI и validator)
├── postgres-entrypoint.sh    # Существует, но не используется
├── nginx/                    # Директория для includes
└── data/                     # Данные PostgreSQL
```

---

### Kubernetes конфигурации:

**Расположение**: `k8s/supabase/`

**Файлы**:
1. `namespace.yaml` - ✅ Создан namespace `supabase`
2. `postgres-statefulset.yaml` - ✅ Исправлен (securityContext, nodeSelector)
3. `kong-deployment.yaml` - ✅ Исправлен (externalIPs, nodeSelector, память 1Gi)
4. `supabase-services.yaml` - ✅ Исправлен (nodeSelector для всех Deployment'ов, API_EXTERNAL_URL)
5. `ingress.yaml` - ✅ Создан (host: api.1otc.cc)

**Все сервисы настроены на ноду**: `canton-node-65-108-15-30`

---

## 🔍 ДИАГНОСТИЧЕСКИЕ КОМАНДЫ

### Проверка Supabase:

```bash
# 1. Статус всех подов
kubectl get pods -n supabase -o wide

# 2. Проверить, что все на нужной ноде
kubectl get pods -n supabase -o wide | grep -v 'canton-node-65-108-15-30' | grep -v '^NAME'
# Должно быть пусто

# 3. Проверить сервисы
kubectl get svc -n supabase

# 4. Проверить Kong Service
kubectl get svc -n supabase kong -o yaml | grep -A 5 externalIPs
# Должно быть: externalIPs: [65.108.15.30]

# 5. Проверить Ingress
kubectl get ingress -n supabase

# 6. Логи проблемных сервисов
kubectl logs -n supabase postgres-0 --tail=50
kubectl logs -n supabase -l app=kong --tail=50
kubectl logs -n supabase -l app=supabase-auth --tail=50
```

### Проверка Canton Validator:

```bash
# На сервере 65.108.15.30
ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30
cd /opt/canton-validator

# 1. Статус контейнеров
docker ps -a --format 'table {{.Names}}\t{{.Status}}' | grep splice-validator

# 2. Проверить compose.yaml
docker compose -f compose.yaml config > /dev/null 2>&1 && echo "OK" || echo "ERROR"

# 3. Логи participant
docker logs splice-validator-participant-1 2>&1 | tail -30

# 4. Логи validator
docker logs splice-validator-validator-1 2>&1 | tail -30

# 5. Проверить ошибки auth
docker logs splice-validator-participant-1 2>&1 | grep -i 'auth.*empty\|jwks.*empty\|auth.*error' | tail -5
docker logs splice-validator-validator-1 2>&1 | grep -i 'auth.*empty\|jwks.*empty\|auth.*error' | tail -5

# 6. Проверить подключение к PostgreSQL
docker exec splice-validator-postgres-splice-1 pg_isready -U postgres

# 7. Проверить доступность JWKS
curl -v http://localhost:8000/auth/v1/jwks 2>&1 | head -20
# или
curl -v http://65.108.15.30:8000/auth/v1/jwks 2>&1 | head -20
```

---

## ⚠️ ВАЖНЫЕ ЗАМЕЧАНИЯ

### 1. Порядок запуска критичен:
1. **PostgreSQL** (Supabase) - должен запуститься первым
2. **supabase-auth** - зависит от PostgreSQL
3. **Kong** - может запускаться параллельно
4. **PostgreSQL** (Canton) - должен запуститься
5. **participant** - зависит от PostgreSQL (Canton) и требует auth
6. **validator** - зависит от participant и PostgreSQL (Canton)

### 2. Auth конфигурация:
- Если домен `api.1otc.cc` не доступен, использовать IP: `http://65.108.15.30:8000`
- Обновить `.env` файл соответственно
- Перезапустить контейнеры после изменения `.env`

### 3. Права доступа PostgreSQL:
- PostgreSQL требует пользователя 999 (postgres)
- Если проблема с правами сохраняется после удаления PVC, проверить:
  ```bash
  kubectl describe pvc postgres-storage-postgres-0 -n supabase
  ```

### 4. Память Kong:
- Увеличена до 1Gi limit
- Если все еще OOMKilled, увеличить до 2Gi в `kong-deployment.yaml`

### 5. Все сервисы на одной ноде:
- Все поды Supabase должны быть на `canton-node-65-108-15-30`
- Это обеспечивает, что трафик идет через IP 65.108.15.30
- Проверить: `kubectl get pods -n supabase -o wide | grep -v canton-node-65-108-15-30`

---

## 🚨 ТИПИЧНЫЕ ПРОБЛЕМЫ И РЕШЕНИЯ

### Проблема 1: PostgreSQL не запускается (wrong ownership)

**Симптомы**: CrashLoopBackOff, ошибка "data directory has wrong ownership"

**Решение**:
```bash
kubectl delete statefulset postgres -n supabase
kubectl delete pvc postgres-storage-postgres-0 -n supabase
kubectl apply -f k8s/supabase/postgres-statefulset.yaml
kubectl wait --for=condition=ready pod -l app=postgres -n supabase --timeout=300s
```

### Проблема 2: supabase-auth не может подключиться к PostgreSQL

**Симптомы**: Error, "connection refused" в логах

**Решение**:
- Убедиться, что PostgreSQL запущен: `kubectl get pods -n supabase postgres-0`
- Проверить Service: `kubectl get svc -n supabase postgres`
- Подождать 30 секунд после запуска PostgreSQL

### Проблема 3: Kong OOMKilled

**Симптомы**: Pod перезапускается, статус OOMKilled

**Решение**: 
- Уже исправлено - память 1Gi. Если проблема сохраняется:
```bash
# Увеличить до 2Gi в k8s/supabase/kong-deployment.yaml
# limits: memory: "2Gi"
kubectl apply -f k8s/supabase/kong-deployment.yaml
kubectl delete pod -n supabase -l app=kong
```

### Проблема 4: JWKS endpoint недоступен

**Симптомы**: curl возвращает ошибку или таймаут

**Решение**:
```bash
# 1. Проверить, что Kong работает
kubectl get pods -n supabase -l app=kong

# 2. Проверить Service
kubectl get svc -n supabase kong
# Должно быть: externalIPs: [65.108.15.30]

# 3. Проверить доступность с ноды
ssh root@65.108.15.30 "curl -v http://localhost:8000/auth/v1/jwks"

# 4. Если Kong работает, но endpoint недоступен, проверить конфигурацию
kubectl get configmap -n supabase kong-declarative-config -o yaml | grep -A 10 auth-v1
```

### Проблема 5: Canton participant требует auth (empty string)

**Симптомы**: Ошибка `canton.participants.participant.ledger-api.auth-services.0.url` - пустая строка

**Решение**:
```bash
# 1. Проверить доступность JWKS
curl http://65.108.15.30:8000/auth/v1/jwks

# 2. Обновить .env с правильным URL (если нужно)
cd /opt/canton-validator
sed -i 's|AUTH_JWKS_URL=.*|AUTH_JWKS_URL=http://65.108.15.30:8000/auth/v1/jwks|g' .env

# 3. Перезапустить контейнеры
docker compose -f compose.yaml down
docker compose -f compose.yaml up -d

# 4. Проверить логи
docker logs splice-validator-participant-1 2>&1 | tail -30
```

### Проблема 6: Canton validator требует auth (empty string)

**Симптомы**: Ошибка `canton.validator-apps.validator_backend.auth.jwks-url` - пустая строка

**Решение**: То же, что для participant (см. Проблема 5)

### Проблема 7: Контейнеры в статусе "Created" не запускаются

**Симптомы**: `docker ps` показывает статус "Created" вместо "Up"

**Решение**:
```bash
# 1. Проверить ошибки
docker inspect splice-validator-participant-1 --format '{{.State.Error}}'
docker inspect splice-validator-validator-1 --format '{{.State.Error}}'

# 2. Попробовать запустить вручную
docker start splice-validator-participant-1
docker start splice-validator-validator-1

# 3. Проверить логи
docker logs splice-validator-participant-1 2>&1 | tail -20
```

---

## ✅ ЧЕКЛИСТ ПОЛНОГО ЗАВЕРШЕНИЯ

### Supabase:
- [ ] PostgreSQL запущен и работает (Ready 1/1)
- [ ] Kong запущен и работает (Ready 1/1)
- [ ] supabase-auth запущен и работает (Ready 1/1)
- [ ] supabase-rest запущен и работает (Ready 1/1 или 2/2)
- [ ] supabase-realtime запущен и работает (Ready 1/1)
- [ ] Все поды Supabase на ноде `canton-node-65-108-15-30`
- [ ] Kong Service имеет externalIPs: [65.108.15.30]
- [ ] JWKS endpoint доступен: `http://65.108.15.30:8000/auth/v1/jwks`

### Canton Validator:
- [ ] PostgreSQL (Canton) запущен и работает (healthy)
- [ ] participant запущен и работает (healthy)
- [ ] validator запущен и работает (healthy)
- [ ] wallet-web-ui запущен и работает (healthy)
- [ ] ans-web-ui запущен и работает (healthy)
- [ ] nginx запущен и работает
- [ ] .env файл обновлен с правильным AUTH_JWKS_URL
- [ ] Нет ошибок auth в логах participant
- [ ] Нет ошибок auth в логах validator
- [ ] Все health checks проходят
- [ ] Systemd service активен

### DevNet подключение:
- [ ] Validator подключается к SPONSOR_SV_ADDRESS
- [ ] Validator подключается к SCAN_ADDRESS
- [ ] Нет ошибок подключения в логах
- [ ] Validator зарегистрирован в DevNet (проверить через логи)

---

## 🎯 ФИНАЛЬНАЯ ЦЕЛЬ

**Полностью работоспособный Canton Validator Node в DevNet с:**
1. ✅ Все контейнеры запущены и работают
2. ✅ Supabase Auth доступен и работает
3. ✅ Аутентификация настроена и работает
4. ✅ Подключение к DevNet установлено
5. ✅ Все сервисы доступны через правильный IP (65.108.15.30)
6. ✅ Systemd service настроен для автозапуска

---

## 📊 ТЕКУЩИЙ СТАТУС (на момент создания промпта)

### Supabase:
```bash
# Выполнить для получения актуального статуса:
kubectl get pods -n supabase -o wide
kubectl get svc -n supabase
kubectl get ingress -n supabase
```

**Ожидаемый статус после исправления**:
- postgres-0: Running (Ready 1/1)
- kong-*: Running (Ready 1/1)
- supabase-auth-*: Running (Ready 1/1)
- supabase-rest-*: Running (Ready 2/2)
- supabase-realtime-*: Running (Ready 1/1)

### Canton Validator:
```bash
# На сервере 65.108.15.30
ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30
cd /opt/canton-validator
docker ps -a --format 'table {{.Names}}\t{{.Status}}' | grep splice-validator
```

**Ожидаемый статус после исправления**:
- splice-validator-postgres-splice-1: Up (healthy)
- splice-validator-participant-1: Up (healthy)
- splice-validator-validator-1: Up (healthy)
- splice-validator-wallet-web-ui-1: Up (healthy)
- splice-validator-ans-web-ui-1: Up (healthy)
- splice-validator-nginx-1: Up

---

## 🔗 ССЫЛКИ И ПУТИ

- **SSH**: `ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30`
- **Директория валидатора**: `/opt/canton-validator`
- **Systemd service**: `/etc/systemd/system/canton-validator.service`
- **Логи systemd**: `journalctl -u canton-validator.service -f`
- **Kubernetes namespace**: `supabase`
- **Kubernetes нода**: `canton-node-65-108-15-30` (IP: 65.108.15.30)
- **Kong Service**: `kong.supabase:8000` (внутри кластера) или `65.108.15.30:8000` (снаружи)
- **JWKS endpoint**: `http://65.108.15.30:8000/auth/v1/jwks`
- **DevNet API**: `https://sv.sv-1.dev.global.canton.network.sync.global`

---

## 🚀 ИНСТРУКЦИИ ДЛЯ AI

**Ты должен:**

1. **Исправить PostgreSQL в Supabase** - удалить PVC и пересоздать с правильными правами
2. **Проверить запуск supabase-auth** - убедиться что подключается к PostgreSQL
3. **Проверить Kong** - убедиться что работает и доступен на 65.108.15.30:8000
4. **Проверить доступность JWKS** - curl должен возвращать JSON с ключами
5. **Обновить .env Canton Validator** - использовать правильный URL для JWKS (IP если домен не работает)
6. **Перезапустить контейнеры Canton** - убедиться что все запускаются
7. **Проверить логи** - нет ошибок auth, все работает
8. **Проверить подключение к DevNet** - validator должен подключаться к DevNet
9. **Проверить systemd service** - должен быть активен и работать

**Важно:**
- Все сервисы Supabase должны быть на ноде `canton-node-65-108-15-30`
- Трафик должен идти через IP 65.108.15.30 (не через российские IP)
- Проверять каждый шаг перед следующим
- Показывать результаты команд
- Объяснять что делаешь и почему

**Формат работы:**
- Выполняй команды через kubectl и SSH
- Показывай результаты каждой команды
- Проверяй успешность каждого шага
- Исправляй проблемы по мере их обнаружения
- Документируй что сделано

---

**Дата создания**: 28 ноября 2025  
**Приоритет**: КРИТИЧЕСКИЙ  
**Следующий шаг**: Исправить PostgreSQL в Supabase (удалить PVC и пересоздать)

---

## 📝 ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ

### Структура Docker Compose стека:

1. **postgres-splice** - PostgreSQL для Canton (порт 5432)
2. **participant** - Canton Participant (порты 5001, 5002)
3. **validator** - Canton Validator App (порты 5003, 10013)
4. **wallet-web-ui** - Web UI для кошелька (порт 8080)
5. **ans-web-ui** - Web UI для ANS (порт 8080)
6. **nginx** - Reverse proxy (порт 80)

### Зависимости:
- participant зависит от postgres-splice (health check)
- validator зависит от participant и postgres-splice
- nginx зависит от wallet-web-ui, ans-web-ui, validator
- Все требуют auth (AUTH_JWKS_URL должен быть доступен)

### Порты:
- **80** - Nginx (доступен снаружи)
- **5432** - PostgreSQL (только внутри сети)
- **5001** - Participant Ledger API (только внутри сети)
- **5002** - Participant Admin API (только внутри сети)
- **5003** - Validator API (только внутри сети)
- **10013** - Validator Metrics (только внутри сети)
- **8000** - Kong (Supabase, доступен снаружи через 65.108.15.30)

---

**КОНЕЦ ПРОМПТА**





