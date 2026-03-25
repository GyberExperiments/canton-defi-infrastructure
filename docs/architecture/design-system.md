# 🎨 Design System - Canton DeFi Platform

> **Версия:** 1.0.0  
> **Дата:** 2026-01-20  
> **Контекст:** DeFi платформа с институциональным уровнем UX/UI

---

## 🎯 Design Principles

### 1. Trust & Transparency
- Четкая визуальная иерархия для финансовых данных
- Прозрачность всех комиссий и рисков
- Визуальные индикаторы статуса операций

### 2. Clarity & Simplicity
- Минимум когнитивной нагрузки
- Прогрессивное раскрытие информации
- Четкие CTA и навигация

### 3. Performance & Responsiveness
- Быстрая загрузка и отклик
- Оптимизация для мобильных устройств
- Skeleton loaders вместо пустых экранов

---

## 🎨 Color System

### Primary Colors (Trust & Finance)
```css
--defi-trust: #10B981;        /* Emerald - успех, подтверждение */
--defi-risk: #EF4444;        /* Red - предупреждения, ошибки */
--defi-info: #3B82F6;        /* Blue - информация, ссылки */
--defi-warning: #F59E0B;     /* Amber - предупреждения */
--defi-success: #059669;     /* Green - успешные операции */
```

### Status Colors
```css
--status-live: #10B981;      /* Live/Active */
--status-pending: #F59E0B;    /* Pending/Waiting */
--status-error: #EF4444;     /* Error/Failed */
--status-inactive: #6B7280;   /* Inactive/Disabled */
```

### Background Colors
```css
--bg-card: rgba(255, 255, 255, 0.05);
--bg-card-hover: rgba(255, 255, 255, 0.08);
--bg-surface: rgba(255, 255, 255, 0.02);
--bg-elevated: rgba(255, 255, 255, 0.1);
```

### Text Colors
```css
--text-primary: #FFFFFF;
--text-secondary: rgba(255, 255, 255, 0.7);
--text-tertiary: rgba(255, 255, 255, 0.5);
--text-disabled: rgba(255, 255, 255, 0.3);
```

---

## 📐 Typography

### Font Scale
```css
--font-display: 'Inter Variable', system-ui, sans-serif;
--font-mono: 'JetBrains Mono Variable', monospace;

/* Sizes */
--text-xs: 0.75rem;      /* 12px - метки, badges */
--text-sm: 0.875rem;     /* 14px - вторичный текст */
--text-base: 1rem;      /* 16px - основной текст */
--text-lg: 1.125rem;     /* 18px - подзаголовки */
--text-xl: 1.25rem;      /* 20px - заголовки секций */
--text-2xl: 1.5rem;      /* 24px - крупные заголовки */
--text-3xl: 1.875rem;    /* 30px - hero заголовки */
--text-4xl: 2.25rem;     /* 36px - главные заголовки */
```

### Financial Data Typography
- **Числа:** `font-mono` для точности
- **Валюта:** `font-display` с `font-semibold`
- **Проценты:** Цвет по значению (зеленый/красный)

---

## 📏 Spacing System (4px Grid)

```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
--space-20: 5rem;     /* 80px */
```

---

## 🧩 Component Patterns

### Product Card
- **Padding:** `p-6` (24px)
- **Border Radius:** `rounded-2xl` (24px)
- **Background:** `bg-card` с `backdrop-blur-xl`
- **Hover:** `bg-card-hover` + `scale(1.02)`
- **Status Badge:** В правом верхнем углу
- **CTA Button:** Полная ширина, четкий контраст

### Input Fields
- **Height:** `h-12` (48px) минимум для touch
- **Border:** `border-white/10` → `border-info` на focus
- **Padding:** `px-4 py-3`
- **Font:** `font-mono` для чисел
- **Placeholder:** `text-tertiary`

### Buttons
- **Primary:** `bg-gradient-to-r from-info to-success`
- **Secondary:** `bg-card` с `border-white/20`
- **Danger:** `bg-risk` для критических действий
- **Height:** `h-12` минимум
- **Padding:** `px-6 py-3`

### Status Badges
- **Live:** `bg-success/20 text-success border-success/30`
- **Pending:** `bg-warning/20 text-warning border-warning/30`
- **Error:** `bg-risk/20 text-risk border-risk/30`

---

## 🎭 Animation Guidelines

### Micro-interactions
- **Hover:** `scale(1.02)` + `transition-all duration-200`
- **Click:** `scale(0.98)` + `transition-all duration-100`
- **Loading:** `animate-spin` для spinners

### Page Transitions
- **Duration:** `300ms` для быстрого отклика
- **Easing:** `ease-out` для естественности

### Reduced Motion
- Всегда проверять `prefers-reduced-motion`
- Отключать сложные анимации на мобильных

---

## 📱 Mobile Optimizations

### Breakpoints
```css
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
```

### Mobile-Specific
- Уменьшенные padding: `p-4` вместо `p-6`
- Компактные карточки: `grid-cols-1`
- Sticky navigation для быстрого доступа
- Touch targets: минимум 44x44px

---

## ♿ Accessibility

### Contrast Ratios
- **Text:** Минимум 4.5:1 для основного текста
- **Buttons:** Минимум 3:1 для фона
- **Focus:** Четкий outline `2px solid info`

### Keyboard Navigation
- Все интерактивные элементы доступны через Tab
- Skip links для главного контента
- ARIA labels для иконок

---

## 🚀 Performance

### Loading States
- Skeleton loaders вместо пустых экранов
- Progressive image loading
- Lazy loading для ниже fold контента

### Optimization
- CSS-in-JS для критических стилей
- Минимизация re-renders через React.memo
- Виртуализация для длинных списков

---

## 📋 Component Checklist

### Product Card
- [x] Статус badge
- [x] APY с цветовой индикацией
- [x] Минимальная инвестиция
- [x] Четкий CTA
- [x] Hover эффекты
- [x] Loading state

### Input Fields
- [x] Label
- [x] Placeholder
- [x] Error state
- [x] Success state
- [x] Disabled state
- [x] Helper text

### Buttons
- [x] Primary variant
- [x] Secondary variant
- [x] Danger variant
- [x] Loading state
- [x] Disabled state
- [x] Icon support

---

## 🎯 Usage Examples

### Product Card
```tsx
<ProductCard
  name="AI Optimizer"
  apy="14.2%"
  minInvestment={2500}
  status="live"
  riskLevel="medium"
  onInvest={handleInvest}
/>
```

### Status Badge
```tsx
<StatusBadge status="live" />
<StatusBadge status="pending" />
<StatusBadge status="error" />
```

### Financial Display
```tsx
<FinancialValue
  value={1250000}
  currency="USD"
  format="compact"
  trend="up"
/>
```

---

## 📚 Resources

- [Figma Design Tokens](https://figma.com/...)
- [Component Storybook](https://storybook...)
- [Accessibility Guide](./accessibility.md)
