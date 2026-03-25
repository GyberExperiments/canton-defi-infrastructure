
# 🤖 Инструкции по настройке Fin ассистента

## ✅ ЧТО УЖЕ ГОТОВО:

### 1. База знаний создана
- 📚 **Collection ID:** 16127377
- 📁 **Название:** Canton Coin Trading
- 📋 **Секции:** Buying Canton Coin, Pricing and Networks, Order Management

### 2. Кастомные атрибуты созданы
- ✅ order_id (string)
- ✅ canton_address (string)

### 3. Теги созданы
- ✅ canton-coin, new-customer, returning-customer
- ✅ high-value, technical-issue, payment-issue
- ✅ order-created, order-completed, needs-human, ai-handled

### 4. API endpoints готовы
- ✅ /api/intercom/fin-over-api - обработка событий Fin
- ✅ /api/intercom/ai-agent - AI агент для обработки сообщений
- ✅ /api/intercom/webhook - стандартный webhook

## 🚀 СЛЕДУЮЩИЕ ШАГИ:

### Шаг 1: Войти в Intercom Admin Panel
1. Открыть: https://app.intercom.com/a/apps/a131dwle
2. Войти: start@techhy.me / Far12{Fit{Win

### Шаг 2: Активировать Fin ассистента
1. Перейти в Settings → Fin
2. Нажать "Activate Fin"
3. Выбрать "Fin over API" (если доступно)

### Шаг 3: Настроить Fin over API
1. В разделе "Fin over API":
   - **Callback URL:** https://stage.minimal.build.infra.1otc.cc/api/intercom/fin-over-api
   - **Authentication Token:** intercom_webhook_secret_minimal_stage_2025
   - **Auto Reply:** включить
   - **Collect User Data:** включить
   - **Handoff to Human:** включить

### Шаг 4: Настроить базу знаний
1. В разделе "Knowledge Base":
   - **Collection ID:** 16127377
   - **Auto Suggest:** включить
   - **Fallback to AI:** включить

### Шаг 5: Настроить брендинг
1. **App Name:** Canton OTC Assistant
2. **Logo:** загрузить fin-assistant-logo.svg
3. **Welcome Message:** использовать из fin-assistant-config.md
4. **Language:** Russian (основной)
5. **Tone:** Friendly Professional

### Шаг 6: Настроить автоматические ответы
1. **Price Questions:** настроить ответ о цене CC
2. **Buy Questions:** настроить инструкции по покупке
3. **Network Questions:** настроить информацию о сетях
4. **Support Questions:** настроить передачу в поддержку

### Шаг 7: Протестировать
1. Отправить тестовое сообщение
2. Проверить автоматические ответы
3. Протестировать создание заказа
4. Проверить передачу в поддержку

## 🧪 ТЕСТИРОВАНИЕ:

### Команды для тестирования:
```bash
# Тест Fin over API endpoint
node setup-fin-complete.js

# Тест AI агента
node test-ai-agent-integration.js

# Тест webhook
node test-intercom-debug.js
```

### Ожидаемые результаты:
- ✅ Fin отвечает на приветствие
- ✅ Fin обрабатывает вопросы о цене
- ✅ Fin создает заказы автоматически
- ✅ Fin передает в поддержку при необходимости
- ✅ Операторы получают уведомления в Telegram

## 📊 МОНИТОРИНГ:

### Endpoints для мониторинга:
- GET /api/intercom/fin-over-api - health check
- GET /api/admin/intercom-monitoring - метрики
- GET /api/intercom/ai-agent?action=status - статус AI агента

### Ключевые метрики:
- Количество обращений к Fin
- Процент решенных вопросов
- Время ответа Fin
- Процент передачи в поддержку
- Конверсия в заказы

## 🎯 ГОТОВО К PRODUCTION!

После выполнения всех шагов Fin ассистент будет полностью готов к работе с клиентами Canton OTC!
