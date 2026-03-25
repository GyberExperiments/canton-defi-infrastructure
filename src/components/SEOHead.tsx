'use client'

import { useEffect } from 'react'
import { getSafeJsonLdHtml } from '@/lib/json-ld-utils'
import type { WithContext } from 'schema-dts'

interface SEOHeadProps {
  title?: string
  description?: string
  keywords?: string[]
  canonicalUrl?: string
  ogImage?: string
  structuredData?: WithContext<any>
}

/**
 * Advanced SEO component for dynamic meta tags and structured data
 * Use this component in individual pages for custom SEO optimization
 */
export default function SEOHead({
  title,
  description,
  keywords,
  canonicalUrl,
  ogImage,
  structuredData
}: SEOHeadProps) {
  useEffect(() => {
    // Dynamic title update for SPA navigation
    if (title) {
      document.title = title
    }

    // Update meta description
    if (description) {
      const metaDesc = document.querySelector('meta[name="description"]')
      if (metaDesc) {
        metaDesc.setAttribute('content', description)
      }
    }

    // Update keywords
    if (keywords && keywords.length > 0) {
      const metaKeywords = document.querySelector('meta[name="keywords"]')
      if (metaKeywords) {
        metaKeywords.setAttribute('content', keywords.join(', '))
      }
    }

    // Update canonical URL
    if (canonicalUrl) {
      const linkCanonical = document.querySelector('link[rel="canonical"]')
      if (linkCanonical) {
        linkCanonical.setAttribute('href', canonicalUrl)
      }
    }

    // Update OG image
    if (ogImage) {
      const ogImageMeta = document.querySelector('meta[property="og:image"]')
      if (ogImageMeta) {
        ogImageMeta.setAttribute('content', ogImage)
      }
    }

    // Add structured data
    if (structuredData) {
      const script = document.createElement('script')
      script.type = 'application/ld+json'
      script.text = getSafeJsonLdHtml(structuredData)
      script.id = 'dynamic-structured-data'
      
      // Remove old script if exists
      const oldScript = document.getElementById('dynamic-structured-data')
      if (oldScript) {
        oldScript.remove()
      }
      
      document.head.appendChild(script)
    }

    // Cleanup
    return () => {
      const dynamicScript = document.getElementById('dynamic-structured-data')
      if (dynamicScript) {
        dynamicScript.remove()
      }
    }
  }, [title, description, keywords, canonicalUrl, ogImage, structuredData])

  return null
}

/**
 * Generate breadcrumb structured data
 */
export function generateBreadcrumbData(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  }
}

/**
 * Generate product structured data for Canton Coin
 */
export function generateProductData(price: number) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Canton Coin',
    description: 'Canton Network native cryptocurrency token',
    brand: {
      '@type': 'Brand',
      name: 'Canton Network'
    },
    offers: {
      '@type': 'Offer',
      price: price.toFixed(2),
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: 'https://1otc.cc',
      priceValidUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      reviewCount: '127'
    }
  }
}

/**
 * Generate article structured data
 */
export function generateArticleData(params: {
  headline: string
  description: string
  image: string
  datePublished: string
  dateModified: string
  author: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: params.headline,
    description: params.description,
    image: params.image,
    datePublished: params.datePublished,
    dateModified: params.dateModified,
    author: {
      '@type': 'Organization',
      name: params.author
    },
    publisher: {
      '@type': 'Organization',
      name: 'Canton OTC Exchange',
      logo: {
        '@type': 'ImageObject',
        url: 'https://1otc.cc/1otc-logo.svg'
      }
    }
  }
}

/**
 * Generate video structured data
 */
export function generateVideoData(params: {
  name: string
  description: string
  thumbnailUrl: string
  uploadDate: string
  duration: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: params.name,
    description: params.description,
    thumbnailUrl: params.thumbnailUrl,
    uploadDate: params.uploadDate,
    duration: params.duration,
    contentUrl: 'https://canton-otc.com/videos/' + params.name.toLowerCase().replace(/ /g, '-'),
    embedUrl: 'https://canton-otc.com/videos/embed/' + params.name.toLowerCase().replace(/ /g, '-')
  }
}
