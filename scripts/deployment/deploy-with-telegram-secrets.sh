#!/bin/bash

# 🚀 Canton OTC - Деплой с обновлением Telegram секретов
# Этот скрипт добавляет Telegram Client API секреты и запускает workflow

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Canton OTC - Деплой с обновлением Telegram секретов${NC}"
echo "=========================================================="
echo ""

# Проверяем GitHub CLI
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI не установлен!${NC}"
    echo -e "${YELLOW}💡 Установите: brew install gh${NC}"
    exit 1
fi

# Проверяем авторизацию
echo -e "${BLUE}🔍 Проверяем авторизацию GitHub CLI...${NC}"
if ! gh auth status > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Не авторизован. Выполняем авторизацию...${NC}"
    gh auth login -h github.com
fi

echo -e "${GREEN}✅ GitHub CLI готов${NC}"
echo ""

# Telegram Client API секреты из .env.local
TELEGRAM_API_ID="38052547"
TELEGRAM_API_HASH="cb6e8dec7c4ecb28c860e41f40b18d36"
TELEGRAM_SESSION_STRING="1AgAOMTQ5LjE1NC4xNjcuNDEBu0m3L/6yeqPCXoDWEd5qofzQvQogFKew0E7PA2TBwv9ag1GmcDnGaYJUDlfyGt2trJZTwp/dTmgxL8cu5vIycp9jCvJfG4BzGiFf+hOH/5Z/YC7VNapm3wlnP8/7gWWE52xru/T1zaEjyx5zb9oXwjzHfiEx6t1x9YnyD9KWYlyVLHiRBDxzZ6sHiWVbA0rbW3axJvdfrOxXhqqK4eXNRs6LB0HYGmJaVQ7nSzK8fg+H4QpDhuoyDjXO0yFYfKGouq0dj2Yxr9uW4FOsKmZdFabmP3oYMvvI1xQeofS/GNt9J6ccrdjs3361QUr6HPxaIxV2oPJznarH6Z9TaCWmODw="

# Функция для установки секрета
set_secret() {
    local secret_name="$1"
    local secret_value="$2"
    
    if [ -z "$secret_value" ]; then
        echo -e "${YELLOW}⚠️  Пропускаем $secret_name (пустое значение)${NC}"
        return
    fi
    
    echo -e "${BLUE}🔑 Устанавливаем $secret_name...${NC}"
    echo "$secret_value" | gh secret set "$secret_name" --body - 2>&1 | grep -v "Setting secret" || true
    echo -e "${GREEN}✅ $secret_name установлен${NC}"
}

# Устанавливаем Telegram Client API секреты
echo -e "${BLUE}📱 Устанавливаем Telegram Client API секреты...${NC}"
set_secret "TELEGRAM_API_ID" "$TELEGRAM_API_ID"
set_secret "TELEGRAM_API_HASH" "$TELEGRAM_API_HASH"
set_secret "TELEGRAM_SESSION_STRING" "$TELEGRAM_SESSION_STRING"

echo ""
echo -e "${GREEN}✅ Все Telegram секреты установлены${NC}"
echo ""

# Проверяем что мы в правильной директории
if [ ! -f ".github/workflows/deploy.yml" ]; then
    echo -e "${RED}❌ Не в корне проекта!${NC}"
    echo -e "${YELLOW}💡 Перейдите в /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc${NC}"
    exit 1
fi

# Переходим в корень проекта
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc

# Проверяем что мы на main ветке
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${YELLOW}⚠️  Текущая ветка: $CURRENT_BRANCH${NC}"
    echo -e "${BLUE}🔄 Переключаемся на main...${NC}"
    git checkout main
    git pull origin main
fi

# Проверяем есть ли изменения
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}⚠️  Есть незакоммиченные изменения${NC}"
    echo -e "${BLUE}📝 Коммитим изменения...${NC}"
    git add -A
    git commit -m "chore: Update Telegram Client API secrets and trigger deployment"
    git push origin main
    echo -e "${GREEN}✅ Изменения запушены${NC}"
else
    echo -e "${BLUE}📝 Создаем пустой commit для запуска workflow...${NC}"
    git commit --allow-empty -m "chore: Trigger deployment with updated Telegram secrets"
    git push origin main
    echo -e "${GREEN}✅ Workflow запущен${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Готово!${NC}"
echo ""
echo -e "${BLUE}📊 Проверка статуса:${NC}"
echo "  1. GitHub Actions: https://github.com/TheMacroeconomicDao/CantonOTC/actions"
echo "  2. После завершения workflow проверьте Secret:"
echo "     kubectl get secret canton-otc-secrets -n canton-otc -o jsonpath='{.data}' | jq 'keys | length'"
echo "  3. Проверьте переменные в подах:"
echo "     kubectl exec -n canton-otc deployment/canton-otc -- env | grep TELEGRAM_API"
echo ""
