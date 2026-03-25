import type { Metadata } from 'next'
import AboutContent from '@/components/AboutContent'
import { JsonLdScript } from '@/lib/json-ld-utils'
import type { WithContext, AboutPage } from 'schema-dts'

export const metadata: Metadata = {
  title: 'About Canton OTC Exchange | Professional Crypto Trading Platform',
  description: 'Learn about Canton OTC Exchange - the leading over-the-counter platform for Canton Coin trading. Our mission, values, technology, and commitment to secure cryptocurrency exchange.',
  keywords: [
    'Canton OTC about',
    'Canton exchange team',
    'Canton trading platform',
    'crypto OTC platform',
    'Canton Coin exchange history',
    'Canton OTC mission',
    'secure crypto exchange',
    'professional OTC trading'
  ],
  openGraph: {
    title: 'About Canton OTC - Professional Cryptocurrency Exchange',
    description: 'Discover the team and technology behind Canton OTC Exchange, the trusted platform for Canton Coin trading.',
    type: 'website',
    url: '/about',
  },
  alternates: {
    canonical: '/about',
  }
}

export default function AboutPage() {
  const aboutStructuredData: WithContext<AboutPage> = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    mainEntity: {
      '@type': 'Organization',
      name: 'Canton OTC Exchange',
      alternateName: '1OTC',
      url: 'https://1otc.cc',
      description: 'Professional over-the-counter cryptocurrency exchange specializing in Canton Coin trading',
      foundingDate: '2023',
      foundingLocation: {
        '@type': 'Place',
        name: 'Global'
      },
      knowsAbout: [
        'Cryptocurrency Trading',
        'Blockchain Technology',
        'DeFi',
        'Canton Network',
        'OTC Trading',
        'Smart Contracts'
      ],
      slogan: 'Your Gateway to Canton Coin',
      award: 'Trusted OTC Platform 2024'
    }
  }

  return (
    <>
      <JsonLdScript data={aboutStructuredData} />
      <AboutContent />
    </>
  )
}
