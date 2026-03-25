/**
 * Price Chart Component
 * Real-time price charts для токенов
 */

'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getSwapRate } from '@/lib/near-intents-price'

interface PriceChartProps {
  fromToken: string
  toToken: string
  className?: string
}

type Timeframe = '1h' | '4h' | '24h' | '7d' | '30d'

export default function PriceChart({ fromToken, toToken, className }: PriceChartProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>('24h')
  const [priceHistory, setPriceHistory] = useState<Array<{ time: number; price: number }>>([])
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)
  const [priceChange, setPriceChange] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadPriceData()
    const interval = setInterval(loadPriceData, 30000) // Обновляем каждые 30 секунд
    return () => clearInterval(interval)
  }, [fromToken, toToken, timeframe])

  const loadPriceData = async () => {
    setIsLoading(true)
    try {
      // Получаем текущий курс обмена
      const swapRate = await getSwapRate(fromToken, toToken, 1)
      if (swapRate) {
        setCurrentPrice(swapRate.rate)
      }

      // TODO: Загрузить историю из Supabase price_history
      // Пока используем mock данные
      const mockHistory = generateMockHistory(timeframe)
      setPriceHistory(mockHistory)
      
      if (mockHistory.length > 0) {
        const firstPrice = mockHistory[0].price
        const lastPrice = mockHistory[mockHistory.length - 1].price
        setPriceChange(((lastPrice - firstPrice) / firstPrice) * 100)
      }
    } catch (error) {
      console.error('Error loading price data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const generateMockHistory = (tf: Timeframe): Array<{ time: number; price: number }> => {
    const now = Date.now()
    const points = tf === '1h' ? 60 : tf === '4h' ? 48 : tf === '24h' ? 24 : tf === '7d' ? 168 : 720
    const interval = tf === '1h' ? 60000 : tf === '4h' ? 300000 : tf === '24h' ? 3600000 : tf === '7d' ? 3600000 : 3600000
    
    const basePrice = currentPrice || 1
    const history = []
    
    for (let i = points; i >= 0; i--) {
      const time = now - (i * interval)
      const volatility = (Math.random() - 0.5) * 0.02 // ±1% волатильность
      const price = basePrice * (1 + volatility * i / points)
      history.push({ time, price })
    }
    
    return history
  }

  const minPrice = Math.min(...priceHistory.map(h => h.price))
  const maxPrice = Math.max(...priceHistory.map(h => h.price))
  const priceRange = maxPrice - minPrice || 1

  return (
    <div className={cn('glass-ultra rounded-3xl p-6 md:p-8 shadow-2xl', className)}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-fluid-xl font-bold text-white mb-1">
            {fromToken} / {toToken}
          </h3>
          {currentPrice && (
            <div className="flex items-center gap-2">
              <span className="text-fluid-lg font-semibold text-white">
                {currentPrice.toFixed(6)}
              </span>
              <span className={cn(
                "text-sm font-medium flex items-center gap-1",
                priceChange >= 0 ? "text-success" : "text-error"
              )}>
                {priceChange >= 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                {Math.abs(priceChange).toFixed(2)}%
              </span>
            </div>
          )}
        </div>
        <button
          onClick={loadPriceData}
          disabled={isLoading}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
        </button>
      </div>

      {/* Timeframe Selector */}
      <div className="flex gap-2 mb-4">
        {(['1h', '4h', '24h', '7d', '30d'] as Timeframe[]).map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              timeframe === tf
                ? "bg-gradient-to-r from-violet-500 to-cyan-500 text-white"
                : "bg-white/5 text-white/70 hover:bg-white/10"
            )}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="relative h-64 bg-white/5 rounded-xl p-4">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-pulse text-white/50">Loading chart...</div>
          </div>
        ) : priceHistory.length > 0 ? (
          <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
            <defs>
              <linearGradient id="priceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
              </linearGradient>
            </defs>
            
            {/* Area fill */}
            <path
              d={`M 0,${200 - ((priceHistory[0].price - minPrice) / priceRange) * 200} ${priceHistory.map((point, i) => {
                const x = (i / (priceHistory.length - 1)) * 400
                const y = 200 - ((point.price - minPrice) / priceRange) * 200
                return `L ${x},${y}`
              }).join(' ')} L 400,200 L 0,200 Z`}
              fill="url(#priceGradient)"
            />
            
            {/* Line */}
            <polyline
              points={priceHistory.map((point, i) => {
                const x = (i / (priceHistory.length - 1)) * 400
                const y = 200 - ((point.price - minPrice) / priceRange) * 200
                return `${x},${y}`
              }).join(' ')}
              fill="none"
              stroke="url(#linearGradient)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            
            <defs>
              <linearGradient id="linearGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
          </svg>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/50">
            No data available
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/10">
        <div>
          <p className="text-xs text-white/50 mb-1">24h High</p>
          <p className="text-sm font-medium text-white">
            {maxPrice.toFixed(6)}
          </p>
        </div>
        <div>
          <p className="text-xs text-white/50 mb-1">24h Low</p>
          <p className="text-sm font-medium text-white">
            {minPrice.toFixed(6)}
          </p>
        </div>
        <div>
          <p className="text-xs text-white/50 mb-1">Volume</p>
          <p className="text-sm font-medium text-white">
            --
          </p>
        </div>
      </div>
    </div>
  )
}
