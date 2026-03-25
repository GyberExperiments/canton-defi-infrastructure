#!/bin/bash

# 🔐 Load environment variables from Kubernetes secrets
# Загружает переменные окружения из Kubernetes secrets для локальной разработки

echo "🔍 Загружаем переменные окружения из Kubernetes..."

# Проверяем подключение к Kubernetes
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ Не удается подключиться к Kubernetes кластеру"
    exit 1
fi

# Проверяем наличие namespace
NAMESPACE="canton-otc-minimal-stage"
if ! kubectl get namespace $NAMESPACE &> /dev/null; then
    echo "❌ Namespace $NAMESPACE не найден"
    exit 1
fi

# Проверяем наличие secret
SECRET_NAME="canton-otc-secrets-minimal-stage"
if ! kubectl get secret $SECRET_NAME -n $NAMESPACE &> /dev/null; then
    echo "❌ Secret $SECRET_NAME не найден в namespace $NAMESPACE"
    exit 1
fi

echo "✅ Подключение к Kubernetes установлено"
echo "📋 Загружаем переменные из secret: $SECRET_NAME"

# Создаем временный файл для переменных окружения
TEMP_ENV_FILE="/tmp/canton-otc-env-$(date +%s).env"

# Извлекаем и декодируем переменные окружения
kubectl get secret $SECRET_NAME -n $NAMESPACE -o jsonpath='{.data}' | jq -r 'to_entries[] | "\(.key)=\(.value | @base64d)"' > $TEMP_ENV_FILE

# Загружаем переменные в текущую сессию (игнорируем переменные с пробелами)
while IFS='=' read -r key value; do
    # Пропускаем пустые строки и переменные с пробелами в значении
    if [[ -n "$key" && -n "$value" && "$value" != *" "* ]]; then
        export "$key=$value"
    fi
done < $TEMP_ENV_FILE

echo "✅ Переменные окружения загружены:"
echo "   - NEXT_PUBLIC_INTERCOM_APP_ID: ${NEXT_PUBLIC_INTERCOM_APP_ID:0:8}..."
echo "   - INTERCOM_ACCESS_TOKEN: ${INTERCOM_ACCESS_TOKEN:0:8}..."
echo "   - INTERCOM_ADMIN_ID: $INTERCOM_ADMIN_ID"
echo "   - INTERCOM_WEBHOOK_SECRET: ${INTERCOM_WEBHOOK_SECRET:0:8}..."
echo "   - ADMIN_API_KEY: ${ADMIN_API_KEY:0:8}..."

# Удаляем временный файл
rm -f $TEMP_ENV_FILE

echo "🚀 Переменные окружения готовы к использованию!"
echo ""
echo "💡 Теперь вы можете запустить:"
echo "   node setup-fin-assistant.js"
echo "   или"
echo "   source load-env-from-k8s.sh && node setup-fin-assistant.js"
