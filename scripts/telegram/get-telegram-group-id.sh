#!/bin/bash

# 🔍 Получить ID Telegram группы через API
# Автор: AI Assistant

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔍 ПОЛУЧЕНИЕ ID TELEGRAM ГРУППЫ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Проверяем наличие токена
BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-${TELEGRAM_MEDIATOR_BOT_TOKEN}}"

if [ -z "$BOT_TOKEN" ]; then
    echo -e "${RED}❌ TELEGRAM_BOT_TOKEN или TELEGRAM_MEDIATOR_BOT_TOKEN не установлен${NC}"
    echo ""
    echo -e "${YELLOW}💡 Использование:${NC}"
    echo "   export TELEGRAM_BOT_TOKEN='your_bot_token'"
    echo "   bash scripts/get-telegram-group-id.sh"
    echo ""
    exit 1
fi

echo -e "${YELLOW}📋 Инструкция:${NC}"
echo "1. Добавьте бота в группу клиентов"
echo "2. Сделайте бота администратором"
echo "3. Напишите в группе любое сообщение (например: 'test')"
echo "4. Нажмите Enter для получения обновлений..."
echo ""
read -p "Нажмите Enter когда готовы..."

echo ""
echo -e "${YELLOW}🔍 Получаю обновления от Telegram...${NC}"

# Получаем последние обновления
RESPONSE=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=-10")

# Проверяем ответ
if echo "$RESPONSE" | jq -e '.ok == true' > /dev/null 2>&1; then
    # Ищем группы в обновлениях
    GROUPS=$(echo "$RESPONSE" | jq -r '.result[] | select(.message.chat.type == "group" or .message.chat.type == "supergroup") | {
        chat_id: .message.chat.id,
        chat_title: .message.chat.title,
        chat_type: .message.chat.type,
        last_message: .message.text,
        timestamp: .message.date
    }' | jq -s '.')

    if [ "$(echo "$GROUPS" | jq 'length')" -gt 0 ]; then
        echo ""
        echo -e "${GREEN}✅ Найдены группы:${NC}"
        echo ""
        echo "$GROUPS" | jq -r '.[] | "📋 Группа: \(.chat_title // "Без названия")\n   ID: \(.chat_id)\n   Тип: \(.chat_type)\n   Последнее сообщение: \(.last_message // "нет")\n"'
        echo ""
        
        # Предлагаем выбрать группу
        echo -e "${YELLOW}💡 Для добавления в секреты используйте:${NC}"
        echo ""
        FIRST_GROUP_ID=$(echo "$GROUPS" | jq -r '.[0].chat_id')
        FIRST_GROUP_TITLE=$(echo "$GROUPS" | jq -r '.[0].chat_title // "Группа клиентов"')
        
        echo -e "${BLUE}GitHub Secrets:${NC}"
        echo "   gh secret set TELEGRAM_CLIENT_GROUP_CHAT_ID -b \"${FIRST_GROUP_ID}\""
        echo ""
        echo -e "${BLUE}Kubernetes Secret:${NC}"
        echo "   kubectl create secret generic telegram-client-group \\"
        echo "     --from-literal=TELEGRAM_CLIENT_GROUP_CHAT_ID=\"${FIRST_GROUP_ID}\" \\"
        echo "     -n canton-otc --dry-run=client -o yaml | kubectl apply -f -"
        echo ""
        echo -e "${BLUE}Environment Variable:${NC}"
        echo "   export TELEGRAM_CLIENT_GROUP_CHAT_ID=\"${FIRST_GROUP_ID}\""
        echo ""
        
        # Сохраняем в файл для удобства
        echo "${FIRST_GROUP_ID}" > /tmp/telegram_client_group_id.txt
        echo -e "${GREEN}✅ ID группы сохранен в: /tmp/telegram_client_group_id.txt${NC}"
        
    else
        echo -e "${YELLOW}⚠️ Группы не найдены в последних обновлениях${NC}"
        echo ""
        echo -e "${YELLOW}💡 Попробуйте:${NC}"
        echo "1. Написать сообщение в группе"
        echo "2. Запустить скрипт снова"
        echo ""
        echo -e "${YELLOW}Или используйте альтернативный способ:${NC}"
        echo "1. Добавьте бота @userinfobot в группу"
        echo "2. Бот покажет ID группы"
    fi
else
    echo -e "${RED}❌ Ошибка получения обновлений${NC}"
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
    exit 1
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
