import { getDamlService } from "@/lib/canton/services/damlIntegrationService";
import { NextResponse } from "next/server";

/**
 * GET /api/daml/health
 * Health check endpoint for DAML Canton Network connection
 */
export async function GET() {
  try {
    const service = getDamlService();
    const status = service.getStatus();

    return NextResponse.json({
      mode: status.mode,
      connected: status.connected,
      ledgerHost:
        process.env.CANTON_PARTICIPANT_URL ||
        process.env.DAML_LEDGER_HOST ||
        "not-configured",
      applicationId:
        process.env.CANTON_APPLICATION_ID ||
        process.env.DAML_APPLICATION_ID ||
        "canton-otc-platform",
      contractCount: status.contractCount,
      cacheSize: status.cacheSize,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
    });
  } catch (error) {
    return NextResponse.json(
      {
        mode: "ERROR",
        connected: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
