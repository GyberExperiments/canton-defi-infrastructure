# 📊 СТАТУС ДЕПЛОЯ: Wallet Endpoints 404 Fix

**Дата:** 2025-11-29  
**Статус:** Конфигурация применена, требуется исправление проблем с deployment

---

## ✅ ЧТО ВЫПОЛНЕНО

### 1. Конфигурация применена успешно ✅

Конфигурация `ADDITIONAL_CONFIG_WALLET` успешно добавлена в deployment `validator-app`:

```yaml
- name: ADDITIONAL_CONFIG_WALLET
  value: |
    canton.validator-apps.validator_backend {
      enable-wallet = true
      validator-wallet-users = [wallet-admin]
      admin-api {
        port = 5003
        address = "0.0.0.0"
      }
    }
```

**Проверка:**
```bash
kubectl get deployment validator-app -n canton-node -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="ADDITIONAL_CONFIG_WALLET")]}'
```

✅ Конфигурация присутствует в deployment

### 2. Манифест применен ✅

```bash
kubectl apply -f blockchain/k8s/canton-validator-full-stack.yaml
```

Результат:
- ✅ `deployment.apps/validator-app configured`
- ✅ Конфигурация обновлена

### 3. Deployment перезапущен ✅

```bash
kubectl rollout restart deployment validator-app -n canton-node
```

---

## ⚠️ ТЕКУЩИЕ ПРОБЛЕМЫ

### 1. Проблема с образом validator-app

**Статус:** `ImagePullBackOff`

**Детали:**
- Образ: `ghcr.io/themacroeconomicdao/validator-app:0.5.8`
- Проблема: Не может загрузить образ из registry

**Возможные причины:**
- Проблемы с credentials для GHCR
- Проблемы с доступом к registry
- Образ не существует или недоступен

**Решение:**
```bash
# Проверить imagePullSecrets
kubectl get deployment validator-app -n canton-node -o jsonpath='{.spec.template.spec.imagePullSecrets}'

# Проверить секрет ghcr-creds
kubectl get secret ghcr-creds -n canton-node

# Попробовать вручную загрузить образ на узле
docker pull ghcr.io/themacroeconomicdao/validator-app:0.5.8
```

### 2. Проблема с participant

**Статус:** `ImagePullBackOff`

**Детали:**
- Образ: `ghcr.io/themacroeconomicdao/canton-participant:0.5.8`
- Проблема: Не может загрузить образ
- Влияние: Init-контейнер validator-app ждет participant

**Решение:**
- Исправить проблему с образом participant
- Или временно отключить init-контейнер (уже сделано через patch)

### 3. Конфликт портов

**Статус:** Поды в статусе `Pending`

**Причина:** `1 node(s) didn't have free ports for the requested pod ports`

**Детали:**
- Используется `hostNetwork: true`
- Порты 5003, 5004 должны быть свободны на узле `canton-node-65-108-15-30`

**Решение:**
```bash
# Проверить, что занимает порты на узле
ssh root@65.108.15.30 "ss -tlnp | grep -E '5003|5004'"

# Остановить процессы, занимающие порты (если есть)
# Или изменить порты в конфигурации
```

---

## 🔍 ДИАГНОСТИКА

### Проверка конфигурации:

```bash
# Проверить, что ADDITIONAL_CONFIG_WALLET применена
kubectl get deployment validator-app -n canton-node -o yaml | grep -A 10 "ADDITIONAL_CONFIG_WALLET"

# Проверить статус deployment
kubectl get deployment validator-app -n canton-node

# Проверить статус подов
kubectl get pods -n canton-node -l app=canton-validator,component=validator
```

### Проверка образов:

```bash
# Проверить imagePullSecrets
kubectl get deployment validator-app -n canton-node -o jsonpath='{.spec.template.spec.imagePullSecrets}'

# Проверить секрет ghcr-creds
kubectl get secret ghcr-creds -n canton-node -o yaml

# Проверить события
kubectl get events -n canton-node --sort-by='.lastTimestamp' | grep validator | tail -10
```

---

## 🚀 СЛЕДУЮЩИЕ ШАГИ

### 1. Исправить проблему с образом validator-app

**Вариант A: Проверить и обновить credentials**

```bash
# Проверить секрет
kubectl get secret ghcr-creds -n canton-node

# Если секрет отсутствует или неверный, создать/обновить:
kubectl create secret docker-registry ghcr-creds \
  --docker-server=ghcr.io \
  --docker-username=<GITHUB_USERNAME> \
  --docker-password=<GITHUB_TOKEN> \
  --namespace=canton-node
```

**Вариант B: Загрузить образ вручную на узле**

```bash
ssh root@65.108.15.30
docker pull ghcr.io/themacroeconomicdao/validator-app:0.5.8
```

### 2. Исправить проблему с participant

Аналогично validator-app - проверить credentials или загрузить образ вручную.

### 3. Проверить и освободить порты

```bash
# На узле canton-node-65-108-15-30
ssh root@65.108.15.30
ss -tlnp | grep -E '5003|5004'
# Остановить процессы, занимающие порты
```

### 4. После исправления проблем

```bash
# Убедиться, что под запустился
kubectl get pods -n canton-node -l app=canton-validator,component=validator

# Проверить логи на предмет регистрации wallet endpoints
kubectl logs -n canton-node -l app=canton-validator,component=validator | grep -i "wallet\|endpoint\|route"

# Протестировать endpoints
curl "http://65.108.15.30/api/validator/version"
curl "http://65.108.15.30/api/validator/v0/wallet/balance" -H "Authorization: Bearer <token>"
```

---

## ✅ КРИТЕРИИ УСПЕХА

После исправления проблем deployment должен:

1. ✅ Под validator-app в статусе `Running`
2. ✅ В логах есть сообщения о регистрации wallet endpoints
3. ✅ Endpoint `/api/validator/version` работает
4. ✅ Endpoints `/api/validator/v0/wallet/*` работают
5. ✅ Endpoint `/api/validator/v0/register` работает
6. ✅ Wallet UI загружается без ошибок

---

## 📝 ПРИМЕЧАНИЯ

1. **Конфигурация применена:** `ADDITIONAL_CONFIG_WALLET` успешно добавлена в deployment
2. **Требуется исправление:** Проблемы с образами и портами блокируют запуск подов
3. **Init-контейнер:** Временно отключен через patch (не будет применен при следующем `kubectl apply`)

---

**Статус:** ⚠️ Конфигурация применена, требуется исправление проблем с deployment  
**Приоритет:** Высокий - исправить проблемы с образами для завершения деплоя





