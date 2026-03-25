/**
 * Intent Tracker
 * Система отслеживания статуса NEAR Intents
 */

import { getIntentStatus } from './near-intents'

export interface IntentRecord {
  id: string
  type: 'swap' | 'bridge'
  status: 'pending' | 'filled' | 'expired' | 'cancelled'
  fromToken?: string
  toToken?: string
  fromChain?: string
  toChain?: string
  amount: number
  transactionHash?: string
  createdAt: number
  filledAt?: number
  expiryAt?: number
}

export type IntentStatusCallback = (record: IntentRecord) => void

class IntentTracker {
  private trackingInterval: NodeJS.Timeout | null = null
  private trackedIntents: Map<string, IntentRecord> = new Map()
  private callbacks: Map<string, IntentStatusCallback[]> = new Map()
  private readonly POLL_INTERVAL = 10000 // 10 секунд

  /**
   * Начинает отслеживание intent
   */
  startTracking(record: IntentRecord, callback?: IntentStatusCallback) {
    this.trackedIntents.set(record.id, record)
    
    if (callback) {
      const callbacks = this.callbacks.get(record.id) || []
      callbacks.push(callback)
      this.callbacks.set(record.id, callbacks)
    }
    
    // Запускаем polling если еще не запущен
    if (!this.trackingInterval) {
      this.startPolling()
    }
  }

  /**
   * Останавливает отслеживание intent
   */
  stopTracking(intentId: string) {
    this.trackedIntents.delete(intentId)
    this.callbacks.delete(intentId)
    
    // Останавливаем polling если нет активных intents
    if (this.trackedIntents.size === 0 && this.trackingInterval) {
      clearInterval(this.trackingInterval)
      this.trackingInterval = null
    }
  }

  /**
   * Получает текущую запись intent
   */
  getRecord(intentId: string): IntentRecord | undefined {
    return this.trackedIntents.get(intentId)
  }

  /**
   * Получает все активные intents
   */
  getActiveIntents(): IntentRecord[] {
    return Array.from(this.trackedIntents.values())
  }

  /**
   * Сохраняет intent в localStorage
   */
  saveToLocalStorage(record: IntentRecord) {
    try {
      const saved = this.loadFromLocalStorage()
      const index = saved.findIndex(r => r.id === record.id)
      
      if (index >= 0) {
        saved[index] = record
      } else {
        saved.push(record)
      }
      
      localStorage.setItem('near_intents_history', JSON.stringify(saved))
    } catch (error) {
      console.error('Error saving intent to localStorage:', error)
    }
  }

  /**
   * Загружает историю intents из localStorage
   */
  loadFromLocalStorage(): IntentRecord[] {
    try {
      const saved = localStorage.getItem('near_intents_history')
      if (!saved) {
        return []
      }
      return JSON.parse(saved)
    } catch (error) {
      console.error('Error loading intent history:', error)
      return []
    }
  }

  /**
   * Очищает старые записи из истории (старше 30 дней)
   */
  cleanupOldRecords() {
    try {
      const saved = this.loadFromLocalStorage()
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
      const filtered = saved.filter(r => r.createdAt > thirtyDaysAgo)
      localStorage.setItem('near_intents_history', JSON.stringify(filtered))
    } catch (error) {
      console.error('Error cleaning up old records:', error)
    }
  }

  /**
   * Запускает polling для проверки статуса intents
   */
  private startPolling() {
    this.trackingInterval = setInterval(async () => {
      await this.pollIntents()
    }, this.POLL_INTERVAL)
  }

  /**
   * Проверяет статус всех отслеживаемых intents
   */
  private async pollIntents() {
    const pendingIntents = Array.from(this.trackedIntents.values()).filter(
      r => r.status === 'pending'
    )
    
    for (const record of pendingIntents) {
      try {
        const statusData = await getIntentStatus(record.id)
        
        if (statusData.status !== record.status) {
          // Обновляем запись
          const updatedRecord: IntentRecord = {
            ...record,
            status: statusData.status,
            transactionHash: statusData.transactionHash,
            filledAt: statusData.status === 'filled' ? Date.now() : record.filledAt,
            expiryAt: statusData.expiryAt || record.expiryAt,
          }
          
          this.trackedIntents.set(record.id, updatedRecord)
          this.saveToLocalStorage(updatedRecord)
          
          // Вызываем callbacks
          const callbacks = this.callbacks.get(record.id)
          if (callbacks) {
            callbacks.forEach(cb => cb(updatedRecord))
          }
        }
      } catch (error) {
        console.error(`Error polling intent ${record.id}:`, error)
      }
    }
  }

  /**
   * Останавливает весь трекинг
   */
  stopAll() {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval)
      this.trackingInterval = null
    }
    this.trackedIntents.clear()
    this.callbacks.clear()
  }
}

// Singleton instance
export const intentTracker = new IntentTracker()

// Очищаем старые записи при загрузке модуля
if (typeof window !== 'undefined') {
  intentTracker.cleanupOldRecords()
}

