import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '@/app/api/auth/[...nextauth]/route';
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

describe('Auth API Integration', () => {
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

  describe('AuthService Integration', () => {
    it('should register a new user successfully', async () => {
      const registerData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'User',
      };

      const result = await authService.register(registerData);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe('test@example.com');
      expect(result.session).toBeDefined();
    });

    it('should handle registration with existing email', async () => {
      const registerData = {
        email: 'existing@example.com',
        password: 'TestPassword123!',
      };

      const result = await authService.register(registerData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('should login user successfully', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'TestPassword123!',
      };

      const result = await authService.login(credentials);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.session).toBeDefined();
    });

    it('should handle login with invalid credentials', async () => {
      const credentials = {
        email: 'invalid@example.com',
        password: 'WrongPassword123!',
      };

      const result = await authService.login(credentials);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should logout user successfully', async () => {
      const result = await authService.logout('test-session-token');

      expect(result.success).toBe(true);
    });

    it('should refresh session successfully', async () => {
      const result = await authService.refreshSession('test-refresh-token');

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
    });

    it('should request password reset', async () => {
      const result = await authService.requestPasswordReset({
        email: 'test@example.com',
      });

      expect(result.success).toBe(true);
    });

    it('should reset password with valid token', async () => {
      const result = await authService.resetPassword({
        token: 'valid-token',
        newPassword: 'NewPassword123!',
      });

      expect(result.success).toBe(true);
    });

    it('should verify email with valid token', async () => {
      const result = await authService.verifyEmail({
        token: 'valid-token',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Auth Service Events', () => {
    it('should emit user_registered event on successful registration', async () => {
      const eventSpy = vi.fn();
      authService.on('user_registered', eventSpy);

      await authService.register({
        email: 'test@example.com',
        password: 'TestPassword123!',
      });

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should emit user_logged_in event on successful login', async () => {
      const eventSpy = vi.fn();
      authService.on('user_logged_in', eventSpy);

      await authService.login({
        email: 'test@example.com',
        password: 'TestPassword123!',
      });

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should emit user_logged_out event on successful logout', async () => {
      const eventSpy = vi.fn();
      authService.on('user_logged_out', eventSpy);

      await authService.logout('test-session-token');

      expect(eventSpy).toHaveBeenCalled();
    });
  });
});
