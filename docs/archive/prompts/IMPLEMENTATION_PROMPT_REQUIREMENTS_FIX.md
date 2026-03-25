# 🛠️ ПРОМПТ ДЛЯ РЕАЛИЗАЦИИ ИСПРАВЛЕНИЙ ТРЕБОВАНИЙ

**Проект**: Canton OTC Exchange  
**Дата**: 2025-01-27  
**Версия**: 2.0 (обновлено с учетом прогресса)  
**Цель**: Реализовать все требования из скриншотов согласно спецификации

---

## ✅ ТЕКУЩИЙ СТАТУС ВЫПОЛНЕНИЯ

**Выполнено:**
- ✅ **REQ-001**: Изменение порядка блоков в форме - **ЗАВЕРШЕНО**
- ✅ **REQ-002**: Функция "Make a deal at market price" - **ЗАВЕРШЕНО**
- ✅ **REQ-004**: Удаление таймера оплаты - **ЗАВЕРШЕНО**
- ✅ **REQ-005**: Шеринг ссылки на ордер - **ЗАВЕРШЕНО**

**В процессе:**
- 🟡 **REQ-006**: Детальная калькуляция - **НАЧАТО, НУЖНО ЗАВЕРШИТЬ**

**Осталось выполнить:**
- ❌ **REQ-007**: Упрощение текста ордера в Telegram (английский язык)
- ❌ **REQ-008**: Условное отображение "(market)" - **ЧАСТИЧНО** (логика есть в telegram.ts, но нужно проверить и доработать)

---

## 🔍 ОБЯЗАТЕЛЬНАЯ ПРОВЕРКА ПЕРЕД НАЧАЛОМ

**КРИТИЧЕСКИ ВАЖНО:** Перед началом работы выполни полную проверку текущего состояния:

### 1. Проверка кода и линтера

```bash
# Проверь линтер на всех измененных файлах
read_lints paths=['src/components/ExchangeFxaorm.tsx', 'src/components/ExchangeFormCompact.tsx', 'src/components/OrderSummary.tsx', 'src/components/EnhancedOrderSummary.tsx', 'src/config/otc.ts', 'src/app/api/create-order/route.ts', 'src/lib/services/telegram.ts']

# Проверь TypeScript компиляцию
# (выполни в терминале или через IDE)
```

**Требование:** Должно быть **0 ошибок** и **0 предупреждений**. Если есть предупреждения - исправь их ПЕРВЫМ ДЕЛОМ.

### 2. Проверка выполненных требований

**REQ-001:**
- [ ] Открой `src/components/ExchangeForm.tsx` (строки 488-547)
- [ ] Проверь наличие заголовка "Do you want to BUY or SELL Canton?"
- [ ] Проверь наличие подзаголовка "Make your choice!"
- [ ] Убедись, что кнопки BUY/SELL находятся сразу после подзаголовка
- [ ] Проверь `ExchangeFormCompact.tsx` аналогично

**REQ-002:**
- [ ] Проверь наличие state `isMarketPrice` в обеих формах
- [ ] Проверь наличие чекбокса "Make a deal at market price" (строки ~620-630 в ExchangeForm.tsx)
- [ ] Проверь, что поле цены имеет `disabled={isMarketPrice}`
- [ ] Проверь наличие поля `isMarketPrice?: boolean` в `src/config/otc.ts` (строка ~310)
- [ ] Проверь обработку флага в `src/app/api/create-order/route.ts`

**REQ-004:**
- [ ] Открой `src/components/OrderSummary.tsx` - убедись, что блок таймера удален
- [ ] Проверь отсутствие функций `formatTime()`, `getTimerColor()`
- [ ] Проверь отсутствие state `timeLeft`
- [ ] Проверь `EnhancedOrderSummary.tsx` аналогично

**REQ-005:**
- [ ] Проверь наличие блока "Share Order Link" в `OrderSummary.tsx` (после "You will receive")
- [ ] Проверь работу кнопки копирования

### 3. Проверка качества кода

**Критерии качества:**
- ✅ Нет дублирования кода
- ✅ Используются существующие паттерны проекта
- ✅ TypeScript типы корректны
- ✅ Нет неиспользуемых импортов
- ✅ Нет конфликтов в className (block/flex и т.д.)
- ✅ Все функции имеют правильные зависимости в useCallback/useEffect

---

## 📋 КОНТЕКСТ ПРОЕКТА

Ты работаешь с проектом **Canton OTC Exchange** - платформой для обмена Canton Coin на другие криптовалюты.

**Технологический стек:**
- Next.js 14+ (App Router)
- TypeScript (строгая типизация)
- React 18+ (hooks, функциональные компоненты)
- Framer Motion (анимации)
- Tailwind CSS (стилизация)
- Supabase (база данных)
- Telegram Bot API

**Структура проекта:**
- `src/components/` - React компоненты (клиентские)
- `src/app/api/` - API routes (серверные)
- `src/lib/services/` - Сервисы (Telegram, Intercom, Google Sheets)
- `src/config/otc.ts` - Конфигурация и типы данных
- `src/lib/utils.ts` - Утилиты (formatCurrency, formatNumber, etc.)

**Паттерны проекта:**
- Все компоненты - функциональные с hooks
- Используется `'use client'` для клиентских компонентов
- State управление через `useState`, `useCallback`, `useEffect`
- Анимации через Framer Motion (`motion.div`, `AnimatePresence`)
- Стили через Tailwind CSS с кастомными классами
- Форматирование через утилиты из `@/lib/utils`

---

## 🎯 ЗАДАЧА

Реализовать **оставшиеся требования** из скриншотов, приведя систему в полное соответствие со спецификации. Все изменения должны быть выполнены на **атомарном уровне**, качественно и соответствовать **best practices**.

---

## 📝 BEST PRACTICES И КРИТЕРИИ КАЧЕСТВА

### ⚠️ КРИТИЧЕСКИ ВАЖНЫЕ ПРАВИЛА

1. **Всегда читай существующий код перед изменением**
   - Используй `read_file` для чтения файлов
   - Изучи структуру и паттерны перед редактированием
   - Не предполагай - проверяй

2. **Обратная совместимость - ПРИОРИТЕТ #1**
   - Все новые поля должны быть опциональными (`?:`)
   - Старые форматы данных должны продолжать работать
   - Не удаляй legacy поля без необходимости

3. **Следуй существующим паттернам**
   - Используй те же стили, структуру, naming conventions
   - Копируй паттерны из похожих компонентов
   - Не изобретай велосипед

4. **Чистый код - без предупреждений**
   - После каждого изменения проверяй `read_lints`
   - Исправляй все предупреждения немедленно
   - Не оставляй TODO или FIXME без необходимости

5. **Атомарные изменения**
   - Каждое требование реализуй отдельно
   - Коммить изменения по одному требованию
   - Проверяй каждое требование перед переходом к следующему

6. **Тестирование на каждом шаге**
   - Проверяй компиляцию TypeScript
   - Проверяй линтер
   - Проверяй визуально в браузере (если возможно)

---

## ✅ ВЫПОЛНЕНО (Проверь перед продолжением)

### REQ-001: Изменение порядка блоков в форме ✅

**Статус**: ✅ **ВЫПОЛНЕНО** - проверь перед продолжением

**Что было сделано:**
- Изменен заголовок на "Do you want to BUY or SELL Canton?"
- Добавлен подзаголовок "Make your choice!"
- Кнопки BUY/SELL перемещены сразу после подзаголовка
- Изменения внесены в `ExchangeForm.tsx` и `ExchangeFormCompact.tsx`

**Файлы:**
- `src/components/ExchangeForm.tsx` (строки 481-547)
- `src/components/ExchangeFormCompact.tsx` (строки 296-350)

**Проверка:**
```bash
# 1. Проверь линтер
read_lints paths=['src/components/ExchangeForm.tsx', 'src/components/ExchangeFormCompact.tsx']

# 2. Проверь наличие текста
grep -n "Do you want to BUY or SELL Canton" src/components/ExchangeForm.tsx
grep -n "Make your choice" src/components/ExchangeForm.tsx

# 3. Проверь порядок блоков визуально (если возможно)
```

**Критерии успеха:**
- ✅ Заголовок отображается корректно
- ✅ Кнопки находятся сразу после подзаголовка
- ✅ Остальные блоки сохраняют порядок
- ✅ Нет ошибок линтера

---

### REQ-002: Функция "Make a deal at market price" ✅

**Статус**: ✅ **ВЫПОЛНЕНО** - проверь перед продолжением

**Что было сделано:**
- Добавлен state `isMarketPrice` в обе формы
- Добавлен чекбокс "Make a deal at market price" перед полем цены
- Поле цены отключается при активации чекбокса (`disabled={isMarketPrice}`)
- Добавлено поле `isMarketPrice?: boolean` в тип `OTCOrder`
- Обновлен API для обработки флага
- В Telegram показывается "(market)" условно
- В Order Summary показывается пометка "at Market Price"

**Файлы:**
- `src/components/ExchangeForm.tsx` (строки 44, 198-205, 620-650)
- `src/components/ExchangeFormCompact.tsx` (строки 52, 79-87, 443-480)
- `src/config/otc.ts` (строка ~310)
- `src/app/api/create-order/route.ts` (строки 128, 400)
- `src/lib/services/telegram.ts` (строки 450-490)
- `src/app/page.tsx` (добавлено isMarketPrice в интерфейс)
- `src/components/OrderSummary.tsx` (добавлена пометка)

**Проверка:**
```bash
# 1. Проверь наличие state
grep -n "isMarketPrice" src/components/ExchangeForm.tsx

# 2. Проверь чекбокс
grep -n "Make a deal at market price" src/components/ExchangeForm.tsx

# 3. Проверь disabled логику
grep -n "disabled.*isMarketPrice" src/components/ExchangeForm.tsx

# 4. Проверь тип
grep -n "isMarketPrice.*boolean" src/config/otc.ts

# 5. Проверь линтер
read_lints paths=['src/components/ExchangeForm.tsx', 'src/components/ExchangeFormCompact.tsx', 'src/config/otc.ts']
```

**Критерии успеха:**
- ✅ Чекбокс присутствует и работает
- ✅ Поле цены отключается при активации
- ✅ Ордер создается с правильным флагом
- ✅ В Telegram показывается "(market)" только при активной галке
- ✅ Нет ошибок линтера

---

### REQ-004: Удаление таймера оплаты ✅

**Статус**: ✅ **ВЫПОЛНЕНО** - проверь перед продолжением

**Что было сделано:**
- Удален блок "Payment Timer" из `OrderSummary.tsx`
- Удален блок "Payment Timer" из `EnhancedOrderSummary.tsx`
- Удалены функции `formatTime()`, `getTimerColor()`
- Удален state `timeLeft` и useEffect для таймера
- Удален импорт `Clock` из lucide-react

**Файлы:**
- `src/components/OrderSummary.tsx`
- `src/components/EnhancedOrderSummary.tsx`

**Проверка:**
```bash
# 1. Проверь отсутствие таймера
grep -n "Payment Timer\|timeLeft\|formatTime\|getTimerColor" src/components/OrderSummary.tsx
# Должно быть пусто

# 2. Проверь отсутствие Clock импорта
grep -n "Clock" src/components/OrderSummary.tsx
# Должно быть пусто

# 3. Проверь линтер
read_lints paths=['src/components/OrderSummary.tsx', 'src/components/EnhancedOrderSummary.tsx']
```

**Критерии успеха:**
- ✅ Блок таймера полностью удален
- ✅ Нет ошибок компиляции
- ✅ Компонент работает корректно без таймера
- ✅ Нет неиспользуемых импортов

---

### REQ-005: Шеринг ссылки на ордер ✅

**Статус**: ✅ **ВЫПОЛНЕНО** - проверь перед продолжением

**Что было сделано:**
- Добавлен блок "Share Order Link" в `OrderSummary.tsx`
- Ссылка в формате `${window.location.origin}/order/${orderId}`
- Добавлена кнопка "Copy" для копирования ссылки
- Блок размещен после "You will receive"

**Файлы:**
- `src/components/OrderSummary.tsx` (после блока "You will receive")

**Проверка:**
```bash
# 1. Проверь наличие блока
grep -n "Share Order Link\|order/${orderId}" src/components/OrderSummary.tsx

# 2. Проверь кнопку копирования
grep -n "Copy.*Link\|copyToClipboard" src/components/OrderSummary.tsx

# 3. Проверь линтер
read_lints paths=['src/components/OrderSummary.tsx']
```

**Критерии успеха:**
- ✅ Ссылка отображается корректно
- ✅ Кнопка копирования работает
- ✅ Ссылка ведет на правильную страницу ордера
- ✅ Нет ошибок линтера

---

## 🟡 ПРИОРИТЕТ 2: ВАЖНЫЕ ИСПРАВЛЕНИЯ (В РАБОТЕ)

### REQ-006: Детальная калькуляция 🟡 В ПРОЦЕССЕ

**Статус**: 🟡 **НАЧАТО** - нужно завершить

**Файлы для изменения:**
- `src/components/OrderSummary.tsx`
- `src/components/EnhancedOrderSummary.tsx`

**Требования:**
1. Добавить блок с детальной калькуляцией:
   - **Общая сумма к переводу** (paymentAmount в USD)
   - **Комиссия** (в USD и в CC/USDT в зависимости от направления)
   - **Итоговая сумма, которую получит инициатор** (уже есть, но нужно добавить детализацию)

**Детали реализации:**

**Для BUY (покупка Canton):**
```typescript
const totalAmount = orderData.paymentAmountUSD // Общая сумма к переводу
const commissionUSD = totalAmount * (orderData.serviceCommission || 1) / 100 // Комиссия в USD
const finalAmount = orderData.cantonAmount // Итоговая сумма в CC
```

**Для SELL (продажа Canton):**
```typescript
const totalAmount = orderData.cantonAmount // Общая сумма к переводу (в CC)
const commissionCC = totalAmount * (orderData.serviceCommission || 1) / 100 // Комиссия в CC
const finalAmount = orderData.paymentAmount // Итоговая сумма в USDT
```

**UI структура:**
```tsx
{/* REQ-006: Exchange Calculation Details */}
<motion.div
  className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.35 }}
>
  <h3 className="text-lg font-bold text-white mb-4">Exchange Calculation</h3>
  <div className="space-y-3">
    <div className="flex justify-between items-center">
      <span className="text-white/70">Total Amount:</span>
      <span className="text-white font-semibold">
        {isBuying 
          ? `${formatCurrency(totalAmount)} USD`
          : `${formatCurrency(totalAmount)} CC`
        }
      </span>
    </div>
    <div className="flex justify-between items-center">
      <span className="text-white/70">Commission ({orderData.serviceCommission || 1}%):</span>
      <span className="text-cyan-400 font-semibold">
        {isBuying 
          ? `${formatCurrency(commissionUSD)} USD`
          : `${formatCurrency(commissionCC)} CC`
        }
      </span>
    </div>
    <div className="border-t border-white/10 pt-3 mt-3">
      <div className="flex justify-between items-center">
        <span className="text-white font-semibold">You will receive:</span>
        <span className="text-cyan-300 font-bold text-lg">
          {isBuying 
            ? `${formatCurrency(finalAmount)} CC`
            : `${formatCurrency(finalAmount)} ${orderData.paymentToken.symbol}`
          }
        </span>
      </div>
    </div>
  </div>
</motion.div>
```

**Размещение:**
- Разместить блок **перед** блоком "You will receive"
- Использовать существующие стили и компоненты
- Использовать `formatCurrency` и `formatNumber` для форматирования

**Проверка:**
- [ ] Все суммы отображаются корректно
- [ ] Расчеты правильные (проверь математику)
- [ ] Форматирование соответствует существующему стилю
- [ ] Блок отображается для обоих направлений (BUY/SELL)
- [ ] Нет ошибок линтера

**Критерии успеха:**
- ✅ Блок отображается перед "You will receive"
- ✅ Все три значения (общая сумма, комиссия, итоговая сумма) присутствуют
- ✅ Расчеты математически корректны
- ✅ Форматирование единообразно
- ✅ Нет ошибок линтера

---

### REQ-007: Упрощение текста ордера в Telegram

**Статус**: ❌ **НЕ ВЫПОЛНЕНО** - нужно реализовать

**Файлы для изменения:**
- `src/lib/services/telegram.ts` (метод `formatPublicOrderMessage`, строки ~436-491)

**Требования:**
1. Перевести весь текст на **английский язык**
2. Упростить форматирование, убрать избыточные эмодзи
3. Убрать процент комиссии из текста
4. Убрать дескриптор "(рыночная)" из текста (он будет условно показываться только при REQ-008)
5. Убрать призыв к действию из текста (оставить только кнопку)

**Обязательные поля (все на английском):**
- Заголовок: "🔔 NEW OTC ORDER" (один эмодзи для заголовка)
- Тип: "Type: BUY Canton Coin" или "Type: SELL Canton Coin"
- Payment: "Payment: $500.00 USDT"
- Price: "Price CC: $0.4400" (без "(рыночная)" - будет добавлено в REQ-008)
- Receiving: "Receiving: 1136.36 Canton Coin"
- Order ID: "Order ID: MIQKFB9G-S3H1A8"
- Created: "Created: 04.12.2025, 01:15 (MSK)"
- Contact: "@TECH_HY_Customer_Service_bot", "@hypov"

**Исключаемые поля:**
- ❌ Процент комиссии (строка "📈 <b>Комиссия:</b> ${serviceCommission}%")
- ❌ Дескриптор "(рыночная)" в тексте (будет условно в REQ-008)
- ❌ Призыв к действию "⚡️ <i>Нажмите "Принять заявку" для начала сделки</i>"
- ❌ Избыточные эмодзи (💰, 📊, 💵, 📈, 📋, 🕐, 📞, 💬, 👤, ⚡️ - оставить только 🔔)

**Текущий код (нужно заменить):**
```typescript
return `
🔔 <b>НОВАЯ ЗАЯВКА OTC</b>

📊 <b>Тип:</b> ${direction} Canton Coin
${amountLine}

💵 <b>Цена:</b> ${priceDisplay}
📈 <b>Комиссия:</b> ${serviceCommission}%
📋 <b>ID заявки:</b> <code>${order.orderId}</code>
🕐 <b>Создана:</b> ${timestamp} (МСК)

📞 <b>СВЯЗЬ С ОПЕРАТОРОМ:</b>
💬 ${serviceBotUsername}
👤 ${operatorUsername}

⚡️ <i>Нажмите "Принять заявку" для начала сделки</i>
  `.trim();
```

**Новый код (пример):**
```typescript
return `
🔔 <b>NEW OTC ORDER</b>

<b>Type:</b> ${direction === '🛒 ПОКУПКА' ? 'BUY' : 'SELL'} Canton Coin
${amountLine}

<b>Price CC:</b> ${priceDisplay}
<b>Order ID:</b> <code>${order.orderId}</code>
<b>Created:</b> ${timestamp} (MSK)

<b>CONTACT:</b>
${serviceBotUsername}
${operatorUsername}
  `.trim();
```

**Детали реализации:**
- Использовать минимальное форматирование HTML (только `<b>`, `<code>`)
- Убрать все лишние эмодзи, оставить только 🔔 для заголовка
- Текст должен быть лаконичным и информативным
- Использовать существующие функции форматирования даты
- Перевести все тексты на английский
- Убрать строку с комиссией полностью
- Убрать призыв к действию (кнопка останется)

**Проверка:**
```bash
# 1. Проверь английский язык
grep -n "НОВАЯ ЗАЯВКА\|Создана\|СВЯЗЬ\|Комиссия" src/lib/services/telegram.ts
# Должно быть пусто (все на английском)

# 2. Проверь отсутствие комиссии в тексте
grep -n "Комиссия\|Commission.*%" src/lib/services/telegram.ts
# Должно быть пусто

# 3. Проверь минимальные эмодзи
grep -n "💰\|📊\|💵\|📈\|📋\|🕐\|📞\|💬\|👤\|⚡️" src/lib/services/telegram.ts
# Должен остаться только 🔔

# 4. Проверь линтер
read_lints paths=['src/lib/services/telegram.ts']
```

**Критерии успеха:**
- ✅ Текст полностью на английском языке
- ✅ Текст лаконичный, без избыточной информации
- ✅ Минимальное использование эмодзи (только 🔔)
- ✅ Все обязательные поля присутствуют
- ✅ Исключаемые поля отсутствуют
- ✅ Нет ошибок линтера

---

### REQ-008: Условное отображение "(market)"

**Статус**: 🟡 **ЧАСТИЧНО ВЫПОЛНЕНО** - нужно проверить и доработать

**Файлы для изменения:**
- `src/lib/services/telegram.ts` (метод `formatPublicOrderMessage`)

**Текущее состояние:**
- Логика условного отображения уже добавлена в `telegram.ts` (строки ~450-490)
- Используется проверка `isMarketPrice === true`
- Показывается "(market)" только при активной галке

**Требования:**
1. Проверить, что логика работает корректно
2. Убедиться, что "(market)" показывается только если `isMarketPrice === true`
3. Формат: "Price CC: $0.4400 (market)" или "Price CC: $0.4400"

**Проверка текущей реализации:**
```bash
# 1. Проверь наличие логики
grep -n "isMarketPrice.*market\|market.*isMarketPrice" src/lib/services/telegram.ts

# 2. Проверь условное форматирование
grep -A 5 -B 5 "priceDisplay\|market" src/lib/services/telegram.ts

# 3. Проверь линтер
read_lints paths=['src/lib/services/telegram.ts']
```

**Что нужно проверить:**
- [ ] Логика `isMarketPrice` работает корректно
- [ ] "(market)" показывается только при `isMarketPrice === true`
- [ ] Без галки пометка отсутствует
- [ ] Формат цены корректный

**Если нужно доработать:**
- Убедись, что проверка `isMarketPrice` выполняется правильно
- Убедись, что формат соответствует требованиям
- Проверь, что нет лишних пробелов или символов

**Критерии успеха:**
- ✅ "(market)" показывается только при активной галке
- ✅ Без галки пометка отсутствует
- ✅ Формат корректный: "Price CC: $0.4400 (market)" или "Price CC: $0.4400"
- ✅ Нет ошибок линтера

---

## 📐 ПАТТЕРНЫ И КОНВЕНЦИИ ПРОЕКТА

### Стилизация компонентов

**Существующие паттерны:**
```tsx
// Блок с glass-эффектом
<motion.div
  className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.3 }}
>
  {/* Контент */}
</motion.div>

// Заголовок блока
<h3 className="text-lg font-bold text-white mb-4">Title</h3>

// Текст с градиентом
<span className="text-cyan-300 font-semibold">Text</span>

// Кнопка
<Button
  onClick={handleClick}
  className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold px-8 py-4 rounded-xl"
>
  Button Text
</Button>
```

### State управление

**Паттерны:**
```typescript
// Простой state
const [value, setValue] = useState<string>('')

// State с типом
const [isActive, setIsActive] = useState<boolean>(false)

// useCallback для функций
const handleChange = useCallback((newValue: string) => {
  setValue(newValue)
  // Логика
}, [dependencies])

// useEffect для side effects
useEffect(() => {
  // Логика
  return () => {
    // Cleanup
  }
}, [dependencies])
```

### Форматирование

**Используемые функции:**
```typescript
import { formatCurrency, formatNumber } from '@/lib/utils'

// Форматирование валюты
formatCurrency(1234.56, 2) // "1,234.56"

// Форматирование чисел
formatNumber(1234.56) // "1,234.56"
```

---

## 🚨 ТИПИЧНЫЕ ОШИБКИ И КАК ИХ ИЗБЕЖАТЬ

### 1. Конфликты className

**Проблема:** Одновременное использование `block` и `flex` в className
```tsx
// ❌ НЕПРАВИЛЬНО
<label className="block flex items-center gap-2">

// ✅ ПРАВИЛЬНО
<label className="flex items-center gap-2">
```

**Решение:** Используй только один display тип. Если нужен flex, убирай block.

### 2. Неправильные зависимости в hooks

**Проблема:** Забытые зависимости в useCallback/useEffect
```typescript
// ❌ НЕПРАВИЛЬНО
useEffect(() => {
  setValue(price)
}, []) // price не в зависимостях

// ✅ ПРАВИЛЬНО
useEffect(() => {
  setValue(price)
}, [price])
```

**Решение:** Всегда добавляй все используемые переменные в зависимости.

### 3. Неправильная типизация

**Проблема:** Использование `any` или отсутствие типов
```typescript
// ❌ НЕПРАВИЛЬНО
const value: any = orderData.someField

// ✅ ПРАВИЛЬНО
const value: number = orderData.paymentAmount
```

**Решение:** Всегда используй правильные типы из интерфейсов.

### 4. Неправильное форматирование чисел

**Проблема:** Прямое использование чисел без форматирования
```typescript
// ❌ НЕПРАВИЛЬНО
<span>{amount} USD</span>

// ✅ ПРАВИЛЬНО
<span>{formatCurrency(amount)} USD</span>
```

**Решение:** Всегда используй функции форматирования.

---

## ✅ ДЕТАЛЬНЫЙ ЧЕКЛИСТ ДЛЯ КАЖДОГО ТРЕБОВАНИЯ

### Перед началом работы над требованием:

- [ ] Прочитал существующий код файлов, которые буду изменять
- [ ] Понял структуру и паттерны проекта
- [ ] Проверил текущее состояние через `read_lints`
- [ ] Исправил все существующие предупреждения

### Во время реализации:

- [ ] Следую существующим паттернам
- [ ] Использую правильные типы TypeScript
- [ ] Не создаю дублирование кода
- [ ] Проверяю каждое изменение через `read_lints`
- [ ] Коммичу атомарно (одно требование = один коммит)

### После реализации требования:

- [ ] Код компилируется без ошибок TypeScript
- [ ] Нет ошибок линтера (`read_lints` показывает 0 ошибок)
- [ ] Все импорты корректны и используются
- [ ] Нет неиспользуемых переменных или функций
- [ ] Стили соответствуют существующему дизайну
- [ ] Изменения не сломали существующий функционал
- [ ] Обратная совместимость сохранена

### Финальная проверка перед завершением:

- [ ] Все 8 требований реализованы
- [ ] Все требования протестированы
- [ ] Нет ошибок компиляции
- [ ] Нет предупреждений линтера
- [ ] Код соответствует best practices проекта

---

## 🚀 ПОРЯДОК РЕАЛИЗАЦИИ ОСТАВШИХСЯ ТРЕБОВАНИЙ

**Текущий статус:**
1. ✅ REQ-001 - Выполнено
2. ✅ REQ-002 - Выполнено
3. ✅ REQ-003 - Уже было реализовано (приватная сделка)
4. ✅ REQ-004 - Выполнено
5. ✅ REQ-005 - Выполнено
6. 🟡 REQ-006 - Начато, нужно завершить
7. ❌ REQ-007 - Нужно реализовать
8. 🟡 REQ-008 - Частично выполнено, нужно проверить

**Рекомендуемый порядок:**

1. **Заверши REQ-006** (детальная калькуляция)
   - Прочитай текущий код `OrderSummary.tsx`
   - Добавь блок с расчетами
   - Проверь математику
   - Проверь линтер

2. **Реализуй REQ-007** (упрощение Telegram текста)
   - Прочитай текущий код `formatPublicOrderMessage`
   - Переведи на английский
   - Убери лишние эмодзи и поля
   - Проверь формат

3. **Проверь и доработай REQ-008** (условное "(market)")
   - Проверь текущую реализацию
   - Убедись, что логика работает корректно
   - Протестируй с галкой и без

**Важно:** Реализуй требования последовательно, проверяя каждое перед переходом к следующему.

---

## 📚 СПРАВОЧНАЯ ИНФОРМАЦИЯ

### Тип OTCOrder (актуальный)

```typescript
export interface OTCOrder {
  orderId: string;
  timestamp: number;
  paymentToken: TokenConfig;
  paymentAmount: number;
  paymentAmountUSD: number;
  cantonAmount: number;
  cantonAddress: string;
  receivingAddress?: string;
  refundAddress?: string;
  email: string;
  whatsapp?: string;
  telegram?: string;
  status: OrderStatus;
  exchangeDirection?: 'buy' | 'sell';
  manualPrice?: number;
  serviceCommission?: number;
  isPrivateDeal?: boolean;
  isMarketPrice?: boolean; // ✅ REQ-002: Добавлено
  usdtAmount?: number;
}
```

### Существующие функции форматирования

```typescript
// Из @/lib/utils
formatCurrency(value: number, decimals?: number): string
formatNumber(value: number): string
copyToClipboard(text: string, label: string): Promise<void>
generateOrderId(): string
```

### Существующие компоненты UI

```typescript
// Из @/components/ui/
<Button variant="default" | "secondary" | "ghost" | "outline" />
<Input type="number" | "text" disabled={boolean} required={boolean} />

// Из lucide-react
import { ShoppingCart, TrendingDown, Sparkles, LinkIcon, Copy, ... } from 'lucide-react'

// Framer Motion
import { motion, AnimatePresence } from 'framer-motion'
```

### Конфигурация

```typescript
// Из @/config/otc
OTC_CONFIG.SUPPORTED_TOKENS // Массив токенов
OTC_CONFIG.PROCESSING_STEPS // Шаги обработки
OTC_CONFIG.SUPPORT_EMAIL // Email поддержки
```

---

## 🎯 КРИТЕРИИ КАЧЕСТВА КОДА

### Обязательные требования:

1. **TypeScript:**
   - ✅ Строгая типизация (no `any`)
   - ✅ Все интерфейсы определены
   - ✅ Нет ошибок компиляции

2. **Линтер:**
   - ✅ 0 ошибок
   - ✅ 0 предупреждений
   - ✅ Все правила ESLint соблюдены

3. **Архитектура:**
   - ✅ Нет дублирования кода
   - ✅ Следует существующим паттернам
   - ✅ Обратная совместимость сохранена

4. **Стили:**
   - ✅ Используются существующие классы Tailwind
   - ✅ Нет конфликтов в className
   - ✅ Соответствует дизайну проекта

5. **Функциональность:**
   - ✅ Все требования реализованы
   - ✅ Работает корректно
   - ✅ Нет регрессий

---

## 📝 ИНСТРУКЦИИ ПО ТЕСТИРОВАНИЮ

После реализации каждого требования:

1. **Проверь компиляцию:**
   ```bash
   npx tsc --noEmit
   ```

2. **Проверь линтер:**
   ```bash
   read_lints paths=['путь/к/измененным/файлам']
   ```

3. **Проверь визуально (если возможно):**
   - Открой приложение в браузере
   - Проверь отображение изменений
   - Проверь интерактивность

4. **Проверь функциональность:**
   - Создай тестовый ордер
   - Проверь все сценарии использования
   - Убедись, что ничего не сломалось

---

## 🔄 ПРОЦЕСС РАБОТЫ

### Шаг 1: Подготовка
1. Прочитай этот промпт полностью
2. Проверь текущий статус выполнения
3. Выполни обязательную проверку перед началом

### Шаг 2: Реализация
1. Выбери требование для реализации
2. Прочитай существующий код
3. Реализуй требование
4. Проверь линтер
5. Исправь все предупреждения

### Шаг 3: Проверка
1. Проверь компиляцию
2. Проверь линтер
3. Проверь функциональность
4. Обнови статус в TODO

### Шаг 4: Переход к следующему
1. Убедись, что текущее требование полностью выполнено
2. Переходи к следующему требованию
3. Повторяй процесс

---

## ⚠️ ВАЖНЫЕ ЗАМЕЧАНИЯ

1. **Не пропускай проверки** - каждая проверка критична
2. **Не оставляй предупреждения** - исправляй сразу
3. **Не ломай существующий функционал** - тестируй изменения
4. **Не создавай дублирование** - используй существующие паттерны
5. **Не забывай про типы** - TypeScript должен быть строгим

---

## 📊 ПРОГРЕСС ВЫПОЛНЕНИЯ

**Общий прогресс: 62.5% (5 из 8 требований)**

- ✅ REQ-001: Изменение порядка блоков - **100%**
- ✅ REQ-002: Make a deal at market price - **100%**
- ✅ REQ-003: Приватная сделка - **100%** (уже было)
- ✅ REQ-004: Удаление таймера - **100%**
- ✅ REQ-005: Шеринг ссылки - **100%**
- 🟡 REQ-006: Детальная калькуляция - **50%** (начато)
- ❌ REQ-007: Упрощение Telegram - **0%**
- 🟡 REQ-008: Условное "(market)" - **80%** (нужно проверить)

---

**Удачи в реализации! 🎯**

**Помни:** Качество важнее скорости. Лучше сделать медленно, но правильно, чем быстро, но с ошибками.
