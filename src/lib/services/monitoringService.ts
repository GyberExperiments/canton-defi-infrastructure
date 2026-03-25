// import { persistentStorage } from './persistentStorage'; // REMOVED - not in use
// import type { AddressMapping } from './addressGenerator'; // REMOVED - not in use

// Temporary type stubs for compatibility
type AddressMapping = { 
  orderId: string; 
  address: string; 
  addressPath: string; 
  createdAt: number; 
  expiresAt: number;
  isActive: boolean;
};
const persistentStorage = null as any; // Stub for removed service

/**
 * 🏛️ Monitoring Service
 * Расширенный мониторинг и метрики для Canton OTC Exchange
 * Отслеживает производительность, безопасность и бизнес-метрики
 */

export interface SystemMetrics {
  // Адреса и транзакции
  addresses: {
    totalGenerated: number;
    activeAddresses: number;
    expiredAddresses: number;
    averageLifetime: number;
    generationRate: number; // адресов в час
  };
  
  // Производительность
  performance: {
    averageResponseTime: number;
    apiCallsPerMinute: number;
    errorRate: number;
    uptime: number;
  };
  
  // Безопасность
  security: {
    spamAttempts: number;
    blockedIPs: number;
    blockedEmails: number;
    suspiciousActivities: number;
    lastSecurityScan: number;
  };
  
  // Бизнес метрики
  business: {
    totalOrders: number;
    completedOrders: number;
    failedOrders: number;
    totalVolumeUSD: number;
    averageOrderSize: number;
    conversionRate: number;
  };
  
  // Система
  system: {
    storageType: 'redis' | 'memory' | 'postgresql';
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
    lastCleanup: number;
  };
  
  // Временные метки
  timestamps: {
    lastUpdate: number;
    systemStartTime: number;
    lastBackup: number;
  };
}

export interface AlertRule {
  id: string;
  name: string;
  condition: (metrics: SystemMetrics) => boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  cooldown: number; // в миллисекундах
  lastTriggered?: number;
}

export class MonitoringService {
  private static instance: MonitoringService;
  private metrics!: SystemMetrics;
  private alertRules: AlertRule[] = [];
  private startTime: number;
  private apiCallTimes: number[] = [];
  private errorCount = 0;
  private totalApiCalls = 0;

  private constructor() {
    this.startTime = Date.now();
    this.initializeMetrics();
    this.setupAlertRules();
    this.startMetricsCollection();
  }

  public static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  private initializeMetrics(): void {
    this.metrics = {
      addresses: {
        totalGenerated: 0,
        activeAddresses: 0,
        expiredAddresses: 0,
        averageLifetime: 0,
        generationRate: 0
      },
      performance: {
        averageResponseTime: 0,
        apiCallsPerMinute: 0,
        errorRate: 0,
        uptime: 0
      },
      security: {
        spamAttempts: 0,
        blockedIPs: 0,
        blockedEmails: 0,
        suspiciousActivities: 0,
        lastSecurityScan: 0
      },
      business: {
        totalOrders: 0,
        completedOrders: 0,
        failedOrders: 0,
        totalVolumeUSD: 0,
        averageOrderSize: 0,
        conversionRate: 0
      },
      system: {
        storageType: 'memory',
        memoryUsage: 0,
        cpuUsage: 0,
        diskUsage: 0,
        lastCleanup: 0
      },
      timestamps: {
        lastUpdate: Date.now(),
        systemStartTime: this.startTime,
        lastBackup: 0
      }
    };
  }

  private setupAlertRules(): void {
    this.alertRules = [
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        condition: (metrics) => metrics.performance.errorRate > 0.05, // 5%
        severity: 'high',
        message: 'Error rate is above 5%',
        cooldown: 30 * 60 * 1000 // ✅ FIX: 30 минут вместо 5 минут
      },
      {
        id: 'low_memory',
        name: 'Low Memory',
        condition: (metrics) => metrics.system.memoryUsage > 0.9, // 90%
        severity: 'critical',
        message: 'Memory usage is above 90%',
        cooldown: 30 * 60 * 1000 // ✅ FIX: 30 минут вместо 2 минут
      },
      {
        id: 'high_spam_attempts',
        name: 'High Spam Attempts',
        condition: (metrics) => metrics.security.spamAttempts > 100,
        severity: 'medium',
        message: 'High number of spam attempts detected',
        cooldown: 10 * 60 * 1000 // 10 минут
      },
      {
        id: 'slow_response_time',
        name: 'Slow Response Time',
        condition: (metrics) => metrics.performance.averageResponseTime > 2000, // 2 секунды
        severity: 'medium',
        message: 'Average response time is above 2 seconds',
        cooldown: 5 * 60 * 1000 // 5 минут
      },
      {
        id: 'storage_issues',
        name: 'Storage Issues',
        condition: (metrics) => metrics.system.storageType === 'memory' && metrics.addresses.totalGenerated > 1000,
        severity: 'high',
        message: 'Using memory storage with high address count - consider Redis',
        cooldown: 30 * 60 * 1000 // 30 минут
      }
    ];
  }

  private startMetricsCollection(): void {
    // Обновляем метрики каждые 30 секунд
    setInterval(async () => {
      await this.updateMetrics();
      await this.checkAlerts();
    }, 30 * 1000);

    // Очищаем старые данные каждые 5 минут
    setInterval(() => {
      this.cleanupOldData();
    }, 5 * 60 * 1000);
  }

  private async updateMetrics(): Promise<void> {
    try {
      // Получаем метрики из хранилища
      const storage = await persistentStorage;
      const storageMetrics = await storage.getMetrics();
      const activeAddresses = await storage.getAllActiveAddresses();

      // Обновляем метрики адресов
      this.metrics.addresses.totalGenerated = storageMetrics.addressesGenerated;
      this.metrics.addresses.activeAddresses = activeAddresses.length;
      this.metrics.addresses.expiredAddresses = storageMetrics.addressesExpired;
      this.metrics.addresses.averageLifetime = this.calculateAverageLifetime(activeAddresses);
      this.metrics.addresses.generationRate = this.calculateGenerationRate();

      // Обновляем метрики производительности
      this.metrics.performance.averageResponseTime = this.calculateAverageResponseTime();
      this.metrics.performance.apiCallsPerMinute = this.calculateApiCallsPerMinute();
      this.metrics.performance.errorRate = this.calculateErrorRate();
      this.metrics.performance.uptime = Date.now() - this.startTime;

      // Обновляем метрики безопасности
      this.metrics.security.spamAttempts = storageMetrics.spamAttempts;
      this.metrics.security.lastSecurityScan = Date.now();

      // Обновляем системные метрики
      this.metrics.system.storageType = storageMetrics.storageType;
      this.metrics.system.lastCleanup = storageMetrics.lastCleanup;
      this.metrics.system.memoryUsage = this.getMemoryUsage();
      this.metrics.system.cpuUsage = this.getCpuUsage();
      this.metrics.system.diskUsage = this.getDiskUsage();

      // Обновляем временные метки
      this.metrics.timestamps.lastUpdate = Date.now();

    } catch (error) {
      console.error('❌ Failed to update metrics:', error);
    }
  }

  private calculateAverageLifetime(addresses: AddressMapping[]): number {
    if (addresses.length === 0) return 0;
    
    const now = Date.now();
    const totalLifetime = addresses.reduce((sum, addr) => {
      return sum + (now - addr.createdAt);
    }, 0);
    
    return totalLifetime / addresses.length / (1000 * 60); // в минутах
  }

  private calculateGenerationRate(): number {
    const uptimeHours = (Date.now() - this.startTime) / (1000 * 60 * 60);
    return this.metrics.addresses.totalGenerated / Math.max(uptimeHours, 1);
  }

  private calculateAverageResponseTime(): number {
    if (this.apiCallTimes.length === 0) return 0;
    
    const sum = this.apiCallTimes.reduce((a, b) => a + b, 0);
    return sum / this.apiCallTimes.length;
  }

  private calculateApiCallsPerMinute(): number {
    const now = Date.now();
    const oneMinuteAgo = now - (60 * 1000);
    
    // Подсчитываем API вызовы за последнюю минуту
    const recentCalls = this.apiCallTimes.filter(time => time > oneMinuteAgo);
    return recentCalls.length;
  }

  private calculateErrorRate(): number {
    if (this.totalApiCalls === 0) return 0;
    return this.errorCount / this.totalApiCalls;
  }

  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      // ✅ FIX: Используем RSS (реальную память) вместо heap
      // RSS показывает физическую память, а не только V8 heap
      // Для контейнеров обычно лимит 512Mi, так что используем это как базу
      const containerLimit = 512 * 1024 * 1024; // 512Mi в байтах
      return usage.rss / containerLimit;
    }
    return 0;
  }

  private getCpuUsage(): number {
    // Упрощенная оценка CPU usage
    // В реальном приложении можно использовать более точные методы
    return 0;
  }

  private getDiskUsage(): number {
    // Упрощенная оценка disk usage
    // В реальном приложении можно использовать более точные методы
    return 0;
  }

  private cleanupOldData(): void {
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    
    // Очищаем старые времена API вызовов
    this.apiCallTimes = this.apiCallTimes.filter(time => time > fiveMinutesAgo);
  }

  private async checkAlerts(): Promise<void> {
    for (const rule of this.alertRules) {
      if (rule.condition(this.metrics)) {
        const now = Date.now();
        const lastTriggered = rule.lastTriggered || 0;
        
        if (now - lastTriggered > rule.cooldown) {
          await this.triggerAlert(rule);
          rule.lastTriggered = now;
        }
      }
    }
  }

  private async triggerAlert(rule: AlertRule): Promise<void> {
    console.warn(`🚨 ALERT [${rule.severity.toUpperCase()}]: ${rule.name} - ${rule.message}`);
    
    // Здесь можно добавить отправку уведомлений в Telegram, Slack, email и т.д.
    // await this.sendAlertNotification(alert);
  }

  // Публичные методы для обновления метрик
  public recordApiCall(responseTime: number, isError: boolean = false): void {
    this.apiCallTimes.push(Date.now());
    this.totalApiCalls++;
    
    if (isError) {
      this.errorCount++;
    }
  }

  public recordOrder(orderAmount: number, isCompleted: boolean = true): void {
    this.metrics.business.totalOrders++;
    
    if (isCompleted) {
      this.metrics.business.completedOrders++;
      this.metrics.business.totalVolumeUSD += orderAmount;
    } else {
      this.metrics.business.failedOrders++;
    }
    
    this.metrics.business.averageOrderSize = 
      this.metrics.business.totalVolumeUSD / Math.max(this.metrics.business.completedOrders, 1);
    
    this.metrics.business.conversionRate = 
      this.metrics.business.completedOrders / Math.max(this.metrics.business.totalOrders, 1);
  }

  public recordSpamAttempt(): void {
    this.metrics.security.spamAttempts++;
  }

  public recordBlockedIP(): void {
    this.metrics.security.blockedIPs++;
  }

  public recordBlockedEmail(): void {
    this.metrics.security.blockedEmails++;
  }

  public recordSuspiciousActivity(): void {
    this.metrics.security.suspiciousActivities++;
  }

  // Геттеры для метрик
  public getMetrics(): SystemMetrics {
    return { ...this.metrics };
  }

  public getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    uptime: number;
  } {
    const issues: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Проверяем критические проблемы
    if (this.metrics.performance.errorRate > 0.1) {
      issues.push('High error rate');
      status = 'critical';
    }

    if (this.metrics.system.memoryUsage > 0.9) {
      issues.push('High memory usage');
      status = 'critical';
    }

    if (this.metrics.performance.averageResponseTime > 5000) {
      issues.push('Very slow response time');
      status = 'critical';
    }

    // Проверяем предупреждения
    if (this.metrics.performance.errorRate > 0.05) {
      issues.push('Elevated error rate');
      if (status === 'healthy') status = 'warning';
    }

    if (this.metrics.performance.averageResponseTime > 2000) {
      issues.push('Slow response time');
      if (status === 'healthy') status = 'warning';
    }

    if (this.metrics.security.spamAttempts > 50) {
      issues.push('High spam activity');
      if (status === 'healthy') status = 'warning';
    }

    return {
      status,
      issues,
      uptime: Date.now() - this.startTime
    };
  }

  public getPerformanceReport(): {
    summary: string;
    recommendations: string[];
    metrics: SystemMetrics;
  } {
    const recommendations: string[] = [];
    const health = this.getHealthStatus();

    if (health.status === 'critical') {
      recommendations.push('🚨 Immediate attention required - system health is critical');
    }

    if (this.metrics.performance.errorRate > 0.05) {
      recommendations.push('🔧 Investigate and fix API errors');
    }

    if (this.metrics.performance.averageResponseTime > 2000) {
      recommendations.push('⚡ Optimize API response times');
    }

    if (this.metrics.system.storageType === 'memory' && this.metrics.addresses.totalGenerated > 1000) {
      recommendations.push('💾 Consider migrating to Redis for better performance');
    }

    if (this.metrics.security.spamAttempts > 100) {
      recommendations.push('🛡️ Review and strengthen anti-spam measures');
    }

    if (this.metrics.system.memoryUsage > 0.8) {
      recommendations.push('🧠 Monitor memory usage and consider scaling');
    }

    const summary = `System is ${health.status} with ${health.issues.length} issues. ` +
      `Uptime: ${Math.floor(health.uptime / (1000 * 60 * 60))}h ${Math.floor((health.uptime % (1000 * 60 * 60)) / (1000 * 60))}m`;

    return {
      summary,
      recommendations,
      metrics: this.metrics
    };
  }
}

// Экспортируем singleton instance
export const monitoringService = MonitoringService.getInstance();
