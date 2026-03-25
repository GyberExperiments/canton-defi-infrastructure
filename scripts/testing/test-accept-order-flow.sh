#!/bin/bash

# 🧪 Скрипт для автоматизированного тестирования флоу принятия заявок
# Использование: ./scripts/test-accept-order-flow.sh

set -e

BASE_URL="https://1otc.cc"
NAMESPACE="canton-otc"
TIMESTAMP=$(date +%s)

# Цвета для вывода
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}🧪 ТЕСТИРОВАНИЕ ФЛОУ ПРИНЯТИЯ ЗАЯВОК${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Функция для проверки результата
check_result() {
  local test_name="$1"
  local result="$2"
  if [ "$result" = "true" ] || [ "$result" = "0" ]; then
    echo -e "${GREEN}✅ $test_name${NC}"
    return 0
  else
    echo -e "${RED}❌ $test_name${NC}"
    return 1
  fi
}

# Функция для логирования
log_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
  echo -e "${RED}❌ $1${NC}"
}

log_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

# ============================================
# ПРЕДВАРИТЕЛЬНАЯ ПРОВЕРКА
# ============================================

echo -e "${BLUE}📋 ПРЕДВАРИТЕЛЬНАЯ ПРОВЕРКА${NC}"
echo "─────────────────────────────────────────"

# 1. Проверка доступности API
log_info "Проверка доступности API..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL" || echo "000")
if [ "$HTTP_STATUS" = "200" ]; then
  log_success "API доступен (HTTP $HTTP_STATUS)"
else
  log_error "API недоступен (HTTP $HTTP_STATUS)"
  exit 1
fi

# 2. Проверка статуса подов
log_info "Проверка статуса подов..."
if command -v kubectl &> /dev/null; then
  PODS=$(kubectl get pods -n "$NAMESPACE" -l app=canton-otc --no-headers 2>/dev/null | grep -v "auto-update" | wc -l | tr -d ' ')
  if [ "$PODS" -ge "1" ]; then
    log_success "Найдено подов: $PODS"
  else
    log_warning "Поды не найдены или kubectl недоступен"
  fi
else
  log_warning "kubectl не установлен, пропускаем проверку подов"
fi

# 3. Проверка переменных окружения
log_info "Проверка переменных окружения..."
if command -v kubectl &> /dev/null; then
  ENV_CHECK=$(kubectl exec -n "$NAMESPACE" deployment/canton-otc -- env 2>/dev/null | grep -E "TELEGRAM_CLIENT_GROUP_CHAT_ID|TELEGRAM_CHAT_ID|NEXT_PUBLIC_SUPABASE_URL" | wc -l | tr -d ' ')
  if [ "$ENV_CHECK" -ge "2" ]; then
    log_success "Переменные окружения настроены"
  else
    log_warning "Не все переменные окружения найдены"
  fi
else
  log_warning "kubectl недоступен, пропускаем проверку переменных"
fi

echo ""

# ============================================
# ТЕСТ 1: Создание публичной заявки
# ============================================

echo -e "${BLUE}🧪 ТЕСТ 1: Создание публичной заявки${NC}"
echo "─────────────────────────────────────────"

# Получаем текущие цены
log_info "Получение текущих цен..."
CONFIG=$(curl -s "$BASE_URL/api/config")
BUY_PRICE=$(echo "$CONFIG" | jq -r '.cantonCoinBuyPrice // .cantonCoinBuyPrice // 0.2')

if [ "$BUY_PRICE" = "null" ] || [ -z "$BUY_PRICE" ] || [ "$BUY_PRICE" = "0" ]; then
  BUY_PRICE="0.2"  # Fallback цена
  log_warning "Не удалось получить цену, используем fallback: $BUY_PRICE"
fi

USDT_AMOUNT=1000
BASE=$(echo "scale=10; $USDT_AMOUNT / $BUY_PRICE" | bc)
CANTON_AMOUNT=$(echo "scale=0; $BASE * 0.99" | bc)

log_info "USDT: $USDT_AMOUNT, Buy Price: $BUY_PRICE, Canton: $CANTON_AMOUNT"

# Создаем публичную заявку
PUBLIC_ORDER=$(curl -X POST "$BASE_URL/api/create-order" \
  -H "Content-Type: application/json" \
  -d "{
    \"cantonAddress\": \"04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8\",
    \"refundAddress\": \"bron::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8\",
    \"usdtAmount\": $USDT_AMOUNT,
    \"cantonAmount\": $CANTON_AMOUNT,
    \"email\": \"test-public-$TIMESTAMP@example.com\",
    \"exchangeDirection\": \"buy\",
    \"isMarketPrice\": true,
    \"isPrivateDeal\": false
  }" -s)

PUBLIC_ORDER_ID=$(echo "$PUBLIC_ORDER" | jq -r '.orderId // empty')

if [ -n "$PUBLIC_ORDER_ID" ] && [ "$PUBLIC_ORDER_ID" != "null" ]; then
  log_success "Публичная заявка создана: $PUBLIC_ORDER_ID"
  echo "$PUBLIC_ORDER" | jq '{
    success,
    orderId,
    isPrivateDeal,
    isMarketPrice
  }'
else
  log_error "Не удалось создать публичную заявку"
  echo "$PUBLIC_ORDER" | jq '.'
  exit 1
fi

# Проверка в логах (если доступен kubectl)
if command -v kubectl &> /dev/null; then
  sleep 3
  log_info "Проверка логов публикации в Telegram..."
  kubectl logs -n "$NAMESPACE" deployment/canton-otc --tail=200 2>/dev/null | grep -i "sendPublicOrderNotification\|Order published\|NEW OTC ORDER" | tail -3 || log_warning "Логи не найдены"
fi

echo ""

# ============================================
# ТЕСТ 2: Создание приватной заявки
# ============================================

echo -e "${BLUE}🧪 ТЕСТ 2: Создание приватной заявки${NC}"
echo "─────────────────────────────────────────"

PRIVATE_ORDER=$(curl -X POST "$BASE_URL/api/create-order" \
  -H "Content-Type: application/json" \
  -d "{
    \"cantonAddress\": \"04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8\",
    \"refundAddress\": \"bron::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8\",
    \"usdtAmount\": $USDT_AMOUNT,
    \"cantonAmount\": $CANTON_AMOUNT,
    \"email\": \"test-private-$TIMESTAMP@example.com\",
    \"exchangeDirection\": \"buy\",
    \"isMarketPrice\": true,
    \"isPrivateDeal\": true
  }" -s)

PRIVATE_ORDER_ID=$(echo "$PRIVATE_ORDER" | jq -r '.orderId // empty')

if [ -n "$PRIVATE_ORDER_ID" ] && [ "$PRIVATE_ORDER_ID" != "null" ]; then
  log_success "Приватная заявка создана: $PRIVATE_ORDER_ID"
  echo "$PRIVATE_ORDER" | jq '{
    success,
    orderId,
    isPrivateDeal,
    isMarketPrice
  }'
else
  log_error "Не удалось создать приватную заявку"
  echo "$PRIVATE_ORDER" | jq '.'
  exit 1
fi

# Проверка в логах
if command -v kubectl &> /dev/null; then
  sleep 3
  log_info "Проверка логов (должно быть 'Skipped (private deal)')..."
  kubectl logs -n "$NAMESPACE" deployment/canton-otc --tail=200 2>/dev/null | grep -i "private deal\|Skipped.*private" | tail -3 || log_warning "Логи не найдены"
fi

echo ""

# ============================================
# ТЕСТ 3: Проверка заявок через API
# ============================================

echo -e "${BLUE}🧪 ТЕСТ 3: Проверка заявок через API${NC}"
echo "─────────────────────────────────────────"

log_info "Проверка публичной заявки через API..."
PUBLIC_STATUS=$(curl -s "$BASE_URL/api/order/$PUBLIC_ORDER_ID" 2>/dev/null || echo "{}")
PUBLIC_STATUS_CHECK=$(echo "$PUBLIC_STATUS" | jq -r '.orderId // empty')

if [ -n "$PUBLIC_STATUS_CHECK" ] && [ "$PUBLIC_STATUS_CHECK" = "$PUBLIC_ORDER_ID" ]; then
  log_success "Публичная заявка найдена через API"
  echo "$PUBLIC_STATUS" | jq '{
    orderId,
    status,
    isPrivateDeal,
    email
  }'
else
  log_warning "Публичная заявка не найдена через API (может быть еще не синхронизирована)"
fi

log_info "Проверка приватной заявки через API..."
PRIVATE_STATUS=$(curl -s "$BASE_URL/api/order/$PRIVATE_ORDER_ID" 2>/dev/null || echo "{}")
PRIVATE_STATUS_CHECK=$(echo "$PRIVATE_STATUS" | jq -r '.orderId // empty')

if [ -n "$PRIVATE_STATUS_CHECK" ] && [ "$PRIVATE_STATUS_CHECK" = "$PRIVATE_ORDER_ID" ]; then
  log_success "Приватная заявка найдена через API"
  echo "$PRIVATE_STATUS" | jq '{
    orderId,
    status,
    isPrivateDeal,
    email
  }'
else
  log_warning "Приватная заявка не найдена через API (может быть еще не синхронизирована)"
fi

echo ""

# ============================================
# ИТОГОВАЯ ИНФОРМАЦИЯ
# ============================================

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}📊 ИТОГОВАЯ ИНФОРМАЦИЯ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}✅ Созданные заявки:${NC}"
echo "  Публичная: $PUBLIC_ORDER_ID"
echo "  Приватная: $PRIVATE_ORDER_ID"
echo ""
echo -e "${YELLOW}📋 Следующие шаги (вручную в Telegram):${NC}"
echo ""
echo "1. Откройте клиентскую группу Telegram (-5039619304)"
echo "2. Найдите заявку с Order ID: $PUBLIC_ORDER_ID"
echo "3. Нажмите 'Принять заявку' (как тейкер)"
echo "4. Проверьте что:"
echo "   - Статус обновился: pending → client_accepted"
echo "   - Сообщение в группе обновилось (TAKEN BY: @username)"
echo "   - Получили сообщение в личный чат с кнопкой"
echo ""
echo "5. Откройте админский чат (-4872025335)"
echo "6. Для публичной заявки: нажмите 'Принять заявку' (статус должен быть client_accepted)"
echo "7. Для приватной заявки: нажмите 'Принять заявку' (можно из pending)"
echo ""
echo -e "${BLUE}🔍 Проверка логов после действий в Telegram:${NC}"
echo ""
echo "# Проверка принятия тейкером:"
echo "kubectl logs -n $NAMESPACE deployment/canton-otc --tail=500 | grep -E 'accept_order|Client accepted|Taker redirected' | tail -20"
echo ""
echo "# Проверка принятия админом:"
echo "kubectl logs -n $NAMESPACE deployment/canton-otc --tail=500 | grep -E 'Admin accepted|isAdminChat.*true|status.*accepted' | tail -10"
echo ""
echo "# Проверка статусов через API:"
echo "curl -s '$BASE_URL/api/order/$PUBLIC_ORDER_ID' | jq '{orderId, status, isPrivateDeal}'"
echo "curl -s '$BASE_URL/api/order/$PRIVATE_ORDER_ID' | jq '{orderId, status, isPrivateDeal}'"
echo ""
