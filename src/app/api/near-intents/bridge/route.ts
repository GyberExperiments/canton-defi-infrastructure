import { NextRequest, NextResponse } from 'next/server'
import { getTestnetRpcProvider, getProviderByNetwork } from '@near-js/client'
import { getNearIntentsSDK } from '@/lib/near-intents-sdk'
import { rateLimiterService } from '@/lib/services/rateLimiter'
import { validateNearAccountIdDetailed } from '@/lib/validators/near-address-validator'

// Принудительно делаем route динамическим
export const dynamic = 'force-dynamic'

/**
 * Get client IP address
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const clientIP = request.headers.get('cf-connecting-ip') // Cloudflare
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  if (realIP) {
    return realIP
  }
  
  if (clientIP) {
    return clientIP
  }
  
  return 'unknown'
}

/**
 * Оценивает время выполнения bridge операции между сетями
 */
function getBridgeEstimatedTime(fromChain: string, toChain: string): number {
  // Базовые оценки времени для разных bridge маршрутов
  const bridgeTimes: Record<string, number> = {
    'NEAR-AURORA': 120, // ~2 минуты
    'NEAR-ETHEREUM': 600, // ~10 минут
    'NEAR-POLYGON': 480, // ~8 минут
    'NEAR-BSC': 360, // ~6 минут
  }

  const key = `${fromChain}-${toChain}`
  return bridgeTimes[key] || 300 // Default: 5 минут
}

/**
 * POST /api/near-intents/bridge
 * Создает bridge intent через NEAR Intents протокол
 * Боевая реализация с интеграцией NEAR RPC и смарт-контрактов
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Get client IP for rate limiting
    const clientIP = getClientIP(request)
    
    const body = await request.json()
    
    const {
      fromChain,
      toChain,
      amount,
      dexFee, // Комиссия DEX в долях (0.005 = 0.5%)
      userAccount, // NEAR account ID пользователя
    } = body

    // Rate limiting check for DEX operations
    const rateLimitResult = await rateLimiterService.checkDexLimit(clientIP, userAccount)
    if (!rateLimitResult.allowed) {
      const message = rateLimiterService.formatLimitExceededMessage(rateLimitResult)
      const headers = rateLimiterService.getRateLimitHeaders(rateLimitResult)
      
      return NextResponse.json(
        { error: message, code: 'RATE_LIMIT_EXCEEDED' },
        { status: 429, headers }
      )
    }

    // Валидация обязательных полей
    if (!fromChain || !toChain || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields', code: 'MISSING_FIELDS' },
        { status: 400 }
      )
    }

    if (parseFloat(amount) <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0', code: 'INVALID_AMOUNT' },
        { status: 400 }
      )
    }

    if (fromChain === toChain) {
      return NextResponse.json(
        { error: 'Source and destination chains must be different', code: 'SAME_CHAIN' },
        { status: 400 }
      )
    }

    if (!userAccount) {
      return NextResponse.json(
        { error: 'User account is required', code: 'MISSING_ACCOUNT' },
        { status: 400 }
      )
    }

    // Валидация формата NEAR account ID
    const accountValidation = validateNearAccountIdDetailed(userAccount)
    if (!accountValidation.valid) {
      return NextResponse.json(
        { error: accountValidation.error || 'Invalid account ID format', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    // Получаем конфигурацию из environment
    const network = process.env.NEXT_PUBLIC_NEAR_NETWORK || 'testnet'
    const verifierContract = process.env.NEAR_INTENTS_VERIFIER_CONTRACT || 'verifier.testnet'
    const rpcUrl = process.env.NEAR_RPC_URL || (network === 'mainnet' 
      ? 'https://rpc.mainnet.near.org' 
      : 'https://rpc.testnet.near.org')

    // Инициализируем RPC provider
    const rpcProvider = network === 'testnet' 
      ? getTestnetRpcProvider()
      : getProviderByNetwork('mainnet')

    // Получаем адрес для получения комиссий
    const feeRecipient = process.env.NEAR_DEX_FEE_RECIPIENT || ''
    
    // Получаем decimals для токена (по умолчанию NEAR = 24)
    const getTokenDecimals = (chain: string): number => {
      // Для bridge обычно используется NEAR или нативный токен сети
      const decimalsMap: Record<string, number> = {
        'NEAR': 24,
        'AURORA': 18,
        'ETHEREUM': 18,
        'POLYGON': 18,
        'BSC': 18,
      }
      return decimalsMap[chain] || 24
    }
    
    // Вычисляем комиссию DEX (в наименьших единицах токена)
    const dexFeePercent = dexFee || 0.005 // 0.5%
    const fromChainDecimals = getTokenDecimals(fromChain)
    const amountBN = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, fromChainDecimals)))
    const dexFeeAmount = amountBN * BigInt(Math.floor(dexFeePercent * 1e6)) / BigInt(1e6)

    // Инициализируем NEAR Intents SDK
    const sdk = getNearIntentsSDK()

    // Создаем intent данные через SDK
    const intentArgs = {
      from_chain: fromChain,
      to_chain: toChain,
      amount: amountBN.toString(), // В наименьших единицах токена
      user_account: userAccount,
      deadline: Math.floor(Date.now() / 1000) + 7200, // 2 часа для bridge (больше времени)
      ...(feeRecipient && dexFeeAmount > BigInt(0) ? {
        app_fees: dexFeeAmount.toString(),
        fee_recipient: feeRecipient,
      } : {}),
    }

    // Валидируем параметры через SDK
    const validation = sdk.validateBridgeIntent(intentArgs)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error, code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    // Подготавливаем транзакцию через SDK
    const transactionData = sdk.prepareBridgeIntentTransaction(intentArgs)

    // Вызываем метод смарт-контракта verifier для создания intent
    try {
      console.log('🌉 Creating bridge intent via SDK:', {
        intentArgs,
        contractInfo: sdk.getContractInfo(),
        network,
        feeRecipient,
        dexFeePercent,
        processingTime: Date.now() - startTime
      })

      // Возвращаем данные для подписания транзакции на клиенте
      // Транзакция будет подписана пользователем через NEAR Wallet
      return NextResponse.json({
        success: true,
        status: 'pending',
        intent: intentArgs,
        message: 'Bridge intent готов к подписанию. Подпишите транзакцию в кошельке.',
        transactionData,
        feeInfo: {
          percent: dexFeePercent * 100,
          amount: dexFeeAmount.toString(),
          recipient: feeRecipient || 'Не указан',
          source: 'config', // Указываем что комиссия из конфига
        },
        estimatedTime: getBridgeEstimatedTime(fromChain, toChain),
        timestamp: Date.now(),
        processingTime: Date.now() - startTime,
      })
    } catch (contractError: any) {
      console.error('❌ Contract call error:', contractError)
      
      return NextResponse.json(
        { 
          error: 'Failed to create intent on contract',
          details: contractError.message || 'Contract interaction failed',
          code: 'CONTRACT_ERROR'
        },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error('❌ Error creating bridge intent:', error)
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to create bridge intent',
        code: 'INTERNAL_ERROR',
        processingTime: Date.now() - startTime
      },
      { status: 500 }
    )
  }
}

