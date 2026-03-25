#!/bin/bash

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   Проверка валидации IP-адресов для Canton Networks           ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Проверка текущего IP
echo "1️⃣  Проверка вашего текущего IP-адреса:"
CURRENT_IP=$(curl -sSL http://checkip.amazonaws.com 2>/dev/null | tr -d '\n')
if [ -z "$CURRENT_IP" ]; then
    CURRENT_IP=$(curl -sSL https://api.ipify.org 2>/dev/null)
fi
echo "   Текущий IP: $CURRENT_IP"
echo ""

echo "ℹ️  Ваши зарегистрированные IP-адреса:"
echo "   Devnet:  65.108.15.30"
echo "   Testnet: 65.108.15.20"
echo "   Mainnet: 65.108.15.19"
echo ""

# Проверка наличия необходимых утилит
echo "2️⃣  Проверка необходимых утилит:"

required_tools=("curl" "jq" "grpcurl")
missing_tools=()

for tool in "${required_tools[@]}"; do
    if command -v "$tool" &> /dev/null; then
        echo "   ✓ $tool: установлен"
    else
        echo "   ✗ $tool: НЕ установлен"
        missing_tools+=("$tool")
    fi
done

echo ""

if [ ${#missing_tools[@]} -gt 0 ]; then
    echo "⚠️  Установите отсутствующие утилиты:"
    echo "   macOS: brew install ${missing_tools[@]}"
    echo "   Linux: apt-get install ${missing_tools[@]}"
    exit 1
fi

echo "3️⃣  Запуск тестов подключения..."
echo ""

# Запуск тестов
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Тест №1: Scan URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
bash "$script_dir/scan_test.sh"
scan_result=$?

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Тест №2: Sequencer Endpoints"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
bash "$script_dir/sequencer_test.sh"
sequencer_result=$?

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                        ИТОГОВЫЕ РЕЗУЛЬТАТЫ                     ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

if [ $scan_result -eq 0 ] && [ $sequencer_result -eq 0 ]; then
    echo "✅ ОБА ТЕСТА ПРОЙДЕНЫ УСПЕШНО!"
    echo ""
    echo "Ваш IP-адрес валидирован. Можно переходить к развертыванию ноды."
    exit 0
elif [ $scan_result -eq 0 ] || [ $sequencer_result -eq 0 ]; then
    echo "⚠️  ЧАСТИЧНАЯ УСПЕШНОСТЬ"
    echo ""
    echo "Следующие тесты прошли:"
    [ $scan_result -eq 0 ] && echo "  ✓ Scan URL проверен"
    [ $sequencer_result -eq 0 ] && echo "  ✓ Sequencer проверен"
    echo ""
    echo "Рекомендация: Подождите 2-7 дней и повторите проверку"
    exit 1
else
    echo "❌ ТЕСТЫ НЕ ПРОЙДЕНЫ"
    echo ""
    echo "Возможные причины:"
    echo "  • Ваш IP еще не добавлен в allowlist Super Validators"
    echo "  • Проблема с сетевым подключением"
    echo "  • Перезагрузите локальную машину или нее на кубер кластере"
    echo ""
    echo "Рекомендация:"
    echo "  1. Убедитесь, что используете статический IP: 65.108.15.30 (Devnet)"
    echo "  2. Подождите 2-7 дней, пока Super Validators обновят allowlist"
    echo "  3. Если прошло более 7 дней, свяжитесь со спонсором"
    exit 1
fi