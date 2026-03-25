#!/bin/bash
# Ручное удаление Pending подов порциями с отслеживанием прогресса

set -euo pipefail

NAMESPACE="${1:-platform-gyber-org}"
BATCH_SIZE="${2:-20}"

echo "Удаление Pending подов в namespace $NAMESPACE батчами по $BATCH_SIZE"
echo ""

INITIAL=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Pending --no-headers 2>/dev/null | wc -l | tr -d ' ')
echo "Начальное количество: $INITIAL"
echo ""

DELETED=0
ITERATION=0

while true; do
    ITERATION=$((ITERATION + 1))
    echo "=== Итерация $ITERATION (батч $BATCH_SIZE) ==="
    
    # Получаем список подов для удаления
    PODS=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Pending --no-headers 2>/dev/null | head -"$BATCH_SIZE" | awk '{print $1}')
    
    if [ -z "$PODS" ]; then
        echo "Нет подов для удаления"
        break
    fi
    
    # Удаляем поды
    COUNT=0
    for pod in $PODS; do
        if kubectl delete pod "$pod" -n "$NAMESPACE" --grace-period=0 --force --timeout=2s 2>&1 | grep -q "deleted\|not found"; then
            COUNT=$((COUNT + 1))
        fi
    done
    
    DELETED=$((DELETED + COUNT))
    echo "Удалено в этой итерации: $COUNT"
    echo "Всего удалено: $DELETED"
    
    # Проверяем оставшееся количество
    sleep 1
    REMAINING=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Pending --no-headers 2>/dev/null | wc -l | tr -d ' ')
    echo "Осталось: $REMAINING"
    echo ""
    
    if [ "$REMAINING" -eq 0 ]; then
        break
    fi
    
    # Если осталось мало, уменьшаем батч
    if [ "$REMAINING" -lt "$BATCH_SIZE" ]; then
        BATCH_SIZE=$REMAINING
    fi
done

echo "=== ИТОГ ==="
echo "Начальное количество: $INITIAL"
echo "Удалено: $DELETED"
FINAL=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Pending --no-headers 2>/dev/null | wc -l | tr -d ' ')
echo "Осталось: $FINAL"
