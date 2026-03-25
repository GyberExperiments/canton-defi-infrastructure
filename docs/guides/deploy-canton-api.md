# 🚀 Deploy Canton API Server — Complete Guide

## Цель
Развернуть **Canton API Server (Rust SDK)** как **отдельный pod** в namespace `canton-otc`, рядом с Next.js приложением.

## Архитектура

```
Namespace: canton-otc
├── Deployment: canton-otc (Next.js) — 2 pods
├── Deployment: canton-api-server (Rust) — 2 pods ← NEW
├── Service: canton-otc-service → canton-otc pods
└── Service: canton-api-server → canton-api-server pods ← NEW
```

**Communication:**
```
canton-otc pods → http://canton-api-server:8080 → Canton Participant (gRPC 5001)
```

---

## Step 1: Build and Push Docker Image

### Option A: На сервере с Docker

```bash
# SSH на K8s node или build server
ssh user@65.108.15.30

# Clone repo
git clone https://github.com/themacroeconomicdao/canton-otc.git
cd canton-otc/cantonnet-omnichain-sdk

# Login to GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u themacroeconomicdao --password-stdin

# Build image
docker build -t ghcr.io/themacroeconomicdao/canton-api-server:latest \
  -f docker/Dockerfile.api-server .

# Push to registry
docker push ghcr.io/themacroeconomicdao/canton-api-server:latest

# Make it public (optional)
# Go to https://github.com/orgs/themacroeconomicdao/packages/container/canton-api-server/settings
# Change visibility to Public
```

### Option B: GitHub Actions (automated)

Create `.github/workflows/build-canton-api-server.yml`:

```yaml
name: Build Canton API Server

on:
  push:
    branches: [main, feat/canton-daml-integration]
    paths:
      - 'cantonnet-omnichain-sdk/crates/canton-api-server/**'
      - 'cantonnet-omnichain-sdk/docker/Dockerfile.api-server'
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      packages: write
      contents: read
    
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive
      
      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: ./cantonnet-omnichain-sdk
          file: ./cantonnet-omnichain-sdk/docker/Dockerfile.api-server
          push: true
          tags: |
            ghcr.io/themacroeconomicdao/canton-api-server:latest
            ghcr.io/themacroeconomicdao/canton-api-server:${{ github.sha }}
```

---

## Step 2: Create K8s Image Pull Secret

Если image приватный, создай secret для pull:

```bash
# Get GitHub Personal Access Token with read:packages scope
GITHUB_TOKEN="ghp_your_token_here"

# Create secret
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=themacroeconomicdao \
  --docker-password=$GITHUB_TOKEN \
  --docker-email=your-email@example.com \
  -n canton-otc

# Verify
kubectl get secret ghcr-secret -n canton-otc
```

Или если image **публичный** (рекомендуется для упрощения):
```bash
# Make package public at:
# https://github.com/orgs/themacroeconomicdao/packages/container/canton-api-server/settings
# → Change visibility to "Public"
# → No secret needed!
```

---

## Step 3: Update Deployment YAML

Обнови `config/kubernetes/k8s/canton-api-server-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: canton-api-server
  namespace: canton-otc
  labels:
    app: canton-api-server
    component: ledger-gateway
spec:
  replicas: 2
  selector:
    matchLabels:
      app: canton-api-server
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
  template:
    metadata:
      labels:
        app: canton-api-server
        component: ledger-gateway
    spec:
      # If private image, add this:
      # imagePullSecrets:
      # - name: ghcr-secret
      
      containers:
      - name: canton-api-server
        image: ghcr.io/themacroeconomicdao/canton-api-server:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 8080
          name: http
          protocol: TCP
        env:
        - name: CANTON_LEDGER_HOST
          value: "participant.validator.svc.cluster.local"
        - name: CANTON_LEDGER_PORT
          value: "5001"
        - name: CANTON_APPLICATION_ID
          value: "canton-otc-platform"
        - name: CANTON_PARTY_ID
          value: "otc_operator"
        - name: CANTON_LEDGER_ID
          value: "canton-otc"
        - name: RUST_LOG
          value: "canton_api_server=info,tower_http=info"
        - name: PORT
          value: "8080"
        resources:
          requests:
            memory: "128Mi"
            cpu: "50m"
          limits:
            memory: "256Mi"
            cpu: "250m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
            scheme: HTTP
          initialDelaySeconds: 10
          periodSeconds: 30
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
            scheme: HTTP
          initialDelaySeconds: 5
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
---
apiVersion: v1
kind: Service
metadata:
  name: canton-api-server
  namespace: canton-otc
  labels:
    app: canton-api-server
spec:
  type: ClusterIP
  selector:
    app: canton-api-server
  ports:
  - port: 8080
    targetPort: 8080
    protocol: TCP
    name: http
```

---

## Step 4: Deploy to K8s

```bash
# Apply deployment
kubectl apply -f config/kubernetes/k8s/canton-api-server-deployment.yaml

# Wait for pods
kubectl wait --for=condition=ready pod -l app=canton-api-server -n canton-otc --timeout=120s

# Check status
kubectl get pods -n canton-otc -l app=canton-api-server
kubectl get svc -n canton-otc canton-api-server

# Check logs
kubectl logs -n canton-otc -l app=canton-api-server --tail=50
```

**Expected output:**
```
NAME                                READY   STATUS    RESTARTS   AGE
canton-api-server-xxxxxxxxxx-xxxxx  1/1     Running   0          30s
canton-api-server-xxxxxxxxxx-xxxxx  1/1     Running   0          30s
```

---

## Step 5: Configure Next.js to Use Canton API Server

```bash
# Update ConfigMap
kubectl patch configmap canton-otc-config -n canton-otc --type merge -p '{
  "data": {
    "CANTON_API_SERVER_URL": "http://canton-api-server:8080"
  }
}'

# Verify
kubectl get configmap canton-otc-config -n canton-otc -o jsonpath='{.data.CANTON_API_SERVER_URL}'

# Restart Next.js to pick up new config
kubectl rollout restart deployment/canton-otc -n canton-otc
kubectl rollout status deployment/canton-otc -n canton-otc
```

---

## Step 6: Verify Integration

### 6.1 Health Check from Within Cluster

```bash
# From canton-otc pod
kubectl exec -n canton-otc deployment/canton-otc -- \
  curl -s http://canton-api-server:8080/health | jq

# Expected:
# {
#   "status": "healthy",
#   "connected": true,
#   "participant": "http://participant.validator.svc.cluster.local:5001",
#   "mode": "stub" or "daml-ledger-api-v2"
# }
```

### 6.2 Test Contract Creation

```bash
kubectl exec -n canton-otc deployment/canton-otc -- \
  curl -s -X POST http://canton-api-server:8080/api/v1/contracts/offer \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "TEST-001",
    "initiator": "party::test@example.com",
    "asset": "USDT",
    "quantity": 1000,
    "price": 0.101,
    "offer_type": "buy"
  }' | jq

# Expected:
# {
#   "success": true,
#   "contract_id": "00...:TEST-001",
#   "transaction_id": "tx_...",
#   "order_id": "TEST-001"
# }
```

### 6.3 Check Widget on Frontend

1. Open https://1otc.cc/
2. Above the exchange form, should see **Canton Ledger Status** widget
3. Color indicators:
   - 🟢 **Green** + "DAML Ledger API" = Canton API Server connected to participant
   - 🟠 **Amber** + "HTTP JSON API" = Fallback mode
   - 🔴 **Red** + "Offline" = Not reachable

### 6.4 Create Test Order

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

### 6.5 Check Logs

```bash
# Canton API Server logs
kubectl logs -n canton-otc -l app=canton-api-server --tail=50 -f

# Look for:
# "Creating OtcOffer contract order_id=\"ABC-123\""
# "DAML OtcOffer contract created"

# Next.js logs
kubectl logs -n canton-otc -l app=canton-otc --tail=50 -f | grep DAML

# Look for:
# "✅ DAML OtcOffer contract created: { orderId: ..., contractId: ... }"
```

---

## Troubleshooting

### Image Pull Failed

```bash
# Check deployment events
kubectl describe deployment canton-api-server -n canton-otc

# If "ImagePullBackOff":
# 1. Verify image exists:
docker pull ghcr.io/themacroeconomicdao/canton-api-server:latest

# 2. If private, create pull secret:
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=themacroeconomicdao \
  --docker-password=$GITHUB_TOKEN \
  -n canton-otc

# 3. Update deployment to use secret (add imagePullSecrets)

# 4. Or make package public
```

### Pods Not Ready

```bash
# Check pod status
kubectl get pods -n canton-otc -l app=canton-api-server
kubectl describe pod -n canton-otc -l app=canton-api-server

# Check logs
kubectl logs -n canton-otc -l app=canton-api-server --tail=100

# Common issues:
# - Port already in use → check conflicts
# - Canton participant unreachable → verify network
# - Health probe failing → check /health endpoint
```

### Canton Participant Connection Failed

```bash
# Test connectivity from Canton API Server pod
kubectl exec -n canton-otc deployment/canton-api-server -- \
  nc -zv participant.validator.svc.cluster.local 5001

# Should output: "Connection to participant.validator.svc.cluster.local 5001 port [tcp/*] succeeded!"

# If fails:
# 1. Check participant pod is running
kubectl get pods -n validator -l app=participant

# 2. Check participant service
kubectl get svc -n validator participant

# 3. Check network policies
kubectl get networkpolicies -n canton-otc
kubectl get networkpolicies -n validator
```

### Widget Shows Offline

```bash
# Check /api/canton/status endpoint
kubectl exec -n canton-otc deployment/canton-otc -- \
  curl -s http://localhost:3000/api/canton/status | jq

# If "mode": "offline":
# 1. Check CANTON_API_SERVER_URL is set
kubectl get configmap canton-otc-config -n canton-otc -o yaml | grep CANTON_API_SERVER_URL

# 2. Check canton-api-server service is accessible
kubectl exec -n canton-otc deployment/canton-otc -- \
  curl -s http://canton-api-server:8080/health

# 3. Restart Next.js pods
kubectl rollout restart deployment/canton-otc -n canton-otc
```

---

## Production Checklist

- [ ] Docker image built and pushed to ghcr.io
- [ ] Image is public OR pull secret created
- [ ] Deployment applied (2 replicas running)
- [ ] Service created and accessible
- [ ] Health checks passing (liveness + readiness)
- [ ] Canton participant reachable from pods
- [ ] ConfigMap updated with CANTON_API_SERVER_URL
- [ ] Next.js restarted and using Canton API Server
- [ ] Widget shows green on https://1otc.cc/
- [ ] Test order creates DAML contract
- [ ] Logs show contract creation
- [ ] Monitoring configured (logs, alerts)

---

## Quick Deploy Script

Save as `deploy-canton-api-server.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 Deploying Canton API Server..."

# 1. Login to GHCR (if not already)
echo "$GITHUB_TOKEN" | docker login ghcr.io -u themacroeconomicdao --password-stdin

# 2. Build and push (if Docker available locally)
cd cantonnet-omnichain-sdk
docker build -t ghcr.io/themacroeconomicdao/canton-api-server:latest -f docker/Dockerfile.api-server .
docker push ghcr.io/themacroeconomicdao/canton-api-server:latest
cd ..

# 3. Apply K8s resources
kubectl apply -f config/kubernetes/k8s/canton-api-server-deployment.yaml

# 4. Wait for rollout
kubectl wait --for=condition=ready pod -l app=canton-api-server -n canton-otc --timeout=120s

# 5. Configure Next.js
kubectl patch configmap canton-otc-config -n canton-otc --type merge \
  -p '{"data":{"CANTON_API_SERVER_URL":"http://canton-api-server:8080"}}'

# 6. Restart Next.js
kubectl rollout restart deployment/canton-otc -n canton-otc

echo "✅ Deployment complete!"
echo ""
echo "Verify:"
echo "  kubectl get pods -n canton-otc"
echo "  kubectl logs -n canton-otc -l app=canton-api-server"
echo "  curl https://1otc.cc/ (check widget)"
```

---

## Summary

**Before:**
```
canton-otc (Next.js) → Mock DAML
```

**After:**
```
canton-otc (Next.js) → canton-api-server (Rust) → Canton Participant (gRPC)
                                                  → Real DAML contracts
```

**Status**: Ready to deploy once Docker image is built and pushed to ghcr.io

**Next**: Build image on server with Docker, push to registry, apply K8s manifests.
