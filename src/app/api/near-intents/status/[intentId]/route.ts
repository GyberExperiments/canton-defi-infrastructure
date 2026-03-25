import { NextRequest, NextResponse } from 'next/server'
import { getNearIntentsSDK } from '@/lib/near-intents-sdk'

// Принудительно делаем route динамическим
export const dynamic = 'force-dynamic'

/**
 * GET /api/near-intents/status/[intentId]
 * Получает статус intent по его ID через вызов смарт-контракта
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ intentId: string }> }
) {
  const startTime = Date.now()
  
  try {
    const params = await context.params
    const { intentId } = params

    if (!intentId) {
      return NextResponse.json(
        { error: 'Intent ID is required', code: 'MISSING_INTENT_ID' },
        { status: 400 }
      )
    }

    // Инициализируем NEAR Intents SDK
    const sdk = getNearIntentsSDK()

    // Получаем статус через SDK
    try {
      const statusData = await sdk.getIntentStatus(intentId)

      console.log('📊 Intent status retrieved via SDK:', {
        intentId,
        status: statusData.status,
        contractInfo: sdk.getContractInfo(),
        processingTime: Date.now() - startTime
      })

      return NextResponse.json({
        status: statusData.status,
        transactionHash: statusData.transactionHash || null,
        filledAt: statusData.filledAt || null,
        expiryAt: statusData.expiryAt || null,
        solver: statusData.solver || null,
      })
    } catch (viewError: any) {
      // Если intent не найден или контракт недоступен, возвращаем pending
      console.warn('⚠️ Could not fetch intent status from contract:', viewError.message)
      
      return NextResponse.json({
        status: 'pending' as const,
        transactionHash: null,
        message: 'Intent status unavailable, may be pending or expired',
      })
    }

  } catch (error: any) {
    console.error('❌ Error getting intent status:', error)
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to get intent status',
        code: 'INTERNAL_ERROR',
        processingTime: Date.now() - startTime
      },
      { status: 500 }
    )
  }
}

