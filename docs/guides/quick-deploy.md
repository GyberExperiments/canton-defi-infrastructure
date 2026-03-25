# 🚀 Quick Deploy Guide — Canton API Server

## Prerequisites

1. **Docker** installed (for building images)
2. **kubectl** configured to access K8s cluster
3. **GitHub Token** with `read:packages` and `write:packages` scope

## Option 1: Automated Deploy via Script

```bash
# 1. Set GitHub token
export GITHUB_TOKEN="ghp_your_token_here"

# 2. Run deployment script
./deploy-canton-api-server.sh
```

This will:
- Build Docker image from `cantonnet-omnichain-sdk/`
- Push to `ghcr.io/themacroeconomicdao/canton-api-server:latest`
- Deploy to K8s cluster in `canton-otc` namespace
- Configure Next.js to use Canton API Server
- Restart pods

## Option 2: GitHub Actions (Recommended for Production)

```bash
# 1. Push workflow to repo
git add .github/workflows/build-canton-api-server.yml
git commit -m "ci: Add Canton API Server build workflow"
git push

# 2. Trigger manually or wait for next push to main branch
# Go to GitHub Actions → "Build Canton API Server" → Run workflow

# 3. Once image is built, deploy to K8s
kubectl apply -f config/kubernetes/k8s/canton-api-server-deployment.yaml

# 4. Wait for pods
kubectl wait --for=condition=ready pod -l app=canton-api-server -n canton-otc --timeout=120s

# 5. Configure Next.js
kubectl patch configmap canton-otc-config -n canton-otc --type merge \
  -p '{"data":{"CANTON_API_SERVER_URL":"http://canton-api-server:8080"}}'

# 6. Restart Next.js
kubectl rollout restart deployment/canton-otc -n canton-otc
```

## Option 3: Manual Build on Server

If Docker is not available locally, SSH to K8s node:

```bash
# 1. SSH to server
ssh user@65.108.15.30

# 2. Clone repo
git clone https://github.com/themacroeconomicdao/canton-otc.git
cd canton-otc
git submodule update --init --recursive

# 3. Login to GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u themacroeconomicdao --password-stdin

# 4. Build image
cd cantonnet-omnichain-sdk
docker build -t ghcr.io/themacroeconomicdao/canton-api-server:latest \
  -f docker/Dockerfile.api-server .

# 5. Push to registry
docker push ghcr.io/themacroeconomicdao/canton-api-server:latest

# 6. Deploy (from main repo directory)
cd ..
kubectl apply -f config/kubernetes/k8s/canton-api-server-deployment.yaml

# 7. Configure and restart Next.js
kubectl patch configmap canton-otc-config -n canton-otc --type merge \
  -p '{"data":{"CANTON_API_SERVER_URL":"http://canton-api-server:8080"}}'
kubectl rollout restart deployment/canton-otc -n canton-otc
```

## Verification

### 1. Check Pods

```bash
kubectl get pods -n canton-otc
```

Expected output:
```
NAME                                READY   STATUS    RESTARTS   AGE
canton-api-server-xxxxxxxxxx-xxxxx  1/1     Running   0          2m
canton-api-server-xxxxxxxxxx-xxxxx  1/1     Running   0          2m
canton-otc-xxxxxxxxxx-xxxxx         1/1     Running   0          5m
canton-otc-xxxxxxxxxx-xxxxx         1/1     Running   0          5m
```

### 2. Check Service

```bash
kubectl get svc -n canton-otc canton-api-server
```

Expected:
```
NAME                TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)    AGE
canton-api-server   ClusterIP   10.43.xxx.xxx   <none>        8080/TCP   2m
```

### 3. Test Health Endpoint

```bash
kubectl exec -n canton-otc deployment/canton-otc -- \
  curl -s http://canton-api-server:8080/health | jq
```

Expected:
```json
{
  "status": "healthy",
  "connected": true,
  "participant": "http://participant.validator.svc.cluster.local:5001",
  "mode": "daml-ledger-api-v2",
  "ledger_end": "...",
  "application_id": "canton-otc-platform",
  "version": "2.10.0"
}
```

### 4. Check Widget on Frontend

Open https://1otc.cc/ and look for **Canton Ledger Status** widget above the exchange form:

- 🟢 **Green** + "DAML Ledger API" = Connected to Canton participant ✅
- 🟠 **Amber** + "HTTP JSON API" = Fallback mode
- 🔴 **Red** + "Offline" = Not reachable

### 5. Create Test Order

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
```

Expected:
```json
{
  "contractId": "00...:ORDER-123",
  "transactionId": "tx_...",
  "enabled": true
}
```

### 6. Check Logs

```bash
# Canton API Server logs
kubectl logs -n canton-otc -l app=canton-api-server --tail=50 -f

# Next.js logs
kubectl logs -n canton-otc -l app=canton-otc --tail=50 -f | grep DAML
```

## Troubleshooting

### Pods in ImagePullBackOff

```bash
# Check if image exists
docker pull ghcr.io/themacroeconomicdao/canton-api-server:latest

# If private, make it public:
# Go to https://github.com/orgs/themacroeconomicdao/packages/container/canton-api-server/settings
# Change visibility to Public

# Or create pull secret:
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=themacroeconomicdao \
  --docker-password=$GITHUB_TOKEN \
  -n canton-otc
```

### Health Check Fails

```bash
# Check Canton participant is reachable
kubectl exec -n canton-otc deployment/canton-api-server -- \
  nc -zv participant.validator.svc.cluster.local 5001

# Check logs
kubectl logs -n canton-otc -l app=canton-api-server --tail=100
```

### Widget Shows Offline

```bash
# Verify ConfigMap
kubectl get configmap canton-otc-config -n canton-otc -o yaml | grep CANTON_API_SERVER_URL

# Should output:
# CANTON_API_SERVER_URL: http://canton-api-server:8080

# If missing, add it:
kubectl patch configmap canton-otc-config -n canton-otc --type merge \
  -p '{"data":{"CANTON_API_SERVER_URL":"http://canton-api-server:8080"}}'

# Restart Next.js
kubectl rollout restart deployment/canton-otc -n canton-otc
```

## Rollback

If something goes wrong:

```bash
# Delete deployment
kubectl delete -f config/kubernetes/k8s/canton-api-server-deployment.yaml

# Remove config
kubectl patch configmap canton-otc-config -n canton-otc --type json \
  -p '[{"op": "remove", "path": "/data/CANTON_API_SERVER_URL"}]'

# Restart Next.js
kubectl rollout restart deployment/canton-otc -n canton-otc
```

## Production Checklist

- [ ] Docker image built and pushed to GHCR
- [ ] Image is public or pull secret created
- [ ] Deployment applied (2 replicas running)
- [ ] Service created and accessible
- [ ] Health checks passing
- [ ] Canton participant reachable
- [ ] ConfigMap updated
- [ ] Next.js restarted
- [ ] Widget shows green on production
- [ ] Test order creates DAML contract
- [ ] Logs show successful contract creation
- [ ] Monitoring configured

## Next Steps

1. **Monitor**: Set up alerts for Canton API Server pods
2. **Scale**: Adjust replicas based on load
3. **Backup**: Configure DAML ledger backup strategy
4. **Security**: Review network policies and access controls
5. **Optimize**: Tune resource limits based on actual usage
