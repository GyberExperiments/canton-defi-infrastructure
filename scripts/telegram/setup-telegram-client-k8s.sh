#!/bin/bash
# 🔐 Скрипт для настройки Telegram Client API в Kubernetes
# Использует значения из .env.local для создания Kubernetes Secret

set -e

NAMESPACE="${NAMESPACE:-canton-otc}"
SECRET_NAME="${SECRET_NAME:-canton-otc-secrets}"

echo "🔐 Настройка Telegram Client API в Kubernetes"
echo "=============================================="
echo ""

# Проверка наличия .env.local
ENV_FILE=".env.local"
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Файл $ENV_FILE не найден!"
  echo ""
  echo "📝 Сначала выполните:"
  echo "   1. Получите API credentials на https://my.telegram.org/apps"
  echo "   2. Добавьте TELEGRAM_API_ID и TELEGRAM_API_HASH в .env.local"
  echo "   3. Запустите: node scripts/setup-telegram-session-improved.js"
  echo "   4. Затем запустите этот скрипт снова"
  exit 1
fi

# Загрузка переменных из .env.local
source "$ENV_FILE" 2>/dev/null || {
  echo "⚠️ Не удалось загрузить .env.local напрямую, используем grep..."
}

# Получение значений
API_ID=$(grep "^TELEGRAM_API_ID=" "$ENV_FILE" | cut -d'=' -f2 | tr -d '"' | tr -d "'" | xargs || echo "")
API_HASH=$(grep "^TELEGRAM_API_HASH=" "$ENV_FILE" | cut -d'=' -f2 | tr -d '"' | tr -d "'" | xargs || echo "")
SESSION_STRING=$(grep "^TELEGRAM_SESSION_STRING=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'" | xargs || echo "")

# Проверка наличия всех переменных
if [ -z "$API_ID" ] || [ -z "$API_HASH" ] || [ -z "$SESSION_STRING" ]; then
  echo "❌ Не все переменные найдены в .env.local!"
  echo ""
  echo "Найдено:"
  [ -n "$API_ID" ] && echo "  ✅ TELEGRAM_API_ID" || echo "  ❌ TELEGRAM_API_ID"
  [ -n "$API_HASH" ] && echo "  ✅ TELEGRAM_API_HASH" || echo "  ❌ TELEGRAM_API_HASH"
  [ -n "$SESSION_STRING" ] && echo "  ✅ TELEGRAM_SESSION_STRING" || echo "  ❌ TELEGRAM_SESSION_STRING"
  echo ""
  echo "📝 Убедитесь что:"
  echo "   1. TELEGRAM_API_ID и TELEGRAM_API_HASH добавлены в .env.local"
  echo "   2. Запущен скрипт: node scripts/setup-telegram-session-improved.js"
  echo "   3. TELEGRAM_SESSION_STRING сохранен в .env.local"
  exit 1
fi

echo "✅ Найдены все необходимые переменные:"
echo "   API_ID: ${API_ID:0:4}****"
echo "   API_HASH: ${API_HASH:0:10}****"
echo "   SESSION_STRING: ${#SESSION_STRING} символов"
echo ""

# Проверка существования Secret
if kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" &>/dev/null; then
  echo "📝 Обновление существующего Secret: $SECRET_NAME"
  
  # Обновление Secret через patch
  kubectl create secret generic "$SECRET_NAME" \
    --from-literal=TELEGRAM_API_ID="$API_ID" \
    --from-literal=TELEGRAM_API_HASH="$API_HASH" \
    --from-literal=TELEGRAM_SESSION_STRING="$SESSION_STRING" \
    --dry-run=client -o yaml | \
    kubectl patch secret "$SECRET_NAME" -n "$NAMESPACE" --patch-file=/dev/stdin --type=merge || {
    
    # Fallback: удаление и создание заново (если patch не работает)
    echo "⚠️ Patch не удался, обновляем через delete/create..."
    kubectl delete secret "$SECRET_NAME" -n "$NAMESPACE" --ignore-not-found=true
    
    # Получаем все существующие ключи
    EXISTING_KEYS=$(kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" -o jsonpath='{.data}' 2>/dev/null | jq -r 'keys[]' || echo "")
    
    # Создаем команду с сохранением всех существующих ключей
    CREATE_CMD="kubectl create secret generic $SECRET_NAME -n $NAMESPACE"
    CREATE_CMD="$CREATE_CMD --from-literal=TELEGRAM_API_ID=\"$API_ID\""
    CREATE_CMD="$CREATE_CMD --from-literal=TELEGRAM_API_HASH=\"$API_HASH\""
    CREATE_CMD="$CREATE_CMD --from-literal=TELEGRAM_SESSION_STRING=\"$SESSION_STRING\""
    
    # Добавляем существующие ключи (кроме тех что обновляем)
    for key in $EXISTING_KEYS; do
      if [ "$key" != "TELEGRAM_API_ID" ] && [ "$key" != "TELEGRAM_API_HASH" ] && [ "$key" != "TELEGRAM_SESSION_STRING" ]; then
        VALUE=$(kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" -o jsonpath="{.data.$key}" | base64 -d 2>/dev/null || echo "")
        if [ -n "$VALUE" ]; then
          CREATE_CMD="$CREATE_CMD --from-literal=$key=\"$VALUE\""
        fi
      fi
    done
    
    eval "$CREATE_CMD"
  }
else
  echo "📝 Создание нового Secret: $SECRET_NAME"
  kubectl create secret generic "$SECRET_NAME" \
    --from-literal=TELEGRAM_API_ID="$API_ID" \
    --from-literal=TELEGRAM_API_HASH="$API_HASH" \
    --from-literal=TELEGRAM_SESSION_STRING="$SESSION_STRING" \
    -n "$NAMESPACE"
fi

echo ""
echo "✅ Secret успешно создан/обновлен!"
echo ""
echo "📋 Проверка Secret:"
kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" -o jsonpath='{.data}' | jq -r 'keys[]' | grep -E "TELEGRAM_API|TELEGRAM_SESSION" | while read key; do
  echo "   ✅ $key"
done

echo ""
echo "🔄 Теперь нужно перезапустить deployment для применения изменений:"
echo "   kubectl rollout restart deployment/canton-otc -n $NAMESPACE"
echo ""
echo "💡 Или используйте скрипт:"
echo "   ./scripts/restart-deployment.sh"





