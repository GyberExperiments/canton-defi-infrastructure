/**
 * Limit Order Panel Component
 * Создание и управление limit orders
 */

'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Target, Clock, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'
import TokenSelector from './TokenSelector'
import { type Token, getSwapableTokens, NEAR_TOKENS } from '@/lib/near-tokens'
import { limitOrderOperations, type LimitOrder as LimitOrderDB } from '@/lib/supabase'

interface LimitOrder {
  id: string
  fromToken: string
  toToken: string
  amount: number
  targetPrice: number
  currentPrice: number
  status: 'pending' | 'filled' | 'cancelled' | 'expired'
  createdAt: number
  expiresAt?: number
}

export default function LimitOrderPanel() {
  const [fromToken, setFromToken] = useState<Token | null>(null)
  const [toToken, setToToken] = useState<Token | null>(null)
  const [amount, setAmount] = useState('')
  const [targetPrice, setTargetPrice] = useState('')
  const [orders, setOrders] = useState<LimitOrder[]>([])
  const [tokens] = useState<Token[]>(NEAR_TOKENS.filter(t => t.chain === 'NEAR' || t.chain === 'AURORA'))
  const userAccount = typeof window !== 'undefined' ? localStorage.getItem('near_wallet_account') : null

  useEffect(() => {
    if (userAccount) {
      loadOrders()
    }
  }, [userAccount])

  const loadOrders = async () => {
    if (!userAccount) return
    try {
      const loadedOrders = await limitOrderOperations.getByUser(userAccount, { status: 'pending' })
      setOrders(loadedOrders.map(o => ({
        id: o.id,
        fromToken: o.from_token,
        toToken: o.to_token,
        amount: parseFloat(o.amount),
        targetPrice: parseFloat(o.target_price),
        currentPrice: parseFloat(o.filled_price || o.target_price) * 0.95,
        status: o.status as any,
        createdAt: new Date(o.created_at).getTime(),
        expiresAt: o.expires_at ? new Date(o.expires_at).getTime() : undefined,
      })))
    } catch (error) {
      console.error('Error loading orders:', error)
    }
  }

  const handleCreateLimitOrder = async () => {
    if (!fromToken || !toToken || !amount || !targetPrice || !userAccount) {
      toast.error('Fill in all fields and connect wallet')
      return
    }

    try {
      // Преобразуем chain в формат ChainId (AURORA -> Aurora)
      const chainToChainId = (chain: string): 'NEAR' | 'Ethereum' | 'BSC' | 'Polygon' | 'Aurora' => {
        if (chain === 'AURORA') return 'Aurora'
        if (chain === 'ETHEREUM') return 'Ethereum'
        if (chain === 'POLYGON') return 'Polygon'
        if (chain === 'BSC') return 'BSC'
        return 'NEAR'
      }

      const newOrder = await limitOrderOperations.create({
        user_account: userAccount,
        from_token: fromToken.symbol,
        to_token: toToken.symbol,
        from_chain: chainToChainId(fromToken.chain),
        to_chain: chainToChainId(toToken.chain),
        amount: parseFloat(amount).toString(),
        target_price: parseFloat(targetPrice).toString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      })

      toast.success('Limit order created! It will execute automatically when price is reached.')
      setAmount('')
      setTargetPrice('')
      loadOrders() // Перезагрузить список
    } catch (error: any) {
      console.error('Error creating limit order:', error)
      toast.error(error.message || 'Failed to create limit order')
    }
  }

  return (
    <div className="glass-ultra rounded-3xl p-6 md:p-8 lg:p-12 shadow-2xl">
      <h2 className="text-fluid-2xl font-bold text-white mb-6 flex items-center gap-3">
        <Target className="w-6 h-6" />
        Limit Orders
      </h2>

      {/* Create Order Form */}
      <div className="glass-medium rounded-2xl p-6 mb-6">
        <h3 className="text-lg font-semibold text-white mb-4">Create Limit Order</h3>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Sell</label>
              <TokenSelector
                tokens={tokens}
                selectedToken={fromToken}
                onSelect={setFromToken}
                excludeTokens={toToken ? [toToken.symbol] : []}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Buy</label>
              <TokenSelector
                tokens={tokens}
                selectedToken={toToken}
                onSelect={setToToken}
                excludeTokens={fromToken ? [fromToken.symbol] : []}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Amount</label>
              <Input
                type="number"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                variant="dark"
              />
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
            onClick={handleCreateLimitOrder}
            className="w-full"
            disabled={!fromToken || !toToken || !amount || !targetPrice}
          >
            Create Limit Order
          </Button>
        </div>
      </div>

      {/* Active Orders */}
      {orders.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Active Orders</h3>
          <div className="space-y-3">
            {orders.filter(o => o.status === 'pending').map((order) => (
              <div
                key={order.id}
                className="glass-medium rounded-xl p-4 flex items-center justify-between"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-white">
                      {order.amount} {order.fromToken}
                    </span>
                    <span className="text-white/50">→</span>
                    <span className="font-medium text-white">
                      {order.toToken}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-white/70">
                    <span>Target: {order.targetPrice}</span>
                    <span>Current: {order.currentPrice}</span>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    try {
                      await limitOrderOperations.cancel(order.id)
                      toast.success('Order cancelled')
                      loadOrders()
                    } catch (error: any) {
                      toast.error(error.message || 'Failed to cancel order')
                    }
                  }}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {orders.length === 0 && (
        <div className="text-center py-8 text-white/50">
          <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No limit orders yet</p>
          <p className="text-sm mt-1">Create your first limit order above</p>
        </div>
      )}
    </div>
  )
}

