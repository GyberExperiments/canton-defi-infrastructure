import type { Metadata } from 'next'
import FAQContent from '@/components/FAQContent'
import { JsonLdScript } from '@/lib/json-ld-utils'
import type { WithContext, FAQPage } from 'schema-dts'

export const metadata: Metadata = {
  title: 'Frequently Asked Questions | Canton OTC Exchange',
  description: 'Find answers to common questions about buying Canton Coin, our OTC exchange process, supported networks, security measures, and more.',
  keywords: [
    'Canton Coin FAQ',
    'Canton OTC questions',
    'how to buy Canton Coin',
    'Canton exchange help',
    'Canton trading guide',
    'Canton Coin support',
    'Canton OTC tutorial',
    'Canton cryptocurrency FAQ'
  ],
  openGraph: {
    title: 'Canton OTC FAQ - Your Questions Answered',
    description: 'Everything you need to know about buying Canton Coin on our OTC exchange.',
    type: 'website',
    url: '/faq',
  },
  alternates: {
    canonical: '/faq',
  }
}

export default function FAQPage() {
  const faqStructuredData: WithContext<FAQPage> = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is Canton Coin?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Canton Coin is the native cryptocurrency of the Canton Network, designed for decentralized finance (DeFi) applications. It powers transactions, governance, and staking within the Canton ecosystem.'
        }
      },
      {
        '@type': 'Question',
        name: 'How do I buy Canton Coin on Canton OTC?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'To buy Canton Coin: 1) Select your payment currency (USDT, ETH, or BNB), 2) Enter the amount you want to exchange, 3) Provide your Canton wallet address, 4) Complete the payment, 5) Receive your Canton Coins instantly.'
        }
      },
      {
        '@type': 'Question',
        name: 'What payment methods are accepted?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'We accept USDT (TRC-20, ERC-20, BEP-20), Ethereum (ETH), and Binance Coin (BNB). All transactions are processed instantly through smart contracts.'
        }
      },
      {
        '@type': 'Question',
        name: 'Is Canton OTC exchange safe?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes, Canton OTC is secure. We use smart contracts for automated transactions, SSL encryption for all data transfers, and never store your private keys. All transactions are transparent and verifiable on the blockchain.'
        }
      },
      {
        '@type': 'Question',
        name: 'What is the minimum purchase amount?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The minimum purchase amount is $50 USD equivalent in your chosen payment currency. There is no maximum limit for OTC transactions.'
        }
      },
      {
        '@type': 'Question',
        name: 'How long does the transaction take?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Transactions are typically completed within 5-15 minutes, depending on network confirmation times. ETH and BNB transactions are usually faster than USDT on TRON network.'
        }
      },
      {
        '@type': 'Question',
        name: 'Do I need KYC verification?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'No KYC is required for transactions under $10,000 USD. For larger transactions, we may require basic verification to comply with regulations and ensure security.'
        }
      },
      {
        '@type': 'Question',
        name: 'What networks does Canton Coin support?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Canton Coin is available on multiple networks including Ethereum (ERC-20), Binance Smart Chain (BEP-20), TRON (TRC-20), Solana, and Optimism, providing flexibility and lower transaction fees.'
        }
      }
    ]
  }

  return (
    <>
      <JsonLdScript data={faqStructuredData} />
      <FAQContent />
    </>
  )
}
