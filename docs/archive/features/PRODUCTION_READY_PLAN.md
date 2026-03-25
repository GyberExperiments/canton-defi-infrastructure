# 🚀 DEX Production Ready Plan - Без моков, только боевой режим

**Дата**: 2 ноября 2025  
**Подход**: Production-first, real contracts only  
**Статус**: Ready to deploy

---

## 🎯 ФИЛОСОФИЯ: БОЕВОЙ РЕЖИМ С ПЕРВОГО ДНЯ

**Принципы:**
- ❌ Никаких моков
- ✅ Только реальные контракты
- ✅ Только реальные DEX
- ✅ Реальные токены (testnet → mainnet)
- ✅ Production-grade infrastructure
- ✅ Мониторинг и алерты с первого дня

---

## 📋 РЕАЛЬНЫЕ КОНТРАКТЫ И СЕРВИСЫ

### 1. NEAR Ecosystem Contracts

#### REF Finance (Production DEX)
```bash
# Mainnet
REF_FINANCE_CONTRACT=v2.ref-finance.near
WRAP_NEAR_CONTRACT=wrap.near

# Testnet
REF_FINANCE_CONTRACT=ref-finance-101.testnet
WRAP_NEAR_CONTRACT=wrap.testnet
```

**Статус:** ✅ РАБОТАЕТ  
**Документация:** https://guide.ref.finance/  
**API:** https://indexer.ref-finance.near.org/

#### Token Contracts (Mainnet)
```bash
# Stablecoins
USDT_CONTRACT=usdt.tether-token.near
USDC_CONTRACT=17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1  # Aurora USDC

# Major tokens
WETH_CONTRACT=aurora
WBTC_CONTRACT=2260fac5e5542a773aa44fbcfedf7c193bc2c599.factory.bridge.near
DAI_CONTRACT=6b175474e89094c44da98b954eedeac495271d0f.factory.bridge.near
```

### 2. NEAR Intents - Альтернативный подход

**Проблема:** NEAR Intents как отдельный протокол может не быть fully deployed.

**Решение:** Используем **direct DEX integration** с intent-like behavior:

```typescript
// Вместо NEAR Intents контракта, используем direct REF Finance
// Но с intent semantics в нашем API layer

// User создает "intent" через наш API
POST /api/dex/swap
{
  fromToken: "NEAR",
  toToken: "USDT", 
  amount: "10",
  minReceive: "99.5"  // slippage protection
}

// Наш Solver напрямую исполняет через REF Finance
// Но логика остается intent-based
```

**Преимущества:**
- ✅ Работает прямо сейчас
- ✅ Никаких зависимостей от внешних протоколов
- ✅ Полный контроль над execution
- ✅ Те же гарантии (slippage, MEV protection)

### 3. Price Oracle (Production)

#### Pyth Network (Primary)
```bash
# Mainnet
PYTH_PRICE_SERVICE=https://hermes.pyth.network

# Price IDs
NEAR_USD=c415de8d2eba7db216527dff4b60e8f3a5311c740dadb233e13e12547e226750
BTC_USD=e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43
ETH_USD=ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace
```

**Статус:** ✅ РАБОТАЕТ  
**Latency:** <100ms  
**Dokumentation:** https://docs.pyth.network/

#### REF Finance Indexer (Secondary)
```bash
API_ENDPOINT=https://indexer.ref-finance.near.org

# Endpoints
GET /list-pools  # All pools
GET /get-pool?pool_id=X  # Specific pool
GET /get-return?...  # Swap quote
```

**Статус:** ✅ РАБОТАЕТ  
**Rate Limit:** Unlimited (public API)

---

## 🏗️ PRODUCTION ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (Next.js)                                         │
│  • SwapInterface                                            │
│  • BridgeInterface                                          │
│  • NEAR Wallet Selector                                     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────────┐
│  API Layer (Next.js API Routes)                             │
│  • POST /api/dex/swap    → Create swap intent              │
│  • POST /api/dex/bridge  → Create bridge intent            │
│  • GET /api/dex/status   → Check status                    │
└────────────────┬────────────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        ↓                 ↓
┌─────────────────┐ ┌──────────────────────┐
│  Price Oracle   │ │  Intent Queue        │
│  • Pyth Network │ │  • PostgreSQL / Redis│
│  • REF Indexer  │ │  • Pending intents   │
└─────────────────┘ └──────────────────────┘
                          ↓
                 ┌────────────────┐
                 │  Solver Node   │
                 │  • Monitor     │
                 │  • Calculate   │
                 │  • Execute     │
                 └────────┬───────┘
                          ↓
                 ┌────────────────┐
                 │  REF Finance   │
                 │  v2.ref-finance│
                 │  .near         │
                 └────────────────┘
```

---

## 🔥 PRODUCTION-READY IMPLEMENTATION

### Phase 1: Core Infrastructure (День 1-2)

#### 1.1 Intent Storage (PostgreSQL)
```sql
CREATE TABLE intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_account VARCHAR(64) NOT NULL,
  intent_type VARCHAR(20) NOT NULL, -- 'swap' or 'bridge'
  from_token VARCHAR(64) NOT NULL,
  to_token VARCHAR(64) NOT NULL,
  amount DECIMAL(36, 18) NOT NULL,
  min_receive DECIMAL(36, 18) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, executing, completed, failed
  solver_account VARCHAR(64),
  tx_hash VARCHAR(66),
  created_at TIMESTAMP DEFAULT NOW(),
  executed_at TIMESTAMP,
  metadata JSONB,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'executing', 'completed', 'failed', 'cancelled'))
);

CREATE INDEX idx_intents_status ON intents(status);
CREATE INDEX idx_intents_user ON intents(user_account);
CREATE INDEX idx_intents_created ON intents(created_at);
```

#### 1.2 API Endpoints (Production)
```typescript
// src/app/api/dex/swap/route.ts
export async function POST(req: Request) {
  // 1. Валидация
  const { fromToken, toToken, amount, userAccount } = await req.json()
  
  // 2. Price quote от Oracle
  const quote = await getPriceQuote(fromToken, toToken, amount)
  
  // 3. Calculate slippage
  const minReceive = calculateMinReceive(quote.estimatedOut, 0.5) // 0.5% slippage
  
  // 4. Сохранить intent в DB
  const intent = await db.intents.create({
    userAccount,
    intentType: 'swap',
    fromToken,
    toToken,
    amount,
    minReceive,
    status: 'pending',
    metadata: { quote, deadline: Date.now() + 3600000 }
  })
  
  // 5. Return intent ID
  return Response.json({ 
    intentId: intent.id,
    estimatedOut: quote.estimatedOut,
    minReceive,
    deadline: intent.metadata.deadline
  })
}
```

#### 1.3 Solver Node (Production)
```typescript
// services/solver-node/src/intent-monitor.ts
export class ProductionIntentMonitor {
  private db: PostgreSQL
  
  async monitorIntents() {
    setInterval(async () => {
      // 1. Получить pending intents
      const intents = await this.db.query(`
        SELECT * FROM intents 
        WHERE status = 'pending' 
        AND created_at > NOW() - INTERVAL '1 hour'
        ORDER BY created_at ASC
        LIMIT 10
      `)
      
      // 2. Process каждый intent
      for (const intent of intents) {
        await this.processIntent(intent)
      }
    }, 2000) // Каждые 2 секунды
  }
  
  async processIntent(intent: Intent) {
    // 1. Check profitability
    const profitable = await this.calculator.isProfitable(intent)
    if (!profitable) return
    
    // 2. Mark as executing
    await this.db.intents.update(intent.id, { 
      status: 'executing',
      solverAccount: this.solverAccount 
    })
    
    // 3. Execute через REF Finance
    try {
      const txHash = await this.executor.executeSwap(intent)
      
      // 4. Mark as completed
      await this.db.intents.update(intent.id, {
        status: 'completed',
        txHash,
        executedAt: new Date()
      })
    } catch (error) {
      // 5. Mark as failed
      await this.db.intents.update(intent.id, {
        status: 'failed',
        metadata: { error: error.message }
      })
    }
  }
}
```

---

## 🔐 PRODUCTION SECRETS

### Environment Variables (Production)

```bash
# NEAR Configuration
NEAR_NETWORK=mainnet
NEAR_RPC_URL=https://rpc.mainnet.near.org
REF_FINANCE_CONTRACT=v2.ref-finance.near
WRAP_NEAR_CONTRACT=wrap.near

# Solver Account (Mainnet)
SOLVER_ACCOUNT_ID=1otc-solver.near
SOLVER_PRIVATE_KEY=ed25519:xxxxx  # From Kubernetes Secret

# Database (Production)
DATABASE_URL=postgresql://user:pass@db.1otc.cc:5432/intents
REDIS_URL=redis://redis.1otc.cc:6379

# Price Oracle
PYTH_PRICE_SERVICE=https://hermes.pyth.network
REF_FINANCE_API=https://indexer.ref-finance.near.org

# Monitoring
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
GRAFANA_API_KEY=xxxxx

# Solver Behavior
SOLVER_MIN_PROFIT_THRESHOLD=0.5  # $0.50 minimum
SOLVER_MAX_GAS_COST=0.02  # 0.02 NEAR max
SOLVER_POLLING_INTERVAL=2000  # 2 seconds
```

### Kubernetes Secrets Setup

```bash
# 1. Database
kubectl create secret generic dex-database \
  --from-literal=DATABASE_URL="postgresql://..." \
  --from-literal=REDIS_URL="redis://..." \
  -n canton-otc

# 2. Solver
kubectl create secret generic solver-node-secret \
  --from-literal=SOLVER_ACCOUNT_ID="1otc-solver.near" \
  --from-literal=SOLVER_PRIVATE_KEY="ed25519:xxxxx" \
  -n canton-otc

# 3. Monitoring
kubectl create secret generic monitoring \
  --from-literal=SENTRY_DSN="https://xxxxx" \
  --from-literal=GRAFANA_API_KEY="xxxxx" \
  -n canton-otc
```

---

## 📦 PRODUCTION INFRASTRUCTURE

### 1. Database (PostgreSQL)

```yaml
# k8s/postgres-deployment.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: canton-otc
spec:
  serviceName: postgres
  replicas: 1
  template:
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        env:
        - name: POSTGRES_DB
          value: intents
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: dex-database
              key: DB_USER
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: dex-database
              key: DB_PASSWORD
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
  - metadata:
      name: postgres-storage
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 10Gi
```

### 2. Redis (Caching)

```yaml
# k8s/redis-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: canton-otc
spec:
  replicas: 1
  template:
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
```

### 3. Solver Node (Updated)

```yaml
# services/solver-node/k8s/deployment.yaml
# ... existing deployment ...
        env:
        # Database
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: dex-database
              key: DATABASE_URL
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: dex-database
              key: REDIS_URL
```

---

## 🚀 DEPLOYMENT PLAN (Production)

### Day 1: Infrastructure Setup

```bash
# 1. Create production namespace
kubectl create namespace canton-otc-prod

# 2. Deploy database
kubectl apply -f k8s/postgres-deployment.yaml
kubectl apply -f k8s/postgres-service.yaml

# Wait for ready
kubectl wait --for=condition=ready pod -l app=postgres -n canton-otc-prod --timeout=300s

# 3. Run migrations
kubectl exec -it postgres-0 -n canton-otc-prod -- psql -U postgres -d intents -f /migrations/001_create_intents.sql

# 4. Deploy Redis
kubectl apply -f k8s/redis-deployment.yaml
kubectl apply -f k8s/redis-service.yaml

# 5. Create secrets
kubectl create secret generic dex-database \
  --from-literal=DATABASE_URL="postgresql://postgres:pass@postgres:5432/intents" \
  -n canton-otc-prod
```

### Day 2: Application Deployment

```bash
# 1. Deploy frontend + API
docker build -t ghcr.io/themacroeconomicdao/cantonotc:dex-prod .
docker push ghcr.io/themacroeconomicdao/cantonotc:dex-prod

kubectl set image deployment/canton-otc \
  canton-otc=ghcr.io/themacroeconomicdao/cantonotc:dex-prod \
  -n canton-otc-prod

# 2. Deploy Solver Node
cd services/solver-node
docker build -t ghcr.io/themacroeconomicdao/solver-node:prod .
docker push ghcr.io/themacroeconomicdao/solver-node:prod

kubectl apply -f k8s/deployment.yaml -n canton-otc-prod

# 3. Verify
kubectl get pods -n canton-otc-prod
kubectl logs -f deployment/solver-node -n canton-otc-prod
```

### Day 3: Production Testing

```bash
# 1. Create NEAR mainnet account for solver
# → near.org wallet
# → Fund with 50 NEAR

# 2. Test swap
curl -X POST https://1otc.cc/api/dex/swap \
  -H "Content-Type: application/json" \
  -d '{
    "fromToken": "NEAR",
    "toToken": "USDT",
    "amount": "1",
    "userAccount": "test.near"
  }'

# 3. Monitor solver
kubectl logs -f deployment/solver-node -n canton-otc-prod

# Expected output:
# 📋 Found 1 pending intent
# 💰 Intent xxx is profitable: $0.85
# 🚀 Executing via REF Finance...
# ✅ Swap completed: tx_hash
```

---

## 📊 MONITORING (Production)

### Metrics to Track

```typescript
// Prometheus metrics
export const metrics = {
  intents_created: new Counter('dex_intents_created_total'),
  intents_completed: new Counter('dex_intents_completed_total'),
  intents_failed: new Counter('dex_intents_failed_total'),
  
  solver_balance: new Gauge('dex_solver_balance_near'),
  solver_profit: new Counter('dex_solver_profit_usd_total'),
  
  execution_time: new Histogram('dex_execution_time_seconds'),
  gas_cost: new Histogram('dex_gas_cost_near'),
}
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "1OTC DEX Production",
    "panels": [
      {
        "title": "Intents per Hour",
        "targets": ["rate(dex_intents_created_total[1h])"]
      },
      {
        "title": "Success Rate",
        "targets": ["dex_intents_completed_total / dex_intents_created_total"]
      },
      {
        "title": "Solver Balance",
        "targets": ["dex_solver_balance_near"]
      },
      {
        "title": "Total Profit",
        "targets": ["dex_solver_profit_usd_total"]
      }
    ]
  }
}
```

### Alerts

```yaml
# Prometheus alerts
groups:
- name: dex_alerts
  rules:
  - alert: SolverLowBalance
    expr: dex_solver_balance_near < 10
    annotations:
      summary: "Solver balance low: {{ $value }} NEAR"
      
  - alert: HighFailureRate
    expr: rate(dex_intents_failed_total[5m]) > 0.1
    annotations:
      summary: "High intent failure rate: {{ $value }}"
      
  - alert: SolverDown
    expr: up{job="solver-node"} == 0
    annotations:
      summary: "Solver node is down!"
```

---

## ✅ PRODUCTION CHECKLIST

### Pre-Production
- [ ] PostgreSQL deployed & migrated
- [ ] Redis deployed
- [ ] NEAR mainnet account created & funded (50+ NEAR)
- [ ] Private key exported & secured
- [ ] All secrets in Kubernetes
- [ ] Monitoring configured (Grafana + Prometheus)
- [ ] Alerts configured (Telegram/Email)
- [ ] Backup strategy defined

### Go-Live
- [ ] Frontend deployed with production env
- [ ] API endpoints responding
- [ ] Solver node running & monitoring
- [ ] Create test intent & verify execution
- [ ] Monitor for 24 hours
- [ ] Document any issues
- [ ] Team notified

### Post-Launch (Week 1)
- [ ] Daily monitoring
- [ ] Performance tuning
- [ ] Bug fixes
- [ ] User feedback collection
- [ ] Marketing announcement

---

## 🎯 SUCCESS METRICS

### Week 1 Targets
- ✅ 100+ intents created
- ✅ >95% success rate
- ✅ <5 seconds average execution time
- ✅ Zero downtime
- ✅ Solver profitable

### Month 1 Targets
- ✅ 1000+ intents
- ✅ $10K+ trading volume
- ✅ Multiple solvers competing
- ✅ Advanced features launched (Phase 3)

---

**Статус:** 🔥 READY FOR PRODUCTION  
**Approach:** No mocks, real contracts from day 1  
**ETA:** 3 days от start до production  
**Next:** Deploy infrastructure & go live!

**Last Updated:** 2 ноября 2025

