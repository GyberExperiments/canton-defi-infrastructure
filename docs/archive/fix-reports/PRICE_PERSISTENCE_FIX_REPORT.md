# 🔧 Отчет об исправлении проблемы с сохранением цен

**Дата:** 23 октября 2025  
**Ветка:** minimal-stage  
**Проблема:** Цены возвращались к старым дефолтным значениям после изменения в админке

---

## 🐛 Выявленные проблемы

### 1. **API `/admin/settings` возвращал статические значения**
- **Файл:** `src/app/api/admin/settings/route.ts`
- **Проблема:** Метод GET читал цены из статического `OTC_CONFIG` вместо актуального ConfigMap
- **Результат:** Админка всегда показывала старые цены из кода

### 2. **Хардкод дефолтных цен в ConfigManager**
- **Файл:** `src/lib/config-manager.ts`
- **Проблема:** При отсутствии значений в ConfigMap использовались хардкод значения `0.21` и `0.18`
- **Результат:** Цены откатывались к дефолтным при любом сбое

### 3. **Неправильная работа Fallback в ConfigProvider**
- **Файл:** `src/components/ConfigProvider.tsx`
- **Проблема:** Использование оператора `||` вместо `??` приводило к замене `0` на дефолтные значения
- **Результат:** Fallback перезаписывал актуальные значения

---

## ✅ Внедренные исправления

### 1. API `/admin/settings` - Чтение из ConfigManager

**До:**
```typescript
export async function GET() {
  return NextResponse.json({
    cantonCoinBuyPrice: OTC_CONFIG.CANTON_COIN_BUY_PRICE_USD,
    cantonCoinSellPrice: OTC_CONFIG.CANTON_COIN_SELL_PRICE_USD,
    // ...
  });
}
```

**После:**
```typescript
export async function GET() {
  // ✅ Обновляем конфигурацию перед чтением
  await configManager.refreshConfig();
  const currentConfig = configManager.getConfig();
  
  return NextResponse.json({
    cantonCoinBuyPrice: currentConfig.cantonCoinBuyPrice,
    cantonCoinSellPrice: currentConfig.cantonCoinSellPrice,
    _source: currentConfig.version,
    _lastUpdate: currentConfig.lastUpdate
  });
}
```

### 2. ConfigManager - Приоритет ConfigMap над хардкодом

**До:**
```typescript
const cantonCoinBuyPrice = parseFloat(configMapData.CANTON_COIN_BUY_PRICE_USD || '0.21');
```

**После:**
```typescript
const cantonCoinBuyPrice = parseFloat(
  configMapData.CANTON_COIN_BUY_PRICE_USD || 
  process.env.CANTON_COIN_BUY_PRICE_USD || 
  '0.21'  // Хардкод только в крайнем случае
);
```

### 3. ConfigProvider - Правильное использование Fallback

**До:**
```typescript
cantonCoinBuyPrice: currentConfig?.cantonCoinBuyPrice || OTC_CONFIG.CANTON_COIN_BUY_PRICE_USD
```

**После:**
```typescript
cantonCoinBuyPrice: currentConfig?.cantonCoinBuyPrice ?? OTC_CONFIG.CANTON_COIN_BUY_PRICE_USD
// Использование ?? вместо || для правильной обработки 0
```

**Дополнительно:**
```typescript
else if (config) {
  // ✅ Очищаем fallback когда есть актуальный config
  setFallbackConfig(null);
}
```

---

## 🔍 Цепочка загрузки конфигурации

### Приоритет источников (от высшего к низшему):

1. **Kubernetes ConfigMap** ← Основной источник истины
2. **Environment Variables (process.env)** ← Fallback #1
3. **OTC_CONFIG (статический код)** ← Fallback #2 (только для development)

### Поток данных:

```
ConfigMap → ConfigManager → ConfigProvider → useCantonPrices() → UI компоненты
     ↓                                              ↓
   Админка                                     Цены в форме обмена
```

---

## 🎯 Результат

### ✅ Что работает теперь:

1. **Изменение цен в админке**
   - Цены сохраняются в ConfigMap
   - Мгновенно применяются на всей платформе
   - Сохраняются после перезапуска

2. **Приоритет источников**
   - ConfigMap имеет наивысший приоритет
   - Fallback срабатывает только при недоступности ConfigMap
   - Хардкод используется только в крайнем случае

3. **Отладка и мониторинг**
   - Логирование источника данных (`_source`, `_lastUpdate`)
   - Предупреждения при использовании fallback
   - Аудит изменений в админке

---

## 🧪 Как проверить

### 1. Изменение цен через админку:
```bash
# 1. Откройте админку
open http://localhost:3000/admin/settings

# 2. Измените цены (например, Buy: 0.30, Sell: 0.25)
# 3. Нажмите "Save Changes"
# 4. Проверьте главную страницу - цены должны обновиться
```

### 2. Проверка персистентности:
```bash
# 1. Измените цены в админке
# 2. Перезапустите приложение
pnpm dev

# 3. Проверьте - цены должны остаться измененными
```

### 3. Проверка ConfigMap (в Kubernetes):
```bash
kubectl get configmap canton-otc-config -o yaml

# Должны быть видны актуальные значения:
# CANTON_COIN_BUY_PRICE_USD: "0.30"
# CANTON_COIN_SELL_PRICE_USD: "0.25"
```

---

## 📊 Технические детали

### Измененные файлы:

1. **src/app/api/admin/settings/route.ts**
   - Метод GET теперь читает из ConfigManager
   - Добавлены поля `_source` и `_lastUpdate` для отладки

2. **src/lib/config-manager.ts**
   - Приоритет ConfigMap над хардкодом
   - Улучшенное логирование

3. **src/components/ConfigProvider.tsx**
   - Использование оператора `??` вместо `||`
   - Очистка fallback при наличии актуальной конфигурации

### Совместимость:

- ✅ Обратная совместимость с OTC_CONFIG
- ✅ Работает в development без Kubernetes
- ✅ Работает в production с ConfigMap
- ✅ Graceful degradation при недоступности ConfigMap

---

## 🚀 Best Practices реализованные в решении

1. **Single Source of Truth**
   - ConfigMap как единственный источник истины в production
   - Четкая иерархия fallback-ов

2. **Separation of Concerns**
   - Разделение логики чтения и записи конфигурации
   - API не смешивает статические и динамические данные

3. **Graceful Degradation**
   - Приложение работает даже при недоступности ConfigMap
   - Логирование и предупреждения о fallback

4. **Type Safety**
   - Полная типизация ConfigData
   - TypeScript проверяет корректность данных

5. **Monitoring & Debugging**
   - Логирование источника данных
   - Аудит всех изменений
   - Метаданные версии и времени обновления

---

## 📝 Следующие шаги

Для дальнейшего улучшения системы конфигурации:

1. [ ] Добавить валидацию диапазонов цен (min/max)
2. [ ] Реализовать версионирование конфигурации
3. [ ] Добавить rollback механизм для отката изменений
4. [ ] Настроить webhook для уведомлений об изменениях цен
5. [ ] Добавить A/B тестирование цен

---

**Статус:** ✅ **РЕШЕНО**  
**Приоритет:** 🔴 **КРИТИЧЕСКИЙ**  
**Время решения:** ~30 минут

