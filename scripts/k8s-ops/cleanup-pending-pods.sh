#!/bin/bash
# Скрипт для очистки старых Pending подов в кластере

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

NAMESPACE="${1:-platform-gyber-org}"
BATCH_SIZE=100

echo -e "${BLUE}🧹 ОЧИСТКА PENDING ПОДОВ${NC}"
echo "=============================="
echo ""

# Проверка доступности кластера
if ! kubectl cluster-info &>/dev/null; then
    echo -e "${RED}❌ Кластер недоступен${NC}"
    exit 1
fi

# Подсчет Pending подов
PENDING_COUNT=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Pending --no-headers 2>/dev/null | wc -l || echo "0")
echo -e "${BLUE}Найдено Pending подов в namespace $NAMESPACE: $PENDING_COUNT${NC}"

if [ "$PENDING_COUNT" -eq "0" ]; then
    echo -e "${GREEN}✅ Pending подов не найдено${NC}"
    exit 0
fi

# Подтверждение
echo -e "${YELLOW}⚠️  Будет удалено $PENDING_COUNT подов${NC}"
echo "Продолжить? (y/N)"
read -r response
if [ "$response" != "y" ] && [ "$response" != "Y" ]; then
    echo "Отменено"
    exit 0
fi

# Удаление батчами
echo ""
echo -e "${BLUE}Удаление подов батчами по $BATCH_SIZE...${NC}"

DELETED=0
while [ "$PENDING_COUNT" -gt 0 ]; do
    echo "Удаление батча... (осталось: $PENDING_COUNT)"
    
    # Получаем список Pending подов и удаляем первые BATCH_SIZE
    kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Pending -o jsonpath='{.items[*].metadata.name}' 2>/dev/null | \
        tr ' ' '\n' | head -"$BATCH_SIZE" | \
        xargs -r kubectl delete pod -n "$NAMESPACE" --grace-period=0 --force 2>/dev/null || true
    
    DELETED=$((DELETED + BATCH_SIZE))
    sleep 2
    
    # Обновляем счетчик
    PENDING_COUNT=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Pending --no-headers 2>/dev/null | wc -l || echo "0")
    
    if [ "$PENDING_COUNT" -eq "0" ]; then
        break
    fi
done

echo ""
echo -e "${GREEN}✅ Удалено подов: $DELETED${NC}"
echo -e "${GREEN}✅ Осталось Pending подов: $PENDING_COUNT${NC}"
