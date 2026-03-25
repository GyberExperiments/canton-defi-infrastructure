#!/bin/bash

# 🧪 Полное тестирование системы: создание заявки и проверка отправки в обе группы
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
echo -e "${BLUE}🧪 ПОЛНОЕ ТЕСТИРОВАНИЕ СИСТЕМЫ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 1. Создаем заявку
echo -e "${YELLOW}📝 Шаг 1: Создание тестовой заявки...${NC}"

CONFIG_RESPONSE=$(curl -s "${BASE_URL}/api/config")
BUY_PRICE=$(echo "$CONFIG_RESPONSE" | jq -r '.cantonCoinBuyPriceUSD // 0.44')
PAYMENT_AMOUNT=500
CANTON_AMOUNT=$(echo "scale=2; $PAYMENT_AMOUNT / $BUY_PRICE" | bc 2>/dev/null || echo "1136.36")

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
  "email": "test-full-system-${TIMESTAMP}@example.com",
  "telegram": "@testuser"
}
EOF
)

RESPONSE=$(curl -s -X POST "${BASE_URL}/api/create-order" \
  -H "Content-Type: application/json" \
  -d "$BUY_ORDER_PAYLOAD")

ORDER_ID=$(echo "$RESPONSE" | jq -r '.orderId // empty')

if [ -z "$ORDER_ID" ] || [ "$ORDER_ID" = "null" ]; then
    echo -e "${RED}❌ Ошибка создания заявки${NC}"
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ Заявка создана: ${BLUE}${ORDER_ID}${NC}"
echo ""

# 2. Ждем обработки
echo -e "${YELLOW}⏳ Шаг 2: Жду обработки заявки (10 секунд)...${NC}"
sleep 10

# 3. Проверяем логи
echo -e "${YELLOW}📋 Шаг 3: Проверка логов отправки...${NC}"
echo ""

NAMESPACE="canton-otc-minimal-stage"
DEPLOYMENT="canton-otc"

# Проверяем логи обработки
PROCESSING_LOG=$(kubectl logs -n "$NAMESPACE" deployment/"$DEPLOYMENT" --tail=500 --since=2m 2>/dev/null | grep -i "Starting background processing for order.*${ORDER_ID}" || echo "")

if [ -n "$PROCESSING_LOG" ]; then
    echo -e "${GREEN}✅ Заявка обрабатывается${NC}"
else
    echo -e "${YELLOW}⚠️ Логи обработки не найдены (возможно еще не обработано)${NC}"
fi

# Проверяем отправку в группу клиентов
CLIENT_GROUP_LOG=$(kubectl logs -n "$NAMESPACE" deployment/"$DEPLOYMENT" --tail=500 --since=2m 2>/dev/null | grep -iE "Publishing order to client group|Order published to channel.*${ORDER_ID}" || echo "")

if [ -n "$CLIENT_GROUP_LOG" ]; then
    echo -e "${GREEN}✅ Заявка отправлена в группу клиентов${NC}"
    echo "$CLIENT_GROUP_LOG" | head -2
else
    echo -e "${YELLOW}⚠️ Логи отправки в группу клиентов не найдены${NC}"
fi

# Проверяем отправку в группу нотификаций
NOTIFICATION_LOG=$(kubectl logs -n "$NAMESPACE" deployment/"$DEPLOYMENT" --tail=500 --since=2m 2>/dev/null | grep -iE "Telegram notification sent successfully.*${ORDER_ID}|📱 Telegram notification sent.*${ORDER_ID}" || echo "")

if [ -n "$NOTIFICATION_LOG" ]; then
    echo -e "${GREEN}✅ Заявка отправлена в группу нотификаций${NC}"
    echo "$NOTIFICATION_LOG" | head -2
else
    echo -e "${YELLOW}⚠️ Логи отправки в группу нотификаций не найдены${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 РУЧНАЯ ПРОВЕРКА В TELEGRAM${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}Проверьте в Telegram:${NC}"
echo ""
echo -e "${GREEN}1. Группа клиентов (1OTC_ORDERS, ID: -5039619304):${NC}"
echo "   - Должна быть заявка с Order ID: ${BLUE}${ORDER_ID}${NC}"
echo "   - Кнопка '✅ Принять заявку'"
echo "   - Форматированное сообщение с деталями"
echo ""
echo -e "${GREEN}2. Группа нотификаций (операторов):${NC}"
echo "   - Должна быть заявка с Order ID: ${BLUE}${ORDER_ID}${NC}"
echo "   - Уведомление для операторов"
echo ""
echo -e "${GREEN}3. Тест подтверждения:${NC}"
echo "   - Нажмите 'Принять заявку' в группе клиентов"
echo "   - Должно прийти подтверждение"
echo "   - Статус должен измениться на 'accepted'"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}💡 Если заявки не пришли в Telegram:${NC}"
echo "   1. Проверьте что TELEGRAM_CLIENT_GROUP_CHAT_ID установлен в секретах"
echo "   2. Проверьте что TELEGRAM_BOT_TOKEN валидный"
echo "   3. Проверьте логи на ошибки: kubectl logs -n $NAMESPACE deployment/$DEPLOYMENT --tail=100 | grep -i error"
echo ""


