/**
 * 🧪 Admin Service Testing API
 * Test all integrations and services
 */

import { NextRequest, NextResponse } from 'next/server'
import { googleSheetsService } from '@/lib/services/googleSheets'
import { telegramService } from '@/lib/services/telegram'
import { emailService } from '@/lib/services/email'

// Принудительно делаем route динамическим
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { adminKey } = await request.json()

    // Simple admin authentication
    if (adminKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    console.log('🧪 Testing all services...')

    // Test all services in parallel
    const [sheetsTest, telegramTest, emailTest] = await Promise.allSettled([
      testGoogleSheets(),
      testTelegram(),
      testEmail()
    ])

    const results = {
      googleSheets: {
        status: sheetsTest.status,
        result: sheetsTest.status === 'fulfilled' ? sheetsTest.value : sheetsTest.reason?.message
      },
      telegram: {
        status: telegramTest.status,
        result: telegramTest.status === 'fulfilled' ? telegramTest.value : telegramTest.reason?.message
      },
      email: {
        status: emailTest.status,
        result: emailTest.status === 'fulfilled' ? emailTest.value : emailTest.reason?.message
      }
    }

    console.log('🧪 Service test results:', results)

    return NextResponse.json({
      success: true,
      message: 'Service tests completed',
      results,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Service test failed:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Service test failed',
        code: 'SERVICE_TEST_FAILED'
      }, 
      { status: 500 }
    )
  }
}

/**
 * Test Google Sheets connection
 */
async function testGoogleSheets(): Promise<{ success: boolean; message: string }> {
  try {
    // Try to initialize the sheet (this will test authentication)
    await googleSheetsService.initializeSheet()
    return { success: true, message: 'Google Sheets connection successful' }
  } catch (error) {
    return { 
      success: false, 
      message: `Google Sheets error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }
  }
}

/**
 * Test Telegram Bot connection
 */
async function testTelegram(): Promise<{ success: boolean; message: string }> {
  try {
    const isConnected = await telegramService.testConnection()
    
    if (isConnected) {
      // Send test message
      const testSent = await telegramService.sendTestMessage()
      return { 
        success: testSent, 
        message: testSent ? 'Telegram Bot connection and test message successful' : 'Connected but failed to send test message'
      }
    } else {
      return { success: false, message: 'Telegram Bot connection failed' }
    }
  } catch (error) {
    return { 
      success: false, 
      message: `Telegram error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }
  }
}

/**
 * Test Email service connection
 */
async function testEmail(): Promise<{ success: boolean; message: string }> {
  try {
    const isConnected = await emailService.testConnection()
    return { 
      success: isConnected, 
      message: isConnected ? 'Email service connection successful' : 'Email service connection failed'
    }
  } catch (error) {
    return { 
      success: false, 
      message: `Email error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }
  }
}
