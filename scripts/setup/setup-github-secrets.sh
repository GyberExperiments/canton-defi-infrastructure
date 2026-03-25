#!/bin/bash

# 🔐 Canton OTC - Автоматическая установка GitHub Secrets
# Этот скрипт автоматически добавляет все необходимые секреты в GitHub репозиторий

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔐 Canton OTC - Автоматическая установка GitHub Secrets${NC}"
echo "========================================================"
echo ""

# Проверяем GitHub CLI
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI не установлен!${NC}"
    echo -e "${YELLOW}💡 Установите GitHub CLI: https://cli.github.com/${NC}"
    exit 1
fi

# Проверяем авторизацию
echo -e "${BLUE}🔍 Проверяем авторизацию GitHub CLI...${NC}"
if ! gh auth status > /dev/null 2>&1; then
    echo -e "${RED}❌ Не авторизован в GitHub CLI!${NC}"
    echo -e "${YELLOW}💡 Выполните авторизацию:${NC}"
    echo "   gh auth login -h github.com"
    echo ""
    echo -e "${BLUE}🔧 Авторизуемся сейчас...${NC}"
    gh auth login -h github.com
fi

# Функция для установки секрета
set_secret() {
    local secret_name="$1"
    local secret_value="$2"
    local description="$3"
    
    if [ -z "$secret_value" ]; then
        echo -e "${YELLOW}⚠️  Пропускаем $secret_name (пустое значение)${NC}"
        return
    fi
    
    echo -e "${BLUE}🔑 Устанавливаем $secret_name${NC}"
    echo "$secret_value" | gh secret set "$secret_name" --body -
    echo -e "${GREEN}✅ $secret_name установлен${NC}"
}

# Функция для генерации случайного секрета
generate_random_secret() {
    openssl rand -base64 32
}

echo -e "${GREEN}✅ Авторизация успешна!${NC}"
echo ""

# Проверяем наличие .env файла
ENV_FILE="${1:-.env.production}"
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}⚠️  Файл $ENV_FILE не найден!${NC}"
    echo -e "${BLUE}🔧 Создаем пример файла из env.template...${NC}"
    
    if [ -f "env.template" ]; then
        cp env.template "$ENV_FILE"
        echo -e "${GREEN}✅ Создан файл $ENV_FILE из template${NC}"
        echo -e "${YELLOW}💡 Отредактируйте $ENV_FILE и запустите скрипт снова${NC}"
        exit 0
    else
        echo -e "${RED}❌ env.template не найден!${NC}"
        exit 1
    fi
fi

echo -e "${BLUE}📄 Читаем секреты из $ENV_FILE...${NC}"

# Загружаем переменные из .env файла
set -a
source "$ENV_FILE"
set +a

echo -e "${GREEN}✅ Секреты загружены из $ENV_FILE${NC}"
echo ""

# Специальная обработка KUBECONFIG
echo -e "${BLUE}🔑 Обрабатываем KUBECONFIG...${NC}"
KUBECONFIG_PATH="$HOME/.kube/config"
if [ -f "$KUBECONFIG_PATH" ]; then
    KUBECONFIG_BASE64=$(cat "$KUBECONFIG_PATH" | base64)
    set_secret "KUBECONFIG" "$KUBECONFIG_BASE64" "Kubernetes configuration (base64 encoded)"
else
    echo -e "${YELLOW}⚠️  $KUBECONFIG_PATH не найден! Пропускаем KUBECONFIG${NC}"
fi

# Генерируем секреты, если они не заданы
if [ -z "$ADMIN_API_KEY" ]; then
    ADMIN_API_KEY=$(generate_random_secret)
    echo -e "${BLUE}🎲 Сгенерирован ADMIN_API_KEY: $ADMIN_API_KEY${NC}"
fi

if [ -z "$NEXTAUTH_SECRET" ]; then
    NEXTAUTH_SECRET=$(generate_random_secret)
    echo -e "${BLUE}🎲 Сгенерирован NEXTAUTH_SECRET: $NEXTAUTH_SECRET${NC}"
fi

if [ -z "$NEXTAUTH_URL" ]; then
    NEXTAUTH_URL="https://1otc.cc"
    echo -e "${BLUE}🌐 Установлен NEXTAUTH_URL: $NEXTAUTH_URL${NC}"
fi

echo ""
echo -e "${BLUE}🚀 Устанавливаем секреты в GitHub...${NC}"
echo ""

# Устанавливаем все секреты
set_secret "GOOGLE_SHEET_ID" "$GOOGLE_SHEET_ID" "Google Sheets ID"
set_secret "GOOGLE_SERVICE_ACCOUNT_EMAIL" "$GOOGLE_SERVICE_ACCOUNT_EMAIL" "Google Service Account Email"
set_secret "GOOGLE_PRIVATE_KEY" "$GOOGLE_PRIVATE_KEY" "Google Service Account Private Key"

set_secret "TELEGRAM_BOT_TOKEN" "$TELEGRAM_BOT_TOKEN" "Telegram Bot Token"
set_secret "TELEGRAM_CHAT_ID" "$TELEGRAM_CHAT_ID" "Telegram Chat ID"

set_secret "SMTP_HOST" "$SMTP_HOST" "SMTP Server Host"
set_secret "SMTP_PORT" "$SMTP_PORT" "SMTP Server Port"
set_secret "SMTP_SECURE" "$SMTP_SECURE" "SMTP Use TLS"
set_secret "SMTP_USER" "$SMTP_USER" "SMTP Username"
set_secret "SMTP_PASSWORD" "$SMTP_PASSWORD" "SMTP Password"
set_secret "SMTP_FROM_ADDRESS" "$SMTP_FROM_ADDRESS" "SMTP From Address"
set_secret "SMTP_FROM_NAME" "$SMTP_FROM_NAME" "SMTP From Name"

set_secret "USDT_RECEIVING_ADDRESS" "$USDT_RECEIVING_ADDRESS" "USDT Receiving Address"
set_secret "CANTON_COIN_PRICE_USD" "$CANTON_COIN_PRICE_USD" "Canton Coin Price in USD"

set_secret "ADMIN_API_KEY" "$ADMIN_API_KEY" "Admin API Key"
set_secret "NEXTAUTH_SECRET" "$NEXTAUTH_SECRET" "NextAuth Secret"
set_secret "NEXTAUTH_URL" "$NEXTAUTH_URL" "NextAuth URL"

echo ""
echo -e "${BLUE}📋 Проверяем установленные секреты...${NC}"
gh secret list

echo ""
echo "========================================================"
echo -e "${GREEN}🎉 Все секреты успешно установлены!${NC}"
echo ""
echo -e "${BLUE}📊 Статистика:${NC}"
SECRET_COUNT=$(gh secret list --json name | jq length)
echo "  • Всего секретов: $SECRET_COUNT"
echo "  • Репозиторий: $(gh repo view --json nameWithOwner -q .nameWithOwner)"
echo ""
echo -e "${YELLOW}🚀 Готово к деплою!${NC}"
echo "Теперь можно запустить GitHub Actions workflow:"
echo "  1. Автоматически: git push origin main"
echo "  2. Вручную: GitHub Actions → Deploy Canton OTC to Kubernetes → Run workflow"
echo ""
echo -e "${BLUE}🔗 Полезные ссылки:${NC}"
echo "  • GitHub Actions: https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/actions"
echo "  • Секреты: https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/settings/secrets/actions"
echo ""
echo -e "${GREEN}✨ CI/CD pipeline готов к работе!${NC}"
