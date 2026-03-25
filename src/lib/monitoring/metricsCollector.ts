/**
 * Metrics Collector
 * Собирает метрики для мониторинга production системы
 */

interface Metrics {
  orderCreations: number;
  orderCreationErrors: number;
  averageOrderCreationTime: number;
  supabaseSaveSuccesses: number;
  supabaseSaveErrors: number;
  webhookValidations: number;
  webhookRejections: number;
  notificationsSent: {
    telegram: number;
    intercom: number;
    email: number;
  };
  notificationsFailed: {
    telegram: number;
    intercom: number;
    email: number;
  };
  orderCreationSuccessRate: number;
  supabaseSaveSuccessRate: number;
}

class MetricsCollector {
  private metrics: Metrics = {
    orderCreations: 0,
    orderCreationErrors: 0,
    averageOrderCreationTime: 0,
    supabaseSaveSuccesses: 0,
    supabaseSaveErrors: 0,
    webhookValidations: 0,
    webhookRejections: 0,
    notificationsSent: {
      telegram: 0,
      intercom: 0,
      email: 0
    },
    notificationsFailed: {
      telegram: 0,
      intercom: 0,
      email: 0
    },
    orderCreationSuccessRate: 100,
    supabaseSaveSuccessRate: 100
  };

  private orderCreationTimes: number[] = [];
  private readonly MAX_SAMPLES = 1000;

  /**
   * Записать создание заявки
   */
  recordOrderCreation(durationMs: number): void {
    this.metrics.orderCreations++;
    this.orderCreationTimes.push(durationMs);
    
    // Ограничиваем размер массива
    if (this.orderCreationTimes.length > this.MAX_SAMPLES) {
      this.orderCreationTimes.shift();
    }
    
    // Пересчитываем среднее
    const sum = this.orderCreationTimes.reduce((a, b) => a + b, 0);
    this.metrics.averageOrderCreationTime = sum / this.orderCreationTimes.length;
    
    // Пересчитываем success rate
    const total = this.metrics.orderCreations + this.metrics.orderCreationErrors;
    if (total > 0) {
      this.metrics.orderCreationSuccessRate = 
        (this.metrics.orderCreations / total) * 100;
    }
  }

  /**
   * Записать ошибку создания заявки
   */
  recordOrderCreationError(): void {
    this.metrics.orderCreationErrors++;
    
    // Пересчитываем success rate
    const total = this.metrics.orderCreations + this.metrics.orderCreationErrors;
    if (total > 0) {
      this.metrics.orderCreationSuccessRate = 
        (this.metrics.orderCreations / total) * 100;
    }
  }

  /**
   * Записать успешное сохранение в Supabase
   */
  recordSupabaseSave(success: boolean): void {
    if (success) {
      this.metrics.supabaseSaveSuccesses++;
    } else {
      this.metrics.supabaseSaveErrors++;
    }
    
    // Пересчитываем success rate
    const total = this.metrics.supabaseSaveSuccesses + this.metrics.supabaseSaveErrors;
    if (total > 0) {
      this.metrics.supabaseSaveSuccessRate = 
        (this.metrics.supabaseSaveSuccesses / total) * 100;
    }
  }

  /**
   * Записать валидацию webhook
   */
  recordWebhookValidation(valid: boolean): void {
    if (valid) {
      this.metrics.webhookValidations++;
    } else {
      this.metrics.webhookRejections++;
    }
  }

  /**
   * Записать отправку уведомления
   */
  recordNotification(channel: 'telegram' | 'intercom' | 'email', success: boolean): void {
    if (success) {
      this.metrics.notificationsSent[channel]++;
    } else {
      this.metrics.notificationsFailed[channel]++;
    }
  }

  /**
   * Получить текущие метрики
   */
  getMetrics(): Metrics {
    return { ...this.metrics };
  }

  /**
   * Сбросить метрики (для тестов)
   */
  reset(): void {
    this.metrics = {
      orderCreations: 0,
      orderCreationErrors: 0,
      averageOrderCreationTime: 0,
      supabaseSaveSuccesses: 0,
      supabaseSaveErrors: 0,
      webhookValidations: 0,
      webhookRejections: 0,
      notificationsSent: {
        telegram: 0,
        intercom: 0,
        email: 0
      },
      notificationsFailed: {
        telegram: 0,
        intercom: 0,
        email: 0
      },
      orderCreationSuccessRate: 100,
      supabaseSaveSuccessRate: 100
    };
    this.orderCreationTimes = [];
  }
}

export const metricsCollector = new MetricsCollector();
