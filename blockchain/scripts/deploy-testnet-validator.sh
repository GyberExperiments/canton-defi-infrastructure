#!/bin/bash

# 🚀 Скрипт для развертывания Testnet валидатора на ноде 65.108.15.20

set -e

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Конфигурация
NODE_IP="65.108.15.20"
MASTER_IP="31.129.105.180"
NETWORK="testnet"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_header() {
    echo -e "${BLUE}════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}════════════════════════════════════════${NC}"
}

# Проверка подключения ноды к кластеру
check_node_connected() {
    print_header "1. Проверка подключения ноды к кластеру"
    
    local node_exists
    node_exists=$(kubectl get nodes -o jsonpath='{.items[*].status.addresses[?(@.type=="InternalIP")].address}' 2>/dev/null | grep -q "$NODE_IP" && echo "yes" || echo "no")
    
    if [ "$node_exists" = "yes" ]; then
        local node_name
        node_name=$(kubectl get nodes -o jsonpath='{range .items[?(@.status.addresses[?(@.type=="InternalIP")].address=="'$NODE_IP'")]}{.metadata.name}{end}' 2>/dev/null)
        print_status "Нода $NODE_IP подключена к кластеру"
        print_info "Hostname ноды: $node_name"
        echo "$node_name"
        return 0
    else
        print_error "Нода $NODE_IP НЕ подключена к кластеру"
        print_warning "Необходимо подключить ноду перед развертыванием"
        echo ""
        print_info "Для подключения выполните на сервере $NODE_IP:"
        echo "  ssh root@$NODE_IP"
        echo "  # Получите токен:"
        echo "  # ssh root@$MASTER_IP 'sudo cat /var/lib/rancher/k3s/server/node-token'"
        echo "  # Затем выполните подключение"
        return 1
    fi
}

# Обновление hostname в манифесте
update_manifest_hostname() {
    local node_hostname=$1
    
    print_header "2. Обновление hostname в манифесте"
    
    local manifest_file="$PROJECT_ROOT/config/kubernetes/k8s/canton-validator-testnet.yaml"
    
    if [ ! -f "$manifest_file" ]; then
        print_error "Манифест не найден: $manifest_file"
        return 1
    fi
    
    # Создание резервной копии
    cp "$manifest_file" "${manifest_file}.backup"
    print_status "Резервная копия создана"
    
    # Обновление hostname
    sed -i.tmp "s/kubernetes.io\/hostname: \"\"/kubernetes.io\/hostname: \"$node_hostname\"/" "$manifest_file"
    rm -f "${manifest_file}.tmp"
    
    print_status "Hostname обновлен: $node_hostname"
}

# Проверка/создание Secret
check_secret() {
    print_header "3. Проверка Secret для Testnet"
    
    local secret_exists
    secret_exists=$(kubectl get secret canton-onboarding-testnet -n canton-node 2>/dev/null && echo "yes" || echo "no")
    
    if [ "$secret_exists" = "no" ]; then
        print_warning "Secret canton-onboarding-testnet не найден"
        print_info "Создаю временный Secret (обновите после получения onboarding secret)"
        
        kubectl create secret generic canton-onboarding-testnet \
            -n canton-node \
            --from-literal=ONBOARDING_SECRET="placeholder-update-after-whitelisting" \
            --dry-run=client -o yaml | kubectl apply -f -
        
        print_status "Временный Secret создан"
        print_warning "ВАЖНО: Обновите Secret после получения реального onboarding secret для Testnet"
    else
        print_status "Secret canton-onboarding-testnet существует"
    fi
}

# Развертывание валидатора
deploy_validator() {
    print_header "4. Развертывание Testnet валидатора"
    
    local manifest_file="$PROJECT_ROOT/config/kubernetes/k8s/canton-validator-testnet.yaml"
    
    print_info "Применение манифеста: $manifest_file"
    kubectl apply -f "$manifest_file"
    
    print_status "Манифест применен"
}

# Проверка статуса развертывания
check_deployment_status() {
    print_header "5. Проверка статуса развертывания"
    
    sleep 5
    
    print_info "Статус пода:"
    kubectl get pods -n canton-node -l node=testnet-validator -o wide
    
    echo ""
    print_info "События:"
    kubectl get events -n canton-node --sort-by='.lastTimestamp' | grep testnet | tail -5
    
    echo ""
    print_info "Для просмотра логов выполните:"
    echo "  kubectl logs -f -n canton-node -l node=testnet-validator"
}

# Проверка whitelisting через логи
check_whitelisting_status() {
    print_header "6. Проверка whitelisting"
    
    local pod_name
    pod_name=$(kubectl get pods -n canton-node -l node=testnet-validator -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [ -z "$pod_name" ]; then
        print_warning "Под не найден, невозможно проверить логи"
        return 1
    fi
    
    print_info "Проверка логов на ошибки whitelisting..."
    sleep 10  # Даем поду время запуститься
    
    local logs
    logs=$(kubectl logs -n canton-node "$pod_name" --tail=50 2>/dev/null || echo "")
    
    if [ -z "$logs" ]; then
        print_warning "Логи пока пусты (под еще запускается)"
        return 0
    fi
    
    # Проверка на ошибки whitelisting
    if echo "$logs" | grep -qi "whitelist\|unauthorized\|forbidden\|403\|401\|not.*whitelist"; then
        print_error "Обнаружены ошибки, связанные с whitelisting!"
        echo ""
        echo "$logs" | grep -i "whitelist\|unauthorized\|forbidden\|403\|401" | head -10
        echo ""
        print_warning "IP $NODE_IP может быть не добавлен в whitelist для Testnet"
        print_info "Проверьте статус whitelisting у SV sponsor (GSF)"
    elif echo "$logs" | grep -qi "connected\|success\|ready"; then
        print_status "В логах есть признаки успешного подключения"
        echo ""
        echo "$logs" | grep -i "connected\|success\|ready" | head -5
    else
        print_info "Логи пока не показывают явных проблем с whitelisting"
        echo ""
        echo "Последние строки логов:"
        echo "$logs" | tail -10
    fi
}

# Главная функция
main() {
    echo ""
    print_header "🚀 Развертывание Canton Testnet Validator"
    echo ""
    print_info "IP ноды: $NODE_IP"
    print_info "Сеть: $NETWORK"
    print_info "Master IP: $MASTER_IP"
    echo ""
    
    # Проверка подключения ноды
    local node_hostname
    node_hostname=$(check_node_connected)
    
    if [ -z "$node_hostname" ]; then
        print_error "Нода не подключена. Подключите ноду и запустите скрипт снова."
        exit 1
    fi
    
    echo ""
    
    # Обновление манифеста
    update_manifest_hostname "$node_hostname"
    echo ""
    
    # Проверка Secret
    check_secret
    echo ""
    
    # Развертывание
    deploy_validator
    echo ""
    
    # Проверка статуса
    check_deployment_status
    echo ""
    
    # Проверка whitelisting
    check_whitelisting_status
    echo ""
    
    print_header "📊 Итоговый статус"
    print_info "Health check: curl http://$NODE_IP:8081/health"
    print_info "Логи: kubectl logs -f -n canton-node -l node=testnet-validator"
    print_info "Статус: kubectl get pods -n canton-node -l node=testnet-validator"
    echo ""
    
    print_warning "ВАЖНО:"
    echo "  1. Убедитесь, что IP $NODE_IP добавлен в whitelist для Testnet"
    echo "  2. Обновите Secret canton-onboarding-testnet реальным onboarding secret"
    echo "  3. Проверьте логи на ошибки подключения"
    echo ""
}

# Запуск
main "$@"


















