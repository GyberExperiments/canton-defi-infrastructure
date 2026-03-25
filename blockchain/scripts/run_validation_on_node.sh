#!/bin/bash

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   Запуск валидации IP с ноды canton-node-65-108-15-30         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Создаем временный скрипт на ноде
TEMP_SCRIPT="/tmp/validate_ip_$(date +%s).sh"

kubectl debug node/canton-node-65-108-15-30 -it --image=ubuntu:latest -- bash -c "
set -o pipefail

echo '╔════════════════════════════════════════════════════════════════╗'
echo '║   Проверка валидации IP-адреса 65.108.15.30 (Devnet)          ║'
echo '╚════════════════════════════════════════════════════════════════╝'
echo ''

# Проверка текущего IP
echo '1️⃣  Текущий IP-адрес ноды:'
CURRENT_IP=\$(curl -sSL http://checkip.amazonaws.com 2>/dev/null || echo 'unknown')
echo \"   IP: \$CURRENT_IP\"
echo ''

if [ \"\$CURRENT_IP\" = \"65.108.15.30\" ]; then
  echo '✅ Правильный IP для Devnet'
else
  echo '⚠️  IP не совпадает! Ожидается 65.108.15.30'
fi
echo ''

# Проверка наличия необходимых утилит
echo '2️⃣  Проверка утилит:'
for tool in curl jq grpcurl; do
  if command -v \$tool &>/dev/null; then
    echo \"   ✓ \$tool установлен\"
  else
    echo \"   ✗ \$tool НЕ установлен\"
  fi
done
echo ''

# Тест №1: Scan URL
echo '3️⃣  Тест №1: Проверка Scan URL'
echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

CURL='curl -fsS -m 5 --connect-timeout 5'

echo 'Получение списка Scan URL...'
scan_urls=\$(\$CURL https://scan.sv-1.dev.global.canton.network.sync.global/api/scan/v0/scans 2>/dev/null | jq -r '.scans[].scans[].publicUrl' 2>/dev/null)

if [ -z \"\$scan_urls\" ]; then
    echo '❌ Не удалось получить список Scan URL'
else
    echo 'Результаты:'
    scan_success=0
    scan_fail=0
    for url in \$scan_urls; do
        result=\$(\$CURL \"\$url\"/api/scan/version 2>&1 | jq -r '.version' 2>/dev/null)
        if [ -n \"\$result\" ] && [ \"\$result\" != \"null\" ]; then
            echo \"  ✓ \$url: \$result\"
            ((scan_success++))
        else
            echo \"  ✗ \$url: TIMEOUT/ERROR\"
            ((scan_fail++))
        fi
    done
    echo \"  Итого: \$scan_success успешно, \$scan_fail ошибок\"
fi
echo ''

# Тест №2: Sequencer
echo '4️⃣  Тест №2: Проверка Sequencer'
echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

echo 'Получение списка Sequencer URL...'
sequencer_urls=\$(curl -fsS -m 5 --connect-timeout 5 https://scan.sv-1.dev.global.canton.network.sync.global/api/scan/v0/dso-sequencers 2>/dev/null | jq -r '.domainSequencers[].sequencers[].url | sub(\"https://\"; \"\")' 2>/dev/null)

if [ -z \"\$sequencer_urls\" ]; then
    echo '❌ Не удалось получить список Sequencer URL'
else
    echo 'Результаты:'
    seq_success=0
    seq_fail=0
    for url in \$sequencer_urls; do
        result=\$(grpcurl --max-time 10 \"\$url\":443 grpc.health.v1.Health/Check 2>&1)
        if echo \"\$result\" | grep -q \"SERVING\"; then
            echo \"  ✓ \$url: SERVING\"
            ((seq_success++))
        else
            echo \"  ✗ \$url: NOT SERVING\"
            ((seq_fail++))
        fi
    done
    echo \"  Итого: \$seq_success успешно, \$seq_fail ошибок\"
fi

echo ''
echo '╔════════════════════════════════════════════════════════════════╗'
echo '║                        РЕЗУЛЬТАТЫ                              ║'
echo '╚════════════════════════════════════════════════════════════════╝'
echo ''

if [ \"\${scan_fail:-0}\" -eq 0 ] && [ \"\${seq_fail:-0}\" -eq 0 ]; then
    echo '✅ ОБА ТЕСТА ПРОЙДЕНЫ!'
    echo 'IP 65.108.15.30 валидирован для Devnet'
else
    echo '⚠️  ТРЕБУЕТСЯ ПРОВЕРКА'
    echo 'Некоторые SV еще не добавили ваш IP в allowlist'
    echo 'Ожидание может занять 2-7 дней'
fi
echo ''
" 2>&1