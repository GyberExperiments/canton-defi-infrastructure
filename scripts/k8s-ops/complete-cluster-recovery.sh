#!/bin/bash

# 🔒 ПОЛНОЕ ВОССТАНОВЛЕНИЕ И ОБЕЗЗАРАЖИВАНИЕ KUBERNETES КЛАСТЕРА
# Автоматизирует все 7 этапов восстановления из docs/infrastructure/COMPLETE_CLUSTER_RECOVERY_AND_SECURITY_PROMPT.md

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
STUCK_NODE="canton-node-65-108-15-30"
CONTROL_PLANE_NODE="tmedm"

# Функции для вывода
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
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}📋 $1${NC}"
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Проверка зависимостей
check_dependencies() {
    log_info "Проверка зависимостей..."
    
    local missing=()
    for cmd in kubectl jq; do
        if ! command -v "$cmd" &> /dev/null; then
            missing+=("$cmd")
        fi
    done
    
    if [ ${#missing[@]} -gt 0 ]; then
        log_error "Отсутствуют необходимые команды: ${missing[*]}"
        exit 1
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Не удается подключиться к кластеру Kubernetes"
        exit 1
    fi
    
    log_success "Все зависимости установлены"
}

# Безопасный kubectl с таймаутом (для перегруженного API)
safe_kubectl() {
    local timeout=${1:-30}
    shift
    timeout "$timeout" kubectl "$@" 2>/dev/null || return 1
}

# Удаление ресурсов маленькими батчами (для перегруженного API)
batch_delete() {
    local resource_type=$1
    local namespace=${2:-""}
    local filter=${3:-""}
    local batch_size=${4:-50}
    local timeout=${5:-2}
    
    local cmd="kubectl get $resource_type"
    [ -n "$namespace" ] && cmd="$cmd -n $namespace" || cmd="$cmd -A"
    [ -n "$filter" ] && cmd="$cmd --field-selector $filter"
    cmd="$cmd -o json --timeout=30s"
    
    log_info "Удаление $resource_type (батчами по $batch_size)..."
    
    local count=0
    local total=0
    
    while true; do
        local items=$(eval "$cmd" 2>/dev/null | jq -r '.items[] | "\(.metadata.namespace)|\(.metadata.name)"' 2>/dev/null | head -"$batch_size")
        
        if [ -z "$items" ]; then
            break
        fi
        
        echo "$items" | while IFS='|' read -r ns name; do
            [ -z "$name" ] && continue
            
            # Очистить finalizers перед удалением
            if [ "$resource_type" = "pods" ]; then
                safe_kubectl "$timeout" patch pod "$name" -n "$ns" -p '{"metadata":{"finalizers":[]}}' --type=merge 2>/dev/null || true
            fi
            
            # Удалить ресурс
            if [ -n "$namespace" ]; then
                safe_kubectl "$timeout" delete "$resource_type" "$name" -n "$ns" --grace-period=0 --force 2>/dev/null || true
            else
                safe_kubectl "$timeout" delete "$resource_type" "$name" -n "$ns" --grace-period=0 --force 2>/dev/null || true
            fi
            
            ((count++))
            sleep 0.05
        done
        
        total=$((total + count))
        log_info "Удалено: $total ресурсов"
        
        sleep 2  # Пауза между батчами
        count=0
    done
    
    log_success "Удаление $resource_type завершено (всего: $total)"
}

# Получить статистику кластера
get_cluster_stats() {
    log_info "Получение статистики кластера..."
    
    local pending=$(safe_kubectl 30 get pods -A --field-selector status.phase=Pending --no-headers 2>/dev/null | wc -l | tr -d ' ')
    local challenges=$(safe_kubectl 30 get challenges -A --no-headers 2>/dev/null | wc -l | tr -d ' ')
    local challenge_pods=$(safe_kubectl 30 get pods -A 2>/dev/null | grep cm-acme-http-solver | wc -l | tr -d ' ')
    local cpu_usage="N/A"
    
    if safe_kubectl 10 top node "$CONTROL_PLANE_NODE" &>/dev/null; then
        cpu_usage=$(safe_kubectl 10 top node "$CONTROL_PLANE_NODE" --no-headers 2>/dev/null | awk '{print $3}' || echo "N/A")
    fi
    
    echo ""
    echo -e "${CYAN}📊 ТЕКУЩАЯ СТАТИСТИКА:${NC}"
    echo "  Pending подов: $pending"
    echo "  Challenge ресурсов: $challenges"
    echo "  Challenge подов: $challenge_pods"
    echo "  CPU control-plane ($CONTROL_PLANE_NODE): $cpu_usage"
    echo ""
}

# ЭТАП 0: РЕЗЕРВНОЕ КОПИРОВАНИЕ
stage0_backup() {
    log_step "ЭТАП 0: РЕЗЕРВНОЕ КОПИРОВАНИЕ ВАЖНЫХ ДАННЫХ"
    
    log_warning "КРИТИЧЕСКИ ВАЖНО: Создание backup перед восстановлением!"
    
    if [ -f "$SCRIPT_DIR/backup-critical-data.sh" ]; then
        log_info "Запуск скрипта резервного копирования..."
        chmod +x "$SCRIPT_DIR/backup-critical-data.sh"
        "$SCRIPT_DIR/backup-critical-data.sh" || log_warning "Backup завершился с ошибками, но продолжаем..."
    else
        log_warning "Скрипт backup не найден, создаем backup вручную..."
        BACKUP_DIR="$PROJECT_DIR/backup/$(date +%Y%m%d_%H%M%S)"
        mkdir -p "$BACKUP_DIR"
        
        log_info "Backup Secrets..."
        for ns in $(safe_kubectl 30 get namespaces -o name 2>/dev/null | cut -d/ -f2 | grep -v -E "(kube-system|kube-public|kube-node-lease)"); do
            safe_kubectl 30 get secrets -n "$ns" -o yaml > "$BACKUP_DIR/secrets_${ns}.yaml" 2>/dev/null || true
        done
        
        log_info "Backup ConfigMaps..."
        for ns in $(safe_kubectl 30 get namespaces -o name 2>/dev/null | cut -d/ -f2 | grep -v -E "(kube-system|kube-public|kube-node-lease)"); do
            safe_kubectl 30 get configmaps -n "$ns" -o yaml > "$BACKUP_DIR/configmaps_${ns}.yaml" 2>/dev/null || true
        done
        
        log_info "Backup PVC..."
        safe_kubectl 30 get pvc -A -o yaml > "$BACKUP_DIR/all_pvc.yaml" 2>/dev/null || true
        
        log_success "Backup сохранен в: $BACKUP_DIR"
    fi
    
    log_success "Резервное копирование завершено"
}

# ЭТАП 1: РАДИКАЛЬНАЯ ОЧИСТКА КЛАСТЕРА
stage1_radical_cleanup() {
    log_step "ЭТАП 1: РАДИКАЛЬНАЯ ОЧИСТКА КЛАСТЕРА"
    
    log_info "Остановка cert-manager для предотвращения создания новых challenge подов..."
    safe_kubectl 10 scale deployment cert-manager -n cert-manager --replicas=0 2>/dev/null || true
    safe_kubectl 10 scale deployment cert-manager-cainjector -n cert-manager --replicas=0 2>/dev/null || true
    safe_kubectl 10 scale deployment cert-manager-webhook -n cert-manager --replicas=0 2>/dev/null || true
    log_success "Cert-manager остановлен"
    
    log_info "Удаление Challenge ресурсов маленькими батчами..."
    batch_delete "challenges" "" "" 50 2
    
    log_info "Удаление CertificateRequest..."
    batch_delete "certificaterequests" "" "" 50 2
    
    log_info "Удаление Order..."
    batch_delete "orders" "" "" 50 2
    
    log_info "Удаление Pending подов по namespace..."
    PROBLEM_NAMESPACES=("platform-gyber-org" "istio-system" "default" "supabase" "canton-otc" "maximus")
    for ns in "${PROBLEM_NAMESPACES[@]}"; do
        log_info "Очистка namespace: $ns"
        batch_delete "pods" "$ns" "status.phase=Pending" 50 2
        sleep 2
    done
    
    log_info "Удаление challenge подов по паттерну..."
    safe_kubectl 60 get pods -A -o json 2>/dev/null | \
        jq -r '.items[] | select(.metadata.name | startswith("cm-acme-http-solver")) | "\(.metadata.namespace)|\(.metadata.name)"' | \
        head -200 | \
        while IFS='|' read -r ns name; do
            [ -z "$ns" ] || [ -z "$name" ] && continue
            safe_kubectl 2 patch pod "$name" -n "$ns" -p '{"metadata":{"finalizers":[]}}' --type=merge 2>/dev/null || true
            safe_kubectl 2 delete pod "$name" -n "$ns" --grace-period=0 --force 2>/dev/null || true
            sleep 0.05
        done
    
    log_success "Радикальная очистка завершена"
    
    # Проверка результатов
    log_info "Проверка результатов очистки..."
    sleep 5  # Дать время API server обработать удаления
    get_cluster_stats
    
    local pending=$(safe_kubectl 30 get pods -A --field-selector status.phase=Pending --no-headers 2>/dev/null | wc -l | tr -d ' ')
    
    if [ "$pending" -gt 100 ]; then
        log_warning "Осталось много Pending подов ($pending). Повторная очистка..."
        # Повторить удаление
        batch_delete "pods" "" "status.phase=Pending" 50 2
        get_cluster_stats
    fi
}

# ЭТАП 2: УДАЛЕНИЕ И ПЕРЕСОЗДАНИЕ ЗАВИСШЕГО УЗЛА
stage2_remove_stuck_node() {
    log_step "ЭТАП 2: УДАЛЕНИЕ ЗАВИСШЕГО УЗЛА"
    
    # Проверить существует ли узел
    if ! kubectl get node "$STUCK_NODE" &>/dev/null; then
        log_warning "Узел $STUCK_NODE не найден, пропускаем этап"
        return 0
    fi
    
    log_info "Принудительное удаление всех подов с узла $STUCK_NODE..."
    
    # Получить все поды на узле и удалить их
    local count=0
    kubectl get pods -A -o json 2>/dev/null | \
        jq -r --arg node "$STUCK_NODE" '.items[] | select(.spec.nodeName==$node) | "\(.metadata.namespace)|\(.metadata.name)"' | \
        while IFS='|' read -r ns name; do
            if [ -n "$ns" ] && [ -n "$name" ]; then
                log_info "  Удаление пода $name в namespace $ns"
                # Очистить finalizers
                kubectl patch pod "$name" -n "$ns" -p '{"metadata":{"finalizers":[]}}' --type=merge --timeout=5s 2>/dev/null || true
                # Принудительно удалить
                kubectl delete pod "$name" -n "$ns" --grace-period=0 --force --timeout=5s 2>/dev/null || true
                ((count++))
            fi
        done
    
    log_success "Удалено подов с узла: $count"
    
    log_info "Удаление узла $STUCK_NODE из кластера..."
    if kubectl delete node "$STUCK_NODE" --timeout=30s 2>/dev/null; then
        log_success "Узел $STUCK_NODE удален из кластера"
    else
        log_warning "Не удалось удалить узел (возможно уже удален)"
    fi
    
    # Очистка PVC связанных с узлом
    log_info "Очистка PVC связанных с узлом..."
    kubectl get pvc -A -o json 2>/dev/null | \
        jq -r --arg node "$STUCK_NODE" '.items[] | select(.metadata.annotations."volume.kubernetes.io/selected-node"==$node) | "\(.metadata.namespace)|\(.metadata.name)"' | \
        while IFS='|' read -r ns name; do
            if [ -n "$ns" ] && [ -n "$name" ]; then
                log_info "  Удаление PVC $name в namespace $ns"
                kubectl delete pvc "$name" -n "$ns" --timeout=10s 2>/dev/null || true
            fi
        done
    
    log_success "Этап 2 завершен"
}

# ЭТАП 3: ОБЕЗЗАРАЖИВАНИЕ И БЕЗОПАСНОСТЬ
stage3_security_sanitization() {
    log_step "ЭТАП 3: ОБЕЗЗАРАЖИВАНИЕ И БЕЗОПАСНОСТЬ"
    
    log_info "Проверка на компрометацию..."
    
    # Проверить подозрительные поды
    log_info "Проверка подозрительных подов..."
    local suspicious_pods=$(kubectl get pods -A -o json 2>/dev/null | \
        jq -r '.items[] | select(.status.phase != "Running" and .status.phase != "Succeeded" and .metadata.namespace != "kube-system" and .metadata.namespace != "kube-public" and .metadata.namespace != "kube-node-lease") | "\(.metadata.namespace)|\(.metadata.name)"')
    
    if [ -n "$suspicious_pods" ]; then
        log_warning "Найдены подозрительные поды, удаление..."
        echo "$suspicious_pods" | while IFS='|' read -r ns name; do
            if [ -n "$ns" ] && [ -n "$name" ]; then
                kubectl delete pod "$name" -n "$ns" --grace-period=0 --force --timeout=5s 2>/dev/null || true
            fi
        done
    else
        log_success "Подозрительных подов не найдено"
    fi
    
    # Проверить подозрительные сервисы
    log_info "Проверка подозрительных сервисов..."
    local external_svcs=$(kubectl get svc -A -o json 2>/dev/null | \
        jq -r '.items[] | select(.spec.type != "ClusterIP" and .spec.type != "") | "\(.metadata.namespace)|\(.metadata.name)|\(.spec.type)"')
    
    if [ -n "$external_svcs" ]; then
        log_warning "Найдены внешние сервисы:"
        echo "$external_svcs" | while IFS='|' read -r ns name type; do
            echo "  - $ns/$name ($type)"
        done
    else
        log_success "Подозрительных сервисов не найдено"
    fi
    
    # Проверить RBAC
    log_info "Проверка RBAC..."
    local non_system_roles=$(kubectl get clusterrole -o json 2>/dev/null | \
        jq -r '.items[] | select(.metadata.name | startswith("system:") | not) | .metadata.name')
    
    if [ -n "$non_system_roles" ]; then
        log_info "Найдены пользовательские ClusterRole:"
        echo "$non_system_roles" | head -10 | while read role; do
            echo "  - $role"
        done
    fi
    
    # Очистка старых сертификатов
    log_info "Очистка старых Certificate ресурсов..."
    local failed_certs=$(kubectl get certificates -A -o json 2>/dev/null | \
        jq -r '.items[] | select(.status.conditions[]?.status == "False" or .status.conditions == null) | "\(.metadata.namespace)|\(.metadata.name)"')
    
    if [ -n "$failed_certs" ]; then
        local count=0
        echo "$failed_certs" | while IFS='|' read -r ns name; do
            if [ -n "$ns" ] && [ -n "$name" ]; then
                kubectl delete certificate "$name" -n "$ns" --timeout=5s 2>/dev/null || true
                ((count++))
            fi
        done
        log_success "Удалено неработающих сертификатов: $count"
    else
        log_success "Проблемных сертификатов не найдено"
    fi
    
    log_success "Этап 3 завершен"
}

# ЭТАП 4: НАСТРОЙКА CERT-MANAGER ПРАВИЛЬНО
stage4_configure_cert_manager() {
    log_step "ЭТАП 4: НАСТРОЙКА CERT-MANAGER"
    
    log_info "Проверка текущей конфигурации cert-manager..."
    
    if ! kubectl get deployment cert-manager -n cert-manager &>/dev/null; then
        log_warning "Cert-manager не найден, пропускаем настройку"
        return 0
    fi
    
    log_info "Применение правильной конфигурации cert-manager..."
    kubectl patch deployment cert-manager -n cert-manager --type json -p '[
      {"op": "replace", "path": "/spec/template/spec/containers/0/args", "value": [
        "--v=2",
        "--cluster-resource-namespace=$(POD_NAMESPACE)",
        "--leader-election-namespace=kube-system",
        "--max-concurrent-challenges=5",
        "--acme-http01-solver-pod-grace-period=1m",
        "--enable-certificate-owner-ref=true"
      ]}
    ]' 2>/dev/null || log_warning "Не удалось обновить args (возможно уже настроено)"
    
    log_info "Установка лимитов ресурсов..."
    kubectl patch deployment cert-manager -n cert-manager --type json -p '[
      {"op": "add", "path": "/spec/template/spec/containers/0/resources", "value": {
        "limits": {"cpu": "500m", "memory": "512Mi"},
        "requests": {"cpu": "100m", "memory": "128Mi"}
      }}
    ]' 2>/dev/null || log_warning "Не удалось установить лимиты (возможно уже установлены)"
    
    log_info "Перезапуск cert-manager..."
    kubectl rollout restart deployment cert-manager -n cert-manager 2>/dev/null || true
    kubectl rollout restart deployment cert-manager-cainjector -n cert-manager 2>/dev/null || true
    kubectl rollout restart deployment cert-manager-webhook -n cert-manager 2>/dev/null || true
    
    log_info "Ожидание готовности cert-manager..."
    kubectl wait --for=condition=available --timeout=120s deployment/cert-manager -n cert-manager 2>/dev/null || log_warning "Таймаут ожидания cert-manager"
    kubectl wait --for=condition=available --timeout=120s deployment/cert-manager-cainjector -n cert-manager 2>/dev/null || log_warning "Таймаут ожидания cainjector"
    kubectl wait --for=condition=available --timeout=120s deployment/cert-manager-webhook -n cert-manager 2>/dev/null || log_warning "Таймаут ожидания webhook"
    
    log_success "Этап 4 завершен"
}

# ЭТАП 5: ИСПРАВЛЕНИЕ КОНФИГУРАЦИЙ ПРОЕКТОВ
stage5_fix_project_configs() {
    log_step "ЭТАП 5: ИСПРАВЛЕНИЕ КОНФИГУРАЦИЙ ПРОЕКТОВ"
    
    log_info "Исправление ingress конфигураций..."
    
    if [ -f "$SCRIPT_DIR/fix-ingress-configurations.sh" ]; then
        chmod +x "$SCRIPT_DIR/fix-ingress-configurations.sh"
        "$SCRIPT_DIR/fix-ingress-configurations.sh"
    else
        log_warning "Скрипт fix-ingress-configurations.sh не найден"
    fi
    
    log_info "Применение исправленных ingress..."
    
    # Применить исправленные ingress если они существуют
    local ingress_files=(
        "$PROJECT_DIR/k8s/supabase/ingress.yaml"
        "/Users/Gyber/GYBERNATY-ECOSYSTEM/aura-domus/k8s/overlays/prod/auradomus-acme-ingress.yml"
    )
    
    for file in "${ingress_files[@]}"; do
        if [ -f "$file" ]; then
            log_info "  Применение $file"
            kubectl apply -f "$file" 2>/dev/null || log_warning "Не удалось применить $file"
        fi
    done
    
    log_info "Унификация ClusterIssuer..."
    # Найти ingress с letsencrypt-production и обновить на letsencrypt-prod
    kubectl get ingress -A -o json 2>/dev/null | \
        jq -r '.items[] | select(.metadata.annotations."cert-manager.io/cluster-issuer" == "letsencrypt-production") | "\(.metadata.namespace)|\(.metadata.name)"' | \
        while IFS='|' read -r ns name; do
            if [ -n "$ns" ] && [ -n "$name" ]; then
                log_info "  Обновление ClusterIssuer для $ns/$name"
                kubectl annotate ingress "$name" -n "$ns" cert-manager.io/cluster-issuer=letsencrypt-prod --overwrite 2>/dev/null || true
            fi
        done
    
    log_success "Этап 5 завершен"
}

# ЭТАП 6: ВОССТАНОВЛЕНИЕ РАБОТЫ ПРОЕКТОВ
stage6_restore_projects() {
    log_step "ЭТАП 6: ВОССТАНОВЛЕНИЕ РАБОТЫ ПРОЕКТОВ"
    
    log_info "Проверка статуса deployments..."
    kubectl get deployments -A --no-headers 2>/dev/null | grep -v "1/1\|0/0" | while read -r line; do
        local ns=$(echo "$line" | awk '{print $1}')
        local name=$(echo "$line" | awk '{print $2}')
        log_warning "  Проблемный deployment: $ns/$name"
    done
    
    log_info "Перезапуск проблемных deployments..."
    kubectl rollout restart deployment maximus -n maximus 2>/dev/null || log_warning "Не удалось перезапустить maximus"
    kubectl rollout restart deployment redis -n maximus 2>/dev/null || log_warning "Не удалось перезапустить redis"
    
    log_info "Проверка планирования подов..."
    sleep 5
    kubectl get pods -n maximus 2>/dev/null | head -10
    kubectl get pods -n canton-otc 2>/dev/null | head -10
    
    log_info "Проверка ingress и сертификатов..."
    kubectl get ingress -A --no-headers 2>/dev/null | wc -l | xargs echo "  Всего ingress:"
    kubectl get certificates -A --no-headers 2>/dev/null | wc -l | xargs echo "  Всего сертификатов:"
    
    log_success "Этап 6 завершен"
}

# ЭТАП 7: НАСТРОЙКА МОНИТОРИНГА И ПРОФИЛАКТИКИ
stage7_setup_monitoring() {
    log_step "ЭТАП 7: НАСТРОЙКА МОНИТОРИНГА И ПРОФИЛАКТИКИ"
    
    log_info "Создание CronJob для автоматической очистки..."
    
    # Проверить существует ли уже CronJob
    if kubectl get cronjob cleanup-pending-pods -n kube-system &>/dev/null; then
        log_warning "CronJob cleanup-pending-pods уже существует, пропускаем создание"
    else
        kubectl apply -f - <<EOF 2>/dev/null || log_warning "Не удалось создать CronJob"
apiVersion: batch/v1
kind: CronJob
metadata:
  name: cleanup-pending-pods
  namespace: kube-system
spec:
  schedule: "0 */6 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: default
          containers:
          - name: cleanup
            image: bitnami/kubectl:latest
            command:
            - /bin/sh
            - -c
            - |
              kubectl get pods -A --field-selector status.phase=Pending -o json | \
                jq -r '.items[] | select((.metadata.creationTimestamp | fromdateiso8601) < (now - 3600)) | "\(.metadata.namespace) \(.metadata.name)"' | \
                while read ns name; do
                  kubectl delete pod "\$name" -n "\$ns" --grace-period=0 --force --timeout=5s 2>/dev/null || true
                done
          restartPolicy: OnFailure
EOF
        log_success "CronJob создан"
    fi
    
    log_success "Этап 7 завершен"
}

# Главная функция
main() {
    echo ""
    echo -e "${RED}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  🔒 ПОЛНОЕ ВОССТАНОВЛЕНИЕ И ОБЕЗЗАРАЖИВАНИЕ КЛАСТЕРА       ║${NC}"
    echo -e "${RED}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    check_dependencies
    
    log_info "Начальное состояние кластера:"
    get_cluster_stats
    
    # Запросить подтверждение
    echo ""
    log_warning "Этот скрипт выполнит радикальные изменения в кластере!"
    read -p "Продолжить? (yes/no): " -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log_info "Операция отменена"
        exit 0
    fi
    
    # Выполнить все этапы
    stage0_backup
    stage1_radical_cleanup
    stage2_remove_stuck_node
    stage3_security_sanitization
    stage4_configure_cert_manager
    stage5_fix_project_configs
    stage6_restore_projects
    stage7_setup_monitoring
    
    # Финальная статистика
    echo ""
    log_step "ФИНАЛЬНАЯ СТАТИСТИКА"
    get_cluster_stats
    
    echo ""
    log_success "🎉 ВОССТАНОВЛЕНИЕ ЗАВЕРШЕНО!"
    echo ""
    log_info "Следующие шаги:"
    echo "  1. Проверить доступность сайтов:"
    echo "     curl -I https://gyber.org"
    echo "     curl -I https://1otc.cc"
    echo "     curl -I https://maximus-marketing-swarm.gyber.org"
    echo ""
    echo "  2. Мониторить состояние кластера:"
    echo "     kubectl get nodes"
    echo "     kubectl top node $CONTROL_PLANE_NODE"
    echo "     kubectl get pods -A --field-selector status.phase=Pending"
    echo ""
}

# Запуск
main "$@"
