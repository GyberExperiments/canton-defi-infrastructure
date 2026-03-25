# 💎 План миграции Discount Tiers на динамическую систему

**Дата:** 27 октября 2025  
**Статус:** 📋 ПЛАН РАЗРАБОТАН

---

## 🎯 Цель

Сделать систему скидок **динамической** через ConfigMap, как уже реализовано с ценами и лимитами.

---

## 📊 Текущая реализация (хардкод)

```typescript
// src/config/otc.ts - СТАТИЧНЫЙ массив
export const DISCOUNT_TIERS = [
  { minAmount: 0,     maxAmount: 5000,   discount: 0,     label: 'Standard' },
  { minAmount: 5000,  maxAmount: 25000,  discount: 0.005, label: 'Bronze' },
  { minAmount: 25000, maxAmount: 50000,  discount: 0.01,  label: 'Silver' },
  { minAmount: 50000, maxAmount: ∞,      discount: 0.015, label: 'Gold' }
];
```

**Проблемы:**
- ❌ Хардкод значений
- ❌ Невозможно изменить через админку
- ❌ Требует rebuild для изменений
- ❌ Не синхронизируется с ConfigMap

---

## ✅ Новая архитектура (динамическая)

### 1. ConfigMap переменные

```yaml
# config/kubernetes/k8s/configmap.yaml
data:
  # Existing...
  CANTON_COIN_BUY_PRICE_USD: "0.44"
  MIN_USDT_AMOUNT: "500"
  
  # NEW - Discount Tiers System
  DISCOUNT_TIER_1_MIN: "0"
  DISCOUNT_TIER_1_MAX: "5000"
  DISCOUNT_TIER_1_DISCOUNT: "0"
  DISCOUNT_TIER_1_LABEL: "Standard"
  
  DISCOUNT_TIER_2_MIN: "5000"
  DISCOUNT_TIER_2_MAX: "25000"
  DISCOUNT_TIER_2_DISCOUNT: "0.005"
  DISCOUNT_TIER_2_LABEL: "Bronze"
  
  DISCOUNT_TIER_3_MIN: "25000"
  DISCOUNT_TIER_3_MAX: "50000"
  DISCOUNT_TIER_3_DISCOUNT: "0.01"
  DISCOUNT_TIER_3_LABEL: "Silver"
  
  DISCOUNT_TIER_4_MIN: "50000"
  DISCOUNT_TIER_4_MAX: "999999999"
  DISCOUNT_TIER_4_DISCOUNT: "0.015"
  DISCOUNT_TIER_4_LABEL: "Gold"
```

### 2. ConfigData interface

```typescript
// src/lib/config-manager.ts
export interface ConfigData {
  // Existing...
  cantonCoinBuyPrice: number;
  minUsdtAmount: number;
  
  // NEW - Discount Tiers
  discountTiers: Array<{
    minAmount: number;
    maxAmount: number;
    discount: number;
    label: string;
  }>;
}
```

### 3. ConfigProvider hook

```typescript
// src/components/ConfigProvider.tsx
export function useDiscountTiers() {
  const { discountTiers } = useConfigContext();
  
  return {
    tiers: discountTiers || DEFAULT_DISCOUNT_TIERS,
    getTier: (usdAmount: number) => {
      return discountTiers?.find(
        tier => usdAmount >= tier.minAmount && usdAmount < tier.maxAmount
      ) || discountTiers?.[0];
    }
  };
}
```

### 4. Admin Settings UI

```tsx
// src/app/admin/settings/SettingsPageContent.tsx
<section>
  <h2>💎 Система скидок</h2>
  
  {editMode ? (
    <div>
      {/* Tier 1 - Standard */}
      <div>
        <input value={editValues.tier1Discount} />
        <input value={editValues.tier1Max} />
      </div>
      
      {/* Tier 2 - Bronze */}
      {/* ... */}
    </div>
  ) : (
    <div>
      {settings.discountTiers.map(tier => (
        <div key={tier.label}>
          {tier.label}: {tier.discount * 100}%
          (${tier.minAmount} - ${tier.maxAmount})
        </div>
      ))}
    </div>
  )}
</section>
```

---

## 🔄 Этапы миграции

### Этап 1: Backend (ConfigMap + API) ⏳
- [ ] Добавить discount tier переменные в ConfigMap
- [ ] Обновить ConfigManager для чтения tiers
- [ ] Обновить /api/config для возврата tiers
- [ ] Обновить /api/admin/settings для сохранения tiers

### Этап 2: Frontend (ConfigProvider) ⏳
- [ ] Расширить ConfigData interface
- [ ] Добавить useDiscountTiers() hook
- [ ] Создать fallback на DEFAULT_DISCOUNT_TIERS

### Этап 3: Components ⏳
- [ ] Обновить ExchangeFormCompact использовать useDiscountTiers()
- [ ] Обновить ExchangeForm использовать useDiscountTiers()
- [ ] Обновить Admin Settings показывать/редактировать tiers

### Этап 4: Testing ⏳
- [ ] Тест: изменение tiers через админку
- [ ] Тест: синхронизация с формой обмена
- [ ] Тест: правильный расчет бонусов

---

## 💡 Временное решение (QUICK FIX)

Пока полная миграция не готова, можно:

### Option 1: Отключить отображение (скрыть)
```tsx
// Закомментировать секцию в Settings:
{/* <DiscountTiersSection /> */}
```

### Option 2: Сделать read-only с правильными значениями
```typescript
// Обновить хардкод на актуальные значения:
export const DISCOUNT_TIERS = [
  { minAmount: 0,     maxAmount: 5000,   discount: 0,      label: 'Standard', description: '0%' },
  { minAmount: 5000,  maxAmount: 25000,  discount: 0.005,  label: 'Bronze',   description: '+0.5%' },
  { minAmount: 25000, maxAmount: 50000,  discount: 0.01,   label: 'Silver',   description: '+1%' },
  { minAmount: 50000, maxAmount: Infinity, discount: 0.02, label: 'Gold',     description: '+2%' }
];
```

---

## 🎯 Рекомендация

**Для текущего релиза:**
1. ✅ Убрать дефолтный выбор токена (сделано)
2. ✅ Обновить discount tiers на правильные значения (хардкод)
3. ⏳ Добавить пометку "(Скоро: редактируемые)" в Settings

**Для следующей версии:**
- Полная миграция discount tiers на ConfigMap систему
- Редактирование через админку
- Real-time обновление

---

**Оценка времени полной миграции:** ~2-3 часа  
**Приоритет:** СРЕДНИЙ (функционал работает, но не редактируется)  
**Зависимости:** ConfigMap система уже готова, можно использовать аналогично ценам

