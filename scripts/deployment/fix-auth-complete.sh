#!/bin/bash

##############################################################################
# 🔐 Полное исправление авторизации Canton OTC
# Устанавливает все правильные секреты для работы логина
##############################################################################

set -e

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}  🔐 ИСПРАВЛЕНИЕ АВТОРИЗАЦИИ CANTON OTC${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo ""

# Проверка GitHub CLI
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI не установлен!${NC}"
    echo "Установите: brew install gh"
    exit 1
fi

if ! gh auth status &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI не авторизован!${NC}"
    echo "Выполните: gh auth login"
    exit 1
fi

echo -e "${GREEN}✅ GitHub CLI готов${NC}"
echo ""

# Проверяем Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js не установлен!${NC}"
    exit 1
fi

# ============================================================================
# ГЕНЕРАЦИЯ ПРАВИЛЬНЫХ СЕКРЕТОВ
# ============================================================================

echo -e "${BLUE}🔐 Генерация секретов...${NC}"
echo ""

# Email и пароль
ADMIN_EMAIL="admin@canton-otc.com"
ADMIN_PASSWORD="Wm8vJISLZ9oeCaca2025!"
ADMIN_NAME="Admin"

# Генерируем bcrypt хеш
echo -e "${YELLOW}🔄 Генерация bcrypt хеша для пароля...${NC}"
ADMIN_PASSWORD_HASH=$(node -e "
const bcrypt = require('bcryptjs');
const password = '${ADMIN_PASSWORD}';
const hash = bcrypt.hashSync(password, 10);
console.log(hash);
")

echo -e "${GREEN}✅ Хеш сгенерирован${NC}"
echo ""

# Генерируем NEXTAUTH_SECRET если нужно
echo -e "${YELLOW}🔄 Генерация NEXTAUTH_SECRET...${NC}"
NEXTAUTH_SECRET=$(openssl rand -base64 32)
echo -e "${GREEN}✅ NEXTAUTH_SECRET сгенерирован${NC}"
echo ""

# NEXTAUTH_URL для production
NEXTAUTH_URL="https://1otc.cc"

# ============================================================================
# ОБНОВЛЕНИЕ GITHUB SECRETS
# ============================================================================

echo -e "${BLUE}📤 Обновление GitHub Secrets...${NC}"
echo ""

echo "1. ADMIN_EMAIL..."
echo "$ADMIN_EMAIL" | gh secret set ADMIN_EMAIL --repo TheMacroeconomicDao/CantonOTC

echo "2. ADMIN_PASSWORD_HASH..."
echo "$ADMIN_PASSWORD_HASH" | gh secret set ADMIN_PASSWORD_HASH --repo TheMacroeconomicDao/CantonOTC

echo "3. ADMIN_NAME..."
echo "$ADMIN_NAME" | gh secret set ADMIN_NAME --repo TheMacroeconomicDao/CantonOTC

echo "4. NEXTAUTH_SECRET..."
echo "$NEXTAUTH_SECRET" | gh secret set NEXTAUTH_SECRET --repo TheMacroeconomicDao/CantonOTC

echo "5. NEXTAUTH_URL..."
echo "$NEXTAUTH_URL" | gh secret set NEXTAUTH_URL --repo TheMacroeconomicDao/CantonOTC

echo ""
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ ВСЕ СЕКРЕТЫ ОБНОВЛЕНЫ!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo ""

echo -e "${BLUE}📋 Установленные значения:${NC}"
echo "  • ADMIN_EMAIL = $ADMIN_EMAIL"
echo "  • ADMIN_PASSWORD_HASH = <bcrypt hash установлен>"
echo "  • ADMIN_NAME = $ADMIN_NAME"
echo "  • NEXTAUTH_SECRET = <сгенерирован>"
echo "  • NEXTAUTH_URL = $NEXTAUTH_URL"
echo ""

echo -e "${YELLOW}═══════════════════════════════════════════${NC}"
echo -e "${YELLOW}  🚀 СЛЕДУЮЩИЕ ШАГИ${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════${NC}"
echo ""
echo "1. Запустите деплой вручную:"
echo "   https://github.com/TheMacroeconomicDao/CantonOTC/actions"
echo "   → 'Run workflow' → выберите 'deploy.yml' → 'Run'"
echo ""
echo "   ИЛИ сделайте push для автоматического деплоя:"
echo "   git commit --allow-empty -m 'chore: trigger redeploy with new secrets'"
echo "   git push origin main"
echo ""
echo "2. Дождитесь завершения деплоя (~5-7 минут)"
echo ""
echo "3. Войдите в админку:"
echo "   URL: https://1otc.cc/admin/login"
echo "   Email: $ADMIN_EMAIL"
echo "   Password: <ваш пароль>"
echo ""
echo -e "${GREEN}✅ После деплоя авторизация будет работать!${NC}"
echo ""

