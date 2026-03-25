'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import WalletDetailsForm from '@/components/WalletDetailsForm'
import OrderSummary from '@/components/OrderSummary'
import IntegratedLandingPage from '@/components/IntegratedLandingPage'
// import SupportButton from '@/components/SupportButton'
import { TokenConfig } from '@/config/otc'

type Step = 'landing' | 'wallet' | 'summary'

interface ExchangeData {
  paymentToken: TokenConfig;
  paymentAmount: number;
  paymentAmountUSD: number;
  cantonAmount: number;
  // Legacy compatibility
  usdtAmount: number;
  exchangeDirection?: 'buy' | 'sell';
  isPrivateDeal?: boolean; // ✅ Приватная сделка
  isMarketPrice?: boolean; // REQ-002: Сделка по рыночной цене
  marketPriceDiscountPercent?: number; // Процент дисконта от рыночной цены
  serviceCommission?: number; // REQ-006: Комиссия сервиса в %
}

interface WalletData {
  cantonAddress: string;
  receivingAddress?: string; // ✅ При sell: адрес для получения USDT
  refundAddress?: string;
  email: string;
  whatsapp?: string;
  telegram?: string;
}

export default function Home() {
  const [currentStep, setCurrentStep] = useState<Step>('landing')
  const [exchangeData, setExchangeData] = useState<ExchangeData | null>(null)
  const [walletData, setWalletData] = useState<WalletData | null>(null)
  
  const handleExchangeSubmit = (data: ExchangeData) => {
    setExchangeData(data)
    setCurrentStep('wallet')
  }

  const handleWalletSubmit = (data: WalletData) => {
    setWalletData(data)
    setCurrentStep('summary')
  }

  const handleBackToExchange = () => {
    setCurrentStep('landing')
  }

  const handleBackToWallet = () => {
    setCurrentStep('wallet')
  }

  return (
    <div className="w-full">
      {/* Support Button - handled by IntercomProvider fallback */}
      
      <AnimatePresence mode="wait">
          {currentStep === 'landing' && (
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
            >
              <IntegratedLandingPage onExchangeSubmit={handleExchangeSubmit} />
            </motion.div>
          )}

          {currentStep === 'wallet' && exchangeData && (
            <motion.div
              key="wallet"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.6, ease: [0.6, 0.05, 0.01, 0.9] }}
            >
              <WalletDetailsForm
                onBack={handleBackToExchange}
                onNext={handleWalletSubmit}
                exchangeData={{
                  // Updated for new structure
                  paymentToken: exchangeData.paymentToken,
                  paymentAmount: exchangeData.paymentAmount,
                  paymentAmountUSD: exchangeData.paymentAmountUSD,
                  cantonAmount: exchangeData.cantonAmount,
                  // Legacy fields for compatibility
                  usdtAmount: exchangeData.usdtAmount,
                  exchangeDirection: exchangeData.exchangeDirection, // ✅ Передаем направление обмена
                  isPrivateDeal: exchangeData.isPrivateDeal, // ✅ Передаем флаг приватной сделки
                  isMarketPrice: exchangeData.isMarketPrice, // REQ-002: Передаем флаг рыночной цены
                  serviceCommission: exchangeData.serviceCommission // REQ-006: Передаем комиссию сервиса
                }}
              />
            </motion.div>
          )}

          {currentStep === 'summary' && exchangeData && walletData && (
            <motion.div
              key="summary"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.6, ease: [0.6, 0.05, 0.01, 0.9] }}
            >
              <OrderSummary
                onBack={handleBackToWallet}
                orderData={{
                  ...exchangeData,
                  ...walletData
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
    </div>
  )
}
