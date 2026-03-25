/**
 * 🔍 API endpoint для проверки обновлений конфигурации
 * Проверяет, есть ли обновления конфигурации без полного обновления
 */

import { NextResponse } from 'next/server';
import { configManager } from '@/lib/config-manager';

// Принудительно делаем route динамическим
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('🔍 API: Checking for configuration updates');
    
    // Получаем текущую конфигурацию
    const stats = configManager.getStats();
    
    // Проверяем, актуальна ли конфигурация
    const isFresh = configManager.isConfigFresh();
    
    console.log('📊 API: Configuration check completed', {
      isFresh,
      lastUpdate: stats.lastUpdate
    });
    
    return NextResponse.json({
      success: true,
      hasUpdates: !isFresh,
      isFresh: isFresh,
      lastUpdate: stats.lastUpdate,
      lastModified: stats.lastUpdate.getTime(),
      stats: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ API: Configuration check error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST() {
  try {
    console.log('🔄 API: Force configuration refresh');
    
    // Принудительно обновляем конфигурацию
    const refreshed = await configManager.refreshConfig();
    const stats = configManager.getStats();
    
    console.log('📊 API: Force configuration refresh completed', {
      refreshed,
      lastUpdate: stats.lastUpdate
    });
    
    return NextResponse.json({
      success: refreshed,
      hasUpdates: refreshed,
      lastUpdate: stats.lastUpdate,
      lastModified: stats.lastUpdate.getTime(),
      stats: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ API: Force configuration refresh error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
