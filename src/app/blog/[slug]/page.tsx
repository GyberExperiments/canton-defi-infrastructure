import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { generateSEOMeta } from '@/lib/seo-utils'
import { JsonLdScript } from '@/lib/json-ld-utils'
import type { WithContext, BlogPosting } from 'schema-dts'

// Blog posts data - только реальные качественные статьи
// Статьи синхронизируются с Teletype аккаунта @techhy через /api/teletype-sync
const blogPosts: Record<string, {
  id: string
  title: string
  excerpt: string
  content: string
  date: string
  author: string
  category: string
  readTime: string
  image: string
  source?: string
}> = {
  'canton-network-101': {
    id: 'canton-network-101',
    title: 'Canton Network 101: Complete Guide for Beginners',
    excerpt: 'Comprehensive introduction to Canton Network - the enterprise blockchain platform revolutionizing DeFi. Learn architecture, features, and use cases.',
    content: `
      <h2>What is Canton Network?</h2>
      <p>Canton Network is a privacy-enabled, interoperable blockchain network designed specifically for institutional and enterprise use cases. Built on Daml (Digital Asset Modeling Language), Canton enables financial institutions to transact with each other while maintaining privacy and regulatory compliance.</p>
      
      <h2>Key Architecture Components</h2>
      <h3>1. Privacy-First Design</h3>
      <p>Canton Network uses advanced cryptographic techniques to ensure that transaction details remain private between parties. Only the involved parties can see the full transaction details, while the network maintains integrity and prevents double-spending.</p>
      
      <h3>2. Interoperability</h3>
      <p>One of Canton's most powerful features is its ability to connect different blockchain networks and traditional systems. This interoperability allows institutions to leverage existing infrastructure while gaining blockchain benefits.</p>
      
      <h3>3. Smart Contract Language: Daml</h3>
      <p>Daml (Digital Asset Modeling Language) is a domain-specific language designed for building distributed applications. It provides:</p>
      <ul>
        <li>Type-safe smart contracts</li>
        <li>Built-in privacy controls</li>
        <li>Regulatory compliance features</li>
        <li>Multi-party workflows</li>
      </ul>
      
      <h2>How Canton Network Works</h2>
      <p>Canton Network operates on a unique architecture that combines:</p>
      <ul>
        <li><strong>Participant Nodes</strong>: Each institution runs a participant node that maintains their private data</li>
        <li><strong>Domain Nodes</strong>: Public infrastructure that coordinates transactions without seeing private data</li>
        <li><strong>Privacy</strong>: Transactions are encrypted and only visible to authorized parties</li>
        <li><strong>Synchronization</strong>: All parties stay synchronized through cryptographic commitments</li>
      </ul>
      
      <h2>Use Cases</h2>
      <h3>Institutional Trading</h3>
      <p>Canton enables institutions to trade digital assets directly with each other, reducing counterparty risk and settlement times while maintaining privacy.</p>
      
      <h3>Cross-Chain DeFi</h3>
      <p>Financial institutions can build DeFi protocols that work across multiple blockchains, enabling new forms of financial products and services.</p>
      
      <h3>Regulatory Compliance</h3>
      <p>Canton's architecture supports regulatory requirements like KYC/AML while maintaining privacy for legitimate transactions.</p>
      
      <h3>Tokenization</h3>
      <p>Institutions can tokenize real-world assets (stocks, bonds, commodities) and trade them on Canton Network with full regulatory compliance.</p>
      
      <h2>Canton Coin (CC)</h2>
      <p>Canton Coin is the native cryptocurrency of Canton Network. It serves multiple purposes:</p>
      <ul>
        <li><strong>Transaction Fees</strong>: Used to pay for network operations</li>
        <li><strong>Staking</strong>: Network participants can stake CC to secure the network</li>
        <li><strong>Governance</strong>: CC holders can participate in network governance decisions</li>
        <li><strong>Value Transfer</strong>: Primary medium of exchange on Canton Network</li>
      </ul>
      
      <h2>Why Choose Canton Network?</h2>
      <h3>For Institutions</h3>
      <ul>
        <li>Privacy-preserving transactions</li>
        <li>Regulatory compliance built-in</li>
        <li>Interoperability with existing systems</li>
        <li>Enterprise-grade security</li>
        <li>Scalable architecture</li>
      </ul>
      
      <h3>For Developers</h3>
      <ul>
        <li>Daml - powerful smart contract language</li>
        <li>Rich SDK and tooling</li>
        <li>Active developer community</li>
        <li>Comprehensive documentation</li>
      </ul>
      
      <h2>Getting Started with Canton Network</h2>
      <h3>1. Acquire Canton Coin</h3>
      <p>You can purchase Canton Coin (CC) through our OTC exchange at <a href="https://1otc.cc">1otc.cc</a>. We support multiple payment methods including USDT, ETH, and BNB.</p>
      
      <h3>2. Set Up a Wallet</h3>
      <p>Choose a wallet that supports Canton Network. Make sure to securely store your private keys.</p>
      
      <h3>3. Explore the Network</h3>
      <p>Start by exploring Canton Network's features, reading documentation, and joining the community.</p>
      
      <h2>Future of Canton Network</h2>
      <p>Canton Network is positioned to become a leading platform for institutional DeFi. With its focus on privacy, compliance, and interoperability, it addresses the key concerns that have prevented traditional financial institutions from fully embracing blockchain technology.</p>
      
      <p>As the network grows, we can expect to see:</p>
      <ul>
        <li>More institutional adoption</li>
        <li>New financial products and services</li>
        <li>Increased liquidity and trading volume</li>
        <li>Expansion to new use cases</li>
      </ul>
      
      <h2>Conclusion</h2>
      <p>Canton Network represents a significant step forward in making blockchain technology accessible and useful for institutional finance. Its unique combination of privacy, interoperability, and regulatory compliance makes it an ideal platform for the next generation of financial services.</p>
      
      <p>Ready to get started? <a href="https://1otc.cc">Buy Canton Coin</a> today and join the future of enterprise blockchain!</p>
    `,
    date: '2025-11-02',
    author: 'TechHy',
    category: 'Education',
    readTime: '15 min read',
    image: '/og-image.png',
    source: 'https://teletype.in/@techhy/canton-network-101'
  }
}

export async function generateStaticParams() {
  return Object.keys(blogPosts).map((slug) => ({
    slug,
  }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = blogPosts[slug]
  
  if (!post) {
    return {
      title: 'Post Not Found',
    }
  }
  
  return generateSEOMeta({
    title: `${post.title} | 1OTC Blog`,
    description: post.excerpt,
    keywords: ['Canton Coin', 'Canton Network', 'cryptocurrency', 'DeFi', 'blockchain'],
    url: `/blog/${post.id}`,
    type: 'article',
    image: post.image
  })
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = blogPosts[slug]
  
  if (!post) {
    notFound()
  }
  
  const articleStructuredData: WithContext<BlogPosting> = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `https://1otc.cc/blog/${post.id}#post`,
    headline: post.title,
    description: post.excerpt,
    image: `https://1otc.cc${post.image}`,
    datePublished: post.date,
    dateModified: post.date,
    author: {
      '@type': 'Organization',
      name: post.author,
      '@id': 'https://1otc.cc/#organization'
    },
    publisher: {
      '@type': 'Organization',
      name: 'Canton OTC Exchange',
      '@id': 'https://1otc.cc/#organization',
      logo: {
        '@type': 'ImageObject',
        url: 'https://1otc.cc/1otc-logo.svg'
      }
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://1otc.cc/blog/${post.id}`
    }
  }
  
  return (
    <>
      <JsonLdScript data={articleStructuredData} />
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Link */}
        <Link
          href="/blog"
          className="inline-flex items-center text-white/60 hover:text-white mb-8 transition-colors"
        >
          ← Back to Blog
        </Link>
        
        {/* Header */}
        <header className="mb-8">
          <div className="mb-4">
            <span className="inline-block px-3 py-1 text-xs font-semibold text-blue-400 bg-blue-400/10 rounded-full">
              {post.category}
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            {post.title}
          </h1>
          <div className="flex items-center gap-4 text-sm text-white/60">
            <time dateTime={post.date}>
              {new Date(post.date).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </time>
            <span>•</span>
            <span>{post.readTime}</span>
            <span>•</span>
            <span>{post.author}</span>
          </div>
        </header>
        
        {/* Content */}
        <div 
          className="prose prose-invert max-w-none text-white/80"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
        
        {/* Source Attribution */}
        {post.source && (
          <div className="mt-8 p-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
            <p className="text-sm text-white/60">
              Source: <a href={post.source} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">Original article on Teletype</a>
            </p>
          </div>
        )}
        
        {/* CTA */}
        <div className="mt-12 p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl text-center">
          <h3 className="text-2xl font-bold text-white mb-4">
            Ready to Buy Canton Coin?
          </h3>
          <p className="text-white/70 mb-6">
            Start your Canton Coin purchase now on our secure OTC exchange.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all"
          >
            Buy Canton Coin Now
          </Link>
        </div>
      </article>
    </>
  )
}

