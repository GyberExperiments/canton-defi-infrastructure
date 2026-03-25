/**
 * NEAR Wallet Utilities
 * Утилиты для работы с NEAR кошельком и подписанием транзакций
 */

import { getTestnetRpcProvider, getProviderByNetwork } from '@near-js/client'

export interface TransactionData {
  receiverId: string
  methodName: string
  args: Record<string, any>
  gas: string
  attachedDeposit: string
}

/**
 * Получает NEAR RPC provider для указанной сети
 */
export function getNearRpcProvider(network: 'mainnet' | 'testnet') {
  return network === 'testnet'
    ? getTestnetRpcProvider()
    : getProviderByNetwork('mainnet')
}

/**
 * Подписывает транзакцию через NEAR Wallet Selector
 * @param transactionData Данные транзакции для подписания
 * @param accountId ID аккаунта пользователя
 * @returns Хеш транзакции или null
 */
export async function signTransactionWithWallet(
  transactionData: TransactionData,
  accountId: string
): Promise<string | null> {
  try {
    // Проверяем наличие wallet selector
    if (typeof window === 'undefined' || !(window as any).selector) {
      throw new Error('NEAR Wallet Selector is not available')
    }

    const selector = (window as any).selector
    const accounts = selector.getAccounts()

    if (!accounts || accounts.length === 0) {
      throw new Error('Wallet is not connected')
    }

    // Получаем аккаунт из selector
    const account = accounts.find((acc: any) => acc.accountId === accountId)
    if (!account) {
      throw new Error(`Account ${accountId} not found`)
    }

    // Получаем wallet из selector
    const wallet = await selector.wallet()
    
    // Подписываем транзакцию
    const result = await wallet.signAndSendTransaction({
      receiverId: transactionData.receiverId,
      actions: [
        {
          type: 'FunctionCall',
          params: {
            methodName: transactionData.methodName,
            args: transactionData.args,
            gas: transactionData.gas,
            deposit: transactionData.attachedDeposit,
          },
        },
      ],
    })

    // Возвращаем transaction hash
    return result?.transaction?.hash || result?.transactionHash || null
  } catch (error: any) {
    console.error('Ошибка при подписании транзакции:', error)
    throw error
  }
}

/**
 * Альтернативный метод: подписание через redirect на wallet.near.org
 * Используется если wallet selector недоступен
 */
export function signTransactionViaRedirect(
  transactionData: TransactionData,
  accountId: string,
  network: 'mainnet' | 'testnet' = 'testnet'
): void {
  try {
    const walletUrl = network === 'mainnet' 
      ? 'https://wallet.near.org'
      : 'https://wallet.testnet.near.org'
    
    // Кодируем транзакцию в URL параметры для wallet
    const transactionParams = {
      receiverId: transactionData.receiverId,
      methodName: transactionData.methodName,
      args: transactionData.args,
      gas: transactionData.gas,
      deposit: transactionData.attachedDeposit,
    }

    // Создаем URL для подписания транзакции
    const redirectUrl = `${walletUrl}/sign?${new URLSearchParams({
      contract_id: transactionData.receiverId,
      method_name: transactionData.methodName,
      args: JSON.stringify(transactionData.args),
      gas: transactionData.gas,
      deposit: transactionData.attachedDeposit,
      callback_url: window.location.href,
    })}`

    window.location.href = redirectUrl
  } catch (error: any) {
    console.error('Ошибка при создании redirect URL:', error)
    throw error
  }
}

/**
 * Универсальная функция подписания транзакции
 * Пытается использовать wallet selector, если недоступен - делает redirect
 */
export async function signTransaction(
  transactionData: TransactionData,
  accountId: string,
  network: 'mainnet' | 'testnet' = 'testnet'
): Promise<string | null> {
  try {
    // Сначала пытаемся через wallet selector
    if (typeof window !== 'undefined' && (window as any).selector) {
      return await signTransactionWithWallet(transactionData, accountId)
    }
    
    // Fallback: redirect на wallet.near.org
    signTransactionViaRedirect(transactionData, accountId, network)
    return null // redirect не возвращает hash сразу
  } catch (error: any) {
    console.error('Ошибка при подписании транзакции:', error)
    throw error
  }
}
