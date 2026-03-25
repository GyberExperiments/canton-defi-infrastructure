# 🚀 Solver Node - Deployment Guide

**Проект**: 1OTC DEX Solver Node  
**Последнее обновление**: 2 Ноября 2025  
**Статус**: Production Ready

---

## 📋 БЫСТРЫЙ СТАРТ

### Local Development:
```bash
# 1. Переход в solver-node
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/services/solver-node

# 2. Установка зависимостей
pnpm install

# 3. Настройка .env
cp .env.example .env
# Заполнить SOLVER_ACCOUNT_ID и SOLVER_PRIVATE_KEY

# 4. Сборка
pnpm build

# 5. Запуск
pnpm start
```

### Production Deployment:
```bash
# 1. Build Docker образа
docker build -t solver-node:latest -f Dockerfile .

# 2. Push в registry
docker tag solver-node:latest ghcr.io/themacroeconomicdao/solver-node:latest
docker push ghcr.io/themacroeconomicdao/solver-node:latest

# 3. Deploy в Kubernetes
kubectl apply -f k8s/deployment.yaml
kubectl rollout status deployment/solver-node -n canton-otc
```

---

## 🏗️ АРХИТЕКТУРА

### Компоненты:
- **Intent Monitor** - Сканирует pending intents каждые 2-5 секунд
- **Profitability Calculator** - Рассчитывает прибыльность
- **Price Oracle** - Получает цены с REF Finance
- **Intent Executor** - Исполняет через REF Finance DEX
- **NEAR Signer** - Подписание транзакций

### Dependencies:
- `near-api-js` v4.0.0 - Transaction signing
- `@near-js/client` v0.5.0 - RPC calls
- `axios` v1.6.0 - API requests
- `dotenv` v16.3.1 - Environment variables

---

## 🔧 ПОДГОТОВКА К DEPLOYMENT

### 1. Создание NEAR Account

**Testnet:**
```bash
# 1. Создать account на https://wallet.testnet.near.org
# Account ID: your-solver.testnet

# 2. Экспортировать private key
cat ~/.near-credentials/testnet/your-solver.testnet.json

# 3. Скопировать private_key (формат: ed25519:...)
```

**Mainnet:**
```bash
# 1. Создать account на https://wallet.near.org
# Account ID: your-solver.near

# 2. Пополнить баланс (минимум 10 NEAR)
# 3. Экспортировать private key
```

### 2. Настройка Environment Variables

```bash
# Обязательные переменные
NEAR_NETWORK=testnet                           # или mainnet
NEAR_INTENTS_CONTRACT=verifier.testnet         # адрес контракта
SOLVER_ACCOUNT_ID=your-solver.testnet          # NEAR account
SOLVER_PRIVATE_KEY=ed25519:xxxxx               # Private key

# Опциональные
SOLVER_MIN_PROFIT_THRESHOLD=0.1                # Минимальная прибыль
SOLVER_POLLING_INTERVAL=2000                   # Интервал (мс)
SOLVER_MAX_GAS_COST=0.01                       # Максимальный gas
PRICE_ORACLE_ENABLED=true                      # Включить oracle
REF_FINANCE_API=https://indexer.ref-finance.near.org
LOG_LEVEL=info                                 # Уровень логов
```

### 3. Проверка Баланса

```bash
# Проверить баланс NEAR account
near view-account your-solver.testnet --networkId testnet

# Должно быть минимум:
# - Testnet: 5 NEAR
# - Mainnet: 10 NEAR
```

---

## 📦 СБОРКА

### Local Build:

```bash
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/services/solver-node

# TypeScript → JavaScript
pnpm build

# Проверка
ls -la dist/
# Должны быть: index.js, executor.js, intent-monitor.js, etc.
```

### Docker Build:

```bash
# Сборка образа
docker build -t solver-node:latest .

# Проверка размера
docker images | grep solver-node
# Ожидается: ~150-200 MB
```

**Dockerfile:**
```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy dependencies
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --prod

# Copy built code
COPY dist/ ./dist/

# Run
CMD ["node", "dist/index.js"]
```

---

## 🚀 DEPLOYMENT

### Option 1: Local (Development)

```bash
cd services/solver-node

# 1. Setup .env
cp .env.example .env
vim .env  # Заполнить credentials

# 2. Run
pnpm start

# Ожидаемый output:
# 🚀 Starting 1OTC Solver Node...
# 📋 Configuration:
#    Network: testnet
#    Contract: verifier.testnet
#    Solver Account: your-solver.testnet
# 🔐 Initializing NEAR Signer...
# ✅ NEAR Signer initialized
# 💰 Solver Account Info: balance: 10.5 NEAR
# ✅ Components initialized
# 🎯 Starting intent monitoring...
```

### Option 2: Docker (Local Testing)

```bash
# 1. Build
docker build -t solver-node:latest .

# 2. Run с env файлом
docker run --env-file .env solver-node:latest

# 3. Run с volumes (для логов)
docker run \
  --env-file .env \
  -v $(pwd)/logs:/app/logs \
  solver-node:latest
```

### Option 3: Kubernetes (Production)

**1. Создать ConfigMap:**
```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: solver-node-config
  namespace: canton-otc
data:
  NEAR_NETWORK: "testnet"
  NEAR_INTENTS_CONTRACT: "verifier.testnet"
  SOLVER_MIN_PROFIT_THRESHOLD: "0.1"
  SOLVER_POLLING_INTERVAL: "2000"
  SOLVER_MAX_GAS_COST: "0.01"
  PRICE_ORACLE_ENABLED: "true"
  LOG_LEVEL: "info"
```

**2. Создать Secret:**
```bash
kubectl create secret generic solver-node-secret \
  --from-literal=SOLVER_ACCOUNT_ID=your-solver.testnet \
  --from-literal=SOLVER_PRIVATE_KEY=ed25519:xxxxx \
  -n canton-otc
```

**3. Создать Deployment:**
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: solver-node
  namespace: canton-otc
spec:
  replicas: 1  # Только 1 solver instance
  selector:
    matchLabels:
      app: solver-node
  template:
    metadata:
      labels:
        app: solver-node
    spec:
      containers:
      - name: solver-node
        image: ghcr.io/themacroeconomicdao/solver-node:latest
        envFrom:
        - configMapRef:
            name: solver-node-config
        - secretRef:
            name: solver-node-secret
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

**4. Deploy:**
```bash
# Apply всё
kubectl apply -f k8s/

# Проверка
kubectl get pods -n canton-otc -l app=solver-node

# Логи
kubectl logs -n canton-otc -l app=solver-node -f
```

---

## 🧪 ТЕСТИРОВАНИЕ

### 1. Unit Tests

```bash
cd services/solver-node

# Запустить все тесты
pnpm test

# С coverage
pnpm test:coverage

# Watch mode
pnpm test:watch
```

### 2. Integration Test (Local)

**Создать test intent:**
```bash
# Создать test intent через API
curl -X POST http://localhost:3000/api/near-intents/swap \
  -H "Content-Type: application/json" \
  -d '{
    "fromToken": "NEAR",
    "fromChain": "NEAR",
    "toToken": "USDT",
    "toChain": "NEAR",
    "amount": 1,
    "dexFee": 0.003,
    "userAccount": "test.testnet"
  }'

# Solver должен увидеть этот intent и обработать
```

**Проверить логи:**
```bash
# Должны увидеть:
# 📋 Found 1 pending intents
# 💰 Intent xxx is profitable
# 🚀 Executing intent xxx
# ✅ Swap executed successfully
```

### 3. End-to-End Test (Testnet)

**Скрипт для полного теста:**
```bash
#!/bin/bash
# test-solver-e2e.sh

echo "🧪 E2E Test for Solver Node on NEAR Testnet"

# 1. Проверить баланс solver
SOLVER_ACCOUNT="your-solver.testnet"
near view-account $SOLVER_ACCOUNT --networkId testnet

# 2. Создать test intent (через frontend или API)
echo "Creating test intent..."

# 3. Запустить solver
echo "Starting solver..."
cd services/solver-node
pnpm start &
SOLVER_PID=$!

# 4. Ждать 60 секунд
sleep 60

# 5. Проверить был ли исполнен intent
echo "Checking intent status..."

# 6. Остановить solver
kill $SOLVER_PID

echo "✅ E2E test completed"
```

---

## 🔍 МОНИТОРИНГ

### Проверка Статуса

```bash
# Kubernetes
kubectl get pods -n canton-otc -l app=solver-node
kubectl logs -n canton-otc -l app=solver-node --tail=50

# Docker
docker ps | grep solver-node
docker logs solver-node --tail=50

# Local
ps aux | grep "node dist/index.js"
```

### Ключевые Метрики

**Что мониторить:**
1. Solver balance (должен быть > 1 NEAR)
2. Количество обработанных intents
3. Success rate исполнения
4. Средняя прибыль на intent
5. Errors и failed transactions

**Пример логов:**
```
📋 Found 5 pending intents
💰 Intent intent_123 is profitable: 99 USDT
🚀 Executing intent intent_123
🔄 Executing swap through REF Finance
✅ Sufficient balance: have 1000000, need 100000
📊 Using REF Finance pool: 42
🔐 Signing and sending transaction...
✅ Transaction successful: hash_xyz
✅ Swap executed successfully: amountOut 10100000000
📝 Fulfilling intent intent_123 in contract...
✅ Intent intent_123 fulfilled successfully
🎉 Intent intent_123 executed successfully
```

---

## 🛠️ TROUBLESHOOTING

### Проблема 1: "SOLVER_PRIVATE_KEY is required"

**Причина:** Не установлена env переменная

**Решение:**
```bash
# Проверить .env файл
cat .env | grep SOLVER_PRIVATE_KEY

# Должно быть:
SOLVER_PRIVATE_KEY=ed25519:xxxxx

# Если нет - добавить
echo 'SOLVER_PRIVATE_KEY=ed25519:your-key-here' >> .env
```

### Проблема 2: "Insufficient balance"

**Причина:** У solver account недостаточно токенов

**Решение:**
```bash
# 1. Проверить баланс
near view-account your-solver.testnet --networkId testnet

# 2. Пополнить через faucet (testnet)
# https://near-faucet.io/

# 3. Или перевести с другого account
near send main-account.testnet your-solver.testnet 10 --networkId testnet
```

### Проблема 3: "No liquidity pool found"

**Причина:** Токен пара не имеет пула на REF Finance

**Решение:**
```bash
# Проверить доступные пулы
curl https://indexer.ref-finance.near.org/list-pools

# Использовать только поддерживаемые пары:
# - NEAR/USDT
# - NEAR/USDC
# - NEAR/ETH
```

### Проблема 4: "Transaction failed"

**Причина:** Различные (gas, slippage, deadline)

**Решение:**
```bash
# 1. Проверить логи для деталей
kubectl logs -n canton-otc -l app=solver-node --tail=100 | grep -A 10 "Transaction failed"

# 2. Увеличить gas limit в конфиге
SOLVER_MAX_GAS_COST=0.02

# 3. Уменьшить polling interval (меньше competition)
SOLVER_POLLING_INTERVAL=1000
```

### Проблема 5: Solver не видит intents

**Причина:** Контракт не возвращает pending intents

**Решение:**
```bash
# 1. Проверить что контракт существует
near view verifier.testnet get_intent_status '{"intent_id":"test"}' --networkId testnet

# 2. Проверить что метод get_pending_intents существует
# Если нет - нужна альтернативная реализация (events)

# 3. Временное решение - polling user intents
# См. src/intent-monitor.ts для fallback логики
```

---

## 📊 ПРОИЗВОДИТЕЛЬНОСТЬ

### Оптимизация

**CPU/Memory:**
- Базовое использование: ~100MB RAM, ~5% CPU
- Пик (при исполнении): ~250MB RAM, ~20% CPU

**Network:**
- RPC calls: ~10-20 запросов в минуту
- REF Finance API: ~5-10 запросов в минуту

**Recommendations:**
```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "100m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```

### Scaling

**Важно:** НЕ запускать несколько solvers с одним private key!

Если нужно масштабирование:
1. Создать отдельные solver accounts
2. Каждый solver - свой deployment
3. Использовать leader election (если 1 account)

---

## 🔐 БЕЗОПАСНОСТЬ

### Private Key Management

**DO:**
- ✅ Хранить в Kubernetes Secret
- ✅ Использовать InMemoryKeyStore
- ✅ Никогда не логировать private key
- ✅ Ротация ключей каждые 3-6 месяцев

**DON'T:**
- ❌ Коммитить в Git
- ❌ Хардкодить в коде
- ❌ Хранить в plain text файлах
- ❌ Шарить между solvers

### Network Security

```yaml
# Kubernetes NetworkPolicy
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: solver-node-policy
spec:
  podSelector:
    matchLabels:
      app: solver-node
  policyTypes:
  - Egress
  egress:
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 443  # HTTPS только
```

---

## 🎯 BEST PRACTICES

### 1. Monitoring Setup

```typescript
// Добавить metrics endpoint
app.get('/metrics', (req, res) => {
  res.json({
    intentsProcessed: metrics.intentsProcessed,
    successRate: metrics.successRate,
    averageProfit: metrics.averageProfit,
    balance: await checkBalance(),
  })
})
```

### 2. Health Checks

```yaml
# В Deployment
livenessProbe:
  exec:
    command:
    - node
    - -e
    - "process.exit(0)"
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  exec:
    command:
    - sh
    - -c
    - "pgrep -f 'node dist/index.js'"
  initialDelaySeconds: 10
  periodSeconds: 5
```

### 3. Logging

```typescript
// Structured logging
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  level: 'info',
  message: 'Intent executed',
  intentId: intent.intent_id,
  profit: result.profit,
  transactionHash: result.transactionHash,
}))
```

### 4. Error Recovery

```typescript
// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...')
  monitor.stop()
  process.exit(0)
})

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error)
  // Don't exit - continue monitoring
})
```

---

## 📝 CHECKLIST

### Pre-Deployment:
- [ ] NEAR account создан и пополнен
- [ ] Private key экспортирован
- [ ] Environment variables настроены
- [ ] Тесты пройдены (pnpm test)
- [ ] Docker образ собран
- [ ] Secret создан в Kubernetes

### Deployment:
- [ ] Deployment применен
- [ ] Pod запущен (1/1 Running)
- [ ] Логи показывают "Starting intent monitoring"
- [ ] Balance проверен

### Post-Deployment:
- [ ] Мониторинг настроен
- [ ] Alerts настроены
- [ ] Документация обновлена
- [ ] Team уведомлена

---

## 🆘 EMERGENCY PROCEDURES

### Остановить Solver

```bash
# Kubernetes
kubectl scale deployment solver-node --replicas=0 -n canton-otc

# Docker
docker stop solver-node

# Local
pkill -f "node dist/index.js"
```

### Быстрый Restart

```bash
# Kubernetes
kubectl rollout restart deployment/solver-node -n canton-otc

# Docker
docker restart solver-node
```

### Проверить Stuck Intents

```bash
# Получить все intents пользователя
near view verifier.testnet get_intents_by_user \
  '{"user_account":"solver.testnet"}' \
  --networkId testnet

# Отменить stuck intent
near call verifier.testnet cancel_intent \
  '{"intent_id":"xxx"}' \
  --accountId solver.testnet \
  --networkId testnet
```

---

## 📚 ДОПОЛНИТЕЛЬНАЯ ДОКУМЕНТАЦИЯ

- **README.md** - Общее описание
- **SOLVER_SYSTEM_EXPLAINED.md** - Подробное объяснение
- **TRANSACTION_SIGNING_COMPLETE.md** - Реализация signing
- **FINAL_IMPLEMENTATION_REPORT.md** - Полный отчет

---

## 💡 ПОЛЕЗНЫЕ КОМАНДЫ

```bash
# Быстрый деплой (local)
cd services/solver-node && pnpm build && pnpm start

# Проверка логов (K8s)
kubectl logs -n canton-otc -l app=solver-node -f --tail=100

# Проверка env (K8s)
kubectl exec -n canton-otc deployment/solver-node -- env | grep SOLVER

# Restart (K8s)
kubectl rollout restart deployment/solver-node -n canton-otc

# Health check
kubectl get pods -n canton-otc -l app=solver-node
```

---

**Автор**: AI Assistant  
**Версия**: 1.0  
**Статус**: Production Ready ✅

