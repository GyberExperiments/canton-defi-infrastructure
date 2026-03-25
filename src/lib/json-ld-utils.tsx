/**
 * JSON-LD Structured Data Utilities
 * Safe rendering with schema-dts typing and XSS protection
 */

import type { WithContext } from 'schema-dts'

/**
 * Safely stringify JSON-LD data with XSS protection
 * Escapes < characters to prevent XSS attacks
 * 
 * @param data - JSON-LD structured data (typed with schema-dts)
 * @returns Safe JSON string ready for dangerouslySetInnerHTML
 */
export function safeJsonLdStringify<T extends WithContext<any>>(
  data: T
): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

/**
 * Render JSON-LD script tag component
 * Safe for use in Next.js App Router
 * 
 * ⚠️ ВАЖНО ДЛЯ SEO:
 * - Этот компонент рендерится на СЕРВЕРЕ (Server Component)
 * - JSON-LD попадает в HTML до отправки клиенту
 * - Google бот читает HTML напрямую (без выполнения JavaScript)
 * - Используйте только в Server Components (без 'use client')
 * 
 * @param data - JSON-LD structured data (typed with schema-dts)
 * @returns JSX script element with safe JSON-LD
 */
export function JsonLdScript<T extends WithContext<any>>({ data }: { data: T }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(data) }}
    />
  )
}

/**
 * Get safe JSON-LD HTML string for use in dangerouslySetInnerHTML
 * Use this when you need the string directly (e.g., in SEOHead component)
 * 
 * @param data - JSON-LD structured data (typed with schema-dts)
 * @returns Safe HTML string
 */
export function getSafeJsonLdHtml<T extends WithContext<any>>(data: T): string {
  return safeJsonLdStringify(data)
}
