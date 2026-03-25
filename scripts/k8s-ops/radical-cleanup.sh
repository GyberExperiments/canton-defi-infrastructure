#!/bin/bash

# РАДИКАЛЬНОЕ РЕШЕНИЕ: Массовое удаление через API с обходом обычных проверок
# Использует прямые API вызовы и массовые операции

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${RED}🔥 РАДИКАЛЬНАЯ ОЧИСТКА КЛАСТЕРА${NC}"
echo -e "${YELLOW}⚠️  Это удалит ВСЕ Pending поды, Challenge, CertificateRequest, Order${NC}"
echo ""

# Функция для массового удаления через API
mass_delete() {
    local resource=$1
    local namespace=${2:-""}
    local ns_flag=""
    
    if [ -n "$namespace" ]; then
        ns_flag="-n $namespace"
    else
        ns_flag="-A"
    fi
    
    echo -e "${BLUE}Удаление всех $resource${NC}"
    
    # Получить список и удалить через xargs с параллельным выполнением
    kubectl get $resource $ns_flag -o name 2>/dev/null | \
        head -500 | \
        xargs -P 10 -I {} kubectl delete {} --grace-period=0 --force --timeout=5s 2>/dev/null || true
    
    echo -e "${GREEN}✅ $resource обработаны${NC}"
}

# ШАГ 1: Массовое удаление всех Challenge ресурсов
echo -e "${YELLOW}ШАГ 1: Удаление всех Challenge ресурсов${NC}"
mass_delete "challenges" ""

# ШАГ 2: Массовое удаление всех CertificateRequest
echo -e "${YELLOW}ШАГ 2: Удаление всех CertificateRequest${NC}"
mass_delete "certificaterequests" ""

# ШАГ 3: Массовое удаление всех Order
echo -e "${YELLOW}ШАГ 3: Удаление всех Order${NC}"
mass_delete "orders" ""

# ШАГ 4: Удаление Pending подов по namespace (самые проблемные первыми)
echo -e "${YELLOW}ШАГ 4: Удаление Pending подов по namespace${NC}"

PROBLEM_NAMESPACES=(
    "platform-gyber-org"
    "istio-system"
    "default"
    "supabase"
    "canton-otc"
    "maximus"
)

for ns in "${PROBLEM_NAMESPACES[@]}"; do
    echo -e "${BLUE}Обработка namespace: $ns${NC}"
    
    # Получить список Pending подов и удалить параллельно
    kubectl get pods -n "$ns" --field-selector status.phase=Pending -o name 2>/dev/null | \
        head -200 | \
        xargs -P 20 -I {} kubectl delete {} --grace-period=0 --force --timeout=3s 2>/dev/null || true
    
    echo -e "${GREEN}✅ $ns обработан${NC}"
done

# ШАГ 5: Удаление всех cert-manager challenge подов (по имени)
echo -e "${YELLOW}ШАГ 5: Удаление всех cert-manager challenge подов${NC}"
kubectl get pods -A -o name 2>/dev/null | grep cm-acme-http-solver | \
    head -1000 | \
    xargs -P 30 -I {} kubectl delete {} --grace-period=0 --force --timeout=2s 2>/dev/null || true

echo -e "${GREEN}✅ Challenge поды удалены${NC}"

# ШАГ 6: Очистка finalizers у зависших подов (радикальный метод)
echo -e "${YELLOW}ШАГ 6: Очистка finalizers у зависших подов${NC}"

# Получить все Terminating поды и очистить finalizers
kubectl get pods -A -o json 2>/dev/null | \
    jq -r '.items[] | select(.metadata.deletionTimestamp != null) | "\(.metadata.namespace) \(.metadata.name)"' | \
    head -100 | \
    while read -r ns name; do
        if [ -n "$ns" ] && [ -n "$name" ]; then
            kubectl patch pod "$name" -n "$ns" -p '{"metadata":{"finalizers":[]}}' --type=merge --timeout=3s 2>/dev/null || true
        fi
    done

echo -e "${GREEN}✅ Finalizers очищены${NC}"

# ИТОГОВАЯ СТАТИСТИКА
echo ""
echo -e "${BLUE}📊 ИТОГОВАЯ СТАТИСТИКА:${NC}"
echo "Pending подов: $(kubectl get pods -A --field-selector status.phase=Pending --no-headers 2>/dev/null | wc -l | tr -d ' ')"
echo "Challenge подов: $(kubectl get pods -A | grep cm-acme-http-solver 2>/dev/null | wc -l | tr -d ' ')"
echo "Challenge ресурсов: $(kubectl get challenges -A --no-headers 2>/dev/null | wc -l | tr -d ' ')"
echo "CertificateRequest: $(kubectl get certificaterequests -A --no-headers 2>/dev/null | wc -l | tr -d ' ')"
echo "Order ресурсов: $(kubectl get orders -A --no-headers 2>/dev/null | wc -l | tr -d ' ')"
echo ""

echo -e "${GREEN}✅ Радикальная очистка завершена!${NC}"
