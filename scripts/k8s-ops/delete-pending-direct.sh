#!/bin/bash
# Прямое удаление подов без предварительного подсчета (чтобы не зависать)

set -euo pipefail

NAMESPACE="${1:-platform-gyber-org}"
BATCH_SIZE="${2:-10}"

LOG_FILE="/tmp/delete-pending-direct-$(date +%Y%m%d-%H%M%S).log"

log() {
    echo "[$(date +%H:%M:%S)] $1" | tee -a "$LOG_FILE"
}

log "=== ПРЯМОЕ УДАЛЕНИЕ PENDING ПОДОВ ==="
log "Namespace: $NAMESPACE"
log "Размер батча: $BATCH_SIZE"
log "Лог файл: $LOG_FILE"
log ""

DELETED=0
ITERATION=0
MAX_ITERATIONS=1000  # Защита от бесконечного цикла

while [ $ITERATION -lt $MAX_ITERATIONS ]; do
    ITERATION=$((ITERATION + 1))
    log "=== ИТЕРАЦИЯ $ITERATION ==="
    
    # Получаем список подов БЕЗ подсчета (только первые N)
    log "Получение списка подов (первые $BATCH_SIZE)..."
    START_TIME=$(date +%s)
    
    # Используем простой подход - получаем только имена
    PODS=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Pending --no-headers 2>/dev/null | head -"$BATCH_SIZE" | awk '{print $1}' 2>&1 || echo "")
    
    ELAPSED=$(($(date +%s) - START_TIME))
    log "Получение списка заняло: ${ELAPSED}с"
    
    if [ -z "$PODS" ] || [ "$PODS" = "" ]; then
        log "Нет подов для удаления - завершение"
        break
    fi
    
    POD_COUNT=$(echo "$PODS" | grep -v "^$" | wc -l | tr -d ' ')
    log "Найдено подов: $POD_COUNT"
    
    if [ "$POD_COUNT" -eq 0 ]; then
        log "Нет подов для удаления - завершение"
        break
    fi
    
    # Удаляем поды по одному
    COUNT=0
    for pod in $PODS; do
        if [ -z "$pod" ]; then
            continue
        fi
        
        log "  Удаление: $pod"
        START_DEL=$(date +%s)
        
        if kubectl delete pod "$pod" -n "$NAMESPACE" --grace-period=0 --force --timeout=3s 2>&1 | tee -a "$LOG_FILE" | grep -q "deleted\|not found"; then
            COUNT=$((COUNT + 1))
            DEL_ELAPSED=$(($(date +%s) - START_DEL))
            log "    ✓ Удален за ${DEL_ELAPSED}с"
        else
            DEL_ELAPSED=$(($(date +%s) - START_DEL))
            log "    ✗ Ошибка за ${DEL_ELAPSED}с"
        fi
    done
    
    DELETED=$((DELETED + COUNT))
    log "Удалено: $COUNT | Всего: $DELETED"
    log ""
    
    # Небольшая пауза
    sleep 1
done

log ""
log "=== ЗАВЕРШЕНО ==="
log "Всего удалено: $DELETED подов"
log "Лог: $LOG_FILE"
