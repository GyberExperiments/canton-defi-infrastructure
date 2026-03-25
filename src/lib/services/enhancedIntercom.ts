/**
 * 🚀 Enhanced Intercom Service - Production Ready
 * Intercom-First архитектура с полной интеграцией Order ID
 */

import axios, { AxiosInstance } from 'axios';
import { OTC_CONFIG, type OTCOrder } from '@/config/otc';

interface IntercomConfig {
  appId: string;
  accessToken: string;
  adminId: string;
}

interface IntercomUser {
  type: 'user';
  id: string;
  user_id: string;
  email: string;
  name?: string;
  phone?: string;
  custom_attributes: {
    // Order Context
    active_order_id?: string;
    active_order_status?: string;
    active_order_amount?: number;
    active_canton_amount?: number;
    canton_address?: string;
    refund_address?: string;
    payment_token?: string;
    payment_network?: string;
    
    // Customer Profile
    total_orders?: number;
    total_volume_usd?: number;
    customer_since?: string;
    last_order_date?: string;
    preferred_network?: string;
    support_priority?: 'low' | 'normal' | 'high' | 'vip';
    
    // Technical Context
    user_agent?: string;
    signup_source?: string;
    last_activity?: string;
  };
}

interface IntercomConversation {
  type: 'conversation';
  id: string;
  created_at: number;
  updated_at: number;
  state: 'open' | 'closed' | 'snoozed';
  priority: 'not_priority' | 'priority';
  custom_attributes: {
    order_id?: string;
    order_status?: string;
    order_amount?: number;
    requires_urgent_response?: boolean;
    conversation_type?: 'order_support' | 'general_inquiry' | 'complaint';
  };
  tags: {
    type: 'tag.list';
    tags: Array<{
      type: 'tag';
      id: string;
      name: string;
    }>;
  };
}

class EnhancedIntercomService {
  private config: IntercomConfig | null = null;
  private client: AxiosInstance;
  private readonly baseUrl = 'https://api.intercom.io';

  constructor() {
    this.initializeConfig();
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 15000, // 15 seconds для production
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Intercom-Version': '2.14'
      }
    });

    // Request interceptor для авторизации
    this.client.interceptors.request.use((config) => {
      if (this.config?.accessToken) {
        config.headers.Authorization = `Bearer ${this.config.accessToken}`;
      }
      return config;
    });

    // Response interceptor для error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('❌ Intercom API Error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: error.config?.url,
          method: error.config?.method
        });
        throw error;
      }
    );
  }

  private initializeConfig() {
    const appId = process.env.NEXT_PUBLIC_INTERCOM_APP_ID;
    const accessToken = process.env.INTERCOM_ACCESS_TOKEN;
    const adminId = process.env.INTERCOM_ADMIN_ID;

    if (!appId || !accessToken || !adminId) {
      console.warn('⚠️ Intercom configuration missing. Service will be disabled.');
      return;
    }

    this.config = { appId, accessToken, adminId };
    console.log('✅ Enhanced Intercom Service configured');
  }

  /**
   * 🎯 MAIN: Create user with full order context
   */
  async createOrderUser(order: OTCOrder): Promise<IntercomUser | null> {
    try {
      if (!this.config) {
        console.log('💬 Intercom disabled - logging user creation locally');
        this.logUserCreationLocally(order);
        return null;
      }

      // Calculate customer metrics
      const existingUser = await this.findUserByEmail(order.email);
      const totalOrders = (existingUser?.custom_attributes?.total_orders || 0) + 1;
      const totalVolume = (existingUser?.custom_attributes?.total_volume_usd || 0) + (order.paymentAmountUSD || 0);

      const userData: Partial<IntercomUser> = {
        user_id: order.email,
        email: order.email,
        name: order.email.split('@')[0],
        custom_attributes: {
          // 🎯 Active Order Context (для удобства админов)
          active_order_id: order.orderId,
          active_order_status: order.status,
          active_order_amount: order.paymentAmountUSD || order.usdtAmount || 0,
          active_canton_amount: order.cantonAmount,
          canton_address: order.cantonAddress,
          refund_address: order.refundAddress || '',
          payment_token: order.paymentToken?.symbol || 'USDT',
          payment_network: order.paymentToken?.networkName || 'TRC-20',
          
          // 📊 Customer Profile (для персонализации)
          total_orders: totalOrders,
          total_volume_usd: totalVolume,
          customer_since: existingUser?.custom_attributes?.customer_since || new Date().toISOString(),
          last_order_date: new Date(order.timestamp).toISOString(),
          preferred_network: order.paymentToken?.network || 'TRON',
          support_priority: this.calculateSupportPriority(totalVolume, totalOrders),
          
          // 🔧 Technical Context
          last_activity: new Date().toISOString(),
          signup_source: 'canton_otc_web'
        }
      };

      const response = await this.client.post('/contacts', userData);
      console.log('✅ Enhanced Intercom user created/updated:', order.orderId);
      
      return response.data;

    } catch (error) {
      console.error('❌ Failed to create Intercom user:', error);
      this.logUserCreationLocally(order);
      return null;
    }
  }

  /**
   * 🎯 MAIN: Create conversation with rich order context
   */
  async createOrderConversation(user: IntercomUser, order: OTCOrder): Promise<IntercomConversation | null> {
    try {
      const welcomeMessage = this.generateWelcomeMessage(order);
      
      const conversationData = {
        from: {
          type: 'admin',
          id: this.config!.adminId
        },
        to: {
          type: 'user',
          user_id: user.user_id
        },
        message_type: 'comment',
        body: welcomeMessage,
        // 🎯 Rich Custom Attributes для админ панели
        custom_attributes: {
          order_id: order.orderId,
          order_status: order.status,
          order_amount: order.paymentAmountUSD || order.usdtAmount || 0,
          requires_urgent_response: (order.paymentAmountUSD || 0) > 1000,
          conversation_type: 'order_support'
        }
      };

      const response = await this.client.post('/conversations', conversationData);
      const conversation = response.data;

      // 🏷️ Add relevant tags для админов
      await this.tagConversation(conversation.id, [
        'new-order',
        `amount-${this.getAmountCategory(order.paymentAmountUSD || 0)}`,
        `network-${order.paymentToken?.network?.toLowerCase() || 'tron'}`,
        order.status
      ]);

      console.log('✅ Enhanced conversation created:', order.orderId);
      return conversation;

    } catch (error) {
      console.error('❌ Failed to create conversation:', error);
      return null;
    }
  }

  /**
   * 🔍 Find user by email
   */
  async findUserByEmail(email: string): Promise<IntercomUser | null> {
    try {
      const response = await this.client.get('/users', {
        params: { email }
      });
      return response.data.users?.[0] || null;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number } };
        if (axiosError.response?.status === 404) {
          return null; // User not found
        }
      }
      throw error;
    }
  }

  /**
   * 🔍 Find conversations by order ID
   */
  async findConversationsByOrderId(orderId: string): Promise<IntercomConversation[]> {
    try {
      const response = await this.client.post('/conversations/search', {
        query: {
          field: 'custom_attributes.order_id',
          operator: '=',
          value: orderId
        }
      });
      
      return response.data.conversations || [];
    } catch (error) {
      console.error('❌ Failed to search conversations:', error);
      return [];
    }
  }

  /**
   * 🏷️ Add tags to conversation
   */
  async tagConversation(conversationId: string, tags: string[]): Promise<boolean> {
    try {
      for (const tag of tags) {
        await this.client.post(`/conversations/${conversationId}/tags`, {
          name: tag,
          admin_id: this.config!.adminId
        });
      }
      return true;
    } catch (error) {
      console.error('❌ Failed to tag conversation:', error);
      return false;
    }
  }

  /**
   * 📝 Add internal note (для админов)
   */
  async addInternalNote(conversationId: string, note: string): Promise<boolean> {
    try {
      await this.client.post(`/conversations/${conversationId}/parts`, {
        message_type: 'note',
        type: 'note',
        body: note,
        admin_id: this.config!.adminId
      });
      return true;
    } catch (error) {
      console.error('❌ Failed to add internal note:', error);
      return false;
    }
  }

  /**
   * 🔄 Update order status in all related conversations
   */
  async updateOrderStatus(orderId: string, newStatus: string, additionalInfo?: string): Promise<boolean> {
    try {
      const conversations = await this.findConversationsByOrderId(orderId);
      
      for (const conversation of conversations) {
        // Update conversation attributes
        await this.client.put(`/conversations/${conversation.id}`, {
          custom_attributes: {
            ...conversation.custom_attributes,
            order_status: newStatus
          }
        });

        // Add status update note
        const statusNote = `🔄 **Order Status Updated**\n\nOrder: ${orderId}\nNew Status: ${newStatus}${additionalInfo ? `\n\nDetails: ${additionalInfo}` : ''}`;
        await this.addInternalNote(conversation.id, statusNote);

        // Update tags
        await this.tagConversation(conversation.id, [newStatus]);
      }

      console.log('✅ Order status updated across all conversations:', orderId);
      return true;

    } catch (error) {
      console.error('❌ Failed to update order status:', error);
      return false;
    }
  }

  /**
   * 📊 Get conversation analytics
   */
  async getConversationAnalytics(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<unknown> {
    try {
      const response = await this.client.get('/counts', {
        params: {
          type: 'conversation',
          timeframe
        }
      });
      return response.data;
    } catch (error) {
      console.error('❌ Failed to get analytics:', error);
      return null;
    }
  }

  /**
   * 🎨 Generate personalized welcome message
   */
  private generateWelcomeMessage(order: OTCOrder): string {
    const timestamp = new Date(order.timestamp).toLocaleString('ru-RU', { 
      timeZone: 'Europe/Moscow',
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return `🎉 **Добро пожаловать в Canton OTC!**

Ваш заказ успешно создан:

📋 **Order ID:** \`${order.orderId}\`
💰 **Сумма:** $${order.paymentAmountUSD || order.usdtAmount || 0} ${order.paymentToken?.symbol || 'USDT'} → ${order.cantonAmount} Canton Coin
🌐 **Сеть:** ${order.paymentToken?.networkName || 'TRON (TRC-20)'}
📅 **Создан:** ${timestamp} (МСК)

🏛️ **Получатель:** \`${order.cantonAddress}\`
${order.refundAddress ? `🔄 **Возврат:** \`${order.refundAddress}\`` : ''}

---

👋 **Как мы можем помочь?**

Наша команда поддержки готова ответить на любые вопросы о вашем заказе. Среднее время ответа: **5 минут** в рабочие часы.

🕐 **Рабочие часы:** ${OTC_CONFIG.BUSINESS_HOURS}
📱 **Статус заказа:** Отслеживается автоматически

Просто напишите ваш вопрос, и мы поможем! 🚀`;
  }

  /**
   * 🎯 Calculate support priority based on customer value
   */
  private calculateSupportPriority(totalVolume: number, totalOrders: number): 'low' | 'normal' | 'high' | 'vip' {
    if (totalVolume > 10000 || totalOrders > 50) return 'vip';
    if (totalVolume > 5000 || totalOrders > 20) return 'high';
    if (totalVolume > 1000 || totalOrders > 5) return 'normal';
    return 'low';
  }

  /**
   * 💰 Get amount category for tagging
   */
  private getAmountCategory(amount: number): string {
    if (amount >= 10000) return 'enterprise';
    if (amount >= 5000) return 'premium';
    if (amount >= 1000) return 'standard';
    return 'basic';
  }

  /**
   * 📝 Local logging fallback
   */
  private logUserCreationLocally(order: OTCOrder): void {
    console.log('💬 INTERCOM USER CREATION (LOCAL):', {
      orderId: order.orderId,
      email: order.email,
      amount: `$${order.paymentAmountUSD || order.usdtAmount || 0}`,
      cantonAmount: order.cantonAmount,
      timestamp: new Date(order.timestamp).toISOString()
    });
  }

  /**
   * 🔧 Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.config) return false;
      const response = await this.client.get('/me');
      return response.status === 200;
    } catch {
      return false;
    }
  }
}

// Singleton instance для production
export const enhancedIntercomService = new EnhancedIntercomService();
export default enhancedIntercomService;
