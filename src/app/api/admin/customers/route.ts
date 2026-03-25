/**
 * 👥 Admin API - Customers Management (CRM)
 * Управление клиентами
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { customerService } from '@/lib/services/customerService';

// Принудительно делаем route динамическим
export const dynamic = 'force-dynamic';

/**
 * GET - Получить список клиентов
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const sortBy = (searchParams.get('sortBy') || 'totalVolume') as 'totalVolume' | 'totalOrders' | 'lastOrderDate';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

    const result = await customerService.getAllCustomers({
      page,
      limit,
      sortBy,
      sortOrder
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Admin API - Get customers error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customers' },
      { status: 500 }
    );
  }
}



