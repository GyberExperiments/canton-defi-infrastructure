/**
 * 📊 Public API для получения актуальной конфигурации
 * Читает напрямую из ConfigMap (не из process.env) для гарантии актуальности
 */

import { NextResponse } from 'next/server';

/**
 * GET /api/config - Получить актуальную конфигурацию
 * Этот эндпоинт читает напрямую из Kubernetes ConfigMap
 */
export async function GET() {
  try {
    // ✅ Используем ConfigManager для получения актуальных цен (с учетом динамического ценообразования)
    // ConfigManager сам читает из ConfigMap и рассчитывает динамические цены если нужно
    const { configManager } = await import('@/lib/config-manager');
    await configManager.refreshConfig();
    const currentConfig = configManager.getConfig();
    
    let config;
    
    if (currentConfig) {
      // ✅ Используем данные из ConfigManager (уже учитывает динамическое ценообразование)
      console.log('📊 Reading config from ConfigManager');
      
      config = {
        // Цены Canton Coin - вычисляемые через ConfigManager (учитывает динамическое ценообразование)
        cantonCoinBuyPrice: currentConfig.cantonCoinBuyPrice,
        cantonCoinSellPrice: currentConfig.cantonCoinSellPrice,
        cantonCoinPrice: currentConfig.cantonCoinPrice,
        
        // Лимиты
        minUsdtAmount: currentConfig.minUsdtAmount,
        maxUsdtAmount: currentConfig.maxUsdtAmount,
        
        // Бизнес настройки
        businessHours: currentConfig.businessHours,
        supportEmail: currentConfig.supportEmail,
        telegramBotUsername: currentConfig.telegramBotUsername,
        
        // Вычисляемые поля
        minCantonAmount: currentConfig.minCantonAmount,
        maxCantonAmount: currentConfig.maxCantonAmount,
        
        // Service commission
        serviceCommission: parseFloat(process.env.SERVICE_COMMISSION_PERCENT || '1'),
        
        // Технические поля
        nodeEnv: currentConfig.nodeEnv,
        nextPublicAppUrl: currentConfig.nextPublicAppUrl,
        redisUrl: currentConfig.redisUrl,
        
        // Настройки сервисов
        emailServiceEnabled: currentConfig.emailServiceEnabled,
        telegramServiceEnabled: currentConfig.telegramServiceEnabled,
        spamDetectionEnabled: currentConfig.spamDetectionEnabled,
        maxOrdersPerIpPerHour: currentConfig.maxOrdersPerIpPerHour,
        duplicateAmountWindowMinutes: currentConfig.duplicateAmountWindowMinutes,
        monitoringEnabled: currentConfig.monitoringEnabled,
        
        // Auth настройки
        authTrustHost: currentConfig.authTrustHost,
        authUrl: currentConfig.authUrl,
        
        // GitHub настройки
        repoOwner: currentConfig.repoOwner,
        repoName: currentConfig.repoName,
        workflowId: currentConfig.workflowId,
        workflowBranch: currentConfig.workflowBranch,
        
        // Метаданные
        lastUpdate: currentConfig.lastUpdate,
        version: currentConfig.version,
        source: 'configmap'
      };
    } else {
      // ⚠️ Fallback к process.env если ConfigMap недоступен
      console.warn('⚠️ ConfigMap unavailable, using process.env fallback');
      
      config = {
        // ⚠️ Fallback режим - используется только когда ConfigMap недоступен
        // В production цены ДОЛЖНЫ браться из ConfigMap
        cantonCoinBuyPrice: parseFloat(process.env.CANTON_COIN_BUY_PRICE_USD || '0.21'), // Fallback для разработки
        cantonCoinSellPrice: parseFloat(process.env.CANTON_COIN_SELL_PRICE_USD || '0.19'), // Fallback для разработки
        cantonCoinPrice: process.env.CANTON_COIN_PRICE_USD || '0.20',
        minUsdtAmount: parseFloat(process.env.MIN_USDT_AMOUNT || '1'),
        maxUsdtAmount: process.env.MAX_USDT_AMOUNT ? parseFloat(process.env.MAX_USDT_AMOUNT) : undefined,
        businessHours: process.env.BUSINESS_HOURS || '8:00 AM - 10:00 PM (GMT+8)',
        supportEmail: process.env.SUPPORT_EMAIL || 'support@cantonotc.com',
        telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME || '@canton_otc_bot',
        minCantonAmount: 1, // Не можем вычислить без цены
        maxCantonAmount: undefined, // Не можем вычислить без цены
        serviceCommission: parseFloat(process.env.SERVICE_COMMISSION_PERCENT || '1'),
        nodeEnv: process.env.NODE_ENV || 'production',
        nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL || '',
        redisUrl: process.env.REDIS_URL || '',
        emailServiceEnabled: process.env.EMAIL_SERVICE_ENABLED === 'true',
        telegramServiceEnabled: !!process.env.TELEGRAM_BOT_TOKEN,
        spamDetectionEnabled: process.env.SPAM_DETECTION_ENABLED !== 'false',
        maxOrdersPerIpPerHour: parseInt(process.env.MAX_ORDERS_PER_IP_PER_HOUR || '3'),
        duplicateAmountWindowMinutes: parseInt(process.env.DUPLICATE_AMOUNT_WINDOW_MINUTES || '10'),
        monitoringEnabled: process.env.MONITORING_ENABLED !== 'false',
        authTrustHost: process.env.AUTH_TRUST_HOST === 'true',
        authUrl: process.env.AUTH_URL || process.env.NEXTAUTH_URL || '',
        repoOwner: process.env.REPO_OWNER || process.env.GITHUB_REPO_OWNER || 'TheMacroeconomicDao',
        repoName: process.env.REPO_NAME || process.env.GITHUB_REPO_NAME || 'CantonOTC',
        workflowId: process.env.GITHUB_WORKFLOW_ID || 'deploy.yml',
        workflowBranch: process.env.GITHUB_BRANCH || 'minimal-stage',
        lastUpdate: new Date(),
        version: `env-v${Date.now()}`,
        source: 'process.env'
      };
    }
    
    return NextResponse.json(config, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching config:', error);
    
    // В случае ошибки всё равно возвращаем fallback конфигурацию
    return NextResponse.json({
      // ❗ Fallback значения для разработки
      cantonCoinBuyPrice: 0.21,
      cantonCoinSellPrice: 0.19,
      cantonCoinPrice: process.env.CANTON_COIN_PRICE_USD || '0.20',
      minUsdtAmount: parseFloat(process.env.MIN_USDT_AMOUNT || '1'),
      maxUsdtAmount: process.env.MAX_USDT_AMOUNT ? parseFloat(process.env.MAX_USDT_AMOUNT) : undefined,
      minCantonAmount: 4,
      maxCantonAmount: undefined,
      serviceCommission: parseFloat(process.env.SERVICE_COMMISSION_PERCENT || '1'),
      businessHours: '8:00 AM - 10:00 PM (GMT+8)',
      supportEmail: 'support@cantonotc.com',
      telegramBotUsername: '@canton_otc_bot',
      nodeEnv: 'production',
      nextPublicAppUrl: '',
      redisUrl: '',
      emailServiceEnabled: false,
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
      version: 'fallback',
      source: 'fallback'
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    });
  }
}

