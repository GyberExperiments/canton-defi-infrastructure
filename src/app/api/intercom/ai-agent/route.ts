/**
 * 🤖 Intercom AI Agent API
 * Обработка сообщений AI агента 1OTC
 */

import { NextRequest, NextResponse } from 'next/server'
import { intercomAIAgent } from '@/lib/services/intercomAIAgent'
import { intercomMonitoringService } from '@/lib/services/intercomMonitoring'
import type { NetworkType } from '@/config/otc'

interface AIAgentRequest {
  message: string
  customerContext: {
    email?: string
    name?: string
    cantonAddress?: string
    refundAddress?: string
    phone?: string
    telegram?: string
    orderHistory?: Array<{
      orderId: string
      amount: number
      status: string
      createdAt: string
    }>
    preferences?: {
      preferredNetwork: NetworkType
      communicationMethod: 'email' | 'telegram' | 'whatsapp'
    }
  }
  conversationId?: string
  userId?: string
}

interface AIAgentResponse {
  success: boolean
  response: string
  action?: 'create_order' | 'transfer_to_human' | 'get_info'
  orderData?: {
    amount: number
    network: NetworkType
    cantonAddress: string
    refundAddress?: string
    customerEmail: string
    customerName?: string
    phone?: string
    telegram?: string
  }
  orderId?: string
  error?: string
}

/**
 * Обработка сообщения AI агента
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const body: AIAgentRequest = await request.json()
    const { message, customerContext, conversationId, userId } = body

    // Валидация входных данных
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Message is required and must be a string',
          response: 'Извините, я не понял ваше сообщение. Пожалуйста, попробуйте еще раз.'
        } as AIAgentResponse,
        { status: 400 }
      )
    }

    // Логируем входящее сообщение
    intercomMonitoringService.trackError('ai_agent_message_received', {
      messageLength: message.length,
      hasCustomerContext: !!customerContext.email,
      conversationId,
      userId
    })

    // Обрабатываем сообщение через AI агента
    const result = await intercomAIAgent.processMessage(message, customerContext)

    // Если нужно создать заказ
    if (result.action === 'create_order' && result.orderData) {
      const orderResult = await intercomAIAgent.createOrder(result.orderData)
      
      if (orderResult.success) {
        return NextResponse.json({
          success: true,
          response: result.response,
          action: 'create_order',
          orderData: result.orderData,
          orderId: orderResult.orderId
        } as AIAgentResponse)
      } else {
        return NextResponse.json({
          success: false,
          response: 'Произошла ошибка при создании заказа. Я передам вас живому оператору.',
          action: 'transfer_to_human',
          error: orderResult.error
        } as AIAgentResponse)
      }
    }

    // Если нужно передать живому оператору
    if (result.action === 'transfer_to_human') {
      await intercomAIAgent.transferToHuman(customerContext, 'AI agent requested human handoff')
    }

    // Логируем ответ
    intercomMonitoringService.trackError('ai_agent_response_sent', {
      responseLength: result.response.length,
      action: result.action,
      processingTime: Date.now() - startTime
    })

    return NextResponse.json({
      success: true,
      response: result.response,
      action: result.action
    } as AIAgentResponse)

  } catch (error) {
    console.error('❌ AI Agent API error:', error)
    
    // Логируем ошибку
    intercomMonitoringService.trackError('AI Agent API error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    })

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error',
        response: 'Извините, произошла техническая ошибка. Я передам вас живому оператору для решения вашего вопроса.'
      } as AIAgentResponse,
      { status: 500 }
    )
  }
}

/**
 * Получение информации о AI агенте
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'status':
        return NextResponse.json({
          success: true,
          agent: {
            name: '1OTC AI Assistant',
            version: '1.0.0',
            capabilities: [
              'buy_canton',
              'check_price',
              'order_status',
              'create_order',
              'transfer_to_human'
            ],
            status: 'active',
            lastUpdated: new Date().toISOString()
          }
        })

      case 'metrics':
        const metrics = intercomMonitoringService.getMetrics()
        return NextResponse.json({
          success: true,
          metrics: {
            ...metrics,
            aiAgent: {
              messagesProcessed: 0, // TODO: Implement proper event tracking
              ordersCreated: 0,
              humanHandoffs: 0
            }
          }
        })

      default:
        return NextResponse.json({
          success: true,
          message: '1OTC AI Agent API is running',
          endpoints: {
            'POST /api/intercom/ai-agent': 'Process AI agent message',
            'GET /api/intercom/ai-agent?action=status': 'Get agent status',
            'GET /api/intercom/ai-agent?action=metrics': 'Get agent metrics'
          }
        })
    }
  } catch (error) {
    console.error('❌ AI Agent GET error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
