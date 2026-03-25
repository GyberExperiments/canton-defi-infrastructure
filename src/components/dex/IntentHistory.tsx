'use client'

import React, { useState, useEffect } from 'react'
import { Clock, CheckCircle, XCircle, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { intentTracker, type IntentRecord } from '@/lib/intent-tracker'
import { formatNumber } from '@/lib/utils'

interface IntentHistoryProps {
  className?: string
}

export default function IntentHistory({ className }: IntentHistoryProps) {
  const [intents, setIntents] = useState<IntentRecord[]>([])
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    // Загружаем историю из localStorage
    const loadHistory = () => {
      const history = intentTracker.loadFromLocalStorage()
      // Сортируем по дате (новые сверху)
      history.sort((a, b) => b.createdAt - a.createdAt)
      setIntents(history)
    }

    loadHistory()

    // Подписываемся на обновления активных intents
    const interval = setInterval(() => {
      const activeIntents = intentTracker.getActiveIntents()
      // Объединяем активные с историей
      loadHistory()
    }, 5000) // Обновляем каждые 5 секунд

    return () => clearInterval(interval)
  }, [])

  const getStatusIcon = (status: IntentRecord['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-400" />
      case 'filled':
        return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'expired':
        return <XCircle className="w-4 h-4 text-red-400" />
      case 'cancelled':
        return <AlertCircle className="w-4 h-4 text-gray-400" />
      default:
        return <Clock className="w-4 h-4" />
    }
  }

  const getStatusColor = (status: IntentRecord['status']) => {
    switch (status) {
      case 'pending':
        return 'border-yellow-400/30 bg-yellow-400/10'
      case 'filled':
        return 'border-green-400/30 bg-green-400/10'
      case 'expired':
        return 'border-red-400/30 bg-red-400/10'
      case 'cancelled':
        return 'border-gray-400/30 bg-gray-400/10'
      default:
        return 'border-white/10 bg-white/5'
    }
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = Date.now()
    const diff = now - timestamp

    const MINUTE_MS = 60 * 1000
    const HOUR_MS = 60 * MINUTE_MS
    const DAY_MS = 24 * HOUR_MS

    if (diff < MINUTE_MS) {
      return 'Just now'
    }
    if (diff < HOUR_MS) {
      const minutes = Math.floor(diff / MINUTE_MS)
      return `${minutes}m ago`
    }
    if (diff < DAY_MS) {
      const hours = Math.floor(diff / HOUR_MS)
      return `${hours}h ago`
    }

    return date.toLocaleDateString()
  }

  if (intents.length === 0) {
    return null
  }

  return (
    <div className={className}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between glass-medium rounded-xl p-4 md:p-6 hover:bg-white/10 transition-colors"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-fluid-lg font-semibold text-white">Transaction History</h3>
          <span className="px-2 py-1 rounded-full bg-white/10 text-fluid-xs text-white/70">
            {intents.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-white/50" />
          {isExpanded ? (
            <ArrowRight className="w-5 h-5 text-white/70 transform rotate-90 transition-transform" />
          ) : (
            <ArrowRight className="w-5 h-5 text-white/70 transition-transform" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 space-y-2"
          >
            {intents.slice(0, 10).map((intent, index) => (
              <motion.div
                key={intent.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`glass-light rounded-xl p-4 md:p-6 border ${getStatusColor(intent.status)}`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(intent.status)}
                    <div>
                      <p className="font-medium text-white capitalize text-fluid-base">
                        {intent.type}
                      </p>
                      <p className="text-fluid-xs text-white/50">{formatDate(intent.createdAt)}</p>
                    </div>
                  </div>
                  <span className="text-fluid-xs px-3 py-1 rounded-full bg-white/10 text-white/70 capitalize">
                    {intent.status}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 text-fluid-sm">
                  {intent.fromToken && (
                    <>
                      <span className="font-medium text-white">
                        {formatNumber(intent.amount)} {intent.fromToken}
                      </span>
                      <ArrowRight className="w-4 h-4 text-white/50 hidden sm:block" />
                      <span className="text-white/70">{intent.toToken}</span>
                    </>
                  )}
                  {!intent.fromToken && intent.fromChain && (
                    <>
                      <span className="font-medium text-white">
                        {formatNumber(intent.amount)} {intent.fromChain}
                      </span>
                      <ArrowRight className="w-4 h-4 text-white/50 hidden sm:block" />
                      <span className="text-white/70">{intent.toChain}</span>
                    </>
                  )}
                </div>

                {intent.transactionHash && (
                  <div className="mt-3 flex items-center gap-2">
                    <a
                      href={`https://explorer.near.org/transactions/${intent.transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-fluid-xs text-white/50 hover:text-white/80 transition-colors truncate inline-flex items-center gap-1"
                    >
                      <span>View on Explorer</span>
                      <ArrowRight className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </motion.div>
            ))}
            
            {intents.length > 10 && (
              <p className="text-center text-fluid-xs text-white/50 py-3">
                Showing last 10 transactions
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

