# 🎯 Canton OTC CRM System

## Полноценная CRM система для OTC обменника

### ✨ Основные функции

#### 1. 📊 Dashboard (Панель управления)
- Реальная статистика из Google Sheets
- Мониторинг заказов в реальном времени
- Графики и аналитика
- Быстрый доступ к последним заказам

#### 2. 📦 Orders Management (Управление заказами)
- Просмотр всех заказов
- Фильтрация по статусу
- Поиск по Order ID, Email, Address
- Редактирование статуса заказа
- Добавление TX Hash
- Удаление заказов
- Пагинация

#### 3. 👥 Customers (CRM - Управление клиентами)
- **Профили клиентов:**
  - Email, контакты (WhatsApp, Telegram)
  - Общий объём покупок (LTV)
  - Количество заказов
  - Средний чек
  - Статус: New/Active/VIP/Inactive
  
- **Аналитика клиентов:**
  - Всего клиентов
  - Новые клиенты за месяц
  - VIP клиенты (>$10,000)
  - Неактивные клиенты (>30 дней)
  - Средний LTV
  
- **Топ клиенты:**
  - Рейтинг по LTV
  - Предпочитаемые токены
  - История покупок

#### 4. 📝 Logs & Monitoring (Логи и мониторинг)
- Системные логи (Info, Success, Warning, Error)
- Фильтрация по уровню и категории
- Мониторинг состояния системы
- Отслеживание интеграций

#### 5. ⚙️ Settings (Настройки)
- Курсы и лимиты
- Поддерживаемые токены
- Прогрессивная система скидок (4 уровня)
- Статус интеграций (Google Sheets, Telegram)
- Рабочие часы

---

### 💎 Прогрессивная система скидок

Автоматические бонусы за объём покупки:

| Tier | Объём покупки | Бонус | Описание |
|------|---------------|-------|----------|
| 🥉 **Standard** | $0 - $500 | 0% | Базовая цена |
| 🥉 **Bronze** | $500 - $2,000 | +3% | Экономия 3% |
| 🥈 **Silver** | $2,000 - $10,000 | +5% | Экономия 5% |
| 🥇 **Gold** | $10,000+ | +10% | Экономия 10% |

**Как это работает:**
- Клиент платит обычную цену
- Получает **больше токенов** за ту же сумму
- Скидка применяется автоматически при расчёте
- Отображается в реальном времени при вводе суммы

---

### 🚀 Технологии

**Frontend:**
- Next.js 15 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
- Framer Motion (анимации)
- React Hot Toast (уведомления)

**Backend:**
- Next.js API Routes
- NextAuth v5 (аутентификация)
- Google Sheets API (хранение данных)
- Telegram Bot API (уведомления)

**Security:**
- Rate limiting (3 заказа/час на IP)
- Spam detection
- Canton address validation
- JWT authentication
- Bcrypt password hashing

---

### 🔐 Аутентификация

**Дефолтные credentials:**
- Email: `admin@canton-otc.com`
- Password: `canton-admin-2025`

⚠️ **ВАЖНО:** Смените пароль в продакшне!

**Как сгенерировать новый хеш пароля:**
```javascript
const bcrypt = require('bcryptjs');
const hash = await bcrypt.hash('your-new-password', 10);
console.log(hash);
```

Затем обновите `ADMIN_PASSWORD_HASH` в `.env`

---

### 📈 Аналитика и метрики

**Order Metrics:**
- Total Orders
- Total Volume (USD)
- Completed Orders
- Pending Orders
- Failed Orders
- Average Order Value

**Customer Metrics:**
- Total Customers
- New Customers (month)
- VIP Customers
- Inactive Customers
- Average LTV
- Top Customers by LTV

**Real-time Data:**
- Все данные загружаются из Google Sheets
- Обновление по требованию
- Фильтрация и сортировка
- Пагинация для больших объёмов

---

### 🎨 UI/UX Features

- **Responsive Design:** Полностью адаптивный для мобильных устройств
- **Dark Sidebar:** Профессиональный дизайн админки
- **Real-time Updates:** Обновление данных без перезагрузки
- **Loading States:** Индикаторы загрузки
- **Error Handling:** Понятные сообщения об ошибках
- **Toast Notifications:** Уведомления о действиях
- **Pagination:** Для больших списков
- **Sorting & Filtering:** Гибкие возможности фильтрации

---

### 🔄 Integration Status

**✅ Google Sheets:**
- Автоматическое сохранение заказов
- CRUD операции
- Статистика и аналитика
- JWT аутентификация

**✅ Telegram Bot:**
- Уведомления о новых заказах
- HTML форматирование
- Поддержка бизнес-часов
- Детальная информация о заказе

**✅ Multi-token Support:**
- ETH (Ethereum)
- BNB (BSC)
- USDT (ERC-20, BEP-20, TRC-20)
- Автоматический пересчёт курсов
- QR коды для оплаты

---

### 📱 Supported Tokens

| Token | Network | Price | Min | Max |
|-------|---------|-------|-----|-----|
| ETH | Ethereum | ~$2,400 | 0.02 | 20 |
| BNB | BSC | ~$320 | 0.15 | 150 |
| USDT | Ethereum (ERC-20) | $1 | 50 | 50,000 |
| USDT | BSC (BEP-20) | $1 | 50 | 50,000 |
| USDT | Tron (TRC-20) | $1 | 50 | 50,000 |

---

### 🛡️ Security Features

1. **Rate Limiting:**
   - 3 orders per hour per IP
   - Email-based limiting
   - Automatic cooldown

2. **Spam Detection:**
   - Pattern analysis
   - Duplicate detection
   - Suspicious activity flagging

3. **Address Validation:**
   - Canton Network format validation
   - Multiple format support
   - Checksum verification

4. **Authentication:**
   - NextAuth v5 (latest)
   - JWT tokens
   - Session management
   - Protected routes (middleware)

---

### 📊 Customer Lifecycle

**New** → First order
↓
**Active** → 3+ orders OR <30 days since last order
↓
**VIP** → $10,000+ total volume
↓
**Inactive** → >30 days since last order

---

### 🎯 Best Practices Implemented

✅ **No Mocks or Hardcoded Data:** All data from real sources  
✅ **Type Safety:** Full TypeScript coverage  
✅ **Error Handling:** Comprehensive error handling  
✅ **Logging:** Detailed logging system  
✅ **Security:** Rate limiting, spam detection, validation  
✅ **Scalability:** Pagination, efficient data loading  
✅ **UX:** Loading states, error messages, toast notifications  
✅ **Responsive:** Mobile-first design  
✅ **Real-time:** Instant data updates  
✅ **Production Ready:** All integrations configured  

---

### 📖 API Endpoints

**Admin API:**
```
GET    /api/admin/stats                     # Dashboard statistics
GET    /api/admin/orders                    # List orders (paginated)
GET    /api/admin/orders/[orderId]          # Get single order
PATCH  /api/admin/orders/[orderId]          # Update order
DELETE /api/admin/orders/[orderId]          # Delete order
GET    /api/admin/customers                 # List customers (CRM)
GET    /api/admin/customers/[email]         # Customer profile
GET    /api/admin/customers/analytics       # Customer analytics
GET    /api/admin/settings                  # System settings
```

**Public API:**
```
POST   /api/create-order                    # Create new order
GET    /api/order-status/[orderId]          # Check order status
GET    /api/health                          # Health check
```

---

### 🚀 Deployment Notes

1. Set all environment variables in `.env`
2. Configure Google Sheets API (see GOOGLE_SHEETS_SETUP.md)
3. Set up Telegram Bot (optional but recommended)
4. Change default admin password
5. Update receiving addresses for production
6. Deploy to Vercel/any Node.js hosting
7. Monitor logs and analytics

---

### 💡 Future Enhancements

- [ ] Email notifications for customers
- [ ] Advanced charts and graphs
- [ ] Export data (CSV, PDF)
- [ ] Multi-admin support with roles
- [ ] Customer support chat integration
- [ ] Automated marketing campaigns
- [ ] Referral program
- [ ] API rate limit dashboard
- [ ] Transaction blockchain verification
- [ ] Multi-language support

---

**Created with ❤️ for Canton OTC Exchange**



