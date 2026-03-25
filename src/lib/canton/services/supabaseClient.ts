'use client';

/**
 * 🔥 SUPABASE CLIENT для Canton Wealth Platform
 * 
 * Клиент для работы с Supabase (treasury_bills, purchase_requests, treasury_holdings)
 * Используется для persistence в TreasuryBillsService
 */

import { createClient } from '@supabase/supabase-js';

// Конфигурация из окружения
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Серверный клиент с service role key для admin операций
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Проверка конфигурации
const isConfigured = Boolean(supabaseUrl && (supabaseAnonKey || supabaseServiceKey));

if (!isConfigured && process.env.NODE_ENV === 'development') {
  console.warn('⚠️ Supabase not configured - using mock data');
}

/**
 * Публичный клиент (для клиентских операций)
 */
export const supabase = isConfigured && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true
      }
    })
  : null;

/**
 * Сервисный клиент (для server-side операций с elevated permissions)
 */
export const supabaseAdmin = isConfigured && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

/**
 * Проверка доступности Supabase
 */
export async function checkSupabaseHealth(): Promise<boolean> {
  if (!supabase && !supabaseAdmin) {
    return false;
  }
  
  try {
    const client = supabaseAdmin || supabase;
    const { error } = await client!
      .from('treasury_bills')
      .select('bill_id')
      .limit(1)
      .maybeSingle();
    
    return !error;
  } catch {
    return false;
  }
}

/**
 * Флаг - используется ли реальный Supabase
 */
export const isSupabaseConfigured = isConfigured;

export default supabase;
