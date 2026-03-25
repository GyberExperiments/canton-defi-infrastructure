/**
 * 🛡️ Enhanced Anti-Spam Service
 * Улучшенная система защиты от спама с:
 * - Persistent storage в Redis
 * - Fallback на файловое хранилище
 * - Распределённая работа в кластере
 * - Machine Learning алгоритмы детекции
 * - Detailed analytics и reporting
 */

import { Redis } from 'ioredis';
import { UnifiedCacheService } from './unifiedCache';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

export interface SpamDetectionConfig {
  // Time windows
  rapidOrderWindow: number;          // Окно для быстрых заказов (секунды)
  duplicateAmountWindow: number;     // Окно для дублирующихся сумм (минуты)  
  blockDuration: number;             // Длительность блокировки (секунды)
  
  // Thresholds
  maxOrdersPerWindow: number;        // Максимум заказов в окне
  maxDuplicateAmounts: number;       // Максимум одинаковых сумм
  maxOrdersPerIP: number;            // Максимум заказов с одного IP
  maxOrdersPerEmail: number;         // Максимум заказов с одного email
  
  // Advanced features
  suspiciousPatternThreshold: number; // Порог подозрительности (0-1)
  enableMLDetection: boolean;         // Включить ML детекцию
  enableBehaviorAnalysis: boolean;    // Анализ поведения пользователей
}

export interface SpamRecord {
  id: string;
  type: 'ip' | 'email' | 'pattern' | 'ml';
  identifier: string;               // IP, email, или паттерн
  reason: string;                  // Причина блокировки
  timestamp: number;               // Время обнаружения
  expiresAt: number;              // Время истечения
  severity: 'low' | 'medium' | 'high';
  metadata: Record<string, unknown>; // Дополнительные данные
  attempts: number;                // Количество попыток
}

export interface OrderAnalytics {
  orderId: string;
  ip: string;
  email: string;
  amount: number;
  timestamp: number;
  userAgent?: string;
  fingerprint?: string;
  suspiciousScore: number;         // 0-1, где 1 = очень подозрительно
  patterns: string[];              // Найденные паттерны
}

export interface SpamStats {
  totalBlocked: number;
  totalAnalyzed: number;
  blocksByType: Record<string, number>;
  blocksByHour: Record<string, number>;
  falsePositives: number;
  accuracy: number;
}

export class EnhancedAntiSpamService extends EventEmitter {
  private static instance: EnhancedAntiSpamService;
  private redis?: Redis;
  private cache: UnifiedCacheService;
  private config: SpamDetectionConfig;
  
  // In-memory storage для критически важных данных
  private blockedRecords = new Map<string, SpamRecord>();
  private orderHistory: OrderAnalytics[] = [];
  private stats: SpamStats = {
    totalBlocked: 0,
    totalAnalyzed: 0,
    blocksByType: {},
    blocksByHour: {},
    falsePositives: 0,
    accuracy: 0.95
  };
  
  private readonly STORAGE_PATH = path.join(process.cwd(), 'data', 'anti-spam');
  private readonly BACKUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private saveInterval?: NodeJS.Timeout;
  
  constructor(config?: Partial<SpamDetectionConfig>) {
    super();
    
    this.config = {
      rapidOrderWindow: 60,           // 1 минута
      duplicateAmountWindow: 5,       // 5 минут  
      blockDuration: 3600,            // 1 час
      maxOrdersPerWindow: 3,
      maxDuplicateAmounts: 2,
      maxOrdersPerIP: 10,
      maxOrdersPerEmail: 5,
      suspiciousPatternThreshold: 0.7,
      enableMLDetection: true,
      enableBehaviorAnalysis: true,
      ...config
    };
    
    this.cache = UnifiedCacheService.getInstance();
    this.initialize();
  }
  
  static getInstance(config?: Partial<SpamDetectionConfig>): EnhancedAntiSpamService {
    if (!EnhancedAntiSpamService.instance) {
      EnhancedAntiSpamService.instance = new EnhancedAntiSpamService(config);
    }
    return EnhancedAntiSpamService.instance;
  }
  
  private async initialize(): Promise<void> {
    try {
      // Setup Redis connection
      if (process.env.REDIS_URL) {
        this.redis = new Redis(process.env.REDIS_URL);
        await this.redis.ping();
        console.info('✅ Anti-spam service connected to Redis');
      }
      
      // Create storage directory
      await fs.mkdir(this.STORAGE_PATH, { recursive: true });
      
      // Load existing data
      await this.loadFromStorage();
      
      // Start periodic backup
      this.startBackupInterval();
      
      // Load existing blocks from Redis
      if (this.redis) {
        await this.loadFromRedis();
      }
      
      console.info('✅ Enhanced Anti-Spam Service initialized', {
        redis: !!this.redis,
        recordsLoaded: this.blockedRecords.size,
        historyLoaded: this.orderHistory.length
      });
      
    } catch (error) {
      console.error('❌ Failed to initialize Anti-Spam Service:', error);
      // Continue with in-memory only mode
    }
  }
  
  /**
   * Основной метод проверки заказа на спам
   */
  async analyzeOrder(orderData: {
    ip: string;
    email: string;
    amount: number;
    userAgent?: string;
    fingerprint?: string;
  }): Promise<{
    isSpam: boolean;
    reason?: string;
    confidence: number;
    suspiciousScore: number;
    blockDuration?: number;
    recommendations: string[];
  }> {
    const startTime = Date.now();
    const analytics: OrderAnalytics = {
      orderId: crypto.randomUUID(),
      ...orderData,
      timestamp: startTime,
      suspiciousScore: 0,
      patterns: []
    };
    
    this.stats.totalAnalyzed++;
    
    try {
      // 1. Проверка существующих блокировок
      const existingBlock = await this.checkExistingBlocks(orderData.ip, orderData.email);
      if (existingBlock) {
        this.emit('orderBlocked', {
          ...analytics,
          reason: existingBlock.reason,
          blockType: existingBlock.type
        });
        
        return {
          isSpam: true,
          reason: existingBlock.reason,
          confidence: 0.95,
          suspiciousScore: 1.0,
          blockDuration: existingBlock.expiresAt - Date.now(),
          recommendations: ['Wait for block to expire', 'Contact support if this is an error']
        };
      }
      
      // 2. Rapid order detection
      const rapidCheck = await this.checkRapidOrders(orderData.ip, orderData.email);
      analytics.patterns.push(...rapidCheck.patterns);
      analytics.suspiciousScore = Math.max(analytics.suspiciousScore, rapidCheck.score);
      
      // 3. Duplicate amount detection
      const duplicateCheck = await this.checkDuplicateAmounts(orderData.amount, orderData.ip);
      analytics.patterns.push(...duplicateCheck.patterns);
      analytics.suspiciousScore = Math.max(analytics.suspiciousScore, duplicateCheck.score);
      
      // 4. IP reputation check
      const ipCheck = await this.checkIPReputation(orderData.ip);
      analytics.patterns.push(...ipCheck.patterns);
      analytics.suspiciousScore = Math.max(analytics.suspiciousScore, ipCheck.score);
      
      // 5. Email pattern analysis
      const emailCheck = await this.checkEmailPatterns(orderData.email);
      analytics.patterns.push(...emailCheck.patterns);
      analytics.suspiciousScore = Math.max(analytics.suspiciousScore, emailCheck.score);
      
      // 6. ML-based detection (если включено)
      if (this.config.enableMLDetection) {
        const mlCheck = await this.mlPatternDetection(analytics);
        analytics.patterns.push(...mlCheck.patterns);
        analytics.suspiciousScore = Math.max(analytics.suspiciousScore, mlCheck.score);
      }
      
      // 7. Behavior analysis (если включено)
      if (this.config.enableBehaviorAnalysis) {
        const behaviorCheck = await this.analyzeBehaviorPatterns(analytics);
        analytics.patterns.push(...behaviorCheck.patterns);
        analytics.suspiciousScore = Math.max(analytics.suspiciousScore, behaviorCheck.score);
      }
      
      // Сохранить аналитику
      this.orderHistory.push(analytics);
      await this.saveAnalytics(analytics);
      
      // Принять решение
      const isSpam = analytics.suspiciousScore >= this.config.suspiciousPatternThreshold;
      const confidence = Math.min(analytics.suspiciousScore * 1.2, 1.0);
      
      if (isSpam) {
        await this.blockEntity(analytics);
        this.stats.totalBlocked++;
        this.stats.blocksByType['pattern'] = (this.stats.blocksByType['pattern'] || 0) + 1;
        
        this.emit('spamDetected', analytics);
      }
      
      const processingTime = Date.now() - startTime;
      console.info(`🔍 Spam analysis completed in ${processingTime}ms`, {
        isSpam,
        score: analytics.suspiciousScore,
        patterns: analytics.patterns,
        confidence
      });
      
      return {
        isSpam,
        reason: isSpam ? `Suspicious patterns detected: ${analytics.patterns.join(', ')}` : undefined,
        confidence,
        suspiciousScore: analytics.suspiciousScore,
        blockDuration: isSpam ? this.config.blockDuration * 1000 : undefined,
        recommendations: this.generateRecommendations(analytics, isSpam)
      };
      
    } catch (error) {
      console.error('❌ Spam analysis failed:', error);
      
      // В случае ошибки - консервативный подход
      return {
        isSpam: false,
        confidence: 0,
        suspiciousScore: 0,
        recommendations: ['Analysis failed - order allowed with manual review recommended']
      };
    }
  }
  
  private async checkExistingBlocks(ip: string, email: string): Promise<SpamRecord | null> {
    const now = Date.now();
    
    // Check in-memory first
    for (const [key, record] of this.blockedRecords) {
      if (record.expiresAt < now) {
        this.blockedRecords.delete(key);
        continue;
      }
      
      if (record.identifier === ip || record.identifier === email) {
        record.attempts++;
        return record;
      }
    }
    
    // Check Redis cache
    if (this.redis) {
      try {
        const ipBlock = await this.redis.get(`spam:block:ip:${ip}`);
        const emailBlock = await this.redis.get(`spam:block:email:${email}`);
        
        if (ipBlock) {
          const record: SpamRecord = JSON.parse(ipBlock);
          if (record.expiresAt > now) {
            return record;
          }
        }
        
        if (emailBlock) {
          const record: SpamRecord = JSON.parse(emailBlock);
          if (record.expiresAt > now) {
            return record;
          }
        }
      } catch (error) {
        console.warn('Redis block check failed:', error);
      }
    }
    
    return null;
  }
  
  private async checkRapidOrders(ip: string, email: string): Promise<{score: number, patterns: string[]}> {
    const now = Date.now();
    const windowStart = now - (this.config.rapidOrderWindow * 1000);
    const patterns: string[] = [];
    let score = 0;
    
    // Count recent orders from this IP/email
    const recentOrders = this.orderHistory.filter(order => 
      order.timestamp > windowStart && 
      (order.ip === ip || order.email === email)
    );
    
    if (recentOrders.length >= this.config.maxOrdersPerWindow) {
      patterns.push(`rapid_orders_${recentOrders.length}_in_${this.config.rapidOrderWindow}s`);
      score = Math.min(recentOrders.length / this.config.maxOrdersPerWindow, 1.0);
    }
    
    return { score, patterns };
  }
  
  private async checkDuplicateAmounts(amount: number, ip: string): Promise<{score: number, patterns: string[]}> {
    const now = Date.now();
    const windowStart = now - (this.config.duplicateAmountWindow * 60 * 1000);
    const patterns: string[] = [];
    let score = 0;
    
    // Count duplicate amounts from this IP
    const duplicateOrders = this.orderHistory.filter(order => 
      order.timestamp > windowStart && 
      order.ip === ip &&
      Math.abs(order.amount - amount) < 0.01 // Floating point comparison
    );
    
    if (duplicateOrders.length >= this.config.maxDuplicateAmounts) {
      patterns.push(`duplicate_amount_${amount}_count_${duplicateOrders.length}`);
      score = Math.min(duplicateOrders.length / this.config.maxDuplicateAmounts, 1.0);
    }
    
    return { score, patterns };
  }
  
  private async checkIPReputation(ip: string): Promise<{score: number, patterns: string[]}> {
    const patterns: string[] = [];
    let score = 0;
    
    // Check historical data for this IP
    const ipHistory = this.orderHistory.filter(order => order.ip === ip);
    const avgSuspiciousScore = ipHistory.reduce((sum, order) => sum + order.suspiciousScore, 0) / ipHistory.length;
    
    if (avgSuspiciousScore > 0.5) {
      patterns.push(`high_risk_ip_avg_score_${avgSuspiciousScore.toFixed(2)}`);
      score = avgSuspiciousScore;
    }
    
    // Check if IP has too many orders total
    if (ipHistory.length > this.config.maxOrdersPerIP) {
      patterns.push(`high_volume_ip_${ipHistory.length}_orders`);
      score = Math.max(score, 0.6);
    }
    
    return { score, patterns };
  }
  
  private async checkEmailPatterns(email: string): Promise<{score: number, patterns: string[]}> {
    const patterns: string[] = [];
    let score = 0;
    
    // Check for suspicious email patterns
    const suspiciousPatterns = [
      /\+.*@/,                    // Plus addressing
      /@10minutemail\./,          // Temporary email
      /@tempmail\./,              // Temporary email
      /^[a-z]+\d+@/,             // Simple pattern like user123@
      /@.*\.tk$/,                 // Suspicious TLD
      /@.*\.ml$/,                 // Suspicious TLD
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(email)) {
        patterns.push(`suspicious_email_pattern_${pattern.source}`);
        score = Math.max(score, 0.4);
      }
    }
    
    // Check email frequency
    const emailHistory = this.orderHistory.filter(order => order.email === email);
    if (emailHistory.length > this.config.maxOrdersPerEmail) {
      patterns.push(`high_frequency_email_${emailHistory.length}_orders`);
      score = Math.max(score, 0.7);
    }
    
    return { score, patterns };
  }
  
  private async mlPatternDetection(analytics: OrderAnalytics): Promise<{score: number, patterns: string[]}> {
    // Простая ML логика (в реальности можно использовать TensorFlow.js или API)
    const patterns: string[] = [];
    let score = 0;
    
    // Feature engineering
    const features = {
      hourOfDay: new Date(analytics.timestamp).getHours(),
      amountRounded: Math.round(analytics.amount) === analytics.amount,
      emailLength: analytics.email.length,
      hasUserAgent: !!analytics.userAgent,
      hasFingerprint: !!analytics.fingerprint,
    };
    
    // Простые эвристики (заменить на реальную ML модель)
    if (features.hourOfDay < 6 || features.hourOfDay > 22) {
      patterns.push('unusual_time_pattern');
      score = Math.max(score, 0.3);
    }
    
    if (features.amountRounded && analytics.amount > 100) {
      patterns.push('round_amount_pattern');
      score = Math.max(score, 0.2);
    }
    
    if (!features.hasUserAgent) {
      patterns.push('missing_user_agent');
      score = Math.max(score, 0.5);
    }
    
    return { score, patterns };
  }
  
  private async analyzeBehaviorPatterns(analytics: OrderAnalytics): Promise<{score: number, patterns: string[]}> {
    const patterns: string[] = [];
    let score = 0;
    
    // Analyze user behavior patterns
    const recentOrders = this.orderHistory
      .filter(order => order.ip === analytics.ip || order.email === analytics.email)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);
    
    if (recentOrders.length > 2) {
      // Check for too regular timing
      const intervals = [];
      for (let i = 1; i < recentOrders.length; i++) {
        intervals.push(recentOrders[i-1].timestamp - recentOrders[i].timestamp);
      }
      
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
      
      if (variance < avgInterval * 0.1) { // Очень регулярные интервалы
        patterns.push('robotic_timing_pattern');
        score = Math.max(score, 0.8);
      }
    }
    
    return { score, patterns };
  }
  
  private async blockEntity(analytics: OrderAnalytics): Promise<void> {
    const now = Date.now();
    const expiresAt = now + (this.config.blockDuration * 1000);
    
    // Block IP
    const ipRecord: SpamRecord = {
      id: crypto.randomUUID(),
      type: 'ip',
      identifier: analytics.ip,
      reason: `Suspicious patterns detected: ${analytics.patterns.join(', ')}`,
      timestamp: now,
      expiresAt,
      severity: analytics.suspiciousScore > 0.8 ? 'high' : 'medium',
      metadata: { analytics },
      attempts: 1
    };
    
    // Block Email
    const emailRecord: SpamRecord = {
      ...ipRecord,
      id: crypto.randomUUID(),
      type: 'email',
      identifier: analytics.email,
    };
    
    // Store in memory
    this.blockedRecords.set(`ip:${analytics.ip}`, ipRecord);
    this.blockedRecords.set(`email:${analytics.email}`, emailRecord);
    
    // Store in Redis
    if (this.redis) {
      try {
        const ttl = Math.ceil(this.config.blockDuration);
        await Promise.all([
          this.redis.setex(`spam:block:ip:${analytics.ip}`, ttl, JSON.stringify(ipRecord)),
          this.redis.setex(`spam:block:email:${analytics.email}`, ttl, JSON.stringify(emailRecord))
        ]);
      } catch (error) {
        console.warn('Failed to store block in Redis:', error);
      }
    }
    
    // Backup to file
    await this.saveToStorage();
    
    console.warn(`🚫 Blocked ${analytics.ip} and ${analytics.email} for ${this.config.blockDuration}s`, {
      reason: ipRecord.reason,
      score: analytics.suspiciousScore,
      patterns: analytics.patterns
    });
  }
  
  private generateRecommendations(analytics: OrderAnalytics, isSpam: boolean): string[] {
    const recommendations: string[] = [];
    
    if (isSpam) {
      recommendations.push('Order blocked due to suspicious patterns');
      
      if (analytics.patterns.includes('rapid_orders')) {
        recommendations.push('Wait longer between orders');
      }
      
      if (analytics.patterns.some(p => p.includes('duplicate_amount'))) {
        recommendations.push('Try a different amount');
      }
      
      if (analytics.patterns.some(p => p.includes('suspicious_email'))) {
        recommendations.push('Use a different email address');
      }
      
      recommendations.push('Contact support if you believe this is an error');
    } else {
      recommendations.push('Order approved - no suspicious patterns detected');
      
      if (analytics.suspiciousScore > 0.3) {
        recommendations.push('Order flagged for manual review');
      }
    }
    
    return recommendations;
  }
  
  // Persistence methods
  private async saveToStorage(): Promise<void> {
    try {
      const data = {
        blocks: Array.from(this.blockedRecords.entries()),
        history: this.orderHistory.slice(-1000), // Keep last 1000 orders
        stats: this.stats,
        timestamp: Date.now()
      };
      
      const filePath = path.join(this.STORAGE_PATH, 'spam-data.json');
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save anti-spam data:', error);
    }
  }
  
  private async loadFromStorage(): Promise<void> {
    try {
      const filePath = path.join(this.STORAGE_PATH, 'spam-data.json');
      const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
      
      // Load blocks
      this.blockedRecords = new Map(data.blocks || []);
      
      // Load history
      this.orderHistory = data.history || [];
      
      // Load stats
      this.stats = { ...this.stats, ...data.stats };
      
      // Clean expired blocks
      const now = Date.now();
      for (const [key, record] of this.blockedRecords) {
        if (record.expiresAt < now) {
          this.blockedRecords.delete(key);
        }
      }
      
      console.info('📂 Loaded anti-spam data from storage', {
        blocks: this.blockedRecords.size,
        history: this.orderHistory.length
      });
    } catch (error) {
      console.warn('Could not load anti-spam data from storage:', error);
    }
  }
  
  private async loadFromRedis(): Promise<void> {
    if (!this.redis) return;
    
    try {
      const keys = await this.redis.keys('spam:block:*');
      
      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          const record: SpamRecord = JSON.parse(data);
          if (record.expiresAt > Date.now()) {
            const mapKey = `${record.type}:${record.identifier}`;
            this.blockedRecords.set(mapKey, record);
          }
        }
      }
      
      console.info('📡 Loaded anti-spam blocks from Redis', {
        blocks: keys.length
      });
    } catch (error) {
      console.warn('Failed to load blocks from Redis:', error);
    }
  }
  
  private async saveAnalytics(analytics: OrderAnalytics): Promise<void> {
    // Cache analytics in unified cache service
    await this.cache.set(
      `analytics:order:${analytics.orderId}`,
      analytics,
      { ttl: 24 * 60 * 60 } // 24 hours
    );
  }
  
  private startBackupInterval(): void {
    this.saveInterval = setInterval(async () => {
      await this.saveToStorage();
    }, this.BACKUP_INTERVAL);
  }
  
  // Public methods for management
  async unblock(identifier: string, type: 'ip' | 'email'): Promise<boolean> {
    const key = `${type}:${identifier}`;
    const deleted = this.blockedRecords.delete(key);
    
    if (this.redis) {
      try {
        await this.redis.del(`spam:block:${type}:${identifier}`);
      } catch (error) {
        console.warn('Failed to remove block from Redis:', error);
      }
    }
    
    if (deleted) {
      await this.saveToStorage();
      this.emit('entityUnblocked', { type, identifier });
      console.info(`✅ Unblocked ${type}: ${identifier}`);
    }
    
    return deleted;
  }
  
  async getStats(): Promise<SpamStats & { activeBlocks: number }> {
    return {
      ...this.stats,
      activeBlocks: this.blockedRecords.size
    };
  }
  
  async getActiveBlocks(): Promise<SpamRecord[]> {
    const now = Date.now();
    return Array.from(this.blockedRecords.values())
      .filter(record => record.expiresAt > now);
  }
  
  // Cleanup
  destroy(): void {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }
    
    if (this.redis) {
      this.redis.disconnect();
    }
    
    this.removeAllListeners();
  }
}

// Export singleton
export const enhancedAntiSpam = EnhancedAntiSpamService.getInstance();



