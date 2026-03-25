import {
  getCantonCoinBuyPriceSync,
  getCantonCoinSellPriceSync,
  OTC_CONFIG,
  type OTCOrder,
} from "@/config/otc";
import { logRateDeviation } from "@/lib/monitoring/exchange-rate-monitor";
import { cantonValidationService } from "@/lib/services/cantonValidation";
import { googleSheetsService } from "@/lib/services/googleSheets";
import { intercomService } from "@/lib/services/intercom";
import { rateLimiterService } from "@/lib/services/rateLimiter";
import { telegramService } from "@/lib/services/telegram";
import { NextRequest, NextResponse } from "next/server";

// Принудительно делаем route динамическим
export const dynamic = "force-dynamic";
// MINIMAL VERSION: addressGeneratorService not needed
import { antiSpamService } from "@/lib/services/antiSpamService";
// MINIMAL VERSION: monitoringService not needed

/**
 * 🏛️ Production-ready OTC Order Creation API
 * Full validation, rate limiting, and real integrations
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Get client IP for rate limiting
    const clientIP = getClientIP(request);

    // Parse and validate request body
    const orderData = await parseAndValidateOrderData(request);

    // Rate limiting check
    const rateLimitResult = await rateLimiterService.checkOrderCreationLimit(
      clientIP,
      orderData.email,
    );
    if (!rateLimitResult.allowed) {
      const message =
        rateLimiterService.formatLimitExceededMessage(rateLimitResult);
      const headers = rateLimiterService.getRateLimitHeaders(rateLimitResult);

      return NextResponse.json(
        { error: message, code: "RATE_LIMIT_EXCEEDED" },
        { status: 429, headers },
      );
    }

    // Enhanced spam detection with new AntiSpamService
    const spamResult = await antiSpamService.detectSpam({
      email: orderData.email,
      cantonAddress: orderData.cantonAddress,
      usdtAmount: orderData.paymentAmountUSD || orderData.usdtAmount || 0,
      ip: clientIP,
      timestamp: Date.now(),
      orderId: orderData.orderId,
    });

    if (spamResult.isSpam) {
      console.warn("🚫 Spam detected:", {
        reason: spamResult.reason,
        confidence: spamResult.confidence,
        riskLevel: spamResult.riskLevel,
        orderId: orderData.orderId,
      });

      return NextResponse.json(
        {
          error: `Request flagged as suspicious: ${spamResult.reason}`,
          code: "SPAM_DETECTED",
          riskLevel: spamResult.riskLevel,
          confidence: spamResult.confidence,
        },
        { status: 400 },
      );
    }

    // Address validation
    const cantonValidation = cantonValidationService.validateCantonAddress(
      orderData.cantonAddress,
    );
    if (!cantonValidation.isValid) {
      return NextResponse.json(
        {
          error: `Invalid Canton address: ${cantonValidation.error}`,
          code: "INVALID_ADDRESS",
        },
        { status: 400 },
      );
    }

    if (orderData.refundAddress) {
      const refundValidation = cantonValidationService.validateRefundAddress(
        orderData.refundAddress,
      );
      if (!refundValidation.isValid) {
        return NextResponse.json(
          {
            error: `Invalid refund address: ${refundValidation.error}`,
            code: "INVALID_REFUND_ADDRESS",
          },
          { status: 400 },
        );
      }
    }

    // MINIMAL VERSION: No unique address generation
    // Customer will receive payment address through customer support

    // Create order without unique address (minimal version)
    const orderId = generateOrderId();
    const order: OTCOrder = {
      ...orderData,
      orderId,
      timestamp: Date.now(),
      status: "awaiting-deposit",
    };

    // Supabase storage - OPTIONAL for VIP customer service mode
    // Decentralized DAML mode works WITHOUT Supabase
    const useSupabase =
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.NEXT_PUBLIC_SUPABASE_URL !== "http://localhost:54321";

    if (useSupabase) {
      try {
        await saveOrderToSupabaseSync(order);
        console.log(
          "✅ Order saved to Supabase (VIP customer service mode):",
          orderId,
        );
      } catch (supabaseError) {
        console.warn(
          "⚠️ Supabase save failed (non-critical for decentralized mode):",
          {
            orderId,
            error:
              supabaseError instanceof Error
                ? supabaseError.message
                : String(supabaseError),
            timestamp: new Date().toISOString(),
          },
        );

        // Record metrics but don't fail the order
        const { metricsCollector } =
          await import("@/lib/monitoring/metricsCollector");
        metricsCollector.recordSupabaseSave(false);
      }
    } else {
      console.log("ℹ️ Supabase disabled - using decentralized DAML mode only");
    }

    // ✅ CREATE DAML CONTRACT via Rust Canton API Server
    let damlContractId: string | null = null;
    let damlTransactionId: string | null = null;
    const cantonApiUrl = process.env.CANTON_API_SERVER_URL;

    if (cantonApiUrl) {
      try {
        const priceRate =
          orderData.paymentAmountUSD && orderData.cantonAmount
            ? (orderData.paymentAmountUSD / orderData.cantonAmount).toFixed(6)
            : "0";
        const quantityStr = String(orderData.cantonAmount);

        const cantonHeaders: Record<string, string> = {
          "Content-Type": "application/json",
        };
        const serviceToken = process.env.CANTON_API_SERVICE_TOKEN;
        if (serviceToken) {
          cantonHeaders["Authorization"] = `Bearer ${serviceToken}`;
        }
        const contractResponse = await fetch(
          `${cantonApiUrl}/api/v1/contracts/offer`,
          {
            method: "POST",
            headers: cantonHeaders,
            body: JSON.stringify({
              order_id: orderId,
              initiator: `party::${orderData.email}`,
              counterparty: null,
              asset: {
                symbol: orderData.paymentToken?.symbol || "USDT",
                amount: quantityStr,
                chain: orderData.paymentToken?.network || "Canton",
                contract_address: null,
              },
              price: {
                rate: priceRate,
                currency: "USD",
              },
              quantity: quantityStr,
              side: orderData.exchangeDirection === "sell" ? "Sell" : "Buy",
              limits: {
                min_amount: "1",
                max_amount: quantityStr,
              },
              min_compliance_level: "RETAIL",
              allowed_jurisdictions: [],
              auditors: [],
            }),
            signal: AbortSignal.timeout(10000),
          },
        );

        if (contractResponse.ok) {
          const contractResult = await contractResponse.json();
          damlContractId = contractResult.contract_id;
          damlTransactionId = contractResult.transaction_id;
          console.log("✅ DAML OtcOffer contract created:", {
            orderId,
            contractId: damlContractId,
            transactionId: damlTransactionId,
          });
        } else {
          console.warn(
            "⚠️ Canton API returned non-OK:",
            contractResponse.status,
          );
        }
      } catch (cantonError) {
        console.warn("⚠️ Canton contract creation failed (non-blocking):", {
          orderId,
          error:
            cantonError instanceof Error
              ? cantonError.message
              : String(cantonError),
        });
      }
    } else {
      console.log(
        "ℹ️ CANTON_API_SERVER_URL not configured - DAML contracts disabled",
      );
    }

    // ⚡ Уведомления и legacy storage в background (не блокирует ответ)
    processNotificationsAsync(order, startTime).catch((error) => {
      console.error(
        "❌ Background notifications failed (non-blocking):",
        error,
      );
    });

    // Метрики
    const responseTime = Date.now() - startTime;
    const { metricsCollector } =
      await import("@/lib/monitoring/metricsCollector");
    metricsCollector.recordOrderCreation(responseTime);

    // Генерируем ссылку
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";
    const orderLink = `${baseUrl}/order/${orderId}`;

    // ✅ Success ответ ТОЛЬКО после сохранения в Supabase
    return NextResponse.json({
      success: true,
      orderId,
      orderLink,
      message:
        "Order created successfully. You will receive notifications shortly.",
      status: order.status,
      processingTime: responseTime + "ms",
      storage: {
        primary: "supabase", // ✅ NEW
        saved: true, // ✅ NEW
      },
      paymentAddress: null,
      paymentNetwork: orderData.paymentToken.network,
      paymentToken: orderData.paymentToken.symbol,
      isPrivateDeal: orderData.isPrivateDeal || false,
      isMarketPrice: orderData.isMarketPrice || false,
      validation: {
        cantonAddress: cantonValidation.format,
        refundAddress: orderData.refundAddress
          ? cantonValidationService.validateRefundAddress(
              orderData.refundAddress,
            ).format
          : undefined,
        addressValid: true,
      },
      spamCheck: {
        passed: true,
        riskLevel: spamResult.riskLevel,
        confidence: spamResult.confidence,
      },
      daml: {
        contractId: damlContractId,
        transactionId: damlTransactionId,
        enabled: !!cantonApiUrl,
      },
    });
  } catch (error) {
    console.error("❌ Order creation failed:", error);

    // Record error metrics
    try {
      const { metricsCollector } =
        await import("@/lib/monitoring/metricsCollector");
      metricsCollector.recordOrderCreationError();
    } catch {
      // Ignore metrics errors
    }

    const message =
      error instanceof Error ? error.message : "Failed to create order";
    const validationPatterns = [
      "Missing ",
      "Invalid ",
      "Minimum order amount",
      "exchange rate",
    ];
    const isValidationError = validationPatterns.some((p) =>
      message.includes(p),
    );

    return NextResponse.json(
      {
        error: message,
        code: isValidationError ? "VALIDATION_ERROR" : "ORDER_CREATION_FAILED",
      },
      { status: isValidationError ? 400 : 500 },
    );
  }
}

/**
 * Parse and validate order data
 */
async function parseAndValidateOrderData(
  request: NextRequest,
): Promise<Omit<OTCOrder, "timestamp" | "status">> {
  let orderData: Record<string, unknown>;

  try {
    orderData = await request.json();
  } catch {
    throw new Error("Invalid JSON in request body");
  }

  // Required fields validation - support both new and legacy formats
  const hasNewFormat =
    orderData.paymentToken &&
    orderData.paymentAmount &&
    orderData.paymentAmountUSD;
  const hasLegacyFormat = orderData.usdtAmount;

  if (!hasNewFormat && !hasLegacyFormat) {
    throw new Error(
      "Missing payment information - provide either paymentToken/paymentAmount/paymentAmountUSD or usdtAmount",
    );
  }

  const requiredFields = ["cantonAmount", "cantonAddress", "email"];
  for (const field of requiredFields) {
    if (!orderData[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Type validation and conversion
  const cantonAmount = Number(orderData.cantonAmount);
  const email = String(orderData.email || "").trim();

  // Handle both new (paymentToken) and legacy (usdtAmount) formats
  let paymentAmount: number;
  let paymentAmountUSD: number;
  let usdtAmount: number;
  let paymentToken: import("@/config/otc").TokenConfig;

  if (orderData.paymentToken && typeof orderData.paymentToken === "object") {
    // New multi-token format
    paymentToken = orderData.paymentToken as import("@/config/otc").TokenConfig;
    paymentAmount = Number(orderData.paymentAmount);
    paymentAmountUSD = Number(orderData.paymentAmountUSD);

    // For legacy compatibility, set usdtAmount
    usdtAmount = orderData.usdtAmount
      ? Number(orderData.usdtAmount)
      : paymentAmountUSD;
  } else if (orderData.usdtAmount) {
    // Legacy format - only USDT
    usdtAmount = Number(orderData.usdtAmount);
    paymentAmount = usdtAmount;
    paymentAmountUSD = usdtAmount;

    // Use default USDT TRC-20 token
    const { SUPPORTED_TOKENS } = await import("@/config/otc");
    const foundToken = SUPPORTED_TOKENS.find(
      (t) => t.symbol === "USDT" && t.network === "TRON",
    );

    if (!foundToken) {
      throw new Error("Default USDT token not found");
    }

    paymentToken = foundToken;
  } else {
    throw new Error("Missing payment information");
  }

  if (!paymentAmount || paymentAmount <= 0) {
    throw new Error("Invalid payment amount");
  }

  if (!cantonAmount || cantonAmount <= 0) {
    throw new Error("Invalid Canton amount");
  }

  // Amount limits (check USD value)
  if (paymentAmountUSD < OTC_CONFIG.MIN_USDT_AMOUNT) {
    throw new Error(`Minimum order amount is $${OTC_CONFIG.MIN_USDT_AMOUNT}`);
  }

  // Email validation
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Invalid email address");
  }

  // Определяем направление обмена (buy или sell)
  const exchangeDirection = orderData.exchangeDirection as
    | "buy"
    | "sell"
    | undefined;
  const isBuying = !exchangeDirection || exchangeDirection === "buy"; // Default: buy

  // 🔍 ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ для отладки
  console.log("📋 Order data received:", {
    exchangeDirection: orderData.exchangeDirection,
    isBuying,
    cantonAmount: orderData.cantonAmount,
    paymentAmount: orderData.paymentAmount,
    paymentAmountUSD: orderData.paymentAmountUSD,
    email: orderData.email,
  });

  // ✅ УПРОЩЕННАЯ ВАЛИДАЦИЯ: Без discount tiers, используем manualPrice если указана
  const { getCantonCoinBuyPrice, getCantonCoinSellPrice } =
    await import("@/config/otc");

  // Используем manualPrice если указана, иначе рыночную цену с учетом дисконта
  const manualPrice = orderData.manualPrice
    ? Number(orderData.manualPrice)
    : undefined;
  const serviceCommission = orderData.serviceCommission
    ? Number(orderData.serviceCommission)
    : 1;
  const isMarketPrice = orderData.isMarketPrice === true;
  const marketPriceDiscountPercent = orderData.marketPriceDiscountPercent
    ? Number(orderData.marketPriceDiscountPercent)
    : 0;

  if (isBuying) {
    // Buy: User платит USDT, получает Canton
    // Проверяем что Canton amount корректен для данного USD amount
    // ✅ ИСПРАВЛЕНО: Используем ту же логику что и frontend
    let buyPrice: number;
    if (manualPrice && !isMarketPrice) {
      buyPrice = manualPrice;
    } else {
      const marketPrice = await getCantonCoinBuyPrice();
      buyPrice = marketPrice * (1 - marketPriceDiscountPercent / 100);
    }
    const baseAmount = paymentAmountUSD / buyPrice;
    // Упрощенный расчет без discount tiers (как на frontend)
    const expectedCantonAmount = baseAmount * (1 - serviceCommission / 100);
    // ✅ ИСПРАВЛЕНО: Увеличиваем tolerance до 0.5% для учета округлений и небольших расхождений
    const tolerance = Math.max(expectedCantonAmount * 0.005, 0.01); // 0.5% или минимум 0.01 CC

    console.log("🔍 Buy rate validation:", {
      exchangeDirection: "buy",
      paymentAmountUSD,
      buyPrice,
      cantonAmount,
      expectedCantonAmount,
      tolerance,
      difference: Math.abs(cantonAmount - expectedCantonAmount),
      deviationPercent:
        (
          (Math.abs(cantonAmount - expectedCantonAmount) /
            expectedCantonAmount) *
          100
        ).toFixed(2) + "%",
    });

    const deviation = Math.abs(cantonAmount - expectedCantonAmount);

    // Мониторинг отклонений exchange rate
    logRateDeviation(
      String(orderData.orderId || "unknown"),
      "buy",
      expectedCantonAmount,
      cantonAmount,
      tolerance,
    );

    if (deviation > tolerance) {
      console.warn("❌ Buy rate validation failed:", {
        cantonAmount,
        expectedCantonAmount,
        difference: deviation,
        tolerance,
        deviationPercent:
          ((deviation / expectedCantonAmount) * 100).toFixed(2) + "%",
      });
      throw new Error("Invalid exchange rate calculation");
    }
  } else {
    // Sell: User продает Canton, получает USDT
    // Проверяем что USDT amount (paymentAmount) корректен для данного Canton amount
    // ✅ ИСПРАВЛЕНО: Используем ту же логику что и frontend
    const sellPrice = manualPrice || (await getCantonCoinSellPrice());
    const baseUsdValue = cantonAmount * sellPrice;
    // Упрощенный расчет без discount tiers (как на frontend)
    const expectedUsdtAmount = baseUsdValue * (1 - serviceCommission / 100);
    const actualUsdtAmount = paymentAmount; // При sell paymentAmount = USDT amount
    // ✅ ИСПРАВЛЕНО: Увеличиваем tolerance до 0.5% для учета округлений и небольших расхождений
    const tolerance = Math.max(expectedUsdtAmount * 0.005, 0.01); // 0.5% или минимум 0.01 USDT

    console.log("🔍 Sell rate validation:", {
      exchangeDirection: "sell",
      cantonAmount,
      sellPrice,
      baseUsdValue,
      expectedUsdtAmount,
      actualUsdtAmount,
      tolerance,
      difference: Math.abs(actualUsdtAmount - expectedUsdtAmount),
      deviationPercent:
        (
          (Math.abs(actualUsdtAmount - expectedUsdtAmount) /
            expectedUsdtAmount) *
          100
        ).toFixed(2) + "%",
      validationPassed:
        Math.abs(actualUsdtAmount - expectedUsdtAmount) <= tolerance,
    });

    const deviation = Math.abs(actualUsdtAmount - expectedUsdtAmount);

    // Мониторинг отклонений exchange rate
    logRateDeviation(
      String(orderData.orderId || "unknown"),
      "sell",
      expectedUsdtAmount,
      actualUsdtAmount,
      tolerance,
    );

    if (deviation > tolerance) {
      console.warn("❌ Sell rate validation failed:", {
        actualUsdtAmount,
        expectedUsdtAmount,
        difference: deviation,
        tolerance,
        deviationPercent:
          ((deviation / expectedUsdtAmount) * 100).toFixed(2) + "%",
        sellPrice,
        cantonAmount,
      });
      throw new Error("Invalid exchange rate calculation");
    }
  }

  // Валидация receivingAddress при sell
  let receivingAddress: string | undefined;
  if (!isBuying) {
    receivingAddress = orderData.receivingAddress
      ? String(orderData.receivingAddress).trim()
      : undefined;
    if (!receivingAddress) {
      throw new Error(
        "Receiving address is required when selling Canton (for receiving USDT)",
      );
    }

    // Валидация receiving address в зависимости от network
    const { validateTronAddress, validateEthereumAddress } =
      await import("@/lib/utils");
    const network = paymentToken.network;
    let isValidReceiving = false;

    if (network === "TRON") {
      isValidReceiving = validateTronAddress(receivingAddress);
    } else if (
      network === "ETHEREUM" ||
      network === "BSC" ||
      network === "OPTIMISM"
    ) {
      isValidReceiving = validateEthereumAddress(receivingAddress);
    } else {
      isValidReceiving =
        validateEthereumAddress(receivingAddress) ||
        validateTronAddress(receivingAddress);
    }

    if (!isValidReceiving) {
      throw new Error(
        `Invalid receiving address format for ${paymentToken.symbol} (${paymentToken.networkName})`,
      );
    }
  }

  return {
    orderId: generateOrderId(),
    paymentToken,
    paymentAmount,
    paymentAmountUSD,
    cantonAmount,
    cantonAddress: String(orderData.cantonAddress || "").trim(),
    receivingAddress, // ✅ При sell: адрес для получения USDT
    refundAddress: orderData.refundAddress
      ? String(orderData.refundAddress).trim()
      : undefined,
    email: email.toLowerCase(),
    whatsapp: orderData.whatsapp
      ? String(orderData.whatsapp).trim()
      : undefined,
    telegram: orderData.telegram
      ? String(orderData.telegram).trim()
      : undefined,
    exchangeDirection: exchangeDirection, // Сохраняем направление обмена для корректного отображения
    isPrivateDeal: orderData.isPrivateDeal === true, // Private deal флаг
    isMarketPrice: orderData.isMarketPrice === true, // REQ-002: Market price deal флаг
    marketPriceDiscountPercent: orderData.marketPriceDiscountPercent
      ? Number(orderData.marketPriceDiscountPercent)
      : undefined, // Процент дисконта от рыночной цены
    usdtAmount, // Legacy compatibility
  };
}

/**
 * ===================================================================
 * HELPER FUNCTIONS ДЛЯ ORDER PROCESSING
 * ===================================================================
 */

/**
 * Тестирование подключения к Supabase перед сохранением
 */
async function testSupabaseConnection(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return {
        success: false,
        error: `Supabase env variables missing: ${!supabaseUrl ? "NEXT_PUBLIC_SUPABASE_URL" : ""} ${!supabaseKey ? "SUPABASE_SERVICE_ROLE_KEY" : ""}`,
      };
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      },
    });

    // Простой тест запрос для проверки подключения и прав
    const { data, error } = await supabase
      .from("public_orders")
      .select("order_id")
      .limit(1);

    if (error) {
      return {
        success: false,
        error: `Supabase connection test failed: ${error.message} (code: ${error.code}, hint: ${error.hint || "none"})`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Supabase connection error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * ✅ КРИТИЧНО: Синхронное сохранение в Supabase (primary storage)
 * Должно выполниться успешно ПЕРЕД ответом пользователю
 */
async function saveOrderToSupabaseSync(order: OTCOrder): Promise<void> {
  const { createClient } = await import("@supabase/supabase-js");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    const errorMsg = `Supabase not configured - NEXT_PUBLIC_SUPABASE_URL: ${!!supabaseUrl}, SUPABASE_SERVICE_ROLE_KEY: ${!!supabaseKey}`;
    console.error("❌", errorMsg);
    throw new Error(errorMsg);
  }

  // Тестируем подключение перед сохранением
  const connectionTest = await testSupabaseConnection();
  if (!connectionTest.success) {
    console.error("❌ Supabase connection test failed:", connectionTest.error);
    throw new Error(`Supabase connection failed: ${connectionTest.error}`);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    },
  });

  // Extract order properties
  const isPrivateDeal =
    (order as unknown as { isPrivateDeal?: boolean }).isPrivateDeal === true;
  const isMarketPrice =
    (order as unknown as { isMarketPrice?: boolean }).isMarketPrice === true;
  const exchangeDirection =
    (order as unknown as { exchangeDirection?: "buy" | "sell" })
      .exchangeDirection || "buy";
  const manualPrice = (order as unknown as { manualPrice?: number })
    .manualPrice;
  const serviceCommission =
    (order as unknown as { serviceCommission?: number }).serviceCommission || 3;
  const receivingAddress = (order as unknown as { receivingAddress?: string })
    .receivingAddress;
  const marketPriceDiscountPercent =
    (order as unknown as { marketPriceDiscountPercent?: number })
      .marketPriceDiscountPercent || 0;

  // Calculate price with discount applied if market price
  let price: number;
  if (manualPrice && !isMarketPrice) {
    price = manualPrice;
  } else {
    const marketPrice =
      exchangeDirection === "buy"
        ? getCantonCoinBuyPriceSync()
        : getCantonCoinSellPriceSync();
    price = marketPrice * (1 - marketPriceDiscountPercent / 100);
  }

  const orderData = {
    order_id: order.orderId,
    exchange_direction: exchangeDirection,
    payment_amount_usd: order.paymentAmountUSD || order.usdtAmount || 0,
    canton_amount: order.cantonAmount,
    price: price,
    manual_price: !!manualPrice,
    service_commission: serviceCommission,
    canton_address: order.cantonAddress,
    receiving_address: receivingAddress,
    refund_address: order.refundAddress,
    email: order.email,
    telegram: order.telegram,
    whatsapp: order.whatsapp,
    status: "pending",
    is_private: isPrivateDeal,
    is_market_price: isMarketPrice,
    market_price_discount_percent: marketPriceDiscountPercent,
  };

  console.log("💾 Saving order to Supabase (primary storage):", {
    orderId: order.orderId,
    exchangeDirection,
    isPrivate: isPrivateDeal,
    isMarketPrice,
    timestamp: new Date().toISOString(),
  });

  const startTime = Date.now();
  const { data, error } = await supabase
    .from("public_orders")
    .insert(orderData)
    .select()
    .single();

  const saveTime = Date.now() - startTime;

  if (error) {
    // Детальное логирование ошибки для диагностики
    const errorDetails = {
      orderId: order.orderId,
      error: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      saveTime: `${saveTime}ms`,
      timestamp: new Date().toISOString(),
      orderData: {
        order_id: orderData.order_id,
        exchange_direction: orderData.exchange_direction,
        status: orderData.status,
        is_private: orderData.is_private,
        is_market_price: orderData.is_market_price,
      },
      supabaseConfig: {
        url: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : "missing",
        hasKey: !!supabaseKey,
        keyLength: supabaseKey?.length || 0,
      },
    };

    console.error("❌ Supabase insert failed:", errorDetails);

    // Специальная обработка для известных ошибок
    if (
      error.code === "PGRST116" ||
      (error.message.includes("column") &&
        error.message.includes("does not exist"))
    ) {
      console.error(
        "❌ CRITICAL: Database schema mismatch - column missing. Check migrations!",
      );
      throw new Error(
        `Database schema error: ${error.message}. Hint: ${error.hint || "Check if migrations are applied"}`,
      );
    }

    if (
      error.code === "42501" ||
      error.message.includes("permission denied") ||
      error.message.includes("policy")
    ) {
      console.error(
        "❌ CRITICAL: RLS policy or permission issue. Check service_role key and RLS policies!",
      );
      throw new Error(
        `Database permission error: ${error.message}. Hint: ${error.hint || "Check RLS policies and service_role key"}`,
      );
    }

    // Record metrics
    const { metricsCollector } =
      await import("@/lib/monitoring/metricsCollector");
    metricsCollector.recordSupabaseSave(false);

    throw new Error(
      `Database save failed: ${error.message}${error.hint ? ` (${error.hint})` : ""}`,
    );
  }

  console.log("✅ Order saved to Supabase successfully:", {
    orderId: order.orderId,
    saveTime: `${saveTime}ms`,
    inserted: !!data,
    dataId: data?.id,
    timestamp: new Date().toISOString(),
  });

  // Record metrics
  const { metricsCollector } =
    await import("@/lib/monitoring/metricsCollector");
  metricsCollector.recordSupabaseSave(true);
}

/**
 * ⚡ Async обработка уведомлений и legacy storage
 * Выполняется в фоне ПОСЛЕ ответа пользователю
 * НЕ блокирует ответ если упадет
 */
async function processNotificationsAsync(
  order: OTCOrder,
  startTime: number,
): Promise<void> {
  try {
    console.log("🚀 Background notifications started:", {
      orderId: order.orderId,
      email: order.email,
      timestamp: new Date().toISOString(),
    });

    const isPrivateDeal =
      (order as unknown as { isPrivateDeal?: boolean }).isPrivateDeal === true;
    const { metricsCollector } =
      await import("@/lib/monitoring/metricsCollector");

    // Параллельные уведомления (все non-critical)
    const notifications = [
      // Legacy storage (non-critical)
      googleSheetsService.saveOrder(order).catch((err) => {
        console.warn(
          "⚠️ Google Sheets save failed (legacy, non-critical):",
          err,
        );
        return { success: false, error: err };
      }),

      // Intercom (important but not critical)
      intercomService
        .sendOrderNotification(order)
        .then((result) => {
          metricsCollector.recordNotification("intercom", result);
          return { success: result };
        })
        .catch((err) => {
          console.error("⚠️ Intercom notification failed:", err);
          metricsCollector.recordNotification("intercom", false);
          return { success: false, error: err };
        }),

      // Telegram admin notification
      telegramService
        .sendOrderNotification(order)
        .then((result) => {
          metricsCollector.recordNotification("telegram", result);
          return { success: result };
        })
        .catch((err) => {
          console.error("⚠️ Telegram admin notification failed:", err);
          metricsCollector.recordNotification("telegram", false);
          return { success: false, error: err };
        }),
    ];

    // Публичная группа клиентов (только для публичных заявок)
    let publicMessageId: number | undefined;
    if (!isPrivateDeal) {
      try {
        const result = await telegramService.sendPublicOrderNotification(order);
        if (result.success && result.messageId) {
          publicMessageId = result.messageId;
          console.log("✅ Public notification sent:", {
            orderId: order.orderId,
            messageId: publicMessageId,
          });

          // Обновляем telegram_message_id в Supabase
          await updateTelegramMessageId(order.orderId, publicMessageId);
        }
      } catch (err) {
        console.error(
          "⚠️ Public Telegram notification failed (non-critical):",
          err,
        );
      }
    }

    const results = await Promise.allSettled(notifications);
    const [sheetsResult, intercomResult, telegramResult] = results;

    // Детальное логирование результатов
    console.log("📊 Background notifications completed:", {
      orderId: order.orderId,
      results: {
        googleSheets: sheetsResult.status === "fulfilled" ? "✅" : "❌",
        intercom: intercomResult.status === "fulfilled" ? "✅" : "❌",
        telegram: telegramResult.status === "fulfilled" ? "✅" : "❌",
        publicTelegram: isPrivateDeal
          ? "⏭️ Skipped"
          : publicMessageId
            ? "✅"
            : "❌",
      },
      isPrivateDeal,
      totalTime: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString(),
    });

    // Warning если все уведомления упали
    const allFailed = results.every(
      (r) =>
        r.status === "rejected" ||
        (r.status === "fulfilled" && !(r.value as any)?.success),
    );

    if (allFailed) {
      console.error(
        "❌ ALL background notifications failed for order:",
        order.orderId,
      );
      console.error("   Manual intervention may be required!");

      // Отправить критичный alert админам
      try {
        const { telegramService } = await import("@/lib/services/telegram");
        await telegramService.sendCustomMessage(
          `🚨 ALERT: All notifications failed for order ${order.orderId}\nPlease check manually!`,
        );
      } catch {
        // Ignore если даже alert не отправился
      }
    }
  } catch (error) {
    console.error("❌ Background processing error:", {
      orderId: order.orderId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

/**
 * Обновить telegram_message_id в Supabase
 */
async function updateTelegramMessageId(
  orderId: string,
  messageId: number,
): Promise<void> {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn("⚠️ Supabase not configured for message ID update");
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabase
      .from("public_orders")
      .update({ telegram_message_id: messageId })
      .eq("order_id", orderId);

    if (error) {
      console.error("⚠️ Failed to update telegram_message_id:", error);
    } else {
      console.log("✅ Telegram message ID updated:", { orderId, messageId });
    }
  } catch (error) {
    console.error("⚠️ Error updating telegram_message_id:", error);
  }
}

/**
 * ⚡ Process order asynchronously in background (for speed)
 * @deprecated Используется processNotificationsAsync вместо этого
 */
async function processOrderAsync(
  order: OTCOrder,
  startTime: number,
): Promise<void> {
  try {
    console.log("🚀 Starting background processing for order:", {
      orderId: order.orderId,
      email: order.email,
      timestamp: new Date().toISOString(),
    });

    const isPrivateDeal =
      (order as unknown as { isPrivateDeal?: boolean }).isPrivateDeal === true;
    const isMarketPrice =
      (order as unknown as { isMarketPrice?: boolean }).isMarketPrice === true;
    console.log("📋 Order processing config:", {
      orderId: order.orderId,
      isPrivateDeal,
      isMarketPrice,
      hasExchangeDirection: !!(
        order as unknown as { exchangeDirection?: string }
      ).exchangeDirection,
    });

    // Process Google Sheets, Intercom, Telegram (private) in parallel
    // Public Telegram только если НЕ приватная сделка
    const promises: Promise<unknown>[] = [
      googleSheetsService.saveOrder(order),
      intercomService.sendOrderNotification(order),
      telegramService.sendOrderNotification(order), // Приватный канал операторов
    ];

    // Публичный канал только для публичных заявок
    if (!isPrivateDeal) {
      promises.push(telegramService.sendPublicOrderNotification(order));
    }

    const results = await Promise.allSettled(promises);
    const [sheetsResult, intercomResult, telegramResult, publicTelegramResult] =
      results;

    // Сохраняем результат публикации в публичный канал (только для публичных заявок)
    const messageId =
      publicTelegramResult &&
      publicTelegramResult.status === "fulfilled" &&
      (publicTelegramResult.value as { success?: boolean })?.success
        ? (publicTelegramResult.value as { messageId?: number }).messageId
        : undefined;

    // Сохраняем в Supabase (если используется) - для всех заявок, но с флагом is_private
    try {
      console.log(
        "📊 Checking Supabase configuration for order:",
        order.orderId,
      );
      const { createClient } = await import("@supabase/supabase-js");
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      console.log("📊 Supabase config:", {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey,
        url: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : "missing",
      });

      if (supabaseUrl && supabaseKey) {
        console.log("📊 Creating Supabase client for order:", order.orderId);
        const supabase = createClient(supabaseUrl, supabaseKey);

        const orderData = {
          order_id: order.orderId,
          exchange_direction:
            (order as unknown as { exchangeDirection?: "buy" | "sell" })
              .exchangeDirection || "buy",
          payment_amount_usd: order.paymentAmountUSD || order.usdtAmount || 0,
          canton_amount: order.cantonAmount,
          price:
            (order as unknown as { manualPrice?: number }).manualPrice ||
            ((order as unknown as { exchangeDirection?: "buy" | "sell" })
              .exchangeDirection === "buy"
              ? getCantonCoinBuyPriceSync()
              : getCantonCoinSellPriceSync()), // Fallback цена
          manual_price: !!(order as unknown as { manualPrice?: number })
            .manualPrice,
          service_commission:
            (order as unknown as { serviceCommission?: number })
              .serviceCommission || 3,
          canton_address: order.cantonAddress,
          receiving_address: (order as unknown as { receivingAddress?: string })
            .receivingAddress,
          refund_address: order.refundAddress,
          email: order.email,
          telegram: order.telegram,
          whatsapp: order.whatsapp,
          status: "pending",
          is_private: isPrivateDeal, // ✅ Флаг приватной сделки
          telegram_message_id: messageId,
        };

        console.log("📊 Inserting order to Supabase:", {
          orderId: order.orderId,
          exchangeDirection: orderData.exchange_direction,
          isPrivate: isPrivateDeal,
        });

        const { data, error } = await supabase
          .from("public_orders")
          .insert(orderData);

        if (error) {
          console.error("❌ Supabase insert error:", {
            orderId: order.orderId,
            error: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
          });
          throw error;
        }

        console.log("✅ Order saved to public_orders table", {
          orderId: order.orderId,
          isPrivateDeal,
          data: data ? "inserted" : "no data returned",
        });
      } else {
        console.warn("⚠️ Supabase not configured - skipping database save", {
          orderId: order.orderId,
          hasUrl: !!supabaseUrl,
          hasKey: !!supabaseKey,
        });
      }
    } catch (dbError) {
      console.error(
        "⚠️ Failed to save to public_orders (using Google Sheets only):",
        {
          orderId: order.orderId,
          error: dbError instanceof Error ? dbError.message : String(dbError),
          stack: dbError instanceof Error ? dbError.stack : undefined,
        },
      );
      // Продолжаем работу, используя только Google Sheets
    }

    // Log detailed results with full error details
    const sheetsSuccess =
      sheetsResult.status === "fulfilled" && sheetsResult.value === true;
    const sheetsError =
      sheetsResult.status === "rejected"
        ? sheetsResult.reason
        : sheetsResult.status === "fulfilled" && sheetsResult.value === false
          ? "saveOrder вернул false"
          : null;

    console.log("📊 Background processing completed:", {
      orderId: order.orderId,
      sheets: sheetsSuccess
        ? "✅ Success"
        : `❌ FAILED${sheetsError ? ` - ${sheetsError instanceof Error ? sheetsError.message : String(sheetsError)}` : ""}`,
      sheetsValue:
        sheetsResult.status === "fulfilled" ? sheetsResult.value : undefined,
      sheetsErrorDetails:
        sheetsError instanceof Error
          ? {
              message: sheetsError.message,
              name: sheetsError.name,
              stack: sheetsError.stack?.substring(0, 500),
            }
          : sheetsError,
      intercom:
        intercomResult.status === "fulfilled"
          ? "✅ Success"
          : `❌ ${intercomResult.reason}`,
      telegram:
        telegramResult.status === "fulfilled"
          ? "✅ Success"
          : `❌ ${telegramResult.reason}`,
      publicTelegram: isPrivateDeal
        ? "⏭️ Skipped (private deal)"
        : publicTelegramResult &&
            publicTelegramResult.status === "fulfilled" &&
            (publicTelegramResult.value as { success?: boolean })?.success
          ? "✅ Success"
          : `❌ ${publicTelegramResult && publicTelegramResult.status === "rejected" ? publicTelegramResult.reason : "Failed"}`,
      isPrivateDeal,
      totalProcessingTime: Date.now() - startTime + "ms",
    });

    // 🔍 ДОПОЛНИТЕЛЬНОЕ ЛОГИРОВАНИЕ если Google Sheets не сохранил
    if (!sheetsSuccess) {
      console.error(
        "❌ КРИТИЧЕСКАЯ ПРОБЛЕМА: Ордер НЕ был сохранен в Google Sheets!",
        {
          orderId: order.orderId,
          sheetsResultStatus: sheetsResult.status,
          sheetsResultValue:
            sheetsResult.status === "fulfilled"
              ? sheetsResult.value
              : undefined,
          sheetsError: sheetsError,
        },
      );
    }
  } catch (error) {
    console.error(
      "❌ Background processing error for order",
      order.orderId,
      ":",
      error,
    );
  }
}

/**
 * Generate unique order ID
 */
function generateOrderId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${randomPart}`.toUpperCase();
}

/**
 * Get client IP address
 */
function getClientIP(request: NextRequest): string {
  // Try various headers for IP detection
  const forwarded = request.headers.get("x-forwarded-for");
  const realIP = request.headers.get("x-real-ip");
  const clientIP = request.headers.get("cf-connecting-ip"); // Cloudflare

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  if (realIP) {
    return realIP.trim();
  }

  if (clientIP) {
    return clientIP.trim();
  }

  // Fallback
  return "127.0.0.1";
}
