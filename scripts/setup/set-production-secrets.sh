#!/bin/bash
# 🔐 Установка правильных секретов для продакшн контура Canton OTC
# Создает или обновляет критически важные секреты через GitHub CLI

set -e

echo "🔐 Установка секретов для production контура Canton OTC..."
echo "📋 Репозиторий: TheMacroeconomicDao/CantonOTC"
echo ""

# Проверяем наличие GitHub CLI
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI не установлен!"
    echo "📦 Установите: brew install gh (macOS) или https://cli.github.com/"
    exit 1
fi

# Проверяем авторизацию
if ! gh auth status &> /dev/null; then
    echo "❌ GitHub CLI не авторизован!"
    echo "🔐 Выполните: gh auth login"
    exit 1
fi

echo "✅ GitHub CLI готов"
echo ""

# Критически важные секреты для исправления проблемы авторизации
echo "🔧 Устанавливаем NEXTAUTH_URL для production..."
gh secret set NEXTAUTH_URL --body "https://1otc.cc" --repo TheMacroeconomicDao/CantonOTC

echo "🔧 Устанавливаем новый пароль админки..."
gh secret set ADMIN_PASSWORD_HASH --body "\$2b\$10\$DvEeNmh4LIbO.ZCQ1.c0g.xX4GgEwCbfPPuAuQp2gMji56gIWVFVu" --repo TheMacroeconomicDao/CantonOTC

echo "🔧 Устанавливаем email админки..."
gh secret set ADMIN_EMAIL --body "admin@1otc.cc" --repo TheMacroeconomicDao/CantonOTC

echo "🔧 Устанавливаем имя админки..."
gh secret set ADMIN_NAME --body "Canton OTC Admin" --repo TheMacroeconomicDao/CantonOTC

echo ""
echo "✅ Ключевые секреты установлены:"
echo "   • NEXTAUTH_URL = https://1otc.cc"
echo "   • ADMIN_PASSWORD_HASH = новый хеш (пароль: CantonOTC2025@Admin)"
echo "   • ADMIN_EMAIL = admin@1otc.cc"
echo "   • ADMIN_NAME = Canton OTC Admin"
echo ""
echo "🚀 Теперь можно делать commit и push - авторизация будет работать корректно!"
echo ""
echo "📋 Для входа в админку используйте:"
echo "   Email: admin@1otc.cc"
echo "   Password: CantonOTC2025@Admin"