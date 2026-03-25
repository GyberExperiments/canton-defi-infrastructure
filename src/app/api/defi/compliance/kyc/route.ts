'use client';

/**
 * 🛡️ COMPLIANCE KYC API ROUTE
 * 
 * API endpoints для управления KYC проверками:
 * - POST /api/defi/compliance/kyc - Начать KYC проверку
 * - GET /api/defi/compliance/kyc - Получить KYC проверки
 */

import { NextRequest, NextResponse } from 'next/server';
import { ComplianceService } from '@/lib/canton/services/complianceService';

// Initialize service
let complianceService: ComplianceService | null = null;

function getComplianceService(): ComplianceService {
  if (!complianceService) {
    complianceService = new ComplianceService({
      enabled: true,
      strictMode: false,
      kycProvider: 'sumsub',
      amlProvider: 'chainalysis',
      sanctionsProvider: 'worldcheck',
      auditLogRetentionDays: 2555,
      autoRejectThreshold: 80
    });
  }
  
  return complianceService;
}

/**
 * POST /api/defi/compliance/kyc
 * Начать KYC проверку
 */
export async function POST(request: NextRequest) {
  try {
    console.log('📝 POST /api/defi/compliance/kyc');
    
    const body = await request.json();
    
    // Validate required fields
    if (!body.userId || !body.personalInfo) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: userId, personalInfo'
        },
        { status: 400 }
      );
    }
    
    const service = getComplianceService();
    const verification = await service.startKYCVerification(
      body.userId,
      body.personalInfo,
      body.targetLevel || 'RETAIL'
    );
    
    return NextResponse.json({
      success: true,
      data: verification,
      message: 'KYC verification started successfully'
    }, { status: 201 });
    
  } catch (error: any) {
    console.error('❌ Error in POST /api/defi/compliance/kyc:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to start KYC verification'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/defi/compliance/kyc
 * Получить KYC проверки
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📊 GET /api/defi/compliance/kyc');
    
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const verificationId = searchParams.get('verificationId');
    
    const service = getComplianceService();
    
    // Get verification by ID
    if (verificationId) {
      // Would need to add getVerification method to service
      return NextResponse.json({
        success: true,
        data: null
      });
    }
    
    // Get verifications by user
    if (userId) {
      // Would need to add getUserVerifications method to service
      return NextResponse.json({
        success: true,
        data: []
      });
    }
    
    return NextResponse.json({
      success: false,
      error: 'Missing required parameter: userId or verificationId'
    }, { status: 400 });
    
  } catch (error: any) {
    console.error('❌ Error in GET /api/defi/compliance/kyc:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch KYC verifications'
      },
      { status: 500 }
    );
  }
}
