/**
 * 🏗️ Unified Configuration System
 * Единая система управления конфигурацией с поддержкой:
 * - Hot reload из API
 * - Fallback на переменные окружения  
 * - Интеллектуальное кеширование
 * - Type safety
 * - Subscription model для real-time обновлений
 */

import React from 'react';
import { Redis } from 'ioredis';
import { EventEmitter } from 'events';

export interface ConfigData {
  // Цены
  CANTON_COIN_BUY_PRICE_USD: string;
  CANTON_COIN_SELL_PRICE_USD: string;
  
  // Лимиты
  MIN_USDT_AMOUNT: string;
  MAX_USDT_AMOUNT: string;
  MIN_CANTON_AMOUNT: string;
  MAX_CANTON_AMOUNT: string;
  
  // Бизнес настройки
  BUSINESS_HOURS: string;
  SUPPORT_EMAIL: string;
  TELEGRAM_BOT_USERNAME: string;
  
  // Feature flags
  EMAIL_SERVICE_ENABLED: boolean;
  TELEGRAM_SERVICE_ENABLED: boolean;
  SPAM_DETECTION_ENABLED: boolean;
  MONITORING_ENABLED: boolean;
}

export interface ConfigSource {
  name: string;
  priority: number;
  fetch(): Promise<Partial<ConfigData>>;
  isAvailable(): Promise<boolean>;
}

// Source 1: API Configuration
class APIConfigSource implements ConfigSource {
  name = 'API';
  priority = 100; // Highest priority
  
  async fetch(): Promise<Partial<ConfigData>> {
    try {
      const response = await fetch('/api/admin/config', {
        cache: 'no-cache',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`API config failed: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.warn('API config source failed:', error);
      return {};
    }
  }
  
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch('/api/health', { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Source 2: Environment Variables
class EnvironmentConfigSource implements ConfigSource {
  name = 'ENV';
  priority = 50; // Lower priority
  
  async fetch(): Promise<Partial<ConfigData>> {
    return {
      CANTON_COIN_BUY_PRICE_USD: process.env.CANTON_COIN_BUY_PRICE_USD || '0.77',
      CANTON_COIN_SELL_PRICE_USD: process.env.CANTON_COIN_SELL_PRICE_USD || '0.22',
      MIN_USDT_AMOUNT: process.env.MIN_USDT_AMOUNT || '1',
      MAX_USDT_AMOUNT: process.env.MAX_USDT_AMOUNT || '',
      MIN_CANTON_AMOUNT: process.env.MIN_CANTON_AMOUNT || '4',
      MAX_CANTON_AMOUNT: process.env.MAX_CANTON_AMOUNT || '',
      BUSINESS_HOURS: process.env.BUSINESS_HOURS || '8:00 AM - 10:00 PM (GMT+8)',
      SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || 'support@1otc.cc',
      TELEGRAM_BOT_USERNAME: process.env.TELEGRAM_BOT_USERNAME || '@CantonOTC_Bot',
      EMAIL_SERVICE_ENABLED: process.env.EMAIL_SERVICE_ENABLED === 'true',
      TELEGRAM_SERVICE_ENABLED: process.env.TELEGRAM_SERVICE_ENABLED === 'true',
      SPAM_DETECTION_ENABLED: process.env.SPAM_DETECTION_ENABLED !== 'false',
      MONITORING_ENABLED: process.env.MONITORING_ENABLED !== 'false',
    };
  }
  
  async isAvailable(): Promise<boolean> {
    return true; // Always available
  }
}

// Source 3: Redis Cache
class RedisConfigSource implements ConfigSource {
  name = 'REDIS_CACHE';
  priority = 75; // Medium priority
  
  constructor(private redis?: Redis) {}
  
  async fetch(): Promise<Partial<ConfigData>> {
    if (!this.redis) return {};
    
    try {
      const cached = await this.redis.get('config:unified');
      return cached ? JSON.parse(cached) : {};
    } catch (error) {
      console.warn('Redis config source failed:', error);
      return {};
    }
  }
  
  async isAvailable(): Promise<boolean> {
    if (!this.redis) return false;
    try {
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }
  
  async save(config: ConfigData, ttl = 300): Promise<void> {
    if (!this.redis) return;
    
    try {
      await this.redis.setex('config:unified', ttl, JSON.stringify(config));
    } catch (error) {
      console.warn('Failed to cache config to Redis:', error);
    }
  }
}

export class UnifiedConfigManager extends EventEmitter {
  private static instance: UnifiedConfigManager;
  private sources: ConfigSource[] = [];
  private currentConfig: ConfigData | null = null;
  private lastFetch = 0;
  private cacheTTL = 5 * 60 * 1000; // 5 minutes
  private refreshInterval?: NodeJS.Timeout;
  private redis?: Redis;
  
  private constructor() {
    super();
    this.setupSources();
    this.startAutoRefresh();
  }
  
  static getInstance(): UnifiedConfigManager {
    if (!UnifiedConfigManager.instance) {
      UnifiedConfigManager.instance = new UnifiedConfigManager();
    }
    return UnifiedConfigManager.instance;
  }
  
  private setupSources(): void {
    // Setup Redis if available
    try {
      if (process.env.REDIS_URL) {
        this.redis = new Redis(process.env.REDIS_URL);
      }
    } catch (error) {
      console.warn('Redis not available for config cache:', error);
    }
    
    // Add sources in priority order (highest first)
    this.sources = [
      new APIConfigSource(),
      new RedisConfigSource(this.redis),
      new EnvironmentConfigSource(),
    ].sort((a, b) => b.priority - a.priority);
  }
  
  async getConfig(): Promise<ConfigData> {
    const now = Date.now();
    
    // Return cached if fresh
    if (this.currentConfig && (now - this.lastFetch) < this.cacheTTL) {
      return this.currentConfig;
    }
    
    // Refresh config
    await this.refreshConfig();
    
    if (!this.currentConfig) {
      throw new Error('Failed to load configuration from all sources');
    }
    
    return this.currentConfig;
  }
  
  private async refreshConfig(): Promise<void> {
    const mergedConfig: Partial<ConfigData> = {};
    const availableSources: string[] = [];
    
    // Try each source in priority order
    for (const source of this.sources) {
      try {
        if (await source.isAvailable()) {
          const sourceConfig = await source.fetch();
          
          // Merge with lower priority config (higher priority overwrites)
          Object.assign(mergedConfig, sourceConfig);
          availableSources.push(source.name);
          
          // If we have a complete config from high-priority source, we can stop
          if (source.priority >= 100 && this.isCompleteConfig(sourceConfig)) {
            break;
          }
        }
      } catch (error) {
        console.warn(`Config source ${source.name} failed:`, error);
      }
    }
    
    // Validate we have required config
    if (!this.isCompleteConfig(mergedConfig)) {
      console.error('Incomplete configuration loaded:', {
        available: availableSources,
        config: mergedConfig
      });
    }
    
    const newConfig = this.fillDefaults(mergedConfig);
    const oldConfig = this.currentConfig;
    
    this.currentConfig = newConfig;
    this.lastFetch = Date.now();
    
    // Cache to Redis if available
    const redisSource = this.sources.find(s => s.name === 'REDIS_CACHE') as RedisConfigSource;
    if (redisSource) {
      await redisSource.save(newConfig, this.cacheTTL / 1000);
    }
    
    // Emit change event if config changed
    if (!oldConfig || JSON.stringify(oldConfig) !== JSON.stringify(newConfig)) {
      this.emit('configChanged', {
        old: oldConfig,
        new: newConfig,
        sources: availableSources
      });
      
      console.info('🔄 Configuration updated', {
        sources: availableSources,
        changes: this.getConfigDiff(oldConfig, newConfig)
      });
    }
  }
  
  private isCompleteConfig(config: Partial<ConfigData>): config is ConfigData {
    const required = [
      'CANTON_COIN_BUY_PRICE_USD',
      'CANTON_COIN_SELL_PRICE_USD',
      'MIN_USDT_AMOUNT',
      'SUPPORT_EMAIL'
    ];
    
    return required.every(key => key in config);
  }
  
  private fillDefaults(config: Partial<ConfigData>): ConfigData {
    return {
      CANTON_COIN_BUY_PRICE_USD: '0.77',
      CANTON_COIN_SELL_PRICE_USD: '0.22',
      MIN_USDT_AMOUNT: '1',
      MAX_USDT_AMOUNT: '',
      MIN_CANTON_AMOUNT: '4',
      MAX_CANTON_AMOUNT: '',
      BUSINESS_HOURS: '8:00 AM - 10:00 PM (GMT+8)',
      SUPPORT_EMAIL: 'support@1otc.cc',
      TELEGRAM_BOT_USERNAME: '@CantonOTC_Bot',
      EMAIL_SERVICE_ENABLED: true,
      TELEGRAM_SERVICE_ENABLED: true,
      SPAM_DETECTION_ENABLED: true,
      MONITORING_ENABLED: true,
      ...config
    };
  }
  
  private getConfigDiff(old: ConfigData | null, current: ConfigData): Record<string, {old: unknown, new: unknown}> {
    const diff: Record<string, {old: unknown, new: unknown}> = {};
    
    if (!old) return diff;
    
    for (const [key, value] of Object.entries(current)) {
      if (old[key as keyof ConfigData] !== value) {
        diff[key] = {
          old: old[key as keyof ConfigData],
          new: value
        };
      }
    }
    
    return diff;
  }
  
  private startAutoRefresh(): void {
    // Refresh every 5 minutes
    this.refreshInterval = setInterval(async () => {
      try {
        await this.refreshConfig();
      } catch (error) {
        console.error('Auto-refresh config failed:', error);
      }
    }, this.cacheTTL);
  }
  
  // Manual refresh method
  async refresh(): Promise<void> {
    this.lastFetch = 0; // Force refresh
    await this.refreshConfig();
  }
  
  // Get specific config value with type safety
  get<K extends keyof ConfigData>(key: K, defaultValue?: ConfigData[K]): ConfigData[K] {
    if (!this.currentConfig) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`Config not loaded and no default provided for ${key}`);
    }
    
    const value = this.currentConfig[key];
    return value !== undefined ? value : (defaultValue as ConfigData[K]);
  }
  
  // Subscribe to config changes
  onConfigChanged(callback: (event: {old: ConfigData | null, new: ConfigData, sources: string[]}) => void): () => void {
    this.on('configChanged', callback);
    return () => this.removeListener('configChanged', callback);
  }
  
  // Cleanup
  destroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    
    if (this.redis) {
      this.redis.disconnect();
    }
    
    this.removeAllListeners();
  }
}

// Export singleton instance
export const unifiedConfig = UnifiedConfigManager.getInstance();

// Export React hook for components
export function useUnifiedConfig() {
  const [config, setConfig] = React.useState<ConfigData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  
  React.useEffect(() => {
    let mounted = true;
    
    const loadConfig = async () => {
      try {
        const newConfig = await unifiedConfig.getConfig();
        if (mounted) {
          setConfig(newConfig);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load config');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    
    // Subscribe to changes
    const unsubscribe = unifiedConfig.onConfigChanged(({ new: newConfig }) => {
      if (mounted) {
        setConfig(newConfig);
        setError(null);
      }
    });
    
    loadConfig();
    
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);
  
  return {
    config,
    loading,
    error,
    refresh: () => unifiedConfig.refresh()
  };
}
