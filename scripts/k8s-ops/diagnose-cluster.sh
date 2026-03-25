#!/bin/bash
# 🔍 Скрипт диагностики кластера и восстановления проекта

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

NAMESPACE="canton-otc"
DEPLOYMENT="canton-otc"

echo -e "${BLUE}🔍 ДИАГНОСТИКА КЛАСТЕРА И ПРОЕКТА${NC}"
echo "=================================="
echo ""

# 1. Проверка доступности кластера
echo -e "${BLUE}1. Проверка доступности кластера...${NC}"
if kubectl cluster-info &>/dev/null; then
    echo -e "${GREEN}✅ Кластер доступен${NC}"
    kubectl cluster-info | head -1
else
    echo -e "${RED}❌ Кластер недоступен${NC}"
    echo "Попробуйте подключиться через SSH к одной из нод:"
    echo "  - 65.108.15.30 (worker node)"
    echo "  - 65.108.15.20 (worker node)"
    echo "  - 65.108.15.19 (worker node)"
    exit 1
fi
echo ""

# 2. Проверка нод
echo -e "${BLUE}2. Проверка нод кластера...${NC}"
kubectl get nodes -o wide
echo ""

# 3. Проверка namespace
echo -e "${BLUE}3. Проверка namespace ${NAMESPACE}...${NC}"
if kubectl get namespace ${NAMESPACE} &>/dev/null; then
    echo -e "${GREEN}✅ Namespace существует${NC}"
else
    echo -e "${RED}❌ Namespace не существует${NC}"
    echo "Создаю namespace..."
    kubectl create namespace ${NAMESPACE}
fi
echo ""

# 4. Проверка всех ресурсов в namespace
echo -e "${BLUE}4. Проверка ресурсов в namespace ${NAMESPACE}...${NC}"
echo "--- Deployments ---"
kubectl get deployments -n ${NAMESPACE} || echo "Нет deployments"
echo ""
echo "--- Pods ---"
kubectl get pods -n ${NAMESPACE} -o wide
echo ""
echo "--- Services ---"
kubectl get services -n ${NAMESPACE} || echo "Нет services"
echo ""
echo "--- Ingress ---"
kubectl get ingress -n ${NAMESPACE} || echo "Нет ingress"
echo ""

# 5. Детальная диагностика подов
echo -e "${BLUE}5. Детальная диагностика подов...${NC}"
PODS=$(kubectl get pods -n ${NAMESPACE} -l app=${DEPLOYMENT} -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")

if [ -z "$PODS" ]; then
    echo -e "${RED}❌ Поды не найдены${NC}"
    echo "Проверяю deployment..."
    kubectl describe deployment ${DEPLOYMENT} -n ${NAMESPACE} || echo "Deployment не существует"
else
    for POD in $PODS; do
        echo ""
        echo "--- Pod: $POD ---"
        kubectl get pod $POD -n ${NAMESPACE} -o wide
        echo ""
        echo "Статус:"
        kubectl get pod $POD -n ${NAMESPACE} -o jsonpath='{.status.phase}' 2>/dev/null || echo "Unknown"
        echo ""
        echo "События (последние 5):"
        kubectl get events -n ${NAMESPACE} --field-selector involvedObject.name=$POD --sort-by='.lastTimestamp' | tail -5 || echo "Нет событий"
        echo ""
        echo "Логи (последние 10 строк):"
        kubectl logs $POD -n ${NAMESPACE} --tail=10 2>&1 || echo "Не удалось получить логи"
    done
fi
echo ""

# 6. Проверка ConfigMap и Secrets
echo -e "${BLUE}6. Проверка ConfigMap и Secrets...${NC}"
echo "--- ConfigMaps ---"
kubectl get configmaps -n ${NAMESPACE} || echo "Нет ConfigMaps"
echo ""
echo "--- Secrets ---"
kubectl get secrets -n ${NAMESPACE} || echo "Нет Secrets"
echo ""

# Проверка критичных ConfigMap
if kubectl get configmap canton-otc-config -n ${NAMESPACE} &>/dev/null; then
    echo -e "${GREEN}✅ ConfigMap canton-otc-config существует${NC}"
    echo "Ключи в ConfigMap:"
    kubectl get configmap canton-otc-config -n ${NAMESPACE} -o jsonpath='{.data}' | jq -r 'keys[]' 2>/dev/null || echo "Не удалось прочитать ключи"
else
    echo -e "${RED}❌ ConfigMap canton-otc-config не существует${NC}"
fi
echo ""

# Проверка критичных Secrets
if kubectl get secret canton-otc-secrets -n ${NAMESPACE} &>/dev/null; then
    echo -e "${GREEN}✅ Secret canton-otc-secrets существует${NC}"
    echo "Ключи в Secret:"
    kubectl get secret canton-otc-secrets -n ${NAMESPACE} -o jsonpath='{.data}' | jq -r 'keys[]' 2>/dev/null || echo "Не удалось прочитать ключи"
else
    echo -e "${RED}❌ Secret canton-otc-secrets не существует${NC}"
fi
echo ""

# 7. Проверка Service и Ingress
echo -e "${BLUE}7. Проверка Service и Ingress...${NC}"
SERVICE=$(kubectl get service -n ${NAMESPACE} -l app=${DEPLOYMENT} -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
if [ -n "$SERVICE" ]; then
    echo "Service: $SERVICE"
    kubectl describe service $SERVICE -n ${NAMESPACE} | grep -A 5 "Endpoints:" || echo "Нет endpoints"
else
    echo -e "${RED}❌ Service не найден${NC}"
fi
echo ""

# 8. Проверка всех проектов на кластере
echo -e "${BLUE}8. Список всех проектов на кластере...${NC}"
echo "--- Все namespaces ---"
kubectl get namespaces
echo ""
echo "--- Все deployments (топ 20) ---"
kubectl get deployments --all-namespaces | head -20
echo ""

# 9. Рекомендации по восстановлению
echo -e "${YELLOW}📋 РЕКОМЕНДАЦИИ ПО ВОССТАНОВЛЕНИЮ:${NC}"
echo ""
echo "Если поды не запускаются:"
echo "1. Проверьте логи: kubectl logs <pod-name> -n ${NAMESPACE}"
echo "2. Проверьте события: kubectl get events -n ${NAMESPACE} --sort-by='.lastTimestamp'"
echo "3. Проверьте ресурсы: kubectl top nodes && kubectl top pods -n ${NAMESPACE}"
echo ""
echo "Если ConfigMap/Secret отсутствуют:"
echo "1. Примените манифесты: kubectl apply -f config/kubernetes/k8s/"
echo ""
echo "Если нужно перезапустить deployment:"
echo "1. kubectl rollout restart deployment/${DEPLOYMENT} -n ${NAMESPACE}"
echo "2. kubectl rollout status deployment/${DEPLOYMENT} -n ${NAMESPACE}"
echo ""
echo "Если нужно обновить образ:"
echo "1. COMMIT_HASH=\$(git rev-parse --short HEAD)"
echo "2. kubectl set image deployment/${DEPLOYMENT} ${DEPLOYMENT}=ghcr.io/themacroeconomicdao/cantonotc:\$COMMIT_HASH -n ${NAMESPACE}"
echo ""

echo -e "${GREEN}✅ Диагностика завершена${NC}"

