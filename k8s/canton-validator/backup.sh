#!/bin/bash
# Скрипт для создания backup перед применением изменений
# Использование: ./backup.sh

set -euo pipefail

BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
NAMESPACE="${NAMESPACE:-default}"

mkdir -p "$BACKUP_DIR"

echo "📦 Создание backup перед применением изменений..."
echo ""

# 1. Backup Kubernetes ресурсов
echo "1️⃣  Backup Kubernetes ресурсов в namespace $NAMESPACE..."
kubectl get svc,ingress,endpoints -n "$NAMESPACE" -o yaml > "$BACKUP_DIR/k8s-canton-validator-backup-$TIMESTAMP.yaml" 2>/dev/null || true
echo "✅ Kubernetes backup сохранен: $BACKUP_DIR/k8s-canton-validator-backup-$TIMESTAMP.yaml"

# 2. Backup текущего состояния
echo "2️⃣  Backup текущего состояния кластера..."
kubectl get all -n "$NAMESPACE" > "$BACKUP_DIR/cluster-$NAMESPACE-ns-before-$TIMESTAMP.txt" 2>/dev/null || true
echo "✅ Состояние кластера сохранено: $BACKUP_DIR/cluster-$NAMESPACE-ns-before-$TIMESTAMP.txt"

# 3. Проверка существующих Ingress
echo "3️⃣  Проверка существующих Ingress..."
kubectl get ingress -A > "$BACKUP_DIR/existing-ingress-$TIMESTAMP.txt" 2>/dev/null || true
echo "✅ Список Ingress сохранен: $BACKUP_DIR/existing-ingress-$TIMESTAMP.txt"

# 4. Проверка существующих Service
echo "4️⃣  Проверка существующих Service в namespace $NAMESPACE..."
kubectl get svc -n "$NAMESPACE" > "$BACKUP_DIR/existing-services-$TIMESTAMP.txt" 2>/dev/null || true
echo "✅ Список Service сохранен: $BACKUP_DIR/existing-services-$TIMESTAMP.txt"

echo ""
echo "✅ Backup завершен. Все файлы сохранены в директории: $BACKUP_DIR/"
echo ""
echo "Для восстановления используйте:"
echo "  kubectl apply -f $BACKUP_DIR/k8s-canton-validator-backup-$TIMESTAMP.yaml"





