#!/bin/bash
# 🔧 БЫСТРОЕ РЕШЕНИЕ: Обновление iptables для прямого доступа к подам
# Обходит блокировку master-ноды, обновляя правила маршрутизации напрямую

set -e

SSH_KEY="$HOME/.ssh/id_rsa_canton"
WORKER_NODE="root@65.108.15.30"

# IP адреса подов (найдены при диагностике)
POD_IPS=(
  "10.42.2.228"
  "10.42.2.83"
  "10.42.2.195"
)
POD_PORT=3000
SERVICE_IP="10.43.151.176"  # Cluster IP из iptables правил

echo "🔧 ОБНОВЛЕНИЕ IPTABLES ДЛЯ ПРЯМОГО ДОСТУПА К ПОДАМ"
echo "=================================================="
echo ""

# Проверяем текущие правила
echo "📋 Текущие правила для canton-otc-service:"
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$WORKER_NODE" \
  "sudo iptables -t nat -L KUBE-SVC-QJS7N4YGQWCOAJMY -n --line-numbers 2>&1 | head -20"

echo ""
echo "🔍 Проверяем доступность подов..."
for ip in "${POD_IPS[@]}"; do
  result=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$WORKER_NODE" \
    "curl -s -m 2 http://$ip:$POD_PORT/api/health 2>&1 | head -1")
  if echo "$result" | grep -q "healthy\|unhealthy"; then
    echo "✅ $ip:$POD_PORT - доступен"
  else
    echo "⚠️  $ip:$POD_PORT - не отвечает или ошибка"
  fi
done

echo ""
echo "⚠️  ВАЖНО: Обновление iptables правил может нарушить работу кластера"
echo "   после восстановления master-ноды. Используйте только как временное решение!"
echo ""

read -p "Продолжить? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Отменено."
    exit 1
fi

echo ""
echo "🔄 Обновление правил iptables..."

# Создаем скрипт для выполнения на worker-ноде
cat > /tmp/update-iptables.sh <<'SCRIPT'
#!/bin/bash
set -e

POD_IPS=("10.42.2.228" "10.42.2.83" "10.42.2.195")
POD_PORT=3000
CHAIN="KUBE-SVC-QJS7N4YGQWCOAJMY"

# Удаляем старые правила (кроме первого - он для балансировки)
echo "Удаление старых правил..."
sudo iptables -t nat -L "$CHAIN" -n --line-numbers | tail -n +4 | awk '{print $1}' | tac | while read line; do
  if [ -n "$line" ]; then
    echo "Удаление правила #$line"
    sudo iptables -t nat -D "$CHAIN" "$line" 2>/dev/null || true
  fi
done

# Добавляем новые правила для каждого пода
echo "Добавление новых правил..."
for ip in "${POD_IPS[@]}"; do
  echo "Добавление правила для $ip:$POD_PORT"
  sudo iptables -t nat -A "$CHAIN" -m statistic --mode random --probability 0.33333333333 -j KUBE-SEP-$(echo -n "$ip:$POD_PORT" | md5sum | cut -c1-10) 2>/dev/null || \
  sudo iptables -t nat -A "$CHAIN" -j DNAT --to-destination "$ip:$POD_PORT"
done

# Создаем правила для каждого endpoint
for ip in "${POD_IPS[@]}"; do
  SEP_CHAIN="KUBE-SEP-$(echo -n "$ip:$POD_PORT" | md5sum | cut -c1-10)"
  echo "Создание цепочки $SEP_CHAIN для $ip:$POD_PORT"
  sudo iptables -t nat -N "$SEP_CHAIN" 2>/dev/null || true
  sudo iptables -t nat -F "$SEP_CHAIN" 2>/dev/null || true
  sudo iptables -t nat -A "$SEP_CHAIN" -p tcp -j DNAT --to-destination "$ip:$POD_PORT"
done

echo "✅ Правила обновлены"
echo ""
echo "Проверка новых правил:"
sudo iptables -t nat -L "$CHAIN" -n -v
SCRIPT

chmod +x /tmp/update-iptables.sh

echo "📤 Копирование скрипта на worker-ноду..."
scp -i "$SSH_KEY" -o StrictHostKeyChecking=no /tmp/update-iptables.sh "$WORKER_NODE:/tmp/update-iptables.sh"

echo ""
echo "⚠️  ВНИМАНИЕ: Этот метод может не сработать, так как iptables правила"
echo "   управляются kube-proxy, который синхронизируется с Kubernetes API."
echo ""
echo "💡 РЕКОМЕНДУЕМЫЙ ПОДХОД:"
echo "   Использовать Traefik Middleware или настроить прямой маршрут"
echo "   через обновление Ingress правил в Traefik"
echo ""
