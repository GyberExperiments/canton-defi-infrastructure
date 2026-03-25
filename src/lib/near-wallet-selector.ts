/**
 * NEAR Wallet Selector Setup
 * Инициализация wallet selector для удобного подключения кошельков
 */

import { setupWalletSelector } from '@near-wallet-selector/core'
import { setupModal } from '@near-wallet-selector/modal-ui'
import { setupMeteorWallet } from '@near-wallet-selector/meteor-wallet'
import { setupHereWallet } from '@near-wallet-selector/here-wallet'
import '@near-wallet-selector/modal-ui/styles.css'

export interface WalletSelectorConfig {
  network: 'mainnet' | 'testnet'
  contractId?: string
}

let selector: any = null
let modal: any = null

/**
 * Инициализирует NEAR Wallet Selector
 */
export async function initWalletSelector(config: WalletSelectorConfig) {
  if (typeof window === 'undefined') {
    return null
  }

  if (selector) {
    return selector
  }

  try {
    // Создаем wallet selector
    selector = await setupWalletSelector({
      network: config.network,
      modules: [
        setupMeteorWallet(),
        setupHereWallet(),
      ],
    })

    // Создаем модальное окно для выбора кошелька
    modal = setupModal(selector, {
      contractId: config.contractId || 'app.near',
    })

    return selector
  } catch (error) {
    console.error('Failed to initialize wallet selector:', error)
    return null
  }
}

/**
 * Получает инициализированный wallet selector
 */
export function getWalletSelector() {
  return selector
}

/**
 * Получает модальное окно wallet selector
 */
export function getWalletModal() {
  return modal
}

/**
 * Показывает модальное окно выбора кошелька
 */
export function showWalletModal() {
  if (modal) {
    modal.show()
  }
}

/**
 * Скрывает модальное окно выбора кошелька
 */
export function hideWalletModal() {
  if (modal) {
    modal.hide()
  }
}

