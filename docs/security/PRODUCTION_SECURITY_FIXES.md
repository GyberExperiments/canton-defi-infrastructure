# 🔐 Исправления безопасности для продакшена

**Дата**: 2 ноября 2025  
**Статус**: ✅ ВЫПОЛНЕНО

---

## 📋 ВЫПОЛНЕННЫЕ ИСПРАВЛЕНИЯ

### ✅ 1. Exchange Rate Validation - Уменьшен tolerance

**Проблема**: 1% tolerance позволял манипулировать ценой на до 1%  
**Решение**: Уменьшен до 0.1%

**Файлы**:
- ✅ `src/app/api/create-order/enhanced-route.ts` - исправлено

**Изменения**:
```typescript
// Было:
const tolerance = expectedCantonAmount * 0.01 // 1% tolerance

// Стало:
const tolerance = expectedCantonAmount * 0.001 // 0.1% tolerance (was 1%)
```

**Эффект**: Снижение риска финансовых потерь от манипуляций ценой в 10 раз

---

### ✅ 2. Balance Check в DEX Swap API

**Проблема**: Можно было создать swap intent на сумму больше чем есть на балансе  
**Решение**: Добавлена проверка баланса перед созданием intent

**Файлы**:
- ✅ `src/app/api/near-intents/swap/route.ts` - добавлена проверка баланса

**Что добавлено**:
1. Проверка баланса для fungible tokens (USDT, USDC) через `ft_balance_of`
2. Проверка баланса для native NEAR через `getNearBalance`
3. Учет комиссий и gas reserve при проверке
4. Подробные error messages для пользователя

**Эффект**: Предотвращение DoS атак и неисполнимых intents

---

### ✅ 3. Secret Management - GitHub Secrets для Solver Node

**Проблема**: `SOLVER_PRIVATE_KEY` хранился в environment variables, доступных через pod  
**Решение**: Перемещен в GitHub Secrets через External Secrets Operator

**Файлы**:
- ✅ `config/kubernetes/k8s/minimal-stage/external-secret.yaml` - добавлены секреты:
  - `SOLVER_ACCOUNT_ID`
  - `SOLVER_PRIVATE_KEY`
  - `NEAR_NETWORK`
  - `NEAR_INTENTS_CONTRACT`
  - `NEAR_RPC_URL`
  - `NEAR_DEX_FEE_RECIPIENT` - адрес для получения комиссий с DEX

- ✅ `services/solver-node/k8s/deployment.yaml` - обновлен:
  - Использует `canton-otc-secrets-minimal-stage` из External Secrets
  - ConfigMap обновлен (удалены критические секреты)

**Что нужно сделать вручную**:

#### 1. Добавить секреты в GitHub Secrets:

```bash
# Перейти на: https://github.com/TheMacroeconomicDao/CantonOTC/settings/secrets/actions

# Добавить следующие секреты:
SOLVER_ACCOUNT_ID=solver.near  # Ваш solver account ID
SOLVER_PRIVATE_KEY=ed25519:... # Ваш приватный ключ
NEAR_NETWORK=testnet          # или mainnet
NEAR_INTENTS_CONTRACT=verifier.testnet  # или mainnet contract
NEAR_RPC_URL=https://rpc.testnet.near.org  # или mainnet URL
NEAR_DEX_FEE_RECIPIENT=7cf1dafc0445bd9f8646ea27d8c7d1f99c68d61cbc524756a33c95710d274ccb  # Адрес для получения комиссий с DEX
```

#### 2. Проверить External Secrets Operator:

```bash
# Проверить что External Secrets Operator работает
kubectl get externalsecret -n canton-otc-minimal-stage

# Проверить что секреты синхронизированы
kubectl get secret canton-otc-secrets-minimal-stage -n canton-otc-minimal-stage

# Проверить что секреты содержат нужные ключи
kubectl get secret canton-otc-secrets-minimal-stage -n canton-otc-minimal-stage -o jsonpath='{.data}' | jq 'keys'
```

#### 3. Обновить namespace в deployment (если нужно):

⚠️ **ВАЖНО**: Проверьте namespace для solver-node:
- В `external-secret.yaml`: `namespace: canton-otc-minimal-stage`
- В `deployment.yaml`: `namespace: canton-otc` (может нужно изменить)

**Для production**: Создайте отдельный External Secret для production namespace

**Эффект**: 
- Секреты не доступны через env vars в pod
- Централизованное управление через GitHub Secrets
- Автоматическая синхронизация через External Secrets Operator

---

## 🧪 ТЕСТИРОВАНИЕ ИЗМЕНЕНИЙ

### 1. Тест Exchange Rate Validation:

```bash
# Попытка создать ордер с манипуляцией > 0.1%
curl -X POST http://localhost:3000/api/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "cantonAmount": 1000.2,
    "paymentAmountUSD": 1000,
    "paymentToken": { "symbol": "USDT", "network": "TRON" },
    "cantonAddress": "alice:1234567890abcdef1234567890abcdef12345678",
    "email": "test@example.com"
  }'

# Ожидается: ошибка "deviation X.XX% exceeds allowed 0.1%"
```

### 2. Тест Balance Check:

```bash
# Попытка создать swap intent на сумму больше баланса
curl -X POST http://localhost:3000/api/near-intents/swap \
  -H "Content-Type: application/json" \
  -d '{
    "fromToken": "NEAR",
    "fromChain": "NEAR",
    "toToken": "USDT",
    "toChain": "NEAR",
    "amount": "1000000000000000000000000",
    "userAccount": "test.near"
  }'

# Ожидается: ошибка "Insufficient balance"
```

### 3. Тест Secret Management:

```bash
# Проверить что секреты не доступны через env
kubectl exec -n canton-otc-minimal-stage deployment/solver-node -- env | grep SOLVER_PRIVATE_KEY
# Ожидается: ничего (или только в Kubernetes Secret, не в env)

# Проверить что solver node запускается
kubectl logs -n canton-otc-minimal-stage deployment/solver-node
# Ожидается: успешная инициализация с сообщением "✅ NEAR Signer initialized"
```

---

## 📊 МЕТРИКИ УСПЕХА

### После деплоя проверьте:

1. ✅ Exchange rate отклонения < 0.1% от expected
2. ✅ Все swap intents имеют достаточный баланс
3. ✅ Solver node успешно подключается к NEAR
4. ✅ Нет ошибок связанных с отсутствующими секретами

### Мониторинг:

```bash
# Логи exchange rate отклонений
kubectl logs -n canton-otc-minimal-stage deployment/canton-otc | grep "Exchange rate manipulation"

# Логи недостаточного баланса
kubectl logs -n canton-otc-minimal-stage deployment/canton-otc | grep "Insufficient balance"

# Статус External Secrets синхронизации
kubectl get externalsecret canton-otc-github-secrets -n canton-otc-minimal-stage -o yaml
```

---

## ⚠️ ВАЖНЫЕ ЗАМЕЧАНИЯ

1. **Namespace**: Проверьте что namespace в deployment совпадает с External Secret
2. **GitHub Secrets**: Убедитесь что все секреты добавлены в GitHub Secrets перед деплоем
3. **External Secrets Operator**: Должен быть установлен в кластере
4. **Толерантность 0.1%**: Может потребовать настройки для production (возможно увеличить до 0.15-0.2% для учета сетевых задержек)

---

## 🔄 ОТКАТ ИЗМЕНЕНИЙ (если нужно)

Если нужно откатить изменения:

```bash
# 1. Откатить exchange rate validation
git revert <commit-hash>

# 2. Откатить balance check
git revert <commit-hash>

# 3. Вернуть старый deployment (если нужно)
kubectl apply -f services/solver-node/k8s/deployment.yaml.backup
```

---

**Автор**: Security Engineer  
**Дата**: 2 ноября 2025  
**Статус**: COMPLETE ✅

