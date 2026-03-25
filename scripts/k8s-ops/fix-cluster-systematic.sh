#!/bin/bash
# Системное исправление проблем кластера
# Приоритет: снижение нагрузки на control-plane → очистка Pending подов → удаление зависших подов → восстановление проектов

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

LOG_DIR="/tmp/cluster-fix-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$LOG_DIR"

log() {
    echo -e "$1" | tee -a "$LOG_DIR/fix.log"
}

log "${BLUE}🚀 СИСТЕМНОЕ ИСПРАВЛЕНИЕ КЛАСТЕРА${NC}"
log "=============================================="
log "Логи сохраняются в: $LOG_DIR"
log ""

# Проверка доступности кластера
if ! kubectl cluster-info &>/dev/null; then
    log "${RED}❌ Кластер недоступен${NC}"
    exit 1
fi

log "${GREEN}✅ Кластер доступен${NC}"
log ""

# ШАГ 1: Принудительное удаление зависших подов в maximus
log "${BLUE}📦 ШАГ 1: Очистка зависших подов в maximus${NC}"
MAXIMUS_TERMINATING=$(kubectl get pods -n maximus -o json 2>/dev/null | \
    jq -r '.items[] | select(.metadata.deletionTimestamp != null) | .metadata.name' 2>/dev/null || echo "")

if [ -n "$MAXIMUS_TERMINATING" ]; then
    log "Найдено зависших подов в maximus: $(echo "$MAXIMUS_TERMINATING" | wc -l | tr -d ' ')"
    for pod in $MAXIMUS_TERMINATING; do
        log "Удаление пода $pod..."
        kubectl patch pod "$pod" -n maximus -p '{"metadata":{"finalizers":[]}}' --type=merge 2>&1 | tee -a "$LOG_DIR/fix.log" || true
        kubectl delete pod "$pod" -n maximus --grace-period=0 --force 2>&1 | tee -a "$LOG_DIR/fix.log" || true
    done
    sleep 2
    log "${GREEN}✅ Зависшие поды в maximus удалены${NC}"
else
    log "${GREEN}✅ Нет зависших подов в maximus${NC}"
fi
log ""

# ШАГ 2: Очистка зависших подов на отключенном узле
log "${BLUE}🔴 ШАГ 2: Очистка зависших подов на отключенном узле${NC}"
STUCK_PODS=$(kubectl get pods --all-namespaces -o json 2>/dev/null | \
    jq -r '.items[] | select(.spec.nodeName=="canton-node-65-108-15-30" and .metadata.deletionTimestamp != null) | "\(.metadata.namespace)/\(.metadata.name)"' 2>/dev/null || echo "")

if [ -n "$STUCK_PODS" ]; then
    STUCK_COUNT=$(echo "$STUCK_PODS" | wc -l | tr -d ' ')
    log "Найдено зависших подов на отключенном узле: $STUCK_COUNT"
    log "Удаление первых 20 подов (чтобы не перегружать API)..."
    
    COUNT=0
    for pod in $STUCK_PODS; do
        if [ $COUNT -ge 20 ]; then
            log "${YELLOW}⚠️  Ограничение: удалено 20 подов, остальные будут удалены позже${NC}"
            break
        fi
        
        NS=$(echo "$pod" | cut -d/ -f1)
        NAME=$(echo "$pod" | cut -d/ -f2)
        log "Удаление пода $NS/$NAME..."
        kubectl patch pod "$NAME" -n "$NS" -p '{"metadata":{"finalizers":[]}}' --type=merge 2>&1 | grep -v "^pod" || true
        kubectl delete pod "$NAME" -n "$NS" --grace-period=0 --force 2>&1 | grep -v "^pod" || true
        COUNT=$((COUNT + 1))
        
        if [ $((COUNT % 5)) -eq 0 ]; then
            sleep 1
        fi
    done
    
    log "${GREEN}✅ Удалено $COUNT зависших подов${NC}"
else
    log "${GREEN}✅ Нет зависших подов на отключенном узле${NC}"
fi
log ""

# ШАГ 3: Очистка старых Pending подов (cert-manager challenges)
log "${BLUE}🧹 ШАГ 3: Очистка старых Pending подов${NC}"
log "Очистка Pending подов в platform-gyber-org (cert-manager challenges)..."

# Используем существующий скрипт очистки
if [ -f "scripts/cleanup-pending-pods-api.sh" ]; then
    log "Использование скрипта cleanup-pending-pods-api.sh..."
    bash scripts/cleanup-pending-pods-api.sh platform-gyber-org 2>&1 | tee -a "$LOG_DIR/cleanup-platform-gyber-org.log" || true
else
    log "${YELLOW}⚠️  Скрипт cleanup-pending-pods-api.sh не найден, используем прямое удаление${NC}"
    # Прямое удаление первых 1000 подов
    kubectl get pods -n platform-gyber-org --field-selector=status.phase=Pending --no-headers 2>/dev/null | \
        head -1000 | awk '{print $2}' | \
        xargs -I {} -P 10 kubectl delete pod {} -n platform-gyber-org --grace-period=0 --force 2>&1 | \
        tee -a "$LOG_DIR/cleanup-platform-gyber-org.log" || true
fi

log "${GREEN}✅ Очистка Pending подов завершена${NC}"
log ""

# ШАГ 4: Проверка и перезапуск deployments в maximus
log "${BLUE}🔄 ШАГ 4: Восстановление deployments в maximus${NC}"
if kubectl get deployment maximus -n maximus &>/dev/null; then
    log "Перезапуск deployment maximus..."
    kubectl rollout restart deployment maximus -n maximus 2>&1 | tee -a "$LOG_DIR/fix.log" || true
    sleep 3
fi

if kubectl get deployment redis -n maximus &>/dev/null; then
    log "Перезапуск deployment redis..."
    kubectl rollout restart deployment redis -n maximus 2>&1 | tee -a "$LOG_DIR/fix.log" || true
    sleep 3
fi

log "${GREEN}✅ Deployments перезапущены${NC}"
log ""

# ШАГ 5: Проверка состояния после исправлений
log "${BLUE}📊 ШАГ 5: Проверка состояния после исправлений${NC}"
log ""

PENDING_AFTER=$(kubectl get pods --all-namespaces --field-selector=status.phase=Pending --no-headers 2>/dev/null | wc -l | tr -d ' ')
log "Pending подов после очистки: ${YELLOW}$PENDING_AFTER${NC}"

MAXIMUS_PODS=$(kubectl get pods -n maximus 2>/dev/null | grep -v "Terminating" | tail -n +2 | wc -l | tr -d ' ')
log "Рабочих подов в maximus: ${YELLOW}$MAXIMUS_PODS${NC}"

STUCK_AFTER=$(kubectl get pods --all-namespaces -o json 2>/dev/null | \
    jq -r '.items[] | select(.spec.nodeName=="canton-node-65-108-15-30" and .metadata.deletionTimestamp != null) | .metadata.name' 2>/dev/null | wc -l | tr -d ' ')
log "Зависших подов на отключенном узле: ${YELLOW}$STUCK_AFTER${NC}"

log ""
log "${GREEN}✅ Исправления завершены${NC}"
log "Детальные логи сохранены в: $LOG_DIR"
