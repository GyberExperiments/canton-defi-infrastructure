#!/bin/bash
# Скрипт для обновления IP адреса в Endpoints при изменении Docker контейнера
# Использование: ./update-nginx-endpoints.sh [SSH_KEY] [SERVER_IP]

set -euo pipefail

SSH_KEY="${SSH_KEY:-${1:-~/.ssh/id_rsa_canton}}"
SERVER="${SERVER:-${2:-65.108.15.30}}"
NAMESPACE="${NAMESPACE:-default}"
SERVICE_NAME="${SERVICE_NAME:-canton-validator-nginx}"
CONTAINER_NAME="${CONTAINER_NAME:-splice-validator-nginx-1}"
NETWORK_NAME="${NETWORK_NAME:-splice-validator_splice_validator}"

echo "🔍 Получение IP адреса Docker контейнера..."

NGINX_IP=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no root@"$SERVER" \
  "docker network inspect $NETWORK_NAME \
  --format '{{range .Containers}}{{if eq .Name \"$CONTAINER_NAME\"}}{{.IPv4Address}}{{end}}{{end}}' | cut -d'/' -f1" 2>/dev/null || echo "")

if [ -z "$NGINX_IP" ]; then
  echo "❌ Ошибка: не удалось получить IP адрес контейнера $CONTAINER_NAME"
  echo "Проверьте:"
  echo "  1. Контейнер запущен: ssh -i $SSH_KEY root@$SERVER 'docker ps | grep $CONTAINER_NAME'"
  echo "  2. Сеть существует: ssh -i $SSH_KEY root@$SERVER 'docker network ls | grep $NETWORK_NAME'"
  exit 1
fi

echo "✅ Найден IP адрес: $NGINX_IP"

# Проверяем текущий IP в Endpoints
CURRENT_IP=$(kubectl get endpoints "$SERVICE_NAME" -n "$NAMESPACE" -o jsonpath='{.subsets[0].addresses[0].ip}' 2>/dev/null || echo "")

if [ "$CURRENT_IP" == "$NGINX_IP" ]; then
  echo "✅ IP адрес уже актуален: $NGINX_IP"
  exit 0
fi

echo "🔄 Обновление Endpoints: ${CURRENT_IP:-<не установлен>} → $NGINX_IP"

kubectl patch endpoints "$SERVICE_NAME" -n "$NAMESPACE" --type=json \
  -p="[{\"op\":\"replace\",\"path\":\"/subsets/0/addresses/0/ip\",\"value\":\"$NGINX_IP\"}]"

if [ $? -eq 0 ]; then
  echo "✅ Endpoints успешно обновлен"
  kubectl get endpoints "$SERVICE_NAME" -n "$NAMESPACE"
else
  echo "❌ Ошибка при обновлении Endpoints"
  exit 1
fi





