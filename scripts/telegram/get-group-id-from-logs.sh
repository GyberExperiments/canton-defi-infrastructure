#!/bin/bash

# 🔍 Получить ID группы клиентов из логов сервера
# Автор: AI Assistant

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔍 ПОЛУЧЕНИЕ ID ГРУППЫ ИЗ ЛОГОВ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

NAMESPACE="${KUBECTL_NAMESPACE:-canton-otc}"
DEPLOYMENT="${KUBECTL_DEPLOYMENT:-canton-otc}"

echo -e "${YELLOW}📋 Ищу ID группы в логах deployment...${NC}"
echo ""

# Получаем последние логи и ищем упоминания группы
LOGS=$(kubectl logs -n "$NAMESPACE" deployment/"$DEPLOYMENT" --tail=500 2>/dev/null | grep -i "client group\|ruheggs\|chat.*id" || true)

if [ -z "$LOGS" ]; then
    echo -e "${YELLOW}⚠️ Не найдено упоминаний группы в логах${NC}"
    echo ""
    echo -e "${YELLOW}💡 Попробуйте:${NC}"
    echo "1. Напишите 'ruheggs' в группе клиентов"
    echo "2. Подождите несколько секунд"
    echo "3. Запустите скрипт снова"
    echo ""
    exit 1
fi

# Ищем ID группы (формат: -1001234567890)
GROUP_ID=$(echo "$LOGS" | grep -oE '-\d{10,}' | head -1)

if [ -z "$GROUP_ID" ]; then
    # Пробуем найти в других форматах
    GROUP_ID=$(echo "$LOGS" | grep -oE 'chatId["\s:]+(-?\d+)' | grep -oE '-\d+' | head -1)
fi

if [ -z "$GROUP_ID" ]; then
    echo -e "${RED}❌ Не удалось извлечь ID группы из логов${NC}"
    echo ""
    echo -e "${YELLOW}📋 Последние релевантные логи:${NC}"
    echo "$LOGS" | head -20
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ Найден ID группы: ${BLUE}$GROUP_ID${NC}"
echo ""

# Выводим команды для добавления в секреты
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

# Проверяем существующий secret
if kubectl get secret canton-otc-secrets-minimal-stage -n "$NAMESPACE" > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️ Secret уже существует, обновляю...${NC}"
    # Добавляем новый ключ в существующий secret
    kubectl patch secret canton-otc-secrets-minimal-stage -n "$NAMESPACE" \
        --type='json' \
        -p="[{\"op\": \"add\", \"path\": \"/data/TELEGRAM_CLIENT_GROUP_CHAT_ID\", \"value\": \"$(echo -n "$GROUP_ID" | base64)\"}]" 2>/dev/null && \
        echo -e "${GREEN}✅ Обновлен Kubernetes Secret${NC}" || \
        echo -e "${YELLOW}⚠️ Не удалось обновить secret (попробуйте создать новый)${NC}"
else
    # Создаем новый secret
    if kubectl create secret generic canton-otc-secrets-minimal-stage \
        --from-literal=TELEGRAM_CLIENT_GROUP_CHAT_ID="$GROUP_ID" \
        -n "$NAMESPACE" 2>/dev/null; then
        echo -e "${GREEN}✅ Создан Kubernetes Secret${NC}"
    else
        echo -e "${YELLOW}⚠️ Не удалось создать Kubernetes Secret${NC}"
    fi
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
echo -e "${GREEN}Или создать новый:${NC}"
echo "   kubectl create secret generic telegram-client-group \\"
echo "     --from-literal=TELEGRAM_CLIENT_GROUP_CHAT_ID=\"$GROUP_ID\" \\"
echo "     -n $NAMESPACE"
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
echo ""
