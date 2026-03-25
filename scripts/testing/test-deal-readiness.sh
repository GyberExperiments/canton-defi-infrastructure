#!/bin/bash

# 🧪 Тестирование системы принятия заявок и готовности сделок
# Автор: AI Assistant
# Дата: $(date +%Y-%m-%d)

set -e

BASE_URL="https://1otc.cc"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Валидные адреса
VALID_CANTON_ADDRESS="04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8"
VALID_REFUND_ADDRESS="bron::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8"
VALID_TRON_ADDRESS="TKau36dpRiTENTjhdJVU4DhoFzX9x3N5Q1"

# Получаем цены из конфига
echo -e "${BLUE}📊 Получаю актуальные цены...${NC}"
CONFIG_RESPONSE=$(curl -s "$BASE_URL/api/config")
BUY_PRICE=$(echo "$CONFIG_RESPONSE" | jq -r '.cantonCoinBuyPrice')
SELL_PRICE=$(echo "$CONFIG_RESPONSE" | jq -r '.cantonCoinSellPrice')
MIN_AMOUNT=$(echo "$CONFIG_RESPONSE" | jq -r '.minUsdtAmount')

echo -e "${GREEN}✅ Цены получены:${NC}"
echo -e "   Buy: \$$BUY_PRICE"
echo -e "   Sell: \$$SELL_PRICE"
echo -e "   Min: \$$MIN_AMOUNT"
echo ""

# Генерируем уникальные email для теста
TIMESTAMP=$(date +%s)
BUY_EMAIL="test-buy-$TIMESTAMP@example.com"
SELL_EMAIL="test-sell-$TIMESTAMP@example.com"

# Сумма для теста (минимум $500)
TEST_AMOUNT=500
CANTON_AMOUNT_BUY=$(echo "scale=0; $TEST_AMOUNT / $BUY_PRICE * 1.03" | bc 2>/dev/null || echo "1170")
CANTON_AMOUNT_SELL=10000
USDT_AMOUNT_SELL=$(echo "scale=0; $CANTON_AMOUNT_SELL * $SELL_PRICE * 1.03" | bc 2>/dev/null || echo "1236")

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🧪 ТЕСТ 1: Создание заявки на ПОКУПКУ (BUY)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

BUY_ORDER=$(cat <<EOF
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
  "paymentAmount": $TEST_AMOUNT,
  "paymentAmountUSD": $TEST_AMOUNT,
  "cantonAmount": $CANTON_AMOUNT_BUY,
  "cantonAddress": "$VALID_CANTON_ADDRESS",
  "refundAddress": "$VALID_REFUND_ADDRESS",
  "email": "$BUY_EMAIL",
  "telegram": "@testbuyer"
}
EOF
)

echo -e "${YELLOW}Создаю заявку на покупку...${NC}"
BUY_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$BUY_ORDER" \
    "$BASE_URL/api/create-order" 2>&1)

BUY_HTTP_STATUS=$(echo "$BUY_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
BUY_BODY=$(echo "$BUY_RESPONSE" | sed '/HTTP_STATUS:/d')
BUY_ORDER_ID=$(echo "$BUY_BODY" | jq -r '.orderId // empty' 2>/dev/null || echo "")

if [ "$BUY_HTTP_STATUS" = "200" ] && [ -n "$BUY_ORDER_ID" ]; then
    echo -e "${GREEN}✅ Заявка на покупку создана${NC}"
    echo -e "${YELLOW}Order ID:${NC} $BUY_ORDER_ID"
    echo -e "${YELLOW}Email:${NC} $BUY_EMAIL"
    echo "$BUY_BODY" | jq . 2>/dev/null || echo "$BUY_BODY"
else
    echo -e "${RED}❌ Ошибка создания заявки на покупку${NC}"
    echo -e "${YELLOW}Status:${NC} $BUY_HTTP_STATUS"
    echo "$BUY_BODY" | jq . 2>/dev/null || echo "$BUY_BODY"
    exit 1
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🧪 ТЕСТ 2: Создание заявки на ПРОДАЖУ (SELL)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

SELL_ORDER=$(cat <<EOF
{
  "exchangeDirection": "sell",
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
  "paymentAmount": $USDT_AMOUNT_SELL,
  "paymentAmountUSD": $USDT_AMOUNT_SELL,
  "cantonAmount": $CANTON_AMOUNT_SELL,
  "cantonAddress": "$VALID_CANTON_ADDRESS",
  "receivingAddress": "$VALID_TRON_ADDRESS",
  "refundAddress": "$VALID_REFUND_ADDRESS",
  "email": "$SELL_EMAIL",
  "telegram": "@testseller"
}
EOF
)

echo -e "${YELLOW}Создаю заявку на продажу...${NC}"
SELL_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$SELL_ORDER" \
    "$BASE_URL/api/create-order" 2>&1)

SELL_HTTP_STATUS=$(echo "$SELL_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
SELL_BODY=$(echo "$SELL_RESPONSE" | sed '/HTTP_STATUS:/d')
SELL_ORDER_ID=$(echo "$SELL_BODY" | jq -r '.orderId // empty' 2>/dev/null || echo "")

if [ "$SELL_HTTP_STATUS" = "200" ] && [ -n "$SELL_ORDER_ID" ]; then
    echo -e "${GREEN}✅ Заявка на продажу создана${NC}"
    echo -e "${YELLOW}Order ID:${NC} $SELL_ORDER_ID"
    echo -e "${YELLOW}Email:${NC} $SELL_EMAIL"
    echo "$SELL_BODY" | jq . 2>/dev/null || echo "$SELL_BODY"
else
    echo -e "${RED}❌ Ошибка создания заявки на продажу${NC}"
    echo -e "${YELLOW}Status:${NC} $SELL_HTTP_STATUS"
    echo "$SELL_BODY" | jq . 2>/dev/null || echo "$SELL_BODY"
    exit 1
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 ИНФОРМАЦИЯ ДЛЯ РУЧНОГО ТЕСТИРОВАНИЯ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo ""
echo -e "${YELLOW}Для тестирования принятия заявок:${NC}"
echo ""
echo -e "${GREEN}1. Заявка на ПОКУПКУ:${NC}"
echo -e "   Order ID: ${BLUE}$BUY_ORDER_ID${NC}"
echo -e "   Email: ${BLUE}$BUY_EMAIL${NC}"
echo -e "   Сумма: ${BLUE}\$$TEST_AMOUNT USDT${NC}"
echo ""
echo -e "${GREEN}2. Заявка на ПРОДАЖУ:${NC}"
echo -e "   Order ID: ${BLUE}$SELL_ORDER_ID${NC}"
echo -e "   Email: ${BLUE}$SELL_EMAIL${NC}"
echo -e "   Сумма: ${BLUE}\$$USDT_AMOUNT_SELL USDT${NC}"
echo ""
echo -e "${YELLOW}Инструкции:${NC}"
echo "1. Откройте Telegram публичный канал с заявками"
echo "2. Найдите заявки с ID: $BUY_ORDER_ID и $SELL_ORDER_ID"
echo "3. Нажмите '✅ Принять' на заявке на покупку"
echo "4. Нажмите '✅ Принять' на заявке на продажу"
echo "5. Проверьте логи сервера на наличие:"
echo "   - '✅ Order accepted successfully'"
echo "   - '🔍 Checking for matching orders'"
echo "   - '✅ Found matching order for deal'"
echo "   - '✅ Admin notified about ready deal'"
echo "6. Проверьте Telegram канал администратора - должно прийти уведомление"
echo "   '🎯 СДЕЛКА ГОТОВА К ИСПОЛНЕНИЮ!'"
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🧪 ТЕСТ 3: Проверка webhook ответа (симуляция принятия)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Симулируем callback query для принятия заявки
# В реальности это приходит от Telegram, но мы можем проверить структуру ответа

echo -e "${YELLOW}Проверяю структуру webhook endpoint...${NC}"

WEBHOOK_HEALTH=$(curl -s "$BASE_URL/api/telegram-mediator/webhook")
echo "$WEBHOOK_HEALTH" | jq . 2>/dev/null || echo "$WEBHOOK_HEALTH"

echo ""
echo -e "${YELLOW}ℹ️ Для полного тестирования нужно:${NC}"
echo "1. Настроить Telegram webhook на $BASE_URL/api/telegram-mediator/webhook"
echo "2. Использовать реальный Telegram бот"
echo "3. Нажать кнопку 'Принять' в публичном канале"
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo ""
echo -e "${GREEN}✅ Создано заявок:${NC} 2"
echo -e "${GREEN}   - Покупка:${NC} $BUY_ORDER_ID"
echo -e "${GREEN}   - Продажа:${NC} $SELL_ORDER_ID"
echo ""
echo -e "${YELLOW}⏳ Ожидается:${NC}"
echo "   - Принятие заявок операторами через Telegram"
echo "   - Автоматическая проверка готовности сделки"
echo "   - Уведомление администратору"
echo ""

echo -e "${BLUE}💡 Для проверки логов:${NC}"
echo "   kubectl logs -n canton-otc deployment/canton-otc --tail=100 | grep -E 'Order accepted|matching orders|deal readiness'"
echo ""
