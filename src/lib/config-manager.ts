/**
 * 🔧 Config Manager для динамического управления конфигурацией
 * Позволяет обновлять конфигурацию без перезапуска приложения
 */

export interface ConfigData {
  // Цены Canton Coin (вычисляемые или статичные)
  cantonCoinBuyPrice: number;
  cantonCoinSellPrice: number;
  cantonCoinPrice: string;
  
  // Настройки динамического ценообразования
  useDynamicPricing: boolean; // Использовать ли рыночную цену из API
  buyMarkupPercent: number; // Процент наценки при покупке (прибавляется к рыночной цене)
  sellMarkupPercent: number; // Процент наценки при продаже (вычитается из рыночной цены)
  
  // Лимиты
  minUsdtAmount: number;
  maxUsdtAmount?: number;
  minCantonAmount: number;
  maxCantonAmount?: number;
  
  // Настройки бизнеса
  businessHours: string;
  supportEmail: string;
  telegramBotUsername: string;
  
  // Настройки приложения
  nodeEnv: string;
  nextPublicAppUrl: string;
  redisUrl: string;
  
  // Настройки сервисов
  emailServiceEnabled: boolean;
  telegramServiceEnabled: boolean;
  
  // Настройки анти-спама
  spamDetectionEnabled: boolean;
  maxOrdersPerIpPerHour: number;
  duplicateAmountWindowMinutes: number;
  
  // Настройки мониторинга
  monitoringEnabled: boolean;
  
  // Настройки AUTH
  authTrustHost: boolean;
  authUrl: string;
  
  // Настройки GitHub API
  repoOwner: string;
  repoName: string;
  workflowId: string;
  workflowBranch: string;
  
  // DEX настройки
  dexFeePercent?: number; // Комиссия DEX в процентах (0.3 = 0.3%)
  swapFeePercent?: number; // Комиссия для swap в процентах
  bridgeFeePercent?: number; // Комиссия для bridge в процентах
  dexFeeRecipient?: string; // Адрес получателя комиссий
  minSwapAmount?: number; // Минимальная сумма для свапа
  maxSwapAmount?: number; // Максимальная сумма для свапа
  enabledTokens?: string[]; // Включенные токены (пустой = все)
  enabledChains?: string[]; // Включенные блокчейны
  
  // Service commission
  serviceCommission?: number; // Комиссия сервиса в процентах (1 = 1%)
  
  // Метаданные
  lastUpdate: Date;
  version: string;
}

export class ConfigManager {
  private static instance: ConfigManager;
  private config: ConfigData | null = null;
  private lastUpdate: Date = new Date();
  private refreshInterval: number = 60000; // ✅ 60 секунд (было 30) - оптимизация
  private interval: NodeJS.Timeout | null = null;
  private listeners: Array<(config: ConfigData) => void> = [];
  private isRefreshing: boolean = false; // ✅ Флаг для предотвращения множественных обновлений
  private lastCheckTime: Date = new Date(0); // ✅ Время последней проверки

  private constructor() {
    // ✅ Инициализируем базовые значения синхронно (без async операций)
    this.initializeDefaults();
    
    // ✅ Пытаемся загрузить предыдущие значения из localStorage (только на клиенте)
    this.loadFromLocalStorage();
    
    // ✅ ИСПРАВЛЕНО: НЕ вызываем refreshConfig() в конструкторе!
    // Это предотвращает ChunkLoadError timeout при SSR
    // Загрузка конфигурации происходит отложенно через useConfig hook
    
    // Запускаем auto-refresh только на клиенте с задержкой
    if (typeof window !== 'undefined') {
      // Отложенный запуск чтобы не блокировать первый рендер
      setTimeout(() => {
        this.startAutoRefresh();
        // Первая загрузка конфигурации после инициализации компонентов
        this.refreshConfig().catch(err => {
          console.warn('⚠️ Initial config load failed, using defaults:', err);
        });
      }, 1000); // 1 секунда задержки
    }
  }
  
  /**
   * Загрузить предыдущие значения из localStorage (только на клиенте)
   */
  private loadFromLocalStorage(): void {
    // Базовые значения уже инициализированы в конструкторе
    if (typeof window === 'undefined') return; // localStorage только на клиенте
    
    try {
      const stored = localStorage.getItem('canton_otc_config');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.config = {
          ...parsed,
          lastUpdate: new Date(parsed.lastUpdate)
        };
        console.log('📦 Loaded previous config from localStorage:', {
          buyPrice: parsed.cantonCoinBuyPrice,
          sellPrice: parsed.cantonCoinSellPrice,
          lastUpdate: parsed.lastUpdate
        });
      }
    } catch (error) {
      console.warn('⚠️ Could not load config from localStorage:', error);
    }
  }
  
  /**
   * Инициализация базовых значений (без цен)
   */
  private initializeDefaults(): void {
    // ❗ Устанавливаем fallback цены для локальной разработки
    this.config = {
      cantonCoinBuyPrice: 0.21, // Fallback для разработки
      cantonCoinSellPrice: 0.19, // Fallback для разработки
      cantonCoinPrice: '0.20',
      useDynamicPricing: false,
      buyMarkupPercent: 0,
      sellMarkupPercent: 0,
      minUsdtAmount: 1,
      maxUsdtAmount: undefined,
      minCantonAmount: 1,
      maxCantonAmount: undefined,
      businessHours: '8:00 AM - 10:00 PM (GMT+8)',
      supportEmail: 'support@cantonotc.com',
      telegramBotUsername: '@canton_otc_bot',
      nodeEnv: typeof process !== 'undefined' && process.env?.NODE_ENV ? process.env.NODE_ENV : 'development',
      nextPublicAppUrl: typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_APP_URL ? process.env.NEXT_PUBLIC_APP_URL : 'http://localhost:3000',
      redisUrl: '',
      emailServiceEnabled: true,
      telegramServiceEnabled: false,
      spamDetectionEnabled: true,
      maxOrdersPerIpPerHour: 3,
      duplicateAmountWindowMinutes: 10,
      monitoringEnabled: true,
      authTrustHost: true,
      authUrl: '',
      repoOwner: 'TheMacroeconomicDao',
      repoName: 'CantonOTC',
      workflowId: 'deploy.yml',
      workflowBranch: 'minimal-stage',
      lastUpdate: new Date(),
      version: 'initial'
    };
  }
  
  /**
   * Сохранить текущие значения в localStorage (только на клиенте)
   */
  private saveToLocalStorage(): void {
    if (typeof window === 'undefined' || !this.config) return; // Только на клиенте
    
    try {
      localStorage.setItem('canton_otc_config', JSON.stringify(this.config));
    } catch (error) {
      console.warn('⚠️ Could not save config to localStorage:', error);
    }
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Получить текущую конфигурацию
   */
  getConfig(): ConfigData | null {
    return this.config;
  }

  /**
   * Проверить, актуальна ли конфигурация
   */
  isConfigFresh(): boolean {
    return Date.now() - this.lastUpdate.getTime() < this.refreshInterval;
  }

  /**
   * Принудительно обновить конфигурацию
   * ✅ ОБНОВЛЕНО: Теперь читаем из /api/config вместо process.env
   */
  async refreshConfig(): Promise<boolean> {
    // ✅ Предотвращаем множественные одновременные обновления
    if (this.isRefreshing) {
      console.log('⏳ Refresh already in progress, skipping...');
      return false;
    }

    try {
      this.isRefreshing = true;
      console.log('🔄 Refreshing configuration from API...');
      
      // Определяем URL для запроса
      const isServer = typeof window === 'undefined';
      
      if (isServer) {
        // ✅ На сервере: используем прямой импорт Kubernetes ConfigManager
        console.log('📊 Server-side: Reading directly from Kubernetes ConfigMap');
        
        try {
          // ✅ ИСПРАВЛЕНО: Добавляем таймаут для Kubernetes операций
          const timeoutPromise = new Promise<null>((_, reject) => {
            setTimeout(() => reject(new Error('Kubernetes config timeout')), 5000);
          });
          
          const k8sPromise = (async () => {
            const { getKubernetesConfigManager } = await import('@/lib/kubernetes-config');
            const k8sManager = getKubernetesConfigManager();
            return k8sManager.getConfigMap();
          })();
          
          const configMapData = await Promise.race([k8sPromise, timeoutPromise]);
          
          if (configMapData) {
            // ✅ Новая логика: проверяем используем ли мы динамическое ценообразование
            const useDynamicPricing = configMapData.USE_DYNAMIC_PRICING === 'true';
            const buyMarkupPercent = parseFloat(configMapData.BUY_MARKUP_PERCENT || '0');
            const sellMarkupPercent = parseFloat(configMapData.SELL_MARKUP_PERCENT || '0');
            
            let cantonCoinBuyPrice: number;
            let cantonCoinSellPrice: number;
            
            if (useDynamicPricing) {
              // ✅ Используем рыночную цену из API + проценты наценки
              try {
                const { marketPriceService } = await import('@/lib/services/marketPriceService');
                const marketPrice = await marketPriceService.getMarketPrice();
                
                if (marketPrice > 0) {
                  // Buy: рыночная цена + процент наценки (прибавляем)
                  cantonCoinBuyPrice = marketPrice * (1 + buyMarkupPercent / 100);
                  // Sell: рыночная цена - процент наценки (вычитаем)
                  cantonCoinSellPrice = marketPrice * (1 - sellMarkupPercent / 100);
                  
                  console.log('✅ Using dynamic pricing:', {
                    marketPrice,
                    buyMarkupPercent,
                    sellMarkupPercent,
                    calculatedBuyPrice: cantonCoinBuyPrice,
                    calculatedSellPrice: cantonCoinSellPrice
                  });
                } else {
                  // Fallback на статичные цены если API недоступен
                  console.warn('⚠️ Market price API unavailable, using static prices');
                  cantonCoinBuyPrice = parseFloat(configMapData.CANTON_COIN_BUY_PRICE_USD || '0');
                  cantonCoinSellPrice = parseFloat(configMapData.CANTON_COIN_SELL_PRICE_USD || '0');
                }
              } catch (error) {
                console.error('❌ Error fetching market price, using static prices:', error);
                // Fallback на статичные цены при ошибке
                cantonCoinBuyPrice = parseFloat(configMapData.CANTON_COIN_BUY_PRICE_USD || '0');
                cantonCoinSellPrice = parseFloat(configMapData.CANTON_COIN_SELL_PRICE_USD || '0');
              }
            } else {
              // ✅ Используем статичные цены из ConfigMap (старый способ)
              cantonCoinBuyPrice = parseFloat(
                configMapData.CANTON_COIN_BUY_PRICE_USD || '0'
              );
              cantonCoinSellPrice = parseFloat(
                configMapData.CANTON_COIN_SELL_PRICE_USD || '0'
              );
            }
            
            const newConfig: ConfigData = {
              cantonCoinBuyPrice,
              cantonCoinSellPrice,
              cantonCoinPrice: configMapData.CANTON_COIN_PRICE_USD || ((cantonCoinBuyPrice + cantonCoinSellPrice) / 2).toFixed(2),
              useDynamicPricing,
              buyMarkupPercent,
              sellMarkupPercent,
              minUsdtAmount: parseFloat(configMapData.MIN_USDT_AMOUNT || '1'),
              maxUsdtAmount: configMapData.MAX_USDT_AMOUNT ? parseFloat(configMapData.MAX_USDT_AMOUNT) : undefined,
              minCantonAmount: cantonCoinSellPrice > 0 ? Math.ceil(parseFloat(configMapData.MIN_USDT_AMOUNT || '1') / cantonCoinSellPrice) : 5,
              maxCantonAmount: (configMapData.MAX_USDT_AMOUNT && cantonCoinSellPrice > 0) ? Math.floor(parseFloat(configMapData.MAX_USDT_AMOUNT) / cantonCoinSellPrice) : undefined,
              businessHours: configMapData.BUSINESS_HOURS || '8:00 AM - 10:00 PM (GMT+8)',
              supportEmail: configMapData.SUPPORT_EMAIL || 'support@cantonotc.com',
              telegramBotUsername: configMapData.TELEGRAM_BOT_USERNAME || '@canton_otc_bot',
              nodeEnv: configMapData.NODE_ENV || process.env.NODE_ENV || 'development',
              nextPublicAppUrl: configMapData.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
              redisUrl: process.env.REDIS_URL || '',
              emailServiceEnabled: configMapData.EMAIL_SERVICE_ENABLED === 'true',
              telegramServiceEnabled: !!process.env.TELEGRAM_BOT_TOKEN,
              spamDetectionEnabled: configMapData.SPAM_DETECTION_ENABLED !== 'false',
              maxOrdersPerIpPerHour: parseInt(configMapData.MAX_ORDERS_PER_IP_PER_HOUR || '3'),
              duplicateAmountWindowMinutes: parseInt(configMapData.DUPLICATE_AMOUNT_WINDOW_MINUTES || '10'),
              monitoringEnabled: configMapData.MONITORING_ENABLED !== 'false',
              authTrustHost: process.env.AUTH_TRUST_HOST === 'true',
              authUrl: process.env.AUTH_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000',
              repoOwner: process.env.REPO_OWNER || process.env.GITHUB_REPO_OWNER || 'TheMacroeconomicDao',
              repoName: process.env.REPO_NAME || process.env.GITHUB_REPO_NAME || 'CantonOTC',
              workflowId: process.env.GITHUB_WORKFLOW_ID || 'deploy.yml',
              workflowBranch: configMapData.GITHUB_BRANCH || process.env.GITHUB_BRANCH || 'minimal-stage',
              // DEX настройки
              dexFeePercent: parseFloat(configMapData.NEAR_DEX_FEE_PERCENT || '0.3'),
              swapFeePercent: parseFloat(configMapData.NEAR_DEX_SWAP_FEE_PERCENT || '0.3'),
              bridgeFeePercent: parseFloat(configMapData.NEAR_DEX_BRIDGE_FEE_PERCENT || '0.5'),
              dexFeeRecipient: configMapData.NEAR_DEX_FEE_RECIPIENT || '',
              minSwapAmount: parseFloat(configMapData.NEAR_DEX_MIN_SWAP_AMOUNT || '0.1'),
              maxSwapAmount: configMapData.NEAR_DEX_MAX_SWAP_AMOUNT ? parseFloat(configMapData.NEAR_DEX_MAX_SWAP_AMOUNT) : undefined,
              enabledTokens: configMapData.NEAR_DEX_ENABLED_TOKENS ? configMapData.NEAR_DEX_ENABLED_TOKENS.split(',').map(t => t.trim()) : [],
              enabledChains: configMapData.NEAR_DEX_ENABLED_CHAINS ? configMapData.NEAR_DEX_ENABLED_CHAINS.split(',').map(c => c.trim()) : ['NEAR', 'AURORA'],
              serviceCommission: parseFloat(configMapData.SERVICE_COMMISSION_PERCENT || '1'),
              lastUpdate: new Date(),
              version: `configmap-v${Date.now()}`
            };
            
            this.config = newConfig;
            this.lastUpdate = new Date();
            
            console.log('✅ Configuration refreshed from ConfigMap:', {
              buyPrice: newConfig.cantonCoinBuyPrice,
              sellPrice: newConfig.cantonCoinSellPrice
            });
            
            // Сохраняем в localStorage для следующего запуска
            this.saveToLocalStorage();
            
            // Уведомляем слушателей
            this.notifyListeners();
            
            return true;
          }
        } catch (k8sError) {
          console.warn('⚠️ Could not read from ConfigMap, falling back to process.env:', k8sError);
        }
        
        // Fallback к process.env на сервере (только для локальной разработки)
        // ⚠️ В production это НЕ должно использоваться - цены должны браться из ConfigMap
        console.warn('⚠️ ConfigMap unavailable, using process.env fallback (dev mode only)');
        const useDynamicPricing = process.env.USE_DYNAMIC_PRICING === 'true';
        const buyMarkupPercent = parseFloat(process.env.BUY_MARKUP_PERCENT || '0');
        const sellMarkupPercent = parseFloat(process.env.SELL_MARKUP_PERCENT || '0');
        
        let cantonCoinBuyPrice: number;
        let cantonCoinSellPrice: number;
        
        if (useDynamicPricing) {
          try {
            const { marketPriceService } = await import('@/lib/services/marketPriceService');
            const marketPrice = await marketPriceService.getMarketPrice();
            
            if (marketPrice > 0) {
              cantonCoinBuyPrice = marketPrice * (1 + buyMarkupPercent / 100);
              cantonCoinSellPrice = marketPrice * (1 - sellMarkupPercent / 100);
            } else {
              cantonCoinBuyPrice = parseFloat(process.env.CANTON_COIN_BUY_PRICE_USD || '0.21');
              cantonCoinSellPrice = parseFloat(process.env.CANTON_COIN_SELL_PRICE_USD || '0.19');
            }
          } catch (error) {
            console.error('❌ Error fetching market price in fallback:', error);
            cantonCoinBuyPrice = parseFloat(process.env.CANTON_COIN_BUY_PRICE_USD || '0.21');
            cantonCoinSellPrice = parseFloat(process.env.CANTON_COIN_SELL_PRICE_USD || '0.19');
          }
        } else {
          cantonCoinBuyPrice = parseFloat(process.env.CANTON_COIN_BUY_PRICE_USD || '0.21');
          cantonCoinSellPrice = parseFloat(process.env.CANTON_COIN_SELL_PRICE_USD || '0.19');
        }
        
        const fallbackConfig: ConfigData = {
          cantonCoinBuyPrice,
          cantonCoinSellPrice,
          cantonCoinPrice: ((cantonCoinBuyPrice + cantonCoinSellPrice) / 2).toFixed(2),
          useDynamicPricing,
          buyMarkupPercent,
          sellMarkupPercent,
          minUsdtAmount: parseFloat(process.env.MIN_USDT_AMOUNT || '1'),
          maxUsdtAmount: process.env.MAX_USDT_AMOUNT ? parseFloat(process.env.MAX_USDT_AMOUNT) : undefined,
          minCantonAmount: cantonCoinSellPrice > 0 ? Math.ceil(parseFloat(process.env.MIN_USDT_AMOUNT || '1') / cantonCoinSellPrice) : 5,
          maxCantonAmount: (process.env.MAX_USDT_AMOUNT && cantonCoinSellPrice > 0) ? Math.floor(parseFloat(process.env.MAX_USDT_AMOUNT) / cantonCoinSellPrice) : undefined,
          businessHours: process.env.BUSINESS_HOURS || '8:00 AM - 10:00 PM (GMT+8)',
          supportEmail: process.env.SUPPORT_EMAIL || 'support@cantonotc.com',
          telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME || '@canton_otc_bot',
          nodeEnv: process.env.NODE_ENV || 'development',
          nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          redisUrl: process.env.REDIS_URL || '',
          emailServiceEnabled: process.env.EMAIL_SERVICE_ENABLED === 'true',
          telegramServiceEnabled: !!process.env.TELEGRAM_BOT_TOKEN,
          spamDetectionEnabled: process.env.SPAM_DETECTION_ENABLED !== 'false',
          maxOrdersPerIpPerHour: parseInt(process.env.MAX_ORDERS_PER_IP_PER_HOUR || '3'),
          duplicateAmountWindowMinutes: parseInt(process.env.DUPLICATE_AMOUNT_WINDOW_MINUTES || '10'),
          monitoringEnabled: process.env.MONITORING_ENABLED !== 'false',
          authTrustHost: process.env.AUTH_TRUST_HOST === 'true',
          authUrl: process.env.AUTH_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000',
          repoOwner: process.env.REPO_OWNER || process.env.GITHUB_REPO_OWNER || 'TheMacroeconomicDao',
          repoName: process.env.REPO_NAME || process.env.GITHUB_REPO_NAME || 'CantonOTC',
          workflowId: process.env.GITHUB_WORKFLOW_ID || 'deploy.yml',
          workflowBranch: process.env.GITHUB_BRANCH || 'minimal-stage',
          // DEX настройки (fallback)
          dexFeePercent: parseFloat(process.env.NEAR_DEX_FEE_PERCENT || '0.3'),
          swapFeePercent: parseFloat(process.env.NEAR_DEX_SWAP_FEE_PERCENT || '0.3'),
          bridgeFeePercent: parseFloat(process.env.NEAR_DEX_BRIDGE_FEE_PERCENT || '0.5'),
          dexFeeRecipient: process.env.NEAR_DEX_FEE_RECIPIENT || '',
          minSwapAmount: parseFloat(process.env.NEAR_DEX_MIN_SWAP_AMOUNT || '0.1'),
          maxSwapAmount: process.env.NEAR_DEX_MAX_SWAP_AMOUNT ? parseFloat(process.env.NEAR_DEX_MAX_SWAP_AMOUNT) : undefined,
          enabledTokens: process.env.NEAR_DEX_ENABLED_TOKENS ? process.env.NEAR_DEX_ENABLED_TOKENS.split(',').map(t => t.trim()) : [],
          enabledChains: process.env.NEAR_DEX_ENABLED_CHAINS ? process.env.NEAR_DEX_ENABLED_CHAINS.split(',').map(c => c.trim()) : ['NEAR', 'AURORA'],
          lastUpdate: new Date(),
          version: `env-v${Date.now()}`
        };
        
        this.config = fallbackConfig;
        this.lastUpdate = new Date();
        
        console.log('✅ Configuration refreshed from process.env (fallback)');
        
        // Сохраняем в localStorage для следующего запуска
        this.saveToLocalStorage();
        
        this.notifyListeners();
        
        return true;
      } else {
        // ✅ На клиенте: используем fetch к /api/config
        console.log('🌐 Client-side: Fetching from /api/config');
        
        // ✅ ИСПРАВЛЕНО: Добавляем AbortController с таймаутом
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 сек таймаут
        
        try {
          const response = await fetch('/api/config', {
            method: 'GET',
            headers: {
              'Cache-Control': 'no-cache'
            },
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch config: ${response.status} ${response.statusText}`);
          }
          
          const newConfig = await response.json();
          
          this.config = {
            ...newConfig,
            lastUpdate: new Date(newConfig.lastUpdate)
          };
          this.lastUpdate = new Date();
          
          console.log('✅ Configuration refreshed from API:', {
            buyPrice: newConfig.cantonCoinBuyPrice,
            sellPrice: newConfig.cantonCoinSellPrice,
            source: newConfig.source
          });
          
          // Сохраняем в localStorage для следующего запуска
          this.saveToLocalStorage();
          
          // Уведомляем слушателей
          this.notifyListeners();
          
          return true;
        } catch (fetchError) {
          clearTimeout(timeoutId);
          console.warn('⚠️ Client config fetch failed, using cached/defaults:', fetchError);
          return false;
        }
      }
    } catch (error) {
      console.error('❌ Error refreshing configuration:', error);
      return false;
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Проверить обновления конфигурации (только из переменных окружения)
   * ⚠️ ИСПРАВЛЕНО: Убрана циклическая зависимость с API
   * ✅ Добавлен дебаунсинг для предотвращения множественных вызовов
   */
  async checkForUpdates(): Promise<boolean> {
    try {
      // ✅ Проверяем, прошло ли достаточно времени с последней проверки (минимум 5 секунд)
      const timeSinceLastCheck = Date.now() - this.lastCheckTime.getTime();
      if (timeSinceLastCheck < 5000) {
        console.log('⏭️ Skipping update check - too soon (last check: ' + Math.round(timeSinceLastCheck / 1000) + 's ago)');
        return false;
      }

      this.lastCheckTime = new Date();
      console.log('🔍 Checking for configuration updates from environment...');
      return await this.refreshConfig();
    } catch (error) {
      console.error('❌ Error checking for updates:', error);
      return false;
    }
  }

  /**
   * Запустить автоматическое обновление
   */
  startAutoRefresh(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }

    this.interval = setInterval(async () => {
      try {
        await this.checkForUpdates();
      } catch (error) {
        console.error('❌ Auto-refresh error:', error);
      }
    }, this.refreshInterval);

    console.log('🔄 Auto-refresh started (60s interval)');
  }

  /**
   * Остановить автоматическое обновление
   */
  stopAutoRefresh(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log('⏹️ Auto-refresh stopped');
    }
  }

  /**
   * Подписаться на изменения конфигурации
   */
  subscribe(listener: (config: ConfigData) => void): () => void {
    this.listeners.push(listener);
    
    // Возвращаем функцию отписки
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Уведомить слушателей об изменениях
   */
  private notifyListeners(): void {
    if (this.config) {
      this.listeners.forEach(listener => {
        try {
          listener(this.config!);
        } catch (error) {
          console.error('❌ Error notifying listener:', error);
        }
      });
    }
  }

  /**
   * Получить конкретное значение конфигурации
   */
  getValue<K extends keyof ConfigData>(key: K): ConfigData[K] | undefined {
    return this.config?.[key];
  }

  /**
   * Установить интервал обновления
   */
  setRefreshInterval(interval: number): void {
    this.refreshInterval = interval;
    
    if (this.interval) {
      this.stopAutoRefresh();
      this.startAutoRefresh();
    }
  }

  /**
   * Получить статистику конфигурации
   */
  getStats(): {
    lastUpdate: Date;
    isFresh: boolean;
    listenersCount: number;
    refreshInterval: number;
  } {
    return {
      lastUpdate: this.lastUpdate,
      isFresh: this.isConfigFresh(),
      listenersCount: this.listeners.length,
      refreshInterval: this.refreshInterval
    };
  }
}

// Экспортируем singleton instance
export const configManager = ConfigManager.getInstance();
