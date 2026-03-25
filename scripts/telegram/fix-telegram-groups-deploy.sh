#!/bin/bash

# 🔧 Скрипт для исправления маршрутизации Telegram групп
# Проверяет конфигурацию и деплоит исправления

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

NAMESPACE="${KUBECTL_NAMESPACE:-canton-otc-minimal-stage}"
DEPLOYMENT="${KUBECTL_DEPLOYMENT:-canton-otc}"
IMAGE_TAG="${IMAGE_TAG:-main}"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔧 ИСПРАВЛЕНИЕ МАРШРУТИЗАЦИИ TELEGRAM ГРУПП${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Шаг 1: Проверка переменных окружения в deployment
echo -e "${YELLOW}📋 Шаг 1: Проверка переменных окружения в deployment...${NC}"
if kubectl get deployment "$DEPLOYMENT" -n "$NAMESPACE" &>/dev/null; then
    echo -e "${GREEN}✅ Deployment найден${NC}"
    
    # Проверяем текущий образ
    CURRENT_IMAGE=$(kubectl get deployment "$DEPLOYMENT" -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].image}')
    echo -e "${BLUE}   Текущий образ: ${CURRENT_IMAGE}${NC}"
    
    # Проверяем переменные окружения
    echo -e "${YELLOW}   Проверяю переменные окружения...${NC}"
    if kubectl get deployment "$DEPLOYMENT" -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="TELEGRAM_CLIENT_GROUP_CHAT_ID")]}' &>/dev/null; then
        echo -e "${GREEN}   ✅ TELEGRAM_CLIENT_GROUP_CHAT_ID настроена в deployment${NC}"
    else
        echo -e "${RED}   ❌ TELEGRAM_CLIENT_GROUP_CHAT_ID НЕ найдена в deployment${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ Deployment не найден: $DEPLOYMENT в namespace $NAMESPACE${NC}"
    exit 1
fi
echo ""

# Шаг 2: Проверка переменных в runtime
echo -e "${YELLOW}📋 Шаг 2: Проверка переменных в runtime (в поде)...${NC}"
POD_NAME=$(kubectl get pods -n "$NAMESPACE" -l app=canton-otc -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

if [ -z "$POD_NAME" ]; then
    echo -e "${RED}❌ Под не найден${NC}"
    exit 1
fi

echo -e "${BLUE}   Под: $POD_NAME${NC}"

# Проверяем переменные окружения в поде
CLIENT_GROUP_ID=$(kubectl exec -n "$NAMESPACE" "$POD_NAME" -- env 2>/dev/null | grep "TELEGRAM_CLIENT_GROUP_CHAT_ID" | cut -d'=' -f2 || echo "")

if [ -n "$CLIENT_GROUP_ID" ]; then
    echo -e "${GREEN}   ✅ TELEGRAM_CLIENT_GROUP_CHAT_ID в runtime: $CLIENT_GROUP_ID${NC}"
else
    echo -e "${RED}   ❌ TELEGRAM_CLIENT_GROUP_CHAT_ID НЕ найдена в runtime${NC}"
    echo -e "${YELLOW}   💡 Возможно нужно перезапустить под после обновления секретов${NC}"
fi

# Проверяем TELEGRAM_CHAT_ID для сравнения
TELEGRAM_CHAT_ID=$(kubectl exec -n "$NAMESPACE" "$POD_NAME" -- env 2>/dev/null | grep "TELEGRAM_CHAT_ID" | cut -d'=' -f2 || echo "")
if [ -n "$TELEGRAM_CHAT_ID" ]; then
    echo -e "${BLUE}   TELEGRAM_CHAT_ID (группа операторов): $TELEGRAM_CHAT_ID${NC}"
fi
echo ""

# Шаг 3: Проверка логов инициализации
echo -e "${YELLOW}📋 Шаг 3: Проверка логов инициализации TelegramService...${NC}"
INIT_LOGS=$(kubectl logs -n "$NAMESPACE" "$POD_NAME" --tail=200 2>/dev/null | grep -iE "Telegram Service Config|clientGroupChatId|TELEGRAM_CLIENT_GROUP" || echo "")

if [ -n "$INIT_LOGS" ]; then
    echo -e "${GREEN}   ✅ Найдены логи инициализации:${NC}"
    echo "$INIT_LOGS" | head -5 | sed 's/^/   /'
else
    echo -e "${YELLOW}   ⚠️ Логи инициализации не найдены (возможно старая версия кода)${NC}"
fi
echo ""

# Шаг 4: Проверка текущего образа и предложение обновления
echo -e "${YELLOW}📋 Шаг 4: Проверка версии образа...${NC}"
if [[ "$CURRENT_IMAGE" == *":minimal-stage"* ]]; then
    echo -e "${YELLOW}   ⚠️ Используется тег 'minimal-stage' - может содержать старую версию кода${NC}"
    echo -e "${BLUE}   💡 Рекомендуется обновить на тег 'main' где есть исправления${NC}"
    
    read -p "   Обновить образ на тег 'main'? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        UPDATE_IMAGE=true
    else
        UPDATE_IMAGE=false
        echo -e "${YELLOW}   Пропускаю обновление образа${NC}"
    fi
else
    echo -e "${GREEN}   ✅ Используется тег: $(echo $CURRENT_IMAGE | cut -d':' -f2)${NC}"
    UPDATE_IMAGE=false
fi
echo ""

# Шаг 5: Обновление образа (если нужно)
if [ "$UPDATE_IMAGE" = true ]; then
    echo -e "${YELLOW}📋 Шаг 5: Обновление образа на тег 'main'...${NC}"
    
    NEW_IMAGE="ghcr.io/themacroeconomicdao/cantonotc:main"
    
    echo -e "${BLUE}   Обновляю образ: $NEW_IMAGE${NC}"
    kubectl set image deployment/"$DEPLOYMENT" \
        canton-otc="$NEW_IMAGE" \
        -n "$NAMESPACE"
    
    echo -e "${GREEN}   ✅ Образ обновлен${NC}"
    echo -e "${YELLOW}   ⏳ Жду готовности deployment (это может занять 1-2 минуты)...${NC}"
    
    kubectl rollout status deployment/"$DEPLOYMENT" -n "$NAMESPACE" --timeout=120s || {
        echo -e "${RED}   ❌ Deployment не готов в течение 2 минут${NC}"
        echo -e "${YELLOW}   Проверьте статус вручную: kubectl rollout status deployment/$DEPLOYMENT -n $NAMESPACE${NC}"
    }
    
    echo -e "${GREEN}   ✅ Deployment обновлен и готов${NC}"
    echo ""
    
    # Ждем немного чтобы под перезапустился
    echo -e "${YELLOW}   ⏳ Жду перезапуска пода (10 секунд)...${NC}"
    sleep 10
    
    # Проверяем новый под
    NEW_POD_NAME=$(kubectl get pods -n "$NAMESPACE" -l app=canton-otc -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    if [ -n "$NEW_POD_NAME" ]; then
        echo -e "${GREEN}   ✅ Новый под: $NEW_POD_NAME${NC}"
        
        # Проверяем логи инициализации нового пода
        echo -e "${YELLOW}   Проверяю логи инициализации нового пода...${NC}"
        sleep 5
        NEW_INIT_LOGS=$(kubectl logs -n "$NAMESPACE" "$NEW_POD_NAME" --tail=50 2>/dev/null | grep -iE "Telegram Service Config|clientGroupChatId|TELEGRAM_CLIENT_GROUP" || echo "")
        
        if [ -n "$NEW_INIT_LOGS" ]; then
            echo -e "${GREEN}   ✅ Логи инициализации нового пода:${NC}"
            echo "$NEW_INIT_LOGS" | head -5 | sed 's/^/   /'
        else
            echo -e "${YELLOW}   ⚠️ Логи инициализации пока не видны (под еще запускается)${NC}"
        fi
    fi
else
    echo -e "${YELLOW}📋 Шаг 5: Пропущен (образ не обновляется)${NC}"
fi
echo ""

# Шаг 6: Финальная проверка
echo -e "${YELLOW}📋 Шаг 6: Финальная проверка...${NC}"
FINAL_POD_NAME=$(kubectl get pods -n "$NAMESPACE" -l app=canton-otc -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

if [ -n "$FINAL_POD_NAME" ]; then
    FINAL_CLIENT_GROUP_ID=$(kubectl exec -n "$NAMESPACE" "$FINAL_POD_NAME" -- env 2>/dev/null | grep "TELEGRAM_CLIENT_GROUP_CHAT_ID" | cut -d'=' -f2 || echo "")
    
    if [ -n "$FINAL_CLIENT_GROUP_ID" ]; then
        echo -e "${GREEN}   ✅ TELEGRAM_CLIENT_GROUP_CHAT_ID в runtime: $FINAL_CLIENT_GROUP_ID${NC}"
    else
        echo -e "${RED}   ❌ TELEGRAM_CLIENT_GROUP_CHAT_ID все еще не найдена${NC}"
    fi
fi
echo ""

# Итоги
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 ИТОГИ И СЛЕДУЮЩИЕ ШАГИ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}1. Проверьте логи после создания тестовой заявки:${NC}"
echo "   kubectl logs -n $NAMESPACE deployment/$DEPLOYMENT --tail=200 | grep -iE 'sendPublicOrderNotification|client group|Publishing order'"
echo ""
echo -e "${YELLOW}2. Создайте тестовую заявку:${NC}"
echo "   bash scripts/test-client-group-orders.sh"
echo ""
echo -e "${YELLOW}3. Проверьте в Telegram:${NC}"
echo "   - Группа клиентов (1OTC_ORDERS, ID: -5039619304): должна прийти заявка"
echo "   - Группа нотификаций (операторы): должна прийти уведомление"
echo ""
echo -e "${YELLOW}4. Если проблема сохраняется, проверьте:${NC}"
echo "   - Секрет в Kubernetes: kubectl get secret canton-otc-secrets-minimal-stage -n $NAMESPACE -o jsonpath='{.data.TELEGRAM_CLIENT_GROUP_CHAT_ID}' | base64 -d"
echo "   - Логи с детальной диагностикой: kubectl logs -n $NAMESPACE deployment/$DEPLOYMENT --tail=500 | grep -iE 'sendPublicOrderNotification debug|Telegram Service Config'"
echo ""
