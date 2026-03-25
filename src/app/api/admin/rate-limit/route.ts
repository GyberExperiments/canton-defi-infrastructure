import { NextRequest, NextResponse } from 'next/server'
import { rateLimiterService } from '@/lib/services/rateLimiter'

// Принудительно делаем route динамическим
export const dynamic = 'force-dynamic';

/**
 * 🛡️ Admin Rate Limit API
 * GET: получить состояние лимитов по ip/email
 * POST: сбросить лимиты по ip/email
 */

export async function GET(request: NextRequest) {
  try {
    const adminKey = request.headers.get('x-admin-key')
    if (adminKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const ip = searchParams.get('ip') || '127.0.0.1'
    const email = searchParams.get('email') || undefined

    const status = await rateLimiterService.getLimitStatus(ip, email)
    return NextResponse.json({ success: true, status })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to get rate limit status' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminKey = request.headers.get('x-admin-key')
    if (adminKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({})) as { ip?: string; email?: string }
    const ip = body.ip || '127.0.0.1'
    const email = body.email

    const ok = await rateLimiterService.resetLimits(ip, email)
    return NextResponse.json({ success: ok, message: ok ? 'Rate limits reset' : 'Failed to reset' })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to reset rate limits' }, { status: 500 })
  }
}


