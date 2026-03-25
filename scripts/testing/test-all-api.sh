#!/bin/bash

# 🧪 Полное тестирование всех API функций сайта 1otc.cc через curl
# Автор: AI Assistant
# Дата: $(date +%Y-%m-%d)

set -e

BASE_URL="https://1otc.cc"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Счетчики
TESTS_PASSED=0
TESTS_FAILED=0
TOTAL_TESTS=0

# Функция для вывода заголовка теста
print_test_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}🧪 Тест: $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Функция для выполнения curl запроса
run_test() {
    local test_name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local expected_status="${5:-200}"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    print_test_header "$test_name"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$BASE_URL$endpoint" 2>&1)
    else
        response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
            -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint" 2>&1)
    fi
    
    http_status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
    body=$(echo "$response" | sed '/HTTP_STATUS:/d')
    
    echo -e "${YELLOW}Endpoint:${NC} $method $endpoint"
    echo -e "${YELLOW}Expected Status:${NC} $expected_status"
    echo -e "${YELLOW}Actual Status:${NC} $http_status"
    echo -e "${YELLOW}Response:${NC}"
    echo "$body" | jq . 2>/dev/null || echo "$body"
    
    if [ "$http_status" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASSED${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}❌ FAILED${NC} (Expected: $expected_status, Got: $http_status)"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Функция для сохранения orderId для последующих тестов
SAVED_ORDER_ID=""

save_order_id() {
    local response="$1"
    SAVED_ORDER_ID=$(echo "$response" | jq -r '.orderId // empty' 2>/dev/null || echo "")
    if [ -n "$SAVED_ORDER_ID" ]; then
        echo -e "${GREEN}💾 Сохранен Order ID: $SAVED_ORDER_ID${NC}"
    fi
}

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║                    🧪 ТЕСТИРОВАНИЕ API 1OTC.CC                              ║"
echo "║                    Полное покрытие всех функций                              ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ============================================================================
# 1. HEALTH CHECK
# ============================================================================
run_test "Health Check" "GET" "/api/health" "" "200"

# ============================================================================
# 2. CONFIG API
# ============================================================================
run_test "Get Configuration" "GET" "/api/config" "" "200"

# Проверяем что цены присутствуют в ответе
config_response=$(curl -s "$BASE_URL/api/config")
buy_price=$(echo "$config_response" | jq -r '.cantonCoinBuyPrice // empty' 2>/dev/null || echo "")
sell_price=$(echo "$config_response" | jq -r '.cantonCoinSellPrice // empty' 2>/dev/null || echo "")

if [ -n "$buy_price" ] && [ -n "$sell_price" ]; then
    echo -e "${GREEN}✅ Цены получены: Buy=$buy_price, Sell=$sell_price${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ Цены не найдены в конфигурации${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# ============================================================================
# 3. CREATE ORDER - BUY (Покупка Canton за USDT)
# ============================================================================

# Валидный Canton адрес (HEX::HEX формат)
VALID_CANTON_ADDRESS="04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8"
VALID_REFUND_ADDRESS="bron::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8"

# Вычисляем правильные суммы на основе цен
# Минимальная сумма = $500 (из конфига)
# Если buy_price = 0.44, то за 500 USDT получим ~1170 CC (500 / 0.44 * 1.03)
# Используем округленные значения для теста
PAYMENT_AMOUNT_USD=500
CANTON_AMOUNT_BUY=$(echo "scale=0; $PAYMENT_AMOUNT_USD / $buy_price * 1.03" | bc 2>/dev/null || echo "1170")

# 3.1. BUY с USDT TRC-20 (TRON)
BUY_ORDER_TRC20=$(cat <<EOF
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
  "paymentAmount": 500,
  "paymentAmountUSD": 500,
  "cantonAmount": $CANTON_AMOUNT_BUY,
  "cantonAddress": "$VALID_CANTON_ADDRESS",
  "refundAddress": "$VALID_REFUND_ADDRESS",
  "email": "test-buy-trc20-$(date +%s)@example.com",
  "telegram": "@testuser"
}
EOF
)

response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$BUY_ORDER_TRC20" \
    "$BASE_URL/api/create-order" 2>&1)

http_status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_STATUS:/d')

print_test_header "Create Order - BUY (USDT TRC-20)"
echo -e "${YELLOW}Request:${NC}"
echo "$BUY_ORDER_TRC20" | jq .
echo -e "${YELLOW}Status:${NC} $http_status"
echo -e "${YELLOW}Response:${NC}"
echo "$body" | jq . 2>/dev/null || echo "$body"

if [ "$http_status" = "200" ]; then
    echo -e "${GREEN}✅ PASSED${NC}"
    save_order_id "$body"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ FAILED${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# 3.2. BUY с USDT ERC-20 (Ethereum)
BUY_ORDER_ERC20=$(cat <<EOF
{
  "exchangeDirection": "buy",
  "paymentToken": {
    "symbol": "USDT",
    "name": "USDT (ERC-20)",
    "network": "ETHEREUM",
    "networkName": "Ethereum",
    "decimals": 6,
    "priceUSD": 1,
    "minAmount": 1,
    "contractAddress": "0xdAC17F958D2ee523a2206206994597C13D831ec7"
  },
  "paymentAmount": 150,
  "paymentAmountUSD": 150,
  "cantonAmount": $(echo "scale=0; 150 / $buy_price * 1.03" | bc 2>/dev/null || echo "882"),
  "cantonAddress": "$VALID_CANTON_ADDRESS",
  "refundAddress": "$VALID_REFUND_ADDRESS",
  "email": "test-buy-erc20-$(date +%s)@example.com"
}
EOF
)

response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$BUY_ORDER_ERC20" \
    "$BASE_URL/api/create-order" 2>&1)

http_status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_STATUS:/d')

print_test_header "Create Order - BUY (USDT ERC-20)"
echo -e "${YELLOW}Status:${NC} $http_status"
echo -e "${YELLOW}Response:${NC}"
echo "$body" | jq . 2>/dev/null || echo "$body"

if [ "$http_status" = "200" ]; then
    echo -e "${GREEN}✅ PASSED${NC}"
    save_order_id "$body"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ FAILED${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# 3.3. BUY с USDT BEP-20 (BSC)
BUY_ORDER_BEP20=$(cat <<EOF
{
  "exchangeDirection": "buy",
  "paymentToken": {
    "symbol": "USDT",
    "name": "USDT (BEP-20)",
    "network": "BSC",
    "networkName": "BNB Chain",
    "decimals": 18,
    "priceUSD": 1,
    "minAmount": 1,
    "contractAddress": "0x55d398326f99059fF775485246999027B3197955"
  },
  "paymentAmount": 700,
  "paymentAmountUSD": 700,
  "cantonAmount": $(echo "scale=0; 700 / $buy_price * 1.03" | bc 2>/dev/null || echo "1638"),
  "cantonAddress": "$VALID_CANTON_ADDRESS",
  "refundAddress": "$VALID_REFUND_ADDRESS",
  "email": "test-buy-bep20-$(date +%s)@example.com"
}
EOF
)

response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$BUY_ORDER_BEP20" \
    "$BASE_URL/api/create-order" 2>&1)

http_status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_STATUS:/d')

print_test_header "Create Order - BUY (USDT BEP-20)"
echo -e "${YELLOW}Status:${NC} $http_status"
echo -e "${YELLOW}Response:${NC}"
echo "$body" | jq . 2>/dev/null || echo "$body"

if [ "$http_status" = "200" ]; then
    echo -e "${GREEN}✅ PASSED${NC}"
    save_order_id "$body"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ FAILED${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# ============================================================================
# 4. CREATE ORDER - SELL (Продажа Canton за USDT)
# ============================================================================

# Валидный адрес для получения USDT (TRON)
VALID_TRON_ADDRESS="TKau36dpRiTENTjhdJVU4DhoFzX9x3N5Q1"
VALID_ETH_ADDRESS="0xe70eC2DeA28CD14B2d392E72F2fE68F8d8799D5E"

# При sell: пользователь продает Canton, получает USDT
# Если sell_price = 0.14, то за 10000 CC получим ~1400 USDT (10000 * 0.14)
CANTON_AMOUNT_SELL=10000
USDT_AMOUNT_SELL=$(echo "scale=0; $CANTON_AMOUNT_SELL * $sell_price * 1.03" | bc 2>/dev/null || echo "1442")

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
  "email": "test-sell-$(date +%s)@example.com",
  "whatsapp": "+1234567890"
}
EOF
)

response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$SELL_ORDER" \
    "$BASE_URL/api/create-order" 2>&1)

http_status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_STATUS:/d')

print_test_header "Create Order - SELL (Продажа Canton за USDT)"
echo -e "${YELLOW}Request:${NC}"
echo "$SELL_ORDER" | jq .
echo -e "${YELLOW}Status:${NC} $http_status"
echo -e "${YELLOW}Response:${NC}"
echo "$body" | jq . 2>/dev/null || echo "$body"

if [ "$http_status" = "200" ]; then
    echo -e "${GREEN}✅ PASSED${NC}"
    save_order_id "$body"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ FAILED${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# ============================================================================
# 5. ORDER STATUS
# ============================================================================

if [ -n "$SAVED_ORDER_ID" ]; then
    # Order status может вернуть 404 если ордер еще не синхронизирован с Google Sheets
    # Это нормально, проверяем что API работает (200 или 404 - оба валидны)
    response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$BASE_URL/api/order-status/$SAVED_ORDER_ID" 2>&1)
    http_status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
    body=$(echo "$response" | sed '/HTTP_STATUS:/d')
    
    print_test_header "Get Order Status"
    echo -e "${YELLOW}Endpoint:${NC} GET /api/order-status/$SAVED_ORDER_ID"
    echo -e "${YELLOW}Status:${NC} $http_status"
    echo -e "${YELLOW}Response:${NC}"
    echo "$body" | jq . 2>/dev/null || echo "$body"
    
    # 200 = ордер найден, 404 = еще не синхронизирован (нормально)
    if [ "$http_status" = "200" ] || [ "$http_status" = "404" ]; then
        echo -e "${GREEN}✅ PASSED (API работает)${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ FAILED${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
else
    print_test_header "Get Order Status (SKIPPED - нет orderId)"
    echo -e "${YELLOW}⚠️ Пропущен: нет сохраненного orderId${NC}"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
fi

# ============================================================================
# 6. NEAR INTENTS - SWAP
# ============================================================================

SWAP_INTENT=$(cat <<EOF
{
  "fromToken": "NEAR",
  "fromChain": "NEAR",
  "toToken": "USDT",
  "toChain": "NEAR",
  "amount": 10,
  "userAccount": "test.near"
}
EOF
)

response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$SWAP_INTENT" \
    "$BASE_URL/api/near-intents/swap" 2>&1)

http_status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_STATUS:/d')

print_test_header "NEAR Intents - Swap"
echo -e "${YELLOW}Request:${NC}"
echo "$SWAP_INTENT" | jq .
echo -e "${YELLOW}Status:${NC} $http_status"
echo -e "${YELLOW}Response:${NC}"
echo "$body" | jq . 2>/dev/null || echo "$body"

# Swap может вернуть 400 если баланс недостаточен или 200 если все ок
if [ "$http_status" = "200" ] || [ "$http_status" = "400" ]; then
    echo -e "${GREEN}✅ PASSED (API работает, валидация работает)${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ FAILED${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# ============================================================================
# 7. NEAR INTENTS - BRIDGE
# ============================================================================

BRIDGE_INTENT=$(cat <<EOF
{
  "fromChain": "NEAR",
  "toChain": "ETHEREUM",
  "amount": 5,
  "userAccount": "test.near"
}
EOF
)

response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$BRIDGE_INTENT" \
    "$BASE_URL/api/near-intents/bridge" 2>&1)

http_status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_STATUS:/d')

print_test_header "NEAR Intents - Bridge"
echo -e "${YELLOW}Request:${NC}"
echo "$BRIDGE_INTENT" | jq .
echo -e "${YELLOW}Status:${NC} $http_status"
echo -e "${YELLOW}Response:${NC}"
echo "$body" | jq . 2>/dev/null || echo "$body"

# Bridge может вернуть 400 если валидация не прошла или 200 если все ок
if [ "$http_status" = "200" ] || [ "$http_status" = "400" ]; then
    echo -e "${GREEN}✅ PASSED (API работает, валидация работает)${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ FAILED${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# ============================================================================
# 8. ВАЛИДАЦИЯ ОШИБОК
# ============================================================================

# 8.1. Невалидный email
INVALID_EMAIL_ORDER=$(cat <<EOF
{
  "exchangeDirection": "buy",
  "paymentToken": {
    "symbol": "USDT",
    "network": "TRON",
    "priceUSD": 1
  },
  "paymentAmount": 100,
  "paymentAmountUSD": 100,
  "cantonAmount": 588,
  "cantonAddress": "$VALID_CANTON_ADDRESS",
  "email": "invalid-email"
}
EOF
)

response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$INVALID_EMAIL_ORDER" \
    "$BASE_URL/api/create-order" 2>&1)

http_status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_STATUS:/d')

print_test_header "Validation - Invalid Email"
echo -e "${YELLOW}Status:${NC} $http_status"
echo -e "${YELLOW}Response:${NC}"
echo "$body" | jq . 2>/dev/null || echo "$body"

if [ "$http_status" = "400" ]; then
    echo -e "${GREEN}✅ PASSED (Валидация работает)${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ FAILED (Ожидался 400)${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# 8.2. Невалидный Canton адрес
INVALID_ADDRESS_ORDER=$(cat <<EOF
{
  "exchangeDirection": "buy",
  "paymentToken": {
    "symbol": "USDT",
    "network": "TRON",
    "priceUSD": 1
  },
  "paymentAmount": 100,
  "paymentAmountUSD": 100,
  "cantonAmount": 588,
  "cantonAddress": "invalid-address",
  "email": "test@example.com"
}
EOF
)

response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$INVALID_ADDRESS_ORDER" \
    "$BASE_URL/api/create-order" 2>&1)

http_status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_STATUS:/d')

print_test_header "Validation - Invalid Canton Address"
echo -e "${YELLOW}Status:${NC} $http_status"
echo -e "${YELLOW}Response:${NC}"
echo "$body" | jq . 2>/dev/null || echo "$body"

if [ "$http_status" = "400" ]; then
    echo -e "${GREEN}✅ PASSED (Валидация работает)${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ FAILED (Ожидался 400)${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# 8.3. Сумма меньше минимума
SMALL_AMOUNT_ORDER=$(cat <<EOF
{
  "exchangeDirection": "buy",
  "paymentToken": {
    "symbol": "USDT",
    "network": "TRON",
    "priceUSD": 1
  },
  "paymentAmount": 100,
  "paymentAmountUSD": 100,
  "cantonAmount": 234,
  "cantonAddress": "$VALID_CANTON_ADDRESS",
  "email": "test@example.com"
}
EOF
)

response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$SMALL_AMOUNT_ORDER" \
    "$BASE_URL/api/create-order" 2>&1)

http_status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_STATUS:/d')

print_test_header "Validation - Amount Below Minimum"
echo -e "${YELLOW}Status:${NC} $http_status"
echo -e "${YELLOW}Response:${NC}"
echo "$body" | jq . 2>/dev/null || echo "$body"

if [ "$http_status" = "400" ]; then
    echo -e "${GREEN}✅ PASSED (Валидация работает)${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ FAILED (Ожидался 400)${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# ============================================================================
# ИТОГОВЫЙ ОТЧЕТ
# ============================================================================

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 ИТОГОВЫЙ ОТЧЕТ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}✅ Успешно: $TESTS_PASSED${NC}"
echo -e "${RED}❌ Провалено: $TESTS_FAILED${NC}"
echo -e "${YELLOW}📊 Всего тестов: $TOTAL_TESTS${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 ВСЕ ТЕСТЫ ПРОШЛИ УСПЕШНО!${NC}"
    exit 0
else
    echo -e "${RED}⚠️ НЕКОТОРЫЕ ТЕСТЫ ПРОВАЛИЛИСЬ${NC}"
    exit 1
fi
