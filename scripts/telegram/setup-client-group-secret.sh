#!/bin/bash

# 🔧 Настройка секрета для группы клиентов
# Автор: AI Assistant

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔧 НАСТРОЙКА СЕКРЕТА ДЛЯ ГРУППЫ КЛИЕНТОВ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Проверяем наличие токена
BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-${TELEGRAM_MEDIATOR_BOT_TOKEN}}"

if [ -z "$BOT_TOKEN" ]; then
    echo -e "${RED}❌ TELEGRAM_BOT_TOKEN не установлен${NC}"
    echo ""
    echo -e "${YELLOW}💡 Установите токен:${NC}"
    echo "   export TELEGRAM_BOT_TOKEN='your_bot_token'"
    exit 1
fi

echo -e "${YELLOW}📋 Получаю ID группы из последних обновлений...${NC}"
echo ""

# Получаем последние обновления
RESPONSE=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=-20")

if ! echo "$RESPONSE" | jq -e '.ok == true' > /dev/null 2>&1; then
    echo -e "${RED}❌ Ошибка получения обновлений${NC}"
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
    exit 1
fi

# Ищем группы с сообщением "ruheggs"
GROUPS=$(echo "$RESPONSE" | jq -r '.result[] | select(.message.chat.type == "group" or .message.chat.type == "supergroup") | select(.message.text | ascii_downcase | contains("ruheggs")) | {
    chat_id: .message.chat.id,
    chat_title: .message.chat.title,
    chat_type: .message.chat.type,
    message_text: .message.text,
    timestamp: .message.date
}')

if [ -z "$GROUPS" ] || [ "$GROUPS" = "null" ]; then
    echo -e "${YELLOW}⚠️ Группа с сообщением 'ruheggs' не найдена в последних обновлениях${NC}"
    echo ""
    echo -e "${YELLOW}💡 Попробуйте:${NC}"
    echo "1. Напишите 'ruheggs' в группе клиентов"
    echo "2. Запустите скрипт снова"
    echo ""
    echo -e "${YELLOW}Или введите ID группы вручную:${NC}"
    read -p "ID группы: " MANUAL_GROUP_ID
    
    if [ -z "$MANUAL_GROUP_ID" ]; then
        echo -e "${RED}❌ ID группы не указан${NC}"
        exit 1
    fi
    
    GROUP_ID="$MANUAL_GROUP_ID"
    GROUP_TITLE="Группа клиентов (введена вручную)"
else
    GROUP_ID=$(echo "$GROUPS" | jq -r '.chat_id' | head -1)
    GROUP_TITLE=$(echo "$GROUPS" | jq -r '.chat_title // "Группа клиентов"' | head -1)
    
    echo -e "${GREEN}✅ Найдена группа:${NC}"
    echo -e "   Название: ${BLUE}$GROUP_TITLE${NC}"
    echo -e "   ID: ${BLUE}$GROUP_ID${NC}"
    echo ""
fi

# Проверяем что ID валидный
if [ -z "$GROUP_ID" ] || [ "$GROUP_ID" = "null" ]; then
    echo -e "${RED}❌ Не удалось получить ID группы${NC}"
    exit 1
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📤 ДОБАВЛЕНИЕ В СЕКРЕТЫ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# GitHub Secrets
if command -v gh > /dev/null 2>&1; then
    echo -e "${YELLOW}🔐 Добавляю в GitHub Secrets...${NC}"
    if gh secret set TELEGRAM_CLIENT_GROUP_CHAT_ID -b "$GROUP_ID" 2>/dev/null; then
        echo -e "${GREEN}✅ Добавлено в GitHub Secrets${NC}"
    else
        echo -e "${YELLOW}⚠️ Не удалось добавить в GitHub Secrets (возможно нет прав)${NC}"
    fi
    echo ""
else
    echo -e "${YELLOW}ℹ️ GitHub CLI не установлен, пропускаю GitHub Secrets${NC}"
    echo ""
fi

# Kubernetes Secret
echo -e "${YELLOW}☸️  Добавляю в Kubernetes Secret...${NC}"
NAMESPACE="${KUBECTL_NAMESPACE:-canton-otc}"

# Проверяем существующий secret
if kubectl get secret telegram-client-group -n "$NAMESPACE" > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️ Secret уже существует, обновляю...${NC}"
    kubectl delete secret telegram-client-group -n "$NAMESPACE" > /dev/null 2>&1 || true
fi

# Создаем новый secret
if kubectl create secret generic telegram-client-group \
    --from-literal=TELEGRAM_CLIENT_GROUP_CHAT_ID="$GROUP_ID" \
    -n "$NAMESPACE" 2>/dev/null; then
    echo -e "${GREEN}✅ Добавлено в Kubernetes Secret${NC}"
    echo -e "   Namespace: ${BLUE}$NAMESPACE${NC}"
    echo -e "   Secret: ${BLUE}telegram-client-group${NC}"
else
    echo -e "${YELLOW}⚠️ Не удалось создать Kubernetes Secret (возможно нет доступа к кластеру)${NC}"
fi
echo ""

# Выводим команды для ручного добавления
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 КОМАНДЫ ДЛЯ РУЧНОГО ДОБАВЛЕНИЯ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}GitHub Secrets:${NC}"
echo "   gh secret set TELEGRAM_CLIENT_GROUP_CHAT_ID -b \"$GROUP_ID\""
echo ""
echo -e "${GREEN}Kubernetes Secret:${NC}"
echo "   kubectl create secret generic telegram-client-group \\"
echo "     --from-literal=TELEGRAM_CLIENT_GROUP_CHAT_ID=\"$GROUP_ID\" \\"
echo "     -n $NAMESPACE"
echo ""
echo -e "${GREEN}Environment Variable (для тестирования):${NC}"
echo "   export TELEGRAM_CLIENT_GROUP_CHAT_ID=\"$GROUP_ID\""
echo ""

# Сохраняем в файл
echo "$GROUP_ID" > /tmp/telegram_client_group_id.txt
echo -e "${GREEN}✅ ID группы сохранен в: /tmp/telegram_client_group_id.txt${NC}"
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}✅ НАСТРОЙКА ЗАВЕРШЕНА${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}💡 Следующие шаги:${NC}"
echo "1. Если добавили в Kubernetes Secret, обновите deployment:"
echo "   kubectl set env deployment/canton-otc -n $NAMESPACE \\"
echo "     TELEGRAM_CLIENT_GROUP_CHAT_ID=\"$GROUP_ID\""
echo ""
echo "2. Или добавьте в deployment.yaml:"
echo "   - name: TELEGRAM_CLIENT_GROUP_CHAT_ID"
echo "     valueFrom:"
echo "       secretKeyRef:"
echo "         name: telegram-client-group"
echo "         key: TELEGRAM_CLIENT_GROUP_CHAT_ID"
echo ""
echo "3. Перезапустите deployment:"
echo "   kubectl rollout restart deployment/canton-otc -n $NAMESPACE"
echo ""
