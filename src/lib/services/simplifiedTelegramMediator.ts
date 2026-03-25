/**
 * 📱 Simplified Telegram Mediator - Production Ready
 * Только уведомления операторам, без сложной медиации
 * Вся логика разговоров делегирована Intercom
 */

import axios from 'axios';
import { enhancedIntercomService } from './enhancedIntercom';

interface TelegramConfig {
  botToken: string;
  operatorChatId: string;
}

interface OperatorNotification {
  orderId: string;
  customerEmail: string;
  orderAmount?: number;
  orderStatus?: string;
  messagePreview?: string;
  intercomConversationUrl?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

interface ConversationAnalytics {
  conversation_counts?: {
    new?: number;
    open?: number;
    closed?: number;
  };
  user_counts?: {
    new?: number;
    active?: number;
  };
}

class SimplifiedTelegramMediator {
  private config: TelegramConfig | null = null;
  private baseUrl = 'https://api.telegram.org/bot';

  constructor() {
    this.initializeConfig();
  }

  private initializeConfig() {
    const botToken = process.env.TELEGRAM_MEDIATOR_BOT_TOKEN;
    const operatorChatId = process.env.TELEGRAM_MEDIATOR_CHAT_ID;

    if (!botToken || !operatorChatId) {
      console.warn('📱 Telegram Mediator configuration missing. Notifications disabled.');
      return;
    }

    this.config = { botToken, operatorChatId };
    console.log('✅ Simplified Telegram Mediator configured');
  }

  /**
   * 🎯 MAIN: Notify operators about new conversation
   */
  async notifyNewConversation(notification: OperatorNotification): Promise<boolean> {
    try {
      if (!this.config) {
        console.log('📱 Telegram disabled - logging notification locally');
        this.logNotificationLocally('NEW_CONVERSATION', notification);
        return false;
      }

      const message = this.formatNewConversationMessage(notification);
      
      const response = await axios.post(
        `${this.baseUrl}${this.config.botToken}/sendMessage`,
        {
          chat_id: this.config.operatorChatId,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: false,
          reply_markup: {
            inline_keyboard: [[
              {
                text: '💬 Открыть в Intercom',
                url: notification.intercomConversationUrl || `https://app.intercom.com/a/apps/${process.env.NEXT_PUBLIC_INTERCOM_APP_ID}/inbox`
              }
            ]]
          }
        },
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.ok) {
        console.log('📱 Operator notification sent successfully:', notification.orderId);
        return true;
      } else {
        throw new Error(`Telegram API error: ${response.data.description}`);
      }

    } catch (error) {
      console.error('❌ Failed to send operator notification:', error);
      this.logNotificationLocally('NEW_CONVERSATION_FAILED', notification);
      return false;
    }
  }

  /**
   * 🔔 Notify about urgent messages
   */
  async notifyUrgentMessage(notification: OperatorNotification): Promise<boolean> {
    try {
      if (!this.config) {
        console.log('📱 Telegram disabled - logging urgent notification locally');
        return false;
      }

      const message = this.formatUrgentMessageNotification(notification);
      
      const response = await axios.post(
        `${this.baseUrl}${this.config.botToken}/sendMessage`,
        {
          chat_id: this.config.operatorChatId,
          text: message,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[
              {
                text: '🚨 СРОЧНО - Открыть в Intercom',
                url: notification.intercomConversationUrl || `https://app.intercom.com/a/apps/${process.env.NEXT_PUBLIC_INTERCOM_APP_ID}/inbox`
              }
            ]]
          }
        }
      );

      return response.data.ok;

    } catch (error) {
      console.error('❌ Failed to send urgent notification:', error);
      return false;
    }
  }

  /**
   * 📊 Send daily summary to operators
   */
  async sendDailySummary(): Promise<boolean> {
    try {
      if (!this.config) return false;

      // Get analytics from Intercom
      const analytics = await enhancedIntercomService.getConversationAnalytics('day');
      if (!analytics) return false;

      const summaryMessage = this.formatDailySummary(analytics as ConversationAnalytics);
      
      const response = await axios.post(
        `${this.baseUrl}${this.config.botToken}/sendMessage`,
        {
          chat_id: this.config.operatorChatId,
          text: summaryMessage,
          parse_mode: 'HTML'
        }
      );

      return response.data.ok;

    } catch (error) {
      console.error('❌ Failed to send daily summary:', error);
      return false;
    }
  }

  /**
   * 💬 Format new conversation notification
   */
  private formatNewConversationMessage(notification: OperatorNotification): string {
    const priorityEmoji = this.getPriorityEmoji(notification.priority || 'normal');
    const timestamp = new Date().toLocaleString('ru-RU', {
      timeZone: 'Europe/Moscow',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return `${priorityEmoji} <b>НОВЫЙ ЗАКАЗ - ТРЕБУЕТСЯ ПОДДЕРЖКА</b>

📋 <b>Order ID:</b> <code>${notification.orderId}</code>
📧 <b>Клиент:</b> ${notification.customerEmail}
💰 <b>Сумма:</b> $${notification.orderAmount || 0} USD
🎯 <b>Статус:</b> ${notification.orderStatus || 'новый'}
📅 <b>Время:</b> ${timestamp} (МСК)

${notification.messagePreview ? `💬 <b>Сообщение:</b>\n"${notification.messagePreview}"` : ''}

<b>📱 Все ответы только через Intercom Dashboard!</b>
История разговоров, контекст заказа и customer data доступны в Intercom.`;
  }

  /**
   * 🚨 Format urgent message notification
   */
  private formatUrgentMessageNotification(notification: OperatorNotification): string {
    return `🚨 <b>СРОЧНОЕ СООБЩЕНИЕ</b>

📋 <b>Order ID:</b> <code>${notification.orderId}</code>
📧 <b>Клиент:</b> ${notification.customerEmail}
💰 <b>Сумма:</b> $${notification.orderAmount || 0} USD

💬 <b>Сообщение:</b>
"${notification.messagePreview}"

⚡ <b>Требуется немедленный ответ!</b>`;
  }

  /**
   * 📊 Format daily summary
   */
  private formatDailySummary(analytics: ConversationAnalytics): string {
    return `📊 <b>ЕЖЕДНЕВНАЯ СВОДКА</b>

📈 <b>Разговоры за сегодня:</b>
• Новые: ${analytics.conversation_counts?.new || 0}
• Активные: ${analytics.conversation_counts?.open || 0}
• Закрытые: ${analytics.conversation_counts?.closed || 0}

👥 <b>Пользователи:</b>
• Новые: ${analytics.user_counts?.new || 0}
• Активные: ${analytics.user_counts?.active || 0}

📅 <b>Дата:</b> ${new Date().toLocaleDateString('ru-RU')}

<b>Все детали доступны в Intercom Analytics</b> 📊`;
  }

  /**
   * 🎨 Get priority emoji
   */
  private getPriorityEmoji(priority: string): string {
    const emojiMap: Record<string, string> = {
      'low': '🟢',
      'normal': '🟡',
      'high': '🟠',
      'urgent': '🔴',
      'vip': '💎'
    };
    return emojiMap[priority] || '🟡';
  }

  /**
   * 📝 Local logging fallback
   */
  private logNotificationLocally(type: string, notification: OperatorNotification): void {
    console.log(`📱 ${type} (LOCAL):`, {
      orderId: notification.orderId,
      customerEmail: notification.customerEmail,
      orderAmount: notification.orderAmount,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 🔧 Test connection
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.config) return false;

      const response = await axios.get(
        `${this.baseUrl}${this.config.botToken}/getMe`,
        { timeout: 5000 }
      );

      if (response.data.ok) {
        console.log('📱 Telegram Mediator connection successful:', response.data.result.first_name);
        return true;
      }

      return false;

    } catch (error) {
      console.error('❌ Telegram Mediator connection failed:', error);
      return false;
    }
  }
}

// Singleton instance для production
export const simplifiedTelegramMediator = new SimplifiedTelegramMediator();
export default simplifiedTelegramMediator;
