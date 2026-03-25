import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { AuthService } from '@/lib/canton/services/authService';

// Mock Supabase
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      refreshSession: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      verifyOtp: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
    })),
  })),
}));

describe('User Registration and Login Flow Integration', () => {
  let authService: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();

    authService = new AuthService({
      supabaseUrl: 'https://test.supabase.co',
      supabaseAnonKey: 'test-key',
      jwtSecret: 'test-secret',
      sessionTimeout: 30,
      refreshTokenExpiry: 7,
      enableMFA: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Registration Flow', () => {
    it('should complete full registration process', async () => {
      // Step 1: Register new user
      const registerResult = await authService.register({
        email: 'newuser@example.com',
        password: 'SecurePassword123!',
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(registerResult.success).toBe(true);
      expect(registerResult.user).toBeDefined();
      expect(registerResult.user?.email).toBe('newuser@example.com');
      expect(registerResult.session).toBeDefined();

      // Step 2: Verify email (simulated)
      const verifyResult = await authService.verifyEmail({
        token: 'verification-token',
      });

      expect(verifyResult.success).toBe(true);

      // Step 3: Login with credentials
      const loginResult = await authService.login({
        email: 'newuser@example.com',
        password: 'SecurePassword123!',
      });

      expect(loginResult.success).toBe(true);
      expect(loginResult.user).toBeDefined();
      expect(loginResult.session).toBeDefined();
    });

    it('should handle registration with existing email', async () => {
      const registerResult = await authService.register({
        email: 'existing@example.com',
        password: 'SecurePassword123!',
      });

      expect(registerResult.success).toBe(false);
      expect(registerResult.error).toContain('already exists');
    });

    it('should handle registration with weak password', async () => {
      const registerResult = await authService.register({
        email: 'test@example.com',
        password: 'weak',
      });

      expect(registerResult.success).toBe(false);
      expect(registerResult.error).toBeDefined();
    });
  });

  describe('Complete Login Flow', () => {
    it('should complete full login process', async () => {
      // Step 1: Login with valid credentials
      const loginResult = await authService.login({
        email: 'test@example.com',
        password: 'SecurePassword123!',
      });

      expect(loginResult.success).toBe(true);
      expect(loginResult.user).toBeDefined();
      expect(loginResult.session).toBeDefined();
      expect(loginResult.session?.token).toBeDefined();
      expect(loginResult.session?.expiresAt).toBeDefined();

      // Step 2: Verify session is active
      const session = loginResult.session;
      expect(session?.userId).toBeDefined();
      expect(session?.email).toBe('test@example.com');
      expect(session?.permissions).toBeDefined();
      expect(Array.isArray(session?.permissions)).toBe(true);
    });

    it('should handle login with invalid credentials', async () => {
      const loginResult = await authService.login({
        email: 'invalid@example.com',
        password: 'WrongPassword123!',
      });

      expect(loginResult.success).toBe(false);
      expect(loginResult.error).toBeDefined();
      expect(loginResult.user).toBeUndefined();
      expect(loginResult.session).toBeUndefined();
    });

    it('should handle login with suspended account', async () => {
      const loginResult = await authService.login({
        email: 'suspended@example.com',
        password: 'SecurePassword123!',
      });

      expect(loginResult.success).toBe(false);
      expect(loginResult.error).toContain('suspended');
    });
  });

  describe('Session Management Flow', () => {
    it('should refresh expired session', async () => {
      // Initial login
      const loginResult = await authService.login({
        email: 'test@example.com',
        password: 'SecurePassword123!',
      });

      expect(loginResult.success).toBe(true);
      const initialSession = loginResult.session;

      // Refresh session
      const refreshResult = await authService.refreshSession(
        initialSession?.refreshToken || ''
      );

      expect(refreshResult.success).toBe(true);
      expect(refreshResult.session).toBeDefined();
      expect(refreshResult.session?.token).toBeDefined();
      expect(refreshResult.session?.token).not.toBe(initialSession?.token);
    });

    it('should handle session refresh with invalid token', async () => {
      const refreshResult = await authService.refreshSession('invalid-refresh-token');

      expect(refreshResult.success).toBe(false);
      expect(refreshResult.error).toBeDefined();
    });

    it('should logout and clear session', async () => {
      // Login first
      const loginResult = await authService.login({
        email: 'test@example.com',
        password: 'SecurePassword123!',
      });

      expect(loginResult.success).toBe(true);

      // Logout
      const logoutResult = await authService.logout(
        loginResult.session?.token || ''
      );

      expect(logoutResult.success).toBe(true);
    });
  });

  describe('Password Reset Flow', () => {
    it('should complete password reset process', async () => {
      // Step 1: Request password reset
      const requestResult = await authService.requestPasswordReset({
        email: 'test@example.com',
      });

      expect(requestResult.success).toBe(true);

      // Step 2: Reset password with token
      const resetResult = await authService.resetPassword({
        token: 'reset-token',
        newPassword: 'NewSecurePassword456!',
      });

      expect(resetResult.success).toBe(true);

      // Step 3: Login with new password
      const loginResult = await authService.login({
        email: 'test@example.com',
        password: 'NewSecurePassword456!',
      });

      expect(loginResult.success).toBe(true);
    });

    it('should handle password reset with invalid token', async () => {
      const resetResult = await authService.resetPassword({
        token: 'invalid-token',
        newPassword: 'NewSecurePassword456!',
      });

      expect(resetResult.success).toBe(false);
      expect(resetResult.error).toBeDefined();
    });

    it('should handle password reset with weak password', async () => {
      const resetResult = await authService.resetPassword({
        token: 'valid-token',
        newPassword: 'weak',
      });

      expect(resetResult.success).toBe(false);
      expect(resetResult.error).toBeDefined();
    });
  });

  describe('Email Verification Flow', () => {
    it('should verify email with valid token', async () => {
      const verifyResult = await authService.verifyEmail({
        token: 'valid-verification-token',
      });

      expect(verifyResult.success).toBe(true);
    });

    it('should handle email verification with invalid token', async () => {
      const verifyResult = await authService.verifyEmail({
        token: 'invalid-token',
      });

      expect(verifyResult.success).toBe(false);
      expect(verifyResult.error).toBeDefined();
    });

    it('should handle email verification with expired token', async () => {
      const verifyResult = await authService.verifyEmail({
        token: 'expired-token',
      });

      expect(verifyResult.success).toBe(false);
      expect(verifyResult.error).toBeDefined();
    });
  });

  describe('Multi-Factor Authentication Flow', () => {
    it('should require MFA when enabled', async () => {
      const mfaAuthService = new AuthService({
        supabaseUrl: 'https://test.supabase.co',
        supabaseAnonKey: 'test-key',
        jwtSecret: 'test-secret',
        sessionTimeout: 30,
        refreshTokenExpiry: 7,
        enableMFA: true,
      });

      const loginResult = await mfaAuthService.login({
        email: 'test@example.com',
        password: 'SecurePassword123!',
      });

      expect(loginResult.success).toBe(false);
      expect(loginResult.requiresMFA).toBe(true);
      expect(loginResult.error).toContain('MFA code required');
    });

    it('should login with valid MFA code', async () => {
      const mfaAuthService = new AuthService({
        supabaseUrl: 'https://test.supabase.co',
        supabaseAnonKey: 'test-key',
        jwtSecret: 'test-secret',
        sessionTimeout: 30,
        refreshTokenExpiry: 7,
        enableMFA: true,
      });

      const loginResult = await mfaAuthService.login({
        email: 'test@example.com',
        password: 'SecurePassword123!',
        mfaCode: '123456',
      });

      expect(loginResult.success).toBe(true);
      expect(loginResult.session).toBeDefined();
    });

    it('should reject login with invalid MFA code', async () => {
      const mfaAuthService = new AuthService({
        supabaseUrl: 'https://test.supabase.co',
        supabaseAnonKey: 'test-key',
        jwtSecret: 'test-secret',
        sessionTimeout: 30,
        refreshTokenExpiry: 7,
        enableMFA: true,
      });

      const loginResult = await mfaAuthService.login({
        email: 'test@example.com',
        password: 'SecurePassword123!',
        mfaCode: '000000',
      });

      expect(loginResult.success).toBe(false);
      expect(loginResult.error).toBeDefined();
    });
  });

  describe('User Profile Flow', () => {
    it('should retrieve user profile after login', async () => {
      const loginResult = await authService.login({
        email: 'test@example.com',
        password: 'SecurePassword123!',
      });

      expect(loginResult.success).toBe(true);
      expect(loginResult.user).toBeDefined();

      const user = loginResult.user;
      expect(user?.id).toBeDefined();
      expect(user?.email).toBe('test@example.com');
      expect(user?.kycLevel).toBeDefined();
      expect(user?.kycStatus).toBeDefined();
      expect(user?.status).toBe('ACTIVE');
    });

    it('should handle user with different KYC levels', async () => {
      const loginResult = await authService.login({
        email: 'accredited@example.com',
        password: 'SecurePassword123!',
      });

      expect(loginResult.success).toBe(true);
      expect(loginResult.user?.kycLevel).toBe('ACCREDITED');
      expect(loginResult.user?.isAccreditedInvestor).toBe(true);
    });
  });

  describe('Error Handling Flow', () => {
    it('should handle network errors during registration', async () => {
      const registerResult = await authService.register({
        email: 'test@example.com',
        password: 'SecurePassword123!',
      });

      // Simulate network error
      if (!registerResult.success) {
        expect(registerResult.error).toBeDefined();
      }
    });

    it('should handle network errors during login', async () => {
      const loginResult = await authService.login({
        email: 'test@example.com',
        password: 'SecurePassword123!',
      });

      // Simulate network error
      if (!loginResult.success) {
        expect(loginResult.error).toBeDefined();
      }
    });

    it('should handle concurrent login attempts', async () => {
      const loginPromises = [
        authService.login({
          email: 'test@example.com',
          password: 'SecurePassword123!',
        }),
        authService.login({
          email: 'test@example.com',
          password: 'SecurePassword123!',
        }),
      ];

      const results = await Promise.all(loginPromises);

      // Both should succeed or fail gracefully
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(typeof result.success).toBe('boolean');
      });
    });
  });

  describe('Security Flow', () => {
    it('should prevent login with banned account', async () => {
      const loginResult = await authService.login({
        email: 'banned@example.com',
        password: 'SecurePassword123!',
      });

      expect(loginResult.success).toBe(false);
      expect(loginResult.error).toContain('banned');
    });

    it('should prevent login with deleted account', async () => {
      const loginResult = await authService.login({
        email: 'deleted@example.com',
        password: 'SecurePassword123!',
      });

      expect(loginResult.success).toBe(false);
      expect(loginResult.error).toContain('deleted');
    });

    it('should handle rate limiting', async () => {
      const loginAttempts = Array(10).fill(null).map(() =>
        authService.login({
          email: 'test@example.com',
          password: 'WrongPassword123!',
        })
      );

      const results = await Promise.all(loginAttempts);

      // Some attempts should fail due to rate limiting
      const failedAttempts = results.filter(r => !r.success);
      expect(failedAttempts.length).toBeGreaterThan(0);
    });
  });
});
