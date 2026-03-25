#!/bin/bash
# Очистка Pending подов через Kubernetes API напрямую (самый быстрый метод)

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

NAMESPACE="${1:-platform-gyber-org}"

echo -e "${BLUE}🚀 МАССОВАЯ ОЧИСТКА ЧЕРЕЗ KUBERNETES API${NC}"
echo "=============================================="
echo ""

# Проверка доступности кластера
if ! kubectl cluster-info &>/dev/null; then
    echo -e "${RED}❌ Кластер недоступен${NC}"
    exit 1
fi

# Получаем количество Pending подов
PENDING_COUNT=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Pending --no-headers 2>/dev/null | wc -l | tr -d ' ')

if [ "$PENDING_COUNT" -eq "0" ]; then
    echo -e "${GREEN}✅ Pending подов не найдено${NC}"
    exit 0
fi

echo -e "${YELLOW}Найдено Pending подов: $PENDING_COUNT${NC}"
echo ""

# Метод 1: Удаление через kubectl с --selector и таймаутом
echo -e "${BLUE}Метод 1: Массовое удаление через kubectl...${NC}"
kubectl delete pods -n "$NAMESPACE" \
    --field-selector=status.phase=Pending \
    --grace-period=0 \
    --force \
    --timeout=60s \
    2>&1 | head -20 || true

sleep 2

# Проверяем результат
REMAINING=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Pending --no-headers 2>/dev/null | wc -l | tr -d ' ')
DELETED=$((PENDING_COUNT - REMAINING))

echo ""
echo -e "${GREEN}Удалено: $DELETED подов${NC}"
echo -e "${BLUE}Осталось: $REMAINING подов${NC}"

# Если остались поды, используем метод 2
if [ "$REMAINING" -gt "0" ] && [ "$REMAINING" -lt "1000" ]; then
    echo ""
    echo -e "${BLUE}Метод 2: Удаление оставшихся подов по одному...${NC}"
    
    # Получаем список оставшихся подов
    REMAINING_PODS=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Pending -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")
    
    DELETED_COUNT=0
    for pod in $REMAINING_PODS; do
        if [ -z "$pod" ]; then
            continue
        fi
        
        kubectl delete pod "$pod" -n "$NAMESPACE" --grace-period=0 --force --timeout=2s 2>&1 | grep -q "deleted\|not found" && {
            DELETED_COUNT=$((DELETED_COUNT + 1))
            if [ $((DELETED_COUNT % 100)) -eq 0 ]; then
                echo -e "${GREEN}Удалено еще: $DELETED_COUNT подов${NC}"
            fi
        } || true
    done
    
    echo -e "${GREEN}Удалено дополнительно: $DELETED_COUNT подов${NC}"
fi

# Финальная проверка
FINAL_REMAINING=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Pending --no-headers 2>/dev/null | wc -l | tr -d ' ')
echo ""
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}ИТОГОВЫЙ РЕЗУЛЬТАТ${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "Было: ${YELLOW}$PENDING_COUNT${NC}"
echo -e "Удалено: ${GREEN}$((PENDING_COUNT - FINAL_REMAINING))${NC}"
echo -e "Осталось: ${YELLOW}$FINAL_REMAINING${NC}"

if [ "$FINAL_REMAINING" -eq "0" ]; then
    echo -e "${GREEN}✅ Все Pending поды удалены${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Осталось $FINAL_REMAINING подов${NC}"
    echo "Возможно, они создаются заново cert-manager"
    exit 1
fi
