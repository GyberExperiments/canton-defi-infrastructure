/**
 * 📊 Admin API - Customer Analytics
 * Аналитика клиентов и LTV
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { customerService } from '@/lib/services/customerService';

// Принудительно делаем route динамическим
export const dynamic = 'force-dynamic';

/**
 * GET - Получить аналитику клиентов
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const analytics = await customerService.getCustomerAnalytics();

    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Admin API - Get customer analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}

