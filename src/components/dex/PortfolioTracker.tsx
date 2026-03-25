/**
 * Portfolio Tracker Component
 * Dashboard для отслеживания портфеля пользователя
 */

'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Wallet, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { cn, formatNumber } from '@/lib/utils'
import { type Token } from '@/lib/near-tokens'
import { getAllTokenBalances } from '@/lib/near-balance'
import { getTokenPrice } from '@/lib/near-intents-price'
import { intentOperations, portfolioOperations, type PortfolioSnapshot } from '@/lib/supabase'

interface PortfolioData {
  tokens: Array<{
    token: Token
    balance: string
    balanceFormatted: number
    usdValue: number
  }>
  totalUsdValue: number
  totalUsdValue24hAgo: number
  change24h: number
  change24hPercent: number
}

export default function PortfolioTracker() {
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [userAccount, setUserAccount] = useState<string | null>(null)

  useEffect(() => {
    const account = localStorage.getItem('near_wallet_account')
    setUserAccount(account)
    
    if (account) {
      loadPortfolio(account)
    }
  }, [])

  const loadPortfolio = async (account: string) => {
    setIsLoading(true)
    try {
      // Получаем балансы всех токенов
      const tokenBalances = await getAllTokenBalances(account)
      
      // Получаем последний snapshot для расчета изменений
      const lastSnapshot = await portfolioOperations.getLatestSnapshot(account)
      
      // Рассчитываем портфель
      const portfolioTokens = []
      let totalUsd = 0
      
      for (const tokenBalance of tokenBalances) {
        if (parseFloat(tokenBalance.balance) > 0) {
          const price = await getTokenPrice(tokenBalance.symbol)
          if (price) {
            const usdValue = parseFloat(tokenBalance.balance) * price.priceUSD
            totalUsd += usdValue
            
            portfolioTokens.push({
              token: { 
                symbol: tokenBalance.symbol, 
                name: tokenBalance.symbol, 
                icon: '🪙', 
                chain: 'NEAR' as const, 
                decimals: tokenBalance.decimals, 
                contractId: '' 
              },
              balance: tokenBalance.balance,
              balanceFormatted: parseFloat(tokenBalance.balance),
              usdValue,
            })
          }
        }
      }

      // Получаем snapshot 24 часа назад
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const history = await portfolioOperations.getHistory(account, {
        from: yesterday,
        limit: 1
      })
      
      const totalUsd24hAgo = history.length > 0 
        ? parseFloat(history[0].total_usd_value) 
        : (lastSnapshot ? parseFloat(lastSnapshot.total_usd_value) : totalUsd)
      const change24h = totalUsd - totalUsd24hAgo
      const change24hPercent = totalUsd24hAgo > 0 ? (change24h / totalUsd24hAgo) * 100 : 0

      // Сохраняем snapshot
      await portfolioOperations.createSnapshot(account, 
        portfolioTokens.reduce((acc, item) => {
          acc[item.token.symbol] = item.balance
          return acc
        }, {} as Record<string, string>),
        totalUsd
      )

      setPortfolio({
        tokens: portfolioTokens.sort((a, b) => b.usdValue - a.usdValue),
        totalUsdValue: totalUsd,
        totalUsdValue24hAgo: totalUsd24hAgo,
        change24h,
        change24hPercent,
      })
    } catch (error) {
      console.error('Error loading portfolio:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!userAccount) {
    return (
      <div className="glass-ultra rounded-3xl p-6 md:p-8 lg:p-12 shadow-2xl text-center">
        <Wallet className="w-12 h-12 text-white/50 mx-auto mb-4" />
        <p className="text-white/70">Connect wallet to view portfolio</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="glass-ultra rounded-3xl p-6 md:p-8 lg:p-12 shadow-2xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-white/10 rounded w-1/3" />
          <div className="h-20 bg-white/10 rounded" />
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-white/5 rounded" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!portfolio || portfolio.tokens.length === 0) {
    return (
      <div className="glass-ultra rounded-3xl p-6 md:p-8 lg:p-12 shadow-2xl text-center">
        <Wallet className="w-12 h-12 text-white/50 mx-auto mb-4" />
        <p className="text-white/70">No tokens in portfolio</p>
      </div>
    )
  }

  return (
    <div className="glass-ultra rounded-3xl p-6 md:p-8 lg:p-12 shadow-2xl">
      <h2 className="text-fluid-2xl font-bold text-white mb-6 flex items-center gap-3">
        <Wallet className="w-6 h-6" />
        Portfolio
      </h2>

      {/* Total Value */}
      <div className="glass-medium rounded-2xl p-6 mb-6">
        <div className="flex items-end justify-between mb-2">
          <div>
            <p className="text-white/70 text-sm mb-1">Total Portfolio Value</p>
            <p className="text-fluid-3xl font-bold text-white">
              ${formatNumber(portfolio.totalUsdValue)}
            </p>
          </div>
          <div className={cn(
            "flex items-center gap-1 text-sm font-medium",
            portfolio.change24h >= 0 ? "text-success" : "text-error"
          )}>
            {portfolio.change24h >= 0 ? (
              <ArrowUpRight className="w-4 h-4" />
            ) : (
              <ArrowDownRight className="w-4 h-4" />
            )}
            {Math.abs(portfolio.change24hPercent).toFixed(2)}%
          </div>
        </div>
        <p className="text-white/50 text-xs">
          24h change: {portfolio.change24h >= 0 ? '+' : ''}${formatNumber(portfolio.change24h)}
        </p>
      </div>

      {/* Token List */}
      <div className="space-y-3">
        <h3 className="text-fluid-lg font-semibold text-white mb-4">Holdings</h3>
        {portfolio.tokens.map((item) => {
          const percentage = (item.usdValue / portfolio.totalUsdValue) * 100
          return (
            <motion.div
              key={item.token.symbol}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-medium rounded-xl p-4 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{item.token.icon}</span>
                  <div>
                    <p className="font-medium text-white">{item.token.symbol}</p>
                    <p className="text-xs text-white/50">{item.token.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-white">
                    {formatNumber(item.balanceFormatted)}
                  </p>
                  <p className="text-sm text-white/70">
                    ${formatNumber(item.usdValue)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    className="h-full bg-gradient-to-r from-violet-500 to-cyan-500"
                  />
                </div>
                <span className="text-xs text-white/50">{percentage.toFixed(1)}%</span>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

