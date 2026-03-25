#!/bin/bash
# Агрессивное удаление через patch finalizers (обходит API server)

set -euo pipefail

NAMESPACE="${1:-platform-gyber-org}"
BATCH_SIZE="${2:-5}"

LOG_FILE="/tmp/delete-pending-aggressive-$(date +%Y%m%d-%H%M%S).log"

log() {
    echo "[$(date +%H:%M:%S)] $1" | tee -a "$LOG_FILE"
}

log "=== АГРЕССИВНОЕ УДАЛЕНИЕ PENDING ПОДОВ ==="
log "Namespace: $NAMESPACE"
log "Размер батча: $BATCH_SIZE"
log "Лог файл: $LOG_FILE"
log ""

DELETED=0
ITERATION=0
MAX_ITERATIONS=200

while [ $ITERATION -lt $MAX_ITERATIONS ]; do
    ITERATION=$((ITERATION + 1))
    log "=== ИТЕРАЦИЯ $ITERATION ==="
    
    # Получаем список подов (только имена, минимальный запрос)
    log "Получение списка подов..."
    START_TIME=$(date +%s)
    
    # Используем jsonpath для быстрого получения только имен
    PODS=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Pending -o jsonpath='{.items[0:'$BATCH_SIZE'].metadata.name}' 2>&1 || echo "")
    
    ELAPSED=$(($(date +%s) - START_TIME))
    log "Получение списка заняло: ${ELAPSED}с"
    
    if [ -z "$PODS" ] || [ "$PODS" = "" ]; then
        log "Нет подов для удаления"
        break
    fi
    
    POD_COUNT=$(echo "$PODS" | tr ' ' '\n' | grep -v "^$" | wc -l | tr -d ' ')
    log "Найдено подов: $POD_COUNT"
    
    if [ "$POD_COUNT" -eq 0 ]; then
        log "Нет подов для удаления"
        break
    fi
    
    # Удаляем через patch finalizers (быстрее чем delete)
    COUNT=0
    for pod in $PODS; do
        if [ -z "$pod" ]; then
            continue
        fi
        
        log "  Удаление через patch: $pod"
        START_DEL=$(date +%s)
        
        # Метод 1: Patch finalizers
        if kubectl patch pod "$pod" -n "$NAMESPACE" -p '{"metadata":{"finalizers":[]}}' --type=merge --timeout=2s 2>&1 | tee -a "$LOG_FILE" | grep -q "patched\|not found"; then
            # Затем удаляем
            kubectl delete pod "$pod" -n "$NAMESPACE" --grace-period=0 --force --timeout=2s 2>&1 | tee -a "$LOG_FILE" > /dev/null || true
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
    
    # Пауза между итерациями
    sleep 2
done

log ""
log "=== ЗАВЕРШЕНО ==="
log "Всего удалено: $DELETED подов"
log "Лог: $LOG_FILE"
