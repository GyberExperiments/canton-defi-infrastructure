#!/bin/bash

# 🔧 Скрипт применения RBAC для ConfigMap управления
# Настраивает права для админ панели на изменение ConfigMap

set -e

echo "🚀 Применение RBAC для ConfigMap..."
echo ""

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

NAMESPACE="canton-otc-minimal-stage"
CONFIGMAP_NAME="canton-otc-config"

# Проверка kubectl
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}❌ kubectl не найден${NC}"
    echo "Установите kubectl: https://kubernetes.io/docs/tasks/tools/"
    exit 1
fi

echo -e "${YELLOW}📋 Проверка текущего состояния...${NC}"
echo ""

# Проверка namespace
if kubectl get namespace "$NAMESPACE" &> /dev/null; then
    echo -e "${GREEN}✅ Namespace найден: $NAMESPACE${NC}"
else
    echo -e "${RED}❌ Namespace не найден: $NAMESPACE${NC}"
    echo "Создайте namespace командой: kubectl create namespace $NAMESPACE"
    exit 1
fi

# Проверка ConfigMap
if kubectl get configmap "$CONFIGMAP_NAME" -n "$NAMESPACE" &> /dev/null; then
    echo -e "${GREEN}✅ ConfigMap найден: $CONFIGMAP_NAME${NC}"
else
    echo -e "${RED}❌ ConfigMap не найден: $CONFIGMAP_NAME${NC}"
    echo "Примените ConfigMap командой: kubectl apply -f config/kubernetes/k8s/minimal-stage/configmap.yaml"
    exit 1
fi

echo ""
echo -e "${YELLOW}🔧 Применение RBAC конфигурации...${NC}"
echo ""

# Применение RBAC
kubectl apply -f config/kubernetes/k8s/minimal-stage/configmap-rbac.yaml

echo ""
echo -e "${YELLOW}🔄 Обновление Deployment...${NC}"
echo ""

# Применение обновлённого Deployment
kubectl apply -f config/kubernetes/k8s/minimal-stage/deployment.yaml

# Применение обновлённого ConfigMap
kubectl apply -f config/kubernetes/k8s/minimal-stage/configmap.yaml

echo ""
echo -e "${YELLOW}⏳ Ожидание перезапуска pod...${NC}"
echo ""

# Ожидание готовности deployment
kubectl rollout status deployment/canton-otc -n "$NAMESPACE" --timeout=5m

echo ""
echo -e "${GREEN}✅ Deployment обновлён и готов${NC}"
echo ""

# Проверка ServiceAccount
echo -e "${YELLOW}🔍 Проверка ServiceAccount...${NC}"
if kubectl get serviceaccount canton-otc-configmap-manager -n "$NAMESPACE" &> /dev/null; then
    echo -e "${GREEN}✅ ServiceAccount создан${NC}"
else
    echo -e "${RED}❌ ServiceAccount не создан${NC}"
    exit 1
fi

# Проверка Role
echo -e "${YELLOW}🔍 Проверка Role...${NC}"
if kubectl get role canton-otc-configmap-editor -n "$NAMESPACE" &> /dev/null; then
    echo -e "${GREEN}✅ Role создан${NC}"
else
    echo -e "${RED}❌ Role не создан${NC}"
    exit 1
fi

# Проверка RoleBinding
echo -e "${YELLOW}🔍 Проверка RoleBinding...${NC}"
if kubectl get rolebinding canton-otc-configmap-editor-binding -n "$NAMESPACE" &> /dev/null; then
    echo -e "${GREEN}✅ RoleBinding создан${NC}"
else
    echo -e "${RED}❌ RoleBinding не создан${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}🔐 Проверка прав доступа...${NC}"
echo ""

# Проверка прав на чтение ConfigMap
if kubectl auth can-i get configmaps \
  --as=system:serviceaccount:${NAMESPACE}:canton-otc-configmap-manager \
  -n "$NAMESPACE" 2>/dev/null | grep -q "yes"; then
    echo -e "${GREEN}✅ Права на чтение ConfigMap: OK${NC}"
else
    echo -e "${RED}❌ Нет прав на чтение ConfigMap${NC}"
fi

# Проверка прав на изменение ConfigMap
if kubectl auth can-i patch configmaps \
  --as=system:serviceaccount:${NAMESPACE}:canton-otc-configmap-manager \
  -n "$NAMESPACE" 2>/dev/null | grep -q "yes"; then
    echo -e "${GREEN}✅ Права на изменение ConfigMap: OK${NC}"
else
    echo -e "${RED}❌ Нет прав на изменение ConfigMap${NC}"
fi

echo ""
echo -e "${YELLOW}📊 Информация о pod...${NC}"
echo ""

# Получить имя pod
POD_NAME=$(kubectl get pods -n "$NAMESPACE" -l app=canton-otc -o jsonpath='{.items[0].metadata.name}')

if [ -n "$POD_NAME" ]; then
    echo -e "${GREEN}✅ Pod запущен: $POD_NAME${NC}"
    echo ""
    
    # Проверка ServiceAccount в pod
    echo -e "${YELLOW}🔍 Проверка ServiceAccount в pod...${NC}"
    SA=$(kubectl get pod "$POD_NAME" -n "$NAMESPACE" -o jsonpath='{.spec.serviceAccountName}')
    
    if [ "$SA" == "canton-otc-configmap-manager" ]; then
        echo -e "${GREEN}✅ ServiceAccount в pod: $SA${NC}"
    else
        echo -e "${RED}❌ ServiceAccount в pod: $SA (ожидается: canton-otc-configmap-manager)${NC}"
    fi
    
    echo ""
    echo -e "${YELLOW}📋 Логи pod (последние 20 строк):${NC}"
    echo ""
    kubectl logs "$POD_NAME" -n "$NAMESPACE" --tail=20
else
    echo -e "${RED}❌ Pod не найден${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Настройка завершена!${NC}"
echo ""
echo -e "${YELLOW}📌 Следующие шаги:${NC}"
echo ""
echo "1. Проверить админ панель:"
echo "   https://stage.minimal.build.infra.1otc.cc/admin/settings"
echo ""
echo "2. Изменить цену и проверить что она сохраняется"
echo ""
echo "3. Проверить логи:"
echo "   kubectl logs -f deployment/canton-otc -n $NAMESPACE | grep ConfigMap"
echo ""
echo "4. Проверить ConfigMap:"
echo "   kubectl get configmap $CONFIGMAP_NAME -n $NAMESPACE -o yaml"
echo ""
echo -e "${GREEN}✅ Готово!${NC}"

