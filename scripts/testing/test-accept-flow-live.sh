#!/bin/bash

# 🧪 Скрипт для проверки логов после принятия заявки
# Использование: ./scripts/test-accept-flow-live.sh ORDER_ID

ORDER_ID="${1:-$(cat /tmp/test_order_id.txt 2>/dev/null || echo '')}"

if [ -z "$ORDER_ID" ]; then
  echo "❌ Order ID не указан"
  echo "Использование: $0 ORDER_ID"
  exit 1
fi

echo "🔍 Проверка логов для заявки: $ORDER_ID"
echo "─────────────────────────────────────────"
echo ""

echo "📋 1. Проверка обработки callback accept_order:"
kubectl logs -n canton-otc deployment/canton-otc --tail=200 --since=5m | grep -iE "accept_order.*$ORDER_ID|Processing accept_order.*$ORDER_ID" | tail -10

echo ""
echo "📋 2. Проверка обновления статуса:"
kubectl logs -n canton-otc deployment/canton-otc --tail=200 --since=5m | grep -iE "$ORDER_ID.*client_accepted|Client accepted.*$ORDER_ID|Supabase update.*$ORDER_ID" | tail -10

echo ""
echo "📋 3. Проверка перенаправления тейкера:"
kubectl logs -n canton-otc deployment/canton-otc --tail=200 --since=5m | grep -iE "Taker redirected.*$ORDER_ID|sendMessage.*chat_id|Failed to redirect.*$ORDER_ID" | tail -10

echo ""
echo "📋 4. Проверка обновления сообщения в группе:"
kubectl logs -n canton-otc deployment/canton-otc --tail=200 --since=5m | grep -iE "Message updated.*$ORDER_ID|editMessageText.*$ORDER_ID|TAKEN BY" | tail -10

echo ""
echo "📋 5. Проверка ошибок:"
kubectl logs -n canton-otc deployment/canton-otc --tail=200 --since=5m | grep -iE "$ORDER_ID.*error|$ORDER_ID.*failed|$ORDER_ID.*❌" | tail -10

echo ""
echo "📋 6. Статус заявки через API:"
curl -s "https://1otc.cc/api/order/$ORDER_ID" | jq '{
  orderId,
  status,
  isPrivateDeal,
  client_id,
  client_username,
  client_accepted_at
}' 2>/dev/null || echo "⚠️ Заявка еще не синхронизирована в Google Sheets"

echo ""
echo "✅ Проверка завершена"
