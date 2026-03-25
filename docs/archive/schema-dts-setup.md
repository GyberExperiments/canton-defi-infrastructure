# Установка schema-dts для типизации JSON-LD

## Установка пакета

Выполните одну из команд:

```bash
# npm
npm install schema-dts --save-dev

# yarn
yarn add schema-dts --dev

# pnpm
pnpm add schema-dts --save-dev

**Примечание:** Актуальная версия пакета - `1.1.5` (не `1.2.0`).
```

## Что было сделано

1. ✅ Создана утилита `src/lib/json-ld-utils.ts` для безопасного рендеринга JSON-LD
2. ✅ Все файлы обновлены для использования типизации через `schema-dts`
3. ✅ Добавлена защита от XSS через экранирование символа `<`
4. ✅ Создан компонент `JsonLdScript` для удобного использования

## Обновленные файлы

- `src/app/layout.tsx` - типизация `Graph`
- `src/app/blog/page.tsx` - типизация `Blog`
- `src/app/about/page.tsx` - типизация `AboutPage`
- `src/app/faq/page.tsx` - типизация `FAQPage`
- `src/app/how-it-works/page.tsx` - типизация `HowTo`
- `src/app/blog/[slug]/page.tsx` - типизация `BlogPosting`
- `src/components/SEOHead.tsx` - использование безопасного рендеринга

## Преимущества

- ✅ **Типобезопасность**: TypeScript проверяет корректность структуры JSON-LD
- ✅ **Безопасность**: Автоматическое экранирование предотвращает XSS атаки
- ✅ **Удобство**: Единый компонент `JsonLdScript` для всех страниц
- ✅ **Best Practice**: Соответствует рекомендациям Next.js и Google

## Использование

```tsx
import { JsonLdScript } from '@/lib/json-ld-utils'
import type { WithContext, Blog } from 'schema-dts'

const blogData: WithContext<Blog> = {
  '@context': 'https://schema.org',
  '@type': 'Blog',
  // ... остальные поля
}

export default function Page() {
  return (
    <>
      <JsonLdScript data={blogData} />
      {/* остальной контент */}
    </>
  )
}
```
