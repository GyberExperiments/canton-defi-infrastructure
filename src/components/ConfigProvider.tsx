/**
 * 🔧 ConfigProvider - интеграция новой системы конфигурации
 * Обеспечивает совместимость между старой и новой системами
 */

'use client';

import React, { createContext, useContext, useEffect } from 'react';
import { useConfig } from '@/hooks/useConfig';

interface ConfigContextType {
  // Цены Canton Coin
  cantonCoinBuyPrice: number;
  cantonCoinSellPrice: number;
  cantonCoinPrice: string;
  
  // Лимиты
  minUsdtAmount: number;
  maxUsdtAmount?: number;
  minCantonAmount: number;
  maxCantonAmount?: number;
  
  // Настройки бизнеса
  businessHours: string;
  supportEmail: string;
  telegramBotUsername: string;
  
  // Состояние конфигурации
  isLoading: boolean;
  error: string | null;
  isFresh: boolean;
  
  // Функции
  refresh: () => Promise<boolean>;
}

const ConfigContext = createContext<ConfigContextType | null>(null);

interface ConfigProviderProps {
  children: React.ReactNode;
}

export function ConfigProvider({ children }: ConfigProviderProps) {
  const { config, isLoading, error, refresh, isFresh } = useConfig({
    autoRefresh: true,
    hotReload: true,
    refreshInterval: 300000, // ✅ 5 минут - только как резерв, основное обновление через события
    debug: process.env.NODE_ENV === 'development'
  });
  
  // ✅ Слушаем событие обновления конфигурации
  useEffect(() => {
    const handleConfigUpdate = (event: CustomEvent) => {
      console.log('🔔 Config update event received, refreshing...', event.detail);
      
      // Немедленно обновляем конфигурацию
      refresh().then(() => {
        console.log('✅ Configuration refreshed after config-updated event');
      }).catch(error => {
        console.error('❌ Failed to refresh config after event:', error);
      });
    };
    
    window.addEventListener('config-updated', handleConfigUpdate as EventListener);
    return () => window.removeEventListener('config-updated', handleConfigUpdate as EventListener);
  }, [refresh]);

  // ✅ ИСПРАВЛЕНО: Используем config напрямую, без промежуточного fallback state
  // Это гарантирует что как только config загрузится, он сразу применится
  const currentConfig = config;

  const contextValue: ConfigContextType = {
    // ✅ Цены Canton Coin - используем config с fallback из ConfigMap
    cantonCoinBuyPrice: currentConfig?.cantonCoinBuyPrice ?? 0.77,
    cantonCoinSellPrice: currentConfig?.cantonCoinSellPrice ?? 0.22,
    cantonCoinPrice: currentConfig?.cantonCoinPrice ?? '0.50',
    
    // Лимиты
    minUsdtAmount: currentConfig?.minUsdtAmount || 1,
    maxUsdtAmount: currentConfig?.maxUsdtAmount,
    minCantonAmount: currentConfig?.minCantonAmount || 1,
    maxCantonAmount: currentConfig?.maxCantonAmount,
    
    // Настройки бизнеса
    businessHours: currentConfig?.businessHours || '8:00 AM - 10:00 PM (GMT+8)',
    supportEmail: currentConfig?.supportEmail || 'support@cantonotc.com',
    telegramBotUsername: currentConfig?.telegramBotUsername || '@canton_otc_bot',
    
    // Состояние конфигурации
    isLoading,
    error,
    isFresh: isFresh || !config, // Если нет новой конфигурации, считаем свежей
    
    // Функции
    refresh
  };

  return (
    <ConfigContext.Provider value={contextValue}>
      {children}
    </ConfigContext.Provider>
  );
}

// Hook для использования конфигурации в компонентах
export function useConfigContext(): ConfigContextType {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfigContext must be used within a ConfigProvider');
  }
  return context;
}

// Hook для получения цен Canton Coin
export function useCantonPrices() {
  const { cantonCoinBuyPrice, cantonCoinSellPrice, cantonCoinPrice } = useConfigContext();
  
  return {
    buyPrice: cantonCoinBuyPrice,
    sellPrice: cantonCoinSellPrice,
    legacyPrice: cantonCoinPrice,
    spread: cantonCoinBuyPrice - cantonCoinSellPrice,
    spreadPercentage: ((cantonCoinBuyPrice - cantonCoinSellPrice) / cantonCoinBuyPrice) * 100
  };
}

// Hook для получения лимитов
export function useLimits() {
  const { minUsdtAmount, maxUsdtAmount, minCantonAmount, maxCantonAmount } = useConfigContext();
  
  return {
    minUsdtAmount,
    maxUsdtAmount,
    minCantonAmount,
    maxCantonAmount,
    hasUsdtLimit: maxUsdtAmount !== undefined,
    hasCantonLimit: maxCantonAmount !== undefined
  };
}

// Hook для получения настроек бизнеса
export function useBusinessSettings() {
  const { businessHours, supportEmail, telegramBotUsername } = useConfigContext();
  
  return {
    businessHours,
    supportEmail,
    telegramBotUsername
  };
}

// Hook для получения состояния конфигурации
export function useConfigState() {
  const { isLoading, error, isFresh, refresh } = useConfigContext();
  
  return {
    isLoading,
    error,
    isFresh,
    refresh
  };
}
