#!/bin/bash

# САМОЕ РАДИКАЛЬНОЕ РЕШЕНИЕ: Прямое удаление через etcd (обход API server)
# ⚠️ ОПАСНО: Используется только в критических ситуациях
# Требует доступа к etcd на control-plane узле

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${RED}🔥🔥🔥 КРИТИЧЕСКОЕ РЕШЕНИЕ: Прямое удаление через etcd${NC}"
echo -e "${YELLOW}⚠️  ⚠️  ⚠️  ОЧЕНЬ ОПАСНО! Использовать только если API server полностью недоступен${NC}"
echo ""

# Для K3s etcd находится в /var/lib/rancher/k3s/server/db/etcd
# Но проще использовать kubectl с прямым доступом к API

# Альтернатива: Использовать kubectl с увеличенными таймаутами и прямыми API вызовами
echo -e "${BLUE}Использование kubectl с прямыми API вызовами и увеличенными таймаутами${NC}"

# Установить очень большие таймауты
export KUBECTL_TIMEOUT=300

# Массовое удаление через API с использованием curl напрямую к API server
API_SERVER=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')
TOKEN=$(kubectl get secret -n kube-system -o jsonpath='{.items[?(@.metadata.annotations.kubernetes\.io/service-account\.name=="default")].data.token}' | base64 -d)

if [ -z "$TOKEN" ]; then
    TOKEN=$(cat ~/.kube/config | grep token | head -1 | awk '{print $2}')
fi

echo -e "${BLUE}API Server: $API_SERVER${NC}"

# Функция для массового удаления через прямой API вызов
delete_via_api() {
    local resource=$1
    local namespace=$2
    
    local url="${API_SERVER}/api/v1/namespaces/${namespace}/${resource}"
    if [ "$resource" == "pods" ]; then
        url="${API_SERVER}/api/v1/namespaces/${namespace}/pods"
    fi
    
    echo -e "${YELLOW}Удаление $resource из $namespace через прямой API${NC}"
    
    # Получить список
    curl -k -H "Authorization: Bearer $TOKEN" "$url?fieldSelector=status.phase=Pending" 2>/dev/null | \
        jq -r '.items[] | .metadata.name' | \
        head -500 | \
        while read name; do
            if [ -n "$name" ]; then
                curl -k -X DELETE \
                    -H "Authorization: Bearer $TOKEN" \
                    -H "Content-Type: application/json" \
                    "$url/$name?gracePeriodSeconds=0" \
                    --max-time 2 \
                    2>/dev/null || true
            fi
        done
}

# Использовать этот метод только если kubectl полностью не работает
# В противном случае использовать radical-cleanup.sh

echo -e "${YELLOW}Этот скрипт требует прямого доступа к API server${NC}"
echo -e "${YELLOW}Рекомендуется использовать radical-cleanup.sh вместо этого${NC}"
