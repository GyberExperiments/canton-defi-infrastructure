#!/bin/bash
# 🚀 Canton DAML Integration — Quick Deploy Commands

set -e

echo "🏛️ Canton DAML Integration Deployment"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Build Rust Canton API Server
echo -e "${YELLOW}Step 1: Building Canton API Server (Rust)...${NC}"
cd cantonnet-omnichain-sdk
cargo build --release -p canton-api-server
echo -e "${GREEN}✅ Rust build complete${NC}"
echo ""

# Step 2: Build Docker Image
echo -e "${YELLOW}Step 2: Building Docker image...${NC}"
docker build -t ghcr.io/themacroeconomicdao/canton-api-server:latest \
  -f docker/Dockerfile.api-server .
echo -e "${GREEN}✅ Docker image built${NC}"
echo ""

# Step 3: Push to Registry
echo -e "${YELLOW}Step 3: Pushing to GitHub Container Registry...${NC}"
echo "You may need to authenticate: docker login ghcr.io"
docker push ghcr.io/themacroeconomicdao/canton-api-server:latest
echo -e "${GREEN}✅ Image pushed to ghcr.io${NC}"
echo ""

# Step 4: Deploy to Kubernetes
echo -e "${YELLOW}Step 4: Deploying to Kubernetes...${NC}"
cd ..
kubectl apply -f config/kubernetes/k8s/canton-api-server-deployment.yaml
echo -e "${GREEN}✅ Kubernetes deployment created${NC}"
echo ""

# Step 5: Wait for pods
echo -e "${YELLOW}Step 5: Waiting for pods to be ready...${NC}"
kubectl wait --for=condition=ready pod -l app=canton-api-server -n canton-otc --timeout=60s
echo -e "${GREEN}✅ Pods are ready${NC}"
echo ""

# Step 6: Configure Next.js
echo -e "${YELLOW}Step 6: Configuring Next.js to use Canton API Server...${NC}"
kubectl patch configmap canton-otc-config -n canton-otc --type merge -p '{
  "data": {
    "CANTON_API_SERVER_URL": "http://canton-api-server:8080"
  }
}'
echo -e "${GREEN}✅ ConfigMap patched${NC}"
echo ""

# Step 7: Restart Next.js
echo -e "${YELLOW}Step 7: Restarting Next.js deployment...${NC}"
kubectl rollout restart deployment/canton-otc -n canton-otc
kubectl rollout status deployment/canton-otc -n canton-otc --timeout=120s
echo -e "${GREEN}✅ Next.js restarted${NC}"
echo ""

# Step 8: Verify
echo -e "${YELLOW}Step 8: Verifying deployment...${NC}"
echo ""

echo "Canton API Server pods:"
kubectl get pods -n canton-otc -l app=canton-api-server

echo ""
echo "Next.js pods:"
kubectl get pods -n canton-otc -l app=canton-otc

echo ""
echo -e "${YELLOW}Testing health endpoint...${NC}"
sleep 5
HEALTH_OUTPUT=$(kubectl exec -n canton-otc deployment/canton-api-server -- curl -s http://localhost:8080/health)
echo "$HEALTH_OUTPUT" | jq .

if echo "$HEALTH_OUTPUT" | jq -e '.connected == true' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Canton API Server is connected to participant!${NC}"
else
  echo -e "${RED}⚠️ Canton API Server is not connected. Check logs:${NC}"
  echo "kubectl logs -n canton-otc deployment/canton-api-server --tail=50"
fi

echo ""
echo -e "${GREEN}======================================"
echo "🎉 Deployment Complete!"
echo "======================================${NC}"
echo ""
echo "Next steps:"
echo "1. Visit https://1otc.cc/ and check the Canton Ledger Status widget"
echo "2. Create a test order and verify DAML contract is created"
echo "3. Check logs:"
echo "   - Canton API: kubectl logs -n canton-otc deployment/canton-api-server -f"
echo "   - Next.js: kubectl logs -n canton-otc deployment/canton-otc -f | grep DAML"
echo ""
echo "See CANTON_DAML_INTEGRATION_GUIDE.md for full documentation."
