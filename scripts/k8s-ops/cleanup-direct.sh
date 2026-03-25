#!/bin/bash

# Прямое удаление через API с короткими таймаутами
# Работает даже при перегруженном control-plane

set -euo pipefail

echo "🔧 Прямое удаление Pending подов через API"
echo ""

# Установить короткий таймаут для kubectl
export KUBECTL_TIMEOUT=10

# Функция для удаления подов из namespace
delete_pending_from_ns() {
    local ns=$1
    local limit=${2:-50}
    
    echo "Обработка namespace: $ns (лимит: $limit)"
    
    # Получить список подов с коротким таймаутом
    local pods=$(kubectl get pods -n "$ns" --field-selector status.phase=Pending -o name --request-timeout=10s 2>/dev/null | head -$limit || echo "")
    
    if [ -z "$pods" ]; then
        echo "  Нет Pending подов в $ns"
        return
    fi
    
    # Удалить по одному с коротким таймаутом
    echo "$pods" | while read -r pod; do
        if [ -n "$pod" ]; then
            kubectl delete "$pod" -n "$ns" --grace-period=0 --force --request-timeout=5s 2>/dev/null || true
        fi
    done
    
    echo "  Обработано подов из $ns"
}

# Обработать проблемные namespace по очереди
echo "Обработка platform-gyber-org..."
delete_pending_from_ns "platform-gyber-org" 50

echo "Обработка istio-system..."
delete_pending_from_ns "istio-system" 50

echo "Обработка default..."
delete_pending_from_ns "default" 50

echo "Обработка всех остальных namespace..."
for ns in $(kubectl get namespaces -o name --request-timeout=10s 2>/dev/null | cut -d/ -f2); do
    if [ "$ns" != "kube-system" ] && [ "$ns" != "kube-public" ] && [ "$ns" != "kube-node-lease" ]; then
        delete_pending_from_ns "$ns" 20
    fi
done

echo ""
echo "✅ Очистка завершена"
