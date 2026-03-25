import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

/**
 * API endpoint для автоматической отправки сообщения о заказе в Intercom
 * 
 * Создаёт conversation и отправляет сообщение от имени пользователя,
 * позволяя Fin AI отвечать пока оператор не подключится
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { order_id, email, order_data } = body

    // Валидация обязательных полей
    if (!order_id || !email) {
      return NextResponse.json(
        { error: 'order_id and email are required' },
        { status: 400 }
      )
    }

    // Получаем конфигурацию Intercom
    const intercomAppId = process.env.NEXT_PUBLIC_INTERCOM_APP_ID
    const intercomAccessToken = process.env.INTERCOM_ACCESS_TOKEN || process.env.INTERCOM_API_KEY
    
    if (!intercomAppId || !intercomAccessToken) {
      console.warn('⚠️ Intercom not configured, skipping message send')
      return NextResponse.json({
        success: false,
        reason: 'intercom_not_configured',
        message: 'Intercom is not configured. Please use fallback support.',
        details: {
          hasAppId: !!intercomAppId,
          hasAccessToken: !!intercomAccessToken
        }
      }, { status: 200 }) // Возвращаем 200 вместо ошибки, так как это не критично
    }

    // Форматируем сообщение с данными заказа
    const orderMessage = formatOrderMessage(order_id, order_data)

    // Создаём/обновляем пользователя в Intercom
    console.log('📤 Creating/updating Intercom user:', email)
    
    const userPayload = {
      user_id: email,
      email: email,
      name: email.split('@')[0],
      custom_attributes: {
        last_order_id: order_id,
        last_order_amount: order_data?.amount || 0,
        last_order_status: 'awaiting-deposit',
        canton_address: order_data?.canton_address || '',
        payment_token: order_data?.payment_token || 'USDT',
        last_activity: new Date().toISOString(),
      }
    }

    // Создаём пользователя через Intercom API
    const userResponse = await axios.post(
      'https://api.intercom.io/contacts',
      userPayload,
      {
        headers: {
          'Authorization': `Bearer ${intercomAccessToken}`,
          'Content-Type': 'application/json',
          'Intercom-Version': '2.11'
        }
      }
    )

    const userId = userResponse.data.id
    console.log('✅ Intercom user created/updated:', userId)

    // Отправляем сообщение от имени пользователя
    // Это создаст conversation и Fin AI сможет ответить
    console.log('📨 Sending order message to Intercom...')
    
    const messagePayload = {
      from: {
        type: 'user',
        id: userId
      },
      body: orderMessage
    }

    const messageResponse = await axios.post(
      'https://api.intercom.io/messages',
      messagePayload,
      {
        headers: {
          'Authorization': `Bearer ${intercomAccessToken}`,
          'Content-Type': 'application/json',
          'Intercom-Version': '2.11'
        }
      }
    )

    const conversationId = messageResponse.data.conversation_id

    console.log('✅ Message sent to Intercom:', {
      userId,
      conversationId,
      orderId: order_id
    })

    return NextResponse.json({
      success: true,
      conversation_id: conversationId,
      user_id: userId,
      message: 'Order message sent successfully. Fin AI or team will respond soon.'
    })

  } catch (error) {
    console.error('❌ Error sending order message to Intercom:', error)
    
    // Детальное логирование ошибки
    if (axios.isAxiosError(error)) {
      const errorDetails = {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers ? { Authorization: '***HIDDEN***' } : undefined
      }
      console.error('Intercom API error details:', errorDetails)
      
      // Возвращаем более информативную ошибку
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to send order message to Intercom',
          details: `Request failed with status code ${error.response?.status}`,
          intercom_error: error.response?.data,
          fallback: 'Message will be shown in Intercom widget directly'
        },
        { status: error.response?.status === 401 || error.response?.status === 403 ? 200 : 500 }
        // Возвращаем 200 для auth ошибок, чтобы не блокировать создание заказа
      )
    }

    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to send order message',
        details: error instanceof Error ? error.message : 'Unknown error',
        fallback: 'Please contact support directly via Intercom widget'
      },
      { status: 200 } // Возвращаем 200 чтобы не блокировать создание заказа
    )
  }
}

/**
 * Форматирование сообщения о заказе для отправки в Intercom
 */
function formatOrderMessage(orderId: string, orderData: {
  amount?: number
  canton_amount?: number
  payment_token?: string
  payment_network?: string
  canton_address?: string
  exchange_direction?: 'buy' | 'sell'
}): string {
  const amount = orderData?.amount || 0
  const cantonAmount = orderData?.canton_amount || 0
  const paymentToken = orderData?.payment_token || 'USDT'
  const paymentNetwork = orderData?.payment_network || 'Ethereum'
  const cantonAddress = orderData?.canton_address || 'Not provided'
  const direction = orderData?.exchange_direction || 'buy'
  const isBuying = direction === 'buy'

  // Форматируем сообщение в зависимости от направления
  if (isBuying) {
    return `👋 Hello! I need help with my order #${orderId}

📋 Order Details:
• Order ID: ${orderId}
• **Type: BUYING Canton Coin** 🛒
• Paying: ${amount.toFixed(2)} ${paymentToken}
• Receiving: ${cantonAmount.toFixed(2)} Canton Coin
• Payment Network: ${paymentNetwork}
• Canton Address: ${cantonAddress}

Please provide payment instructions for this order. Thanks!`
  } else {
    return `👋 Hello! I need help with my order #${orderId}

📋 Order Details:
• Order ID: ${orderId}
• **Type: SELLING Canton Coin** 💰
• Selling: ${cantonAmount.toFixed(2)} Canton Coin
• Receiving: ${amount.toFixed(2)} ${paymentToken}
• Payment Network: ${paymentNetwork}
• Canton Address: ${cantonAddress}

Please provide payment instructions for this order. Thanks!`
  }
}

/**
 * Health check endpoint
 */
export async function GET() {
  const isConfigured = !!(
    process.env.NEXT_PUBLIC_INTERCOM_APP_ID && 
    process.env.INTERCOM_ACCESS_TOKEN
  )
  
  return NextResponse.json({
    service: 'Intercom Order Message Sender',
    configured: isConfigured,
    status: isConfigured ? 'ready' : 'missing_configuration',
  })
}

