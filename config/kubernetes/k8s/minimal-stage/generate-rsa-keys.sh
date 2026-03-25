#!/bin/bash
set -e

echo "🔑 Генерация RSA ключей для Supabase GoTrue"

# Генерация приватного ключа
openssl genrsa -out /tmp/private_key.pem 2048

# Генерация публичного ключа
openssl rsa -in /tmp/private_key.pem -pubout -out /tmp/public_key.pem

# Конвертация в формат для GitHub Secrets (одна строка с \n)
PRIVATE_KEY=$(awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' /tmp/private_key.pem)
PUBLIC_KEY=$(awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' /tmp/public_key.pem)

echo "=========================================="
echo "ДОБАВЬТЕ ЭТИ СЕКРЕТЫ В GITHUB SECRETS:"
echo "=========================================="
echo ""
echo "SUPABASE_RSA_PRIVATE_KEY=$PRIVATE_KEY"
echo ""
echo "SUPABASE_RSA_PUBLIC_KEY=$PUBLIC_KEY"
echo ""
echo "=========================================="

# Удаление временных файлов
rm /tmp/private_key.pem /tmp/public_key.pem

echo "✅ RSA ключи сгенерированы и удалены из /tmp"