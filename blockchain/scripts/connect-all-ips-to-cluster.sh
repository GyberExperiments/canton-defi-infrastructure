#!/bin/bash

# Скрипт для подключения всех статических IP адресов к кластеру
# Автоматически определяет ситуацию и выполняет необходимые шаги

set -e

# Цвета
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# IP адреса
DEVNET_IP="65.108.15.30"
TESTNET_IP="65.108.15.20"
MAINNET_IP="65.108.15.19"
MASTER_IP="31.129.105.180"

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_header() {
    echo ""
    echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
    echo ""
}

# Проверка доступности сервера
check_server_access() {
    local IP=$1
    print_info "Проверка доступности сервера $IP..."
    
    if ping -c 2 -W 2 "$IP" &>/dev/null; then
        print_success "Сервер $IP доступен"
        return 0
    else
        print_warning "Сервер $IP недоступен через ping (может быть заблокирован ICMP)"
        # Попробуем через SSH
        if ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no "root@$IP" "echo 'OK'" &>/dev/null; then
            print_success "Сервер $IP доступен через SSH"
            return 0
        else
            print_error "Сервер $IP недоступен"
            return 1
        fi
    fi
}

# Проверка IP адресов на сервере
check_ips_on_server() {
    local IP=$1
    print_info "Проверка IP адресов на сервере $IP..."
    
    ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no "root@$IP" "
        echo 'Текущие IP адреса:'
        ip addr show | grep '65.108.15' | awk '{print \"  \" \$2}'
    " 2>/dev/null || {
        print_error "Не удалось подключиться к серверу $IP"
        return 1
    }
}

# Определение ситуации
detect_situation() {
    print_header "Определение ситуации"
    
    # Проверяем доступность серверов
    DEVNET_ACCESS=false
    TESTNET_ACCESS=false
    MAINNET_ACCESS=false
    
    if check_server_access "$DEVNET_IP"; then
        DEVNET_ACCESS=true
    fi
    
    if check_server_access "$TESTNET_IP"; then
        TESTNET_ACCESS=true
    fi
    
    if check_server_access "$MAINNET_IP"; then
        MAINNET_ACCESS=true
    fi
    
    echo ""
    print_info "Результаты проверки:"
    echo "  Devnet ($DEVNET_IP): $([ "$DEVNET_ACCESS" = true ] && echo "✅ Доступен" || echo "❌ Недоступен")"
    echo "  Testnet ($TESTNET_IP): $([ "$TESTNET_ACCESS" = true ] && echo "✅ Доступен" || echo "❌ Недоступен")"
    echo "  Mainnet ($MAINNET_IP): $([ "$MAINNET_ACCESS" = true ] && echo "✅ Доступен" || echo "❌ Недоступен")"
    echo ""
    
    # Определяем ситуацию
    if [ "$DEVNET_ACCESS" = true ] && [ "$TESTNET_ACCESS" = true ] && [ "$MAINNET_IP" = "$DEVNET_IP" ]; then
        print_success "Все IP адреса на одном сервере ($DEVNET_IP)"
        echo "SITUATION=same_server" > /tmp/canton-ip-situation.txt
        return 0
    elif [ "$TESTNET_ACCESS" = true ] && [ "$MAINNET_ACCESS" = true ]; then
        print_success "IP адреса на разных серверах"
        echo "SITUATION=different_servers" > /tmp/canton-ip-situation.txt
        return 0
    else
        print_error "Не удалось определить ситуацию"
        print_warning "Проверьте доступность серверов вручную"
        return 1
    fi
}

# Подключение IP на одном сервере
setup_same_server() {
    print_header "Настройка IP адресов на одном сервере"
    
    print_info "Подключение к серверу $DEVNET_IP..."
    
    # Копируем скрипт на сервер
    if [ -f "blockchain/scripts/setup-multiple-ips-on-node.sh" ]; then
        print_info "Копирование скрипта на сервер..."
        scp -o ConnectTimeout=5 -o StrictHostKeyChecking=no \
            blockchain/scripts/setup-multiple-ips-on-node.sh \
            "root@$DEVNET_IP:/tmp/setup-ips.sh" 2>/dev/null || {
            print_error "Не удалось скопировать скрипт"
            return 1
        }
        
        print_info "Запуск скрипта на сервере..."
        ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no "root@$DEVNET_IP" \
            "bash /tmp/setup-ips.sh" || {
            print_warning "Скрипт завершился с ошибками, проверьте вручную"
        }
    else
        print_warning "Скрипт setup-multiple-ips-on-node.sh не найден"
        print_info "Выполните настройку вручную (см. blockchain/STEP_BY_STEP_CONNECT_IPS.md)"
    fi
}

# Подключение отдельных серверов
setup_different_servers() {
    print_header "Подключение отдельных серверов к кластеру"
    
    # Получаем токен
    print_info "Получение токена k3s..."
    K3S_TOKEN=$(ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no "root@$MASTER_IP" \
        "sudo cat /var/lib/rancher/k3s/server/node-token" 2>/dev/null || echo "")
    
    if [ -z "$K3S_TOKEN" ]; then
        print_error "Не удалось получить токен k3s"
        print_info "Выполните вручную: ssh root@$MASTER_IP 'sudo cat /var/lib/rancher/k3s/server/node-token'"
        return 1
    fi
    
    print_success "Токен получен"
    
    # Подключаем Testnet
    if check_server_access "$TESTNET_IP"; then
        print_info "Подключение Testnet сервера ($TESTNET_IP)..."
        
        ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no "root@$TESTNET_IP" "
            curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=latest sh -s - agent \
                --server https://$MASTER_IP:6443 \
                --token $K3S_TOKEN \
                --node-name canton-node-65-108-15-20 \
                --node-ip $TESTNET_IP
        " 2>/dev/null && print_success "Testnet сервер подключен" || \
        print_warning "Не удалось подключить Testnet сервер"
    fi
    
    # Подключаем Mainnet
    if check_server_access "$MAINNET_IP"; then
        print_info "Подключение Mainnet сервера ($MAINNET_IP)..."
        
        ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no "root@$MAINNET_IP" "
            curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=latest sh -s - agent \
                --server https://$MASTER_IP:6443 \
                --token $K3S_TOKEN \
                --node-name canton-node-65-108-15-19 \
                --node-ip $MAINNET_IP
        " 2>/dev/null && print_success "Mainnet сервер подключен" || \
        print_warning "Не удалось подключить Mainnet сервер"
    fi
}

# Проверка подключения в кластере
check_cluster_connection() {
    print_header "Проверка подключения в кластере"
    
    print_info "Проверка нод в кластере..."
    kubectl get nodes -o wide | grep -E "65.108.15" || {
        print_warning "Ноды с IP 65.108.15.* не найдены в кластере"
        return 1
    }
    
    print_success "Ноды найдены в кластере"
}

# Запуск проверки валидации
run_validation() {
    print_header "Запуск проверки валидации"
    
    # Testnet
    print_info "Запуск проверки Testnet..."
    kubectl delete job ip-validation-checker-testnet -n default --ignore-not-found=true &>/dev/null
    kubectl apply -f blockchain/k8s/ip-validation-testnet.yaml &>/dev/null && {
        print_success "Проверка Testnet запущена"
        print_info "Просмотр логов: kubectl logs -l job-name=ip-validation-checker-testnet -f"
    } || print_error "Не удалось запустить проверку Testnet"
    
    # Mainnet
    print_info "Запуск проверки Mainnet..."
    kubectl delete job ip-validation-checker-mainnet -n default --ignore-not-found=true &>/dev/null
    kubectl apply -f blockchain/k8s/ip-validation-mainnet.yaml &>/dev/null && {
        print_success "Проверка Mainnet запущена"
        print_info "Просмотр логов: kubectl logs -l job-name=ip-validation-checker-mainnet -f"
    } || print_error "Не удалось запустить проверку Mainnet"
}

# Главная функция
main() {
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║   Подключение статических IP адресов к кластеру               ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    
    # Определяем ситуацию
    if ! detect_situation; then
        print_error "Не удалось определить ситуацию"
        print_info "Выполните настройку вручную (см. blockchain/STEP_BY_STEP_CONNECT_IPS.md)"
        exit 1
    fi
    
    SITUATION=$(cat /tmp/canton-ip-situation.txt 2>/dev/null | grep SITUATION= | cut -d= -f2)
    
    # Выполняем соответствующую настройку
    case "$SITUATION" in
        same_server)
            setup_same_server
            ;;
        different_servers)
            setup_different_servers
            ;;
        *)
            print_error "Неизвестная ситуация: $SITUATION"
            exit 1
            ;;
    esac
    
    # Проверяем подключение
    sleep 5
    check_cluster_connection
    
    # Запускаем валидацию
    read -p "Запустить проверку валидации IP адресов? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        run_validation
    fi
    
    print_header "Завершено"
    print_success "Настройка завершена!"
    print_info "Следующие шаги:"
    echo "  1. Проверьте ноды: kubectl get nodes -o wide"
    echo "  2. Просмотрите логи валидации: kubectl logs -l job-name=ip-validation-checker-testnet -f"
    echo "  3. См. подробную инструкцию: blockchain/STEP_BY_STEP_CONNECT_IPS.md"
    echo ""
}

# Запуск
main "$@"





