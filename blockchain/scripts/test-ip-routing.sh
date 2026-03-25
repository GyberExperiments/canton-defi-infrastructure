#!/bin/bash

# Скрипт для проверки реальной маршрутизации трафика с правильных IP адресов

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

# Тест 1: Проверка IP через внешние сервисы
test_ip_detection() {
    print_header "Тест 1: Определение IP адреса через внешние сервисы"
    
    print_info "Проверка Devnet IP (65.108.15.30)..."
    DEVNET_DETECTED=$(curl -sSL --interface $DEVNET_IP http://checkip.amazonaws.com 2>/dev/null || echo "ERROR")
    if [ "$DEVNET_DETECTED" = "$DEVNET_IP" ]; then
        print_success "Devnet IP правильный: $DEVNET_DETECTED"
    else
        print_warning "Devnet IP не совпадает: обнаружен $DEVNET_DETECTED, ожидается $DEVNET_IP"
    fi
    
    print_info "Проверка Testnet IP (65.108.15.20)..."
    TESTNET_DETECTED=$(curl -sSL --interface $TESTNET_IP http://checkip.amazonaws.com 2>/dev/null || echo "ERROR")
    if [ "$TESTNET_DETECTED" = "$TESTNET_IP" ]; then
        print_success "Testnet IP правильный: $TESTNET_DETECTED"
    else
        print_error "Testnet IP не совпадает: обнаружен $TESTNET_DETECTED, ожидается $TESTNET_IP"
    fi
    
    print_info "Проверка Mainnet IP (65.108.15.19)..."
    MAINNET_DETECTED=$(curl -sSL --interface $MAINNET_IP http://checkip.amazonaws.com 2>/dev/null || echo "ERROR")
    if [ "$MAINNET_DETECTED" = "$MAINNET_IP" ]; then
        print_success "Mainnet IP правильный: $MAINNET_DETECTED"
    else
        print_error "Mainnet IP не совпадает: обнаружен $MAINNET_DETECTED, ожидается $MAINNET_IP"
    fi
    
    echo ""
}

# Тест 2: Проверка через несколько сервисов
test_multiple_services() {
    print_header "Тест 2: Проверка через несколько сервисов определения IP"
    
    SERVICES=(
        "http://checkip.amazonaws.com"
        "https://ifconfig.me"
        "https://api.ipify.org"
        "https://icanhazip.com"
    )
    
    for SERVICE in "${SERVICES[@]}"; do
        print_info "Проверка через $SERVICE..."
        
        TESTNET_RESULT=$(curl -sSL --interface $TESTNET_IP --max-time 5 "$SERVICE" 2>/dev/null || echo "ERROR")
        MAINNET_RESULT=$(curl -sSL --interface $MAINNET_IP --max-time 5 "$SERVICE" 2>/dev/null || echo "ERROR")
        
        if [ "$TESTNET_RESULT" = "$TESTNET_IP" ]; then
            print_success "  Testnet: $TESTNET_RESULT ✅"
        else
            print_error "  Testnet: $TESTNET_RESULT (ожидается $TESTNET_IP) ❌"
        fi
        
        if [ "$MAINNET_RESULT" = "$MAINNET_IP" ]; then
            print_success "  Mainnet: $MAINNET_RESULT ✅"
        else
            print_error "  Mainnet: $MAINNET_RESULT (ожидается $MAINNET_IP) ❌"
        fi
        
        echo ""
    done
}

# Тест 3: Проверка реальных запросов к Canton API
test_canton_api() {
    print_header "Тест 3: Проверка реальных запросов к Canton API"
    
    print_info "Запрос к Testnet API с IP 65.108.15.20..."
    TESTNET_RESPONSE=$(curl -sSL --interface $TESTNET_IP -m 10 --connect-timeout 5 \
        https://scan.sv-1.testnet.global.canton.network.sync.global/api/scan/v0/scans 2>&1)
    
    if echo "$TESTNET_RESPONSE" | grep -q '"scans"'; then
        print_success "Testnet API доступен"
        print_info "Получен ответ от API (IP должен быть 65.108.15.20)"
    else
        print_warning "Testnet API недоступен или timeout"
        echo "Ответ: ${TESTNET_RESPONSE:0:200}"
    fi
    
    echo ""
    
    print_info "Запрос к Mainnet API с IP 65.108.15.19..."
    MAINNET_RESPONSE=$(curl -sSL --interface $MAINNET_IP -m 10 --connect-timeout 5 \
        https://scan.sv-1.global.canton.network.sync.global/api/scan/v0/scans 2>&1)
    
    if echo "$MAINNET_RESPONSE" | grep -q '"scans"'; then
        print_success "Mainnet API доступен"
        print_info "Получен ответ от API (IP должен быть 65.108.15.19)"
    else
        print_warning "Mainnet API недоступен или timeout"
        echo "Ответ: ${MAINNET_RESPONSE:0:200}"
    fi
    
    echo ""
}

# Тест 4: Проверка через tcpdump (если доступен)
test_tcpdump() {
    print_header "Тест 4: Проверка через tcpdump (требует root)"
    
    if ! command -v tcpdump &> /dev/null; then
        print_warning "tcpdump не установлен, пропускаем тест"
        return
    fi
    
    if [ "$EUID" -ne 0 ]; then
        print_warning "Требуются права root для tcpdump, пропускаем тест"
        return
    fi
    
    print_info "Захват трафика для Testnet (5 секунд)..."
    timeout 5 tcpdump -i any -n "host scan.sv-1.testnet.global.canton.network.sync.global and src host 65.108.15.20" 2>&1 | head -5 || true
    
    print_info "Захват трафика для Mainnet (5 секунд)..."
    timeout 5 tcpdump -i any -n "host scan.sv-1.global.canton.network.sync.global and src host 65.108.15.19" 2>&1 | head -5 || true
    
    echo ""
}

# Тест 5: Проверка маршрутизации через ip route
test_routing() {
    print_header "Тест 5: Проверка настроек маршрутизации"
    
    print_info "Правила маршрутизации (ip rule):"
    ip rule show | grep "65.108.15" || print_warning "Правила для 65.108.15.* не найдены"
    
    echo ""
    
    print_info "Таблицы маршрутизации:"
    if ip route show table 200 &>/dev/null; then
        print_success "Таблица 200 (Testnet) существует:"
        ip route show table 200
    else
        print_warning "Таблица 200 (Testnet) не найдена"
    fi
    
    echo ""
    
    if ip route show table 201 &>/dev/null; then
        print_success "Таблица 201 (Mainnet) существует:"
        ip route show table 201
    else
        print_warning "Таблица 201 (Mainnet) не найдена"
    fi
    
    echo ""
}

# Главная функция
main() {
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║   Проверка реальной маршрутизации трафика с IP адресов        ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    
    # Проверка IP адресов на интерфейсе
    print_info "Проверка IP адресов на интерфейсе..."
    ip addr show | grep "65.108.15" | awk '{print "  " $2}'
    echo ""
    
    # Запуск тестов
    test_routing
    test_ip_detection
    test_multiple_services
    test_canton_api
    
    # Итоги
    print_header "Итоги проверки"
    
    print_info "Для проверки в реальном времени используйте:"
    echo "  # В одном терминале запустите tcpdump:"
    echo "  sudo tcpdump -i any -n 'host scan.sv-1.testnet.global.canton.network.sync.global'"
    echo ""
    echo "  # В другом терминале отправьте запрос:"
    echo "  curl --interface 65.108.15.20 https://scan.sv-1.testnet.global.canton.network.sync.global/api/scan/v0/scans"
    echo ""
    echo "  # В выводе tcpdump вы должны увидеть src IP = 65.108.15.20"
    echo ""
}

# Запуск
main "$@"





