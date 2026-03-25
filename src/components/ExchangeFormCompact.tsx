'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, ArrowLeft, RefreshCw, Sparkles, Zap, PartyPopper, ShoppingCart, DollarSign, TrendingDown, Edit } from 'lucide-react'
import CantonIcon from './CantonIcon'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import TokenSelector from './TokenSelector'
import { TokenConfig, SUPPORTED_TOKENS } from '@/config/otc'
import { useCantonPrices, useLimits } from './ConfigProvider'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import { useAnimationConfig } from '@/hooks/useIsMobile'

interface ExchangeFormCompactProps {
  onProceed: (data: { 
    paymentToken: TokenConfig;
    paymentAmount: number;
    paymentAmountUSD: number;
    cantonAmount: number;
    usdtAmount: number;
    exchangeDirection?: 'buy' | 'sell';
    manualPrice?: number;
    serviceCommission?: number;
    isPrivateDeal?: boolean;
    isMarketPrice?: boolean; // REQ-002: Make a deal at market price
    marketPriceDiscountPercent?: number; // Процент дисконта от рыночной цены
  }) => void;
}

export default function ExchangeFormCompact({ onProceed }: ExchangeFormCompactProps) {
  // Get dynamic prices from ConfigProvider
  const { buyPrice, sellPrice } = useCantonPrices()
  const { minCantonAmount: configMinCantonAmount, minUsdtAmount, maxUsdtAmount } = useLimits()
  
  // Mobile optimization
  const { 
    isMobile, 
    shouldReduceAnimations,
    animationDuration,
    showDecorativeEffects
  } = useAnimationConfig()
  
  const [selectedToken, setSelectedToken] = useState<TokenConfig | null>(null) // No default selection - user must choose
  const [paymentAmount, setPaymentAmount] = useState('')
  const [cantonAmount, setCantonAmount] = useState('')
  const [resultAmount, setResultAmount] = useState('') // Separate state for result
  // Removed isCalculating state as calculation is instant
  const [exchangeDirection, setExchangeDirection] = useState<'buy' | 'sell'>('buy') // 'buy' = USDT → Canton, 'sell' = Canton → USDT
  const [serviceCommission, setServiceCommission] = useState(1) // Default 1%
  const [customPrice, setCustomPrice] = useState('') // Цена всегда вводится вручную
  const [priceWarning, setPriceWarning] = useState<string | null>(null) // Предупреждение о цене
  const [isPrivateDeal, setIsPrivateDeal] = useState(false) // Private deal чекбокс
  const [isMarketPrice, setIsMarketPrice] = useState(false) // REQ-002: Make a deal at market price
  const [marketPriceDiscountPercent, setMarketPriceDiscountPercent] = useState('') // Процент дисконта от рыночной цены (от 0.1%)
  
  // Fix hydration mismatch - only show price after client-side load
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Clear fields when direction changes
  useEffect(() => {
    setPaymentAmount('')
    setCantonAmount('')
    setResultAmount('')
  }, [exchangeDirection])

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
      })
  }, [])

  const calculateAmounts = useCallback((amount: string, token: TokenConfig | null) => {
    console.log('calculateAmounts called:', { amount, token: token?.symbol, exchangeDirection })
    
    if (!amount || !token || parseFloat(amount) <= 0) {
      setCantonAmount('')
      setResultAmount('')
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
    

    // Calculation is instant, no loading state needed
    
    // ✅ ИСПРАВЛЕНО: Используем динамическую цену из ConfigProvider или ручную
    const usdValue = amountValue * token.priceUSD
    
    // ✅ УПРОЩЕННАЯ ЛОГИКА: Без объемных скидок
    // Сначала рассчитываем базовое количество без комиссии
    const baseAmount = usdValue / currentPrice
    
    // Вычитаем комиссию из получаемого количества (комиссия = 1% от получаемого)
    const canton = baseAmount * (1 - serviceCommission / 100)
    
    setCantonAmount(formatNumber(canton))
    setResultAmount(formatNumber(canton))
    } else {
      // Selling Canton for USDT
      const minCantonAmount = configMinCantonAmount || 5
      
      if (amountValue < minCantonAmount) {
        toast.error(`Minimum amount: ${formatNumber(minCantonAmount)} Canton`)
        return
      }
      

      // Calculation is instant, no loading state needed
      
      // ✅ УПРОЩЕННАЯ ЛОГИКА: Без объемных скидок
      // При продаже: сначала рассчитываем базовую стоимость
      const baseUsdValue = amountValue * currentPrice
      
      // ✅ НОВАЯ ЛОГИКА: Комиссия вычитается из получаемой суммы (1% от суммы)
      const usdValue = baseUsdValue * (1 - serviceCommission / 100)
      
      const usdtAmount = usdValue / token.priceUSD
      // В режиме продажи - продаем Canton и получаем USDT
      setCantonAmount(amount) // Сохраняем исходное количество Canton
      setResultAmount(formatNumber(usdtAmount)) // Результат в USDT
    }
    
    // No need to reset loading state
  }, [exchangeDirection, buyPrice, sellPrice, configMinCantonAmount, serviceCommission, customPrice, isMarketPrice, marketPriceDiscountPercent])

  // REQ-002: Auto-set market price when checkbox is activated
  useEffect(() => {
    if (isMarketPrice && mounted) {
      const marketPrice = exchangeDirection === 'buy' ? buyPrice : sellPrice
      setCustomPrice(marketPrice.toString())
      setPriceWarning(null)
      // Пересчитываем суммы при изменении market price или дисконта
      if (paymentAmount && selectedToken) {
        calculateAmounts(paymentAmount, selectedToken)
      }
    }
  }, [isMarketPrice, exchangeDirection, buyPrice, sellPrice, mounted, marketPriceDiscountPercent, paymentAmount, selectedToken, calculateAmounts])

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setPaymentAmount(value)
    calculateAmounts(value, selectedToken)
  }

  const handleTokenChange = (token: TokenConfig) => {
    setSelectedToken(token)
    setPaymentAmount('')
    setCantonAmount('')
    setResultAmount('')
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
        setResultAmount('')
      }
    } else {
      setPriceWarning(null)
      // Если цена пустая, используем рыночную для расчетов
      if (selectedToken && paymentAmount) {
        calculateAmounts(paymentAmount, selectedToken)
      }
    }
  }

  const handleProceed = () => {
    if (!selectedToken || !paymentAmount || (exchangeDirection === 'buy' ? !cantonAmount : !resultAmount)) {
      toast.error('Please select a token and enter an amount')
      return
    }

    // REQ-002: Проверка обязательной цены (не требуется если market price)
    if (!isMarketPrice && (!customPrice || parseFloat(customPrice) <= 0)) {
      toast.error('Please enter your price or select market price')
      return
    }

    const amountValue = parseFloat(paymentAmount)
    const resultValue = parseFloat((exchangeDirection === 'buy' ? cantonAmount : resultAmount).replace(/,/g, ''))

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
        const marketPrice = buyPrice
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
  const canProceed = selectedToken && paymentAmount && (exchangeDirection === 'buy' ? cantonAmount : resultAmount) && (isMarketPrice || (customPrice && parseFloat(customPrice) > 0))

  // Debug logging
  console.log('ExchangeFormCompact render:', { 
    exchangeDirection, 
    paymentAmount, 
    cantonAmount,
    resultAmount, 
    selectedToken: selectedToken?.symbol 
  })

  return (
    <div className="space-y-4 sm:space-y-6 md:space-y-8">
      {/* REQ-001: Form Header and Buy/Sell Buttons - Mobile Optimized */}
      <motion.div
        className="text-center space-y-4"
        initial={{ opacity: 0, y: shouldReduceAnimations ? -10 : -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: animationDuration }}
      >
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white">
          Do you want to BUY or SELL Canton?
        </h2>
        <p className="text-base sm:text-lg md:text-xl text-white/80 font-medium">
          Make your choice!
        </p>
        
        {/* Buy/Sell Buttons */}
        <motion.div 
          className="flex gap-3 sm:gap-4 mt-4 sm:mt-6"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ 
            delay: shouldReduceAnimations ? 0.1 : 0.2, 
            type: "spring", 
            stiffness: shouldReduceAnimations ? 300 : 200 
          }}
        >
          <motion.button
            onClick={() => {
              if (exchangeDirection !== 'buy') {
                setExchangeDirection('buy')
                setPaymentAmount('')
                setCantonAmount('')
                setResultAmount('')
              }
            }}
            className={cn(
              "flex-1 py-3 sm:py-4 px-4 sm:px-6 rounded-xl font-bold text-base sm:text-lg transition-all touch-manipulation",
              exchangeDirection === 'buy' 
                ? "bg-gradient-to-r from-green-600 to-emerald-500 text-white shadow-lg scale-105"
                : "bg-white/10 text-white/60 hover:bg-white/20"
            )}
            whileHover={exchangeDirection === 'buy' || shouldReduceAnimations ? {} : { scale: 1.02 }}
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
                setResultAmount('')
              }
            }}
            className={cn(
              "flex-1 py-3 sm:py-4 px-4 sm:px-6 rounded-xl font-bold text-base sm:text-lg transition-all touch-manipulation",
              exchangeDirection === 'sell'
                ? "bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-lg scale-105"
                : "bg-white/10 text-white/60 hover:bg-white/20"
            )}
            whileHover={exchangeDirection === 'sell' || shouldReduceAnimations ? {} : { scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="flex items-center justify-center gap-2">
              <TrendingDown className="w-5 h-5" />
              SELL Canton
            </span>
          </motion.button>
        </motion.div>
      </motion.div>

      {/* Dynamic Exchange Rate Display - Mobile Optimized */}
      <motion.div 
        className="relative text-center p-4 sm:p-5 md:p-6 rounded-xl overflow-hidden group/rate glass-ultra"
        initial={{ opacity: 0, scale: shouldReduceAnimations ? 0.95 : 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: shouldReduceAnimations ? 0.1 : 0.2, duration: animationDuration, ease: "easeOut" }}
        style={{
          background: exchangeDirection === 'buy' 
            ? 'linear-gradient(135deg, rgba(30, 64, 175, 0.08), rgba(8, 145, 178, 0.05))'
            : 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(220, 38, 38, 0.08))',
          border: exchangeDirection === 'buy'
            ? '1px solid rgba(30, 64, 175, 0.2)'
            : '1px solid rgba(239, 68, 68, 0.3)',
          boxShadow: exchangeDirection === 'buy'
            ? '0 8px 32px rgba(30, 64, 175, 0.15), 0 0 0 1px rgba(8, 145, 178, 0.1)'
            : '0 8px 32px rgba(239, 68, 68, 0.25), 0 0 0 1px rgba(220, 38, 38, 0.2), 0 0 20px rgba(239, 68, 68, 0.1)',
        }}
      >
        {/* Dynamic Shimmer effect - только на десктопе */}
        {showDecorativeEffects && (
          <motion.div
            className="absolute inset-0"
            animate={{ 
              x: ['-200%', '200%'],
              background: exchangeDirection === 'buy'
                ? 'linear-gradient(to right, transparent, rgba(255, 255, 255, 0.08), transparent)'
                : 'linear-gradient(to right, transparent, rgba(239, 68, 68, 0.15), transparent)'
            }}
            transition={{ 
              x: { duration: 3, repeat: Infinity, ease: 'linear' },
              background: { duration: 0.7 }
            }}
          />
        )}
        
        <div className="relative z-10">
          <div className="flex items-center justify-center gap-3 mb-6">
            <motion.div 
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <svg className="w-6 h-6 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
            </motion.div>
            <span className="text-orange-300 font-bold text-lg">
              We are currently operating manually!
            </span>
          </div>
          <motion.div 
            className={`text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black bg-clip-text text-transparent ${
              exchangeDirection === 'buy' 
                ? 'gradient-text-aurora' 
                : 'bg-gradient-to-r from-red-400 via-orange-400 to-red-500'
            }`}
            animate={shouldReduceAnimations ? {} : { backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
            transition={{ duration: 4, repeat: Infinity }}
          >
            1 CC = ${mounted ? formatCurrency(customPrice ? parseFloat(customPrice) : (exchangeDirection === 'buy' ? buyPrice : sellPrice), 4) : '...'}
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

      {/* REQ-002: Make a deal at market price checkbox - Mobile Optimized */}
      <motion.div
        className="glass-ultra rounded-xl p-4 sm:p-5 md:p-6 relative z-10"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: shouldReduceAnimations ? 0.2 : 0.25, duration: animationDuration }}
      >
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="marketPriceCheckboxCompact"
            checked={isMarketPrice}
            onChange={(e) => {
              setIsMarketPrice(e.target.checked)
              if (!e.target.checked) {
                setCustomPrice('')
              }
            }}
            className="w-5 h-5 rounded border-2 border-white/30 bg-white/10 checked:bg-violet-500 checked:border-violet-500 cursor-pointer"
          />
          <label htmlFor="marketPriceCheckboxCompact" className="text-white font-medium cursor-pointer text-sm sm:text-base">
            Make a deal at market price
          </label>
        </div>
      </motion.div>

      {/* Your Price - ОБЯЗАТЕЛЬНОЕ ПОЛЕ (скрыто если market price) - Mobile Optimized */}
      {!isMarketPrice && (
        <motion.div
          className="glass-ultra rounded-xl p-4 sm:p-5 md:p-6 relative z-10"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: shouldReduceAnimations ? 0.2 : 0.3, duration: animationDuration }}
        >
          <label className="block text-sm text-white/80 mb-2">
            Your Price (per 1 CC) <span className="text-red-400">*</span>
          </label>
          <Input
            type="number"
            value={customPrice}
            onChange={handleCustomPriceChange}
            step="0.0001"
            className="text-base sm:text-lg font-bold"
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
          className="glass-ultra rounded-xl p-4 sm:p-5 md:p-6 relative z-10"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: shouldReduceAnimations ? 0.2 : 0.3, duration: animationDuration }}
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

      {/* Token Selection - Mobile Optimized */}
      <motion.div
        className="glass-ultra rounded-xl p-4 sm:p-5 md:p-6 relative z-10"
        initial={{ opacity: 0, x: shouldReduceAnimations ? -10 : -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: shouldReduceAnimations ? 0.2 : 0.4, duration: animationDuration, ease: "easeOut" }}
      >
        <label className="flex items-center gap-2 md:gap-3 text-base sm:text-lg font-bold text-white mb-3 md:mb-4" htmlFor="token-selector">
          <div className="w-7 h-7 md:w-8 md:h-8 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 flex items-center justify-center glow-electric" aria-hidden="true">
            <Zap className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
          </div>
          {isMobile 
            ? (exchangeDirection === 'buy' ? 'Payment Token' : 'Receive Token')
            : (exchangeDirection === 'buy' ? 'Select Payment Token' : 'Select Receivable Token')
          }
        </label>
        <TokenSelector
          selectedToken={selectedToken}
          onTokenSelect={handleTokenChange}
          className="mb-4"
          exchangeDirection={exchangeDirection}
        />
      </motion.div>

      {/* You Pay Section - Mobile Optimized */}
      <motion.div
        className="glass-ultra rounded-xl p-4 sm:p-5 md:p-6 relative z-10"
        initial={{ opacity: 0, x: shouldReduceAnimations ? -10 : -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: shouldReduceAnimations ? 0.3 : 0.6, duration: animationDuration }}
      >
        <label className="flex items-center gap-2 md:gap-3 text-base sm:text-lg font-bold text-white mb-3 md:mb-4" htmlFor="payment-amount">
          <div className="w-7 h-7 md:w-8 md:h-8 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center glow-cyan" aria-hidden="true">
            <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
          </div>
          {exchangeDirection === 'buy' ? '💳 You Pay' : '💰 You Sell'}
        </label>
        <div className="relative">
          <Input
            id="payment-amount"
            type="number"
            label={selectedToken ? (exchangeDirection === 'buy' ? `Enter ${selectedToken.symbol} amount` : "Enter Canton amount") : "Select payment token first"}
            value={paymentAmount}
            onChange={handleAmountChange}
            placeholder={isMobile 
              ? (selectedToken ? `Min: ${minUsdtAmount || selectedToken.minAmount}` : "Select token")
              : (selectedToken ? (exchangeDirection === 'buy' ? `Enter amount (min: ${minUsdtAmount || selectedToken.minAmount})` : "Enter Canton amount") : "Choose a token to continue")
            }
            className="text-base sm:text-lg md:text-xl font-bold pr-20 sm:pr-24 md:pr-32"
            min={minUsdtAmount || selectedToken?.minAmount}
            step={selectedToken?.decimals === 18 ? "0.000001" : "0.01"}
            disabled={!selectedToken}
            floating={false}
            aria-describedby={selectedToken ? "payment-limits" : undefined}
          />
          {selectedToken && (
            <motion.div 
              className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 sm:gap-3"
              initial={{ opacity: 0, scale: shouldReduceAnimations ? 0.9 : 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: shouldReduceAnimations ? 0.1 : 0.2 }}
            >
              <div 
                className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center text-base sm:text-lg font-bold shadow-lg backdrop-blur-xl"
                style={{ 
                  backgroundColor: selectedToken.color + '20', 
                  color: selectedToken.color,
                  border: `2px solid ${selectedToken.color}40`,
                  boxShadow: `0 0 20px ${selectedToken.color}30`
                }}
              >
                {selectedToken.icon}
              </div>
              <span className="font-black text-input-suffix text-sm sm:text-base md:text-lg">{exchangeDirection === 'buy' ? selectedToken.symbol : 'Canton'}</span>
            </motion.div>
          )}
        </div>
        {selectedToken && (
          <div id="payment-limits" className="text-sm text-white/80 mt-4 flex flex-wrap items-center gap-4" role="region" aria-label="Payment limits">
            {exchangeDirection === 'buy' ? (
              <>
            <span className="px-3 py-1.5 bg-white/15 rounded-xl font-medium">Min: {minUsdtAmount || selectedToken.minAmount}</span>
            <span className="px-3 py-1.5 bg-gradient-to-r from-blue-500/25 to-cyan-500/25 rounded-xl font-medium text-xs border border-blue-500/40">
              {selectedToken.networkName}
            </span>
              </>
            ) : (
              <>
                <span className="px-3 py-1.5 bg-white/15 rounded-xl font-medium">Min: {formatNumber(configMinCantonAmount || 5)} Canton</span>
                <span className="px-3 py-1.5 bg-gradient-to-r from-cyan-500/25 to-blue-500/25 rounded-xl font-medium text-xs border border-cyan-500/40">
                  Canton Network
                </span>
              </>
            )}
          </div>
        )}
      </motion.div>

      {/* You Get Section */}
      <motion.div
        className="glass-ultra rounded-xl p-6 relative z-10"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.0, duration: 0.6 }}
      >
        <label className="flex items-center gap-3 text-lg font-bold text-white mb-4" htmlFor="canton-amount">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center glow-cyan" aria-hidden="true">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          {exchangeDirection === 'buy' ? '✨ You Get' : '💵 You Receive'}
          <span className="text-sm font-normal text-white/80 ml-2">
            {exchangeDirection === 'buy' ? 'Canton Coin Amount' : 'USDT Amount'}
          </span>
        </label>
        <div className="relative">
          <Input
            id="canton-amount"
            type="text"
            label={exchangeDirection === 'buy' ? 'CC Amount' : 'USDT Amount'}
            value={(exchangeDirection === 'buy' ? cantonAmount : resultAmount) || (selectedToken ? (exchangeDirection === 'buy' ? `Enter ${selectedToken.symbol} amount above` : 'Enter CC amount above') : 'Select payment token first')}
            readOnly
            className={cn(
              "text-xl font-bold pr-40 cursor-not-allowed",
              ""
            )}
            floating={false}
            aria-label={exchangeDirection === 'buy' ? "CC amount to receive" : "USDT amount to receive"}
          />
          <motion.div 
            className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {exchangeDirection === 'buy' ? (
              <CantonIcon className="w-10 h-10" />
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg glow-cyan">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
            )}
            <span className="font-black text-input-on-dark-suffix text-lg glow-text-electric">{exchangeDirection === 'buy' ? 'CC' : selectedToken?.symbol || 'USDT'}</span>
          </motion.div>
        </div>
        
        {/* Removed calculating indicator as calculation is instant */}
        
        {selectedToken && paymentAmount && (
          <motion.div 
            className="text-white/80 mt-3 font-medium px-3 py-2 bg-white/10 rounded-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {exchangeDirection === 'buy' ? (
              <>≈ ${formatCurrency(parseFloat(paymentAmount) * selectedToken.priceUSD, 2)} USD</>
            ) : (
              <>≈ ${formatCurrency(parseFloat(paymentAmount) * sellPrice, 2)} USD</>
            )}
          </motion.div>
        )}
      </motion.div>

      {/* Private Deal Checkbox - Mobile Optimized */}
      <motion.div 
        className="glass-ultra rounded-xl p-4 sm:p-5 md:p-6 relative z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: shouldReduceAnimations ? 0.4 : 0.9, duration: animationDuration }}
      >
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="privateDealCompact"
            checked={isPrivateDeal}
            onChange={(e) => setIsPrivateDeal(e.target.checked)}
            className="w-5 h-5 rounded border-2 border-white/30 bg-white/10 checked:bg-violet-500 checked:border-violet-500 cursor-pointer"
          />
          <label htmlFor="privateDealCompact" className="text-white font-medium cursor-pointer text-sm sm:text-base flex items-center gap-2">
            🔒 Private deal (available only by link)
          </label>
        </div>
        {isPrivateDeal && (
          <p className="text-xs text-white/60 mt-2 ml-8">
            This order will not be published to the public order book.
            You can share the link directly with your counterparty.
          </p>
        )}
      </motion.div>

      {/* Proceed Button - Mobile Optimized */}
      <motion.div
        initial={{ opacity: 0, y: shouldReduceAnimations ? 10 : 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: shouldReduceAnimations ? 0.5 : 1.2, duration: animationDuration }}
        className="pt-2 md:pt-4"
      >
        <motion.div
          className="relative"
          whileHover={shouldReduceAnimations ? {} : { scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <Button
            onClick={handleProceed}
            disabled={!canProceed}
            className={cn(
              "w-full text-base sm:text-lg py-4 sm:py-5 md:py-6 font-black rounded-xl transition-all duration-500 min-h-[56px] md:min-h-[64px] touch-manipulation",
              canProceed 
                ? exchangeDirection === 'buy'
                  ? "bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-500 hover:from-blue-500 hover:via-cyan-500 hover:to-blue-400 shadow-[0_8px_32px_rgba(30,64,175,0.5)]" 
                  : "bg-gradient-to-r from-red-600 via-orange-600 to-red-500 hover:from-red-500 hover:via-orange-500 hover:to-red-400 shadow-[0_8px_32px_rgba(239,68,68,0.5)]"
                : "bg-gray-600 cursor-not-allowed opacity-50"
            )}
            size="lg"
            variant="default"
          >
            <motion.span 
              className="flex items-center justify-center gap-2 md:gap-3"
              whileHover={canProceed && !shouldReduceAnimations ? { x: 5 } : {}}
              transition={{ type: "spring", stiffness: 400 }}
            >
              {canProceed ? (
                <>
                  {isMobile
                    ? (exchangeDirection === 'buy' ? '🛒 Buy Canton' : '💸 Sell Canton')
                    : (exchangeDirection === 'buy' ? '🛒 Buy Canton Coin' : '💸 Sell Canton Coin')
                  }
                  <ArrowRight className="w-5 h-5 md:w-6 md:h-6" />
                </>
              ) : (
                <>
                  {isMobile ? 'Select & Enter' : 'Select token and enter amount'}
                  <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
                </>
              )}
            </motion.span>
          </Button>
          
          {/* Ultra modern glow effect for button - только на десктопе */}
          {canProceed && showDecorativeEffects && (
            <motion.div
              className="absolute inset-0 rounded-xl blur-xl -z-10"
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
          )}
        </motion.div>
      </motion.div>
    </div>
  )
}
