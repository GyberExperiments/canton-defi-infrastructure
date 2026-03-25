/**
 * 📱 Real Telegram Bot Integration
 * Production-ready service for OTC order notifications
 */

import axios from 'axios';
import { OTC_CONFIG, type OTCOrder, getCantonCoinBuyPriceSync, getCantonCoinSellPriceSync } from '@/config/otc';

interface TelegramConfig {
  botToken: string;
  chatId: string; // Канал операторов (используется для публикации заявок)
  serviceBotUsername?: string; // Сервисный бот (новое)
  operatorUsername?: string; // Оператор (новое)
}

class TelegramService {
  private config: TelegramConfig | null = null;
  private baseUrl = 'https://api.telegram.org/bot';

  constructor() {
    this.initializeConfig();
  }

  private initializeConfig() {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID; // Группа нотификаций (для операторов)
    const clientGroupChatId = process.env.TELEGRAM_CLIENT_GROUP_CHAT_ID; // ✅ Группа клиентов

    if (!botToken || !chatId) {
      console.warn('Telegram Bot configuration missing. Service will be disabled.');
      return;
    }

    this.config = { botToken, chatId };
    
    // 🔍 ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ конфигурации групп
    console.log('📱 Telegram Service Config:', {
      hasBotToken: !!botToken,
      operatorGroupChatId: chatId, // Группа нотификаций
      clientGroupChatId: clientGroupChatId || 'не настроена', // Группа клиентов
      clientGroupChatIdRaw: process.env.TELEGRAM_CLIENT_GROUP_CHAT_ID, // Сырое значение для диагностики
      isClientGroupConfigured: !!clientGroupChatId,
      timestamp: new Date().toISOString()
    });
    
    // ⚠️ Предупреждение если группа клиентов не настроена
    if (!clientGroupChatId) {
      console.warn('⚠️ TELEGRAM_CLIENT_GROUP_CHAT_ID не настроена - sendPublicOrderNotification будет использовать fallback на группу операторов');
    } else {
      console.log('✅ TELEGRAM_CLIENT_GROUP_CHAT_ID настроена:', clientGroupChatId);
    }
  }

  /**
   * Send new order notification
   */
  async sendOrderNotification(order: OTCOrder): Promise<boolean> {
    try {
      if (!this.config) {
        console.log('📱 Telegram Bot disabled - logging notification locally');
        this.logNotificationLocally('NEW ORDER', order);
        return false;
      }

      const message = this.formatOrderMessage(order);
      
      const response = await axios.post(
        `${this.baseUrl}${this.config.botToken}/sendMessage`,
        {
          chat_id: this.config.chatId,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '✅ Принять заказ',
                  callback_data: `accept_order:${order.orderId}`
                },
                {
                  text: '📧 Написать клиенту',
                  callback_data: `contact_${order.orderId}`
                }
              ],
              [
                {
                  text: '📊 Открыть в админке',
                  url: `https://stage.minimal.build.infra.1otc.cc/admin/orders`
                },
                {
                  text: '💳 Отправить реквизиты',
                  callback_data: `payment_${order.orderId}`
                }
              ],
              [
                {
                  text: '🗑️ Удалить заявку из канала',
                  callback_data: `delete_order:${order.orderId}`
                }
              ]
            ]
          }
        }
      );

      if (response.data.ok) {
        console.log('📱 Telegram notification sent successfully:', order.orderId);
        return true;
      } else {
        throw new Error(`Telegram API error: ${response.data.description}`);
      }

    } catch (error) {
      console.error('❌ Failed to send Telegram notification:', error);
      // Fallback to local logging
      this.logNotificationLocally('NEW ORDER', order);
      return false;
    }
  }

  /**
   * Send status update notification
   */
  async sendStatusUpdate(order: OTCOrder, newStatus: string, additionalInfo?: string): Promise<boolean> {
    try {
      if (!this.config) {
        console.log('📱 Telegram Bot disabled - logging status update locally');
        return false;
      }

      const message = this.formatStatusUpdateMessage(order, newStatus, additionalInfo);
      
      const response = await axios.post(
        `${this.baseUrl}${this.config.botToken}/sendMessage`,
        {
          chat_id: this.config.chatId,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }
      );

      if (response.data.ok) {
        console.log('📱 Telegram status update sent:', order.orderId, newStatus);
        return true;
      } else {
        throw new Error(`Telegram API error: ${response.data.description}`);
      }

    } catch (error) {
      console.error('❌ Failed to send Telegram status update:', error);
      return false;
    }
  }

  /**
   * Format new order message
   */
  private formatOrderMessage(order: OTCOrder): string {
    const timestamp = new Date(order.timestamp).toLocaleString('ru-RU', { 
      timeZone: 'Europe/Moscow',
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Определяем направление обмена
    const exchangeDirection = (order as unknown as { exchangeDirection?: 'buy' | 'sell' }).exchangeDirection || 'buy'
    const isBuying = exchangeDirection === 'buy'
    
    // Получаем цену и комиссию
    const manualPrice = (order as unknown as { manualPrice?: number }).manualPrice;
    const isMarketPrice = (order as unknown as { isMarketPrice?: boolean }).isMarketPrice === true;
    const marketPriceDiscountPercent = (order as unknown as { marketPriceDiscountPercent?: number }).marketPriceDiscountPercent || 0;
    const serviceCommission = (order as unknown as { serviceCommission?: number }).serviceCommission || 3;
    
    // Вычисляем цену с учетом дисконта
    let price: number;
    if (manualPrice && !isMarketPrice) {
      price = manualPrice;
    } else {
      const marketPrice = isBuying ? getCantonCoinBuyPriceSync() : getCantonCoinSellPriceSync();
      price = marketPrice * (1 - marketPriceDiscountPercent / 100);
    }
    
    let priceDisplay: string;
    if (isMarketPrice) {
      if (marketPriceDiscountPercent > 0) {
        priceDisplay = `$${price.toFixed(4)} (рыночная, скидка ${marketPriceDiscountPercent}%)`;
      } else {
        priceDisplay = `$${price.toFixed(4)} (рыночная)`;
      }
    } else if (manualPrice) {
      priceDisplay = `$${price.toFixed(4)} (ручной ввод)`;
    } else {
      priceDisplay = `$${price.toFixed(4)}`;
    }
    
    // Форматируем строку суммы в зависимости от направления
    const amountLine = isBuying
      ? `💰 <b>ТИП:</b> 🛒 <b>ПОКУПКА CANTON</b>\n💵 <b>Оплата:</b> $${order.paymentAmountUSD || order.usdtAmount || 0} ${order.paymentToken ? order.paymentToken.symbol : 'USDT'}\n📊 <b>Получение:</b> ${order.cantonAmount} Canton Coin`
      : `💰 <b>ТИП:</b> 💸 <b>ПРОДАЖА CANTON</b>\n📊 <b>Продажа:</b> ${order.cantonAmount} Canton Coin\n💵 <b>Получение:</b> $${order.paymentAmountUSD || order.usdtAmount || 0} ${order.paymentToken ? order.paymentToken.symbol : 'USDT'}`

    // Получаем receiving_address (важно для sell)
    const receivingAddress = (order as unknown as { receivingAddress?: string }).receivingAddress;

    return `
🔥 <b>НОВАЯ OTC ЗАЯВКА</b>

📋 <b>ID:</b> <code>${order.orderId}</code>
${amountLine}
💵 <b>Цена CC:</b> ${priceDisplay}
📈 <b>Комиссия:</b> ${serviceCommission}%
📅 <b>Время:</b> ${timestamp} (МСК)

👤 <b>АДРЕСА:</b>
🏛️ Canton Address: <code>${order.cantonAddress}</code>
${receivingAddress ? `💳 Receiving Address: <code>${receivingAddress}</code>\n` : ''}🔄 Refund Address: <code>${order.refundAddress || 'Не указан'}</code>

📞 <b>КОНТАКТЫ:</b>
📧 Email: ${order.email}
📱 WhatsApp: ${order.whatsapp || 'Не указан'}
📟 Telegram: ${order.telegram || 'Не указан'}

🎯 <b>СТАТУС:</b> ${this.getStatusEmoji(order.status)} ${order.status}

💬 <b>СПОСОБ ОПЛАТЫ:</b> Связаться с клиентом через Intercom чат для получения инструкций по оплате

⏰ Обработка в рабочие часы: ${OTC_CONFIG.BUSINESS_HOURS}
    `.trim();
  }

  /**
   * Format status update message
   */
  private formatStatusUpdateMessage(order: OTCOrder, newStatus: string, additionalInfo?: string): string {
    const timestamp = new Date().toLocaleString('ru-RU', { 
      timeZone: 'Europe/Moscow',
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    let message = `
🔄 <b>ОБНОВЛЕНИЕ СТАТУСА</b>

📋 <b>Order ID:</b> <code>${order.orderId}</code>
💰 <b>Сумма:</b> $${order.usdtAmount || order.paymentAmountUSD || 0} USDT → ${order.cantonAmount} CC
📅 <b>Обновлено:</b> ${timestamp} (МСК)

🎯 <b>НОВЫЙ СТАТУС:</b> ${this.getStatusEmoji(newStatus)} ${newStatus}
    `.trim();

    if (additionalInfo) {
      message += `\n\n📝 <b>Дополнительно:</b> ${additionalInfo}`;
    }

    return message;
  }

  /**
   * Get status emoji
   */
  private getStatusEmoji(status: string): string {
    const emojiMap: Record<string, string> = {
      'awaiting-deposit': '🟠',
      'awaiting-confirmation': '🔵',
      'exchanging': '🟡',
      'sending': '🟢',
      'completed': '✅',
      'failed': '❌',
    };

    return emojiMap[status] || '⚪';
  }

  /**
   * Log notification locally when Telegram is disabled
   */
  private logNotificationLocally(type: string, order: OTCOrder): void {
    console.log(`📱 ${type} NOTIFICATION (LOCAL):`, {
      orderId: order.orderId,
      amount: `$${order.usdtAmount || order.paymentAmountUSD || 0} → ${order.cantonAmount} CC`,
      email: order.email,
      status: order.status,
      timestamp: new Date(order.timestamp).toISOString()
    });
  }

  /**
   * Test Telegram Bot connection
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.config) {
        console.log('📱 Telegram Bot not configured');
        return false;
      }

      const response = await axios.get(
        `${this.baseUrl}${this.config.botToken}/getMe`
      );

      if (response.data.ok) {
        console.log('📱 Telegram Bot connection successful:', response.data.result.username);
        return true;
      }

      return false;

    } catch (error) {
      console.error('❌ Telegram Bot connection failed:', error);
      return false;
    }
  }

  /**
   * Send test message
   */
  async sendTestMessage(): Promise<boolean> {
    try {
      if (!this.config) {
        return false;
      }

      const message = `
🧪 <b>ТЕСТ СИСТЕМЫ УВЕДОМЛЕНИЙ</b>

✅ Telegram Bot подключен
📊 Google Sheets готов
📧 Email сервис активен
⏰ ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })} (МСК)

🏛️ <b>Canton OTC Exchange</b> готов к работе!
      `.trim();

      return await this.sendMessage(message);

    } catch (error) {
      console.error('❌ Failed to send test message:', error);
      return false;
    }
  }

  /**
   * Send custom message to operator group
   */
  async sendCustomMessage(text: string): Promise<boolean> {
    return await this.sendMessage(text)
  }

  /**
   * Send raw message
   */
  private async sendMessage(text: string): Promise<boolean> {
    try {
      if (!this.config) return false;

      const response = await axios.post(
        `${this.baseUrl}${this.config.botToken}/sendMessage`,
        {
          chat_id: this.config.chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }
      );

      return response.data.ok;

    } catch (error) {
      console.error('❌ Failed to send message:', error);
      return false;
    }
  }

  /**
   * Публикация заявки в группу клиентов (вместо группы нотификаций)
   */
  async sendPublicOrderNotification(order: OTCOrder): Promise<{success: boolean, messageId?: number}> {
    try {
      if (!this.config) {
        console.log('📱 Telegram Bot disabled - cannot publish to channel');
        return { success: false };
      }

      // ✅ НОВОЕ: Используем группу клиентов вместо группы нотификаций
      // Приоритет: TELEGRAM_CLIENT_GROUP_CHAT_ID > TELEGRAM_CHAT_ID (fallback)
      const clientGroupChatId = process.env.TELEGRAM_CLIENT_GROUP_CHAT_ID;
      const chatId = clientGroupChatId || this.config.chatId;
      
      // 🔍 ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ для диагностики
      console.log('🔍 sendPublicOrderNotification debug:', {
        orderId: order.orderId,
        clientGroupChatId: clientGroupChatId || 'undefined',
        configChatId: this.config.chatId,
        finalChatId: chatId,
        isClientGroup: !!clientGroupChatId,
        usingFallback: !clientGroupChatId,
        allTelegramEnvVars: {
          TELEGRAM_CLIENT_GROUP_CHAT_ID: process.env.TELEGRAM_CLIENT_GROUP_CHAT_ID || 'undefined',
          TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || 'undefined',
        },
        timestamp: new Date().toISOString()
      });
      
      if (!chatId) {
        console.warn('⚠️ Telegram client group not configured');
        return { success: false };
      }

      console.log('📤 Publishing order to client group:', {
        orderId: order.orderId,
        chatId,
        isClientGroup: !!clientGroupChatId,
        timestamp: new Date().toISOString()
      });

      const message = this.formatPublicOrderMessage(order);
      
      const response = await axios.post(
        `${this.baseUrl}${this.config.botToken}/sendMessage`,
        {
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '✅ Принять заявку',
                  callback_data: `accept_order:${order.orderId}`
                }
              ]
            ]
          }
        },
        {
          timeout: 10000
        }
      );

      if (response.data.ok) {
        const messageId = response.data.result.message_id;
        console.log('✅ Order published to channel:', {
          orderId: order.orderId,
          messageId,
          channel: chatId
        });
        return { success: true, messageId };
      }
      
      return { success: false };
    } catch (error) {
      console.error('❌ Failed to publish order to channel:', error);
      return { success: false };
    }
  }

  /**
   * Форматирование сообщения для публичного канала
   * REQ-007: Упрощенный текст на английском языке
   */
  private formatPublicOrderMessage(order: OTCOrder): string {
    const exchangeDirection = (order as unknown as { exchangeDirection?: 'buy' | 'sell' }).exchangeDirection || 'buy';
    const isBuying = exchangeDirection === 'buy';
    const direction = isBuying ? 'BUY' : 'SELL';
    
    const timestamp = new Date(order.timestamp).toLocaleString('en-GB', {
      timeZone: 'Europe/Moscow',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // REQ-002 & REQ-008: Получаем цену и проверяем флаг isMarketPrice
    const manualPrice = (order as unknown as { manualPrice?: number }).manualPrice;
    const isMarketPrice = (order as unknown as { isMarketPrice?: boolean }).isMarketPrice === true;
    const marketPriceDiscountPercent = (order as unknown as { marketPriceDiscountPercent?: number }).marketPriceDiscountPercent || 0;
    
    // Для получения рыночной цены используем синхронные геттеры (fallback)
    let price: number;
    
    if (manualPrice && !isMarketPrice) {
      price = manualPrice;
    } else {
      // Используем синхронные геттеры (fallback) для рыночной цены с учетом дисконта
      const marketPrice = isBuying ? getCantonCoinBuyPriceSync() : getCantonCoinSellPriceSync();
      price = marketPrice * (1 - marketPriceDiscountPercent / 100);
    }

    // REQ-008: Условное отображение "(market)" только если isMarketPrice === true
    let priceDisplay: string;
    if (isMarketPrice) {
      if (marketPriceDiscountPercent > 0) {
        priceDisplay = `$${price.toFixed(4)} (market, ${marketPriceDiscountPercent}% discount)`;
      } else {
        priceDisplay = `$${price.toFixed(4)} (market)`;
      }
    } else {
      priceDisplay = `$${price.toFixed(4)}`;
    }

    const amountLine = isBuying
      ? `<b>Payment:</b> $${(order.paymentAmountUSD || order.usdtAmount || 0).toFixed(2)} ${order.paymentToken?.symbol || 'USDT'}\n<b>Receiving:</b> ${order.cantonAmount.toFixed(2)} Canton Coin`
      : `<b>Payment:</b> ${order.cantonAmount.toFixed(2)} Canton Coin\n<b>Receiving:</b> $${(order.paymentAmountUSD || order.usdtAmount || 0).toFixed(2)} ${order.paymentToken?.symbol || 'USDT'}`;

    const serviceBotUsername = process.env.TELEGRAM_SERVICE_BOT_USERNAME || '@TECH_HY_Customer_Service_bot';
    const operatorUsername = process.env.TELEGRAM_OPERATOR_USERNAME || '@hypov';

    return `
🔔 <b>NEW OTC ORDER</b>

<b>Type:</b> ${direction} Canton Coin
${amountLine}

<b>Price CC:</b> ${priceDisplay}
<b>Order ID:</b> <code>${order.orderId}</code>
<b>Created:</b> ${timestamp} (MSK)

<b>CONTACT:</b>
${serviceBotUsername}
${operatorUsername}
  `.trim();
  }

  /**
   * Создание deep link для сервисного чата
   * Telegram Bot API не позволяет создавать чаты автоматически,
   * поэтому используем deep link для начала диалога с ботом
   */
  async createServiceChat(orderId: string): Promise<string> {
    try {
      const serviceBotUsername = process.env.TELEGRAM_SERVICE_BOT_USERNAME || 'TECH_HY_Customer_Service_bot';
      
      // Убираем @ если есть
      const botUsername = serviceBotUsername.replace('@', '');
      
      // Создаем deep link для начала диалога с ботом
      // Формат: https://t.me/bot_username?start=order_orderId
      const deepLink = `https://t.me/${botUsername}?start=order_${orderId}`;
      
      console.log('✅ Service chat link created:', {
        orderId,
        deepLink,
        botUsername
      });
      
      return deepLink;
    } catch (error) {
      console.error('❌ Failed to create service chat link:', error);
      // Fallback: возвращаем username бота
      const serviceBotUsername = process.env.TELEGRAM_SERVICE_BOT_USERNAME || '@TECH_HY_Customer_Service_bot';
      return serviceBotUsername;
    }
  }

  /**
   * Обновление текста сообщения в канале
   */
  async editMessageText(chatId: string | number, messageId: number, newText: string): Promise<boolean> {
    try {
      if (!this.config) {
        return false;
      }

      const response = await axios.post(
        `${this.baseUrl}${this.config.botToken}/editMessageText`,
        {
          chat_id: chatId,
          message_id: messageId,
          text: newText,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        },
        {
          timeout: 10000
        }
      );

      return response.data.ok === true;
    } catch (error) {
      console.error('❌ Failed to edit message:', error);
      return false;
    }
  }

  /**
   * Удаление сообщения из канала (только для оператора)
   */
  async deleteMessage(chatId: string | number, messageId: number): Promise<boolean> {
    try {
      if (!this.config) {
        console.warn('⚠️ Telegram Bot not configured - cannot delete message');
        return false;
      }

      const response = await axios.post(
        `${this.baseUrl}${this.config.botToken}/deleteMessage`,
        {
          chat_id: chatId,
          message_id: messageId
        },
        {
          timeout: 10000
        }
      );

      if (response.data.ok) {
        console.log('✅ Message deleted from channel:', {
          chatId,
          messageId,
          timestamp: new Date().toISOString()
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Failed to delete message:', error);
      return false;
    }
  }

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
    
    // 3. ✅ ИСПРАВЛЕНО: Безопасный fallback на Email
    if (!telegramClientSuccess && !intercomSuccess) {
      try {
        // Безопасный импорт с проверкой
        let emailModule;
        try {
          emailModule = await import('@/lib/services/email');
        } catch (importError) {
          console.warn('⚠️ Email service module not found (expected for initial release)');
          emailModule = null;
        }
        
        if (emailModule && emailModule.emailService) {
          const { emailService } = emailModule;
          
          // Проверяем что сервис доступен
          if (emailService.isAvailable && emailService.isAvailable()) {
            try {
              emailSuccess = await emailService.sendStatusUpdate(
                order,
                'accepted',
                notificationMessage
              );
              
              if (emailSuccess) {
                console.log('✅ Customer notified via Email:', order.orderId);
              } else {
                console.warn('⚠️ Email sent but service returned false');
              }
            } catch (sendError) {
              console.warn('⚠️ Email sending failed:', sendError);
            }
          } else {
            console.log('ℹ️ Email service not available (stub mode)');
          }
        } else {
          console.log('ℹ️ Email service not loaded (stub mode or not implemented)');
        }
      } catch (error) {
        // Полностью не критично - это последний fallback
        console.warn('⚠️ Email notification error (non-critical):', 
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

  /**
   * Получить ссылку на сервисного бота
   */
  private getServiceBotLink(orderId: string): string {
    const serviceBotUsername = process.env.TELEGRAM_SERVICE_BOT_USERNAME || 'TECH_HY_Customer_Service_bot';
    const botUsername = serviceBotUsername.replace('@', '');
    return `https://t.me/${botUsername}?start=order_${orderId}`;
  }
}

// Export singleton instance
export const telegramService = new TelegramService();
export default telegramService;
