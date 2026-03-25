#!/bin/bash
# Скрипт для тестирования функциональности market price с discount

set -e

API_URL="${API_URL:-https://1otc.cc/api/create-order}"

echo "🧪 Тестирование функциональности Market Price с Discount"
echo "=========================================================="
echo ""

# Тест 1: Market price без дисконта
echo "📋 Тест 1: Market price без дисконта (0%)"
echo "-------------------------------------------"

RESPONSE1=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "cantonAddress": "04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "refundAddress": "bron::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "paymentAmount": 100,
    "paymentAmountUSD": 100,
    "cantonAmount": 650,
    "email": "test-market-0@example.com",
    "exchangeDirection": "buy",
    "isMarketPrice": true,
    "marketPriceDiscountPercent": 0,
    "paymentToken": {
      "symbol": "USDT",
      "network": "TRON",
      "networkName": "TRON (TRC-20)"
    }
  }')

echo "$RESPONSE1" | jq '.' || echo "$RESPONSE1"

SUCCESS1=$(echo "$RESPONSE1" | jq -r '.success // false')
if [ "$SUCCESS1" = "true" ]; then
    echo "✅ Тест 1 пройден: Заявка создана успешно"
    ORDER_ID1=$(echo "$RESPONSE1" | jq -r '.orderId // ""')
    echo "   Order ID: $ORDER_ID1"
else
    echo "❌ Тест 1 провален"
    ERROR1=$(echo "$RESPONSE1" | jq -r '.error // "Unknown error"')
    echo "   Ошибка: $ERROR1"
fi

echo ""
sleep 2

# Тест 2: Market price с дисконтом 2%
echo "📋 Тест 2: Market price с дисконтом 2%"
echo "---------------------------------------"

RESPONSE2=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "cantonAddress": "04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "refundAddress": "bron::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "paymentAmount": 100,
    "paymentAmountUSD": 100,
    "cantonAmount": 663,
    "email": "test-market-2@example.com",
    "exchangeDirection": "buy",
    "isMarketPrice": true,
    "marketPriceDiscountPercent": 2,
    "paymentToken": {
      "symbol": "USDT",
      "network": "TRON",
      "networkName": "TRON (TRC-20)"
    }
  }')

echo "$RESPONSE2" | jq '.' || echo "$RESPONSE2"

SUCCESS2=$(echo "$RESPONSE2" | jq -r '.success // false')
if [ "$SUCCESS2" = "true" ]; then
    echo "✅ Тест 2 пройден: Заявка создана с дисконтом 2%"
    ORDER_ID2=$(echo "$RESPONSE2" | jq -r '.orderId // ""')
    echo "   Order ID: $ORDER_ID2"
else
    echo "❌ Тест 2 провален"
    ERROR2=$(echo "$RESPONSE2" | jq -r '.error // "Unknown error"')
    echo "   Ошибка: $ERROR2"
fi

echo ""
sleep 2

# Тест 3: Market price с дисконтом 5%
echo "📋 Тест 3: Market price с дисконтом 5%"
echo "---------------------------------------"

RESPONSE3=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "cantonAddress": "04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "refundAddress": "bron::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "paymentAmount": 100,
    "paymentAmountUSD": 100,
    "cantonAmount": 684,
    "email": "test-market-5@example.com",
    "exchangeDirection": "buy",
    "isMarketPrice": true,
    "marketPriceDiscountPercent": 5,
    "paymentToken": {
      "symbol": "USDT",
      "network": "TRON",
      "networkName": "TRON (TRC-20)"
    }
  }')

echo "$RESPONSE3" | jq '.' || echo "$RESPONSE3"

SUCCESS3=$(echo "$RESPONSE3" | jq -r '.success // false')
if [ "$SUCCESS3" = "true" ]; then
    echo "✅ Тест 3 пройден: Заявка создана с дисконтом 5%"
    ORDER_ID3=$(echo "$RESPONSE3" | jq -r '.orderId // ""')
    echo "   Order ID: $ORDER_ID3"
else
    echo "❌ Тест 3 провален"
    ERROR3=$(echo "$RESPONSE3" | jq -r '.error // "Unknown error"')
    echo "   Ошибка: $ERROR3"
fi

echo ""
echo "=========================================================="
echo "📊 Итоги тестирования:"
echo ""

if [ "$SUCCESS1" = "true" ] && [ "$SUCCESS2" = "true" ] && [ "$SUCCESS3" = "true" ]; then
    echo "✅ Все тесты пройдены успешно!"
    echo ""
    echo "📝 Созданные заявки:"
    [ -n "$ORDER_ID1" ] && echo "   - Order 1 (0% discount): $ORDER_ID1"
    [ -n "$ORDER_ID2" ] && echo "   - Order 2 (2% discount): $ORDER_ID2"
    [ -n "$ORDER_ID3" ] && echo "   - Order 3 (5% discount): $ORDER_ID3"
    echo ""
    echo "🔍 Проверить данные в БД:"
    echo "   kubectl exec -n supabase postgres-0 -- bash -c \\"
    echo "     \"PGPASSWORD='\$(kubectl get secret postgres-secret -n supabase -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d)' psql -U supabase -d supabase -c \\\""
    echo "       SELECT order_id, is_market_price, market_price_discount_percent, price"
    echo "       FROM public_orders"
    echo "       WHERE email LIKE 'test-market-%@example.com'"
    echo "       ORDER BY created_at DESC;"
    echo "     \\\"\""
    exit 0
else
    echo "❌ Некоторые тесты провалены"
    echo ""
    echo "🔍 Проверить логи:"
    echo "   kubectl logs -n canton-otc deployment/canton-otc --tail=100 | grep -E 'Supabase|DATABASE|Error'"
    exit 1
fi
