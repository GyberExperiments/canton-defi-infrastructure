#!/bin/bash

# 🔍 Получить ID группы клиентов через Telegram API используя токен из Kubernetes
# Автор: AI Assistant

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔍 ПОЛУЧЕНИЕ ID ГРУППЫ ЧЕРЕЗ TELEGRAM API${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

NAMESPACE="${KUBECTL_NAMESPACE:-canton-otc}"
DEPLOYMENT="${KUBECTL_DEPLOYMENT:-canton-otc}"

echo -e "${YELLOW}📋 Получаю токен бота из Kubernetes...${NC}"

# Пробуем получить токен медиатора (который обрабатывает сообщения)
BOT_TOKEN=$(kubectl get secret canton-otc-secrets-minimal-stage -n "$NAMESPACE" -o jsonpath='{.data.TELEGRAM_MEDIATOR_BOT_TOKEN}' 2>/dev/null | base64 -d 2>/dev/null || echo "")

if [ -z "$BOT_TOKEN" ]; then
    # Пробуем основной токен
    BOT_TOKEN=$(kubectl get secret canton-otc-secrets-minimal-stage -n "$NAMESPACE" -o jsonpath='{.data.TELEGRAM_BOT_TOKEN}' 2>/dev/null | base64 -d 2>/dev/null || echo "")
fi

if [ -z "$BOT_TOKEN" ]; then
    echo -e "${RED}❌ Не удалось получить токен бота из Kubernetes${NC}"
    echo ""
    echo -e "${YELLOW}💡 Попробуйте указать токен вручную:${NC}"
    echo "   export TELEGRAM_MEDIATOR_BOT_TOKEN='your_token'"
    echo "   bash scripts/get-group-id-from-k8s.sh"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ Токен получен${NC}"
echo ""

echo -e "${YELLOW}📋 Получаю последние обновления от Telegram...${NC}"

# Получаем последние обновления
RESPONSE=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=-50&timeout=5")

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
    echo "2. Подождите несколько секунд"
    echo "3. Запустите скрипт снова"
    echo ""
    
    # Показываем все найденные группы для справки
    ALL_GROUPS=$(echo "$RESPONSE" | jq -r '.result[] | select(.message.chat.type == "group" or .message.chat.type == "supergroup") | {
        chat_id: .message.chat.id,
        chat_title: .message.chat.title,
        last_message: .message.text
    }' | jq -s '.')
    
    if [ -n "$ALL_GROUPS" ] && [ "$ALL_GROUPS" != "null" ] && [ "$(echo "$ALL_GROUPS" | jq 'length')" -gt 0 ]; then
        echo -e "${YELLOW}📋 Найденные группы (без 'ruheggs'):${NC}"
        echo "$ALL_GROUPS" | jq -r '.[] | "   - \(.chat_title // "Без названия"): \(.chat_id)"'
        echo ""
        echo -e "${YELLOW}💡 Если одна из этих групп - группа клиентов, используйте её ID:${NC}"
        FIRST_GROUP_ID=$(echo "$ALL_GROUPS" | jq -r '.[0].chat_id')
        echo "   GROUP_ID=\"$FIRST_GROUP_ID\""
        echo ""
        read -p "Введите ID группы (или нажмите Enter для выхода): " MANUAL_GROUP_ID
        
        if [ -z "$MANUAL_GROUP_ID" ]; then
            exit 1
        fi
        
        GROUP_ID="$MANUAL_GROUP_ID"
        GROUP_TITLE="Группа клиентов (введена вручную)"
    else
        exit 1
    fi
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
echo -e "${YELLOW}☸️  Обновляю Kubernetes Secret...${NC}"

# Добавляем новый ключ в существующий secret
if kubectl patch secret canton-otc-secrets-minimal-stage -n "$NAMESPACE" \
    --type='json' \
    -p="[{\"op\": \"add\", \"path\": \"/data/TELEGRAM_CLIENT_GROUP_CHAT_ID\", \"value\": \"$(echo -n "$GROUP_ID" | base64)\"}]" 2>/dev/null; then
    echo -e "${GREEN}✅ Обновлен Kubernetes Secret${NC}"
    echo -e "   Namespace: ${BLUE}$NAMESPACE${NC}"
    echo -e "   Secret: ${BLUE}canton-otc-secrets-minimal-stage${NC}"
else
    echo -e "${YELLOW}⚠️ Не удалось обновить secret (попробуйте создать новый)${NC}"
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
echo -e "${GREEN}Kubernetes Secret (обновить существующий):${NC}"
echo "   kubectl patch secret canton-otc-secrets-minimal-stage -n $NAMESPACE \\"
echo "     --type='json' \\"
echo "     -p='[{\"op\": \"add\", \"path\": \"/data/TELEGRAM_CLIENT_GROUP_CHAT_ID\", \"value\": \"$(echo -n "$GROUP_ID" | base64)\"}]'"
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
echo "1. Если добавили в GitHub Secrets, External Secret автоматически синхронизирует"
echo "2. Или примените external-secret вручную:"
echo "   kubectl apply -f config/kubernetes/k8s/minimal-stage/external-secret.yaml"
echo ""
echo "3. Перезапустите deployment:"
echo "   kubectl rollout restart deployment/$DEPLOYMENT -n $NAMESPACE"
echo "   kubectl rollout status deployment/$DEPLOYMENT -n $NAMESPACE --timeout=180s"
echo ""
