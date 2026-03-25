#!/bin/bash

# 🔧 СКРИПТ ПРОВЕРКИ И ТЕСТИРОВАНИЯ СИСТЕМЫ ПРИНЯТИЯ ОРДЕРОВ CANTON OTC
# Проверяет конфигурацию, создает тестовую заявку и проверяет работу кнопки "Принять заявку"

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Конфигурация
NAMESPACE="${NAMESPACE:-canton-otc}"
DEPLOYMENT="${DEPLOYMENT:-canton-otc}"
API_URL="${API_URL:-https://1otc.cc}"
WEBHOOK_URL="${WEBHOOK_URL:-https://1otc.cc/api/telegram-mediator/webhook}"

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}🔧 ПРОВЕРКА СИСТЕМЫ ПРИНЯТИЯ ОРДЕРОВ CANTON OTC${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

# Функция для проверки команды
check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo -e "${RED}❌ Команда $1 не найдена${NC}"
        exit 1
    fi
}

# Проверка зависимостей
echo -e "${BLUE}📋 Проверка зависимостей...${NC}"
check_command kubectl
check_command curl
check_command jq
echo -e "${GREEN}✅ Все зависимости установлены${NC}"
echo ""

# 1. ПРОВЕРКА ENV ПЕРЕМЕННЫХ
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}1️⃣ ПРОВЕРКА ENV ПЕРЕМЕННЫХ В K8S${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"

echo -e "${YELLOW}Проверяю переменные Telegram...${NC}"
TELEGRAM_VARS=$(kubectl exec -n "$NAMESPACE" deployment/"$DEPLOYMENT" -- env 2>/dev/null | grep -E "TELEGRAM" || echo "")

if [ -z "$TELEGRAM_VARS" ]; then
    echo -e "${RED}❌ Не удалось получить переменные Telegram${NC}"
    echo -e "${YELLOW}Проверьте доступ к поду: kubectl get pods -n $NAMESPACE${NC}"
    exit 1
fi

echo "$TELEGRAM_VARS" | while IFS= read -r line; do
    VAR_NAME=$(echo "$line" | cut -d'=' -f1)
    VAR_VALUE=$(echo "$line" | cut -d'=' -f2-)
    
    if [ "$VAR_NAME" = "TELEGRAM_BOT_TOKEN" ]; then
        if [ -n "$VAR_VALUE" ]; then
            MASKED_VALUE="${VAR_VALUE:0:10}...${VAR_VALUE: -4}"
            echo -e "${GREEN}✅ $VAR_NAME: $MASKED_VALUE${NC}"
        else
            echo -e "${RED}❌ $VAR_NAME: не установлена${NC}"
        fi
    elif [ "$VAR_NAME" = "TELEGRAM_CHAT_ID" ]; then
        echo -e "${GREEN}✅ $VAR_NAME: $VAR_VALUE (группа операторов)${NC}"
    elif [ "$VAR_NAME" = "TELEGRAM_CLIENT_GROUP_CHAT_ID" ]; then
        if [ -n "$VAR_VALUE" ]; then
            echo -e "${GREEN}✅ $VAR_NAME: $VAR_VALUE (группа клиентов)${NC}"
        else
            echo -e "${YELLOW}⚠️  $VAR_NAME: не настроена (будет использован fallback на группу операторов)${NC}"
        fi
    else
        echo -e "${BLUE}ℹ️  $VAR_NAME: ${VAR_VALUE:0:20}...${NC}"
    fi
done

echo ""
echo -e "${YELLOW}Проверяю переменные Supabase...${NC}"
SUPABASE_VARS=$(kubectl exec -n "$NAMESPACE" deployment/"$DEPLOYMENT" -- env 2>/dev/null | grep -E "SUPABASE" || echo "")

if [ -z "$SUPABASE_VARS" ]; then
    echo -e "${RED}❌ Supabase переменные не найдены${NC}"
    echo -e "${YELLOW}⚠️  Система будет работать только с Google Sheets${NC}"
else
    echo "$SUPABASE_VARS" | while IFS= read -r line; do
        VAR_NAME=$(echo "$line" | cut -d'=' -f1)
        VAR_VALUE=$(echo "$line" | cut -d'=' -f2-)
        
        if [ "$VAR_NAME" = "NEXT_PUBLIC_SUPABASE_URL" ]; then
            if [ -n "$VAR_VALUE" ]; then
                echo -e "${GREEN}✅ $VAR_NAME: $VAR_VALUE${NC}"
            else
                echo -e "${RED}❌ $VAR_NAME: не установлена${NC}"
            fi
        elif [ "$VAR_NAME" = "SUPABASE_SERVICE_ROLE_KEY" ]; then
            if [ -n "$VAR_VALUE" ]; then
                MASKED_VALUE="${VAR_VALUE:0:10}...${VAR_VALUE: -4}"
                echo -e "${GREEN}✅ $VAR_NAME: $MASKED_VALUE${NC}"
            else
                echo -e "${RED}❌ $VAR_NAME: не установлена${NC}"
            fi
        fi
    done
fi

echo ""

# 2. ПРОВЕРКА ЛОГОВ
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}2️⃣ ПРОВЕРКА ЛОГОВ${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"

echo -e "${YELLOW}Последние 50 строк логов...${NC}"
RECENT_LOGS=$(kubectl logs -n "$NAMESPACE" deployment/"$DEPLOYMENT" --tail=50 2>/dev/null || echo "")

if [ -z "$RECENT_LOGS" ]; then
    echo -e "${RED}❌ Не удалось получить логи${NC}"
else
    echo "$RECENT_LOGS" | tail -20
fi

echo ""

# 3. ПРОВЕРКА WEBHOOK
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}3️⃣ ПРОВЕРКА WEBHOOK${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"

echo -e "${YELLOW}Тестирую webhook endpoint...${NC}"
WEBHOOK_RESPONSE=$(curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"message": {"text": "test", "chat": {"id": 123, "type": "private"}, "from": {"id": 123, "first_name": "Test"}}}' || echo "")

if [ -n "$WEBHOOK_RESPONSE" ]; then
    echo "$WEBHOOK_RESPONSE" | jq . 2>/dev/null || echo "$WEBHOOK_RESPONSE"
    echo -e "${GREEN}✅ Webhook отвечает${NC}"
else
    echo -e "${RED}❌ Webhook не отвечает${NC}"
fi

echo ""

# 4. СОЗДАНИЕ ТЕСТОВОЙ ЗАЯВКИ
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}4️⃣ СОЗДАНИЕ ТЕСТОВОЙ ЗАЯВКИ${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"

# Генерируем уникальный order ID для теста
RANDOM_NUM=$((RANDOM % 9000 + 1000))
TEST_ORDER_ID="TEST-$(date +%s)-${RANDOM_NUM}"
TEST_EMAIL="test-$(date +%s)@example.com"

echo -e "${YELLOW}Создаю тестовую заявку...${NC}"
echo -e "${BLUE}Order ID: $TEST_ORDER_ID${NC}"
echo -e "${BLUE}Email: $TEST_EMAIL${NC}"

CREATE_ORDER_RESPONSE=$(curl -s -X POST "$API_URL/api/create-order" \
  -H "Content-Type: application/json" \
  -d "{
    \"cantonAddress\": \"04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8\",
    \"usdtAmount\": 700,
    \"cantonAmount\": 1591,
    \"email\": \"$TEST_EMAIL\",
    \"exchangeDirection\": \"buy\"
  }" || echo "")

if [ -n "$CREATE_ORDER_RESPONSE" ]; then
    echo "$CREATE_ORDER_RESPONSE" | jq . 2>/dev/null || echo "$CREATE_ORDER_RESPONSE"
    
    # Извлекаем order ID из ответа
    ACTUAL_ORDER_ID=$(echo "$CREATE_ORDER_RESPONSE" | jq -r '.orderId // empty' 2>/dev/null || echo "")
    
    if [ -n "$ACTUAL_ORDER_ID" ]; then
        echo -e "${GREEN}✅ Заявка создана: $ACTUAL_ORDER_ID${NC}"
        TEST_ORDER_ID="$ACTUAL_ORDER_ID"
    else
        echo -e "${YELLOW}⚠️  Не удалось извлечь order ID из ответа${NC}"
    fi
else
    echo -e "${RED}❌ Не удалось создать заявку${NC}"
    exit 1
fi

echo ""

# 5. ПРОВЕРКА ЛОГОВ ПОСЛЕ СОЗДАНИЯ ЗАЯВКИ
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}5️⃣ ПРОВЕРКА ЛОГОВ ПОСЛЕ СОЗДАНИЯ ЗАЯВКИ${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"

echo -e "${YELLOW}Жду 3 секунды для обработки...${NC}"
sleep 3

echo -e "${YELLOW}Ищу логи связанные с заявкой $TEST_ORDER_ID...${NC}"
ORDER_LOGS=$(kubectl logs -n "$NAMESPACE" deployment/"$DEPLOYMENT" --tail=200 --since=1m 2>/dev/null | grep -iE "$TEST_ORDER_ID|sendPublicOrderNotification|Publishing order|Order published|public_orders" || echo "")

if [ -n "$ORDER_LOGS" ]; then
    echo "$ORDER_LOGS"
    
    # Проверяем ключевые моменты
    if echo "$ORDER_LOGS" | grep -q "sendPublicOrderNotification"; then
        echo -e "${GREEN}✅ sendPublicOrderNotification вызван${NC}"
    else
        echo -e "${YELLOW}⚠️  sendPublicOrderNotification не найден в логах${NC}"
    fi
    
    if echo "$ORDER_LOGS" | grep -q "Order published to channel"; then
        echo -e "${GREEN}✅ Заявка опубликована в канал${NC}"
    else
        echo -e "${YELLOW}⚠️  Публикация в канал не найдена в логах${NC}"
    fi
    
    if echo "$ORDER_LOGS" | grep -q "public_orders"; then
        echo -e "${GREEN}✅ Запись в public_orders найдена${NC}"
    else
        echo -e "${YELLOW}⚠️  Запись в public_orders не найдена в логах${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Логи по заявке не найдены${NC}"
fi

echo ""

# 6. ИНСТРУКЦИИ ПО ТЕСТИРОВАНИЮ КНОПКИ
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}6️⃣ ИНСТРУКЦИИ ПО ТЕСТИРОВАНИЮ КНОПКИ \"ПРИНЯТЬ ЗАЯВКУ\"${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"

echo -e "${YELLOW}📋 РУЧНОЕ ТЕСТИРОВАНИЕ:${NC}"
echo ""
echo -e "1. Откройте группу клиентов в Telegram: ${GREEN}1OTC_ORDERS${NC}"
echo -e "2. Найдите сообщение с заявкой ${GREEN}$TEST_ORDER_ID${NC}"
echo -e "3. Нажмите кнопку ${GREEN}✅ Принять заявку${NC}"
echo -e "4. Проверьте логи командой:"
echo -e "   ${BLUE}kubectl logs -n $NAMESPACE deployment/$DEPLOYMENT --tail=100 | grep -iE \"accept|$TEST_ORDER_ID\"${NC}"
echo ""
echo -e "${YELLOW}📊 ПРОВЕРКА СТАТУСА В БАЗЕ:${NC}"
echo ""
echo -e "Если Supabase настроен, проверьте статус заявки:"
echo -e "   ${BLUE}SELECT * FROM public_orders WHERE order_id = '$TEST_ORDER_ID';${NC}"
echo ""

# 7. ФИНАЛЬНАЯ СВОДКА
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}📊 СВОДКА${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"

echo -e "${GREEN}✅ Тестовая заявка создана: $TEST_ORDER_ID${NC}"
echo ""
echo -e "${YELLOW}Следующие шаги:${NC}"
echo -e "1. Проверьте группу ${GREEN}1OTC_ORDERS${NC} в Telegram"
echo -e "2. Нажмите кнопку ${GREEN}✅ Принять заявку${NC}"
echo -e "3. Проверьте логи: ${BLUE}kubectl logs -n $NAMESPACE deployment/$DEPLOYMENT --tail=100 | grep accept${NC}"
echo -e "4. Проверьте статус в базе (если Supabase настроен)"
echo ""

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Проверка завершена${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
