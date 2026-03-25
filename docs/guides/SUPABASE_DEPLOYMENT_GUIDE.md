# 🚀 Supabase Deployment Guide для 1OTC DEX

**Дата**: 2 ноября 2025  
**Статус**: Production Ready  
**Архитектура**: Self-hosted Supabase в Kubernetes

---

## 📋 ЧТО ВКЛЮЧЕНО

### Компоненты Supabase:
1. **PostgreSQL 15** - База данных с расширениями
2. **PostgREST** - Auto REST API
3. **Realtime** - WebSocket subscriptions
4. **GoTrue** - Authentication (опционально)
5. **Kong** - API Gateway
6. **pg-meta** - Database management UI

### Наши таблицы:
- `intents` - Swap/bridge requests
- `solver_stats` - Solver performance
- `price_history` - Price quotes history
- `intent_audit_log` - Audit trail

---

## 🚀 QUICK START

### Step 1: Deploy Supabase (15-20 минут)

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

# 4. Проверить статус
kubectl get pods -n supabase
```

### Step 2: Run Migrations (5 минут)

```bash
# 1. Copy migration file в pod
kubectl cp supabase/migrations/001_create_intents_schema.sql \
  supabase/postgres-0:/tmp/migration.sql

# 2. Run migration
kubectl exec -it postgres-0 -n supabase -- \
  psql -U supabase -d supabase -f /tmp/migration.sql

# 3. Verify tables
kubectl exec -it postgres-0 -n supabase -- \
  psql -U supabase -d supabase -c "\dt"

# Должны увидеть: intents, solver_stats, price_history, intent_audit_log
```

### Step 3: Configure Environment (5 минут)

```bash
# 1. Получить Supabase URL
kubectl get svc kong -n supabase

# 2. Добавить в GitHub Secrets
gh secret set NEXT_PUBLIC_SUPABASE_URL -b "http://api.1otc.cc"
gh secret set NEXT_PUBLIC_SUPABASE_ANON_KEY -b "eyJhbGc..."
gh secret set SUPABASE_SERVICE_ROLE_KEY -b "eyJhbGc..."

# 3. Добавить в K8s secrets (для Solver)
kubectl create secret generic supabase-config \
  --from-literal=SUPABASE_URL="http://kong.supabase:8000" \
  --from-literal=SUPABASE_SERVICE_ROLE_KEY="eyJhbGc..." \
  -n canton-otc
```

---

## 🔐 SECURITY SETUP

### 1. Generate JWT Secrets (ВАЖНО!)

```bash
# Generate secure JWT secret (32+ characters)
openssl rand -base64 32

# Update в postgres-secret.yaml:
# JWT_SECRET: "YOUR_GENERATED_SECRET"

# Recreate secret
kubectl delete secret postgres-secret -n supabase
kubectl apply -f k8s/supabase/postgres-statefulset.yaml
```

### 2. Generate API Keys

```javascript
// Используй https://supabase.com/docs/guides/self-hosting#api-keys
// Или через JWT encoder с правильным payload

// ANON_KEY (для frontend):
{
  "iss": "supabase",
  "ref": "localhost",
  "role": "anon",
  "iat": 1641769200,
  "exp": 1957345200
}

// SERVICE_ROLE_KEY (для backend):
{
  "iss": "supabase",
  "ref": "localhost",
  "role": "service_role",
  "iat": 1641769200,
  "exp": 1957345200
}
```

### 3. Configure RLS (Row Level Security)

Уже настроено в миграции:
- ✅ Users видят только свои intents
- ✅ Solvers могут обновлять intents
- ✅ Service role имеет full access

---

## 🔌 API ENDPOINTS

### Base URL
```
Production: https://api.1otc.cc
Internal: http://kong.supabase:8000
```

### REST API (PostgREST)
```bash
# Get pending intents
GET https://api.1otc.cc/rest/v1/intents?status=eq.pending
Authorization: Bearer ANON_KEY

# Create intent
POST https://api.1otc.cc/rest/v1/intents
Authorization: Bearer ANON_KEY
Content-Type: application/json

{
  "user_account": "user.near",
  "intent_type": "swap",
  "from_token": "NEAR",
  "to_token": "USDT",
  "amount": "1000000000000000000000000",
  "min_receive": "100000000",
  "deadline": "2025-11-03T12:00:00Z"
}

# Update intent (service_role only)
PATCH https://api.1otc.cc/rest/v1/intents?id=eq.UUID
Authorization: Bearer SERVICE_ROLE_KEY
Content-Type: application/json

{
  "status": "executing",
  "solver_account": "solver.near"
}
```

### Realtime Subscriptions
```typescript
// Subscribe к изменениям intent
import { supabase } from '@/lib/supabase'

const subscription = supabase
  .channel('intent-updates')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'intents',
      filter: `id=eq.${intentId}`,
    },
    (payload) => {
      console.log('Intent updated:', payload.new)
    }
  )
  .subscribe()
```

---

## 💻 CODE INTEGRATION

### Frontend (Next.js)

```typescript
// app/api/dex/swap/route.ts
import { intentOperations } from '@/lib/supabase'

export async function POST(req: Request) {
  const { fromToken, toToken, amount, userAccount } = await req.json()
  
  // Get price quote
  const quote = await getPriceQuote(fromToken, toToken, amount)
  
  // Calculate min_receive with slippage
  const minReceive = calculateMinReceive(quote.estimatedOut, 0.5)
  
  // Create intent in Supabase
  const intent = await intentOperations.create({
    user_account: userAccount,
    intent_type: 'swap',
    from_token: fromToken,
    to_token: toToken,
    from_chain: 'NEAR',
    to_chain: 'NEAR',
    amount: amount.toString(),
    min_receive: minReceive.toString(),
    deadline: new Date(Date.now() + 3600000).toISOString(), // 1 hour
    price_quote: quote,
  })
  
  return Response.json({
    intentId: intent.id,
    status: intent.status,
    estimatedOut: quote.estimatedOut,
  })
}
```

### Solver Node

```typescript
// services/solver-node/src/intent-monitor.ts
import { intentOperations } from './supabase-client'

export class SupabaseIntentMonitor {
  async start() {
    // Option 1: Polling
    setInterval(async () => {
      const intents = await intentOperations.getPending(10)
      for (const intent of intents) {
        await this.processIntent(intent)
      }
    }, 2000)
    
    // Option 2: Realtime (лучше!)
    intentOperations.subscribeToPending(async (intent) => {
      await this.processIntent(intent)
    })
  }
  
  async processIntent(intent: Intent) {
    // Check profitability
    const profitable = await this.calculator.isProfitable(intent)
    if (!profitable) return
    
    // Mark as executing
    await intentOperations.updateStatus(intent.id, 'executing', {
      solver_account: this.solverAccount,
    })
    
    try {
      // Execute swap
      const txHash = await this.executor.executeSwap(intent)
      
      // Mark as completed
      await intentOperations.updateStatus(intent.id, 'completed', {
        tx_hash: txHash,
        completed_at: new Date().toISOString(),
      })
    } catch (error) {
      // Mark as failed
      await intentOperations.updateStatus(intent.id, 'failed', {
        failure_reason: error.message,
      })
    }
  }
}
```

---

## 📊 MONITORING

### Database Queries

```sql
-- Active intents
SELECT status, COUNT(*) 
FROM intents 
GROUP BY status;

-- Top solvers
SELECT * FROM v_solver_leaderboard LIMIT 10;

-- Recent price quotes
SELECT * FROM price_history 
ORDER BY timestamp DESC 
LIMIT 20;

-- Intent completion rate
SELECT 
  COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / COUNT(*) as success_rate
FROM intents;
```

### Grafana Dashboard

```yaml
# Add Supabase PostgreSQL as datasource
datasource:
  type: postgres
  host: postgres.supabase:5432
  database: supabase
  user: supabase
  
# Example queries
queries:
  - name: Active Intents
    sql: SELECT COUNT(*) FROM intents WHERE status = 'pending'
    
  - name: Completed Today
    sql: SELECT COUNT(*) FROM intents WHERE status = 'completed' AND created_at > NOW() - INTERVAL '1 day'
```

---

## 🧪 TESTING

### Local Test

```bash
# 1. Port forward Supabase
kubectl port-forward -n supabase svc/kong 8000:8000

# 2. Test REST API
curl http://localhost:8000/rest/v1/intents?select=* \
  -H "apikey: YOUR_ANON_KEY"

# 3. Create test intent
curl -X POST http://localhost:8000/rest/v1/intents \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_account": "test.near",
    "intent_type": "swap",
    "from_token": "NEAR",
    "to_token": "USDT",
    "amount": "1000000",
    "min_receive": "100000",
    "deadline": "2025-11-03T12:00:00Z"
  }'
```

---

## 🚨 TROUBLESHOOTING

### Problem: PostgreSQL pod не запускается

```bash
# Check logs
kubectl logs postgres-0 -n supabase

# Check PVC
kubectl get pvc -n supabase

# Recreate if needed
kubectl delete statefulset postgres -n supabase
kubectl apply -f k8s/supabase/postgres-statefulset.yaml
```

### Problem: Migration failed

```bash
# Check current schema
kubectl exec -it postgres-0 -n supabase -- \
  psql -U supabase -d supabase -c "\d"

# Drop and recreate (DANGER!)
kubectl exec -it postgres-0 -n supabase -- \
  psql -U supabase -d supabase -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Re-run migration
kubectl exec -it postgres-0 -n supabase -- \
  psql -U supabase -d supabase -f /tmp/migration.sql
```

### Problem: RLS блокирует запросы

```bash
# Temporary disable RLS (for debugging only!)
ALTER TABLE intents DISABLE ROW LEVEL SECURITY;

# Check policies
\dp intents

# Re-enable
ALTER TABLE intents ENABLE ROW LEVEL SECURITY;
```

---

## 📚 RESOURCES

- **Supabase Docs**: https://supabase.com/docs
- **Self-hosted Guide**: https://supabase.com/docs/guides/self-hosting
- **PostgREST API**: https://postgrest.org/en/stable/
- **Realtime**: https://supabase.com/docs/guides/realtime

---

## ✅ CHECKLIST

### Pre-deployment
- [ ] Kubernetes cluster ready
- [ ] Storage class configured
- [ ] Ingress controller installed
- [ ] SSL certificates ready

### Deployment
- [ ] Namespace created
- [ ] PostgreSQL deployed & ready
- [ ] Services deployed
- [ ] Migration completed
- [ ] Tables verified
- [ ] RLS configured

### Configuration
- [ ] JWT secrets generated
- [ ] API keys created
- [ ] Secrets в GitHub
- [ ] Secrets в K8s
- [ ] Frontend env updated
- [ ] Solver env updated

### Testing
- [ ] REST API works
- [ ] Realtime works
- [ ] RLS policies work
- [ ] Create intent works
- [ ] Update intent works

---

**Статус:** ✅ READY TO DEPLOY  
**ETA:** 30-40 минут от start до production  
**Next:** Deploy PostgreSQL first!

**Last Updated:** 2 ноября 2025

