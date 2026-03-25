#!/bin/bash
# 🧪 Скрипт для тестирования Telegram Client API

set -e

NAMESPACE="${NAMESPACE:-canton-otc}"
DEPLOYMENT="${DEPLOYMENT:-canton-otc}"

echo "🧪 Тестирование Telegram Client API"
echo "===================================="
echo ""

# Проверка подключения
echo "1️⃣ Проверка подключения к Telegram..."
kubectl exec -n "$NAMESPACE" deployment/"$DEPLOYMENT" -- node -e "
const { telegramClientService } = require('./src/lib/services/telegramClient');
telegramClientService.checkConnection().then(connected => {
  if (connected) {
    console.log('✅ Подключение успешно');
    process.exit(0);
  } else {
    console.log('❌ Подключение не удалось');
    process.exit(1);
  }
}).catch(err => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});
" || {
  echo "❌ Не удалось проверить подключение"
  exit 1
}

echo ""
echo "2️⃣ Получение информации о пользователе..."
kubectl exec -n "$NAMESPACE" deployment/"$DEPLOYMENT" -- node -e "
const { telegramClientService } = require('./src/lib/services/telegramClient');
telegramClientService.getMe().then(me => {
  if (me) {
    console.log('✅ Пользователь:', me.firstName, me.lastName || '', \`(@\${me.username || 'no username'})\`);
    console.log('   ID:', me.id);
    process.exit(0);
  } else {
    console.log('❌ Не удалось получить информацию');
    process.exit(1);
  }
}).catch(err => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});
" || {
  echo "❌ Не удалось получить информацию о пользователе"
  exit 1
}

echo ""
echo "✅ Тестирование завершено успешно!"
echo ""
echo "💡 Для отправки тестового сообщения используйте:"
echo "   kubectl exec -n $NAMESPACE deployment/$DEPLOYMENT -- node -e \""
echo "   const { telegramClientService } = require('./src/lib/services/telegramClient');"
echo "   telegramClientService.sendMessage('@username', 'Тестовое сообщение').then(r => console.log(r));"
echo "   \""





