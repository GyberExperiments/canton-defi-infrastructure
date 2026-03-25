# 🎯 Next Steps — Canton API Server Deployment

## Текущий статус

✅ **Готово:**
- Canton API Server (Rust) разработан и собирается локально
- Next.js интегрирован с Canton API Server
- CantonLedgerStatus виджет готов
- Kubernetes deployment манифесты созданы
- GitHub Actions workflow для сборки image готов
- Документация полная

⚠️ **Осталось:**
- Собрать Docker image и запушить в ghcr.io
- Задеплоить в K8s cluster
- Проверить работу widget и DAML контрактов

---

## Вариант 1: Автоматическая сборка через GitHub Actions (РЕКОМЕНДУЕТСЯ)

### Шаг 1: Закоммитить и запушить

```bash
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc

# Commit changes
git add -A
git commit -m "feat: Add Canton API Server (Rust SDK) for real DAML contracts

- Create canton-api-server crate with Axum REST API
- Add CantonLedgerStatus widget to main page
- Integrate DAML contract creation in create-order API
- Add K8s deployment manifests
- Add GitHub Actions workflow for automated builds
- Add comprehensive documentation

Canton API Server provides:
- REST API bridge to Canton Ledger API v2
- POST /api/v1/contracts/offer - Create OtcOffer contracts
- GET /health - Connection status
- Runs in stub mode without proto files
- Production mode with real gRPC when proto available

Widget shows real-time connection status:
- Green = DAML API connected
- Amber = HTTP JSON API fallback
- Red = Offline

See DEPLOY_CANTON_API_SERVER.md for deployment guide."

# Push to GitHub
git push origin main  # или feat/canton-daml-integration
```

### Шаг 2: GitHub Actions автоматически соберет image

После push GitHub Actions:
1. Соберет Docker image
2. Запушит в `ghcr.io/themacroeconomicdao/canton-api-server:latest`
3. Сделает package публичным (если настроено)

Проверить: https://github.com/themacroeconomicdao/canton-otc/actions

### Шаг 3: Deploy в K8s

```bash
# Apply deployment
kubectl apply -f config/kubernetes/k8s/canton-api-server-deployment.yaml

# Wait for pods
kubectl wait --for=condition=ready pod -l app=canton-api-server -n canton-otc --timeout=120s

# Check status
kubectl get pods -n canton-otc -l app=canton-api-server

# Configure Next.js
kubectl patch configmap canton-otc-config -n canton-otc --type merge \
  -p '{"data":{"CANTON_API_SERVER_URL":"http://canton-api-server:8080"}}'

# Restart Next.js
kubectl rollout restart deployment/canton-otc -n canton-otc
```

---

## Вариант 2: Ручная сборка на сервере

Если GitHub Actions не подходит, собери на K8s node:

```bash
# SSH на K8s node
ssh user@65.108.15.30

# Clone или pull latest
cd /tmp
git clone https://github.com/themacroeconomicdao/canton-otc.git
cd canton-otc/cantonnet-omnichain-sdk

# Login to GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u themacroeconomicdao --password-stdin

# Build
docker build -t ghcr.io/themacroeconomicdao/canton-api-server:latest \
  -f docker/Dockerfile.api-server .

# Push
docker push ghcr.io/themacroeconomicdao/canton-api-server:latest

# Exit SSH
exit

# Deploy from local machine
kubectl apply -f config/kubernetes/k8s/canton-api-server-deployment.yaml
kubectl patch configmap canton-otc-config -n canton-otc --type merge \
  -p '{"data":{"CANTON_API_SERVER_URL":"http://canton-api-server:8080"}}'
kubectl rollout restart deployment/canton-otc -n canton-otc
```

---

## Вариант 3: Локальное тестирование без K8s

Для быстрой проверки функциональности:

```bash
# Terminal 1: Запустить Canton API Server локально
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/cantonnet-omnichain-sdk
CANTON_LEDGER_HOST=65.108.15.30 CANTON_LEDGER_PORT=30501 \
RUST_LOG=canton_api_server=info PORT=8080 \
./target/release/canton-api-server

# Terminal 2: Тест
curl http://localhost:8080/health | jq

curl -X POST http://localhost:8080/api/v1/contracts/offer \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "TEST-001",
    "initiator": "party::test@example.com",
    "asset": "USDT",
    "quantity": 1000,
    "price": 0.101,
    "offer_type": "buy"
  }' | jq
```

---

## Проверка после деплоя

### 1. Проверить pods запущены

```bash
kubectl get pods -n canton-otc

# Должно быть:
# canton-otc-xxx            1/1     Running
# canton-otc-xxx            1/1     Running
# canton-api-server-xxx     1/1     Running  ← NEW
# canton-api-server-xxx     1/1     Running  ← NEW
```

### 2. Проверить health endpoint

```bash
kubectl exec -n canton-otc deployment/canton-api-server -- \
  curl -s http://localhost:8080/health | jq

# Expected:
# {
#   "status": "healthy",
#   "connected": true,
#   "mode": "stub" or "daml-ledger-api-v2"
# }
```

### 3. Проверить widget на фронтенде

1. Открыть https://1otc.cc/
2. Должен быть виджет **над формой обмена**
3. **Зеленый** индикатор = успех

### 4. Создать тестовый заказ

```bash
curl -X POST https://1otc.cc/api/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "cantonAddress": "1220abcdef1234567890abcdef1234567890abcdef1234567890abcdef12345678",
    "orderType": "buy",
    "usdtAmount": 1000,
    "cantonAmount": 9900
  }' | jq '.daml'

# Expected:
# {
#   "contractId": "00...:ORDER-123",
#   "transactionId": "tx_...",
#   "enabled": true
# }
```

### 5. Проверить логи

```bash
# Canton API Server
kubectl logs -n canton-otc -l app=canton-api-server --tail=50

# Next.js
kubectl logs -n canton-otc -l app=canton-otc --tail=50 | grep DAML
```

---

## Troubleshooting

### ImagePullBackOff

```bash
# Check if image exists
docker pull ghcr.io/themacroeconomicdao/canton-api-server:latest

# If 403 Forbidden → make package public:
# https://github.com/orgs/themacroeconomicdao/packages/container/canton-api-server/settings
# Change visibility to Public
```

### Pods CrashLoopBackOff

```bash
kubectl describe pod -n canton-otc -l app=canton-api-server
kubectl logs -n canton-otc -l app=canton-api-server --tail=100
```

### Widget shows Red/Offline

```bash
# Check ConfigMap
kubectl get configmap canton-otc-config -n canton-otc -o yaml | grep CANTON_API_SERVER_URL

# Should be: CANTON_API_SERVER_URL: http://canton-api-server:8080

# If missing, apply:
kubectl patch configmap canton-otc-config -n canton-otc --type merge \
  -p '{"data":{"CANTON_API_SERVER_URL":"http://canton-api-server:8080"}}'
kubectl rollout restart deployment/canton-otc -n canton-otc
```

---

## Что дальше после успешного деплоя

1. **Deploy DAR files** — загрузить DAML контракты на Canton participant
   ```bash
   cd daml-contracts
   daml build
   daml ledger upload-dar .daml/dist/otc-contracts-0.1.0.dar \
     --host 65.108.15.30 --port 30501
   ```

2. **Update Package ID** — обновить `CANTON_OTC_PACKAGE_ID` в Canton API Server env

3. **Enable real gRPC mode** — добавить proto files для production Canton Ledger API v2

4. **Admin Dashboard** — создать UI для просмотра DAML контрактов

5. **Monitoring** — настроить Prometheus metrics endpoint

---

## Summary Commands (Copy-Paste Ready)

```bash
# ============================================
# QUICK DEPLOY — Canton API Server
# ============================================

# 1. Commit and push (triggers GitHub Actions build)
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc
git add -A
git commit -m "feat: Add Canton API Server for real DAML contracts"
git push origin main

# 2. Wait for GitHub Actions to build image (~5-10 min)
# Check: https://github.com/themacroeconomicdao/canton-otc/actions

# 3. Deploy to K8s
kubectl apply -f config/kubernetes/k8s/canton-api-server-deployment.yaml
kubectl wait --for=condition=ready pod -l app=canton-api-server -n canton-otc --timeout=120s

# 4. Configure Next.js
kubectl patch configmap canton-otc-config -n canton-otc --type merge \
  -p '{"data":{"CANTON_API_SERVER_URL":"http://canton-api-server:8080"}}'
kubectl rollout restart deployment/canton-otc -n canton-otc

# 5. Verify
kubectl get pods -n canton-otc
kubectl logs -n canton-otc -l app=canton-api-server --tail=20
curl https://1otc.cc/ # Check widget

# ============================================
# DONE! ✅
# ============================================
```

---

## Files Created

```
canton-otc/
├── .github/workflows/
│   └── build-canton-api-server.yml          ← GitHub Actions workflow
├── cantonnet-omnichain-sdk/
│   ├── crates/canton-api-server/            ← Rust API server source
│   ├── docker/Dockerfile.api-server         ← Docker build
│   └── scripts/run-api-server-dev.sh        ← Local dev script
├── config/kubernetes/k8s/
│   └── canton-api-server-deployment.yaml    ← K8s manifests
├── src/
│   ├── app/api/canton/status/route.ts       ← Status API
│   ├── components/CantonLedgerStatus.tsx    ← Widget
│   └── app/api/create-order/route.ts        ← Modified (DAML integration)
└── Documentation:
    ├── DEPLOY_CANTON_API_SERVER.md          ← Full deployment guide
    ├── CANTON_DAML_INTEGRATION_GUIDE.md     ← Integration guide
    ├── CHANGELOG_DAML_INTEGRATION.md        ← Changelog
    ├── DAML_INTEGRATION_SUMMARY.md          ← Executive summary
    └── NEXT_STEPS.md                        ← This file
```

---

**Current Status**: ✅ Ready to deploy

**Next Action**: Commit → Push → GitHub Actions builds image → Deploy to K8s

**Expected Time**: 15-20 minutes total
