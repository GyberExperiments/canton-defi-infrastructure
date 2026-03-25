import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthService } from '@/lib/canton/services/authService';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    refreshSession: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    verifyOtp: vi.fn(),
    getUser: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(),
        data: null,
        error: null,
      })),
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
    })),
  })),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

describe('AuthService ↔ Supabase Integration', () => {
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

  describe('User Registration with Supabase', () => {
    it('should register user with Supabase Auth', async () => {
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
          },
          session: {
            access_token: 'access-token',
            refresh_token: 'refresh-token',
          },
        },
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          })),
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'user-123',
                email: 'test@example.com',
                kyc_level: 'RETAIL',
                kyc_status: 'NOT_STARTED',
                status: 'ACTIVE',
                is_accredited_investor: false,
              },
              error: null,
            }),
          })),
        })),
      });

      const result = await authService.register({
        email: 'test@example.com',
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'User',
      });

      expect(result.success).toBe(true);
      expect(result.user?.email).toBe('test@example.com');
      expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'TestPassword123!',
      });
    });

    it('should handle Supabase Auth error during registration', async () => {
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Email already registered' },
      });

      const result = await authService.register({
        email: 'existing@example.com',
        password: 'TestPassword123!',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Email already registered');
    });

    it('should handle Supabase database error during user creation', async () => {
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
          },
          session: {
            access_token: 'access-token',
            refresh_token: 'refresh-token',
          },
        },
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          })),
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            }),
          })),
        })),
      });

      const result = await authService.register({
        email: 'test@example.com',
        password: 'TestPassword123!',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to create user record');
    });
  });

  describe('User Login with Supabase', () => {
    it('should login user with Supabase Auth', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
          },
          session: {
            access_token: 'access-token',
            refresh_token: 'refresh-token',
          },
        },
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'user-123',
                email: 'test@example.com',
                kyc_level: 'RETAIL',
                kyc_status: 'NOT_STARTED',
                status: 'ACTIVE',
                is_accredited_investor: false,
              },
              error: null,
            }),
          })),
        })),
      });

      const result = await authService.login({
        email: 'test@example.com',
        password: 'TestPassword123!',
      });

      expect(result.success).toBe(true);
      expect(result.user?.email).toBe('test@example.com');
      expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'TestPassword123!',
      });
    });

    it('should handle invalid credentials', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

      const result = await authService.login({
        email: 'invalid@example.com',
        password: 'WrongPassword123!',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid login credentials');
    });

    it('should handle suspended user account', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'suspended@example.com',
          },
          session: {
            access_token: 'access-token',
            refresh_token: 'refresh-token',
          },
        },
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'user-123',
                email: 'suspended@example.com',
                kyc_level: 'RETAIL',
                kyc_status: 'NOT_STARTED',
                status: 'SUSPENDED',
                is_accredited_investor: false,
              },
              error: null,
            }),
          })),
        })),
      });

      const result = await authService.login({
        email: 'suspended@example.com',
        password: 'TestPassword123!',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('suspended');
    });
  });

  describe('Session Management with Supabase', () => {
    it('should refresh session with Supabase', async () => {
      mockSupabaseClient.auth.refreshSession.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
          },
          session: {
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
          },
        },
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'user-123',
                email: 'test@example.com',
                kyc_level: 'RETAIL',
                kyc_status: 'NOT_STARTED',
                status: 'ACTIVE',
                is_accredited_investor: false,
              },
              error: null,
            }),
          })),
        })),
      });

      const result = await authService.refreshSession('refresh-token');

      expect(result.success).toBe(true);
      expect(result.session?.token).toBe('new-access-token');
      expect(mockSupabaseClient.auth.refreshSession).toHaveBeenCalledWith({
        refresh_token: 'refresh-token',
      });
    });

    it('should logout user with Supabase', async () => {
      mockSupabaseClient.auth.signOut.mockResolvedValue({
        error: null,
      });

      const result = await authService.logout('session-token');

      expect(result.success).toBe(true);
      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();
    });
  });

  describe('Password Reset with Supabase', () => {
    it('should request password reset with Supabase', async () => {
      mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValue({
        error: null,
      });

      const result = await authService.requestPasswordReset({
        email: 'test@example.com',
      });

      expect(result.success).toBe(true);
      expect(mockSupabaseClient.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.any(Object)
      );
    });

    it('should reset password with Supabase', async () => {
      mockSupabaseClient.auth.updateUser.mockResolvedValue({
        error: null,
      });

      const result = await authService.resetPassword({
        token: 'valid-token',
        newPassword: 'NewPassword123!',
      });

      expect(result.success).toBe(true);
      expect(mockSupabaseClient.auth.updateUser).toHaveBeenCalledWith({
        password: 'NewPassword123!',
      });
    });
  });

  describe('Email Verification with Supabase', () => {
    it('should verify email with Supabase', async () => {
      mockSupabaseClient.auth.verifyOtp.mockResolvedValue({
        error: null,
      });

      const result = await authService.verifyEmail({
        token: 'valid-token',
      });

      expect(result.success).toBe(true);
      expect(mockSupabaseClient.auth.verifyOtp).toHaveBeenCalledWith({
        token: 'valid-token',
        type: 'email',
      });
    });
  });

  describe('User Data Retrieval from Supabase', () => {
    it('should retrieve user data from Supabase database', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'user-123',
                email: 'test@example.com',
                first_name: 'Test',
                last_name: 'User',
                kyc_level: 'ACCREDITED',
                kyc_status: 'APPROVED',
                status: 'ACTIVE',
                is_accredited_investor: true,
              },
              error: null,
            }),
          })),
        })),
      });

      const userData = await (authService as any).getUserData('user-123');

      expect(userData).toBeDefined();
      expect(userData.email).toBe('test@example.com');
      expect(userData.kycLevel).toBe('ACCREDITED');
    });

    it('should handle user not found in database', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'User not found' },
            }),
          })),
        })),
      });

      const userData = await (authService as any).getUserData('nonexistent-user');

      expect(userData).toBeNull();
    });
  });
});
