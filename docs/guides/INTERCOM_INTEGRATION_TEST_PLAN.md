# 🧪 Intercom Integration Test Plan
## Canton OTC Exchange - Minimal Stage

**Версия:** 2025-01-17  
**Цель:** Комплексное тестирование Intercom интеграции для готовности к production

---

## 📋 ПРЕДВАРИТЕЛЬНЫЕ ПРОВЕРКИ

### ✅ Конфигурация окружения
- [ ] `NEXT_PUBLIC_INTERCOM_APP_ID` установлен
- [ ] `INTERCOM_ACCESS_TOKEN` установлен  
- [ ] `INTERCOM_ADMIN_ID` установлен
- [ ] `INTERCOM_WEBHOOK_SECRET` установлен
- [ ] Все переменные в Kubernetes Secrets

### ✅ CSP и заголовки безопасности
- [ ] `script-src` включает `https://widget.intercom.io`
- [ ] `connect-src` включает Intercom домены
- [ ] `frame-ancestors` разрешает Intercom iframe
- [ ] `img-src` включает `https://js.intercomcdn.com`

---

## 🧪 ТЕСТОВЫЕ СЦЕНАРИИ

### **1. АРХИТЕКТУРА И ЗАГРУЗКА**

#### 1.1 Lazy Loading
```bash
# Тест: Виджет загружается только при необходимости
curl -I https://stage.minimal.build.infra.1otc.cc
# Ожидаем: TTFB < 500ms, без блокирующих ресурсов Intercom
```

#### 1.2 Fallback механизм
```bash
# Тест: При недоступности Intercom показывается fallback
# 1. Отключить интернет
# 2. Открыть сайт
# 3. Ожидаем: кнопка "Contact Support" с ссылкой на Telegram
```

#### 1.3 Производительность
```bash
# Тест: Влияние на Core Web Vitals
lighthouse https://stage.minimal.build.infra.1otc.cc --only-categories=performance
# Ожидаем: LCP < 2.5s, FID < 100ms, CLS < 0.1
```

### **2. ИДЕНТИФИКАЦИЯ И КОНТЕКСТ**

#### 2.1 Связь чата с заказом
```javascript
// Тест: orderId передается в Intercom
// 1. Создать заказ
// 2. Открыть чат
// 3. Проверить custom_attributes в Intercom
const orderData = {
  orderId: "TEST-123",
  email: "test@example.com",
  cantonAddress: "0x123...",
  amount: 100,
  status: "awaiting-deposit"
}
intercomUtils.setOrderUser(orderData)
```

#### 2.2 Кастомные события
```javascript
// Тест: События отправляются в Intercom
intercomUtils.trackEvent('order_created', { orderId: 'TEST-123' })
intercomUtils.trackEvent('validation_error', { field: 'email' })
intercomUtils.trackEvent('status_changed', { status: 'completed' })
```

### **3. WEBHOOK И ОПЕРАТОРСКИЙ ПОТОК**

#### 3.1 Входящие сообщения
```bash
# Тест: Webhook обрабатывает сообщения от клиентов
curl -X POST https://stage.minimal.build.infra.1otc.cc/api/intercom/webhook \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: sha256=VALID_SIGNATURE" \
  -d '{
    "type": "conversation.user.replied",
    "data": {
      "item": {
        "id": "123",
        "conversation_parts": {
          "conversation_parts": [{
            "part_type": "comment",
            "body": "Test message from client",
            "created_at": 1640995200
          }]
        },
        "custom_attributes": {
          "order_id": "TEST-123"
        }
      }
    }
  }'
# Ожидаем: Сообщение в Telegram операторской группе
```

#### 3.2 Верификация webhook
```bash
# Тест: Неверная подпись отклоняется
curl -X POST https://stage.minimal.build.infra.1otc.cc/api/intercom/webhook \
  -H "x-hub-signature-256: sha256=INVALID_SIGNATURE" \
  -d '{"test": "data"}'
# Ожидаем: 401 Unauthorized
```

#### 3.3 Rate limiting
```bash
# Тест: Превышение лимита блокируется
for i in {1..15}; do
  curl -X POST https://stage.minimal.build.infra.1otc.cc/api/intercom/webhook \
    -H "x-hub-signature-256: sha256=VALID_SIGNATURE" \
    -d '{"test": "data"}'
done
# Ожидаем: 429 Too Many Requests после 10 запросов
```

### **4. UX И СЦЕНАРИИ ОТКАЗОВ**

#### 4.1 Смена роутов (SPA)
```javascript
// Тест: Виджет не "залипает" при навигации
// 1. Открыть чат на главной странице
// 2. Перейти на /admin
// 3. Вернуться на главную
// 4. Ожидаем: Виджет работает корректно
```

#### 4.2 Потеря сети
```javascript
// Тест: Graceful degradation
// 1. Открыть чат
// 2. Отключить интернет
// 3. Попытаться отправить сообщение
// 4. Ожидаем: Показ fallback кнопки
```

#### 4.3 Смена устройства
```javascript
// Тест: Контекст сохраняется
// 1. Создать заказ на десктопе
// 2. Открыть чат на мобильном
// 3. Ожидаем: orderId доступен в чате
```

### **5. БЕЗОПАСНОСТЬ И ПРИВАТНОСТЬ**

#### 5.1 CSP проверка
```bash
# Тест: CSP не блокирует Intercom
curl -I https://stage.minimal.build.infra.1otc.cc | grep -i "content-security-policy"
# Ожидаем: script-src включает widget.intercom.io
```

#### 5.2 Маскирование PII
```javascript
// Тест: PII маскируется в логах
// 1. Отправить сообщение с email
// 2. Проверить логи сервера
// 3. Ожидаем: email замаскирован как "test***@example.com"
```

#### 5.3 Cookies политика
```bash
# Тест: Cookies настроены правильно
curl -I https://stage.minimal.build.infra.1otc.cc | grep -i "set-cookie"
# Ожидаем: Secure, HttpOnly, SameSite атрибуты
```

### **6. МОНИТОРИНГ И МЕТРИКИ**

#### 6.1 Метрики загрузки
```bash
# Тест: Метрики виджета отслеживаются
curl "https://stage.minimal.build.infra.1otc.cc/api/admin/intercom-monitoring?adminKey=YOUR_KEY&type=metrics"
# Ожидаем: widgetLoads, widgetLoadFailures, averageResponseTime
```

#### 6.2 Health check
```bash
# Тест: Статус здоровья интеграции
curl "https://stage.minimal.build.infra.1otc.cc/api/admin/intercom-monitoring?adminKey=YOUR_KEY&type=health"
# Ожидаем: status: "healthy", issues: []
```

#### 6.3 События
```bash
# Тест: История событий
curl "https://stage.minimal.build.infra.1otc.cc/api/admin/intercom-monitoring?adminKey=YOUR_KEY&type=events&limit=10"
# Ожидаем: Массив последних событий
```

---

## 🔍 НЕГАТИВНЫЕ ТЕСТЫ

### **1. Падение Intercom CDN**
```bash
# Тест: Fallback при недоступности Intercom
# 1. Заблокировать widget.intercom.io в hosts
# 2. Открыть сайт
# 3. Ожидаем: Fallback кнопка появляется через 10 секунд
```

### **2. Бот недоступен**
```bash
# Тест: Graceful degradation при недоступности Telegram
# 1. Отключить Telegram Bot API
# 2. Отправить сообщение через Intercom
# 3. Ожидаем: Webhook не падает, ошибка логируется
```

### **3. Длинное сообщение**
```javascript
// Тест: Обработка больших сообщений
const longMessage = "A".repeat(10000) // 10KB сообщение
// Ожидаем: Сообщение обрезается или обрабатывается корректно
```

### **4. Вложения**
```javascript
// Тест: Обработка файлов в сообщениях
// 1. Отправить сообщение с изображением
// 2. Ожидаем: Файл обрабатывается или игнорируется gracefully
```

---

## 📊 КРИТЕРИИ УСПЕХА

### ✅ **ГОТОВО К БОЮ** - Все критерии выполнены:

1. **Производительность:**
   - [ ] TTFB < 500ms
   - [ ] LCP < 2.5s
   - [ ] FID < 100ms
   - [ ] CLS < 0.1

2. **Функциональность:**
   - [ ] Виджет загружается в 95%+ случаев
   - [ ] Fallback работает при ошибках
   - [ ] Webhook обрабатывает 99%+ сообщений
   - [ ] Контекст заказа передается корректно

3. **Безопасность:**
   - [ ] CSP не блокирует Intercom
   - [ ] Webhook подписи верифицируются
   - [ ] Rate limiting работает
   - [ ] PII маскируется в логах

4. **Мониторинг:**
   - [ ] Метрики собираются
   - [ ] Health check работает
   - [ ] Ошибки логируются
   - [ ] Алерты настроены

5. **UX:**
   - [ ] Виджет не "залипает" при навигации
   - [ ] Fallback доступен при проблемах
   - [ ] Сообщения доходят операторам
   - [ ] Ответы возвращаются клиентам

---

## 🚨 АЛЕРТЫ И МОНИТОРИНГ

### Критические алерты:
- [ ] Error rate > 10%
- [ ] Widget load failure rate > 5%
- [ ] Response time > 5 seconds
- [ ] Webhook signature verification failures

### Предупреждения:
- [ ] No activity in last 24 hours
- [ ] Conversion rate < 5%
- [ ] High rate limit hits

---

## 📝 ОТЧЕТ О ТЕСТИРОВАНИИ

### Результаты тестирования:
- **Дата:** ___________
- **Тестировщик:** ___________
- **Версия:** ___________

### Позитивные тесты:
- [ ] 1.1 Lazy Loading: ✅/❌
- [ ] 1.2 Fallback механизм: ✅/❌
- [ ] 1.3 Производительность: ✅/❌
- [ ] 2.1 Связь чата с заказом: ✅/❌
- [ ] 2.2 Кастомные события: ✅/❌
- [ ] 3.1 Входящие сообщения: ✅/❌
- [ ] 3.2 Верификация webhook: ✅/❌
- [ ] 3.3 Rate limiting: ✅/❌
- [ ] 4.1 Смена роутов: ✅/❌
- [ ] 4.2 Потеря сети: ✅/❌
- [ ] 4.3 Смена устройства: ✅/❌
- [ ] 5.1 CSP проверка: ✅/❌
- [ ] 5.2 Маскирование PII: ✅/❌
- [ ] 5.3 Cookies политика: ✅/❌
- [ ] 6.1 Метрики загрузки: ✅/❌
- [ ] 6.2 Health check: ✅/❌
- [ ] 6.3 События: ✅/❌

### Негативные тесты:
- [ ] 1. Падение Intercom CDN: ✅/❌
- [ ] 2. Бот недоступен: ✅/❌
- [ ] 3. Длинное сообщение: ✅/❌
- [ ] 4. Вложения: ✅/❌

### **ИТОГОВЫЙ ВЕРДИКТ:**
- [ ] ✅ **ГОТОВО К БОЮ** - Все критерии выполнены
- [ ] ❌ **НЕ ГОТОВО** - Требуются исправления

### Найденные проблемы:
1. ________________________________
2. ________________________________
3. ________________________________

### Рекомендации:
1. ________________________________
2. ________________________________
3. ________________________________

---

**Подпись тестировщика:** ___________  
**Дата:** ___________
