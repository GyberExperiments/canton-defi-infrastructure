/**
 * SEO Utility Functions for Canton OTC Exchange
 * Optimized for 2025 SEO best practices
 */

import { Metadata } from 'next'

/**
 * Base URL for the application
 */
export const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://1otc.cc'

/**
 * Generate optimized meta tags for a page
 */
export function generateSEOMeta(params: {
  title: string
  description: string
  keywords?: string[]
  image?: string
  url?: string
  type?: 'website' | 'article' | 'product'
  noindex?: boolean
}): Metadata {
  const {
    title,
    description,
    keywords = [],
    image = '/og-image.png',
    url = '/',
    type = 'website',
    noindex = false
  } = params

  const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`
  const fullImageUrl = image.startsWith('http') ? image : `${BASE_URL}${image}`

  return {
    title,
    description,
    keywords: keywords.length > 0 ? keywords : undefined,
    authors: [{ name: 'Canton OTC Exchange' }],
    creator: 'Canton OTC Exchange',
    publisher: 'Canton OTC Exchange',
    
    robots: noindex ? {
      index: false,
      follow: false,
    } : {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    
    openGraph: {
      title,
      description,
      url: fullUrl,
      siteName: 'Canton OTC Exchange',
      images: [
        {
          url: fullImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: 'en_US',
      type: type === 'product' ? 'website' : type,
    },
    
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [fullImageUrl],
      creator: '@CantonOTC',
      site: '@CantonOTC',
    },
    
    alternates: {
      canonical: fullUrl,
      languages: {
        'en-US': `${fullUrl}`,
        'ru-RU': `${fullUrl}/ru`,
      },
    },
    
    other: {
      'price:currency': 'USD',
    },
  }
}

/**
 * Generate structured data for organization
 */
export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${BASE_URL}/#organization`,
    name: 'Canton OTC Exchange',
    alternateName: '1OTC',
    url: BASE_URL,
    logo: {
      '@type': 'ImageObject',
      url: `${BASE_URL}/1otc-logo.svg`,
      width: '512',
      height: '512'
    },
    description: 'Professional over-the-counter exchange for Canton Coin cryptocurrency',
    sameAs: [
      'https://twitter.com/CantonOTC',
      'https://t.me/canton_otc_bot',
      'https://github.com/canton-otc',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Customer Service',
      email: 'support@1otc.cc',
      availableLanguage: ['English', 'Russian'],
      areaServed: 'Worldwide'
    }
  }
}

/**
 * Generate WebSite schema with search action
 */
export function generateWebsiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${BASE_URL}/#website`,
    url: BASE_URL,
    name: 'Canton OTC Exchange',
    description: 'Professional OTC exchange for Canton Coin cryptocurrency',
    publisher: {
      '@id': `${BASE_URL}/#organization`
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE_URL}/search?q={search_term_string}`
      },
      'query-input': 'required name=search_term_string'
    },
    inLanguage: ['en', 'ru']
  }
}

/**
 * Generate CryptocurrencyExchange schema
 */
export function generateCryptoExchangeSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FinancialService',
    '@id': `${BASE_URL}/#exchange`,
    name: 'Canton OTC Exchange',
    description: 'Over-the-counter cryptocurrency exchange specializing in Canton Coin trading',
    url: BASE_URL,
    provider: {
      '@id': `${BASE_URL}/#organization`
    },
    areaServed: 'Worldwide',
    serviceType: 'Cryptocurrency Exchange',
    currenciesAccepted: ['USD', 'USDT', 'ETH', 'BNB', 'CANTON'],
    availableChannel: {
      '@type': 'ServiceChannel',
      serviceUrl: BASE_URL,
      availableLanguage: ['en', 'ru']
    },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Canton Coin Trading Services',
      itemListElement: [
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Buy Canton Coin with USDT',
            description: 'Exchange USDT (TRC-20, ERC-20, BEP-20) for Canton Coin'
          }
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Buy Canton Coin with ETH',
            description: 'Exchange Ethereum for Canton Coin'
          }
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Buy Canton Coin with BNB',
            description: 'Exchange Binance Coin for Canton Coin'
          }
        }
      ]
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      reviewCount: '127',
      bestRating: '5',
      worstRating: '1'
    }
  }
}

/**
 * Extract keywords from content using AI-like approach
 */
export function extractKeywords(content: string, limit: number = 10): string[] {
  // Simple keyword extraction based on frequency
  const words = content
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3)
  
  const frequency: Record<string, number> = {}
  words.forEach(word => {
    frequency[word] = (frequency[word] || 0) + 1
  })
  
  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word)
}

/**
 * Generate optimal title length (50-60 characters)
 */
export function optimizeTitle(title: string, maxLength: number = 60): string {
  if (title.length <= maxLength) return title
  
  // Truncate and add ellipsis
  return title.substring(0, maxLength - 3) + '...'
}

/**
 * Generate optimal description length (150-160 characters)
 */
export function optimizeDescription(description: string, maxLength: number = 160): string {
  if (description.length <= maxLength) return description
  
  // Truncate at last complete sentence or word
  const truncated = description.substring(0, maxLength - 3)
  const lastSpace = truncated.lastIndexOf(' ')
  
  return truncated.substring(0, lastSpace) + '...'
}

/**
 * Generate URL slug from title
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

/**
 * Check if content is SEO-friendly
 */
export function analyzeSEO(params: {
  title: string
  description: string
  content: string
  keywords: string[]
}) {
  const issues: string[] = []
  const suggestions: string[] = []
  
  // Title analysis
  if (params.title.length < 30) {
    issues.push('Title is too short (< 30 characters)')
  } else if (params.title.length > 60) {
    issues.push('Title is too long (> 60 characters)')
  }
  
  // Description analysis
  if (params.description.length < 120) {
    issues.push('Description is too short (< 120 characters)')
  } else if (params.description.length > 160) {
    issues.push('Description is too long (> 160 characters)')
  }
  
  // Content analysis
  const wordCount = params.content.split(/\s+/).length
  if (wordCount < 300) {
    suggestions.push('Consider adding more content (currently ' + wordCount + ' words)')
  }
  
  // Keyword analysis
  const contentLower = params.content.toLowerCase()
  params.keywords.forEach(keyword => {
    if (!contentLower.includes(keyword.toLowerCase())) {
      suggestions.push(`Keyword "${keyword}" not found in content`)
    }
  })
  
  return {
    score: Math.max(0, 100 - (issues.length * 15) - (suggestions.length * 5)),
    issues,
    suggestions
  }
}

/**
 * Generate hreflang tags for multi-language support
 */
export function generateHreflangTags(path: string) {
  return [
    { hreflang: 'en', href: `${BASE_URL}${path}` },
    { hreflang: 'ru', href: `${BASE_URL}/ru${path}` },
    { hreflang: 'x-default', href: `${BASE_URL}${path}` },
  ]
}

/**
 * Generate canonical URL
 */
export function generateCanonicalUrl(path: string): string {
  // Remove trailing slash and query parameters
  const cleanPath = path.split('?')[0].replace(/\/$/, '')
  return `${BASE_URL}${cleanPath}`
}

/**
 * Calculate reading time for content
 */
export function calculateReadingTime(content: string, wordsPerMinute: number = 200): number {
  const wordCount = content.split(/\s+/).length
  return Math.ceil(wordCount / wordsPerMinute)
}

/**
 * Generate social sharing URLs
 */
export function generateSocialShareUrls(params: {
  url: string
  title: string
  description: string
}) {
  const encodedUrl = encodeURIComponent(params.url)
  const encodedTitle = encodeURIComponent(params.title)
  
  return {
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
    whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
    reddit: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
  }
}
