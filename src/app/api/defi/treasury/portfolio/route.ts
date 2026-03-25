'use client';

/**
 * 💰 TREASURY PORTFOLIO API ROUTE
 * 
 * API endpoints для управления портфелем инвестора:
 * - GET /api/defi/treasury/portfolio - Получить портфель инвестора
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCantonParticipantConfig } from '@/lib/canton/config/cantonEnv';
import { TreasuryBillsService } from '@/lib/canton/services/treasuryBillsService';
import { DamlIntegrationService } from '@/lib/canton/services/damlIntegrationService';
import { OracleService } from '@/lib/canton/services/oracleService';
import { ComplianceService } from '@/lib/canton/services/complianceService';

// Initialize services
let treasuryService: TreasuryBillsService | null = null;

function getTreasuryService(): TreasuryBillsService {
  if (!treasuryService) {
    const cantonConfig = getCantonParticipantConfig();
    const damlService = new DamlIntegrationService({
      participantUrl: cantonConfig.participantUrl,
      participantId: cantonConfig.participantId,
      authToken: cantonConfig.authToken,
      partyId: cantonConfig.partyId
    });
    
    const oracleService = new OracleService({
      enabled: true,
      defaultProvider: 'pyth',
      cacheTTL: 60
    });
    
    const complianceService = new ComplianceService({
      enabled: true,
      strictMode: false
    });
    
    treasuryService = new TreasuryBillsService(
      {
        enabled: true,
        minInvestment: '100',
        maxInvestment: '10000000',
        settlementType: 'T0',
        yieldDistributionFrequency: 'DAILY',
        autoReinvest: false,
        secondaryMarketEnabled: true
      },
      damlService,
      oracleService,
      complianceService
    );
  }
  
  return treasuryService;
}

/**
 * GET /api/defi/treasury/portfolio
 * Получить портфель инвестора
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📊 GET /api/defi/treasury/portfolio');
    
    const searchParams = request.nextUrl.searchParams;
    const investor = searchParams.get('investor');
    
    if (!investor) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameter: investor'
        },
        { status: 400 }
      );
    }
    
    const service = getTreasuryService();
    const portfolio = await service.getInvestorPortfolioSummary(investor);
    
    return NextResponse.json({
      success: true,
      data: portfolio
    });
    
  } catch (error: any) {
    console.error('❌ Error in GET /api/defi/treasury/portfolio:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch portfolio'
      },
      { status: 500 }
    );
  }
}
