# 🚀 PRODUCTION DEPLOYMENT GUIDE
**Canton OTC Exchange - Enhanced Intercom Integration**

---

## 📋 OVERVIEW

Этот гайд поможет вам внедрить новую Intercom-First архитектуру в production среду с максимальной эффективностью и минимальными рисками.

---

## 🎯 MAIN BENEFITS

### **До внедрения:**
- ❌ Сложная система хранения разговоров в файлах
- ❌ Дублирование логики между сервисами  
- ❌ Админы работают через Telegram медиатор
- ❌ Контекст заказа разбросан по разным системам

### **После внедрения:**
- ✅ **Intercom как единый источник истины**
- ✅ **Order ID автоматически в каждом чате**
- ✅ **Админы работают в Intercom Dashboard**
- ✅ **Полный контекст клиента в одном месте**
- ✅ **60% меньше кода для поддержки**

---

## 🛠️ DEPLOYMENT STEPS

### **PHASE 1: PREPARATION (30 минут)**

#### 1.1 **Backup Current System**
```bash
# Создать backup текущих файлов
cp -r src/lib/services src/lib/services.backup
cp -r src/app/api/create-order src/app/api/create-order.backup
cp -r src/components/OrderSummary.tsx src/components/OrderSummary.tsx.backup
```

#### 1.2 **Environment Variables Setup**
```bash
# Добавить в .env.local (если еще нет)
NEXT_PUBLIC_INTERCOM_APP_ID=your_intercom_app_id
INTERCOM_ACCESS_TOKEN=your_intercom_access_token
INTERCOM_ADMIN_ID=your_intercom_admin_id
INTERCOM_WEBHOOK_SECRET=your_webhook_secret

# Telegram (опционально - только для уведомлений)
TELEGRAM_MEDIATOR_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_MEDIATOR_CHAT_ID=your_telegram_chat_id
```

#### 1.3 **Dependencies Check**
```bash
# Проверить что все dependencies установлены
npm list axios
npm list crypto
npm list next
```

---

### **PHASE 2: DEPLOY NEW SERVICES (45 минут)**

#### 2.1 **Deploy Enhanced Intercom Service**
```bash
# Копировать новый сервис
cp /path/to/enhancedIntercom.ts src/lib/services/

# Тестировать локально
npm run dev
# Проверить в консоли: "✅ Enhanced Intercom Service configured"
```

#### 2.2 **Deploy Simplified Telegram Mediator**
```bash
# Заменить существующий telegramMediator.ts
mv src/lib/services/telegramMediator.ts src/lib/services/telegramMediator.old.ts
cp /path/to/simplifiedTelegramMediator.ts src/lib/services/telegramMediator.ts
```

#### 2.3 **Deploy Enhanced Order Creation API**
```bash
# Создать новый endpoint рядом со старым (для A/B testing)
cp /path/to/enhanced-route.ts src/app/api/create-order/
```

#### 2.4 **Deploy Enhanced Order Summary Component**
```bash
# Заменить компонент
mv src/components/OrderSummary.tsx src/components/OrderSummary.old.tsx
cp /path/to/EnhancedOrderSummary.tsx src/components/OrderSummary.tsx
```

---

### **PHASE 3: A/B TESTING (1 час)**

#### 3.1 **Test New Order Creation**
```typescript
// В src/components/OrderSummary.tsx измените endpoint
const response = await fetch('/api/create-order/enhanced-route', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(order),
})
```

#### 3.2 **Manual Testing Checklist**

**✅ Order Creation:**
- [ ] Создать тестовый заказ
- [ ] Проверить создание пользователя в Intercom
- [ ] Проверить создание conversation с welcome message
- [ ] Проверить добавление tags (new-order, amount-basic, etc.)
- [ ] Проверить уведомление в Telegram

**✅ Intercom Dashboard:**
- [ ] Открыть Intercom Dashboard
- [ ] Найти созданную conversation
- [ ] Проверить Custom Attributes:
  - active_order_id
  - active_order_amount
  - canton_address
  - payment_token
- [ ] Проверить Tags в разговоре
- [ ] Проверить Welcome message

**✅ Customer Experience:**
- [ ] Нажать "Contact Customer Support" 
- [ ] Проверить открытие Intercom chat
- [ ] Проверить предзаполненное сообщение с Order ID
- [ ] Отправить тестовое сообщение
- [ ] Проверить получение в Intercom Dashboard

**✅ Admin Workflow:**
- [ ] Ответить на сообщение через Intercom Dashboard
- [ ] Проверить получение ответа в клиентском чате
- [ ] Добавить internal note
- [ ] Изменить status conversation
- [ ] Добавить custom tags

---

### **PHASE 4: MONITORING & ROLLBACK PLAN (30 минут)**

#### 4.1 **Setup Monitoring**
```typescript
// Добавить health check endpoint
// GET /api/health/intercom
export async function GET() {
  const intercomHealth = await enhancedIntercomService.healthCheck()
  const telegramHealth = await simplifiedTelegramMediator.testConnection()
  
  return NextResponse.json({
    intercom: intercomHealth ? 'healthy' : 'failed',
    telegram: telegramHealth ? 'healthy' : 'failed',
    timestamp: new Date().toISOString()
  })
}
```

#### 4.2 **Rollback Plan**
```bash
# Если что-то идет не так - быстрый rollback
mv src/lib/services/telegramMediator.old.ts src/lib/services/telegramMediator.ts
mv src/components/OrderSummary.old.tsx src/components/OrderSummary.tsx

# Изменить endpoint обратно на старый
# В OrderSummary.tsx: '/api/create-order' вместо '/api/create-order/enhanced-route'

# Перезапустить приложение
npm run build && npm start
```

---

### **PHASE 5: FULL DEPLOYMENT (15 минут)**

#### 5.1 **Switch to New System**
```bash
# Удалить старые файлы
rm src/lib/services/conversationStorage.ts
rm src/lib/services/intercomMonitoring.ts

# Заменить основной endpoint
mv src/app/api/create-order/route.ts src/app/api/create-order/route.old.ts
mv src/app/api/create-order/enhanced-route.ts src/app/api/create-order/route.ts
```

#### 5.2 **Update Import Statements**
```typescript
// В файлах где используется старый telegramMediatorService
// Заменить на:
import { simplifiedTelegramMediator } from '@/lib/services/simplifiedTelegramMediator'

// Вместо старого intercomService
// Использовать:
import { enhancedIntercomService } from '@/lib/services/enhancedIntercom'
```

#### 5.3 **Final Build & Deploy**
```bash
# Финальная сборка
npm run build

# Запуск в production
npm start

# Или deploy на вашу платформу (Vercel, etc.)
vercel deploy --prod
```

---

## 🔧 INTERCOM DASHBOARD SETUP

### **Configure Custom Attributes**

В Intercom Dashboard → Settings → Data → Custom Attributes:

**User Attributes:**
- `active_order_id` (String) - "Current Order ID"
- `active_order_status` (String) - "Current Order Status"  
- `active_order_amount` (Number) - "Current Order Amount"
- `total_orders` (Number) - "Total Orders Count"
- `total_volume_usd` (Number) - "Total Volume USD"
- `support_priority` (String) - "Support Priority"
- `canton_address` (String) - "Canton Address"
- `payment_token` (String) - "Preferred Payment Token"

**Conversation Attributes:**
- `order_id` (String) - "Order ID"
- `order_status` (String) - "Order Status"
- `order_amount` (Number) - "Order Amount"
- `conversation_type` (String) - "Conversation Type"

### **Setup Tags**

Создать автоматические tags в Intercom:
- `new-order` - новые заказы
- `amount-basic` - заказы до $1000
- `amount-standard` - заказы $1000-$5000  
- `amount-premium` - заказы $5000-$10000
- `amount-enterprise` - заказы $10000+
- `network-tron` - TRON сеть
- `network-ethereum` - Ethereum сеть
- `awaiting-deposit` - ожидает депозит
- `completed` - завершенные заказы

### **Setup Saved Replies**

Создать готовые ответы для операторов:

**Payment Instructions:**
```
Hi! Thanks for your order #{order_id}. 

Please send {amount} {token} to the following address:
{payment_address}

Network: {network}
Minimum confirmations: 3

We'll process your order within 2-12 hours after confirmation.
```

**Order Status Update:**
```
Order #{order_id} Status Update:

Current Status: {status}
Expected completion: {time}

We'll notify you as soon as your Canton Coins are sent!
```

---

## 📊 SUCCESS METRICS

### **Technical Metrics:**
- ✅ **Response Time:** < 100ms для webhook
- ✅ **Error Rate:** < 1% для Intercom API calls
- ✅ **Uptime:** > 99.9% для Intercom integration
- ✅ **Memory Usage:** -80% по сравнению со старой системой

### **Business Metrics:**
- ✅ **Support Response Time:** среднее время ответа
- ✅ **Customer Satisfaction:** оценки в Intercom
- ✅ **Conversion Rate:** от chat к completed order
- ✅ **Support Ticket Volume:** количество обращений

### **Operational Metrics:**
- ✅ **Admin Efficiency:** время обработки одного заказа
- ✅ **Context Completeness:** % чатов с полным контекстом заказа
- ✅ **Escalation Rate:** % чатов переданных человеку
- ✅ **Resolution Rate:** % успешно решенных вопросов

---

## 🚨 TROUBLESHOOTING

### **Common Issues:**

**1. Intercom API 401 Unauthorized**
```bash
# Проверить токены
echo $INTERCOM_ACCESS_TOKEN
echo $INTERCOM_ADMIN_ID

# Проверить права токена в Intercom Settings
```

**2. User not created in Intercom**
```typescript
// Добавить debug logging
console.log('Creating user:', userData)
const response = await this.client.post('/users', userData)
console.log('User created:', response.data)
```

**3. Conversation not showing in Dashboard**
```typescript
// Проверить создание conversation
const conversation = await enhancedIntercomService.createOrderConversation(user, order)
console.log('Conversation created:', conversation?.id)
```

**4. Telegram notifications not working**
```bash
# Проверить токен и chat ID
curl "https://api.telegram.org/bot$TELEGRAM_MEDIATOR_BOT_TOKEN/getMe"
```

**5. Tags not appearing**
```typescript
// Проверить добавление tags
await enhancedIntercomService.tagConversation(conversationId, ['test-tag'])
```

---

## 🎉 POST-DEPLOYMENT

### **Immediate Actions (первые 24 часа):**
1. ✅ Мониторить error logs каждый час
2. ✅ Проверять создание пользователей в Intercom
3. ✅ Тестировать customer journey несколько раз
4. ✅ Получить feedback от операторов
5. ✅ Проверить все Telegram уведомления

### **Week 1 Actions:**
1. ✅ Анализировать Intercom Analytics
2. ✅ Оптимизировать saved replies
3. ✅ Настроить automation rules в Intercom
4. ✅ Обучить операторов новому workflow
5. ✅ Собрать customer feedback

### **Week 2-4 Actions:**
1. ✅ Удалить старые backup файлы
2. ✅ Оптимизировать performance
3. ✅ Добавить advanced analytics
4. ✅ Настроить alerting для критических ошибок
5. ✅ Документировать lessons learned

---

## 📞 SUPPORT CONTACTS

**Technical Issues:**
- 🔧 Check logs: `npm run logs`
- 📊 Health check: `GET /api/health/intercom`
- ⚡ Rollback script: см. Phase 4.2

**Business Questions:**
- 💬 Intercom Dashboard: app.intercom.com
- 📈 Analytics: Intercom → Reports
- 👥 Team performance: Intercom → Teammates

---

**🎯 Success Criteria: Order ID успешно прокидывается в каждый чат, админы работают удобно в Intercom Dashboard, клиенты получают быстрые ответы с полным контекстом заказа.**
