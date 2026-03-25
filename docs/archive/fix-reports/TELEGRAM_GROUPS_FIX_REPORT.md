# 🔧 ОТЧЕТ ОБ ИСПРАВЛЕНИИ МАРШРУТИЗАЦИИ TELEGRAM ГРУПП

**Дата:** $(date +%Y-%m-%d)  
**Статус:** ✅ Исправления внесены, готово к деплою

## 📋 ПРОБЛЕМА

- Обе заявки приходят в группу нотификаций (1OTC.cc | Notifications, ID: -4872025335)
- В группу клиентов (1OTC_ORDERS, ID: -5039619304) ничего не приходит
- Deployment использует старую версию образа `minimal-stage` без исправлений

## ✅ ВЫПОЛНЕННЫЕ ИСПРАВЛЕНИЯ

### 1. Улучшено логирование в `telegram.ts`

**Файл:** `src/lib/services/telegram.ts`

#### a) Метод `initializeConfig()` (строки 24-48)
- ✅ Добавлено детальное логирование переменной `TELEGRAM_CLIENT_GROUP_CHAT_ID`
- ✅ Добавлено предупреждение если группа клиентов не настроена
- ✅ Логируется сырое значение переменной для диагностики

**Изменения:**
```typescript
// 🔍 ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ конфигурации групп
console.log('📱 Telegram Service Config:', {
  hasBotToken: !!botToken,
  operatorGroupChatId: chatId,
  clientGroupChatId: clientGroupChatId || 'не настроена',
  clientGroupChatIdRaw: process.env.TELEGRAM_CLIENT_GROUP_CHAT_ID, // Сырое значение
  isClientGroupConfigured: !!clientGroupChatId,
  timestamp: new Date().toISOString()
});

// ⚠️ Предупреждение если группа клиентов не настроена
if (!clientGroupChatId) {
  console.warn('⚠️ TELEGRAM_CLIENT_GROUP_CHAT_ID не настроена - sendPublicOrderNotification будет использовать fallback');
} else {
  console.log('✅ TELEGRAM_CLIENT_GROUP_CHAT_ID настроена:', clientGroupChatId);
}
```

#### b) Метод `sendPublicOrderNotification()` (строки 337-411)
- ✅ Добавлено детальное логирование для диагностики
- ✅ Логируются все переменные окружения связанные с Telegram
- ✅ Логируется использование fallback

**Изменения:**
```typescript
// 🔍 ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ для диагностики
console.log('🔍 sendPublicOrderNotification debug:', {
  orderId: order.orderId,
  clientGroupChatId: clientGroupChatId || 'undefined',
  configChatId: this.config.chatId,
  finalChatId: chatId,
  isClientGroup: !!clientGroupChatId,
  usingFallback: !clientGroupChatId,
  allTelegramEnvVars: {
    TELEGRAM_CLIENT_GROUP_CHAT_ID: process.env.TELEGRAM_CLIENT_GROUP_CHAT_ID || 'undefined',
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || 'undefined',
  },
  timestamp: new Date().toISOString()
});
```

### 2. Обновлен deployment.yaml

**Файл:** `config/kubernetes/k8s/minimal-stage/deployment.yaml`

- ✅ Обновлен тег образа с `minimal-stage` на `main` (строка 25)
- ✅ Теперь используется актуальная версия кода с исправлениями

**Изменение:**
```yaml
image: ghcr.io/themacroeconomicdao/cantonotc:main  # Было: minimal-stage
```

### 3. Создан скрипт для диагностики и деплоя

**Файл:** `scripts/fix-telegram-groups-deploy.sh`

Скрипт выполняет:
- ✅ Проверку переменных окружения в deployment
- ✅ Проверку переменных в runtime (в поде)
- ✅ Проверку логов инициализации TelegramService
- ✅ Обновление образа на тег `main` (опционально)
- ✅ Финальную проверку после обновления

## 🔍 ДИАГНОСТИКА

### Что проверяет код:

1. **Инициализация TelegramService:**
   - Логирует наличие `TELEGRAM_CLIENT_GROUP_CHAT_ID` при старте
   - Предупреждает если переменная не настроена

2. **Отправка в группу клиентов:**
   - Читает `process.env.TELEGRAM_CLIENT_GROUP_CHAT_ID` напрямую
   - Использует fallback на `this.config.chatId` если переменная не настроена
   - Детально логирует все значения для диагностики

### Логи для проверки:

```bash
# Проверка инициализации
kubectl logs -n canton-otc-minimal-stage deployment/canton-otc --tail=100 | grep "Telegram Service Config"

# Проверка отправки заявки
kubectl logs -n canton-otc-minimal-stage deployment/canton-otc --tail=200 | grep -iE "sendPublicOrderNotification debug|Publishing order to client group"

# Проверка переменных в runtime
kubectl exec -n canton-otc-minimal-stage deployment/canton-otc -- env | grep TELEGRAM_CLIENT_GROUP
```

## 🚀 ПЛАН ДЕПЛОЯ

### Вариант 1: Использовать обновленный deployment.yaml (рекомендуется)

```bash
# Применить обновленный deployment
kubectl apply -f config/kubernetes/k8s/minimal-stage/deployment.yaml

# Проверить статус
kubectl rollout status deployment/canton-otc -n canton-otc-minimal-stage
```

### Вариант 2: Использовать скрипт диагностики

```bash
# Запустить скрипт диагностики и деплоя
bash scripts/fix-telegram-groups-deploy.sh
```

### Вариант 3: Обновить образ вручную

```bash
# Обновить образ на тег main
kubectl set image deployment/canton-otc \
  canton-otc=ghcr.io/themacroeconomicdao/cantonotc:main \
  -n canton-otc-minimal-stage

# Проверить статус
kubectl rollout status deployment/canton-otc -n canton-otc-minimal-stage
```

## 🧪 ТЕСТИРОВАНИЕ

После деплоя:

1. **Создать тестовую заявку:**
   ```bash
   bash scripts/test-client-group-orders.sh
   ```

2. **Проверить логи:**
   ```bash
   kubectl logs -n canton-otc-minimal-stage deployment/canton-otc --tail=200 | grep -iE "sendPublicOrderNotification debug|client group|Order published"
   ```

3. **Проверить в Telegram:**
   - ✅ Группа клиентов (1OTC_ORDERS, ID: -5039619304): должна прийти заявка
   - ✅ Группа нотификаций (операторы, ID: -4872025335): должно прийти уведомление

## 📊 ОЖИДАЕМЫЕ РЕЗУЛЬТАТЫ

### В логах должно быть:

1. **При инициализации:**
   ```
   📱 Telegram Service Config: {
     clientGroupChatId: "-5039619304",
     isClientGroupConfigured: true,
     ...
   }
   ✅ TELEGRAM_CLIENT_GROUP_CHAT_ID настроена: -5039619304
   ```

2. **При отправке заявки:**
   ```
   🔍 sendPublicOrderNotification debug: {
     clientGroupChatId: "-5039619304",
     finalChatId: "-5039619304",
     isClientGroup: true,
     usingFallback: false,
     ...
   }
   📤 Publishing order to client group: {
     chatId: "-5039619304",
     isClientGroup: true,
     ...
   }
   ✅ Order published to channel: {
     channel: "-5039619304"
   }
   ```

### В Telegram:

- ✅ **Группа клиентов (1OTC_ORDERS):** Заявка с кнопкой "Принять заявку"
- ✅ **Группа нотификаций (операторы):** Уведомление для операторов

## ⚠️ ВАЖНО

1. **НЕ УДАЛЯТЬ** существующую функциональность
2. **НЕ МЕНЯТЬ** логику `sendOrderNotification()` - она должна работать как раньше
3. **ПРОВЕРИТЬ** все места где используется Telegram перед изменениями
4. **ПРОТЕСТИРОВАТЬ** после каждого изменения
5. **УБЕДИТЬСЯ** что ничего не сломалось

## 🔄 ОТКАТ (если что-то пошло не так)

```bash
# Откатить deployment на предыдущую версию
kubectl rollout undo deployment/canton-otc -n canton-otc-minimal-stage

# Или вернуть старый тег образа
kubectl set image deployment/canton-otc \
  canton-otc=ghcr.io/themacroeconomicdao/cantonotc:minimal-stage \
  -n canton-otc-minimal-stage
```

## 📝 ЧЕКЛИСТ

- [x] Улучшено логирование в `telegram.ts`
- [x] Обновлен `deployment.yaml` для использования тега `main`
- [x] Создан скрипт диагностики и деплоя
- [ ] Задеплоить обновления в Kubernetes
- [ ] Протестировать создание заявки
- [ ] Проверить что заявка приходит в группу клиентов
- [ ] Проверить что заявка приходит в группу нотификаций
- [ ] Протестировать подтверждение заявки
- [ ] Убедиться что ничего не сломалось

---

**Следующий шаг:** Задеплоить обновления и протестировать!
