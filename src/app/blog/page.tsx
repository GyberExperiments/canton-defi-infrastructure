import type { Metadata } from 'next'
import Link from 'next/link'
import { generateSEOMeta } from '@/lib/seo-utils'
import { JsonLdScript } from '@/lib/json-ld-utils'
import type { WithContext, Blog } from 'schema-dts'

export const metadata: Metadata = generateSEOMeta({
  title: 'Canton Coin Blog | News, Guides & Updates | 1OTC Exchange',
  description: 'Stay updated with the latest news, guides, and insights about Canton Coin, Canton Network, and cryptocurrency trading. Expert articles, tutorials, and market analysis.',
  keywords: [
    'Canton Coin blog',
    'Canton Network news',
    'cryptocurrency guides',
    'Canton Coin tutorials',
    'DeFi articles',
    'blockchain education',
    'Canton ecosystem',
    'crypto trading tips'
  ],
  url: '/blog',
  type: 'website'
})

// Blog posts data - только реальные качественные статьи
// Статьи синхронизируются с Teletype аккаунта @techhy через /api/teletype-sync
interface BlogPost {
  id: string
  title: string
  excerpt: string
  date: string
  author: string
  category: string
  readTime: string
  image: string
  featured?: boolean
}

const blogPosts: BlogPost[] = [
  {
    id: 'canton-network-101',
    title: 'Canton Network 101: Complete Guide for Beginners',
    excerpt: 'Comprehensive introduction to Canton Network - the enterprise blockchain platform revolutionizing DeFi. Learn architecture, features, and use cases.',
    date: '2025-11-02',
    author: 'TechHy',
    category: 'Education',
    readTime: '15 min read',
    image: '/og-image.png',
    featured: true
  }
]

const blogStructuredData: WithContext<Blog> = {
  '@context': 'https://schema.org',
  '@type': 'Blog',
  '@id': 'https://1otc.cc/blog#blog',
  name: 'Canton OTC Exchange Blog',
  description: 'Latest news, guides, and insights about Canton Coin and Canton Network',
  url: 'https://1otc.cc/blog',
  publisher: {
    '@id': 'https://1otc.cc/#organization'
  },
  blogPost: blogPosts.map(post => ({
    '@type': 'BlogPosting',
    '@id': `https://1otc.cc/blog/${post.id}#post`,
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    author: {
      '@type': 'Organization',
      name: post.author
    },
    publisher: {
      '@id': 'https://1otc.cc/#organization'
    },
    image: `https://1otc.cc${post.image}`,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://1otc.cc/blog/${post.id}`
    }
  }))
}

export default function BlogPage() {
  return (
    <>
      <JsonLdScript data={blogStructuredData} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <header className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Canton Coin Blog
          </h1>
          <p className="text-xl text-white/70 max-w-2xl mx-auto">
            Stay updated with the latest news, guides, and insights about Canton Coin and the blockchain ecosystem.
          </p>
        </header>

        {/* Featured Article */}
        {blogPosts.find(post => post.featured) && (
          <div className="mb-16">
            {(() => {
              const featured = blogPosts.find(post => post.featured)!
              return (
                <article
                  className="relative overflow-hidden bg-gradient-to-br from-purple-500/20 via-blue-500/20 to-cyan-500/20 backdrop-blur-xl border border-white/20 rounded-3xl p-8 md:p-12 hover:border-white/30 transition-all group"
                  itemScope
                  itemType="https://schema.org/BlogPosting"
                >
                  <div className="absolute top-4 right-4">
                    <span className="px-3 py-1 text-xs font-semibold text-yellow-400 bg-yellow-400/20 rounded-full">
                      Featured
                    </span>
                  </div>
                  
                  <div className="relative z-10">
                    <div className="mb-4">
                      <span className="inline-block px-3 py-1 text-xs font-semibold text-blue-400 bg-blue-400/10 rounded-full mb-4">
                        {featured.category}
                      </span>
                    </div>
                    
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-blue-300 group-hover:to-cyan-300 transition-all" itemProp="headline">
                      <Link 
                        href={`/blog/${featured.id}`}
                        className="hover:text-blue-400 transition-colors"
                      >
                        {featured.title}
                      </Link>
                    </h2>
                    
                    <p className="text-lg text-white/70 mb-6 line-clamp-2" itemProp="description">
                      {featured.excerpt}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm text-white/50">
                        <time dateTime={featured.date} itemProp="datePublished">
                          {new Date(featured.date).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </time>
                        <span>•</span>
                        <span>{featured.readTime}</span>
                        <span>•</span>
                        <span itemProp="author" itemScope itemType="https://schema.org/Organization">
                          <span itemProp="name">{featured.author}</span>
                        </span>
                      </div>
                      
                      <Link
                        href={`/blog/${featured.id}`}
                        className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all"
                      >
                        Read Article →
                      </Link>
                    </div>
                  </div>
                </article>
              )
            })()}
          </div>
        )}

        {/* Blog Posts Grid */}
        {blogPosts.filter(post => !post.featured).length > 0 && (
          <>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-8">All Articles</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {blogPosts.filter(post => !post.featured).map((post) => (
            <article
              key={post.id}
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all"
              itemScope
              itemType="https://schema.org/BlogPosting"
            >
              <div className="mb-4">
                <span className="inline-block px-3 py-1 text-xs font-semibold text-blue-400 bg-blue-400/10 rounded-full mb-3">
                  {post.category}
                </span>
                <h2 className="text-xl font-bold text-white mb-3" itemProp="headline">
                  <Link 
                    href={`/blog/${post.id}`}
                    className="hover:text-blue-400 transition-colors"
                  >
                    {post.title}
                  </Link>
                </h2>
              </div>
              
              <p className="text-white/60 text-sm mb-4 line-clamp-3" itemProp="description">
                {post.excerpt}
              </p>
              
              <div className="flex items-center justify-between text-sm text-white/50">
                <div>
                  <time dateTime={post.date} itemProp="datePublished">
                    {new Date(post.date).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </time>
                  <span className="mx-2">•</span>
                  <span>{post.readTime}</span>
                </div>
              </div>
              
              <div className="mt-4" itemProp="author" itemScope itemType="https://schema.org/Organization">
                <span className="text-xs text-white/40" itemProp="name">{post.author}</span>
              </div>
            </article>
          ))}
            </div>
          </>
        )}

        {/* Empty State or Coming Soon */}
        {blogPosts.length === 0 ? (
          <div className="mt-16 text-center">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 max-w-2xl mx-auto">
              <h3 className="text-2xl font-bold text-white mb-4">
                No Articles Yet
              </h3>
              <p className="text-white/70 mb-6">
                Articles are automatically synced from our Teletype account. Check back soon for new content!
              </p>
              <Link
                href="/"
                className="inline-block px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all"
              >
                Back to Exchange
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-16 text-center">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 max-w-2xl mx-auto">
              <h3 className="text-2xl font-bold text-white mb-4">
                More Articles Coming Soon
              </h3>
              <p className="text-white/70 mb-6">
                New articles are automatically synced from our Teletype account (@techhy). Stay tuned for the latest guides, tutorials, and insights about Canton Coin and Canton Network.
              </p>
              <div className="flex gap-4 justify-center">
                <Link
                  href="/"
                  className="inline-block px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all"
                >
                  Back to Exchange
                </Link>
                <a
                  href="https://teletype.in/@techhy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg border border-white/20 transition-all"
                >
                  Visit Teletype
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

