import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import IntercomProvider from "@/components/IntercomProvider";
import { ConfigProvider } from "@/components/ConfigProvider";
import { WagmiProvider } from "@/components/providers/WagmiProvider";
import { OTC_CONFIG } from "@/config/otc";
import { JsonLdScript } from "@/lib/json-ld-utils";
import type { Graph, Thing } from "schema-dts";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://1otc.cc"),

  title: {
    default: "Buy Canton Coin | 1OTC - Professional Cryptocurrency Exchange",
    template: "%s | 1OTC Exchange",
  },

  description:
    "Buy Canton Coin instantly with USDT on 1OTC Exchange. Professional over-the-counter cryptocurrency trading with multi-network support (Ethereum, TRON, Solana, Optimism). Fast, secure, and transparent OTC platform.",

  keywords: [
    // Primary keywords
    "buy Canton Coin",
    "Canton OTC",
    "Canton Coin exchange",
    "Canton Network",

    // OTC specific
    "OTC cryptocurrency exchange",
    "over-the-counter crypto",
    "Canton OTC trading",
    "buy crypto OTC",

    // Payment methods
    "buy Canton with USDT",
    "buy Canton with ETH",
    "buy Canton with BNB",
    "USDT to Canton",
    "ETH to Canton",

    // Networks
    "Canton Coin TRC-20",
    "Canton Coin ERC-20",
    "Canton Coin BEP-20",
    "multi-network crypto exchange",

    // Features
    "secure crypto exchange",
    "instant Canton purchase",
    "Canton Coin trading platform",
    "decentralized OTC",

    // Location & variations
    "Canton cryptocurrency",
    "Canton token",
    "Canton Coin price",
    "how to buy Canton Coin",
    "where to buy Canton Coin",
  ],

  authors: [{ name: "1OTC Exchange" }],
  creator: "1OTC Exchange",
  publisher: "1OTC Exchange",

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: ["ru_RU"],
    url: "/",
    siteName: "1OTC Exchange",
    title: "Buy Canton Coin | 1OTC - Professional Cryptocurrency Exchange",
    description:
      "Buy Canton Coin instantly with USDT, ETH, or BNB. Multi-network support, secure trading, instant processing. The trusted Canton OTC platform.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Canton OTC Exchange - Buy Canton Coin",
        type: "image/png",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    site: "@CantonOTC",
    creator: "@CantonOTC",
    title: "Buy Canton Coin | 1OTC Exchange",
    description:
      "Secure OTC exchange for Canton Coin. Buy with USDT, ETH, BNB. Multi-network support.",
    images: ["/twitter-image.png"],
  },

  alternates: {
    canonical: "/",
    languages: {
      "en-US": "/en",
      "ru-RU": "/ru",
    },
  },

  verification: {
    google: "your-google-verification-code",
    yandex: "your-yandex-verification-code",
  },

  category: "Cryptocurrency Exchange",

  other: {
    "price:currency": "USD",
    "price:amount": OTC_CONFIG.CANTON_COIN_PRICE_USD.toFixed(2),
  },
};

// JSON-LD Structured Data for SEO
// Extended Graph type to support JSON-LD properties not covered by schema-dts strict types
interface JsonLdGraph extends Omit<Graph, "@graph"> {
  "@graph": ReadonlyArray<Thing & Record<string, unknown>>;
}

const jsonLd: JsonLdGraph = {
  "@context": "https://schema.org",
  "@graph": [
    // Organization Schema
    {
      "@type": "Organization",
      "@id": "https://1otc.cc/#organization",
      name: "Canton OTC Exchange",
      url: "https://1otc.cc",
      logo: {
        "@type": "ImageObject",
        url: "https://1otc.cc/1otc-logo.svg",
        width: "512",
        height: "512",
      },
      description:
        "Professional over-the-counter exchange for Canton Coin cryptocurrency",
      sameAs: ["https://twitter.com/CantonOTC", "https://t.me/canton_otc_bot"],
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "Customer Service",
        email: process.env.SUPPORT_EMAIL || "support@canton-otc.com",
        availableLanguage: ["English", "Russian"],
      },
    },
    // FinancialService Schema
    {
      "@type": "FinancialService",
      "@id": "https://1otc.cc/#service",
      name: "Canton OTC Exchange",
      description:
        "Secure over-the-counter cryptocurrency exchange for Canton Coin. Buy Canton with USDT, ETH, or BNB.",
      url: "https://1otc.cc",
      provider: {
        "@type": "Organization",
        "@id": "https://1otc.cc/#organization",
      },
      areaServed: "Worldwide",
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Canton Coin Trading Services",
        itemListElement: [
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Buy Canton Coin with USDT",
              description:
                "Exchange USDT (TRC-20, ERC-20, BEP-20) for Canton Coin",
            },
          },
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Buy Canton Coin with ETH",
              description: "Exchange Ethereum for Canton Coin",
            },
          },
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Buy Canton Coin with BNB",
              description: "Exchange Binance Coin for Canton Coin",
            },
          },
        ],
      },
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.8",
        reviewCount: "127",
        bestRating: "5",
        worstRating: "1",
      },
    },
    // Product Schema for Canton Coin
    {
      "@type": "Product",
      "@id": "https://1otc.cc/#product",
      name: "Canton Coin",
      description:
        "Canton Network native cryptocurrency token for decentralized finance",
      brand: {
        "@type": "Brand",
        name: "Canton Network",
      },
      offers: {
        "@type": "Offer",
        price: OTC_CONFIG.CANTON_COIN_PRICE_USD.toFixed(2),
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: "https://1otc.cc",
        seller: {
          "@id": "https://1otc.cc/#organization",
        },
      },
    },
    // WebSite Schema
    {
      "@type": "WebSite",
      "@id": "https://1otc.cc/#website",
      url: "https://1otc.cc",
      name: "Canton OTC Exchange",
      description: "Professional OTC exchange for Canton Coin cryptocurrency",
      publisher: {
        "@id": "https://1otc.cc/#organization",
      },
      potentialAction: {
        "@type": "SearchAction",
        target: "https://1otc.cc/search?q={search_term_string}",
        "query-input": "required name=search_term_string",
      },
    },
    // BreadcrumbList Schema
    {
      "@type": "BreadcrumbList",
      "@id": "https://1otc.cc/#breadcrumb",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: "https://1otc.cc",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Buy Canton Coin",
          item: "https://1otc.cc",
        },
      ],
    },
    // FAQPage Schema for homepage
    {
      "@type": "FAQPage",
      "@id": "https://1otc.cc/#faq",
      mainEntity: [
        {
          "@type": "Question",
          name: "How long does it take to receive Canton Coin?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Orders are typically processed within 2-4 hours during business hours (8:00 AM - 10:00 PM GMT+8). You'll receive email and Telegram notifications about your order status.",
          },
        },
        {
          "@type": "Question",
          name: "What is the minimum order amount?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "The minimum order is $700 USD equivalent in USDT on any supported network. Maximum order is $100,000 USD.",
          },
        },
        {
          "@type": "Question",
          name: "Do I need to register an account?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No registration required! Simply enter your Canton wallet address, email, and payment details to start trading.",
          },
        },
        {
          "@type": "Question",
          name: "What networks are supported?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "We support USDT on Ethereum (ERC-20), TRON (TRC-20), Solana, and Optimism networks. You can also use ETH and BNB for purchases.",
          },
        },
        {
          "@type": "Question",
          name: "Is Canton OTC Exchange safe?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes! We implement enterprise-grade security including rate limiting, spam detection, and secure address validation. We never hold your funds - it's a true OTC exchange.",
          },
        },
        {
          "@type": "Question",
          name: "What is Canton Coin?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Canton Coin (CC) is the native cryptocurrency of the Canton Network, a cutting-edge blockchain platform designed for decentralized finance (DeFi) applications.",
          },
        },
      ],
    },
    // Review Schema with detailed reviews
    {
      "@type": "Review",
      "@id": "https://1otc.cc/#review",
      itemReviewed: {
        "@id": "https://1otc.cc/#service",
      },
      reviewRating: {
        "@type": "Rating",
        ratingValue: "4.8",
        bestRating: "5",
        worstRating: "1",
      },
      author: {
        "@type": "Organization",
        name: "Canton OTC Exchange",
      },
      reviewBody:
        "Professional OTC exchange with excellent service, fast processing, and secure transactions.",
      datePublished: "2024-01-15",
    },
    // CryptocurrencyExchange Schema
    {
      "@type": "FinancialService",
      "@id": "https://1otc.cc/#cryptocurrency-exchange",
      name: "Canton OTC Exchange",
      description:
        "Professional over-the-counter cryptocurrency exchange specializing in Canton Coin (CC) trading. Buy and sell Canton Coin with USDT, ETH, or BNB across multiple blockchain networks.",
      url: "https://1otc.cc",
      provider: {
        "@id": "https://1otc.cc/#organization",
      },
      serviceType: "Cryptocurrency Exchange",
      areaServed: {
        "@type": "Place",
        name: "Worldwide",
      },
      currenciesAccepted: ["USD", "USDT", "ETH", "BNB", "CANTON"],
      paymentAccepted: ["Cryptocurrency"],
      priceRange: "$700 - $100,000",
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.8",
        reviewCount: "127",
        bestRating: "5",
        worstRating: "1",
      },
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Canton Coin Trading Services",
        itemListElement: [
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Buy Canton Coin with USDT",
              description:
                "Exchange USDT (TRC-20, ERC-20, BEP-20) for Canton Coin. Multi-network support with instant processing.",
            },
            price: "0.44",
            priceCurrency: "USD",
          },
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Buy Canton Coin with ETH",
              description:
                "Exchange Ethereum for Canton Coin with competitive rates.",
            },
            price: "0.44",
            priceCurrency: "USD",
          },
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Buy Canton Coin with BNB",
              description:
                "Exchange Binance Coin for Canton Coin on BSC network.",
            },
            price: "0.44",
            priceCurrency: "USD",
          },
        ],
      },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const intercomAppId = process.env.NEXT_PUBLIC_INTERCOM_APP_ID || "a131dwle";

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* JSON-LD Structured Data */}
        <JsonLdScript data={jsonLd} />
        {/* Preconnect to external domains for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link rel="preconnect" href="https://widget.intercom.io" />

        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="Canton OTC" />

        {/* Favicon and Icons */}
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon-16x16.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />
        <link rel="shortcut icon" href="/favicon.svg" />

        {/* Additional SEO Meta Tags */}
        <meta name="application-name" content="Canton OTC Exchange" />
        <meta name="msapplication-TileColor" content="#6366f1" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <meta name="theme-color" content="#6366f1" />

        {/* Geo Tags */}
        <meta name="geo.region" content="GLOBAL" />
        <meta name="geo.position" content="0;0" />
        <meta name="ICBM" content="0, 0" />

        {/* Performance Hints */}
        <link rel="dns-prefetch" href="https://1otc.cc" />
        <link rel="preconnect" href="https://1otc.cc" crossOrigin="anonymous" />

        {/* Google Analytics 4 */}
        {process.env.NEXT_PUBLIC_GA_ID && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}', {
                    page_path: window.location.pathname,
                  });
                `,
              }}
            />
          </>
        )}

        {/* Security Headers */}
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="X-XSS-Protection" content="1; mode=block" />
      </head>
      <body
        className={`${inter.className} antialiased`}
        suppressHydrationWarning
      >
        <ConfigProvider>
          <WagmiProvider>
            {intercomAppId ? (
              <IntercomProvider appId={intercomAppId}>
                <div
                  className="min-h-screen"
                  style={{ background: "var(--bg-primary)" }}
                >
                  {/* Ultra Modern Aurora Background */}
                  <div className="fixed inset-0 mesh-gradient-aurora" />

                  {/* Noise Texture Overlay */}
                  <div className="fixed inset-0 noise-overlay opacity-20" />

                  {/* Content Container with Proper Spacing */}
                  <div className="relative z-10 container-fluid py-8 sm:py-16 lg:py-24">
                    <div className="max-w-7xl mx-auto">{children}</div>
                  </div>
                </div>

                <Toaster
                  position="top-right"
                  toastOptions={{
                    duration: 4000,
                    style: {
                      background: "var(--glass-white-10)",
                      color: "#fff",
                      border: "1px solid rgba(255, 255, 255, 0.18)",
                      backdropFilter: "var(--glass-blur-xl) saturate(180%)",
                      borderRadius: "16px",
                      padding: "16px 20px",
                      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.37)",
                    },
                  }}
                />
              </IntercomProvider>
            ) : (
              <>
                <div
                  className="min-h-screen"
                  style={{ background: "var(--bg-primary)" }}
                >
                  {/* Ultra Modern Aurora Background */}
                  <div className="fixed inset-0 mesh-gradient-aurora" />

                  {/* Noise Texture Overlay */}
                  <div className="fixed inset-0 noise-overlay opacity-20" />

                  {/* Content Container with Proper Spacing */}
                  <div className="relative z-10 container-fluid py-8 sm:py-16 lg:py-24">
                    <div className="max-w-7xl mx-auto">{children}</div>
                  </div>
                </div>

                <Toaster
                  position="top-right"
                  toastOptions={{
                    duration: 4000,
                    style: {
                      background: "var(--glass-white-10)",
                      color: "#fff",
                      border: "1px solid rgba(255, 255, 255, 0.18)",
                      backdropFilter: "var(--glass-blur-xl) saturate(180%)",
                      borderRadius: "16px",
                      padding: "16px 20px",
                      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.37)",
                    },
                  }}
                />
              </>
            )}
          </WagmiProvider>
        </ConfigProvider>
      </body>
    </html>
  );
}
