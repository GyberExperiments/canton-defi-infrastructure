"use client";

/**
 * 💰 TREASURY PURCHASES API ROUTE
 *
 * API endpoints для управления запросами на покупку облигаций:
 * - GET /api/defi/treasury/purchases - Получить все запросы на покупку
 * - POST /api/defi/treasury/purchases - Создать запрос на покупку
 */

import { NextRequest, NextResponse } from "next/server";
import { TreasuryBillsService } from "@/lib/canton/services/treasuryBillsService";
import { DamlIntegrationService } from "@/lib/canton/services/damlIntegrationService";
import { OracleService } from "@/lib/canton/services/oracleService";
import { ComplianceService } from "@/lib/canton/services/complianceService";

// Initialize services
let treasuryService: TreasuryBillsService | null = null;

function getTreasuryService(): TreasuryBillsService {
  if (!treasuryService) {
    const damlService = new DamlIntegrationService({
      participantUrl:
        process.env.CANTON_PARTICIPANT_URL || "http://localhost:5011",
      participantId: process.env.CANTON_PARTICIPANT_ID || "participant1",
      authToken: process.env.CANTON_AUTH_TOKEN || "",
      partyId: process.env.CANTON_PARTY_ID || "party1",
    });

    const oracleService = new OracleService({
      enabled: true,
      defaultProvider: "pyth",
      cacheTTL: 60,
    });

    const complianceService = new ComplianceService({
      enabled: true,
      strictMode: false,
    });

    treasuryService = new TreasuryBillsService(
      {
        enabled: true,
        minInvestment: "100",
        maxInvestment: "10000000",
        settlementType: "T0",
        yieldDistributionFrequency: "DAILY",
        autoReinvest: false,
        secondaryMarketEnabled: true,
      },
      damlService,
      oracleService,
      complianceService,
    );
  }

  return treasuryService;
}

/**
 * GET /api/defi/treasury/purchases
 * Получить все запросы на покупку
 */
export async function GET(request: NextRequest) {
  try {
    console.log("📊 GET /api/defi/treasury/purchases");

    const searchParams = request.nextUrl.searchParams;
    const investor = searchParams.get("investor");
    const status = searchParams.get("status");
    const billId = searchParams.get("billId");

    // TODO: Add getPurchaseRequests method to TreasuryBillsService
    // For now, return empty array as the service does not expose purchase request listing
    const purchases: Record<string, unknown>[] = [];

    // Filter by investor
    if (investor) {
      // purchases = purchases.filter(p => p.investor === investor);
    }

    // Filter by status
    if (status) {
      // purchases = purchases.filter(p => p.status === status);
    }

    // Filter by billId
    if (billId) {
      // purchases = purchases.filter(p => p.billId === billId);
    }

    return NextResponse.json({
      success: true,
      data: purchases,
      count: purchases.length,
    });
  } catch (error: unknown) {
    console.error("❌ Error in GET /api/defi/treasury/purchases:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch purchase requests";
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/defi/treasury/purchases
 * Создать запрос на покупку
 */
export async function POST(request: NextRequest) {
  try {
    console.log("📝 POST /api/defi/treasury/purchases");

    const body = await request.json();

    // Validate required fields
    if (!body.billId || !body.investor || !body.numberOfTokens) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: billId, investor, numberOfTokens",
        },
        { status: 400 },
      );
    }

    // Validate numberOfTokens
    if (body.numberOfTokens <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "numberOfTokens must be greater than 0",
        },
        { status: 400 },
      );
    }

    const service = getTreasuryService();
    const purchaseRequest = await service.createPurchaseRequest(
      body.billId,
      body.investor,
      body.numberOfTokens,
      body.paymentData || {},
    );

    return NextResponse.json(
      {
        success: true,
        data: purchaseRequest,
        message: "Purchase request created successfully",
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    console.error("❌ Error in POST /api/defi/treasury/purchases:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create purchase request";
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
