import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/canton/status
 *
 * Proxies the Canton API Server /health endpoint and returns
 * the DAML ledger connection status to the frontend widget.
 *
 * When CANTON_API_SERVER_URL is not set, falls back to checking
 * the HTTP JSON API directly.
 */
export async function GET() {
  const cantonApiUrl = process.env.CANTON_API_SERVER_URL;
  const httpJsonApiUrl =
    process.env.NEXT_PUBLIC_CANTON_PARTICIPANT_URL ||
    "http://65.108.15.30:30757";

  // Strategy 1: Canton API Server (Rust SDK)
  if (cantonApiUrl) {
    try {
      const headers: Record<string, string> = {};
      const serviceToken = process.env.CANTON_API_SERVICE_TOKEN;
      if (serviceToken) {
        headers["Authorization"] = `Bearer ${serviceToken}`;
      }
      const res = await fetch(`${cantonApiUrl}/health`, {
        headers,
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({
          mode: "daml-ledger-api",
          connected: data.connected === true,
          participant: data.participant,
          ledgerEnd: data.ledger_end ?? null,
          applicationId: data.application_id,
          sdkVersion: data.version,
          apiServerUrl: cantonApiUrl,
          source: "canton-api-server",
        });
      }
    } catch {
      // fall through to HTTP JSON API check
    }
  }

  // Strategy 2: HTTP JSON API health probe
  try {
    const res = await fetch(`${httpJsonApiUrl}/v1/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateIds: [], query: {} }),
      signal: AbortSignal.timeout(5000),
    });
    // 200 or 400 (bad query) both mean the API is reachable
    const reachable = res.status === 200 || res.status === 400;
    return NextResponse.json({
      mode: "http-json-api",
      connected: reachable,
      participant: httpJsonApiUrl,
      ledgerEnd: null,
      applicationId: null,
      sdkVersion: null,
      apiServerUrl: cantonApiUrl ?? null,
      source: "http-json-api-probe",
    });
  } catch {
    // Strategy 3: Everything offline
    return NextResponse.json({
      mode: "offline",
      connected: false,
      participant: httpJsonApiUrl,
      ledgerEnd: null,
      applicationId: null,
      sdkVersion: null,
      apiServerUrl: cantonApiUrl ?? null,
      source: "none",
    });
  }
}
