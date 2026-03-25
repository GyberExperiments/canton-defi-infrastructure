# 🤖 Telegram Mediator Bot Setup Guide
## Настройка бота-посредника между Intercom и оператором

**Версия:** 2025-01-17  
**Цель:** Настройка двусторонней связи клиент ↔ оператор через Telegram бот-медиатор

---

## 📋 ОБЗОР АРХИТЕКТУРЫ

### **Поток сообщений:**
```
Клиент (Intercom) → Webhook → Telegram Mediator Bot → Оператор
Оператор → Telegram Mediator Bot → Intercom API → Клиент
```

### **Компоненты:**
1. **Intercom Widget** - чат на сайте для клиентов
2. **Intercom Webhook** - получает сообщения от клиентов
3. **Telegram Mediator Bot** - бот-посредник для операторов
4. **Intercom API** - отправляет ответы обратно клиентам

---

## 🔧 НАСТРОЙКА TELEGRAM БОТА

### **1. Создание бота**

1. **Откройте Telegram** и найдите [@BotFather](https://t.me/botfather)
2. **Создайте нового бота:**
   ```
   /newbot
   ```
3. **Введите имя бота:** `Canton OTC Mediator Bot`
4. **Введите username:** `canton_otc_mediator_bot` (должен заканчиваться на `_bot`)
5. **Скопируйте токен** (формат: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### **2. Настройка webhook**

1. **Установите webhook URL:**
   ```bash
   curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{
       "url": "https://stage.minimal.build.infra.1otc.cc/api/telegram-mediator/webhook",
       "secret_token": "your_webhook_secret_here"
     }'
   ```

2. **Проверьте webhook:**
   ```bash
   curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
   ```

### **3. Получение Chat ID оператора**

1. **Добавьте бота в группу** операторов или **напишите боту лично**
2. **Отправьте любое сообщение** боту
3. **Получите Chat ID:**
   ```bash
   curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates"
   ```
4. **Найдите `chat.id`** в ответе

---

## 🔐 ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ

### **Добавьте в `.env.production`:**

```bash
# Telegram Mediator Bot Configuration
TELEGRAM_MEDIATOR_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_MEDIATOR_CHAT_ID=-1001234567890
TELEGRAM_MEDIATOR_WEBHOOK_SECRET=your_webhook_secret_here

# Existing Intercom Configuration (уже должно быть)
NEXT_PUBLIC_INTERCOM_APP_ID=your_intercom_app_id
INTERCOM_ACCESS_TOKEN=your_intercom_access_token
INTERCOM_ADMIN_ID=your_intercom_admin_id
INTERCOM_WEBHOOK_SECRET=your_intercom_webhook_secret
```

### **Kubernetes Secrets:**

```bash
# Создайте секреты в Kubernetes
kubectl create secret generic telegram-mediator-secrets \
  --from-literal=TELEGRAM_MEDIATOR_BOT_TOKEN="123456789:ABCdefGHIjklMNOpqrsTUVwxyz" \
  --from-literal=TELEGRAM_MEDIATOR_CHAT_ID="-1001234567890" \
  --from-literal=TELEGRAM_MEDIATOR_WEBHOOK_SECRET="your_webhook_secret_here" \
  -n canton-otc-minimal-stage
```

---

## 🧪 ТЕСТИРОВАНИЕ

### **1. Тест соединения**

```bash
# Проверьте соединение с ботом
curl "https://stage.minimal.build.infra.1otc.cc/api/admin/test-mediator?adminKey=YOUR_ADMIN_KEY"
```

### **2. Тест webhook**

```bash
# Отправьте тестовое сообщение боту
# Бот должен ответить в чат операторов
```

### **3. Тест полного потока**

1. **Откройте сайт** и создайте заказ
2. **Напишите в Intercom** виджет
3. **Проверьте** что сообщение пришло в Telegram чат операторов
4. **Ответьте оператором** в формате: `ORDER_ID: ваш ответ`
5. **Проверьте** что ответ пришел клиенту в Intercom

---

## 📱 ИНСТРУКЦИИ ДЛЯ ОПЕРАТОРОВ

### **Как отвечать клиентам:**

1. **Получите сообщение** от клиента в Telegram чате
2. **Нажмите кнопку** "💬 Ответить клиенту" 
3. **Следуйте инструкции** бота
4. **Напишите ответ** в формате: `ORDER_ID: ваш ответ`

### **Пример:**
```
MGUW22RW-SW27E2: Добро пожаловать! Ваш заказ обрабатывается. 
Пожалуйста, отправьте 10000 USDT на адрес: 0x123...
```

### **Функции бота:**
- ✅ **Автоматическая пересылка** сообщений от клиентов
- ✅ **Контекст заказа** (ID, сумма, адреса)
- ✅ **Двусторонняя связь** через Intercom
- ✅ **Inline кнопки** для удобства
- ✅ **Уведомления** об отправке ответов

---

## 🔍 МОНИТОРИНГ

### **API Endpoints:**

```bash
# Health check
GET /api/telegram-mediator/webhook

# Статистика разговоров
GET /api/admin/mediator-stats?adminKey=YOUR_KEY

# Тест соединения
GET /api/admin/test-mediator?adminKey=YOUR_KEY
```

### **Логи:**

```bash
# Просмотр логов
kubectl logs -f deployment/canton-otc -n canton-otc-minimal-stage | grep "🤖"
```

### **Метрики:**
- Количество активных разговоров
- Время ответа оператора
- Успешность доставки сообщений
- Ошибки интеграции

---

## 🚨 УСТРАНЕНИЕ НЕПОЛАДОК

### **Проблема: Бот не отвечает**

1. **Проверьте токен:**
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/getMe"
   ```

2. **Проверьте webhook:**
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
   ```

3. **Проверьте переменные окружения:**
   ```bash
   kubectl get secret telegram-mediator-secrets -n canton-otc-minimal-stage -o yaml
   ```

### **Проблема: Сообщения не доходят операторам**

1. **Проверьте Chat ID** операторской группы
2. **Убедитесь** что бот добавлен в группу
3. **Проверьте права** бота в группе

### **Проблема: Ответы не доходят клиентам**

1. **Проверьте Intercom API** токен
2. **Проверьте Conversation ID** в логах
3. **Проверьте формат** ответа оператора

---

## 📊 ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ

### **Сообщение от клиента:**
```
💬 НОВОЕ СООБЩЕНИЕ ОТ КЛИЕНТА

📋 Order ID: MGUW22RW-SW27E2
📧 Email: client@example.com
📅 Время: 17.01.2025 15:30 (МСК)

💰 Сумма заказа: $10000 USDT
🎯 Статус: awaiting-deposit
🏛️ Canton Address: 0x123...abc
🔄 Refund Address: 0x456...def

💬 Сообщение клиента:
"Привет! Когда я получу Canton Coin?"

🔗 Ссылка в админку:
https://stage.minimal.build.infra.1otc.cc/admin/orders

[💬 Ответить клиенту]
```

### **Ответ оператора:**
```
MGUW22RW-SW27E2: Добро пожаловать! Ваш заказ обрабатывается. 
Пожалуйста, отправьте 10000 USDT на адрес: 0x789...
После получения средств вы получите 7857.14 Canton Coin в течение 12 часов.
```

### **Уведомление об отправке:**
```
✅ Ответ отправлен клиенту

📋 Order: MGUW22RW-SW27E2
💬 Сообщение: "Добро пожаловать! Ваш заказ обрабатывается..."
```

---

## ✅ ЧЕКЛИСТ НАСТРОЙКИ

- [ ] Telegram бот создан через @BotFather
- [ ] Webhook настроен на правильный URL
- [ ] Chat ID операторской группы получен
- [ ] Переменные окружения добавлены
- [ ] Kubernetes secrets созданы
- [ ] Тест соединения прошел успешно
- [ ] Полный поток протестирован
- [ ] Операторы обучены работе с ботом

---

**Поддержка:** Если возникли проблемы, проверьте логи и обратитесь к разработчику.
