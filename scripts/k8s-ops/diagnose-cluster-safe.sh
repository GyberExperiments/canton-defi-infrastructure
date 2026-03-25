#!/bin/bash
# Безопасная диагностика кластера с ограничениями и проверками

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 БЕЗОПАСНАЯ ДИАГНОСТИКА КЛАСТЕРА${NC}"
echo "=============================================="
echo ""

# Проверка доступности кластера
if ! kubectl cluster-info &>/dev/null; then
    echo -e "${RED}❌ Кластер недоступен${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Кластер доступен${NC}"
echo ""

# 1. Состояние узлов
echo -e "${BLUE}📊 Состояние узлов:${NC}"
kubectl get nodes -o wide 2>/dev/null | head -10
echo ""

# 2. Использование ресурсов узлов
echo -e "${BLUE}💻 Использование ресурсов:${NC}"
kubectl top nodes 2>/dev/null || echo -e "${YELLOW}⚠️  metrics-server недоступен${NC}"
echo ""

# 3. Количество Pending подов (быстро, без деталей)
echo -e "${BLUE}⏳ Подсчет Pending подов...${NC}"
PENDING_TOTAL=$(kubectl get pods --all-namespaces --field-selector=status.phase=Pending --no-headers 2>/dev/null | wc -l | tr -d ' ')
echo -e "Всего Pending подов: ${YELLOW}$PENDING_TOTAL${NC}"

# 4. Pending поды по namespace (топ-10)
echo -e "${BLUE}📦 Pending поды по namespace (топ-10):${NC}"
kubectl get pods --all-namespaces --field-selector=status.phase=Pending --no-headers 2>/dev/null | \
    awk '{print $1}' | sort | uniq -c | sort -rn | head -10
echo ""

# 5. Примеры Pending подов (первые 5) - с ограничением времени
echo -e "${BLUE}📋 Примеры Pending подов (первые 5):${NC}"
(kubectl get pods --all-namespaces --field-selector=status.phase=Pending --no-headers 2>/dev/null | head -5) || echo -e "${YELLOW}⚠️  Превышено время ожидания${NC}"
echo ""

# 6. Детали одного Pending пода (если есть)
FIRST_PENDING=$(kubectl get pods --all-namespaces --field-selector=status.phase=Pending --no-headers 2>/dev/null | head -1)
if [ -n "$FIRST_PENDING" ]; then
    NS=$(echo "$FIRST_PENDING" | awk '{print $1}')
    POD=$(echo "$FIRST_PENDING" | awk '{print $2}')
    echo -e "${BLUE}🔍 Детали пода $NS/$POD:${NC}"
    kubectl describe pod "$POD" -n "$NS" 2>/dev/null | grep -A 10 "Events:" | head -15 || echo -e "${YELLOW}⚠️  Не удалось получить детали${NC}"
    echo ""
fi

# 7. Зависшие поды на отключенном узле
echo -e "${BLUE}🔴 Зависшие поды на отключенном узле:${NC}"
TERMINATING_COUNT=$(kubectl get pods --all-namespaces -o json 2>/dev/null | \
    jq -r '.items[] | select(.spec.nodeName=="canton-node-65-108-15-30" and .metadata.deletionTimestamp != null) | "\(.metadata.namespace)/\(.metadata.name)"' 2>/dev/null | wc -l | tr -d ' ')
echo -e "Зависших подов в Terminating: ${YELLOW}$TERMINATING_COUNT${NC}"
if [ "$TERMINATING_COUNT" -gt 0 ]; then
    kubectl get pods --all-namespaces -o json 2>/dev/null | \
        jq -r '.items[] | select(.spec.nodeName=="canton-node-65-108-15-30" and .metadata.deletionTimestamp != null) | "\(.metadata.namespace)/\(.metadata.name)"' 2>/dev/null | head -10
fi
echo ""

# 8. Поды в maximus
echo -e "${BLUE}📦 Поды в namespace maximus:${NC}"
kubectl get pods -n maximus 2>/dev/null || echo -e "${YELLOW}⚠️  Namespace maximus не найден${NC}"
echo ""

# 9. Cert-manager поды
echo -e "${BLUE}🔐 Cert-manager поды:${NC}"
kubectl get pods -n cert-manager 2>/dev/null || echo -e "${YELLOW}⚠️  Namespace cert-manager не найден${NC}"
echo ""

# 10. Challenges с ошибками
echo -e "${BLUE}⚠️  Challenges с ошибками:${NC}"
ERROR_CHALLENGES=$(kubectl get challenges -A 2>/dev/null | grep -i error | wc -l | tr -d ' ')
echo -e "Challenges с ошибками: ${YELLOW}$ERROR_CHALLENGES${NC}"
if [ "$ERROR_CHALLENGES" -gt 0 ]; then
    kubectl get challenges -A 2>/dev/null | grep -i error | head -5
fi
echo ""

# 11. Поды на control-plane узле
echo -e "${BLUE}🖥️  Поды на control-plane узле (tmedm):${NC}"
kubectl get pods --all-namespaces -o wide --field-selector spec.nodeName=tmedm 2>/dev/null | head -10
echo ""

# 12. Топ подов по CPU (если доступно)
echo -e "${BLUE}🔥 Топ подов по CPU:${NC}"
kubectl top pods --all-namespaces --sort-by=cpu 2>/dev/null | head -10 || echo -e "${YELLOW}⚠️  metrics-server недоступен${NC}"
echo ""

echo -e "${GREEN}✅ Диагностика завершена${NC}"
