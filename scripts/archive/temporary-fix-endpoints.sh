#!/bin/bash
# 🔧 ВРЕМЕННОЕ РЕШЕНИЕ: Обход блокировки master-ноды
# Настройка Traefik для прямого доступа к подам через их IP адреса

set -e

SSH_KEY="$HOME/.ssh/id_rsa_canton"
WORKER_NODE="root@65.108.15.30"
NAMESPACE="canton-otc"
SERVICE_NAME="canton-otc-service"

# IP адреса подов (найдены при диагностике)
POD_IPS=(
  "10.42.2.228"  # healthy, uptime 7 дней
  "10.42.2.83"   # healthy, uptime 7 дней
  "10.42.2.195"  # healthy, uptime 12 часов
)
POD_PORT=3000

echo "🔧 ВРЕМЕННОЕ РЕШЕНИЕ: Настройка прямого доступа к подам"
echo "=================================================="
echo ""

# Вариант 1: Попробовать обновить Endpoints через etcd (если доступен)
echo "📋 Вариант 1: Обновление Endpoints через etcd..."

# Проверяем доступность etcd
ETCD_AVAILABLE=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$WORKER_NODE" \
  "sudo systemctl status k3s-agent 2>&1 | grep -q 'active' && echo 'yes' || echo 'no'")

if [ "$ETCD_AVAILABLE" = "yes" ]; then
  echo "✅ K3s-agent работает, пробуем обновить через etcd..."
  
  # Создаем временный манифест Endpoints
  cat > /tmp/endpoints-patch.yaml <<EOF
subsets:
- addresses:
$(for ip in "${POD_IPS[@]}"; do
  echo "  - ip: $ip"
done)
  ports:
  - port: $POD_PORT
    protocol: TCP
EOF

  # Пробуем применить через k3s (может не сработать из-за блокировки)
  ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$WORKER_NODE" \
    "sudo k3s kubectl patch endpoints $SERVICE_NAME -n $NAMESPACE --type merge --patch-file -" < /tmp/endpoints-patch.yaml 2>&1 || \
    echo "⚠️ Не удалось обновить через kubectl (ожидаемо из-за блокировки)"
fi

echo ""
echo "📋 Вариант 2: Настройка Traefik File Provider..."
echo ""

# Создаем конфигурацию Traefik для прямого доступа
cat > /tmp/traefik-direct-routes.yaml <<EOF
# Временная конфигурация Traefik для прямого доступа к подам
# Использовать только до восстановления master-ноды

http:
  routers:
    canton-otc-direct:
      rule: "Host(\`1otc.cc\`) || Host(\`cantonotc.com\`) || Host(\`canton-otc.com\`)"
      service: canton-otc-direct-service
      entryPoints:
        - websecure
      tls:
        certResolver: letsencrypt

  services:
    canton-otc-direct-service:
      loadBalancer:
        servers:
$(for ip in "${POD_IPS[@]}"; do
  echo "          - url: http://$ip:$POD_PORT"
done)
EOF

echo "📝 Конфигурация Traefik создана в /tmp/traefik-direct-routes.yaml"
echo ""
echo "⚠️  ВАЖНО: Для применения этой конфигурации нужно:"
echo "   1. Скопировать файл на worker-ноду"
echo "   2. Настроить Traefik File Provider"
echo "   3. Или использовать другой метод маршрутизации"
echo ""

# Вариант 3: Использовать iptables для перенаправления
echo "📋 Вариант 3: Настройка iptables для перенаправления трафика..."
echo ""

# Проверяем текущие правила
echo "Текущие правила iptables для Service:"
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$WORKER_NODE" \
  "sudo iptables -t nat -L KUBE-SERVICES -n | grep canton-otc || echo 'Правила не найдены'"

echo ""
echo "💡 РЕКОМЕНДАЦИЯ:"
echo "   Самый быстрый способ - использовать nginx или другой reverse proxy"
echo "   на worker-ноде для перенаправления трафика напрямую к подам"
echo ""

# Вариант 4: Создать простой nginx reverse proxy
echo "📋 Вариант 4: Создание простого nginx reverse proxy..."
echo ""

cat > /tmp/nginx-canton-otc.conf <<EOF
# Временный nginx reverse proxy для canton-otc
# Использовать до восстановления master-ноды

upstream canton_otc_backend {
$(for ip in "${POD_IPS[@]}"; do
  echo "    server $ip:$POD_PORT;"
done)
    keepalive 32;
}

server {
    listen 8080;
    server_name 1otc.cc cantonotc.com canton-otc.com;

    location / {
        proxy_pass http://canton_otc_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

echo "📝 Конфигурация nginx создана в /tmp/nginx-canton-otc.conf"
echo ""
echo "✅ Для применения:"
echo "   1. Установить nginx на worker-ноде (если не установлен)"
echo "   2. Скопировать конфигурацию: scp /tmp/nginx-canton-otc.conf $WORKER_NODE:/etc/nginx/sites-available/canton-otc"
echo "   3. Настроить Traefik для проксирования на nginx:8080"
echo ""

echo "🎯 САМОЕ БЫСТРОЕ РЕШЕНИЕ:"
echo "   Обновить Ingress в Traefik для использования прямых IP адресов подов"
echo "   Это можно сделать через Traefik Dashboard или конфигурацию"
echo ""
