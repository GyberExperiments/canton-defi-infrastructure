// import crypto from 'crypto'; // Unused import removed

/**
 * 🛡️ Anti-Spam Service
 * Защита от спам-атак и race conditions
 * Решает проблему одновременных заявок на одинаковую сумму
 */

export interface SpamDetectionResult {
  isSpam: boolean;
  confidence: number; // 0-100
  reason: string;
  blockedUntil?: number; // timestamp
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface OrderData {
  email: string;
  cantonAddress: string;
  usdtAmount: number;
  ip: string;
  timestamp: number;
  orderId: string;
}

export interface SpamPattern {
  type: 'DUPLICATE_AMOUNT' | 'DUPLICATE_ADDRESS' | 'RAPID_ORDERS' | 'SUSPICIOUS_IP' | 'PATTERN_ANALYSIS';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  confidence: number;
}

export class AntiSpamService {
  private static instance: AntiSpamService;
  private orderCache = new Map<string, OrderData[]>();
  private blockedIPs = new Map<string, number>();
  private blockedEmails = new Map<string, number>();
  private blockedAddresses = new Map<string, number>();
  
  // Конфигурация - настраивается через переменные окружения
  private readonly DUPLICATE_AMOUNT_WINDOW_MS = parseInt(process.env.ANTI_SPAM_DUPLICATE_WINDOW || '300000'); // 5 минут по умолчанию
  private readonly RAPID_ORDERS_WINDOW_MS = parseInt(process.env.ANTI_SPAM_RAPID_WINDOW || '60000'); // 1 минута по умолчанию
  private readonly MAX_ORDERS_PER_WINDOW = parseInt(process.env.ANTI_SPAM_MAX_ORDERS || '3'); // 3 заказа по умолчанию
  private readonly BLOCK_DURATION_MS = parseInt(process.env.ANTI_SPAM_BLOCK_DURATION || '1800000'); // 30 минут по умолчанию
  private readonly CLEANUP_INTERVAL_MS = parseInt(process.env.ANTI_SPAM_CLEANUP_INTERVAL || '600000'); // 10 минут по умолчанию
  private readonly ENABLE_ANTI_SPAM = process.env.ENABLE_ANTI_SPAM !== 'false'; // включен по умолчанию

  private constructor() {
    this.startCleanupScheduler();
    
    console.log('🛡️ Anti-spam service configured:', {
      enabled: this.ENABLE_ANTI_SPAM,
      duplicateWindow: `${this.DUPLICATE_AMOUNT_WINDOW_MS}ms`,
      rapidWindow: `${this.RAPID_ORDERS_WINDOW_MS}ms`,
      maxOrdersPerWindow: this.MAX_ORDERS_PER_WINDOW,
      blockDuration: `${this.BLOCK_DURATION_MS}ms`,
      cleanupInterval: `${this.CLEANUP_INTERVAL_MS}ms`
    });
  }

  public static getInstance(): AntiSpamService {
    if (!AntiSpamService.instance) {
      AntiSpamService.instance = new AntiSpamService();
    }
    return AntiSpamService.instance;
  }

  /**
   * Основной метод детекции спама
   */
  async detectSpam(orderData: OrderData): Promise<SpamDetectionResult> {
    try {
      // Проверяем, включен ли anti-spam
      if (!this.ENABLE_ANTI_SPAM) {
        console.log(`🛡️ Anti-spam DISABLED for order ${orderData.orderId}`);
        // Сохраняем заявку в кэш для статистики
        this.cacheOrder(orderData);
        return {
          isSpam: false,
          confidence: 0,
          reason: 'Anti-spam disabled via ENABLE_ANTI_SPAM=false',
          riskLevel: 'LOW'
        };
      }

      const patterns: SpamPattern[] = [];
      
      // 1. Проверка дублирующихся сумм в короткий период
      const duplicateAmountPattern = await this.checkDuplicateAmounts(orderData);
      if (duplicateAmountPattern) {
        patterns.push(duplicateAmountPattern);
      }

      // 2. Проверка дублирующихся адресов
      const duplicateAddressPattern = await this.checkDuplicateAddresses(orderData);
      if (duplicateAddressPattern) {
        patterns.push(duplicateAddressPattern);
      }

      // 3. Проверка быстрых заявок
      const rapidOrdersPattern = await this.checkRapidOrders(orderData);
      if (rapidOrdersPattern) {
        patterns.push(rapidOrdersPattern);
      }

      // 4. Проверка подозрительных IP
      const suspiciousIPPattern = await this.checkSuspiciousIP(orderData);
      if (suspiciousIPPattern) {
        patterns.push(suspiciousIPPattern);
      }

      // 5. Анализ паттернов поведения
      const patternAnalysis = await this.analyzeBehaviorPatterns();
      if (patternAnalysis) {
        patterns.push(patternAnalysis);
      }

      // Анализируем результаты
      const result = this.analyzeSpamPatterns(patterns);
      
      // Если спам обнаружен, блокируем
      if (result.isSpam) {
        await this.applyBlocking(orderData, result.riskLevel);
      }

      // Сохраняем заявку в кэш
      this.cacheOrder(orderData);

      console.log(`🛡️ Spam detection for order ${orderData.orderId}:`, {
        isSpam: result.isSpam,
        confidence: result.confidence,
        riskLevel: result.riskLevel,
        patterns: patterns.length
      });

      return result;

    } catch (error) {
      console.error('❌ Spam detection failed:', error);
      // В случае ошибки разрешаем заявку, но логируем
      return {
        isSpam: false,
        confidence: 0,
        reason: 'Detection failed - allowing order',
        riskLevel: 'LOW'
      };
    }
  }

  /**
   * Проверка дублирующихся сумм в короткий период
   */
  private async checkDuplicateAmounts(orderData: OrderData): Promise<SpamPattern | null> {
    const now = Date.now();
    const windowStart = now - this.DUPLICATE_AMOUNT_WINDOW_MS;
    
    let duplicateCount = 0;

    // Проверяем все заявки в окне времени
    for (const [, orders] of this.orderCache.entries()) {
      for (const order of orders) {
        if (order.timestamp > windowStart) {
          if (Math.abs(order.usdtAmount - orderData.usdtAmount) < 0.01) { // Точность до цента
            duplicateCount++;
          }
        }
      }
    }

    if (duplicateCount >= 2) { // 2 или более заявок с одинаковой суммой
      const confidence = Math.min(duplicateCount * 30, 100);
      const severity = duplicateCount >= 5 ? 'CRITICAL' : duplicateCount >= 3 ? 'HIGH' : 'MEDIUM';
      
      return {
        type: 'DUPLICATE_AMOUNT',
        severity,
        description: `${duplicateCount} orders with same amount ($${orderData.usdtAmount}) in 5 minutes`,
        confidence
      };
    }

    return null;
  }

  /**
   * Проверка дублирующихся адресов
   */
  private async checkDuplicateAddresses(orderData: OrderData): Promise<SpamPattern | null> {
    const now = Date.now();
    const windowStart = now - this.DUPLICATE_AMOUNT_WINDOW_MS;
    
    let duplicateCount = 0;

    for (const [, orders] of this.orderCache.entries()) {
      for (const order of orders) {
        if (order.timestamp > windowStart && order.cantonAddress === orderData.cantonAddress) {
          duplicateCount++;
        }
      }
    }

    if (duplicateCount >= 2) {
      const confidence = Math.min(duplicateCount * 25, 100);
      const severity = duplicateCount >= 4 ? 'CRITICAL' : duplicateCount >= 3 ? 'HIGH' : 'MEDIUM';
      
      return {
        type: 'DUPLICATE_ADDRESS',
        severity,
        description: `${duplicateCount} orders to same address in 5 minutes`,
        confidence
      };
    }

    return null;
  }

  /**
   * Проверка быстрых заявок
   */
  private async checkRapidOrders(orderData: OrderData): Promise<SpamPattern | null> {
    const now = Date.now();
    const windowStart = now - this.RAPID_ORDERS_WINDOW_MS;
    
    let rapidCount = 0;

    // Проверяем заявки с того же IP
    const ipOrders = this.orderCache.get(orderData.ip) || [];
    for (const order of ipOrders) {
      if (order.timestamp > windowStart) {
        rapidCount++;
      }
    }

    if (rapidCount >= this.MAX_ORDERS_PER_WINDOW) {
      const confidence = Math.min(rapidCount * 20, 100);
      const severity = rapidCount >= 5 ? 'CRITICAL' : rapidCount >= 4 ? 'HIGH' : 'MEDIUM';
      
      return {
        type: 'RAPID_ORDERS',
        severity,
        description: `${rapidCount} orders from same IP in 1 minute`,
        confidence
      };
    }

    return null;
  }

  /**
   * Проверка подозрительных IP
   */
  private async checkSuspiciousIP(orderData: OrderData): Promise<SpamPattern | null> {
    // Проверяем, не заблокирован ли IP
    if (this.blockedIPs.has(orderData.ip)) {
      const blockedUntil = this.blockedIPs.get(orderData.ip)!;
      if (Date.now() < blockedUntil) {
        return {
          type: 'SUSPICIOUS_IP',
          severity: 'CRITICAL',
          description: 'IP is currently blocked',
          confidence: 100
        };
      }
    }

    // Проверяем историю IP
    const ipOrders = this.orderCache.get(orderData.ip) || [];
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    
    let dayOrders = 0;
    const uniqueEmails = new Set<string>();
    const uniqueAddresses = new Set<string>();

    for (const order of ipOrders) {
      if (order.timestamp > dayAgo) {
        dayOrders++;
        uniqueEmails.add(order.email);
        uniqueAddresses.add(order.cantonAddress);
      }
    }

    // Подозрительные паттерны
    if (dayOrders >= 10) {
      return {
        type: 'SUSPICIOUS_IP',
        severity: 'HIGH',
        description: `${dayOrders} orders from same IP in 24 hours`,
        confidence: Math.min(dayOrders * 5, 100)
      };
    }

    if (uniqueEmails.size >= 5 && dayOrders >= 5) {
      return {
        type: 'SUSPICIOUS_IP',
        severity: 'MEDIUM',
        description: `${uniqueEmails.size} different emails from same IP in 24 hours`,
        confidence: Math.min(uniqueEmails.size * 10, 100)
      };
    }

    return null;
  }

  /**
   * Анализ паттернов поведения
   */
  private async analyzeBehaviorPatterns(): Promise<SpamPattern | null> {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    
    let hourOrders = 0;
    let totalAmount = 0;
    const amounts: number[] = [];

    // Анализируем заявки за последний час
    for (const [, orders] of this.orderCache.entries()) {
      for (const order of orders) {
        if (order.timestamp > hourAgo) {
          hourOrders++;
          totalAmount += order.usdtAmount;
          amounts.push(order.usdtAmount);
        }
      }
    }

    if (hourOrders >= 5) {
      const avgAmount = totalAmount / hourOrders;
      const variance = this.calculateVariance(amounts, avgAmount);
      
      // Если все суммы очень похожи (низкая вариация)
      if (variance < 100 && hourOrders >= 5) {
        return {
          type: 'PATTERN_ANALYSIS',
          severity: 'HIGH',
          description: `Suspicious pattern: ${hourOrders} orders with similar amounts (variance: ${variance.toFixed(2)})`,
          confidence: Math.min(hourOrders * 15, 100)
        };
      }
    }

    return null;
  }

  /**
   * Анализ результатов детекции спама
   */
  private analyzeSpamPatterns(patterns: SpamPattern[]): SpamDetectionResult {
    if (patterns.length === 0) {
      return {
        isSpam: false,
        confidence: 0,
        reason: 'No suspicious patterns detected',
        riskLevel: 'LOW'
      };
    }

    // Вычисляем общую уверенность
    const totalConfidence = patterns.reduce((sum, pattern) => sum + pattern.confidence, 0);
    const avgConfidence = totalConfidence / patterns.length;
    
    // Определяем уровень риска
    const criticalPatterns = patterns.filter(p => p.severity === 'CRITICAL').length;
    const highPatterns = patterns.filter(p => p.severity === 'HIGH').length;
    
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    if (criticalPatterns > 0 || avgConfidence >= 80) {
      riskLevel = 'CRITICAL';
    } else if (highPatterns > 0 || avgConfidence >= 60) {
      riskLevel = 'HIGH';
    } else if (avgConfidence >= 40) {
      riskLevel = 'MEDIUM';
    } else {
      riskLevel = 'LOW';
    }

    const isSpam = avgConfidence >= 50 || criticalPatterns > 0;
    
    const reason = patterns.map(p => p.description).join('; ');

    return {
      isSpam,
      confidence: Math.round(avgConfidence),
      reason,
      riskLevel
    };
  }

  /**
   * Применение блокировок
   */
  private async applyBlocking(orderData: OrderData, riskLevel: string): Promise<void> {
    const blockDuration = riskLevel === 'CRITICAL' ? this.BLOCK_DURATION_MS * 2 : this.BLOCK_DURATION_MS;
    const blockedUntil = Date.now() + blockDuration;

    // Блокируем IP
    this.blockedIPs.set(orderData.ip, blockedUntil);
    
    // Блокируем email если высокий риск
    if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
      this.blockedEmails.set(orderData.email, blockedUntil);
    }

    // Блокируем адрес если критический риск
    if (riskLevel === 'CRITICAL') {
      this.blockedAddresses.set(orderData.cantonAddress, blockedUntil);
    }

    console.log(`🚫 Applied blocking for order ${orderData.orderId}:`, {
      ip: orderData.ip,
      email: orderData.email,
      address: orderData.cantonAddress,
      riskLevel,
      blockedUntil: new Date(blockedUntil).toISOString()
    });
  }

  /**
   * Кэширование заявки
   */
  private cacheOrder(orderData: OrderData): void {
    // Кэшируем по IP
    if (!this.orderCache.has(orderData.ip)) {
      this.orderCache.set(orderData.ip, []);
    }
    this.orderCache.get(orderData.ip)!.push(orderData);

    // Кэшируем по email
    if (!this.orderCache.has(orderData.email)) {
      this.orderCache.set(orderData.email, []);
    }
    this.orderCache.get(orderData.email)!.push(orderData);

    // Кэшируем по адресу
    if (!this.orderCache.has(orderData.cantonAddress)) {
      this.orderCache.set(orderData.cantonAddress, []);
    }
    this.orderCache.get(orderData.cantonAddress)!.push(orderData);
  }

  /**
   * Вычисление дисперсии
   */
  private calculateVariance(values: number[], mean: number): number {
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }

  /**
   * Запуск периодической очистки
   */
  private startCleanupScheduler(): void {
    setInterval(() => {
      this.cleanupExpiredData();
    }, this.CLEANUP_INTERVAL_MS);
  }

  /**
   * Очистка устаревших данных
   */
  private cleanupExpiredData(): void {
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    
    let cleanedEntries = 0;

    // Очищаем кэш заявок
    for (const [key, orders] of this.orderCache.entries()) {
      const filteredOrders = orders.filter(order => order.timestamp > dayAgo);
      if (filteredOrders.length === 0) {
        this.orderCache.delete(key);
        cleanedEntries++;
      } else {
        this.orderCache.set(key, filteredOrders);
      }
    }

    // Очищаем блокировки
    for (const [ip, blockedUntil] of this.blockedIPs.entries()) {
      if (now > blockedUntil) {
        this.blockedIPs.delete(ip);
        cleanedEntries++;
      }
    }

    for (const [email, blockedUntil] of this.blockedEmails.entries()) {
      if (now > blockedUntil) {
        this.blockedEmails.delete(email);
        cleanedEntries++;
      }
    }

    for (const [address, blockedUntil] of this.blockedAddresses.entries()) {
      if (now > blockedUntil) {
        this.blockedAddresses.delete(address);
        cleanedEntries++;
      }
    }

    if (cleanedEntries > 0) {
      console.log(`🧹 Anti-spam cleanup: removed ${cleanedEntries} expired entries`);
    }
  }

  /**
   * Получение статистики
   */
  getStatistics(): {
    totalOrders: number;
    blockedIPs: number;
    blockedEmails: number;
    blockedAddresses: number;
    cacheSize: number;
  } {
    let totalOrders = 0;
    for (const orders of this.orderCache.values()) {
      totalOrders += orders.length;
    }

    return {
      totalOrders,
      blockedIPs: this.blockedIPs.size,
      blockedEmails: this.blockedEmails.size,
      blockedAddresses: this.blockedAddresses.size,
      cacheSize: this.orderCache.size
    };
  }

  /**
   * Проверка, заблокирован ли IP/email/адрес
   */
  isBlocked(ip: string, email?: string, address?: string): boolean {
    const now = Date.now();
    
    if (this.blockedIPs.has(ip) && this.blockedIPs.get(ip)! > now) {
      return true;
    }
    
    if (email && this.blockedEmails.has(email) && this.blockedEmails.get(email)! > now) {
      return true;
    }
    
    if (address && this.blockedAddresses.has(address) && this.blockedAddresses.get(address)! > now) {
      return true;
    }
    
    return false;
  }

  /**
   * Ручная разблокировка (для администратора)
   */
  unblock(ip?: string, email?: string, address?: string): boolean {
    let unblocked = false;
    
    if (ip && this.blockedIPs.has(ip)) {
      this.blockedIPs.delete(ip);
      unblocked = true;
    }
    
    if (email && this.blockedEmails.has(email)) {
      this.blockedEmails.delete(email);
      unblocked = true;
    }
    
    if (address && this.blockedAddresses.has(address)) {
      this.blockedAddresses.delete(address);
      unblocked = true;
    }
    
    if (unblocked) {
      console.log(`🔓 Manual unblock applied:`, { ip, email, address });
    }
    
    return unblocked;
  }
}

// Экспортируем singleton instance
export const antiSpamService = AntiSpamService.getInstance();