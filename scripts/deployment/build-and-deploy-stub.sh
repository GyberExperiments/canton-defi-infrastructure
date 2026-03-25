#!/bin/bash
set -e

echo "🚀 Building and deploying Canton API Server (Stub)"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if we're on K8s server or local
if command -v docker &> /dev/null && docker info &> /dev/null; then
  echo -e "${GREEN}✓ Docker is available${NC}"
  BUILD_LOCAL=true
else
  echo -e "${YELLOW}⚠ Docker not available locally - will use K8s node${NC}"
  BUILD_LOCAL=false
fi

# Step 1: Build and push image
if [ "$BUILD_LOCAL" = true ]; then
  echo -e "${YELLOW}1. Building Docker image locally...${NC}"
  cd canton-api-server-stub
  docker build -t ghcr.io/themacroeconomicdao/canton-api-server:latest .

  if [ -n "$GITHUB_TOKEN" ]; then
    echo -e "${YELLOW}2. Pushing to GHCR...${NC}"
    echo "$GITHUB_TOKEN" | docker login ghcr.io -u themacroeconomicdao --password-stdin
    docker push ghcr.io/themacroeconomicdao/canton-api-server:latest
  else
    echo -e "${YELLOW}⚠ GITHUB_TOKEN not set, skipping push${NC}"
  fi
  cd ..
else
  echo -e "${YELLOW}Docker not available. Please run this on K8s server:${NC}"
  echo ""
  echo "ssh user@65.108.15.30"
  echo "cd /path/to/canton-otc"
  echo "export GITHUB_TOKEN=ghp_your_token"
  echo "./build-and-deploy-stub.sh"
  exit 1
fi

# Step 2: Delete existing failed pods
echo -e "${YELLOW}3. Cleaning up failed pods...${NC}"
kubectl delete pods -n canton-otc -l app=canton-api-server --field-selector status.phase=Failed 2>/dev/null || true

# Step 3: Restart deployment to pull new image
echo -e "${YELLOW}4. Restarting deployment...${NC}"
kubectl rollout restart deployment/canton-api-server -n canton-otc

# Step 4: Wait for pods
echo -e "${YELLOW}5. Waiting for pods to be ready...${NC}"
kubectl wait --for=condition=ready pod -l app=canton-api-server -n canton-otc --timeout=120s || true

# Step 5: Check status
echo -e "${YELLOW}6. Checking pod status...${NC}"
kubectl get pods -n canton-otc -l app=canton-api-server

echo ""
echo -e "${GREEN}✅ Deployment initiated!${NC}"
echo ""
echo "Verify:"
echo "  kubectl logs -n canton-otc -l app=canton-api-server"
echo "  kubectl exec -n canton-otc deployment/canton-otc -- curl -s http://canton-api-server:8080/health"
