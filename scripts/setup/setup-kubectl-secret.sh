#!/bin/bash

# 🔐 Canton OTC - KUBECONFIG Secret Setup Script
# Этот скрипт помогает настроить KUBECONFIG secret для GitHub Actions

set -e

echo "🔐 Canton OTC - Настройка KUBECONFIG Secret для GitHub Actions"
echo "=============================================================="
echo ""

# Проверяем наличие kubectl
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl не найден. Установите kubectl и настройте подключение к кластеру."
    exit 1
fi

# Проверяем подключение к кластеру
echo "🔍 Проверяем подключение к Kubernetes кластеру..."
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ Не удается подключиться к кластеру. Проверьте настройки kubectl."
    echo "💡 Убедитесь, что:"
    echo "   - kubectl настроен правильно"
    echo "   - Вы подключены к правильному кластеру"
    echo "   - У вас есть права доступа к кластеру"
    exit 1
fi

echo "✅ Подключение к кластеру успешно!"
echo ""

# Получаем информацию о кластере
echo "📊 Информация о кластере:"
kubectl cluster-info
echo ""

# Проверяем наличие ~/.kube/config
KUBECONFIG_FILE="$HOME/.kube/config"
if [ ! -f "$KUBECONFIG_FILE" ]; then
    echo "❌ Файл $KUBECONFIG_FILE не найден."
    echo "💡 Убедитесь, что kubectl настроен правильно."
    exit 1
fi

echo "✅ Файл конфигурации найден: $KUBECONFIG_FILE"
echo ""

# Кодируем в base64
echo "🔐 Кодируем kubeconfig в base64..."
BASE64_CONFIG=$(cat "$KUBECONFIG_FILE" | base64 -w 0)

if [ -z "$BASE64_CONFIG" ]; then
    echo "❌ Ошибка при кодировании kubeconfig в base64."
    exit 1
fi

echo "✅ Kubeconfig успешно закодирован в base64!"
echo ""

# Показываем инструкции
echo "📋 ИНСТРУКЦИИ ДЛЯ НАСТРОЙКИ GITHUB SECRET:"
echo "=========================================="
echo ""
echo "1. Перейдите в ваш GitHub репозиторий: TheMacroeconomicDao/CantonOTC"
echo "2. Откройте Settings → Secrets and variables → Actions"
echo "3. Нажмите 'New repository secret'"
echo "4. Имя secret: KUBECONFIG"
echo "5. Значение secret (скопируйте строку ниже):"
echo ""
echo "----------------------------------------"
echo "$BASE64_CONFIG"
echo "----------------------------------------"
echo ""
echo "6. Нажмите 'Add secret'"
echo ""
echo "✅ После этого CI/CD pipeline сможет подключиться к вашему кластеру!"
echo ""
echo "🔍 Для проверки можно запустить:"
echo "   kubectl get nodes"
echo "   kubectl get namespaces"
echo ""

# Опционально: проверяем права доступа
echo "🔍 Проверяем права доступа к кластеру..."
if kubectl auth can-i create deployments &> /dev/null; then
    echo "✅ У вас есть права на создание deployments"
else
    echo "⚠️  У вас может не быть прав на создание deployments"
fi

if kubectl auth can-i create secrets &> /dev/null; then
    echo "✅ У вас есть права на создание secrets"
else
    echo "⚠️  У вас может не быть прав на создание secrets"
fi

if kubectl auth can-i create namespaces &> /dev/null; then
    echo "✅ У вас есть права на создание namespaces"
else
    echo "⚠️  У вас может не быть прав на создание namespaces"
fi

echo ""
echo "🎉 Настройка завершена! Теперь можно запускать CI/CD pipeline."


