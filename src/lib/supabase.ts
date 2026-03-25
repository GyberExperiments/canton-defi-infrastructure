/**
 * Supabase Client for 1OTC DEX
 * Production-ready configuration
 */

import { createClient } from '@supabase/supabase-js'

// Types
export type IntentStatus = 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled' | 'expired'
export type IntentType = 'swap' | 'bridge'
export type ChainId = 'NEAR' | 'Ethereum' | 'BSC' | 'Polygon' | 'Aurora'

export interface Intent {
  id: string
  user_account: string
  user_wallet_address?: string
  intent_type: IntentType
  from_token: string
  to_token: string
  from_chain: ChainId
  to_chain: ChainId
  amount: string
  min_receive: string
  actual_received?: string
  status: IntentStatus
  solver_account?: string
  solver_profit?: string
  tx_hash?: string
  block_height?: number
  deadline: string
  created_at: string
  executed_at?: string
  completed_at?: string
  metadata?: any
  price_quote?: any
  failure_reason?: string
}

export interface SolverStats {
  id: number
  solver_account: string
  total_intents_executed: number
  total_intents_failed: number
  total_profit_usd: string
  total_gas_spent_near: string
  avg_execution_time_seconds?: string
  success_rate?: string
  reputation_score: number
  first_seen_at: string
  last_active_at: string
  metadata?: any
}

export interface PriceHistory {
  id: number
  from_token: string
  to_token: string
  price: string
  source: string
  volume_24h?: string
  timestamp: string
  raw_data?: any
}

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://api.1otc.cc'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Client для frontend (использует anon key)
// Создаем только если ключ доступен, иначе используем заглушку
export const supabase = supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : createClient(supabaseUrl, 'dummy-key-for-build', {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

// Admin client для backend/solver (использует service_role key)
export const supabaseAdmin = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : createClient(supabaseUrl, 'dummy-key-for-build', {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

/**
 * Intent Operations
 */
export const intentOperations = {
  /**
   * Создать новый intent
   */
  async create(data: Omit<Intent, 'id' | 'created_at' | 'status'>) {
    const { data: intent, error } = await supabase
      .from('intents')
      .insert(data)
      .select()
      .single()

    if (error) throw error
    return intent as Intent
  },

  /**
   * Получить intent по ID
   */
  async getById(intentId: string) {
    const { data, error } = await supabase
      .from('intents')
      .select('*')
      .eq('id', intentId)
      .single()

    if (error) throw error
    return data as Intent
  },

  /**
   * Получить pending intents (для solver)
   */
  async getPending(limit = 100) {
    const { data, error } = await supabaseAdmin
      .from('v_pending_intents')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) throw error
    return data as Intent[]
  },

  /**
   * Получить intents пользователя
   */
  async getByUser(userAccount: string, options?: {
    status?: IntentStatus
    limit?: number
    offset?: number
  }) {
    let query = supabase
      .from('intents')
      .select('*')
      .eq('user_account', userAccount)

    if (options?.status) {
      query = query.eq('status', options.status)
    }

    query = query
      .order('created_at', { ascending: false })
      .limit(options?.limit || 50)

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1)
    }

    const { data, error } = await query

    if (error) throw error
    return data as Intent[]
  },

  /**
   * Обновить статус intent (solver only)
   */
  async updateStatus(
    intentId: string,
    status: IntentStatus,
    updates?: Partial<Intent>
  ) {
    const { data, error } = await supabaseAdmin
      .from('intents')
      .update({
        status,
        ...updates,
      })
      .eq('id', intentId)
      .select()
      .single()

    if (error) throw error
    return data as Intent
  },

  /**
   * Subscribe к изменениям intent
   */
  subscribeToIntent(intentId: string, callback: (intent: Intent) => void) {
    return supabase
      .channel(`intent:${intentId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'intents',
          filter: `id=eq.${intentId}`,
        },
        (payload: any) => {
          callback(payload.new as Intent)
        }
      )
      .subscribe()
  },

  /**
   * Subscribe к pending intents (для solver)
   */
  subscribeToPending(callback: (intent: Intent) => void) {
    return supabaseAdmin
      .channel('pending_intents')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'intents',
          filter: 'status=eq.pending',
        },
        (payload: any) => {
          callback(payload.new as Intent)
        }
      )
      .subscribe()
  },
}

/**
 * Solver Stats Operations
 */
export const solverOperations = {
  /**
   * Получить статистику solver
   */
  async getStats(solverAccount: string) {
    const { data, error } = await supabase
      .from('solver_stats')
      .select('*')
      .eq('solver_account', solverAccount)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw error
    }
    return data as SolverStats
  },

  /**
   * Получить leaderboard
   */
  async getLeaderboard(limit = 10) {
    const { data, error } = await supabase
      .from('v_solver_leaderboard')
      .select('*')
      .limit(limit)

    if (error) throw error
    return data
  },
}

/**
 * Price History Operations
 */
export const priceOperations = {
  /**
   * Сохранить price quote
   */
  async savePriceQuote(
    fromToken: string,
    toToken: string,
    price: string,
    source: string,
    metadata?: any
  ) {
    const { data, error } = await supabaseAdmin
      .from('price_history')
      .insert({
        from_token: fromToken,
        to_token: toToken,
        price,
        source,
        raw_data: metadata,
      })
      .select()
      .single()

    if (error) throw error
    return data as PriceHistory
  },

  /**
   * Получить последнюю цену
   */
  async getLatestPrice(fromToken: string, toToken: string) {
    const { data, error } = await supabase
      .from('price_history')
      .select('*')
      .eq('from_token', fromToken)
      .eq('to_token', toToken)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return data as PriceHistory
  },

  /**
   * Получить historical prices
   */
  async getHistory(
    fromToken: string,
    toToken: string,
    options?: {
      from?: Date
      to?: Date
      limit?: number
    }
  ) {
    let query = supabase
      .from('price_history')
      .select('*')
      .eq('from_token', fromToken)
      .eq('to_token', toToken)
      .order('timestamp', { ascending: false })

    if (options?.from) {
      query = query.gte('timestamp', options.from.toISOString())
    }

    if (options?.to) {
      query = query.lte('timestamp', options.to.toISOString())
    }

    query = query.limit(options?.limit || 100)

    const { data, error } = await query

    if (error) throw error
    return data as PriceHistory[]
  },
}

/**
 * Limit Order Operations
 */
export interface LimitOrder {
  id: string
  user_account: string
  from_token: string
  to_token: string
  from_chain: ChainId
  to_chain: ChainId
  amount: string
  target_price: string
  status: 'pending' | 'filled' | 'cancelled' | 'expired'
  filled_price?: string
  filled_at?: string
  intent_id?: string
  expires_at?: string
  created_at: string
  metadata?: any
}

export const limitOrderOperations = {
  /**
   * Создать limit order
   */
  async create(data: Omit<LimitOrder, 'id' | 'created_at' | 'status'>) {
    const { data: order, error } = await supabase
      .from('limit_orders')
      .insert({ ...data, status: 'pending' })
      .select()
      .single()

    if (error) throw error
    return order as LimitOrder
  },

  /**
   * Получить limit orders пользователя
   */
  async getByUser(userAccount: string, options?: {
    status?: LimitOrder['status']
    limit?: number
  }) {
    let query = supabase
      .from('limit_orders')
      .select('*')
      .eq('user_account', userAccount)
      .order('created_at', { ascending: false })

    if (options?.status) {
      query = query.eq('status', options.status)
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    const { data, error } = await query
    if (error) throw error
    return data as LimitOrder[]
  },

  /**
   * Получить активные limit orders (для автоматического исполнения)
   */
  async getActive() {
    const { data, error } = await supabaseAdmin
      .from('v_active_limit_orders')
      .select('*')

    if (error) throw error
    return data as LimitOrder[]
  },

  /**
   * Обновить статус limit order
   */
  async updateStatus(orderId: string, status: LimitOrder['status'], updates?: Partial<LimitOrder>) {
    const { data, error } = await supabase
      .from('limit_orders')
      .update({ status, ...updates })
      .eq('id', orderId)
      .select()
      .single()

    if (error) throw error
    return data as LimitOrder
  },

  /**
   * Отменить limit order
   */
  async cancel(orderId: string) {
    return this.updateStatus(orderId, 'cancelled')
  },
}

/**
 * Price Alert Operations
 */
export interface PriceAlert {
  id: string
  user_account: string
  token: string
  target_price: string
  condition: 'above' | 'below'
  is_active: boolean
  triggered: boolean
  triggered_at?: string
  triggered_price?: string
  notify_email: boolean
  notify_push: boolean
  notify_telegram: boolean
  created_at: string
  expires_at?: string
  metadata?: any
}

export const priceAlertOperations = {
  /**
   * Создать price alert
   */
  async create(data: Omit<PriceAlert, 'id' | 'created_at' | 'is_active' | 'triggered'>) {
    const { data: alert, error } = await supabase
      .from('price_alerts')
      .insert({ ...data, is_active: true, triggered: false })
      .select()
      .single()

    if (error) throw error
    return alert as PriceAlert
  },

  /**
   * Получить alerts пользователя
   */
  async getByUser(userAccount: string, options?: {
    is_active?: boolean
    triggered?: boolean
  }) {
    let query = supabase
      .from('price_alerts')
      .select('*')
      .eq('user_account', userAccount)
      .order('created_at', { ascending: false })

    if (options?.is_active !== undefined) {
      query = query.eq('is_active', options.is_active)
    }

    if (options?.triggered !== undefined) {
      query = query.eq('triggered', options.triggered)
    }

    const { data, error } = await query
    if (error) throw error
    return data as PriceAlert[]
  },

  /**
   * Обновить alert
   */
  async update(alertId: string, updates: Partial<PriceAlert>) {
    const { data, error } = await supabase
      .from('price_alerts')
      .update(updates)
      .eq('id', alertId)
      .select()
      .single()

    if (error) throw error
    return data as PriceAlert
  },

  /**
   * Удалить alert
   */
  async delete(alertId: string) {
    const { error } = await supabase
      .from('price_alerts')
      .delete()
      .eq('id', alertId)

    if (error) throw error
  },

  /**
   * Переключить активность alert
   */
  async toggleActive(alertId: string, isActive: boolean) {
    return this.update(alertId, { is_active: isActive })
  },
}

/**
 * Portfolio Operations
 */
export interface PortfolioSnapshot {
  id: number
  user_account: string
  tokens: Record<string, string> // { "NEAR": "100", "USDT": "500" }
  total_usd_value: string
  change_24h?: string
  change_24h_percent?: string
  snapshot_at: string
}

export const portfolioOperations = {
  /**
   * Создать snapshot портфеля
   */
  async createSnapshot(userAccount: string, tokens: Record<string, string>, totalUsdValue: number) {
    const { data, error } = await supabaseAdmin
      .from('portfolio_snapshots')
      .insert({
        user_account: userAccount,
        tokens,
        total_usd_value: totalUsdValue.toString(),
      })
      .select()
      .single()

    if (error) throw error
    return data as PortfolioSnapshot
  },

  /**
   * Получить последний snapshot
   */
  async getLatestSnapshot(userAccount: string) {
    const { data, error } = await supabase
      .from('portfolio_snapshots')
      .select('*')
      .eq('user_account', userAccount)
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return data as PortfolioSnapshot
  },

  /**
   * Получить историю snapshots
   */
  async getHistory(userAccount: string, options?: {
    from?: Date
    to?: Date
    limit?: number
  }) {
    let query = supabase
      .from('portfolio_snapshots')
      .select('*')
      .eq('user_account', userAccount)
      .order('snapshot_at', { ascending: false })

    if (options?.from) {
      query = query.gte('snapshot_at', options.from.toISOString())
    }

    if (options?.to) {
      query = query.lte('snapshot_at', options.to.toISOString())
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    const { data, error } = await query
    if (error) throw error
    return data as PortfolioSnapshot[]
  },
}

/**
 * Utility функции
 */
export const utils = {
  /**
   * Истечь старые pending intents
   */
  async expireOldIntents() {
    const { data, error } = await supabaseAdmin.rpc('expire_old_intents')
    if (error) throw error
    return data
  },

  /**
   * Получить статистику пользователя
   */
  async getUserStats(userAccount: string) {
    const { data, error } = await supabase
      .from('v_user_stats')
      .select('*')
      .eq('user_account', userAccount)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return data
  },

  /**
   * Проверить price alerts (для background job)
   */
  async checkPriceAlerts() {
    const { data, error } = await supabaseAdmin.rpc('check_price_alerts')
    if (error) throw error
    return data as number
  },
}

// Export все operations
export default {
  intents: intentOperations,
  solvers: solverOperations,
  prices: priceOperations,
  limitOrders: limitOrderOperations,
  priceAlerts: priceAlertOperations,
  portfolio: portfolioOperations,
  utils,
}

