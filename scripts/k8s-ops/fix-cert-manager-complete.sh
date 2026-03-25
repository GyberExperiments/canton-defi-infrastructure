#!/bin/bash
# Комплексное исправление проблемы cert-manager и разблокировка scheduler
# Основано на docs/infrastructure/FINAL_CERT_MANAGER_FIX_PROMPT.md

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

NAMESPACE="${1:-platform-gyber-org}"
CERT_MANAGER_NS="cert-manager"
MAXIMUS_NS="maximus"

# Функция для логирования
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_step() {
    echo ""
    echo -e "${CYAN}════════════════════════════════════════${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}════════════════════════════════════════${NC}"
    echo ""
}

# Проверка зависимостей
check_dependencies() {
    log_info "Проверка зависимостей..."
    
    local missing_deps=()
    
    if ! command -v kubectl &>/dev/null; then
        missing_deps+=("kubectl")
    fi
    
    if ! command -v jq &>/dev/null; then
        log_warning "jq не установлен, некоторые функции могут быть недоступны"
    fi
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        log_error "Отсутствуют необходимые инструменты: ${missing_deps[*]}"
        exit 1
    fi
    
    log_success "Все зависимости установлены"
}

# Проверка доступности кластера
check_cluster() {
    log_info "Проверка доступности кластера..."
    if ! kubectl cluster-info &>/dev/null; then
        log_error "Кластер недоступен"
        exit 1
    fi
    log_success "Кластер доступен"
}

# Получить количество Pending подов
get_pending_count() {
    kubectl get pods -A --field-selector=status.phase=Pending --no-headers 2>/dev/null | wc -l | tr -d ' '
}

# Шаг 1: Остановить cert-manager
stop_cert_manager() {
    log_step "ШАГ 1: Остановка cert-manager"
    
    # Проверяем, существует ли deployment
    if ! kubectl get deployment cert-manager -n "$CERT_MANAGER_NS" &>/dev/null; then
        log_warning "Deployment cert-manager не найден, пропускаем остановку"
        return 0
    fi
    
    # Получаем текущее количество реплик
    CURRENT_REPLICAS=$(kubectl get deployment cert-manager -n "$CERT_MANAGER_NS" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "1")
    
    if [ "$CURRENT_REPLICAS" -eq "0" ]; then
        log_info "Cert-manager уже остановлен"
        return 0
    fi
    
    log_info "Останавливаем cert-manager (было реплик: $CURRENT_REPLICAS)..."
    kubectl scale deployment cert-manager -n "$CERT_MANAGER_NS" --replicas=0 --timeout=0 2>&1 || {
        log_error "Не удалось остановить cert-manager"
        return 1
    }
    
    # Ждем остановки
    log_info "Ожидание остановки cert-manager..."
    sleep 10
    
    log_success "Cert-manager остановлен"
}

# Шаг 2: Удаление Challenge ресурсов (правильный способ)
delete_challenges() {
    log_step "ШАГ 2: Удаление Challenge ресурсов"
    
    # Проверяем наличие Challenge ресурсов
    CHALLENGE_COUNT=$(kubectl get challenges -A --no-headers 2>/dev/null | wc -l | tr -d ' ' || echo "0")
    
    if [ "$CHALLENGE_COUNT" -eq "0" ]; then
        log_info "Challenge ресурсы не найдены"
        return 0
    fi
    
    log_info "Найдено Challenge ресурсов: $CHALLENGE_COUNT"
    log_info "Удаляем Challenge ресурсы (это автоматически удалит связанные поды)..."
    
    # Удаляем все Challenge ресурсы
    kubectl delete challenges -A --all --grace-period=0 --timeout=0 2>&1 | head -20 || {
        log_warning "Не удалось удалить некоторые Challenge ресурсы, продолжаем..."
    }
    
    # Ждем удаления подов
    log_info "Ожидание удаления подов (10 секунд)..."
    sleep 10
    
    log_success "Challenge ресурсы удалены"
}

# Шаг 3: Удаление оставшихся Pending подов
delete_pending_pods() {
    log_step "ШАГ 3: Удаление оставшихся Pending подов"
    
    PENDING_COUNT=$(get_pending_count)
    
    if [ "$PENDING_COUNT" -eq "0" ]; then
        log_success "Pending подов не найдено"
        return 0
    fi
    
    log_info "Найдено Pending подов: $PENDING_COUNT"
    
    # Метод 1: Удаление по метке cert-manager (САМЫЙ ЭФФЕКТИВНЫЙ)
    log_info "Метод 1: Удаление по метке acme.cert-manager.io/http01-solver=true..."
    CERT_MANAGER_PODS=$(kubectl get pods -n "$NAMESPACE" \
        -l acme.cert-manager.io/http01-solver=true \
        --field-selector=status.phase=Pending \
        --no-headers 2>/dev/null | wc -l | tr -d ' ' || echo "0")
    
    if [ "$CERT_MANAGER_PODS" -gt "0" ]; then
        log_info "Найдено cert-manager подов: $CERT_MANAGER_PODS"
        log_info "Удаляем все cert-manager поды по метке..."
        
        # Удаление по метке - самый эффективный способ
        kubectl delete pods -n "$NAMESPACE" \
            -l acme.cert-manager.io/http01-solver=true \
            --field-selector=status.phase=Pending \
            --grace-period=0 \
            --force \
            --timeout=0 \
            2>&1 | head -10 || {
            log_warning "Массовое удаление по метке не сработало, переходим к батчам"
        }
        
        sleep 5
    fi
    
    sleep 5
    
    # Проверяем результат
    REMAINING=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Pending --no-headers 2>/dev/null | wc -l | tr -d ' ')
    DELETED=$((PENDING_COUNT - REMAINING))
    
    log_info "Удалено: $DELETED подов"
    log_info "Осталось: $REMAINING подов"
    
    # Метод 2: Удаление батчами через xargs (если осталось много)
    if [ "$REMAINING" -gt "100" ]; then
        log_info "Метод 2: Удаление батчами по 100 подов (ограничение параллелизма)..."
        
        # Получаем список подов и удаляем батчами по 100
        # Используем xargs с ограничением параллелизма для снижения нагрузки на API
        DELETED_COUNT=0
        for i in {1..50}; do
            PODS_BATCH=$(kubectl get pods -n "$NAMESPACE" \
                --field-selector=status.phase=Pending \
                -o jsonpath='{.items[*].metadata.name}' 2>/dev/null | \
                tr ' ' '\n' | head -100)
            
            if [ -z "$PODS_BATCH" ]; then
                break
            fi
            
            BATCH_DELETED=$(echo "$PODS_BATCH" | tr '\n' ' ' | \
                xargs -n 1 -P 20 -I {} kubectl delete pod {} -n "$NAMESPACE" \
                --grace-period=0 --force --timeout=0 2>&1 | \
                grep -c "deleted\|not found" || echo "0")
            
            DELETED_COUNT=$((DELETED_COUNT + BATCH_DELETED))
            
            sleep 1
            
            # Показываем прогресс каждые 5 итераций
            if [ $((i % 5)) -eq 0 ]; then
                CURRENT=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Pending --no-headers 2>/dev/null | wc -l | tr -d ' ')
                log_info "Прогресс: удалено $DELETED_COUNT, осталось $CURRENT подов (итерация $i/50)"
            fi
            
            # Если осталось мало подов, выходим
            if [ "$CURRENT" -lt "100" ]; then
                break
            fi
        done
        
        log_info "Удалено батчами: $DELETED_COUNT подов"
        sleep 3
        
        # Проверяем результат после батчей
        REMAINING=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Pending --no-headers 2>/dev/null | wc -l | tr -d ' ')
        log_info "После батчей осталось: $REMAINING подов"
    fi
    
    # Финальная проверка
    FINAL_REMAINING=$(get_pending_count)
    log_info "Финальное количество Pending подов: $FINAL_REMAINING"
    
    if [ "$FINAL_REMAINING" -lt "100" ]; then
        log_success "Большинство подов удалено"
    else
        log_warning "Осталось много подов ($FINAL_REMAINING), возможно они создаются заново"
    fi
}

# Шаг 4: Проверка и исправление Certificate ресурсов
check_certificates() {
    log_step "ШАГ 4: Проверка Certificate ресурсов"
    
    log_info "Проверяем все Certificate ресурсы..."
    kubectl get certificates -A 2>/dev/null || {
        log_warning "Не удалось получить Certificate ресурсы"
        return 0
    }
    
    # Находим проблемные Certificate
    log_info "Ищем проблемные Certificate ресурсы..."
    PROBLEMATIC_CERTS=$(kubectl get certificates -A -o json 2>/dev/null | \
        jq -r '.items[] | select(.status.conditions[]?.reason=="Pending" or .status.conditions[]?.reason=="Failed") | "\(.metadata.namespace)/\(.metadata.name)"' 2>/dev/null || echo "")
    
    if [ -n "$PROBLEMATIC_CERTS" ]; then
        log_warning "Найдены проблемные Certificate ресурсы:"
        echo "$PROBLEMATIC_CERTS" | while IFS= read -r cert; do
            if [ -n "$cert" ]; then
                NAMESPACE_CERT=$(echo "$cert" | cut -d'/' -f1)
                NAME_CERT=$(echo "$cert" | cut -d'/' -f2)
                log_warning "  - $cert"
                
                # Показываем детали
                log_info "Детали Certificate $cert:"
                kubectl describe certificate "$NAME_CERT" -n "$NAMESPACE_CERT" 2>/dev/null | grep -A 10 "Status\|Reason\|Message" || true
            fi
        done
        
        log_warning "Рекомендуется проверить и исправить эти Certificate ресурсы вручную"
    else
        log_success "Проблемных Certificate ресурсов не найдено"
    fi
}

# Шаг 5: Настройка cert-manager
configure_cert_manager() {
    log_step "ШАГ 5: Настройка cert-manager"
    
    # Проверяем, существует ли deployment
    if ! kubectl get deployment cert-manager -n "$CERT_MANAGER_NS" &>/dev/null; then
        log_warning "Deployment cert-manager не найден, пропускаем настройку"
        return 0
    fi
    
    log_info "Проверяем текущую конфигурацию cert-manager..."
    
    # Проверяем ConfigMap
    if kubectl get configmap cert-manager-controller -n "$CERT_MANAGER_NS" &>/dev/null; then
        log_info "Настраиваем ConfigMap cert-manager-controller..."
        kubectl patch configmap cert-manager-controller -n "$CERT_MANAGER_NS" --type merge \
            -p '{"data":{"cleanup-on-success":"true","cleanup-on-failure":"true"}}' 2>/dev/null || {
            log_warning "Не удалось обновить ConfigMap, возможно он не поддерживает эти параметры"
        }
    fi
    
    # Настраиваем deployment для ограничения concurrent challenges
    log_info "Настраиваем ограничение concurrent challenges..."
    
    # Проверяем текущие аргументы
    CURRENT_ARGS=$(kubectl get deployment cert-manager -n "$CERT_MANAGER_NS" -o jsonpath='{.spec.template.spec.containers[0].args[*]}' 2>/dev/null || echo "")
    
    if echo "$CURRENT_ARGS" | grep -q "max-concurrent-challenges"; then
        log_info "Параметр max-concurrent-challenges уже настроен"
    else
        log_info "Добавляем параметр --max-concurrent-challenges=5..."
        kubectl patch deployment cert-manager -n "$CERT_MANAGER_NS" --type json \
            -p '[{"op": "add", "path": "/spec/template/spec/containers/0/args/-", "value": "--max-concurrent-challenges=5"}]' 2>/dev/null || {
            log_warning "Не удалось добавить параметр, возможно нужно настроить вручную"
        }
    fi
    
    log_success "Настройка cert-manager завершена"
}

# Шаг 6: Восстановление cert-manager
restore_cert_manager() {
    log_step "ШАГ 6: Восстановление cert-manager"
    
    # Проверяем, существует ли deployment
    if ! kubectl get deployment cert-manager -n "$CERT_MANAGER_NS" &>/dev/null; then
        log_warning "Deployment cert-manager не найден"
        return 0
    fi
    
    # Проверяем текущее количество реплик
    CURRENT_REPLICAS=$(kubectl get deployment cert-manager -n "$CERT_MANAGER_NS" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
    
    if [ "$CURRENT_REPLICAS" -eq "0" ]; then
        log_info "Восстанавливаем cert-manager (запускаем 1 реплику)..."
        kubectl scale deployment cert-manager -n "$CERT_MANAGER_NS" --replicas=1 --timeout=0 2>&1 || {
            log_error "Не удалось восстановить cert-manager"
            return 1
        }
        
        log_info "Ожидание запуска cert-manager..."
        sleep 10
        
        log_success "Cert-manager восстановлен"
    else
        log_info "Cert-manager уже запущен (реплик: $CURRENT_REPLICAS)"
    fi
}

# Шаг 7: Проверка планирования подов
check_scheduling() {
    log_step "ШАГ 7: Проверка планирования подов"
    
    log_info "Ожидание стабилизации scheduler (5 минут)..."
    log_warning "Это может занять время, пожалуйста, подождите..."
    
    # Показываем прогресс
    for i in {1..10}; do
        sleep 30
        PENDING=$(get_pending_count)
        echo -ne "\r${BLUE}Ожидание... ($i/10) Pending подов: $PENDING${NC}"
    done
    echo ""
    
    log_info "Проверяем планирование подов в namespace $MAXIMUS_NS..."
    kubectl get pods -n "$MAXIMUS_NS" -o wide 2>/dev/null || {
        log_warning "Namespace $MAXIMUS_NS не найден или недоступен"
    }
    
    # Проверяем Pending поды
    PENDING_COUNT=$(get_pending_count)
    log_info "Общее количество Pending подов: $PENDING_COUNT"
    
    if [ "$PENDING_COUNT" -lt "100" ]; then
        log_success "Количество Pending подов в норме"
    else
        log_warning "Все еще много Pending подов ($PENDING_COUNT)"
    fi
    
    # Перезапускаем deployments если нужно
    if kubectl get deployment maximus -n "$MAXIMUS_NS" &>/dev/null; then
        log_info "Перезапускаем deployment maximus..."
        kubectl rollout restart deployment maximus -n "$MAXIMUS_NS" 2>/dev/null || true
    fi
    
    if kubectl get deployment redis -n "$MAXIMUS_NS" &>/dev/null; then
        log_info "Перезапускаем deployment redis..."
        kubectl rollout restart deployment redis -n "$MAXIMUS_NS" 2>/dev/null || true
    fi
    
    log_info "Ожидание перезапуска deployments (3 минуты)..."
    sleep 180
    
    log_info "Финальная проверка планирования..."
    kubectl get pods -n "$MAXIMUS_NS" -o wide 2>/dev/null || true
    kubectl get endpoints -n "$MAXIMUS_NS" 2>/dev/null || true
}

# Главная функция
main() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║  ИСПРАВЛЕНИЕ CERT-MANAGER И SCHEDULER  ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
    echo ""
    
    # Начальное состояние
    INITIAL_PENDING=$(get_pending_count)
    log_info "Начальное количество Pending подов: $INITIAL_PENDING"
    
    # Выполняем шаги
    check_dependencies
    check_cluster
    stop_cert_manager
    delete_challenges
    delete_pending_pods
    check_certificates
    configure_cert_manager
    
    # Показываем промежуточный результат
    INTERMEDIATE_PENDING=$(get_pending_count)
    log_info "Промежуточное количество Pending подов: $INTERMEDIATE_PENDING"
    
    # Восстанавливаем cert-manager
    restore_cert_manager
    
    # Проверяем планирование
    check_scheduling
    
    # Финальный результат
    FINAL_PENDING=$(get_pending_count)
    echo ""
    log_step "ИТОГОВЫЙ РЕЗУЛЬТАТ"
    echo -e "${BLUE}Начальное количество Pending подов: ${YELLOW}$INITIAL_PENDING${NC}"
    echo -e "${BLUE}Финальное количество Pending подов: ${YELLOW}$FINAL_PENDING${NC}"
    echo -e "${BLUE}Удалено подов: ${GREEN}$((INITIAL_PENDING - FINAL_PENDING))${NC}"
    
    if [ "$FINAL_PENDING" -lt "100" ]; then
        log_success "Проблема решена! Количество Pending подов в норме"
        exit 0
    else
        log_warning "Все еще много Pending подов. Возможно, требуется дополнительная диагностика"
        exit 1
    fi
}

# Запуск
main "$@"
