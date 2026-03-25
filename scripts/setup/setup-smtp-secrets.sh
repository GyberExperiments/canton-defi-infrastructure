#!/bin/bash

# 📧 Setup SMTP Secrets for Canton OTC Exchange
# Настройка SMTP секретов для production-ready email сервиса

set -e

echo "📧 Настройка SMTP секретов для Canton OTC Exchange"
echo "=================================================="

# Проверяем наличие gh CLI
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) не установлен!"
    echo "📋 Установите: brew install gh"
    echo "📋 Авторизуйтесь: gh auth login"
    exit 1
fi

# Проверяем авторизацию
if ! gh auth status &> /dev/null; then
    echo "❌ Не авторизованы в GitHub CLI!"
    echo "📋 Выполните: gh auth login"
    exit 1
fi

echo "✅ GitHub CLI готов"

# Функция для установки секрета
set_secret() {
    local key=$1
    local value=$2
    local description=$3
    
    if [ -z "$value" ]; then
        echo "⚠️  Пропускаем $key (пустое значение)"
        return
    fi
    
    echo "🔐 Устанавливаем $key..."
    if gh secret set "$key" --body "$value" --repo TheMacroeconomicDao/CantonOTC; then
        echo "✅ $key установлен: $description"
    else
        echo "❌ Ошибка установки $key"
        return 1
    fi
}

echo ""
echo "📋 Введите SMTP настройки для Gmail:"
echo ""

# Запрашиваем SMTP настройки
read -p "📧 SMTP Host (по умолчанию: smtp.gmail.com): " SMTP_HOST
SMTP_HOST=${SMTP_HOST:-smtp.gmail.com}

read -p "🔌 SMTP Port (по умолчанию: 587): " SMTP_PORT
SMTP_PORT=${SMTP_PORT:-587}

read -p "🔒 SMTP Secure (true/false, по умолчанию: false): " SMTP_SECURE
SMTP_SECURE=${SMTP_SECURE:-false}

read -p "👤 SMTP User (ваш Gmail): " SMTP_USER

read -s -p "🔑 SMTP Password (App Password для Gmail): " SMTP_PASSWORD
echo ""

read -p "📨 From Address (по умолчанию: support@canton-otc.com): " SMTP_FROM_ADDRESS
SMTP_FROM_ADDRESS=${SMTP_FROM_ADDRESS:-support@canton-otc.com}

read -p "📝 From Name (по умолчанию: Canton OTC Exchange): " SMTP_FROM_NAME
SMTP_FROM_NAME=${SMTP_FROM_NAME:-Canton OTC Exchange}

echo ""
echo "🔐 Устанавливаем SMTP секреты в GitHub..."

# Устанавливаем все SMTP секреты
set_secret "SMTP_HOST" "$SMTP_HOST" "SMTP Server Host"
set_secret "SMTP_PORT" "$SMTP_PORT" "SMTP Server Port"
set_secret "SMTP_SECURE" "$SMTP_SECURE" "SMTP Use TLS"
set_secret "SMTP_USER" "$SMTP_USER" "SMTP Username"
set_secret "SMTP_PASSWORD" "$SMTP_PASSWORD" "SMTP Password"
set_secret "SMTP_FROM_ADDRESS" "$SMTP_FROM_ADDRESS" "SMTP From Address"
set_secret "SMTP_FROM_NAME" "$SMTP_FROM_NAME" "SMTP From Name"

echo ""
echo "🎉 SMTP секреты успешно настроены!"
echo ""
echo "📋 Следующие шаги:"
echo "1. 🚀 Запустите CI/CD пайплайн для minimal-stage"
echo "2. 📧 Email сервис будет автоматически включен"
echo "3. 🔍 Проверьте логи на отсутствие предупреждений"
echo ""
echo "💡 Для Gmail App Password:"
echo "   - Включите 2FA в Google аккаунте"
echo "   - Создайте App Password: https://myaccount.google.com/apppasswords"
echo "   - Используйте App Password вместо обычного пароля"
echo ""
echo "✅ Готово! Email сервис будет работать в production режиме."
