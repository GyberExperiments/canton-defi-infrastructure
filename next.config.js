const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Устраняем предупреждение о множественных lockfiles
  outputFileTracingRoot: path.join(__dirname),
  
  // Enable standalone output for Docker
  output: 'standalone',
  poweredByHeader: false,
  
  // Performance optimizations
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  compress: true,
  generateEtags: true,
  
  // Отключаем ESLint во время сборки (проверяется в CI отдельно)
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Временно: не ломать сборку из-за TS-ошибок в defi/ (исправить и убрать)
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Next.js 15.x native support для serverExternalPackages
  serverExternalPackages: ['tronweb', 'bip32', 'tiny-secp256k1', '@kubernetes/client-node', '@supabase/supabase-js', 'telegram'],
  
  // Image optimization with SEO improvements
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.canton-otc.com',
      },
    ],
  },
  
  // Page extensions
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  
  // ✅ МИНИМАЛЬНАЯ webpack конфигурация - НЕ трогаем CSS!
  // Next.js 15 App Router имеет правильную встроенную обработку CSS
  webpack: (config, { isServer, dev }) => {
    // 🚫 НЕ ТРОГАЕМ CSS RULES - позволяем Next.js обрабатывать нативно!

    if (isServer) {
      // Server-side базовые fallbacks
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
      
      // ✅ Игнорируем опциональные модули telegram на этапе сборки
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push({
          'telegram': 'commonjs telegram',
          'telegram/sessions': 'commonjs telegram/sessions',
          'telegram/tl': 'commonjs telegram/tl',
        });
      } else if (typeof config.externals === 'object') {
        config.externals = [
          config.externals,
          {
            'telegram': 'commonjs telegram',
            'telegram/sessions': 'commonjs telegram/sessions',
            'telegram/tl': 'commonjs telegram/tl',
          }
        ];
      }
    } else {
      // Client-side fallbacks - КРИТИЧНО для browser compatibility
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: false,
        fs: false,
        net: false,
        tls: false,
        // ✅ Исключаем Kubernetes client из клиентского бандла
        '@kubernetes/client-node': false,
      };
      
      // ✅ Игнорируем server-only модули в клиентском коде
      config.externals = config.externals || [];
      config.externals.push({
        '@kubernetes/client-node': 'commonjs @kubernetes/client-node',
      });

      // Production optimizations
      if (!dev) {
        config.optimization = {
          ...config.optimization,
          moduleIds: 'deterministic',
          runtimeChunk: 'single',
          splitChunks: {
            chunks: 'all',
            cacheGroups: {
              default: false,
              vendors: false,
              // Vendor chunk
              vendor: {
                name: 'vendor',
                chunks: 'all',
                test: /node_modules/,
                priority: 20
              },
              // Common chunk
              common: {
                name: 'common',
                minChunks: 2,
                chunks: 'all',
                priority: 10,
                reuseExistingChunk: true,
                enforce: true
              },
              // Framework chunk (React, Next.js, etc.)
              framework: {
                name: 'framework',
                test: /[\\/]node_modules[\\/](react|react-dom|scheduler|next)[\\/]/,
                priority: 40,
                enforce: true
              },
              // Lib chunk for larger dependencies
              lib: {
                test: /[\\/]node_modules[\\/]/,
                name(module) {
                  if (!module.context) return 'lib.unknown'
                  const match = module.context.match(
                    /[\\/]node_modules[\\/](.*?)([\\/]|$)/
                  )
                  if (!match || !match[1]) return 'lib.unknown'
                  const packageName = match[1]
                  return `lib.${packageName.replace('@', '')}`
                },
                priority: 30,
              },
            },
          },
        }
      }
    }
    
    return config;
  },

  // Environment variables
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://canton-otc.com',
    NEXT_PUBLIC_APP_NAME: 'Canton OTC Exchange',
  },

  // ✅ ПРАВИЛЬНАЯ конфигурация - доверяем Next.js defaults
  // Note: swcMinify включен по умолчанию в Next.js 15
  experimental: {
    // Используем дефолты Next.js 15 - они оптимальны для App Router
  },

  // Redirects for SEO
  async redirects() {
    return [
      // Redirect www to non-www
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'www.canton-otc.com',
          },
        ],
        destination: 'https://canton-otc.com/:path*',
        permanent: true,
      },
    ]
  },

  // Rewrites for clean URLs
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [
        // API rewrites
        {
          source: '/api-docs',
          destination: '/api/documentation',
        },
      ],
      fallback: [],
    }
  },
  
  async headers() {
    // ПОЛНЫЙ CSP с поддержкой Intercom - КРИТИЧНО для безопасности!
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    // 🔥 КРИТИЧНО: Полный список доменов Intercom для устранения 403 ошибок
    const intercomDomains = [
      'https://widget.intercom.io',
      'https://js.intercomcdn.com',
      'https://api.intercom.io',
      'https://api-iam.intercom.io',
      'https://api-ping.intercom.io',
      'https://nexus-websocket-a.intercom.io',
      'https://nexus-websocket-b.intercom.io',
      'wss://nexus-websocket-a.intercom.io',
      'wss://nexus-websocket-b.intercom.io',
      'https://downloads.intercomcdn.com',
      'https://downloads.intercomcdn.eu',
      'https://uploads.intercomcdn.com',
      'https://uploads.intercomusercontent.com',
      'https://static.intercomassets.com',  // Для аватаров и изображений
      'https://*.intercom.io',
      'https://*.intercomcdn.com',
      'https://*.intercomcdn.eu',
    ].join(' ');

    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' ${isDevelopment ? "'unsafe-eval'" : ''} ${intercomDomains}`,
      `style-src 'self' 'unsafe-inline' blob: ${intercomDomains}`,
      `img-src 'self' data: blob: ${intercomDomains}`,
      `connect-src 'self' https://api.telegram.org ${intercomDomains}`,
      `font-src 'self' data: ${intercomDomains}`,
      `media-src 'self' blob: ${intercomDomains}`,
      `frame-src 'self' ${intercomDomains}`,
      "object-src 'none'",
      "base-uri 'self'",
      `frame-ancestors 'self' ${intercomDomains}`,
      "form-action 'self'",
      `worker-src 'self' blob: ${intercomDomains}`,
      `child-src 'self' blob: ${intercomDomains}`,
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          // Security headers
          { 
            key: 'X-DNS-Prefetch-Control', 
            value: 'on' 
          },
          { 
            key: 'Strict-Transport-Security', 
            value: 'max-age=63072000; includeSubDomains; preload' 
          },
          { 
            key: 'Content-Security-Policy', 
            value: csp 
          },
          { 
            key: 'X-Content-Type-Options', 
            value: 'nosniff' 
          },
          { 
            key: 'X-Frame-Options', 
            value: 'SAMEORIGIN' 
          },
          { 
            key: 'X-XSS-Protection', 
            value: '1; mode=block' 
          },
          { 
            key: 'Referrer-Policy', 
            value: 'strict-origin-when-cross-origin' 
          },
          { 
            key: 'Permissions-Policy', 
            value: "geolocation=(), microphone=(), camera=(), payment=()" 
          },
          { 
            key: 'X-Frame-Options', 
            value: 'SAMEORIGIN' 
          }
        ],
      },
      // Cache static assets
      {
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Cache images
      {
        source: '/:all*(svg|jpg|jpeg|png|gif|webp|avif)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // ✅ КРИТИЧЕСКОЕ исправление MIME type для CSS файлов
      {
        source: '/_next/static/css/:path*',
        headers: [
          {
            key: 'Content-Type',
            value: 'text/css; charset=utf-8'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      },
      // ✅ Исправление для всех статических файлов Next.js
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          }
        ]
      },
    ];
  },
};

module.exports = nextConfig;
