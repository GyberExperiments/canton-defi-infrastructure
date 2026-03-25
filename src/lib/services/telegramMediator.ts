/**
 * 🤖 Telegram Mediator Bot Service
 * Бот-посредник между Intercom чатом клиента и оператором
 * Обеспечивает двустороннюю связь с контекстом заказа
 */

import axios from 'axios';
import { intercomService } from './intercom';
import { conversationStorageService, ConversationContext } from './conversationStorage';

interface TelegramMediatorConfig {
  botToken: string;
  operatorChatId: string;
}

// ConversationContext теперь импортируется из conversationStorage

class TelegramMediatorService {
  private config: TelegramMediatorConfig | null = null;
  private baseUrl = 'https://api.telegram.org/bot';
  private clientGroupChatId: string | null = null; // ✅ ID группы для клиентов
  private telegramClientService: any = null; // ✅ Telegram Client API (ленивая инициализация)
  // Удаляем in-memory Map, используем персистентное хранилище

  constructor() {
    this.initializeConfig();
    this.loadClientGroupChatId();
  }

  /**
   * Ленивая инициализация Telegram Client API
   * Используется для отправки сообщений от администратора
   */
  private async getTelegramClientService() {
    if (!this.telegramClientService) {
      try {
        const { telegramClientService } = await import('@/lib/services/telegramClient');
        this.telegramClientService = telegramClientService;
        
        // Проверяем доступность
        const isConnected = await telegramClientService.checkConnection();
        if (!isConnected) {
          console.warn('⚠️ Telegram Client API not available, will use Bot API fallback');
          return null;
        }
        
        console.log('✅ Telegram Client API initialized in mediator');
      } catch (error) {
        console.warn('⚠️ Failed to load Telegram Client API:', error);
        return null;
      }
    }
    return this.telegramClientService;
  }

  private initializeConfig() {
    // ✅ ИСПОЛЬЗУЕМ ОДИН БОТ: используем TELEGRAM_BOT_TOKEN вместо отдельного медиатора
    const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_MEDIATOR_BOT_TOKEN;
    // ✅ Используем TELEGRAM_CHAT_ID (операторский канал) с fallback на TELEGRAM_MEDIATOR_CHAT_ID
    const operatorChatId = process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_MEDIATOR_CHAT_ID;

    console.log('🔧 Telegram Mediator Config:', {
      hasBotToken: !!botToken,
      hasOperatorChatId: !!operatorChatId,
      botTokenPrefix: botToken ? botToken.substring(0, 10) + '...' : 'undefined',
      operatorChatId: operatorChatId,
      usingMainBot: !!process.env.TELEGRAM_BOT_TOKEN,
      usingMediatorBot: !!process.env.TELEGRAM_MEDIATOR_BOT_TOKEN && !process.env.TELEGRAM_BOT_TOKEN
    });

    if (!botToken || !operatorChatId) {
      console.warn('Telegram Mediator Bot configuration missing. Service will be disabled.');
      return;
    }

    this.config = { botToken, operatorChatId };
    console.log('✅ Telegram Mediator Bot configured successfully (using main bot token)');
  }

  /**
   * ✅ Загрузить ID группы клиентов из env или базы
   */
  private loadClientGroupChatId() {
    // Сначала пробуем из env (приоритет)
    this.clientGroupChatId = process.env.TELEGRAM_CLIENT_GROUP_CHAT_ID || null;
    
    if (this.clientGroupChatId) {
      console.log('✅ Client group chat ID loaded from env:', this.clientGroupChatId);
    } else {
      console.log('ℹ️ Client group chat ID not configured - will be set when bot receives "ruheggs" message');
    }
  }

  /**
   * ✅ Сохранить ID группы клиентов
   */
  private async saveClientGroupChatId(chatId: string): Promise<void> {
    try {
      // Сохраняем в память (до перезапуска)
      this.clientGroupChatId = chatId;
      
      console.log('✅ Client group chat ID saved to memory:', chatId);
      console.log('💡 Для постоянного хранения добавьте в секреты:');
      console.log(`   GitHub: gh secret set TELEGRAM_CLIENT_GROUP_CHAT_ID -b "${chatId}"`);
      console.log(`   K8s: kubectl create secret generic telegram-client-group --from-literal=TELEGRAM_CLIENT_GROUP_CHAT_ID="${chatId}" -n canton-otc`);
      
      // Также обновляем process.env для текущей сессии (не персистентно)
      process.env.TELEGRAM_CLIENT_GROUP_CHAT_ID = chatId;
      
      // TODO: Можно также сохранить в Supabase или ConfigMap для персистентности
    } catch (error) {
      console.error('❌ Failed to save client group chat ID:', error);
    }
  }

  /**
   * Отправить сообщение от клиента оператору
   */
  async forwardClientMessage(
    orderId: string,
    customerMessage: string,
    context: Omit<ConversationContext, 'createdAt' | 'updatedAt' | 'lastActivity'>
  ): Promise<boolean> {
    try {
      if (!this.config) {
        console.log('🤖 Telegram Mediator disabled - logging message locally');
        this.logMessageLocally('CLIENT_MESSAGE', orderId, customerMessage);
        return false;
      }

      // Сохраняем контекст разговора в персистентное хранилище
      const saved = await conversationStorageService.saveContext(orderId, context);
      if (!saved) {
        console.warn('⚠️ Failed to save conversation context to storage, continuing with in-memory only');
      }
      
      console.log('💾 Conversation context saved to persistent storage:', {
        orderId,
        context: {
          orderId: context.orderId,
          customerEmail: context.customerEmail,
          intercomConversationId: context.intercomConversationId
        }
      });

      const message = this.formatClientMessage(orderId, customerMessage, context);
      
      const response = await axios.post(
        `${this.baseUrl}${this.config.botToken}/sendMessage`,
        {
          chat_id: this.config.operatorChatId,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          reply_markup: {
            inline_keyboard: [[
              {
                text: `💬 Ответить клиенту`,
                callback_data: `reply_${orderId}`
              }
            ]]
          }
        },
        {
          timeout: 10000, // 10 секунд таймаут
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.ok) {
        console.log('🤖 Client message forwarded to operator:', orderId);
        return true;
      } else {
        throw new Error(`Telegram Mediator API error: ${response.data.description}`);
      }

    } catch (error) {
      console.error('❌ Failed to forward client message:', {
        orderId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
      
      // Логируем локально для отладки
      this.logMessageLocally('CLIENT_MESSAGE_FAILED', orderId, customerMessage);
      
      // Пытаемся отправить уведомление оператору об ошибке
      try {
        if (this.config) {
          await axios.post(
            `${this.baseUrl}${this.config.botToken}/sendMessage`,
            {
              chat_id: this.config.operatorChatId,
              text: `⚠️ <b>Ошибка отправки сообщения</b>\n\n📋 Order: <code>${orderId}</code>\n❌ ${error instanceof Error ? error.message : 'Unknown error'}`,
              parse_mode: 'HTML'
            },
            { timeout: 5000 }
          );
        }
      } catch (notificationError) {
        console.error('❌ Failed to send error notification:', notificationError);
      }
      
      return false;
    }
  }

  /**
   * Отправить ответ оператора клиенту через Intercom
   * ✅ ИНТЕГРАЦИЯ: Добавлена поддержка Telegram Client API для персональных сообщений
   */
  async sendOperatorReply(
    orderId: string,
    operatorMessage: string,
    operatorName?: string
  ): Promise<boolean> {
    try {
      const context = await conversationStorageService.getContext(orderId);
      if (!context) {
        console.error('❌ No conversation context found for order:', orderId);
        return false;
      }

      let intercomSuccess = false;
      let telegramGroupSuccess = false;
      let telegramClientSuccess = false;

      // ✅ 1. Пробуем Telegram Client API (если у клиента есть Telegram username)
      // Это позволяет отправить первое сообщение без /start
      if (context.customerTelegram) {
        try {
          const clientService = await this.getTelegramClientService();
          if (clientService) {
            const telegramUsername = context.customerTelegram.startsWith('@') 
              ? context.customerTelegram 
              : `@${context.customerTelegram}`;
            
            const message = `💬 <b>Сообщение от оператора</b>\n\n` +
              `📋 <b>Order ID:</b> <code>${orderId}</code>\n` +
              `👤 <b>Оператор:</b> ${operatorName || 'Оператор'}\n\n` +
              `${operatorMessage}\n\n` +
              `Спасибо за использование Canton OTC Exchange! 🚀`;

            const result = await clientService.sendMessage(telegramUsername, message, { parseMode: 'html' });
            
            if (result.success) {
              telegramClientSuccess = true;
              console.log('✅ Operator reply sent via Telegram Client API:', orderId);
            }
          }
        } catch (telegramClientError) {
          console.warn('⚠️ Failed to send via Telegram Client API:', telegramClientError);
        }
      }

      // ✅ 2. Отправляем через Intercom (основной канал для клиентов на сайте)
      if (context.intercomConversationId) {
        try {
          const { intercomService } = await import('@/lib/services/intercom');
          intercomSuccess = await intercomService.sendOperatorReply(
            context.intercomConversationId,
            operatorMessage,
            operatorName
          );
        } catch (intercomError) {
          console.warn('⚠️ Failed to send via Intercom:', intercomError);
        }
      } else {
        console.warn('⚠️ No Intercom conversation ID found for order:', orderId);
      }

      // ✅ 3. Отправляем в группу клиентов, если настроена (fallback)
      if (this.clientGroupChatId && !telegramClientSuccess) {
        try {
          const customerInfo = context.customerEmail ? `\n📧 Клиент: ${context.customerEmail}` : '';
          const messageToClientGroup = `
💬 <b>Сообщение от оператора</b>

📋 <b>Order ID:</b> <code>${orderId}</code>${customerInfo}

👤 <b>Оператор:</b> ${operatorName || 'Оператор'}

💬 <b>Сообщение:</b>
${operatorMessage}
          `.trim();

          telegramGroupSuccess = await this.sendMessageToChat(
            this.clientGroupChatId,
            messageToClientGroup
          );

          if (telegramGroupSuccess) {
            console.log('✅ Message sent to client group:', {
              orderId,
              clientGroupChatId: this.clientGroupChatId
            });
          }
        } catch (telegramError) {
          console.warn('⚠️ Failed to send to client group:', telegramError);
        }
      } else {
        console.log('ℹ️ Client group not configured, skipping Telegram group message');
      }

      // Считаем успешным если хотя бы один канал сработал
      const success = telegramClientSuccess || intercomSuccess || telegramGroupSuccess;

      if (success) {
        console.log('🤖 Operator reply sent:', {
          orderId,
          intercom: intercomSuccess,
          telegramGroup: telegramGroupSuccess
        });
        
        // Обновляем время активности в контексте
        await conversationStorageService.updateActivity(orderId);
        
        // Уведомляем оператора об успешной отправке
        await this.notifyOperatorReplySent(orderId, operatorMessage, {
          telegramClient: telegramClientSuccess,
          intercom: intercomSuccess,
          telegramGroup: telegramGroupSuccess
        });
        return true;
      } else {
        throw new Error('Failed to send reply via any channel');
      }

    } catch (error) {
      console.error('❌ Failed to send operator reply:', error);
      return false;
    }
  }

  /**
   * Уведомить оператора об успешной отправке ответа
   */
  private async notifyOperatorReplySent(
    orderId: string, 
    message: string,
    channels?: { telegramClient?: boolean; intercom?: boolean; telegramGroup?: boolean }
  ): Promise<void> {
    try {
      if (!this.config) return;

      const shortMessage = message.length > 50 ? message.substring(0, 50) + '...' : message;
      
      let statusText = '✅ <b>Ответ отправлен клиенту</b>\n\n';
      statusText += `📋 Order: <code>${orderId}</code>\n`;
      statusText += `💬 Сообщение: "${shortMessage}"\n\n`;
      
      if (channels) {
        statusText += `📤 Каналы:\n`;
        if (channels.telegramClient) {
          statusText += `   ✅ Telegram (от администратора)\n`;
        }
        if (channels.intercom) {
          statusText += `   ✅ Intercom\n`;
        }
        if (channels.telegramGroup) {
          statusText += `   ✅ Telegram группа клиентов\n`;
        }
      }

      await axios.post(
        `${this.baseUrl}${this.config.botToken}/sendMessage`,
        {
          chat_id: this.config.operatorChatId,
          text: statusText,
          parse_mode: 'HTML',
          disable_notification: true
        }
      );

    } catch (error) {
      console.error('❌ Failed to notify operator about reply:', error);
    }
  }

  /**
   * Форматировать сообщение от клиента для оператора
   */
  private formatClientMessage(
    orderId: string,
    customerMessage: string,
    context: Omit<ConversationContext, 'createdAt' | 'updatedAt' | 'lastActivity'>
  ): string {
    const timestamp = new Date().toLocaleString('ru-RU', {
      timeZone: 'Europe/Moscow',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    let message = `💬 <b>НОВОЕ СООБЩЕНИЕ ОТ КЛИЕНТА</b>\n\n`;
    message += `📋 <b>Order ID:</b> <code>${orderId}</code>\n`;
    message += `📧 <b>Email:</b> ${context.customerEmail}\n`;
    message += `📅 <b>Время:</b> ${timestamp} (МСК)\n\n`;

    if (context.orderAmount) {
      message += `💰 <b>Сумма заказа:</b> $${context.orderAmount} USDT\n`;
    }
    
    if (context.orderStatus) {
      message += `🎯 <b>Статус:</b> ${context.orderStatus}\n`;
    }
    
    if (context.cantonAddress) {
      message += `🏛️ <b>Canton Address:</b> <code>${context.cantonAddress}</code>\n`;
    }
    
    if (context.refundAddress) {
      message += `🔄 <b>Refund Address:</b> <code>${context.refundAddress}</code>\n`;
    }

    message += `\n💬 <b>Сообщение клиента:</b>\n"${customerMessage}"\n\n`;
    message += `🔗 <b>Ссылка в админку:</b>\nhttps://stage.minimal.build.infra.1otc.cc/admin/orders`;

    return message;
  }

  /**
   * Обработать callback от inline кнопки
   */
  async handleCallbackQuery(callbackQuery: { id: string; data: string; message?: Record<string, unknown>; from?: { id?: number; username?: string } }): Promise<boolean> {
    try {
      const { data, message } = callbackQuery;
      
      console.log('🔍 Callback Query Debug:', {
        data,
        hasMessage: !!message,
        storageStats: conversationStorageService.getStats()
      });
      
      // ✅ Обработка accept_order callback
      if (typeof data === 'string' && data.startsWith('accept_order:')) {
        const orderId = data.replace('accept_order:', '');
        const userId = (callbackQuery as any).from?.id;
        const userUsername = (callbackQuery as any).from?.username;
        const message = (callbackQuery as any).message;
        const chatId = message?.chat?.id;
        
        // ✅ Определяем источник callback (клиентский или админский чат)
        const adminChatId = process.env.TELEGRAM_CHAT_ID ? String(process.env.TELEGRAM_CHAT_ID) : null;
        const clientGroupChatId = process.env.TELEGRAM_CLIENT_GROUP_CHAT_ID ? String(process.env.TELEGRAM_CLIENT_GROUP_CHAT_ID) : null;
        const isAdminChat = adminChatId && chatId && String(chatId) === adminChatId;
        const isClientGroup = clientGroupChatId && chatId && String(chatId) === clientGroupChatId;
        
        console.log('🔍 Processing accept_order callback:', {
          orderId,
          userId,
          userUsername,
          chatId,
          adminChatId,
          clientGroupChatId,
          isAdminChat,
          isClientGroup,
          messageId: message?.message_id,
          timestamp: new Date().toISOString()
        });
        
        // Показываем loading state сразу
        await this.answerCallbackQuery(callbackQuery.id, '', { showLoading: true });
        
        try {
          // Проверяем статус заявки в базе данных
          const { createClient } = await import('@supabase/supabase-js');
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          
          console.log('🔍 Supabase config check:', {
            orderId,
            hasUrl: !!supabaseUrl,
            hasKey: !!supabaseKey,
            url: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'missing'
          });
          
          if (!supabaseUrl || !supabaseKey) {
            console.error('❌ Supabase not configured:', {
              orderId,
              hasUrl: !!supabaseUrl,
              hasKey: !!supabaseKey,
              envKeys: Object.keys(process.env).filter(k => k.includes('SUPABASE'))
            });
            await this.answerCallbackQuery(callbackQuery.id, '❌ База данных не настроена', { showAlert: true });
            return false;
          }
          
          // Создаем клиент Supabase с правильными опциями для service role key
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
          
          console.log('🔍 Querying Supabase for order:', {
            orderId,
            url: supabaseUrl,
            table: 'public_orders'
          });
          
          // Получаем заявку с детальным логированием ошибок
          const { data: order, error: fetchError } = await supabase
            .from('public_orders')
            .select('*')
            .eq('order_id', orderId)
            .single();
          
          console.log('🔍 Supabase query result:', {
            orderId,
            found: !!order,
            error: fetchError ? {
              message: fetchError.message,
              details: fetchError.details,
              hint: fetchError.hint,
              code: fetchError.code
            } : null
          });
          
          if (fetchError) {
            console.error('❌ Supabase fetch error:', {
              orderId,
              error: fetchError.message,
              details: fetchError.details,
              hint: fetchError.hint,
              code: fetchError.code,
              timestamp: new Date().toISOString()
            });
            await this.answerCallbackQuery(
              callbackQuery.id, 
              `❌ Ошибка поиска заявки: ${fetchError.message}`, 
              { showAlert: true }
            );
            return false;
          }
          
          if (!order) {
            console.error('❌ Order not found in database:', {
              orderId,
              timestamp: new Date().toISOString()
            });
            await this.answerCallbackQuery(
              callbackQuery.id, 
              '❌ Заявка не найдена в базе данных. Возможно, она еще не сохранена.', 
              { showAlert: true }
            );
            return false;
          }
        
          // ✅ Логируем информацию о клиенте
          console.log('📋 Order found - Client Info:', {
            orderId: order.order_id,
            customerEmail: order.email,
            customerTelegram: order.telegram,
            customerWhatsapp: order.whatsapp,
            status: order.status,
            timestamp: new Date().toISOString()
          });
          
          // ✅ РАЗЛИЧАЕМ ЛОГИКУ В ЗАВИСИМОСТИ ОТ ИСТОЧНИКА
          let updatedOrder: any;
          let updateError: any;
          
          if (isClientGroup) {
            // ✅ КЛИЕНТСКИЙ ЧАТ: pending → client_accepted
            if (order.status !== 'pending') {
              const statusMessage = order.status === 'client_accepted'
                ? '⚠️ Вы уже откликнулись на эту заявку'
                : order.status === 'accepted'
                ? '⚠️ Заявка уже принята оператором'
                : `⚠️ Заявка имеет статус: ${order.status}`;
              await this.answerCallbackQuery(
                callbackQuery.id,
                statusMessage,
                { showAlert: true }
              );
              return false;
            }
            
            // Обновляем статус на client_accepted и сохраняем информацию о клиенте
            const updateResult = await supabase
              .from('public_orders')
              .update({
                status: 'client_accepted',
                client_id: userId,
                client_username: userUsername,
                client_accepted_at: new Date().toISOString()
              })
              .eq('order_id', orderId)
              .eq('status', 'pending') // Проверка на race condition
              .select()
              .single();
            
            updatedOrder = updateResult.data;
            updateError = updateResult.error;
            
            if (updateError) {
              console.error('❌ Supabase update error (client):', {
                orderId,
                error: updateError.message,
                details: updateError.details,
                code: updateError.code,
                timestamp: new Date().toISOString()
              });
              await this.answerCallbackQuery(
                callbackQuery.id,
                `❌ Ошибка обновления заявки: ${updateError.message}. Пожалуйста, сообщите администратору.`,
                { showAlert: true }
              );
              return false;
            }
            
            if (!updatedOrder) {
              // Кто-то уже откликнулся или принял заявку (race condition)
              console.warn('⚠️ Order already processed (race condition):', {
                orderId,
                timestamp: new Date().toISOString()
              });
              await this.answerCallbackQuery(
                callbackQuery.id,
                '⚠️ Заявка уже обработана',
                { showAlert: true }
              );
              return false;
            }
            
            console.log('✅ Client accepted order:', {
              orderId: updatedOrder.order_id,
              clientId: userId,
              clientUsername: userUsername,
              status: updatedOrder.status,
              timestamp: new Date().toISOString()
            });
            
            // ✅ ОБНОВЛЯЕМ СООБЩЕНИЕ В КЛИЕНТСКОЙ ГРУППЕ
            const { telegramService } = await import('@/lib/services/telegram');
            if (message && (message as any).chat?.id && (message as any).message_id) {
              const messageChatId = (message as any).chat.id;
              const messageId = (message as any).message_id;
              
              try {
                // Переформатируем сообщение с информацией о принятии тейкером
                const exchangeDirection = order.exchange_direction || 'buy';
                const isBuying = exchangeDirection === 'buy';
                const direction = isBuying ? 'BUY' : 'SELL';
                // Получаем токен (может быть в разных полях)
                const paymentToken = (order as any).payment_token || (order as any).paymentToken || 'USDT';
                const amountLine = isBuying
                  ? `<b>Payment:</b> $${Number(order.payment_amount_usd || 0).toFixed(2)} ${paymentToken}\n<b>Receiving:</b> ${Number(order.canton_amount || 0).toFixed(2)} Canton Coin`
                  : `<b>Payment:</b> ${Number(order.canton_amount || 0).toFixed(2)} Canton Coin\n<b>Receiving:</b> $${Number(order.payment_amount_usd || 0).toFixed(2)} ${paymentToken}`;
                
                // Проверяем флаг рыночной цены (может быть в разных полях)
                const isMarketPrice = order.is_market_price === true || (order as any).isMarketPrice === true;
                const priceDisplay = isMarketPrice 
                  ? `$${Number(order.price || 0).toFixed(4)} (market)`
                  : `$${Number(order.price || 0).toFixed(4)}`;
                
                const updatedMessage = `
🔔 <b>NEW OTC ORDER</b>

<b>Type:</b> ${direction} Canton Coin
${amountLine}

<b>Price CC:</b> ${priceDisplay}
<b>Order ID:</b> <code>${order.order_id}</code>
<b>Created:</b> ${new Date(order.created_at || Date.now()).toLocaleString('en-GB', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} (MSK)

✅ <b>TAKEN BY:</b> @${userUsername || 'taker'}

<b>CONTACT:</b>
${process.env.TELEGRAM_SERVICE_BOT_USERNAME || '@TECH_HY_Customer_Service_bot'}
${process.env.TELEGRAM_OPERATOR_USERNAME || '@hypov'}
                `.trim();
                
                await telegramService.editMessageText(messageChatId, messageId, updatedMessage);
                console.log('✅ Message updated in client group:', {
                  orderId,
                  messageId,
                  chatId: messageChatId
                });
              } catch (editError) {
                console.error('⚠️ Failed to edit message in client group:', editError);
              }
            }
            
            // ✅ СОЗДАЕМ ССЫЛКУ ДЛЯ ПЕРЕБРОСКИ В ЛИЧНЫЙ ЧАТ С ОПЕРАТОРОМ
            const serviceBotUsername = process.env.TELEGRAM_SERVICE_BOT_USERNAME || 'TECH_HY_Customer_Service_bot';
            const botUsername = serviceBotUsername.replace('@', '');
            // Deep link с автоматически подставленным номером заявки
            const chatLink = `https://t.me/${botUsername}?start=order_${orderId}`;
            
              // Уведомляем админов в админский чат
            const adminNotification = `🔔 <b>Тейкер откликнулся на заявку</b>\n\n` +
              `📋 <b>Order ID:</b> <code>${orderId}</code>\n` +
              `👤 <b>Тейкер:</b> @${userUsername || 'тейкер'}\n` +
              `📧 <b>Email инициатора:</b> ${order.email}\n` +
              `💰 <b>Сумма:</b> $${order.payment_amount_usd} USDT\n\n` +
              `💬 <b>Тейкер переброшен в личный чат:</b> ${chatLink}\n\n` +
              `✅ Заявка готова к обработке оператором`;
            
            try {
              if (adminChatId) {
                console.log('📤 Notifying admins about taker acceptance:', {
                  orderId,
                  takerUsername: userUsername,
                  takerId: userId,
                  adminChatId,
                  timestamp: new Date().toISOString()
                });
                await telegramService.sendCustomMessage(adminNotification);
                console.log('✅ Admin notification sent:', orderId);
              } else {
                console.warn('⚠️ Admin chat ID not configured, skipping admin notification');
              }
            } catch (notifyError) {
              console.error('❌ Failed to notify admins:', {
                orderId,
                error: notifyError instanceof Error ? notifyError.message : String(notifyError),
                stack: notifyError instanceof Error ? notifyError.stack : undefined,
                timestamp: new Date().toISOString()
              });
            }
            
            // ✅ ОТПРАВЛЯЕМ СООБЩЕНИЕ ТЕЙКЕРУ С ДАННЫМИ ОРДЕРА
            // Используем Telegram Client API для отправки от администратора (работает без /start)
            try {
              const clientService = await this.getTelegramClientService();
              
              if (clientService) {
                // ✅ Отправляем через Telegram Client API (от администратора)
                // Включает все данные ордера и актуальное сообщение
                const result = await clientService.notifyTakerAboutAcceptedOrder(
                  userId,
                  userUsername,
                  order,
                  process.env.TELEGRAM_OPERATOR_USERNAME || '@hypov',
                  chatLink
                );
                
                if (result.success) {
                  console.log('✅ Taker notified via Telegram Client API:', {
                    orderId,
                    takerId: userId,
                    takerUsername: userUsername
                  });
                  
                  // Успешный ответ тейкеру
                  await this.answerCallbackQuery(
                    callbackQuery.id,
                    `✅ Заявка принята! Проверьте личные сообщения от администратора.`,
                    { showAlert: false }
                  );
                } else {
                  // Fallback на Bot API если Client API не сработал
                  console.warn('⚠️ Telegram Client API failed, trying Bot API fallback:', result.error);
                  throw new Error('Telegram Client API failed');
                }
              } else {
                // Fallback если Client API не настроен
                throw new Error('Telegram Client API not available');
              }
            } catch (clientApiError) {
              // ✅ FALLBACK: Пытаемся отправить через Bot API (работает только если пользователь начал диалог)
              console.log('ℹ️ Telegram Client API not available or failed, trying Bot API fallback:', {
                orderId,
                takerId: userId,
                error: clientApiError instanceof Error ? clientApiError.message : String(clientApiError)
              });
              
              try {
                const redirectMessage = `✅ <b>Заявка принята!</b>\n\n` +
                  `📋 <b>Номер заявки:</b> <code>${orderId}</code>\n\n` +
                  `💬 <b>Нажмите кнопку ниже для связи с оператором</b>\n\n` +
                  `В чате автоматически будет указан номер заявки.`;
                
                await axios.post(
                  `${this.baseUrl}${this.config!.botToken}/sendMessage`,
                  {
                    chat_id: userId,
                    text: redirectMessage,
                    parse_mode: 'HTML',
                    reply_markup: {
                      inline_keyboard: [[
                        {
                          text: '💬 Перейти в чат с оператором',
                          url: chatLink
                        }
                      ]]
                    }
                  },
                  {
                    timeout: 10000,
                    headers: { 'Content-Type': 'application/json' }
                  }
                );
                
                console.log('✅ Taker redirected via Bot API (user started chat):', {
                  orderId,
                  takerId: userId,
                  takerUsername: userUsername,
                  chatLink
                });
                
                // Успешный ответ тейкеру
                await this.answerCallbackQuery(
                  callbackQuery.id,
                  `✅ Заявка принята! Проверьте личные сообщения с ботом.`,
                  { showAlert: false }
                );
              } catch (sendMessageError: any) {
                // Если не удалось отправить сообщение (403 - пользователь не начал диалог)
                if (sendMessageError.response?.status === 403) {
                  console.log('ℹ️ User has not started chat with bot, updating message in group:', {
                    orderId,
                    takerId: userId,
                    chatLink
                  });
                  
                  // Обновляем сообщение в группе, добавляя кнопку для перехода в чат
                  if (message && (message as any).chat?.id && (message as any).message_id) {
                    const messageChatId = (message as any).chat.id;
                    const messageId = (message as any).message_id;
                    
                    try {
                      const exchangeDirection = order.exchange_direction || 'buy';
                      const isBuying = exchangeDirection === 'buy';
                      const direction = isBuying ? 'BUY' : 'SELL';
                      const paymentToken = (order as any).payment_token || (order as any).paymentToken || 'USDT';
                      const amountLine = isBuying
                        ? `<b>Payment:</b> $${Number(order.payment_amount_usd || 0).toFixed(2)} ${paymentToken}\n<b>Receiving:</b> ${Number(order.canton_amount || 0).toFixed(2)} Canton Coin`
                        : `<b>Payment:</b> ${Number(order.canton_amount || 0).toFixed(2)} Canton Coin\n<b>Receiving:</b> $${Number(order.payment_amount_usd || 0).toFixed(2)} ${paymentToken}`;
                      
                      const isMarketPrice = order.is_market_price === true || (order as any).isMarketPrice === true;
                      const priceDisplay = isMarketPrice 
                        ? `$${Number(order.price || 0).toFixed(4)} (market)`
                        : `$${Number(order.price || 0).toFixed(4)}`;
                      
                      const updatedMessageWithButton = `
🔔 <b>NEW OTC ORDER</b>

<b>Type:</b> ${direction} Canton Coin
${amountLine}

<b>Price CC:</b> ${priceDisplay}
<b>Order ID:</b> <code>${order.order_id}</code>
<b>Created:</b> ${new Date(order.created_at || Date.now()).toLocaleString('en-GB', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} (MSK)

✅ <b>TAKEN BY:</b> @${userUsername || 'taker'}

💬 <b>Нажмите кнопку ниже для связи с оператором</b>

<b>CONTACT:</b>
${process.env.TELEGRAM_SERVICE_BOT_USERNAME || '@TECH_HY_Customer_Service_bot'}
${process.env.TELEGRAM_OPERATOR_USERNAME || '@hypov'}
                      `.trim();
                      
                      await axios.post(
                        `${this.baseUrl}${this.config!.botToken}/editMessageText`,
                        {
                          chat_id: messageChatId,
                          message_id: messageId,
                          text: updatedMessageWithButton,
                          parse_mode: 'HTML',
                          reply_markup: {
                            inline_keyboard: [[
                              {
                                text: '💬 Перейти в чат с оператором',
                                url: chatLink
                              }
                            ]]
                          }
                        },
                        {
                          timeout: 10000,
                          headers: { 'Content-Type': 'application/json' }
                        }
                      );
                      
                      console.log('✅ Message updated with redirect button:', {
                        orderId,
                        messageId,
                        chatLink
                      });
                    } catch (editError) {
                      console.error('⚠️ Failed to update message with button:', editError);
                    }
                  }
                  
                  // Показываем alert с инструкцией
                  await this.answerCallbackQuery(
                    callbackQuery.id,
                    `✅ Заявка принята!\n\n📋 ID: ${orderId}\n\n💬 Нажмите кнопку в сообщении выше для связи с оператором.`,
                    { showAlert: true }
                  );
                  
                  console.log('✅ Taker redirected via message button:', {
                    orderId,
                    takerId: userId,
                    chatLink
                  });
                } else {
                  // Если ошибка не 403, используем финальный fallback
                  console.error('⚠️ Failed to send message via Bot API (non-403 error):', sendMessageError);
                  
                  try {
                    await this.answerCallbackQuery(
                      callbackQuery.id,
                      `✅ Заявка принята!\n\n📋 ID: ${orderId}\n\n💬 Перейдите по ссылке для связи с оператором:\n${chatLink}`,
                      { showAlert: true }
                    );
                  } catch (fallbackError) {
                    console.error('⚠️ Failed to send fallback message:', fallbackError);
                  }
                }
              }
            }
            
            return true;
            
          } else if (isAdminChat) {
            // ✅ АДМИНСКИЙ ЧАТ: client_accepted → accepted (или pending → accepted для приватных заявок)
            const isPrivateDeal = order.is_private === true;
            
            // Для приватных заявок разрешаем принимать напрямую из pending
            if (!isPrivateDeal && order.status !== 'client_accepted') {
              const statusMessage = order.status === 'pending'
                ? '⚠️ Клиент еще не откликнулся на заявку'
                : order.status === 'accepted'
                ? `⚠️ Заявка уже принята оператором ${order.operator_username || 'другим оператором'}`
                : `⚠️ Заявка имеет статус: ${order.status}`;
              await this.answerCallbackQuery(
                callbackQuery.id,
                statusMessage,
                { showAlert: true }
              );
              return false;
            }
            
            // Для приватных заявок в статусе pending разрешаем принимать напрямую
            if (isPrivateDeal && order.status !== 'pending' && order.status !== 'client_accepted') {
              const statusMessage = order.status === 'accepted'
                ? `⚠️ Заявка уже принята оператором ${order.operator_username || 'другим оператором'}`
                : `⚠️ Заявка имеет статус: ${order.status}`;
              await this.answerCallbackQuery(
                callbackQuery.id,
                statusMessage,
                { showAlert: true }
              );
              return false;
            }
            
            // Обновляем статус на accepted и сохраняем информацию об операторе
            // Для приватных заявок разрешаем принимать из pending, для публичных - только из client_accepted
            const expectedStatus = isPrivateDeal ? 'pending' : 'client_accepted';
            const updateResult = await supabase
              .from('public_orders')
              .update({
                status: 'accepted',
                operator_id: userId,
                operator_username: userUsername,
                accepted_at: new Date().toISOString()
              })
              .eq('order_id', orderId)
              .in('status', isPrivateDeal ? ['pending', 'client_accepted'] : ['client_accepted']) // Для приватных разрешаем оба статуса
              .select()
              .single();
            
            updatedOrder = updateResult.data;
            updateError = updateResult.error;
            
            if (updateError) {
              console.error('❌ Supabase update error (admin):', {
                orderId,
                error: updateError.message,
                details: updateError.details,
                code: updateError.code,
                timestamp: new Date().toISOString()
              });
              await this.answerCallbackQuery(
                callbackQuery.id,
                `❌ Ошибка обновления заявки: ${updateError.message}`,
                { showAlert: true }
              );
              return false;
            }
            
            if (!updatedOrder) {
              // Кто-то уже принял заявку (race condition)
              console.warn('⚠️ Order already accepted by another operator (race condition):', {
                orderId,
                timestamp: new Date().toISOString()
              });
              await this.answerCallbackQuery(
                callbackQuery.id,
                '⚠️ Заявка уже принята другим оператором',
                { showAlert: true }
              );
              return false;
            }
            
            console.log('✅ Admin accepted order:', {
              orderId: updatedOrder.order_id,
              operatorId: userId,
              operatorUsername: userUsername,
              customerEmail: updatedOrder.email,
              status: updatedOrder.status,
              acceptedAt: updatedOrder.accepted_at,
              timestamp: new Date().toISOString()
            });
            
            // Создаем сервисный чат
            const { telegramService } = await import('@/lib/services/telegram');            let chatLink: string;
            try {
              chatLink = await telegramService.createServiceChat(orderId);
              console.log('✅ Service chat created:', { orderId, chatLink });
            } catch (chatError) {
              console.error('❌ Failed to create service chat:', chatError);
              chatLink = `https://t.me/${process.env.TELEGRAM_SERVICE_BOT_USERNAME || 'TECH_HY_Customer_Service_bot'}`;
            }
            
            // Обновляем chat_link в базе
            try {
              await supabase
                .from('public_orders')
                .update({ chat_link: chatLink })
                .eq('order_id', orderId);
            } catch (updateError) {
              console.error('⚠️ Failed to update chat_link:', updateError);
            }
            
            // Обновляем сообщение в публичном канале (если это сообщение из группы)
            if (message && (message as any).chat?.id && (message as any).message_id) {
              const messageChatId = (message as any).chat.id;
              const messageId = (message as any).message_id;
              
              try {
                // Переформатируем сообщение с информацией о принятии
                const exchangeDirection = order.exchange_direction || 'buy';
                const isBuying = exchangeDirection === 'buy';
                const direction = isBuying ? '🛒 ПОКУПКА' : '💸 ПРОДАЖА';
                const amountLine = isBuying
                  ? `💰 <b>Оплата:</b> $${Number(order.payment_amount_usd).toFixed(2)} USDT\n📊 <b>Получение:</b> ${Number(order.canton_amount).toFixed(2)} Canton Coin`
                  : `📊 <b>Продажа:</b> ${Number(order.canton_amount).toFixed(2)} Canton Coin\n💰 <b>Получение:</b> $${Number(order.payment_amount_usd).toFixed(2)} USDT`;
                
                const updatedMessage = `
🔔 <b>НОВАЯ ЗАЯВКА OTC</b>

📊 <b>Тип:</b> ${direction} Canton Coin
${amountLine}

💵 <b>Цена:</b> $${Number(order.price).toFixed(4)} <i>(${order.manual_price ? 'ручной ввод' : 'рыночная'})</i>
📈 <b>Комиссия:</b> ${order.service_commission || 3}%
📋 <b>ID заявки:</b> <code>${order.order_id}</code>

✅ <b>ЗАЯВКА ПРИНЯТА</b>
👤 <b>Оператор:</b> @${userUsername || 'оператор'}
💬 <b>Связь:</b> ${chatLink}

⚡️ <i>Обработка заявки начата</i>
                `.trim();
                
                await telegramService.editMessageText(messageChatId, messageId, updatedMessage);
              } catch (editError) {
                console.error('⚠️ Failed to edit message:', editError);
              }
            }
            
            // Отправляем уведомление клиенту
            try {
              console.log('📤 Notifying customer about accepted order:', {
                orderId,
                customerEmail: order.email,
                customerTelegram: order.telegram,
                operatorUsername: userUsername,
                chatLink,
                timestamp: new Date().toISOString()
              });
              await telegramService.notifyCustomer(order as any, userUsername || 'оператор', chatLink);
              console.log('✅ Customer notification sent:', orderId);
            } catch (notifyError) {
              console.error('❌ Failed to notify customer:', {
                orderId,
                error: notifyError instanceof Error ? notifyError.message : String(notifyError),
                stack: notifyError instanceof Error ? notifyError.stack : undefined,
                timestamp: new Date().toISOString()
              });
            }
            
            // Отправляем инструкции оператору в приватный канал
            const operatorMessage = `✅ <b>Вы приняли заявку #${orderId}</b>\n\n` +
              `💬 <b>Связь с клиентом:</b>\n${chatLink}\n\n` +
              `📋 <b>Детали заявки:</b>\n` +
              `Тип: ${order.exchange_direction === 'buy' ? '🛒 Покупка' : '💸 Продажа'}\n` +
              `Сумма: $${order.payment_amount_usd}\n` +
              `Цена: $${order.price}\n` +
              `Комиссия: ${order.service_commission || 3}%\n\n` +
              `👤 <b>АДРЕСА:</b>\n` +
              `🏛️ Canton Address: <code>${order.canton_address || 'не указан'}</code>\n` +
              `${order.receiving_address ? `💳 Receiving Address: <code>${order.receiving_address}</code>\n` : ''}` +
              `${order.refund_address ? `🔄 Refund Address: <code>${order.refund_address}</code>\n` : ''}\n` +
              `📧 <b>Email клиента:</b> ${order.email}\n` +
              `💬 <b>Telegram:</b> ${order.telegram || 'не указан'}\n` +
              `${order.whatsapp ? `📱 <b>WhatsApp:</b> ${order.whatsapp}\n` : ''}`;
            
            try {
              if (adminChatId) {
                await telegramService.sendCustomMessage(operatorMessage);
              }
            } catch (sendError) {
              console.error('⚠️ Failed to send operator message:', sendError);
            }
            
            // ✅ Проверяем готовность сделки (есть ли противоположная заявка)
            try {
              console.log('🔍 Checking deal readiness:', {
                orderId: updatedOrder.order_id,
                direction: updatedOrder.exchange_direction,
                timestamp: new Date().toISOString()
              });
              await this.checkDealReadiness(updatedOrder, supabase, telegramService);
            } catch (dealError) {
              console.error('❌ Failed to check deal readiness:', {
                orderId: updatedOrder.order_id,
                error: dealError instanceof Error ? dealError.message : String(dealError),
                stack: dealError instanceof Error ? dealError.stack : undefined,
                timestamp: new Date().toISOString()
              });
            }
            
            // Успешный ответ - показываем как alert для явного подтверждения
            await this.answerCallbackQuery(
              callbackQuery.id,
              '✅ Заявка успешно принята!\n\n📋 ID: ' + orderId + '\n👤 Оператор: @' + (userUsername || 'оператор') + '\n\n💬 Проверьте группу операторов для деталей.',
              { showAlert: true }
            );
            
            return true;
            
          } else {
            // Неизвестный источник callback
            console.warn('⚠️ Unknown callback source:', {
              orderId,
              chatId,
              adminChatId,
              clientGroupChatId,
              timestamp: new Date().toISOString()
            });
            await this.answerCallbackQuery(
              callbackQuery.id,
              '⚠️ Неизвестный источник callback. Используйте кнопку из правильной группы.',
              { showAlert: true }
            );
            return false;
          }
          
        } catch (error) {
          console.error('❌ Error processing accept_order:', {
            orderId,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            timestamp: new Date().toISOString()
          });
          
          await this.answerCallbackQuery(
            callbackQuery.id,
            `❌ Ошибка обработки: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
            { showAlert: true }
          );
          
          return false;
        }
      }
      
      // ✅ Обработка order_details callback
      if (typeof data === 'string' && data.startsWith('order_details:')) {
        const orderId = data.replace('order_details:', '');
        
        // Показываем loading state
        await this.answerCallbackQuery(callbackQuery.id, '', { showLoading: true });
        
        try {
          const { createClient } = await import('@supabase/supabase-js');
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          
          if (!supabaseUrl || !supabaseKey) {
            await this.answerCallbackQuery(callbackQuery.id, '❌ База данных не настроена', { showAlert: true });
            return false;
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
          
          const { data: order, error } = await supabase
            .from('public_orders')
            .select('*')
            .eq('order_id', orderId)
            .single();
          
          if (error || !order) {
            await this.answerCallbackQuery(callbackQuery.id, '❌ Заявка не найдена', { showAlert: true });
            return false;
          }
          
          const exchangeDirection = order.exchange_direction || 'buy';
          const isBuying = exchangeDirection === 'buy';
          const direction = isBuying ? '🛒 ПОКУПКА' : '💸 ПРОДАЖА';
          const amountLine = isBuying
            ? `💰 <b>Оплата:</b> $${Number(order.payment_amount_usd).toFixed(2)} USDT\n📊 <b>Получение:</b> ${Number(order.canton_amount).toFixed(2)} Canton Coin`
            : `📊 <b>Продажа:</b> ${Number(order.canton_amount).toFixed(2)} Canton Coin\n💰 <b>Получение:</b> $${Number(order.payment_amount_usd).toFixed(2)} USDT`;
          
          const detailsMessage = `
📋 <b>ДЕТАЛИ ЗАЯВКИ</b>

📋 <b>ID:</b> <code>${order.order_id}</code>
📊 <b>Тип:</b> ${direction} Canton Coin
${amountLine}

💵 <b>Цена:</b> $${Number(order.price).toFixed(4)} <i>(${order.manual_price ? 'ручной ввод' : 'рыночная'})</i>
📈 <b>Комиссия:</b> ${order.service_commission || 3}%

🏛️ <b>Canton Address:</b> <code>${order.canton_address}</code>
${order.receiving_address ? `💳 <b>Receiving Address:</b> <code>${order.receiving_address}</code>\n` : ''}
${order.refund_address ? `🔄 <b>Refund Address:</b> <code>${order.refund_address}</code>\n` : ''}

📞 <b>КОНТАКТЫ:</b>
📧 Email: ${order.email}
${order.telegram ? `💬 Telegram: ${order.telegram}\n` : ''}
${order.whatsapp ? `📱 WhatsApp: ${order.whatsapp}\n` : ''}

🎯 <b>Статус:</b> ${order.status}
${order.operator_username ? `👤 <b>Оператор:</b> @${order.operator_username}\n` : ''}
${order.client_username ? `👤 <b>Клиент откликнулся:</b> @${order.client_username}\n` : ''}
${order.accepted_at ? `⏰ <b>Принято:</b> ${new Date(order.accepted_at).toLocaleString('ru-RU')}\n` : ''}
${order.created_at ? `📅 <b>Создано:</b> ${new Date(order.created_at).toLocaleString('ru-RU')}` : ''}
          `.trim();
          
          await this.answerCallbackQuery(callbackQuery.id, detailsMessage, { showAlert: true });
          return true;
          
        } catch (error) {
          console.error('❌ Error processing order_details:', error);
          await this.answerCallbackQuery(callbackQuery.id, '❌ Ошибка получения деталей заявки', { showAlert: true });
          return false;
        }
      }
      
      // ✅ Обработка contact callback
      if (typeof data === 'string' && data.startsWith('contact_')) {
        const orderId = data.replace('contact_', '');
        
        // Показываем loading state
        await this.answerCallbackQuery(callbackQuery.id, '', { showLoading: true });
        
        try {
          const { createClient } = await import('@supabase/supabase-js');
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          
          if (!supabaseUrl || !supabaseKey) {
            await this.answerCallbackQuery(callbackQuery.id, '❌ База данных не настроена', { showAlert: true });
            return false;
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
          
          const { data: order, error } = await supabase
            .from('public_orders')
            .select('*')
            .eq('order_id', orderId)
            .single();
          
          if (error || !order) {
            await this.answerCallbackQuery(callbackQuery.id, '❌ Заявка не найдена', { showAlert: true });
            return false;
          }
          
          // Создаем ссылку на сервисный чат
          const { telegramService } = await import('@/lib/services/telegram');
          const chatLink = await telegramService.createServiceChat(orderId);
          
          const contactMessage = `
💬 <b>СВЯЗЬ С КЛИЕНТОМ</b>

📋 <b>Order ID:</b> <code>${orderId}</code>

📞 <b>КОНТАКТЫ:</b>
📧 Email: ${order.email}
${order.telegram ? `💬 Telegram: ${order.telegram}\n` : ''}
${order.whatsapp ? `📱 WhatsApp: ${order.whatsapp}\n` : ''}

💬 <b>Сервисный чат:</b>
${chatLink}

💡 Нажмите на ссылку выше для начала диалога с клиентом
          `.trim();
          
          await this.answerCallbackQuery(callbackQuery.id, contactMessage, { showAlert: true });
          return true;
          
        } catch (error) {
          console.error('❌ Error processing contact:', error);
          await this.answerCallbackQuery(callbackQuery.id, '❌ Ошибка получения контактов', { showAlert: true });
          return false;
        }
      }
      
      // ✅ Обработка payment callback
      if (typeof data === 'string' && data.startsWith('payment_')) {
        const orderId = data.replace('payment_', '');
        
        // Показываем loading state
        await this.answerCallbackQuery(callbackQuery.id, '', { showLoading: true });
        
        try {
          const { createClient } = await import('@supabase/supabase-js');
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          
          if (!supabaseUrl || !supabaseKey) {
            await this.answerCallbackQuery(callbackQuery.id, '❌ База данных не настроена', { showAlert: true });
            return false;
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
          
          const { data: order, error } = await supabase
            .from('public_orders')
            .select('*')
            .eq('order_id', orderId)
            .single();
          
          if (error || !order) {
            await this.answerCallbackQuery(callbackQuery.id, '❌ Заявка не найдена', { showAlert: true });
            return false;
          }
          
          const exchangeDirection = order.exchange_direction || 'buy';
          const isBuying = exchangeDirection === 'buy';
          
          const paymentMessage = `
💳 <b>РЕКВИЗИТЫ ДЛЯ ОПЛАТЫ</b>

📋 <b>Order ID:</b> <code>${orderId}</code>

${isBuying 
  ? `💰 <b>К оплате:</b> $${Number(order.payment_amount_usd).toFixed(2)} USDT\n📊 <b>Получение:</b> ${Number(order.canton_amount).toFixed(2)} Canton Coin`
  : `📊 <b>Продажа:</b> ${Number(order.canton_amount).toFixed(2)} Canton Coin\n💰 <b>Получение:</b> $${Number(order.payment_amount_usd).toFixed(2)} USDT`}

💵 <b>Цена:</b> $${Number(order.price).toFixed(4)}
📈 <b>Комиссия:</b> ${order.service_commission || 3}%

💡 <b>Инструкции:</b>
${isBuying 
  ? '1. Отправьте USDT на адрес, который будет предоставлен оператором\n2. После подтверждения транзакции вы получите Canton Coin на указанный адрес'
  : '1. Отправьте Canton Coin на адрес, который будет предоставлен оператором\n2. После подтверждения транзакции вы получите USDT на указанный адрес'}

💬 <b>Свяжитесь с оператором для получения реквизитов оплаты</b>
          `.trim();
          
          await this.answerCallbackQuery(callbackQuery.id, paymentMessage, { showAlert: true });
          return true;
          
        } catch (error) {
          console.error('❌ Error processing payment:', error);
          await this.answerCallbackQuery(callbackQuery.id, '❌ Ошибка получения реквизитов', { showAlert: true });
          return false;
        }
      }
      
      // ✅ Обработка delete_order callback (только для оператора)
      if (typeof data === 'string' && data.startsWith('delete_order:')) {
        const orderId = data.replace('delete_order:', '');
        const userId = (callbackQuery as any).from?.id;
        const userUsername = (callbackQuery as any).from?.username;
        const message = (callbackQuery as any).message;
        const chatId = message?.chat?.id;
        
        // Проверяем что это операторский чат
        const adminChatId = process.env.TELEGRAM_CHAT_ID ? String(process.env.TELEGRAM_CHAT_ID) : null;
        const isAdminChat = adminChatId && chatId && String(chatId) === adminChatId;
        
        if (!isAdminChat) {
          await this.answerCallbackQuery(
            callbackQuery.id,
            '❌ Только оператор может удалить заявку из канала',
            { showAlert: true }
          );
          return false;
        }
        
        // Показываем loading state
        await this.answerCallbackQuery(callbackQuery.id, '', { showLoading: true });
        
        try {
          const { createClient } = await import('@supabase/supabase-js');
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          
          if (!supabaseUrl || !supabaseKey) {
            await this.answerCallbackQuery(callbackQuery.id, '❌ База данных не настроена', { showAlert: true });
            return false;
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
          
          // Получаем заявку для получения telegram_message_id
          const { data: order, error: fetchError } = await supabase
            .from('public_orders')
            .select('*')
            .eq('order_id', orderId)
            .single();
          
          if (fetchError || !order) {
            await this.answerCallbackQuery(callbackQuery.id, '❌ Заявка не найдена', { showAlert: true });
            return false;
          }
          
          // Удаляем сообщение из публичного канала (если есть telegram_message_id)
          const clientGroupChatId = process.env.TELEGRAM_CLIENT_GROUP_CHAT_ID;
          let deleteSuccess = false;
          
          if (order.telegram_message_id && clientGroupChatId) {
            const { telegramService } = await import('@/lib/services/telegram');
            deleteSuccess = await telegramService.deleteMessage(clientGroupChatId, order.telegram_message_id);
            
            if (deleteSuccess) {
              console.log('✅ Order message deleted from channel:', {
                orderId,
                messageId: order.telegram_message_id,
                operatorId: userId,
                operatorUsername: userUsername,
                timestamp: new Date().toISOString()
              });
              
              // Обновляем статус заявки на closed
              await supabase
                .from('public_orders')
                .update({ 
                  status: 'closed',
                  closed_at: new Date().toISOString(),
                  closed_by: userUsername
                })
                .eq('order_id', orderId);
            }
          } else {
            // Если нет telegram_message_id, просто обновляем статус
            await supabase
              .from('public_orders')
              .update({ 
                status: 'closed',
                closed_at: new Date().toISOString(),
                closed_by: userUsername
              })
              .eq('order_id', orderId);
            
            deleteSuccess = true; // Считаем успешным если статус обновлен
          }
          
          if (deleteSuccess) {
            await this.answerCallbackQuery(
              callbackQuery.id,
              `✅ Заявка #${orderId} удалена из канала и закрыта`,
              { showAlert: true }
            );
            return true;
          } else {
            await this.answerCallbackQuery(
              callbackQuery.id,
              '⚠️ Не удалось удалить сообщение из канала',
              { showAlert: true }
            );
            return false;
          }
          
        } catch (error) {
          console.error('❌ Error processing delete_order:', error);
          await this.answerCallbackQuery(
            callbackQuery.id,
            `❌ Ошибка удаления заявки: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
            { showAlert: true }
          );
          return false;
        }
      }
      
      // Существующая обработка reply_ префикса
      if (typeof data === 'string' && data.startsWith('reply_')) {
        const orderId = data.replace('reply_', '');
        const context = await conversationStorageService.getContext(orderId);
        
        console.log('🔍 Order Context Debug:', {
          orderId,
          hasContext: !!context,
          context: context ? {
            orderId: context.orderId,
            customerEmail: context.customerEmail,
            intercomConversationId: context.intercomConversationId,
            lastActivity: new Date(context.lastActivity).toISOString()
          } : null
        });
        
        if (!context) {
          console.error('❌ No conversation context found for order:', orderId);
          await this.answerCallbackQuery(callbackQuery.id, '❌ Контекст разговора не найден');
          return false;
        }

        // Обновляем время активности
        await conversationStorageService.updateActivity(orderId);
        
        // Отправляем инструкцию оператору
        const instructionMessage = `📝 <b>Как ответить клиенту:</b>\n\n` +
          `1. Напишите ответ в следующем сообщении\n` +
          `2. Начните с <code>${orderId}:</code>\n` +
          `3. Затем ваш ответ\n\n` +
          `<b>Пример:</b>\n` +
          `<code>${orderId}: Добро пожаловать! Ваш заказ обрабатывается.</code>\n\n` +
          `📋 <b>Order:</b> <code>${orderId}</code>\n` +
          `📧 <b>Клиент:</b> ${context.customerEmail}\n` +
          `🕐 <b>Последняя активность:</b> ${new Date(context.lastActivity).toLocaleString('ru-RU')}`;

        await axios.post(
          `${this.baseUrl}${this.config!.botToken}/sendMessage`,
          {
            chat_id: this.config!.operatorChatId,
            text: instructionMessage,
            parse_mode: 'HTML',
            reply_to_message_id: message?.message_id
          },
          {
            timeout: 10000, // 10 секунд таймаут
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        await this.answerCallbackQuery(callbackQuery.id, '✅ Инструкция отправлена');
        return true;
      }

      return false;

    } catch (error) {
      console.error('❌ Failed to handle callback query:', {
        callbackData: callbackQuery.data,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
      
      try {
        await this.answerCallbackQuery(callbackQuery.id, '❌ Ошибка обработки');
      } catch (answerError) {
        console.error('❌ Failed to answer callback query:', answerError);
      }
      
      return false;
    }
  }

  /**
   * Обработать текстовое сообщение от оператора или бота в группе
   */
  async handleOperatorMessage(message: { 
    text: string; 
    from: { first_name?: string; username?: string; id?: number; is_bot?: boolean };
    chat: { id: number; type: string; title?: string };
    message_id?: number;
  }): Promise<boolean> {
    try {
      const text = message.text;
      const operatorName = message.from.first_name || 'Оператор';
      const chatId = message.chat.id;
      const chatType = message.chat.type; // 'private', 'group', 'supergroup'
      const isGroup = chatType === 'group' || chatType === 'supergroup';

      console.log('🔍 Processing message:', {
        text: text?.substring(0, 100),
        from: operatorName,
        chatId,
        chatType,
        isGroup,
        isBot: message.from.is_bot,
        timestamp: new Date().toISOString()
      });

      // ✅ НОВОЕ: Обработка сообщений с кредом для настройки группы клиентов
      if (isGroup && text && text.toLowerCase().includes('ruheggs')) {
        console.log('🔑 Detected credentials message in group:', {
          chatId,
          chatTitle: message.chat.title,
          text: text.substring(0, 50)
        });
        
        // Сохраняем ID группы клиентов
        await this.saveClientGroupChatId(chatId.toString());
        
        // Отвечаем в группе с инструкциями
        const responseMessage = `✅ <b>Группа клиентов настроена!</b>

📋 <b>ID группы:</b> <code>${chatId}</code>
💬 <b>Заявки с сайта будут приходить в эту группу</b>

💡 <b>Для постоянного хранения добавьте в секреты:</b>

<b>GitHub Secrets:</b>
<code>gh secret set TELEGRAM_CLIENT_GROUP_CHAT_ID -b "${chatId}"</code>

<b>Kubernetes Secret:</b>
<code>kubectl create secret generic telegram-client-group --from-literal=TELEGRAM_CLIENT_GROUP_CHAT_ID="${chatId}" -n canton-otc</code>

✅ После добавления в секреты перезапустите deployment.`;
        
        await this.sendMessageToChat(chatId, responseMessage);
        
        console.log('✅ Client group configured successfully:', {
          chatId,
          chatTitle: message.chat.title,
          timestamp: new Date().toISOString()
        });
        
        return true;
      }

      // Проверяем формат: ORDER_ID: сообщение
      const match = text.match(/^([A-Z0-9-]+):\s*(.+)$/);
      if (!match) {
        return false; // Не наш формат, игнорируем
      }

      const [, orderId, operatorMessage] = match;
      const context = await conversationStorageService.getContext(orderId);
      
      if (!context) {
        await this.sendMessageToOperator(
          `❌ Контекст разговора не найден для заказа: ${orderId}`
        );
        return false;
      }

      // Отправляем ответ клиенту
      const success = await this.sendOperatorReply(orderId, operatorMessage, operatorName);
      
      if (success) {
        // Обновляем время активности после успешной отправки
        await conversationStorageService.updateActivity(orderId);
      }

      return success;

    } catch (error) {
      console.error('❌ Failed to handle operator message:', {
        messageText: message.text?.substring(0, 100),
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
      
      // Пытаемся уведомить оператора об ошибке
      try {
        await this.sendMessageToOperator(
          `❌ Ошибка обработки сообщения: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      } catch (notificationError) {
        console.error('❌ Failed to send error notification to operator:', notificationError);
      }
      
      return false;
    }
  }

  /**
   * Отправить сообщение оператору
   */
  private async sendMessageToOperator(text: string): Promise<void> {
    try {
      if (!this.config) return;

      await axios.post(
        `${this.baseUrl}${this.config.botToken}/sendMessage`,
        {
          chat_id: this.config.operatorChatId,
          text,
          parse_mode: 'HTML'
        },
        {
          timeout: 10000, // 10 секунд таймаут
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

    } catch (error) {
      console.error('❌ Failed to send message to operator:', error);
    }
  }

  /**
   * ✅ Отправить сообщение в указанный чат (группу или личку)
   */
  private async sendMessageToChat(chatId: string | number, text: string, parseMode: string = 'HTML'): Promise<boolean> {
    try {
      if (!this.config) {
        console.warn('⚠️ Telegram Mediator not configured');
        return false;
      }

      const response = await axios.post(
        `${this.baseUrl}${this.config.botToken}/sendMessage`,
        {
          chat_id: chatId,
          text,
          parse_mode: parseMode
        },
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.ok === true;
    } catch (error) {
      console.error('❌ Failed to send message to chat:', {
        chatId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Ответить на callback query
   */
  private async answerCallbackQuery(
    callbackQueryId: string, 
    text: string, 
    options?: { showAlert?: boolean; showLoading?: boolean }
  ): Promise<void> {
    try {
      if (!this.config) return;

      const payload: any = {
        callback_query_id: callbackQueryId,
        text,
        show_alert: options?.showAlert || false
      };

      // Показываем loading state
      if (options?.showLoading) {
        // Для показа loading просто отвечаем без текста
        await axios.post(
          `${this.baseUrl}${this.config.botToken}/answerCallbackQuery`,
          {
            callback_query_id: callbackQueryId,
            text: '',
            show_alert: false
          },
          {
            timeout: 5000,
            headers: { 'Content-Type': 'application/json' }
          }
        );
        // Не отправляем второй раз если это только loading
        if (!text) return;
      }

      await axios.post(
        `${this.baseUrl}${this.config.botToken}/answerCallbackQuery`,
        payload,
        {
          timeout: 5000,
          headers: { 'Content-Type': 'application/json' }
        }
      );

    } catch (error) {
      console.error('❌ Failed to answer callback query:', error);
    }
  }

  /**
   * Логировать сообщение локально
   */
  private logMessageLocally(type: string, orderId: string, message: string): void {
    console.log(`🤖 ${type} (LOCAL):`, {
      orderId,
      message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Тест соединения
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.config) {
        console.log('🤖 Telegram Mediator not configured');
        return false;
      }

      const response = await axios.get(
        `${this.baseUrl}${this.config.botToken}/getMe`,
        { timeout: 5000 }
      );

      if (response.data.ok) {
        console.log('🤖 Telegram Mediator connection successful:', response.data.result.first_name);
        return true;
      }

      return false;

    } catch (error) {
      console.error('❌ Telegram Mediator connection failed:', error);
      return false;
    }
  }

  /**
   * Получить статистику разговоров
   */
  getConversationStats(): {
    activeConversations: number;
    totalConversations: number;
    expiredConversations: number;
    storageType: string;
  } {
    return conversationStorageService.getStats();
  }

  /**
   * ✅ Проверка готовности сделки (есть покупатель и продавец)
   * Уведомляет администратора когда обе стороны приняты операторами
   */
  private async checkDealReadiness(
    acceptedOrder: any,
    supabase: any,
    telegramService: any
  ): Promise<void> {
    try {
      const exchangeDirection = acceptedOrder.exchange_direction;
      const oppositeDirection = exchangeDirection === 'buy' ? 'sell' : 'buy';
      
      // Ищем противоположные заявки с похожими параметрами
      // Допускаем отклонение до 10% по сумме для гибкости
      const amountTolerance = 0.1; // 10%
      const minAmount = Number(acceptedOrder.payment_amount_usd) * (1 - amountTolerance);
      const maxAmount = Number(acceptedOrder.payment_amount_usd) * (1 + amountTolerance);
      
      console.log('🔍 Checking for matching orders:', {
        currentOrder: acceptedOrder.order_id,
        direction: exchangeDirection,
        lookingFor: oppositeDirection,
        amountRange: { min: minAmount, max: maxAmount },
        timestamp: new Date().toISOString()
      });
      
      // Ищем противоположные принятые заявки
      const { data: matchingOrders, error: searchError } = await supabase
        .from('public_orders')
        .select('*')
        .eq('exchange_direction', oppositeDirection)
        .eq('status', 'accepted') // Только принятые заявки
        .gte('payment_amount_usd', minAmount)
        .lte('payment_amount_usd', maxAmount)
        .order('accepted_at', { ascending: true }); // По очереди принятия
      
      if (searchError) {
        console.error('❌ Error searching for matching orders:', searchError);
        return;
      }
      
      if (!matchingOrders || matchingOrders.length === 0) {
        console.log('ℹ️ No matching orders found for deal readiness');
        return;
      }
      
      // Находим лучшую пару (ближайшую по сумме)
      const bestMatch = matchingOrders.reduce((best: any, current: any) => {
        const bestDiff = Math.abs(Number(best.payment_amount_usd) - Number(acceptedOrder.payment_amount_usd));
        const currentDiff = Math.abs(Number(current.payment_amount_usd) - Number(acceptedOrder.payment_amount_usd));
        return currentDiff < bestDiff ? current : best;
      }, matchingOrders[0]);
      
      console.log('✅ Found matching order for deal:', {
        buyOrder: exchangeDirection === 'buy' ? acceptedOrder.order_id : bestMatch.order_id,
        sellOrder: exchangeDirection === 'sell' ? acceptedOrder.order_id : bestMatch.order_id,
        buyAmount: exchangeDirection === 'buy' ? acceptedOrder.payment_amount_usd : bestMatch.payment_amount_usd,
        sellAmount: exchangeDirection === 'sell' ? acceptedOrder.payment_amount_usd : bestMatch.payment_amount_usd,
        buyOperator: exchangeDirection === 'buy' ? acceptedOrder.operator_username : bestMatch.operator_username,
        sellOperator: exchangeDirection === 'sell' ? acceptedOrder.operator_username : bestMatch.operator_username,
        timestamp: new Date().toISOString()
      });
      
      // Уведомляем администратора о готовности сделки
      const adminChatId = process.env.TELEGRAM_CHAT_ID; // Приватный канал администраторов
      if (adminChatId) {
        const buyOrder = exchangeDirection === 'buy' ? acceptedOrder : bestMatch;
        const sellOrder = exchangeDirection === 'sell' ? acceptedOrder : bestMatch;
        
        const dealReadyMessage = `
🎯 <b>СДЕЛКА ГОТОВА К ИСПОЛНЕНИЮ!</b>

📊 <b>Пара заявок:</b>
🛒 <b>Покупка:</b> #${buyOrder.order_id}
   💰 Сумма: $${Number(buyOrder.payment_amount_usd).toFixed(2)} USDT
   📊 Получение: ${Number(buyOrder.canton_amount).toFixed(2)} CC
   👤 Оператор: @${buyOrder.operator_username || 'оператор'}
   📧 Клиент: ${buyOrder.email}

💸 <b>Продажа:</b> #${sellOrder.order_id}
   📊 Продажа: ${Number(sellOrder.canton_amount).toFixed(2)} CC
   💰 Получение: $${Number(sellOrder.payment_amount_usd).toFixed(2)} USDT
   👤 Оператор: @${sellOrder.operator_username || 'оператор'}
   📧 Клиент: ${sellOrder.email}

⏰ <b>Время принятия:</b>
   Покупка: ${new Date(buyOrder.accepted_at).toLocaleString('ru-RU')}
   Продажа: ${new Date(sellOrder.accepted_at).toLocaleString('ru-RU')}

✅ <b>Обе стороны приняты операторами - можно начинать сделку!</b>
        `.trim();
        
        await telegramService.sendCustomMessage(dealReadyMessage);
        
        console.log('✅ Admin notified about ready deal:', {
          buyOrderId: buyOrder.order_id,
          sellOrderId: sellOrder.order_id,
          timestamp: new Date().toISOString()
        });
      }
      
      // ✅ ИСПРАВЛЕНО: Используем атомарную функцию для матчинга
      try {
        // Используем атомарную функцию для матчинга
        const { data: matched, error: matchError } = await supabase
          .rpc('match_orders', {
            order1_id: acceptedOrder.order_id,
            order2_id: bestMatch.order_id
          });
        
        if (matchError) {
          console.error('❌ Error matching orders:', matchError);
          return; // Не блокируем основной процесс
        }
        
        if (!matched) {
          console.warn('⚠️ Orders could not be matched (race condition or validation failed)');
          return;
        }
        
        console.log('✅ Orders atomically matched:', {
          order1: acceptedOrder.order_id,
          order2: bestMatch.order_id,
          timestamp: new Date().toISOString()
        });
      } catch (matchError) {
        console.error('⚠️ Could not match orders (non-critical):', matchError);
        // Не критично, просто не установили связь
      }
      
    } catch (error) {
      console.error('❌ Error checking deal readiness:', error);
      // Не блокируем основной процесс если проверка не удалась
    }
  }

  /**
   * Получить активные разговоры
   */
  async getActiveConversations(): Promise<ConversationContext[]> {
    return await conversationStorageService.getActiveConversations();
  }

  /**
   * Очистить устаревшие разговоры
   */
  async cleanupExpiredConversations(): Promise<number> {
    return await conversationStorageService.cleanupExpired();
  }
}

// Export singleton instance
export const telegramMediatorService = new TelegramMediatorService();
export default telegramMediatorService;
