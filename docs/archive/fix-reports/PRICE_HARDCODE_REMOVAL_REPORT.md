# 🔧 Отчет об удалении хардкод значений цен

## 🎯 Проблема
Пользователь сообщил что цена после изменения сбивается на стандартное значение, которое не нужно.

## 🔍 Найденные проблемы

### 1. Хардкод значения в коде
В разных местах кода были захардкожены дефолтные значения цен:
- `0.21` для buy price
- `0.18` для sell price  
- `0.20` для средней цены

### 2. Места с хардкод значениями
1. **src/config/otc.ts** - главный конфиг с fallback значениями
2. **src/lib/config-manager.ts** - менеджер конфигурации с дефолтами
3. **src/app/api/config/route.ts** - API эндпоинт с fallback
4. **src/components/ConfigProvider.tsx** - провайдер с fallback на OTC_CONFIG
5. **src/app/api/admin/settings/route.ts** - админский API с OTC_CONFIG

## ✅ Внесенные изменения

### 1. src/config/otc.ts
```typescript
// БЫЛО
export const getCantonCoinBuyPrice = (): number => {
  return parseFloat(process.env.CANTON_COIN_BUY_PRICE_USD || '0.21');
};

// СТАЛО
export const getCantonCoinBuyPrice = (): number => {
  const price = process.env.CANTON_COIN_BUY_PRICE_USD;
  if (!price) {
    console.error('CANTON_COIN_BUY_PRICE_USD not set!');
    throw new Error('CANTON_COIN_BUY_PRICE_USD not configured');
  }
  return parseFloat(price);
};
```

### 2. src/lib/config-manager.ts
- Заменены все хардкод значения `0.21` и `0.18` на `0`
- Теперь используются только значения из ConfigMap или ENV

### 3. src/app/api/config/route.ts
- Убраны все fallback на `0.21` и `0.18`
- Заменены на `0` как индикатор отсутствия конфигурации

### 4. src/components/ConfigProvider.tsx
```typescript
// БЫЛО
cantonCoinBuyPrice: currentConfig?.cantonCoinBuyPrice ?? OTC_CONFIG.CANTON_COIN_BUY_PRICE_USD,

// СТАЛО  
cantonCoinBuyPrice: currentConfig?.cantonCoinBuyPrice ?? 0,
```

### 5. src/app/api/admin/settings/route.ts
- Убран fallback на OTC_CONFIG
- Добавлена минимальная конфигурация без цен
- Исправлена проверка больших изменений цен

## 🚀 Результат

1. **Нет больше хардкод значений** - все цены берутся только из ConfigMap или переменных окружения
2. **Цены не сбрасываются** - нет fallback на дефолтные значения
3. **Явные ошибки** - если цены не настроены, будет ошибка, а не тихий fallback
4. **Безопасные значения** - где нужно возвращается 0 вместо хардкод цен

## 📝 Рекомендации

1. Убедитесь что в ConfigMap всегда есть актуальные цены:
```yaml
CANTON_COIN_BUY_PRICE_USD: "0.25"
CANTON_COIN_SELL_PRICE_USD: "0.18"
```

2. При деплое проверяйте что переменные окружения установлены

3. Мониторьте логи на предмет ошибок связанных с отсутствующими ценами

## ⚠️ Важно
Теперь система не будет работать без явно установленных цен в конфигурации. Это сделано намеренно чтобы избежать случайного использования неправильных цен.
