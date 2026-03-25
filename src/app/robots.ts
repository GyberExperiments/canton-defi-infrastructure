import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://1otc.cc'
  
  return {
    rules: [
      // Rules for all crawlers
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/admin/*', // Block admin endpoints
          '/api/create-order', // Block order creation endpoint (POST only)
          '/_next/static/chunks/*', // Block Next.js internal files
        ],
      },
      // Specific rules for Google
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: [
          '/api/admin/*',
        ],
        crawlDelay: 0,
      },
      // Specific rules for Bing
      {
        userAgent: 'Bingbot',
        allow: '/',
        disallow: [
          '/api/admin/*',
        ],
        crawlDelay: 0,
      },
      // Yandex (popular in Russia)
      {
        userAgent: 'Yandex',
        allow: '/',
        disallow: [
          '/api/admin/*',
        ],
        crawlDelay: 0,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}



