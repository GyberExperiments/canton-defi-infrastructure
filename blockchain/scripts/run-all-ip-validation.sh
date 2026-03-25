#!/bin/bash

# Универсальный скрипт для запуска проверки всех IP адресов
# Поддерживает запуск через SSH или kubectl

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   Проверка валидации IP адресов Testnet и Mainnet             ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Цвета
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Функция проверки через SSH
run_ssh_validation() {
    local IP=$1
    local NETWORK=$2
    local SCRIPT=$3
    
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Проверка $NETWORK (IP: $IP) через SSH${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    # Копируем скрипт на сервер
    echo "📤 Копирование скрипта на сервер $IP..."
    if scp -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$SCRIPT" "root@$IP:/tmp/validate-ip.sh" 2>/dev/null; then
        echo -e "${GREEN}✅ Скрипт скопирован${NC}"
        echo ""
        
        # Запускаем проверку
        echo "🚀 Запуск проверки..."
        ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no "root@$IP" "bash /tmp/validate-ip.sh" 2>&1
        echo ""
    else
        echo -e "${RED}❌ Не удалось подключиться к серверу $IP${NC}"
        echo -e "${YELLOW}⚠️  Возможные причины:${NC}"
        echo "   - Сервер недоступен"
        echo "   - SSH не настроен"
        echo "   - Firewall блокирует подключение"
        echo ""
        return 1
    fi
}

# Функция проверки через kubectl
run_kubectl_validation() {
    local NETWORK=$1
    local MANIFEST=$2
    
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Проверка $NETWORK через kubectl Job${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    # Удаляем предыдущий Job
    JOB_NAME=$(grep "name:" "$MANIFEST" | head -1 | awk '{print $2}')
    echo "🗑️  Удаление предыдущего Job (если есть)..."
    kubectl delete job "$JOB_NAME" -n default --ignore-not-found=true 2>&1 | grep -v "NotFound" || true
    echo ""
    
    # Применяем манифест
    echo "📋 Применение манифеста..."
    if kubectl apply -f "$MANIFEST" 2>&1; then
        echo -e "${GREEN}✅ Job создан${NC}"
        echo ""
        
        # Ждем запуска Pod
        echo "⏳ Ожидание запуска Pod..."
        sleep 3
        
        # Получаем логи
        echo "📊 Результаты проверки:"
        echo ""
        kubectl logs -l job-name="$JOB_NAME" -n default --tail=200 2>&1 || {
            echo -e "${YELLOW}⚠️  Pod еще не запустился, попробуйте позже:${NC}"
            echo "   kubectl logs -l job-name=$JOB_NAME -n default -f"
        }
        echo ""
    else
        echo -e "${RED}❌ Не удалось создать Job${NC}"
        echo -e "${YELLOW}⚠️  Проверьте:${NC}"
        echo "   - Нода подключена к кластеру"
        echo "   - Правильный hostname в манифесте"
        echo ""
        return 1
    fi
}

# Проверка доступности kubectl
check_kubectl() {
    if command -v kubectl &> /dev/null; then
        if kubectl cluster-info &> /dev/null; then
            return 0
        fi
    fi
    return 1
}

# Проверка доступности SSH
check_ssh() {
    if command -v ssh &> /dev/null && command -v scp &> /dev/null; then
        return 0
    fi
    return 1
}

# Главная функция
main() {
    cd "$PROJECT_ROOT"
    
    # Проверяем доступность инструментов
    HAS_KUBECTL=false
    HAS_SSH=false
    
    if check_kubectl; then
        HAS_KUBECTL=true
        echo -e "${GREEN}✅ kubectl доступен${NC}"
    else
        echo -e "${YELLOW}⚠️  kubectl недоступен${NC}"
    fi
    
    if check_ssh; then
        HAS_SSH=true
        echo -e "${GREEN}✅ SSH доступен${NC}"
    else
        echo -e "${YELLOW}⚠️  SSH недоступен${NC}"
    fi
    echo ""
    
    if [ "$HAS_KUBECTL" = false ] && [ "$HAS_SSH" = false ]; then
        echo -e "${RED}❌ Недоступны ни kubectl, ни SSH${NC}"
        echo "Установите один из инструментов для запуска проверки"
        exit 1
    fi
    
    # Проверка Testnet
    echo ""
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                    TESTNET (65.108.15.20)                      ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    
    TESTNET_SUCCESS=false
    
    # Пробуем через kubectl
    if [ "$HAS_KUBECTL" = true ]; then
        # Проверяем, подключена ли нода
        if kubectl get nodes -o wide 2>/dev/null | grep -q "65.108.15.20"; then
            run_kubectl_validation "Testnet" "$PROJECT_ROOT/blockchain/k8s/ip-validation-testnet.yaml" && TESTNET_SUCCESS=true
        else
            echo -e "${YELLOW}⚠️  Нода Testnet не подключена к кластеру${NC}"
            echo ""
        fi
    fi
    
    # Если kubectl не сработал, пробуем SSH
    if [ "$TESTNET_SUCCESS" = false ] && [ "$HAS_SSH" = true ]; then
        run_ssh_validation "65.108.15.20" "Testnet" "$PROJECT_ROOT/blockchain/scripts/validate-testnet-ip.sh"
    fi
    
    # Проверка Mainnet
    echo ""
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                    MAINNET (65.108.15.19)                      ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    
    MAINNET_SUCCESS=false
    
    # Пробуем через kubectl
    if [ "$HAS_KUBECTL" = true ]; then
        # Проверяем, подключена ли нода
        if kubectl get nodes -o wide 2>/dev/null | grep -q "65.108.15.19"; then
            run_kubectl_validation "Mainnet" "$PROJECT_ROOT/blockchain/k8s/ip-validation-mainnet.yaml" && MAINNET_SUCCESS=true
        else
            echo -e "${YELLOW}⚠️  Нода Mainnet не подключена к кластеру${NC}"
            echo ""
        fi
    fi
    
    # Если kubectl не сработал, пробуем SSH
    if [ "$MAINNET_SUCCESS" = false ] && [ "$HAS_SSH" = true ]; then
        run_ssh_validation "65.108.15.19" "Mainnet" "$PROJECT_ROOT/blockchain/scripts/validate-mainnet-ip.sh"
    fi
    
    # Итоги
    echo ""
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                        ИТОГИ                                   ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "Для просмотра результатов:"
    echo ""
    
    if [ "$HAS_KUBECTL" = true ]; then
        echo "📋 Через kubectl:"
        echo "   kubectl logs -l job-name=ip-validation-checker-testnet -n default"
        echo "   kubectl logs -l job-name=ip-validation-checker-mainnet -n default"
        echo ""
    fi
    
    if [ "$HAS_SSH" = true ]; then
        echo "📋 Через SSH (если проверка не запустилась автоматически):"
        echo "   scp blockchain/scripts/validate-testnet-ip.sh root@65.108.15.20:/tmp/ && \\"
        echo "   ssh root@65.108.15.20 'bash /tmp/validate-testnet-ip.sh'"
        echo ""
        echo "   scp blockchain/scripts/validate-mainnet-ip.sh root@65.108.15.19:/tmp/ && \\"
        echo "   ssh root@65.108.15.19 'bash /tmp/validate-mainnet-ip.sh'"
        echo ""
    fi
}

# Запуск
main "$@"





