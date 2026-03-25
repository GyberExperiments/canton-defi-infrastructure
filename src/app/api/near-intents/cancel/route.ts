import { NextRequest, NextResponse } from 'next/server'
import { getNearIntentsSDK } from '@/lib/near-intents-sdk'
import { validateNearAccountIdDetailed } from '@/lib/validators/near-address-validator'

export const dynamic = 'force-dynamic'

/**
 * POST /api/near-intents/cancel
 * Prepares a transaction to cancel an active intent
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { intentId, userAccount } = body

    if (!intentId) {
      return NextResponse.json(
        { error: 'Intent ID is required', code: 'MISSING_INTENT_ID' },
        { status: 400 }
      )
    }

    if (!userAccount) {
      return NextResponse.json(
        { error: 'User account is required', code: 'MISSING_ACCOUNT' },
        { status: 400 }
      )
    }

    // Validate account ID format
    const accountValidation = validateNearAccountIdDetailed(userAccount)
    if (!accountValidation.valid) {
      return NextResponse.json(
        { error: accountValidation.error || 'Invalid account ID format', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    const sdk = getNearIntentsSDK()
    
    // Check if intent exists and belongs to user (optional, but good for validation)
    // For now we trust the client request to save RPC calls, contract will fail if invalid
    
    const transactionData = sdk.prepareCancelIntentTransaction(intentId, userAccount)

    return NextResponse.json({
      success: true,
      intentId,
      transactionData,
      message: 'Cancel transaction prepared',
    })

  } catch (error: any) {
    console.error('❌ Error preparing cancel intent:', error)
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to prepare cancel transaction',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}
