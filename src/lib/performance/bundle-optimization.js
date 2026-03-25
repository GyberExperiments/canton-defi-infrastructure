/**
 * 📦 Bundle Optimization Configuration
 * Комплексная система оптимизации bundle размера:
 * - Tree shaking и dead code elimination
 * - Code splitting и lazy loading
 * - Compression и minification
 * - Cache optimization
 * - Bundle analysis и monitoring
 */

import path from 'path';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';

// ============================================================================
// WEBPACK OPTIMIZATIONS
// ============================================================================

/**
 * Оптимизация Webpack для production
 */
function createOptimizedWebpackConfig(config, { dev }) {
  // Только для production сборки
  if (dev) return config;

  // ============================================================================
  // BUNDLE SPLITTING STRATEGY
  // ============================================================================
  
  config.optimization = {
    ...config.optimization,
    
    // Более агрессивное разделение кода
    splitChunks: {
      chunks: 'all',
      minSize: 20000,      // Минимальный размер chunk (20KB)
      maxSize: 244000,     // Максимальный размер chunk (244KB)
      minChunks: 1,
      maxAsyncRequests: 30, // Максимум async chunks
      maxInitialRequests: 30, // Максимум initial chunks
      
      cacheGroups: {
        // Vendor libraries
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          priority: 20,
          reuseExistingChunk: true,
        },
        
        // React ecosystem
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
          name: 'react-vendor',
          chunks: 'all',
          priority: 30,
          reuseExistingChunk: true,
        },
        
        // Crypto libraries (обычно большие)
        crypto: {
          test: /[\\/]node_modules[\\/](ethers|web3|tronweb|crypto-js)[\\/]/,
          name: 'crypto-vendor',
          chunks: 'all',
          priority: 25,
          reuseExistingChunk: true,
        },
        
        // UI Libraries
        ui: {
          test: /[\\/]node_modules[\\/](@headlessui|@heroicons|framer-motion)[\\/]/,
          name: 'ui-vendor',
          chunks: 'all',
          priority: 15,
          reuseExistingChunk: true,
        },
        
        // Common utilities
        utils: {
          test: /[\\/]node_modules[\\/](lodash|date-fns|uuid|axios)[\\/]/,
          name: 'utils-vendor',
          chunks: 'all',
          priority: 10,
          reuseExistingChunk: true,
        },
        
        // Shared application code
        common: {
          name: 'common',
          minChunks: 2,
          chunks: 'all',
          priority: 5,
          reuseExistingChunk: true,
          enforce: true,
        }
      }
    },
    
    // Module concatenation для лучшего tree shaking
    concatenateModules: true,
    
    // Оптимизация runtime chunk
    runtimeChunk: {
      name: 'webpack-runtime'
    },
    
    // Minimizer configuration
    minimize: true,
    minimizer: [
      // Terser для JavaScript
      '...',
      // CSS minimizer уже настроен Next.js
    ]
  };

  // ============================================================================
  // RESOLVE OPTIMIZATIONS
  // ============================================================================
  
  config.resolve = {
    ...config.resolve,
    
    // Ускоряем резолвинг модулей
    modules: [
      path.resolve('./src'),
      path.resolve('./node_modules'),
      'node_modules'
    ],
    
    // Алиасы для сокращения bundle размера
    alias: {
      ...config.resolve?.alias,
      
      // Используем production версии библиотек
      'react': 'react/index.js',
      'react-dom': 'react-dom/index.js',
      
      // Алиасы для уменьшения размера
      '@': path.resolve('./src'),
      '@components': path.resolve('./src/components'),
      '@lib': path.resolve('./src/lib'),
      '@services': path.resolve('./src/lib/services'),
      '@config': path.resolve('./src/config'),
      
      // Замена больших библиотек на более легкие аналоги
      'moment': 'date-fns',
      'lodash': 'lodash-es'  // ES modules версия для tree shaking
    },
    
    // Расширения файлов (в порядке приоритета)
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
    
    // Fallback для Node.js polyfills в browser
    fallback: {
      ...config.resolve?.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('buffer'),
      process: require.resolve('process/browser')
    }
  };

  // ============================================================================
  // PLUGINS OPTIMIZATION
  // ============================================================================
  
  config.plugins = [
    ...(config.plugins || []),
    
    // Bundle analyzer (только если установлена переменная)
    ...(process.env.ANALYZE === 'true' ? [
      new BundleAnalyzerPlugin({
        analyzerMode: 'server',
        analyzerPort: 8888,
        openAnalyzer: true,
        generateStatsFile: true,
        statsFilename: 'bundle-stats.json',
        logLevel: 'info'
      })
    ] : [])
  ];

  // ============================================================================
  // MODULE RULES OPTIMIZATION
  // ============================================================================
  
  config.module = {
    ...config.module,
    
    rules: [
      ...(config.module?.rules || []),
      
      // Tree shaking для CSS modules
      {
        test: /\.css$/,
        sideEffects: false
      },
      
      // Оптимизация изображений
      {
        test: /\.(png|jpe?g|gif|svg|webp|ico)$/,
        use: [
          {
            loader: 'next-optimized-images',
            options: {
              optimizeImages: true,
              optimizeImagesInDev: false,
              mozjpeg: {
                quality: 80
              },
              pngquant: {
                quality: [0.65, 0.8]
              },
              webp: {
                quality: 80
              }
            }
          }
        ]
      }
    ]
  };

  // ============================================================================
  // PERFORMANCE BUDGETS
  // ============================================================================
  
  config.performance = {
    hints: 'warning',
    maxEntrypointSize: 512000,    // 512KB для entry points
    maxAssetSize: 512000,         // 512KB для отдельных ассетов
    assetFilter: function(assetFilename) {
      // Игнорируем некоторые типы файлов
      return !(/\.map$/.test(assetFilename)) && 
             !(/\.pdf$/.test(assetFilename));
    }
  };

  return config;
}

// ============================================================================
// NEXT.JS OPTIMIZATIONS
// ============================================================================

/**
 * Next.js конфигурация для оптимизации
 */
function createOptimizedNextConfig() {
  return {
    // ============================================================================
    // EXPERIMENTAL FEATURES
    // ============================================================================
    
    experimental: {
      // Modern JavaScript features
      esmExternals: true,
      
      // Оптимизация CSS
      optimizeCss: true,
      
      // Server-side rendering оптимизации
      serverComponentsExternalPackages: ['crypto', 'fs', 'path'],
      
      // Font optimization
      optimizePackageImports: [
        'lucide-react',
        '@heroicons/react',
        'date-fns'
      ]
    },

    // ============================================================================
    // COMPILER OPTIMIZATIONS
    // ============================================================================
    
    compiler: {
      // Remove console.logs in production
      removeConsole: process.env.NODE_ENV === 'production' ? {
        exclude: ['error', 'warn']
      } : false,
      
      // React optimizations
      reactRemoveProperties: process.env.NODE_ENV === 'production',
      
      // Styled-jsx optimization
      styledComponents: {
        displayName: process.env.NODE_ENV === 'development',
        ssr: true,
        fileName: process.env.NODE_ENV === 'development'
      }
    },

    // ============================================================================
    // OUTPUT OPTIMIZATIONS
    // ============================================================================
    
    output: 'standalone', // Для Docker deployment
    
    // Compression
    compress: true,
    
    // Generate etags для кеширования
    generateEtags: true,
    
    // ============================================================================
    // IMAGE OPTIMIZATION
    // ============================================================================
    
    images: {
      // Домены для внешних изображений
      domains: [
        'static.intercomcdn.com',
        'downloads.intercomcdn.com',
        'via.placeholder.com'
      ],
      
      // Форматы изображений
      formats: ['image/webp', 'image/avif'],
      
      // Качество изображений
      quality: 80,
      
      // Размеры для responsive images
      deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
      imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
      
      // Минимальный кеш
      minimumCacheTTL: 60 * 60 * 24 * 365, // 1 год
      
      // Оптимизация loading
      loading: 'lazy'
    },

    // ============================================================================
    // HEADERS AND CACHING
    // ============================================================================
    
    async headers() {
      return [
        {
          source: '/api/(.*)',
          headers: [
            {
              key: 'Cache-Control',
              value: 'no-store, no-cache, must-revalidate'
            }
          ]
        },
        {
          source: '/(.*)',
          headers: [
            {
              key: 'X-Content-Type-Options',
              value: 'nosniff'
            },
            {
              key: 'X-Frame-Options',
              value: 'DENY'
            },
            {
              key: 'X-XSS-Protection',
              value: '1; mode=block'
            }
          ]
        },
        {
          // Кеширование статических ресурсов
          source: '/(_next/static|favicon.ico|robots.txt)',
          headers: [
            {
              key: 'Cache-Control',
              value: 'public, max-age=31536000, immutable'
            }
          ]
        }
      ];
    },

    // ============================================================================
    // REDIRECTS AND REWRITES
    // ============================================================================
    
    async redirects() {
      return [
        // Редиректы для SEO
      ];
    },

    async rewrites() {
      return [
        // API rewrites если нужны
      ];
    },

    // ============================================================================
    // WEBPACK CONFIGURATION
    // ============================================================================
    
    webpack: createOptimizedWebpackConfig,

    // ============================================================================
    // ENVIRONMENT VARIABLES
    // ============================================================================
    
    env: {
      CUSTOM_KEY: process.env.CUSTOM_KEY || 'default-value'
    },

    // ============================================================================
    // PWA CONFIGURATION (если используется)
    // ============================================================================
    
    pwa: process.env.NODE_ENV === 'production' ? {
      dest: 'public',
      register: true,
      skipWaiting: true,
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'google-fonts-cache',
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 60 * 60 * 24 * 365 // 1 год
            }
          }
        },
        {
          urlPattern: /\.(?:png|jpg|jpeg|svg|gif)$/,
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'images-cache',
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 60 * 60 * 24 * 30 // 30 дней
            }
          }
        }
      ]
    } : undefined,

    // ============================================================================
    // TYPESCRIPT CONFIGURATION
    // ============================================================================
    
    typescript: {
      // Игнорировать ошибки типов во время сборки (не рекомендуется для production)
      ignoreBuildErrors: false
    },

    // ============================================================================
    // ESLINT CONFIGURATION
    // ============================================================================
    
    eslint: {
      // Игнорировать ESLint ошибки во время сборки (не рекомендуется)
      ignoreDuringBuilds: false,
      
      // Директории для проверки
      dirs: ['src', 'pages']
    }
  };
}

// ============================================================================
// BUNDLE ANALYSIS UTILITIES
// ============================================================================

/**
 * Анализ размера bundle
 */
function analyzeBundleSize() {
  console.log(`
📦 Bundle Analysis Commands:

1. Analyze bundle:
   ANALYZE=true npm run build

2. Check specific chunks:
   npx webpack-bundle-analyzer .next/static/chunks/*.js

3. Performance audit:
   npm run lighthouse

4. Bundle size tracking:
   npx bundlesize

5. Tree shaking analysis:
   npx webpack --json > stats.json
   npx webpack-bundle-analyzer stats.json
  `);
}

/**
 * Performance monitoring
 */
function setupPerformanceMonitoring() {
  if (typeof window !== 'undefined') {
    // Web Vitals monitoring
    function reportWebVitals(metric) {
      console.log('Web Vitals:', metric);
      
      // Отправка метрик в аналитику
      if (process.env.NODE_ENV === 'production') {
        // analytics.track('Web Vitals', metric);
      }
    }

    // Performance Observer API
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === 'navigation') {
            console.log('Navigation timing:', entry);
          }
          
          if (entry.entryType === 'resource') {
            const resourceSize = entry.transferSize || entry.encodedBodySize;
            if (resourceSize > 100000) { // > 100KB
              console.warn('Large resource detected:', {
                name: entry.name,
                size: `${Math.round(resourceSize / 1024)}KB`,
                duration: `${entry.duration.toFixed(2)}ms`
              });
            }
          }
        });
      });

      observer.observe({ entryTypes: ['navigation', 'resource'] });
    }

    return reportWebVitals;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  createOptimizedWebpackConfig,
  createOptimizedNextConfig,
  analyzeBundleSize,
  setupPerformanceMonitoring
};

// Utility для быстрого запуска анализа
if (require.main === module) {
  analyzeBundleSize();
}
