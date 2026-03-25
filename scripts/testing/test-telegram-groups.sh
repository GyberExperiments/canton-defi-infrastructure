#!/bin/bash

# Тест маршрутизации Telegram групп

BASE_URL="${BASE_URL:-https://1otc.cc}"
NAMESPACE="${KUBECTL_NAMESPACE:-canton-otc-minimal-stage}"
DEPLOYMENT="${KUBECTL_DEPLOYMENT:-canton-otc}"

echo "🔍 Testing Telegram Groups Routing"
echo "==================================="
echo ""

# 1. Check environment variables
echo "1. Checking environment variables..."
ENV_VARS=$(kubectl exec -n "$NAMESPACE" deployment/"$DEPLOYMENT" -- env 2>/dev/null | grep TELEGRAM || echo "")

if echo "$ENV_VARS" | grep -q "TELEGRAM_CHAT_ID"; then
  TELEGRAM_CHAT_ID=$(echo "$ENV_VARS" | grep "TELEGRAM_CHAT_ID" | cut -d'=' -f2)
  echo "✅ TELEGRAM_CHAT_ID: $TELEGRAM_CHAT_ID"
else
  echo "❌ TELEGRAM_CHAT_ID not found"
  exit 1
fi

if echo "$ENV_VARS" | grep -q "TELEGRAM_CLIENT_GROUP_CHAT_ID"; then
  CLIENT_GROUP_ID=$(echo "$ENV_VARS" | grep "TELEGRAM_CLIENT_GROUP_CHAT_ID" | cut -d'=' -f2)
  echo "✅ TELEGRAM_CLIENT_GROUP_CHAT_ID: $CLIENT_GROUP_ID"
else
  echo "❌ TELEGRAM_CLIENT_GROUP_CHAT_ID not found"
  exit 1
fi

# 2. Check initialization logs
echo ""
echo "2. Checking initialization logs..."
INIT_LOGS=$(kubectl logs -n "$NAMESPACE" deployment/"$DEPLOYMENT" --tail=200 2>/dev/null | \
  grep -iE "Telegram Service Config|clientGroupChatId" || echo "")

if echo "$INIT_LOGS" | grep -qi "clientGroupChatId.*$CLIENT_GROUP_ID"; then
  echo "✅ Client group configured in logs"
else
  echo "⚠️ Client group not found in logs (may need restart)"
fi

# 3. Create test order
echo ""
echo "3. Creating test order..."
CONFIG=$(curl -s "${BASE_URL}/api/config")
BUY_PRICE=$(echo "$CONFIG" | jq -r '.cantonCoinBuyPriceUSD')
PAYMENT_AMOUNT=500
CANTON_AMOUNT=$(echo "scale=2; $PAYMENT_AMOUNT / $BUY_PRICE" | bc)

ORDER_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/create-order" \
  -H "Content-Type: application/json" \
  -d "{
    \"exchangeDirection\": \"buy\",
    \"paymentToken\": {
      \"symbol\": \"USDT\",
      \"network\": \"TRON\",
      \"networkName\": \"TRON\",
      \"decimals\": 6,
      \"priceUSD\": 1,
      \"minAmount\": 1,
      \"contractAddress\": \"TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t\"
    },
    \"paymentAmount\": $PAYMENT_AMOUNT,
    \"paymentAmountUSD\": $PAYMENT_AMOUNT,
    \"cantonAmount\": $CANTON_AMOUNT,
    \"cantonAddress\": \"04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8\",
    \"email\": \"telegram-test-$(date +%s)@example.com\"
  }")

ORDER_ID=$(echo "$ORDER_RESPONSE" | jq -r '.orderId')
echo "Order ID: $ORDER_ID"

# 4. Check sending logs
echo ""
echo "4. Checking sending logs (waiting 5 seconds)..."
sleep 5

SEND_LOGS=$(kubectl logs -n "$NAMESPACE" deployment/"$DEPLOYMENT" --tail=500 --since=1m 2>/dev/null | \
  grep -iE "${ORDER_ID}|sendPublicOrderNotification debug|client group|Publishing order" || echo "")

if echo "$SEND_LOGS" | grep -qi "isClientGroup.*true"; then
  echo "✅ Logs show isClientGroup: true"
else
  echo "❌ Logs don't show isClientGroup: true"
  echo "$SEND_LOGS"
fi

if echo "$SEND_LOGS" | grep -qi "usingFallback.*false"; then
  echo "✅ Logs show usingFallback: false"
else
  echo "⚠️ Logs don't show usingFallback: false (may be using fallback)"
fi

if echo "$SEND_LOGS" | grep -qi "channel.*$CLIENT_GROUP_ID"; then
  echo "✅ Logs show message sent to client group: $CLIENT_GROUP_ID"
else
  echo "❌ Logs don't show message sent to client group"
fi

echo ""
echo "📋 Manual check required:"
echo "  1. Check operators group ($TELEGRAM_CHAT_ID): should have detailed notification"
echo "  2. Check clients group ($CLIENT_GROUP_ID): should have public order"

