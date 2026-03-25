"use client";

/**
 * 🔐 AUTH LOGOUT API ROUTE
 *
 * API endpoints для выхода из системы:
 * - POST /api/defi/auth/logout - Выход из системы
 */

import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/canton/services/authService";

// Initialize service
let authService: AuthService | null = null;

function getAuthService(): AuthService {
  if (!authService) {
    authService = new AuthService({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      jwtSecret: process.env.JWT_SECRET || "",
      sessionTimeout: 60, // 1 hour
      refreshTokenExpiry: 30, // 30 days
      enableMFA: false,
    });
  }

  return authService;
}

/**
 * POST /api/defi/auth/logout
 * Выход из системы
 */
export async function POST(request: NextRequest) {
  try {
    console.log("🚪 POST /api/defi/auth/logout");

    const sessionToken = request.cookies.get("session_token")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        {
          success: false,
          error: "No active session",
        },
        { status: 401 },
      );
    }

    const service = getAuthService();
    const result = await service.logout(sessionToken);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 500 },
      );
    }

    // Clear session cookies
    const response = NextResponse.json({
      success: true,
      message: "Logout successful",
    });

    response.cookies.set("session_token", "", { path: "/", maxAge: 0 });
    response.cookies.set("refresh_token", "", { path: "/", maxAge: 0 });

    return response;
  } catch (error: any) {
    console.error("❌ Error in POST /api/defi/auth/logout:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Logout failed",
      },
      { status: 500 },
    );
  }
}
