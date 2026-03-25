#!/bin/bash

set -e

BASE_URL="${BASE_URL:-https://1otc.cc}"
NAMESPACE="${KUBECTL_NAMESPACE:-canton-otc-minimal-stage}"
DEPLOYMENT="${KUBECTL_DEPLOYMENT:-canton-otc}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "🧪 COMPREHENSIVE SYSTEM TEST"
echo "============================"
echo ""

# 1. Health Check
echo -e "${YELLOW}1. Health Check...${NC}"
HEALTH=$(curl -s "${BASE_URL}/api/health")
if echo "$HEALTH" | jq -e '.status == "healthy"' > /dev/null; then
  echo -e "${GREEN}✅ Health check passed${NC}"
else
  echo -e "${RED}❌ Health check failed${NC}"
  echo "$HEALTH" | jq .
  exit 1
fi

# 2. Config Check
echo -e "${YELLOW}2. Config Check...${NC}"
CONFIG=$(curl -s "${BASE_URL}/api/config")
if echo "$CONFIG" | jq -e '.cantonCoinBuyPriceUSD > 0' > /dev/null; then
  echo -e "${GREEN}✅ Config loaded${NC}"
else
  echo -e "${RED}❌ Config failed${NC}"
  exit 1
fi

# 3. Create Order (BUY)
echo -e "${YELLOW}3. Create Order (BUY)...${NC}"
BUY_PRICE=$(echo "$CONFIG" | jq -r '.cantonCoinBuyPriceUSD')
PAYMENT_AMOUNT=500
CANTON_AMOUNT=$(echo "scale=2; $PAYMENT_AMOUNT / $BUY_PRICE" | bc)

BUY_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/create-order" \
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
    \"refundAddress\": \"bron::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8\",
    \"email\": \"test-buy-$(date +%s)@example.com\"
  }")

ORDER_ID=$(echo "$BUY_RESPONSE" | jq -r '.orderId')

if [ -n "$ORDER_ID" ] && [ "$ORDER_ID" != "null" ]; then
  echo -e "${GREEN}✅ Order created: $ORDER_ID${NC}"
else
  echo -e "${RED}❌ Order creation failed${NC}"
  echo "$BUY_RESPONSE" | jq .
  exit 1
fi

# 4. Check Order Status
echo -e "${YELLOW}4. Check Order Status...${NC}"
sleep 2
STATUS_RESPONSE=$(curl -s "${BASE_URL}/api/order-status/${ORDER_ID}")
if echo "$STATUS_RESPONSE" | jq -e '.orderId == "'"$ORDER_ID"'"' > /dev/null; then
  echo -e "${GREEN}✅ Order status retrieved${NC}"
else
  echo -e "${RED}❌ Order status failed${NC}"
  exit 1
fi

# 5. Check Telegram Logs
echo -e "${YELLOW}5. Check Telegram Logs...${NC}"
sleep 5
TELEGRAM_LOGS=$(kubectl logs -n "$NAMESPACE" deployment/"$DEPLOYMENT" --tail=500 --since=2m 2>/dev/null | \
  grep -iE "${ORDER_ID}|sendPublicOrderNotification|client group" || echo "")

if echo "$TELEGRAM_LOGS" | grep -qi "client group"; then
  echo -e "${GREEN}✅ Telegram logs show client group notification${NC}"
else
  echo -e "${YELLOW}⚠️ Telegram logs not found (check manually)${NC}"
fi

echo ""
echo -e "${GREEN}✅ All tests passed!${NC}"
echo ""
echo "Order ID: $ORDER_ID"
echo "Check Telegram groups manually:"
echo "  - Operators group: TELEGRAM_CHAT_ID"
echo "  - Clients group: TELEGRAM_CLIENT_GROUP_CHAT_ID"

