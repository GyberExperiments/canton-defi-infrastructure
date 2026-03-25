#!/bin/bash
set -o pipefail

echo "=== Тест подключения к Sequencer Endpoints ==="
echo ""

echo "Получение списка Sequencer URL..."
sequencer_urls=$(curl -fsS -m 5 --connect-timeout 5 https://scan.sv-1.unknown_cluster.global.canton.network.sync.global/api/scan/v0/dso-sequencers 2>/dev/null | jq -r '.domainSequencers[].sequencers[].url | sub("https://"; "")' 2>/dev/null)

if [ -z "$sequencer_urls" ]; then
    echo "❌ Не удалось получить список Sequencer URL"
    exit 1
fi

echo "Проверка статуса каждого Sequencer:"
echo ""

success_count=0
fail_count=0

for url in $sequencer_urls; do
    echo -n "Проверка $url: "
    result=$(grpcurl --max-time 10 "$url":443 grpc.health.v1.Health/Check 2>&1)
    
    if echo "$result" | grep -q "SERVING"; then
        echo "✓ SERVING"
        ((success_count++))
    else
        echo "✗ FAILED"
        echo "  Ответ: $result"
        ((fail_count++))
    fi
done

echo ""
echo "Результаты теста Sequencer:"
echo "  Успешно: $success_count"
echo "  Ошибок: $fail_count"
echo ""

if [ $fail_count -eq 0 ]; then
    echo "✓ Тест Sequencer пройден успешно!"
    exit 0
else
    echo "⚠ Некоторые Sequencer не отвечают или недоступны"
    exit 1
fi