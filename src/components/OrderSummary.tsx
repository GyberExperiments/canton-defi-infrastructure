'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, CheckCircle, ExternalLink, Sparkles, Copy, Link as LinkIcon } from 'lucide-react'
import { Button } from './ui/Button'
import { OTC_CONFIG, type OTCOrder, TokenConfig } from '@/config/otc'
import { formatCurrency, generateOrderId } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import { intercomUtils } from './IntercomProvider'

interface OrderSummaryProps {
  onBack: () => void;
  orderData: {
    paymentToken: TokenConfig;
    paymentAmount: number;
    paymentAmountUSD: number;
    cantonAmount: number;
    cantonAddress: string;
    receivingAddress?: string; // ✅ При sell: адрес для получения USDT
    refundAddress?: string;
    email: string;
    whatsapp?: string;
    telegram?: string;
    exchangeDirection?: 'buy' | 'sell'; // ✅ КРИТИЧНО: Направление обмена!
    isPrivateDeal?: boolean; // ✅ Приватная сделка
    isMarketPrice?: boolean; // REQ-002: Сделка по рыночной цене
    marketPriceDiscountPercent?: number; // Процент дисконта от рыночной цены
    serviceCommission?: number; // REQ-006: Комиссия сервиса в %
    // Legacy compatibility
    usdtAmount: number;
  };
}

export default function OrderSummary({ onBack, orderData }: OrderSummaryProps) {
  const [orderId, setOrderId] = useState<string>("")
  const [orderLink, setOrderLink] = useState<string>("")
  const [currentStep] = useState(1)
  const [order] = useState<Omit<OTCOrder, 'orderId'>>({
    timestamp: Date.now(),
    paymentToken: orderData.paymentToken,
    paymentAmount: orderData.paymentAmount,
    paymentAmountUSD: orderData.paymentAmountUSD,
    cantonAmount: orderData.cantonAmount,
    cantonAddress: orderData.cantonAddress,
    receivingAddress: orderData.receivingAddress, // ✅ При sell: адрес для получения USDT
    refundAddress: orderData.refundAddress,
    email: orderData.email,
    whatsapp: orderData.whatsapp,
    telegram: orderData.telegram,
    status: 'awaiting-deposit',
    exchangeDirection: orderData.exchangeDirection, // ✅ КРИТИЧНО: Передаем направление обмена!
    usdtAmount: orderData.usdtAmount
  })
  
  const isBuying = !orderData.exchangeDirection || orderData.exchangeDirection === 'buy'
  
  // MINIMAL VERSION: No unique address needed

  // MINIMAL VERSION: No QR code generation needed

  // Save order via API (minimal version)
  useEffect(() => {
    const saveOrder = async () => {
      try {
        const response = await fetch('/api/create-order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(order),
        })

        // Проверяем статус ПЕРЕД парсингом JSON
        if (!response.ok) {
          // Если статус не 200, значит ошибка
          let errorMessage = 'Failed to create order'
          
          try {
            const errorData = await response.json()
            errorMessage = errorData.error || errorMessage
          } catch {
            errorMessage = `HTTP Error: ${response.status}`
          }
          
          toast.error(`Failed to create order: ${errorMessage}`)
          console.error('❌ Order creation failed:', { status: response.status, error: errorMessage })
          
          // ВАЖНО: Вернуться к форме при ошибке
          setTimeout(() => {
            onBack()
          }, 2000)
          return
        }

        const result = await response.json()
        if (result.success && result.orderId) {
         setOrderId(String(result.orderId))
         if (result.orderLink) {
           setOrderLink(result.orderLink)
         }
         toast.success('Order created successfully! Please contact customer support for payment instructions.')
         console.log('📊 Order saved:', result)
         // Update Intercom user с правильным id
         intercomUtils.updateUser({
           user_id: order.email,
           email: order.email,
           name: order.email.split('@')[0],
           custom_attributes: {
             last_order_id: result.orderId,
             last_order_amount: order.paymentAmountUSD,
             last_order_status: order.status,
             canton_address: order.cantonAddress,
             payment_token: order.paymentToken.symbol,
             order_created_at: new Date(order.timestamp).toISOString()
           }
         })
        } else {
         toast.error(`Failed to create order: ${result.error}`)
         console.error('❌ Order creation failed:', result)
         setTimeout(() => { onBack() }, 2000)
        }
      } catch (error) {
        console.error('❌ Network error creating order:', error)
        toast.error('Network error. Please try again.')
        
        // Вернуться к форме при сетевой ошибке
        setTimeout(() => {
          onBack()
        }, 2000)
      }
    }

    saveOrder()
  }, [order])

  const copyToClipboard = async (text: string, label: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text)
        toast.success(`${label} copied to clipboard!`)
      } else {
        // Fallback for server-side rendering
        toast.error('Clipboard not available')
      }
    } catch {
      toast.error('Failed to copy to clipboard')
    }
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

  return (
    <motion.div 
      className="max-w-4xl mx-auto"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <div className="text-center mb-8">
        <motion.h2 
          className="text-3xl font-bold text-white mb-2"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Order Summary
        </motion.h2>
        <div className="text-lg text-blue-300 font-semibold">
          Order ID: {orderId ? orderId : '...'}
        </div>
      </div>

      <div className="max-w-2xl mx-auto space-y-8">
        {/* Left Column - Payment Instructions */}
        <motion.div
          className="space-y-6"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          {/* Payment Instructions */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-white mb-4">Payment Instructions</h3>
            
            <div className="space-y-4">
              <div>
                <div className="text-sm text-white/70 mb-2">You need to send</div>
                <div className="flex items-center gap-2 mb-2">
                  {isBuying ? (
                    <>
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: orderData.paymentToken.color + '20', color: orderData.paymentToken.color }}
                      >
                        {orderData.paymentToken.icon}
                      </div>
                      <div className="text-2xl font-bold text-blue-300">
                        {formatCurrency(orderData.paymentAmount)} {orderData.paymentToken.symbol}
                      </div>
                    </>
                  ) : (
                    <>
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ 
                          background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                          color: '#fff'
                        }}
                      >
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div className="text-2xl font-bold text-blue-300">
                        {formatCurrency(orderData.cantonAmount)} CC
                      </div>
                    </>
                  )}
                </div>
                {isBuying ? (
                  <>
                    <div className="text-sm text-white/50">{orderData.paymentToken.networkName} Network</div>
                    <div className="text-xs text-white/40">≈ ${formatCurrency(orderData.paymentAmountUSD)} USD</div>
                  </>
                ) : (
                  <div className="text-sm text-white/50">Canton Network</div>
                )}
              </div>

              <div className="text-center p-6 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-400/20 rounded-xl">
                <div className="text-lg font-semibold text-blue-300 mb-4">
                  Please, to proceed with your order <span className="text-white font-bold">#{orderId}</span> connect with our customer support by pressing the button below
                </div>
                <Button
                  onClick={async () => {
                    // 🎯 АВТОМАТИЧЕСКАЯ ОТПРАВКА сообщения в Intercom
                    console.log('📤 Contact Customer Support clicked')
                    
                    // Проверяем, доступен ли Intercom
                    if (intercomUtils.isReady()) {
                      toast.loading('Sending message to support...', { id: 'sending-message' })
                      
                      // Автоматически отправляем сообщение с данными заказа
                      const result = await intercomUtils.sendOrderMessageAutomatic({
                        orderId,
                        email: orderData.email,
                        amount: orderData.paymentAmountUSD,
                        cantonAmount: orderData.cantonAmount,
                        paymentToken: orderData.paymentToken.symbol,
                        paymentNetwork: orderData.paymentToken.networkName,
                        cantonAddress: orderData.cantonAddress,
                        exchangeDirection: (orderData as {exchangeDirection?: 'buy' | 'sell'}).exchangeDirection
                      })
                      
                      toast.dismiss('sending-message')
                      
                      if (result.success) {
                        toast.success('✅ Message sent! Our team or AI assistant will respond soon.')
                        console.log('✅ Auto-sent order message:', result)
                      } else {
                        // Fallback: открываем чат с предзаполненным сообщением
                        toast('Opening chat... Please send the message manually.', { icon: '⚠️' })
                        const orderMessage = isBuying
                          ? `👋 Hello! I need help with my order #${orderId}

📋 Order Details:
• Order ID: ${orderId}
• **Type: BUYING Canton Coin** 🛒
• Paying: ${formatCurrency(orderData.paymentAmount)} ${orderData.paymentToken.symbol}
• Receiving: ${formatCurrency(orderData.cantonAmount)} Canton Coin
• Payment Network: ${orderData.paymentToken.networkName}

Please provide payment instructions for this order. Thanks!`
                          : `👋 Hello! I need help with my order #${orderId}

📋 Order Details:
• Order ID: ${orderId}
• **Type: SELLING Canton Coin** 💰
• Selling: ${formatCurrency(orderData.cantonAmount)} Canton Coin
• Receiving: ${formatCurrency(orderData.paymentAmount)} ${orderData.paymentToken.symbol}
• Payment Network: ${orderData.paymentToken.networkName}

Please provide payment instructions for this order. Thanks!`
                        
                        intercomUtils.showNewMessage(orderMessage)
                      }
                    } else {
                      // Fallback: показываем модальное окно с информацией о заказе
                      const supportInfo = isBuying
                        ? `Order #${orderId}\n\nType: BUYING Canton Coin 🛒\nPaying: ${formatCurrency(orderData.paymentAmount)} ${orderData.paymentToken.symbol}\nReceiving: ${formatCurrency(orderData.cantonAmount)} Canton Coin\n\nPlease contact support with this information.`
                        : `Order #${orderId}\n\nType: SELLING Canton Coin 💰\nSelling: ${formatCurrency(orderData.cantonAmount)} Canton Coin\nReceiving: ${formatCurrency(orderData.paymentAmount)} ${orderData.paymentToken.symbol}\n\nPlease contact support with this information.`
                      
                      // Копируем информацию в буфер обмена
                      if (navigator.clipboard) {
                        navigator.clipboard.writeText(supportInfo)
                        toast.success('Order information copied to clipboard! Contact support with this data.')
                      } else {
                        // Fallback для старых браузеров
                        const textArea = document.createElement('textarea')
                        textArea.value = supportInfo
                        document.body.appendChild(textArea)
                        textArea.select()
                        document.execCommand('copy')
                        document.body.removeChild(textArea)
                        toast.success('Order information copied to clipboard! Contact support with this data.')
                      }
                      
                      // Показываем дополнительную информацию
                      toast.success('Support chat is temporarily unavailable. Please contact us via email or use the copied order information.')
                    }
                    
                    console.log('✅ Support requested for order', { orderId })
                  }}
                  className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold px-8 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  Contact Customer Support
                </Button>
              </div>
            </div>
          </div>

          {/* REQ-006: Exchange Calculation Details */}
          <motion.div
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <h3 className="text-lg font-bold text-white mb-4">Exchange Calculation</h3>
            <div className="space-y-3">
              {(() => {
                const serviceCommission = orderData.serviceCommission || 1;
                
                // Для BUY (покупка Canton)
                if (isBuying) {
                  const totalAmount = orderData.paymentAmountUSD; // Общая сумма к переводу
                  const commissionUSD = totalAmount * serviceCommission / 100; // Комиссия в USD
                  const finalAmount = orderData.cantonAmount; // Итоговая сумма в CC
                  
                  return (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-white/70">Total Amount:</span>
                        <span className="text-white font-semibold">
                          {formatCurrency(totalAmount)} USD
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-white/70">Commission ({serviceCommission}%):</span>
                        <span className="text-cyan-400 font-semibold">
                          {formatCurrency(commissionUSD)} USD
                        </span>
                      </div>
                      <div className="border-t border-white/10 pt-3 mt-3">
                        <div className="flex justify-between items-center">
                          <span className="text-white font-semibold">You will receive:</span>
                          <span className="text-cyan-300 font-bold text-lg">
                            {formatCurrency(finalAmount)} CC
                          </span>
                        </div>
                      </div>
                    </>
                  );
                } else {
                  // Для SELL (продажа Canton)
                  const totalAmount = orderData.cantonAmount; // Общая сумма к переводу (в CC)
                  const commissionCC = totalAmount * serviceCommission / 100; // Комиссия в CC
                  const finalAmount = orderData.paymentAmount; // Итоговая сумма в USDT
                  
                  return (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-white/70">Total Amount:</span>
                        <span className="text-white font-semibold">
                          {formatCurrency(totalAmount)} CC
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-white/70">Commission ({serviceCommission}%):</span>
                        <span className="text-cyan-400 font-semibold">
                          {formatCurrency(commissionCC)} CC
                        </span>
                      </div>
                      <div className="border-t border-white/10 pt-3 mt-3">
                        <div className="flex justify-between items-center">
                          <span className="text-white font-semibold">You will receive:</span>
                          <span className="text-cyan-300 font-bold text-lg">
                            {formatCurrency(finalAmount)} {orderData.paymentToken.symbol}
                          </span>
                        </div>
                      </div>
                    </>
                  );
                }
              })()}
            </div>
          </motion.div>

          {/* You Will Receive */}
          <div className="bg-gradient-to-r from-green-500/10 to-cyan-500/10 border border-green-400/20 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              <span className="text-cyan-300 font-semibold">You will receive</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {isBuying ? (
                <>{formatCurrency(orderData.cantonAmount)} CC</>
              ) : (
                <>{formatCurrency(orderData.paymentAmount)} {orderData.paymentToken.symbol}</>
              )}
            </div>
            {/* REQ-002: Market Price indicator */}
            {orderData.isMarketPrice && (
              <div className="text-sm text-cyan-400 mt-2 font-medium">
                ✓ Price: at Market Price
                {orderData.marketPriceDiscountPercent && orderData.marketPriceDiscountPercent > 0 && (
                  <span className="text-yellow-400 ml-1">
                    ({orderData.marketPriceDiscountPercent}% discount)
                  </span>
                )}
              </div>
            )}
            <div className="text-sm text-white/50 mt-1">
              Receiving Address: <span className="text-cyan-300">
                {isBuying ? (
                  <>{orderData.cantonAddress.substring(0, 20)}...</>
                ) : (
                  <>{orderData.receivingAddress ? orderData.receivingAddress.substring(0, 20) + '...' : 'Not provided'}</>
                )}
              </span>
            </div>
            
            {/* Canton Address при sell */}
            {!isBuying && (
              <div className="mt-3 text-xs text-white/60">
                Sending from: <span className="text-cyan-300">{orderData.cantonAddress.substring(0, 20)}...</span>
              </div>
            )}
            
            {/* Refund Wallet Field */}
            {orderData.refundAddress && (
              <div className="mt-4 p-3 bg-white/5 border border-white/10 rounded-lg">
                <div className="text-xs text-white/70 mb-1">Refund Wallet:</div>
                <div className="text-sm text-cyan-300 font-mono break-all">
                  {orderData.refundAddress}
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* REQ-005: Order Link for Sharing */}
        {orderId && (
          <motion.div
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <LinkIcon className="w-5 h-5 text-cyan-400" />
              <h3 className="text-lg font-bold text-white">Share Order Link</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-white/5 border border-white/10 rounded-lg">
                <code className="text-sm text-cyan-300 font-mono flex-1 break-all">
                  {typeof window !== 'undefined' ? `${window.location.origin}/order/${orderId}` : `.../order/${orderId}`}
                </code>
                <Button
                  onClick={() => {
                    const orderLink = typeof window !== 'undefined' 
                      ? `${window.location.origin}/order/${orderId}`
                      : `.../order/${orderId}`
                    copyToClipboard(orderLink, 'Order link')
                  }}
                  variant="ghost"
                  size="sm"
                  className="ml-2"
                >
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </Button>
              </div>
              <p className="text-xs text-white/60">
                Share this link with your counterparty to allow them to view and complete the order.
              </p>
            </div>
          </motion.div>
        )}

        {/* Progress Steps */}
        <motion.div
          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="text-lg font-bold text-white mb-6 text-center">Exchange Progress</h3>
          
          <div className="flex justify-between mb-8">
            {OTC_CONFIG.PROCESSING_STEPS.map((step) => (
              <StepIndicator
                key={step.id}
                step={step.id}
                isActive={currentStep === step.id}
                isCompleted={currentStep > step.id}
              />
            ))}
          </div>

          <div className="text-center">
            <div className="text-sm font-semibold text-blue-300 mb-2">
              {OTC_CONFIG.PROCESSING_STEPS[currentStep - 1]?.name}
            </div>
            <div className="text-xs text-white/70">
              {OTC_CONFIG.PROCESSING_STEPS[currentStep - 1]?.description}
            </div>
          </div>
        </motion.div>

        {/* Contact Support */}
        <motion.div
          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h3 className="text-lg font-bold text-white mb-4">Need Help?</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-blue-400" />
              <span className="text-white/70">Email:</span>
              <span className="text-blue-300">{OTC_CONFIG.SUPPORT_EMAIL}</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Back Button */}
      <motion.div 
        className="mt-8 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <Button
          onClick={onBack}
          variant="secondary"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Create New Order
        </Button>
      </motion.div>
    </motion.div>
  )
}
