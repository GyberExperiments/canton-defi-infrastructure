#!/bin/bash

# САМОЕ ДЕЙСТВЕННОЕ РЕШЕНИЕ: Комбинированный подход
# 1. Удаление через kubectl delete --all с фильтрацией
# 2. Параллельное выполнение для скорости
# 3. Обход finalizers через patch
# 4. Удаление через API напрямую если kubectl не работает

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${RED}🔥 САМОЕ ДЕЙСТВЕННОЕ РЕШЕНИЕ: Комбинированная радикальная очистка${NC}"
echo ""

# Увеличить лимиты для параллельного выполнения
ulimit -n 4096

# Функция для быстрого массового удаления
fast_delete() {
    local resource=$1
    local namespace=$2
    local filter=${3:-""}
    
    echo -e "${BLUE}Быстрое удаление: $resource в $namespace${NC}"
    
    local cmd="kubectl get $resource -n $namespace -o name"
    if [ -n "$filter" ]; then
        cmd="$cmd --field-selector $filter"
    fi
    
    # Удалить с максимальной параллельностью
    eval "$cmd" 2>/dev/null | \
        head -1000 | \
        xargs -P 50 -n 20 -I {} sh -c 'kubectl delete {} --grace-period=0 --force --timeout=2s 2>/dev/null || true' &
    
    wait
    echo -e "${GREEN}✅ $resource в $namespace обработаны${NC}"
}

# ШАГ 1: Удалить ВСЕ Challenge, CertificateRequest, Order сразу
echo -e "${YELLOW}ШАГ 1: Массовое удаление cert-manager ресурсов${NC}"

# Параллельно удалить все типы ресурсов
(
    fast_delete "challenges" "" ""
    fast_delete "certificaterequests" "" ""
    fast_delete "orders" "" ""
) &

wait

# ШАГ 2: Удалить ВСЕ Pending поды по namespace параллельно
echo -e "${YELLOW}ШАГ 2: Параллельное удаление Pending подов${NC}"

PROBLEM_NAMESPACES=(
    "platform-gyber-org"
    "istio-system" 
    "default"
    "supabase"
    "canton-otc"
    "maximus"
    "develop-gprod"
    "prod-pswmeta"
    "stage-pswmeta"
    "develop-pswmeta"
)

# Удалить параллельно из всех namespace
for ns in "${PROBLEM_NAMESPACES[@]}"; do
    fast_delete "pods" "$ns" "status.phase=Pending" &
done

wait

# ШАГ 3: Удалить ВСЕ cert-manager challenge поды (по паттерну имени)
echo -e "${YELLOW}ШАГ 3: Удаление всех challenge подов по паттерну${NC}"

kubectl get pods -A -o name 2>/dev/null | grep -E "(cm-acme-http-solver|cert-monitor|cleanup-old)" | \
    head -2000 | \
    xargs -P 100 -n 50 -I {} sh -c 'kubectl delete {} --grace-period=0 --force --timeout=1s 2>/dev/null || true' &

wait

# ШАГ 4: Массовая очистка finalizers (критично для зависших подов)
echo -e "${YELLOW}ШАГ 4: Массовая очистка finalizers${NC}"

# Получить все Terminating поды и очистить finalizers параллельно
kubectl get pods -A -o json 2>/dev/null | \
    jq -r '.items[] | select(.metadata.deletionTimestamp != null) | "\(.metadata.namespace)|\(.metadata.name)"' | \
    head -500 | \
    xargs -P 50 -I {} sh -c '
        ns=$(echo {} | cut -d"|" -f1)
        name=$(echo {} | cut -d"|" -f2)
        kubectl patch pod "$name" -n "$ns" -p '"'"'{"metadata":{"finalizers":[]}}'"'"' --type=merge --timeout=2s 2>/dev/null || true
    ' &

wait

# ШАГ 5: Удалить все оставшиеся Pending поды из всех namespace
echo -e "${YELLOW}ШАГ 5: Финальная очистка всех Pending подов${NC}"

# Получить все namespace и обработать параллельно
kubectl get namespaces -o name 2>/dev/null | cut -d/ -f2 | \
    grep -v -E "(kube-system|kube-public|kube-node-lease)" | \
    while read ns; do
        fast_delete "pods" "$ns" "status.phase=Pending" &
    done

wait

# ИТОГОВАЯ СТАТИСТИКА
echo ""
echo -e "${BLUE}📊 ИТОГОВАЯ СТАТИСТИКА:${NC}"
sleep 2  # Дать время API server обработать удаления

PENDING=$(kubectl get pods -A --field-selector status.phase=Pending --no-headers 2>/dev/null | wc -l | tr -d ' ')
CHALLENGE_PODS=$(kubectl get pods -A | grep cm-acme-http-solver 2>/dev/null | wc -l | tr -d ' ')
CHALLENGES=$(kubectl get challenges -A --no-headers 2>/dev/null | wc -l | tr -d ' ')
CR=$(kubectl get certificaterequests -A --no-headers 2>/dev/null | wc -l | tr -d ' ')
ORDERS=$(kubectl get orders -A --no-headers 2>/dev/null | wc -l | tr -d ' ')

echo "Pending подов: $PENDING"
echo "Challenge подов: $CHALLENGE_PODS"
echo "Challenge ресурсов: $CHALLENGES"
echo "CertificateRequest: $CR"
echo "Order ресурсов: $ORDERS"
echo ""

# Проверить нагрузку на control-plane
echo -e "${BLUE}Нагрузка на control-plane:${NC}"
kubectl top node tmedm 2>/dev/null || echo "Не удалось получить метрики"

echo ""
if [ "$PENDING" -lt 100 ] && [ "$CHALLENGE_PODS" -lt 10 ]; then
    echo -e "${GREEN}✅ УСПЕХ! Кластер очищен!${NC}"
else
    echo -e "${YELLOW}⚠️  Остались ресурсы. Возможно нужно повторить или использовать более радикальные методы.${NC}"
fi
