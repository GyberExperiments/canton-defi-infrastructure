#!/bin/bash

# 🚀 Полный скрипт развертывания Canton Validator на новом сервере
# Автоматизирует процесс подключения к k3s и развертывания валидатора

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Конфигурация
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
BLOCKCHAIN_DIR="$PROJECT_ROOT/blockchain"
CONFIG_DIR="$BLOCKCHAIN_DIR/config"
K8S_CONFIG_DIR="$PROJECT_ROOT/config/kubernetes/k8s"

# Параметры подключения
MASTER_IP="${MASTER_IP:-}"
K3S_TOKEN="${K3S_TOKEN:-}"
NODE_NAME="${NODE_NAME:-}"
NODE_IP="65.108.15.30"  # IP нового сервера для валидатора

# Параметры валидатора
CANTON_NETWORK="${CANTON_NETWORK:-devnet}"
VALIDATOR_NAME="${VALIDATOR_NAME:-gyber-validator}"

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
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "ОПЦИИ:"
    echo "  --master-ip <IP>      IP адрес master ноды k3s кластера"
    echo "  --token <TOKEN>       Токен для подключения к k3s кластеру"
    echo "  --node-name <NAME>    Имя ноды в кластере (по умолчанию: hostname)"
    echo "  --network <NETWORK>   Canton сеть: devnet, testnet, mainnet (по умолчанию: devnet)"
    echo "  --skip-join           Пропустить подключение к k3s (нода уже подключена)"
    echo "  --skip-onboarding     Пропустить получение onboarding secret"
    echo "  -h, --help            Показать эту справку"
    echo ""
    echo "ПРИМЕРЫ:"
    echo "  # Полное развертывание на новом сервере"
    echo "  $0 --master-ip 192.168.1.100 --token K10abc123..."
    echo ""
    echo "  # Только развертывание валидатора (нода уже в кластере)"
    echo "  $0 --skip-join --network devnet"
}

# Парсинг аргументов
SKIP_JOIN=false
SKIP_ONBOARDING=false

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
        --network)
            CANTON_NETWORK="$2"
            shift 2
            ;;
        --skip-join)
            SKIP_JOIN=true
            shift
            ;;
        --skip-onboarding)
            SKIP_ONBOARDING=true
            shift
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

echo -e "${BLUE}🚀 Развертывание Canton Validator на новом сервере${NC}"
echo -e "${BLUE}====================================================${NC}"
echo ""
print_info "Node IP: $NODE_IP"
print_info "Network: $CANTON_NETWORK"
print_info "Validator Name: $VALIDATOR_NAME"
echo ""

# Шаг 1: Подключение к k3s кластеру
if [ "$SKIP_JOIN" = false ]; then
    if [ -z "$MASTER_IP" ] || [ -z "$K3S_TOKEN" ]; then
        print_error "Для подключения к кластеру требуются --master-ip и --token"
        echo ""
        print_info "Получение токена на master ноде:"
        echo "  sudo cat /var/lib/rancher/k3s/server/node-token"
        echo ""
        show_usage
        exit 1
    fi
    
    print_info "Шаг 1: Подключение к k3s кластеру..."
    "$SCRIPT_DIR/join-k3s-cluster.sh" \
        --master-ip "$MASTER_IP" \
        --token "$K3S_TOKEN" \
        --node-name "${NODE_NAME:-$(hostname)}" \
        --node-ip "$NODE_IP" || {
        print_error "Не удалось подключиться к кластеру"
        exit 1
    }
    
    print_status "Шаг 1 завершен: нода подключена к кластеру"
    echo ""
else
    print_info "Пропускаем подключение к k3s (--skip-join)"
    echo ""
fi

# Определение имени ноды для использования в манифестах
if [ -z "$NODE_NAME" ]; then
    NODE_NAME=$(hostname)
fi

# Шаг 2: Получение onboarding secret
ONBOARDING_SECRET=""
if [ "$SKIP_ONBOARDING" = false ]; then
    print_info "Шаг 2: Получение onboarding secret для $CANTON_NETWORK..."
    
    ONBOARDING_SECRET=$("$SCRIPT_DIR/get-onboarding-secret.sh" "$CANTON_NETWORK" --save)
    
    if [ -z "$ONBOARDING_SECRET" ]; then
        print_error "Не удалось получить onboarding secret"
        exit 1
    fi
    
    print_status "Шаг 2 завершен: onboarding secret получен"
    echo ""
else
    print_info "Пропускаем получение onboarding secret (--skip-onboarding)"
    print_warning "Убедитесь, что secret уже создан в Kubernetes"
    echo ""
fi

# Шаг 3: Создание namespace (если не существует)
print_info "Шаг 3: Создание namespace и базовых ресурсов..."

# Проверка доступности kubectl
if ! command -v kubectl &> /dev/null && ! sudo k3s kubectl version &> /dev/null; then
    print_error "kubectl не доступен. Убедитесь, что нода подключена к кластеру."
    exit 1
fi

# Определение команды kubectl
KUBECTL_CMD="kubectl"
if ! command -v kubectl &> /dev/null; then
    KUBECTL_CMD="sudo k3s kubectl"
    print_info "Используется k3s kubectl"
fi

# Создание namespace
$KUBECTL_CMD apply -f "$K8S_CONFIG_DIR/canton-namespace.yaml" || {
    print_warning "Namespace может уже существовать, продолжаем..."
}

# Шаг 4: Создание ConfigMap с конфигурацией
print_info "Шаг 4: Создание ConfigMap с конфигурацией Canton..."

# Создание ConfigMap из файлов
$KUBECTL_CMD create configmap canton-config \
    --namespace=canton-node \
    --from-file="$CONFIG_DIR/canton.conf" \
    --from-file="$CONFIG_DIR/validator.conf" \
    --dry-run=client -o yaml | $KUBECTL_CMD apply -f -

print_status "ConfigMap создан"

# Шаг 5: Создание Secret с onboarding secret
if [ -n "$ONBOARDING_SECRET" ]; then
    print_info "Шаг 5: Создание Secret с onboarding secret..."
    
    # Кодирование в base64
    ONBOARDING_SECRET_B64=$(echo -n "$ONBOARDING_SECRET" | base64 -w 0 2>/dev/null || echo -n "$ONBOARDING_SECRET" | base64)
    
    $KUBECTL_CMD create secret generic canton-onboarding \
        --namespace=canton-node \
        --from-literal=ONBOARDING_SECRET="$ONBOARDING_SECRET" \
        --dry-run=client -o yaml | $KUBECTL_CMD apply -f -
    
    print_status "Secret создан"
else
    print_warning "Пропускаем создание Secret (onboarding secret не получен)"
fi

# Шаг 6: Создание Secret для GHCR (если нужно)
print_info "Шаг 6: Проверка Secret для GHCR..."
if ! $KUBECTL_CMD get secret ghcr-creds -n canton-node &> /dev/null; then
    print_warning "Secret ghcr-creds не найден. Создайте его вручную:"
    echo "  kubectl create secret docker-registry ghcr-creds \\"
    echo "    --docker-server=ghcr.io \\"
    echo "    --docker-username=<USERNAME> \\"
    echo "    --docker-password=<TOKEN> \\"
    echo "    --namespace=canton-node"
    echo ""
    read -p "Продолжить без GHCR secret? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    print_status "GHCR secret найден"
fi

# Шаг 7: Обновление StatefulSet с правильным hostname
print_info "Шаг 7: Подготовка StatefulSet для новой ноды..."

# Обновление hostname в манифесте
TEMP_MANIFEST=$(mktemp)
sed "s/kubernetes.io\/hostname: \"\"/kubernetes.io\/hostname: \"$NODE_NAME\"/" \
    "$K8S_CONFIG_DIR/canton-validator-new-node.yaml" > "$TEMP_MANIFEST"

# Шаг 8: Развертывание StatefulSet
print_info "Шаг 8: Развертывание Canton Validator StatefulSet..."

$KUBECTL_CMD apply -f "$TEMP_MANIFEST"

# Ожидание запуска пода
print_info "Ожидание запуска Canton Validator..."
sleep 10

# Проверка статуса
POD_NAME=$($KUBECTL_CMD get pods -n canton-node -l app=canton-node,node=new-validator -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

if [ -n "$POD_NAME" ]; then
    print_status "Pod создан: $POD_NAME"
    echo ""
    print_info "Статус пода:"
    $KUBECTL_CMD get pod "$POD_NAME" -n canton-node
    echo ""
    print_info "Логи пода (последние 20 строк):"
    $KUBECTL_CMD logs "$POD_NAME" -n canton-node --tail=20 || true
else
    print_warning "Pod еще не создан или не найден"
fi

# Шаг 9: Проверка health endpoint
print_info "Шаг 9: Проверка health endpoint..."
sleep 5

HEALTH_URL="http://${NODE_IP}:8081/health"
if curl -f -s "$HEALTH_URL" > /dev/null; then
    print_status "Health check успешен: $HEALTH_URL"
else
    print_warning "Health check не прошел (возможно, валидатор еще запускается)"
    print_info "Проверьте позже: curl $HEALTH_URL"
fi

# Итоговая информация
echo ""
echo -e "${BLUE}====================================================${NC}"
print_status "Развертывание завершено!"
echo ""
print_info "Информация о развертывании:"
echo "  • Node IP: $NODE_IP"
echo "  • Node Name: $NODE_NAME"
echo "  • Network: $CANTON_NETWORK"
echo "  • Health URL: http://${NODE_IP}:8081/health"
echo "  • Metrics URL: http://${NODE_IP}:8080/metrics"
echo "  • Admin URL: http://${NODE_IP}:8082/admin"
echo ""
print_info "Полезные команды:"
echo "  • Проверить статус: kubectl get pods -n canton-node"
echo "  • Просмотреть логи: kubectl logs -f -n canton-node -l app=canton-node,node=new-validator"
echo "  • Проверить health: curl http://${NODE_IP}:8081/health"
echo ""
print_warning "Важно:"
echo "  • Убедитесь, что порты 8080, 8081, 8082, 6865 открыты в firewall"
echo "  • Проверьте, что IP $NODE_IP добавлен в whitelist Canton Network"
echo "  • Мониторьте логи валидатора на предмет ошибок подключения"

# Очистка временных файлов
rm -f "$TEMP_MANIFEST"

