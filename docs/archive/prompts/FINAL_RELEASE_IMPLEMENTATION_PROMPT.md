# 🚀 ФИНАЛЬНЫЙ ПРОМПТ: Исправление критичных проблем для Production Release

## 📋 КОНТЕКСТ И ЦЕЛЬ

На основе глубокого анализа Canton OTC Platform (см. [`docs/reports/RELEASE_READINESS_REPORT.md`](../reports/RELEASE_READINESS_REPORT.md)) найдено **3 критичные проблемы (P0)**, которые блокируют production release.

**Цель**: Исправить все P0 проблемы для получения production-ready релиза.

**Estimated time**: 6-8 часов работы

---

## ⚠️ КРИТИЧНЫЕ ПРОБЛЕМЫ ДЛЯ ИСПРАВЛЕНИЯ

### PROB-001: Отсутствие Telegram Webhook Security (CRITICAL - P0)
- **Файл**: `src/app/api/telegram-mediator/webhook/route.ts`
- **Проблема**: Нет валидации что callback пришел от Telegram
- **Риск**: Любой может подделать callback и управлять заявками
- **Приоритет**: P0 (критично)

### PROB-002: Email Service Import может крашнуть (CRITICAL - P0)
- **Файл**: [`src/lib/services/telegram.ts`](../../src/lib/services/telegram.ts:670-685)
- **Проблема**: Динамический импорт без проверки существования
- **Риск**: Crash приложения при уведомлении клиента
- **Приоритет**: P0 (критично)

### PROB-003: Process Order Async без гарантий (CRITICAL - P0)
- **Файл**: [`src/app/api/create-order/route.ts`](../../src/app/api/create-order/route.ts:103-105)
- **Проблема**: Пользователь получает success но заявка может не создаться
- **Риск**: Потеря заявок, финансовые потери
- **Приоритет**: P0 (критично)

---

## 🎯 ПЛАН ИСПРАВЛЕНИЙ

### Последовательность (в порядке приоритета):

1. **PROB-001**: Telegram Webhook Security (2 hours)
   - Создать middleware для валидации
   - Добавить secret token в webhook
   - Протестировать

2. **PROB-003**: Synchronous Primary Storage (3 hours)
   - Рефакторинг create-order route
   - Сделать Supabase синхронным
   - Notifications в background
   - Протестировать

3. **PROB-002**: Email Service Safe Import (1 hour)
   - Добавить try-catch с проверкой
   - Создать stub email service
   - Протестировать

---

## 🔧 РЕАЛИЗАЦИЯ

### ✅ ЗАДАЧА 1: Telegram Webhook Security (PROB-001)

#### Шаг 1.1: Создать middleware для валидации

Создай файл `src/lib/middleware/telegramWebhookAuth.ts`:

```typescript
/**
 * Telegram Webhook Authentication Middleware
 * Валидирует что webhook запрос пришел от настоящего Telegram бота
 */

export interface TelegramUpdate {
  update_id: number;
  callback_query?: {
    id: string;
    from: {
      id: number;
      username?: string;
      first_name?: string;
    };
    data: string;
    message?: Record<string, unknown>;
  };
  message?: Record<string, unknown>;
}

/**
 * Валидация Telegram webhook используя secret token
 * Telegram отправляет X-Telegram-Bot-Api-Secret-Token header
 */
export function validateTelegramWebhook(
  body: TelegramUpdate,
  secretToken?: string
): boolean {
  // Базовая валидация структуры
  if (!body || typeof body !== 'object') {
    console.warn('⚠️ Invalid webhook body structure');
    return false;
  }
  
  // update_id обязателен
  if (!body.update_id || typeof body.update_id !== 'number' || body.update_id < 0) {
    console.warn('⚠️ Invalid or missing update_id');
    return false;
  }
  
  // Если используется secret token, header проверяется в route handler
  // Здесь просто валидируем структуру данных
  return true;
}

/**
 * Валидация secret token из header
 */
export function validateSecretToken(
  headerToken: string | null,
  expectedToken: string | undefined
): boolean {
  // Если secret token не настроен, пропускаем (legacy mode)
  if (!expectedToken) {
    console.warn('⚠️ Telegram webhook secret token not configured - using legacy mode');
    return true;
  }
  
  // Если настроен, обязательно проверяем
  if (headerToken !== expectedToken) {
    console.warn('❌ Invalid Telegram webhook secret token');
    return false;
  }
  
  return true;
}
```

#### Шаг 1.2: Обновить webhook route handler

Обнови `src/app/api/telegram-mediator/webhook/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { telegramMediatorService } from '@/lib/services/telegramMediator';
import { validateTelegramWebhook, validateSecretToken, type TelegramUpdate } from '@/lib/middleware/telegramWebhookAuth';

export const dynamic = 'force-dynamic';

/**
 * Telegram Webhook Handler
 * Обрабатывает callback queries и сообщения от Telegram бота
 * 
 * SECURITY: Валидирует webhook используя secret token
 */
export async function POST(request: NextRequest) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_MEDIATOR_BOT_TOKEN;
    const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;
    
    if (!botToken) {
      console.error('❌ Telegram bot not configured');
      return NextResponse.json(
        { error: 'Bot not configured' },
        { status: 500 }
      );
    }
    
    // ✅ SECURITY: Проверка secret token из header
    const headerToken = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    
    if (!validateSecretToken(headerToken, secretToken)) {
      console.warn('❌ Unauthorized webhook request', {
        hasHeaderToken: !!headerToken,
        hasExpectedToken: !!secretToken,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
      });
      
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Parse body
    const body: TelegramUpdate = await request.json();
    
    // ✅ SECURITY: Валидация структуры webhook данных
    if (!validateTelegramWebhook(body, secretToken)) {
      console.warn('❌ Invalid webhook data structure', {
        hasUpdateId: !!body.update_id,
        hasCallbackQuery: !!body.callback_query,
        hasMessage: !!body.message
      });
      
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400 }
      );
    }
    
    console.log('✅ Webhook validated successfully', {
      updateId: body.update_id,
      hasCallback: !!body.callback_query,
      hasMessage: !!body.message
    });
    
    // Обработка callback query
    if (body.callback_query) {
      const success = await telegramMediatorService.handleCallbackQuery(body.callback_query);
      
      return NextResponse.json({
        ok: true,
        result: success
      });
    }
    
    // Обработка обычного сообщения
    if (body.message) {
      const success = await telegramMediatorService.handleOperatorMessage(body.message as any);
      
      return NextResponse.json({
        ok: true,
        result: success
      });
    }
    
    // Неизвестный тип обновления
    console.warn('⚠️ Unknown update type:', Object.keys(body));
    return NextResponse.json({
      ok: true,
      result: false
    });
    
  } catch (error) {
    console.error('❌ Webhook handler error:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

#### Шаг 1.3: Настройка Telegram Webhook с Secret Token

Создай файл `scripts/setup-telegram-webhook.sh`:

```bash
#!/bin/bash
# Настройка Telegram webhook с secret token

# Проверка переменных окружения
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
  echo "❌ TELEGRAM_BOT_TOKEN не установлен"
  exit 1
fi

if [ -z "$TELEGRAM_WEBHOOK_SECRET" ]; then
  echo "⚠️ TELEGRAM_WEBHOOK_SECRET не установлен. Генерирую..."
  TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 32)
  echo "✅ Secret token сгенерирован: $TELEGRAM_WEBHOOK_SECRET"
  echo ""
  echo "📋 Добавьте в GitHub Secrets:"
  echo "gh secret set TELEGRAM_WEBHOOK_SECRET -b \"$TELEGRAM_WEBHOOK_SECRET\""
  echo ""
  echo "📋 Или добавьте в .env:"
  echo "TELEGRAM_WEBHOOK_SECRET=$TELEGRAM_WEBHOOK_SECRET"
  echo ""
fi

# URL вашего webhook
WEBHOOK_URL="${NEXT_PUBLIC_BASE_URL:-https://stage.minimal.build.infra.1otc.cc}/api/telegram-mediator/webhook"

echo "🔧 Настройка Telegram webhook..."
echo "URL: $WEBHOOK_URL"

# Установка webhook
RESPONSE=$(curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"$WEBHOOK_URL\",
    \"secret_token\": \"$TELEGRAM_WEBHOOK_SECRET\",
    \"allowed_updates\": [\"message\", \"callback_query\"]
  }")

# Проверка результата
if echo "$RESPONSE" | grep -q '"ok":true'; then
  echo "✅ Webhook настроен успешно!"
  echo "$RESPONSE" | jq .
else
  echo "❌ Ошибка настройки webhook:"
  echo "$RESPONSE" | jq .
  exit 1
fi

# Проверка webhook info
echo ""
echo "📊 Информация о webhook:"
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo" | jq .
```

Сделай скрипт исполняемым:
```bash
chmod +x scripts/setup-telegram-webhook.sh
```

#### Шаг 1.4: Обновить GitHub Secrets

Добавь в GitHub Secrets:

```bash
# Генерация secret token
openssl rand -hex 32

# Добавление в GitHub
gh secret set TELEGRAM_WEBHOOK_SECRET -b "<generated_token>"
```

Для Kubernetes:

```bash
kubectl create secret generic telegram-webhook \
  --from-literal=TELEGRAM_WEBHOOK_SECRET="<generated_token>" \
  -n canton-otc
```

---

### ✅ ЗАДАЧА 2: Synchronous Primary Storage (PROB-003)

#### Шаг 2.1: Рефакторинг create-order route

Обнови [`src/app/api/create-order/route.ts`](../../src/app/api/create-order/route.ts):

Найди функцию `POST` и измени логику (строки 93-145):

```typescript
// Замени эти строки (93-145)
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

    // Create order
    const orderId = generateOrderId()
    const order: OTCOrder = {
      ...orderData,
      orderId,
      timestamp: Date.now(),
      status: 'awaiting-deposit'
    }

    // ✅ КРИТИЧНО: Сначала сохраняем в Supabase (primary storage) СИНХРОННО
    try {
      await saveOrderToSupabase(order);
      console.log('✅ Order saved to Supabase (primary storage):', orderId);
    } catch (supabaseError) {
      console.error('❌ Failed to save to Supabase:', {
        orderId,
        error: supabaseError instanceof Error ? supabaseError.message : String(supabaseError),
        stack: supabaseError instanceof Error ? supabaseError.stack : undefined
      });
      
      // ❌ ВОЗВРАЩАЕМ ОШИБКУ - не создаем заявку если primary storage упал
      return NextResponse.json(
        { 
          error: 'Failed to create order. Please try again.',
          code: 'DATABASE_ERROR'
        },
        { status: 500 }
      );
    }

    // ⚡ Остальные операции в background (не критично для ответа)
    processNotificationsAsync(order, startTime).catch(error => {
      console.error('❌ Background notifications failed:', error);
      // Логируем но не блокируем ответ
    });

    // Записываем метрики мониторинга
    const responseTime = Date.now() - startTime;

    // Генерируем ссылку на заявку
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                    'http://localhost:3000'
    const orderLink = `${baseUrl}/order/${orderId}`

    // ✅ Return success только после успешного сохранения в Supabase
    return NextResponse.json({
      success: true,
      orderId,
      orderLink,
      message: 'Order created successfully. Notifications are being sent.',
      status: order.status,
      processingTime: responseTime + 'ms',
      paymentAddress: null,
      paymentNetwork: orderData.paymentToken.network,
      paymentToken: orderData.paymentToken.symbol,
      isPrivateDeal: orderData.isPrivateDeal || false,
      isMarketPrice: orderData.isMarketPrice || false,
      notifications: {
        supabase: true, // primary storage
        background: true // notifications в процессе
      },
      validation: {
        cantonAddress: cantonValidation.format,
        refundAddress: orderData.refundAddress ? cantonValidationService.validateRefundAddress(orderData.refundAddress).format : undefined,
        addressValid: true
      },
      spamCheck: {
        passed: true,
        riskLevel: spamResult.riskLevel,
        confidence: spamResult.confidence
      }
    })
    
  } catch (error) {
    console.error('❌ Order creation failed:', error)
    
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
```

#### Шаг 2.2: Добавить функции для Supabase и notifications

Добавь после функции `POST` (после строки 171):

```typescript
/**
 * ✅ Синхронное сохранение в Supabase (primary storage)
 * Критично: должно выполниться успешно перед ответом пользователю
 */
async function saveOrderToSupabase(order: OTCOrder): Promise<void> {
  const { createClient } = await import('@supabase/supabase-js');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase not configured - cannot create order');
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    }
  });
  
  const isPrivateDeal = (order as unknown as { isPrivateDeal?: boolean }).isPrivateDeal === true;
  const isMarketPrice = (order as unknown as { isMarketPrice?: boolean }).isMarketPrice === true;
  const exchangeDirection = (order as unknown as { exchangeDirection?: 'buy' | 'sell' }).exchangeDirection || 'buy';
  const manualPrice = (order as unknown as { manualPrice?: number }).manualPrice;
  const serviceCommission = (order as unknown as { serviceCommission?: number }).serviceCommission || 3;
  const receivingAddress = (order as unknown as { receivingAddress?: string }).receivingAddress;
  
  // Вычисляем цену
  let price: number;
  if (manualPrice && !isMarketPrice) {
    price = manualPrice;
  } else {
    price = exchangeDirection === 'buy' ? getCantonCoinBuyPriceSync() : getCantonCoinSellPriceSync();
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
    status: 'pending',
    is_private: isPrivateDeal,
    is_market_price: isMarketPrice
  };
  
  console.log('📊 Inserting order to Supabase:', {
    orderId: order.orderId,
    exchangeDirection,
    isPrivate: isPrivateDeal,
    isMarketPrice
  });
  
  const { data, error } = await supabase
    .from('public_orders')
    .insert(orderData)
    .select()
    .single();
  
  if (error) {
    console.error('❌ Supabase insert error:', {
      orderId: order.orderId,
      error: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    });
    throw new Error(`Database error: ${error.message}`);
  }
  
  console.log('✅ Order inserted to public_orders table:', {
    orderId: order.orderId,
    isPrivateDeal,
    inserted: !!data
  });
}

/**
 * ⚡ Async обработка уведомлений (не критично для ответа)
 * Выполняется в фоне после ответа пользователю
 */
async function processNotificationsAsync(order: OTCOrder, startTime: number): Promise<void> {
  try {
    console.log('🚀 Starting background notifications for order:', {
      orderId: order.orderId,
      email: order.email,
      timestamp: new Date().toISOString()
    });

    const isPrivateDeal = (order as unknown as { isPrivateDeal?: boolean }).isPrivateDeal === true;
    
    // Параллельная отправка уведомлений (не критично если упадут)
    const notifications = [
      googleSheetsService.saveOrder(order).catch(err => {
        console.error('⚠️ Google Sheets save failed (non-critical):', err);
        return false;
      }),
      intercomService.sendOrderNotification(order).catch(err => {
        console.error('⚠️ Intercom notification failed (non-critical):', err);
        return false;
      }),
      telegramService.sendOrderNotification(order).catch(err => {
        console.error('⚠️ Telegram admin notification failed (non-critical):', err);
        return false;
      })
    ];
    
    // Публичный канал только для публичных заявок
    let publicMessageId: number | undefined;
    if (!isPrivateDeal) {
      try {
        const result = await telegramService.sendPublicOrderNotification(order);
        if (result.success && result.messageId) {
          publicMessageId = result.messageId;
          console.log('✅ Public notification sent:', { orderId: order.orderId, messageId: publicMessageId });
        }
      } catch (err) {
        console.error('⚠️ Public Telegram notification failed (non-critical):', err);
      }
    }
    
    const results = await Promise.allSettled(notifications);
    
    // Обновляем telegram_message_id если есть
    if (publicMessageId) {
      try {
        await updateTelegramMessageId(order.orderId, publicMessageId);
      } catch (updateErr) {
        console.error('⚠️ Failed to update telegram_message_id:', updateErr);
      }
    }
    
    // Логируем результаты
    const [sheetsResult, intercomResult, telegramResult] = results;
    
    console.log('📊 Background notifications completed:', {
      orderId: order.orderId,
      sheets: sheetsResult.status === 'fulfilled' && sheetsResult.value ? '✅' : '⚠️',
      intercom: intercomResult.status === 'fulfilled' && intercomResult.value ? '✅' : '⚠️',
      telegram: telegramResult.status === 'fulfilled' && telegramResult.value ? '✅' : '⚠️',
      publicTelegram: isPrivateDeal ? '⏭️ Skipped (private)' : (publicMessageId ? '✅' : '⚠️'),
      isPrivateDeal,
      totalProcessingTime: Date.now() - startTime + 'ms'
    });
    
  } catch (error) {
    console.error('❌ Background processing error:', {
      orderId: order.orderId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Обновить telegram_message_id в Supabase
 */
async function updateTelegramMessageId(orderId: string, messageId: number): Promise<void> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) return;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    await supabase
      .from('public_orders')
      .update({ telegram_message_id: messageId })
      .eq('order_id', orderId);
      
    console.log('✅ Telegram message ID updated:', { orderId, messageId });
  } catch (error) {
    console.error('⚠️ Failed to update telegram_message_id:', error);
  }
}
```

#### Шаг 2.3: Удалить старую функцию processOrderAsync

Найди и УДАЛИ функцию `processOrderAsync` (строки около 418-573), так как мы заменили её на `processNotificationsAsync`.

---

### ✅ ЗАДАЧА 3: Email Service Safe Import (PROB-002)

#### Шаг 3.1: Создать stub Email Service

Создай файл `src/lib/services/email.ts`:

```typescript
/**
 * 📧 Email Service
 * Stub implementation - готов к расширению
 */

import { OTCOrder } from '@/config/otc';

class EmailService {
  private configured: boolean = false;
  
  constructor() {
    // Проверка конфигурации
    this.configured = !!(
      process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASSWORD &&
      process.env.EMAIL_FROM
    );
    
    if (!this.configured) {
      console.warn('⚠️ Email service not configured - stub mode');
    }
  }
  
  /**
   * Отправка уведомления о статусе заявки
   */
  async sendStatusUpdate(
    order: OTCOrder,
    status: string,
    message: string
  ): Promise<boolean> {
    if (!this.configured) {
      console.log('📧 Email service (stub) - would send:', {
        to: order.email,
        subject: `Canton OTC - Order ${order.orderId} - ${status}`,
        message
      });
      return false;
    }
    
    try {
      // TODO: Реализовать actual email sending через nodemailer
      // const transporter = nodemailer.createTransport({...});
      // await transporter.sendMail({...});
      
      console.log('📧 Email sent (stub):', {
        to: order.email,
        subject: `Canton OTC - Order ${order.orderId} - ${status}`
      });
      
      return false; // Пока stub
    } catch (error) {
      console.error('❌ Email sending failed:', error);
      return false;
    }
  }
  
  /**
   * Проверка что сервис доступен
   */
  isAvailable(): boolean {
    return this.configured;
  }
}

export const emailService = new EmailService();
```

#### Шаг 3.2: Обновить telegram.ts с безопасным импортом

Обнови [`src/lib/services/telegram.ts`](../../src/lib/services/telegram.ts), найди метод `notifyCustomer` (строки 619-702) и замени:

```typescript
/**
 * Отправка уведомления клиенту о принятии заявки
 * Использует fallback: Telegram Client → Intercom → Email
 */
async notifyCustomer(order: OTCOrder, operatorUsername: string, chatLink: string): Promise<boolean> {
  let telegramClientSuccess = false;
  let intercomSuccess = false;
  let emailSuccess = false;
  
  const notificationMessage = `Ваша заявка #${order.orderId} принята оператором ${operatorUsername}. Свяжитесь через: ${chatLink}`;
  
  // 1. Пробуем Telegram Client API (если у клиента есть Telegram username)
  if (order.telegram) {
    try {
      const { telegramClientService } = await import('@/lib/services/telegramClient');
      telegramClientSuccess = await telegramClientService.notifyCustomerAboutOrder(
        {
          orderId: order.orderId,
          email: order.email,
          telegram: order.telegram,
          exchangeDirection: (order as unknown as { exchangeDirection?: 'buy' | 'sell' }).exchangeDirection,
          paymentAmountUSD: order.paymentAmountUSD || order.usdtAmount || 0,
          cantonAmount: order.cantonAmount,
          paymentToken: order.paymentToken
        },
        operatorUsername,
        chatLink
      );
      
      if (telegramClientSuccess) {
        console.log('✅ Customer notified via Telegram Client:', order.orderId);
        return true; // Telegram Client - самый быстрый и надежный канал
      }
    } catch (error) {
      console.warn('⚠️ Telegram Client notification failed:', error);
    }
  }
  
  // 2. Пробуем Intercom (основной канал)
  try {
    const { intercomService } = await import('@/lib/services/intercom');
    intercomSuccess = await intercomService.sendStatusUpdate(
      order,
      'accepted',
      notificationMessage
    );
    
    if (intercomSuccess) {
      console.log('✅ Customer notified via Intercom:', order.orderId);
    }
  } catch (error) {
    console.warn('⚠️ Intercom notification failed:', error);
  }
  
  // 3. ✅ ИСПРАВЛЕНО: Fallback на Email с безопасным импортом
  if (!intercomSuccess) {
    try {
      // Пробуем импортировать email service
      const emailModule = await import('@/lib/services/email').catch(() => null);
      
      if (emailModule && emailModule.emailService) {
        const { emailService } = emailModule;
        
        // Проверяем что сервис доступен
        if (typeof emailService.sendStatusUpdate === 'function') {
          try {
            emailSuccess = await emailService.sendStatusUpdate(
              order,
              'accepted',
              notificationMessage
            );
            
            if (emailSuccess) {
              console.log('✅ Customer notified via Email:', order.orderId);
            } else {
              console.warn('⚠️ Email service available but not configured');
            }
          } catch (sendError) {
            console.warn('⚠️ Email sending failed:', sendError);
          }
        } else {
          console.warn('⚠️ Email service sendStatusUpdate method not available');
        }
      } else {
        console.log('ℹ️ Email service module not loaded (stub mode)');
      }
    } catch (error) {
      // Не критично - просто логируем
      console.warn('⚠️ Email service error (non-critical):', 
        error instanceof Error ? error.message : String(error)
      );
    }
  }
  
  // Считаем успешным если хотя бы один канал сработал
  const success = telegramClientSuccess || intercomSuccess || emailSuccess;
  
  if (!success) {
    console.error('❌ All notification channels failed for order:', order.orderId);
  } else {
    console.log('✅ Customer notification sent (channels):', {
      orderId: order.orderId,
      telegramClient: telegramClientSuccess,
      intercom: intercomSuccess,
      email: emailSuccess
    });
  }
  
  return success;
}
```

---

## ✅ ТЕСТИРОВАНИЕ

### Test 1: Telegram Webhook Security

```bash
# 1. Настрой webhook с secret token
./scripts/setup-telegram-webhook.sh

# 2. Попробуй отправить fake webhook без secret
curl -X POST https://your-app.com/api/telegram-mediator/webhook \
  -H "Content-Type: application/json" \
  -d '{"update_id": 123, "callback_query": {"id": "test", "data": "accept_order:TEST"}}'
# Expected: 401 Unauthorized

# 3. Попробуй с неправильным secret
curl -X POST https://your-app.com/api/telegram-mediator/webhook \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Token: wrong_secret" \
  -d '{"update_id": 123, "callback_query": {"id": "test", "data": "accept_order:TEST"}}'
# Expected: 401 Unauthorized

# 4. Настоящий webhook от Telegram должен работать
# (будет содержать правильный secret token в header)
```

### Test 2: Synchronous Supabase Storage

```bash
# 1. Создай заявку с работающим Supabase
curl -X POST https://your-app.com/api/create-order \
  -H "Content-Type: application/json" \
  -d @test-order.json
# Expected: 200 OK, orderId в ответе

# 2. Проверь Supabase - заявка должна быть там СРАЗУ
# SELECT * FROM public_orders WHERE order_id = '<orderId>';

# 3. Симулируй падение Supabase (отключи в .env)
# Создай заявку
# Expected: 500 DATABASE_ERROR
# Пользователь НЕ получает success если Supabase упал

# 4. Восстанови Supabase, проверь что заявка НЕ создалась
# (не должно быть потерянных заявок)
```

### Test 3: Email Service Safe Import

```bash
# 1. Проверь что email service загружается без краша
# В консоли должно быть: "Email service not configured - stub mode"

# 2. Оператор принимает заявку
# Intercom fails → Email should try gracefully
# Не должно быть crash

# 3. Проверь логи:
# "Email service module not loaded (stub mode)" - OK
# или
# "Email service available but not configured" - OK
# НЕ должно быть unhandled errors
```

---

## 📋 ФИНАЛЬНЫЙ CHECKLIST

После реализации проверь:

### Код
- [ ] `src/lib/middleware/telegramWebhookAuth.ts` создан
- [ ] `src/app/api/telegram-mediator/webhook/route.ts` обновлен с security
- [ ] `scripts/setup-telegram-webhook.sh` создан и исполняемый
- [ ] `src/app/api/create-order/route.ts` рефакторинг выполнен
- [ ] Функции `saveOrderToSupabase` и `processNotificationsAsync` добавлены
- [ ] Старая `processOrderAsync` удалена
- [ ] `src/lib/services/email.ts` создан (stub)
- [ ] `src/lib/services/telegram.ts` метод `notifyCustomer` обновлен

### Конфигурация
- [ ] `TELEGRAM_WEBHOOK_SECRET` добавлен в GitHub Secrets
- [ ] `TELEGRAM_WEBHOOK_SECRET` добавлен в K8s secrets (если используется)
- [ ] Telegram webhook настроен с secret token
- [ ] Webhook info проверен: `curl https://api.telegram.org/bot<token>/getWebhookInfo`

### Тестирование
- [ ] Webhook security test passed (401 без secret)
- [ ] Order creation with Supabase working
- [ ] Order creation fails gracefully if Supabase down
- [ ] Email service не крашит app при Intercom failure
- [ ] Все логи чистые (нет unhandled errors)

### Мониторинг
- [ ] Проверь логи создания заявок - должны быть "✅ Order saved to Supabase"
- [ ] Проверь логи webhook - должны быть "✅ Webhook validated successfully"
- [ ] Проверь логи notifications - должны быть "📊 Background notifications completed"

---

## 🚀 DEPLOYMENT PLAN

### 1. Pre-deployment (15 min)

```bash
# 1. Backup Supabase
# (через Supabase dashboard или pg_dump)

# 2. Commit и push changes
git add .
git commit -m "fix(critical): P0 issues - webhook security, sync storage, safe email import"
git push origin main

# 3. Verify build passes
# GitHub Actions должен успешно собрать
```

### 2. Setup Secrets (10 min)

```bash
# GitHub Secrets
gh secret set TELEGRAM_WEBHOOK_SECRET -b "$(openssl rand -hex 32)"

# Kubernetes (если используется)
kubectl create secret generic telegram-webhook \
  --from-literal=TELEGRAM_WEBHOOK_SECRET="$(openssl rand -hex 32)" \
  -n canton-otc
  
# Обновить deployment чтобы использовать secret
```

### 3. Configure Webhook (5 min)

```bash
# Run setup script
export TELEGRAM_BOT_TOKEN="your_token"
export TELEGRAM_WEBHOOK_SECRET="your_secret"
export NEXT_PUBLIC_BASE_URL="https://your-domain.com"

./scripts/setup-telegram-webhook.sh

# Verify
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

### 4. Deploy (5 min)

```bash
# Trigger deployment
# (GitHub Actions или kubectl apply)

# Wait for healthy status
kubectl get pods -n canton-otc
# Все поды должны быть Running
```

### 5. Verification (20 min)

```bash
# 1. Health check
curl https://your-domain.com/api/health

# 2. Create test order
curl -X POST https://your-domain.com/api/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "cantonAddress": "0x...",
    "email": "test@example.com",
    "cantonAmount": 100,
    "paymentAmount": 20,
    "paymentAmountUSD": 20,
    "paymentToken": {
      "symbol": "USDT",
      "network": "TRON",
      "networkName": "TRON (TRC-20)"
    },
    "exchangeDirection": "buy"
  }'

# 3. Verify in Supabase
# Заявка должна быть в public_orders СРАЗУ

# 4. Check logs
kubectl logs -f deployment/canton-otc -n canton-otc
# Должны быть:
# "✅ Order saved to Supabase (primary storage)"
# "📊 Background notifications completed"

# 5. Test webhook security
# Попробуй fake webhook - должен вернуть 401
```

### 6. Monitoring (1st hour)

Следи за:
- ✅ Order creation success rate (должен быть >99%)
- ✅ Supabase save success rate (должен быть 100%)
- ✅ Webhook validation rate (все должны проходить)
- ❌ Errors в логах (должно быть <1%)

### 7. Rollback Plan

Если что-то не так:

```bash
# Откат deployment
kubectl rollout undo deployment/canton-otc -n canton-otc

# Проверка
kubectl rollout status deployment/canton-otc -n canton-otc

# Verify old version works
curl https://your-domain.com/api/health
```

---

## 📝 SUMMARY

После выполнения всех задач:

✅ **PROB-001 FIXED**: Telegram webhook защищен secret token  
✅ **PROB-002 FIXED**: Email service import безопасный с fallback  
✅ **PROB-003 FIXED**: Supabase сохранение синхронное, заявки не теряются

**Результат**: ✅ **PRODUCTION READY** (с учетом P1 рисков)

**Следующие шаги после релиза**:
1. Мониторинг в течение первых 24 часов
2. Исправление P1 проблем в течение недели (см. отчет)
3. Добавление полноценного email sending
4. Улучшение мониторинга и алертов

---

**Estimated total time**: 6-8 hours  
**Priority**: CRITICAL (P0)  
**Status**: Ready for implementation

**Автор промпта**: AI Assistant (Claude Sonnet 4.5)  
**Дата**: 2026-01-02  
**Для использования**: Code mode

---

Этот промпт готов к использованию в Code mode для исправления всех критичных проблем.
