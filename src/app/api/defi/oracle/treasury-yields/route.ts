'use client';

/**
 * 🔮 ORACLE TREASURY YIELDS API ROUTE
 * 
 * API endpoints для получения доходности казначейских облигаций:
 * - GET /api/defi/oracle/treasury-yields - Получить доходность облигаций
 */

import { NextRequest, NextResponse } from 'next/server';
import { OracleService } from '@/lib/canton/services/oracleService';

// Initialize service
let oracleService: OracleService | null = null;

function getOracleService(): OracleService {
  if (!oracleService) {
    oracleService = new OracleService({
      enabled: true,
      defaultProvider: 'pyth',
      fallbackProviders: ['chainlink', 'band', 'coingecko'],
      cacheTTL: 60,
      updateInterval: 30,
      maxRetries: 3,
      retryDelay: 1000
    });
  }
  
  return oracleService;
}

/**
 * GET /api/defi/oracle/treasury-yields
 * Получить доходность казначейских облигаций
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📊 GET /api/defi/oracle/treasury-yields');
    
    const searchParams = request.nextUrl.searchParams;
    const maturity = searchParams.get('maturity');
    
    const service = getOracleService();
    
    // Get specific maturity yield
    if (maturity) {
      const yieldData = await service.getTreasuryYield(maturity as any);
      return NextResponse.json({
        success: true,
        data: yieldData
      });
    }
    
    // Get all treasury yields
    const yields = await service.getAllTreasuryYields();
    
    return NextResponse.json({
      success: true,
      data: yields,
      count: yields.length
    });
    
  } catch (error: any) {
    console.error('❌ Error in GET /api/defi/oracle/treasury-yields:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch treasury yields'
      },
      { status: 500 }
    );
  }
}
