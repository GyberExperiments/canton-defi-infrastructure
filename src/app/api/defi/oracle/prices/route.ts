'use client';

/**
 * 🔮 ORACLE PRICES API ROUTE
 * 
 * API endpoints для получения цен от оракулов:
 * - GET /api/defi/oracle/prices - Получить цены активов
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
 * GET /api/defi/oracle/prices
 * Получить цены активов
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📊 GET /api/defi/oracle/prices');
    
    const searchParams = request.nextUrl.searchParams;
    const symbols = searchParams.get('symbols');
    const symbol = searchParams.get('symbol');
    
    const service = getOracleService();
    
    // Get single price
    if (symbol) {
      const price = await service.getPrice(symbol);
      return NextResponse.json({
        success: true,
        data: price
      });
    }
    
    // Get multiple prices
    if (symbols) {
      const symbolList = symbols.split(',').map(s => s.trim());
      const prices = await service.getPrices(symbolList);
      return NextResponse.json({
        success: true,
        data: prices,
        count: prices.length
      });
    }
    
    // Get all supported crypto prices
    const cryptoSymbols = ['BTC', 'ETH', 'USDT', 'USDC', 'DAI', 'WBTC', 'LINK', 'UNI', 'AAVE', 'COMP'];
    const prices = await service.getPrices(cryptoSymbols);
    
    return NextResponse.json({
      success: true,
      data: prices,
      count: prices.length
    });
    
  } catch (error: any) {
    console.error('❌ Error in GET /api/defi/oracle/prices:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch prices'
      },
      { status: 500 }
    );
  }
}
