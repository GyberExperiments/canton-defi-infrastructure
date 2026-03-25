/**
 * 📊 Order Status Tracking API
 * Real-time order status retrieval
 */

import { NextRequest, NextResponse } from 'next/server'
import { googleSheetsService } from '@/lib/services/googleSheets'
import { intercomService } from '@/lib/services/intercom'
import { rateLimiterService } from '@/lib/services/rateLimiter'

// Принудительно делаем route динамическим
export const dynamic = 'force-dynamic';
// MINIMAL VERSION: addressGeneratorService not needed

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    // Get client IP for rate limiting
    const clientIP = getClientIP(request)
    
    // Rate limiting check (more lenient for status checks)
    const rateLimitResult = await rateLimiterService.checkApiLimit(clientIP)
    if (!rateLimitResult.allowed) {
      const message = rateLimiterService.formatLimitExceededMessage(rateLimitResult)
      const headers = rateLimiterService.getRateLimitHeaders(rateLimitResult)
      
      return NextResponse.json(
        { error: message, code: 'RATE_LIMIT_EXCEEDED' },
        { status: 429, headers }
      )
    }

    const { orderId } = await context.params

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required', code: 'MISSING_ORDER_ID' },
        { status: 400 }
      )
    }

    // Get order from Google Sheets
    const orders = await googleSheetsService.getAllOrders()
    const order = orders.find(row => row[0] === orderId) // First column is Order ID

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found', code: 'ORDER_NOT_FOUND' },
        { status: 404 }
      )
    }

    // Parse order data with unique address support (based on extended sheet structure)
    const orderData = {
      orderId: order[0],
      timestamp: order[1],
      usdtAmount: parseFloat(order[2]) || 0,
      cantonAmount: parseFloat(order[3]) || 0,
      cantonAddress: order[4],
      refundAddress: order[5] || null,
      email: order[6],
      whatsapp: order[7] || null,
      telegram: order[8] || null,
      status: order[9] || 'awaiting-deposit',
      txHash: order[10] || null,
      createdAt: order[11],
      // NEW FIELDS for unique addresses
      uniqueAddress: order[12] || null,
      addressPath: order[13] || null,
      paymentNetwork: order[14] || 'TRON',
      paymentToken: order[15] || 'USDT'
    }

    // Calculate progress
    const statusProgress = getStatusProgress(orderData.status)

    // MINIMAL VERSION: No address generation needed
    const uniqueAddressInfo = null;

    return NextResponse.json({
      success: true,
      order: orderData,
      progress: statusProgress,
      estimatedCompletion: getEstimatedCompletion(orderData.status),
      nextSteps: getNextSteps(orderData.status),
      // UNIQUE ADDRESS INFORMATION
      uniqueAddress: uniqueAddressInfo,
      paymentInstructions: getPaymentInstructions(orderData, uniqueAddressInfo || {})
    })

  } catch (error) {
    console.error('❌ Failed to get order status:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to get order status',
        code: 'STATUS_CHECK_FAILED'
      }, 
      { status: 500 }
    )
  }
}

/**
 * Update order status (for admin use)
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await context.params
    const { status, txHash, adminKey } = await request.json()

    // Simple admin authentication (in production, use proper auth)
    if (adminKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    if (!status) {
      return NextResponse.json(
        { error: 'Status is required', code: 'MISSING_STATUS' },
        { status: 400 }
      )
    }

    // Valid status values
    const validStatuses = [
      'awaiting-deposit',
      'awaiting-confirmation', 
      'exchanging',
      'sending',
      'completed',
      'failed'
    ]

    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status value', code: 'INVALID_STATUS' },
        { status: 400 }
      )
    }

    // Update status in Google Sheets
    const success = await googleSheetsService.updateOrderStatus(orderId, status, txHash)

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update order status', code: 'UPDATE_FAILED' },
        { status: 500 }
      )
    }

    // Send status update notification via Intercom
    try {
      // Get order data for notification
      const orders = await googleSheetsService.getAllOrders()
      const order = orders.find(row => row[0] === orderId)
      
      if (order) {
        const orderData = {
          orderId: order[0],
          timestamp: order[1],
          usdtAmount: parseFloat(order[2]) || 0,
          cantonAmount: parseFloat(order[3]) || 0,
          cantonAddress: order[4],
          refundAddress: order[5] || null,
          email: order[6],
          whatsapp: order[7] || null,
          telegram: order[8] || null,
          status: status,
          txHash: txHash || null,
        }

        // Send Intercom notification
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await intercomService.sendStatusUpdate(orderData as any, status, txHash ? `Transaction: ${txHash}` : undefined)
      }
    } catch (error) {
      console.error('❌ Failed to send Intercom status update:', error)
      // Don't fail the request if notification fails
    }

    return NextResponse.json({
      success: true,
      orderId,
      status,
      txHash: txHash || null,
      updatedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Failed to update order status:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to update order status',
        code: 'STATUS_UPDATE_FAILED'
      }, 
      { status: 500 }
    )
  }
}

/**
 * Get status progress percentage
 */
function getStatusProgress(status: string): { current: number; total: number; percentage: number } {
  const statusMap: Record<string, number> = {
    'awaiting-deposit': 1,
    'awaiting-confirmation': 2,
    'exchanging': 3,
    'sending': 4,
    'completed': 5,
    'failed': 0
  }

  const current = statusMap[status] || 0
  const total = 5
  const percentage = status === 'failed' ? 0 : Math.round((current / total) * 100)

  return { current, total, percentage }
}

/**
 * Get estimated completion time
 */
function getEstimatedCompletion(status: string): string {
  const estimates: Record<string, string> = {
    'awaiting-deposit': 'Waiting for your payment',
    'awaiting-confirmation': '15-30 minutes',
    'exchanging': '30-60 minutes', 
    'sending': '15-30 minutes',
    'completed': 'Complete',
    'failed': 'Failed - Contact support'
  }

  return estimates[status] || 'Unknown'
}

/**
 * Get next steps for user
 */
function getNextSteps(status: string): string[] {
  const steps: Record<string, string[]> = {
    'awaiting-deposit': [
      'Send exactly the specified USDT amount to your unique address',
      'Use the correct network (TRC-20, ERC-20, etc.)',
      'Include your Order ID in transaction memo if possible'
    ],
    'awaiting-confirmation': [
      'We are verifying your USDT payment',
      'This usually takes 15-30 minutes',
      'You will receive an email update soon'
    ],
    'exchanging': [
      'Processing your Canton Coin exchange',
      'Preparing transfer to your wallet',
      'Almost complete!'
    ],
    'sending': [
      'Transferring Canton Coin to your address',
      'Transaction is being processed',
      'You will receive confirmation shortly'
    ],
    'completed': [
      'Your Canton Coin has been successfully delivered',
      'Check your wallet for the tokens',
      'Thank you for using Canton OTC!'
    ],
    'failed': [
      'Something went wrong with your order',
      'Please contact our support team',
      'We will resolve this issue quickly'
    ]
  }

  return steps[status] || ['Contact support for assistance']
}

/**
 * Get payment instructions with unique address
 */
function getPaymentInstructions(orderData: Record<string, unknown>, uniqueAddressInfo: Record<string, unknown>): {
  address: string;
  amount: number;
  network: string;
  token: string;
  instructions: string[];
} | null {
  if (!uniqueAddressInfo) {
    return null;
  }

  const instructions = [
    `Send exactly $${orderData.usdtAmount} ${uniqueAddressInfo.token} to the address below`,
    `Network: ${uniqueAddressInfo.network}`,
    `Address: ${uniqueAddressInfo.address}`,
    `Order ID: ${orderData.orderId}`,
    'Include your Order ID in the transaction memo if possible',
    'Do not send from an exchange - use a personal wallet'
  ];

  return {
    address: uniqueAddressInfo.address as string,
    amount: orderData.usdtAmount as number,
    network: uniqueAddressInfo.network as string,
    token: uniqueAddressInfo.token as string,
    instructions
  };
}

/**
 * Get client IP address
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const clientIP = request.headers.get('cf-connecting-ip')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  if (realIP) {
    return realIP.trim()
  }
  
  if (clientIP) {
    return clientIP.trim()
  }

  return '127.0.0.1'
}
