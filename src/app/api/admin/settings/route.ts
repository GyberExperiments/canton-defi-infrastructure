/**
 * ⚙️ Admin API - System Settings
 * ✅ БЕЗОПАСНОЕ управление настройками через ConfigMap
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { SUPPORTED_TOKENS } from '@/config/otc';
// ✅ Убираем прямой импорт kubernetes-config (будет динамический)
import { configManager } from '@/lib/config-manager';
import { 
  validateSettingsUpdate, 
  checkRateLimit, 
  logAuditEvent,
  safeLog 
} from '@/lib/security';

// Принудительно делаем route динамическим
export const dynamic = 'force-dynamic';

/**
 * GET - Получить текущие настройки
 * ✅ ИСПРАВЛЕНО: Читаем из ConfigManager вместо статического OTC_CONFIG
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ✅ Обновляем конфигурацию перед чтением
    console.log('🔄 GET /admin/settings: Refreshing config from ConfigMap...');
    await configManager.refreshConfig();
    
    // ✅ Получаем актуальную конфигурацию из ConfigManager
    const currentConfig = configManager.getConfig();
    
    if (!currentConfig) {
      console.warn('⚠️ ConfigManager returned null, returning minimal config');
      // Возвращаем минимальную конфигурацию без цен
      return NextResponse.json({
        cantonCoinBuyPrice: 0,
        cantonCoinSellPrice: 0,
        cantonCoinPrice: '0',
        minAmount: 1,
        maxAmount: null,
        minCantonAmount: 1,
        maxCantonAmount: null,
        supportedTokens: SUPPORTED_TOKENS,
        businessHours: '8:00 AM - 10:00 PM (GMT+8)',
        telegram: {
          botUsername: '@canton_otc_bot',
          configured: false
        },
        googleSheets: {
          configured: false
        },
        _source: 'fallback-minimal'
      });
    }

    console.log('✅ GET /admin/settings: Returning config from ConfigManager:', {
      buyPrice: currentConfig.cantonCoinBuyPrice,
      sellPrice: currentConfig.cantonCoinSellPrice,
      version: currentConfig.version
    });

    // ✅ Возвращаем актуальные значения из ConfigMap
    return NextResponse.json({
      // New separate prices (вычисляемые или статичные)
      cantonCoinBuyPrice: currentConfig.cantonCoinBuyPrice,
      cantonCoinSellPrice: currentConfig.cantonCoinSellPrice,
      // Legacy single price for backward compatibility
      cantonCoinPrice: currentConfig.cantonCoinPrice,
      // Динамическое ценообразование
      useDynamicPricing: currentConfig.useDynamicPricing,
      buyMarkupPercent: currentConfig.buyMarkupPercent,
      sellMarkupPercent: currentConfig.sellMarkupPercent,
      // Updated limits
      minAmount: currentConfig.minUsdtAmount,
      maxAmount: currentConfig.maxUsdtAmount || null,
      // Canton limits
      minCantonAmount: currentConfig.minCantonAmount,
      maxCantonAmount: currentConfig.maxCantonAmount || null,
      supportedTokens: SUPPORTED_TOKENS,
      businessHours: currentConfig.businessHours,
      telegram: {
        botUsername: currentConfig.telegramBotUsername,
        configured: !!process.env.TELEGRAM_BOT_TOKEN
      },
      googleSheets: {
        configured: !!process.env.GOOGLE_SHEET_ID
      },
      // DEX настройки
      dexFeePercent: currentConfig.dexFeePercent || 0.3,
      swapFeePercent: currentConfig.swapFeePercent || 0.3,
      bridgeFeePercent: currentConfig.bridgeFeePercent || 0.5,
      dexFeeRecipient: currentConfig.dexFeeRecipient || '',
      minSwapAmount: currentConfig.minSwapAmount || 0.1,
      maxSwapAmount: currentConfig.maxSwapAmount || null,
      enabledTokens: currentConfig.enabledTokens || [],
      enabledChains: currentConfig.enabledChains || ['NEAR', 'AURORA'],
      // Service commission
      serviceCommission: currentConfig.serviceCommission ?? parseFloat(process.env.SERVICE_COMMISSION_PERCENT || '1'),
      _source: currentConfig.version,
      _lastUpdate: currentConfig.lastUpdate
    });
  } catch (error) {
    console.error('Admin API - Get settings error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - ✅ БЕЗОПАСНОЕ обновление настройки с защитой секретов
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const updates = await request.json();
    const userEmail = session.user?.email || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

    // ✅ ВАЛИДАЦИЯ входных данных
    const validation = validateSettingsUpdate(updates);
    
    if (!validation.isValid) {
      logAuditEvent(userEmail, 'SETTINGS_UPDATE_FAILED', {
        reason: 'validation_failed',
        errors: validation.errors,
        updates
      }, ip, userAgent);
      
      return NextResponse.json({
        error: 'Validation failed',
        details: validation.errors,
        warnings: validation.warnings
      }, { status: 400 });
    }

    // ✅ ДОПОЛНИТЕЛЬНАЯ ВАЛИДАЦИЯ: Проверка разумности цен
    if (updates.cantonCoinBuyPrice !== undefined && updates.cantonCoinSellPrice !== undefined) {
      if (updates.cantonCoinBuyPrice <= updates.cantonCoinSellPrice) {
        return NextResponse.json({
          error: 'Buy price must be higher than sell price'
        }, { status: 400 });
      }
    }

    // ✅ Предупреждение о больших изменениях (но не блокируем)
    if (updates.cantonCoinBuyPrice !== undefined) {
      // Проверяем большие изменения относительно текущей цены
      const currentPrice = configManager.getConfig()?.cantonCoinBuyPrice || 0;
      if (currentPrice > 0) {
        const priceChange = Math.abs(updates.cantonCoinBuyPrice - currentPrice);
        const changePercent = (priceChange / currentPrice) * 100;
      
        if (changePercent > 50) {
          console.warn(`⚠️ Large price change detected: ${changePercent.toFixed(1)}% change in buy price`);
          // Только предупреждение, не блокируем
        }
      }
    }

    // ✅ RATE LIMITING: Защита от злоупотреблений
    const RATE_LIMIT_KEY = `admin-settings-${userEmail}`;
    
    if (!checkRateLimit(RATE_LIMIT_KEY, 10000)) { // 10 секунд
      logAuditEvent(userEmail, 'SETTINGS_UPDATE_RATE_LIMITED', {
        updates
      }, ip, userAgent);
      
      return NextResponse.json({
        error: 'Rate limit exceeded. Please wait before making another update.'
      }, { status: 429 });
    }

    // ✅ АУДИТ: Логирование всех изменений
    logAuditEvent(userEmail, 'SETTINGS_UPDATE_ATTEMPT', {
      changes: updates,
      warnings: validation.warnings
    }, ip, userAgent);

    // ✅ ОБНОВЛЕНИЕ CONFIGMAP (новая архитектура)
    try {
      console.log('🔧 Getting Kubernetes ConfigMap manager...');
      
      // ✅ Динамический импорт только на сервере
      const { getKubernetesConfigManager } = await import('@/lib/kubernetes-config');
      const k8sManager = getKubernetesConfigManager();
      const k8sStatus = k8sManager.getStatus();
      
      console.log('📊 Kubernetes status:', k8sStatus);
      
      const configUpdates = [];

      // ✅ Подготовка обновлений для ConfigMap
      if (updates.cantonCoinBuyPrice !== undefined) {
        configUpdates.push({
          key: 'CANTON_COIN_BUY_PRICE_USD',
          value: updates.cantonCoinBuyPrice.toString()
        });
      }

      if (updates.cantonCoinSellPrice !== undefined) {
        configUpdates.push({
          key: 'CANTON_COIN_SELL_PRICE_USD',
          value: updates.cantonCoinSellPrice.toString()
        });
    }

    if (updates.minAmount !== undefined) {
        configUpdates.push({
          key: 'MIN_USDT_AMOUNT',
          value: updates.minAmount.toString()
        });
      }

      if (updates.maxAmount !== undefined) {
        configUpdates.push({
          key: 'MAX_USDT_AMOUNT',
          value: updates.maxAmount?.toString() || ''
        });
      }

      if (updates.businessHours !== undefined) {
        configUpdates.push({
          key: 'BUSINESS_HOURS',
          value: updates.businessHours
        });
      }

      if (updates.supportEmail !== undefined) {
        configUpdates.push({
          key: 'SUPPORT_EMAIL',
          value: updates.supportEmail
        });
      }

      if (updates.telegramBotUsername !== undefined) {
        configUpdates.push({
          key: 'TELEGRAM_BOT_USERNAME',
          value: updates.telegramBotUsername
        });
      }

      // ✅ Новые поля для динамического ценообразования
      if (updates.useDynamicPricing !== undefined) {
        configUpdates.push({
          key: 'USE_DYNAMIC_PRICING',
          value: updates.useDynamicPricing ? 'true' : 'false'
        });
      }

      if (updates.buyMarkupPercent !== undefined) {
        configUpdates.push({
          key: 'BUY_MARKUP_PERCENT',
          value: updates.buyMarkupPercent.toString()
        });
      }

      if (updates.sellMarkupPercent !== undefined) {
        configUpdates.push({
          key: 'SELL_MARKUP_PERCENT',
          value: updates.sellMarkupPercent.toString()
        });
      }

      // Service commission
      if (updates.serviceCommission !== undefined) {
        configUpdates.push({
          key: 'SERVICE_COMMISSION_PERCENT',
          value: updates.serviceCommission.toString()
        });
      }

      // ✅ Обновление ConfigMap
      if (configUpdates.length > 0) {
        safeLog('🔄 Updating ConfigMap:', {
          updates: configUpdates.map(u => u.key),
          user: userEmail
        });
        
        console.log('🔄 Calling Kubernetes API to update ConfigMap...');
        const success = await k8sManager.updateConfigMap(configUpdates);
        
        if (!success) {
          console.error('❌ Failed to update ConfigMap');
          logAuditEvent(userEmail, 'SETTINGS_UPDATE_CONFIGMAP_FAILURE', {
            updates: configUpdates,
            userUpdates: updates
          }, ip, userAgent);
          
          return NextResponse.json({
            error: 'Failed to update ConfigMap',
            details: 'ConfigMap update operation failed. Changes may not be persisted.'
          }, { status: 500 });
        }

        safeLog('✅ ConfigMap updated successfully:', {
          updates: configUpdates.map(u => u.key),
          user: userEmail
        });

        // ✅ МГНОВЕННОЕ применение изменений через ConfigManager
        console.log('🔄 Updating ConfigManager for instant application...');
        await configManager.refreshConfig();
        console.log('✅ ConfigManager updated');

        // ✅ УСПЕШНЫЙ АУДИТ
        logAuditEvent(userEmail, 'SETTINGS_UPDATE_SUCCESS', {
          configMapUpdates: configUpdates.map(u => u.key),
          updates
        }, ip, userAgent);

        return NextResponse.json({
          success: true,
          message: 'Settings successfully updated in ConfigMap and applied instantly!',
          updates,
          configMap: {
            updated: configUpdates.map(u => u.key),
            namespace: k8sStatus.namespace,
            name: k8sStatus.configMapName,
            inCluster: k8sStatus.inCluster
          },
          instructions: [
            '✅ Settings updated in ConfigMap',
            '⚡ Changes applied instantly',
            '🔄 New values available immediately',
            '📊 ConfigManager automatically updated'
          ],
          warnings: validation.warnings
        });
      }

    } catch (configMapError) {
      console.error('❌ ConfigMap error:', configMapError);
      console.error('❌ Error details:', {
        message: configMapError instanceof Error ? configMapError.message : 'Unknown error',
        stack: configMapError instanceof Error ? configMapError.stack : undefined,
        name: configMapError instanceof Error ? configMapError.name : undefined
      });
      
      logAuditEvent(userEmail, 'SETTINGS_UPDATE_CONFIGMAP_ERROR', {
        error: configMapError instanceof Error ? configMapError.message : 'Unknown error',
        updates
      }, ip, userAgent);
      
      // ✅ FALLBACK: Обновляем только локальный ConfigManager
      console.warn('⚠️ Using fallback mode - updating ConfigManager only');
      
      try {
        // Обновляем process.env напрямую
        if (updates.cantonCoinBuyPrice !== undefined) {
          process.env.CANTON_COIN_BUY_PRICE_USD = updates.cantonCoinBuyPrice.toString();
        }
        if (updates.cantonCoinSellPrice !== undefined) {
          process.env.CANTON_COIN_SELL_PRICE_USD = updates.cantonCoinSellPrice.toString();
        }
        if (updates.minAmount !== undefined) {
          process.env.MIN_USDT_AMOUNT = updates.minAmount.toString();
        }
        if (updates.maxAmount !== undefined) {
          process.env.MAX_USDT_AMOUNT = updates.maxAmount?.toString() || '';
        }
        if (updates.businessHours !== undefined) {
          process.env.BUSINESS_HOURS = updates.businessHours;
        }
        if (updates.supportEmail !== undefined) {
          process.env.SUPPORT_EMAIL = updates.supportEmail;
        }
        if (updates.telegramBotUsername !== undefined) {
          process.env.TELEGRAM_BOT_USERNAME = updates.telegramBotUsername;
        }
        
        // Обновляем ConfigManager
        await configManager.refreshConfig();
        
        return NextResponse.json({
          success: true,
          message: 'Settings updated locally (development mode)',
          updates,
          warning: 'ConfigMap unavailable. Changes applied locally only and will be lost on restart.',
          details: 'This is local development mode. In production, changes are saved to ConfigMap.'
        });
      } catch (fallbackError) {
        console.error('❌ Fallback mode error:', fallbackError);
        return NextResponse.json({
          error: 'Failed to update settings',
          details: 'Both ConfigMap and fallback updates failed'
        }, { status: 500 });
      }
    }

    // Fallback: если нет изменений
    logAuditEvent(userEmail, 'SETTINGS_UPDATE_NO_CHANGES', {
      updates
    }, ip, userAgent);

    return NextResponse.json({
      success: true,
      message: 'No changes to apply',
      updates,
      warnings: validation.warnings
    });

  } catch (error) {
    console.error('Admin API - Update settings error:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}

