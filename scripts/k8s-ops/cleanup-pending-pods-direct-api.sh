#!/bin/bash
# Прямое удаление через Kubernetes API (самый эффективный метод)

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

NAMESPACE="${1:-platform-gyber-org}"

echo -e "${BLUE}🚀 ПРЯМОЕ УДАЛЕНИЕ ЧЕРЕЗ KUBERNETES API${NC}"
echo "=========================================="
echo ""

# Получаем конфигурацию kubectl
KUBECONFIG="${KUBECONFIG:-$HOME/.kube/config}"
API_SERVER=$(kubectl config view -o jsonpath='{.clusters[0].cluster.server}')
TOKEN=$(kubectl get secret -n kube-system $(kubectl get sa -n kube-system default -o jsonpath='{.secrets[0].name}') -o jsonpath='{.data.token}' 2>/dev/null | base64 -d 2>/dev/null || kubectl config view --raw -o jsonpath='{.users[?(@.name=="*")].user.token}' 2>/dev/null || echo "")

if [ -z "$API_SERVER" ]; then
    echo -e "${RED}❌ Не удалось получить API server${NC}"
    exit 1
fi

# Получаем список Pending подов
echo -e "${BLUE}Получение списка Pending подов...${NC}"
PENDING_PODS=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Pending -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")
PENDING_COUNT=$(echo "$PENDING_PODS" | tr ' ' '\n' | grep -v '^$' | wc -l | tr -d ' ')

if [ "$PENDING_COUNT" -eq "0" ]; then
    echo -e "${GREEN}✅ Pending подов не найдено${NC}"
    exit 0
fi

echo -e "${YELLOW}Найдено Pending подов: $PENDING_COUNT${NC}"
echo ""

# Метод: Удаление через kubectl с правильными параметрами
echo -e "${BLUE}Удаление подов...${NC}"

# Используем более эффективный метод - удаляем все сразу, но с ограничением
DELETED=0
ATTEMPTS=0
MAX_ATTEMPTS=5

while [ "$PENDING_COUNT" -gt "0" ] && [ "$ATTEMPTS" -lt "$MAX_ATTEMPTS" ]; do
    ATTEMPTS=$((ATTEMPTS + 1))
    echo -e "${BLUE}Попытка $ATTEMPTS из $MAX_ATTEMPTS...${NC}"
    
    # Удаляем батчами по 1000 подов
    kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Pending -o jsonpath='{.items[*].metadata.name}' 2>/dev/null | \
        tr ' ' '\n' | head -1000 | \
        xargs -r -P 10 -I {} sh -c "kubectl delete pod {} -n $NAMESPACE --grace-period=0 --force 2>&1 | grep -q 'deleted\|not found' && echo 'deleted' || true" 2>/dev/null | wc -l
    
    sleep 3
    
    # Проверяем результат
    OLD_COUNT=$PENDING_COUNT
    PENDING_COUNT=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Pending --no-headers 2>/dev/null | wc -l | tr -d ' ')
    DELETED=$((OLD_COUNT - PENDING_COUNT))
    
    echo -e "${GREEN}Удалено в этой попытке: $DELETED${NC}"
    echo -e "${BLUE}Осталось: $PENDING_COUNT${NC}"
    echo ""
    
    if [ "$DELETED" -eq "0" ]; then
        echo -e "${YELLOW}⚠️  Удаление не прогрессирует, возможно поды создаются заново${NC}"
        break
    fi
done

# Финальная проверка
FINAL_COUNT=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Pending --no-headers 2>/dev/null | wc -l | tr -d ' ')
TOTAL_DELETED=$((PENDING_COUNT - FINAL_COUNT))

echo ""
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}ИТОГОВЫЙ РЕЗУЛЬТАТ${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "Было: ${YELLOW}$PENDING_COUNT${NC}"
echo -e "Удалено: ${GREEN}$TOTAL_DELETED${NC}"
echo -e "Осталось: ${YELLOW}$FINAL_COUNT${NC}"

if [ "$FINAL_COUNT" -lt "100" ]; then
    echo -e "${GREEN}✅ Большинство подов удалено${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Осталось много подов${NC}"
    echo "Возможно, cert-manager продолжает создавать новые поды"
    echo "Рекомендуется настроить cert-manager для правильной очистки"
    exit 1
fi
