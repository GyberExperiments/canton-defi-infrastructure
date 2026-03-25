/**
 * 📊 Admin API - Statistics
 * Реальная статистика из Google Sheets для дашборда
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { googleSheetsService } from '@/lib/services/googleSheets';

// Принудительно делаем route динамическим
export const dynamic = 'force-dynamic';

/**
 * GET - Получить статистику
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stats = await googleSheetsService.getStatistics();

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Admin API - Get stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}

