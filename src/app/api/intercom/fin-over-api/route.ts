/**
 * 🤖 Fin over API Handler
 * Обработка событий от Fin ассистента Intercom
 */

import { NextRequest, NextResponse } from 'next/server'
import { intercomAIAgent } from '@/lib/services/intercomAIAgent'
import { intercomMonitoringService } from '@/lib/services/intercomMonitoring'
import { telegramMediatorService } from '@/lib/services/telegramMediator'
import { OTC_CONFIG } from '@/config/otc'

interface FinEvent {
  event_type: string
  conversation_id: string
  external_conversation_id: string
  message?: {
    type: string
    text: string
  }
  user?: {
    external_id: string
    email?: string
    name?: string
  }
  metadata?: {
    source?: string
    order_context?: string
    quick_reply_value?: string
  }
}

interface FinResponse {
  event_type: string
  conversation_id: string
  external_conversation_id: string
  message?: {
    type: string
    text: string
  }
  quick_reply_options?: Array<{
    text: string
    value: string
  }>
  typing?: boolean
  resolution_state?: 'resolved' | 'unresolved' | 'handoff_to_human'
}

/**
 * Обработка входящих событий от Fin
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const event: FinEvent = await request.json()
    
    console.log('🤖 Fin over API event received:', {
      event_type: event.event_type,
      conversation_id: event.conversation_id,
      external_conversation_id: event.external_conversation_id,
      has_message: !!event.message,
      has_user: !!event.user
    })

    // Логируем событие
    intercomMonitoringService.trackError('fin_event_received', {
      event_type: event.event_type,
      conversation_id: event.conversation_id,
      processing_time: Date.now() - startTime
    })

    let response: FinResponse = {
      event_type: 'message',
      conversation_id: event.conversation_id,
      external_conversation_id: event.external_conversation_id
    }

    switch (event.event_type) {
      case 'new_conversation':
        response = await handleNewConversation(event)
        break
        
      case 'new_message':
        response = await handleNewMessage(event)
        break
        
      case 'quick_reply_selected':
        response = await handleQuickReply(event)
        break
        
      default:
        console.log('⚠️ Unknown Fin event type:', event.event_type)
        response.message = {
          type: 'text',
          text: 'Извините, я не понял ваш запрос. Пожалуйста, попробуйте еще раз.'
        }
    }

    // Логируем ответ
    intercomMonitoringService.trackError('fin_response_sent', {
      event_type: response.event_type,
      conversation_id: response.conversation_id,
      processing_time: Date.now() - startTime
    })

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Fin over API error:', error)
    
    // Логируем ошибку
    intercomMonitoringService.trackError('fin_api_error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      processing_time: Date.now() - startTime
    })

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

/**
 * Обработка нового разговора
 */
async function handleNewConversation(event: FinEvent): Promise<FinResponse> {
  console.log('🆕 Handling new conversation:', event.external_conversation_id)
  
  // Получаем актуальную цену из конфигурации
  const currentPrice = OTC_CONFIG.CANTON_COIN_BUY_PRICE_USD;
  
  const welcomeMessage = `👋 Привет! Я Canton OTC Assistant, ваш AI-помощник для покупки Canton Coin (CC).

🎯 **Что я могу для вас сделать:**
• 🛒 Помочь купить Canton Coin
• 💰 Сообщить актуальную цену CC
• 📋 Создать заказ на покупку
• 🔍 Проверить статус заказа
• 👨‍💼 Связать с живым оператором

**Актуальная цена CC:** $${currentPrice.toFixed(2)} за 1 CC

Просто напишите, что вас интересует! Например:
• "Хочу купить Canton Coin"
• "Какая цена?"
• "Создать заказ на $100"

Готов помочь! 🚀`

  return {
    event_type: 'message',
    conversation_id: event.conversation_id,
    external_conversation_id: event.external_conversation_id,
    message: {
      type: 'text',
      text: welcomeMessage
    },
    quick_reply_options: [
      { text: '💰 Узнать цену', value: 'check_price' },
      { text: '🛒 Купить CC', value: 'buy_canton' },
      { text: '🌐 Поддерживаемые сети', value: 'supported_networks' },
      { text: '👨‍💼 Связаться с поддержкой', value: 'contact_support' }
    ]
  }
}

/**
 * Обработка нового сообщения
 */
async function handleNewMessage(event: FinEvent): Promise<FinResponse> {
  console.log('💬 Handling new message:', event.message?.text)
  
  if (!event.message?.text) {
    return {
      event_type: 'message',
      conversation_id: event.conversation_id,
      external_conversation_id: event.external_conversation_id,
      message: {
        type: 'text',
        text: 'Извините, я не понял ваше сообщение. Пожалуйста, попробуйте еще раз.'
      }
    }
  }

  // Подготавливаем контекст клиента
  const customerContext = {
    email: event.user?.email,
    name: event.user?.name,
    cantonAddress: undefined,
    refundAddress: undefined,
    phone: undefined,
    telegram: undefined,
    orderHistory: undefined,
    preferences: undefined
  }

  // Обрабатываем сообщение через AI агента
  const aiResult = await intercomAIAgent.processMessage(event.message.text, customerContext)

  // Если AI агент создал заказ
  if (aiResult.action === 'create_order' && aiResult.orderData) {
    const orderResult = await intercomAIAgent.createOrder(aiResult.orderData)
    
    if (orderResult.success) {
      // Отправляем уведомление операторам
      await telegramMediatorService.forwardClientMessage(
        orderResult.orderId!,
        `Fin AI создал новый заказ: ${orderResult.orderId}`,
        {
          orderId: orderResult.orderId!,
          customerEmail: aiResult.orderData.customerEmail,
          orderAmount: aiResult.orderData.amount,
          orderStatus: 'pending',
          intercomConversationId: event.conversation_id,
          intercomUserId: event.user?.external_id || 'unknown'
        }
      )

      return {
        event_type: 'message',
        conversation_id: event.conversation_id,
        external_conversation_id: event.external_conversation_id,
        message: {
          type: 'text',
          text: aiResult.response
        },
        quick_reply_options: [
          { text: '📋 Проверить статус заказа', value: 'check_order_status' },
          { text: '🛒 Создать еще один заказ', value: 'buy_canton' },
          { text: '👨‍💼 Связаться с поддержкой', value: 'contact_support' }
        ]
      }
    }
  }

  // Если нужно передать живому оператору
  if (aiResult.action === 'transfer_to_human') {
    await intercomAIAgent.transferToHuman(customerContext, 'Fin requested human handoff')
    
    return {
      event_type: 'resolution_state_updated',
      conversation_id: event.conversation_id,
      external_conversation_id: event.external_conversation_id,
      message: {
        type: 'text',
        text: aiResult.response
      },
      resolution_state: 'handoff_to_human'
    }
  }

  // Обычный ответ AI агента
  return {
    event_type: 'message',
    conversation_id: event.conversation_id,
    external_conversation_id: event.external_conversation_id,
    message: {
      type: 'text',
      text: aiResult.response
    },
    quick_reply_options: getQuickReplyOptions(aiResult.response)
  }
}

/**
 * Обработка быстрых ответов
 */
async function handleQuickReply(event: FinEvent): Promise<FinResponse> {
  console.log('⚡ Handling quick reply:', event.metadata)
  
  const quickReplyValue = event.metadata?.quick_reply_value || ''
  
  // Получаем актуальную цену из конфигурации
  const currentPrice = OTC_CONFIG.CANTON_COIN_BUY_PRICE_USD;
  
  switch (quickReplyValue) {
    case 'check_price':
      return {
        event_type: 'message',
        conversation_id: event.conversation_id,
        external_conversation_id: event.external_conversation_id,
        message: {
          type: 'text',
          text: `💰 **Актуальная информация о Canton Coin (CC):**

📈 **Цена:** $${currentPrice.toFixed(2)} за 1 CC
⏰ **Обновлено:** ${new Date().toLocaleString('ru-RU')}
🌐 **Доступные сети:** TRC-20, ERC-20, BEP-20, Solana, Optimism

💡 **Преимущества покупки CC:**
• Доступ к экосистеме Canton Network
• Стабильная цена с потенциалом роста
• Мультисетевая совместимость
• Низкие комиссии за транзакции

Хотите создать заказ на покупку CC? Просто напишите сумму и сеть!`
        },
        quick_reply_options: [
          { text: '🛒 Купить CC', value: 'buy_canton' },
          { text: '🌐 Поддерживаемые сети', value: 'supported_networks' }
        ]
      }
      
    case 'buy_canton':
      return {
        event_type: 'message',
        conversation_id: event.conversation_id,
        external_conversation_id: event.external_conversation_id,
        message: {
          type: 'text',
          text: `🛒 **Как купить Canton Coin (CC):**

**Процесс покупки:**
1️⃣ Укажите сумму покупки (минимум $1, максимум $100,000)
2️⃣ Выберите сеть USDT (TRC-20, ERC-20, BEP-20, Solana, Optimism)
3️⃣ Предоставьте ваш Canton адрес (формат: bron:...)
4️⃣ Укажите email для связи
5️⃣ (Опционально) Резервный адрес для возврата

**Пример заказа:**
"Хочу купить на $100 USDT TRC-20, мой Canton адрес: bron:1220..., email: user@example.com"

**Время обработки:** до 12 часов
**Уведомления:** на email и Telegram

Готов создать заказ? Просто напишите все данные! 🚀`
        },
        quick_reply_options: [
          { text: '💰 Узнать цену', value: 'check_price' },
          { text: '🌐 Поддерживаемые сети', value: 'supported_networks' }
        ]
      }
      
    case 'supported_networks':
      return {
        event_type: 'message',
        conversation_id: event.conversation_id,
        external_conversation_id: event.external_conversation_id,
        message: {
          type: 'text',
          text: `🌐 **Поддерживаемые сети для USDT:**

• **TRC-20 (TRON)** - Рекомендуется (низкие комиссии)
• **ERC-20 (Ethereum)** - Стандартная сеть
• **BEP-20 (BSC)** - Быстрые транзакции
• **Solana** - Очень быстрые и дешевые
• **Optimism** - L2 решение Ethereum

**Минимальная сумма:** $1
**Максимальная сумма:** $100,000

Какую сеть предпочитаете? 🤔`
        },
        quick_reply_options: [
          { text: '🛒 Купить CC', value: 'buy_canton' },
          { text: '💰 Узнать цену', value: 'check_price' }
        ]
      }
      
    case 'contact_support':
      return {
        event_type: 'resolution_state_updated',
        conversation_id: event.conversation_id,
        external_conversation_id: event.external_conversation_id,
        message: {
          type: 'text',
          text: '👨‍💼 Я передаю вас живому оператору для решения вашего вопроса.\n\n⏰ **Время ожидания:** обычно до 5 минут\n📱 **Уведомления:** вы получите уведомление, когда оператор ответит\n\nСпасибо за терпение! Наша команда поддержки поможет вам. 🙏'
        },
        resolution_state: 'handoff_to_human'
      }
      
    default:
      return {
        event_type: 'message',
        conversation_id: event.conversation_id,
        external_conversation_id: event.external_conversation_id,
        message: {
          type: 'text',
          text: 'Извините, я не понял ваш выбор. Пожалуйста, попробуйте еще раз.'
        }
      }
  }
}

/**
 * Получить варианты быстрых ответов на основе контекста
 */
function getQuickReplyOptions(response: string): Array<{ text: string; value: string }> {
  if (response.includes('цена') || response.includes('price')) {
    return [
      { text: '🛒 Купить CC', value: 'buy_canton' },
      { text: '🌐 Поддерживаемые сети', value: 'supported_networks' }
    ]
  }
  
  if (response.includes('купить') || response.includes('buy')) {
    return [
      { text: '💰 Узнать цену', value: 'check_price' },
      { text: '🌐 Поддерживаемые сети', value: 'supported_networks' }
    ]
  }
  
  if (response.includes('сети') || response.includes('networks')) {
    return [
      { text: '🛒 Купить CC', value: 'buy_canton' },
      { text: '💰 Узнать цену', value: 'check_price' }
    ]
  }
  
  // Стандартные опции
  return [
    { text: '💰 Узнать цену', value: 'check_price' },
    { text: '🛒 Купить CC', value: 'buy_canton' },
    { text: '🌐 Поддерживаемые сети', value: 'supported_networks' },
    { text: '👨‍💼 Связаться с поддержкой', value: 'contact_support' }
  ]
}

/**
 * Health check для Fin over API
 */
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'Fin over API Handler',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  })
}
