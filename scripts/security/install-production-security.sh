#!/bin/bash

# Скрипт для установки production-ready security инструментов
# Устанавливает: Falco, Trivy, настраивает Audit Logs

set -e

echo "=== Установка Production Security Инструментов ==="
echo ""

# Проверка наличия kubectl и helm
command -v kubectl >/dev/null 2>&1 || { echo "Ошибка: kubectl не установлен"; exit 1; }
command -v helm >/dev/null 2>&1 || { echo "Ошибка: helm не установлен"; exit 1; }

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Функция для проверки успешности установки
check_installation() {
    local component=$1
    if kubectl get pods -n $2 | grep -q "$component"; then
        echo -e "${GREEN}✓ $component установлен успешно${NC}"
        return 0
    else
        echo -e "${RED}✗ $component не установлен${NC}"
        return 1
    fi
}

# 1. Установка Falco
echo "=== 1. Установка Falco (Runtime Security Monitoring) ==="
if kubectl get namespace falco-system >/dev/null 2>&1; then
    echo -e "${YELLOW}Falco уже установлен, пропускаем...${NC}"
else
    helm repo add falcosecurity https://falcosecurity.github.io/charts
    helm repo update
    
    kubectl create namespace falco-system
    
    helm install falco falcosecurity/falco \
        --namespace falco-system \
        --set driver.enabled=true \
        --set falco.grpc.enabled=true \
        --set falco.grpcOutput.enabled=true \
        --wait
    
    echo "Ожидание запуска Falco..."
    sleep 30
    
    if check_installation "falco" "falco-system"; then
        echo "Falco готов к использованию"
        echo "Проверка статуса: kubectl get pods -n falco-system"
    fi
fi
echo ""

# 2. Установка Trivy Operator
echo "=== 2. Установка Trivy Operator (Image Scanning) ==="
if kubectl get namespace trivy-system >/dev/null 2>&1; then
    echo -e "${YELLOW}Trivy уже установлен, пропускаем...${NC}"
else
    helm repo add aquasecurity https://aquasecurity.github.io/helm-charts/
    helm repo update
    
    kubectl create namespace trivy-system
    
    helm install trivy-operator aquasecurity/trivy-operator \
        --namespace trivy-system \
        --set trivy.ignoreUnfixed=true \
        --set trivy.severity=CRITICAL,HIGH \
        --wait
    
    echo "Ожидание запуска Trivy..."
    sleep 30
    
    if check_installation "trivy-operator" "trivy-system"; then
        echo "Trivy готов к использованию"
        echo "Проверка статуса: kubectl get pods -n trivy-system"
    fi
fi
echo ""

# 3. Настройка Kubernetes Audit Logs
echo "=== 3. Настройка Kubernetes Audit Logs ==="
echo "Для k3s требуется ручная настройка в /etc/rancher/k3s/config.yaml"
echo ""
echo "Добавьте следующие строки:"
echo "---"
echo "apiVersion: v1"
echo "kind: Config"
echo "audit-policy-file: /etc/rancher/k3s/audit-policy.yaml"
echo "---"
echo ""
echo "Создайте файл /etc/rancher/k3s/audit-policy.yaml с содержимым:"
cat << 'EOF'
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
- level: Metadata
  namespaces: ["default"]
- level: RequestResponse
  verbs: ["create", "update", "patch", "delete"]
  resources:
  - group: ""
    resources: ["pods", "deployments", "services", "secrets"]
- level: Request
  verbs: ["get", "list", "watch"]
  resources:
  - group: ""
    resources: ["secrets", "configmaps"]
EOF
echo ""
echo "После настройки перезапустите k3s:"
echo "sudo systemctl restart k3s"
echo ""

# 4. Создание кастомных правил Falco
echo "=== 4. Создание кастомных правил Falco ==="
cat > /tmp/falco-custom-rules.yaml << 'EOF'
- rule: Detect Cryptocurrency Mining
  desc: Detect cryptocurrency mining activity
  condition: >
    spawned_process and
    (proc.name in (javae, XFZSrI, miner, xmrig, cpuminer, ccminer) or
     proc.cmdline contains "mining" or
     proc.cmdline contains "cryptocurrency" or
     proc.cmdline contains "pool" or
     proc.cmdline contains "stratum")
  output: >
    Cryptocurrency mining detected
    (user=%user.name command=%proc.cmdline
    container_id=%container.id container_name=%container.name
    image=%container.image.repository)
  priority: CRITICAL
  tags: [container, process, mining]

- rule: Unauthorized Process in Container
  desc: Detect unauthorized processes in containers
  condition: >
    spawned_process and
    container and
    not proc.name in (node, java, python, nginx, envoy, postgres, redis, next)
  output: >
    Unauthorized process started in container
    (user=%user.name command=%proc.cmdline
    container_id=%container.id container_name=%container.name
    image=%container.image.repository)
  priority: WARNING
  tags: [container, process]
EOF

echo "Кастомные правила сохранены в /tmp/falco-custom-rules.yaml"
echo "Для применения выполните:"
echo "kubectl create configmap falco-custom-rules --from-file=/tmp/falco-custom-rules.yaml -n falco-system"
echo ""

# 5. Проверка установки
echo "=== 5. Проверка установки ==="
echo ""
echo "Проверка Falco:"
kubectl get pods -n falco-system 2>/dev/null || echo "Falco не установлен"
echo ""
echo "Проверка Trivy:"
kubectl get pods -n trivy-system 2>/dev/null || echo "Trivy не установлен"
echo ""

# 6. Инструкции по использованию
echo "=== 6. Инструкции по использованию ==="
echo ""
echo "Просмотр алертов Falco:"
echo "  kubectl logs -n falco-system -l app=falco --tail=100"
echo ""
echo "Сканирование образа через Trivy:"
echo "  kubectl get vulnerabilityreports -A"
echo ""
echo "Проверка audit logs (после настройки):"
echo "  journalctl -u k3s | grep audit"
echo ""

echo -e "${GREEN}=== Установка завершена ===${NC}"
echo ""
echo "Следующие шаги:"
echo "1. Настройте Kubernetes Audit Logs (см. инструкции выше)"
echo "2. Примените кастомные правила Falco"
echo "3. Настройте алерты на критические события"
echo "4. Запустите сканирование всех образов через Trivy"







