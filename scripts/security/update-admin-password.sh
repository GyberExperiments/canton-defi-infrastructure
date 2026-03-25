#!/bin/bash

##############################################################################
# 🔐 Скрипт обновления пароля администратора
# Автоматически обновляет ADMIN_PASSWORD_HASH в GitHub Secrets
##############################################################################

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}  🔐 ОБНОВЛЕНИЕ ПАРОЛЯ АДМИНИСТРАТОРА${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo ""

# Проверка наличия необходимых инструментов
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js не установлен!${NC}"
    exit 1
fi

if ! command -v gh &> /dev/null; then
    echo -e "${YELLOW}⚠️  GitHub CLI не установлен${NC}"
    echo -e "${YELLOW}   Будет показана инструкция для ручного обновления${NC}"
    MANUAL_MODE=true
fi

# Получаем пароль из аргумента или переменной окружения
if [ -n "$1" ]; then
    PASSWORD="$1"
elif [ -n "$ADMIN_PASSWORD" ]; then
    PASSWORD="$ADMIN_PASSWORD"
else
    echo -e "${RED}❌ Пароль не указан!${NC}"
    echo ""
    echo "Использование:"
    echo "  $0 <password>"
    echo ""
    echo "ИЛИ установите переменную окружения:"
    echo "  export ADMIN_PASSWORD='your-password'"
    echo "  $0"
    echo ""
    exit 1
fi

echo -e "${GREEN}📋 Пароль получен${NC}"
echo ""

# Генерация bcrypt хеша
echo -e "${BLUE}🔄 Генерация bcrypt хеша...${NC}"
HASH=$(node -e "
const bcrypt = require('bcryptjs');
const password = '$PASSWORD';
const hash = bcrypt.hashSync(password, 10);
console.log(hash);
")

echo -e "${GREEN}✅ Хеш сгенерирован:${NC}"
echo "$HASH"
echo ""

if [ "$MANUAL_MODE" = true ]; then
    echo -e "${YELLOW}═══════════════════════════════════════════${NC}"
    echo -e "${YELLOW}  📋 РУЧНОЕ ОБНОВЛЕНИЕ GITHUB SECRET${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════${NC}"
    echo ""
    echo "1. Перейдите: https://github.com/TheMacroeconomicDao/CantonOTC/settings/secrets/actions"
    echo ""
    echo "2. Найдите secret: ADMIN_PASSWORD_HASH"
    echo ""
    echo "3. Нажмите 'Update'"
    echo ""
    echo "4. Вставьте новое значение:"
    echo ""
    echo -e "${GREEN}$HASH${NC}"
    echo ""
    echo "5. Нажмите 'Update secret'"
    echo ""
    echo "6. Запустите новый деплой:"
    echo "   https://github.com/TheMacroeconomicDao/CantonOTC/actions"
    echo "   → 'Run workflow' → выберите 'deploy.yml' → 'Run'"
    echo ""
    
    # Копируем в буфер обмена если возможно
    if command -v pbcopy &> /dev/null; then
        echo "$HASH" | pbcopy
        echo -e "${GREEN}✅ Хеш скопирован в буфер обмена!${NC}"
    elif command -v xclip &> /dev/null; then
        echo "$HASH" | xclip -selection clipboard
        echo -e "${GREEN}✅ Хеш скопирован в буфер обмена!${NC}"
    fi
else
    echo -e "${BLUE}🔄 Обновление через GitHub CLI...${NC}"
    
    # Проверка аутентификации
    if ! gh auth status &> /dev/null; then
        echo -e "${RED}❌ GitHub CLI не авторизован!${NC}"
        echo -e "${YELLOW}Выполните: gh auth login${NC}"
        exit 1
    fi
    
    # Обновление секрета
    echo "$HASH" | gh secret set ADMIN_PASSWORD_HASH \
        --repo TheMacroeconomicDao/CantonOTC \
        --body "$HASH"
    
    if [ $? -eq 0 ]; then
        echo ""
        echo -e "${GREEN}═══════════════════════════════════════════${NC}"
        echo -e "${GREEN}  ✅ SECRET УСПЕШНО ОБНОВЛЕН!${NC}"
        echo -e "${GREEN}═══════════════════════════════════════════${NC}"
        echo ""
        echo -e "${BLUE}📋 Следующие шаги:${NC}"
        echo ""
        echo "1. Запустите новый деплой вручную:"
        echo "   https://github.com/TheMacroeconomicDao/CantonOTC/actions"
        echo ""
        echo "   ИЛИ сделайте push в main:"
        echo "   git commit --allow-empty -m 'chore: trigger deploy'"
        echo "   git push origin main"
        echo ""
        echo "2. Дождитесь завершения деплоя (~5-7 минут)"
        echo ""
        echo "3. Попробуйте войти снова:"
        echo "   URL: https://1otc.cc/admin/login"
        echo "   Email: admin@canton-otc.com"
        echo "   Password: <ваш пароль>"
        echo ""
    else
        echo -e "${RED}❌ Ошибка обновления secret!${NC}"
        exit 1
    fi
fi

echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo ""

