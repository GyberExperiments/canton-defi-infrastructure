/**
 * 🔄 API endpoint для обновления конфигурации
 * Позволяет принудительно обновить конфигурацию без перезапуска
 */

import { NextResponse } from 'next/server';
import { configManager } from '@/lib/config-manager';

// Принудительно делаем route динамическим
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    console.log('🔄 API: Configuration refresh requested');

    // Принудительно обновляем конфигурацию
    const success = await configManager.refreshConfig();
    
    if (success) {
      const config = configManager.getConfig();
      const stats = configManager.getStats();
      
      console.log('✅ API: Configuration refreshed successfully', {
        cantonCoinBuyPrice: config?.cantonCoinBuyPrice,
        cantonCoinSellPrice: config?.cantonCoinSellPrice,
        cantonCoinPrice: config?.cantonCoinPrice
      });
      
      return NextResponse.json({
        success: true,
        message: 'Configuration refreshed successfully',
        config: config,
        stats: stats,
        timestamp: new Date().toISOString()
      });
    } else {
      console.error('❌ API: Failed to refresh configuration');
      
      return NextResponse.json({
        success: false,
        error: 'Failed to refresh configuration',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
  } catch (error) {
    console.error('❌ API: Configuration refresh error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    console.log('📊 API: Configuration status requested');
    
    const config = configManager.getConfig();
    const stats = configManager.getStats();
    
    return NextResponse.json({
      success: true,
      config: config,
      stats: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ API: Configuration status error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
