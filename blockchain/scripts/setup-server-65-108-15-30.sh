#!/bin/bash

# 🚀 Полная настройка сервера 65.108.15.30
# 1. Установка Ubuntu
# 2. Подключение к k3s кластеру
# Выполните НА СЕРВЕРЕ 65.108.15.30 в Rescue System

set -e

MASTER_IP="31.129.105.180"
NODE_IP="65.108.15.30"

echo "🚀 Настройка сервера $NODE_IP"
echo "=========================================="
echo ""

# Проверка что мы в Rescue System
if [ ! -f /root/.oldroot/nfs/install/installimage ]; then
    echo "⚠️  Похоже, что мы не в Rescue System"
    echo "Продолжаем установку k3s..."
else
    echo "📋 Обнаружен Rescue System"
    echo "⚠️  ВАЖНО: Сначала нужно установить ОС!"
    echo ""
    echo "Выполните:"
    echo "  installimage"
    echo ""
    echo "Или используйте автоматическую установку Ubuntu:"
    read -p "Установить Ubuntu автоматически? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "📦 Установка Ubuntu 24.04..."
        installimage -a -n "ubuntu-2404" -r yes -l 0 -p /boot:ext4:1G,/:ext4:all -i /root/.oldroot/nfs/install/../images/Ubuntu-2404-jammy-amd64-base.tar.gz
        echo "✅ Ubuntu установлен, перезагрузите сервер"
        exit 0
    fi
fi

# Если ОС уже установлена, продолжаем с установкой k3s
echo "📦 Установка k3s agent..."

# Получение токена
echo ""
echo "⚠️  Получите токен k3s:"
echo "   ssh root@$MASTER_IP 'sudo cat /var/lib/rancher/k3s/server/node-token'"
echo ""
read -p "Введите токен k3s: " K3S_TOKEN

if [ -z "$K3S_TOKEN" ]; then
    echo "❌ Токен не может быть пустым"
    exit 1
fi

NODE_NAME=$(hostname)

# Если hostname = "rescue", устанавливаем нормальный hostname
if [ "$NODE_NAME" = "rescue" ]; then
    echo "⚠️  Hostname = rescue, устанавливаю новый hostname..."
    NODE_NAME="canton-node-$(echo $NODE_IP | tr '.' '-')"
    hostnamectl set-hostname "$NODE_NAME" || echo "$NODE_NAME" > /etc/hostname
    echo "✅ Hostname установлен: $NODE_NAME"
fi

# Удаление старой версии k3s если есть
if [ -f /usr/local/bin/k3s-agent-uninstall.sh ]; then
    /usr/local/bin/k3s-agent-uninstall.sh 2>/dev/null || true
fi

# Установка зависимостей
echo "📦 Установка зависимостей..."
apt-get update -qq
apt-get install -y -qq curl wget

# Установка k3s с конкретной версией (избегаем latest)
echo "📦 Установка k3s..."
K3S_VERSION="v1.31.5+k3s1"  # Используем версию совместимую с master

curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION="$K3S_VERSION" sh -s - agent \
    --server https://${MASTER_IP}:6443 \
    --token ${K3S_TOKEN} \
    --node-name ${NODE_NAME} \
    --node-ip ${NODE_IP}

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ k3s agent установлен!"
    sleep 5
    
    echo ""
    echo "🔍 Проверка подключения:"
    if command -v k3s &> /dev/null; then
        k3s kubectl get nodes 2>/dev/null || echo "Проверка через kubectl на master ноде"
    fi
    
    echo ""
    echo "✅ Hostname ноды: $NODE_NAME"
    echo "✅ IP ноды: $NODE_IP"
    echo ""
    echo "📝 Следующие шаги на локальной машине:"
    echo "   kubectl get nodes -o wide"
    echo "   cd blockchain/scripts && ./update-node-hostname.sh $NODE_NAME"
    echo "   cd ../../config/kubernetes/k8s && kubectl apply -f canton-validator-new-node.yaml"
else
    echo ""
    echo "❌ Ошибка при установке k3s"
    echo "Проверьте:"
    echo "  - Доступность master ноды: ping $MASTER_IP"
    echo "  - Правильность токена"
    echo "  - Логи: journalctl -u k3s-agent -n 50"
    exit 1
fi

















