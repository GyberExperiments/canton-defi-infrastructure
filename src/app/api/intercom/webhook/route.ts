/**
 * 🔗 Intercom Webhook Handler
 * Handles incoming messages from Intercom and forwards to operator group
 * Implements security verification and rate limiting
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { telegramService } from '@/lib/services/telegram'
import { telegramMediatorService } from '@/lib/services/telegramMediator'
import { googleSheetsService } from '@/lib/services/googleSheets'
import { intercomMonitoringService } from '@/lib/services/intercomMonitoring'
import { intercomAIAgent } from '@/lib/services/intercomAIAgent'
import { redisRateLimiter } from '@/lib/services/redisRateLimiter'

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  points: 10,        // 10 requests
  duration: 60,      // per minute
  blockDuration: 300 // block for 5 minutes if exceeded
}

interface IntercomWebhookPayload {
  type: string
  data: {
    item: {
      type: string
      id: string
      created_at: number
      updated_at: number
      source: {
        type: string
        id: string
      }
      contacts: {
        type: string
        contacts: Array<{
          type: string
          id: string
        }>
      }
      conversation_parts: {
        type: string
        conversation_parts: Array<{
          type: string
          id: string
          part_type: string
          body: string
          created_at: number
          author: {
            type: string
            id: string
          }
        }>
      }
      custom_attributes?: {
        order_id?: string
        order_type?: string
        order_status?: string
        order_amount?: number
      }
    }
  }
}

/**
 * Check rate limit for IP address using Redis
 */
async function checkRateLimit(ip: string): Promise<boolean> {
  try {
    const result = await redisRateLimiter.checkRateLimit(`webhook:${ip}`, RATE_LIMIT_CONFIG)
    return result.success
  } catch (error) {
    console.error('❌ Rate limit check failed:', error)
    // Allow request if rate limiting fails (fail open)
    return true
  }
}

/**
 * Mask PII data for logging - Enhanced version
 */
function maskPII(data: unknown): unknown {
  if (typeof data === 'string') {
    // Mask email addresses
    let masked = data.replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '$1***@$2')
    
    // Mask phone numbers (various formats)
    masked = masked.replace(/(\+?[1-9]\d{1,14})/g, '***-***-****')
    
    // Mask credit card numbers
    masked = masked.replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '****-****-****-****')
    
    // Mask addresses (basic pattern)
    masked = masked.replace(/\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr)\b/gi, '*** *** Street')
    
    return masked
  }
  
  if (typeof data === 'object' && data !== null) {
    const masked: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase()
      if (lowerKey.includes('email') || lowerKey.includes('phone') || 
          lowerKey.includes('address') || lowerKey.includes('name') ||
          lowerKey.includes('ssn') || lowerKey.includes('passport') ||
          lowerKey.includes('credit') || lowerKey.includes('card')) {
        masked[key] = typeof value === 'string' ? value.replace(/(.{2}).*(.{2})/, '$1***$2') : '***'
      } else {
        masked[key] = maskPII(value)
      }
    }
    return masked
  }
  
  return data
}

/**
 * Verify Intercom webhook signature
 */
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex')
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    )
  } catch (error) {
    console.error('❌ Webhook signature verification failed:', error)
    intercomMonitoringService.trackError('Webhook signature verification failed', { error: error instanceof Error ? error.message : 'Unknown error' })
    return false
  }
}

/**
 * Extract order context from conversation
 */
function extractOrderContext(conversation: Record<string, unknown>): {
  orderId?: string
  orderAmount?: number
  orderStatus?: string
  customerEmail?: string
} {
  const customAttrs = (conversation.custom_attributes as Record<string, unknown>) || {}
  
  return {
    orderId: customAttrs.order_id as string | undefined,
    orderAmount: customAttrs.order_amount as number | undefined,
    orderStatus: customAttrs.order_status as string | undefined,
    customerEmail: (conversation.contacts as { contacts?: Array<{ id?: string }> })?.contacts?.[0]?.id
  }
}

/**
 * Format message for operator group
 */
function formatOperatorMessage(
  message: string,
  context: ReturnType<typeof extractOrderContext>,
  timestamp: number
): string {
  const timeStr = new Date(timestamp * 1000).toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  let formattedMessage = `💬 **НОВОЕ СООБЩЕНИЕ ОТ КЛИЕНТА**\n\n`
  formattedMessage += `📅 **Время:** ${timeStr} (МСК)\n`
  
  if (context.orderId) {
    formattedMessage += `📋 **Order ID:** \`${context.orderId}\`\n`
  }
  
  if (context.orderAmount) {
    formattedMessage += `💰 **Сумма заказа:** $${context.orderAmount} USDT\n`
  }
  
  if (context.orderStatus) {
    formattedMessage += `🎯 **Статус:** ${context.orderStatus}\n`
  }
  
  if (context.customerEmail) {
    formattedMessage += `📧 **Email:** ${context.customerEmail}\n`
  }
  
  formattedMessage += `\n💬 **Сообщение:**\n${message}\n\n`
  formattedMessage += `🔗 **Ссылка в админку:**\nhttps://stage.minimal.build.infra.1otc.cc/admin/orders`

  return formattedMessage
}

/**
 * Handle incoming Intercom webhook
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Get client IP for rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown'
    
    // Check rate limit
    if (!(await checkRateLimit(clientIP))) {
      console.warn('⚠️ Intercom webhook: Rate limit exceeded for IP:', clientIP)
      intercomMonitoringService.trackError('Rate limit exceeded', { ip: clientIP })
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      )
    }

    const payload = await request.text()
    const signature = request.headers.get('x-hub-signature-256')
    const webhookSecret = process.env.INTERCOM_WEBHOOK_SECRET

    // Verify webhook signature
    if (!webhookSecret || !signature) {
      console.warn('⚠️ Intercom webhook: Missing secret or signature')
      intercomMonitoringService.trackError('Missing webhook secret or signature', { ip: clientIP })
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (signature && webhookSecret && !verifyWebhookSignature(payload, signature.replace('sha256=', ''), webhookSecret)) {
      console.warn('⚠️ Intercom webhook: Invalid signature')
      intercomMonitoringService.trackError('Invalid webhook signature', { ip: clientIP })
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const data: IntercomWebhookPayload = JSON.parse(payload)
    
    // Log webhook event (with PII masking)
    console.log('📨 Intercom webhook received:', maskPII({
      type: data.type,
      timestamp: new Date().toISOString(),
      ip: clientIP
    }))
    
    // Only process conversation messages
    if (data.type !== 'conversation.user.created' && 
        data.type !== 'conversation.user.replied') {
      console.log('ℹ️ Intercom webhook: Ignoring event type:', data.type)
      return NextResponse.json({ success: true })
    }

    const conversation = data.data.item
    const latestMessage = conversation.conversation_parts?.conversation_parts?.[0]
    
    if (!latestMessage || latestMessage.part_type !== 'comment') {
      console.log('ℹ️ Intercom webhook: No user message found')
      return NextResponse.json({ success: true })
    }

    // Extract order context
    const context = extractOrderContext(conversation)
    
    // Try to process message with AI agent first
    try {
      const customerContext = {
        email: context.customerEmail,
        name: (conversation.contacts?.contacts?.[0] as { name?: string })?.name || 'Unknown',
        cantonAddress: undefined, // TODO: Extract from conversation
        refundAddress: undefined, // TODO: Extract from conversation
        phone: undefined, // TODO: Extract from conversation
        telegram: undefined, // TODO: Extract from conversation
        orderHistory: undefined, // TODO: Extract from conversation
        preferences: undefined // TODO: Extract from conversation
      }
      
      const aiResult = await intercomAIAgent.processMessage(latestMessage.body, customerContext)
      
      // If AI agent can handle the message, send response back to Intercom
      if (aiResult.response && !aiResult.action) {
        // Send AI response back to customer via Intercom
        await sendIntercomReply(conversation.id, aiResult.response)
        
        // Log AI agent response
        intercomMonitoringService.trackError('ai_agent_auto_response', {
          conversationId: conversation.id,
          responseLength: aiResult.response.length
        })
        
        return NextResponse.json({ success: true, handled_by_ai: true })
      }
      
      // If AI agent created an order, handle it
      if (aiResult.action === 'create_order' && aiResult.orderData) {
        const orderResult = await intercomAIAgent.createOrder(aiResult.orderData)
        
        if (orderResult.success) {
          // Send confirmation to customer
          await sendIntercomReply(conversation.id, aiResult.response)
          
          // Notify operators about new order
          const operatorMessage = `🤖 **AI Agent создал новый заказ!**

📋 **Детали заказа:**
• 🆔 ID: ${orderResult.orderId}
• 💰 Сумма: $${aiResult.orderData.amount} USDT (${aiResult.orderData.network})
• 📧 Email: ${aiResult.orderData.customerEmail}
• 🏠 Canton адрес: ${aiResult.orderData.cantonAddress}
${aiResult.orderData.refundAddress ? `• 🔄 Резервный адрес: ${aiResult.orderData.refundAddress}` : ''}

⏰ **Создан:** ${new Date().toLocaleString('ru-RU')}
🤖 **Источник:** AI Agent (автоматически)

🔗 **Ссылка в админку:** https://stage.minimal.build.infra.1otc.cc/admin/orders`
          
          const mediatorContext = {
            orderId: orderResult.orderId || 'unknown',
            customerEmail: aiResult.orderData.customerEmail,
            orderAmount: aiResult.orderData.amount,
            orderStatus: 'pending',
            intercomConversationId: conversation.id,
            intercomUserId: conversation.contacts?.contacts?.[0]?.id
          };

          console.log('🔍 Forwarding to mediator with context:', mediatorContext);
          
          await telegramMediatorService.forwardClientMessage(
            orderResult.orderId || 'unknown',
            operatorMessage,
            mediatorContext
          )
          
          return NextResponse.json({ 
            success: true, 
            handled_by_ai: true, 
            order_created: true,
            orderId: orderResult.orderId 
          })
        }
      }
      
      // If AI agent wants to transfer to human, continue with normal flow
      if (aiResult.action === 'transfer_to_human') {
        await intercomAIAgent.transferToHuman(customerContext, 'AI agent requested human handoff')
      }
      
    } catch (aiError) {
      console.error('❌ AI Agent processing failed:', aiError)
      // Continue with normal operator flow if AI fails
    }
    
    // Format message for operators (fallback or when AI can't handle)
    const operatorMessage = formatOperatorMessage(
      latestMessage.body,
      context,
      latestMessage.created_at
    )

    // Send to Telegram mediator bot for operator communication
    try {
      const mediatorContext = {
        orderId: context.orderId || 'unknown',
        customerEmail: context.customerEmail || 'unknown@example.com',
        intercomConversationId: conversation.id,
        intercomUserId: conversation.contacts?.contacts?.[0]?.id,
        orderAmount: context.orderAmount,
        orderStatus: context.orderStatus,
        cantonAddress: (conversation.custom_attributes as Record<string, unknown>)?.canton_address as string | undefined,
        refundAddress: (conversation.custom_attributes as Record<string, unknown>)?.refund_address as string | undefined
      }

      console.log('🔍 Forwarding regular message to mediator with context:', mediatorContext);

      await telegramMediatorService.forwardClientMessage(
        mediatorContext.orderId,
        latestMessage.body,
        mediatorContext
      )
      
      console.log('✅ Intercom message forwarded to mediator bot:', context.orderId)
      intercomMonitoringService.trackMessageSent(context.orderId)
    } catch (mediatorError) {
      console.error('❌ Failed to forward message to mediator bot:', mediatorError)
      
      // Fallback to original Telegram notification
      try {
        await telegramService.sendCustomMessage(operatorMessage)
        console.log('✅ Fallback: Message sent to original Telegram bot')
      } catch (telegramError) {
        console.error('❌ Fallback also failed:', telegramError)
      }
      
      intercomMonitoringService.trackError('Failed to forward to mediator bot', { 
        error: mediatorError instanceof Error ? mediatorError.message : 'Unknown error',
        orderId: context.orderId 
      })
    }

    // Log to Google Sheets if order context exists
    if (context.orderId) {
      try {
        await googleSheetsService.addOrderNote(
          context.orderId,
          `Intercom message: ${latestMessage.body.substring(0, 100)}...`
        )
        console.log('✅ Intercom message logged to Google Sheets:', context.orderId)
      } catch (sheetsError) {
        console.error('❌ Failed to log message to Google Sheets:', sheetsError)
        intercomMonitoringService.trackError('Failed to log to Google Sheets', { 
          error: sheetsError instanceof Error ? sheetsError.message : 'Unknown error',
          orderId: context.orderId 
        })
        // Don't fail the webhook if Sheets fails
      }
    }

    // Track response time
    const responseTime = Date.now() - startTime
    intercomMonitoringService.updateResponseTime(responseTime)

    return NextResponse.json({ 
      success: true,
      message: 'Webhook processed successfully',
      orderId: context.orderId,
      responseTime
    })

  } catch (error) {
    console.error('❌ Intercom webhook error:', error)
    intercomMonitoringService.trackError('Webhook processing failed', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: request.headers.get('x-forwarded-for') || 'unknown'
    })
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Webhook processing failed',
        code: 'INTERCOM_WEBHOOK_ERROR'
      },
      { status: 500 }
    )
  }
}

/**
 * Send reply back to Intercom conversation
 */
async function sendIntercomReply(conversationId: string, message: string): Promise<void> {
  try {
    const intercomAccessToken = process.env.INTERCOM_ACCESS_TOKEN
    const intercomAdminId = process.env.INTERCOM_ADMIN_ID
    
    if (!intercomAccessToken || !intercomAdminId) {
      console.warn('⚠️ Intercom credentials not configured for replies')
      return
    }
    
    const response = await fetch(`https://api.intercom.io/conversations/${conversationId}/parts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${intercomAccessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        message_type: 'note',
        type: 'admin',
        admin_id: intercomAdminId,
        body: message
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Failed to send Intercom reply:', response.status, errorText)
      return
    }
    
    console.log('✅ Intercom reply sent successfully')
  } catch (error) {
    console.error('❌ Error sending Intercom reply:', error)
  }
}

/**
 * Health check for webhook endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    endpoint: 'intercom-webhook',
    timestamp: new Date().toISOString(),
    features: [
      'signature_verification',
      'telegram_forwarding',
      'google_sheets_logging',
      'order_context_extraction',
      'ai_agent_integration',
      'intercom_reply_support'
    ]
  })
}
