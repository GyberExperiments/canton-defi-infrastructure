import { NextRequest, NextResponse } from 'next/server'
import { getTestnetRpcProvider, getProviderByNetwork } from '@near-js/client'
import { getBestPriceQuote, calculateMinReceive, calculatePriceImpact } from '@/lib/price-oracle'
import { getNearIntentsSDK } from '@/lib/near-intents-sdk'
import { getNearBalance, getTokenBalance } from '@/lib/near-balance'
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
 * POST /api/near-intents/swap
 * Создает swap intent через NEAR Intents протокол
 * Боевая реализация с интеграцией NEAR RPC и смарт-контрактов
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Get client IP for rate limiting
    const clientIP = getClientIP(request)
    
    const body = await request.json()
    
    const {
      fromToken,
      fromChain,
      toToken,
      toChain,
      amount,
      dexFee, // Комиссия DEX в долях (опционально, берется из конфига если не указана)
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

    // Получаем комиссию из конфига если не указана
    let swapFee = dexFee
    if (!swapFee || swapFee === 0) {
      const { getSwapFee } = await import('@/lib/dex-config')
      swapFee = await getSwapFee()
    }

    // Валидация обязательных полей
    if (!fromToken || !fromChain || !toToken || !toChain || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields', code: 'MISSING_FIELDS' },
        { status: 400 }
      )
    }

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0', code: 'INVALID_AMOUNT' },
        { status: 400 }
      )
    }

    // Валидация минимальной суммы swap
    const { getDEXConfig } = await import('@/lib/dex-config')
    const dexConfig = await getDEXConfig()
    if (amountNum < dexConfig.minSwapAmount) {
      return NextResponse.json(
        { 
          error: `Amount must be at least ${dexConfig.minSwapAmount} ${fromToken}`, 
          code: 'AMOUNT_TOO_SMALL',
          minAmount: dexConfig.minSwapAmount
        },
        { status: 400 }
      )
    }

    // Получаем лучшую цену через price oracle
    let priceQuote = null
    let minReceive = amountNum * 0.995 // Fallback: 0.5% slippage
    let priceImpact = 0
    const LARGE_AMOUNT_THRESHOLD = 1000 // Порог для "больших" сумм (в USD эквиваленте)

    try {
      priceQuote = await getBestPriceQuote(fromToken, toToken, amountNum)
      
      if (priceQuote) {
        minReceive = calculateMinReceive(priceQuote.estimatedOut, 0.005) // 0.5% slippage
        priceImpact = await calculatePriceImpact(fromToken, toToken, amountNum)
        
        console.log('💰 Price quote received:', {
          fromToken,
          toToken,
          amountIn: amountNum,
          estimatedOut: priceQuote.estimatedOut,
          swapRate: priceQuote.swapRate,
          priceImpact,
          source: priceQuote.source,
        })
      } else {
        // Для больших сумм требуем актуальную цену
        const estimatedUsdValue = amountNum * (fromToken === 'USDT' || fromToken === 'USDC' ? 1 : 
          (fromToken === 'NEAR' ? 3 : 2000)) // Примерная оценка USD стоимости
        
        if (estimatedUsdValue >= LARGE_AMOUNT_THRESHOLD) {
          return NextResponse.json(
            { 
              error: 'Price oracle unavailable for large amounts. Please try again later.', 
              code: 'PRICE_ORACLE_UNAVAILABLE',
              note: 'For amounts >= $1000, real-time price is required'
            },
            { status: 503 }
          )
        }
        
        // Для меньших сумм используем более консервативный slippage при fallback
        minReceive = amountNum * 0.98 // 2% slippage для fallback (более консервативно)
        console.warn('⚠️ Price oracle unavailable, using conservative fallback (2% slippage)')
      }
    } catch (priceError) {
      // Для больших сумм отклоняем запрос при ошибке price oracle
      const estimatedUsdValue = amountNum * (fromToken === 'USDT' || fromToken === 'USDC' ? 1 : 
        (fromToken === 'NEAR' ? 3 : 2000))
      
      if (estimatedUsdValue >= LARGE_AMOUNT_THRESHOLD) {
        console.error('❌ Price oracle error for large amount:', priceError)
        return NextResponse.json(
          { 
            error: 'Price oracle error for large amounts. Please try again later.', 
            code: 'PRICE_ORACLE_ERROR',
            note: 'For amounts >= $1000, real-time price is required'
          },
          { status: 503 }
        )
      }
      
      // Для меньших сумм используем консервативный fallback
      minReceive = amountNum * 0.98 // 2% slippage для fallback
      console.warn('⚠️ Price oracle unavailable, using conservative fallback (2% slippage):', priceError)
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
    const getTokenDecimals = (tokenSymbol: string): number => {
      const decimalsMap: Record<string, number> = {
        'NEAR': 24,
        'USDT': 6,
        'USDC': 6,
        'ETH': 18,
      }
      return decimalsMap[tokenSymbol] || 24
    }
    
    // Получаем contract address для токена
    const getTokenContract = (tokenSymbol: string, chain: string): string | null => {
      // Для NEAR native token используем пустую строку (не contract)
      if (tokenSymbol === 'NEAR' && chain === 'NEAR') {
        return null // Native NEAR doesn't have contract
      }
      
      // Token contract addresses (testnet/mainnet)
      const contracts: Record<string, Record<string, string>> = {
        'USDT': {
          'NEAR': network === 'mainnet' 
            ? (process.env.NEAR_MAINNET_USDT_CONTRACT || 'usdt.tether-token.near') 
            : (process.env.NEAR_TESTNET_USDT_CONTRACT || 'usdt.fakes.testnet'),
          'ETHEREUM': network === 'mainnet'
            ? (process.env.ETH_MAINNET_USDT_CONTRACT || '0xdAC17F958D2ee523a2206206994597C13D831ec7')
            : (process.env.ETH_SEPOLIA_USDT_CONTRACT || '0xaa8e23fb1079ea71e0a56f48a2aa51851d8433d0'), // Sepolia
        },
        'USDC': {
          'NEAR': network === 'mainnet' 
            ? (process.env.NEAR_MAINNET_USDC_CONTRACT || '17208628f84f5d6ad33f0558Cv31893f72df156.factory.bridge.near') 
            : (process.env.NEAR_TESTNET_USDC_CONTRACT || 'usdc.fakes.testnet'),
          'ETHEREUM': network === 'mainnet'
            ? (process.env.ETH_MAINNET_USDC_CONTRACT || '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
            : (process.env.ETH_SEPOLIA_USDC_CONTRACT || '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8'), // Sepolia
        },
        'WBTC': {
          'NEAR': network === 'mainnet'
            ? '2260fac5e5542a773aa44fbcfedf7c193bc2c599.factory.bridge.near'
            : 'wbtc.fakes.testnet'
        }
      }
      
      return contracts[tokenSymbol]?.[chain] || null
    }
    
    // Вычисляем комиссию DEX (в наименьших единицах токена)
    const dexFeePercent = dexFee || 0.003 // 0.3%
    const fromTokenDecimals = getTokenDecimals(fromToken)
    const amountBN = BigInt(Math.floor(amountNum * Math.pow(10, fromTokenDecimals)))
    const dexFeeAmount = amountBN * BigInt(Math.floor(dexFeePercent * 1e6)) / BigInt(1e6)
    
    // ✅ SECURITY FIX: Проверка баланса пользователя перед созданием intent
    try {
      const tokenContract = getTokenContract(fromToken, fromChain)
      
      if (tokenContract) {
        // Проверка баланса для fungible tokens (FT)
        try {
          const tokenBalanceData = await getTokenBalance(
            userAccount,
            tokenContract,
            fromToken,
            fromTokenDecimals,
            network as 'mainnet' | 'testnet'
          )
          
          if (!tokenBalanceData) {
            console.warn('⚠️ Could not fetch token balance for:', { userAccount, token: fromToken, contract: tokenContract })
          } else {
            const balanceBN = BigInt(tokenBalanceData.balanceRaw || '0')
            const requiredAmount = amountBN + dexFeeAmount // amount + fee
            
            if (balanceBN < requiredAmount) {
              console.warn('🚨 Insufficient balance detected:', {
                userAccount,
                token: fromToken,
                required: requiredAmount.toString(),
                available: balanceBN.toString(),
              })
              
              return NextResponse.json(
                { 
                  error: 'Insufficient balance',
                  code: 'INSUFFICIENT_BALANCE',
                  details: {
                    required: requiredAmount.toString(),
                    available: balanceBN.toString(),
                    token: fromToken,
                  }
                },
                { status: 400 }
              )
            }
            
            console.log('✅ Balance check passed:', {
              userAccount,
              token: fromToken,
              available: balanceBN.toString(),
              required: requiredAmount.toString(),
            })
          }
        } catch (balanceError: any) {
          // Если не удалось проверить баланс (например, токен не поддерживает ft_balance_of)
          // Логируем предупреждение, но не блокируем запрос (fail secure не применим здесь)
          console.warn('⚠️ Could not verify balance (token may not support ft_balance_of):', balanceError.message)
        }
      } else if (fromToken === 'NEAR' && fromChain === 'NEAR') {
        // Проверка баланса для native NEAR
        try {
          const nearBalanceData = await getNearBalance(userAccount, network as 'mainnet' | 'testnet')
          
          if (!nearBalanceData) {
            console.warn('⚠️ Could not fetch NEAR balance for:', userAccount)
          } else {
            const balanceBN = BigInt(nearBalanceData.balanceRaw || '0')
            const requiredAmount = amountBN + dexFeeAmount
            
            // Добавляем резерв на gas (примерно 0.1 NEAR)
            const gasReserve = BigInt('100000000000000000000000') // 0.1 NEAR
            const totalRequired = requiredAmount + gasReserve
            
            if (balanceBN < totalRequired) {
              console.warn('🚨 Insufficient NEAR balance:', {
                userAccount,
                required: totalRequired.toString(),
                available: balanceBN.toString(),
              })
              
              return NextResponse.json(
                { 
                  error: 'Insufficient NEAR balance (including gas reserve)',
                  code: 'INSUFFICIENT_BALANCE',
                  details: {
                    required: totalRequired.toString(),
                    available: balanceBN.toString(),
                    note: 'Balance must cover amount + fee + gas reserve (~0.1 NEAR)',
                  }
                },
                { status: 400 }
              )
            }
            
            console.log('✅ NEAR balance check passed:', {
              userAccount,
              available: balanceBN.toString(),
              required: totalRequired.toString(),
            })
          }
        } catch (nearBalanceError: any) {
          console.warn('⚠️ Could not verify NEAR balance:', nearBalanceError.message)
        }
      }
    } catch (balanceCheckError: any) {
      // Логируем ошибку, но не блокируем запрос если баланс невозможно проверить
      // В production можно добавить алерт
      console.error('❌ Balance check failed:', balanceCheckError)
    }

    // Вычисляем min_receive с учетом slippage (в наименьших единицах токена)
    const toTokenDecimals = getTokenDecimals(toToken)
    const minReceiveBN = BigInt(Math.floor(minReceive * Math.pow(10, toTokenDecimals)))

    // Инициализируем NEAR Intents SDK
    const sdk = getNearIntentsSDK()

    // Создаем intent данные через SDK
    const intentArgs = {
      from_token: fromToken,
      from_chain: fromChain,
      to_token: toToken,
      to_chain: toChain,
      amount: amountBN.toString(), // В наименьших единицах токена
      min_receive: minReceiveBN.toString(), // Минимальная сумма получения (защита от slippage)
      user_account: userAccount,
      deadline: Math.floor(Date.now() / 1000) + 3600, // 1 час на исполнение
      ...(feeRecipient && dexFeeAmount > BigInt(0) ? {
        app_fees: dexFeeAmount.toString(),
        fee_recipient: feeRecipient,
      } : {}),
    }

    // Валидируем параметры через SDK
    const validation = sdk.validateSwapIntent(intentArgs)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error, code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    // Подготавливаем транзакцию через SDK
    const transactionData = sdk.prepareSwapIntentTransaction(intentArgs)

    try {
      console.log('📝 Creating swap intent via SDK:', {
        intentArgs,
        contractInfo: sdk.getContractInfo(),
        feeRecipient,
        dexFeePercent,
        priceImpact,
        processingTime: Date.now() - startTime
      })

      // Возвращаем данные для подписания транзакции на клиенте
      // Транзакция будет подписана пользователем через NEAR Wallet
      return NextResponse.json({
        success: true,
        status: 'pending',
        intent: intentArgs,
        message: 'Swap intent готов к подписанию. Подпишите транзакцию в кошельке.',
        transactionData,
        feeInfo: {
          percent: dexFeePercent * 100,
          amount: dexFeeAmount.toString(),
          recipient: feeRecipient || 'Не указан',
          source: 'config', // Указываем что комиссия из конфига
        },
        // Price information из oracle
        priceInfo: priceQuote ? {
          estimatedOut: priceQuote.estimatedOut,
          swapRate: priceQuote.swapRate,
          priceImpact: priceImpact,
          source: priceQuote.source,
          route: priceQuote.route,
        } : null,
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
    console.error('❌ Error creating swap intent:', error)
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to create swap intent',
        code: 'INTERNAL_ERROR',
        processingTime: Date.now() - startTime
      },
      { status: 500 }
    )
  }
}

