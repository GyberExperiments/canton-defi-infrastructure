/**
 * 💾 Conversation Context Storage Service
 * Персистентное хранение контекста разговоров между Intercom и Telegram
 * Поддерживает файловое хранилище с возможностью миграции на Redis
 */

import fs from 'fs/promises';
import path from 'path';

export interface ConversationContext {
  orderId: string;
  customerEmail: string;
  customerTelegram?: string;
  intercomConversationId?: string;
  intercomUserId?: string;
  orderAmount?: number;
  orderStatus?: string;
  cantonAddress?: string;
  refundAddress?: string;
  createdAt: number;
  updatedAt: number;
  lastActivity: number;
}

interface ConversationStorageConfig {
  storageType: 'file' | 'redis';
  filePath?: string;
  redisUrl?: string;
  ttl?: number; // Time to live in seconds
}

class ConversationStorageService {
  private config: ConversationStorageConfig;
  private filePath: string;
  private ttl: number;
  private cache = new Map<string, ConversationContext>();
  private cacheExpiry = new Map<string, number>();
  private isFileStorageAvailable = false;

  constructor() {
    this.config = {
      storageType: 'file',
      filePath: process.env.CONVERSATION_STORAGE_PATH || path.join(process.cwd(), 'data', 'conversations.json'),
      ttl: parseInt(process.env.CONVERSATION_TTL_SECONDS || '86400', 10) // 24 hours default
    };
    
    this.filePath = this.config.filePath!;
    this.ttl = this.config.ttl!;
    
    // Инициализируем хранилище асинхронно
    this.initializeStorage().catch(error => {
      console.warn('⚠️ Storage initialization failed, using in-memory fallback:', error);
    });
  }

  /**
   * Инициализация хранилища
   */
  private async initializeStorage(): Promise<void> {
    try {
      // Создаем директорию если не существует
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });
      
      // Загружаем существующие данные
      await this.loadFromFile();
      
      this.isFileStorageAvailable = true;
      console.log('✅ Conversation storage initialized:', {
        type: this.config.storageType,
        path: this.filePath,
        ttl: this.ttl
      });
    } catch (error) {
      this.isFileStorageAvailable = false;
      console.warn('⚠️ File storage unavailable, using in-memory fallback:', error);
      console.log('✅ Conversation storage initialized (in-memory fallback):', {
        type: 'memory',
        ttl: this.ttl
      });
    }
  }

  /**
   * Сохранить контекст разговора
   */
  async saveContext(orderId: string, context: Omit<ConversationContext, 'createdAt' | 'updatedAt' | 'lastActivity'>): Promise<boolean> {
    try {
      const now = Date.now();
      const existingContext = await this.getContext(orderId);
      
      const conversationContext: ConversationContext = {
        ...context,
        createdAt: existingContext?.createdAt || now,
        updatedAt: now,
        lastActivity: now
      };

      // Сохраняем в кэш
      this.cache.set(orderId, conversationContext);
      this.cacheExpiry.set(orderId, now + (this.ttl * 1000));

      // Сохраняем в файл (если доступно)
      if (this.isFileStorageAvailable) {
        try {
          await this.saveToFile();
        } catch (error) {
          console.warn('⚠️ Failed to save to file, using in-memory only:', error);
          this.isFileStorageAvailable = false;
        }
      }

      console.log('💾 Conversation context saved:', {
        orderId,
        customerEmail: context.customerEmail,
        intercomConversationId: context.intercomConversationId,
        cacheSize: this.cache.size
      });

      return true;
    } catch (error) {
      console.error('❌ Failed to save conversation context:', error);
      return false;
    }
  }

  /**
   * Получить контекст разговора
   */
  async getContext(orderId: string): Promise<ConversationContext | null> {
    try {
      // Проверяем кэш
      const cached = this.cache.get(orderId);
      const expiry = this.cacheExpiry.get(orderId);
      
      if (cached && expiry && Date.now() < expiry) {
        return cached;
      }

      // Если в кэше нет или истек, загружаем из файла
      await this.loadFromFile();
      
      const context = this.cache.get(orderId);
      if (context) {
        // Обновляем время активности
        context.lastActivity = Date.now();
        this.cacheExpiry.set(orderId, Date.now() + (this.ttl * 1000));
        await this.saveToFile();
      }

      return context || null;
    } catch (error) {
      console.error('❌ Failed to get conversation context:', error);
      return null;
    }
  }

  /**
   * Удалить контекст разговора
   */
  async deleteContext(orderId: string): Promise<boolean> {
    try {
      this.cache.delete(orderId);
      this.cacheExpiry.delete(orderId);
      await this.saveToFile();

      console.log('🗑️ Conversation context deleted:', orderId);
      return true;
    } catch (error) {
      console.error('❌ Failed to delete conversation context:', error);
      return false;
    }
  }

  /**
   * Обновить время активности
   */
  async updateActivity(orderId: string): Promise<boolean> {
    try {
      const context = await this.getContext(orderId);
      if (!context) {
        return false;
      }

      context.lastActivity = Date.now();
      this.cache.set(orderId, context);
      this.cacheExpiry.set(orderId, Date.now() + (this.ttl * 1000));
      
      await this.saveToFile();
      return true;
    } catch (error) {
      console.error('❌ Failed to update activity:', error);
      return false;
    }
  }

  /**
   * Получить все активные разговоры
   */
  async getActiveConversations(): Promise<ConversationContext[]> {
    try {
      await this.loadFromFile();
      
      const now = Date.now();
      const active: ConversationContext[] = [];
      
      for (const [orderId, context] of this.cache.entries()) {
        const expiry = this.cacheExpiry.get(orderId);
        if (expiry && now < expiry) {
          active.push(context);
        }
      }
      
      return active.sort((a, b) => b.lastActivity - a.lastActivity);
    } catch (error) {
      console.error('❌ Failed to get active conversations:', error);
      return [];
    }
  }

  /**
   * Очистить устаревшие разговоры
   */
  async cleanupExpired(): Promise<number> {
    try {
      const now = Date.now();
      let cleaned = 0;
      
      for (const [orderId, expiry] of this.cacheExpiry.entries()) {
        if (now >= expiry) {
          this.cache.delete(orderId);
          this.cacheExpiry.delete(orderId);
          cleaned++;
        }
      }
      
      if (cleaned > 0) {
        await this.saveToFile();
        console.log(`🧹 Cleaned up ${cleaned} expired conversations`);
      }
      
      return cleaned;
    } catch (error) {
      console.error('❌ Failed to cleanup expired conversations:', error);
      return 0;
    }
  }

  /**
   * Получить статистику
   */
  getStats(): {
    totalConversations: number;
    activeConversations: number;
    expiredConversations: number;
    storageType: string;
  } {
    const now = Date.now();
    let active = 0;
    let expired = 0;
    
    for (const [, expiry] of this.cacheExpiry.entries()) {
      if (now < expiry) {
        active++;
      } else {
        expired++;
      }
    }
    
    return {
      totalConversations: this.cache.size,
      activeConversations: active,
      expiredConversations: expired,
      storageType: this.config.storageType
    };
  }

  /**
   * Сохранить данные в файл
   */
  private async saveToFile(): Promise<void> {
    try {
      const data = {
        conversations: Object.fromEntries(this.cache),
        expiry: Object.fromEntries(this.cacheExpiry),
        metadata: {
          lastSaved: Date.now(),
          version: '1.0.0'
        }
      };
      
      await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      console.error('❌ Failed to save to file:', error);
      throw error;
    }
  }

  /**
   * Загрузить данные из файла
   */
  private async loadFromFile(): Promise<void> {
    try {
      const data = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(data);
      
      if (parsed.conversations) {
        this.cache.clear();
        this.cacheExpiry.clear();
        
        for (const [orderId, context] of Object.entries(parsed.conversations)) {
          this.cache.set(orderId, context as ConversationContext);
        }
        
        if (parsed.expiry) {
          for (const [orderId, expiry] of Object.entries(parsed.expiry)) {
            this.cacheExpiry.set(orderId, expiry as number);
          }
        }
      }
    } catch (error) {
      // Файл не существует или поврежден - это нормально при первом запуске
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('❌ Failed to load from file:', error);
      }
    }
  }

  /**
   * Создать резервную копию
   */
  async createBackup(): Promise<string> {
    try {
      const backupPath = `${this.filePath}.backup.${Date.now()}`;
      await fs.copyFile(this.filePath, backupPath);
      
      console.log('💾 Backup created:', backupPath);
      return backupPath;
    } catch (error) {
      console.error('❌ Failed to create backup:', error);
      throw error;
    }
  }

  /**
   * Восстановить из резервной копии
   */
  async restoreFromBackup(backupPath: string): Promise<boolean> {
    try {
      await fs.copyFile(backupPath, this.filePath);
      await this.loadFromFile();
      
      console.log('🔄 Restored from backup:', backupPath);
      return true;
    } catch (error) {
      console.error('❌ Failed to restore from backup:', error);
      return false;
    }
  }
}

// Export singleton instance
export const conversationStorageService = new ConversationStorageService();
export default conversationStorageService;
