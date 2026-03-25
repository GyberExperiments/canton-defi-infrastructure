'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, CheckCircle, Clock, ExternalLink, Sparkles, Copy, Loader2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { OTC_CONFIG, type OTCOrder } from '@/config/otc'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { toast } from 'react-hot-toast'

export default function OrderPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params?.orderId as string

  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!orderId) {
      setError('Order ID is required')
      setLoading(false)
      return
    }

    const fetchOrder = async () => {
      try {
        const response = await fetch(`/api/order/${orderId}`)
        const data = await response.json()

        if (!response.ok) {
          setError(data.error || 'Failed to load order')
          setLoading(false)
          return
        }

        if (data.success && data.order) {
          setOrder(data.order)
        } else {
          setError('Order not found')
        }
      } catch (err) {
        console.error('Failed to fetch order:', err)
        setError('Failed to load order')
      } finally {
        setLoading(false)
      }
    }

    fetchOrder()
  }, [orderId])

  const copyToClipboard = async (text: string, label: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text)
        toast.success(`${label} copied to clipboard!`)
      }
    } catch {
      toast.error('Failed to copy to clipboard')
    }
  }

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getStatusProgress = (status: string) => {
    const statusMap: Record<string, number> = {
      'awaiting-deposit': 1,
      'awaiting-confirmation': 2,
      'exchanging': 3,
      'sending': 4,
      'completed': 5,
      'failed': 0
    }
    const current = statusMap[status] || 0
    const total = 5
    const percentage = status === 'failed' ? 0 : Math.round((current / total) * 100)
    return { current, total, percentage }
  }

  const StepIndicator = ({ step, isActive, isCompleted }: { step: number; isActive: boolean; isCompleted: boolean }) => (
    <div className="flex flex-col items-center">
      <motion.div
        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
          isCompleted ? 'bg-green-500 text-white' :
          isActive ? 'bg-blue-500 text-white' :
          'bg-white/10 text-white/50'
        }`}
        initial={false}
        animate={{ scale: isActive ? 1.1 : 1 }}
      >
        {isCompleted ? <CheckCircle className="w-5 h-5" /> : step}
      </motion.div>
      <div className="text-xs text-center mt-2 max-w-20">
        <div className={`font-medium ${isActive ? 'text-blue-300' : 'text-white/50'}`}>
          {OTC_CONFIG.PROCESSING_STEPS[step - 1]?.name}
        </div>
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-white/70">Loading order...</p>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center">
        <motion.div
          className="max-w-md mx-auto p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="text-2xl font-bold text-white mb-4">Order Not Found</h2>
          <p className="text-white/70 mb-6">{error || 'The order you are looking for does not exist.'}</p>
          <Button
            onClick={() => router.push('/')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </motion.div>
      </div>
    )
  }

  const isBuying = !order.exchangeDirection || order.exchangeDirection === 'buy'
  const progress = getStatusProgress(order.status || 'awaiting-deposit')
  const orderLink = typeof window !== 'undefined' ? window.location.href : ''

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-center gap-4 mb-4">
            <Button
              onClick={() => router.push('/')}
              className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            {order.isPrivateDeal && (
              <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
                <Lock className="w-4 h-4 text-yellow-400" />
                <span className="text-yellow-400 text-sm font-medium">Private Deal</span>
              </div>
            )}
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Order Summary</h2>
          <div className="text-lg text-blue-300 font-semibold">
            Order ID: {order.orderId}
          </div>
          {order.isPrivateDeal && (
            <div className="mt-2 text-sm text-yellow-400">
              ⚠️ This is a private deal. Share this link only with your counterparty.
            </div>
          )}
        </motion.div>

        {/* Order Details */}
        <motion.div
          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h3 className="text-xl font-bold text-white mb-4">Order Details</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-white/70 mb-1">Direction</div>
              <div className="text-lg font-bold text-white">
                {isBuying ? '🛒 Buying Canton' : '💸 Selling Canton'}
              </div>
            </div>
            <div>
              <div className="text-sm text-white/70 mb-1">Status</div>
              <div className="text-lg font-bold text-blue-300 capitalize">
                {order.status || 'pending'}
              </div>
            </div>
            <div>
              <div className="text-sm text-white/70 mb-1">Payment Amount</div>
              <div className="text-lg font-bold text-white">
                {formatCurrency(order.paymentAmount)} {order.paymentToken?.symbol || 'USDT'}
              </div>
              <div className="text-sm text-white/50">
                ≈ ${formatCurrency(order.paymentAmountUSD, 2)} USD
              </div>
            </div>
            <div>
              <div className="text-sm text-white/70 mb-1">Canton Amount</div>
              <div className="text-lg font-bold text-green-300">
                {formatCurrency(order.cantonAmount)} CC
              </div>
            </div>
            {order.manualPrice && (
              <div>
                <div className="text-sm text-white/70 mb-1">Price per CC</div>
                <div className="text-lg font-bold text-white">
                  ${formatCurrency(order.manualPrice, 4)}
                </div>
              </div>
            )}
            {order.serviceCommission && (
              <div>
                <div className="text-sm text-white/70 mb-1">Service Commission</div>
                <div className="text-lg font-bold text-white">
                  {order.serviceCommission}%
                </div>
              </div>
            )}
          </div>

          {/* Addresses */}
          <div className="mt-6 space-y-4">
            <div>
              <div className="text-sm text-white/70 mb-2">Canton Address</div>
              <div className="flex items-center gap-2">
                <div className="text-sm text-cyan-300 font-mono break-all flex-1">
                  {order.cantonAddress}
                </div>
                <Button
                  onClick={() => copyToClipboard(order.cantonAddress, 'Canton Address')}
                  className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {order.receivingAddress && (
              <div>
                <div className="text-sm text-white/70 mb-2">Receiving Address</div>
                <div className="flex items-center gap-2">
                  <div className="text-sm text-cyan-300 font-mono break-all flex-1">
                    {order.receivingAddress}
                  </div>
                  <Button
                    onClick={() => copyToClipboard(order.receivingAddress, 'Receiving Address')}
                    className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Progress Steps */}
        <motion.div
          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="text-lg font-bold text-white mb-6 text-center">Exchange Progress</h3>
          
          <div className="flex justify-between mb-8">
            {OTC_CONFIG.PROCESSING_STEPS.map((step) => (
              <StepIndicator
                key={step.id}
                step={step.id}
                isActive={progress.current === step.id}
                isCompleted={progress.current > step.id}
              />
            ))}
          </div>

          <div className="text-center">
            <div className="text-sm font-semibold text-blue-300 mb-2">
              {OTC_CONFIG.PROCESSING_STEPS[progress.current - 1]?.name || 'Processing'}
            </div>
            <div className="text-xs text-white/70">
              {OTC_CONFIG.PROCESSING_STEPS[progress.current - 1]?.description || 'Please wait...'}
            </div>
          </div>
        </motion.div>

        {/* Share Link */}
        {orderLink && (
          <motion.div
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h3 className="text-lg font-bold text-white mb-4">Share Order Link</h3>
            <div className="flex items-center gap-2">
              <div className="flex-1 text-sm text-blue-300 font-mono break-all bg-white/5 p-3 rounded-lg">
                {orderLink}
              </div>
              <Button
                onClick={() => copyToClipboard(orderLink, 'Order link')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            {order.isPrivateDeal && (
              <div className="mt-3 text-xs text-yellow-400">
                ⚠️ This is a private deal. Only share this link with your counterparty.
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}

