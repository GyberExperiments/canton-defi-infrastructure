#!/bin/bash
set -e

echo "🚀 Deploying Canton API Server..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if GITHUB_TOKEN is set
if [ -z "$GITHUB_TOKEN" ]; then
  echo -e "${RED}❌ Error: GITHUB_TOKEN not set${NC}"
  echo "Export it first: export GITHUB_TOKEN=ghp_your_token_here"
  exit 1
fi

# Check if kubectl is configured
if ! kubectl cluster-info &> /dev/null; then
  echo -e "${RED}❌ Error: kubectl not configured or cluster unreachable${NC}"
  exit 1
fi

echo -e "${YELLOW}1. Logging into GHCR...${NC}"
echo "$GITHUB_TOKEN" | docker login ghcr.io -u themacroeconomicdao --password-stdin

echo -e "${YELLOW}2. Building Docker image...${NC}"
cd cantonnet-omnichain-sdk
docker build -t ghcr.io/themacroeconomicdao/canton-api-server:latest \
  -f docker/Dockerfile.api-server .
cd ..

echo -e "${YELLOW}3. Pushing to GHCR...${NC}"
docker push ghcr.io/themacroeconomicdao/canton-api-server:latest

echo -e "${YELLOW}4. Applying K8s deployment...${NC}"
kubectl apply -f config/kubernetes/k8s/canton-api-server-deployment.yaml

echo -e "${YELLOW}5. Waiting for pods to be ready...${NC}"
kubectl wait --for=condition=ready pod -l app=canton-api-server -n canton-otc --timeout=120s

echo -e "${YELLOW}6. Updating ConfigMap...${NC}"
kubectl patch configmap canton-otc-config -n canton-otc --type merge \
  -p '{"data":{"CANTON_API_SERVER_URL":"http://canton-api-server:8080"}}'

echo -e "${YELLOW}7. Restarting Next.js deployment...${NC}"
kubectl rollout restart deployment/canton-otc -n canton-otc
kubectl rollout status deployment/canton-otc -n canton-otc

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "Verification commands:"
echo "  kubectl get pods -n canton-otc"
echo "  kubectl logs -n canton-otc -l app=canton-api-server"
echo "  kubectl exec -n canton-otc deployment/canton-otc -- curl -s http://canton-api-server:8080/health"
echo ""
echo "Test on production:"
echo "  curl https://1otc.cc/ (check Canton Ledger Status widget)"
