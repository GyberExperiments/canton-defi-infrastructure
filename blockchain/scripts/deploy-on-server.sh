#!/bin/bash
# 🚀 Скрипт для выполнения на новом сервере (65.108.15.30)
# Подключает сервер к k3s и разворачивает валидатора

set -e

echo "🚀 Развертывание Canton Validator на сервере 65.108.15.30"
echo "========================================================"
echo ""

# Параметры подключения (замените на реальные)
MASTER_IP="${MASTER_IP:-31.129.105.180}"  # IP master ноды из kubectl get nodes
K3S_TOKEN="${K3S_TOKEN:-}"  # Получите на master: sudo cat /var/lib/rancher/k3s/server/node-token

if [ -z "$K3S_TOKEN" ]; then
    echo "❌ Ошибка: K3S_TOKEN не установлен"
    echo ""
    echo "Получите токен на master ноде (31.129.105.180):"
    echo "  sudo cat /var/lib/rancher/k3s/server/node-token"
    echo ""
    echo "Затем запустите:"
    echo "  export K3S_TOKEN='<токен>'"
    echo "  $0"
    exit 1
fi

# Определение hostname
NODE_NAME=$(hostname)
NODE_IP="65.108.15.30"

echo "📋 Параметры:"
echo "  Master IP: $MASTER_IP"
echo "  Node IP: $NODE_IP"
echo "  Node Name: $NODE_NAME"
echo ""

# Проверка установки k3s
if systemctl is-active --quiet k3s-agent 2>/dev/null; then
    echo "⚠️  k3s agent уже запущен"
    echo "Пропускаем подключение к кластеру"
else
    echo "📦 Установка и подключение к k3s кластеру..."
    
    curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=latest sh -s - agent \
        --server https://${MASTER_IP}:6443 \
        --token ${K3S_TOKEN} \
        --node-name ${NODE_NAME} \
        --node-ip ${NODE_IP}
    
    echo "✅ k3s agent установлен и запущен"
fi

echo ""
echo "✅ Сервер подключен к кластеру!"
echo ""
echo "📝 Следующие шаги:"
echo "1. На машине с kubectl выполните:"
echo "   kubectl get nodes"
echo "   (должна появиться нода $NODE_NAME)"
echo ""
echo "2. Обновите hostname в манифесте:"
echo "   cd /path/to/canton-otc/blockchain/scripts"
echo "   ./update-node-hostname.sh $NODE_NAME"
echo ""
echo "3. Разверните валидатора:"
echo "   kubectl apply -f ../config/kubernetes/k8s/canton-validator-new-node.yaml"
echo ""

