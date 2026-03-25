/**
 * 🔥 Hot Reload Manager для динамического обновления конфигурации
 * Позволяет обновлять конфигурацию без перезапуска приложения
 */

import { configManager, ConfigData } from './config-manager';

export interface HotReloadOptions {
  interval?: number;           // Интервал проверки (по умолчанию 30 секунд)
  autoReload?: boolean;        // Автоматическая перезагрузка при изменениях
  showNotifications?: boolean; // Показывать уведомления о изменениях
  debug?: boolean;             // Режим отладки
}

export class HotReloadManager {
  private static instance: HotReloadManager;
  private options: HotReloadOptions;
  private interval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private lastConfigHash: string | null = null;
  private listeners: Array<(config: ConfigData) => void> = [];

  private constructor(options: HotReloadOptions = {}) {
    this.options = {
      interval: 30000,        // 30 секунд
      autoReload: false,      // ❌ ОТКЛЮЧЕНО: React сам обновляет компоненты через hooks
      showNotifications: false, // ❌ ОТКЛЮЧЕНО: Не нужны нативные уведомления
      debug: false,           // Режим отладки
      ...options
    };
  }

  static getInstance(options?: HotReloadOptions): HotReloadManager {
    if (!HotReloadManager.instance) {
      HotReloadManager.instance = new HotReloadManager(options);
    }
    return HotReloadManager.instance;
  }

  /**
   * Запустить hot reload
   */
  start(): void {
    if (this.isRunning) {
      console.warn('⚠️ Hot reload is already running');
      return;
    }

    this.isRunning = true;
    this.log('🔥 Starting hot reload manager...');

    // Подписываемся на изменения конфигурации
    configManager.subscribe((config) => {
      this.handleConfigChange(config);
    });

    // Запускаем периодическую проверку
    this.interval = setInterval(async () => {
      try {
        await this.checkForUpdates();
      } catch (error) {
        this.log('❌ Hot reload check error:', error);
      }
    }, this.options.interval!);

    this.log('✅ Hot reload manager started');
  }

  /**
   * Остановить hot reload
   */
  stop(): void {
    if (!this.isRunning) {
      console.warn('⚠️ Hot reload is not running');
      return;
    }

    this.isRunning = false;
    this.log('⏹️ Stopping hot reload manager...');

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    this.log('✅ Hot reload manager stopped');
  }

  /**
   * Проверить обновления
   */
  private async checkForUpdates(): Promise<void> {
    try {
      const hasUpdates = await configManager.checkForUpdates();
      
      if (hasUpdates) {
        this.log('🔄 Configuration updates detected');
        this.handleConfigChange(configManager.getConfig()!);
      }
    } catch (error) {
      this.log('❌ Error checking for updates:', error);
    }
  }

  /**
   * Обработать изменения конфигурации
   */
  private handleConfigChange(config: ConfigData): void {
    if (!config) return;

    // Вычисляем хеш конфигурации для отслеживания изменений
    const configHash = this.calculateConfigHash(config);
    
    if (this.lastConfigHash && this.lastConfigHash === configHash) {
      this.log('📊 Configuration unchanged, skipping update');
      return;
    }

    this.log('🔄 Configuration changed, processing update...');
    this.lastConfigHash = configHash;

    // Уведомляем слушателей (React hooks обновят компоненты автоматически)
    this.notifyListeners(config);

    // ✅ НЕ перезагружаем страницу - React обновится сам через hooks
    // Показываем уведомление только в режиме debug
    if (this.options.showNotifications && this.options.debug) {
      this.showNotification('Configuration updated', 'Your application configuration has been refreshed');
    }

    // ❌ Автоматическая перезагрузка ОТКЛЮЧЕНА
    // React hooks (useCantonPrices, useConfig) обновят компоненты автоматически
    if (this.options.autoReload) {
      this.log('⚠️ Auto-reload is enabled, but page reload is disabled. Use React hooks for updates.');
    }

    this.log('✅ Configuration update processed - React components will update via hooks');
  }

  /**
   * Вычислить хеш конфигурации
   * ✅ ИСПРАВЛЕНО: Игнорируем timestamp и version для правильного сравнения
   */
  private calculateConfigHash(config: ConfigData): string {
    // Создаём объект только с важными полями (без timestamp и version)
    const relevantConfig = {
      cantonCoinBuyPrice: config.cantonCoinBuyPrice,
      cantonCoinSellPrice: config.cantonCoinSellPrice,
      cantonCoinPrice: config.cantonCoinPrice,
      minUsdtAmount: config.minUsdtAmount,
      maxUsdtAmount: config.maxUsdtAmount,
      minCantonAmount: config.minCantonAmount,
      maxCantonAmount: config.maxCantonAmount,
      businessHours: config.businessHours,
      supportEmail: config.supportEmail,
      telegramBotUsername: config.telegramBotUsername,
      // Исключаем: lastUpdate, version - они всегда разные!
    };
    
    const configString = JSON.stringify(relevantConfig, null, 0);
    // Используем Buffer для Node.js совместимости
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(configString).toString('base64').slice(0, 16);
    }
    // Fallback для браузера
    if (typeof btoa !== 'undefined') {
      return btoa(configString).slice(0, 16);
    }
    // Простой хеш если ничего не доступно
    return configString.slice(0, 16);
  }

  /**
   * Перезагрузить приложение
   */
  private reloadApplication(): void {
    try {
      // Мягкая перезагрузка страницы
      if (typeof window !== 'undefined' && typeof window.location !== 'undefined') {
        window.location.reload();
      }
    } catch (error) {
      this.log('❌ Error reloading application:', error);
    }
  }

  /**
   * Показать уведомление
   */
  private showNotification(title: string, message: string): void {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification(title, {
            body: message,
            icon: '/favicon.ico'
          });
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
              new Notification(title, {
                body: message,
                icon: '/favicon.ico'
              });
            }
          });
        }
      }
    } catch (error) {
      this.log('❌ Error showing notification:', error);
    }
  }

  /**
   * Подписаться на изменения конфигурации
   */
  subscribe(listener: (config: ConfigData) => void): () => void {
    this.listeners.push(listener);
    
    // Возвращаем функцию отписки
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Уведомить слушателей
   */
  private notifyListeners(config: ConfigData): void {
    this.listeners.forEach(listener => {
      try {
        listener(config);
      } catch (error) {
        this.log('❌ Error notifying listener:', error);
      }
    });
  }

  /**
   * Получить статус hot reload
   */
  getStatus(): {
    isRunning: boolean;
    interval: number;
    lastConfigHash: string | null;
    listenersCount: number;
  } {
    return {
      isRunning: this.isRunning,
      interval: this.options.interval!,
      lastConfigHash: this.lastConfigHash,
      listenersCount: this.listeners.length
    };
  }

  /**
   * Обновить опции
   */
  updateOptions(newOptions: Partial<HotReloadOptions>): void {
    this.options = { ...this.options, ...newOptions };
    
    if (this.isRunning && newOptions.interval) {
      this.stop();
      this.start();
    }
    
    this.log('⚙️ Hot reload options updated:', this.options);
  }

  /**
   * Логирование
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.options.debug) {
      console.log(`[HotReload] ${message}`, ...args);
    }
  }
}

// Экспортируем singleton instance
export const hotReloadManager = HotReloadManager.getInstance();
