/**
 * 💬 Intercom Integration Service
 * Production-ready service for OTC order notifications via Intercom
 * Replaces Telegram bot with modern customer support platform
 */

import axios from 'axios';
import { OTC_CONFIG, type OTCOrder } from '@/config/otc';

interface IntercomConfig {
  appId: string;
  accessToken: string;
  adminId: string;
}

interface IntercomUser {
  user_id: string;
  email: string;
  name?: string;
  role?: 'user' | 'lead'; // Required for Intercom API v2.14
  custom_attributes?: Record<string, string | number | boolean>;
}

interface IntercomConversation {
  type: 'conversation';
  id: string;
  created_at: number;
  updated_at: number;
  source: {
    type: 'admin';
    id: string;
  };
  contacts: {
    type: 'contact.list';
    contacts: Array<{
      type: 'contact';
      id: string;
    }>;
  };
  conversation_parts: {
    type: 'conversation_part.list';
    conversation_parts: Array<{
      type: 'conversation_part';
      id: string;
      part_type: 'comment';
      body: string;
      created_at: number;
      author: {
        type: 'admin';
        id: string;
      };
    }>;
  };
}

class IntercomService {
  private config: IntercomConfig | null = null;
  private baseUrl = 'https://api.intercom.io';

  constructor() {
    this.initializeConfig();
  }

  private initializeConfig() {
    const appId = process.env.NEXT_PUBLIC_INTERCOM_APP_ID;
    const accessToken = process.env.INTERCOM_ACCESS_TOKEN;
    const adminId = process.env.INTERCOM_ADMIN_ID;

    if (!appId || !accessToken || !adminId) {
      console.warn('Intercom configuration missing. Service will be disabled.');
      return;
    }

    this.config = { appId, accessToken, adminId };
  }

  /**
   * Send new order notification via Intercom
   */
  async sendOrderNotification(order: OTCOrder): Promise<boolean> {
    try {
      if (!this.config) {
        console.log('💬 Intercom disabled - logging notification locally');
        this.logNotificationLocally('NEW ORDER', order);
        return false;
      }

      // Create or find user in Intercom
      const user = await this.createOrUpdateUser(order);
      if (!user) {
        throw new Error('Failed to create/update user in Intercom');
      }

      // Create conversation with order details
      const conversation = await this.createConversation(user, order);
      if (!conversation) {
        throw new Error('Failed to create conversation in Intercom');
      }

      console.log('💬 Intercom notification sent successfully:', order.orderId);
      return true;

    } catch (error) {
      console.error('❌ Failed to send Intercom notification:', error);
      // Fallback to local logging
      this.logNotificationLocally('NEW ORDER', order);
      return false;
    }
  }

  /**
   * Send operator reply to client via Intercom with retry mechanism
   */
  async sendOperatorReply(
    conversationId: string,
    message: string,
    operatorName?: string
  ): Promise<boolean> {
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (!this.config) {
          console.log('💬 Intercom disabled - logging operator reply locally');
          return false;
        }

        const messageData = {
          message_type: 'note',
          type: 'admin',
          body: operatorName ? `**${operatorName}:** ${message}` : message
        };

        await axios.post(
          `${this.baseUrl}/conversations/${conversationId}/parts`,
          messageData,
          {
            headers: {
              'Authorization': `Bearer ${this.config.accessToken}`,
              'Content-Type': 'application/json',
              'Intercom-Version': '2.14'
            },
            timeout: 10000 // 10 second timeout
          }
        );

        console.log('💬 Operator reply sent via Intercom:', conversationId);
        return true;

      } catch (error) {
        console.error(`❌ Failed to send operator reply via Intercom (attempt ${attempt}/${maxRetries}):`, error);
        
        if (attempt === maxRetries) {
          console.error('❌ All retry attempts failed for operator reply');
          return false;
        }
        
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }

    return false;
  }

  /**
   * Send status update notification
   */
  async sendStatusUpdate(order: OTCOrder, newStatus: string, additionalInfo?: string): Promise<boolean> {
    try {
      if (!this.config) {
        console.log('💬 Intercom disabled - logging status update locally');
        return false;
      }

      // Find existing conversation for this order
      const conversation = await this.findConversationByOrderId(order.orderId);
      if (!conversation) {
        console.warn(`No conversation found for order ${order.orderId}`);
        return false;
      }

      // Add status update as conversation part
      const message = this.formatStatusUpdateMessage(order, newStatus, additionalInfo);
      await this.addMessageToConversation(conversation.id, message);

      console.log('💬 Intercom status update sent:', order.orderId, newStatus);
      return true;

    } catch (error) {
      console.error('❌ Failed to send Intercom status update:', error);
      return false;
    }
  }

  /**
   * Create or update user in Intercom
   */
  private async createOrUpdateUser(order: OTCOrder): Promise<IntercomUser | null> {
    try {
      const userData: IntercomUser = {
        user_id: order.email, // Use email as user_id for consistency
        email: order.email,
        name: order.email.split('@')[0], // Use email prefix as name
        role: 'user', // Required for Intercom API v2.14
        custom_attributes: {
          canton_address: order.cantonAddress,
          refund_address: order.refundAddress || '',
          whatsapp: order.whatsapp || '',
          telegram: order.telegram || '',
          last_order_id: order.orderId,
          last_order_amount: order.usdtAmount || order.paymentAmountUSD || 0,
          last_order_status: order.status,
          customer_since: new Date(order.timestamp).toISOString(),
        }
      };

      const response = await axios.post(
        `${this.baseUrl}/contacts`,
        userData,
        {
          headers: {
            'Authorization': `Bearer ${this.config!.accessToken}`,
            'Content-Type': 'application/json',
            'Intercom-Version': '2.14'
          }
        }
      );

      return response.data;

    } catch (error) {
      console.error('❌ Failed to create/update user in Intercom:', error);
      return null;
    }
  }

  /**
   * Create conversation for new order
   */
  private async createConversation(user: IntercomUser, order: OTCOrder): Promise<IntercomConversation | null> {
    try {
      const message = this.formatOrderMessage(order);
      
      const conversationData = {
        from: {
          type: 'admin',
          id: this.config!.adminId
        },
        to: {
          type: 'user',
          id: user.user_id
        },
        message_type: 'note',
        subject: `🔥 Новая OTC заявка #${order.orderId}`,
        body: message,
        custom_attributes: {
          order_id: order.orderId,
          order_type: 'otc_exchange',
          order_status: order.status,
          order_amount: order.usdtAmount || order.paymentAmountUSD || 0,
          canton_amount: order.cantonAmount,
          payment_token: 'USDT',
          created_at: new Date(order.timestamp).toISOString()
        }
      };

      const response = await axios.post(
        `${this.baseUrl}/conversations`,
        conversationData,
        {
          headers: {
            'Authorization': `Bearer ${this.config!.accessToken}`,
            'Content-Type': 'application/json',
            'Intercom-Version': '2.14'
          }
        }
      );

      return response.data;

    } catch (error) {
      console.error('❌ Failed to create conversation in Intercom:', error);
      return null;
    }
  }

  /**
   * Find conversation by order ID
   */
  private async findConversationByOrderId(orderId: string): Promise<IntercomConversation | null> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/conversations`,
        {
          params: {
            'custom_attributes.order_id': orderId
          },
          headers: {
            'Authorization': `Bearer ${this.config!.accessToken}`,
            'Intercom-Version': '2.14'
          }
        }
      );

      const conversations = response.data.conversations;
      return conversations && conversations.length > 0 ? conversations[0] : null;

    } catch (error) {
      console.error('❌ Failed to find conversation in Intercom:', error);
      return null;
    }
  }

  /**
   * Add message to existing conversation
   */
  private async addMessageToConversation(conversationId: string, message: string): Promise<boolean> {
    try {
      const messageData = {
        message_type: 'note',
        type: 'admin',
        body: message
      };

      await axios.post(
        `${this.baseUrl}/conversations/${conversationId}/parts`,
        messageData,
        {
          headers: {
            'Authorization': `Bearer ${this.config!.accessToken}`,
            'Content-Type': 'application/json',
            'Intercom-Version': '2.14'
          }
        }
      );

      return true;

    } catch (error) {
      console.error('❌ Failed to add message to conversation:', error);
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
    
    // Форматируем строку суммы в зависимости от направления
    const amountLine = isBuying
      ? `💰 **ТИП:** 🛒 **ПОКУПКА CANTON**\n💵 **Оплата:** $${order.paymentAmountUSD || order.usdtAmount || 0} ${order.paymentToken ? order.paymentToken.symbol : 'USDT'}\n📊 **Получение:** ${order.cantonAmount} Canton Coin`
      : `💰 **ТИП:** 💸 **ПРОДАЖА CANTON**\n📊 **Продажа:** ${order.cantonAmount} Canton Coin\n💵 **Получение:** $${order.paymentAmountUSD || order.usdtAmount || 0} ${order.paymentToken ? order.paymentToken.symbol : 'USDT'}`

    return `
🔥 **НОВАЯ OTC ЗАЯВКА**

📋 **ID:** \`${order.orderId}\`
${amountLine}
📅 **Время:** ${timestamp} (МСК)

👤 **ПОЛУЧАТЕЛЬ:**
🏛️ Canton Address: \`${order.cantonAddress}\`
🔄 Refund Address: \`${order.refundAddress || 'Не указан'}\`

📞 **КОНТАКТЫ:**
📧 Email: ${order.email}
📱 WhatsApp: ${order.whatsapp || 'Не указан'}
📟 Telegram: ${order.telegram || 'Не указан'}

🎯 **СТАТУС:** ${this.getStatusEmoji(order.status)} ${order.status}

💬 **СПОСОБ ОПЛАТЫ:** Клиент получит инструкции по оплате через чат поддержки

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
🔄 **ОБНОВЛЕНИЕ СТАТУСА**

📋 **Order ID:** \`${order.orderId}\`
💰 **Сумма:** $${order.usdtAmount || order.paymentAmountUSD || 0} USDT → ${order.cantonAmount} CC
📅 **Обновлено:** ${timestamp} (МСК)

🎯 **НОВЫЙ СТАТУС:** ${this.getStatusEmoji(newStatus)} ${newStatus}
    `.trim();

    if (additionalInfo) {
      message += `\n\n📝 **Дополнительно:** ${additionalInfo}`;
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
   * Log notification locally when Intercom is disabled
   */
  private logNotificationLocally(type: string, order: OTCOrder): void {
    console.log(`💬 ${type} NOTIFICATION (LOCAL):`, {
      orderId: order.orderId,
      amount: `$${order.usdtAmount || order.paymentAmountUSD || 0} → ${order.cantonAmount} CC`,
      email: order.email,
      status: order.status,
      timestamp: new Date(order.timestamp).toISOString()
    });
  }

  /**
   * Test Intercom connection
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.config) {
        console.log('💬 Intercom not configured');
        return false;
      }

      const response = await axios.get(
        `${this.baseUrl}/me`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Intercom-Version': '2.14'
          }
        }
      );

      if (response.data) {
        console.log('💬 Intercom connection successful:', response.data.name);
        return true;
      }

      return false;

    } catch (error) {
      console.error('❌ Intercom connection failed:', error);
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

      const testMessage = `
🧪 **ТЕСТ СИСТЕМЫ УВЕДОМЛЕНИЙ**

✅ Intercom подключен
📊 Google Sheets готов
📧 Email сервис активен
⏰ ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })} (МСК)

🏛️ **Canton OTC Exchange** готов к работе!
      `.trim();

      // Create test conversation
      const testUser = {
        user_id: 'test@canton-otc.com',
        email: 'test@canton-otc.com',
        name: 'Test User'
      };

      const testOrder: OTCOrder = {
        orderId: 'TEST-' + Date.now(),
        email: 'test@canton-otc.com',
        cantonAddress: 'TEST_ADDRESS',
        cantonAmount: 1000,
        usdtAmount: 200,
        paymentAmountUSD: 200,
        paymentAmount: 200,
        paymentToken: {
          symbol: 'USDT',
          name: 'Tether USD',
          network: 'TRON',
          networkName: 'TRON (TRC-20)',
          icon: '💎',
          color: '#26a17b',
          priceUSD: 1,
          minAmount: 1,
          decimals: 6,
          receivingAddress: 'TEST_ADDRESS'
        },
        status: 'awaiting-deposit' as const,
        timestamp: Date.now()
      };
      
      const conversation = await this.createConversation(testUser, testOrder);
      
      // Log the test message for verification
      console.log('Test message:', testMessage);

      return !!conversation;

    } catch (error) {
      console.error('❌ Failed to send test message:', error);
      return false;
    }
  }
}

// Export singleton instance
export const intercomService = new IntercomService();
export default intercomService;
