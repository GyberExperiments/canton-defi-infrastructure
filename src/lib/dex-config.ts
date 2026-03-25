/**
 * DEX Configuration Manager
 * Управление настройками DEX через ConfigMap/Admin Panel
 */

import { configManager } from './config-manager'
import { validateNearAccountIdDetailed } from './validators/near-address-validator'

export interface DEXConfig {
  dexFeePercent: number // Комиссия DEX в процентах (0.3 = 0.3%)
  swapFeePercent: number // Комиссия для swap
  bridgeFeePercent: number // Комиссия для bridge
  feeRecipient: string // Адрес получателя комиссий
  minSwapAmount: number // Минимальная сумма для свапа
  maxSwapAmount: number | null // Максимальная сумма
  enabledTokens: string[] // Включенные токены для свапа
  enabledChains: string[] // Включенные блокчейны
}

/**
 * Получить конфигурацию DEX из ConfigManager
 */
export async function getDEXConfig(): Promise<DEXConfig> {
  const config = await configManager.getConfig()
  
  // Fallback значения если config null
  const fallback: DEXConfig = {
    dexFeePercent: 0.3,
    swapFeePercent: 0.003, // 0.3% в долях
    bridgeFeePercent: 0.005, // 0.5% в долях
    feeRecipient: '',
    minSwapAmount: 0.1,
    maxSwapAmount: null,
    enabledTokens: [],
    enabledChains: ['NEAR', 'AURORA'],
  }
  
  if (!config) {
    return {
      ...fallback,
      dexFeePercent: parseFloat(process.env.NEAR_DEX_FEE_PERCENT || '0.3'),
      swapFeePercent: parseFloat(process.env.NEAR_DEX_SWAP_FEE_PERCENT || '0.3') / 100,
      bridgeFeePercent: parseFloat(process.env.NEAR_DEX_BRIDGE_FEE_PERCENT || '0.5') / 100,
      feeRecipient: process.env.NEAR_DEX_FEE_RECIPIENT || '',
      minSwapAmount: parseFloat(process.env.NEAR_DEX_MIN_SWAP_AMOUNT || '0.1'),
      maxSwapAmount: process.env.NEAR_DEX_MAX_SWAP_AMOUNT ? parseFloat(process.env.NEAR_DEX_MAX_SWAP_AMOUNT) : null,
      enabledTokens: process.env.NEAR_DEX_ENABLED_TOKENS ? process.env.NEAR_DEX_ENABLED_TOKENS.split(',').map(t => t.trim()) : [],
      enabledChains: process.env.NEAR_DEX_ENABLED_CHAINS ? process.env.NEAR_DEX_ENABLED_CHAINS.split(',').map(c => c.trim()) : ['NEAR', 'AURORA'],
    }
  }
  
  return {
    dexFeePercent: parseFloat(
      process.env.NEAR_DEX_FEE_PERCENT || 
      config.dexFeePercent?.toString() || 
      '0.3'
    ),
    swapFeePercent: parseFloat(
      process.env.NEAR_DEX_SWAP_FEE_PERCENT || 
      config.swapFeePercent?.toString() || 
      '0.3'
    ) / 100, // Конвертируем проценты в доли
    bridgeFeePercent: parseFloat(
      process.env.NEAR_DEX_BRIDGE_FEE_PERCENT || 
      config.bridgeFeePercent?.toString() || 
      '0.5'
    ) / 100,
    feeRecipient: 
      process.env.NEAR_DEX_FEE_RECIPIENT || 
      config.dexFeeRecipient || 
      '',
    minSwapAmount: parseFloat(
      process.env.NEAR_DEX_MIN_SWAP_AMOUNT || 
      config.minSwapAmount?.toString() || 
      '0.1'
    ),
    maxSwapAmount: config.maxSwapAmount ? parseFloat(config.maxSwapAmount.toString()) : null,
    enabledTokens: config.enabledTokens || [],
    enabledChains: config.enabledChains || ['NEAR', 'AURORA'],
  }
}

/**
 * Получить комиссию для swap
 */
export async function getSwapFee(): Promise<number> {
  const config = await getDEXConfig()
  return config.swapFeePercent
}

/**
 * Получить комиссию для bridge
 */
export async function getBridgeFee(): Promise<number> {
  const config = await getDEXConfig()
  return config.bridgeFeePercent
}

/**
 * Проверить доступен ли токен для свапа
 */
export async function isTokenEnabled(tokenSymbol: string): Promise<boolean> {
  const config = await getDEXConfig()
  if (config.enabledTokens.length === 0) {
    return true // Если список пустой - все токены разрешены
  }
  return config.enabledTokens.includes(tokenSymbol.toUpperCase())
}

/**
 * Получить адрес получателя комиссий
 */
export async function getFeeRecipient(): Promise<string> {
  const config = await getDEXConfig()
  return config.feeRecipient
}

/**
 * Валидирует конфигурацию DEX при старте приложения
 * Проверяет что все обязательные параметры присутствуют и имеют правильный формат
 */
export async function validateDEXConfig(): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = []
  
  try {
    const config = await getDEXConfig()
    
    // Валидация feeRecipient если указан
    if (config.feeRecipient) {
      const validation = validateNearAccountIdDetailed(config.feeRecipient)
      if (!validation.valid) {
        errors.push(`Invalid NEAR_DEX_FEE_RECIPIENT format: ${validation.error}`)
      }
    } else {
      // feeRecipient не обязателен, но рекомендуется для production
      console.warn('⚠️ NEAR_DEX_FEE_RECIPIENT is not set. DEX fees will not be collected.')
    }
    
    // Валидация процентов комиссий
    if (config.dexFeePercent < 0 || config.dexFeePercent > 100) {
      errors.push(`Invalid NEAR_DEX_FEE_PERCENT: must be between 0 and 100, got ${config.dexFeePercent}`)
    }
    
    if (config.swapFeePercent < 0 || config.swapFeePercent > 1) {
      errors.push(`Invalid NEAR_DEX_SWAP_FEE_PERCENT: must be between 0 and 1 (0-100%), got ${config.swapFeePercent}`)
    }
    
    if (config.bridgeFeePercent < 0 || config.bridgeFeePercent > 1) {
      errors.push(`Invalid NEAR_DEX_BRIDGE_FEE_PERCENT: must be between 0 and 1 (0-100%), got ${config.bridgeFeePercent}`)
    }
    
    // Валидация минимальной суммы
    if (config.minSwapAmount < 0) {
      errors.push(`Invalid NEAR_DEX_MIN_SWAP_AMOUNT: must be >= 0, got ${config.minSwapAmount}`)
    }
    
    return {
      valid: errors.length === 0,
      errors
    }
  } catch (error: any) {
    errors.push(`Failed to validate DEX config: ${error.message}`)
    return {
      valid: false,
      errors
    }
  }
}

