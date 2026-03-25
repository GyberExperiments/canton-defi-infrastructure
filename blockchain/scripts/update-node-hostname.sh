#!/bin/bash

# 🔧 Скрипт для обновления hostname ноды в манифесте StatefulSet

set -e

# Цвета
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Определение файла манифеста
if [ -z "$1" ]; then
    echo "Usage: $0 <NODE_HOSTNAME> [testnet|devnet|mainnet]"
    echo ""
    echo "Пример:"
    echo "  $0 my-node-name           # Devnet (по умолчанию)"
    echo "  $0 my-node-name testnet   # Testnet"
    echo ""
    echo "Для получения hostname выполните на master ноде:"
    echo "  kubectl get nodes"
    exit 1
fi

NODE_HOSTNAME="$1"
NETWORK="${2:-devnet}"

case "$NETWORK" in
    testnet)
        MANIFEST_FILE="$PROJECT_ROOT/config/kubernetes/k8s/canton-validator-testnet.yaml"
        ;;
    devnet)
        MANIFEST_FILE="$PROJECT_ROOT/config/kubernetes/k8s/canton-validator-new-node.yaml"
        ;;
    mainnet)
        MANIFEST_FILE="$PROJECT_ROOT/config/kubernetes/k8s/canton-validator-mainnet.yaml"
        ;;
    *)
        echo "❌ Неизвестная сеть: $NETWORK"
        echo "Используйте: testnet, devnet или mainnet"
        exit 1
        ;;
esac

echo -e "${BLUE}🔧 Обновление hostname ноды в манифесте${NC}"
echo -e "${BLUE}==========================================${NC}"
echo ""
echo "Hostname: $NODE_HOSTNAME"
echo "Сеть: $NETWORK"
echo "Файл: $MANIFEST_FILE"
echo ""

# Создание резервной копии
cp "$MANIFEST_FILE" "${MANIFEST_FILE}.backup"
echo "✅ Резервная копия создана: ${MANIFEST_FILE}.backup"

# Обновление hostname в манифесте
sed -i.tmp "s/kubernetes.io\/hostname: \"\"/kubernetes.io\/hostname: \"$NODE_HOSTNAME\"/" "$MANIFEST_FILE"
rm -f "${MANIFEST_FILE}.tmp"

echo -e "${GREEN}✅ Hostname обновлен в манифесте${NC}"
echo ""
echo "Теперь вы можете применить манифест:"
echo "  kubectl apply -f $MANIFEST_FILE"

