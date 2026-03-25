# 🎯 Canton OTC - Full CRM System

## ✨ Полноценная CRM система для управления OTC обменником

### 🚀 Что реализовано

#### ✅ **1. Прогрессивная система скидок (4 уровня)**
- **Standard** ($0-$500): 0% — базовая цена
- **Bronze** ($500-$2,000): +3% бонусных токенов
- **Silver** ($2,000-$10,000): +5% бонусных токенов  
- **Gold** ($10,000+): +10% бонусных токенов

**Автоматический расчёт:**
- Применяется при вводе суммы в форме обмена
- Клиент платит ту же цену, но получает больше токенов
- Визуальная индикация с progress bar до следующего уровня

#### ✅ **2. Dashboard (Панель управления)**
- Реальная статистика из Google Sheets
- Мониторинг заказов в реальном времени
- Ключевые метрики:
  - Всего заказов
  - Общий объём (USD)
  - Завершённые заказы
  - В обработке
  - Сегодняшние заказы
- Последние 10 заказов с быстрым доступом

#### ✅ **3. Orders Management (Управление заказами)**
- Просмотр всех заказов с пагинацией
- Фильтрация по статусу
- Поиск по Order ID, Email, Canton Address
- Редактирование заказа:
  - Изменение статуса
  - Добавление TX Hash
  - Изменение Canton Address
- Удаление заказов
- Сортировка
- Автоматические уведомления в Telegram при изменении

#### ✅ **4. Customers (CRM - Управление клиентами)**
**Профили клиентов:**
- Email, контакты (WhatsApp, Telegram)
- Lifetime Value (LTV)
- Количество заказов (всего/завершённых)
- Средний чек
- Статусы:
  - **New**: первый заказ
  - **Active**: 3+ заказов или <30 дней
  - **VIP**: $10,000+ объём
  - **Inactive**: >30 дней без заказов

**Аналитика:**
- Всего клиентов
- Новые клиенты за месяц
- VIP клиенты
- Неактивные клиенты
- Средний LTV
- Топ-10 клиентов по LTV

**Возможности:**
- Сортировка (по объёму, заказам, дате)
- Пагинация
- Просмотр истории заказов каждого клиента

#### ✅ **5. Logs & Monitoring (Логи и мониторинг)**
- Системные логи (Info, Success, Warning, Error)
- Фильтрация по:
  - Уровню (Info/Success/Warning/Error)
  - Категории (Order/Telegram/RateLimit/GoogleSheets)
- Состояние системы:
  - API status
  - Google Sheets connection
  - Telegram Bot status
- Мониторинг интеграций

#### ✅ **6. Settings (Настройки системы)**
- Просмотр текущих настроек:
  - Курс Canton Coin
  - Лимиты (min/max)
  - Поддерживаемые токены
- Статус интеграций:
  - Google Sheets (Активно/Не настроено)
  - Telegram Bot (Активно/Не настроено)
- Прогрессивная система скидок (визуализация)
- Рабочие часы

---

### 🔐 Доступ к админ-панели

**URL:** `http://localhost:3000/admin/login`

**Дефолтные credentials:**
- **Email:** `admin@canton-otc.com`
- **Password:** `canton-admin-2025`

⚠️ **КРИТИЧЕСКИ ВАЖНО:** Измените пароль в продакшне!

**Как изменить пароль:**
```javascript
const bcrypt = require('bcryptjs');
const newPasswordHash = await bcrypt.hash('your-new-secure-password', 10);
console.log(newPasswordHash);
```

Обновите `ADMIN_PASSWORD_HASH` в `.env`

---

### 📊 API Endpoints (Admin)

```
# Статистика
GET    /api/admin/stats

# Заказы
GET    /api/admin/orders?page=1&limit=20&status=completed
GET    /api/admin/orders/[orderId]
PATCH  /api/admin/orders/[orderId]
DELETE /api/admin/orders/[orderId]

# Клиенты (CRM)
GET    /api/admin/customers?page=1&sortBy=totalVolume
GET    /api/admin/customers/[email]
GET    /api/admin/customers/analytics

# Настройки
GET    /api/admin/settings
PATCH  /api/admin/settings
```

---

### 🎨 UI/UX Features

✅ **Responsive Design** - полностью адаптивный для мобильных  
✅ **Dark Sidebar** - профессиональный дизайн  
✅ **Real-time Updates** - обновление без перезагрузки  
✅ **Loading States** - индикаторы загрузки  
✅ **Error Handling** - понятные сообщения  
✅ **Toast Notifications** - уведомления о действиях  
✅ **Pagination** - для больших списков  
✅ **Sorting & Filtering** - гибкие возможности  

---

### 🛡️ Security Features

1. **NextAuth v5 Authentication:**
   - JWT tokens
   - Session management
   - Password hashing (bcrypt)

2. **Protected Routes:**
   - Middleware для автоматической защиты `/admin/*`
   - Редирект на `/admin/login` если не авторизован

3. **Rate Limiting:**
   - 3 заказа/час на IP
   - Email-based limiting

4. **Spam Detection:**
   - Pattern analysis
   - Duplicate detection

5. **Address Validation:**
   - Canton Network format validation

---

### 📱 Поддерживаемые токены

| Token | Network | Min | Max | Price |
|-------|---------|-----|-----|-------|
| ETH | Ethereum | 0.02 | 20 | ~$2,400 |
| BNB | BSC | 0.15 | 150 | ~$320 |
| USDT | Ethereum (ERC-20) | 50 | 50,000 | $1 |
| USDT | BSC (BEP-20) | 50 | 50,000 | $1 |
| USDT | Tron (TRC-20) | 50 | 50,000 | $1 |

Автоматический пересчёт курсов между токенами!

---

### 🔄 Integration Status

✅ **Google Sheets** - CRUD operations, статистика  
✅ **Telegram Bot** - уведомления о заказах  
✅ **Multi-token** - 5 токенов на 3 сетях  
✅ **QR Codes** - для оплаты  
✅ **Canton Address Validation** - проверка адресов  

---

### 📈 Customer Lifecycle

```
NEW (первый заказ)
   ↓
ACTIVE (3+ заказов ИЛИ <30 дней)
   ↓
VIP ($10,000+ объём)
   ↓
INACTIVE (>30 дней без заказов)
```

---

### 🚀 Deployment

**Локальный запуск:**
```bash
npm install
npm run dev
```

**Production build:**
```bash
npm run build
npm start
```

**Environment variables:**
Скопируйте `.env.example` в `.env.local` и заполните:
- NextAuth credentials
- Google Sheets API
- Telegram Bot
- Receiving addresses
- Canton Coin price

---

### 📝 Best Practices

✅ Нет моков или хардкода - все данные реальные  
✅ Type Safety - полное TypeScript покрытие  
✅ Error Handling - комплексная обработка ошибок  
✅ Logging - детальная система логирования  
✅ Security - rate limiting, spam detection, validation  
✅ Scalability - пагинация, эффективная загрузка  
✅ UX - loading states, error messages, notifications  
✅ Production Ready - все интеграции настроены  

---

### 💡 Технологии

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS 4
- **Animation:** Framer Motion
- **Auth:** NextAuth v5
- **Backend:** Next.js API Routes
- **Storage:** Google Sheets API
- **Notifications:** Telegram Bot API, React Hot Toast
- **Validation:** Canton Network address validation
- **Security:** Rate limiting, spam detection, bcrypt

---

### 🎯 Особенности реализации

1. **No Temporary Solutions** - только production-ready код
2. **Best Practices** - следование индустриальным стандартам
3. **Progressive Discounts** - 4-уровневая система скидок с автоматическим расчётом
4. **Real-time CRM** - полноценная система управления клиентами
5. **Advanced Analytics** - детальная аналитика и метрики
6. **Multi-token Support** - поддержка 5 токенов на 3 сетях
7. **Automated Notifications** - автоматические уведомления
8. **Professional UI** - современный профессиональный дизайн

---

### 🎨 Screenshots

**Dashboard:**
- Реальные метрики
- 4 карточки со статистикой
- Последние заказы
- Средний чек
- Статистика по статусам

**Orders:**
- Таблица с пагинацией
- Фильтрация и поиск
- Редактирование заказов
- Удаление
- Цветные статусы

**Customers (CRM):**
- Профили клиентов
- LTV и метрики
- Топ клиенты
- Аналитика
- Контактная информация

**Logs:**
- Системные логи
- Фильтрация
- Мониторинг статуса
- Категории

**Settings:**
- Прогрессивные скидки
- Поддерживаемые токены
- Статус интеграций
- Конфигурация

---

### ✨ Заключение

Полноценная **CRM система** для Canton OTC Exchange:
- ✅ 100% Production-Ready
- ✅ Без моков и временных решений
- ✅ Best Practices
- ✅ Автоматизация
- ✅ Продвинутая аналитика
- ✅ Прогрессивные скидки
- ✅ Управление клиентами
- ✅ Мониторинг и логи

**Всё работает! 🚀**

---

**Created with ❤️ for Canton Network**



