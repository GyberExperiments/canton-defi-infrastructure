#!/bin/bash
# Анализ нагрузки на control-plane узел

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

CONTROL_PLANE_NODE="tmedm"

echo -e "${BLUE}🖥️  АНАЛИЗ НАГРУЗКИ НА CONTROL-PLANE${NC}"
echo "=============================================="
echo ""

# 1. Использование ресурсов узла
echo -e "${BLUE}📊 Использование ресурсов узла $CONTROL_PLANE_NODE:${NC}"
kubectl top node "$CONTROL_PLANE_NODE" 2>/dev/null || echo -e "${YELLOW}⚠️  metrics-server недоступен${NC}"
echo ""

# 2. Количество подов на узле
echo -e "${BLUE}📦 Количество подов на узле:${NC}"
POD_COUNT=$(kubectl get pods --all-namespaces -o wide --field-selector spec.nodeName="$CONTROL_PLANE_NODE" --no-headers 2>/dev/null | wc -l | tr -d ' ')
echo "Всего подов: $POD_COUNT"
echo ""

# 3. Поды по namespace
echo -e "${BLUE}📋 Поды по namespace:${NC}"
kubectl get pods --all-namespaces -o wide --field-selector spec.nodeName="$CONTROL_PLANE_NODE" --no-headers 2>/dev/null | \
    awk '{print $1}' | sort | uniq -c | sort -rn | head -10
echo ""

# 4. Топ подов по CPU (если доступно)
echo -e "${BLUE}🔥 Топ подов по CPU на узле:${NC}"
kubectl top pods --all-namespaces --sort-by=cpu 2>/dev/null | \
    grep -E "NAME|$CONTROL_PLANE_NODE" | head -15 || echo -e "${YELLOW}⚠️  metrics-server недоступен${NC}"
echo ""

# 5. Системные поды (kube-system)
echo -e "${BLUE}⚙️  Системные поды (kube-system):${NC}"
kubectl get pods -n kube-system -o wide --field-selector spec.nodeName="$CONTROL_PLANE_NODE" 2>/dev/null
echo ""

# 6. Поды с высоким количеством рестартов
echo -e "${BLUE}🔄 Поды с высоким количеством рестартов:${NC}"
kubectl get pods --all-namespaces -o wide --field-selector spec.nodeName="$CONTROL_PLANE_NODE" 2>/dev/null | \
    awk '$5 ~ /^[0-9]+$/ && $5 > 10 {print $1"/"$2" - "$5" рестартов"}' | head -10
echo ""

# 7. Проблемные поды (CrashLoopBackOff, Error)
echo -e "${BLUE}⚠️  Проблемные поды:${NC}"
kubectl get pods --all-namespaces -o wide --field-selector spec.nodeName="$CONTROL_PLANE_NODE" 2>/dev/null | \
    grep -E "CrashLoopBackOff|Error|Pending" | head -10 || echo -e "${GREEN}✅ Проблемных подов не найдено${NC}"
echo ""

# 8. События на узле (последние 20)
echo -e "${BLUE}📝 Последние события на узле:${NC}"
kubectl get events --field-selector involvedObject.name="$CONTROL_PLANE_NODE" --sort-by='.lastTimestamp' 2>/dev/null | tail -20 || echo -e "${YELLOW}⚠️  События недоступны${NC}"
echo ""

echo -e "${GREEN}✅ Анализ завершен${NC}"
