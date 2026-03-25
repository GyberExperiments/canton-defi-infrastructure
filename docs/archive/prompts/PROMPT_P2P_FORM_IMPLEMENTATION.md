# 🚀 ПРОМТ: Реализация P2P Exchange Form

**Копируй этот промт целиком в новый чат**

---

## ЗАДАЧА

Реализовать изменения в форме обмена Canton OTC для P2P торговли. 

**ОБЯЗАТЕЛЬНО ПРОЧИТАЙ ФАЙЛ:** `P2P_EXCHANGE_FORM_REQUIREMENTS.md` - там полная спецификация с кодом.

---

## КОНТЕКСТ

- **Проект:** Canton OTC Exchange
- **URL:** https://1otc.cc
- **Репозиторий:** `/Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc`
- **Stack:** Next.js 15, TypeScript, Tailwind, Framer Motion

---

## ТРЕБОВАНИЯ (КРАТКОЕ)

### 1. Убрать жесткое ограничение ±10% на цену
- Функция `validateCustomPrice` должна возвращать `warning`, не `error`
- Цена вне диапазона НЕ блокирует создание заявки
- Показывать предупреждение желтым цветом

### 2. Цена всегда вводится вручную
- Убрать чекбокс "Suggest your price" - поле цены всегда видно
- Поле цены **обязательное** для создания заявки
- Рыночная цена только справочно

### 3. Добавить чекбокс "Private deal (available only by link)"
- Если включен - заявка НЕ публикуется в Telegram группу клиентов
- Заявка доступна только по прямой ссылке
- Добавить `isPrivateDeal` в тип ордера и API

### 4. Убрать бонусную лестницу (Volume Discount Tiers)
- Удалить компонент `<DiscountTierBadge />`
- Убрать `tier.discount` из расчетов
- Убрать тиры Standard/Bronze/Silver/Gold из UI

---

## ФАЙЛЫ ДЛЯ ИЗМЕНЕНИЯ

1. `src/components/ExchangeForm.tsx` - основная форма
2. `src/components/ExchangeFormCompact.tsx` - компактная форма
3. `src/app/api/create-order/route.ts` - API создания ордера
4. `src/config/otc.ts` - тип OTCOrder

---

## ПОРЯДОК ДЕЙСТВИЙ

1. **Прочитай** `P2P_EXCHANGE_FORM_REQUIREMENTS.md`
2. **Обнови** тип `OTCOrder` - добавь `isPrivateDeal?: boolean`
3. **Измени** `ExchangeForm.tsx`:
   - Убери `isManualPrice` state
   - Сделай поле цены обязательным и всегда видимым
   - Добавь state `isPrivateDeal` и UI чекбокс
   - Убери `<DiscountTierBadge />`
   - Упрости расчеты (без discount)
4. **Измени** `ExchangeFormCompact.tsx` - аналогично
5. **Измени** `create-order/route.ts`:
   - Добавь `isPrivateDeal` в обработку
   - Условно вызывай `sendPublicOrderNotification`
6. **Создай** SQL миграцию для `is_private` колонки
7. **Протестируй** все сценарии

---

## КРИТИЧЕСКИ ВАЖНО

- ⚠️ НЕ ломать существующую логику
- ⚠️ Сохранить backward compatibility
- ⚠️ Комиссия сервиса остается
- ⚠️ Интеграции (Sheets, Intercom, Telegram операторов) остаются
- ⚠️ Коммитить изменения с понятными сообщениями

---

## НАЧНИ С

```bash
# Прочитай спецификацию
cat P2P_EXCHANGE_FORM_REQUIREMENTS.md

# Прочитай текущие файлы
cat src/components/ExchangeForm.tsx
cat src/components/ExchangeFormCompact.tsx
cat src/config/otc.ts
```

---

**ВЫПОЛНЯЙ ВСЕ ИЗМЕНЕНИЯ В БОЕВОМ РЕЖИМЕ. КОММИТЬ ПОСЛЕ КАЖДОГО ЛОГИЧЕСКОГО БЛОКА.**

