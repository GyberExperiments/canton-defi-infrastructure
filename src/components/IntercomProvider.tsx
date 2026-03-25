'use client'

import { useEffect, useState, useCallback } from 'react'
import { intercomMonitoringService } from '@/lib/services/intercomMonitoring'

interface IntercomProviderProps {
  appId: string
  children: React.ReactNode
}

declare global {
  interface Window {
    Intercom: (command: string, ...args: unknown[]) => void
    intercomSettings: {
      app_id: string
      [key: string]: unknown
    }
  }
}

export default function IntercomProvider({ appId, children }: IntercomProviderProps) {
  const [isIntercomLoaded, setIsIntercomLoaded] = useState(false)
  const [intercomError, setIntercomError] = useState<string | null>(null)
  const [showFallback, setShowFallback] = useState(false)

  // Lazy load Intercom with error handling
  const loadIntercom = useCallback(async () => {
    if (!appId) {
      console.error('❌ No Intercom App ID provided')
      setIntercomError('No Intercom App ID provided')
      setShowFallback(true)
      return
    }

    console.log('🔄 Loading Intercom with APP_ID:', appId)

    try {
      // Check if Intercom is already loaded and ready
      if (typeof window.Intercom === 'function' && window.Intercom !== null) {
        // Additional check to ensure Intercom is fully initialized
        try {
          window.Intercom('getVisitorId')
          console.log('✅ Intercom already loaded and ready')
          setIsIntercomLoaded(true)
          
          // Check if Intercom is actually working by testing API calls
          setTimeout(() => {
            if (!isIntercomLoaded) {
              console.warn('⚠️ Intercom loaded but API calls may be blocked')
              setShowFallback(true)
            }
          }, 5000)
          
          return
        } catch (error) {
          console.warn('⚠️ Intercom exists but not fully initialized:', error)
          // Intercom exists but not ready, continue with loading
        }
      }

      // Initialize Intercom settings with enhanced configuration
      console.log('⚙️ Initializing Intercom settings')
      window.intercomSettings = {
        app_id: appId,
        // Customize widget appearance
        widget: {
          activator: '#intercom-frame',
        },
        // Set user attributes if available
        user_id: undefined, // Will be set when user creates order
        email: undefined,
        name: undefined,
        // Custom attributes for Canton OTC
        custom_launcher_selector: '.intercom-launcher',
        alignment: 'right',
        vertical_padding: 20,
        horizontal_padding: 20,
        // Performance optimizations
        hide_default_launcher: false,
        session_duration: 30 * 60 * 1000, // 30 minutes
        // 🔥 КРИТИЧНО: API версия и домены для устранения 403
        api_base: 'https://api-iam.intercom.io',
        // Включаем отладку в development
        ...(process.env.NODE_ENV === 'development' && { debug: true })
      }

      // 🔥 Мониторинг HTTP ошибок (403) через глобальный fetch intercept
      const originalFetch = window.fetch
      const fetchInterceptor = async (...args: Parameters<typeof fetch>) => {
        try {
          const response = await originalFetch(...args)
          
          // Проверяем 403 ошибки от Intercom API
          if (!response.ok && args[0] && typeof args[0] === 'string') {
            const url = args[0]
            if (url.includes('intercom.io')) {
              console.error(`🚫 Intercom API error ${response.status} for ${url}`)
              
              if (response.status === 403) {
                console.error('❌ 403 FORBIDDEN - Проверьте:')
                console.error('   1. APP_ID корректен: ' + appId)
                console.error('   2. Домен разрешён в настройках Intercom')
                console.error('   3. Access Token имеет правильные права')
                
                // Показываем fallback после 403
                setTimeout(() => {
                  setShowFallback(true)
                  setIntercomError('Intercom API blocked (403). Using fallback support.')
                }, 2000)
              }
            }
          }
          
          return response
        } catch (error) {
          if (args[0] && typeof args[0] === 'string' && args[0].includes('intercom.io')) {
            console.error('🚫 Network error for Intercom:', error)
          }
          throw error
        }
      }
      
      window.fetch = fetchInterceptor as typeof fetch

      // Load Intercom script with timeout
      console.log('📦 Loading Intercom widget script...')
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.error('⏱️ Intercom script load timeout (10s)')
          reject(new Error('Intercom script load timeout'))
        }, 10000) // 10 second timeout

        // Проверяем доступность document перед созданием элемента
        if (typeof document === 'undefined') {
          reject(new Error('Document not available in server environment'))
          return
        }
        
        const script = document.createElement('script')
        script.type = 'text/javascript'
        script.async = true
        script.src = `https://widget.intercom.io/widget/${appId}`
        
        script.onload = () => {
          clearTimeout(timeout)
          console.log('✅ Intercom widget script loaded')
          resolve()
        }
        
        script.onerror = (error) => {
          clearTimeout(timeout)
          console.error('❌ Failed to load Intercom script:', error)
          reject(new Error('Failed to load Intercom script'))
        }

        // Проверяем доступность document перед использованием
        if (typeof document !== 'undefined') {
          const firstScript = document.getElementsByTagName('script')[0]
          firstScript.parentNode?.insertBefore(script, firstScript)
        } else {
          // Fallback для server-side рендеринга
          reject(new Error('Document not available in server environment'))
          return
        }
      })

      // Boot Intercom
      if (typeof window.Intercom === 'function') {
        const bootStartTime = Date.now()
        ;(window.Intercom as (command: string, ...args: unknown[]) => void)('boot', window.intercomSettings)
        const loadTime = Date.now() - bootStartTime
        
        setIsIntercomLoaded(true)
        intercomMonitoringService.trackWidgetLoad(loadTime)
        console.log('✅ Intercom loaded successfully')
      } else {
        throw new Error('Intercom not available after script load')
      }

    } catch (error) {
      console.error('❌ Failed to load Intercom:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      // Enhanced error logging for debugging
      console.error('🔍 Intercom Error Details:', {
        error: errorMessage,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
        location: typeof window !== 'undefined' && window.location ? window.location.href : 'server',
        timestamp: new Date().toISOString(),
        networkStatus: typeof navigator !== 'undefined' ? (navigator.onLine ? 'online' : 'offline') : 'server'
      })
      
      setIntercomError(errorMessage)
      setShowFallback(true)
      intercomMonitoringService.trackWidgetFailure(errorMessage)
    }
  }, [appId, isIntercomLoaded])

  useEffect(() => {
    // Load Intercom only in browser environment
    if (typeof window !== 'undefined' && !isIntercomLoaded && !intercomError) {
      loadIntercom()
    }
  }, [loadIntercom, isIntercomLoaded, intercomError])

  // Monitor for Intercom API blocking
  useEffect(() => {
    if (isIntercomLoaded && !showFallback) {
      // Listen for network errors that indicate blocking
      const handleNetworkError = (event: Event) => {
        const target = event.target as HTMLScriptElement
        if (target && target.src && target.src.includes('intercom.io')) {
          console.warn('🚫 Intercom API blocked, showing fallback')
          setShowFallback(true)
        }
      }

      // Add event listener for script errors
      if (typeof document !== 'undefined') {
        document.addEventListener('error', handleNetworkError, true)
      }

      // Listen for fetch errors
      const originalFetch = window.fetch
      window.fetch = function(...args) {
        return originalFetch.apply(this, args).catch((error) => {
          if (args[0] && typeof args[0] === 'string' && args[0].includes('intercom.io')) {
            console.warn('🚫 Intercom fetch blocked, showing fallback')
            setShowFallback(true)
          }
          throw error
        })
      }

      // Cleanup
      return () => {
        if (typeof document !== 'undefined') {
          document.removeEventListener('error', handleNetworkError, true)
        }
        window.fetch = originalFetch
      }
    }
  }, [isIntercomLoaded, showFallback])

  // Cleanup function
  useEffect(() => {
    return () => {
      // Remove Intercom script
      const existingScript = typeof document !== 'undefined' ? document.querySelector('script[src*="widget.intercom.io"]') : null
      if (existingScript) {
        existingScript.remove()
      }
      
      // Shutdown Intercom
      if (window.Intercom) {
        window.Intercom('shutdown')
      }
    }
  }, [])

  return (
    <>
      {children}
      {/* Hide Intercom widget when fallback is shown */}
      {showFallback && (
        <style jsx global>{`
          .intercom-launcher,
          .intercom-lightweight-app,
          [data-intercom-target] {
            display: none !important;
          }
        `}</style>
      )}
      {/* Enhanced fallback support when Intercom fails */}
      {showFallback && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 rounded-xl shadow-lg backdrop-blur-xl border border-white/20">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">💬</span>
              <div>
                <div className="font-semibold">Need Help?</div>
                <div className="text-sm opacity-90">Chat with our support team</div>
              </div>
            </div>
            <div className="space-y-2">
              <a
                href="https://t.me/canton_otc_bot"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-colors w-full justify-center text-sm"
              >
                <span>📱</span>
                Telegram Support
              </a>
              <a
                href="mailto:support@cantonotc.com?subject=Support request"
                className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-colors w-full justify-center text-sm"
              >
                <span>📧</span>
                Email Support
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Utility functions for Intercom integration
export const intercomUtils = {
  /**
   * Check if Intercom is loaded and ready
   */
  isReady: (): boolean => {
    return typeof window !== 'undefined' && 
           typeof window.Intercom === 'function' && 
           window.Intercom !== null
  },

  /**
   * Update user information in Intercom with JWT authentication
   */
  updateUser: async (userData: {
    user_id?: string
    email?: string
    name?: string
    custom_attributes?: Record<string, unknown>
  }) => {
    if (!intercomUtils.isReady()) {
      console.warn('⚠️ Intercom not ready, skipping user update')
      return
    }

    try {
      // Если есть email и user_id, генерируем JWT на сервере
      if (userData.email && userData.user_id) {
        console.log('🔐 Generating JWT for user:', userData.email)
        
        const jwtResponse = await fetch('/api/intercom/generate-jwt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: userData.user_id,
            email: userData.email,
            name: userData.name,
            custom_attributes: userData.custom_attributes,
          }),
        })

        if (!jwtResponse.ok) {
          throw new Error(`JWT generation failed: ${jwtResponse.statusText}`)
        }

        const { token } = await jwtResponse.json()

        // Обновляем Intercom с JWT токеном
        // Все данные уже в JWT payload, передаём только токен
        window.Intercom('update', {
          user_hash: token, // DEPRECATED - старое название
          intercom_user_jwt: token, // Новое правильное название для JWT
        })

        console.log('✅ Intercom user updated with JWT:', userData.email)
      } else {
        // Fallback: если нет email/user_id, обновляем без JWT (анонимно)
        window.Intercom('update', userData)
        console.log('✅ Intercom updated (anonymous):', userData)
      }
    } catch (error) {
      console.error('❌ Failed to update Intercom user:', error)
      // Fallback: пытаемся обновить без JWT
      try {
        window.Intercom('update', {
          // Передаём только non-sensitive данные
          name: userData.name,
        })
        console.warn('⚠️ Updated Intercom without JWT (fallback)')
      } catch (fallbackError) {
        console.error('❌ Fallback update also failed:', fallbackError)
      }
    }
  },

  /**
   * Show Intercom messenger
   */
  show: () => {
    if (intercomUtils.isReady()) {
      try {
        window.Intercom('show')
        intercomMonitoringService.trackConversationStarted()
        console.log('✅ Intercom messenger shown')
      } catch (error) {
        console.error('❌ Failed to show Intercom messenger:', error)
        intercomMonitoringService.trackError('Failed to show messenger', { error: error instanceof Error ? error.message : 'Unknown error' })
      }
    } else {
      console.warn('⚠️ Intercom not ready, cannot show messenger')
      intercomMonitoringService.trackError('Messenger not ready', { action: 'show' })
    }
  },

  /**
   * Hide Intercom messenger
   */
  hide: () => {
    if (intercomUtils.isReady()) {
      try {
        window.Intercom('hide')
        console.log('✅ Intercom messenger hidden')
      } catch (error) {
        console.error('❌ Failed to hide Intercom messenger:', error)
      }
    }
  },

  /**
   * Show new message in Intercom
   */
  showNewMessage: (message?: string) => {
    if (intercomUtils.isReady()) {
      try {
        window.Intercom('showNewMessage', message)
        intercomMonitoringService.trackMessageSent()
        console.log('✅ Intercom new message shown:', message)
      } catch (error) {
        console.error('❌ Failed to show Intercom new message:', error)
        intercomMonitoringService.trackError('Failed to show new message', { error: error instanceof Error ? error.message : 'Unknown error' })
      }
    } else {
      console.warn('⚠️ Intercom not ready, cannot show new message')
      intercomMonitoringService.trackError('Messenger not ready', { action: 'showNewMessage' })
    }
  },

  /**
   * Track event in Intercom
   */
  trackEvent: (eventName: string, metadata?: Record<string, unknown>) => {
    if (intercomUtils.isReady()) {
      try {
        window.Intercom('trackEvent', eventName, metadata)
        console.log('✅ Intercom event tracked:', eventName, metadata)
      } catch (error) {
        console.error('❌ Failed to track Intercom event:', error)
      }
    } else {
      console.warn('⚠️ Intercom not ready, cannot track event:', eventName)
    }
  },

  /**
   * Set user attributes for order tracking
   */
  setOrderUser: (orderData: {
    orderId: string
    email: string
    cantonAddress: string
    amount: number
    status: string
  }) => {
    if (intercomUtils.isReady()) {
      try {
        const userData = {
          user_id: orderData.email,
          email: orderData.email,
          name: orderData.email.split('@')[0],
          custom_attributes: {
            last_order_id: orderData.orderId,
            last_order_amount: orderData.amount,
            last_order_status: orderData.status,
            canton_address: orderData.cantonAddress,
            customer_type: 'otc_trader',
            last_activity: new Date().toISOString(),
            // Additional context for operators
            order_network: 'Canton Network',
            order_type: 'OTC Exchange',
            support_priority: orderData.amount > 1000 ? 'high' : 'normal'
          }
        }
        
        window.Intercom('update', userData)
        console.log('✅ Intercom order user set:', orderData.orderId)
      } catch (error) {
        console.error('❌ Failed to set Intercom order user:', error)
      }
    } else {
      console.warn('⚠️ Intercom not ready, cannot set order user')
    }
  },

  /**
   * Track support interaction metrics
   */
  trackSupportMetrics: (action: 'widget_opened' | 'message_sent' | 'conversation_started') => {
    if (intercomUtils.isReady()) {
      try {
        window.Intercom('trackEvent', `support_${action}`, {
          timestamp: new Date().toISOString(),
          page: typeof window !== 'undefined' && window.location ? window.location.pathname : 'server',
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
          referrer: typeof document !== 'undefined' ? document.referrer : ''
        })
        console.log('✅ Intercom support metric tracked:', action)
      } catch (error) {
        console.error('❌ Failed to track support metric:', error)
      }
    }
  },

  /**
   * 🎯 АВТОМАТИЧЕСКАЯ ОТПРАВКА сообщения о заказе в Intercom
   * 
   * Создаёт conversation, отправляет сообщение от имени пользователя,
   * и открывает чат. Fin AI будет отвечать пока оператор не подключится.
   */
  sendOrderMessageAutomatic: async (orderData: {
    orderId: string
    email: string
    amount: number
    cantonAmount: number
    paymentToken: string
    paymentNetwork: string
    cantonAddress: string
    exchangeDirection?: 'buy' | 'sell'
  }) => {
    try {
      console.log('📤 Auto-sending order message to Intercom...', orderData.orderId)

      // Вызываем server-side API для автоматической отправки
      const response = await fetch('/api/intercom/send-order-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order_id: orderData.orderId,
          email: orderData.email,
          order_data: {
            amount: orderData.amount,
            canton_amount: orderData.cantonAmount,
            payment_token: orderData.paymentToken,
            payment_network: orderData.paymentNetwork,
            canton_address: orderData.cantonAddress,
            exchange_direction: orderData.exchangeDirection || 'buy'
          }
        }),
      })

      const result = await response.json()

      if (result.success) {
        console.log('✅ Order message auto-sent to Intercom:', {
          orderId: orderData.orderId,
          conversationId: result.conversation_id
        })

        // Открываем чат чтобы пользователь увидел отправленное сообщение
        if (intercomUtils.isReady()) {
          window.Intercom('show')
        }

        // Трекаем успешную отправку
        intercomUtils.trackEvent('order_message_auto_sent', {
          order_id: orderData.orderId,
          conversation_id: result.conversation_id
        })

        return {
          success: true,
          conversationId: result.conversation_id,
          message: 'Message sent! Our team or Fin AI will respond soon.'
        }
      } else {
        console.warn('⚠️ Failed to auto-send order message:', result)
        return {
          success: false,
          reason: result.reason || 'unknown',
          message: result.message || 'Failed to send message'
        }
      }

    } catch (error) {
      console.error('❌ Error auto-sending order message:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to send message automatically'
      }
    }
  }
}


