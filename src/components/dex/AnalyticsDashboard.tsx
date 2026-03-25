/**
 * Analytics Dashboard Component
 * Детальная аналитика транзакций пользователя
 */

'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, TrendingUp, TrendingDown, DollarSign, Activity, Download, Filter } from 'lucide-react'
import { cn, formatNumber } from '@/lib/utils'
import { intentOperations, utils } from '@/lib/supabase'
import type { Intent } from '@/lib/supabase'

interface AnalyticsData {
  totalVolume: number
  totalVolumeUsd: number
  totalTrades: number
  successfulTrades: number
  failedTrades: number
  totalFeesPaid: number
  averageTradeSize: number
  successRate: number
  bestTrade?: { intent: Intent; profit: number }
  worstTrade?: { intent: Intent; loss: number }
  tradesByDay: Array<{ date: string; count: number; volume: number }>
}

export default function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'completed' | 'failed'>('all')
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d')
  const userAccount = typeof window !== 'undefined' ? localStorage.getItem('near_wallet_account') : null

  useEffect(() => {
    if (userAccount) {
      loadAnalytics()
    }
  }, [userAccount, filter, dateRange])

  const loadAnalytics = async () => {
    if (!userAccount) return
    
    setIsLoading(true)
    try {
      // Получаем статистику пользователя из view
      const userStats = await utils.getUserStats(userAccount)
      
      // Получаем все intents
      const intents = await intentOperations.getByUser(userAccount, { limit: 1000 })
      
      // Фильтруем по date range
      const now = Date.now()
      const rangeMs = dateRange === '7d' ? 7 * 24 * 60 * 60 * 1000 :
                      dateRange === '30d' ? 30 * 24 * 60 * 60 * 1000 :
                      dateRange === '90d' ? 90 * 24 * 60 * 60 * 1000 : Infinity
      
      const filteredIntents = intents.filter(intent => {
        if (filter === 'completed' && intent.status !== 'completed') return false
        if (filter === 'failed' && intent.status !== 'failed') return false
        
        const intentTime = new Date(intent.created_at).getTime()
        return (now - intentTime) <= rangeMs
      })

      // Рассчитываем метрики
      const completedIntents = filteredIntents.filter(i => i.status === 'completed')
      const failedIntents = filteredIntents.filter(i => i.status === 'failed')
      
      let totalVolume = 0
      let totalFees = 0
      
      // Default fee rate if specific fee data is unavailable (0.3%)
      const DEFAULT_FEE_RATE = 0.003
      
      completedIntents.forEach(intent => {
        const amount = parseFloat(intent.amount || '0')
        totalVolume += amount
        
        // Calculate fees: try to use actual recorded fee, otherwise estimate
        const intentData = intent as any
        let fee = 0
        
        if (intentData.fee_amount) {
          fee = parseFloat(intentData.fee_amount)
        } else if (intentData.metadata?.fee) {
          fee = parseFloat(intentData.metadata.fee)
        } else {
          fee = amount * DEFAULT_FEE_RATE
        }
        
        totalFees += fee
      })

      const averageTradeSize = completedIntents.length > 0 
        ? totalVolume / completedIntents.length 
        : 0

      const successRate = filteredIntents.length > 0
        ? (completedIntents.length / filteredIntents.length) * 100
        : 0

      // Группируем по дням
      const tradesByDay = new Map<string, { count: number; volume: number }>()
      completedIntents.forEach(intent => {
        const date = new Date(intent.created_at).toISOString().split('T')[0]
        const existing = tradesByDay.get(date) || { count: 0, volume: 0 }
        tradesByDay.set(date, {
          count: existing.count + 1,
          volume: existing.volume + parseFloat(intent.amount || '0')
        })
      })

      // Используем данные из userStats если доступны
      const totalVolumeUsd = userStats?.total_received 
        ? parseFloat(userStats.total_received.toString()) 
        : totalVolume

      setAnalytics({
        totalVolume,
        totalVolumeUsd,
        totalTrades: userStats?.total_intents || filteredIntents.length,
        successfulTrades: userStats?.completed_intents || completedIntents.length,
        failedTrades: userStats?.failed_intents || failedIntents.length,
        totalFeesPaid: totalFees,
        averageTradeSize: userStats?.avg_completion_time_seconds 
          ? totalVolumeUsd / (userStats.completed_intents || 1)
          : averageTradeSize,
        successRate: userStats 
          ? ((userStats.completed_intents || 0) / (userStats.total_intents || 1)) * 100
          : successRate,
        tradesByDay: Array.from(tradesByDay.entries()).map(([date, data]) => ({
          date,
          ...data
        })).sort((a, b) => a.date.localeCompare(b.date)),
      })
    } catch (error) {
      console.error('Error loading analytics:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const exportToCSV = () => {
    if (!analytics) return
    
    const csv = [
      ['Metric', 'Value'],
      ['Total Volume', analytics.totalVolume],
      ['Total Trades', analytics.totalTrades],
      ['Success Rate', `${analytics.successRate.toFixed(2)}%`],
      ['Total Fees Paid', analytics.totalFeesPaid],
      ['Average Trade Size', analytics.averageTradeSize],
    ].map(row => row.join(',')).join('\n')
    
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dex-analytics-${Date.now()}.csv`
    a.click()
  }

  if (!userAccount) {
    return (
      <div className="glass-ultra rounded-3xl p-6 md:p-8 lg:p-12 shadow-2xl text-center">
        <Activity className="w-12 h-12 text-white/50 mx-auto mb-4" />
        <p className="text-white/70">Connect wallet to view analytics</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="glass-ultra rounded-3xl p-6 md:p-8 lg:p-12 shadow-2xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-white/10 rounded w-1/3" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-white/5 rounded" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!analytics) {
    return null
  }

  return (
    <div className="glass-ultra rounded-3xl p-6 md:p-8 lg:p-12 shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-fluid-2xl font-bold text-white flex items-center gap-3">
          <BarChart3 className="w-6 h-6" />
          Analytics
        </h2>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
        >
          <Download className="w-4 h-4" />
          <span className="text-sm">Export CSV</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500/50"
        >
          <option value="all">All Trades</option>
          <option value="completed">Completed Only</option>
          <option value="failed">Failed Only</option>
        </select>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value as any)}
          className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500/50"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="all">All time</option>
        </select>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="glass-medium rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-violet-400" />
            <p className="text-xs text-white/50">Total Volume</p>
          </div>
          <p className="text-fluid-xl font-bold text-white">
            ${formatNumber(analytics.totalVolumeUsd)}
          </p>
        </div>

        <div className="glass-medium rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            <p className="text-xs text-white/50">Total Trades</p>
          </div>
          <p className="text-fluid-xl font-bold text-white">
            {analytics.totalTrades}
          </p>
        </div>

        <div className="glass-medium rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-success" />
            <p className="text-xs text-white/50">Success Rate</p>
          </div>
          <p className="text-fluid-xl font-bold text-white">
            {analytics.successRate.toFixed(1)}%
          </p>
        </div>

        <div className="glass-medium rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-warning" />
            <p className="text-xs text-white/50">Avg Trade</p>
          </div>
          <p className="text-fluid-xl font-bold text-white">
            ${formatNumber(analytics.averageTradeSize)}
          </p>
        </div>
      </div>

      {/* Chart */}
      {analytics.tradesByDay.length > 0 && (
        <div className="glass-medium rounded-xl p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Trades Over Time</h3>
          <div className="h-48 flex items-end gap-2">
            {analytics.tradesByDay.map((day) => {
              const maxVolume = Math.max(...analytics.tradesByDay.map(d => d.volume))
              const height = (day.volume / maxVolume) * 100
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    className="w-full bg-gradient-to-t from-violet-500 to-cyan-500 rounded-t"
                  />
                  <span className="text-xs text-white/50 rotate-90 origin-center whitespace-nowrap">
                    {new Date(day.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

