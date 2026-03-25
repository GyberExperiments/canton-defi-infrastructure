'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowDownUp, Wallet, AlertCircle, CheckCircle2, RefreshCw, Clock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from 'react-hot-toast'
import { cn, formatNumber, generateOrderId } from '@/lib/utils'
import NearWalletButton from './NearWalletButton'
import { createSwapIntent } from '@/lib/near-intents'
import { signTransaction } from '@/lib/near-wallet-utils'
import { getSwapRate, getTokenPrice, formatEstimatedTime } from '@/lib/near-intents-price'
import { getAllTokenBalances, hasSufficientBalance } from '@/lib/near-balance'
import { intentTracker } from '@/lib/intent-tracker'
import { getTokens, getSwapableTokens, type Token, NEAR_TOKENS } from '@/lib/near-tokens'
import { getSwapFee } from '@/lib/dex-config'
import TokenSelector from './TokenSelector'

export default function SwapInterface() {
  const [fromToken, setFromToken] = useState<Token | null>(null)
  const [toToken, setToToken] = useState<Token | null>(null)
  const [fromAmount, setFromAmount] = useState('')
  const [toAmount, setToAmount] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [swapPrice, setSwapPrice] = useState<number | null>(null)
  const [fee, setFee] = useState<number>(0.003) // 0.3% fee (default)
  const [tokens, setTokens] = useState<Token[]>(NEAR_TOKENS.filter(t => t.chain === 'NEAR' || t.chain === 'AURORA'))
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null)
  const [priceImpact, setPriceImpact] = useState<number | null>(null)
  const [balances, setBalances] = useState<Record<string, string>>({})
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)
  const [isLoadingTokens, setIsLoadingTokens] = useState(true)

  // Загружаем токены и комиссию при монтировании
  useEffect(() => {
    setIsLoadingTokens(true)
    
    getTokens()
      .then(loadedTokens => {
        const swapable = loadedTokens.filter(t => 
          t.chain === 'NEAR' || t.chain === 'AURORA'
        )
        if (swapable.length > 0) {
          setTokens(swapable)
        }
      })
      .catch(() => {
        // Используем fallback - NEAR_TOKENS уже загружены
        console.warn('Failed to load tokens from REF Finance, using static list')
      })
      .finally(() => {
        setIsLoadingTokens(false)
      })

    getSwapFee()
      .then(swapFee => {
        setFee(swapFee)
      })
      .catch(() => {
        // Используем default
      })
  }, [])

  const handleSwap = useCallback(async () => {
    if (!fromToken || !toToken || !fromAmount || parseFloat(fromAmount) <= 0) {
      toast.error('Fill in all fields')
      return
    }

    if (!isConnected) {
      toast.error('Connect wallet')
      return
    }

    setIsLoading(true)
    try {
      const amount = parseFloat(fromAmount)
      
      // Получаем account ID из localStorage
      const userAccount = localStorage.getItem('near_wallet_account') || ''
      
      if (!userAccount) {
        toast.error('Wallet connection required')
        return
      }

      // Создаем swap intent
      const intentResult = await createSwapIntent({
        fromToken: fromToken.symbol,
        fromChain: fromToken.chain,
        toToken: toToken.symbol,
        toChain: toToken.chain,
        amount: amount,
        fee: fee,
        userAccount,
      })

      if (intentResult.success && intentResult.transactionData) {
        // Показываем информацию о комиссии
        if (intentResult.feeInfo) {
          toast.success(`Fee: ${intentResult.feeInfo.percent}%`, {
            icon: <CheckCircle2 className="w-5 h-5 text-green-400" />
          })
        }
        
        // Подписываем транзакцию
        try {
          const network = process.env.NEXT_PUBLIC_NEAR_NETWORK || 'testnet'
          const transactionHash = await signTransaction(
            intentResult.transactionData,
            userAccount,
            network as 'mainnet' | 'testnet'
          )
          
          if (transactionHash) {
            // Создаем запись для отслеживания
            const intentId = generateOrderId()
            const record = {
              id: intentId,
              type: 'swap' as const,
              status: 'pending' as const,
              fromToken: fromToken.symbol,
              toToken: toToken.symbol,
              fromChain: fromToken.chain,
              toChain: toToken.chain,
              amount,
              transactionHash,
              createdAt: Date.now(),
            }
            
            // Начинаем отслеживание
            intentTracker.startTracking(record, (updatedRecord) => {
              if (updatedRecord.status === 'filled') {
                toast.success('Swap completed!', {
                  icon: <CheckCircle2 className="w-5 h-5 text-green-400" />
                })
                intentTracker.stopTracking(intentId)
              } else if (updatedRecord.status === 'expired') {
                toast.error('Swap expired', {
                  icon: <AlertCircle className="w-5 h-5 text-red-400" />
                })
                intentTracker.stopTracking(intentId)
              }
            })
            
            toast.success('Transaction signed and sent!', {
              icon: <CheckCircle2 className="w-5 h-5 text-green-400" />
            })
            console.log('Transaction hash:', transactionHash)
          } else {
            // Redirect на wallet, пользователь подпишет там
            toast.success('Open wallet to sign transaction', {
              icon: <CheckCircle2 className="w-5 h-5 text-green-400" />
            })
          }
        } catch (signError: any) {
          console.error('Ошибка при подписании транзакции:', signError)
          
          let errorMessage = 'Ошибка при подписании транзакции'
          
          if (signError.message?.includes('does not have enough balance')) {
            errorMessage = 'Недостаточно средств для выполнения транзакции. Пополните баланс NEAR.'
          } else if (signError.message?.includes('does not exist')) {
            errorMessage = 'Аккаунт не найден. Проверьте подключение кошелька.'
          } else if (signError.message) {
            errorMessage = signError.message
          }
          
          toast.error(errorMessage, {
            icon: <AlertCircle className="w-5 h-5 text-red-400" />,
            duration: 6000,
          })
        }
      } else {
        throw new Error(intentResult.error || 'Error creating intent')
      }
    } catch (error: any) {
      console.error('Swap error:', error)
      
      let errorMessage = 'Ошибка при выполнении swap'
      
      if (error.message?.includes('does not have enough balance') || 
          error.message?.includes('Insufficient balance')) {
        errorMessage = 'Недостаточно средств для выполнения swap. Проверьте баланс токенов.'
      } else if (error.message?.includes('does not exist')) {
        errorMessage = 'Аккаунт не найден. Проверьте подключение кошелька.'
      } else if (error.message) {
        errorMessage = error.message
      }
      
      toast.error(errorMessage, {
        icon: <AlertCircle className="w-5 h-5 text-red-400" />,
        duration: 6000,
      })
    } finally {
      setIsLoading(false)
    }
  }, [fromToken, toToken, fromAmount, isConnected, fee])

  const calculateOutput = useCallback(async () => {
    if (!fromToken || !toToken || !fromAmount || parseFloat(fromAmount) <= 0) {
      setToAmount('')
      setSwapPrice(null)
      setEstimatedTime(null)
      setPriceImpact(null)
      return
    }

    const inputAmount = parseFloat(fromAmount)
    
    // Получаем реальный курс через price oracle
    const swapRate = await getSwapRate(fromToken.symbol, toToken.symbol, inputAmount)
    
    if (swapRate) {
      const outputAmount = inputAmount * swapRate.rate * (1 - fee)
      setToAmount(formatNumber(outputAmount))
      setSwapPrice(swapRate.rate)
      setEstimatedTime(swapRate.estimatedTime || null)
      setPriceImpact(swapRate.priceImpact || null)
    } else {
      // Fallback на базовый курс
      const estimatedRate = 1
    const outputAmount = inputAmount * estimatedRate * (1 - fee)
    setToAmount(formatNumber(outputAmount))
    setSwapPrice(estimatedRate)
      setEstimatedTime(30)
      setPriceImpact(0)
    }
  }, [fromToken, toToken, fromAmount, fee])

  React.useEffect(() => {
    calculateOutput()
  }, [calculateOutput])

  return (
    <div className="glass-ultra rounded-3xl p-6 md:p-8 lg:p-12 shadow-2xl">
      {/* Wallet Connection */}
      <div className="mb-6 md:mb-8">
        <NearWalletButton 
          onConnect={() => setIsConnected(true)}
          onDisconnect={() => setIsConnected(false)}
        />
      </div>

      {/* Swap Form */}
      <div className="space-y-6">
        {/* From Token */}
        <div className="glass-medium rounded-2xl p-4 md:p-6">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-fluid-sm font-medium text-white/70">
              You send
            </label>
            {fromToken && balances[fromToken.symbol] && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  Balance: {formatNumber(parseFloat(balances[fromToken.symbol]))}
                </span>
                <button
                  onClick={() => {
                    const balance = parseFloat(balances[fromToken.symbol] || '0')
                    if (balance > 0) {
                      setFromAmount(balance.toString())
                    }
                  }}
                  className="px-2 py-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 rounded-lg transition-colors"
                >
                  MAX
                </button>
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
            <div className="flex-1 order-2 sm:order-1">
              <Input
                type="number"
                placeholder="0.0"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                className="text-fluid-2xl font-bold"
                variant="dark"
              />
            </div>
            <div className="flex-shrink-0 order-1 sm:order-2">
              <TokenSelector
                tokens={tokens}
                selectedToken={fromToken}
                onSelect={setFromToken}
                excludeTokens={toToken ? [toToken.symbol] : []}
              />
            </div>
          </div>
        </div>

        {/* Swap Arrow */}
        <div className="flex justify-center -my-2">
          <motion.div
            className="w-12 h-12 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 flex items-center justify-center cursor-pointer"
            whileHover={{ scale: 1.1, rotate: 180 }}
            whileTap={{ scale: 0.95, rotate: 180 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            onClick={() => {
              const temp = fromToken
              setFromToken(toToken)
              setToToken(temp)
              const tempAmount = fromAmount
              setFromAmount(toAmount)
              setToAmount(tempAmount)
            }}
          >
            <ArrowDownUp className="w-5 h-5 text-white" />
          </motion.div>
        </div>

        {/* To Token */}
        <div className="glass-medium rounded-2xl p-4 md:p-6">
          <label className="block text-fluid-sm font-medium text-white/70 mb-3">
            You receive
          </label>
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
            <div className="flex-1 order-2 sm:order-1">
              <Input
                type="text"
                placeholder="0.0"
                value={toAmount}
                readOnly
                className="text-fluid-2xl font-bold"
                variant="dark"
              />
            </div>
            <div className="flex-shrink-0 order-1 sm:order-2">
              <TokenSelector
                tokens={tokens}
                selectedToken={toToken}
                onSelect={setToToken}
                excludeTokens={fromToken ? [fromToken.symbol] : []}
              />
            </div>
          </div>
        </div>

        {/* Swap Info */}
        {swapPrice && (
          <div className="glass-light rounded-2xl p-4 md:p-6 text-fluid-sm text-white/70 space-y-3">
            <div className="flex justify-between items-center">
              <span>Rate:</span>
              <span className="font-medium text-white text-fluid-sm md:text-fluid-base">1 {fromToken?.symbol} = {swapPrice.toFixed(6)} {toToken?.symbol}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Fee ({(fee * 100).toFixed(1)}%):</span>
              <span className="font-medium text-white text-fluid-sm md:text-fluid-base">{formatNumber(parseFloat(fromAmount || '0') * fee)} {fromToken?.symbol}</span>
            </div>
            {estimatedTime && (
              <div className="flex justify-between items-center">
                <span>Estimated time:</span>
                <span className="font-medium text-white text-fluid-sm md:text-fluid-base">{formatEstimatedTime(estimatedTime)}</span>
              </div>
            )}
            {priceImpact !== null && priceImpact > 0 && (
              <div className="flex justify-between items-center">
                <span>Price impact:</span>
                <span className={cn(
                  "font-medium text-fluid-sm md:text-fluid-base",
                  priceImpact > 5 ? "text-error" : 
                  priceImpact > 1 ? "text-warning" : 
                  "text-success"
                )}>
                  {priceImpact.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
        )}

        {/* Swap Button */}
        <Button
          onClick={handleSwap}
          disabled={!isConnected || !fromToken || !toToken || !fromAmount || isLoading}
          className="w-full h-16 text-lg"
          shimmer
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <ArrowDownUp className="w-5 h-5 mr-2" />
              Execute Swap
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

