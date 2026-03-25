#!/bin/bash

# Скрипт для обновления onboarding secret в Kubernetes
# Использование: ./update-onboarding-secret.sh <network> [secret_value]

set -e

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

NETWORK="${1:-devnet}"
SECRET_VALUE="${2:-}"

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
SECRETS_FILE="$PROJECT_ROOT/blockchain/config/onboarding-secrets.env"

# Для Helm DevNet: namespace validator, secret с ключом "secret"
NS="${CANTON_NAMESPACE:-validator}"
case "$NETWORK" in
    devnet)
        SECRET_NAME="splice-app-validator-onboarding-validator"
        ENV_VAR="DEVNET_ONBOARDING_SECRET"
        ;;
    testnet)
        SECRET_NAME="splice-app-validator-onboarding-validator"
        ENV_VAR="TESTNET_ONBOARDING_SECRET"
        ;;
    mainnet)
        SECRET_NAME="splice-app-validator-onboarding-validator"
        ENV_VAR="MAINNET_ONBOARDING_SECRET"
        ;;
    *)
        print_error "Неизвестная сеть: $NETWORK"
        echo "Используйте: devnet, testnet или mainnet"
        exit 1
        ;;
esac

echo -e "${BLUE}🔐 Обновление onboarding secret для $NETWORK${NC}"
echo "=========================================="
echo ""

# Получение secret
if [ -z "$SECRET_VALUE" ]; then
    # Попытка получить из файла
    if [ -f "$SECRETS_FILE" ]; then
        SECRET_VALUE=$(grep "^${ENV_VAR}=" "$SECRETS_FILE" | cut -d'=' -f2 | tr -d '"' || echo "")
    fi
    
    # Если не найден в файле, попробовать получить через API
    if [ -z "$SECRET_VALUE" ]; then
        print_info "Secret не найден в файле, пытаюсь получить через API..."
        SECRET_VALUE=$("$SCRIPT_DIR/get-onboarding-secret.sh" "$NETWORK" 2>/dev/null || echo "")
    fi
    
    # Если все еще пустой, запросить у пользователя
    if [ -z "$SECRET_VALUE" ]; then
        print_warning "Secret не найден автоматически"
        read -p "Введите onboarding secret для $NETWORK: " SECRET_VALUE
    fi
fi

if [ -z "$SECRET_VALUE" ] || [ "$SECRET_VALUE" = "CHANGE_ME" ] || [ "$SECRET_VALUE" = "placeholder" ]; then
    print_error "Неверный secret (пустой или placeholder)"
    exit 1
fi

# Обновление Secret в Kubernetes (Helm chart ожидает ключ "secret")
print_info "Обновление Secret: $SECRET_NAME в namespace $NS"
kubectl create secret generic "$SECRET_NAME" \
    -n "$NS" \
    --from-literal=secret="$SECRET_VALUE" \
    --dry-run=client -o yaml | kubectl apply -f -

if [ $? -eq 0 ]; then
    print_status "Secret обновлен успешно!"
    echo ""
    # Перезапуск validator-app для подхвата нового secret
    POD_NAME=$(kubectl get pods -n "$NS" -l app.kubernetes.io/name=splice-validator -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    if [ -n "$POD_NAME" ]; then
        print_info "Перезапуск пода validator для применения secret..."
        kubectl delete pod -n "$NS" "$POD_NAME"
        print_status "Под перезапущен"
    else
        print_warning "Под splice-validator не найден; при следующем helm upgrade/install secret подхватится"
    fi
    echo ""
    print_info "Проверка: kubectl get pods -n $NS"
else
    print_error "Ошибка при обновлении Secret"
    exit 1
fi

















