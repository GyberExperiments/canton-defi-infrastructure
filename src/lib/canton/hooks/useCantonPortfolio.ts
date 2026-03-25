'use client';

/**
 * 🏛️ CANTON PORTFOLIO INTEGRATION
 * 
 * Интеграция Canton Network в портфолио пользователя
 * Подключается к реальной Canton API через realCantonIntegration
 */

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import Decimal from 'decimal.js';
import { useRealCantonNetwork, type CantonPortfolio, type CantonAssetHolding } from './realCantonIntegration';
import { safeDecimalToNumber } from '../utils/decimalFormatter';

export interface CantonPortfolioData {
  balance: string;
  value: number;
  assets: CantonAssetHolding[];
  yieldEarned: number;
  complianceStatus: string;
}

/**
 * 🎯 Hook для интеграции Canton данных в основное портфолио
 */
export const useCantonPortfolio = () => {
  const { isConnected } = useAccount();
  const { 
    userPortfolio, 
    networkStatus, 
    isLoading, 
    fetchUserPortfolio 
  } = useRealCantonNetwork();

  const [cantonData, setCantonData] = useState<CantonPortfolioData | null>(null);

  // 📊 Обновляем данные при изменении портфолио Canton
  useEffect(() => {
    if (userPortfolio && networkStatus === 'CONNECTED') {
      // Calculate total balance from holdings
      const totalBalance = userPortfolio.assets.reduce((sum: Decimal, asset: CantonAssetHolding) => {
        const assetValue = asset.currentMarketValue || new Decimal(0);
        return sum.plus(assetValue);
      }, new Decimal(0));

      setCantonData({
        balance: totalBalance.dividedBy(125.80).toFixed(4), // Конвертация в количество токенов
        value: safeDecimalToNumber(userPortfolio.totalValue),
        assets: userPortfolio.assets,
        yieldEarned: safeDecimalToNumber(userPortfolio.totalYieldEarned || new Decimal(0)),
        complianceStatus: userPortfolio.complianceStatus || 'FULLY_COMPLIANT'
      });
    } else if (!isConnected || networkStatus !== 'CONNECTED') {
      setCantonData(null);
    }
  }, [userPortfolio, networkStatus, isConnected]);

  return {
    cantonData,
    isLoading,
    isConnected: networkStatus === 'CONNECTED',
    refreshData: fetchUserPortfolio
  };
};
