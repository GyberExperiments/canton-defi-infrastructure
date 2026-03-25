# 💬 Intercom Integration Guide

## 🎯 Обзор

Интеграция Intercom заменяет Telegram бота на современную платформу поддержки клиентов. Intercom предоставляет:

- **Виджет чата** на сайте для поддержки клиентов
- **API уведомления** о новых заказах и изменениях статуса
- **Управление клиентами** с историей заказов
- **Автоматизацию** ответов и маршрутизации

## 🔧 Настройка

### 1. Получение учетных данных

1. **Войдите в аккаунт Intercom:**
   - URL: https://app.intercom.com/
   - Email: `start@techhy.me`
   - Пароль: `Far12{Fit{Win`

2. **Получите APP_ID:**
   - В адресной строке найдите: `https://app.intercom.com/a/apps/{app_id}`
   - Скопируйте `{app_id}`

3. **Получите Access Token:**
   - Settings → Developer Hub → Access Tokens
   - Создайте новый токен с правами: `conversations:write`, `users:write`

4. **Получите Admin ID:**
   - Settings → Team → Admins
   - Скопируйте ID администратора

### 2. Переменные окружения

Добавьте в `.env.production`:

```bash
# Intercom Configuration
NEXT_PUBLIC_INTERCOM_APP_ID=your_app_id_here
INTERCOM_ACCESS_TOKEN=your_access_token_here
INTERCOM_ADMIN_ID=your_admin_id_here
```

## 🚀 Функциональность

### Виджет чата
- **Автоматически загружается** на всех страницах
- **Адаптивный дизайн** под темную тему сайта
- **Быстрые действия**: "Quick Help", "Contact Support"

### Уведомления о заказах
- **Новые заказы** → создается conversation в Intercom
- **Обновления статуса** → добавляется сообщение в conversation
- **Данные клиента** → автоматически сохраняются в профиле

### API Endpoints

#### Создание заказа
```typescript
POST /api/create-order
// Автоматически отправляет уведомление в Intercom
```

#### Обновление статуса
```typescript
PUT /api/order-status/[orderId]
// Автоматически обновляет conversation в Intercom
```

#### Тестирование
```typescript
GET /api/admin/test-intercom?adminKey=your_key
POST /api/admin/test-intercom
{
  "adminKey": "your_key",
  "testType": "full-test"
}
```

## 📱 Компоненты

### IntercomProvider
- Инициализирует Intercom SDK
- Настраивает виджет чата
- Предоставляет утилиты для работы с Intercom

### SupportButton
- Плавающая кнопка поддержки
- Быстрые действия для клиентов
- Интеграция с Intercom messenger

### IntercomService
- Отправка уведомлений о заказах
- Создание и обновление conversations
- Управление пользователями

## 🔄 Миграция с Telegram

### Что изменилось:
1. **TelegramService** → **IntercomService**
2. **Telegram уведомления** → **Intercom conversations**
3. **Telegram бот** → **Intercom виджет чата**

### Что осталось:
- Google Sheets интеграция
- Email сервис (отключен)
- Вся логика валидации и обработки заказов

## 🧪 Тестирование

### 1. Проверка подключения
```bash
curl -X GET "https://your-domain.com/api/admin/test-intercom?adminKey=your_key"
```

### 2. Тест уведомлений
```bash
curl -X POST "https://your-domain.com/api/admin/test-intercom" \
  -H "Content-Type: application/json" \
  -d '{
    "adminKey": "your_key",
    "testType": "full-test"
  }'
```

### 3. Проверка виджета
- Откройте сайт в браузере
- Убедитесь, что виджет чата отображается
- Протестируйте отправку сообщения

## 🎨 Кастомизация

### Настройка виджета
В `IntercomProvider.tsx` можно настроить:
- Позицию виджета
- Цвета и стили
- Автоматические сообщения
- Правила отображения

### Настройка уведомлений
В `IntercomService.ts` можно изменить:
- Формат сообщений
- Дополнительные поля
- Логику создания conversations

## 🔒 Безопасность

- **Access Token** хранится в переменных окружения
- **Admin API** защищен ключом администратора
- **Rate limiting** применяется ко всем API
- **Валидация** всех входящих данных

## 📊 Мониторинг

### Логи
Все операции Intercom логируются:
```
💬 Intercom notification sent successfully: ORDER-123
❌ Failed to send Intercom notification: Error message
```

### Метрики
- Количество созданных conversations
- Успешность отправки уведомлений
- Время ответа API Intercom

## 🚨 Устранение неполадок

### Виджет не загружается
1. Проверьте `NEXT_PUBLIC_INTERCOM_APP_ID`
2. Убедитесь, что APP_ID корректный
3. Проверьте консоль браузера на ошибки

### Уведомления не отправляются
1. Проверьте `INTERCOM_ACCESS_TOKEN`
2. Убедитесь в правах токена
3. Проверьте `INTERCOM_ADMIN_ID`

### API ошибки
1. Проверьте логи сервера
2. Убедитесь в корректности данных
3. Проверьте лимиты API Intercom

## 📈 Преимущества Intercom

### Для клиентов:
- **Мгновенная поддержка** через виджет чата
- **История заказов** в профиле
- **Персонализированные** ответы

### Для администраторов:
- **Централизованное** управление поддержкой
- **Автоматизация** рутинных задач
- **Аналитика** взаимодействий

### Для бизнеса:
- **Повышение** удовлетворенности клиентов
- **Снижение** нагрузки на поддержку
- **Улучшение** конверсии

## 🔄 Следующие шаги

1. **Настройте переменные окружения**
2. **Протестируйте интеграцию**
3. **Обучите команду поддержки**
4. **Настройте автоматические ответы**
5. **Мониторьте метрики**

---

**Статус:** ✅ Готово к production
**Версия:** 1.0
**Дата:** 2025-01-10


