"use client";

/**
 * TREASURY BILL API ROUTE (BY ID)
 *
 * API endpoints для управления конкретной казначейской облигацией:
 * - GET /api/defi/treasury/bills/[billId] - Получить облигацию по ID
 * - PUT /api/defi/treasury/bills/[billId] - Обновить облигацию
 * - DELETE /api/defi/treasury/bills/[billId] - Удалить облигацию
 */

import { getCantonParticipantConfig } from "@/lib/canton/config/cantonEnv";
import { ComplianceService } from "@/lib/canton/services/complianceService";
import { DamlIntegrationService } from "@/lib/canton/services/damlIntegrationService";
import { OracleService } from "@/lib/canton/services/oracleService";
import { TreasuryBillsService } from "@/lib/canton/services/treasuryBillsService";
import { NextRequest, NextResponse } from "next/server";

// Initialize services
let treasuryService: TreasuryBillsService | null = null;

function getTreasuryService(): TreasuryBillsService {
  if (!treasuryService) {
    const cantonConfig = getCantonParticipantConfig();
    const damlService = new DamlIntegrationService({
      participantUrl: cantonConfig.participantUrl,
      participantId: cantonConfig.participantId,
      authToken: cantonConfig.authToken,
      partyId: cantonConfig.partyId,
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
 * GET /api/defi/treasury/bills/[billId]
 * Получить казначейскую облигацию по ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ billId: string }> },
) {
  try {
    const { billId } = await params;
    console.log(`GET /api/defi/treasury/bills/${billId}`);

    const service = getTreasuryService();
    const bill = service.getTreasuryBill(billId);

    if (!bill) {
      return NextResponse.json(
        {
          success: false,
          error: "Treasury bill not found",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: bill,
    });
  } catch (error: unknown) {
    const { billId } = await params;
    const message =
      error instanceof Error ? error.message : "Failed to fetch treasury bill";
    console.error(`Error in GET /api/defi/treasury/bills/${billId}:`, error);
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
 * PUT /api/defi/treasury/bills/[billId]
 * Обновить казначейскую облигацию
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ billId: string }> },
) {
  try {
    const { billId } = await params;
    console.log(`PUT /api/defi/treasury/bills/${billId}`);

    const body = await request.json();

    const service = getTreasuryService();
    const bill = await service.updateTreasuryBill(billId, body);

    return NextResponse.json({
      success: true,
      data: bill,
      message: "Treasury bill updated successfully",
    });
  } catch (error: unknown) {
    const { billId } = await params;
    const message =
      error instanceof Error ? error.message : "Failed to update treasury bill";
    console.error(`Error in PUT /api/defi/treasury/bills/${billId}:`, error);
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
 * DELETE /api/defi/treasury/bills/[billId]
 * Удалить казначейскую облигацию
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ billId: string }> },
) {
  try {
    const { billId } = await params;
    console.log(`DELETE /api/defi/treasury/bills/${billId}`);

    const service = getTreasuryService();
    const bill = service.getTreasuryBill(billId);

    if (!bill) {
      return NextResponse.json(
        {
          success: false,
          error: "Treasury bill not found",
        },
        { status: 404 },
      );
    }

    // Update status to DELISTED instead of deleting
    await service.updateTreasuryBill(billId, { status: "DELISTED" });

    return NextResponse.json({
      success: true,
      message: "Treasury bill delisted successfully",
    });
  } catch (error: unknown) {
    const { billId } = await params;
    const message =
      error instanceof Error ? error.message : "Failed to delist treasury bill";
    console.error(`Error in DELETE /api/defi/treasury/bills/${billId}:`, error);
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
