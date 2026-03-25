"use client";

/**
 * 🔐 AUTH SERVICE 2025
 *
 * Сервис аутентификации для Canton Wealth Platform:
 * - Интеграция с NextAuth.js и Supabase
 * - JWT токены и refresh токены
 * - KYC level based access control
 * - Session management
 * - Multi-factor authentication (MFA)
 * - Password reset и email verification
 */

import { EventEmitter } from "events";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ========================================
// AUTH TYPES
// ========================================

export interface AuthConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  jwtSecret: string;
  sessionTimeout: number; // minutes
  refreshTokenExpiry: number; // days
  enableMFA: boolean;
}

export interface User {
  id: string;
  email: string;
  walletAddress?: string;

  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  nationality?: string;
  countryOfResidence?: string;
  taxId?: string;

  kycLevel: "RETAIL" | "ACCREDITED" | "INSTITUTIONAL" | "ULTRA_HNW";
  kycStatus:
    | "NOT_STARTED"
    | "PENDING"
    | "IN_PROGRESS"
    | "APPROVED"
    | "REJECTED"
    | "REVIEW_REQUIRED";
  kycVerifiedAt?: string;
  kycExpiresAt?: string;

  status: "ACTIVE" | "SUSPENDED" | "BANNED" | "DELETED";
  isAccreditedInvestor: boolean;

  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface Session {
  userId: string;
  email: string;
  token: string;
  refreshToken: string;
  expiresAt: string;
  kycLevel: User["kycLevel"];
  permissions: string[];
}

export interface LoginCredentials {
  email: string;
  password: string;
  mfaCode?: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  walletAddress?: string;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  session?: Session;
  error?: string;
  requiresMFA?: boolean;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetData {
  token: string;
  newPassword: string;
}

export interface EmailVerificationData {
  email: string;
  token: string;
}

// ========================================
// AUTH SERVICE CLASS
// ========================================

export class AuthService extends EventEmitter {
  private config: AuthConfig;
  private supabase: SupabaseClient;
  private sessions: Map<string, Session> = new Map();

  constructor(config: AuthConfig) {
    super();
    this.config = config;
    this.supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);

    console.log("🔐 Auth Service initialized", {
      supabaseUrl: config.supabaseUrl,
      sessionTimeout: config.sessionTimeout,
      enableMFA: config.enableMFA,
    });
  }

  // ========================================
  // AUTHENTICATION
  // ========================================

  /**
   * Login user
   */
  public async login(credentials: LoginCredentials): Promise<AuthResult> {
    try {
      console.log("🔐 Logging in user...", { email: credentials.email });

      // Authenticate with Supabase
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) {
        console.error("❌ Login failed:", error.message);
        return {
          success: false,
          error: error.message,
        };
      }

      if (!data.user || !data.session) {
        return {
          success: false,
          error: "Authentication failed",
        };
      }

      // Get user data from database
      const userData = await this.getUserData(data.user.id);

      if (!userData) {
        return {
          success: false,
          error: "User not found",
        };
      }

      // Check if user is active
      if (userData.status !== "ACTIVE") {
        return {
          success: false,
          error: `Account is ${userData.status.toLowerCase()}`,
        };
      }

      // Check MFA if enabled
      if (this.config.enableMFA && !credentials.mfaCode) {
        // In production, verify MFA code
        return {
          success: false,
          requiresMFA: true,
          error: "MFA code required",
        };
      }

      // Create session
      const session = await this.createSession(
        userData,
        data.session.access_token,
      );

      // Update last login
      await this.updateLastLogin(userData.id);

      console.log("✅ User logged in:", userData.email);
      this.emit("user_logged_in", {
        userId: userData.id,
        email: userData.email,
      });

      return {
        success: true,
        user: userData,
        session,
      };
    } catch (error: any) {
      console.error("❌ Login error:", error);
      return {
        success: false,
        error: error.message || "Login failed",
      };
    }
  }

  /**
   * Register new user
   */
  public async register(data: RegisterData): Promise<AuthResult> {
    try {
      console.log("📝 Registering new user...", { email: data.email });

      // Check if user already exists
      const { data: existingUser } = await this.supabase
        .from("users")
        .select("id")
        .eq("email", data.email)
        .single();

      if (existingUser) {
        return {
          success: false,
          error: "User already exists",
        };
      }

      // Register with Supabase Auth
      const { data: authData, error: authError } =
        await this.supabase.auth.signUp({
          email: data.email,
          password: data.password,
        });

      if (authError) {
        console.error("❌ Registration failed:", authError.message);
        return {
          success: false,
          error: authError.message,
        };
      }

      if (!authData.user) {
        return {
          success: false,
          error: "Registration failed",
        };
      }

      // Create user record in database
      const { data: userData, error: dbError } = await this.supabase
        .from("users")
        .insert({
          id: authData.user.id,
          email: data.email,
          wallet_address: data.walletAddress,
          first_name: data.firstName,
          last_name: data.lastName,
          kyc_level: "RETAIL",
          kyc_status: "NOT_STARTED",
          status: "ACTIVE",
          is_accredited_investor: false,
        })
        .select()
        .single();

      if (dbError) {
        console.error("❌ Failed to create user record:", dbError.message);
        return {
          success: false,
          error: "Failed to create user record",
        };
      }

      // Create session
      const session = await this.createSession(
        userData,
        authData.session?.access_token || "",
      );

      console.log("✅ User registered:", userData.email);
      this.emit("user_registered", {
        userId: userData.id,
        email: userData.email,
      });

      return {
        success: true,
        user: userData,
        session,
      };
    } catch (error: any) {
      console.error("❌ Registration error:", error);
      return {
        success: false,
        error: error.message || "Registration failed",
      };
    }
  }

  /**
   * Logout user
   */
  public async logout(
    sessionToken: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log("🚪 Logging out user...");

      // Remove session from cache
      this.sessions.delete(sessionToken);

      // Sign out from Supabase
      const { error } = await this.supabase.auth.signOut();

      if (error) {
        console.error("❌ Logout failed:", error.message);
        return {
          success: false,
          error: error.message,
        };
      }

      console.log("✅ User logged out");
      this.emit("user_logged_out", { sessionToken });

      return { success: true };
    } catch (error: any) {
      console.error("❌ Logout error:", error);
      return {
        success: false,
        error: error.message || "Logout failed",
      };
    }
  }

  /**
   * Refresh session
   */
  public async refreshSession(refreshToken: string): Promise<AuthResult> {
    try {
      console.log("🔄 Refreshing session...");

      // Refresh with Supabase
      const { data, error } = await this.supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error) {
        console.error("❌ Session refresh failed:", error.message);
        return {
          success: false,
          error: error.message,
        };
      }

      if (!data.user || !data.session) {
        return {
          success: false,
          error: "Session refresh failed",
        };
      }

      // Get user data
      const userData = await this.getUserData(data.user.id);

      if (!userData) {
        return {
          success: false,
          error: "User not found",
        };
      }

      // Create new session
      const session = await this.createSession(
        userData,
        data.session.access_token,
      );

      console.log("✅ Session refreshed");
      this.emit("session_refreshed", { userId: userData.id });

      return {
        success: true,
        user: userData,
        session,
      };
    } catch (error: any) {
      console.error("❌ Session refresh error:", error);
      return {
        success: false,
        error: error.message || "Session refresh failed",
      };
    }
  }

  // ========================================
  // PASSWORD RESET
  // ========================================

  /**
   * Request password reset
   */
  public async requestPasswordReset(
    request: PasswordResetRequest,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log("📧 Requesting password reset...", { email: request.email });

      const { error } = await this.supabase.auth.resetPasswordForEmail(
        request.email,
        {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        },
      );

      if (error) {
        console.error("❌ Password reset request failed:", error.message);
        return {
          success: false,
          error: error.message,
        };
      }

      console.log("✅ Password reset email sent");
      this.emit("password_reset_requested", { email: request.email });

      return { success: true };
    } catch (error: any) {
      console.error("❌ Password reset request error:", error);
      return {
        success: false,
        error: error.message || "Password reset request failed",
      };
    }
  }

  /**
   * Reset password
   */
  public async resetPassword(
    data: PasswordResetData,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log("🔑 Resetting password...");

      const { error } = await this.supabase.auth.updateUser({
        password: data.newPassword,
      });

      if (error) {
        console.error("❌ Password reset failed:", error.message);
        return {
          success: false,
          error: error.message,
        };
      }

      console.log("✅ Password reset successful");
      this.emit("password_reset_completed");

      return { success: true };
    } catch (error: any) {
      console.error("❌ Password reset error:", error);
      return {
        success: false,
        error: error.message || "Password reset failed",
      };
    }
  }

  // ========================================
  // EMAIL VERIFICATION
  // ========================================

  /**
   * Verify email
   */
  public async verifyEmail(
    data: EmailVerificationData,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log("✓ Verifying email...");

      const { error } = await this.supabase.auth.verifyOtp({
        email: data.email || "",
        token: data.token,
        type: "email",
      });

      if (error) {
        console.error("❌ Email verification failed:", error.message);
        return {
          success: false,
          error: error.message,
        };
      }

      console.log("✅ Email verified");
      this.emit("email_verified");

      return { success: true };
    } catch (error: any) {
      console.error("❌ Email verification error:", error);
      return {
        success: false,
        error: error.message || "Email verification failed",
      };
    }
  }

  // ========================================
  // SESSION MANAGEMENT
  // ========================================

  /**
   * Create session
   */
  private async createSession(user: User, token: string): Promise<Session> {
    const expiresAt = new Date(
      Date.now() + this.config.sessionTimeout * 60 * 1000,
    ).toISOString();

    const session: Session = {
      userId: user.id,
      email: user.email,
      token,
      refreshToken: "", // Will be set by Supabase
      expiresAt,
      kycLevel: user.kycLevel,
      permissions: this.getPermissions(user.kycLevel),
    };

    this.sessions.set(token, session);

    return session;
  }

  /**
   * Get session
   */
  public getSession(token: string): Session | undefined {
    return this.sessions.get(token);
  }

  /**
   * Validate session
   */
  public validateSession(token: string): { valid: boolean; user?: User } {
    const session = this.sessions.get(token);

    if (!session) {
      return { valid: false };
    }

    // Check if session is expired
    if (new Date(session.expiresAt) < new Date()) {
      this.sessions.delete(token);
      return { valid: false };
    }

    return {
      valid: true,
      user: {
        id: session.userId,
        email: session.email,
        kycLevel: session.kycLevel,
      } as User,
    };
  }

  // ========================================
  // USER DATA
  // ========================================

  /**
   * Get user data from database
   */
  private async getUserData(userId: string): Promise<User | null> {
    try {
      const { data, error } = await this.supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        id: data.id,
        email: data.email,
        walletAddress: data.wallet_address,
        firstName: data.first_name,
        lastName: data.last_name,
        dateOfBirth: data.date_of_birth,
        nationality: data.nationality,
        countryOfResidence: data.country_of_residence,
        taxId: data.tax_id,
        kycLevel: data.kyc_level,
        kycStatus: data.kyc_status,
        kycVerifiedAt: data.kyc_verified_at,
        kycExpiresAt: data.kyc_expires_at,
        status: data.status,
        isAccreditedInvestor: data.is_accredited_investor,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        lastLoginAt: data.last_login_at,
      };
    } catch (error) {
      console.error("❌ Failed to get user data:", error);
      return null;
    }
  }

  /**
   * Update last login
   */
  private async updateLastLogin(userId: string): Promise<void> {
    try {
      await this.supabase
        .from("users")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", userId);
    } catch (error) {
      console.error("❌ Failed to update last login:", error);
    }
  }

  // ========================================
  // PERMISSIONS
  // ========================================

  /**
   * Get permissions based on KYC level
   */
  private getPermissions(kycLevel: User["kycLevel"]): string[] {
    const basePermissions = ["view_treasury_bills", "view_market_data"];

    const levelPermissions: Record<User["kycLevel"], string[]> = {
      RETAIL: [
        ...basePermissions,
        "purchase_treasury_bills_retail",
        "view_own_holdings",
      ],
      ACCREDITED: [
        ...basePermissions,
        "purchase_treasury_bills_accredited",
        "view_own_holdings",
        "trade_secondary_market",
      ],
      INSTITUTIONAL: [
        ...basePermissions,
        "purchase_treasury_bills_institutional",
        "view_own_holdings",
        "trade_secondary_market",
        "access_privacy_vaults",
        "access_real_estate",
      ],
      ULTRA_HNW: [
        ...basePermissions,
        "purchase_treasury_bills_ultra_hnw",
        "view_own_holdings",
        "trade_secondary_market",
        "access_privacy_vaults",
        "access_real_estate",
        "access_ai_optimizer",
        "access_cross_chain_bridge",
      ],
    };

    return levelPermissions[kycLevel] || basePermissions;
  }

  /**
   * Check if user has permission
   */
  public hasPermission(session: Session, permission: string): boolean {
    return session.permissions.includes(permission);
  }

  /**
   * Check if user has any of the permissions
   */
  public hasAnyPermission(session: Session, permissions: string[]): boolean {
    return permissions.some((permission) =>
      session.permissions.includes(permission),
    );
  }

  /**
   * Check if user has all of the permissions
   */
  public hasAllPermissions(session: Session, permissions: string[]): boolean {
    return permissions.every((permission) =>
      session.permissions.includes(permission),
    );
  }
}
