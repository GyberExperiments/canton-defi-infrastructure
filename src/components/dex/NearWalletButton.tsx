'use client'

import React, { useState, useEffect } from 'react'
import { Wallet, LogOut, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { toast } from 'react-hot-toast'
import { getWalletSelector, showWalletModal } from '@/lib/near-wallet-selector'
import { getNearBalance } from '@/lib/near-balance'

interface NearWalletButtonProps {
  onConnect: () => void
  onDisconnect: () => void
}

export default function NearWalletButton({ onConnect, onDisconnect }: NearWalletButtonProps) {
  const [accountId, setAccountId] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)

  useEffect(() => {
    // Проверяем сохраненное подключение
    if (typeof window !== 'undefined') {
      const savedAccount = localStorage.getItem('near_wallet_account')
      if (savedAccount) {
        setAccountId(savedAccount)
        onConnect()
      }
      
      // Проверяем подключение через NEAR Wallet Selector если доступен
      checkWalletConnection()
    }
  }, [onConnect])

  const checkWalletConnection = async () => {
    try {
      // Проверяем наличие wallet selector
      const selector = getWalletSelector()
      if (selector) {
        const accounts = selector.store.getState().accounts
        if (accounts && accounts.length > 0) {
          const account = accounts[0]
          setAccountId(account.accountId)
          localStorage.setItem('near_wallet_account', account.accountId)
          onConnect()
        }
      }
    } catch (error) {
      console.log('Wallet selector not available:', error)
    }
  }

  const handleConnect = async () => {
    setIsConnecting(true)
    try {
      const selector = getWalletSelector()
      
      if (selector) {
        // Используем wallet selector modal для выбора кошелька
        showWalletModal()
        
        // Подписываемся на изменения аккаунтов
        selector.on('accountsChanged', async (accounts: any[]) => {
        if (accounts && accounts.length > 0) {
          const account = accounts[0]
            const accountIdValue = account.accountId
            
            try {
              // Проверяем баланс после подключения
              const network = (process.env.NEXT_PUBLIC_NEAR_NETWORK || 'testnet') as 'mainnet' | 'testnet'
              const balance = await getNearBalance(accountIdValue, network)
              
              if (balance) {
                const balanceNum = parseFloat(balance.balance)
                const minBalance = 0.01 // Минимальный баланс для работы (0.01 NEAR)
                
                if (balanceNum < minBalance) {
                  toast.error(
                    `Недостаточно средств. Баланс: ${balanceNum.toFixed(4)} NEAR. Минимум: ${minBalance} NEAR`,
                    {
                      icon: <AlertCircle className="w-5 h-5 text-yellow-400" />,
                      duration: 6000,
                    }
                  )
                  toast(
                    <div className="text-sm">
                      <p className="font-semibold mb-1">Пополните баланс для продолжения:</p>
                      <p className="text-xs text-gray-300">
                        Для testnet: <a 
                          href="https://faucet.testnet.near.org/" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline"
                        >
                          faucet.testnet.near.org
                        </a>
                      </p>
                    </div>,
                    {
                      duration: 10000,
                      icon: <AlertCircle className="w-5 h-5 text-blue-400" />,
                    }
                  )
                } else {
                  toast.success('Wallet connected', {
                    icon: <Wallet className="w-5 h-5 text-green-400" />,
                  })
                }
              } else {
                // Если баланс не удалось получить, всё равно подключаем, но предупреждаем
                console.warn('Could not fetch balance for account:', accountIdValue)
                toast.success('Wallet connected', {
                  icon: <Wallet className="w-5 h-5 text-green-400" />,
                })
              }
              
              setAccountId(accountIdValue)
              localStorage.setItem('near_wallet_account', accountIdValue)
              onConnect()
            } catch (balanceError: any) {
              console.error('Error checking balance:', balanceError)
              // Если ошибка при проверке баланса, всё равно подключаем
              setAccountId(accountIdValue)
              localStorage.setItem('near_wallet_account', accountIdValue)
          onConnect()
              
              // Проверяем, не связана ли ошибка с отсутствием баланса
              if (balanceError.message?.includes('does not have enough balance') || 
                  balanceError.message?.includes('not exist')) {
                toast.error(
                  'Аккаунт не найден или имеет нулевой баланс',
                  {
                    icon: <AlertCircle className="w-5 h-5 text-red-400" />,
                    duration: 6000,
                  }
                )
              } else {
                toast.success('Wallet connected', {
                  icon: <Wallet className="w-5 h-5 text-green-400" />,
                })
              }
            }
        }
        })
      } else {
        // Fallback для development mode
        if (process.env.NODE_ENV === 'development') {
          const mockAccount = 'user.testnet'
          setAccountId(mockAccount)
          localStorage.setItem('near_wallet_account', mockAccount)
          onConnect()
          toast.success('Wallet connected (development mode)')
        } else {
          toast.error('Wallet selector not initialized')
        }
      }
    } catch (error: any) {
      console.error('Wallet connection error:', error)
      
      // Обработка специфических ошибок
      let errorMessage = 'Ошибка подключения кошелька'
      
      if (error.message?.includes('does not have enough balance')) {
        errorMessage = 'Недостаточно средств на аккаунте для подключения. Пополните баланс.'
      } else if (error.message?.includes('does not exist')) {
        errorMessage = 'Аккаунт не существует или не найден'
      } else if (error.message) {
        errorMessage = error.message
      }
      
      toast.error(errorMessage, {
        icon: <AlertCircle className="w-5 h-5 text-red-400" />,
        duration: 6000,
      })
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      // Отключаем через wallet selector если доступен
      const selector = getWalletSelector()
      if (selector) {
        const wallet = await selector.wallet()
        if (wallet) {
          await wallet.signOut()
        }
      }
    } catch (error) {
      console.log('Error disconnecting wallet:', error)
    }
    
    setAccountId(null)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('near_wallet_account')
    }
    onDisconnect()
    toast.success('Wallet disconnected')
  }

  if (accountId) {
    return (
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
        <div className="glass-medium px-4 py-3 rounded-xl flex-1 sm:flex-initial">
          <span className="text-fluid-sm text-white/70 mr-2">Connected:</span>
          <span className="font-medium text-white text-fluid-sm md:text-fluid-base break-all">{accountId}</span>
        </div>
        <Button
          variant="secondary"
          onClick={handleDisconnect}
          size="sm"
          className="flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-fluid-sm">Disconnect</span>
        </Button>
      </div>
    )
  }

  return (
    <Button
      onClick={handleConnect}
      disabled={isConnecting}
      size="sm"
      className="flex items-center justify-center gap-2 w-full sm:w-auto"
    >
      <Wallet className="w-5 h-5" />
      <span className="text-fluid-sm md:text-fluid-base">{isConnecting ? 'Connecting...' : 'Connect wallet'}</span>
    </Button>
  )
}

