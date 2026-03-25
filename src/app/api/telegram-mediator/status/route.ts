/**
 * 📊 Telegram Mediator Status API
 * Мониторинг состояния разговоров и статистики
 */

import { NextRequest, NextResponse } from 'next/server'
import { telegramMediatorService } from '@/lib/services/telegramMediator'
import { conversationStorageService } from '@/lib/services/conversationStorage'

// Принудительно делаем route динамическим
export const dynamic = 'force-dynamic';

/**
 * GET /api/telegram-mediator/status
 * Получить статус и статистику Telegram Mediator
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const includeConversations = url.searchParams.get('include_conversations') === 'true'
    const cleanup = url.searchParams.get('cleanup') === 'true'

    // Получаем базовую статистику
    const stats = telegramMediatorService.getConversationStats()
    
    // Тестируем соединение с Telegram
    const connectionStatus = await telegramMediatorService.testConnection()
    
    // Получаем активные разговоры если запрошено
    let activeConversations = null
    if (includeConversations) {
      activeConversations = await telegramMediatorService.getActiveConversations()
    }
    
    // Очищаем устаревшие разговоры если запрошено
    let cleanedCount = 0
    if (cleanup) {
      cleanedCount = await telegramMediatorService.cleanupExpiredConversations()
    }

    const response = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      connection: {
        telegram: connectionStatus,
        storage: 'file'
      },
      statistics: stats,
      ...(activeConversations && { activeConversations }),
      ...(cleanup && { cleanedConversations: cleanedCount })
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Failed to get Telegram Mediator status:', error)
    
    return NextResponse.json(
      { 
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/telegram-mediator/status
 * Управление разговорами (очистка, резервное копирование)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'cleanup':
        const cleanedCount = await conversationStorageService.cleanupExpired()
        return NextResponse.json({
          success: true,
          action: 'cleanup',
          cleanedCount,
          timestamp: new Date().toISOString()
        })

      case 'backup':
        const backupPath = await conversationStorageService.createBackup()
        return NextResponse.json({
          success: true,
          action: 'backup',
          backupPath,
          timestamp: new Date().toISOString()
        })

      case 'restore':
        const { backupPath: restorePath } = body
        if (!restorePath) {
          return NextResponse.json(
            { error: 'backupPath is required for restore action' },
            { status: 400 }
          )
        }
        
        const restored = await conversationStorageService.restoreFromBackup(restorePath)
        return NextResponse.json({
          success: restored,
          action: 'restore',
          backupPath: restorePath,
          timestamp: new Date().toISOString()
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: cleanup, backup, restore' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('❌ Failed to execute Telegram Mediator action:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
