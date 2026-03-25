'use client'

import React, { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Network as BridgeIcon, AlertCircle, CheckCircle2, RefreshCw, Circle, Hexagon } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from 'react-hot-toast'
import { cn, formatNumber } from '@/lib/utils'
import NearWalletButton from './NearWalletButton'
import { createBridgeIntent } from '@/lib/near-intents'
import { signTransaction } from '@/lib/near-wallet-utils'

interface Chain {
  id: string
  name: string
  IconComponent: React.FC<{ className?: string }>
  color: string
}

const SUPPORTED_CHAINS: Chain[] = [
  { 
    id: 'NEAR', 
    name: 'NEAR Protocol', 
    IconComponent: ({ className }) => <Circle className={cn('fill-cyan-400 stroke-cyan-400', className)} />,
    color: 'from-cyan-400 to-blue-500'
  },
  { 
    id: 'AURORA', 
    name: 'Aurora', 
    IconComponent: ({ className }) => <Hexagon className={cn('fill-green-400 stroke-green-400', className)} />,
    color: 'from-green-400 to-emerald-500'
  },
  { 
    id: 'ETHEREUM', 
    name: 'Ethereum', 
    IconComponent: ({ className }) => <Hexagon className={cn('fill-blue-400 stroke-blue-400', className)} />,
    color: 'from-blue-400 to-indigo-500'
  },
  { 
    id: 'POLYGON', 
    name: 'Polygon', 
    IconComponent: ({ className }) => <Hexagon className={cn('fill-purple-400 stroke-purple-400', className)} />,
    color: 'from-purple-400 to-pink-500'
  },
  { 
    id: 'BSC', 
    name: 'BNB Chain', 
    IconComponent: ({ className }) => <Circle className={cn('fill-yellow-400 stroke-yellow-400', className)} />,
    color: 'from-yellow-400 to-orange-500'
  },
]

export default function BridgeInterface() {
  const [fromChain, setFromChain] = useState<Chain | null>(null)
  const [toChain, setToChain] = useState<Chain | null>(null)
  const [amount, setAmount] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [fee, setFee] = useState<number>(0.005) // 0.5% fee for bridge

  const handleBridge = useCallback(async () => {
    if (!fromChain || !toChain || !amount || parseFloat(amount) <= 0) {
      toast.error('Fill in all fields')
      return
    }

    if (!isConnected) {
      toast.error('Connect wallet')
      return
    }

    if (fromChain.id === toChain.id) {
      toast.error('Select different networks')
      return
    }

    setIsLoading(true)
    try {
      const bridgeAmount = parseFloat(amount)
      
      // Получаем account ID из localStorage
      const userAccount = localStorage.getItem('near_wallet_account') || ''
      
      if (!userAccount) {
        toast.error('Wallet connection required')
        return
      }

      // Создаем bridge intent
      const intentResult = await createBridgeIntent({
        fromChain: fromChain.id,
        toChain: toChain.id,
        amount: bridgeAmount,
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
      console.error('Bridge error:', error)
      
      let errorMessage = 'Ошибка при выполнении bridge'
      
      if (error.message?.includes('does not have enough balance') || 
          error.message?.includes('Insufficient balance')) {
        errorMessage = 'Недостаточно средств для выполнения bridge. Проверьте баланс токенов.'
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
  }, [fromChain, toChain, amount, isConnected, fee])

  return (
    <div className="glass-ultra rounded-3xl p-6 md:p-8 lg:p-12 shadow-2xl">
      {/* Wallet Connection */}
      <div className="mb-6 md:mb-8">
        <NearWalletButton 
          onConnect={() => setIsConnected(true)}
          onDisconnect={() => setIsConnected(false)}
        />
      </div>

      {/* Bridge Form */}
      <div className="space-y-6">
        {/* From Chain */}
        <div className="glass-medium rounded-2xl p-4 md:p-6">
          <label className="block text-fluid-sm font-medium text-white/70 mb-3">
            From
          </label>
          <div className="flex gap-2 md:gap-3 flex-wrap">
            {SUPPORTED_CHAINS.map((chain) => (
              <button
                key={chain.id}
                onClick={() => setFromChain(chain)}
                className={cn(
                  "px-3 py-2 md:px-6 md:py-3 rounded-xl font-medium transition-all flex items-center gap-2",
                  fromChain?.id === chain.id
                    ? `bg-gradient-to-r ${chain.color} text-white shadow-glow-electric`
                    : "bg-white/5 text-white/70 hover:bg-white/10"
                )}
              >
                <chain.IconComponent className="w-5 h-5" />
                <span className="text-fluid-sm md:text-fluid-base">{chain.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div className="glass-medium rounded-2xl p-4 md:p-6">
          <label className="block text-fluid-sm font-medium text-white/70 mb-3">
            Amount
          </label>
          <Input
            type="number"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="text-fluid-2xl font-bold"
            variant="dark"
          />
        </div>

        {/* Bridge Arrow */}
        <div className="flex justify-center">
          <motion.div
            className="relative w-16 h-16 rounded-full bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 flex items-center justify-center"
            animate={{ 
              scale: [1, 1.05, 1],
              rotate: [0, 180, 360],
            }}
            transition={{ 
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
              times: [0, 0.5, 1]
            }}
          >
            <BridgeIcon className="w-6 h-6 text-white" />
            
            {/* Pulse effect для "connection" визуализации */}
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-white/30"
              animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
            />
          </motion.div>
        </div>

        {/* To Chain */}
        <div className="glass-medium rounded-2xl p-4 md:p-6">
          <label className="block text-fluid-sm font-medium text-white/70 mb-3">
            To
          </label>
          <div className="flex gap-2 md:gap-3 flex-wrap">
            {SUPPORTED_CHAINS.filter(c => c.id !== fromChain?.id).map((chain) => (
              <button
                key={chain.id}
                onClick={() => setToChain(chain)}
                className={cn(
                  "px-3 py-2 md:px-6 md:py-3 rounded-xl font-medium transition-all flex items-center gap-2",
                  toChain?.id === chain.id
                    ? `bg-gradient-to-r ${chain.color} text-white shadow-glow-electric`
                    : "bg-white/5 text-white/70 hover:bg-white/10"
                )}
              >
                <chain.IconComponent className="w-5 h-5" />
                <span className="text-fluid-sm md:text-fluid-base">{chain.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Bridge Info */}
        <div className="glass-light rounded-2xl p-4 md:p-6 text-fluid-sm text-white/70 space-y-3">
          <div className="flex justify-between items-center">
            <span>Fee ({(fee * 100).toFixed(1)}%):</span>
            <span className="font-medium text-white text-fluid-sm md:text-fluid-base">{formatNumber(parseFloat(amount || '0') * fee)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>You will receive:</span>
            <span className="font-medium text-white text-fluid-sm md:text-fluid-base">{formatNumber(parseFloat(amount || '0') * (1 - fee))}</span>
          </div>
        </div>

        {/* Bridge Button */}
        <Button
          onClick={handleBridge}
          disabled={!isConnected || !fromChain || !toChain || !amount || isLoading || fromChain.id === toChain.id}
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
              <BridgeIcon className="w-5 h-5 mr-2" />
              Execute Bridge
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

