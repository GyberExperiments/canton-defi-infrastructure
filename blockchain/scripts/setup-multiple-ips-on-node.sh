#!/bin/bash

# Скрипт для настройки нескольких статических IP адресов на одной ноде
# Используется когда Testnet и Mainnet IP находятся на том же сервере, что и Devnet

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
NETMASK="255.255.255.0"

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

# Проверка прав root
check_root() {
    if [ "$EUID" -ne 0 ]; then 
        print_error "Этот скрипт должен быть запущен от root"
        exit 1
    fi
}

# Определение интерфейса
detect_interface() {
    # Ищем интерфейс с основным IP
    INTERFACE=$(ip route | grep default | awk '{print $5}' | head -1)
    
    if [ -z "$INTERFACE" ]; then
        # Альтернативный способ
        INTERFACE=$(ip link show | grep -E "^[0-9]+:.*state UP" | head -1 | cut -d: -f2 | tr -d ' ')
    fi
    
    if [ -z "$INTERFACE" ]; then
        print_error "Не удалось определить сетевой интерфейс"
        exit 1
    fi
    
    print_success "Найден интерфейс: $INTERFACE"
}

# Проверка существующих IP
check_existing_ips() {
    print_info "Проверка существующих IP адресов..."
    
    for IP in "$DEVNET_IP" "$TESTNET_IP" "$MAINNET_IP"; do
        if ip addr show | grep -q "$IP"; then
            print_success "IP $IP уже настроен"
        else
            print_warning "IP $IP не найден"
        fi
    done
}

# Настройка через ip addr (временная)
setup_ip_temporary() {
    local IP=$1
    local LABEL=$2
    
    print_info "Добавление IP $IP ($LABEL)..."
    
    if ip addr add "$IP/24" dev "$INTERFACE" label "${INTERFACE}:${LABEL}" 2>/dev/null; then
        print_success "IP $IP добавлен временно"
    else
        if ip addr show | grep -q "$IP"; then
            print_warning "IP $IP уже существует"
        else
            print_error "Не удалось добавить IP $IP"
            return 1
        fi
    fi
}

# Настройка через netplan (постоянная)
setup_netplan() {
    print_info "Настройка netplan для постоянного сохранения IP..."
    
    # Находим файл netplan
    NETPLAN_FILE=$(ls /etc/netplan/*.yaml 2>/dev/null | head -1)
    
    if [ -z "$NETPLAN_FILE" ]; then
        print_warning "Файл netplan не найден, создаем новый..."
        NETPLAN_FILE="/etc/netplan/50-static-ips.yaml"
    fi
    
    print_info "Используется файл: $NETPLAN_FILE"
    print_warning "ВНИМАНИЕ: Создайте резервную копию перед редактированием!"
    
    # Создаем резервную копию
    cp "$NETPLAN_FILE" "${NETPLAN_FILE}.backup.$(date +%Y%m%d_%H%M%S)" 2>/dev/null || true
    
    print_info "Пример конфигурации netplan:"
    cat << EOF

network:
  version: 2
  renderer: networkd
  ethernets:
    ${INTERFACE}:
      dhcp4: false
      addresses:
        - ${DEVNET_IP}/24
        - ${TESTNET_IP}/24
        - ${MAINNET_IP}/24
      gateway4: $(ip route | grep default | awk '{print $3}' | head -1)
      nameservers:
        addresses:
          - 8.8.8.8
          - 8.8.4.4

EOF
    
    print_warning "Отредактируйте файл $NETPLAN_FILE вручную с приведенной выше конфигурацией"
    print_info "После редактирования выполните: netplan apply"
}

# Настройка iptables для маршрутизации
setup_iptables_routing() {
    print_info "Настройка iptables для маршрутизации трафика с правильных IP..."
    
    # Получаем gateway
    GATEWAY=$(ip route | grep default | awk '{print $3}' | head -1)
    
    if [ -z "$GATEWAY" ]; then
        print_error "Не удалось определить gateway"
        return 1
    fi
    
    print_info "Gateway: $GATEWAY"
    
    # Правила для Testnet
    print_info "Добавление правил для Testnet (65.108.15.20)..."
    iptables -t nat -C OUTPUT -p tcp --dport 443 -d scan.sv-1.testnet.global.canton.network.sync.global -j SNAT --to-source "$TESTNET_IP" 2>/dev/null || \
    iptables -t nat -A OUTPUT -p tcp --dport 443 -d scan.sv-1.testnet.global.canton.network.sync.global -j SNAT --to-source "$TESTNET_IP"
    
    # Правила для Mainnet
    print_info "Добавление правил для Mainnet (65.108.15.19)..."
    iptables -t nat -C OUTPUT -p tcp --dport 443 -d scan.sv-1.global.canton.network.sync.global -j SNAT --to-source "$MAINNET_IP" 2>/dev/null || \
    iptables -t nat -A OUTPUT -p tcp --dport 443 -d scan.sv-1.global.canton.network.sync.global -j SNAT --to-source "$MAINNET_IP"
    
    print_success "Правила iptables добавлены"
    
    # Сохранение правил
    if command -v iptables-save &> /dev/null; then
        print_info "Сохранение правил iptables..."
        iptables-save > /etc/iptables/rules.v4 2>/dev/null || \
        mkdir -p /etc/iptables && iptables-save > /etc/iptables/rules.v4
        
        print_info "Для автоматической загрузки правил при загрузке добавьте в /etc/rc.local:"
        echo "  iptables-restore < /etc/iptables/rules.v4"
    fi
}

# Главная функция
main() {
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║   Настройка нескольких статических IP на ноде                 ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    
    check_root
    detect_interface
    echo ""
    
    check_existing_ips
    echo ""
    
    print_info "Добавление IP адресов временно (до перезагрузки)..."
    setup_ip_temporary "$TESTNET_IP" "testnet" || true
    setup_ip_temporary "$MAINNET_IP" "mainnet" || true
    echo ""
    
    print_info "Текущие IP адреса:"
    ip addr show "$INTERFACE" | grep "inet " | awk '{print "  " $2}'
    echo ""
    
    setup_netplan
    echo ""
    
    read -p "Настроить iptables для маршрутизации трафика? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        setup_iptables_routing
    fi
    
    echo ""
    print_success "Настройка завершена!"
    echo ""
    print_info "Следующие шаги:"
    echo "  1. Отредактируйте файл netplan для постоянного сохранения IP"
    echo "  2. Выполните: netplan apply"
    echo "  3. Проверьте IP: ip addr show"
    echo "  4. Перезапустите k3s agent: systemctl restart k3s-agent"
    echo "  5. Проверьте ноды в кластере: kubectl get nodes -o wide"
}

# Запуск
main "$@"





