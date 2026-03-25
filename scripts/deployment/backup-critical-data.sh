#!/bin/bash

# Скрипт резервного копирования критически важных данных кластера

set -euo pipefail

BACKUP_DIR="${1:-/Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/backup/$(date +%Y%m%d_%H%M%S)}"
mkdir -p "$BACKUP_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}💾 РЕЗЕРВНОЕ КОПИРОВАНИЕ КРИТИЧЕСКИ ВАЖНЫХ ДАННЫХ${NC}"
echo -e "${YELLOW}Директория: $BACKUP_DIR${NC}"
echo ""

# Функция для безопасного экспорта
safe_export() {
    local resource=$1
    local namespace=${2:-""}
    local output_file=$3
    
    if [ -n "$namespace" ]; then
        kubectl get "$resource" -n "$namespace" -o yaml 2>/dev/null > "$output_file" || echo "# Empty or error" > "$output_file"
    else
        kubectl get "$resource" -A -o yaml 2>/dev/null > "$output_file" || echo "# Empty or error" > "$output_file"
    fi
}

# 1. Secrets (критически важно!)
echo -e "${YELLOW}1. Резервное копирование Secrets...${NC}"
mkdir -p "$BACKUP_DIR/secrets"
for ns in $(kubectl get namespaces -o name | cut -d/ -f2); do
    if [ "$ns" != "kube-system" ] && [ "$ns" != "kube-public" ] && [ "$ns" != "kube-node-lease" ]; then
        safe_export "secrets" "$ns" "$BACKUP_DIR/secrets/${ns}_secrets.yaml"
    fi
done
echo -e "${GREEN}✅ Secrets сохранены${NC}"

# 2. ConfigMaps
echo -e "${YELLOW}2. Резервное копирование ConfigMaps...${NC}"
mkdir -p "$BACKUP_DIR/configmaps"
for ns in $(kubectl get namespaces -o name | cut -d/ -f2); do
    if [ "$ns" != "kube-system" ] && [ "$ns" != "kube-public" ] && [ "$ns" != "kube-node-lease" ]; then
        safe_export "configmaps" "$ns" "$BACKUP_DIR/configmaps/${ns}_configmaps.yaml"
    fi
done
echo -e "${GREEN}✅ ConfigMaps сохранены${NC}"

# 3. PVC (PersistentVolumeClaims) - данные приложений
echo -e "${YELLOW}3. Резервное копирование PVC...${NC}"
mkdir -p "$BACKUP_DIR/pvc"
safe_export "pvc" "" "$BACKUP_DIR/pvc/all_pvc.yaml"
echo -e "${GREEN}✅ PVC сохранены${NC}"

# 4. Deployments и StatefulSets
echo -e "${YELLOW}4. Резервное копирование Deployments и StatefulSets...${NC}"
mkdir -p "$BACKUP_DIR/deployments"
for ns in $(kubectl get namespaces -o name | cut -d/ -f2); do
    if [ "$ns" != "kube-system" ] && [ "$ns" != "kube-public" ] && [ "$ns" != "kube-node-lease" ]; then
        safe_export "deployments" "$ns" "$BACKUP_DIR/deployments/${ns}_deployments.yaml"
        safe_export "statefulsets" "$ns" "$BACKUP_DIR/deployments/${ns}_statefulsets.yaml"
    fi
done
echo -e "${GREEN}✅ Deployments и StatefulSets сохранены${NC}"

# 5. Ingress конфигурации
echo -e "${YELLOW}5. Резервное копирование Ingress...${NC}"
mkdir -p "$BACKUP_DIR/ingress"
safe_export "ingress" "" "$BACKUP_DIR/ingress/all_ingress.yaml"
echo -e "${GREEN}✅ Ingress сохранены${NC}"

# 6. Certificates (активные)
echo -e "${YELLOW}6. Резервное копирование активных Certificates...${NC}"
mkdir -p "$BACKUP_DIR/certificates"
safe_export "certificates" "" "$BACKUP_DIR/certificates/all_certificates.yaml"
echo -e "${GREEN}✅ Certificates сохранены${NC}"

# 7. ServiceAccounts (могут содержать токены)
echo -e "${YELLOW}7. Резервное копирование ServiceAccounts...${NC}"
mkdir -p "$BACKUP_DIR/serviceaccounts"
for ns in $(kubectl get namespaces -o name | cut -d/ -f2); do
    if [ "$ns" != "kube-system" ] && [ "$ns" != "kube-public" ] && [ "$ns" != "kube-node-lease" ]; then
        safe_export "serviceaccounts" "$ns" "$BACKUP_DIR/serviceaccounts/${ns}_serviceaccounts.yaml"
    fi
done
echo -e "${GREEN}✅ ServiceAccounts сохранены${NC}"

# 8. Важные namespace целиком (для проектов)
echo -e "${YELLOW}8. Резервное копирование важных namespace...${NC}"
mkdir -p "$BACKUP_DIR/namespaces"
IMPORTANT_NS=("canton-otc" "maximus" "supabase" "platform-gyber-org")
for ns in "${IMPORTANT_NS[@]}"; do
    if kubectl get namespace "$ns" &>/dev/null; then
        echo "  Экспорт namespace $ns..."
        kubectl get all -n "$ns" -o yaml > "$BACKUP_DIR/namespaces/${ns}_all.yaml" 2>/dev/null || true
    fi
done
echo -e "${GREEN}✅ Важные namespace сохранены${NC}"

# 9. ClusterIssuer и Issuer
echo -e "${YELLOW}9. Резервное копирование ClusterIssuer и Issuer...${NC}"
mkdir -p "$BACKUP_DIR/issuers"
safe_export "clusterissuers" "" "$BACKUP_DIR/issuers/all_clusterissuers.yaml"
safe_export "issuers" "" "$BACKUP_DIR/issuers/all_issuers.yaml"
echo -e "${GREEN}✅ Issuers сохранены${NC}"

# 10. Список всех ресурсов для справки
echo -e "${YELLOW}10. Создание инвентаря ресурсов...${NC}"
kubectl get all -A > "$BACKUP_DIR/inventory_all_resources.txt" 2>/dev/null || true
kubectl get pvc -A > "$BACKUP_DIR/inventory_pvc.txt" 2>/dev/null || true
kubectl get secrets -A > "$BACKUP_DIR/inventory_secrets.txt" 2>/dev/null || true
echo -e "${GREEN}✅ Инвентарь создан${NC}"

# Создать README с информацией о backup
cat > "$BACKUP_DIR/README.md" <<EOF
# Резервная копия Kubernetes кластера

Дата создания: $(date)

## Содержимое backup:

- \`secrets/\` - Все Secrets из всех namespace
- \`configmaps/\` - Все ConfigMaps из всех namespace  
- \`pvc/\` - Все PersistentVolumeClaims
- \`deployments/\` - Все Deployments и StatefulSets
- \`ingress/\` - Все Ingress конфигурации
- \`certificates/\` - Все Certificate ресурсы
- \`serviceaccounts/\` - Все ServiceAccounts
- \`namespaces/\` - Полные экспорты важных namespace
- \`issuers/\` - ClusterIssuer и Issuer
- \`inventory_*.txt\` - Инвентари всех ресурсов

## Восстановление:

\`\`\`bash
# Восстановить Secret
kubectl apply -f backup/secrets/<namespace>_secrets.yaml

# Восстановить ConfigMap
kubectl apply -f backup/configmaps/<namespace>_configmaps.yaml

# Восстановить Deployment
kubectl apply -f backup/deployments/<namespace>_deployments.yaml
\`\`\`
EOF

echo ""
echo -e "${GREEN}✅ РЕЗЕРВНОЕ КОПИРОВАНИЕ ЗАВЕРШЕНО!${NC}"
echo -e "${BLUE}Директория: $BACKUP_DIR${NC}"
echo -e "${YELLOW}Размер backup: $(du -sh "$BACKUP_DIR" | cut -f1)${NC}"
