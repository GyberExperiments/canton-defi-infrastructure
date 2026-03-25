#!/bin/bash

# Упрощенный скрипт очистки без сложных пайпов
# Работает даже при перегруженном control-plane

set -euo pipefail

echo "🔧 Упрощенная очистка кластера"
echo ""

# Шаг 1: Удалить все challenge поды напрямую
echo "Удаление challenge подов..."
kubectl get pods -A -o name | grep cm-acme-http-solver | xargs -r kubectl delete --grace-period=0 --force 2>/dev/null || echo "Challenge поды удалены или отсутствуют"
echo ""

# Шаг 2: Удалить старые Pending поды (только по имени, без фильтров)
echo "Удаление Pending подов..."
kubectl get pods -A --field-selector status.phase=Pending -o name | head -100 | xargs -r kubectl delete --grace-period=0 --force 2>/dev/null || echo "Pending поды обработаны"
echo ""

# Шаг 3: Удалить все Challenge ресурсы
echo "Удаление Challenge ресурсов..."
kubectl get challenges -A -o name 2>/dev/null | xargs -r kubectl delete --grace-period=0 --force 2>/dev/null || echo "Challenge ресурсы удалены или отсутствуют"
echo ""

# Шаг 4: Удалить проблемные CertificateRequest
echo "Удаление CertificateRequest..."
kubectl get certificaterequests -A -o name 2>/dev/null | head -50 | xargs -r kubectl delete --grace-period=0 --force 2>/dev/null || echo "CertificateRequest обработаны"
echo ""

# Шаг 5: Удалить проблемные Order
echo "Удаление Order..."
kubectl get orders -A -o name 2>/dev/null | head -50 | xargs -r kubectl delete --grace-period=0 --force 2>/dev/null || echo "Order обработаны"
echo ""

echo "✅ Очистка завершена"
echo ""
echo "Текущее состояние:"
kubectl get pods -A --field-selector status.phase=Pending --no-headers 2>/dev/null | wc -l | xargs echo "Pending подов:"
kubectl get challenges -A --no-headers 2>/dev/null | wc -l | xargs echo "Challenge ресурсов:"
