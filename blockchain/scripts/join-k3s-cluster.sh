#!/bin/bash

# 🚀 Подключение нового сервера к k3s кластеру
# Используется для подключения worker ноды к существующему k3s кластеру

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Конфигурация
MASTER_IP="${MASTER_IP:-}"
K3S_TOKEN="${K3S_TOKEN:-}"
NODE_NAME="${NODE_NAME:-}"
NODE_IP="${NODE_IP:-}"

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

show_usage() {
    echo "Usage: $0 --master-ip <IP> --token <TOKEN> [OPTIONS]"
    echo ""
    echo "ОБЯЗАТЕЛЬНЫЕ ПАРАМЕТРЫ:"
    echo "  --master-ip <IP>    IP адрес master ноды k3s кластера"
    echo "  --token <TOKEN>      Токен для подключения к кластеру"
    echo ""
    echo "ОПЦИОНАЛЬНЫЕ ПАРАМЕТРЫ:"
    echo "  --node-name <NAME>   Имя ноды в кластере (по умолчанию: hostname)"
    echo "  --node-ip <IP>      IP адрес текущей ноды (по умолчанию: автоматически)"
    echo "  -h, --help          Показать эту справку"
    echo ""
    echo "ПРИМЕРЫ:"
    echo "  # Подключение к кластеру"
    echo "  $0 --master-ip 192.168.1.100 --token K10abc123..."
    echo ""
    echo "  # С указанием имени ноды"
    echo "  $0 --master-ip 192.168.1.100 --token K10abc123... --node-name canton-validator-2"
    echo ""
    echo "ПОЛУЧЕНИЕ ТОКЕНА:"
    echo "  На master ноде выполните:"
    echo "    sudo cat /var/lib/rancher/k3s/server/node-token"
    echo ""
}

# Парсинг аргументов
while [[ $# -gt 0 ]]; do
    case $1 in
        --master-ip)
            MASTER_IP="$2"
            shift 2
            ;;
        --token)
            K3S_TOKEN="$2"
            shift 2
            ;;
        --node-name)
            NODE_NAME="$2"
            shift 2
            ;;
        --node-ip)
            NODE_IP="$2"
            shift 2
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Неизвестный параметр: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Проверка обязательных параметров
if [ -z "$MASTER_IP" ] || [ -z "$K3S_TOKEN" ]; then
    print_error "Не указаны обязательные параметры!"
    echo ""
    show_usage
    exit 1
fi

echo -e "${BLUE}🚀 Подключение сервера к k3s кластеру${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""
print_info "Master IP: $MASTER_IP"
print_info "Node Name: ${NODE_NAME:-$(hostname)}"
print_info "Node IP: ${NODE_IP:-автоматически}"
echo ""

# Определение имени ноды
if [ -z "$NODE_NAME" ]; then
    NODE_NAME=$(hostname)
fi

print_info "Проверка текущего состояния k3s..."

# Проверка, не установлен ли уже k3s
if systemctl is-active --quiet k3s-agent 2>/dev/null || systemctl is-active --quiet k3s 2>/dev/null; then
    print_warning "k3s уже установлен и запущен на этом сервере"
    read -p "Продолжить переустановку? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Отменено пользователем"
        exit 0
    fi
    
    print_info "Остановка существующего k3s..."
    sudo systemctl stop k3s-agent 2>/dev/null || sudo systemctl stop k3s 2>/dev/null || true
    sudo /usr/local/bin/k3s-agent-uninstall.sh 2>/dev/null || sudo /usr/local/bin/k3s-uninstall.sh 2>/dev/null || true
fi

# Установка k3s agent
print_info "Установка k3s agent..."

# Определение URL для установки
INSTALL_URL="https://get.k3s.io"

# Подготовка команды установки
INSTALL_CMD="curl -sfL $INSTALL_URL | INSTALL_K3S_VERSION=latest sh -s - agent"

# Добавление параметров подключения
INSTALL_CMD="$INSTALL_CMD --server https://${MASTER_IP}:6443"
INSTALL_CMD="$INSTALL_CMD --token ${K3S_TOKEN}"

# Добавление имени ноды если указано
if [ -n "$NODE_NAME" ]; then
    INSTALL_CMD="$INSTALL_CMD --node-name ${NODE_NAME}"
fi

# Добавление IP ноды если указан
if [ -n "$NODE_IP" ]; then
    INSTALL_CMD="$INSTALL_CMD --node-ip ${NODE_IP}"
fi

print_info "Выполнение установки..."
print_warning "Требуются права sudo для установки k3s"
echo ""

# Выполнение установки
eval "sudo $INSTALL_CMD"

# Ожидание запуска сервиса
print_info "Ожидание запуска k3s agent..."
sleep 5

# Проверка статуса
if systemctl is-active --quiet k3s-agent; then
    print_status "k3s agent успешно запущен!"
else
    print_error "Не удалось запустить k3s agent"
    print_info "Проверка логов:"
    sudo journalctl -u k3s-agent --no-pager -n 50
    exit 1
fi

# Проверка подключения к кластеру
print_info "Проверка подключения к кластеру..."
sleep 3

if sudo k3s kubectl get nodes 2>/dev/null | grep -q "$NODE_NAME"; then
    print_status "Нода успешно подключена к кластеру!"
    echo ""
    print_info "Текущие ноды в кластере:"
    sudo k3s kubectl get nodes
else
    print_warning "Нода может еще не отобразиться в списке (может потребоваться время)"
    print_info "Проверьте на master ноде: kubectl get nodes"
fi

echo ""
print_status "Установка завершена!"
echo ""
print_info "Полезные команды:"
echo "  • Проверить статус: sudo systemctl status k3s-agent"
echo "  • Просмотреть логи: sudo journalctl -u k3s-agent -f"
echo "  • Проверить ноды: sudo k3s kubectl get nodes"
echo ""
print_warning "Для управления кластером с этой ноды используйте kubeconfig с master ноды"
print_info "Скопируйте ~/.kube/config с master ноды для доступа к кластеру"

