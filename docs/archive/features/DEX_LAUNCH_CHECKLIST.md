# ✅ DEX Launch Checklist - Что осталось доделать

**Дата**: 2 ноября 2025  
**Статус Phase 2**: Код готов на 100%, требуется настройка и тестирование  
**ETA до запуска**: 2-3 дня

---

## 📊 ТЕКУЩЕЕ СОСТОЯНИЕ

### ✅ ЧТО ГОТОВО (100%)

1. **Frontend DEX Components** ✅
   - SwapInterface (token swaps)
   - BridgeInterface (cross-chain)
   - NearWalletButton (wallet connection)
   - IntentHistory (transaction history)
   - Ultra Modern 2025 Design

2. **NEAR Intents SDK** ✅
   - `near-intents-sdk.ts` - Полная интеграция
   - Validation methods
   - Transaction preparation
   - Status checking

3. **Price Oracle System** ✅
   - REF Finance integration
   - Pyth Network integration
   - Multi-source aggregation
   - Automatic fallback

4. **API Endpoints** ✅
   - POST `/api/near-intents/swap`
   - POST `/api/near-intents/bridge`
   - GET `/api/near-intents/status/[intentId]`
   - GET `/api/near-intents/user/[accountId]`

5. **Solver Node** ✅
   - 7 модулей (1277 строк)
   - Intent monitoring
   - Profitability calculation
   - REF Finance execution
   - Transaction signing
   - Unit tests

6. **Documentation** ✅
   - 15+ документов
   - Deployment guides
   - Troubleshooting
   - Implementation reports

---

## 🚧 ЧТО НУЖНО ДОДЕЛАТЬ

### 🔴 КРИТИЧНО (Без этого не запустится)

#### 1. NEAR Testnet Setup

**Задача:** Создать и настроить NEAR accounts

**Действия:**
```bash
# 1.1 Создать NEAR testnet account для solver
# Перейти на: https://wallet.testnet.near.org
# Создать account: 1otc-solver.testnet

# 1.2 Пополнить баланс через faucet
# https://near-faucet.io/
# Минимум: 10 NEAR для gas

# 1.3 Wrapped NEAR для swaps
near call wrap.testnet near_deposit \
  '{}' \
  --accountId 1otc-solver.testnet \
  --amount 5 \
  --networkId testnet
```

**ETA:** 30 минут  
**Ответственный:** DevOps  
**Документация:** `services/solver-node/DEPLOYMENT_GUIDE.md` (секция "NEAR Account Setup")

---

#### 2. Export Private Key

**Задача:** Экспортировать private key из NEAR account

**Действия:**
```bash
# 2.1 Найти credentials файл
cat ~/.near-credentials/testnet/1otc-solver.testnet.json

# 2.2 Скопировать private_key
# Формат: "ed25519:5JxLKbH..."

# 2.3 Сохранить в безопасном месте
# НЕ коммитить в Git!
```

**ETA:** 5 минут  
**Ответственный:** DevOps  
**⚠️ КРИТИЧНО:** Private key должен храниться только в secrets!

---

#### 3. Создать .env для Solver Node

**Задача:** Создать конфигурационный файл

**Действия:**
```bash
# 3.1 Создать .env.example
cat > services/solver-node/.env.example << 'EOF'
# NEAR Network Configuration
NEAR_NETWORK=testnet
NEAR_RPC_URL=https://rpc.testnet.near.org
NEAR_INTENTS_CONTRACT=verifier.testnet

# Solver Configuration
SOLVER_ACCOUNT_ID=1otc-solver.testnet
SOLVER_PRIVATE_KEY=ed25519:your-private-key-here

# Solver Behavior
SOLVER_MIN_PROFIT_THRESHOLD=0.1
SOLVER_POLLING_INTERVAL=2000
SOLVER_MAX_GAS_COST=0.01

# Price Oracle
PRICE_ORACLE_ENABLED=true
REF_FINANCE_API=https://indexer.ref-finance.near.org

# Logging
LOG_LEVEL=info
EOF

# 3.2 Создать реальный .env (НЕ коммитить!)
cp services/solver-node/.env.example services/solver-node/.env
nano services/solver-node/.env
# Заполнить реальными значениями
```

**ETA:** 10 минут  
**Файл:** `services/solver-node/.env.example`

---

#### 4. Добавить NEAR секреты в систему

**Задача:** Интегрировать NEAR secrets в существующую систему управления секретами

**Действия:**

**4.1 Добавить в GitHub Secrets:**
```bash
# Через GitHub CLI
gh secret set SOLVER_ACCOUNT_ID -b "1otc-solver.testnet"
gh secret set SOLVER_PRIVATE_KEY -b "ed25519:xxxxx"
gh secret set NEAR_NETWORK -b "testnet"
gh secret set NEAR_INTENTS_CONTRACT -b "verifier.testnet"

# Или через web UI:
# https://github.com/TheMacroeconomicDao/CantonOTC/settings/secrets/actions
```

**4.2 Обновить External Secret для minimal-stage:**
```yaml
# config/kubernetes/k8s/minimal-stage/external-secret.yaml
# Добавить в data:
- secretKey: SOLVER_ACCOUNT_ID
  remoteRef:
    key: SOLVER_ACCOUNT_ID
- secretKey: SOLVER_PRIVATE_KEY
  remoteRef:
    key: SOLVER_PRIVATE_KEY
- secretKey: NEAR_NETWORK
  remoteRef:
    key: NEAR_NETWORK
- secretKey: NEAR_INTENTS_CONTRACT
  remoteRef:
    key: NEAR_INTENTS_CONTRACT
```

**4.3 Создать K8s Secret для solver-node:**
```bash
kubectl create secret generic solver-node-secret \
  --from-literal=SOLVER_ACCOUNT_ID=1otc-solver.testnet \
  --from-literal=SOLVER_PRIVATE_KEY=ed25519:xxxxx \
  --from-literal=NEAR_NETWORK=testnet \
  --from-literal=NEAR_INTENTS_CONTRACT=verifier.testnet \
  -n canton-otc
```

**ETA:** 20 минут  
**Ответственный:** DevOps  
**Документация:** См. выше анализ системы секретов

---

#### 5. Создать Kubernetes manifests для Solver

**Задача:** Подготовить K8s deployment для solver node

**Действия:**
```bash
# 5.1 Создать директорию
mkdir -p services/solver-node/k8s

# 5.2 Создать deployment.yaml
# (см. ниже полный файл)

# 5.3 Создать service.yaml (если нужен)
# (опционально для monitoring)
```

**ETA:** 30 минут  
**Файлы:** 
- `services/solver-node/k8s/deployment.yaml`
- `services/solver-node/k8s/configmap.yaml`

---

### 🟡 ВАЖНО (Для production)

#### 6. NEAR Mainnet Contracts

**Задача:** Найти или задеплоить NEAR Intents contract

**Статус:** ⚠️ НУЖНО УТОЧНИТЬ

**Варианты:**
```bash
# A) Использовать существующий контракт
NEAR_INTENTS_CONTRACT=intents.near  # если существует

# B) Задеплоить свой
near deploy --accountId intents.1otc.near \
  --wasmFile contracts/near-intents.wasm

# C) Использовать testnet для начала
NEAR_INTENTS_CONTRACT=verifier.testnet  # для тестирования
```

**ETA:** 1-2 часа (или instant если контракт есть)  
**Ответственный:** Blockchain dev  
**Зависимость:** Нужно найти NEAR Intents contract WASM

---

#### 7. REF Finance Pool IDs

**Задача:** Получить pool IDs для популярных токен пар

**Действия:**
```bash
# 7.1 Получить список пулов
curl https://indexer.ref-finance.near.org/list-pools | jq '.'

# 7.2 Найти нужные пары
# NEAR/USDT: pool_id ?
# NEAR/USDC: pool_id ?
# NEAR/ETH: pool_id ?

# 7.3 Обновить в коде (если нужно хардкодить)
# src/lib/price-oracle/ref-finance.ts
```

**ETA:** 30 минут  
**Ответственный:** Backend dev

---

#### 8. Frontend Environment Variables

**Задача:** Настроить env для фронтенда

**Действия:**
```bash
# 8.1 Обновить .env.local (или через GitHub Secrets)
NEXT_PUBLIC_NEAR_NETWORK=testnet
NEXT_PUBLIC_NEAR_WALLET_SELECTOR_NETWORK=testnet
NEXT_PUBLIC_NEAR_INTENTS_CONTRACT=verifier.testnet

# 8.2 Deploy через CI/CD
git push origin main
```

**ETA:** 10 минут  
**Файл:** `.env.local` или GitHub Secrets

---

### 🟢 ЖЕЛАТЕЛЬНО (Для лучшего UX)

#### 9. Monitoring Setup

**Задача:** Настроить мониторинг для solver node

**Действия:**
```bash
# 9.1 Добавить metrics endpoint
# В services/solver-node/src/index.ts

# 9.2 Настроить Prometheus (опционально)

# 9.3 Настроить alerts (Telegram/Email)
```

**ETA:** 2-3 часа  
**Приоритет:** LOW (можно после запуска)

---

#### 10. Rate Limiting для API

**Задача:** Добавить rate limiting для NEAR Intents API

**Действия:**
```typescript
// В src/app/api/near-intents/*/route.ts
import { rateLimit } from '@/lib/rate-limit'

export async function POST(req: Request) {
  const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 100 })
  await limiter.check(req, 10, 'CACHE_TOKEN')
  // ... rest of code
}
```

**ETA:** 1 час  
**Приоритет:** MEDIUM

---

## 🚀 ПЛАН ЗАПУСКА (Step-by-Step)

### День 1: Setup (2-3 часа)

```bash
# 1. Создать NEAR accounts
# → https://wallet.testnet.near.org
# → Создать: 1otc-solver.testnet

# 2. Пополнить баланс
# → https://near-faucet.io/

# 3. Export private key
cat ~/.near-credentials/testnet/1otc-solver.testnet.json

# 4. Создать .env файлы
cp services/solver-node/.env.example services/solver-node/.env
# Заполнить реальными значениями

# 5. Добавить секреты в GitHub
gh secret set SOLVER_ACCOUNT_ID -b "1otc-solver.testnet"
gh secret set SOLVER_PRIVATE_KEY -b "ed25519:xxxxx"
```

### День 2: Local Testing (3-4 часа)

```bash
# 1. Install dependencies
cd services/solver-node
pnpm install

# 2. Run tests
pnpm test

# 3. Build
pnpm build

# 4. Run locally
pnpm start

# Ожидаемый output:
# 🚀 Starting 1OTC Solver Node...
# ✅ NEAR Signer initialized
# 💰 Solver Account Info: balance: 10.5 NEAR
# 🎯 Starting intent monitoring...
```

### День 2-3: Frontend Testing (2-3 часа)

```bash
# 1. Update frontend env
echo "NEXT_PUBLIC_NEAR_NETWORK=testnet" >> .env.local

# 2. Run dev server
npm run dev

# 3. Open http://localhost:3000/dex

# 4. Connect NEAR wallet
# 5. Try creating a swap intent
# 6. Check solver logs - должен подхватить intent
```

### День 3: Production Deploy (2-3 часа)

```bash
# 1. Create K8s secrets
kubectl create secret generic solver-node-secret \
  --from-literal=SOLVER_ACCOUNT_ID=1otc-solver.testnet \
  --from-literal=SOLVER_PRIVATE_KEY=ed25519:xxxxx \
  -n canton-otc

# 2. Apply K8s manifests
kubectl apply -f services/solver-node/k8s/

# 3. Check deployment
kubectl get pods -n canton-otc -l app=solver-node

# 4. Check logs
kubectl logs -n canton-otc -l app=solver-node -f

# 5. Deploy frontend
git push origin main
# CI/CD автоматически задеплоит
```

---

## 📋 ЧЕКЛИСТ ЗАПУСКА

### Pre-Launch Checklist

- [ ] **NEAR Account** - Создан 1otc-solver.testnet
- [ ] **Balance** - Минимум 10 NEAR на account
- [ ] **Wrapped NEAR** - Минимум 5 wNEAR для swaps
- [ ] **Private Key** - Экспортирован и сохранен
- [ ] **.env файл** - Создан и заполнен
- [ ] **GitHub Secrets** - SOLVER_* secrets добавлены
- [ ] **K8s Secrets** - solver-node-secret создан
- [ ] **K8s Manifests** - deployment.yaml готов
- [ ] **Tests** - Unit tests проходят
- [ ] **Documentation** - Обновлена

### Launch Day Checklist

- [ ] **Local Test** - Solver запускается локально
- [ ] **Frontend Test** - DEX interface открывается
- [ ] **Wallet Connect** - NEAR Wallet подключается
- [ ] **Create Intent** - Можно создать test intent
- [ ] **Solver Pickup** - Solver видит intent
- [ ] **Execution** - Solver исполняет intent
- [ ] **Status Update** - Status обновляется в UI
- [ ] **K8s Deploy** - Solver в production
- [ ] **Monitoring** - Логи мониторятся
- [ ] **Alerts** - Alerts настроены (опционально)

---

## 🎯 КРИТИЧЕСКИЕ ЗАВИСИМОСТИ

### External Dependencies

1. **NEAR Intents Contract**
   - Status: ⚠️ НУЖНО НАЙТИ или ЗАДЕПЛОИТЬ
   - Testnet: `verifier.testnet` (если существует)
   - Mainnet: `intents.near` или `intents.1otc.near`

2. **REF Finance**
   - Status: ✅ РАБОТАЕТ
   - API: https://indexer.ref-finance.near.org
   - Pools: Нужно получить pool IDs

3. **Pyth Network**
   - Status: ✅ РАБОТАЕТ
   - API: https://hermes.pyth.network
   - Price feeds: Доступны

4. **NEAR RPC**
   - Status: ✅ РАБОТАЕТ
   - Testnet: https://rpc.testnet.near.org
   - Mainnet: https://rpc.mainnet.near.org

---

## ⚠️ РИСКИ И MITIGATION

### Risk 1: NEAR Intents Contract не существует

**Вероятность:** ВЫСОКАЯ  
**Влияние:** КРИТИЧЕСКОЕ

**Mitigation:**
1. Проверить существующие контракты
2. Если нет - использовать mock contract для тестирования
3. Разработать свой контракт (2-3 недели)

### Risk 2: REF Finance rate limits

**Вероятность:** СРЕДНЯЯ  
**Влияние:** СРЕДНЕЕ

**Mitigation:**
1. Caching pool IDs
2. Rate limiting в solver (2-5 сек polling)
3. Fallback на on-chain view methods

### Risk 3: Insufficient solver balance

**Вероятность:** СРЕДНЯЯ  
**Влияние:** СРЕДНЕЕ

**Mitigation:**
1. Monitoring балансов
2. Alerts при низком балансе
3. Auto-refill механизм (будущее)

---

## 📞 ПОДДЕРЖКА

**Документация:**
- `services/solver-node/DEPLOYMENT_GUIDE.md`
- `services/solver-node/TROUBLESHOOTING.md`
- `IMPLEMENTATION_COMPLETE.md`

**Вопросы:**
- GitHub Issues
- Team chat

---

## 🎉 ПОСЛЕ ЗАПУСКА

### Immediate (1 неделя)
- [ ] Мониторинг ошибок
- [ ] Сбор метрик
- [ ] Фикс багов
- [ ] Performance tuning

### Short-term (2-4 недели)
- [ ] Mainnet deployment
- [ ] Multiple solvers
- [ ] Advanced features (Phase 3)

### Long-term (2-3 месяца)
- [ ] Professional UI (Phase 4)
- [ ] Advanced analytics
- [ ] Marketing & Growth

---

**Статус:** 🟡 READY TO LAUNCH  
**ETA:** 2-3 дня от начала setup  
**Блокеры:** NEAR account setup + secrets configuration  
**Next Action:** Начать с пункта 1 (NEAR Testnet Setup)

**Last Updated:** 2 ноября 2025

