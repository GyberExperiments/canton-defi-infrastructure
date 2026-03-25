/**
 * 🔍 Admin API for Unique Address Management
 * Мониторинг и управление уникальными адресами
 */

import { NextRequest, NextResponse } from 'next/server'

// Принудительно делаем route динамическим
export const dynamic = 'force-dynamic';
// MINIMAL VERSION: addressGeneratorService not needed
import { antiSpamService } from '@/lib/services/antiSpamService'

export async function GET(request: NextRequest) {
  try {
    // Simple admin authentication
    const adminKey = request.headers.get('x-admin-key')
    if (adminKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    // MINIMAL VERSION: No address generation needed
    const spamStats = antiSpamService.getStatistics()

    return NextResponse.json({
      success: true,
      statistics: {
        addresses: {
          totalGenerated: 0,
          activeAddresses: 0,
          expiredAddresses: 0,
          averageLifetime: 0,
          generationRate: 0
        },
        spam: spamStats
      },
      activeAddresses: []
    })

  } catch (error) {
    console.error('❌ Failed to get address statistics:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to get address statistics',
        code: 'ADDRESS_STATS_FAILED'
      }, 
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Simple admin authentication
    const adminKey = request.headers.get('x-admin-key')
    if (adminKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    const { action, address, ip, email } = await request.json()

    switch (action) {
      case 'deactivate_address':
        // MINIMAL VERSION: No address generation needed
        return NextResponse.json({
          success: false,
          message: 'Address generation not available in minimal version'
        })

      case 'unblock':
        if (!ip && !email && !address) {
          return NextResponse.json(
            { error: 'At least one identifier is required', code: 'MISSING_IDENTIFIER' },
            { status: 400 }
          )
        }
        
        const unblocked = antiSpamService.unblock(ip, email, address)
        return NextResponse.json({
          success: unblocked,
          message: unblocked ? 'Blocking removed' : 'No blocking found'
        })

      case 'get_private_key':
        // MINIMAL VERSION: No address generation needed
        return NextResponse.json({
          success: false,
          message: 'Private key access not available in minimal version'
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action', code: 'INVALID_ACTION' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('❌ Failed to process admin action:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to process admin action',
        code: 'ADMIN_ACTION_FAILED'
      }, 
      { status: 500 }
    )
  }
}
