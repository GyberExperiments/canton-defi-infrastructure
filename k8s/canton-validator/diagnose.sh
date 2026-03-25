#!/bin/bash
# Скрипт для диагностики интеграции Docker Nginx с Kubernetes
# Использование: ./diagnose.sh [SSH_KEY] [SERVER_IP]

set -euo pipefail

SSH_KEY="${SSH_KEY:-${1:-~/.ssh/id_rsa_canton}}"
SERVER="${SERVER:-${2:-65.108.15.30}}"
NAMESPACE="${NAMESPACE:-default}"
SERVICE_NAME="${SERVICE_NAME:-canton-validator-nginx}"
CONTAINER_NAME="${CONTAINER_NAME:-splice-validator-nginx-1}"
NETWORK_NAME="${NETWORK_NAME:-splice-validator_splice_validator}"

echo "🔍 ДИАГНОСТИКА ИНТЕГРАЦИИ DOCKER NGINX С KUBERNETES"
echo "=================================================="
echo ""

# 1. Проверка Kubernetes кластера
echo "1️⃣  Проверка Kubernetes кластера..."
kubectl cluster-info > /dev/null 2>&1 && echo "✅ Kubernetes кластер доступен" || echo "❌ Kubernetes кластер недоступен"
kubectl get nodes -o wide
echo ""

# 2. Проверка Traefik
echo "2️⃣  Проверка Traefik Ingress Controller..."
kubectl get ingressclass | grep traefik && echo "✅ IngressClass traefik найден" || echo "❌ IngressClass traefik не найден"
kubectl get svc -A | grep traefik || echo "⚠️  Traefik Service не найден"
kubectl get pods -A | grep traefik || echo "⚠️  Traefik Pods не найдены"
echo ""

# 3. Проверка Docker контейнера
echo "3️⃣  Проверка Docker контейнера nginx..."
if ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no root@"$SERVER" "docker ps | grep -q $CONTAINER_NAME" 2>/dev/null; then
  echo "✅ Контейнер $CONTAINER_NAME запущен"
  ssh -i "$SSH_KEY" root@"$SERVER" "docker ps | grep $CONTAINER_NAME"
else
  echo "❌ Контейнер $CONTAINER_NAME не запущен"
fi
echo ""

# 4. Получение IP адреса контейнера
echo "4️⃣  Получение IP адреса nginx контейнера..."
NGINX_IP=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no root@"$SERVER" \
  "docker network inspect $NETWORK_NAME \
  --format '{{range .Containers}}{{if eq .Name \"$CONTAINER_NAME\"}}{{.IPv4Address}}{{end}}{{end}}' | cut -d'/' -f1" 2>/dev/null || echo "")

if [ -n "$NGINX_IP" ]; then
  echo "✅ IP адрес контейнера: $NGINX_IP"
else
  echo "❌ Не удалось получить IP адрес контейнера"
fi
echo ""

# 5. Проверка Kubernetes ресурсов
echo "5️⃣  Проверка Kubernetes ресурсов..."
if kubectl get svc "$SERVICE_NAME" -n "$NAMESPACE" > /dev/null 2>&1; then
  echo "✅ Service $SERVICE_NAME существует"
  kubectl get svc "$SERVICE_NAME" -n "$NAMESPACE" -o wide
else
  echo "❌ Service $SERVICE_NAME не найден"
fi

if kubectl get endpoints "$SERVICE_NAME" -n "$NAMESPACE" > /dev/null 2>&1; then
  echo "✅ Endpoints $SERVICE_NAME существует"
  kubectl get endpoints "$SERVICE_NAME" -n "$NAMESPACE" -o wide
  CURRENT_IP=$(kubectl get endpoints "$SERVICE_NAME" -n "$NAMESPACE" -o jsonpath='{.subsets[0].addresses[0].ip}' 2>/dev/null || echo "")
  if [ -n "$NGINX_IP" ] && [ "$CURRENT_IP" != "$NGINX_IP" ]; then
    echo "⚠️  IP в Endpoints ($CURRENT_IP) не совпадает с IP контейнера ($NGINX_IP)"
    echo "   Запустите: ./update-nginx-endpoints.sh"
  fi
else
  echo "❌ Endpoints $SERVICE_NAME не найден"
fi

if kubectl get ingress canton-validator-ingress -n "$NAMESPACE" > /dev/null 2>&1; then
  echo "✅ Ingress canton-validator-ingress существует"
  kubectl get ingress canton-validator-ingress -n "$NAMESPACE" -o wide
else
  echo "❌ Ingress canton-validator-ingress не найден"
fi
echo ""

# 6. Проверка сетевой доступности
echo "6️⃣  Проверка сетевой доступности..."
if [ -n "$NGINX_IP" ]; then
  echo "Проверка подключения из Kubernetes pod к Docker контейнеру..."
  kubectl run test-connectivity-$(date +%s) --image=curlimages/curl --rm -i --restart=Never -- \
    sh -c "curl -s -m 5 http://$NGINX_IP:8080/health 2>&1" || echo "❌ Не удалось подключиться к $NGINX_IP:8080"
fi
echo ""

# 7. Проверка доступности через Ingress
echo "7️⃣  Проверка доступности через Ingress..."
for endpoint in "/health" "/wallet/" "/ans/"; do
  echo -n "  Проверка http://$SERVER$endpoint ... "
  if curl -s -o /dev/null -w "%{http_code}" -m 5 "http://$SERVER$endpoint" | grep -q "200"; then
    echo "✅ OK"
  else
    echo "❌ FAILED"
  fi
done
echo ""

# 8. Проверка логов
echo "8️⃣  Последние логи Traefik (canton-validator):"
kubectl logs -n kube-system -l app.kubernetes.io/name=traefik --tail=5 2>/dev/null | grep -i canton || echo "  (нет записей)"
echo ""

echo "=================================================="
echo "✅ Диагностика завершена"





