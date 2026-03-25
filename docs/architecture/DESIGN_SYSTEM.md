# 🎨 Canton OTC - Централизованная система дизайна

**Version:** 2.0  
**Date:** 27 октября 2025  
**Status:** ✅ АКТИВНАЯ СИСТЕМА

---

## 🎯 Философия

Вместо исправления цветов по одному, мы используем **централизованную систему CSS переменных** определенную в `globals.css` и `tailwind.config.ts`.

### Принципы:
1. **Один источник истины** - все цвета в CSS переменных
2. **Semantic naming** - имена отражают назначение, не цвет
3. **Context-aware** - разные цвета для разных фонов
4. **Easy maintenance** - изменение в одном месте → применяется везде

---

## 🎨 Цветовая система

### Базовые переменные (globals.css)

```css
:root {
  /* ====== LIQUID PRISM COLOR PALETTE ====== */
  --liquid-violet: #6366F1;
  --liquid-blue: #1E40AF;
  --liquid-cyan: #0891B2;
  --liquid-teal: #0F766E;
  --liquid-emerald: #059669;
  
  /* Secondary Warmth */
  --warm-coral: #FF6B6B;
  --warm-amber: #F59E0B;
  --warm-peach: #FB923C;
  --warm-rose: #FB7185;
  
  /* Semantic Colors */
  --success: #10B981;
  --warning: #F59E0B;
  --error: #EF4444;
  --info: #3B82F6;
}
```

### Использование в Tailwind:

```tsx
// ✅ ПРАВИЛЬНО - используем переменные:
className="text-liquid-blue bg-warm-coral"

// ❌ НЕПРАВИЛЬНО - хардкод цветов:
className="text-[#6366F1] bg-[#FF6B6B]"
```

---

## 📝 Input система цветов

### Новая централизованная система (v2.0):

```css
/* globals.css */
:root {
  /* Цвета для светлых Input полей */
  --input-bg: rgba(255, 255, 255, 0.95);
  --input-text: #111827;         /* gray-900 - основной текст */
  --input-placeholder: #6B7280; /* gray-500 - placeholder */
  --input-suffix: #374151;       /* gray-700 - USDT, CC, $ */
  --input-border: #E5E7EB;       /* gray-200 - borders */
  --input-focus-border: #3B82F6; /* blue-500 - focus */
  
  /* Цвета для темных фонов (blue gradient) */
  --input-on-dark-text: #FFFFFF;
  --input-on-dark-placeholder: rgba(255, 255, 255, 0.6);
  --input-on-dark-suffix: rgba(255, 255, 255, 0.9);
}
```

### Использование:

```tsx
// На СВЕТЛОМ фоне (белый input):
<span className="text-input-suffix">USDT</span>   // ← gray-700 (видимо!)

// На ТЕМНОМ фоне (blue gradient):  
<span className="text-input-on-dark-suffix">CC</span>  // ← white/90 (видимо!)
```

---

## 🔧 Компоненты с Input системой

### ExchangeFormCompact.tsx

**Проблема (БЫЛО):**
```tsx
// Суффикс USDT на белом фоне:
<span className="text-white">{selectedToken.symbol}</span>
// ❌ Белый на белом = не видно!
```

**Решение (СТАЛО):**
```tsx
// Используем semantic color:
<span className="text-input-suffix">{selectedToken.symbol}</span>
// ✅ gray-700 на белом = отлично видно!
```

### ExchangeForm.tsx

Те же исправления применены для consistency.

---

## 📐 Типографика

### Fluid система (адаптивная):

```css
/* globals.css - responsive clamp() */
--text-xs: clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem);
--text-sm: clamp(0.875rem, 0.8rem + 0.375vw, 1rem);
--text-base: clamp(1rem, 0.9rem + 0.5vw, 1.125rem);
--text-lg: clamp(1.125rem, 1rem + 0.625vw, 1.25rem);
--text-xl: clamp(1.25rem, 1.1rem + 0.75vw, 1.5rem);
```

### Использование:

```tsx
// ✅ Адаптивные размеры:
className="text-fluid-lg md:text-fluid-xl"

// ✅ Фиксированные где нужно:
className="text-base sm:text-lg md:text-xl"
```

---

## 🎨 Градиенты

### Предопределенные градиенты:

```css
/* Ultra Modern 2025 */
--gradient-ocean: linear-gradient(135deg, #1E3A8A 0%, #1E40AF 50%, #0891B2 100%);
--gradient-twilight: linear-gradient(135deg, #6366F1 0%, #1E40AF 50%, #0891B2 100%);
--gradient-electric: linear-gradient(135deg, #3B82F6 0%, #0EA5E9 50%, #0891B2 100%);
--gradient-aurora: linear-gradient(135deg, #1E3A8A 0%, #0891B2 25%, #059669 50%, #0F766E 75%, #6366F1 100%);
```

### Применение:

```tsx
// Кнопки:
className="bg-gradient-twilight"

// Фоны:
className="bg-gradient-ocean"

// Text gradients:
className="bg-gradient-electric bg-clip-text text-transparent"
```

---

## 🌈 Glass эффекты

### Система depth layers:

```css
--depth-100: rgba(255, 255, 255, 0.02);
--depth-200: rgba(255, 255, 255, 0.05);
--depth-300: rgba(255, 255, 255, 0.08);
--depth-500: rgba(255, 255, 255, 0.12);
--depth-700: rgba(255, 255, 255, 0.18);
--depth-900: rgba(255, 255, 255, 0.25);
```

### Glass blur система:

```css
--glass-blur-sm: blur(8px);
--glass-blur-md: blur(16px);
--glass-blur-lg: blur(24px);
--glass-blur-xl: blur(40px);
--glass-blur-2xl: blur(60px);
```

---

## 📋 Best Practices

### ✅ DO:

```tsx
// Используйте CSS переменные через Tailwind:
className="text-input-suffix"
className="bg-liquid-blue"
className="border-input-border"

// Контекстные цвета:
<div className="bg-white">
  <span className="text-input-suffix">USDT</span>  {/* gray-700 */}
</div>

<div className="bg-blue-gradient">
  <span className="text-input-on-dark-suffix">USDT</span>  {/* white/90 */}
</div>
```

### ❌ DON'T:

```tsx
// НЕ используйте хардкод:
className="text-[#374151]"
className="bg-[#FF6B6B]"

// НЕ используйте text-white на белом фоне:
<div className="bg-white">
  <span className="text-white">USDT</span>  {/* ❌ не видно! */}
</div>

// НЕ смешивайте подходы:
className="text-input-suffix text-gray-700"  // Избыточно!
```

---

## 🔄 Миграция existing кода

### Поиск проблем:

```bash
# Найти все text-white которые могут быть на светлом фоне:
grep -r "text-white" src/components/

# Найти хардкод цветов:
grep -r "text-\[#" src/
grep -r "bg-\[#" src/
```

### Замена:

```tsx
// БЫЛО:
<span className="text-white">USDT</span>

// СТАЛО:
<span className="text-input-suffix">USDT</span>  // на светлом фоне
<span className="text-input-on-dark-suffix">USDT</span>  // на темном фоне
```

---

## 📊 Преимущества централизации

### До (проблемы):
- ❌ Цвета разбросаны по всем файлам
- ❌ Хардкод (#374151, #FFFFFF)
- ❌ Сложно поддерживать
- ❌ Белый на белом = баги
- ❌ Нет consistency

### После (решение):
- ✅ Один источник истины (globals.css)
- ✅ Semantic названия (input-suffix)
- ✅ Легко поддерживать
- ✅ Автоматический контраст
- ✅ Полная consistency

### Пример изменения темы:

```css
/* Хотите изменить цвет всех суффиксов? */
/* globals.css - ОДНА строка: */
--input-suffix: #1E40AF;  /* Теперь все USDT/CC синие! */

/* ✅ Автоматически применится везде где использован text-input-suffix */
```

---

## 🚀 Быстрый справочник

### Input элементы:

| Элемент | Светлый фон | Темный фон |
|---------|-------------|------------|
| Основной текст | `text-input-text` | `text-input-on-dark-text` |
| Placeholder | `text-input-placeholder` | `text-input-on-dark-placeholder` |
| Суффикс (USDT/CC) | `text-input-suffix` | `text-input-on-dark-suffix` |
| Border | `border-input-border` | `border-white/20` |

### Semantic colors:

| Назначение | Класс |
|------------|-------|
| Успех | `text-success` или `bg-success` |
| Предупреждение | `text-warning` |
| Ошибка | `text-error` |
| Информация | `text-info` |

### Gradients:

| Gradient | Использование |
|----------|---------------|
| `bg-gradient-twilight` | Основные кнопки |
| `bg-gradient-ocean` | Фоны секций |
| `bg-gradient-electric` | Акценты |
| `bg-gradient-aurora` | Premium элементы |

---

## ✅ Checklist перед коммитом

- [ ] Нет хардкода цветов `text-[#...]` или `bg-[#...]`
- [ ] Используются CSS переменные через Tailwind классы
- [ ] Контраст проверен (text-white не на white фоне)
- [ ] Semantic классы для Input суффиксов
- [ ] Адаптивные размеры где нужно (fluid-* или responsive)

---

## 📚 Файлы системы дизайна

1. **`src/app/globals.css`** - CSS переменные (source of truth)
2. **`tailwind.config.ts`** - Tailwind интеграция
3. **`docs/guides/ULTRA_MODERN_DESIGN_2025.md`** - Полное руководство
4. **`docs/DESIGN_SYSTEM.md`** - Этот файл (quick reference)

---

**Поддержка:** При добавлении новых цветов - сначала добавьте в `globals.css`, затем в `tailwind.config.ts`, затем используйте semantic класс в компонентах.

**Правило:** Никогда не хардкодить цвета напрямую. Всегда через CSS переменные!

