# 🚀 ПОЛНЫЙ САМОДОСТАТОЧНЫЙ ПРОМПТ: Canton Validator Node DevNet

**Дата создания**: 28 ноября 2025  
**Приоритет**: КРИТИЧЕСКИЙ  
**Версия**: 2.0 (Финальная)  
**Статус**: Готов к выполнению

---

## 📋 EXECUTIVE SUMMARY

Этот документ содержит **ВСЮ** информацию для полного развертывания Canton Validator Node в DevNet с Supabase Auth. Документ самодостаточен и не требует дополнительного контекста.

### 🎯 Цель
Запустить полностью работоспособный Canton Validator Node в DevNet с:
- ✅ Supabase Auth для аутентификации
- ✅ Kong API Gateway для маршрутизации
- ✅ PostgreSQL для хранения данных
- ✅ JWKS endpoint для Canton
- ✅ Подключение к DevNet

### 📊 Текущий статус (на момент создания)
- 🟡 Supabase PostgreSQL: Может иметь проблемы с правами
- 🟢 Kong: Работает, но внешний доступ не настроен
- 🟢 JWKS сервис: Работает внутри кластера
- 🟡 Canton Validator: Контейнеры запущены, но могут быть проблемы с auth
- 🔴 Внешний доступ JWKS: Не работает через 65.108.15.30:30080

---

## 🏗️ АРХИТЕКТУРА СИСТЕМЫ

### ⚠️ ВАЖНО: Архитектура развертывания

**КРИТИЧЕСКИ ВАЖНО ПОНИМАТЬ разницу между компонентами системы:**

#### 🐳 Canton Validator Node (Docker Compose на СЕРВЕРЕ)
**Развертывание**: Напрямую на сервере 65.108.15.30 через Docker Compose
**Доступ**: SSH к серверу (`ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30`)
**Управление**: `docker compose` команды в директории `/opt/canton-validator`

**Компоненты**:
- Canton Participant (порты 5001, 5002)
- Canton Validator (порты 5003, 10013)
- PostgreSQL Canton (порт 5432)
- Wallet Web UI (порт 8080)
- ANS Web UI (порт 8080)
- Nginx reverse proxy (порт 80)

#### ☸️ Supabase Auth (Kubernetes кластер)
**Развертывание**: В Kubernetes namespace `supabase`
**Доступ**: Локальный терминал через `kubectl` (БЕЗ SSH)
**Управление**: `kubectl` команды из вашей локальной машины

**Компоненты**:
- PostgreSQL Supabase (StatefulSet)
- Kong API Gateway (Deployment)
- Supabase Auth (Deployment)
- PostgREST (Deployment)
- Realtime (Deployment)
- JWKS Service (Deployment)

#### 🔄 Взаимодействие компонентов

```
┌─────────────────────────────────────────────────────────────┐
│ СЕРВЕР: 65.108.15.30                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ ☸️ KUBERNETES (управление через kubectl локально)   │   │
│ │ Namespace: supabase                                 │   │
│ │ Нода: canton-node-65-108-15-30                      │   │
│ │                                                     │   │
│ │  ┌──────────┐  ┌──────────┐  ┌────────────────┐   │   │
│ │  │PostgreSQL│  │   Kong   │  │ Supabase Auth  │   │   │
│ │  │  (5432)  │  │LoadBal.  │  │    (9999)      │   │   │
│ │  └──────────┘  │  :8000   │  └────────────────┘   │   │
│ │                └─────┬────┘                        │   │
│ │  ┌──────────┐  ┌─────┴────┐  ┌────────────────┐   │   │
│ │  │   JWKS   │  │PostgREST │  │   Realtime     │   │   │
│ │  │  (8080)  │  │  (3000)  │  │    (4000)      │   │   │
│ │  └──────────┘  └──────────┘  └────────────────┘   │   │
│ └──────────────────────────┬──────────────────────────┘   │
│                            │ JWKS: http://65.108.15.30:8000│
│ ┌──────────────────────────┴──────────────────────────┐   │
│ │ 🐳 DOCKER COMPOSE (управление через SSH к серверу)  │   │
│ │ Директория: /opt/canton-validator                  │   │
│ │                                                     │   │
│ │  ┌──────────┐  ┌─────────────┐  ┌──────────────┐  │   │
│ │  │PostgreSQL│→→│ Participant  │→→│  Validator   │  │   │
│ │  │  Canton  │  │   (5001)     │  │   (5003)     │  │   │
│ │  └──────────┘  └──────┬──────┘  └──────────────┘  │   │
│ │                       │ AUTH                        │   │
│ │  ┌───────┐  ┌─────────┐  ┌──────────────────────┐ │   │
│ │  │ Nginx │  │Wallet UI│  │     ANS UI           │ │   │
│ │  │  (80) │  │  (8080) │  │     (8080)           │ │   │
│ │  └───────┘  └─────────┘  └──────────────────────┘ │   │
│ └─────────────────────────────────────────────────────┘   │
│                                                             │
│ 📡 Auth Flow: Canton → Kong (8000) → JWKS Service          │
│ 📡 DevNet: Canton → sv.sv-1.dev.global.canton.network      │
└─────────────────────────────────────────────────────────────┘
```

### 📋 Workflow развертывания

**ДЛЯ KUBERNETES (Supabase):**
```bash
# На ВАШЕЙ локальной машине (БЕЗ SSH к серверу!)
kubectl get pods -n supabase
kubectl apply -f k8s/supabase/postgres-statefulset.yaml
kubectl logs -n supabase postgres-0
```

**ДЛЯ CANTON VALIDATOR (Docker Compose):**
```bash
# SSH к серверу ОБЯЗАТЕЛЕН
ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30
cd /opt/canton-validator
docker compose up -d
docker logs splice-validator-validator-1
```

### 🔑 Ключевые отличия

| Аспект | Kubernetes (Supabase) | Docker Compose (Canton) |
|--------|----------------------|------------------------|
| **Расположение** | Кластер K3s на сервере | Хост сервера |
| **Управление** | kubectl с локальной машины | docker compose через SSH |
| **Доступ** | Локальный терминал | SSH обязателен |
| **Namespace** | supabase | - |
| **Конфигурация** | YAML манифесты в `k8s/supabase/` | `compose.yaml` + `.env` |
| **Логи** | `kubectl logs` | `docker logs` |
| **Перезапуск** | `kubectl delete pod` | `docker compose restart` |

### Инфраструктура (детально)

### Сетевая архитектура
- **Внешний IP**: `65.108.15.30`
- **Kong NodePort**: `30080` (внешний доступ: `65.108.15.30:30080`)
- **JWKS URL**: `http://65.108.15.30:30080/auth/v1/jwks`
- **DevNet Sponsor SV**: `https://sv.sv-1.dev.global.canton.network.sync.global`
- **DevNet Scan**: `https://scan.sv-1.dev.global.canton.network.sync.global`

---

## 🔐 КРИТИЧЕСКИЕ ПАРАМЕТРЫ

### SSH Доступ
```bash
ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30
```

### DevNet Конфигурация
```bash
SPONSOR_SV_ADDRESS="https://sv.sv-1.dev.global.canton.network.sync.global"
SCAN_ADDRESS="https://scan.sv-1.dev.global.canton.network.sync.global"
ONBOARDING_SECRET="$ONBOARDING_SECRET"
PARTY_HINT="gyber-validator"
MIGRATION_ID="0"
```

### Docker Образы
```bash
IMAGE_REPO="ghcr.io/digital-asset/decentralized-canton-sync/docker/"
IMAGE_TAG="0.5.8"
NGINX_VERSION="1.27.3"
SPLICE_POSTGRES_VERSION="16.6"
```

### Пароли и Секреты (ВАЖНО!)
```bash
# PostgreSQL Supabase
POSTGRES_PASSWORD="your-super-secret-password-change-me"
JWT_SECRET="your-jwt-secret-at-least-32-characters-long"

# PostgreSQL Canton
SPLICE_DB_PASSWORD="canton_secure_password"

# Auth Audience
LEDGER_API_AUTH_AUDIENCE="authenticated"
VALIDATOR_AUTH_AUDIENCE="authenticated"
```

---

## 📁 РАСПОЛОЖЕНИЕ ФАЙЛОВ

### На сервере (65.108.15.30)
```
/opt/canton-validator/
├── compose.yaml              # Docker Compose конфигурация
├── .env                      # Переменные окружения
├── nginx.conf                # Nginx конфигурация
├── data/                     # Данные PostgreSQL Canton
└── postgres-entrypoint.sh    # Скрипт инициализации (не используется)
```

### В репозитории
```
k8s/supabase/
├── namespace.yaml            # Namespace supabase
├── postgres-statefulset.yaml # PostgreSQL StatefulSet
├── kong-deployment.yaml      # Kong API Gateway
├── supabase-services.yaml    # Auth, REST, Realtime, Meta
├── jwks-service.yaml         # JWKS endpoint сервис
└── ingress.yaml              # Ingress (опционально)
```

---

## 🔧 ПОЛНОЕ РЕШЕНИЕ: ПОШАГОВЫЙ ПЛАН

### ЭТАП 1: Диагностика текущего состояния (15 минут)

#### Шаг 1.1: Проверка Kubernetes кластера (kubectl локально)

**🖥️ ВЫПОЛНЯЕМ НА ВАШЕЙ ЛОКАЛЬНОЙ МАШИНЕ (БЕЗ SSH!)**

```bash
# ⚠️ Эти команды выполняются в вашем ЛОКАЛЬНОМ терминале
# НЕ нужно подключаться к серверу через SSH!

# Проверить подключение к кластеру
kubectl cluster-info

# Проверить namespace supabase
kubectl get namespace supabase

# Проверить все поды Supabase
kubectl get pods -n supabase -o wide

# Проверить сервисы
kubectl get svc -n supabase -o wide
```

**Ожидаемый результат**:
- kubectl подключен к кластеру
- Namespace supabase существует
- Все поды должны быть на ноде `canton-node-65-108-15-30`

---

#### Шаг 1.2: Диагностика проблемных подов (kubectl локально)

**🖥️ ВЫПОЛНЯЕМ НА ВАШЕЙ ЛОКАЛЬНОЙ МАШИНЕ (БЕЗ SSH!)**

```bash
# ⚠️ Все команды kubectl выполняются локально

# Проверить PostgreSQL
kubectl describe pod -n supabase postgres-0
kubectl logs -n supabase postgres-0 --tail=50

# Проверить Kong
kubectl describe pod -n supabase -l app=kong
kubectl logs -n supabase -l app=kong --tail=50

# Проверить Auth
kubectl describe pod -n supabase -l app=supabase-auth
kubectl logs -n supabase -l app=supabase-auth --tail=50

# Проверить JWKS
kubectl describe pod -n supabase -l app=supabase-jwks
kubectl logs -n supabase -l app=supabase-jwks --tail=30
```

**Что искать**:
- PostgreSQL: `CrashLoopBackOff` → проблема с правами
- Auth: `connection refused` → PostgreSQL не готов
- Kong: `OOMKilled` → нехватка памяти
- JWKS: Должен быть `Running`

---

#### Шаг 1.3: Проверка Canton Validator (SSH к серверу)

**🔐 ВЫПОЛНЯЕМ НА СЕРВЕРЕ ЧЕРЕЗ SSH**

```bash
# Подключиться к серверу
ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30

# Перейти в директорию Canton Validator
cd /opt/canton-validator

# Проверить статус контейнеров
docker ps -a --format 'table {{.Names}}\t{{.Status}}' | grep splice-validator

# Проверить логи participant
docker logs splice-validator-participant-1 2>&1 | tail -30

# Проверить логи validator
docker logs splice-validator-validator-1 2>&1 | tail -30

# Проверить ошибки auth
docker logs splice-validator-participant-1 2>&1 | grep -i 'auth\|jwks\|error' | tail -10
docker logs splice-validator-validator-1 2>&1 | grep -i 'auth\|jwks\|error' | tail -10
```

**Что искать**:
- Статус "Created" → контейнер не запускается
- Ошибки с `empty string` для auth → JWKS недоступен
- Ошибки подключения к PostgreSQL → база не готова

---

#### 📊 Сводка по доступу

| Компонент | Где выполнять | Команды |
|-----------|---------------|---------|
| **Kubernetes (Supabase)** | 🖥️ Локальный терминал | `kubectl get pods -n supabase` |
| **Canton Validator** | 🔐 SSH к серверу | `ssh ... && docker ps` |
| **Kubernetes логи** | 🖥️ Локальный терминал | `kubectl logs -n supabase ...` |
| **Canton логи** | 🔐 SSH к серверу | `docker logs ...` |

---

### ЭТАП 2: Исправление PostgreSQL Supabase (20 минут)

#### Проблема
PostgreSQL может иметь ошибку `data directory has wrong ownership` из-за неправильных прав на PVC.

#### Решение

##### Шаг 2.1: Проверить статус PostgreSQL
```bash
kubectl get pods -n supabase postgres-0
kubectl logs -n supabase postgres-0 --tail=20
```

Если видим `CrashLoopBackOff` или ошибку про ownership:

##### Шаг 2.2: Удалить StatefulSet (НЕ удаляет PVC)
```bash
kubectl delete statefulset postgres -n supabase --cascade=orphan
```

##### Шаг 2.3: Удалить PVC (УДАЛИТ данные)
```bash
# ⚠️ ВАЖНО: Это удалит все данные PostgreSQL!
# Для первого развертывания это нормально

kubectl delete pvc postgres-storage-postgres-0 -n supabase
```

##### Шаг 2.4: Применить исправленный StatefulSet
```bash
# Текущий StatefulSet уже содержит initContainer для исправления прав
kubectl apply -f - <<'EOF'
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: supabase
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      securityContext:
        fsGroup: 999
      initContainers:
      - name: fix-permissions
        image: busybox:1.36
        command: ['sh', '-c']
        args:
          - |
            echo "Starting permission fix..."
            echo "Current user: $(id)"
            mkdir -p /var/lib/postgresql/data
            chown -R root:root /var/lib/postgresql/data
            chmod -R 755 /var/lib/postgresql/data
            echo "Permission fix completed"
        securityContext:
          runAsUser: 0
          runAsGroup: 0
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
      containers:
      - name: postgres
        image: supabase/postgres:15.1.0.117
        ports:
        - containerPort: 5432
          name: postgres
        envFrom:
        - configMapRef:
            name: postgres-config
        - secretRef:
            name: postgres-secret
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - supabase
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - supabase
          initialDelaySeconds: 5
          periodSeconds: 5
      nodeSelector:
        kubernetes.io/hostname: canton-node-65-108-15-30
  volumeClaimTemplates:
  - metadata:
      name: postgres-storage
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 20Gi
EOF
```

##### Шаг 2.5: Дождаться готовности PostgreSQL
```bash
# Подождать до 5 минут
kubectl wait --for=condition=ready pod -l app=postgres -n supabase --timeout=300s

# Проверить логи
kubectl logs -n supabase postgres-0 --tail=30
```

**Ожидаемый результат**:
```
database system is ready to accept connections
```

##### Шаг 2.6: Инициализировать схему Auth
```bash
# Выполнить SQL для создания схемы auth
kubectl exec -n supabase postgres-0 -- psql -U supabase -d supabase -c "
CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO supabase;
GRANT ALL ON SCHEMA auth TO supabase;
"

# Проверить
kubectl exec -n supabase postgres-0 -- psql -U supabase -d supabase -c "\dn"
```

---

### ЭТАП 3: Проверка и исправление Supabase сервисов (15 минут)

#### Шаг 3.1: Проверить supabase-auth
```bash
# Подождать 30 секунд после запуска PostgreSQL
sleep 30

# Проверить статус
kubectl get pods -n supabase -l app=supabase-auth

# Если ошибки, проверить логи
kubectl logs -n supabase -l app=supabase-auth --tail=50
```

**Возможные проблемы**:
- `connection refused` → PostgreSQL еще не готов (подождать еще)
- `secret not found` → нужно создать RSA ключи

#### Шаг 3.2: Создать RSA ключи для Auth (если нужно)
```bash
# Проверить, существует ли секрет
kubectl get secret -n supabase auth-rsa-keys

# Если не существует, создать
ssh-keygen -t rsa -b 2048 -m PEM -f /tmp/jwt-key -N ""

# Создать секрет
kubectl create secret generic auth-rsa-keys \
  --from-file=private_key=/tmp/jwt-key \
  --from-file=public_key=/tmp/jwt-key.pub \
  -n supabase

# Удалить временные файлы
rm /tmp/jwt-key /tmp/jwt-key.pub

# Перезапустить Auth
kubectl delete pod -n supabase -l app=supabase-auth
```

#### Шаг 3.3: Проверить Kong
```bash
kubectl get pods -n supabase -l app=kong
kubectl logs -n supabase -l app=kong --tail=30
```

**Если OOMKilled**:
```bash
# Увеличить лимит памяти до 2Gi
kubectl patch deployment kong -n supabase -p '
{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "kong",
          "resources": {
            "limits": {
              "memory": "2Gi"
            }
          }
        }]
      }
    }
  }
}'

kubectl delete pod -n supabase -l app=kong
```

#### Шаг 3.4: Проверить JWKS сервис
```bash
kubectl get pods -n supabase -l app=supabase-jwks
kubectl logs -n supabase -l app=supabase-jwks --tail=20

# Проверить внутреннюю доступность
kubectl run -it --rm --restart=Never test-jwks \
  --image=curlimages/curl:latest \
  --namespace=supabase \
  -- curl -s http://supabase-jwks:8080/jwks

# Должен вернуть JSON с ключами
```

---

### ЭТАП 4: Настройка внешнего доступа к JWKS (30 минут)

#### Проблема
JWKS endpoint не доступен снаружи через `65.108.15.30:30080`

#### Диагностика

##### Шаг 4.1: Проверить доступность изнутри кластера
```bash
# Через Service
kubectl run -it --rm --restart=Never test-kong \
  --image=curlimages/curl:latest \
  --namespace=supabase \
  -- curl -v http://kong:8000/auth/v1/jwks

# Должен вернуть JSON
```

##### Шаг 4.2: Проверить с ноды
```bash
# Подключиться к серверу если еще не подключены
ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30

# Проверить через localhost
curl -v http://127.0.0.1:30080/auth/v1/jwks

# Проверить через внешний IP
curl -v http://65.108.15.30:30080/auth/v1/jwks
```

##### Шаг 4.3: Проверить iptables
```bash
# Проверить правила iptables для порта 30080
iptables -t nat -L -n -v | grep 30080

# Проверить INPUT chain
iptables -L INPUT -n -v | grep 30080
```

#### Решение A: Использовать iptables для перенаправления порта 8000

Это самое простое решение - перенаправить входящий трафик с порта 8000 на NodePort 30080.

```bash
# На сервере 65.108.15.30

# 1. Очистить существующие правила для порта 8000 (если есть)
iptables -t nat -D PREROUTING -p tcp --dport 8000 -j REDIRECT --to-port 30080 2>/dev/null || true

# 2. Добавить правило перенаправления
iptables -t nat -A PREROUTING -p tcp --dport 8000 -j REDIRECT --to-port 30080

# 3. Разрешить входящие подключения на порт 8000
iptables -A INPUT -p tcp --dport 8000 -j ACCEPT

# 4. Сохранить правила (для Debian/Ubuntu)
iptables-save > /etc/iptables/rules.v4

# 5. Проверить
iptables -t nat -L PREROUTING -n -v | grep 8000

# 6. Проверить доступность
curl -v http://65.108.15.30:8000/auth/v1/jwks
```

**Плюсы**:
- ✅ Простое решение
- ✅ Использует порт 8000 (как было изначально)
- ✅ Не требует изменения Kong

**Минусы**:
- ⚠️ Требует настройки iptables
- ⚠️ Правила могут сброситься при перезагрузке (нужно сохранить)

#### Решение B: Использовать hostPort вместо NodePort

Более надежное решение - использовать hostPort для прямого биндинга порта на ноде.

```bash
# На сервере 65.108.15.30

# 1. Изменить Kong Deployment на hostPort
kubectl patch deployment kong -n supabase -p '
{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "kong",
          "ports": [
            {
              "containerPort": 8000,
              "hostPort": 8000,
              "name": "proxy",
              "protocol": "TCP"
            }
          ]
        }]
      }
    }
  }
}'

# 2. Изменить Service обратно на ClusterIP
kubectl patch svc kong -n supabase -p '{"spec":{"type":"ClusterIP"}}'

# 3. Дождаться перезапуска пода
kubectl rollout status deployment kong -n supabase

# 4. Проверить
curl -v http://65.108.15.30:8000/auth/v1/jwks
```

**Плюсы**:
- ✅ Надежное решение
- ✅ Не требует iptables
- ✅ Порт привязан напрямую к ноде

**Минусы**:
- ⚠️ Требует, чтобы порт 8000 был свободен на ноде
- ⚠️ Только один под Kong может работать на ноде

#### Решение C: Использовать LoadBalancer с MetalLB (PRODUCTION - РЕКОМЕНДУЕТСЯ) 🏆

**Самое правильное и надежное решение для production окружения**

Это решение использует MetalLB - industry-standard load balancer для bare metal Kubernetes кластеров. Обеспечивает высокую доступность, отказоустойчивость и правильную маршрутизацию трафика.

**Преимущества**:
- ✅ Native Kubernetes решение
- ✅ Высокая отказоустойчивость
- ✅ Автоматическое управление IP адресами
- ✅ Поддержка множественных сервисов
- ✅ Production-ready
- ✅ Легкое масштабирование

**Время установки**: 20-30 минут

---

##### Шаг C.1: Подготовка и проверка окружения

```bash
# Подключиться к серверу
ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30

# Проверить версию Kubernetes
kubectl version --short

# Проверить что IP адрес 65.108.15.30 доступен на интерфейсе
ip addr show | grep 65.108.15.30

# Проверить что порт 8000 свободен
netstat -tlnp | grep :8000
# Если порт занят - освободить или выбрать другой порт

# Проверить текущие сервисы типа LoadBalancer
kubectl get svc --all-namespaces | grep LoadBalancer
```

**Ожидаемый результат**:
- IP 65.108.15.30 присутствует на интерфейсе
- Порт 8000 свободен или может быть освобожден

---

##### Шаг C.2: Установка MetalLB

```bash
# 1. Создать namespace для MetalLB
kubectl create namespace metallb-system

# 2. Применить манифесты MetalLB (версия 0.14.3 - стабильная)
kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/v0.14.3/config/manifests/metallb-native.yaml

# 3. Подождать готовности подов MetalLB
kubectl wait --namespace metallb-system \
  --for=condition=ready pod \
  --selector=app=metallb \
  --timeout=90s

# 4. Проверить установку
kubectl get pods -n metallb-system

# Ожидаемый результат:
# NAME                          READY   STATUS    RESTARTS   AGE
# controller-xxxxxxxxxx-xxxxx    1/1     Running   0          30s
# speaker-xxxxx                  1/1     Running   0          30s
```

**Важно**: MetalLB состоит из двух компонентов:
- **controller** - управляет распределением IP адресов
- **speaker** - анонсирует IP адреса в сеть (L2 mode)

---

##### Шаг C.3: Конфигурация IPAddressPool

IPAddressPool определяет пул IP адресов, которые MetalLB может использовать для LoadBalancer сервисов.

```bash
# Создать конфигурацию IPAddressPool
cat <<EOF | kubectl apply -f -
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: canton-pool
  namespace: metallb-system
spec:
  addresses:
  # Указываем ОДИН IP адрес сервера
  - 65.108.15.30/32
  # Можно добавить диапазон если есть несколько IP:
  # - 65.108.15.30-65.108.15.35
  autoAssign: true
EOF

# Проверить создание
kubectl get ipaddresspool -n metallb-system canton-pool -o yaml
```

**Объяснение параметров**:
- `addresses`: Список IP адресов или CIDR блоков
- `/32` означает один конкретный IP адрес
- `autoAssign: true` - автоматически назначать IP из этого пула

---

##### Шаг C.4: Конфигурация L2Advertisement

L2Advertisement определяет как MetalLB будет анонсировать IP адреса в локальной сети.

```bash
# Создать L2Advertisement
cat <<EOF | kubectl apply -f -
apiVersion: metallb.io/v1beta1
kind: L2Advertisement
metadata:
  name: canton-l2-advert
  namespace: metallb-system
spec:
  ipAddressPools:
  - canton-pool
  # Опционально: можно указать конкретные интерфейсы
  # interfaces:
  # - eth0
  # - eth1
  # Опционально: можно указать конкретные ноды
  # nodeSelectors:
  # - matchLabels:
  #     kubernetes.io/hostname: canton-node-65-108-15-30
EOF

# Проверить создание
kubectl get l2advertisement -n metallb-system canton-l2-advert -o yaml
```

**Объяснение L2 mode**:
- Работает на уровне 2 (Data Link) OSI модели
- Speaker отправляет ARP/NDP ответы для виртуального IP
- Прост в настройке, не требует BGP
- Подходит для большинства случаев

---

##### Шаг C.5: Сохранить текущую конфигурацию Kong Service

```bash
# Сделать backup текущего Service
kubectl get svc kong -n supabase -o yaml > /tmp/kong-service-backup.yaml

# Сохранить на всякий случай
cat /tmp/kong-service-backup.yaml
```

---

##### Шаг C.6: Настроить Kong Service как LoadBalancer

```bash
# Создать новую конфигурацию Kong Service
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Service
metadata:
  name: kong
  namespace: supabase
  labels:
    app: kong
  annotations:
    # Опционально: указать какой IPAddressPool использовать
    metallb.universe.tf/address-pool: canton-pool
    # Опционально: принудительно использовать конкретный IP
    metallb.universe.tf/loadBalancerIPs: 65.108.15.30
spec:
  type: LoadBalancer
  # Запросить конкретный IP (если не указан - MetalLB выберет из пула)
  loadBalancerIP: 65.108.15.30
  # Разрешить трафик с любых IP
  loadBalancerSourceRanges:
  - 0.0.0.0/0
  # Использовать externalTrafficPolicy: Local для сохранения source IP
  externalTrafficPolicy: Local
  ports:
  - port: 8000
    targetPort: 8000
    protocol: TCP
    name: proxy
  - port: 8443
    targetPort: 8443
    protocol: TCP
    name: proxy-ssl
  selector:
    app: kong
EOF

# Подождать назначения IP (может занять до 60 секунд)
echo "Ожидание назначения External IP..."
kubectl wait --for=jsonpath='{.status.loadBalancer.ingress[0].ip}' \
  svc/kong -n supabase --timeout=60s

# Проверить Service
kubectl get svc kong -n supabase -o wide
```

**Ожидаемый результат**:
```
NAME   TYPE           CLUSTER-IP      EXTERNAL-IP     PORT(S)                      AGE
kong   LoadBalancer   10.43.xxx.xxx   65.108.15.30    8000:xxxxx/TCP,8443:xxxxx/TCP   1m
```

---

##### Шаг C.7: Детальная проверка работоспособности

```bash
# 1. Проверить что Service получил External IP
kubectl get svc kong -n supabase

# 2. Проверить endpoints
kubectl get endpoints kong -n supabase

# 3. Проверить события MetalLB
kubectl logs -n metallb-system -l app=metallb --tail=50 | grep kong

# 4. Проверить speaker logs
kubectl logs -n metallb-system -l component=speaker --tail=30

# 5. Проверить controller logs
kubectl logs -n metallb-system -l component=controller --tail=30
```

---

##### Шаг C.8: Проверить доступность JWKS endpoint

```bash
# С самого сервера (localhost)
curl -v http://127.0.0.1:8000/auth/v1/jwks

# Через External IP (с сервера)
curl -v http://65.108.15.30:8000/auth/v1/jwks

# Через External IP (с внешнего хоста - если доступно)
# curl -v http://65.108.15.30:8000/auth/v1/jwks

# Проверить JSON формат
curl -s http://65.108.15.30:8000/auth/v1/jwks | jq .

# Должен вернуть структуру типа:
# {
#   "keys": [
#     {
#       "kty": "RSA",
#       "kid": "...",
#       "use": "sig",
#       "n": "...",
#       "e": "AQAB"
#     }
#   ]
# }
```

**Если не работает** - см. раздел Troubleshooting MetalLB ниже.

---

##### Шаг C.9: Проверить маршрутизацию трафика

```bash
# Проверить что трафик идет через правильный под Kong
# 1. Получить имя пода Kong
KONG_POD=$(kubectl get pod -n supabase -l app=kong -o jsonpath='{.items[0].metadata.name}')

# 2. Сделать несколько запросов
for i in {1..5}; do
  curl -s http://65.108.15.30:8000/auth/v1/jwks > /dev/null
  echo "Request $i sent"
  sleep 1
done

# 3. Проверить логи Kong на эти запросы
kubectl logs -n supabase $KONG_POD --tail=20 | grep "GET /auth/v1/jwks"

# Должны видеть логи запросов
```

---

##### Шаг C.10: Настроить мониторинг доступности

```bash
# Создать простой health check скрипт
cat > /usr/local/bin/check-kong-health.sh <<'EOF'
#!/bin/bash
ENDPOINT="http://65.108.15.30:8000/auth/v1/jwks"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$ENDPOINT")

if [ "$RESPONSE" -eq 200 ]; then
    echo "$(date): Kong JWKS endpoint is healthy (HTTP $RESPONSE)"
    exit 0
else
    echo "$(date): Kong JWKS endpoint is DOWN (HTTP $RESPONSE)" >&2
    exit 1
fi
EOF

chmod +x /usr/local/bin/check-kong-health.sh

# Протестировать
/usr/local/bin/check-kong-health.sh

# Создать systemd timer для периодической проверки
cat > /etc/systemd/system/kong-health-check.service <<'EOF'
[Unit]
Description=Kong Health Check
After=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/check-kong-health.sh
StandardOutput=journal
StandardError=journal
EOF

cat > /etc/systemd/system/kong-health-check.timer <<'EOF'
[Unit]
Description=Kong Health Check Timer
Requires=kong-health-check.service

[Timer]
# Проверять каждые 5 минут
OnBootSec=1min
OnUnitActiveSec=5min

[Install]
WantedBy=timers.target
EOF

# Активировать timer
systemctl daemon-reload
systemctl enable kong-health-check.timer
systemctl start kong-health-check.timer

# Проверить статус
systemctl status kong-health-check.timer
```

---

##### Troubleshooting MetalLB

**Проблема 1: Service не получает External IP**

```bash
# Проверить статус MetalLB подов
kubectl get pods -n metallb-system

# Если поды не Running:
kubectl describe pod -n metallb-system -l app=metallb

# Проверить логи controller
kubectl logs -n metallb-system -l component=controller --tail=50

# Проверить конфигурацию IPAddressPool
kubectl get ipaddresspool -n metallb-system -o yaml

# Возможные причины:
# - IPAddressPool не создан
# - IP адрес не в правильном формате
# - Конфликт IP адресов
```

**Решение**:
```bash
# Пересоздать IPAddressPool
kubectl delete ipaddresspool -n metallb-system canton-pool
kubectl apply -f - <<EOF
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: canton-pool
  namespace: metallb-system
spec:
  addresses:
  - 65.108.15.30/32
  autoAssign: true
EOF
```

---

**Проблема 2: External IP назначен, но endpoint недоступен**

```bash
# Проверить speaker pods
kubectl get pods -n metallb-system -l component=speaker

# Проверить логи speaker
kubectl logs -n metallb-system -l component=speaker --tail=50

# Проверить ARP таблицу
arp -a | grep 65.108.15.30

# Проверить что speaker анонсирует IP
kubectl logs -n metallb-system -l component=speaker | grep "announcing"
```

**Решение**:
```bash
# Перезапустить speaker pods
kubectl delete pod -n metallb-system -l component=speaker

# Проверить L2Advertisement
kubectl get l2advertisement -n metallb-system -o yaml

# Если нужно - пересоздать
kubectl delete l2advertisement -n metallb-system canton-l2-advert
kubectl apply -f - <<EOF
apiVersion: metallb.io/v1beta1
kind: L2Advertisement
metadata:
  name: canton-l2-advert
  namespace: metallb-system
spec:
  ipAddressPools:
  - canton-pool
EOF
```

---

**Проблема 3: Конфликт портов**

```bash
# Проверить что порт 8000 не занят другим процессом
netstat -tlnp | grep :8000
ss -tlnp | grep :8000

# Проверить другие LoadBalancer сервисы
kubectl get svc --all-namespaces -o wide | grep LoadBalancer | grep 8000
```

**Решение**:
```bash
# Если порт занят - освободить процесс или использовать другой порт
# Например, порт 8080:
kubectl patch svc kong -n supabase -p '
{
  "spec": {
    "ports": [{
      "name": "proxy",
      "port": 8080,
      "targetPort": 8000,
      "protocol": "TCP"
    }]
  }
}'

# Обновить .env Canton Validator на новый порт
```

---

#####Production рекомендации для MetalLB

**1. Настроить несколько IP адресов (если доступно)**:
```bash
# Если у вас есть несколько IP адресов
cat <<EOF | kubectl apply -f -
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: canton-pool
  namespace: metallb-system
spec:
  addresses:
  - 65.108.15.30-65.108.15.32
  autoAssign: true
EOF
```

**2. Настроить BGP mode для более продвинутой маршрутизации** (если нужно):
```bash
# BGP mode требует поддержку BGP роутером
# Используйте только если у вас есть BGP инфраструктура
```

**3. Добавить monitoring и alerting**:
```bash
# MetalLB экспортирует Prometheus метрики
# Endpoint: http://<speaker-pod>:7472/metrics

# Важные метрики:
# - metallb_allocator_addresses_in_use_total
# - metallb_speaker_announced
# - metallb_k8s_client_config_loaded_bool
```

**4. Настроить Service ExternalTrafficPolicy**:
```yaml
# Два режима:
# - Cluster (по умолчанию): балансировка между всеми нодами
# - Local: трафик идет только на ноду с подом

# Local лучше для production:
externalTrafficPolicy: Local
# Плюсы: сохраняет source IP, меньше latency
# Минусы: может быть неравномерная балансировка
```

**5. Резервное копирование конфигурации**:
```bash
# Сохранить все конфигурации MetalLB
kubectl get ipaddresspool,l2advertisement -n metallb-system -o yaml > /backup/metallb-config.yaml

# Сохранить Service конфигурацию
kubectl get svc kong -n supabase -o yaml > /backup/kong-service.yaml
```

---

##### Валидация успешной установки MetalLB

После завершения всех шагов, выполните финальную проверку:

```bash
# Чеклист MetalLB
echo "=== MetalLB Installation Checklist ==="

# 1. MetalLB pods Running
kubectl get pods -n metallb-system -o wide
echo "✓ MetalLB pods should be Running"

# 2. IPAddressPool создан
kubectl get ipaddresspool -n metallb-system
echo "✓ IPAddressPool 'canton-pool' should exist"

# 3. L2Advertisement создан
kubectl get l2advertisement -n metallb-system
echo "✓ L2Advertisement 'canton-l2-advert' should exist"

# 4. Kong Service имеет External IP
kubectl get svc kong -n supabase | grep LoadBalancer
echo "✓ Kong Service should have EXTERNAL-IP: 65.108.15.30"

# 5. JWKS endpoint доступен
curl -s http://65.108.15.30:8000/auth/v1/jwks | jq -r '.keys[0].kid'
echo "✓ JWKS endpoint should return key ID"

# 6. Логи speaker без ошибок
kubectl logs -n metallb-system -l component=speaker --tail=10 | grep -i error
echo "✓ Speaker logs should have no errors (empty output is good)"

echo "=== Checklist Complete ==="
```

**Ожидаемый результат**: Все пункты проходят успешно ✓

---

##### Откат на предыдущую конфигурацию (если нужно)

Если MetalLB не работает и нужно вернуться к предыдущей конфигурации:

```bash
# 1. Восстановить предыдущий Service
kubectl apply -f /tmp/kong-service-backup.yaml

# 2. Удалить MetalLB (опционально)
kubectl delete namespace metallb-system

# 3. Использовать альтернативное решение
# См. Решение A (iptables) или Решение B (hostPort)
```

#### Рекомендация

**Выбрать Решение A (iptables)** если нужно быстро:
- Простое развертывание
- Не требует перезапуска подов
- Работает сразу

**Выбрать Решение B (hostPort)** для средней надежности:
- Более надежно чем iptables
- Не требует дополнительного ПО

**Выбрать Решение C (MetalLB)** для production ⭐:
- Самое правильное решение
- Лучшая отказоустойчивость
- Требует времени на настройку

---

### ЭТАП 5: Обновление Canton Validator .env (10 минут)

#### Шаг 5.1: Создать backup .env
```bash
ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30
cd /opt/canton-validator

# Создать backup
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
```

#### Шаг 5.2: Обновить AUTH переменные

**Если использовали Решение A (iptables) - порт 8000**:
```bash
cd /opt/canton-validator

# Обновить на порт 8000
sed -i 's|AUTH_JWKS_URL=.*|AUTH_JWKS_URL=http://65.108.15.30:8000/auth/v1/jwks|g' .env
sed -i 's|AUTH_WELLKNOWN_URL=.*|AUTH_WELLKNOWN_URL=http://65.108.15.30:8000/auth/v1/.well-known/jwks.json|g' .env
sed -i 's|AUTH_URL=.*|AUTH_URL=http://65.108.15.30:8000/auth/v1|g' .env
```

**Если использовали Решение B/C - порт 8000**:
```bash
cd /opt/canton-validator

# То же самое
sed -i 's|AUTH_JWKS_URL=.*|AUTH_JWKS_URL=http://65.108.15.30:8000/auth/v1/jwks|g' .env
sed -i 's|AUTH_WELLKNOWN_URL=.*|AUTH_WELLKNOWN_URL=http://65.108.15.30:8000/auth/v1/.well-known/jwks.json|g' .env
sed -i 's|AUTH_URL=.*|AUTH_URL=http://65.108.15.30:8000/auth/v1|g' .env
```

**Если порт 30080 работает**:
```bash
cd /opt/canton-validator

# Использовать порт 30080
sed -i 's|AUTH_JWKS_URL=.*|AUTH_JWKS_URL=http://65.108.15.30:30080/auth/v1/jwks|g' .env
sed -i 's|AUTH_WELLKNOWN_URL=.*|AUTH_WELLKNOWN_URL=http://65.108.15.30:30080/auth/v1/.well-known/jwks.json|g' .env
sed -i 's|AUTH_URL=.*|AUTH_URL=http://65.108.15.30:30080/auth/v1|g' .env
```

#### Шаг 5.3: Проверить обновленный .env
```bash
cat .env | grep -E '(AUTH_JWKS_URL|AUTH_WELLKNOWN_URL|AUTH_URL|LEDGER_API_AUTH_AUDIENCE|VALIDATOR_AUTH_AUDIENCE)'
```

**Должно быть**:
```
AUTH_JWKS_URL=http://65.108.15.30:8000/auth/v1/jwks
AUTH_WELLKNOWN_URL=http://65.108.15.30:8000/auth/v1/.well-known/jwks.json
AUTH_URL=http://65.108.15.30:8000/auth/v1
LEDGER_API_AUTH_AUDIENCE=authenticated
VALIDATOR_AUTH_AUDIENCE=authenticated
```

#### Шаг 5.4: Проверить полный .env файл

**Файл .env должен содержать**:
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
AUTH_WELLKNOWN_URL=http://65.108.15.30:8000/auth/v1/.well-known/jwks.json
AUTH_JWKS_URL=http://65.108.15.30:8000/auth/v1/jwks
AUTH_URL=http://65.108.15.30:8000/auth/v1
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

---

### ЭТАП 6: Перезапуск Canton Validator (15 минут)

#### Шаг 6.1: Остановить контейнеры
```bash
cd /opt/canton-validator

# Остановить все контейнеры
docker compose -f compose.yaml down

# Проверить что все остановлены
docker ps -a | grep splice-validator
```

#### Шаг 6.2: Очистить старые данные (опционально)
```bash
# ⚠️ ОСТОРОЖНО: Это удалит все данные Canton!
# Делать только если нужен чистый старт

# Удалить данные PostgreSQL Canton
rm -rf data/*

# Или переместить в backup
mkdir -p backups
mv data backups/data.$(date +%Y%m%d_%H%M%S)
mkdir data
```

#### Шаг 6.3: Запустить контейнеры
```bash
cd /opt/canton-validator

# Запустить в фоновом режиме
docker compose -f compose.yaml up -d

# Подождать 30 секунд
sleep 30
```

#### Шаг 6.4: Проверить статус контейнеров
```bash
# Проверить статус всех контейнеров
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep splice-validator

# Ожидаемый результат:
# splice-validator-postgres-splice-1   Up (healthy)   5432/tcp
# splice-validator-participant-1       Up (healthy)   5001/tcp, 5002/tcp
# splice-validator-validator-1         Up (healthy)   5003/tcp, 10013/tcp
# splice-validator-wallet-web-ui-1     Up (healthy)   8080/tcp
# splice-validator-ans-web-ui-1        Up (healthy)   8080/tcp
# splice-validator-nginx-1             Up             0.0.0.0:80->80/tcp
```

#### Шаг 6.5: Проверить логи на ошибки

##### PostgreSQL Canton
```bash
docker logs splice-validator-postgres-splice-1 2>&1 | tail -30

# Должно быть:
# database system is ready to accept connections
```

##### Participant
```bash
docker logs splice-validator-participant-1 2>&1 | tail -50

# Проверить на ошибки auth
docker logs splice-validator-participant-1 2>&1 | grep -i 'auth\|jwks\|error' | tail -20

# НЕ должно быть:
# - "empty string" для auth URLs
# - "connection refused" к JWKS
```

##### Validator
```bash
docker logs splice-validator-validator-1 2>&1 | tail -50

# Проверить на ошибки auth
docker logs splice-validator-validator-1 2>&1 | grep -i 'auth\|jwks\|error' | tail -20

# Проверить подключение к DevNet
docker logs splice-validator-validator-1 2>&1 | grep -i 'sv-1.dev\|scan\|devnet\|onboard' | tail -20
```

#### Шаг 6.6: Проверить подключение к JWKS от Canton
```bash
# Проверить из контейнера participant
docker exec splice-validator-participant-1 wget -O- http://65.108.15.30:8000/auth/v1/jwks

# Должен вернуть JSON с ключами
```

---

### ЭТАП 7: Проверка подключения к DevNet (20 минут)

#### Шаг 7.1: Проверить доступность DevNet endpoints
```bash
# На сервере 65.108.15.30

# Проверить Sponsor SV
curl -I https://sv.sv-1.dev.global.canton.network.sync.global

# Проверить Scan
curl -I https://scan.sv-1.dev.global.canton.network.sync.global

# Должны вернуть HTTP 200 или 3xx
```

#### Шаг 7.2: Мониторинг логов validator на onboarding
```bash
# Следить за логами в реальном времени
docker logs -f splice-validator-validator-1 2>&1 | grep -i 'onboard\|register\|devnet\|sv-1'

# Искать сообщения типа:
# - "Onboarding started"
# - "Registered with DevNet"
# - "Connected to SV"
```

#### Шаг 7.3: Проверить статус участника в DevNet

После успешного onboarding, можно проверить статус через scan:

```bash
# Получить party ID из логов
docker logs splice-validator-validator-1 2>&1 | grep -i 'party\|participant' | grep -v 'DEBUG' | tail -20

# Проверить через Scan API (если доступен)
# curl https://scan.sv-1.dev.global.canton.network.sync.global/api/v1/validators
```

---

### ЭТАП 8: Настройка systemd автозапуска (10 минут)

#### Шаг 8.1: Проверить systemd service
```bash
# Проверить статус
systemctl status canton-validator.service

# Проверить файл сервиса
cat /etc/systemd/system/canton-validator.service
```

#### Шаг 8.2: Создать/обновить systemd service
```bash
cat > /etc/systemd/system/canton-validator.service <<'EOF'
[Unit]
Description=Canton Validator Node
After=docker.service network-online.target k3s.service
Wants=network-online.target
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/canton-validator
Environment="LC_ALL=C.UTF-8"
Environment="LANG=C.UTF-8"
Environment="PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

# Запуск контейнеров
ExecStart=/usr/bin/docker compose -f /opt/canton-validator/compose.yaml up -d

# Остановка контейнеров
ExecStop=/usr/bin/docker compose -f /opt/canton-validator/compose.yaml down

# Автоматический рестарт при сбое
Restart=on-failure
RestartSec=10

# Лимиты
TimeoutStartSec=300
TimeoutStopSec=120

[Install]
WantedBy=multi-user.target
EOF
```

#### Шаг 8.3: Активировать сервис
```bash
# Перегрузить systemd
systemctl daemon-reload

# Включить автозапуск
systemctl enable canton-validator.service

# Запустить (если еще не запущен)
systemctl start canton-validator.service

# Проверить статус
systemctl status canton-validator.service
```

---

## ✅ ФИНАЛЬНАЯ ПРОВЕРКА И ВАЛИДАЦИЯ

### Чеклист полной работоспособности

#### 1. Kubernetes (Supabase)
```bash
# Все поды работают
kubectl get pods -n supabase

# Ожидаемый результат:
# postgres-0                    1/1     Running
# kong-*                        1/1     Running
# supabase-auth-*               1/1     Running
# supabase-rest-*               2/2     Running
# supabase-realtime-*           1/1     Running
# supabase-jwks-*               1/1     Running
# supabase-meta-*               1/1     Running
```

#### 2. JWKS endpoint доступен
```bash
# Изнутри кластера
kubectl run -it --rm --restart=Never test-jwks \
  --image=curlimages/curl:latest \
  --namespace=supabase \
  -- curl -s http://kong:8000/auth/v1/jwks | jq '.keys[0].kid'

# С внешнего IP
curl -s http://65.108.15.30:8000/auth/v1/jwks | jq '.keys[0].kid'

# Должны вернуть key ID
```

#### 3. Canton Validator контейнеры работают
```bash
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep splice-validator | grep -v Exited

# Все должны быть Up (healthy)
```

#### 4. Нет ошибок auth в логах Canton
```bash
# Participant
docker logs splice-validator-participant-1 2>&1 | grep -i 'error.*auth\|error.*jwks' | tail -5

# Validator
docker logs splice-validator-validator-1 2>&1 | grep -i 'error.*auth\|error.*jwks' | tail -5

# Не должно быть ошибок
```

#### 5. Canton подключен к JWKS
```bash
# Проверить из контейнера
docker exec splice-validator-participant-1 wget -qO- http://65.108.15.30:8000/auth/v1/jwks | jq .

# Должен вернуть JSON
```

#### 6. Validator пытается подключиться к DevNet
```bash
docker logs splice-validator-validator-1 2>&1 | grep -i 'sv-1.dev\|onboard\|devnet' | tail -10

# Должны быть логи о попытках подключения
```

#### 7. Health checks проходят
```bash
# PostgreSQL Canton
docker exec splice-validator-postgres-splice-1 pg_isready -U postgres

# Nginx
curl -I http://localhost:80

# UI endpoints
curl -I http://localhost:80/wallet
curl -I http://localhost:80/ans
```

#### 8. Systemd service активен
```bash
systemctl status canton-validator.service | grep Active

# Должно быть: active (running)
```

---

## 🚨 TROUBLESHOOTING: Решение типичных проблем

### Проблема 1: PostgreSQL Supabase не запускается

**Симптомы**: 
- CrashLoopBackOff
- Ошибка "data directory has wrong ownership"

**Диагностика**:
```bash
kubectl logs -n supabase postgres-0 --tail=20
```

**Решение**:
```bash
# Полностью удалить и пересоздать (см. ЭТАП 2)
kubectl delete statefulset postgres -n supabase --cascade=orphan
kubectl delete pvc postgres-storage-postgres-0 -n supabase
kubectl apply -f k8s/supabase/postgres-statefulset.yaml
```

---

### Проблема 2: supabase-auth не подключается к PostgreSQL

**Симптомы**:
- Error в статусе пода
- "connection refused" в логах

**Диагностика**:
```bash
kubectl logs -n supabase -l app=supabase-auth --tail=30
```

**Решение**:
```bash
# Подождать готовности PostgreSQL
kubectl wait --for=condition=ready pod postgres-0 -n supabase --timeout=300s

# Перезапустить auth
kubectl delete pod -n supabase -l app=supabase-auth

# Проверить подключение
kubectl exec -n supabase -l app=supabase-auth -- nc -zv postgres 5432
```

---

### Проблема 3: Kong OOMKilled

**Симптомы**:
- Pod перезапускается
- OOMKilled в статусе

**Диагностика**:
```bash
kubectl describe pod -n supabase -l app=kong | grep -A 5 "Last State"
```

**Решение**:
```bash
# Увеличить лимит памяти до 2Gi
kubectl patch deployment kong -n supabase -p '
{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "kong",
          "resources": {
            "limits": {
              "memory": "2Gi",
              "cpu": "1000m"
            }
          }
        }]
      }
    }
  }
}'

kubectl delete pod -n supabase -l app=kong
```

---

### Проблема 4: JWKS endpoint недоступен снаружи

**Симптомы**:
- Таймаут при curl с внешнего хоста
- HTML вместо JSON при curl с localhost

**Диагностика**:
```bash
# С сервера
curl -v http://127.0.0.1:8000/auth/v1/jwks
curl -v http://65.108.15.30:8000/auth/v1/jwks

# С внешнего хоста
curl -v http://65.108.15.30:8000/auth/v1/jwks
```

**Решение**: См. ЭТАП 4 (Решение A/B/C)

---

### Проблема 5: Canton participant ошибка "empty string" для auth

**Симптомы**:
- Контейнер не запускается
- Ошибка: `canton.participants.participant.ledger-api.auth-services.0.url` - пустая строка

**Диагностика**:
```bash
# Проверить .env
cat /opt/canton-validator/.env | grep AUTH_JWKS_URL

# Проверить доступность JWKS
curl http://65.108.15.30:8000/auth/v1/jwks
```

**Решение**:
```bash
cd /opt/canton-validator

# Убедиться что AUTH_JWKS_URL установлен
sed -i 's|AUTH_JWKS_URL=.*|AUTH_JWKS_URL=http://65.108.15.30:8000/auth/v1/jwks|g' .env

# Перезапустить
docker compose down
docker compose up -d

# Проверить логи
docker logs splice-validator-participant-1 2>&1 | grep -i auth | tail -10
```

---

### Проблема 6: Canton не подключается к DevNet

**Симптомы**:
- Нет логов о подключении к DevNet
- Ошибки подключения к sv-1.dev

**Диагностика**:
```bash
# Проверить логи validator
docker logs splice-validator-validator-1 2>&1 | grep -i 'sv-1\|devnet\|onboard\|error' | tail -30

# Проверить доступность DevNet
curl -I https://sv.sv-1.dev.global.canton.network.sync.global
```

**Решение**:
```bash
# Проверить .env
cat /opt/canton-validator/.env | grep -E '(SPONSOR_SV|SCAN_ADDRESS|ONBOARDING_SECRET)'

# Должно быть:
# SPONSOR_SV_ADDRESS=https://sv.sv-1.dev.global.canton.network.sync.global
# SCAN_ADDRESS=https://scan.sv-1.dev.global.canton.network.sync.global
# ONBOARDING_SECRET=$ONBOARDING_SECRET

# Перезапустить validator
docker restart splice-validator-validator-1

# Мониторить логи
docker logs -f splice-validator-validator-1 2>&1 | grep -i onboard
```

---

## 📊 МОНИТОРИНГ И ЛОГИ

### Kubernetes (Supabase)

```bash
# Все поды
kubectl get pods -n supabase -o wide

# Логи PostgreSQL
kubectl logs -n supabase postgres-0 --tail=50 -f

# Логи Kong
kubectl logs -n supabase -l app=kong --tail=50 -f

# Логи Auth
kubectl logs -n supabase -l app=supabase-auth --tail=50 -f

# Логи JWKS
kubectl logs -n supabase -l app=supabase-jwks --tail=30 -f

# События
kubectl get events -n supabase --sort-by='.lastTimestamp' | tail -20
```

### Canton Validator

```bash
cd /opt/canton-validator

# Все контейнеры
docker compose ps

# Логи PostgreSQL Canton
docker logs splice-validator-postgres-splice-1 --tail=50 -f

# Логи Participant  
docker logs splice-validator-participant-1 --tail=100 -f

# Логи Validator
docker logs splice-validator-validator-1 --tail=100 -f

# Логи Nginx
docker logs splice-validator-nginx-1 --tail=30 -f

# Все логи одновременно
docker compose logs -f --tail=50
```

### Systemd

```bash
# Статус сервиса
systemctl status canton-validator.service

# Логи сервиса
journalctl -u canton-validator.service -n 100 --no-pager

# Следить за логами
journalctl -u canton-validator.service -f
```

---

## 🎯 ОЖИДАЕМЫЙ ФИНАЛЬНЫЙ РЕЗУЛЬТАТ

### После выполнения всех этапов:

#### 1. Supabase Auth работает ✅
```bash
$ curl http://65.108.15.30:8000/auth/v1/jwks
{
  "keys": [
    {
      "kty": "RSA",
      "kid": "...",
      "use": "sig",
      "n": "...",
      "e": "AQAB"
    }
  ]
}
```

#### 2. Все поды Kubernetes работают ✅
```bash
$ kubectl get pods -n supabase
NAME                               READY   STATUS    RESTARTS   AGE
postgres-0                         1/1     Running   0          10m
kong-xxxxx                         1/1     Running   0          10m
supabase-auth-xxxxx                1/1     Running   0          10m
supabase-rest-xxxxx                2/2     Running   0          10m
supabase-realtime-xxxxx            1/1     Running   0          10m
supabase-jwks-xxxxx                1/1     Running   0          10m
supabase-meta-xxxxx                1/1     Running   0          10m
```

#### 3. Все контейнеры Canton работают ✅
```bash
$ docker ps | grep splice-validator
splice-validator-postgres-splice-1   Up (healthy)
splice-validator-participant-1       Up (healthy)
splice-validator-validator-1         Up (healthy)
splice-validator-wallet-web-ui-1     Up (healthy)
splice-validator-ans-web-ui-1        Up (healthy)
splice-validator-nginx-1             Up
```

#### 4. Canton подключен к auth ✅
```bash
$ docker logs splice-validator-participant-1 2>&1 | grep -i auth | tail -5
INFO  Auth service configured: http://65.108.15.30:8000/auth/v1/jwks
INFO  JWKS keys loaded successfully
```

#### 5. Canton подключается к DevNet ✅
```bash
$ docker logs splice-validator-validator-1 2>&1 | grep -i devnet | tail -5
INFO  Connecting to DevNet SV: https://sv.sv-1.dev.global.canton.network.sync.global
INFO  Onboarding process started
INFO  Successfully registered with DevNet
```

#### 6. Systemd service активен ✅
```bash
$ systemctl status canton-validator.service
● canton-validator.service - Canton Validator Node
   Loaded: loaded (/etc/systemd/system/canton-validator.service; enabled)
   Active: active (running) since ...
```

---

## 📚 СПРАВОЧНАЯ ИНФОРМАЦИЯ

### Важные URL и endpoints

| Компонент | URL |
|-----------|-----|
| JWKS (внешний) | http://65.108.15.30:8000/auth/v1/jwks |
| JWKS (внутренний) | http://kong:8000/auth/v1/jwks |
| Well-known | http://65.108.15.30:8000/auth/v1/.well-known/jwks.json |
| Auth API | http://65.108.15.30:8000/auth/v1/ |
| DevNet Sponsor SV | https://sv.sv-1.dev.global.canton.network.sync.global |
| DevNet Scan | https://scan.sv-1.dev.global.canton.network.sync.global |
| Wallet UI | http://65.108.15.30/wallet |
| ANS UI | http://65.108.15.30/ans |

### Важные порты

| Порт | Сервис | Доступ |
|------|--------|--------|
| 8000 | Kong (внешний) | Публичный |
| 30080 | Kong NodePort | Kubernetes |
| 5432 | PostgreSQL Supabase | Внутри K8s |
| 9999 | Supabase Auth | Внутри K8s |
| 8080 | JWKS Service | Внутри K8s |
| 80 | Nginx (Canton) | Публичный |
| 5432 | PostgreSQL Canton | Внутри Docker |
| 5001 | Participant Ledger API | Внутри Docker |
| 5003 | Validator API | Внутри Docker |

### Файлы конфигурации

| Файл | Расположение | Назначение |
|------|--------------|------------|
| compose.yaml | /opt/canton-validator/ | Docker Compose конфигурация |
| .env | /opt/canton-validator/ | Переменные окружения Canton |
| nginx.conf | /opt/canton-validator/ | Nginx конфигурация |
| postgres-statefulset.yaml | k8s/supabase/ | PostgreSQL Supabase |
| kong-deployment.yaml | k8s/supabase/ | Kong API Gateway |
| supabase-services.yaml | k8s/supabase/ | Auth, REST, Realtime |
| jwks-service.yaml | k8s/supabase/ | JWKS endpoint |

---

## 🔐 БЕЗОПАСНОСТЬ

### Важные моменты безопасности

1. **Пароли**: Убедитесь, что изменили все пароли по умолчанию:
   - PostgreSQL Supabase: `POSTGRES_PASSWORD`
   - JWT Secret: `JWT_SECRET`
   - PostgreSQL Canton: `SPLICE_DB_PASSWORD`

2. **Firewall**: Настройте firewall для защиты:
   ```bash
   # Разрешить только необходимые порты
   ufw allow 22/tcp    # SSH
   ufw allow 80/tcp    # HTTP
   ufw allow 443/tcp   # HTTPS
   ufw allow 8000/tcp  # Kong API
   ufw enable
   ```

3. **SSH**: Используйте только ключи, отключите пароли:
   ```bash
   # В /etc/ssh/sshd_config
   PasswordAuthentication no
   PubkeyAuthentication yes
   ```

4. **Secrets в Kubernetes**: Используйте Kubernetes Secrets для чувствительных данных:
   ```bash
   # Никогда не коммитьте секреты в Git
   kubectl create secret generic my-secret --from-literal=password=xxx -n supabase
   ```

---

## 📞 ПОДДЕРЖКА И ОТЛАДКА

### Если что-то не работает

1. **Проверьте логи** (в порядке важности):
   - Kubernetes events: `kubectl get events -n supabase`
   - PostgreSQL: `kubectl logs -n supabase postgres-0`
   - Canton Validator: `docker logs splice-validator-validator-1`

2. **Проверьте сеть**:
   - Доступность JWKS: `curl http://65.108.15.30:8000/auth/v1/jwks`
   - Доступность DevNet: `curl -I https://sv.sv-1.dev.global.canton.network.sync.global`

3. **Проверьте ресурсы**:
   - `kubectl top nodes`
   - `kubectl top pods -n supabase`
   - `docker stats`

4. **Собирите диагностическую информацию**:
   ```bash
   # Создать архив с логами
   mkdir -p /tmp/canton-debug
   kubectl get all -n supabase > /tmp/canton-debug/k8s-resources.txt
   kubectl logs -n supabase --all-containers > /tmp/canton-debug/k8s-logs.txt
   docker compose logs > /tmp/canton-debug/canton-logs.txt
   tar -czf /tmp/canton-debug.tar.gz /tmp/canton-debug/
   ```

---

## ✅ ЧЕКЛИСТ ВЫПОЛНЕНИЯ

Отметьте каждый пункт после выполнения:

### Подготовка
- [ ] SSH доступ к серверу работает
- [ ] Kubernetes кластер работает
- [ ] Docker установлен и работает

### ЭТАП 1: Диагностика
- [ ] Проверен статус всех подов Kubernetes
- [ ] Проверен статус всех сервисов
- [ ] Проверен статус контейнеров Canton

### ЭТАП 2: PostgreSQL Supabase
- [ ] PostgreSQL запущен и работает
- [ ] Схема auth создана
- [ ] Нет ошибок в логах

### ЭТАП 3: Supabase сервисы
- [ ] supabase-auth запущен и подключен к PostgreSQL
- [ ] Kong запущен и работает
- [ ] JWKS сервис работает

### ЭТАП 4: Внешний доступ JWKS
- [ ] Выбрано решение (A/B/C)
- [ ] Настроен внешний доступ
- [ ] JWKS доступен через внешний IP
- [ ] Проверена доступность: `curl http://65.108.15.30:8000/auth/v1/jwks`

### ЭТАП 5: Canton Validator .env
- [ ] Создан backup .env
- [ ] Обновлены AUTH переменные
- [ ] Проверена конфигурация

### ЭТАП 6: Перезапуск Canton
- [ ] Контейнеры перезапущены
- [ ] Все контейнеры в статусе Up (healthy)
- [ ] Нет ошибок auth в логах
- [ ] Canton подключен к JWKS

### ЭТАП 7: DevNet подключение
- [ ] DevNet endpoints доступны
- [ ] Validator пытается подключиться к DevNet
- [ ] Нет критических ошибок в логах

### ЭТАП 8: Systemd автозапуск
- [ ] Systemd service создан
- [ ] Сервис включен (enabled)
- [ ] Сервис работает

### Финальная проверка
- [ ] Все поды Kubernetes работают
- [ ] JWKS endpoint доступен снаружи
- [ ] Все контейнеры Canton работают
- [ ] Нет ошибок auth в логах Canton
- [ ] Canton подключен к JWKS
- [ ] Validator пытается подключиться к DevNet
- [ ] Health checks проходят
- [ ] Systemd service активен

---

## 🎉 УСПЕШНОЕ ЗАВЕРШЕНИЕ

Если все чеклисты отмечены, Canton Validator Node успешно развернут!

**Следующие шаги**:
1. Мониторить логи на ошибки первые 24 часа
2. Настроить алерты на критические события
3. Создать backup план для восстановления
4. Документировать любые специфичные изменения

---

**Дата создания**: 28 ноября 2025  
**Версия**: 2.0 (Финальная)  
**Статус**: Готов к выполнению  
**Автор**: Canton Validator Deployment Team