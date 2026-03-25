#!/bin/bash

# Скрипт проверки валидации IP для Testnet
# Можно запустить на сервере 65.108.15.20 или через SSH

set -e

NETWORK="testnet"
EXPECTED_IP="65.108.15.20"
SCAN_API="https://scan.sv-1.testnet.global.canton.network.sync.global"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   Проверка валидации IP-адреса $EXPECTED_IP (Testnet)         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Проверка текущего IP
echo "1️⃣  Текущий IP-адрес ноды:"
CURRENT_IP=$(curl -sSL http://checkip.amazonaws.com 2>/dev/null || echo "unknown")
echo "   IP: $CURRENT_IP"
echo ""

if [ "$CURRENT_IP" = "$EXPECTED_IP" ]; then
  echo "✅ Правильный IP для Testnet"
else
  echo "⚠️  IP не совпадает! IP: $CURRENT_IP [ожидается $EXPECTED_IP]"
fi
echo ""

# Тест №1: Scan URL
echo "2️⃣  Тест №1: Проверка Scan URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Попытка подключения к $SCAN_API"
echo ""

response=$(curl -fsS -m 10 --connect-timeout 5 "$SCAN_API/api/scan/v0/scans" 2>&1)

if echo "$response" | grep -q '"scans"'; then
    echo "✅ Успешное подключение к Scan API"
    echo "Получение версий для каждого Scan URL..."
    echo ""
    
    scan_urls=$(echo "$response" | grep -o 'https://[^"]*' | sort -u)
    success_count=0
    fail_count=0
    
    for url in $scan_urls; do
        version=$(curl -fsS -m 5 --connect-timeout 5 "$url/api/scan/version" 2>/dev/null | grep -o '"version":"[^"]*' | cut -d'"' -f4 || echo "")
        if [ -n "$version" ]; then
            echo "  ✓ $url: $version"
            ((success_count++))
        else
            echo "  ✗ $url: TIMEOUT/ERROR"
            ((fail_count++))
        fi
    done
    
    echo ""
    echo "Результаты Scan теста:"
    echo "  ✅ Успешно: $success_count"
    echo "  ❌ Ошибок: $fail_count"
    echo "  📊 Процент успеха: $(( success_count * 100 / (success_count + fail_count) ))%"
    
    # Требуется минимум 2/3 (66.7%)
    total=$((success_count + fail_count))
    if [ $total -gt 0 ]; then
        percentage=$(( success_count * 100 / total ))
        if [ $percentage -ge 67 ]; then
            echo "  ✅ Требование 2/3 выполнено!"
        else
            echo "  ⚠️  Требуется минимум 66.7% (2/3), текущий: ${percentage}%"
        fi
    fi
else
    echo "❌ Не удалось подключиться к Scan API"
    echo "Ответ: $response"
    fail_count=999
    success_count=0
fi
echo ""

# Тест №2: Sequencer endpoints
echo "3️⃣  Тест №2: Проверка Sequencer URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Попытка подключения к sequencer API..."
echo ""

sequencer_response=$(curl -fsS -m 10 --connect-timeout 5 "$SCAN_API/api/scan/v0/dso-sequencers" 2>&1)

if echo "$sequencer_response" | grep -q '"sequencers"'; then
    echo "✅ Успешное подключение к Sequencer API"
    sequencer_urls=$(echo "$sequencer_response" | grep -o '"url":"https://[^"]*' | cut -d'"' -f4 | sort -u)
    seq_count=$(echo "$sequencer_urls" | wc -l | tr -d ' ')
    echo "Найдено Sequencer endpoints: $seq_count"
    echo ""
    echo "$sequencer_urls" | head -10 | while read url; do
        echo "  • $url"
    done
    if [ $seq_count -gt 10 ]; then
        echo "  ... и еще $((seq_count - 10)) endpoints"
    fi
else
    echo "❌ Не удалось подключиться к Sequencer API"
    echo "Ответ: $sequencer_response"
fi
echo ""

# Итоги
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                        ИТОГИ ПРОВЕРКИ                          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Дополнительная информация:"
echo "  • Static IP: $EXPECTED_IP"
echo "  • Network: Testnet"
echo "  • Текущий IP: $CURRENT_IP"
echo ""

if [ "$CURRENT_IP" = "$EXPECTED_IP" ]; then
    echo "Статус IP: ✅ IP-адрес подтвержден"
else
    echo "Статус IP: ⚠️  IP-адрес не совпадает"
fi
echo ""

if [ "${fail_count:-0}" -eq 0 ] && [ "${success_count:-0}" -gt 0 ]; then
    echo "✅ IP-адрес валидирован для Testnet!"
    echo "   Все Super Validators добавили IP в allowlist"
elif [ "${success_count:-0}" -gt 0 ]; then
    total=$((success_count + fail_count))
    percentage=$(( success_count * 100 / total ))
    if [ $percentage -ge 67 ]; then
        echo "✅ IP-адрес валидирован для Testnet!"
        echo "   $success_count из $total SV добавили IP (${percentage}%)"
        echo "   Требование 2/3 выполнено"
    else
        echo "⏳ IP-адрес частично валидирован"
        echo "   $success_count из $total SV добавили IP (${percentage}%)"
        echo "   Ожидайте 2-7 дней, пока остальные SV обновят allowlist"
    fi
else
    echo "❌ IP-адрес НЕ валидирован"
    echo "   Не удалось подключиться к Super Validators"
    echo "   Проверьте:"
    echo "   1. IP адрес правильный ($EXPECTED_IP)"
    echo "   2. Сетевое подключение работает"
    echo "   3. SV sponsor добавил IP в whitelist"
fi
echo ""





