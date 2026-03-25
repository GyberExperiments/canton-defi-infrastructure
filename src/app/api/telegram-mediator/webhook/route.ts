/**
 * 🤖 Telegram Mediator Bot Webhook
 * Обрабатывает сообщения от операторов и callback queries
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { telegramMediatorService } from '@/lib/services/telegramMediator'
import { 
  isValidTelegramUpdate, 
  isValidCallbackQuery, 
  isFromAllowedChat,
  checkWebhookRateLimit 
} from '@/lib/middleware/telegramWebhookAuth';
import { metricsCollector } from '@/lib/monitoring/metricsCollector';

// Принудительно делаем route динамическим
export const dynamic = 'force-dynamic';

/**
 * Verify Telegram webhook secret token
 * Telegram Bot API использует простую строку в заголовке x-telegram-bot-api-secret-token,
 * а не HMAC подпись. Просто сравниваем строки.
 */
function verifyTelegramSecretToken(
  receivedToken: string,
  expectedSecret: string
): boolean {
  try {
    // Простое сравнение строк (timing-safe для защиты от timing attacks)
    return crypto.timingSafeEqual(
      Buffer.from(receivedToken, 'utf8'),
      Buffer.from(expectedSecret, 'utf8')
    )
  } catch (error) {
    console.error('❌ Telegram secret token verification failed:', error)
    return false
  }
}

/**
 * Handle Telegram webhook
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.text()
    const signature = request.headers.get('x-telegram-bot-api-secret-token')
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET || 
                          process.env.TELEGRAM_MEDIATOR_WEBHOOK_SECRET; // Fallback для совместимости

    // Verify webhook secret token if secret is configured
    if (webhookSecret && signature) {
      if (!verifyTelegramSecretToken(signature, webhookSecret)) {
        console.warn('⚠️ Telegram Mediator webhook: Invalid secret token', {
          receivedLength: signature?.length,
          expectedLength: webhookSecret?.length,
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
          timestamp: new Date().toISOString()
        })
        metricsCollector.recordWebhookValidation(false);
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
    } else if (webhookSecret && !signature) {
      console.warn('⚠️ Telegram Mediator webhook: Secret configured but no token received')
      metricsCollector.recordWebhookValidation(false);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const data = JSON.parse(payload)

    // ✅ RATE LIMITING для webhook
    const identifier = `webhook:${data.update_id ? (data.update_id % 1000) : 'unknown'}`;
    if (!checkWebhookRateLimit(identifier)) {
      metricsCollector.recordWebhookValidation(false);
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    // ✅ СТРУКТУРА валидация
    if (!isValidTelegramUpdate(data)) {
      metricsCollector.recordWebhookValidation(false);
      return NextResponse.json(
        { error: 'Invalid update structure' },
        { status: 400 }
      );
    }

    // ✅ CALLBACK QUERY валидация (если есть)
    if (data.callback_query && !isValidCallbackQuery(data.callback_query)) {
      metricsCollector.recordWebhookValidation(false);
      return NextResponse.json(
        { error: 'Invalid callback query' },
        { status: 400 }
      );
    }

    // ✅ ALLOWED CHATS проверка
    if (data.callback_query?.message?.chat?.id) {
      const chatId = data.callback_query.message.chat.id;
      const allowed = isFromAllowedChat(chatId, [
        process.env.TELEGRAM_CHAT_ID,
        process.env.TELEGRAM_CLIENT_GROUP_CHAT_ID
      ]);
      
      if (!allowed) {
        console.warn('⚠️ Callback from non-allowed chat (monitoring)', { chatId });
        // Не блокируем, но мониторим
      }
    }

    metricsCollector.recordWebhookValidation(true);

    console.log('✅ Webhook fully validated', {
      updateId: data.update_id,
      type: data.callback_query ? 'callback' : data.message ? 'message' : 'other',
      timestamp: new Date().toISOString()
    });
    
    // Handle different types of updates
    if (data.callback_query) {
      // Handle inline keyboard callbacks
      try {
        console.log('🔍 Processing callback query:', {
          id: data.callback_query.id,
          data: data.callback_query.data,
          from: data.callback_query.from?.first_name,
          timestamp: new Date().toISOString()
        });
        
        const handled = await telegramMediatorService.handleCallbackQuery(data.callback_query)
        
        // Получаем информацию о заявке если это accept_order
        let orderInfo = null;
        if (data.callback_query.data?.startsWith('accept_order:')) {
          const orderId = data.callback_query.data.replace('accept_order:', '');
          try {
            const { createClient } = await import('@supabase/supabase-js');
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
            
            if (supabaseUrl && supabaseKey) {
              const supabase = createClient(supabaseUrl, supabaseKey);
              const { data: order } = await supabase
                .from('public_orders')
                .select('*')
                .eq('order_id', orderId)
                .single();
              
              if (order) {
                orderInfo = {
                  orderId: order.order_id,
                  email: order.email,
                  telegram: order.telegram,
                  whatsapp: order.whatsapp,
                  status: order.status,
                  operatorId: order.operator_id,
                  operatorUsername: order.operator_username,
                  // ✅ ID клиента в Intercom (используем email как user_id)
                  customerId: order.email, // Intercom использует email как user_id
                  intercomUserId: order.email // Для поиска в Intercom API
                };
              }
            }
          } catch (error) {
            console.warn('⚠️ Could not fetch order info for response:', error);
          }
        }
        
        console.log('✅ Callback query processed:', {
          id: data.callback_query.id,
          handled,
          orderInfo,
          callbackData: data.callback_query.data,
          operatorId: data.callback_query.from?.id,
          operatorUsername: data.callback_query.from?.username,
          timestamp: new Date().toISOString()
        });
        
        return NextResponse.json({ 
          success: true,
          handled,
          type: 'callback_query',
          orderInfo, // ✅ Добавляем информацию о заявке и клиенте (включая customerId)
          operator: {
            id: data.callback_query.from?.id,
            username: data.callback_query.from?.username,
            firstName: data.callback_query.from?.first_name
          },
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        console.error('❌ Failed to handle callback query:', {
          id: data.callback_query.id,
          data: data.callback_query.data,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString()
        });
        
        return NextResponse.json({ 
          success: false,
          error: error instanceof Error ? error.message : 'Callback query handling failed',
          type: 'callback_query',
          timestamp: new Date().toISOString()
        }, { status: 500 })
      }
    }
    
    if (data.message) {
      // ✅ Обработка команды /start с параметром order_ (для тейкеров)
      if (data.message.text && data.message.text.startsWith('/start')) {
        try {
          const text = data.message.text;
          const chatId = data.message.chat?.id;
          const userId = data.message.from?.id;
          const isPrivate = data.message.chat?.type === 'private';
          
          // Извлекаем параметр из команды /start order_ORDER_ID
          const match = text.match(/\/start\s+order_(.+)/);
          
          if (match && isPrivate && chatId && userId) {
            const orderId = match[1];
            
            console.log('🔍 Processing /start command with order:', {
              orderId,
              userId,
              chatId,
              timestamp: new Date().toISOString()
            });
            
            // Отправляем автоматическое сообщение с номером заявки
            const { telegramService } = await import('@/lib/services/telegram');
            const welcomeMessage = `✅ <b>Заявка №${orderId}</b>\n\n` +
              `Хочу принять сделку.\n\n` +
              `📋 <b>Номер заявки:</b> <code>${orderId}</code>\n\n` +
              `💬 <b>Ожидаю связи с оператором для уточнения деталей.</b>`;
            
            // Отправляем сообщение тейкеру
            const axios = (await import('axios')).default;
            const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_MEDIATOR_BOT_TOKEN;
            
            if (botToken) {
              await axios.post(
                `https://api.telegram.org/bot${botToken}/sendMessage`,
                {
                  chat_id: chatId,
                  text: welcomeMessage,
                  parse_mode: 'HTML'
                },
                {
                  timeout: 10000,
                  headers: { 'Content-Type': 'application/json' }
                }
              );
              
              // Уведомляем оператора о том, что тейкер начал диалог
              const operatorChatId = process.env.TELEGRAM_CHAT_ID;
              if (operatorChatId) {
                const operatorNotification = `💬 <b>Тейкер начал диалог</b>\n\n` +
                  `📋 <b>Order ID:</b> <code>${orderId}</code>\n` +
                  `👤 <b>Тейкер:</b> @${data.message.from?.username || 'тейкер'}\n` +
                  `🆔 <b>ID:</b> <code>${userId}</code>\n\n` +
                  `💬 Тейкер готов принять сделку. Свяжитесь с ним для уточнения деталей.`;
                
                await axios.post(
                  `https://api.telegram.org/bot${botToken}/sendMessage`,
                  {
                    chat_id: operatorChatId,
                    text: operatorNotification,
                    parse_mode: 'HTML'
                  },
                  {
                    timeout: 10000,
                    headers: { 'Content-Type': 'application/json' }
                  }
                );
              }
              
              console.log('✅ /start command processed:', {
                orderId,
                userId,
                timestamp: new Date().toISOString()
              });
            }
            
            return NextResponse.json({ 
              success: true,
              handled: true,
              type: 'start_command',
              orderId,
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error('❌ Failed to handle /start command:', error);
          // Продолжаем обработку как обычное сообщение
        }
      }
      
      // Handle text messages from operators or bot in groups
      try {
        console.log('🔍 Processing message:', {
          messageId: data.message.message_id,
          from: data.message.from?.first_name,
          text: data.message.text?.substring(0, 100),
          chatId: data.message.chat?.id,
          chatType: data.message.chat?.type,
          chatTitle: data.message.chat?.title,
          isBot: data.message.from?.is_bot,
          timestamp: new Date().toISOString()
        });
        
        // ✅ Передаем полную информацию о сообщении включая chat
        const handled = await telegramMediatorService.handleOperatorMessage({
          text: data.message.text || '',
          from: {
            first_name: data.message.from?.first_name,
            username: data.message.from?.username,
            id: data.message.from?.id,
            is_bot: data.message.from?.is_bot
          },
          chat: {
            id: data.message.chat?.id || 0,
            type: data.message.chat?.type || 'private',
            title: data.message.chat?.title
          },
          message_id: data.message.message_id
        });
        
        console.log('✅ Message processed:', {
          messageId: data.message.message_id,
          handled,
          chatId: data.message.chat?.id,
          timestamp: new Date().toISOString()
        });
        
        return NextResponse.json({ 
          success: true,
          handled,
          type: 'message',
          chatId: data.message.chat?.id,
          chatType: data.message.chat?.type,
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        console.error('❌ Failed to handle message:', {
          messageId: data.message.message_id,
          text: data.message.text?.substring(0, 100),
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString()
        });
        
        return NextResponse.json({ 
          success: false,
          error: error instanceof Error ? error.message : 'Message handling failed',
          type: 'message',
          timestamp: new Date().toISOString()
        }, { status: 500 })
      }
    }

    // Unknown update type
    console.log('ℹ️ Telegram Mediator webhook: Unknown update type:', data)
    return NextResponse.json({ 
      success: true,
      handled: false,
      type: 'unknown'
    })

  } catch (error) {
    console.error('❌ Telegram Mediator webhook error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Webhook processing failed',
        code: 'TELEGRAM_MEDIATOR_WEBHOOK_ERROR'
      },
      { status: 500 }
    )
  }
}

/**
 * Health check for webhook endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    endpoint: 'telegram-mediator-webhook',
    timestamp: new Date().toISOString(),
    features: [
      'operator_message_handling',
      'callback_query_processing',
      'intercom_integration',
      'conversation_context_management'
    ]
  })
}
