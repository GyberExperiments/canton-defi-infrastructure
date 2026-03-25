#!/bin/bash
# Быстрая очистка Pending подов через Kubernetes API

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

NAMESPACE="${1:-platform-gyber-org}"
BATCH_SIZE=200
TIMEOUT=5

echo -e "${BLUE}🧹 БЫСТРАЯ ОЧИСТКА PENDING ПОДОВ${NC}"
echo "======================================"
echo ""

# Проверка доступности кластера
if ! kubectl cluster-info &>/dev/null; then
    echo -e "${RED}❌ Кластер недоступен${NC}"
    exit 1
fi

# Получаем список всех Pending подов
echo -e "${BLUE}Получение списка Pending подов...${NC}"
PENDING_PODS=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Pending -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")
PENDING_COUNT=$(echo "$PENDING_PODS" | tr ' ' '\n' | grep -v '^$' | wc -l | tr -d ' ')

if [ "$PENDING_COUNT" -eq "0" ]; then
    echo -e "${GREEN}✅ Pending подов не найдено${NC}"
    exit 0
fi

echo -e "${YELLOW}Найдено Pending подов: $PENDING_COUNT${NC}"
echo ""

# Разбиваем на батчи и удаляем через API
TOTAL_DELETED=0
BATCH_NUM=1

echo "$PENDING_PODS" | tr ' ' '\n' | grep -v '^$' | while IFS= read -r pod; do
    if [ -z "$pod" ]; then
        continue
    fi
    
    # Удаляем под через API с таймаутом
    kubectl delete pod "$pod" -n "$NAMESPACE" --grace-period=0 --force --timeout="${TIMEOUT}s" 2>&1 | grep -q "deleted\|not found" && {
        TOTAL_DELETED=$((TOTAL_DELETED + 1))
        if [ $((TOTAL_DELETED % BATCH_SIZE)) -eq 0 ]; then
            echo -e "${GREEN}Удалено: $TOTAL_DELETED подов${NC}"
        fi
    } || true
    
    # Небольшая задержка чтобы не перегружать API
    if [ $((TOTAL_DELETED % 50)) -eq 0 ]; then
        sleep 0.1
    fi
done

echo ""
echo -e "${GREEN}✅ Очистка завершена${NC}"

# Проверяем оставшиеся поды
REMAINING=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Pending --no-headers 2>/dev/null | wc -l | tr -d ' ')
echo -e "${BLUE}Осталось Pending подов: $REMAINING${NC}"
