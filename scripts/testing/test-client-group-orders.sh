#!/bin/bash

# 🧪 Тест заявок в группу клиентов
# Автор: AI Assistant

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

BASE_URL="${BASE_URL:-https://1otc.cc}"
TIMESTAMP=$(date +%s)

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🧪 ТЕСТ ЗАЯВОК В ГРУППУ КЛИЕНТОВ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Получаем цены
echo -e "${YELLOW}📊 Получаю текущие цены...${NC}"
CONFIG_RESPONSE=$(curl -s "${BASE_URL}/api/config")
BUY_PRICE=$(echo "$CONFIG_RESPONSE" | jq -r '.cantonCoinBuyPriceUSD // 0.44')
SELL_PRICE=$(echo "$CONFIG_RESPONSE" | jq -r '.cantonCoinSellPriceUSD // 0.40')
MIN_AMOUNT=$(echo "$CONFIG_RESPONSE" | jq -r '.minUsdtAmount // 500')

echo -e "${GREEN}✅ Цены получены:${NC}"
echo "   Покупка: \$${BUY_PRICE}"
echo "   Продажа: \$${SELL_PRICE}"
echo "   Минимум: \$${MIN_AMOUNT}"
echo ""

# Рассчитываем cantonAmount для покупки
PAYMENT_AMOUNT=500
if [ -n "$BUY_PRICE" ] && [ "$BUY_PRICE" != "0" ] && [ "$BUY_PRICE" != "null" ]; then
    CANTON_AMOUNT=$(echo "scale=2; $PAYMENT_AMOUNT / $BUY_PRICE" | bc 2>/dev/null || echo "1136.36")
else
    CANTON_AMOUNT=1136.36  # Fallback если цена не получена
fi

echo -e "${YELLOW}📝 Создаю тестовую заявку на ПОКУПКУ...${NC}"

BUY_ORDER_PAYLOAD=$(cat <<EOF
{
  "exchangeDirection": "buy",
  "paymentToken": {
    "symbol": "USDT",
    "name": "USDT (TRC-20)",
    "network": "TRON",
    "networkName": "TRON",
    "decimals": 6,
    "priceUSD": 1,
    "minAmount": 1,
    "contractAddress": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
  },
  "paymentAmount": ${PAYMENT_AMOUNT},
  "paymentAmountUSD": ${PAYMENT_AMOUNT},
  "cantonAmount": ${CANTON_AMOUNT},
  "cantonAddress": "04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
  "refundAddress": "bron::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
  "email": "test-buy-client-group-${TIMESTAMP}@example.com",
  "telegram": "@testuser"
}
EOF
)

BUY_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/create-order" \
  -H "Content-Type: application/json" \
  -d "$BUY_ORDER_PAYLOAD")

BUY_ORDER_ID=$(echo "$BUY_RESPONSE" | jq -r '.orderId // empty')

if [ -z "$BUY_ORDER_ID" ] || [ "$BUY_ORDER_ID" = "null" ]; then
    echo -e "${RED}❌ Ошибка создания заявки на покупку${NC}"
    echo "$BUY_RESPONSE" | jq . 2>/dev/null || echo "$BUY_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ Заявка на покупку создана:${NC}"
echo "   Order ID: ${BLUE}${BUY_ORDER_ID}${NC}"
echo "   Email: test-buy-client-group-${TIMESTAMP}@example.com"
echo ""

# Ждем обработки
echo -e "${YELLOW}⏳ Жду обработки заявки (5 секунд)...${NC}"
sleep 5

# Проверяем статус
echo -e "${YELLOW}📋 Проверяю статус заявки...${NC}"
STATUS_RESPONSE=$(curl -s "${BASE_URL}/api/order-status/${BUY_ORDER_ID}")
STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status // "unknown"')

echo -e "${GREEN}✅ Статус заявки: ${BLUE}${STATUS}${NC}"
echo ""

# Проверяем логи что заявка отправлена в обе группы
echo -e "${YELLOW}📋 Проверяю логи отправки заявки...${NC}"
sleep 3

NAMESPACE="${KUBECTL_NAMESPACE:-canton-otc-minimal-stage}"
DEPLOYMENT="${KUBECTL_DEPLOYMENT:-canton-otc}"

LOGS=$(kubectl logs -n "$NAMESPACE" deployment/"$DEPLOYMENT" --tail=100 --since=30s 2>/dev/null | grep -iE "${BUY_ORDER_ID}|Publishing order|Order published|client group|sendOrderNotification|sendPublicOrderNotification" || echo "")

if [ -n "$LOGS" ]; then
    echo -e "${GREEN}✅ Найдены логи отправки:${NC}"
    echo "$LOGS" | head -10
    echo ""
    
    # Проверяем что заявка отправлена в группу клиентов
    if echo "$LOGS" | grep -qi "client group\|Publishing order to client group"; then
        echo -e "${GREEN}✅ Заявка отправлена в группу клиентов${NC}"
    else
        echo -e "${YELLOW}⚠️ Не найдено подтверждения отправки в группу клиентов${NC}"
    fi
    
    # Проверяем что заявка отправлена в группу нотификаций
    if echo "$LOGS" | grep -qi "sendOrderNotification\|Telegram notification sent"; then
        echo -e "${GREEN}✅ Заявка отправлена в группу нотификаций${NC}"
    else
        echo -e "${YELLOW}⚠️ Не найдено подтверждения отправки в группу нотификаций${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ Логи не найдены (возможно заявка еще обрабатывается)${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 ИНСТРУКЦИИ ДЛЯ ПРОВЕРКИ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}1. Проверьте группу клиентов (1OTC_ORDERS, ID: -5039619304):${NC}"
echo "   ✅ Должна прийти заявка с Order ID: ${BLUE}${BUY_ORDER_ID}${NC}"
echo "   ✅ Должна быть кнопка 'Принять заявку'"
echo "   ✅ Сообщение должно быть отформатировано как публичная заявка"
echo ""
echo -e "${YELLOW}2. Проверьте группу нотификаций (операторов, TELEGRAM_CHAT_ID):${NC}"
echo "   ✅ Должна прийти заявка с Order ID: ${BLUE}${BUY_ORDER_ID}${NC}"
echo "   ✅ Это уведомление для операторов (sendOrderNotification)"
echo ""
echo -e "${YELLOW}3. Нажмите 'Принять заявку' в группе клиентов:${NC}"
echo "   ✅ Должно прийти подтверждение"
echo "   ✅ Статус заявки должен измениться на 'accepted'"
echo "   ✅ Должно прийти уведомление оператору о принятии"
echo ""
echo -e "${YELLOW}4. Проверьте логи вручную:${NC}"
echo "   kubectl logs -n $NAMESPACE deployment/$DEPLOYMENT --tail=100 | grep -iE '${BUY_ORDER_ID}|client group|order published'"
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
