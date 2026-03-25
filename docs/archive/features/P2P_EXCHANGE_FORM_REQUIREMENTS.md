# 🔧 P2P Exchange Form Requirements - Implementation Prompt

**Дата:** 8 декабря 2025  
**Проект:** Canton OTC Exchange  
**Приоритет:** КРИТИЧЕСКИЙ

---

## 📋 ЗАДАЧА

Переработать форму обмена для P2P торговли. Текущая система ориентирована на OTC с автоматическим расчетом цен - нужно перейти к модели где пользователь **всегда** указывает цену вручную.

---

## 🎯 ТРЕБОВАНИЯ

### 1. УБРАТЬ ЖЕСТКОЕ ОГРАНИЧЕНИЕ ±10% НА ЦЕНУ

**Текущее поведение:**
- Валидация блокирует цены вне диапазона ±10% от рыночной
- Показывает ошибку "Price too high (max +10% from market)"

**Нужное поведение:**
- Ограничение ±10% должно быть **рекомендательным**, не блокирующим
- Пользователь может ввести **любую** цену
- Показывать **предупреждение** (не ошибку) если цена вне рекомендуемого диапазона
- Рыночная цена только справочно

**Файлы для изменения:**
- `src/components/ExchangeForm.tsx` - строки 153-161, функция `validateCustomPrice`
- `src/components/ExchangeFormCompact.tsx` - строки 185-193, функция `validateCustomPrice`

**Текущий код:**
```typescript
const validateCustomPrice = (price: number, marketPrice: number): {valid: boolean, error?: string} => {
  if (price < marketPrice * 0.9) {
    return {valid: false, error: 'Price too low (min -10% from market)'};
  }
  if (price > marketPrice * 1.1) {
    return {valid: false, error: 'Price too high (max +10% from market)'};
  }
  return {valid: true};
}
```

**Новый код:**
```typescript
const validateCustomPrice = (price: number, marketPrice: number): {valid: boolean, warning?: string} => {
  if (price <= 0) {
    return {valid: false, warning: 'Price must be greater than 0'};
  }
  // Рекомендательное предупреждение, не блокирующее
  if (price < marketPrice * 0.9) {
    return {valid: true, warning: `Price is ${((1 - price/marketPrice) * 100).toFixed(0)}% below market`};
  }
  if (price > marketPrice * 1.1) {
    return {valid: true, warning: `Price is ${((price/marketPrice - 1) * 100).toFixed(0)}% above market`};
  }
  return {valid: true};
}
```

---

### 2. ЦЕНА ВСЕГДА ВВОДИТСЯ ВРУЧНУЮ

**Текущее поведение:**
- По умолчанию используется рыночная цена
- Чекбокс "Suggest your price" для ручного ввода

**Нужное поведение:**
- Чекбокс "Suggest your price" **всегда включен** (или убрать чекбокс)
- Поле ввода цены **обязательное**
- Рыночная цена показывается только как **справочная информация**
- Пользователь **не может** создать заявку без указания своей цены

**Изменения в UI:**
1. Убрать чекбокс `isManualPrice`
2. Поле цены всегда видимо и обязательно
3. Убрать `min`/`max` атрибуты из input
4. Изменить label с "Custom Price (±10% from market)" на "Your Price"

**Текущий код (ExchangeForm.tsx, строки 531-573):**
```tsx
{/* Manual Price Input */}
<motion.div>
  <div className="flex items-center gap-3 mb-4">
    <input
      type="checkbox"
      id="manualPriceInput"
      checked={isManualPrice}
      onChange={(e) => {...}}
    />
    <label htmlFor="manualPriceInput">
      Suggest your price
    </label>
  </div>

  {isManualPrice && (
    <div className="mt-4">
      <label>Custom Price (±10% from market)</label>
      <Input min={...} max={...} />
    </div>
  )}
</motion.div>
```

**Новый код:**
```tsx
{/* Your Price - ОБЯЗАТЕЛЬНОЕ ПОЛЕ */}
<motion.div>
  <label className="block text-sm text-white/80 mb-2">
    Your Price (per 1 CC)
  </label>
  <Input
    type="number"
    value={customPrice}
    onChange={handleCustomPriceChange}
    step="0.0001"
    className="text-lg font-bold"
    placeholder="Enter your price"
    required
  />
  <p className="text-xs text-white/60 mt-1">
    Market price: ${formatCurrency(exchangeDirection === 'buy' ? buyPrice : sellPrice, 4)} (reference only)
  </p>
  {priceWarning && (
    <p className="text-xs text-yellow-400 mt-1">
      ⚠️ {priceWarning}
    </p>
  )}
</motion.div>
```

---

### 3. ДОБАВИТЬ ЧЕКБОКС "PRIVATE DEAL"

**Функционал:**
- Если включен - заявка **НЕ публикуется** в общий стакан (Telegram группу клиентов)
- Заявка доступна **только по прямой ссылке**
- Приватная P2P сделка между двумя конкретными сторонами

**UI компонент:**
```tsx
{/* Private Deal Checkbox */}
<motion.div className="flex items-center gap-3 mt-4">
  <input
    type="checkbox"
    id="privateDeal"
    checked={isPrivateDeal}
    onChange={(e) => setIsPrivateDeal(e.target.checked)}
    className="w-5 h-5 rounded border-2 border-white/30 bg-white/10 checked:bg-violet-500 checked:border-violet-500"
  />
  <label htmlFor="privateDeal" className="text-white font-medium cursor-pointer flex items-center gap-2">
    🔒 Private deal (available only by link)
  </label>
</motion.div>
{isPrivateDeal && (
  <p className="text-xs text-white/60 mt-2 ml-8">
    This order will not be published to the public order book.
    You can share the link directly with your counterparty.
  </p>
)}
```

**Передача в API:**
```typescript
onProceed({
  // ... existing fields
  isPrivateDeal: isPrivateDeal, // NEW FIELD
})
```

**Backend изменения (src/app/api/create-order/route.ts):**
- Добавить `isPrivateDeal` в `OTCOrder` type
- Если `isPrivateDeal === true`, **НЕ вызывать** `telegramService.sendPublicOrderNotification()`
- Сохранить `is_private` в `public_orders` таблицу

---

### 4. УБРАТЬ БОНУСНУЮ ЛЕСТНИЦУ (VOLUME DISCOUNT TIERS)

**Что убрать:**
- Компонент `DiscountTierBadge` из формы
- Секцию с тирами: Standard, Bronze, Silver, Gold
- Текст "Next tier: Bronze", "$5,000 needed"
- Текст "Add $X more for +X% discount"
- Применение `tier.discount` в расчетах

**Файлы:**
1. `src/components/ExchangeForm.tsx`:
   - Удалить import `DiscountTierBadge`
   - Удалить import `getDiscountTier` 
   - Удалить JSX `<DiscountTierBadge ... />`
   - Убрать логику `tier.discount` из расчетов

2. `src/components/ExchangeFormCompact.tsx`:
   - Аналогичные изменения

3. `src/components/DiscountTierBadge.tsx`:
   - Можно оставить файл (для будущего), но не использовать

**Упрощенный расчет (без скидок):**
```typescript
// BUY: USDT → Canton
const baseAmount = usdValue / currentPrice
const canton = baseAmount * (1 - serviceCommission / 100)

// SELL: Canton → USDT  
const baseUsdValue = amountValue * currentPrice
const usdValue = baseUsdValue * (1 - serviceCommission / 100)
```

---

## 📁 ФАЙЛЫ ДЛЯ ИЗМЕНЕНИЯ

| Файл | Изменения |
|------|-----------|
| `src/components/ExchangeForm.tsx` | Убрать валидацию ±10%, сделать цену обязательной, добавить Private deal, убрать DiscountTierBadge |
| `src/components/ExchangeFormCompact.tsx` | Аналогичные изменения |
| `src/app/api/create-order/route.ts` | Добавить `isPrivateDeal`, условная публикация |
| `src/config/otc.ts` | Добавить `isPrivateDeal` в `OTCOrder` type |
| `supabase/migrations/004_add_is_private.sql` | Добавить колонку `is_private` |

---

## 🔄 ПОРЯДОК ВЫПОЛНЕНИЯ

1. **Обновить тип `OTCOrder`** в `src/config/otc.ts`:
   ```typescript
   isPrivateDeal?: boolean;
   ```

2. **Обновить ExchangeForm.tsx и ExchangeFormCompact.tsx:**
   - Добавить state `const [isPrivateDeal, setIsPrivateDeal] = useState(false)`
   - Убрать state `isManualPrice` (цена всегда вручную)
   - Изменить `validateCustomPrice` на не-блокирующую
   - Добавить UI для Private deal
   - Убрать `<DiscountTierBadge />`
   - Упростить расчеты (без `tier.discount`)

3. **Обновить API route** `src/app/api/create-order/route.ts`:
   - Принимать `isPrivateDeal`
   - Условно вызывать `sendPublicOrderNotification`

4. **Создать миграцию** `supabase/migrations/004_add_is_private.sql`:
   ```sql
   ALTER TABLE public_orders ADD COLUMN is_private BOOLEAN DEFAULT FALSE;
   ```

5. **Тестирование:**
   - Создать публичную заявку → проверить что идет в Telegram
   - Создать приватную заявку → проверить что НЕ идет в Telegram
   - Проверить что цена обязательна
   - Проверить что предупреждение показывается, но не блокирует

---

## ⚠️ ВАЖНО

- **НЕ ломать** существующую логику создания ордеров
- **НЕ удалять** поддержку API для старых клиентов (backward compatible)
- Комиссия сервиса (`serviceCommission`) остается
- Логика BUY/SELL остается
- Интеграции (Google Sheets, Intercom, Telegram операторов) остаются

---

## 🧪 КРИТЕРИИ ПРИЕМКИ

- [ ] Цена всегда вводится вручную, поле обязательное
- [ ] Валидация ±10% показывает предупреждение, не блокирует
- [ ] Private deal чекбокс работает
- [ ] Приватные заявки НЕ публикуются в Telegram группу клиентов
- [ ] Бонусная лестница убрана из UI
- [ ] Расчеты работают без discount tiers
- [ ] Существующие заявки продолжают работать

