#!/bin/bash

# 🔍 Debug deployment issues
# Helps diagnose why deployment is stuck

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

NAMESPACE="canton-otc-minimal-stage"

echo -e "${YELLOW}🔍 Debugging Canton OTC Deployment${NC}"
echo ""

# 1. Check deployment status
echo -e "${YELLOW}📊 Deployment Status:${NC}"
kubectl get deployment canton-otc -n $NAMESPACE
echo ""

# 2. Check pods
echo -e "${YELLOW}🐳 Pods Status:${NC}"
kubectl get pods -n $NAMESPACE -l app=canton-otc
echo ""

# 3. Check recent events
echo -e "${YELLOW}📋 Recent Events:${NC}"
kubectl get events -n $NAMESPACE --sort-by='.lastTimestamp' | tail -20
echo ""

# 4. Describe deployment
echo -e "${YELLOW}📄 Deployment Details:${NC}"
kubectl describe deployment canton-otc -n $NAMESPACE | tail -50
echo ""

# 5. Check pod logs (old pod)
echo -e "${YELLOW}📝 Old Pod Logs (last 50 lines):${NC}"
OLD_POD=$(kubectl get pods -n $NAMESPACE -l app=canton-otc --sort-by=.metadata.creationTimestamp | grep Running | tail -1 | awk '{print $1}')
if [ -n "$OLD_POD" ]; then
    echo "Pod: $OLD_POD"
    kubectl logs $OLD_POD -n $NAMESPACE --tail=50
else
    echo "No running pod found"
fi
echo ""

# 6. Check new pod if exists
echo -e "${YELLOW}🆕 New Pod Status:${NC}"
NEW_POD=$(kubectl get pods -n $NAMESPACE -l app=canton-otc --sort-by=.metadata.creationTimestamp | grep -v Running | tail -1 | awk '{print $1}')
if [ -n "$NEW_POD" ]; then
    echo "New pod: $NEW_POD"
    kubectl describe pod $NEW_POD -n $NAMESPACE | tail -50
    echo ""
    echo -e "${YELLOW}📝 New Pod Logs:${NC}"
    kubectl logs $NEW_POD -n $NAMESPACE --tail=100 2>&1 || echo "No logs yet or pod not started"
else
    echo "No new pod found yet"
fi
echo ""

# 7. Check ReplicaSet
echo -e "${YELLOW}📦 ReplicaSets:${NC}"
kubectl get rs -n $NAMESPACE -l app=canton-otc
echo ""

# 8. Check image pull
echo -e "${YELLOW}🖼️  Image Pull Status:${NC}"
kubectl describe deployment canton-otc -n $NAMESPACE | grep -A5 "Image:"
echo ""

echo -e "${GREEN}✅ Diagnostic complete!${NC}"
echo ""
echo -e "${YELLOW}💡 Common issues:${NC}"
echo "1. Image pull failed - check GHCR token"
echo "2. Application crash on startup - check logs above"
echo "3. Resource limits - check if pod has enough memory/CPU"
echo "4. ConfigMap/Secret missing - check if all required configs exist"
echo ""
echo -e "${YELLOW}🔧 Quick fixes:${NC}"
echo "Rollback to previous version:"
echo "  kubectl rollout undo deployment/canton-otc -n $NAMESPACE"
echo ""
echo "Force restart:"
echo "  kubectl rollout restart deployment/canton-otc -n $NAMESPACE"
echo ""
echo "Scale down and up:"
echo "  kubectl scale deployment canton-otc -n $NAMESPACE --replicas=0"
echo "  kubectl scale deployment canton-otc -n $NAMESPACE --replicas=1"

