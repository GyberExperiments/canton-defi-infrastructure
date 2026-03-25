#!/bin/bash
# Удаление Pending подов с полным логированием

set -euo pipefail

NAMESPACE="${1:-platform-gyber-org}"
BATCH_SIZE="${2:-10}"

LOG_FILE="/tmp/delete-pending-$(date +%Y%m%d-%H%M%S).log"

log() {
    echo "[$(date +%H:%M:%S)] $1" | tee -a "$LOG_FILE"
}

log "=== НАЧАЛО УДАЛЕНИЯ PENDING ПОДОВ ==="
log "Namespace: $NAMESPACE"
log "Размер батча: $BATCH_SIZE"
log "Лог файл: $LOG_FILE"
log ""

# Проверка доступности кластера
log "Проверка доступности кластера..."
if ! kubectl cluster-info &>/dev/null; then
    log "ОШИБКА: Кластер недоступен"
    exit 1
fi
log "✓ Кластер доступен"
log ""

# Получаем начальное количество
log "Подсчет начального количества Pending подов..."
INITIAL=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Pending --no-headers 2>/dev/null | wc -l | tr -d ' ')
log "Начальное количество: $INITIAL"
log ""

if [ "$INITIAL" -eq 0 ]; then
    log "Нет Pending подов для удаления"
    exit 0
fi

DELETED=0
ITERATION=0

while true; do
    ITERATION=$((ITERATION + 1))
    log "=== ИТЕРАЦИЯ $ITERATION ==="
    
    # Получаем список подов (с таймаутом)
    log "Получение списка подов (первые $BATCH_SIZE)..."
    PODS=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Pending --no-headers 2>/dev/null | head -"$BATCH_SIZE" | awk '{print $1}' || echo "")
    
    if [ -z "$PODS" ]; then
        log "Нет подов для удаления - завершение"
        break
    fi
    
    POD_COUNT=$(echo "$PODS" | grep -v "^$" | wc -l | tr -d ' ')
    log "Найдено подов для удаления: $POD_COUNT"
    
    # Удаляем поды по одному с логированием
    COUNT=0
    FAILED=0
    for pod in $PODS; do
        if [ -z "$pod" ]; then
            continue
        fi
        
        log "  Удаление пода: $pod"
        if kubectl delete pod "$pod" -n "$NAMESPACE" --grace-period=0 --force --timeout=3s 2>&1 | tee -a "$LOG_FILE" | grep -q "deleted\|not found"; then
            COUNT=$((COUNT + 1))
            log "    ✓ Удален"
        else
            FAILED=$((FAILED + 1))
            log "    ✗ Ошибка удаления"
        fi
    done
    
    DELETED=$((DELETED + COUNT))
    log "Удалено в этой итерации: $COUNT (ошибок: $FAILED)"
    log "Всего удалено: $DELETED"
    
    # Проверяем оставшееся количество
    log "Проверка оставшегося количества..."
    sleep 2
    REMAINING=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Pending --no-headers 2>/dev/null | wc -l | tr -d ' ')
    log "Осталось: $REMAINING"
    log ""
    
    if [ "$REMAINING" -eq 0 ]; then
        log "Все поды удалены!"
        break
    fi
    
    # Если осталось мало, уменьшаем батч
    if [ "$REMAINING" -lt "$BATCH_SIZE" ]; then
        BATCH_SIZE=$REMAINING
        log "Уменьшен размер батча до: $BATCH_SIZE"
    fi
    
    # Небольшая пауза между итерациями
    sleep 1
done

log ""
log "=== ИТОГ ==="
log "Начальное количество: $INITIAL"
log "Удалено: $DELETED"
FINAL=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Pending --no-headers 2>/dev/null | wc -l | tr -d ' ')
log "Осталось: $FINAL"
log ""
log "Лог сохранен в: $LOG_FILE"
