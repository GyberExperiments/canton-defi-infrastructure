# 🚀 CANTON OTC - DEVNET DEPLOYMENT PROMPT

**Цель**: Подключить Canton OTC приложение к реальной Canton DevNet ноде через Daml SDK

---

## 📊 ТЕКУЩЕЕ СОСТОЯНИЕ ИНФРАСТРУКТУРЫ

### ✅ УЖЕ РАЗВЕРНУТО:

**Canton Validator (namespace: validator)**
- ✅ `participant` pod: Running (Ledger API на портах 5001, 7575)
- ✅ `postgres-0` pod: Running
- ✅ `participant-ledger-external` service: NodePort 30501 (Ledger API), 30757 (JSON API)
- ⚠️ `validator-app` pod: CrashLoopBackOff (не критично для Ledger API)

**Canton OTC App (namespace: canton-otc)**
- ✅ `canton-otc` deployment: 2 pods Running
- ✅ `redis` pod: Running
- ✅ ConfigMap `canton-otc-config` существует

**Kubernetes Cluster:**
- ✅ Нода `canton-node-65-108-15-30` (65.108.15.30): Ready
- ✅ Master нода `tmedm` (31.129.105.180): Ready

### 🎯 ДОСТУП К LEDGER API:

**Internal (внутри кластера):**
```
participant.validator.svc.cluster.local:5001  # gRPC Ledger API
participant.validator.svc.cluster.local:7575  # JSON API
```

**External (снаружи через NodePort):**
```
65.108.15.30:30501  # gRPC Ledger API
65.108.15.30:30757  # JSON API
```

---

## 🔧 ДЕЙСТВИЯ ДЛЯ ПОДКЛЮЧЕНИЯ

### Шаг 1: Обновить ConfigMap с Canton переменными

```bash
kubectl patch configmap canton-otc-config -n canton-otc --type merge -p '
{
  "data": {
    "NEXT_PUBLIC_DAML_USE_REAL_LEDGER": "true",
    "DAML_LEDGER_HOST": "participant.validator.svc.cluster.local",
    "DAML_LEDGER_PORT": "5001",
    "DAML_JSON_API_HOST": "participant.validator.svc.cluster.local",
    "DAML_JSON_API_PORT": "7575",
    "CANTON_PARTICIPANT_URL": "http://participant.validator.svc.cluster.local:5002",
    "NODE_ENV": "production"
  }
}'
```

### Шаг 2: Добавить Canton переменные в Deployment

Обновить `config/kubernetes/k8s/deployment.yaml`:

```yaml
# Добавить в env секцию контейнера canton-otc:
        - name: NEXT_PUBLIC_DAML_USE_REAL_LEDGER
          valueFrom:
            configMapKeyRef:
              name: canton-otc-config
              key: NEXT_PUBLIC_DAML_USE_REAL_LEDGER
        - name: DAML_LEDGER_HOST
          valueFrom:
            configMapKeyRef:
              name: canton-otc-config
              key: DAML_LEDGER_HOST
        - name: DAML_LEDGER_PORT
          valueFrom:
            configMapKeyRef:
              name: canton-otc-config
              key: DAML_LEDGER_PORT
        - name: DAML_JSON_API_HOST
          valueFrom:
            configMapKeyRef:
              name: canton-otc-config
              key: DAML_JSON_API_HOST
        - name: DAML_JSON_API_PORT
          valueFrom:
            configMapKeyRef:
              name: canton-otc-config
              key: DAML_JSON_API_PORT
        - name: CANTON_PARTICIPANT_URL
          valueFrom:
            configMapKeyRef:
              name: canton-otc-config
              key: CANTON_PARTICIPANT_URL
```

### Шаг 3: Применить изменения и перезапустить приложение

```bash
# Применить обновленный deployment (если файл изменен)
kubectl apply -f config/kubernetes/k8s/deployment.yaml

# ИЛИ просто перезапустить с новым configmap
kubectl rollout restart deployment/canton-otc -n canton-otc

# Следить за развертыванием
kubectl rollout status deployment/canton-otc -n canton-otc

# Проверить логи
kubectl logs -f deployment/canton-otc -n canton-otc --tail=100
```

### Шаг 4: Проверить подключение к Ledger API

```bash
# Проверить доступность Ledger API изнутри пода
kubectl exec -it deployment/canton-otc -n canton-otc -- curl -s http://participant.validator.svc.cluster.local:7575/v1/parties

# Проверить логи на наличие успешного подключения
kubectl logs deployment/canton-otc -n canton-otc | grep -i "daml\|ledger\|canton"

# Ожидаемые логи:
# ✅ Real DAML Ledger connection established
# ✅ DAML Ledger connected. Available parties: ...
```

### Шаг 5: Проверить health endpoint

```bash
# Локально (если есть ingress/nodeport)
curl https://1otc.cc/api/health | jq .

# Внутри кластера
kubectl exec -it deployment/canton-otc -n canton-otc -- curl -s http://localhost:3000/api/health | jq .

# Ожидаемый ответ:
# {
#   "status": "healthy",
#   "components": {
#     "daml_ledger": {
#       "status": "REAL",
#       "mode": "REAL",
#       "contractCount": 0
#     }
#   }
# }
```

---

## 🧪 ТЕСТИРОВАНИЕ END-TO-END

### Тест 1: Проверить создание Daml контракта

```bash
# Создать тестовый заказ через API
curl -X POST https://1otc.cc/api/create-order \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: test-$(date +%s)" \
  -d '{
    "email": "test@example.com",
    "exchangeDirection": "buy",
    "usdtAmount": 500,
    "paymentNetwork": "ethereum",
    "paymentToken": "USDT-ERC20"
  }'

# Проверить логи на создание Daml контракта
kubectl logs deployment/canton-otc -n canton-otc | grep -i "contract created\|otcoffer"

# Ожидаемый лог:
# 🏗️ Creating contract... OtcOffer:OtcOffer
# ✅ Contract created: OtcOffer_xxxxx
```

### Тест 2: Проверить query контрактов

```bash
# Проверить в логах вызовы query
kubectl logs deployment/canton-otc -n canton-otc | grep -i "query\|fetch"

# Проверить через Canton participant (если есть доступ)
kubectl exec -it participant-5c8bc8496b-hnspj -n validator -- curl -s http://localhost:5001/v1/contracts
```

### Тест 3: Проверить DamlIntegrationService статус

```bash
# Добавить эндпоинт для проверки (в src/app/api/daml-status/route.ts):
# export async function GET() {
#   const daml = new DamlIntegrationService({...});
#   const status = daml.getStatus();
#   return Response.json(status);
# }

# Затем проверить:
curl https://1otc.cc/api/daml-status

# Ожидаемый ответ:
# {
#   "mode": "REAL",
#   "contractCount": N,
#   "cacheSize": N
# }
```

---

## 🔍 TROUBLESHOOTING

### Проблема 1: Приложение не может подключиться к Ledger

**Симптомы:**
```
❌ Failed to initialize Daml connection
[DAML] FATAL: Cannot connect to Canton Ledger
```

**Решение:**
```bash
# 1. Проверить доступность participant service
kubectl exec -it deployment/canton-otc -n canton-otc -- nc -zv participant.validator.svc.cluster.local 5001

# 2. Проверить логи participant
kubectl logs participant-5c8bc8496b-hnspj -n validator

# 3. Проверить, что participant Running
kubectl get pods -n validator -l app=participant
```

### Проблема 2: Daml SDK не установлен

**Симптомы:**
```
⚠️ @daml/ledger not installed
[DAML] FATAL: @daml/ledger not available in PRODUCTION
```

**Решение:**

Обновить `Dockerfile`:
```dockerfile
# Добавить установку Daml SDK
FROM node:20-alpine AS builder

# Install Daml SDK
RUN apk add --no-cache curl bash && \
    curl -sSL https://get.daml.com/ | sh -s 2.9.0 && \
    mv /root/.daml/bin/daml /usr/local/bin/

# Продолжить обычный build...
WORKDIR /app
COPY package*.json ./
RUN npm install
...
```

Пересобрать и задеплоить:
```bash
docker build -t ghcr.io/themacroeconomicdao/cantonotc:devnet .
docker push ghcr.io/themacroeconomicdao/cantonotc:devnet
kubectl set image deployment/canton-otc canton-otc=ghcr.io/themacroeconomicdao/cantonotc:devnet -n canton-otc
```

### Проблема 3: Контракты не создаются

**Симптомы:**
```
🏗️ Creating contract... OtcOffer:OtcOffer
❌ Failed to create contract: Template not found
```

**Решение:**
```bash
# 1. Проверить, что Daml контракты загружены в participant
kubectl exec -it participant-5c8bc8496b-hnspj -n validator -- \
  curl -s http://localhost:7575/v1/packages

# 2. Загрузить DAR файл (если нужно)
cd canton/daml
daml build
kubectl cp .daml/dist/canton-otc-1.0.0.dar \
  validator/participant-5c8bc8496b-hnspj:/tmp/

kubectl exec -it participant-5c8bc8496b-hnspj -n validator -- \
  curl -X POST http://localhost:7575/v1/packages \
  -H "Content-Type: application/octet-stream" \
  --data-binary @/tmp/canton-otc-1.0.0.dar
```

---

## ✅ КРИТЕРИИ УСПЕШНОГО РАЗВЕРТЫВАНИЯ

- [ ] ConfigMap обновлен с Canton переменными
- [ ] Deployment перезапущен с новыми env vars
- [ ] Логи показывают: `✅ Real DAML Ledger connection established`
- [ ] Health endpoint возвращает `"daml_ledger": { "status": "REAL" }`
- [ ] Создание заказа создает Daml контракт (логи показывают `Contract created`)
- [ ] Нет ошибок `[DAML] FATAL` в логах
- [ ] `daml.isMock === false` в коде

---

## 📝 КОМАНДЫ ДЛЯ БЫСТРОГО COPY-PASTE

```bash
# 1. Обновить ConfigMap
kubectl patch configmap canton-otc-config -n canton-otc --type merge -p '{"data":{"NEXT_PUBLIC_DAML_USE_REAL_LEDGER":"true","DAML_LEDGER_HOST":"participant.validator.svc.cluster.local","DAML_LEDGER_PORT":"5001","DAML_JSON_API_HOST":"participant.validator.svc.cluster.local","DAML_JSON_API_PORT":"7575","CANTON_PARTICIPANT_URL":"http://participant.validator.svc.cluster.local:5002","NODE_ENV":"production"}}'

# 2. Перезапустить приложение
kubectl rollout restart deployment/canton-otc -n canton-otc

# 3. Следить за развертыванием
kubectl rollout status deployment/canton-otc -n canton-otc

# 4. Проверить логи
kubectl logs -f deployment/canton-otc -n canton-otc --tail=50 | grep -i "daml\|ledger\|contract"

# 5. Проверить health
kubectl exec -it deployment/canton-otc -n canton-otc -- curl -s http://localhost:3000/api/health | jq .

# 6. Тестовый заказ
curl -X POST https://1otc.cc/api/create-order -H "Content-Type: application/json" -H "X-Idempotency-Key: test-$(date +%s)" -d '{"email":"test@example.com","exchangeDirection":"buy","usdtAmount":500,"paymentNetwork":"ethereum","paymentToken":"USDT-ERC20"}'
```

---

## 🎯 ИТОГО

После выполнения всех шагов:
- ✅ Canton OTC подключен к реальному Canton Ledger API
- ✅ Daml контракты создаются на Canton DevNet
- ✅ Mock режим отключен в production
- ✅ End-to-end flow работает: Order → Daml Contract → Settlement

**Проект полностью интегрирован с Canton DevNet!** 🎉
