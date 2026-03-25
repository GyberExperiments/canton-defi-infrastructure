/**
 * 📊 Admin API - Orders Management
 * CRUD operations для управления заказами
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { googleSheetsService } from '@/lib/services/googleSheets';

// Принудительно делаем route динамическим
export const dynamic = 'force-dynamic';

/**
 * GET - Получить список заказов с фильтрацией и пагинацией
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
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;
    const sortBy = (searchParams.get('sortBy') || 'timestamp') as 'timestamp' | 'usdtAmount';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

    const result = await googleSheetsService.getOrdersPaginated({
      page,
      limit,
      status,
      search,
      sortBy,
      sortOrder
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Admin API - Get orders error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}


