/**
 * GET /api/my-orders
 * Получение заявок текущего пользователя
 * Использует RLS для автоматической фильтрации
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Email из query params или auth token
    const email = request.nextUrl.searchParams.get('email');
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter required' },
        { status: 400 }
      );
    }
    
    // Email валидация
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }
    
    // Используем anon key для применения RLS
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // RLS автоматически фильтрует приватные заявки других пользователей
    const { data: orders, error } = await supabase
      .from('public_orders')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching user orders:', error);
      return NextResponse.json(
        { error: 'Failed to fetch orders' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      orders: orders || [],
      count: orders?.length || 0,
      email,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('My orders API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
