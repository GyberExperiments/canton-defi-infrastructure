#!/bin/bash
# 🚀 Автоматическое выполнение ULTIMATE_CANTON_VALIDATOR_DEPLOYMENT_GUIDE.md
# Дата: $(date +%Y-%m-%d)
# Версия: 2.0

set -euo pipefail

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Логирование
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Проверка что скрипт запущен на правильном сервере
check_server() {
    log_info "Проверка сервера..."
    if [ "$(hostname -I | grep -o '65.108.15.30')" != "65.108.15.30" ]; then
        log_warning "Скрипт должен быть запущен на сервере 65.108.15.30"
        read -p "Продолжить? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    log_success "Сервер проверен"
}

# ЭТАП 1: Диагностика текущего состояния
stage1_diagnosis() {
    log_info "=== ЭТАП 1: Диагностика текущего состояния ==="
    
    log_info "Проверка K3s..."
    systemctl status k3s --no-pager || log_error "K3s не запущен"
    
    log_info "Проверка нод..."
    kubectl get nodes -o wide
    
    log_info "Проверка namespace supabase..."
    if ! kubectl get namespace supabase &>/dev/null; then
        log_warning "Namespace supabase не существует, создаю..."
        kubectl apply -f /opt/canton-validator/../k8s/supabase/namespace.yaml || \
        kubectl create namespace supabase
    fi
    
    log_info "Проверка подов..."
    kubectl get pods -n supabase -o wide
    
    log_info "Проверка сервисов..."
    kubectl get svc -n supabase -o wide
    
    log_info "Проверка контейнеров Canton..."
    cd /opt/canton-validator 2>/dev/null || log_warning "Директория /opt/canton-validator не найдена"
    docker ps -a --format 'table {{.Names}}\t{{.Status}}' | grep splice-validator || log_warning "Контейнеры Canton не найдены"
    
    log_success "Диагностика завершена"
}

# ЭТАП 2: Исправление PostgreSQL Supabase
stage2_postgres() {
    log_info "=== ЭТАП 2: Исправление PostgreSQL Supabase ==="
    
    # Проверка статуса PostgreSQL
    if kubectl get pods -n supabase postgres-0 &>/dev/null; then
        STATUS=$(kubectl get pod -n supabase postgres-0 -o jsonpath='{.status.phase}')
        log_info "PostgreSQL статус: $STATUS"
        
        if [ "$STATUS" != "Running" ]; then
            log_warning "PostgreSQL не работает, проверяю логи..."
            kubectl logs -n supabase postgres-0 --tail=20
            
            read -p "Удалить и пересоздать PostgreSQL? (y/n): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                log_info "Удаление StatefulSet..."
                kubectl delete statefulset postgres -n supabase --cascade=orphan || true
                
                log_warning "Удаление PVC (удалит данные!)..."
                kubectl delete pvc postgres-storage-postgres-0 -n supabase || true
                
                log_info "Применение StatefulSet..."
                kubectl apply -f /opt/canton-validator/../k8s/supabase/postgres-statefulset.yaml || \
                kubectl apply -f k8s/supabase/postgres-statefulset.yaml
                
                log_info "Ожидание готовности PostgreSQL (до 5 минут)..."
                kubectl wait --for=condition=ready pod -l app=postgres -n supabase --timeout=300s || {
                    log_error "PostgreSQL не запустился"
                    kubectl logs -n supabase postgres-0 --tail=50
                    return 1
                }
            fi
        fi
    else
        log_info "PostgreSQL не существует, создаю..."
        kubectl apply -f /opt/canton-validator/../k8s/supabase/postgres-statefulset.yaml || \
        kubectl apply -f k8s/supabase/postgres-statefulset.yaml
        
        log_info "Ожидание готовности PostgreSQL..."
        kubectl wait --for=condition=ready pod -l app=postgres -n supabase --timeout=300s || {
            log_error "PostgreSQL не запустился"
            return 1
        }
    fi
    
    log_info "Инициализация схемы auth..."
    kubectl exec -n supabase postgres-0 -- psql -U supabase -d supabase -c "
        CREATE SCHEMA IF NOT EXISTS auth;
        GRANT USAGE ON SCHEMA auth TO supabase;
        GRANT ALL ON SCHEMA auth TO supabase;
    " || log_warning "Схема auth уже существует или ошибка"
    
    log_success "PostgreSQL настроен"
}

# ЭТАП 3: Проверка и исправление Supabase сервисов
stage3_services() {
    log_info "=== ЭТАП 3: Проверка Supabase сервисов ==="
    
    # Проверка RSA ключей
    if ! kubectl get secret -n supabase auth-rsa-keys &>/dev/null; then
        log_warning "RSA ключи не найдены, создаю..."
        ssh-keygen -t rsa -b 2048 -m PEM -f /tmp/jwt-key -N "" -q
        kubectl create secret generic auth-rsa-keys \
            --from-file=private_key=/tmp/jwt-key \
            --from-file=public_key=/tmp/jwt-key.pub \
            -n supabase
        rm -f /tmp/jwt-key /tmp/jwt-key.pub
        log_success "RSA ключи созданы"
    fi
    
    # Применение всех сервисов
    log_info "Применение манифестов Supabase..."
    MANIFEST_DIR="/opt/canton-validator/../k8s/supabase"
    if [ ! -d "$MANIFEST_DIR" ]; then
        MANIFEST_DIR="k8s/supabase"
    fi
    
    kubectl apply -f "$MANIFEST_DIR/kong-deployment.yaml"
    kubectl apply -f "$MANIFEST_DIR/supabase-services.yaml"
    kubectl apply -f "$MANIFEST_DIR/jwks-service.yaml"
    
    log_info "Ожидание готовности сервисов..."
    sleep 30
    
    # Проверка подов
    log_info "Проверка статуса подов..."
    kubectl get pods -n supabase
    
    # Проверка Kong
    if kubectl get pods -n supabase -l app=kong | grep -q OOMKilled; then
        log_warning "Kong OOMKilled, увеличиваю лимит памяти..."
        kubectl patch deployment kong -n supabase -p '{
            "spec": {
                "template": {
                    "spec": {
                        "containers": [{
                            "name": "kong",
                            "resources": {
                                "limits": {
                                    "memory": "2Gi",
                                    "cpu": "1000m"
                                }
                            }
                        }]
                    }
                }
            }
        }'
        kubectl delete pod -n supabase -l app=kong
    fi
    
    log_success "Сервисы проверены"
}

# ЭТАП 4: Настройка внешнего доступа к JWKS
stage4_external_access() {
    log_info "=== ЭТАП 4: Настройка внешнего доступа к JWKS ==="
    
    log_info "Проверка доступности JWKS изнутри кластера..."
    kubectl run -it --rm --restart=Never test-jwks \
        --image=curlimages/curl:latest \
        --namespace=supabase \
        -- curl -s http://supabase-jwks:8080/jwks | jq . || log_warning "JWKS недоступен изнутри"
    
    log_info "Проверка доступности через Kong..."
    curl -s http://127.0.0.1:30080/auth/v1/jwks | jq . || log_warning "JWKS недоступен через NodePort"
    
    log_info "Выберите решение для внешнего доступа:"
    echo "A) iptables перенаправление (порт 8000 -> 30080)"
    echo "B) hostPort (прямой биндинг порта 8000)"
    echo "C) MetalLB LoadBalancer (production, рекомендуется)"
    read -p "Ваш выбор (A/B/C): " -n 1 -r
    echo
    
    case $REPLY in
        [Aa])
            log_info "Настройка iptables..."
            iptables -t nat -D PREROUTING -p tcp --dport 8000 -j REDIRECT --to-port 30080 2>/dev/null || true
            iptables -t nat -A PREROUTING -p tcp --dport 8000 -j REDIRECT --to-port 30080
            iptables -A INPUT -p tcp --dport 8000 -j ACCEPT
            iptables-save > /etc/iptables/rules.v4 2>/dev/null || log_warning "Не удалось сохранить iptables правила"
            log_success "iptables настроен"
            ;;
        [Bb])
            log_info "Настройка hostPort..."
            kubectl patch deployment kong -n supabase -p '{
                "spec": {
                    "template": {
                        "spec": {
                            "containers": [{
                                "name": "kong",
                                "ports": [{
                                    "containerPort": 8000,
                                    "hostPort": 8000,
                                    "name": "proxy",
                                    "protocol": "TCP"
                                }]
                            }]
                        }
                    }
                }
            }'
            kubectl patch svc kong -n supabase -p '{"spec":{"type":"ClusterIP"}}'
            kubectl rollout status deployment kong -n supabase
            log_success "hostPort настроен"
            ;;
        [Cc])
            log_info "Настройка MetalLB LoadBalancer..."
            stage4_metallb
            ;;
        *)
            log_warning "Неверный выбор, пропускаю настройку внешнего доступа"
            ;;
    esac
    
    log_info "Проверка доступности JWKS..."
    sleep 5
    curl -s http://65.108.15.30:8000/auth/v1/jwks | jq . || log_warning "JWKS все еще недоступен"
    
    log_success "Внешний доступ настроен"
}

# Настройка MetalLB
stage4_metallb() {
    log_info "Установка MetalLB..."
    
    # Проверка существования
    if kubectl get namespace metallb-system &>/dev/null; then
        log_info "MetalLB уже установлен"
    else
        kubectl create namespace metallb-system
        kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/v0.14.3/config/manifests/metallb-native.yaml
        kubectl wait --namespace metallb-system \
            --for=condition=ready pod \
            --selector=app=metallb \
            --timeout=90s || log_error "MetalLB не запустился"
    fi
    
    # IPAddressPool
    kubectl apply -f - <<EOF
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: canton-pool
  namespace: metallb-system
spec:
  addresses:
  - 65.108.15.30/32
  autoAssign: true
EOF
    
    # L2Advertisement
    kubectl apply -f - <<EOF
apiVersion: metallb.io/v1beta1
kind: L2Advertisement
metadata:
  name: canton-l2-advert
  namespace: metallb-system
spec:
  ipAddressPools:
  - canton-pool
EOF
    
    # Обновление Kong Service
    kubectl get svc kong -n supabase -o yaml > /tmp/kong-service-backup.yaml
    kubectl apply -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: kong
  namespace: supabase
  labels:
    app: kong
  annotations:
    metallb.universe.tf/address-pool: canton-pool
    metallb.universe.tf/loadBalancerIPs: 65.108.15.30
spec:
  type: LoadBalancer
  loadBalancerIP: 65.108.15.30
  loadBalancerSourceRanges:
  - 0.0.0.0/0
  externalTrafficPolicy: Local
  ports:
  - port: 8000
    targetPort: 8000
    protocol: TCP
    name: proxy
  - port: 8443
    targetPort: 8443
    protocol: TCP
    name: proxy-ssl
  selector:
    app: kong
EOF
    
    log_info "Ожидание назначения External IP..."
    kubectl wait --for=jsonpath='{.status.loadBalancer.ingress[0].ip}' \
        svc/kong -n supabase --timeout=60s || log_warning "External IP не назначен"
    
    kubectl get svc kong -n supabase
    log_success "MetalLB настроен"
}

# ЭТАП 5: Обновление Canton Validator .env
stage5_env_update() {
    log_info "=== ЭТАП 5: Обновление Canton Validator .env ==="
    
    cd /opt/canton-validator || {
        log_error "Директория /opt/canton-validator не найдена"
        return 1
    }
    
    # Backup
    if [ -f .env ]; then
        cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
        log_success "Backup .env создан"
    fi
    
    # Обновление AUTH переменных
    log_info "Обновление AUTH переменных..."
    sed -i 's|AUTH_JWKS_URL=.*|AUTH_JWKS_URL=http://65.108.15.30:8000/auth/v1/jwks|g' .env
    sed -i 's|AUTH_WELLKNOWN_URL=.*|AUTH_WELLKNOWN_URL=http://65.108.15.30:8000/auth/v1/.well-known/jwks.json|g' .env
    sed -i 's|AUTH_URL=.*|AUTH_URL=http://65.108.15.30:8000/auth/v1|g' .env
    
    # Проверка
    log_info "Проверка обновленного .env..."
    grep -E '(AUTH_JWKS_URL|AUTH_WELLKNOWN_URL|AUTH_URL|LEDGER_API_AUTH_AUDIENCE|VALIDATOR_AUTH_AUDIENCE)' .env
    
    log_success ".env обновлен"
}

# ЭТАП 6: Перезапуск Canton Validator
stage6_restart_canton() {
    log_info "=== ЭТАП 6: Перезапуск Canton Validator ==="
    
    cd /opt/canton-validator || {
        log_error "Директория /opt/canton-validator не найдена"
        return 1
    }
    
    log_info "Остановка контейнеров..."
    docker compose -f compose.yaml down || log_warning "Контейнеры уже остановлены"
    
    log_info "Запуск контейнеров..."
    docker compose -f compose.yaml up -d
    
    log_info "Ожидание запуска (30 секунд)..."
    sleep 30
    
    log_info "Проверка статуса контейнеров..."
    docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep splice-validator
    
    log_info "Проверка логов на ошибки..."
    docker logs splice-validator-participant-1 2>&1 | grep -i 'auth\|jwks\|error' | tail -10 || log_info "Ошибок не найдено"
    
    log_success "Canton Validator перезапущен"
}

# ЭТАП 7: Проверка подключения к DevNet
stage7_devnet() {
    log_info "=== ЭТАП 7: Проверка подключения к DevNet ==="
    
    log_info "Проверка доступности DevNet endpoints..."
    curl -I https://sv.sv-1.dev.global.canton.network.sync.global || log_warning "Sponsor SV недоступен"
    curl -I https://scan.sv-1.dev.global.canton.network.sync.global || log_warning "Scan недоступен"
    
    log_info "Мониторинг логов validator на onboarding..."
    docker logs splice-validator-validator-1 2>&1 | grep -i 'sv-1.dev\|onboard\|devnet' | tail -10 || log_info "Логи onboarding не найдены"
    
    log_success "DevNet проверен"
}

# ЭТАП 8: Настройка systemd автозапуска
stage8_systemd() {
    log_info "=== ЭТАП 8: Настройка systemd автозапуска ==="
    
    cat > /etc/systemd/system/canton-validator.service <<'EOF'
[Unit]
Description=Canton Validator Node
After=docker.service network-online.target k3s.service
Wants=network-online.target
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/canton-validator
Environment="LC_ALL=C.UTF-8"
Environment="LANG=C.UTF-8"
Environment="PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

ExecStart=/usr/bin/docker compose -f /opt/canton-validator/compose.yaml up -d
ExecStop=/usr/bin/docker compose -f /opt/canton-validator/compose.yaml down

Restart=on-failure
RestartSec=10

TimeoutStartSec=300
TimeoutStopSec=120

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable canton-validator.service
    systemctl start canton-validator.service
    
    log_info "Проверка статуса сервиса..."
    systemctl status canton-validator.service --no-pager
    
    log_success "Systemd сервис настроен"
}

# Финальная проверка
final_check() {
    log_info "=== ФИНАЛЬНАЯ ПРОВЕРКА ==="
    
    log_info "1. Kubernetes поды..."
    kubectl get pods -n supabase
    
    log_info "2. JWKS endpoint..."
    curl -s http://65.108.15.30:8000/auth/v1/jwks | jq '.keys[0].kid' || log_warning "JWKS недоступен"
    
    log_info "3. Canton контейнеры..."
    docker ps --format 'table {{.Names}}\t{{.Status}}' | grep splice-validator | grep -v Exited
    
    log_info "4. Systemd сервис..."
    systemctl is-active canton-validator.service && log_success "Сервис активен" || log_warning "Сервис не активен"
    
    log_success "Финальная проверка завершена"
}

# Главная функция
main() {
    log_info "🚀 Начало выполнения ULTIMATE_CANTON_VALIDATOR_DEPLOYMENT_GUIDE"
    log_info "Версия: 2.0"
    echo
    
    check_server
    
    # Выбор этапов для выполнения
    echo "Выберите этапы для выполнения:"
    echo "1) Все этапы (1-8)"
    echo "2) Только диагностика (1)"
    echo "3) Только Supabase (2-4)"
    echo "4) Только Canton (5-6)"
    echo "5) Пользовательский выбор"
    read -p "Ваш выбор (1-5): " -n 1 -r
    echo
    
    case $REPLY in
        1)
            stage1_diagnosis
            stage2_postgres
            stage3_services
            stage4_external_access
            stage5_env_update
            stage6_restart_canton
            stage7_devnet
            stage8_systemd
            final_check
            ;;
        2)
            stage1_diagnosis
            ;;
        3)
            stage2_postgres
            stage3_services
            stage4_external_access
            ;;
        4)
            stage5_env_update
            stage6_restart_canton
            ;;
        5)
            echo "Выберите этапы (через запятую, например: 1,2,3):"
            read -p "Этапы: " STAGES
            IFS=',' read -ra STAGE_ARRAY <<< "$STAGES"
            for stage in "${STAGE_ARRAY[@]}"; do
                case $stage in
                    1) stage1_diagnosis ;;
                    2) stage2_postgres ;;
                    3) stage3_services ;;
                    4) stage4_external_access ;;
                    5) stage5_env_update ;;
                    6) stage6_restart_canton ;;
                    7) stage7_devnet ;;
                    8) stage8_systemd ;;
                esac
            done
            final_check
            ;;
        *)
            log_error "Неверный выбор"
            exit 1
            ;;
    esac
    
    log_success "✅ Выполнение завершено!"
}

# Запуск
main "$@"





