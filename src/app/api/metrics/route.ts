/**
 * GET /api/metrics
 * Получение метрик системы для мониторинга
 */

import { NextResponse } from 'next/server';
import { metricsCollector } from '@/lib/monitoring/metricsCollector';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const metrics = metricsCollector.getMetrics();
    
    // Дополнительные системные метрики
    const systemMetrics = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodejs: process.version,
      platform: process.platform
    };
    
    return NextResponse.json({
      success: true,
      metrics,
      system: systemMetrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to collect metrics' },
      { status: 500 }
    );
  }
}
