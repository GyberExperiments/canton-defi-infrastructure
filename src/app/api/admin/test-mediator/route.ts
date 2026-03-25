/**
 * 🧪 Test Telegram Mediator Bot
 * Endpoint для тестирования бота-медиатора
 */

import { NextRequest, NextResponse } from 'next/server'
import { telegramMediatorService } from '@/lib/services/telegramMediator'

// Принудительно делаем route динамическим
export const dynamic = 'force-dynamic';

/**
 * Test mediator bot functionality
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const adminKey = searchParams.get('adminKey')

    // Simple admin authentication
    if (adminKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    // Test bot connection
    const connectionTest = await telegramMediatorService.testConnection()
    
    // Get conversation stats
    const stats = telegramMediatorService.getConversationStats()

    // Test message to operator (if configured)
    let testMessageSent = false
    if (connectionTest) {
      try {
        // Send test message to operator
        await telegramMediatorService.forwardClientMessage(
          'TEST-ORDER-123',
          '🧪 This is a test message from the Canton OTC Mediator Bot. If you see this, the bot is working correctly!',
          {
            orderId: 'TEST-ORDER-123',
            customerEmail: 'test@cantonotc.com',
            intercomConversationId: 'test-conversation-123',
            orderAmount: 1000,
            orderStatus: 'testing',
            cantonAddress: '0x123...test',
            refundAddress: '0x456...test'
            // createdAt, updatedAt, lastActivity будут добавлены автоматически в conversationStorageService.saveContext()
          }
        )
        testMessageSent = true
      } catch (error) {
        console.error('❌ Test message failed:', error)
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      tests: {
        connection: connectionTest,
        testMessageSent,
        conversationStats: stats
      },
      configuration: {
        botTokenConfigured: !!process.env.TELEGRAM_MEDIATOR_BOT_TOKEN,
        chatIdConfigured: !!process.env.TELEGRAM_MEDIATOR_CHAT_ID,
        webhookSecretConfigured: !!process.env.TELEGRAM_MEDIATOR_WEBHOOK_SECRET
      }
    })

  } catch (error) {
    console.error('❌ Mediator test failed:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Mediator test failed',
        code: 'MEDIATOR_TEST_FAILED'
      }, 
      { status: 500 }
    )
  }
}
