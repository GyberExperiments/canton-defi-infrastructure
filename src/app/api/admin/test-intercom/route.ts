/**
 * 🧪 Intercom Test API
 * Test Intercom integration and send test notifications
 */

import { NextRequest, NextResponse } from 'next/server'
import { intercomService } from '@/lib/services/intercom'

// Принудительно делаем route динамическим
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { adminKey, testType } = await request.json()

    // Simple admin authentication
    if (adminKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    const result: Record<string, unknown> = {}

    switch (testType) {
      case 'connection':
        // Test Intercom connection
        result.connection = await intercomService.testConnection()
        break

      case 'test-message':
        // Send test message
        result.testMessage = await intercomService.sendTestMessage()
        break

      case 'test-order':
        // Send test order notification
        const testOrder = {
          orderId: 'TEST-' + Date.now(),
          email: 'test@canton-otc.com',
          cantonAddress: 'TEST_CANTON_ADDRESS_123456789',
          refundAddress: 'TEST_REFUND_ADDRESS_987654321',
          cantonAmount: 1000,
          usdtAmount: 200,
          paymentAmountUSD: 200,
          paymentAmount: 200,
          paymentToken: {
            symbol: 'USDT' as const,
            name: 'Tether USD',
            network: 'TRON' as const,
            networkName: 'TRON (TRC-20)',
            icon: '💎',
            color: '#26a17b',
            priceUSD: 1,
            minAmount: 1,
            maxAmount: 100000,
            decimals: 6,
            receivingAddress: 'TEST_ADDRESS',
            contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
          },
          status: 'awaiting-deposit' as const,
          timestamp: Date.now(),
          whatsapp: '+1234567890',
          telegram: '@testuser'
        }
        result.orderNotification = await intercomService.sendOrderNotification(testOrder)
        break

      case 'test-status-update':
        // Send test status update
        const testOrderForUpdate = {
          orderId: 'TEST-' + Date.now(),
          email: 'test@canton-otc.com',
          cantonAddress: 'TEST_CANTON_ADDRESS_123456789',
          refundAddress: 'TEST_REFUND_ADDRESS_987654321',
          cantonAmount: 1000,
          usdtAmount: 200,
          paymentAmountUSD: 200,
          paymentAmount: 200,
          paymentToken: {
            symbol: 'USDT' as const,
            name: 'Tether USD',
            network: 'TRON' as const,
            networkName: 'TRON (TRC-20)',
            icon: '💎',
            color: '#26a17b',
            priceUSD: 1,
            minAmount: 1,
            maxAmount: 100000,
            decimals: 6,
            receivingAddress: 'TEST_ADDRESS',
            contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
          },
          status: 'completed' as const,
          timestamp: Date.now(),
          whatsapp: '+1234567890',
          telegram: '@testuser'
        }
        result.statusUpdate = await intercomService.sendStatusUpdate(
          testOrderForUpdate, 
          'completed', 
          'Test transaction completed successfully'
        )
        break

      case 'full-test':
        // Run all tests
        result.connection = await intercomService.testConnection()
        result.testMessage = await intercomService.sendTestMessage()
        
        const fullTestOrder = {
          orderId: 'FULL-TEST-' + Date.now(),
          email: 'fulltest@canton-otc.com',
          cantonAddress: 'FULL_TEST_CANTON_ADDRESS_123456789',
          refundAddress: 'FULL_TEST_REFUND_ADDRESS_987654321',
          cantonAmount: 2000,
          usdtAmount: 400,
          paymentAmountUSD: 400,
          paymentAmount: 400,
          paymentToken: {
            symbol: 'USDT' as const,
            name: 'Tether USD',
            network: 'TRON' as const,
            networkName: 'TRON (TRC-20)',
            icon: '💎',
            color: '#26a17b',
            priceUSD: 1,
            minAmount: 1,
            maxAmount: 100000,
            decimals: 6,
            receivingAddress: 'TEST_ADDRESS',
            contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
          },
          status: 'awaiting-deposit' as const,
          timestamp: Date.now(),
          whatsapp: '+1234567890',
          telegram: '@fulltestuser'
        }
        result.orderNotification = await intercomService.sendOrderNotification(fullTestOrder)
        result.statusUpdate = await intercomService.sendStatusUpdate(
          fullTestOrder, 
          'completed', 
          'Full test completed successfully'
        )
        break

      default:
        return NextResponse.json(
          { error: 'Invalid test type', code: 'INVALID_TEST_TYPE' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      testType,
      results: result,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Intercom test failed:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Intercom test failed',
        code: 'INTERCOM_TEST_FAILED'
      }, 
      { status: 500 }
    )
  }
}

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

    // Test Intercom connection
    const connectionResult = await intercomService.testConnection()

    return NextResponse.json({
      success: true,
      intercom: {
        configured: !!(process.env.NEXT_PUBLIC_INTERCOM_APP_ID && process.env.INTERCOM_ACCESS_TOKEN && process.env.INTERCOM_ADMIN_ID),
        connection: connectionResult,
        appId: process.env.NEXT_PUBLIC_INTERCOM_APP_ID ? '***' + process.env.NEXT_PUBLIC_INTERCOM_APP_ID.slice(-4) : 'Not set',
        hasAccessToken: !!process.env.INTERCOM_ACCESS_TOKEN,
        hasAdminId: !!process.env.INTERCOM_ADMIN_ID
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Intercom status check failed:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Intercom status check failed',
        code: 'INTERCOM_STATUS_FAILED'
      }, 
      { status: 500 }
    )
  }
}


