import type { Metadata } from 'next'
import HowItWorksContent from '@/components/HowItWorksContent'
import { JsonLdScript } from '@/lib/json-ld-utils'
import type { WithContext, HowTo } from 'schema-dts'

export const metadata: Metadata = {
  title: 'How to Buy Canton Coin | Step-by-Step Guide | Canton OTC',
  description: 'Learn how to buy Canton Coin on Canton OTC Exchange in 5 simple steps. Detailed guide with screenshots, video tutorials, and expert tips for beginners.',
  keywords: [
    'how to buy Canton Coin',
    'Canton Coin tutorial',
    'Canton OTC guide',
    'buy Canton step by step',
    'Canton trading tutorial',
    'Canton exchange instructions',
    'Canton Coin for beginners',
    'Canton purchase guide'
  ],
  openGraph: {
    title: 'How to Buy Canton Coin - Complete Guide',
    description: 'Step-by-step instructions for purchasing Canton Coin on our OTC exchange.',
    type: 'article',
    url: '/how-it-works',
  },
  alternates: {
    canonical: '/how-it-works',
  }
}

export default function HowItWorksPage() {
  const howToStructuredData: WithContext<HowTo> = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to Buy Canton Coin on Canton OTC Exchange',
    description: 'Complete guide to purchasing Canton Coin through our secure OTC platform',
    image: 'https://1otc.cc/og-image.png',
    totalTime: 'PT15M',
    estimatedCost: {
      '@type': 'MonetaryAmount',
      currency: 'USD',
      value: '50'
    },
    supply: [
      {
        '@type': 'HowToSupply',
        name: 'Cryptocurrency wallet supporting Canton Coin'
      },
      {
        '@type': 'HowToSupply',
        name: 'USDT, ETH, or BNB for payment'
      }
    ],
    tool: [
      {
        '@type': 'HowToTool',
        name: 'Web browser or mobile device'
      }
    ],
    step: [
      {
        '@type': 'HowToStep',
        name: 'Select Payment Currency',
        text: 'Choose your preferred payment method: USDT (TRC-20, ERC-20, BEP-20), ETH, or BNB',
        image: 'https://1otc.cc/step1.png',
        url: 'https://1otc.cc/how-it-works#step1'
      },
      {
        '@type': 'HowToStep',
        name: 'Enter Amount',
        text: 'Specify how much you want to exchange. Our calculator shows real-time Canton Coin amounts.',
        image: 'https://1otc.cc/step2.png',
        url: 'https://1otc.cc/how-it-works#step2'
      },
      {
        '@type': 'HowToStep',
        name: 'Provide Wallet Address',
        text: 'Enter your Canton Coin wallet address where you want to receive your coins.',
        image: 'https://1otc.cc/step3.png',
        url: 'https://1otc.cc/how-it-works#step3'
      },
      {
        '@type': 'HowToStep',
        name: 'Send Payment',
        text: 'Send your payment to our smart contract address. Transaction is automatically processed.',
        image: 'https://1otc.cc/step4.png',
        url: 'https://1otc.cc/how-it-works#step4'
      },
      {
        '@type': 'HowToStep',
        name: 'Receive Canton Coins',
        text: 'Canton Coins are sent to your wallet immediately after payment confirmation.',
        image: 'https://1otc.cc/step5.png',
        url: 'https://1otc.cc/how-it-works#step5'
      }
    ]
  }

  return (
    <>
      <JsonLdScript data={howToStructuredData} />
      <HowItWorksContent />
    </>
  )
}
