/**
 * Cron Job: Telegram Client API Session Health Check
 * Schedule: Каждые 6 часов
 * Purpose: Проактивное обнаружение истечение сессии
 */

import { NextRequest, NextResponse } from 'next/server';
import { telegramClientService } from '@/lib/services/telegramClient';
import { telegramService } from '@/lib/services/telegram';

export const dynamic = 'force-dynamic';

// Vercel Cron authorization
export async function GET(request: NextRequest) {
  try {
    // Проверка authorization для cron (Vercel sends header)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('⚠️ Unauthorized cron request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    console.log('🔍 Starting Telegram session health check...');
    
    const startTime = Date.now();
    
    // Проверка подключения
    const isConnected = await telegramClientService.checkConnection();
    const checkDuration = Date.now() - startTime;
    
    if (isConnected) {
      // Получить user info
      const me = await telegramClientService.getMe();
      
      console.log('✅ Telegram Client API session is valid:', {
        checkDuration: `${checkDuration}ms`,
        user: me ? `${me.firstName} (@${me.username})` : 'unknown',
        userId: me?.id,
        timestamp: new Date().toISOString()
      });
      
      return NextResponse.json({
        success: true,
        status: 'connected',
        checkDuration,
        user: me,
        timestamp: new Date().toISOString()
      });
    } else {
      // 🚨 КРИТИЧНЫЙ АЛЕРТ: Session не валиден
      console.error('🚨 CRITICAL: Telegram Client API session is INVALID or EXPIRED!');
      
      // Отправить алерт администраторам
      await sendSessionExpiryAlert();
      
      return NextResponse.json({
        success: false,
        status: 'disconnected',
        error: 'Session invalid or expired',
        action: 'URGENT: Regenerate session using: node scripts/setup-telegram-session.js',
        impact: 'Taker notifications are NOT working!',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Session check failed:', errorMessage);
    
    // Отправить алерт о проблеме с проверкой
    await sendSessionCheckError(errorMessage);
    
    return NextResponse.json({
      success: false,
      status: 'error',
      error: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Отправить критичный алерт об истечении сессии
 */
async function sendSessionExpiryAlert(): Promise<void> {
  try {
    const alertMessage = `
🚨 <b>CRITICAL ALERT: Telegram Client API Session Expired</b>

⚠️ <b>Impact:</b>
• Taker notifications are NOT working
• Personal messages to customers failing
• Fallback to Bot API active (limited functionality)

🔧 <b>Action Required:</b>
1. Run: <code>node scripts/setup-telegram-session.js</code>
2. Update secret: <code>gh secret set TELEGRAM_SESSION_STRING -b "new_session"</code>
3. Restart deployment: <code>kubectl rollout restart deployment/canton-otc -n canton-otc</code>

⏰ <b>Time:</b> ${new Date().toISOString()}

📚 <b>See:</b> docs/operations/PRODUCTION_RUNBOOK.md
    `.trim();
    
    await telegramService.sendCustomMessage(alertMessage);
    
    console.log('✅ Session expiry alert sent to admins');
  } catch (error) {
    console.error('❌ Failed to send session expiry alert:', error);
  }
}

/**
 * Отправить алерт об ошибке проверки
 */
async function sendSessionCheckError(errorMessage: string): Promise<void> {
  try {
    const alertMessage = `
⚠️ <b>Warning: Telegram Session Check Failed</b>

Error: ${errorMessage}

This may indicate a temporary issue. If persists, check:
1. Telegram Client API configuration
2. Network connectivity
3. Service logs

Time: ${new Date().toISOString()}
    `.trim();
    
    await telegramService.sendCustomMessage(alertMessage);
  } catch (error) {
    console.error('❌ Failed to send check error alert:', error);
  }
}
