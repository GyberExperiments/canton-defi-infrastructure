#!/bin/bash

# 🔄 Canton OTC Deployment Monitor
# Мониторит статус деплоя до успешного завершения

SITE_URL="https://1otc.cc"
HEALTH_URL="https://1otc.cc/api/health"
MAX_ATTEMPTS=30
INTERVAL=60  # 1 минута между проверками

echo "🚀 Начинаю мониторинг деплоя Canton OTC..."
echo "🌐 Site: $SITE_URL"
echo "🏥 Health: $HEALTH_URL"
echo "⏰ Интервал: ${INTERVAL}s | Максимум попыток: $MAX_ATTEMPTS"
echo "=========================================="

attempt=1
while [ $attempt -le $MAX_ATTEMPTS ]; do
    echo -n "[$attempt/$MAX_ATTEMPTS] $(date '+%H:%M:%S') - "
    
    # Проверяем health endpoint
    http_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 30 "$HEALTH_URL" 2>/dev/null)
    
    if [ "$http_code" = "200" ]; then
        echo "✅ ДЕПЛОЙ УСПЕШЕН! Health check: HTTP $http_code"
        echo ""
        echo "🎉 Сайт успешно развернут и работает!"
        echo "🌐 Основной сайт: $SITE_URL"  
        echo "🏥 Health check: $HEALTH_URL"
        echo "👤 Admin панель: $SITE_URL/admin"
        echo ""
        echo "🔍 Финальная проверка endpoints..."
        
        # Проверяем основные endpoints
        main_status=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$SITE_URL" 2>/dev/null)
        admin_status=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$SITE_URL/admin" 2>/dev/null)
        
        echo "   Main page: HTTP $main_status"
        echo "   Health: HTTP $http_code"  
        echo "   Admin: HTTP $admin_status"
        
        exit 0
    elif [ "$http_code" = "000" ]; then
        echo "🔄 Сайт недоступен (деплой в процессе...)"
    else
        echo "⚠️  HTTP $http_code (возможно еще деплоится...)"
    fi
    
    if [ $attempt -lt $MAX_ATTEMPTS ]; then
        echo "   ⏳ Жду ${INTERVAL}s до следующей проверки..."
        sleep $INTERVAL
    fi
    
    ((attempt++))
done

echo ""
echo "❌ Деплой не завершился за $(($MAX_ATTEMPTS * $INTERVAL / 60)) минут"
echo "🔍 Необходимо проверить GitHub Actions вручную:"
echo "   https://github.com/TheMacroeconomicDao/CantonOTC/actions"
exit 1



