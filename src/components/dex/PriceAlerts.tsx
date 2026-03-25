/**
 * Price Alerts Component
 * Уведомления при достижении целевой цены
 */

'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bell, BellOff, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'
import TokenSelector from './TokenSelector'
import { type Token, getSwapableTokens, NEAR_TOKENS } from '@/lib/near-tokens'
import { priceAlertOperations, type PriceAlert } from '@/lib/supabase'

interface PriceAlertDisplay {
  id: string
  token: string
  targetPrice: number
  condition: 'above' | 'below'
  isActive: boolean
  createdAt: number
}

export default function PriceAlerts() {
  const [selectedToken, setSelectedToken] = useState<Token | null>(null)
  const [targetPrice, setTargetPrice] = useState('')
  const [condition, setCondition] = useState<'above' | 'below'>('above')
  const [alerts, setAlerts] = useState<PriceAlertDisplay[]>([])
  const [tokens] = useState<Token[]>(NEAR_TOKENS.filter(t => t.chain === 'NEAR' || t.chain === 'AURORA'))
  const userAccount = typeof window !== 'undefined' ? localStorage.getItem('near_wallet_account') : null

  useEffect(() => {
    if (userAccount) {
      loadAlerts()
    }
  }, [userAccount])

  const loadAlerts = async () => {
    if (!userAccount) return
    try {
      const loadedAlerts = await priceAlertOperations.getByUser(userAccount)
      setAlerts(loadedAlerts.map(a => ({
        id: a.id,
        token: a.token,
        targetPrice: parseFloat(a.target_price),
        condition: a.condition,
        isActive: a.is_active,
        createdAt: new Date(a.created_at).getTime(),
      })))
    } catch (error) {
      console.error('Error loading alerts:', error)
    }
  }

  const handleCreateAlert = async () => {
    if (!selectedToken || !targetPrice || !userAccount) {
      toast.error('Select token, enter target price, and connect wallet')
      return
    }

    try {
      await priceAlertOperations.create({
        user_account: userAccount,
        token: selectedToken.symbol,
        target_price: parseFloat(targetPrice).toString(),
        condition,
        notify_email: false,
        notify_push: true,
        notify_telegram: false,
      })

      toast.success('Price alert created!')
      setTargetPrice('')
      setSelectedToken(null)
      loadAlerts() // Перезагрузить список
    } catch (error: any) {
      console.error('Error creating alert:', error)
      toast.error(error.message || 'Failed to create alert')
    }
  }

  const toggleAlert = async (alertId: string) => {
    try {
      const alert = alerts.find(a => a.id === alertId)
      if (!alert) return

      await priceAlertOperations.toggleActive(alertId, !alert.isActive)
      loadAlerts()
      toast.success(`Alert ${!alert.isActive ? 'activated' : 'deactivated'}`)
    } catch (error: any) {
      toast.error(error.message || 'Failed to toggle alert')
    }
  }

  const deleteAlert = async (alertId: string) => {
    try {
      await priceAlertOperations.delete(alertId)
      loadAlerts()
      toast.success('Alert deleted')
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete alert')
    }
  }

  return (
    <div className="glass-ultra rounded-3xl p-6 md:p-8 lg:p-12 shadow-2xl">
      <h2 className="text-fluid-2xl font-bold text-white mb-6 flex items-center gap-3">
        <Bell className="w-6 h-6" />
        Price Alerts
      </h2>

      {/* Create Alert Form */}
      <div className="glass-medium rounded-2xl p-6 mb-6">
        <h3 className="text-lg font-semibold text-white mb-4">Create Alert</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Token</label>
            <TokenSelector
              tokens={tokens}
              selectedToken={selectedToken}
              onSelect={setSelectedToken}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Condition</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setCondition('above')}
                  className={cn(
                    "flex-1 px-4 py-2 rounded-lg font-medium transition-colors",
                    condition === 'above'
                      ? "bg-gradient-to-r from-violet-500 to-cyan-500 text-white"
                      : "bg-white/5 text-white/70 hover:bg-white/10"
                  )}
                >
                  Above
                </button>
                <button
                  onClick={() => setCondition('below')}
                  className={cn(
                    "flex-1 px-4 py-2 rounded-lg font-medium transition-colors",
                    condition === 'below'
                      ? "bg-gradient-to-r from-violet-500 to-cyan-500 text-white"
                      : "bg-white/5 text-white/70 hover:bg-white/10"
                  )}
                >
                  Below
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Target Price</label>
              <Input
                type="number"
                placeholder="0.0"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                variant="dark"
              />
            </div>
          </div>

          <Button
            onClick={handleCreateAlert}
            className="w-full"
            disabled={!selectedToken || !targetPrice}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Alert
          </Button>
        </div>
      </div>

      {/* Alerts List */}
      {alerts.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Active Alerts</h3>
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="glass-medium rounded-xl p-4 flex items-center justify-between"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-white">{alert.token}</span>
                    <span className={cn(
                      "text-sm px-2 py-0.5 rounded",
                      alert.condition === 'above' 
                        ? "bg-success/20 text-success" 
                        : "bg-error/20 text-error"
                    )}>
                      {alert.condition === 'above' ? '↑ Above' : '↓ Below'}
                    </span>
                  </div>
                  <p className="text-sm text-white/70">
                    Alert when price {alert.condition} ${alert.targetPrice}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleAlert(alert.id)}
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      alert.isActive
                        ? "bg-success/20 text-success hover:bg-success/30"
                        : "bg-white/5 text-white/50 hover:bg-white/10"
                    )}
                  >
                    {alert.isActive ? (
                      <Bell className="w-4 h-4" />
                    ) : (
                      <BellOff className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => deleteAlert(alert.id)}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {alerts.length === 0 && (
        <div className="text-center py-8 text-white/50">
          <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No price alerts yet</p>
          <p className="text-sm mt-1">Create an alert to be notified when price reaches your target</p>
        </div>
      )}
    </div>
  )
}

