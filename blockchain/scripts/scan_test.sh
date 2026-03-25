#!/bin/bash
set -o pipefail

echo "=== Тест подключения к Scan URL ==="
echo ""

CURL='curl -fsS -m 5 --connect-timeout 5'

echo "Получение списка Scan URL..."
scan_urls=$($CURL https://scan.sv-1.unknown_cluster.global.canton.network.sync.global/api/scan/v0/scans | jq -r '.scans[].scans[].publicUrl' 2>/dev/null)

if [ -z "$scan_urls" ]; then
    echo "❌ Не удалось получить список Scan URL"
    echo "Попытка альтернативного источника..."
    exit 1
fi

echo "Проверка версии для каждого Scan URL:"
echo ""

success_count=0
fail_count=0

for url in $scan_urls; do
    result=$($CURL "$url"/api/scan/version 2>&1 | jq -r '.version' 2>/dev/null)
    
    if [ -n "$result" ] && [ "$result" != "null" ]; then
        echo "✓ $url: $result"
        ((success_count++))
    else
        echo "✗ $url: FAILED (timeout или ошибка подключения)"
        ((fail_count++))
    fi
done

echo ""
echo "Результаты теста Scan:"
echo "  Успешно: $success_count"
echo "  Ошибок: $fail_count"
echo ""

if [ $fail_count -eq 0 ]; then
    echo "✓ Тест Scan пройден успешно!"
    exit 0
else
    echo "⚠ Некоторые SV еще не добавили ваш IP в allowlist"
    exit 1
fi