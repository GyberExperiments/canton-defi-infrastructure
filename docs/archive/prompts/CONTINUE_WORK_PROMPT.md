# 🔧 ПРОМПТ: Продолжение работы над Canton OTC

## 📋 ТЕКУЩИЙ КОНТЕКСТ (10 декабря 2025, 22:20 UTC)

### ✅ ЧТО УЖЕ СДЕЛАНО:

1. **Docker образ собран и развернут:**
   - ✅ Образ: `ghcr.io/themacroeconomicdao/cantonotc:308910b7`
   - ✅ Commit hash: `308910b7`
   - ✅ Deployment обновлен на новый образ
   - ✅ Поды работают: 2/2 Running
   - ✅ Health check: `https://1otc.cc/api/health` - работает

2. **Секреты синхронизированы:**
   - ✅ 38 ключей в секрете `canton-otc-secrets`
   - ✅ Все критичные секреты добавлены из работающего пода
   - ✅ Секреты включают: GOOGLE_*, TELEGRAM_*, SMTP_*, SUPABASE_*, ADMIN_*, NEXTAUTH_*
   - ✅ Создана документация по best practices синхронизации секретов

3. **Архитектура секретов:**
   - ✅ Создана конфигурация External Secrets Operator (для будущего использования)
   - ✅ Документация: `config/kubernetes/k8s/SECRETS_SYNC_BEST_PRACTICES.md`
   - ✅ Документация: `config/kubernetes/k8s/SECRETS_SYNC_SUMMARY.md`
   - ✅ GitHub Actions workflow готов для синхронизации (но пока не используется)

4. **Telegram интеграция настроена:**
   - ✅ Группа операторов: `TELEGRAM_CHAT_ID=-4872025335` ("1OTC.cc | Notifications")
   - ✅ Группа клиентов: `TELEGRAM_CLIENT_GROUP_CHAT_ID=-5039619304` ("1OTC_ORDERS")
   - ✅ Заявки публикуются в группу клиентов
   - ✅ Кнопка "Принять" работает в обеих группах

5. **Код исправлен:**
   - ✅ `src/lib/services/telegramMediator.ts` - обработка `accept_order` callback
   - ✅ Добавлен loading state при нажатии кнопки
   - ✅ Детальное логирование всех операций
   - ✅ Обработка ошибок с понятными сообщениями

### ✅ ИСПРАВЛЕНО:

1. **JWT ошибка исправлена:**
   - ✅ Обновлен `SUPABASE_SERVICE_ROLE_KEY` из `postgres-secret` в namespace `supabase`
   - ✅ Ключ синхронизирован в секрет `canton-otc-secrets`
   - ✅ Поды перезапущены с правильным ключом
   - ✅ JWT ошибка больше не возникает

2. **Принятие ордеров работает:**
   - ✅ Заявки создаются успешно
   - ✅ Заявки публикуются в Telegram группу клиентов
   - ✅ Кнопка "Принять" обрабатывается корректно
   - ✅ Заявки находятся и обновляются в Supabase
   - ✅ Статус обновляется на `accepted`
   - ✅ Уведомления отправляются оператору и клиенту

### ⚠️ ТЕКУЩИЕ ПРОБЛЕМЫ:

1. **Intercom 404 ошибка при создании/обновлении пользователя:**
   - ❌ Ошибка: `Failed to create/update user in Intercom: Error [AxiosError]: Request failed with status code 404`
   - ✅ Исправлено: В `src/lib/services/enhancedIntercom.ts` изменен endpoint с `/users` на `/contacts`
   - ✅ Исправлено: Добавлено поле `role` в `IntercomUser` interface
   - ✅ Образ собран и развернут: `ghcr.io/themacroeconomicdao/cantonotc:37ed0bd1`
   - 📝 Intercom API v2.14 использует `/contacts` вместо `/users` для создания контактов
   - 📝 Файл: `src/lib/services/enhancedIntercom.ts:172` - исправлен на `this.client.post('/contacts', userData)`

2. **Заявки не видны при прямом запросе к Supabase:**
   - Возможно проблема с RLS политиками или схемой таблицы
   - Но принятие ордеров работает через код (заявки находятся и обновляются)
   - Требует дополнительной проверки схемы БД

3. **❌ КРИТИЧНО: Неправильная логика принятия ордеров:**
   - **Проблема:** Код не различает источник callback (клиентский или админский чат)
   - **Текущее поведение:** И клиент, и админ меняют статус с `pending` на `accepted` одинаково
   - **Правильная логика должна быть:**
     1. Клиент создает заявку на сайте → статус `pending`
     2. Клиент из клиентской группы принимает (откликается) → статус `client_accepted` или `awaiting_admin`
     3. Админ из админской группы принимает → статус `accepted` или `ready_for_deal`
   - **Что нужно исправить:**
     - Определять источник callback по `chatId` (сравнивать с `TELEGRAM_CHAT_ID` и `TELEGRAM_CLIENT_GROUP_CHAT_ID`)
     - Разная логика в зависимости от источника
     - Обновить схему БД: добавить статус `client_accepted` или использовать `in_progress` для "клиент принял"
     - Добавить поля `client_id` и `admin_id` для отслеживания кто принял
   - **Файл:** `src/lib/services/telegramMediator.ts:380-671` (метод обработки `accept_order`)
   - **Схема БД:** `supabase/migrations/003_create_public_orders.sql` - нужно добавить статус `client_accepted`

### 📊 ТЕКУЩИЙ СТАТУС СИСТЕМЫ:

**Kubernetes:**
- Namespace: `canton-otc`
- Deployment: `canton-otc`
- Поды: 2/2 Running
- Образ: `ghcr.io/themacroeconomicdao/cantonotc:308910b7`
- Секреты: `canton-otc-secrets` (38 ключей)

**Supabase:**
- Namespace: `supabase`
- Service: `kong.supabase.svc.cluster.local:8000`
- Таблица: `public_orders`
- ✅ JWT аутентификация исправлена (SUPABASE_SERVICE_ROLE_KEY обновлен)

**Intercom:**
- API Version: 2.14
- Endpoint для контактов: `/contacts` (не `/users`)
- ✅ Исправлено в `src/lib/services/enhancedIntercom.ts`
- ⚠️ Нужно пересобрать образ для применения исправления

**Telegram:**
- Бот: @CantonOTC_Bot
- Группа операторов: -4872025335
- Группа клиентов: -5039619304
- Webhook: `https://1otc.cc/api/telegram-mediator/webhook`

### 🔍 ДЕТАЛИ РЕАЛИЗАЦИИ:

**Обработка `accept_order` callback:**
1. Показывается loading state сразу при нажатии
2. Проверяется конфигурация Supabase
3. Создается клиент Supabase с SERVICE_ROLE_KEY
4. Запрашивается заявка из таблицы `public_orders`
5. Обновляется статус на `accepted`
6. Создается сервисный чат
7. Обновляется сообщение в группе
8. Отправляются уведомления оператору и клиенту

**Логирование:**
- `🔍 Processing accept_order callback` - начало обработки
- `🔍 Supabase config check` - проверка конфигурации
- `🔍 Querying Supabase for order` - запрос к Supabase
- `❌ Supabase fetch error` - ошибка при запросе (JWT проблема)

### 🎯 ЗАДАЧИ ДЛЯ ПРОДОЛЖЕНИЯ (опционально):

1. **Проверить почему заявки не видны при прямом запросе:**
   - Проверить RLS политики в таблице `public_orders`
   - Проверить схему таблицы и индексы
   - Убедиться что заявки действительно сохраняются (проверить через psql)

2. **Улучшить мониторинг:**
   - Добавить метрики успешности принятия ордеров
   - Добавить алерты при ошибках

3. **Оптимизация:**
   - Проверить производительность запросов к Supabase
   - Оптимизировать индексы если нужно

### 📁 ИЗМЕНЕННЫЕ ФАЙЛЫ:

1. **`src/lib/services/telegramMediator.ts`:**
   - ✅ Функция `answerCallbackQuery` с поддержкой `showLoading`
   - ✅ Обработка `accept_order` callback (строки 380-566)
   - ✅ Детальное логирование всех операций
   - ✅ Обработка всех ошибок с try-catch

2. **`src/lib/services/enhancedIntercom.ts`:**
   - ✅ Исправлен endpoint с `/users` на `/contacts` (строка 172)
   - ✅ Intercom API v2.14 использует `/contacts` для создания/обновления контактов

3. **`config/kubernetes/k8s/deployment.yaml`:**
   - ✅ Переменная `TELEGRAM_CLIENT_GROUP_CHAT_ID` из секрета

4. **Созданные файлы:**
   - `config/kubernetes/k8s/github-secret-store.yaml` - SecretStore для External Secrets
   - `config/kubernetes/k8s/external-secret.yaml` - ExternalSecret для production
   - `config/kubernetes/k8s/SECRETS_SYNC_BEST_PRACTICES.md` - документация
   - `config/kubernetes/k8s/SECRETS_SYNC_SUMMARY.md` - краткая сводка
   - `docs/features/ACCEPT_ORDER_FLOW_ANALYSIS.md` - детальный анализ флоу принятия ордеров

### 🔧 КОМАНДЫ ДЛЯ ДИАГНОСТИКИ:

```bash
# Проверить переменные в поде
kubectl exec -n canton-otc deployment/canton-otc -- env | grep -E "TELEGRAM|SUPABASE"

# Проверить логи обработки accept_order
kubectl logs -n canton-otc deployment/canton-otc --tail=500 --since=10m | grep -iE "accept_order|🔍.*Supabase|Order not found|JWSError"

# Проверить заявку в Supabase (через port-forward)
kubectl port-forward -n supabase svc/supabase-rest 3000:3000 > /dev/null 2>&1 &
PF_PID=$!
sleep 3
SUPABASE_KEY=$(kubectl get secret canton-otc-secrets -n canton-otc -o jsonpath='{.data.SUPABASE_SERVICE_ROLE_KEY}' | base64 -d)
curl -s "http://localhost:3000/rest/v1/public_orders?order_id=eq.TEST_ORDER_ID&select=order_id,status,created_at" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" | jq .
kill $PF_PID 2>/dev/null

# Создать новую тестовую заявку
TEST_EMAIL="test-$(date +%s)@example.com"
EXPECTED=$(python3 -c "print(round(500 / 0.77 * 0.99, 6))")
ORDER_RESPONSE=$(curl -s -X POST "https://1otc.cc/api/create-order" \
  -H "Content-Type: application/json" \
  -d "{
    \"cantonAddress\": \"04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8\",
    \"usdtAmount\": 500,
    \"cantonAmount\": $EXPECTED,
    \"email\": \"$TEST_EMAIL\",
    \"exchangeDirection\": \"buy\",
    \"serviceCommission\": 1,
    \"manualPrice\": 0.77
  }")
TEST_ORDER_ID=$(echo "$ORDER_RESPONSE" | jq -r '.orderId')
echo "✅ Заявка создана: $TEST_ORDER_ID"

# Протестировать кнопку "Принять"
curl -s -X POST "https://1otc.cc/api/telegram-mediator/webhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"callback_query\": {
      \"id\": \"test-$(date +%s)\",
      \"data\": \"accept_order:$TEST_ORDER_ID\",
      \"from\": {
        \"id\": 123456789,
        \"username\": \"test_operator\",
        \"first_name\": \"Test\"
      },
      \"message\": {
        \"chat\": {
          \"id\": -5039619304
        },
        \"message_id\": 1
      }
    }
  }" | jq .

# Проверить логи обработки
sleep 3
kubectl logs -n canton-otc deployment/canton-otc --tail=500 --since=2m | \
  grep -iE "$TEST_ORDER_ID.*accept|🔍.*Supabase config|🔍.*Querying Supabase|Order not found|✅.*Order accepted|JWSError"
```

### 📝 ПРАВИЛА РАБОТЫ:

1. **Всегда читай файлы перед изменением** - не делай предположений
2. **Используй best practices** - никаких временных решений
3. **Детальное логирование** - все важные шаги должны логироваться
4. **Обработка ошибок** - все ошибки должны быть обработаны с понятными сообщениями
5. **Тестирование** - после каждого исправления нужно тестировать
6. **Отвечай на русском** - все ответы и комментарии на русском языке

### 🚀 СЛЕДУЮЩИЕ ШАГИ:

1. **Пересобрать и развернуть образ с исправлением Intercom:**
   ```bash
   cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc
   COMMIT_HASH=$(git rev-parse --short HEAD)
   docker build -t ghcr.io/themacroeconomicdao/cantonotc:$COMMIT_HASH -t ghcr.io/themacroeconomicdao/cantonotc:main .
   docker push ghcr.io/themacroeconomicdao/cantonotc:$COMMIT_HASH
   docker push ghcr.io/themacroeconomicdao/cantonotc:main
   kubectl rollout restart deployment/canton-otc -n canton-otc
   kubectl rollout status deployment/canton-otc -n canton-otc --timeout=180s
   ```

2. **Протестировать создание заявки после исправления Intercom:**
   - Создать тестовую заявку через API
   - Проверить что пользователь создается в Intercom без ошибки 404
   - Проверить логи на отсутствие ошибок Intercom

3. **Протестировать принятие ордеров:**
   - Создать тестовую заявку
   - Нажать "Принять" в Telegram группе (админской и клиентской)
   - Проверить что заявка находится и обновляется
   - Проверить что уведомления отправляются оператору и клиенту
   - Проверить что Intercom уведомления работают

4. **Проверить логи:**
   - Убедиться что Intercom 404 ошибка исправлена
   - Проверить детальное логирование всех операций
   - Проверить обработку ошибок

### 🔍 ОЖИДАЕМОЕ ПОВЕДЕНИЕ ПОСЛЕ ИСПРАВЛЕНИЯ:

1. При нажатии "Принять":
   - ✅ Сразу показывается loading state
   - ✅ Заявка находится в Supabase (без JWT ошибки)
   - ✅ Статус обновляется на `accepted`
   - ✅ Сообщение в группе обновляется
   - ✅ Оператор получает уведомление в личные сообщения
   - ✅ Клиент получает уведомление
   - ✅ Показывается успешное сообщение

2. При ошибках:
   - ✅ Показывается понятное сообщение об ошибке
   - ✅ Детальное логирование в консоль
   - ✅ Пользователь видит что произошло

### 📊 АРХИТЕКТУРА И КОНТЕКСТ:

**Kubernetes:**
- Namespace: `canton-otc`
- Deployment: `canton-otc`
- Secrets: `canton-otc-secrets` (38 ключей)
- ConfigMap: `canton-otc-config`

**Supabase:**
- Namespace: `supabase`
- Service: `kong.supabase.svc.cluster.local:8000`
- Таблица: `public_orders` (создана миграцией `003_create_public_orders.sql`)
- Проблема: JWT аутентификация не работает

**Telegram группы:**
- Группа операторов: `TELEGRAM_CHAT_ID=-4872025335` ("1OTC.cc | Notifications")
- Группа клиентов: `TELEGRAM_CLIENT_GROUP_CHAT_ID=-5039619304` ("1OTC_ORDERS")

**Ключевые файлы:**
- `src/lib/services/telegramMediator.ts` - обработка callback queries (accept_order)
- `src/lib/services/enhancedIntercom.ts` - создание/обновление пользователей в Intercom (исправлен endpoint)
- `src/lib/services/intercom.ts` - базовый Intercom сервис (использует `/contacts`)
- `src/app/api/create-order/route.ts` - создание заявок и сохранение в Supabase
- `src/lib/services/telegram.ts` - отправка сообщений в Telegram

### 📝 ВАЖНЫЕ ЗАМЕТКИ:

- **Код уже исправлен:**
  - ✅ `src/lib/services/telegramMediator.ts` - обработка accept_order работает
  - ✅ `src/lib/services/enhancedIntercom.ts` - исправлен endpoint на `/contacts`
  - ⚠️ Нужно пересобрать и развернуть образ для применения исправления Intercom
  
- **Заявки сохраняются в Supabase** - принятие ордеров работает корректно
- **Все уведомления уже реализованы** - нужно только проверить что они работают после исправления Intercom
- **Loading state уже добавлен** - работает после деплоя
- **GitHub Actions пока не работают** - секреты синхронизированы вручную из работающего пода

- **Детальный анализ флоу:**
  - Создан документ `docs/features/ACCEPT_ORDER_FLOW_ANALYSIS.md` с полным описанием флоу принятия ордеров
  - Описаны различия между админским и клиентским чатом
  - Перечислены недостающие элементы для best practices

### 🔍 ТЕКУЩИЙ СТАТУС ТЕСТИРОВАНИЯ:

**Тестовая заявка:** `MJ0KRGSF-UY92KT`
- ✅ Создана успешно
- ✅ Сообщение отправлено в группу клиентов (channel: -5039619304)
- ✅ Сообщение отправлено в группу операторов
- ✅ Сохранена в Supabase (`✅ Order saved to public_orders table`)
- ✅ При нажатии "Принять" - заявка найдена и принята успешно
- ✅ Статус обновлен на `accepted`
- ✅ Webhook вернул `"handled": true` и `"status": "accepted"`

**Результат тестирования:**
```json
{
  "success": true,
  "handled": true,
  "orderInfo": {
    "orderId": "MJ0KRGSF-UY92KT",
    "status": "accepted",
    "operatorId": 123456789
  }
}
```

### 📚 ДОКУМЕНТАЦИЯ:

- `config/kubernetes/k8s/SECRETS_SYNC_BEST_PRACTICES.md` - best practices синхронизации секретов
- `config/kubernetes/k8s/SECRETS_SYNC_SUMMARY.md` - краткая сводка
- `docs/testing/TESTING_ORDER_ACCEPTANCE_SYSTEM.md` - руководство по тестированию
- `docs/features/ACCEPT_ORDER_FLOW_ANALYSIS.md` - детальный анализ флоу принятия ордеров из Telegram

### 🔍 ДЕТАЛИ ФЛОУ ПРИНЯТИЯ ОРДЕРОВ:

**Единый флоу для обоих чатов (админского и клиентского):**
1. Показывается loading state сразу при нажатии
2. Проверяется конфигурация Supabase
3. Заявка ищется в базе данных
4. Статус обновляется на `accepted` (с защитой от race condition)
5. Создается сервисный чат (deep link)
6. Обновляется сообщение в группе (если доступно)
7. Клиент получает уведомление через Intercom
8. Оператор получает уведомление в группу операторов
9. Проверяется готовность сделки (поиск противоположной заявки)
10. Отправляется ответ на callback

**Различия между чатами:**
- **Админский чат:** Детальное сообщение с контактами, 4 кнопки (Принять, Написать, Админка, Реквизиты)
- **Клиентский чат:** Упрощенное сообщение, 3 кнопки (Принять, Детали, Написать оператору)

**Что не хватает для best practices:**
- ❌ **КРИТИЧНО:** Различение источника callback (клиентский/админский чат) - сейчас не реализовано
- ❌ **КРИТИЧНО:** Правильная логика статусов (client_accepted → accepted) - сейчас оба меняют на accepted
- Проверка прав оператора (не требуется по бизнес-логике - в группах только авторизованные)
- Обработка других кнопок (order_details, contact, payment)
- Fallback уведомления (Telegram/Email если Intercom недоступен)
- Аудит действий
- Retry механизм
- Транзакционность операций
- Мониторинг и метрики

Подробнее в `docs/features/ACCEPT_ORDER_FLOW_ANALYSIS.md`

### 🎯 КРИТИЧНЫЕ ЗАДАЧИ ДЛЯ РЕАЛИЗАЦИИ:

#### 1. Реализовать правильную логику принятия ордеров

**Текущая проблема:**
- Код не различает откуда пришел callback (клиентский чат `-5039619304` или админский `-4872025335`)
- Оба источника меняют статус одинаково: `pending` → `accepted`

**Правильная логика:**
```
1. Клиент создает заявку на сайте
   → статус: `pending`

2. Клиент из клиентской группы нажимает "Принять"
   → статус: `client_accepted` (или `awaiting_admin`)
   → сохранить: `client_id`, `client_username`, `client_accepted_at`
   → уведомление админам: "Клиент откликнулся на заявку #ORDER_ID"

3. Админ из админской группы нажимает "Принять"
   → проверить: статус должен быть `client_accepted`
   → статус: `accepted` (или `ready_for_deal`)
   → сохранить: `admin_id`, `admin_username`, `accepted_at`
   → уведомление клиенту и оператору
```

**Что нужно сделать:**

1. **Обновить схему БД:**
   - Добавить статус `client_accepted` в CHECK constraint
   - Добавить поля: `client_id`, `client_username`, `client_accepted_at`
   - Файл: `supabase/migrations/003_create_public_orders.sql`

2. **Исправить логику в `telegramMediator.ts`:**
   ```typescript
   // Определить источник callback
   const chatId = message?.chat?.id;
   const isAdminChat = chatId === process.env.TELEGRAM_CHAT_ID; // -4872025335
   const isClientGroup = chatId === process.env.TELEGRAM_CLIENT_GROUP_CHAT_ID; // -5039619304
   
   if (isClientGroup) {
     // Клиент откликается на заявку
     // Проверка: статус должен быть 'pending'
     // Обновление: статус → 'client_accepted'
     // Сохранение: client_id, client_username, client_accepted_at
   } else if (isAdminChat) {
     // Админ принимает заявку
     // Проверка: статус должен быть 'client_accepted'
     // Обновление: статус → 'accepted'
     // Сохранение: admin_id (operator_id), admin_username (operator_username), accepted_at
   }
   ```

3. **Обновить проверку статуса:**
   - Для клиентского чата: проверять `status === 'pending'`
   - Для админского чата: проверять `status === 'client_accepted'`

4. **Обновить уведомления:**
   - При принятии клиентом: уведомление админам в админский чат
   - При принятии админом: уведомления клиенту и оператору (как сейчас)

**Файлы для изменения:**
- `supabase/migrations/003_create_public_orders.sql` - добавить статус и поля
- `src/lib/services/telegramMediator.ts:380-671` - исправить логику обработки
- Создать новую миграцию для обновления схемы (если нужно)

#### 2. Обработать другие кнопки (приоритет 1)

**Проблема:** Кнопки `order_details:`, `contact_`, `payment_` не обрабатываются

**Что нужно:**
- Добавить обработчики в `handleCallbackQuery()` для всех типов callback
- Файл: `src/lib/services/telegramMediator.ts`

#### 3. Улучшить уведомления клиенту (приоритет 1)

**Проблема:** Уведомление только через Intercom, нет fallback

**Что нужно:**
- Добавить fallback на Telegram (если указан) и Email
- Файл: `src/lib/services/telegram.ts:561-576` (метод `notifyCustomer`)

#### 4. Аудит действий (приоритет 2)

**Что нужно:**
- Создать таблицу `order_audit_log` в Supabase
- Логировать все действия: кто, когда, откуда принял заявку
- Файл: новая миграция `supabase/migrations/004_create_order_audit_log.sql`

#### 5. Retry механизм (приоритет 2)

**Что нужно:**
- Добавить retry с exponential backoff для критичных операций
- Обновление статуса, отправка уведомлений

#### 6. Fallback при ошибке обновления сообщения (приоритет 2)

**Что нужно:**
- Если `editMessageText` провалился → отправлять новое сообщение
- Файл: `src/lib/services/telegramMediator.ts:595-630`

---

**ВАЖНО:** Этот промпт содержит весь необходимый контекст для продолжения работы. 

### 🚨 КРИТИЧНЫЕ ЗАДАЧИ (сделать в первую очередь):

1. **Реализовать правильную логику принятия ордеров:**
   - Различать источник callback (клиентский/админский чат)
   - Клиент принимает → статус `client_accepted`
   - Админ принимает → статус `accepted` (только если статус был `client_accepted`)
   - Обновить схему БД для поддержки нового статуса
   - Файлы: `supabase/migrations/003_create_public_orders.sql`, `src/lib/services/telegramMediator.ts`

2. **Обработать другие кнопки:**
   - `order_details:`, `contact_`, `payment_`
   - Файл: `src/lib/services/telegramMediator.ts`

3. **Улучшить уведомления:**
   - Fallback на Telegram/Email если Intercom недоступен
   - Файл: `src/lib/services/telegram.ts`

### 📋 ОСТАЛЬНЫЕ ЗАДАЧИ (можно делать потом):

4. Аудит действий (таблица `order_audit_log`)
5. Retry механизм для критичных операций
6. Fallback при ошибке обновления сообщения
7. Мониторинг и метрики
8. Транзакционность операций

**Документация:**
- `docs/features/ACCEPT_ORDER_FLOW_ANALYSIS.md` - детальный анализ флоу и всех проблем
