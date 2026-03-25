/**
 * Treasury Bills API — backed by Canton DAML contracts via Rust API
 *
 * GET  /api/defi/treasury/bills - List all treasury bills from Canton Ledger
 * POST /api/defi/treasury/bills - Create a new treasury bill (OtcOffer contract)
 */

import { NextRequest, NextResponse } from "next/server";
import { getTreasuryService } from "@/lib/canton/services/treasuryBillsService";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const maturity = searchParams.get("maturity");

    const service = getTreasuryService();
    let bills = await service.getAllTreasuryBills();

    if (status) bills = bills.filter((b) => b.status === status);
    if (maturity) bills = bills.filter((b) => b.maturity === maturity);

    return NextResponse.json({ success: true, data: bills, count: bills.length });
  } catch (error) {
    console.error("GET /api/defi/treasury/bills error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.symbol) {
      return NextResponse.json(
        { success: false, error: "Missing required field: symbol" },
        { status: 400 }
      );
    }

    const service = getTreasuryService();
    const bill = await service.createTreasuryBill(body);

    return NextResponse.json(
      { success: true, data: bill, message: "Treasury bill created on Canton Ledger" },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/defi/treasury/bills error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create" },
      { status: 500 }
    );
  }
}
