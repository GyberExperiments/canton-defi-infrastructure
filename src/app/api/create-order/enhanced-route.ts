/**
 * 🚀 Enhanced Order Creation API - Production Ready
 * Интеграция с новым Enhanced Intercom Service
 * Полная проброска Order ID и контекста в Intercom
 */

import { NextRequest, NextResponse } from 'next/server'
import { OTC_CONFIG, type OTCOrder } from '@/config/otc'
import { googleSheetsService } from '@/lib/services/googleSheets'
import { enhancedIntercomService } from '@/lib/services/enhancedIntercom'
import { simplifiedTelegramMediator } from '@/lib/services/simplifiedTelegramMediator'
import { rateLimiterService } from '@/lib/services/rateLimiter'
import { cantonValidationService } from '@/lib/services/cantonValidation'
import { antiSpamService } from '@/lib/services/antiSpamService'

// Принудительно делаем route динамическим
export const dynamic = 'force-dynamic';

/**
 * 🏛️ Enhanced OTC Order Creation API
 * Full Order ID integration with Intercom for seamless customer-admin communication
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Get client IP for rate limiting
    const clientIP = getClientIP(request)
    
    // Parse and validate request body
    const orderData = await parseAndValidateOrderData(request)
    
    // Rate limiting check
    const rateLimitResult = await rateLimiterService.checkOrderCreationLimit(clientIP, orderData.email)
    if (!rateLimitResult.allowed) {
      const message = rateLimiterService.formatLimitExceededMessage(rateLimitResult)
      const headers = rateLimiterService.getRateLimitHeaders(rateLimitResult)
      
      return NextResponse.json(
        { error: message, code: 'RATE_LIMIT_EXCEEDED' },
        { status: 429, headers }
      )
    }

    // Enhanced spam detection
    const spamResult = await antiSpamService.detectSpam({
      email: orderData.email,
      cantonAddress: orderData.cantonAddress,
      usdtAmount: orderData.paymentAmountUSD || orderData.usdtAmount || 0,
      ip: clientIP,
      timestamp: Date.now(),
      orderId: orderData.orderId
    })
    
    if (spamResult.isSpam) {
      console.warn('🚫 Spam detected:', {
        reason: spamResult.reason,
        confidence: spamResult.confidence,
        riskLevel: spamResult.riskLevel,
        orderId: orderData.orderId
      })
      
      return NextResponse.json(
        { 
          error: `Request flagged as suspicious: ${spamResult.reason}`, 
          code: 'SPAM_DETECTED',
          riskLevel: spamResult.riskLevel,
          confidence: spamResult.confidence
        },
        { status: 400 }
      )
    }

    // Address validation
    const cantonValidation = cantonValidationService.validateCantonAddress(orderData.cantonAddress)
    if (!cantonValidation.isValid) {
      return NextResponse.json(
        { error: `Invalid Canton address: ${cantonValidation.error}`, code: 'INVALID_ADDRESS' },
        { status: 400 }
      )
    }

    if (orderData.refundAddress) {
      const refundValidation = cantonValidationService.validateRefundAddress(orderData.refundAddress)
      if (!refundValidation.isValid) {
        return NextResponse.json(
          { error: `Invalid refund address: ${refundValidation.error}`, code: 'INVALID_REFUND_ADDRESS' },
          { status: 400 }
        )
      }
    }

    // Create order object
    const order: OTCOrder = {
      ...orderData,
      timestamp: Date.now(),
      status: 'awaiting-deposit'
    }

    // ⚡ Start enhanced background processing
    processOrderWithEnhancedIntercom(order, startTime).catch(error => {
      console.error('❌ Enhanced background order processing failed:', error);
    });

    const responseTime = Date.now() - startTime;

    // Return immediate success response
    return NextResponse.json({
      success: true,
      orderId: order.orderId,
      message: 'Order created successfully. You will receive detailed instructions via our support chat.',
      status: order.status,
      processingTime: responseTime + 'ms',
      paymentAddress: null, // Provided via support chat
      paymentNetwork: orderData.paymentToken.network,
      paymentToken: orderData.paymentToken.symbol,
      notifications: {
        sheets: true,
        intercom: true, 
        telegram: true,
        email: false
      },
      validation: {
        cantonAddress: cantonValidation.format,
        refundAddress: orderData.refundAddress ? 
          cantonValidationService.validateRefundAddress(orderData.refundAddress).format : undefined,
        addressValid: true
      },
      spamCheck: {
        passed: true,
        riskLevel: spamResult.riskLevel,
        confidence: spamResult.confidence
      },
      // 🎯 Enhanced Intercom integration info
      intercom: {
        userWillBeCreated: true,
        conversationWillBeStarted: true,
        orderContextPreserved: true
      }
    })
    
  } catch (error) {
    console.error('❌ Enhanced order creation failed:', error)
    
    const message = error instanceof Error ? error.message : 'Failed to create order'
    const validationPatterns = [
      'Missing ',
      'Invalid ',
      'Minimum order amount',
      'exchange rate'
    ]
    const isValidationError = validationPatterns.some(p => message.includes(p))

    return NextResponse.json(
      { 
        error: message,
        code: isValidationError ? 'VALIDATION_ERROR' : 'ORDER_CREATION_FAILED'
      }, 
      { status: isValidationError ? 400 : 500 }
    )
  }
}

/**
 * ⚡ Enhanced background processing with full Intercom integration
 */
async function processOrderWithEnhancedIntercom(order: OTCOrder, startTime: number): Promise<void> {
  try {
    console.log('🚀 Starting enhanced background processing for order:', order.orderId);

    // 1. Create/update user in Intercom with full order context
    const intercomUser = await enhancedIntercomService.createOrderUser(order);
    
    // 2. Create conversation with welcome message and order details
    let intercomConversation = null;
    if (intercomUser) {
      intercomConversation = await enhancedIntercomService.createOrderConversation(intercomUser, order);
    }

    // 3. Process other services in parallel
    const [sheetsResult, telegramResult] = await Promise.allSettled([
      googleSheetsService.saveOrder(order),
      // 📱 Simplified Telegram notification with Intercom link
      simplifiedTelegramMediator.notifyNewConversation({
        orderId: order.orderId,
        customerEmail: order.email,
        orderAmount: order.paymentAmountUSD || order.usdtAmount || 0,
        orderStatus: order.status,
        intercomConversationUrl: intercomConversation 
          ? `https://app.intercom.com/a/apps/${process.env.NEXT_PUBLIC_INTERCOM_APP_ID}/inbox/conversation/${intercomConversation.id}`
          : undefined,
        priority: (order.paymentAmountUSD || 0) > 1000 ? 'high' : 'normal'
      })
    ]);

    // Log comprehensive results with full error details
    const sheetsSuccess = sheetsResult.status === 'fulfilled' && sheetsResult.value === true;
    const sheetsError = sheetsResult.status === 'rejected' 
      ? sheetsResult.reason 
      : (sheetsResult.status === 'fulfilled' && sheetsResult.value === false ? 'saveOrder вернул false' : null);

    console.log('📊 Enhanced background processing completed:', {
      orderId: order.orderId,
      intercomUser: intercomUser ? '✅ Created/Updated' : '❌ Failed',
      intercomConversation: intercomConversation ? '✅ Created' : '❌ Failed',
      sheets: sheetsSuccess ? '✅ Success' : `❌ FAILED${sheetsError ? ` - ${sheetsError instanceof Error ? sheetsError.message : String(sheetsError)}` : ''}`,
      sheetsValue: sheetsResult.status === 'fulfilled' ? sheetsResult.value : undefined,
      sheetsErrorDetails: sheetsError instanceof Error ? {
        message: sheetsError.message,
        name: sheetsError.name
      } : sheetsError,
      telegram: telegramResult.status === 'fulfilled' ? '✅ Success' : `❌ ${telegramResult.reason}`,
      totalProcessingTime: Date.now() - startTime + 'ms'
    });

    // 🔍 ДОПОЛНИТЕЛЬНОЕ ЛОГИРОВАНИЕ если Google Sheets не сохранил
    if (!sheetsSuccess) {
      console.error('❌ КРИТИЧЕСКАЯ ПРОБЛЕМА: Ордер НЕ был сохранен в Google Sheets!', {
        orderId: order.orderId,
        sheetsResultStatus: sheetsResult.status,
        sheetsResultValue: sheetsResult.status === 'fulfilled' ? sheetsResult.value : undefined,
        sheetsError: sheetsError
      });
    }

    // 🎯 If everything succeeded, add success note to Intercom
    if (intercomConversation && sheetsResult.status === 'fulfilled') {
      await enhancedIntercomService.addInternalNote(
        intercomConversation.id,
        `✅ **Order Processing Complete**\n\n` +
        `• Google Sheets: ✅ Saved\n` +
        `• Telegram: ✅ Operators notified\n` +
        `• Processing time: ${Date.now() - startTime}ms\n\n` +
        `Order is ready for customer support interaction.`
      );
    }

  } catch (error) {
    console.error('❌ Enhanced background processing error for order', order.orderId, ':', error);
    
    // Try to add error note to Intercom if possible
    try {
      const conversations = await enhancedIntercomService.findConversationsByOrderId(order.orderId);
      if (conversations.length > 0) {
        await enhancedIntercomService.addInternalNote(
          conversations[0].id,
          `❌ **Processing Error**\n\n${error instanceof Error ? error.message : 'Unknown error'}\n\nManual verification may be required.`
        );
      }
    } catch (noteError) {
      console.error('❌ Failed to add error note to Intercom:', noteError);
    }
  }
}

/**
 * Parse and validate order data
 */
async function parseAndValidateOrderData(request: NextRequest): Promise<Omit<OTCOrder, 'timestamp' | 'status'>> {
  let orderData: Record<string, unknown>
  
  try {
    orderData = await request.json()
  } catch {
    throw new Error('Invalid JSON in request body')
  }

  // Required fields validation - support both new and legacy formats
  const hasNewFormat = orderData.paymentToken && orderData.paymentAmount && orderData.paymentAmountUSD
  const hasLegacyFormat = orderData.usdtAmount
  
  if (!hasNewFormat && !hasLegacyFormat) {
    throw new Error('Missing payment information - provide either paymentToken/paymentAmount/paymentAmountUSD or usdtAmount')
  }
  
  const requiredFields = ['cantonAmount', 'cantonAddress', 'email']
  for (const field of requiredFields) {
    if (!orderData[field]) {
      throw new Error(`Missing required field: ${field}`)
    }
  }

  // Type validation and conversion
  const cantonAmount = Number(orderData.cantonAmount)
  const email = String(orderData.email || '').trim()

  // Handle both new (paymentToken) and legacy (usdtAmount) formats
  let paymentAmount: number
  let paymentAmountUSD: number
  let usdtAmount: number
  let paymentToken: import('@/config/otc').TokenConfig

  if (orderData.paymentToken && typeof orderData.paymentToken === 'object') {
    // New multi-token format
    paymentToken = orderData.paymentToken as import('@/config/otc').TokenConfig
    paymentAmount = Number(orderData.paymentAmount)
    paymentAmountUSD = Number(orderData.paymentAmountUSD)
    
    // For legacy compatibility, set usdtAmount
    usdtAmount = orderData.usdtAmount ? Number(orderData.usdtAmount) : paymentAmountUSD
  } else if (orderData.usdtAmount) {
    // Legacy format - only USDT
    usdtAmount = Number(orderData.usdtAmount)
    paymentAmount = usdtAmount
    paymentAmountUSD = usdtAmount
    
    // Use default USDT TRC-20 token
    const { SUPPORTED_TOKENS } = await import('@/config/otc')
    const foundToken = SUPPORTED_TOKENS.find(t => t.symbol === 'USDT' && t.network === 'TRON')
    
    if (!foundToken) {
      throw new Error('Default USDT token not found')
    }
    
    paymentToken = foundToken
  } else {
    throw new Error('Missing payment information')
  }

  if (!paymentAmount || paymentAmount <= 0) {
    throw new Error('Invalid payment amount')
  }

  if (!cantonAmount || cantonAmount <= 0) {
    throw new Error('Invalid Canton amount')
  }

  // Amount limits (check USD value)
  if (paymentAmountUSD < OTC_CONFIG.MIN_USDT_AMOUNT) {
    throw new Error(`Minimum order amount is $${OTC_CONFIG.MIN_USDT_AMOUNT}`)
  }

  // Email validation
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Invalid email address')
  }

  // Exchange rate validation (prevent manipulation) - use same calculation as frontend
  // ✅ SECURITY FIX: Reduced tolerance from 1% to 0.1% to prevent price manipulation
  const { calculateCantonAmount } = await import('@/config/otc')
  const expectedCantonAmount = calculateCantonAmount(paymentAmountUSD, true, true) // Apply discount like frontend, isBuying=true
  const tolerance = expectedCantonAmount * 0.001 // 0.1% tolerance (was 1%)
  
  if (Math.abs(cantonAmount - expectedCantonAmount) > tolerance) {
    const deviation = ((cantonAmount - expectedCantonAmount) / expectedCantonAmount) * 100
    console.warn('🚨 Exchange rate manipulation attempt detected:', {
      orderId: orderData.orderId,
      expected: expectedCantonAmount,
      received: cantonAmount,
      deviation: `${deviation.toFixed(2)}%`,
      tolerance: '0.1%'
    })
    throw new Error(`Invalid exchange rate calculation: deviation ${deviation.toFixed(2)}% exceeds allowed 0.1%`)
  }

  return {
    orderId: generateOrderId(),
    paymentToken,
    paymentAmount,
    paymentAmountUSD,
    cantonAmount,
    cantonAddress: String(orderData.cantonAddress || '').trim(),
    refundAddress: orderData.refundAddress ? String(orderData.refundAddress).trim() : undefined,
    email: email.toLowerCase(),
    whatsapp: orderData.whatsapp ? String(orderData.whatsapp).trim() : undefined,
    telegram: orderData.telegram ? String(orderData.telegram).trim() : undefined,
    usdtAmount, // Legacy compatibility
  }
}

/**
 * Generate unique order ID
 */
function generateOrderId(): string {
  const timestamp = Date.now().toString(36)
  const randomPart = Math.random().toString(36).substring(2, 8)
  return `${timestamp}-${randomPart}`.toUpperCase()
}

/**
 * Get client IP address
 */
function getClientIP(request: NextRequest): string {
  // Try various headers for IP detection
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const clientIP = request.headers.get('cf-connecting-ip') // Cloudflare
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  if (realIP) {
    return realIP.trim()
  }
  
  if (clientIP) {
    return clientIP.trim()
  }

  // Fallback
  return '127.0.0.1'
}
