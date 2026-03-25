#!/bin/bash
# Удаление Pending подов батчами через API (быстро, без зависаний)

set -euo pipefail

NAMESPACE="${1:-platform-gyber-org}"
BATCH_SIZE="${2:-100}"

echo "Удаление Pending подов в namespace $NAMESPACE батчами по $BATCH_SIZE"

# Получаем список подов батчами
TOTAL=0
while true; do
    PODS=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Pending --no-headers 2>/dev/null | head -"$BATCH_SIZE" | awk '{print $1}' | tr '\n' ' ')
    
    if [ -z "$PODS" ] || [ "$PODS" = "" ]; then
        break
    fi
    
    # Удаляем батч
    for pod in $PODS; do
        kubectl delete pod "$pod" -n "$NAMESPACE" --grace-period=0 --force --timeout=2s 2>&1 | grep -q "deleted\|not found" && TOTAL=$((TOTAL + 1)) || true
    done
    
    echo "Удалено: $TOTAL подов"
    
    # Небольшая пауза между батчами
    sleep 1
    
    # Проверяем, остались ли поды
    REMAINING=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Pending --no-headers 2>/dev/null | wc -l | tr -d ' ')
    echo "Осталось: $REMAINING подов"
    
    if [ "$REMAINING" -eq 0 ]; then
        break
    fi
done

echo "Всего удалено: $TOTAL подов"
