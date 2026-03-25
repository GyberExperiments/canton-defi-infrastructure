#!/bin/bash

# 🚀 Скрипт для подключения ноды 65.108.15.30 к k3s кластеру
# Выполните НА СЕРВЕРЕ 65.108.15.30

set -e

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

MASTER_IP="31.129.105.180"
NODE_IP="65.108.15.30"

echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}🚀 Подключение ноды к k3s кластеру${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}IP ноды: $NODE_IP${NC}"
echo -e "${YELLOW}Master IP: $MASTER_IP${NC}"
echo ""

# Проверка, что скрипт запущен на правильном сервере
CURRENT_IP=$(hostname -I | awk '{print $1}' || ip addr show | grep -oP 'inet \K[\d.]+' | grep -v '127.0.0.1' | head -1)
if ! echo "$CURRENT_IP" | grep -q "65.108.15.30"; then
    echo -e "${YELLOW}⚠️  Внимание: Текущий IP ($CURRENT_IP) не соответствует ожидаемому (65.108.15.30)${NC}"
    read -p "Продолжить? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Получение hostname
NODE_NAME=$(hostname)
echo -e "${BLUE}Hostname ноды: $NODE_NAME${NC}"
echo ""

# Запрос токена
echo -e "${YELLOW}Для получения токена выполните на master ноде (31.129.105.180):${NC}"
echo "  ssh root@31.129.105.180"
echo "  sudo cat /var/lib/rancher/k3s/server/node-token"
echo ""
read -p "Введите токен k3s: " K3S_TOKEN

if [ -z "$K3S_TOKEN" ]; then
    echo -e "${RED}❌ Токен не может быть пустым${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}📋 Параметры подключения:${NC}"
echo "  Master IP: $MASTER_IP"
echo "  Node IP: $NODE_IP"
echo "  Node Name: $NODE_NAME"
echo "  Token: ${K3S_TOKEN:0:10}..."
echo ""

# Проверка наличия k3s
if command -v k3s &> /dev/null; then
    echo -e "${YELLOW}⚠️  k3s уже установлен. Удаляю старую версию...${NC}"
    /usr/local/bin/k3s-agent-uninstall.sh 2>/dev/null || /usr/local/bin/k3s-uninstall.sh 2>/dev/null || true
    sleep 2
fi

# Подключение к кластеру
echo -e "${BLUE}📦 Установка и подключение k3s agent...${NC}"
echo ""

curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=latest sh -s - agent \
    --server https://${MASTER_IP}:6443 \
    --token ${K3S_TOKEN} \
    --node-name ${NODE_NAME} \
    --node-ip ${NODE_IP}

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ k3s agent установлен и подключен!${NC}"
    echo ""
    
    # Проверка подключения
    sleep 5
    echo -e "${BLUE}🔍 Проверка подключения...${NC}"
    
    if sudo k3s kubectl get nodes 2>/dev/null | grep -q "$NODE_NAME"; then
        echo -e "${GREEN}✅ Нода успешно подключена к кластеру!${NC}"
        echo ""
        echo -e "${BLUE}Информация о ноде:${NC}"
        sudo k3s kubectl get nodes -o wide | grep "$NODE_NAME"
        echo ""
        echo -e "${GREEN}📝 Hostname ноды для манифеста: $NODE_NAME${NC}"
        echo ""
        echo -e "${YELLOW}Следующие шаги:${NC}"
        echo "1. На локальной машине выполните:"
        echo "   cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc"
        echo "   kubectl get nodes -o wide"
        echo "2. Обновите манифест:"
        echo "   cd blockchain/scripts"
        echo "   ./update-node-hostname.sh $NODE_NAME"
        echo "3. Разверните валидатора:"
        echo "   cd ../../config/kubernetes/k8s"
        echo "   kubectl apply -f canton-validator-new-node.yaml"
    else
        echo -e "${YELLOW}⚠️  Нода установлена, но проверка через kubectl не прошла${NC}"
        echo "Проверьте логи: sudo journalctl -u k3s-agent -f"
    fi
else
    echo ""
    echo -e "${RED}❌ Ошибка при установке k3s agent${NC}"
    echo "Проверьте:"
    echo "  - Доступность master ноды: ping $MASTER_IP"
    echo "  - Правильность токена"
    echo "  - Логи: journalctl -u k3s-agent -n 50"
    exit 1
fi


















