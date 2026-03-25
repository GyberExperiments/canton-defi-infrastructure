/**
 * 📱 Telegram Client API Service
 * Отправка сообщений клиентам от имени администратора через клиентский API
 * Использует GramJS (telegram) для работы с MTProto API
 * 
 * ⚠️ Опциональный сервис: если пакет telegram не установлен, сервис будет отключен
 */

interface TelegramClientConfig {
  apiId: number;
  apiHash: string;
  sessionString: string;
}

class TelegramClientService {
  private client: any = null;
  private config: TelegramClientConfig | null = null;
  private isConnected: boolean = false;
  private connectionPromise: Promise<void> | null = null;
  private telegramModule: any = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeConfig();
  }

  private async loadTelegramModule() {
    if (this.telegramModule) {
      return this.telegramModule;
    }

    try {
      // @ts-ignore - Опциональная зависимость, может отсутствовать
      this.telegramModule = await import("telegram");
      // @ts-ignore - Опциональная зависимость, может отсутствовать
      const sessionsModule = await import("telegram/sessions");
      // @ts-ignore - Опциональная зависимость, может отсутствовать
      const tlModule = await import("telegram/tl");
      return {
        TelegramClient: this.telegramModule.TelegramClient,
        StringSession: sessionsModule.StringSession,
        Api: tlModule.Api
      };
    } catch (error) {
      console.warn('⚠️ Telegram Client API package not installed. Service will be disabled.');
      console.warn('   To enable: pnpm add telegram input');
      return null;
    }
  }

  private initializeConfig() {
    const apiId = process.env.TELEGRAM_API_ID;
    const apiHash = process.env.TELEGRAM_API_HASH;
    const sessionString = process.env.TELEGRAM_SESSION_STRING;

    if (!apiId || !apiHash || !sessionString) {
      console.warn('⚠️ Telegram Client API configuration missing. Service will be disabled.');
      console.warn('   Required: TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION_STRING');
      return;
    }

    this.config = {
      apiId: parseInt(apiId),
      apiHash,
      sessionString,
    };

    console.log('📱 Telegram Client Service Config:', {
      hasApiId: !!apiId,
      hasApiHash: !!apiHash,
      hasSession: !!sessionString,
      sessionLength: sessionString?.length || 0,
    });
  }

  /**
   * Подключение к Telegram (ленивая инициализация)
   */
  private async connect(): Promise<void> {
    if (this.isConnected && this.client) {
      return;
    }

    // Если уже идет подключение, ждем его
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    if (!this.config) {
      throw new Error('Telegram Client API not configured');
    }

    this.connectionPromise = this._connect();
    return this.connectionPromise;
  }

  private async _connect(): Promise<void> {
    if (!this.config) {
      throw new Error('Telegram Client API not configured');
    }

    const telegramLib = await this.loadTelegramModule();
    if (!telegramLib) {
      throw new Error('Telegram Client API package not installed');
    }

    try {
      const stringSession = new telegramLib.StringSession(this.config.sessionString);
      
      this.client = new telegramLib.TelegramClient(stringSession, this.config.apiId, this.config.apiHash, {
        connectionRetries: 5,
        retryDelay: 1000,
      });

      console.log('🔌 Connecting to Telegram...');
      await this.client.connect();
      
      // Проверяем авторизацию
      if (!await this.client.checkAuthorization()) {
        throw new Error('Session expired or invalid. Please run setup-telegram-session.js again.');
      }

      const me = await this.client.getMe();
      console.log('✅ Telegram Client connected as:', me.firstName, me.lastName || '', `(@${me.username || 'no username'})`);
      
      this.isConnected = true;
      
      // ✅ PROB-012: Запускаем health check после успешного подключения
      this.startHealthCheck();
    } catch (error) {
      console.error('❌ Failed to connect Telegram Client:', error);
      this.isConnected = false;
      this.connectionPromise = null;
      throw error;
    }
  }

  /**
   * Отправка сообщения с retry механизмом
   * ✅ ИСПРАВЛЕНО: Добавлен exponential backoff retry
   * @param recipient - username (с @ или без) или user_id (число)
   * @param message - текст сообщения
   * @param options - дополнительные опции
   */
  async sendMessage(
    recipient: string | number,
    message: string,
    options?: {
      parseMode?: 'html' | 'markdown';
      silent?: boolean;
      retries?: number;
    }
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    const maxRetries = options?.retries !== undefined ? options.retries : 3;
    const baseDelay = 1000; // 1 секунда
    
    let lastError: string = '';
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (!this.config) {
          return { success: false, error: 'Telegram Client API not configured' };
        }

        await this.connect();

        if (!this.client || !this.isConnected) {
          throw new Error('Client not connected');
        }

        const telegramLib = await this.loadTelegramModule();
        if (!telegramLib) {
          return { success: false, error: 'Telegram Client API package not installed' };
        }

        // Получаем entity
        let entity: any;
        if (typeof recipient === 'number') {
          entity = await this.client.getEntity(recipient);
        } else {
          const username = recipient.startsWith('@') ? recipient.slice(1) : recipient;
          entity = await this.client.getEntity(username);
        }

        // Отправляем сообщение
        const result = await this.client.sendMessage(entity, {
          message,
          parseMode: options?.parseMode === 'html' ? 'html' : undefined,
          silent: options?.silent,
        });

        const messageId = result.id?.toJSNumber?.() || result.id;

        console.log('✅ Message sent via Telegram Client:', {
          recipient: typeof recipient === 'number' ? `user:${recipient}` : recipient,
          messageId,
          attempt,
          timestamp: new Date().toISOString()
        });

        return { success: true, messageId };
        
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        
        console.warn(`⚠️ Send attempt ${attempt}/${maxRetries} failed:`, {
          error: lastError,
          recipient,
          timestamp: new Date().toISOString()
        });
        
        // Проверка на критичные ошибки (не ретраим)
        if (lastError.includes('AUTH_KEY_INVALID') || 
            lastError.includes('SESSION_REVOKED') ||
            lastError.includes('USER_DEACTIVATED')) {
          console.error('🚨 CRITICAL ERROR - no retry:', lastError);
          
          if (lastError.includes('AUTH_KEY_INVALID') || lastError.includes('SESSION_REVOKED')) {
            console.error('⚠️ Session expired. Alert admins!');
            // Можно отправить alert (но не через этот же сервис)
          }
          
          return { success: false, error: lastError };
        }
        
        // Если это последняя попытка
        if (attempt === maxRetries) {
          console.error('❌ All retry attempts exhausted:', {
            attempts: maxRetries,
            lastError,
            recipient,
            timestamp: new Date().toISOString()
          });
          return { success: false, error: lastError };
        }
        
        // Exponential backoff: 1s, 2s, 4s, 8s...
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`⏳ Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return { success: false, error: lastError || 'All retries failed' };
  }

  /**
   * Отправка уведомления клиенту о принятии заявки
   * @param order - данные заявки
   * @param operatorUsername - username оператора
   * @param chatLink - ссылка на чат
   */
  async notifyCustomerAboutOrder(
    order: { 
      orderId: string; 
      email: string; 
      telegram?: string;
      exchangeDirection?: 'buy' | 'sell';
      paymentAmountUSD?: number;
      cantonAmount?: number;
      paymentToken?: { symbol?: string };
    },
    operatorUsername: string,
    chatLink: string
  ): Promise<boolean> {
    // Пробуем отправить через Telegram если есть username
    if (order.telegram) {
      const telegramUsername = order.telegram.startsWith('@') ? order.telegram : `@${order.telegram}`;
      
      const exchangeDirection = order.exchangeDirection || 'buy';
      const isBuying = exchangeDirection === 'buy';
      const direction = isBuying ? '🛒 Покупка' : '💸 Продажа';
      const paymentToken = order.paymentToken?.symbol || 'USDT';
      
      const amountLine = isBuying
        ? `💵 <b>Оплата:</b> $${(order.paymentAmountUSD || 0).toFixed(2)} ${paymentToken}\n📊 <b>Получение:</b> ${(order.cantonAmount || 0).toFixed(2)} Canton Coin`
        : `📊 <b>Продажа:</b> ${(order.cantonAmount || 0).toFixed(2)} Canton Coin\n💵 <b>Получение:</b> $${(order.paymentAmountUSD || 0).toFixed(2)} ${paymentToken}`;
      
      const message = `✅ <b>Ваша заявка принята!</b>\n\n` +
        `📋 <b>Order ID:</b> <code>${order.orderId}</code>\n\n` +
        `📊 <b>Детали заявки:</b>\n` +
        `• <b>Тип:</b> ${direction} Canton Coin\n` +
        `${amountLine}\n\n` +
        `👤 <b>Оператор:</b> ${operatorUsername}\n\n` +
        `💬 <b>Связь с оператором:</b>\n${chatLink}\n\n` +
        `Спасибо за использование Canton OTC Exchange! 🚀`;

      const result = await this.sendMessage(telegramUsername, message, { parseMode: 'html' });
      
      if (result.success) {
        console.log('✅ Customer notified via Telegram Client:', order.orderId);
        return true;
      } else {
        console.warn('⚠️ Failed to notify via Telegram Client, trying fallback:', result.error);
      }
    }

    return false;
  }

  /**
   * Отправка сообщения тейкеру после принятия заявки
   * Включает все данные ордера и актуальное сообщение от оператора
   * @param takerUserId - Telegram user_id тейкера
   * @param takerUsername - Telegram username тейкера (опционально)
   * @param order - полные данные ордера
   * @param operatorUsername - username оператора
   * @param chatLink - ссылка на чат с оператором
   * @param customMessage - дополнительное сообщение от оператора (опционально)
   */
  async notifyTakerAboutAcceptedOrder(
    takerUserId: number,
    takerUsername: string | undefined,
    order: {
      order_id: string;
      exchange_direction?: 'buy' | 'sell';
      payment_amount_usd: number;
      canton_amount: number;
      price: number;
      is_market_price?: boolean;
      payment_token?: string;
      email: string;
      telegram?: string;
      canton_address?: string;
      receiving_address?: string;
      service_commission?: number;
    },
    operatorUsername: string,
    chatLink: string,
    customMessage?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.config) {
        return { success: false, error: 'Telegram Client API not configured' };
      }

      await this.connect();

      if (!this.client || !this.isConnected) {
        return { success: false, error: 'Client not connected' };
      }

      // Формируем детальное сообщение с данными ордера
      const exchangeDirection = order.exchange_direction || 'buy';
      const isBuying = exchangeDirection === 'buy';
      const direction = isBuying ? 'BUY' : 'SELL';
      const paymentToken = order.payment_token || 'USDT';
      
      const isMarketPrice = order.is_market_price === true;
      const priceDisplay = isMarketPrice 
        ? `$${Number(order.price || 0).toFixed(4)} (market price)`
        : `$${Number(order.price || 0).toFixed(4)}`;

      const amountLine = isBuying
        ? `<b>Payment:</b> $${Number(order.payment_amount_usd || 0).toFixed(2)} ${paymentToken}\n<b>Receiving:</b> ${Number(order.canton_amount || 0).toFixed(2)} Canton Coin`
        : `<b>Payment:</b> ${Number(order.canton_amount || 0).toFixed(2)} Canton Coin\n<b>Receiving:</b> $${Number(order.payment_amount_usd || 0).toFixed(2)} ${paymentToken}`;

      const serviceCommission = order.service_commission || 1;
      
      // Основное сообщение с данными ордера
      let message = `✅ <b>Заявка принята!</b>\n\n` +
        `📋 <b>Order ID:</b> <code>${order.order_id}</code>\n\n` +
        `📊 <b>Детали заявки:</b>\n` +
        `• <b>Тип:</b> ${direction} Canton Coin\n` +
        `${amountLine}\n` +
        `• <b>Цена CC:</b> ${priceDisplay}\n` +
        `• <b>Комиссия:</b> ${serviceCommission}%\n\n`;

      // Добавляем адреса в зависимости от направления
      if (isBuying) {
        // При покупке: тейкер получает Canton, отправляет USDT
        if (order.receiving_address) {
          message += `📍 <b>Адрес для получения Canton:</b>\n<code>${order.receiving_address}</code>\n\n`;
        }
        if (order.canton_address) {
          message += `📍 <b>Canton адрес инициатора:</b>\n<code>${order.canton_address}</code>\n\n`;
        }
      } else {
        // При продаже: тейкер отправляет Canton, получает USDT
        if (order.canton_address) {
          message += `📍 <b>Адрес для отправки Canton:</b>\n<code>${order.canton_address}</code>\n\n`;
        }
        if (order.receiving_address) {
          message += `📍 <b>Адрес для получения ${paymentToken}:</b>\n<code>${order.receiving_address}</code>\n\n`;
        }
      }

      // Контакты
      message += `👤 <b>Оператор:</b> ${operatorUsername}\n` +
        `📧 <b>Email инициатора:</b> ${order.email}\n`;
      
      if (order.telegram) {
        message += `💬 <b>Telegram инициатора:</b> ${order.telegram}\n`;
      }

      // Дополнительное сообщение от оператора (если есть)
      if (customMessage) {
        message += `\n💬 <b>Сообщение от оператора:</b>\n${customMessage}\n\n`;
      }

      // Ссылка на чат
      message += `\n💬 <b>Связь с оператором:</b>\n${chatLink}\n\n` +
        `Спасибо за использование Canton OTC Exchange! 🚀`;

      // Отправляем сообщение тейкеру по user_id
      const result = await this.sendMessage(takerUserId, message, { 
        parseMode: 'html',
        retries: 3 // ✅ Включить retry
      });
      
      if (result.success) {
        console.log('✅ Taker notified via Telegram Client:', {
          orderId: order.order_id,
          takerId: takerUserId,
          takerUsername: takerUsername || 'unknown'
        });
        return { success: true };
      } else {
        console.warn('⚠️ Failed to notify taker via Telegram Client:', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Failed to notify taker via Telegram Client:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Проверка подключения
   */
  async checkConnection(): Promise<boolean> {
    try {
      if (!this.config) {
        return false;
      }

      await this.connect();
      return this.isConnected && !!this.client;
    } catch {
      return false;
    }
  }

  /**
   * Запустить периодическую проверку здоровья соединения
   * Автоматически переподключается при потере связи
   * ✅ PROB-012: Auto-Reconnect с health check
   * @param intervalMs - интервал проверки в миллисекундах (по умолчанию 5 минут)
   */
  startHealthCheck(intervalMs: number = 300000): void {
    // Останавливаем существующий health check если есть
    this.stopHealthCheck();
    
    if (!this.config) {
      console.warn('⚠️ Cannot start health check: Telegram Client API not configured');
      return;
    }
    
    this.healthCheckInterval = setInterval(async () => {
      try {
        // Проверяем соединение
        const isStillConnected = await this.checkConnection();
        
        if (!isStillConnected) {
          console.log('🔄 Connection lost, attempting reconnect...');
          
          // Сбрасываем состояние
          this.isConnected = false;
          this.connectionPromise = null;
          
          // Пытаемся переподключиться
          try {
            await this.connect();
            console.log('✅ Reconnected successfully');
          } catch (reconnectError) {
            console.error('❌ Health check reconnect failed:', reconnectError);
            // Не останавливаем health check, попробует снова через interval
          }
        }
      } catch (error) {
        console.error('❌ Health check error:', error);
        // Не останавливаем health check при ошибке
      }
    }, intervalMs);
    
    console.log(`✅ Health check started (interval: ${intervalMs}ms = ${intervalMs / 1000 / 60} minutes)`);
  }

  /**
   * Остановить health check
   */
  stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log('🛑 Health check stopped');
    }
  }

  /**
   * Отключение
   */
  async disconnect(): Promise<void> {
    // Останавливаем health check при отключении
    this.stopHealthCheck();
    
    if (this.client && this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
      this.client = null;
      this.connectionPromise = null;
      console.log('🔌 Telegram Client disconnected');
    }
  }

  /**
   * Получить информацию о текущем пользователе
   */
  async getMe(): Promise<{ id: number; firstName: string; lastName?: string; username?: string } | null> {
    try {
      await this.connect();
      
      if (!this.client || !this.isConnected) {
        return null;
      }

      const me = await this.client.getMe();
      return {
        id: me.id.toJSNumber(),
        firstName: me.firstName,
        lastName: me.lastName,
        username: me.username,
      };
    } catch (error) {
      console.error('❌ Failed to get user info:', error);
      return null;
    }
  }
}

// Export singleton instance
export const telegramClientService = new TelegramClientService();
export default telegramClientService;
