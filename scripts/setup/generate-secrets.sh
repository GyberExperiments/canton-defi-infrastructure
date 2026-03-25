#!/bin/bash

# 🔐 Canton OTC - Генератор секретов для GitHub Actions
# Этот скрипт поможет вам подготовить секреты для GitHub Actions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔐 Canton OTC - Генератор секретов${NC}"
echo "=================================="
echo ""

# Функция для генерации случайных секретов
generate_random_secret() {
    openssl rand -base64 32
}

# Функция для кодирования в base64 (для kubeconfig)
encode_base64() {
    echo -n "$1" | base64
}

echo -e "${YELLOW}1. 🔑 KUBECONFIG Secret${NC}"
echo "Чтобы получить KUBECONFIG для GitHub Secrets:"
echo -e "${GREEN}cat ~/.kube/config | base64 | pbcopy${NC}"
echo "Затем вставьте результат в секрет KUBECONFIG в GitHub"
echo ""

echo -e "${YELLOW}2. 🛡️ Генерация случайных секретов${NC}"
echo ""

echo -e "${GREEN}ADMIN_API_KEY:${NC}"
echo "$(generate_random_secret)"
echo ""

echo -e "${GREEN}NEXTAUTH_SECRET:${NC}"
echo "$(generate_random_secret)"
echo ""

echo -e "${YELLOW}3. 📋 Список всех необходимых секретов для GitHub Actions:${NC}"
echo ""
echo "Обязательные секреты:"
echo "├── KUBECONFIG (base64 encoded kubeconfig)"
echo "├── GOOGLE_SHEET_ID"
echo "├── GOOGLE_SERVICE_ACCOUNT_EMAIL"
echo "├── GOOGLE_PRIVATE_KEY"
echo "├── TELEGRAM_BOT_TOKEN"
echo "├── TELEGRAM_CHAT_ID"
echo "├── SMTP_HOST"
echo "├── SMTP_PORT"
echo "├── SMTP_SECURE"
echo "├── SMTP_USER"
echo "├── SMTP_PASSWORD"
echo "├── SMTP_FROM_ADDRESS"
echo "├── SMTP_FROM_NAME"
echo "├── USDT_RECEIVING_ADDRESS"
echo "├── CANTON_COIN_PRICE_USD"
echo "├── ADMIN_API_KEY (сгенерирован выше)"
echo "├── NEXTAUTH_SECRET (сгенерирован выше)"
echo "└── NEXTAUTH_URL (https://1otc.cc)"
echo ""

echo -e "${YELLOW}4. 🔗 Ссылки:${NC}"
echo "• GitHub Secrets: https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/settings/secrets/actions"
echo "• Google Console: https://console.cloud.google.com/apis/credentials"
echo "• Telegram Bot: https://t.me/BotFather"
echo ""

echo -e "${BLUE}💡 Подсказки:${NC}"
echo "• Используйте .env.template как основу для создания .env.production"
echo "• Все значения в GitHub Secrets должны быть БЕЗ кодирования base64"
echo "• Workflow автоматически обработает все секреты"
echo "• NEXTAUTH_URL должен быть https://1otc.cc для продакшена"
echo ""

echo -e "${GREEN}✅ Готово! Теперь добавьте все секреты в GitHub Actions.${NC}"
