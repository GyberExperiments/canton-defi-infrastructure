#!/bin/bash
# 🚀 Полная команда для подключения сервера и развертывания
# Выполните на сервере 65.108.15.30

set -e

MASTER_IP="31.129.105.180"
NODE_IP="65.108.15.30"

echo "🚀 Подключение сервера $NODE_IP к k3s кластеру"
echo "=============================================="
echo ""
echo "⚠️  Вам нужен токен k3s от master ноды"
echo ""
echo "Получите токен выполнив на master ноде ($MASTER_IP):"
echo "  ssh root@$MASTER_IP 'sudo cat /var/lib/rancher/k3s/server/node-token'"
echo ""
read -p "Введите токен k3s: " K3S_TOKEN

if [ -z "$K3S_TOKEN" ]; then
    echo "❌ Токен не может быть пустым"
    exit 1
fi

NODE_NAME=$(hostname)

echo ""
echo "📋 Параметры подключения:"
echo "  Master IP: $MASTER_IP"
echo "  Node IP: $NODE_IP"
echo "  Node Name: $NODE_NAME"
echo ""

# Подключение к кластеру
echo "📦 Подключение к k3s кластеру..."
curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=latest sh -s - agent \
    --server https://${MASTER_IP}:6443 \
    --token ${K3S_TOKEN} \
    --node-name ${NODE_NAME} \
    --node-ip ${NODE_IP}

echo ""
echo "✅ Сервер подключен!"
echo ""
echo "📝 Сообщите hostname ($NODE_NAME) для обновления манифеста"
echo "Затем выполните на машине с kubectl:"
echo "  cd /path/to/canton-otc/blockchain/scripts"
echo "  ./update-node-hostname.sh $NODE_NAME"
echo "  kubectl apply -f ../../config/kubernetes/k8s/canton-validator-new-node.yaml"

