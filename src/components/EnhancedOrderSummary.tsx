'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, CheckCircle, ExternalLink, Sparkles, Copy, MessageCircle } from 'lucide-react'
import { Button } from './ui/Button'
import { OTC_CONFIG, type OTCOrder, TokenConfig } from '@/config/otc'
import { formatCurrency, generateOrderId } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import { intercomUtils } from './IntercomProvider'

interface EnhancedOrderSummaryProps {
  onBack: () => void;
  orderData: {
    paymentToken: TokenConfig;
    paymentAmount: number;
    paymentAmountUSD: number;
    cantonAmount: number;
    cantonAddress: string;
    refundAddress?: string;
    email: string;
    whatsapp?: string;
    telegram?: string;
    usdtAmount: number;
  };
}

export default function EnhancedOrderSummary({ onBack, orderData }: EnhancedOrderSummaryProps) {
  const [orderId] = useState(generateOrderId())
  const [currentStep] = useState(1)
  const [orderCreated, setOrderCreated] = useState(false)
  const [intercomReady, setIntercomReady] = useState(false)
  
  const [order] = useState<OTCOrder>({
    orderId,
    timestamp: Date.now(),
    paymentToken: orderData.paymentToken,
    paymentAmount: orderData.paymentAmount,
    paymentAmountUSD: orderData.paymentAmountUSD,
    cantonAmount: orderData.cantonAmount,
    cantonAddress: orderData.cantonAddress,
    refundAddress: orderData.refundAddress,
    email: orderData.email,
    whatsapp: orderData.whatsapp,
    telegram: orderData.telegram,
    status: 'awaiting-deposit',
    usdtAmount: orderData.usdtAmount
  })

  // Check Intercom readiness
  useEffect(() => {
    const checkIntercom = () => {
      if (intercomUtils.isReady()) {
        setIntercomReady(true)
      } else {
        setTimeout(checkIntercom, 1000) // Check again in 1 second
      }
    }
    
    checkIntercom()
  }, [])

  // Enhanced order creation with full Intercom integration
  useEffect(() => {
    const createEnhancedOrder = async () => {
      try {
        const response = await fetch('/api/create-order/enhanced-route', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(order),
        })

        const result = await response.json()

        if (result.success) {
          setOrderCreated(true)
          toast.success('🎉 Order created! Intercom chat is ready for support.')
          console.log('📊 Enhanced order created:', result)
          
          // 🎯 Enhanced Intercom user update with full context
          if (intercomReady) {
            intercomUtils.updateUser({
              user_id: order.email,
              email: order.email,
              name: order.email.split('@')[0],
              custom_attributes: {
                // Active order context
                active_order_id: order.orderId,
                active_order_status: order.status,
                active_order_amount: order.paymentAmountUSD,
                active_canton_amount: order.cantonAmount,
                canton_address: order.cantonAddress,
                refund_address: order.refundAddress || '',
                payment_token: order.paymentToken.symbol,
                payment_network: order.paymentToken.networkName,
                
                // Customer profile
                last_order_date: new Date(order.timestamp).toISOString(),
                preferred_network: order.paymentToken.network,
                signup_source: 'canton_otc_web',
                last_activity: new Date().toISOString()
              }
            })

            // Track order creation event
            intercomUtils.trackEvent('order_created', {
              order_id: order.orderId,
              order_amount: order.paymentAmountUSD,
              payment_token: order.paymentToken.symbol,
              payment_network: order.paymentToken.network,
              canton_amount: order.cantonAmount
            })
          }
        } else {
          toast.error(`Failed to create order: ${result.error}`)
          console.error('❌ Enhanced order creation failed:', result)
        }
      } catch (error) {
        console.error('❌ Network error creating enhanced order:', error)
        toast.error('Network error. Please try again.')
      }
    }

    createEnhancedOrder()
  }, [order, intercomReady])

  const copyToClipboard = async (text: string, label: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text)
        toast.success(`${label} copied to clipboard!`)
      } else {
        toast.error('Clipboard not available')
      }
    } catch {
      toast.error('Failed to copy to clipboard')
    }
  }

  const handleContactSupport = async () => {
    if (!orderCreated) {
      toast.error('Please wait for order creation to complete')
      return
    }

    console.log('📤 Contact Customer Support clicked')
    
    // Проверяем, доступен ли Intercom
    if (intercomUtils.isReady()) {
      toast.loading('Sending message to support...', { id: 'sending-message' })
      
      // 🎯 АВТОМАТИЧЕСКИ отправляем сообщение с данными заказа
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
        toast.success('✅ Message sent! Our team or AI assistant will respond soon.', {
          duration: 5000,
          icon: '💬'
        })
        console.log('✅ Auto-sent order message:', result)
        
        // Track successful auto-send
        intercomUtils.trackEvent('order_message_auto_sent', {
          order_id: orderId,
          conversation_id: result.conversationId,
          source: 'enhanced_order_summary'
        })
      } else {
        // Fallback: открываем чат с предзаполненным сообщением
        toast('Opening chat... Please send the message manually.', { icon: '⚠️' })
        
    const enhancedSupportMessage = `👋 Hello! I need help with my order.

📋 **Order Details:**
• Order ID: ${orderId}
• Amount: ${formatCurrency(orderData.paymentAmount)} ${orderData.paymentToken.symbol}
• Receiving: ${formatCurrency(orderData.cantonAmount)} Canton Coin
• Network: ${orderData.paymentToken.networkName}
• Canton Address: ${orderData.cantonAddress}
${orderData.refundAddress ? `• Refund Address: ${orderData.refundAddress}` : ''}

🤝 **What I need:**
Please provide payment instructions for this order. I'm ready to complete all necessary steps.

Thank you for your help! 🚀`

      intercomUtils.showNewMessage(enhancedSupportMessage)
      }
    } else {
      // Fallback: копируем информацию о заказе в буфер обмена
      const supportInfo = `Order #${orderId}\n\nAmount: ${formatCurrency(orderData.paymentAmount)} ${orderData.paymentToken.symbol}\nReceiving: ${formatCurrency(orderData.cantonAmount)} Canton Coin\nCanton Address: ${orderData.cantonAddress}\n${orderData.refundAddress ? `Refund Address: ${orderData.refundAddress}` : ''}\n\nPlease contact support with this information.`
      
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
    
    console.log('✅ Enhanced support requested for order:', { 
      orderId, 
      intercomReady,
      orderCreated 
    })
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
          Order ID: {orderId}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => copyToClipboard(orderId, 'Order ID')}
          className="mt-2 text-xs"
        >
          <Copy className="w-3 h-3 mr-1" />
          Copy ID
        </Button>
        
        {/* Order status indicator */}
        <div className="mt-4 flex items-center justify-center gap-2">
          <div className={`w-3 h-3 rounded-full ${orderCreated ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
          <span className={`text-sm ${orderCreated ? 'text-green-300' : 'text-yellow-300'}`}>
            {orderCreated ? '✅ Order created successfully' : '⏳ Creating order...'}
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto space-y-8">
        {/* Enhanced Payment Instructions */}
        <motion.div
          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="text-xl font-bold text-white mb-4">Payment Instructions</h3>
          
          <div className="space-y-4">
            <div>
              <div className="text-sm text-white/70 mb-2">You need to send</div>
              <div className="flex items-center gap-2 mb-2">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: orderData.paymentToken.color + '20', color: orderData.paymentToken.color }}
                >
                  {orderData.paymentToken.icon}
                </div>
                <div className="text-2xl font-bold text-blue-300">
                  {formatCurrency(orderData.paymentAmount)} {orderData.paymentToken.symbol}
                </div>
              </div>
              <div className="text-sm text-white/50">{orderData.paymentToken.networkName} Network</div>
              <div className="text-xs text-white/40">≈ ${formatCurrency(orderData.paymentAmountUSD)} USD</div>
            </div>

            {/* Enhanced Contact Support Section */}
            <div className="text-center p-6 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-400/20 rounded-xl">
              <div className="mb-4">
                <MessageCircle className="w-12 h-12 text-blue-400 mx-auto mb-3" />
                <div className="text-lg font-semibold text-blue-300 mb-2">
                  Ready for Next Step!
                </div>
                <div className="text-sm text-white/70 mb-4">
                  Your order <span className="text-white font-bold">#{orderId}</span> has been created with full context in our support system. 
                  Our team will provide personalized payment instructions.
                </div>
              </div>
              
              <Button
                onClick={handleContactSupport}
                disabled={!orderCreated}
                className={`${
                  orderCreated 
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500' 
                    : 'bg-gray-600 cursor-not-allowed'
                } text-white font-bold px-8 py-4 rounded-xl shadow-lg transition-all duration-300 w-full max-w-xs`}
              >
                {orderCreated ? (
                  <>
                    <MessageCircle className="w-5 h-5 mr-2" />
                    Contact Customer Support
                  </>
                ) : (
                  <>
                    <div className="w-5 h-5 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Preparing...
                  </>
                )}
              </Button>
              
              {orderCreated && (
                <div className="mt-3 text-xs text-white/60">
                  ✅ Order context automatically shared with support team
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* You Will Receive */}
        <motion.div
          className="bg-gradient-to-r from-green-500/10 to-cyan-500/10 border border-green-400/20 rounded-2xl p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <span className="text-cyan-300 font-semibold">You will receive</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {formatCurrency(orderData.cantonAmount)} CC
          </div>
          <div className="text-sm text-white/50 mt-1">
            Receiving Address ({orderData.paymentToken.networkName}): <span className="text-cyan-300">{orderData.cantonAddress.substring(0, 20)}...</span>
          </div>
          
          {/* Refund Wallet Field */}
          {orderData.refundAddress && (
            <div className="mt-4 p-3 bg-white/5 border border-white/10 rounded-lg">
              <div className="text-xs text-white/70 mb-1">Refund Wallet ({orderData.paymentToken.networkName}):</div>
              <div className="text-sm text-cyan-300 font-mono break-all">
                {orderData.refundAddress}
              </div>
            </div>
          )}
        </motion.div>

        {/* Progress Steps */}
        <motion.div
          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
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

        {/* Enhanced Contact Support */}
        <motion.div
          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <h3 className="text-lg font-bold text-white mb-4">Need Help?</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-blue-400" />
              <span className="text-white/70">Live Chat:</span>
              <span className="text-blue-300">Available 24/7 via support button above</span>
            </div>
            <div className="flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-blue-400" />
              <span className="text-white/70">Email:</span>
              <span className="text-blue-300">{OTC_CONFIG.SUPPORT_EMAIL}</span>
            </div>
            <div className="text-xs text-white/50 mt-4">
              💡 Your order #{orderId} is automatically linked to your support conversations
            </div>
          </div>
        </motion.div>
      </div>

      {/* Back Button */}
      <motion.div 
        className="mt-8 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
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
