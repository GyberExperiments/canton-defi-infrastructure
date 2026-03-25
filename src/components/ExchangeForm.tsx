'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, RefreshCw, Sparkles, Zap, Shield, Clock, Loader2, ShoppingCart, TrendingDown, Edit } from 'lucide-react'
import Image from 'next/image'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import TokenSelector from './TokenSelector'
import { TokenConfig, SUPPORTED_TOKENS } from '@/config/otc'
import { useCantonPrices, useLimits } from './ConfigProvider'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'
import { toast } from 'react-hot-toast'
// import { intercomUtils } from './IntercomProvider'

interface ExchangeFormProps {
  onProceed: (data: { 
    paymentToken: TokenConfig;
    paymentAmount: number;
    paymentAmountUSD: number;
    cantonAmount: number;
    // Legacy compatibility
    usdtAmount: number;
    exchangeDirection?: 'buy' | 'sell';
    manualPrice?: number;
    serviceCommission?: number;
    isPrivateDeal?: boolean; // ✅ Приватная сделка
    isMarketPrice?: boolean; // REQ-002: Make a deal at market price
    marketPriceDiscountPercent?: number; // Процент дисконта от рыночной цены
  }) => void;
}

export default function ExchangeForm({ onProceed }: ExchangeFormProps) {
  // Get dynamic prices from ConfigProvider
  const { buyPrice, sellPrice } = useCantonPrices()
  const { minCantonAmount: configMinCantonAmount, minUsdtAmount, maxUsdtAmount } = useLimits()
  
  const [selectedToken, setSelectedToken] = useState<TokenConfig | null>(null) // No default selection - user must choose
  const [paymentAmount, setPaymentAmount] = useState('')
  const [cantonAmount, setCantonAmount] = useState('')
  const [isCalculating, setIsCalculating] = useState(false)
  const [exchangeDirection, setExchangeDirection] = useState<'buy' | 'sell'>('buy') // 'buy' = USDT → Canton, 'sell' = Canton → USDT
  const [serviceCommission, setServiceCommission] = useState(1) // Default 1%
  const [customPrice, setCustomPrice] = useState('') // Цена всегда вводится вручную
  const [priceWarning, setPriceWarning] = useState<string | null>(null) // Предупреждение о цене
  const [isPrivateDeal, setIsPrivateDeal] = useState(false) // Private deal чекбокс
  const [isMarketPrice, setIsMarketPrice] = useState(false) // REQ-002: Make a deal at market price
  const [marketPriceDiscountPercent, setMarketPriceDiscountPercent] = useState('') // Процент дисконта от рыночной цены (от 0.1%)
  
  // ✅ Логируем изменения цен
  useEffect(() => {
    console.log('💰 ExchangeForm: Prices updated', {
      buyPrice,
      sellPrice,
      direction: exchangeDirection,
      currentPrice: exchangeDirection === 'buy' ? buyPrice : sellPrice
    });
  }, [buyPrice, sellPrice, exchangeDirection]);

  const calculateAmounts = useCallback((amount: string, token: TokenConfig | null) => {
    if (!amount || !token || parseFloat(amount) <= 0) {
      setCantonAmount('')
      return
    }

    const amountValue = parseFloat(amount)
    
    // Get current price with discount applied if market price is selected
    let currentPrice: number
    if (isMarketPrice) {
      // Применяем дисконт к рыночной цене
      const marketPrice = exchangeDirection === 'buy' ? buyPrice : sellPrice
      const discountPercent = marketPriceDiscountPercent ? parseFloat(marketPriceDiscountPercent) : 0
      currentPrice = marketPrice * (1 - discountPercent / 100)
    } else {
      // Используем ручную цену если указана, иначе рыночную
      currentPrice = customPrice 
        ? parseFloat(customPrice) 
        : (exchangeDirection === 'buy' ? buyPrice : sellPrice)
    }
    
    if (exchangeDirection === 'buy') {
      // Buying Canton with USDT
      // ✅ Используем динамический лимит из конфигурации
      const dynamicMinAmount = minUsdtAmount || token.minAmount;
      if (amountValue < dynamicMinAmount) {
        toast.error(`Minimum amount: ${dynamicMinAmount} ${token.symbol}`)
        return
      }
      

      setIsCalculating(true)
      
      // ✅ ИСПРАВЛЕНО: Используем динамическую цену из ConfigProvider или ручную
      const usdValue = amountValue * token.priceUSD
      
      // ✅ УПРОЩЕННАЯ ЛОГИКА: Без объемных скидок
      // Сначала рассчитываем базовое количество без комиссии
      const baseAmount = usdValue / currentPrice
      
      // Вычитаем комиссию из получаемого количества (комиссия = 1% от получаемого)
      const canton = baseAmount * (1 - serviceCommission / 100)
      
      setCantonAmount(formatNumber(canton))
    } else {
      // Selling Canton for USDT
      const minCantonAmount = configMinCantonAmount || 5
      
      if (amountValue < minCantonAmount) {
        toast.error(`Minimum amount: ${formatNumber(minCantonAmount)} Canton`)
        return
      }
      

      setIsCalculating(true)
      
      // ✅ УПРОЩЕННАЯ ЛОГИКА: Без объемных скидок
      // При продаже: сначала рассчитываем базовую стоимость
      const baseUsdValue = amountValue * currentPrice
      
      // ✅ НОВАЯ ЛОГИКА: Комиссия вычитается из получаемой суммы (1% от суммы)
      const usdValue = baseUsdValue * (1 - serviceCommission / 100)
      
      const usdtAmount = usdValue / token.priceUSD
      setCantonAmount(formatNumber(usdtAmount))
    }
    
    setIsCalculating(false)
  }, [exchangeDirection, buyPrice, sellPrice, configMinCantonAmount, serviceCommission, customPrice, isMarketPrice, marketPriceDiscountPercent])

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setPaymentAmount(value)
    calculateAmounts(value, selectedToken)
  }

  const handleTokenChange = (token: TokenConfig) => {
    setSelectedToken(token)
    setPaymentAmount('')
    setCantonAmount('')
  }

  const validateCustomPrice = (price: number, marketPrice: number): {valid: boolean, warning?: string} => {
    // Проверка на валидное число
    if (isNaN(price) || price <= 0) {
      return {valid: false, warning: 'Price must be greater than 0'};
    }
    // Рекомендательное предупреждение, не блокирующее
    if (price < marketPrice * 0.9) {
      return {valid: true, warning: `Price is ${((1 - price/marketPrice) * 100).toFixed(0)}% below market`};
    }
    if (price > marketPrice * 1.1) {
      return {valid: true, warning: `Price is ${((price/marketPrice - 1) * 100).toFixed(0)}% above market`};
    }
    return {valid: true};
  }

  const handleCustomPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setCustomPrice(value)
    
    if (value && selectedToken) {
      const price = parseFloat(value)
      
      // Проверка на валидное число
      if (isNaN(price)) {
        setPriceWarning(null)
        return
      }
      
      const marketPrice = exchangeDirection === 'buy' ? buyPrice : sellPrice
      const validation = validateCustomPrice(price, marketPrice)
      
      // Показываем предупреждение, но не блокируем
      if (validation.warning) {
        setPriceWarning(validation.warning)
      } else {
        setPriceWarning(null)
      }
      
      // Пересчитываем только если цена валидна
      if (validation.valid && price > 0) {
        calculateAmounts(paymentAmount, selectedToken)
      } else {
        // Очищаем результаты если цена невалидна
        setCantonAmount('')
      }
    } else {
      setPriceWarning(null)
      // Если цена пустая, используем рыночную для расчетов
      if (selectedToken && paymentAmount) {
        calculateAmounts(paymentAmount, selectedToken)
      }
    }
  }

  // Load service commission from API
  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (data.serviceCommission !== undefined) {
          setServiceCommission(data.serviceCommission)
        }
      })
      .catch(() => {
        // Use default 1% if API fails
        setServiceCommission(1)
      })
  }, [])

  // REQ-002: Auto-set market price when checkbox is activated
  useEffect(() => {
    if (isMarketPrice) {
      const marketPrice = exchangeDirection === 'buy' ? buyPrice : sellPrice
      setCustomPrice(marketPrice.toString())
      setPriceWarning(null)
      // Пересчитываем суммы при изменении market price или дисконта
      if (paymentAmount && selectedToken) {
        calculateAmounts(paymentAmount, selectedToken)
      }
    }
  }, [isMarketPrice, exchangeDirection, buyPrice, sellPrice, marketPriceDiscountPercent, paymentAmount, selectedToken, calculateAmounts])

  const handleProceed = () => {
    if (!selectedToken || !paymentAmount || !cantonAmount) {
      toast.error('Please select a token and enter an amount')
      return
    }

    const amountValue = parseFloat(paymentAmount)
    const resultValue = parseFloat(cantonAmount.replace(/,/g, ''))

    if (exchangeDirection === 'buy') {
      // Buying Canton with USDT
      // ✅ Используем динамический лимит из конфигурации
      const dynamicMinAmount = minUsdtAmount || selectedToken.minAmount;
      if (amountValue < dynamicMinAmount) {
        toast.error(`Minimum amount: ${dynamicMinAmount} ${selectedToken.symbol}`)
        return
      }

      const paymentAmountUSD = amountValue * selectedToken.priceUSD

      // Рассчитываем цену с учетом дисконта если market price
      let finalPrice: number | undefined
      if (isMarketPrice) {
        const marketPrice = exchangeDirection === 'buy' ? buyPrice : sellPrice
        const discountPercent = marketPriceDiscountPercent ? parseFloat(marketPriceDiscountPercent) : 0
        finalPrice = marketPrice * (1 - discountPercent / 100)
      } else {
        finalPrice = customPrice ? parseFloat(customPrice) : undefined
      }

      onProceed({
        paymentToken: selectedToken,
        paymentAmount: amountValue,
        paymentAmountUSD,
        cantonAmount: resultValue,
        // Legacy compatibility
        usdtAmount: selectedToken.symbol === 'USDT' ? amountValue : paymentAmountUSD,
        exchangeDirection,
        manualPrice: finalPrice,
        serviceCommission,
        isPrivateDeal,
        isMarketPrice,
        marketPriceDiscountPercent: isMarketPrice && marketPriceDiscountPercent ? parseFloat(marketPriceDiscountPercent) : undefined
      })
    } else {
      // Selling Canton for USDT
      const minCantonAmount = configMinCantonAmount || 5
      
      if (amountValue < minCantonAmount) {
        toast.error(`Minimum amount: ${formatNumber(minCantonAmount)} Canton`)
        return
      }

      // Рассчитываем цену с учетом дисконта если market price
      let finalPrice: number | undefined
      if (isMarketPrice) {
        const marketPrice = sellPrice
        const discountPercent = marketPriceDiscountPercent ? parseFloat(marketPriceDiscountPercent) : 0
        finalPrice = marketPrice * (1 - discountPercent / 100)
      } else {
        finalPrice = customPrice ? parseFloat(customPrice) : undefined
      }
      
      const currentPrice = finalPrice || sellPrice
      const baseUsdValue = amountValue * currentPrice
      
      // Упрощенный расчет без скидок
      const paymentAmountUSD = baseUsdValue * (1 - serviceCommission / 100)

      // ✅ ИСПРАВЛЕНО: При sell правильно передаем Canton и USDT количества
      onProceed({
        paymentToken: selectedToken,
        paymentAmount: resultValue, // USDT amount (результат обмена)
        paymentAmountUSD,
        cantonAmount: amountValue, // Canton amount (что продаем)
        usdtAmount: resultValue,
        exchangeDirection,
        manualPrice: finalPrice,
        serviceCommission,
        isPrivateDeal,
        isMarketPrice,
        marketPriceDiscountPercent: isMarketPrice && marketPriceDiscountPercent ? parseFloat(marketPriceDiscountPercent) : undefined
      })
    }
  }

  // REQ-002: Allow proceeding if market price is selected (customPrice not required)
  const canProceed = selectedToken && paymentAmount && cantonAmount && (isMarketPrice || (customPrice && parseFloat(customPrice) > 0)) && !isCalculating

  return (
    <div>
      {/* Aurora Mesh Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-slate-950" />
        
        {/* Animated mesh gradients */}
        <motion.div
          className="absolute top-10 left-15 w-[600px] h-[600px] rounded-full opacity-30 blur-3xl"
          style={{
            background: 'radial-gradient(circle, #8B5CF6 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
          animate={{
            x: [0, 30, -20, 0],
            y: [0, -50, 30, 0],
            scale: [1, 1.1, 0.9, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
        
        <motion.div
          className="absolute bottom-20 right-10 w-[500px] h-[500px] rounded-full opacity-30 blur-3xl"
          style={{
            background: 'radial-gradient(circle, #06B6D4 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
          animate={{
            x: [0, -30, 20, 0],
            y: [0, 30, -50, 0],
            scale: [1, 0.9, 1.2, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        />
        
        <motion.div
          className="absolute top-1/2 left-1/2 w-[400px] h-[400px] rounded-full opacity-25 blur-3xl"
          style={{
            background: 'radial-gradient(circle, #3B82F6 0%, transparent 70%)',
            filter: 'blur(80px)',
            transform: 'translate(-50%, -50%)',
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.25, 0.4, 0.25],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

    <motion.div 
        className="relative z-10 max-w-3xl mx-auto px-5 sm:px-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.6, 0.05, 0.01, 0.9] }}
    >
        {/* Ultra Modern Header */}
        <div className="text-center mb-16 px-3">
        {/* ✨ Modern Logo with Enhanced Effects */}
        <motion.div 
            className="inline-flex items-center gap-4 mb-10"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 200, damping: 20 }}
          >
            <div className="relative group">
              {/* Dark ultra-modern glow */}
              <motion.div 
                className="absolute inset-0 rounded-full bg-black/40 blur-[60px] scale-140"
                animate={{
                  scale: [1.4, 1.5, 1.4],
                  opacity: [0.4, 0.6, 0.4],
                }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              />
              
              {/* Gradient ring */}
              <motion.div 
                className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-900/30 via-blue-900/20 to-cyan-900/10 blur-[50px] scale-120"
                animate={{
                  rotate: [0, 360],
                }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
              />
              
              {/* Dark glass effect */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-slate-900/80 via-gray-900/70 to-black/80 backdrop-blur-md shadow-[0_0_60px_rgba(0,0,0,0.7)]" />
              
              {/* Logo with glow */}
              <div className="relative w-48 h-48 md:w-56 md:h-56 z-10 drop-shadow-[0_0_40px_rgba(139,92,246,0.3)]">
                <Image 
                  src="/1otc-logo-premium.svg" 
                  alt="1OTC Logo" 
                  fill
                  sizes="(max-width: 768px) 192px, 224px"
                  className="object-contain"
                  priority
                />
              </div>
              
              {/* Floating orbs */}
              <motion.div 
                className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-violet-500/25 blur-md"
                animate={{
                  y: [-10, 10, -10],
                  opacity: [0.25, 0.5, 0.25],
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div 
                className="absolute -bottom-3 -left-3 w-5 h-5 rounded-full bg-blue-500/25 blur-md"
                animate={{
                  y: [10, -10, 10],
                  opacity: [0.25, 0.5, 0.25],
                }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              />
            </div>
        </motion.div>
        
        <motion.h1 
            className="text-5xl md:text-6xl font-black mb-5 leading-[1.2] pb-[0.25em] overflow-visible"
            initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
          >
            <span className="inline-block bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent animate-gradient-x">
              Canton
            </span>
            <br />
            <span className="inline-block bg-gradient-to-r from-white via-white/90 to-white/60 bg-clip-text text-transparent pb-[0.05em] align-baseline descender-safe">
              OTC Exchange
            </span>
        </motion.h1>
        
        <motion.p 
            className="text-xl text-white/70 font-medium mb-10 leading-relaxed max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
        >
            Ultra-Fast • Secure • Revolutionary
        </motion.p>
        
      </div>

        {/* Ultra Glass Exchange Card */}
        <motion.div 
          className="relative group mb-12"
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.8, duration: 0.8, ease: [0.6, 0.05, 0.01, 0.9] }}
        >
          {/* Dynamic Outer glow - changes color based on exchange direction */}
          <motion.div 
            className="absolute -inset-1 rounded-[2rem] blur-2xl transition-all duration-700"
            animate={{
              background: exchangeDirection === 'buy' 
                ? 'linear-gradient(45deg, #8B5CF6, #3B82F6, #06B6D4)' 
                : 'linear-gradient(45deg, #EF4444, #F97316, #DC2626)',
              opacity: [0.2, 0.4, 0.2],
              scale: [1, 1.05, 1]
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity, 
              ease: "easeInOut",
              background: { duration: 0.7 }
            }}
          />
          
          {/* Additional red pulse effect for sell mode */}
          <AnimatePresence>
            {exchangeDirection === 'sell' && (
              <motion.div
                className="absolute -inset-2 rounded-[2rem] blur-3xl"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ 
                  opacity: [0, 0.6, 0],
                  scale: [0.8, 1.2, 0.8],
                  background: 'radial-gradient(circle, #EF4444, #DC2626, transparent)'
                }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ 
                  duration: 1.5, 
                  repeat: Infinity, 
                  ease: "easeInOut" 
                }}
              />
            )}
          </AnimatePresence>
          
          {/* Main card with dynamic prismatic glass */}
          <motion.div 
            className="relative backdrop-blur-2xl rounded-[2rem] p-6 sm:p-8 lg:p-10 overflow-hidden"
            animate={{
              background: exchangeDirection === 'buy' 
                ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)'
                : 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.1) 100%)',
              border: exchangeDirection === 'buy' 
                ? '1px solid rgba(255, 255, 255, 0.18)'
                : '1px solid rgba(239, 68, 68, 0.3)',
              boxShadow: exchangeDirection === 'buy'
                ? '0 8px 32px rgba(31, 38, 135, 0.37), inset 0 1px 1px rgba(255, 255, 255, 0.15)'
                : '0 8px 32px rgba(239, 68, 68, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.1), 0 0 40px rgba(239, 68, 68, 0.2)'
            }}
            transition={{ duration: 0.7, ease: "easeInOut" }}
          >
            
            {/* Top highlight */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            
            {/* Floating decorative elements */}
            <div className="absolute top-8 right-8 w-24 h-24 bg-gradient-to-br from-violet-500/20 to-cyan-500/20 rounded-full blur-2xl" />
            <div className="absolute bottom-8 left-8 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-emerald-500/20 rounded-full blur-3xl" />

            <div className="relative z-10 space-y-10">
              {/* REQ-001: Form Header and Buy/Sell Buttons */}
              <motion.div
                className="text-center space-y-4"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.6 }}
              >
                <h2 className="text-3xl md:text-4xl font-black text-white">
                  Do you want to BUY or SELL Canton?
                </h2>
                <p className="text-lg md:text-xl text-white/80 font-medium">
                  Make your choice!
                </p>
                
                {/* Buy/Sell Buttons */}
                <motion.div 
                  className="flex gap-4 mt-6"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1.0, type: "spring", stiffness: 200 }}
                >
                  <motion.button
                    onClick={() => {
                      if (exchangeDirection !== 'buy') {
                        setExchangeDirection('buy')
                        setPaymentAmount('')
                        setCantonAmount('')
                      }
                    }}
                    className={cn(
                      "flex-1 py-4 px-6 rounded-xl font-bold text-lg transition-all",
                      exchangeDirection === 'buy' 
                        ? "bg-gradient-to-r from-green-600 to-emerald-500 text-white shadow-lg scale-105"
                        : "bg-white/10 text-white/60 hover:bg-white/20"
                    )}
                    whileHover={exchangeDirection === 'buy' ? {} : { scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span className="flex items-center justify-center gap-2">
                      <ShoppingCart className="w-5 h-5" />
                      BUY Canton
                    </span>
                  </motion.button>
                  <motion.button
                    onClick={() => {
                      if (exchangeDirection !== 'sell') {
                        setExchangeDirection('sell')
                        setPaymentAmount('')
                        setCantonAmount('')
                      }
                    }}
                    className={cn(
                      "flex-1 py-4 px-6 rounded-xl font-bold text-lg transition-all",
                      exchangeDirection === 'sell'
                        ? "bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-lg scale-105"
                        : "bg-white/10 text-white/60 hover:bg-white/20"
                    )}
                    whileHover={exchangeDirection === 'sell' ? {} : { scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span className="flex items-center justify-center gap-2">
                      <TrendingDown className="w-5 h-5" />
                      SELL Canton
                    </span>
                  </motion.button>
                </motion.div>
              </motion.div>

              {/* Exchange Rate Display - Holographic style */}
              <motion.div 
                className="relative text-center p-6 sm:p-8 rounded-3xl overflow-hidden group/rate"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1, duration: 0.6 }}
                style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(6, 182, 212, 0.1))',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                }}
              >
                {/* Shimmer effect */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                  animate={{ x: ['-200%', '200%'] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                />
                
                <div className="relative z-10">
                  <div className="flex items-center justify-center gap-2 mb-5">
      <motion.div 
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <svg className="w-5 h-5 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                    </motion.div>
                     <span className="text-orange-300 font-bold text-base">We are currently operating manually!</span>
            </div>
                  <motion.div 
                     className="text-3xl font-black bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent"
                    animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
                    transition={{ duration: 4, repeat: Infinity }}
                  >
                    1 CC = ${formatCurrency(customPrice ? parseFloat(customPrice) : (exchangeDirection === 'buy' ? buyPrice : sellPrice), 4)}
                    {customPrice && <span className="text-sm text-white/70 ml-2">(manual)</span>}
                  </motion.div>
                  {/* Service Commission Display */}
                  <div className="text-center mt-2">
                    <p className="text-sm text-white/70">
                      Service Commission: <span className="font-bold text-cyan-400">{serviceCommission}%</span>
                    </p>
                    <p className="text-xs text-white/50 mt-1">
                      Commission is deducted from the final amount
                    </p>
                  </div>
            </div>
              </motion.div>

              {/* REQ-002: Make a deal at market price checkbox */}
              <motion.div
                className="relative"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.05, duration: 0.6 }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <input
                    type="checkbox"
                    id="marketPriceCheckbox"
                    checked={isMarketPrice}
                    onChange={(e) => {
                      setIsMarketPrice(e.target.checked)
                      if (!e.target.checked) {
                        setCustomPrice('')
                      }
                    }}
                    className="w-5 h-5 rounded border-2 border-white/30 bg-white/10 checked:bg-violet-500 checked:border-violet-500 cursor-pointer"
                  />
                  <label htmlFor="marketPriceCheckbox" className="text-white font-medium cursor-pointer">
                    Make a deal at market price
                  </label>
                </div>
              </motion.div>

              {/* Your Price - ОБЯЗАТЕЛЬНОЕ ПОЛЕ (скрыто если market price) */}
              {!isMarketPrice && (
                <motion.div
                  className="relative"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.1, duration: 0.6 }}
                >
                  <label className="block text-sm text-white/80 mb-2">
                    Your Price (per 1 CC) <span className="text-red-400">*</span>
                  </label>
                  <Input
                    type="number"
                    value={customPrice}
                    onChange={handleCustomPriceChange}
                    step="0.0001"
                    className="text-lg font-bold"
                    placeholder="Enter your price"
                    required
                  />
                  <p className="text-xs text-white/60 mt-1">
                    Market price: ${formatCurrency(exchangeDirection === 'buy' ? buyPrice : sellPrice, 4)} (reference only)
                  </p>
                  {priceWarning && (
                    <p className="text-xs text-yellow-400 mt-1">
                      ⚠️ {priceWarning}
                    </p>
                  )}
                </motion.div>
              )}
              {isMarketPrice && (
                <motion.div
                  className="relative"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.1, duration: 0.6 }}
                >
                  <p className="text-xs text-white/60 mt-1 mb-2">
                    Market price: ${formatCurrency(exchangeDirection === 'buy' ? buyPrice : sellPrice, 4)} (reference only)
                  </p>
                  
                  {/* Поле ввода процента дисконта */}
                  <div className="mt-3">
                    <label className="block text-sm text-white/80 mb-2">
                      Add your discount (optional)
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={marketPriceDiscountPercent}
                        onChange={(e) => {
                          const value = e.target.value
                          // Валидация: только положительные числа от 0.1
                          if (value === '' || (parseFloat(value) >= 0 && parseFloat(value) <= 100)) {
                            setMarketPriceDiscountPercent(value)
                            // Пересчитываем суммы при изменении дисконта
                            if (paymentAmount && selectedToken) {
                              calculateAmounts(paymentAmount, selectedToken)
                            }
                          }
                        }}
                        step="0.1"
                        min="0"
                        max="100"
                        className="text-lg font-bold flex-1"
                        placeholder="0"
                      />
                      <span className="text-white/80 font-medium">%</span>
                    </div>
                    <p className="text-xs text-white/60 mt-1">
                      Discount from market price (0% = market price, 2% = 2% below market)
                    </p>
                    {marketPriceDiscountPercent && parseFloat(marketPriceDiscountPercent) > 0 && (
                      <p className="text-xs text-cyan-400 mt-1">
                        ✓ Final price: ${formatCurrency(
                          (exchangeDirection === 'buy' ? buyPrice : sellPrice) * 
                          (1 - parseFloat(marketPriceDiscountPercent) / 100), 
                          4
                        )} ({parseFloat(marketPriceDiscountPercent)}% discount)
                      </p>
                    )}
                  </div>
                  
                  <p className="text-xs text-cyan-400 mt-3">
                    ✓ Order will be created at market price {marketPriceDiscountPercent && parseFloat(marketPriceDiscountPercent) > 0 ? `with ${parseFloat(marketPriceDiscountPercent)}% discount` : ''} (price will be determined at the moment of order acceptance by taker)
                  </p>
                </motion.div>
              )}

          {/* Token Selection */}
              <motion.div
                className="relative"
                style={{ zIndex: 1000 }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.2, duration: 0.6 }}
              >
                 <label htmlFor="token-selector" className="flex items-center gap-2 text-lg font-bold text-white mb-6">
                   <Zap className="w-4 h-4 text-violet-400" />
              {exchangeDirection === 'buy' ? 'Select Payment Token' : 'Select Receivable Token'}
            </label>
            <TokenSelector
              id="token-selector"
              selectedToken={selectedToken}
              onTokenSelect={handleTokenChange}
               className="mb-6"
              exchangeDirection={exchangeDirection}
            />
              </motion.div>

          {/* You Pay Section */}
              <motion.div
                className="relative"
                style={{ zIndex: 10 }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.4, duration: 0.6 }}
              >
                 <label className="block text-lg font-bold text-white mb-6" htmlFor="payment-amount">
              {exchangeDirection === 'buy' ? 'You Pay' : 'You Sell'}
            </label>
            <div className="relative">
              <Input
                id="payment-amount"
                type="number"
                    label={selectedToken ? (exchangeDirection === 'buy' ? `Enter ${selectedToken.symbol} amount` : "Enter CC amount") : "Select token first"}
                value={paymentAmount}
                onChange={handleAmountChange}
                    placeholder={selectedToken ? (exchangeDirection === 'buy' ? `Min: ${minUsdtAmount || selectedToken.minAmount}` : "Enter CC amount") : ""}
                    className="text-xl font-bold pr-32"
                min={minUsdtAmount || selectedToken?.minAmount}
                step={selectedToken?.decimals === 18 ? "0.000001" : "0.01"}
                disabled={!selectedToken}
                    floating={false}
                aria-describedby={selectedToken ? "payment-limits" : undefined}
              />
              {selectedToken && (
                    <motion.div 
                      className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.2 }}
                    >
                      <div 
                        className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-bold shadow-lg backdrop-blur-xl"
                    style={{ 
                          backgroundColor: selectedToken.color + '20', 
                      color: selectedToken.color,
                          border: `2px solid ${selectedToken.color}40`,
                          boxShadow: `0 0 20px ${selectedToken.color}30`
                    }}
                  >
                    {selectedToken.icon}
                  </div>
                      <span className="font-black text-white text-lg">{exchangeDirection === 'buy' ? selectedToken.symbol : 'CC'}</span>
                    </motion.div>
              )}
            </div>
            {selectedToken && (
                  <div className="text-sm text-white/60 mt-4 flex items-center gap-6">
                    {exchangeDirection === 'buy' ? (
                      <>
                        <span>Min: {minUsdtAmount || selectedToken.minAmount}</span>
                        <span className="px-3 py-1.5 bg-white/10 rounded-xl font-medium text-xs">
                          {selectedToken.networkName}
                        </span>
                      </>
                    ) : (
                      <>
                        <span>Min: {formatNumber(configMinCantonAmount || 5)} CC</span>
                        <span className="px-3 py-1.5 bg-white/10 rounded-xl font-medium text-xs">
                          CC Network
                        </span>
                      </>
                    )}
              </div>
            )}
              </motion.div>

          {/* You Get Section */}
              <motion.div
                className="relative"
                style={{ zIndex: 10 }}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.8, duration: 0.6 }}
              >
                 <label htmlFor="canton-amount" className="block text-lg font-bold text-white mb-6">
              {exchangeDirection === 'buy' ? 'You Get' : 'You Receive'}
            </label>
            <div className="relative">
              <Input
                id="canton-amount"
                type="text"
                    label={exchangeDirection === 'buy' ? 'CC Amount' : 'USDT Amount'}
                value={isCalculating ? 'Calculating...' : cantonAmount || (selectedToken ? (exchangeDirection === 'buy' ? `Enter ${selectedToken.symbol} amount above` : 'Enter CC amount above') : 'Select token first')}
                readOnly
                className={cn(
                       "text-lg font-bold pr-32 cursor-not-allowed",
                  isCalculating && "animate-pulse"
                )}
                    floating={false}
                  />
                  <motion.div 
                    className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3"
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                     <Sparkles className="w-5 h-5 text-cyan-400" />
                     <span className="font-black text-cyan-300 text-base">{exchangeDirection === 'buy' ? 'CC' : selectedToken?.symbol || 'USDT'}</span>
                  </motion.div>
              </div>
                
                <AnimatePresence>
            {isCalculating && (
                    <motion.div 
                      className="flex items-center gap-3 mt-4 text-blue-300"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      >
                        <Loader2 className="w-4 h-4" />
                      </motion.div>
                      <span className="font-medium">Calculating ultra-fast exchange...</span>
                    </motion.div>
                  )}
                </AnimatePresence>
                
            {selectedToken && paymentAmount && (
                  <motion.div 
                    className="text-white/60 mt-3 font-medium"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    {exchangeDirection === 'buy' ? (
                      <span>≈ ${formatCurrency(parseFloat(paymentAmount) * selectedToken.priceUSD, 2)} USD</span>
                    ) : (
                      <span>≈ ${formatCurrency(parseFloat(paymentAmount) * sellPrice, 2)} USD</span>
                    )}
                  </motion.div>
                )}
              </motion.div>

              {/* Private Deal Checkbox */}
              <motion.div 
                className="flex items-center gap-3 mt-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.9, duration: 0.6 }}
              >
                <input
                  type="checkbox"
                  id="privateDeal"
                  checked={isPrivateDeal}
                  onChange={(e) => setIsPrivateDeal(e.target.checked)}
                  className="w-5 h-5 rounded border-2 border-white/30 bg-white/10 checked:bg-violet-500 checked:border-violet-500"
                />
                <label htmlFor="privateDeal" className="text-white font-medium cursor-pointer flex items-center gap-2">
                  🔒 Private deal (available only by link)
                </label>
              </motion.div>
              {isPrivateDeal && (
                <p className="text-xs text-white/60 mt-2 ml-8">
                  This order will not be published to the public order book.
                  You can share the link directly with your counterparty.
                </p>
              )}

              {/* Ultra Proceed Button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 2, duration: 0.6 }}
                className="pt-4"
              >
                <motion.div
                  className="relative"
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <Button
                    onClick={handleProceed}
                    disabled={!canProceed}
                    className={`w-full text-xl py-8 font-black transition-all duration-500 ${
                      exchangeDirection === 'buy' 
                        ? 'bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-500 hover:from-blue-500 hover:via-cyan-500 hover:to-blue-400 shadow-[0_8px_32px_rgba(30,64,175,0.5)]' 
                        : 'bg-gradient-to-r from-red-600 via-orange-600 to-red-500 hover:from-red-500 hover:via-orange-500 hover:to-red-400 shadow-[0_8px_32px_rgba(239,68,68,0.5)]'
                    }`}
                    size="lg"
                    variant="default"
                  >
                    <motion.span 
                      className="flex items-center gap-3"
                      whileHover={{ x: 10 }}
                      transition={{ type: "spring", stiffness: 400 }}
                    >
                      {exchangeDirection === 'buy' ? 'Buy CC' : 'Sell CC'}
                      <ArrowRight className="w-6 h-6" />
                    </motion.span>
                  </Button>
                  
                  {/* Ultra modern glow effect for button */}
                  <motion.div
                    className="absolute inset-0 rounded-2xl blur-xl -z-10"
                    animate={{
                      background: exchangeDirection === 'buy'
                        ? 'radial-gradient(circle, rgba(30, 64, 175, 0.4), rgba(6, 182, 212, 0.3), transparent)'
                        : 'radial-gradient(circle, rgba(239, 68, 68, 0.4), rgba(249, 115, 22, 0.3), transparent)',
                      opacity: [0.3, 0.6, 0.3],
                      scale: [1, 1.1, 1]
                    }}
                    transition={{ 
                      duration: 2, 
                      repeat: Infinity, 
                      ease: "easeInOut",
                      background: { duration: 0.7 }
                    }}
                  />
                </motion.div>
              </motion.div>
            </div>
      </motion.div>

        {/* Floating Security Features */}
        <motion.div 
          className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 px-4"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.2, duration: 0.8 }}
        >
          {[
            { icon: Zap, title: "Instant", desc: "Ultra-fast processing" },
            { icon: Shield, title: "Secure", desc: "Military-grade encryption" },
            { icon: Clock, title: "Manual Processing", desc: "Human verification for security" }
          ].map((feature, i) => (
            <motion.div
              key={feature.title}
              className="relative group text-center p-8 rounded-3xl backdrop-blur-xl"
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
              whileHover={{ 
                scale: 1.05,
                background: 'rgba(255, 255, 255, 0.05)',
              }}
              transition={{ delay: i * 0.1 }}
            >
      <motion.div 
                className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center"
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.6 }}
              >
                <feature.icon className="w-8 h-8 text-white" />
              </motion.div>
              <h3 className="font-bold text-white text-xl mb-3">{feature.title}</h3>
              <p className="text-white/60 text-base leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </motion.div>
    </div>
  )
}