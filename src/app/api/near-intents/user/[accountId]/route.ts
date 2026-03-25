import { NextRequest, NextResponse } from 'next/server'
import { getNearIntentsSDK } from '@/lib/near-intents-sdk'
import { validateNearAccountIdDetailed } from '@/lib/validators/near-address-validator'

// Принудительно делаем route динамическим
export const dynamic = 'force-dynamic'

/**
 * GET /api/near-intents/user/[accountId]
 * Получает список всех интентов пользователя
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ accountId: string }> }
) {
  const startTime = Date.now()
  
  try {
    const params = await context.params
    const { accountId } = params

    if (!accountId) {
      return NextResponse.json(
        { error: 'Account ID is required', code: 'MISSING_ACCOUNT_ID' },
        { status: 400 }
      )
    }

    // Валидируем формат NEAR account ID через единый валидатор
    const accountValidation = validateNearAccountIdDetailed(accountId)
    if (!accountValidation.valid) {
      return NextResponse.json(
        { error: accountValidation.error || 'Invalid account ID format', code: 'INVALID_ACCOUNT_ID' },
        { status: 400 }
      )
    }

    // Инициализируем NEAR Intents SDK
    const sdk = getNearIntentsSDK()

    // Получаем список интентов пользователя через SDK
    try {
      const intentIds = await sdk.getIntentsByUser(accountId)

      console.log('📋 User intents retrieved via SDK:', {
        accountId,
        count: intentIds.length,
        contractInfo: sdk.getContractInfo(),
        processingTime: Date.now() - startTime
      })

      return NextResponse.json({
        accountId,
        intentIds,
        count: intentIds.length,
        timestamp: Date.now(),
      })
    } catch (sdkError: any) {
      // Если метод не поддерживается контрактом, возвращаем пустой массив
      console.warn('⚠️ Could not fetch user intents from contract:', sdkError.message)
      
      return NextResponse.json({
        accountId,
        intentIds: [],
        count: 0,
        message: 'User intents unavailable, contract method may not be implemented',
      })
    }

  } catch (error: any) {
    console.error('❌ Error getting user intents:', error)
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to get user intents',
        code: 'INTERNAL_ERROR',
        processingTime: Date.now() - startTime
      },
      { status: 500 }
    )
  }
}

