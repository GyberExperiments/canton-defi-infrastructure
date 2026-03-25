/**
 * 🎣 React Hook для работы с динамической конфигурацией
 * Позволяет компонентам подписываться на изменения конфигурации
 */

import { useState, useEffect, useCallback } from 'react';
import { configManager, ConfigData } from '@/lib/config-manager';
import { hotReloadManager } from '@/lib/hot-reload-manager';

export interface UseConfigOptions {
  autoRefresh?: boolean;        // Автоматическое обновление
  hotReload?: boolean;          // Hot reload при изменениях
  refreshInterval?: number;    // Интервал обновления (мс)
  debug?: boolean;             // Режим отладки
}

export interface UseConfigReturn {
  config: ConfigData | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<boolean>;
  isFresh: boolean;
  stats: {
    lastUpdate: Date;
    isFresh: boolean;
    listenersCount: number;
    refreshInterval: number;
  };
}

/**
 * Hook для работы с конфигурацией
 */
export function useConfig(options: UseConfigOptions = {}): UseConfigReturn {
  const {
    autoRefresh = true,
    hotReload = true,
    refreshInterval = 60000, // ✅ 60 секунд (было 30) - оптимизация
    debug = false
  } = options;

  const [config, setConfig] = useState<ConfigData | null>(configManager.getConfig());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Функция обновления конфигурации
  const refresh = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (debug) {
        console.log('🔄 useConfig: Refreshing configuration...');
      }
      
      const success = await configManager.refreshConfig();
      
      if (success) {
        const newConfig = configManager.getConfig();
        setConfig(newConfig);
        
        if (debug) {
          console.log('✅ useConfig: Configuration refreshed:', newConfig);
        }
        
        return true;
      } else {
        setError('Failed to refresh configuration');
        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      
      if (debug) {
        console.error('❌ useConfig: Error refreshing configuration:', err);
      }
      
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [debug]);

  // Подписка на изменения конфигурации
  useEffect(() => {
    const unsubscribe = configManager.subscribe((newConfig) => {
      if (debug) {
        console.log('📊 useConfig: Configuration updated:', newConfig);
      }
      setConfig(newConfig);
      setError(null);
    });

    return unsubscribe;
  }, [debug]);

  // Hot reload
  useEffect(() => {
    if (hotReload) {
      hotReloadManager.start();
      
      const unsubscribe = hotReloadManager.subscribe((newConfig) => {
        if (debug) {
          console.log('🔥 useConfig: Hot reload triggered:', newConfig);
        }
        setConfig(newConfig);
        setError(null);
      });

      return () => {
        unsubscribe();
        hotReloadManager.stop();
      };
    }
  }, [hotReload, debug]);

  // Автоматическое обновление
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(async () => {
        try {
          await configManager.checkForUpdates();
        } catch (err) {
          if (debug) {
            console.error('❌ useConfig: Auto-refresh error:', err);
          }
        }
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, debug]);

  // Получение статистики
  const stats = configManager.getStats();
  const isFresh = configManager.isConfigFresh();

  return {
    config,
    isLoading,
    error,
    refresh,
    isFresh,
    stats
  };
}

/**
 * Hook для получения конкретного значения конфигурации
 */
export function useConfigValue<K extends keyof ConfigData>(
  key: K,
  defaultValue?: ConfigData[K],
  options: UseConfigOptions = {}
): ConfigData[K] | undefined {
  const { config } = useConfig(options);
  
  return config?.[key] ?? defaultValue;
}

/**
 * Hook для работы с ценами Canton Coin
 */
export function useCantonPrices(options: UseConfigOptions = {}) {
  const buyPrice = useConfigValue('cantonCoinBuyPrice', 0.25, options);
  const sellPrice = useConfigValue('cantonCoinSellPrice', 0.18, options);
  const legacyPrice = useConfigValue('cantonCoinPrice', '-', options);

  return {
    buyPrice,
    sellPrice,
    legacyPrice,
    spread: buyPrice && sellPrice ? buyPrice - sellPrice : 0,
    spreadPercentage: buyPrice && sellPrice ? ((buyPrice - sellPrice) / buyPrice) * 100 : 0
  };
}

/**
 * Hook для работы с лимитами
 */
export function useLimits(options: UseConfigOptions = {}) {
  const minUsdtAmount = useConfigValue('minUsdtAmount', 1, options);
  const maxUsdtAmount = useConfigValue('maxUsdtAmount', undefined, options);
  const minCantonAmount = useConfigValue('minCantonAmount', 4, options);
  const maxCantonAmount = useConfigValue('maxCantonAmount', undefined, options);

  return {
    minUsdtAmount,
    maxUsdtAmount,
    minCantonAmount,
    maxCantonAmount,
    hasUsdtLimit: maxUsdtAmount !== undefined,
    hasCantonLimit: maxCantonAmount !== undefined
  };
}

/**
 * Hook для работы с настройками бизнеса
 */
export function useBusinessSettings(options: UseConfigOptions = {}) {
  const businessHours = useConfigValue('businessHours', '8:00 AM - 10:00 PM (GMT+8)', options);
  const supportEmail = useConfigValue('supportEmail', 'support@1otc.cc', options);
  const telegramBotUsername = useConfigValue('telegramBotUsername', '@CantonOTC_Bot', options);

  return {
    businessHours,
    supportEmail,
    telegramBotUsername
  };
}

/**
 * Hook для работы с настройками сервисов
 */
export function useServiceSettings(options: UseConfigOptions = {}) {
  const emailServiceEnabled = useConfigValue('emailServiceEnabled', true, options);
  const telegramServiceEnabled = useConfigValue('telegramServiceEnabled', false, options);
  const spamDetectionEnabled = useConfigValue('spamDetectionEnabled', true, options);
  const monitoringEnabled = useConfigValue('monitoringEnabled', true, options);

  return {
    emailServiceEnabled,
    telegramServiceEnabled,
    spamDetectionEnabled,
    monitoringEnabled
  };
}

// Типы уже экспортированы в интерфейсах выше
