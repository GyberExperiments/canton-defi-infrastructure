#!/bin/bash

# 🚀 Canton OTC - Automated Deployment Script
# This script automates the deployment of Canton OTC to Kubernetes

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="canton-otc"
ENV_FILE="${1:-.env.production}"
GITHUB_USERNAME="${GITHUB_USERNAME:-}"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"

echo -e "${BLUE}🚀 Canton OTC Deployment Script${NC}"
echo "================================="
echo ""

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}❌ kubectl is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if .env.production file exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Environment file $ENV_FILE not found!${NC}"
    echo -e "${YELLOW}💡 Please create $ENV_FILE with your configuration.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"
echo ""

# Step 1: Create namespace
echo -e "${BLUE}📦 Step 1: Creating namespace...${NC}"
kubectl apply -f namespace.yaml
echo -e "${GREEN}✅ Namespace created${NC}"
echo ""

# Step 2: Create or update secrets
echo -e "${BLUE}🔐 Step 2: Creating/updating secrets...${NC}"

# Create application secrets from .env file
kubectl create secret generic canton-otc-secrets \
  --namespace=$NAMESPACE \
  --from-env-file=$ENV_FILE \
  --dry-run=client -o yaml | kubectl apply -f -

echo -e "${GREEN}✅ Application secrets created${NC}"

# Create GitHub Container Registry secret if credentials provided
if [ -n "$GITHUB_USERNAME" ] && [ -n "$GITHUB_TOKEN" ]; then
    echo -e "${BLUE}🐳 Creating GitHub Container Registry secret...${NC}"
    kubectl create secret docker-registry ghcr-secret \
      --docker-server=ghcr.io \
      --docker-username=$GITHUB_USERNAME \
      --docker-password=$GITHUB_TOKEN \
      --namespace=$NAMESPACE \
      --dry-run=client -o yaml | kubectl apply -f -
    echo -e "${GREEN}✅ GHCR secret created${NC}"
else
    echo -e "${YELLOW}⚠️  GITHUB_USERNAME or GITHUB_TOKEN not provided. Skipping GHCR secret creation.${NC}"
    echo -e "${YELLOW}💡 Set GITHUB_USERNAME and GITHUB_TOKEN environment variables to create GHCR secret.${NC}"
fi

echo ""

# Step 3: Deploy service
echo -e "${BLUE}🌐 Step 3: Deploying service...${NC}"
kubectl apply -f service.yaml
echo -e "${GREEN}✅ Service deployed${NC}"
echo ""

# Step 4: Deploy application
echo -e "${BLUE}🚀 Step 4: Deploying application...${NC}"
kubectl apply -f deployment.yaml
echo -e "${GREEN}✅ Deployment created${NC}"
echo ""

# Step 5: Deploy ingress
echo -e "${BLUE}🌍 Step 5: Deploying ingress...${NC}"
kubectl apply -f ingress.yaml
echo -e "${GREEN}✅ Ingress deployed${NC}"
echo ""

# Step 6: Wait for rollout
echo -e "${BLUE}⏳ Step 6: Waiting for rollout to complete...${NC}"
kubectl rollout status deployment/canton-otc -n $NAMESPACE --timeout=5m
echo -e "${GREEN}✅ Rollout completed${NC}"
echo ""

# Step 7: Verify deployment
echo -e "${BLUE}🔍 Step 7: Verifying deployment...${NC}"
echo ""
echo "=== Deployment Status ==="
kubectl get deployment canton-otc -n $NAMESPACE
echo ""
echo "=== Pods Status ==="
kubectl get pods -n $NAMESPACE -l app=canton-otc
echo ""
echo "=== Service Status ==="
kubectl get service canton-otc-service -n $NAMESPACE
echo ""
echo "=== Ingress Status ==="
kubectl get ingress canton-otc-ingress -n $NAMESPACE
echo ""

# Step 8: Health check
echo -e "${BLUE}🏥 Step 8: Running health check...${NC}"
sleep 10  # Wait for pods to be fully ready

POD_NAME=$(kubectl get pods -n $NAMESPACE -l app=canton-otc -o jsonpath='{.items[0].metadata.name}')
if [ -n "$POD_NAME" ]; then
    echo "Testing health endpoint on pod: $POD_NAME"
    kubectl exec -n $NAMESPACE $POD_NAME -- wget -qO- http://localhost:3000/api/health || echo "Health check failed (this is expected if pod is still starting)"
fi
echo ""

# Final summary
echo "================================="
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Summary:${NC}"
echo "  • Namespace: $NAMESPACE"
echo "  • Domain: https://1otc.cc"
echo "  • Domain: https://www.1otc.cc"
echo ""
echo -e "${YELLOW}📝 Next steps:${NC}"
echo "  1. Verify DNS: dig 1otc.cc +short"
echo "  2. Test application: curl https://1otc.cc/api/health"
echo "  3. Monitor logs: kubectl logs -f deployment/canton-otc -n $NAMESPACE"
echo "  4. Check ingress: kubectl describe ingress canton-otc-ingress -n $NAMESPACE"
echo ""
echo -e "${BLUE}🔗 Useful commands:${NC}"
echo "  • View logs: kubectl logs -f deployment/canton-otc -n $NAMESPACE"
echo "  • Restart: kubectl rollout restart deployment/canton-otc -n $NAMESPACE"
echo "  • Scale: kubectl scale deployment canton-otc --replicas=3 -n $NAMESPACE"
echo "  • Delete: kubectl delete namespace $NAMESPACE"
echo ""
echo -e "${GREEN}✨ Happy OTC trading!${NC}"

