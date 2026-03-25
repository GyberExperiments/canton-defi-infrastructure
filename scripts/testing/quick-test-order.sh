#!/bin/bash
# Быстрый тест создания заявки с мониторингом логов

API_URL="${API_URL:-https://1otc.cc/api/create-order}"
NAMESPACE="canton-otc"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "🧪 Быстрый тест создания заявки"
echo "================================"

# Запускаем мониторинг логов в фоне
echo "📊 Запускаю мониторинг логов..."
kubectl logs -n $NAMESPACE deployment/canton-otc -f --tail=0 &
LOG_PID=$!
echo "   PID: $LOG_PID"
echo ""

# Создаем заявку
echo "📝 Создаю заявку BUY с market price и discount 2%..."
RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "cantonAddress": "04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "refundAddress": "bron::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "paymentAmount": 100,
    "paymentAmountUSD": 100,
    "cantonAmount": 663,
    "email": "test-'$TIMESTAMP'@example.com",
    "exchangeDirection": "buy",
    "isMarketPrice": true,
    "marketPriceDiscountPercent": 2,
    "paymentToken": {
      "symbol": "USDT",
      "network": "TRON",
      "networkName": "TRON (TRC-20)"
    }
  }')

echo "$RESPONSE" | jq '.' || echo "$RESPONSE"

ORDER_ID=$(echo "$RESPONSE" | jq -r '.orderId // empty')
SUCCESS=$(echo "$RESPONSE" | jq -r '.success // false')

if [ "$SUCCESS" = "true" ] && [ -n "$ORDER_ID" ]; then
    echo ""
    echo "✅ Заявка создана! Order ID: $ORDER_ID"
    echo ""
    echo "🔔 Проверьте Telegram уведомления"
    echo "⏳ Ожидаю 15 секунд для анализа логов..."
    sleep 15
    
    echo ""
    echo "📊 Последние логи:"
    kubectl logs -n $NAMESPACE deployment/canton-otc --tail=50 | grep -E "Order saved|Telegram|Supabase|Error|Failed" | tail -20
    
    # Останавливаем мониторинг
    kill $LOG_PID 2>/dev/null || true
    echo ""
    echo "✅ Тест завершен. Проверьте логи выше."
else
    echo ""
    echo "❌ Ошибка создания заявки!"
    kill $LOG_PID 2>/dev/null || true
    exit 1
fi
