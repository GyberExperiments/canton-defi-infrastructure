/**
 * 👤 Admin API - Single Customer Profile
 * Получение профиля клиента
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { customerService } from '@/lib/services/customerService';

// Принудительно делаем route динамическим
export const dynamic = 'force-dynamic';

/**
 * GET - Получить профиль клиента
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ email: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const email = decodeURIComponent(params.email);
    const profile = await customerService.getCustomerProfile(email);
    
    if (!profile) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error('Admin API - Get customer error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer' },
      { status: 500 }
    );
  }
}

