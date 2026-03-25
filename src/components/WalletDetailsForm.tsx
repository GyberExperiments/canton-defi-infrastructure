'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Wallet, Shield, Mail, Phone, MessageSquare, AlertCircle, CheckCircle, Sparkles, TrendingUp } from 'lucide-react'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { validateEmail, validateCantonAddress, validateTronAddress, validateEthereumAddress } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import { TokenConfig } from '@/config/otc'
import { useAnimationConfig } from '@/hooks/useIsMobile'

interface WalletDetailsData {
  cantonAddress: string;
  receivingAddress?: string; // ✅ При sell: адрес для получения USDT
  refundAddress?: string;
  email: string;
  whatsapp?: string;
  telegram?: string;
}

interface WalletDetailsFormProps {
  onBack: () => void;
  onNext: (data: WalletDetailsData) => void;
  exchangeData: {
    paymentToken: TokenConfig;
    paymentAmount: number;
    paymentAmountUSD: number;
    cantonAmount: number;
    usdtAmount: number; // Legacy
    exchangeDirection?: 'buy' | 'sell'; // ✅ Направление обмена
    isPrivateDeal?: boolean; // ✅ Приватная сделка
    isMarketPrice?: boolean; // REQ-002: Сделка по рыночной цене
    serviceCommission?: number; // REQ-006: Комиссия сервиса в %
  };
}

export default function WalletDetailsForm({ onBack, onNext, exchangeData }: WalletDetailsFormProps) {
  // Mobile optimization
  const { 
    isMobile, 
    shouldReduceAnimations,
    animationDuration,
    showDecorativeEffects
  } = useAnimationConfig()

  const [formData, setFormData] = useState<WalletDetailsData>({
    cantonAddress: '',
    receivingAddress: '',
    refundAddress: '',
    email: '',
    whatsapp: '',
    telegram: ''
  })
  
  const isBuying = !exchangeData.exchangeDirection || exchangeData.exchangeDirection === 'buy'

  const [errors, setErrors] = useState<Partial<WalletDetailsData>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [validatedFields, setValidatedFields] = useState<Set<string>>(new Set())

  const validateForm = (): boolean => {
    const newErrors: Partial<WalletDetailsData> = {}

    if (isBuying) {
      // При покупке: receiving address = Canton address
      if (!formData.cantonAddress) {
        newErrors.cantonAddress = 'Canton Coin receiving address is required'
      } else if (!validateCantonAddress(formData.cantonAddress)) {
        newErrors.cantonAddress = 'Invalid Canton address format'
      }
    } else {
      // При продаже: cantonAddress = откуда отправляем Canton, receivingAddress = куда получаем USDT
      if (!formData.cantonAddress) {
        newErrors.cantonAddress = 'Canton Coin sending address is required'
      } else if (!validateCantonAddress(formData.cantonAddress)) {
        newErrors.cantonAddress = 'Invalid Canton address format'
      }
      
      // Валидация receiving address для USDT
      if (!formData.receivingAddress) {
        newErrors.receivingAddress = `${exchangeData.paymentToken.symbol} receiving address is required`
      } else {
        const network = exchangeData.paymentToken.network
        let isValidReceiving = false
        if (network === 'TRON') {
          isValidReceiving = validateTronAddress(formData.receivingAddress)
        } else if (network === 'ETHEREUM' || network === 'BSC' || network === 'OPTIMISM') {
          isValidReceiving = validateEthereumAddress(formData.receivingAddress)
        } else {
          isValidReceiving = validateEthereumAddress(formData.receivingAddress) || validateTronAddress(formData.receivingAddress)
        }
        
        if (!isValidReceiving) {
          newErrors.receivingAddress = `Invalid ${exchangeData.paymentToken.symbol} address format (${exchangeData.paymentToken.networkName})`
        }
      }
    }

    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email is required'
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Invalid email format'
    }

    // Refund address validation (optional but must be valid if provided)
    // Refund address can be in payment network format or Canton format
    if (formData.refundAddress) {
      const isValidRefund = validateCantonAddress(formData.refundAddress) || 
                           validateTronAddress(formData.refundAddress) ||
                           validateEthereumAddress(formData.refundAddress)
      
      if (!isValidRefund) {
        newErrors.refundAddress = 'Invalid refund address format (Canton, TRON, or Ethereum)'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      toast.error('Please fix the form errors')
      return
    }

    setIsLoading(true)
    
    // Process form immediately to avoid hydration mismatch
    setIsLoading(false)
    onNext(formData)
  }

  const handleInputChange = (field: keyof WalletDetailsData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }

    // Real-time validation for better UX
    if (field === 'email' && value && validateEmail(value)) {
      setValidatedFields(prev => new Set(prev).add(field))
    } else if (field === 'cantonAddress' && value && validateCantonAddress(value)) {
      setValidatedFields(prev => new Set(prev).add(field))
    } else if (field === 'receivingAddress' && value) {
      const network = exchangeData.paymentToken.network
      let isValid = false
      if (network === 'TRON') {
        isValid = validateTronAddress(value)
      } else if (network === 'ETHEREUM' || network === 'BSC' || network === 'OPTIMISM') {
        isValid = validateEthereumAddress(value)
      } else {
        isValid = validateEthereumAddress(value) || validateTronAddress(value)
      }
      if (isValid) {
        setValidatedFields(prev => new Set(prev).add(field))
      } else {
        setValidatedFields(prev => {
          const newSet = new Set(prev)
          newSet.delete(field)
          return newSet
        })
      }
    } else if (field === 'refundAddress' && value && (validateCantonAddress(value) || validateTronAddress(value) || validateEthereumAddress(value))) {
      setValidatedFields(prev => new Set(prev).add(field))
    } else {
      setValidatedFields(prev => {
        const newSet = new Set(prev)
        newSet.delete(field)
        return newSet
      })
    }
  }

  const progress = 40 // Step 2 of 3

  return (
    <>
      {/* Floating mesh background elements - Mobile Optimized */}
      {showDecorativeEffects && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <motion.div
            className="absolute top-20 right-20 rounded-full opacity-20"
            style={{
              width: isMobile ? '250px' : '400px',
              height: isMobile ? '250px' : '400px',
              background: 'radial-gradient(circle, #8B5CF6 0%, transparent 70%)',
              filter: isMobile ? 'blur(40px)' : 'blur(60px)',
            }}
            animate={shouldReduceAnimations ? {} : {
              x: [0, 15, -8, 0],
              y: [0, -20, 15, 0],
              scale: [1, 1.05, 0.95, 1],
            }}
            transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          />
          
          <motion.div
            className="absolute bottom-32 left-20 rounded-full opacity-20"
            style={{
              width: isMobile ? '200px' : '350px',
              height: isMobile ? '200px' : '350px',
              background: 'radial-gradient(circle, #06B6D4 0%, transparent 70%)',
              filter: isMobile ? 'blur(40px)' : 'blur(60px)',
            }}
            animate={shouldReduceAnimations ? {} : {
              x: [0, -15, 10, 0],
              y: [0, 15, -20, 0],
              scale: [1, 0.95, 1.1, 1],
            }}
            transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
          />
        </div>
      )}

      <motion.div 
        className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6"
        initial={{ opacity: 0, x: shouldReduceAnimations ? 15 : 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: animationDuration, ease: [0.6, 0.05, 0.01, 0.9] }}
      >
        {/* Progress indicator */}
        <motion.div 
          className="mb-6 md:mb-8"
          initial={{ opacity: 0, y: shouldReduceAnimations ? -10 : -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: shouldReduceAnimations ? 0.1 : 0.2 }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-white/60 text-sm font-medium">Step 2 of 3</span>
            <span className="text-violet-400 text-sm font-bold">{progress}% Complete</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
            <motion.div
              className="h-full bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 rounded-full relative"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1, ease: 'easeOut', delay: 0.5 }}
            >
              {/* Shimmer effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              />
            </motion.div>
          </div>
        </motion.div>

        {/* Ultra Modern Header - Mobile Optimized */}
        <div className="text-center mb-8 md:mb-12">
          <motion.div 
            className="relative inline-flex items-center gap-3 md:gap-4 mb-6 md:mb-8"
            initial={{ scale: 0, rotate: shouldReduceAnimations ? 0 : -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ 
              delay: shouldReduceAnimations ? 0.15 : 0.3, 
              type: "spring", 
              stiffness: shouldReduceAnimations ? 300 : 200, 
              damping: 20 
            }}
          >
            <div className="relative">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-pink-600 flex items-center justify-center shadow-[0_20px_60px_rgba(139,92,246,0.4)]">
                <Wallet className="w-8 h-8 md:w-10 md:h-10 text-white" />
              </div>
              {/* Pulsing glow ring - только на десктопе */}
              {showDecorativeEffects && (
                <div className="absolute inset-0 rounded-2xl md:rounded-3xl bg-gradient-to-br from-violet-400 via-purple-400 to-pink-400 opacity-50 blur-xl animate-pulse" />
              )}
            </div>
          </motion.div>
          
          <motion.h2 
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black mb-3 md:mb-4 leading-tight px-2"
            initial={{ opacity: 0, y: shouldReduceAnimations ? 10 : 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: shouldReduceAnimations ? 0.2 : 0.4 }}
          >
            <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              {isMobile ? 'Wallet' : 'Wallet Details'}
            </span>
          </motion.h2>
          
          <motion.p 
            className="text-base sm:text-lg md:text-xl text-white/70 font-medium px-4"
            initial={{ opacity: 0, y: shouldReduceAnimations ? 5 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: shouldReduceAnimations ? 0.25 : 0.5 }}
          >
            {isMobile 
              ? 'Set up receiving details'
              : 'Almost there! Let\'s set up your receiving details'
            }
          </motion.p>
        </div>

        {/* Exchange Summary Card - Mobile Optimized */}
        <motion.div 
          className="relative group mb-8 md:mb-12"
          initial={{ opacity: 0, y: shouldReduceAnimations ? 10 : 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: shouldReduceAnimations ? 0.3 : 0.6 }}
        >
          {/* Outer glow */}
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500 rounded-3xl opacity-20 blur-2xl" />
          
          {/* Card */}
          <div className="relative p-5 sm:p-6 md:p-8 rounded-2xl md:rounded-3xl backdrop-blur-2xl overflow-hidden"
               style={{
                 background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(6, 182, 212, 0.1))',
                 border: '1px solid rgba(16, 185, 129, 0.2)',
               }}>
            
            {/* Shimmer effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
              animate={{ x: ['-200%', '200%'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            />
            
            <div className="relative z-10 text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <span className="text-emerald-300 font-bold">Exchange Summary</span>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 text-lg sm:text-xl font-bold text-white">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div 
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center text-base sm:text-lg font-bold shadow-lg backdrop-blur-xl"
                    style={{ 
                      backgroundColor: exchangeData.paymentToken.color + '25', 
                      color: exchangeData.paymentToken.color,
                      border: `2px solid ${exchangeData.paymentToken.color}40`
                    }}
                  >
                    {exchangeData.paymentToken.icon}
                  </div>
                  <div className="text-left">
                    <div className="text-base sm:text-lg font-black">{exchangeData.paymentAmount.toLocaleString()} {exchangeData.paymentToken.symbol}</div>
                    <div className="text-xs text-white/60 font-medium">{exchangeData.paymentToken.networkName}</div>
                  </div>
                </div>
                
                <motion.div
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 flex items-center justify-center"
                  animate={shouldReduceAnimations ? {} : { rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                >
                  <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 text-white rotate-90 sm:rotate-0" />
                </motion.div>
                
                <div className="flex items-center gap-2 sm:gap-3">
                  <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-cyan-400" />
                  <div className="text-left">
                    <div className="text-base sm:text-lg font-black text-cyan-300">{exchangeData.cantonAmount.toLocaleString()} CC</div>
                    <div className="text-xs text-white/60 font-medium">≈ ${exchangeData.paymentAmountUSD.toLocaleString()} USD</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Main Form - Prismatic Glass */}
        <motion.form 
          onSubmit={handleSubmit}
          className="relative group"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.8 }}
        >
          {/* Outer glow */}
          <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-600 rounded-[2rem] opacity-20 group-hover:opacity-30 blur-2xl transition-opacity duration-500" />
          
          {/* Glass form */}
          <div className="relative backdrop-blur-2xl rounded-2xl md:rounded-[2rem] p-6 sm:p-8 md:p-10 overflow-hidden"
               style={{
                 background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
                 border: '1px solid rgba(255, 255, 255, 0.18)',
                 boxShadow: '0 8px 32px rgba(31, 38, 135, 0.37), inset 0 1px 1px rgba(255, 255, 255, 0.15)',
               }}>
            
            {/* Top highlight */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            
            {/* Floating decorative elements - только на десктопе */}
            {showDecorativeEffects && (
              <div className="absolute top-8 right-8 w-24 h-24 bg-gradient-to-br from-violet-500/20 to-cyan-500/20 rounded-full blur-2xl" />
            )}
            
            <div className="relative z-10 space-y-5 sm:space-y-6 md:space-y-8">
              {/* Receiving Address для BUY (Canton) */}
              {isBuying && (
                <motion.div
                  initial={{ opacity: 0, x: shouldReduceAnimations ? -10 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: shouldReduceAnimations ? 0.4 : 1, duration: animationDuration }}
                >
                  <Input
                    id="canton-address"
                    label="Receiving Address (Canton)"
                    icon={<Wallet className="w-5 h-5" />}
                    type="text"
                    value={formData.cantonAddress}
                    onChange={(e) => handleInputChange('cantonAddress', e.target.value)}
                    placeholder="Your CC wallet address"
                    className={`${errors.cantonAddress ? 'border-red-400/50' : ''} ${validatedFields.has('cantonAddress') ? 'border-emerald-400/50' : ''}`}
                    aria-describedby={errors.cantonAddress ? "canton-address-error" : validatedFields.has('cantonAddress') ? "canton-address-success" : undefined}
                  />
                  
                  <AnimatePresence>
                    {errors.cantonAddress ? (
                      <motion.div 
                        id="canton-address-error"
                        className="flex items-center gap-2 mt-3 text-red-400 text-sm font-medium"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                      >
                        <AlertCircle className="w-4 h-4" />
                        {errors.cantonAddress}
                      </motion.div>
                    ) : validatedFields.has('cantonAddress') ? (
                      <motion.div 
                        id="canton-address-success"
                        className="flex items-center gap-2 mt-3 text-emerald-400 text-sm font-medium"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                      >
                        <CheckCircle className="w-4 h-4" />
                        Valid CC address
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* Canton Sending Address для SELL */}
              {!isBuying && (
                <motion.div
                  initial={{ opacity: 0, x: shouldReduceAnimations ? -10 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: shouldReduceAnimations ? 0.4 : 1, duration: animationDuration }}
                >
                  <Input
                    id="canton-address"
                    label="Canton Address (Sending From)"
                    icon={<Wallet className="w-5 h-5" />}
                    type="text"
                    value={formData.cantonAddress}
                    onChange={(e) => handleInputChange('cantonAddress', e.target.value)}
                    placeholder="Your CC wallet address to send from"
                    className={`${errors.cantonAddress ? 'border-red-400/50' : ''} ${validatedFields.has('cantonAddress') ? 'border-emerald-400/50' : ''}`}
                    aria-describedby={errors.cantonAddress ? "canton-address-error" : validatedFields.has('cantonAddress') ? "canton-address-success" : undefined}
                  />
                  
                  <AnimatePresence>
                    {errors.cantonAddress ? (
                      <motion.div 
                        id="canton-address-error"
                        className="flex items-center gap-2 mt-3 text-red-400 text-sm font-medium"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                      >
                        <AlertCircle className="w-4 h-4" />
                        {errors.cantonAddress}
                      </motion.div>
                    ) : validatedFields.has('cantonAddress') ? (
                      <motion.div 
                        id="canton-address-success"
                        className="flex items-center gap-2 mt-3 text-emerald-400 text-sm font-medium"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                      >
                        <CheckCircle className="w-4 h-4" />
                        Valid CC address
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* Receiving Address для SELL (USDT) */}
              {!isBuying && (
                <motion.div
                  initial={{ opacity: 0, x: shouldReduceAnimations ? -10 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: shouldReduceAnimations ? 0.5 : 1.1, duration: animationDuration }}
                >
                  <Input
                    id="receiving-address"
                    label={`Receiving Address (${exchangeData.paymentToken.symbol})`}
                    icon={<Wallet className="w-5 h-5" />}
                    type="text"
                    value={formData.receivingAddress || ''}
                    onChange={(e) => handleInputChange('receivingAddress', e.target.value)}
                    placeholder={`Your ${exchangeData.paymentToken.symbol} ${exchangeData.paymentToken.networkName} address`}
                    className={`${errors.receivingAddress ? 'border-red-400/50' : ''} ${validatedFields.has('receivingAddress') ? 'border-emerald-400/50' : ''}`}
                    aria-describedby={errors.receivingAddress ? "receiving-address-error" : validatedFields.has('receivingAddress') ? "receiving-address-success" : undefined}
                  />
                  
                  <AnimatePresence>
                    {errors.receivingAddress ? (
                      <motion.div 
                        id="receiving-address-error"
                        className="flex items-center gap-2 mt-3 text-red-400 text-sm font-medium"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                      >
                        <AlertCircle className="w-4 h-4" />
                        {errors.receivingAddress}
                      </motion.div>
                    ) : validatedFields.has('receivingAddress') ? (
                      <motion.div 
                        id="receiving-address-success"
                        className="flex items-center gap-2 mt-3 text-emerald-400 text-sm font-medium"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                      >
                        <CheckCircle className="w-4 h-4" />
                        Valid {exchangeData.paymentToken.symbol} address
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* Refund Address */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.1, duration: 0.6 }}
              >
                <Input
                  id="refund-address"
                  label="Refund Address (Security)"
                  icon={<Shield className="w-5 h-5" />}
                  type="text"
                  value={formData.refundAddress}
                  onChange={(e) => handleInputChange('refundAddress', e.target.value)}
                  placeholder="Backup address for refunds"
                  className={`${errors.refundAddress ? 'border-red-400/50' : ''} ${validatedFields.has('refundAddress') ? 'border-emerald-400/50' : ''}`}
                  aria-describedby={errors.refundAddress ? "refund-address-error" : undefined}
                />
                <div className="text-sm text-white/60 mt-2 font-medium">
                  🛡️ Safety first: We will use this for refunds if needed
                </div>
                
                <AnimatePresence>
                  {errors.refundAddress && (
                    <motion.div 
                      id="refund-address-error"
                      className="flex items-center gap-2 mt-3 text-red-400 text-sm font-medium"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <AlertCircle className="w-4 h-4" />
                      {errors.refundAddress}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Email */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.2, duration: 0.6 }}
              >
                <Input
                  id="contact-email"
                  label="Contact Email"
                  icon={<Mail className="w-5 h-5" />}
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="your.email@example.com"
                  className={`${errors.email ? 'border-red-400/50' : ''} ${validatedFields.has('email') ? 'border-emerald-400/50' : ''}`}
                  aria-describedby={errors.email ? "email-error" : undefined}
                />
                
                <AnimatePresence>
                  {errors.email ? (
                    <motion.div 
                      id="email-error"
                      className="flex items-center gap-2 mt-3 text-red-400 text-sm font-medium"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <AlertCircle className="w-4 h-4" />
                      {errors.email}
                    </motion.div>
                  ) : validatedFields.has('email') ? (
                    <motion.div 
                      id="email-success"
                      className="flex items-center gap-2 mt-3 text-emerald-400 text-sm font-medium"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <CheckCircle className="w-4 h-4" />
                      Valid email address
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>

              {/* Optional Contact Methods */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.3, duration: 0.6 }}
                >
                  <Input
                    id="whatsapp-contact"
                    label="WhatsApp (Optional)"
                    icon={<Phone className="w-5 h-5" />}
                    type="tel"
                    value={formData.whatsapp}
                    onChange={(e) => handleInputChange('whatsapp', e.target.value)}
                    placeholder="+1234567890"
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.4, duration: 0.6 }}
                >
                  <Input
                    id="telegram-contact"
                    label="Telegram (Optional)"
                    icon={<MessageSquare className="w-5 h-5" />}
                    type="text"
                    value={formData.telegram}
                    onChange={(e) => handleInputChange('telegram', e.target.value)}
                    placeholder="@username"
                  />
                </motion.div>
              </div>

              {/* Action Buttons */}
              <motion.div 
                className="flex gap-6 pt-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.5, duration: 0.6 }}
              >
                <Button
                  type="button"
                  onClick={onBack}
                  variant="liquid"
                  className="flex-1 text-lg"
                  size="lg"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Back
                </Button>
                
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 text-lg"
                  size="lg"
                >
                  {isLoading ? (
                    <motion.div className="flex items-center gap-3">
                      <motion.div 
                        className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                      Processing...
                    </motion.div>
                  ) : (
                    <motion.span 
                      className="flex items-center gap-3"
                      whileHover={{ x: 5 }}
                      transition={{ type: "spring", stiffness: 400 }}
                    >
                      Continue to Payment
                      <ArrowRight className="w-5 h-5" />
                    </motion.span>
                  )}
                </Button>
              </motion.div>

              {/* Terms Notice */}
              <motion.div 
                className="text-center pt-6 border-t border-white/10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.6 }}
              >
                <div className="flex items-center justify-center gap-2 text-sm text-white/60">
                  <Shield className="w-4 h-4" />
                  <span>Secured by military-grade encryption</span>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.form>
      </motion.div>
    </>
  )
}