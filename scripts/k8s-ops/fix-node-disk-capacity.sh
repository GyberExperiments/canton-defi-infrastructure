#!/bin/bash
# Скрипт для исправления проблемы InvalidDiskCapacity на узле Kubernetes

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TARGET_NODE="canton-node-65-108-15-30"

echo -e "${BLUE}🔧 ИСПРАВЛЕНИЕ ПРОБЛЕМЫ InvalidDiskCapacity${NC}"
echo "=========================================="
echo ""

# Проверка доступности кластера
if ! kubectl cluster-info &>/dev/null; then
    echo -e "${RED}❌ Кластер недоступен${NC}"
    exit 1
fi

# Проверка существования узла
if ! kubectl get node "$TARGET_NODE" &>/dev/null; then
    echo -e "${RED}❌ Узел $TARGET_NODE не найден${NC}"
    exit 1
fi

echo -e "${BLUE}Проверка текущего состояния узла...${NC}"
kubectl describe node "$TARGET_NODE" | grep -i "invalid\|disk\|capacity" || echo "Предупреждений не найдено в выводе describe"
echo ""

# Получение IP узла для SSH подключения
NODE_IP=$(kubectl get node "$TARGET_NODE" -o jsonpath='{.status.addresses[?(@.type=="InternalIP")].address}' 2>/dev/null || echo "")
if [ -z "$NODE_IP" ]; then
    echo -e "${YELLOW}⚠️  Не удалось получить IP узла для SSH${NC}"
    echo "Проблема InvalidDiskCapacity обычно связана с:"
    echo "1. Проблемами с файловой системой контейнеров"
    echo "2. Неправильной настройкой kubelet"
    echo "3. Проблемами с дисковым пространством"
    echo ""
    echo "Рекомендации:"
    echo "1. Проверьте логи kubelet на узле: journalctl -u k3s-agent -n 100"
    echo "2. Проверьте доступное дисковое пространство: df -h"
    echo "3. Перезапустите kubelet: systemctl restart k3s-agent"
    exit 0
fi

echo -e "${BLUE}IP узла: $NODE_IP${NC}"
echo ""
echo -e "${YELLOW}⚠️  Для исправления проблемы InvalidDiskCapacity требуется доступ к узлу${NC}"
echo ""
echo "Возможные решения:"
echo ""
echo "1. Проверка дискового пространства:"
echo "   ssh root@$NODE_IP 'df -h'"
echo ""
echo "2. Проверка файловой системы контейнеров:"
echo "   ssh root@$NODE_IP 'du -sh /var/lib/rancher/k3s/storage/* 2>/dev/null | head -20'"
echo ""
echo "3. Очистка неиспользуемых образов и контейнеров:"
echo "   ssh root@$NODE_IP 'k3s crictl rmi --prune'"
echo ""
echo "4. Перезапуск kubelet:"
echo "   ssh root@$NODE_IP 'systemctl restart k3s-agent'"
echo ""
echo "5. Проверка настроек kubelet:"
echo "   ssh root@$NODE_IP 'cat /var/lib/rancher/k3s/agent/etc/kubelet/config.yaml | grep -i image'"
echo ""

# Попытка исправить через kubectl (если возможно)
echo -e "${BLUE}Попытка исправления через Kubernetes API...${NC}"

# Проверка и обновление условий узла
echo "Проверка условий узла..."
kubectl get node "$TARGET_NODE" -o jsonpath='{.status.conditions[*].type}' | tr ' ' '\n' | while read condition; do
    if [ -n "$condition" ]; then
        STATUS=$(kubectl get node "$TARGET_NODE" -o jsonpath="{.status.conditions[?(@.type==\"$condition\")].status}")
        echo "  $condition: $STATUS"
    fi
done
echo ""

# Предупреждение о необходимости ручного вмешательства
echo -e "${YELLOW}⚠️  ВНИМАНИЕ:${NC}"
echo "Проблема InvalidDiskCapacity обычно требует доступа к узлу для исправления."
echo "Это предупреждение может не блокировать планирование подов, но рекомендуется исправить."
echo ""
echo "Для автоматического исправления выполните на узле:"
echo "  ssh root@$NODE_IP"
echo "  systemctl restart k3s-agent"
echo "  k3s crictl rmi --prune  # Очистка неиспользуемых образов"
echo ""
