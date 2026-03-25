#!/bin/bash

# 🔐 Canton OTC - Seed Phrase Backup Script
# Автоматический бэкап seed phrase в GitHub Secrets

set -e

echo "🔐 Canton OTC - Seed Phrase Backup Script"
echo "=========================================="

# Проверяем, что мы в правильной директории
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this script from the project root directory"
    exit 1
fi

# Проверяем, что gh CLI установлен
if ! command -v gh &> /dev/null; then
    echo "❌ Error: GitHub CLI (gh) is not installed"
    echo "Install it from: https://cli.github.com/"
    exit 1
fi

# Проверяем авторизацию в GitHub
if ! gh auth status &> /dev/null; then
    echo "❌ Error: Not authenticated with GitHub CLI"
    echo "Run: gh auth login"
    exit 1
fi

echo "✅ GitHub CLI is authenticated"

# Генерируем новый seed phrase
echo "🎲 Generating new seed phrase..."
SEED_PHRASE=$(node -e "const bip39 = require('bip39'); console.log(bip39.generateMnemonic());")

if [ -z "$SEED_PHRASE" ]; then
    echo "❌ Error: Failed to generate seed phrase"
    exit 1
fi

echo "✅ Seed phrase generated successfully"

# Выводим seed phrase для записи в блокнот
echo ""
echo "🔥🔥🔥 КРИТИЧЕСКИ ВАЖНО - СОХРАНИТЕ ЭТОТ SEED PHRASE! 🔥🔥🔥"
echo "════════════════════════════════════════════════════════════════════════════════"
echo "📝 SEED PHRASE (запишите в блокнот):"
echo "   $SEED_PHRASE"
echo "════════════════════════════════════════════════════════════════════════════════"
echo "🔐 ДЛЯ PRODUCTION:"
echo "   1. Скопируйте seed phrase выше"
echo "   2. Запишите в безопасный блокнот"
echo "   3. БЕЗ ЭТОГО SEED НЕВОЗМОЖНО ВОССТАНОВИТЬ АДРЕСА!"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

# Спрашиваем подтверждение
read -p "🤔 Do you want to backup this seed phrase to GitHub Secrets? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Backup cancelled by user"
    exit 0
fi

# Добавляем seed phrase в GitHub Secrets
echo "📤 Backing up seed phrase to GitHub Secrets..."
if gh secret set HD_WALLET_SEED --body "$SEED_PHRASE"; then
    echo "✅ Seed phrase successfully backed up to GitHub Secrets"
else
    echo "❌ Error: Failed to backup seed phrase to GitHub Secrets"
    exit 1
fi

# Проверяем, что секрет добавлен
echo "🔍 Verifying backup..."
if gh secret list | grep -q "HD_WALLET_SEED"; then
    echo "✅ HD_WALLET_SEED found in GitHub Secrets"
else
    echo "❌ Error: HD_WALLET_SEED not found in GitHub Secrets"
    exit 1
fi

echo ""
echo "🎉 Seed phrase backup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "   1. ✅ Seed phrase is backed up in GitHub Secrets"
echo "   2. 📝 Write the seed phrase in your secure notebook"
echo "   3. 🔒 Keep the seed phrase safe - it's needed to recover addresses"
echo "   4. 🚀 Your system is ready for production deployment"
echo ""
echo "⚠️  IMPORTANT: Never share this seed phrase with anyone!"
echo "⚠️  IMPORTANT: Store it in a secure location offline!"
echo ""






