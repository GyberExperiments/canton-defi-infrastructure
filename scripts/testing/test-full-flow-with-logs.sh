#!/bin/bash
# Скрипт для полного тестирования флоу создания заявки с мониторингом логов
# Пользователь будет в Telegram нажимать "принять ордер", а мы следим за логами

set -e

API_URL="${API_URL:-https://1otc.cc/api/create-order}"
NAMESPACE="canton-otc"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "🧪 Полное тестирование флоу создания заявки"
echo "=============================================="
echo "Время: $(date)"
echo "API: $API_URL"
echo ""
echo "📋 Инструкции:"
echo "1. Я создам заявку через curl"
echo "2. Вы будете смотреть уведомления в Telegram (клиентская и админская группы)"
echo "3. Нажмите 'принять ордер' в клиентской группе"
echo "4. Нажмите 'принять ордер' в админской группе"
echo "5. Я буду следить за логами и проверять весь флоу"
echo ""
read -p "Нажмите Enter когда будете готовы начать тест..."

# Запускаем мониторинг логов в фоне
echo ""
echo "📊 Запускаю мониторинг логов..."
LOG_FILE="/tmp/canton-otc-test-logs-$TIMESTAMP.txt"
kubectl logs -n $NAMESPACE deployment/canton-otc -f > "$LOG_FILE" 2>&1 &
LOG_PID=$!
echo "   Логи пишутся в: $LOG_FILE"
echo "   PID процесса: $LOG_PID"
echo ""

# Функция для создания заявки
create_order() {
    local test_name=$1
    local order_data=$2
    
    echo "📝 Создаю заявку: $test_name"
    echo "   Данные: $order_data" | jq -c '.' 2>/dev/null || echo "   Данные: $order_data"
    
    RESPONSE=$(curl -s -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -d "$order_data")
    
    echo ""
    echo "📤 Ответ API:"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    
    ORDER_ID=$(echo "$RESPONSE" | jq -r '.orderId // empty')
    SUCCESS=$(echo "$RESPONSE" | jq -r '.success // false')
    
    if [ "$SUCCESS" = "true" ] && [ -n "$ORDER_ID" ]; then
        echo ""
        echo "✅ Заявка создана успешно!"
        echo "   Order ID: $ORDER_ID"
        echo "   Order Link: $(echo "$RESPONSE" | jq -r '.orderLink // "N/A"')"
        echo ""
        echo "🔔 Проверьте Telegram:"
        echo "   - Клиентская группа: должно быть уведомление о новой заявке"
        echo "   - Админская группа: должно быть уведомление о новой заявке"
        echo ""
        echo "⏳ Ожидаю действий в Telegram..."
        echo "   (Нажмите 'принять ордер' в клиентской группе, затем в админской)"
        echo ""
        
        return 0
    else
        echo ""
        echo "❌ Ошибка создания заявки!"
        ERROR=$(echo "$RESPONSE" | jq -r '.error // "Unknown error"')
        echo "   Ошибка: $ERROR"
        echo ""
        return 1
    fi
}

# Функция для проверки логов
check_logs() {
    echo ""
    echo "📊 Анализ логов за последние 2 минуты..."
    echo "=========================================="
    
    # Проверяем успешное сохранение в Supabase
    echo ""
    echo "✅ Проверка сохранения в Supabase:"
    tail -100 "$LOG_FILE" | grep -E "Order saved to Supabase|Supabase insert failed" | tail -5 || echo "   Не найдено записей о сохранении"
    
    # Проверяем отправку уведомлений
    echo ""
    echo "📨 Проверка уведомлений:"
    tail -100 "$LOG_FILE" | grep -E "Telegram.*notification|Intercom.*notification|Public notification" | tail -5 || echo "   Не найдено записей об уведомлениях"
    
    # Проверяем ошибки
    echo ""
    echo "❌ Проверка ошибок:"
    tail -100 "$LOG_FILE" | grep -iE "error|failed|exception" | tail -10 || echo "   Ошибок не найдено ✅"
    
    # Проверяем обработку callback от Telegram
    echo ""
    echo "🔄 Проверка обработки Telegram callback:"
    tail -100 "$LOG_FILE" | grep -E "handleCallbackQuery|Order.*accepted|status.*accepted" | tail -5 || echo "   Не найдено записей о callback"
}

# Тест 1: Создание заявки BUY с market price и discount 2%
echo "=============================================="
echo "ТЕСТ 1: BUY заявка с market price и discount 2%"
echo "=============================================="

ORDER_DATA_1='{
  "cantonAddress": "04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
  "refundAddress": "bron::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
  "paymentAmount": 100,
  "paymentAmountUSD": 100,
  "cantonAmount": 663,
  "email": "test-flow-'$TIMESTAMP'@example.com",
  "exchangeDirection": "buy",
  "isMarketPrice": true,
  "marketPriceDiscountPercent": 2,
  "paymentToken": {
    "symbol": "USDT",
    "network": "TRON",
    "networkName": "TRON (TRC-20)"
  }
}'

if create_order "BUY с market price и discount 2%" "$ORDER_DATA_1"; then
    ORDER_ID_1="$ORDER_ID"
    
    echo "⏳ Ожидаю 10 секунд для обработки уведомлений..."
    sleep 10
    
    check_logs
    
    echo ""
    echo "⏸️  Пауза для действий в Telegram..."
    echo "   Нажмите 'принять ордер' в клиентской группе"
    read -p "   Нажмите Enter после принятия в клиентской группе..."
    
    sleep 5
    check_logs
    
    echo ""
    echo "⏸️  Пауза для действий в Telegram..."
    echo "   Нажмите 'принять ордер' в админской группе"
    read -p "   Нажмите Enter после принятия в админской группе..."
    
    sleep 5
    check_logs
    
    echo ""
    echo "🔍 Проверка финального статуса заявки в БД:"
    echo "   Order ID: $ORDER_ID_1"
    echo ""
    echo "   (Проверьте в Supabase что статус изменился на 'accepted' или 'in_progress')"
fi

# Останавливаем мониторинг логов
echo ""
echo "🛑 Останавливаю мониторинг логов..."
kill $LOG_PID 2>/dev/null || true
wait $LOG_PID 2>/dev/null || true

echo ""
echo "📄 Полные логи сохранены в: $LOG_FILE"
echo ""
echo "✅ Тестирование завершено!"
echo ""
echo "📊 Итоги:"
echo "   - Проверьте логи на наличие ошибок"
echo "   - Проверьте что заявка сохранилась в Supabase"
echo "   - Проверьте что уведомления отправились в Telegram"
echo "   - Проверьте что статус заявки обновился после принятия"
