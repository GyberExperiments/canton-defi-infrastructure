#!/bin/bash
# Скрипт для безопасного применения манифестов с проверками
# Использование: ./apply.sh [--dry-run]

set -euo pipefail

DRY_RUN="${1:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Применение манифестов для интеграции Docker Nginx с Kubernetes"
echo "=================================================================="
echo ""

# Проверка наличия kubectl
if ! command -v kubectl &> /dev/null; then
  echo "❌ Ошибка: kubectl не найден. Установите kubectl и настройте доступ к кластеру."
  exit 1
fi

# Проверка доступа к кластеру
if ! kubectl cluster-info &> /dev/null; then
  echo "❌ Ошибка: нет доступа к Kubernetes кластеру. Проверьте конфигурацию kubectl."
  exit 1
fi

echo "✅ Доступ к кластеру подтвержден"
echo ""

# Создание backup (если не dry-run)
if [ "$DRY_RUN" != "--dry-run" ]; then
  if [ -f "./backup.sh" ]; then
    echo "📦 Создание backup..."
    bash ./backup.sh
    echo ""
  fi
fi

# Dry-run проверка
echo "🔍 Dry-run проверка манифестов..."
kubectl apply --dry-run=client -f nginx-service.yaml
kubectl apply --dry-run=client -f nginx-ingress.yaml
echo "✅ Dry-run проверка пройдена"
echo ""

if [ "$DRY_RUN" == "--dry-run" ]; then
  echo "ℹ️  Режим dry-run: манифесты не применены"
  exit 0
fi

# Применение манифестов
echo "📝 Применение манифестов..."
kubectl apply -f nginx-service.yaml
kubectl apply -f nginx-ingress.yaml
echo "✅ Манифесты применены"
echo ""

# Проверка созданных ресурсов
echo "🔍 Проверка созданных ресурсов..."
kubectl get svc canton-validator-nginx -n default
kubectl get endpoints canton-validator-nginx -n default
kubectl get ingress canton-validator-ingress -n default
echo ""

# Обновление Endpoints IP (если скрипт доступен)
if [ -f "./update-nginx-endpoints.sh" ]; then
  echo "🔄 Обновление IP адреса в Endpoints..."
  bash ./update-nginx-endpoints.sh || echo "⚠️  Не удалось обновить IP автоматически. Обновите вручную."
  echo ""
fi

echo "✅ Применение завершено"
echo ""
echo "📋 Следующие шаги:"
echo "  1. Проверьте доступность: curl -I http://65.108.15.30/health"
echo "  2. Запустите диагностику: ./diagnose.sh"
echo "  3. Проверьте логи: kubectl logs -n kube-system -l app.kubernetes.io/name=traefik --tail=20"





