'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, RefreshCw, Zap, Network } from 'lucide-react'
import SwapInterface from '@/components/dex/SwapInterface'
import BridgeInterface from '@/components/dex/BridgeInterface'
import IntentHistory from '@/components/dex/IntentHistory'
import PortfolioTracker from '@/components/dex/PortfolioTracker'
import PriceChart from '@/components/dex/PriceChart'
import AnalyticsDashboard from '@/components/dex/AnalyticsDashboard'
import LimitOrderPanel from '@/components/dex/LimitOrderPanel'
import PriceAlerts from '@/components/dex/PriceAlerts'
import { Button } from '@/components/ui/Button'
import { useAnimationConfig } from '@/hooks/useIsMobile'
import { initWalletSelector } from '@/lib/near-wallet-selector'

type DexMode = 'swap' | 'bridge' | 'portfolio' | 'analytics' | 'limits' | 'alerts'

export default function DexPage() {
  const [mode, setMode] = useState<DexMode>('swap')
  const { isMobile, shouldReduceAnimations } = useAnimationConfig()

  // Инициализируем wallet selector при загрузке страницы
  useEffect(() => {
    const network = (process.env.NEXT_PUBLIC_NEAR_NETWORK as 'mainnet' | 'testnet') || 'testnet'
    initWalletSelector({ network })
  }, [])

  return (
    <div className="relative min-h-screen w-full">
      {/* Hero Header */}
      <motion.div
        className="text-center py-12 px-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <motion.h1
          className="text-4xl md:text-6xl font-bold mb-4 gradient-text-aurora"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          1OTC DEX
        </motion.h1>
        <motion.p
          className="text-lg md:text-xl text-white/70 mb-8 max-w-2xl mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          Multichain token exchange with minimal fees. Swap and Bridge between different blockchains.
        </motion.p>

        {/* Mode Toggle */}
        <motion.div
          className="flex items-center justify-center gap-2 md:gap-4 mb-8 flex-wrap"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
        >
          <Button
            variant={mode === 'swap' ? 'default' : 'secondary'}
            onClick={() => setMode('swap')}
            className="min-w-[120px] md:min-w-[140px]"
          >
            <Zap className="w-4 h-4 mr-2" />
            Swap
          </Button>
          <Button
            variant={mode === 'bridge' ? 'default' : 'secondary'}
            onClick={() => setMode('bridge')}
            className="min-w-[120px] md:min-w-[140px]"
          >
            <Network className="w-4 h-4 mr-2" />
            Bridge
          </Button>
          <Button
            variant={mode === 'portfolio' ? 'default' : 'secondary'}
            onClick={() => setMode('portfolio')}
            className="min-w-[120px] md:min-w-[140px]"
          >
            <ArrowRight className="w-4 h-4 mr-2" />
            Portfolio
          </Button>
          <Button
            variant={mode === 'analytics' ? 'default' : 'secondary'}
            onClick={() => setMode('analytics')}
            className="min-w-[120px] md:min-w-[140px]"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Analytics
          </Button>
        </motion.div>
      </motion.div>

      {/* Main Interface */}
      <div className="max-w-6xl mx-auto px-4 pb-16 space-y-8">
        <AnimatePresence mode="wait">
          {mode === 'swap' && (
            <motion.div
              key="swap"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.5 }}
              className="space-y-8"
            >
              <SwapInterface />
              <PriceChart fromToken="NEAR" toToken="USDT" />
            </motion.div>
          )}
          {mode === 'bridge' && (
            <motion.div
              key="bridge"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.5 }}
            >
              <BridgeInterface />
            </motion.div>
          )}
          {mode === 'portfolio' && (
            <motion.div
              key="portfolio"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.5 }}
            >
              <PortfolioTracker />
            </motion.div>
          )}
          {mode === 'analytics' && (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.5 }}
            >
              <AnalyticsDashboard />
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Transaction History - показываем только для swap/bridge */}
        {(mode === 'swap' || mode === 'bridge') && <IntentHistory />}
      </div>

      {/* Powered by NEAR Footer */}
      <div className="text-center py-8 px-6">
        <p className="text-xs text-white/30">
          Powered by{' '}
          <a 
            href="https://near.org" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-white/40 hover:text-white/60 transition-colors"
          >
            NEAR Protocol
          </a>
        </p>
      </div>
    </div>
  )
}

