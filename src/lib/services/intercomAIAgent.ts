/**
 * 🤖 Intercom AI Agent Service
 * AI агент 1OTC для продажи Canton Coin в Intercom чате
 */

import { googleSheetsService } from './googleSheets'
import { telegramMediatorService } from './telegramMediator'
import { intercomMonitoringService } from './intercomMonitoring'
import { OTC_CONFIG, type OTCOrder, NetworkType } from '@/config/otc'

interface CustomerContext {
  email?: string
  name?: string
  cantonAddress?: string
  refundAddress?: string
  phone?: string
  telegram?: string
  orderHistory?: Array<{
    orderId: string
    amount: number
    status: string
    createdAt: string
  }>
  preferences?: {
    preferredNetwork: NetworkType
    communicationMethod: 'email' | 'telegram' | 'whatsapp'
  }
}

interface OrderRequest {
  amount: number
  network: NetworkType
  cantonAddress: string
  refundAddress?: string
  customerEmail: string
  customerName?: string
  phone?: string
  telegram?: string
}

class IntercomAIAgent {
  // Используем динамическую цену из конфигурации
  private get CANTON_PRICE_USD() { return OTC_CONFIG.CANTON_COIN_BUY_PRICE_USD; }
  private readonly MIN_ORDER_AMOUNT = 1
  private readonly MAX_ORDER_AMOUNT = 100000

  /**
   * Обработка входящего сообщения от клиента
   */
  async processMessage(message: string, customerContext: CustomerContext): Promise<{
    response: string
    action?: 'create_order' | 'transfer_to_human' | 'get_info'
    orderData?: OrderRequest
  }> {
    try {
      // Анализируем намерение клиента
      const intent = this.analyzeIntent(message)
      
      switch (intent.type) {
        case 'buy_canton':
          return await this.handleBuyIntent(message, customerContext)
        
        case 'check_price':
          return this.handlePriceCheck()
        
        case 'order_status':
          return await this.handleOrderStatus(message, customerContext)
        
        case 'support':
          return this.handleSupportRequest()
        
        case 'create_order':
          return await this.handleOrderCreation(message, customerContext)
        
        default:
          return this.handleGeneralInquiry()
      }
    } catch (error) {
      console.error('❌ AI Agent error:', error)
      return {
        response: 'Извините, произошла техническая ошибка. Я передам вас живому оператору для решения вашего вопроса.',
        action: 'transfer_to_human'
      }
    }
  }

  /**
   * Анализ намерения клиента
   */
  private analyzeIntent(message: string): { type: string; confidence: number } {
    const lowerMessage = message.toLowerCase()
    
    // Ключевые слова для покупки Canton
    const buyKeywords = ['купить', 'buy', 'покупка', 'purchase', 'обмен', 'exchange', 'заказать', 'order']
    const priceKeywords = ['цена', 'price', 'стоимость', 'cost', 'курс', 'rate']
    const statusKeywords = ['статус', 'status', 'проверить', 'check', 'заказ', 'order']
    const supportKeywords = ['помощь', 'help', 'поддержка', 'support', 'проблема', 'problem']
    
    if (buyKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return { type: 'buy_canton', confidence: 0.9 }
    }
    
    if (priceKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return { type: 'check_price', confidence: 0.8 }
    }
    
    if (statusKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return { type: 'order_status', confidence: 0.8 }
    }
    
    if (supportKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return { type: 'support', confidence: 0.7 }
    }
    
    // Проверяем, содержит ли сообщение данные для заказа
    if (this.containsOrderData(message)) {
      return { type: 'create_order', confidence: 0.9 }
    }
    
    return { type: 'general', confidence: 0.5 }
  }

  /**
   * Обработка намерения покупки Canton
   */
  private async handleBuyIntent(message: string, context: CustomerContext): Promise<{
    response: string
    action?: 'create_order' | 'transfer_to_human'
    orderData?: OrderRequest
  }> {
    const orderData = this.extractOrderData(message, context)
    
    if (orderData) {
      // Проверяем валидность данных
      const validation = this.validateOrderData(orderData)
      
      if (!validation.isValid) {
        return {
          response: `❌ ${validation.error}\n\nПожалуйста, предоставьте корректные данные для создания заказа.`,
          action: 'transfer_to_human'
        }
      }
      
      return {
        response: this.generateOrderConfirmation(orderData),
        action: 'create_order',
        orderData
      }
    }
    
    return {
      response: `🎯 Отлично! Я помогу вам купить Canton Coin (CC).

**Текущая цена:** $${this.CANTON_PRICE_USD} за 1 CC
**Минимальная сумма:** $${this.MIN_ORDER_AMOUNT}
**Максимальная сумма:** $${this.MAX_ORDER_AMOUNT}

Для создания заказа мне нужна следующая информация:

1️⃣ **Сумма покупки** (в USDT)
2️⃣ **Сеть USDT** (TRC-20, ERC-20, BEP-20, Solana, Optimism)
3️⃣ **Ваш Canton адрес** для получения CC
4️⃣ **Email** для связи
5️⃣ **Резервный адрес** (опционально, для возврата средств)

Просто напишите все данные в одном сообщении, например:
"Хочу купить на $100 USDT TRC-20, мой Canton адрес: bron:1220..., email: user@example.com"`,
      action: 'transfer_to_human'
    }
  }

  /**
   * Проверка цены
   */
  private handlePriceCheck(): { response: string } {
    return {
      response: `💰 **Актуальная информация о Canton Coin (CC):**

📈 **Цена:** $${this.CANTON_PRICE_USD} за 1 CC
⏰ **Обновлено:** ${new Date().toLocaleString('ru-RU')}
🌐 **Доступные сети:** TRC-20, ERC-20, BEP-20, Solana, Optimism

💡 **Преимущества покупки CC:**
• Доступ к экосистеме Canton Network
• Стабильная цена с потенциалом роста
• Мультисетевая совместимость
• Низкие комиссии за транзакции

Хотите создать заказ на покупку CC? Просто напишите сумму и сеть!`
    }
  }

  /**
   * Проверка статуса заказа
   */
  private async handleOrderStatus(message: string, context: CustomerContext): Promise<{
    response: string
    action?: 'transfer_to_human'
  }> {
    if (!context.email) {
      return {
        response: 'Для проверки статуса заказа мне нужен ваш email. Пожалуйста, укажите email, который вы использовали при создании заказа.',
        action: 'transfer_to_human'
      }
    }
    
    try {
      // Здесь можно добавить логику поиска заказов по email
      return {
        response: 'Я передам вас живому оператору для проверки статуса вашего заказа.',
        action: 'transfer_to_human'
      }
    } catch {
      return {
        response: 'Произошла ошибка при проверке статуса заказа. Я передам вас оператору.',
        action: 'transfer_to_human'
      }
    }
  }

  /**
   * Обработка запроса поддержки
   */
  private handleSupportRequest(): { response: string; action: 'transfer_to_human' } {
    return {
      response: 'Передаю ваш запрос оператору. Он ответит в течение нескольких минут.',
      action: 'transfer_to_human'
    }
  }

  /**
   * Создание заказа
   */
  private async handleOrderCreation(message: string, context: CustomerContext): Promise<{
    response: string
    action: 'create_order'
    orderData: OrderRequest
  }> {
    const orderData = this.extractOrderData(message, context)
    
    if (!orderData) {
      throw new Error('Не удалось извлечь данные заказа')
    }
    
    return {
      response: this.generateOrderConfirmation(orderData),
      action: 'create_order',
      orderData
    }
  }

  /**
   * Общие вопросы
   */
  private handleGeneralInquiry(): { response: string } {
    return {
      response: `👋 Привет! Я AI-ассистент 1OTC, специализируюсь на продаже Canton Coin (CC).

**Что я могу для вас сделать:**
• 🛒 Помочь купить Canton Coin
• 💰 Сообщить актуальную цену
• 📋 Создать заказ на покупку
• 🔍 Проверить статус заказа
• 👨‍💼 Связать с живым оператором

**Актуальная цена CC:** $${this.CANTON_PRICE_USD}

Просто напишите, что вас интересует! Например:
• "Хочу купить Canton Coin"
• "Какая цена?"
• "Создать заказ на $100"`

    }
  }

  /**
   * Извлечение данных заказа из сообщения
   */
  private extractOrderData(message: string, context: CustomerContext): OrderRequest | null {
    
    // Извлекаем сумму
    const amountMatch = message.match(/\$?(\d+(?:\.\d+)?)/)
    if (!amountMatch) return null
    
    const amount = parseFloat(amountMatch[1])
    if (amount < this.MIN_ORDER_AMOUNT || amount > this.MAX_ORDER_AMOUNT) return null
    
    // Извлекаем сеть
    const networkMap: Record<string, NetworkType> = {
      'trc-20': 'TRON',
      'tron': 'TRON',
      'erc-20': 'ETHEREUM',
      'ethereum': 'ETHEREUM',
      'bep-20': 'BSC',
      'bsc': 'BSC',
      'solana': 'SOLANA',
      'optimism': 'OPTIMISM'
    }
    
    const lowerMessage = message.toLowerCase()
    const network = Object.entries(networkMap).find(([key]) => lowerMessage.includes(key))?.[1] || 'TRON'
    
    // Извлекаем Canton адрес
    const cantonAddressMatch = message.match(/[a-zA-Z][a-zA-Z0-9_-]{2,49}::[a-fA-F0-9]{32,80}/i)
    const cantonAddress = cantonAddressMatch ? cantonAddressMatch[0] : context.cantonAddress
    
    if (!cantonAddress) return null
    
    // Извлекаем email
    const emailMatch = message.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
    const email = emailMatch ? emailMatch[0] : context.email
    
    if (!email) return null
    
    // Извлекаем резервный адрес
    const refundAddressMatch = message.match(/refund[:\s]+([a-zA-Z0-9:]+)/i)
    const refundAddress = refundAddressMatch ? refundAddressMatch[1] : context.refundAddress
    
    return {
      amount,
      network,
      cantonAddress,
      refundAddress,
      customerEmail: email,
      customerName: context.name,
      phone: context.phone,
      telegram: context.telegram
    }
  }

  /**
   * Проверка, содержит ли сообщение данные заказа
   */
  private containsOrderData(message: string): boolean {
    
    // Проверяем наличие суммы
    const hasAmount = /\$?(\d+(?:\.\d+)?)/.test(message)
    
    // Проверяем наличие Canton адреса
    const hasCantonAddress = /[a-zA-Z][a-zA-Z0-9_-]{2,49}::[a-fA-F0-9]{32,80}/i.test(message)
    
    // Проверяем наличие email
    const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(message)
    
    return hasAmount && hasCantonAddress && hasEmail
  }

  /**
   * Валидация данных заказа
   */
  private validateOrderData(orderData: OrderRequest): { isValid: boolean; error?: string } {
    if (orderData.amount < this.MIN_ORDER_AMOUNT) {
      return { isValid: false, error: `Минимальная сумма заказа: $${this.MIN_ORDER_AMOUNT}` }
    }
    
    if (orderData.amount > this.MAX_ORDER_AMOUNT) {
      return { isValid: false, error: `Максимальная сумма заказа: $${this.MAX_ORDER_AMOUNT}` }
    }
    
    if (!this.isValidCantonAddress(orderData.cantonAddress)) {
      return { isValid: false, error: 'Неверный формат Canton адреса' }
    }
    
    if (!this.isValidEmail(orderData.customerEmail)) {
      return { isValid: false, error: 'Неверный формат email' }
    }
    
    return { isValid: true }
  }

  /**
   * Валидация Canton адреса
   */
  private isValidCantonAddress(address: string): boolean {
    if (!address || typeof address !== 'string') return false;
    const trimmed = address.trim();
    
    // Canton Network поддерживает несколько форматов:
    // 1. HEX::HEX формат: participant_id::party_hint (САМЫЙ РАСПРОСТРАНЕННЫЙ)
    const hexHexPattern = /^[a-fA-F0-9]{32,}::[a-fA-F0-9]{32,}$/i;
    if (hexHexPattern.test(trimmed)) return true;
    
    // 2. Namespace формат: bron::1220... (с буквенным префиксом)
    const namespacePattern = /^[a-zA-Z][a-zA-Z0-9_]*::[a-fA-F0-9]{32,}$/i;
    if (namespacePattern.test(trimmed)) return true;
    
    // 3. Классический формат: name:fingerprint
    const classicPattern = /^[a-zA-Z][a-zA-Z0-9_-]{2,49}::[a-fA-F0-9]{32,80}$/i;
    if (classicPattern.test(trimmed)) return true;
    
    // 4. Hex-only формат (может быть до 80 символов)
    const hexPattern = /^[a-fA-F0-9]{32,80}$/i;
    if (hexPattern.test(trimmed)) return true;
    
    return false;
  }

  /**
   * Валидация email
   */
  private isValidEmail(email: string): boolean {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)
  }

  /**
   * Генерация подтверждения заказа
   */
  private generateOrderConfirmation(orderData: OrderRequest): string {
    const cantonAmount = (orderData.amount / this.CANTON_PRICE_USD).toFixed(2)
    
    return `✅ **Заказ создан успешно!**

📋 **Детали заказа:**
• 💰 Сумма: $${orderData.amount} USDT (${orderData.network})
• 🪙 Получите: ${cantonAmount} CC
• 📧 Email: ${orderData.customerEmail}
• 🏠 Canton адрес: ${orderData.cantonAddress}
${orderData.refundAddress ? `• 🔄 Резервный адрес: ${orderData.refundAddress}` : ''}

⏰ **Время обработки:** до 12 часов
📱 **Уведомления:** на email и Telegram

Я передам заказ живому оператору для обработки. Ожидайте инструкции по оплате в течение 30 минут.

Спасибо за выбор 1OTC! 🚀`
  }

  /**
   * Создание заказа в системе
   */
  async createOrder(orderData: OrderRequest): Promise<{ success: boolean; orderId?: string; error?: string }> {
    try {
      // Создаем заказ в Google Sheets
      const { generateOrderId } = await import('@/lib/utils')
      const orderId = generateOrderId()
      
      const orderRecord: OTCOrder = {
        orderId,
        timestamp: Date.now(),
        paymentToken: {
          symbol: 'USDT',
          name: `USDT (${orderData.network})`,
          network: orderData.network,
          networkName: orderData.network,
          decimals: 6,
          priceUSD: 1,
          minAmount: 1,
          receivingAddress: '',
          icon: '₮',
          color: '#50AF95'
        },
        paymentAmount: orderData.amount,
        paymentAmountUSD: orderData.amount,
        cantonAmount: orderData.amount / this.CANTON_PRICE_USD,
        cantonAddress: orderData.cantonAddress,
        refundAddress: orderData.refundAddress,
        email: orderData.customerEmail,
        telegram: orderData.telegram,
        status: 'awaiting-deposit'
      }
      
      await googleSheetsService.saveOrder(orderRecord)
      
      // Отправляем уведомление операторам
      await telegramMediatorService.forwardClientMessage(
        orderId,
        `AI Agent создал новый заказ: ${orderId}`,
        {
          orderId,
          customerEmail: orderData.customerEmail,
          orderAmount: orderData.amount,
          orderStatus: 'pending',
          intercomConversationId: 'ai_agent',
          intercomUserId: 'ai_agent'
        }
      )
      
      // Логируем создание заказа
      intercomMonitoringService.trackError('order_created', {
        orderId,
        amount: orderData.amount,
        source: 'ai_agent'
      })
      
      return { success: true, orderId }
    } catch (error) {
      console.error('❌ Failed to create order:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Передача клиента живому оператору
   */
  async transferToHuman(customerContext: CustomerContext, reason: string): Promise<void> {
    try {
      // Отправляем уведомление операторам
      await telegramMediatorService.forwardClientMessage(
        'human_handoff',
        `Передача оператору: ${reason}`,
        {
          orderId: 'human_handoff',
          customerEmail: customerContext.email || 'unknown',
          orderAmount: 0,
          orderStatus: 'human_handoff',
          intercomConversationId: 'ai_agent',
          intercomUserId: 'ai_agent'
        }
      )
      
      // Логируем передачу
      intercomMonitoringService.trackError('human_handoff', {
        reason,
        customerEmail: customerContext.email
      })
    } catch (error) {
      console.error('❌ Failed to transfer to human:', error)
    }
  }
}

export const intercomAIAgent = new IntercomAIAgent()
