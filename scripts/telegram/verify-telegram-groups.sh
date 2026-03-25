#!/bin/bash

# 🔍 Проверка что заявки приходят в обе группы Telegram
# Автор: AI Assistant

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

ORDER_ID="${1:-}"
NAMESPACE="${KUBECTL_NAMESPACE:-canton-otc-minimal-stage}"
DEPLOYMENT="${KUBECTL_DEPLOYMENT:-canton-otc}"

if [ -z "$ORDER_ID" ]; then
    echo -e "${RED}❌ Укажите Order ID${NC}"
    echo "Использование: bash scripts/verify-telegram-groups.sh <ORDER_ID>"
    exit 1
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔍 ПРОВЕРКА ОТПРАВКИ ЗАЯВКИ В TELEGRAM ГРУППЫ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}Order ID: ${BLUE}${ORDER_ID}${NC}"
echo ""

# Получаем логи
echo -e "${YELLOW}📋 Получаю логи...${NC}"
LOGS=$(kubectl logs -n "$NAMESPACE" deployment/"$DEPLOYMENT" --tail=500 --since=5m 2>/dev/null)

# Проверяем отправку в группу клиентов (sendPublicOrderNotification)
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}1. ГРУППА КЛИЕНТОВ (sendPublicOrderNotification)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

CLIENT_GROUP_LOGS=$(echo "$LOGS" | grep -iE "${ORDER_ID}.*Publishing order to client group|${ORDER_ID}.*Order published to channel|sendPublicOrderNotification.*${ORDER_ID}" || echo "")

if [ -n "$CLIENT_GROUP_LOGS" ]; then
    echo -e "${GREEN}✅ Найдены логи отправки в группу клиентов:${NC}"
    echo "$CLIENT_GROUP_LOGS" | head -5
    echo ""
    
    # Проверяем что указан правильный chatId
    if echo "$CLIENT_GROUP_LOGS" | grep -qi "client group\|-5039619304"; then
        echo -e "${GREEN}✅ Chat ID группы клиентов найден в логах${NC}"
    else
        echo -e "${YELLOW}⚠️ Chat ID группы клиентов не найден в логах${NC}"
    fi
else
    echo -e "${RED}❌ Логи отправки в группу клиентов не найдены${NC}"
    echo ""
    echo -e "${YELLOW}Проверяю все логи с Order ID:${NC}"
    echo "$LOGS" | grep -i "$ORDER_ID" | head -10
fi

echo ""

# Проверяем отправку в группу нотификаций (sendOrderNotification)
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}2. ГРУППА НОТИФИКАЦИЙ (sendOrderNotification)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

NOTIFICATION_GROUP_LOGS=$(echo "$LOGS" | grep -iE "${ORDER_ID}.*Telegram notification sent|sendOrderNotification.*${ORDER_ID}|📱 Telegram notification sent successfully" || echo "")

if [ -n "$NOTIFICATION_GROUP_LOGS" ]; then
    echo -e "${GREEN}✅ Найдены логи отправки в группу нотификаций:${NC}"
    echo "$NOTIFICATION_GROUP_LOGS" | head -5
    echo ""
else
    echo -e "${RED}❌ Логи отправки в группу нотификаций не найдены${NC}"
fi

echo ""

# Общая информация
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}3. ОБРАБОТКА ЗАЯВКИ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

PROCESSING_LOGS=$(echo "$LOGS" | grep -iE "${ORDER_ID}.*Starting background|${ORDER_ID}.*background processing" || echo "")

if [ -n "$PROCESSING_LOGS" ]; then
    echo -e "${GREEN}✅ Заявка обрабатывается:${NC}"
    echo "$PROCESSING_LOGS" | head -3
else
    echo -e "${YELLOW}⚠️ Логи обработки не найдены${NC}"
fi

echo ""

# Итоговая проверка
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 ИТОГОВАЯ ПРОВЕРКА${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

CLIENT_OK=false
NOTIFICATION_OK=false

if [ -n "$CLIENT_GROUP_LOGS" ]; then
    CLIENT_OK=true
    echo -e "${GREEN}✅ Группа клиентов: ОК${NC}"
else
    echo -e "${RED}❌ Группа клиентов: НЕ НАЙДЕНО${NC}"
fi

if [ -n "$NOTIFICATION_GROUP_LOGS" ]; then
    NOTIFICATION_OK=true
    echo -e "${GREEN}✅ Группа нотификаций: ОК${NC}"
else
    echo -e "${RED}❌ Группа нотификаций: НЕ НАЙДЕНО${NC}"
fi

echo ""

if [ "$CLIENT_OK" = true ] && [ "$NOTIFICATION_OK" = true ]; then
    echo -e "${GREEN}🎉 ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ! Заявка отправлена в обе группы.${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️ НЕ ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ${NC}"
    echo ""
    echo -e "${YELLOW}💡 Проверьте вручную в Telegram:${NC}"
    echo "   1. Группа клиентов (1OTC_ORDERS): должна быть заявка с ID $ORDER_ID"
    echo "   2. Группа нотификаций: должна быть заявка с ID $ORDER_ID"
    exit 1
fi


