import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthService, AuthConfig, User, Session, LoginCredentials, RegisterData } from '../authService';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Mock EventEmitter methods
vi.mock('events', () => {
  const EventEmitter = class {
    private listeners: Map<string, Function[]> = new Map();
    
    on(event: string, listener: Function) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event)!.push(listener);
      return this;
    }
    
    off(event: string, listener: Function) {
      const listeners = this.listeners.get(event);
      if (listeners) {
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
      return this;
    }
    
    emit(event: string, ...args: any[]) {
      const listeners = this.listeners.get(event);
      if (listeners) {
        listeners.forEach(listener => listener(...args));
      }
      return true;
    }
    
    removeAllListeners(event?: string) {
      if (event) {
        this.listeners.delete(event);
      } else {
        this.listeners.clear();
      }
      return this;
    }
  };
  
  return { EventEmitter };
});

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      refreshSession: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      verifyOtp: vi.fn()
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn()
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn()
          }))
        })),
        update: vi.fn(() => ({
          eq: vi.fn()
        }))
      }))
    }))
  }))
}));

describe('AuthService', () => {
  let service: AuthService;
  let config: AuthConfig;
  let mockSupabase: any;
  
  beforeEach(() => {
    config = {
      supabaseUrl: 'https://test.supabase.co',
      supabaseAnonKey: 'test-anon-key',
      jwtSecret: 'test-jwt-secret',
      sessionTimeout: 60,
      refreshTokenExpiry: 7,
      enableMFA: false
    };
    
    service = new AuthService(config);
    mockSupabase = service['supabase'] as any;
  });

  describe('Constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(service).toBeInstanceOf(AuthService);
      expect(service['config'].supabaseUrl).toBe(config.supabaseUrl);
      expect(service['config'].sessionTimeout).toBe(60);
      expect(service['config'].enableMFA).toBe(false);
    });

    it('should create Supabase client', () => {
      expect(service['supabase']).toBeDefined();
    });
  });

  describe('login', () => {
    const credentials: LoginCredentials = {
      email: 'test@example.com',
      password: 'password123'
    };

    it('should login successfully', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: {
            id: 'user1',
            email: 'test@example.com'
          },
          session: {
            access_token: 'access-token',
            refresh_token: 'refresh-token'
          }
        },
        error: null
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: {
                id: 'user1',
                email: 'test@example.com',
                kyc_level: 'RETAIL',
                kyc_status: 'NOT_STARTED',
                status: 'ACTIVE',
                is_accredited_investor: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              },
              error: null
            }))
          }))
        }))
      });

      const result = await service.login(credentials);
      
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.session).toBeDefined();
      expect(result.user?.email).toBe('test@example.com');
    });

    it('should return error on failed login', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid login credentials' }
      });

      const result = await service.login(credentials);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid login credentials');
    });

    it('should return error when user data not found', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: {
            id: 'user1',
            email: 'test@example.com'
          },
          session: {
            access_token: 'access-token',
            refresh_token: 'refresh-token'
          }
        },
        error: null
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: null,
              error: null
            }))
          }))
        }))
      });

      const result = await service.login(credentials);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
    });

    it('should return error when user is not active', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: {
            id: 'user1',
            email: 'test@example.com'
          },
          session: {
            access_token: 'access-token',
            refresh_token: 'refresh-token'
          }
        },
        error: null
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: {
                id: 'user1',
                email: 'test@example.com',
                kyc_level: 'RETAIL',
                kyc_status: 'NOT_STARTED',
                status: 'SUSPENDED',
                is_accredited_investor: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              },
              error: null
            }))
          }))
        }))
      });

      const result = await service.login(credentials);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Account is suspended');
    });

    it('should require MFA when enabled', async () => {
      const mfaConfig = { ...config, enableMFA: true };
      const mfaService = new AuthService(mfaConfig);
      const mfaMockSupabase = mfaService['supabase'] as any;

      mfaMockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: {
            id: 'user1',
            email: 'test@example.com'
          },
          session: {
            access_token: 'access-token',
            refresh_token: 'refresh-token'
          }
        },
        error: null
      });

      mfaMockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: {
                id: 'user1',
                email: 'test@example.com',
                kyc_level: 'RETAIL',
                kyc_status: 'NOT_STARTED',
                status: 'ACTIVE',
                is_accredited_investor: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              },
              error: null
            }))
          }))
        }))
      });

      const result = await mfaService.login(credentials);
      
      expect(result.success).toBe(false);
      expect(result.requiresMFA).toBe(true);
      expect(result.error).toBe('MFA code required');
    });

    it('should emit user_logged_in event', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: {
            id: 'user1',
            email: 'test@example.com'
          },
          session: {
            access_token: 'access-token',
            refresh_token: 'refresh-token'
          }
        },
        error: null
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: {
                id: 'user1',
                email: 'test@example.com',
                kyc_level: 'RETAIL',
                kyc_status: 'NOT_STARTED',
                status: 'ACTIVE',
                is_accredited_investor: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              },
              error: null
            }))
          }))
        }))
      });

      const eventSpy = vi.fn();
      service.on('user_logged_in', eventSpy);

      await service.login(credentials);
      
      expect(eventSpy).toHaveBeenCalledWith({
        userId: 'user1',
        email: 'test@example.com'
      });
    });
  });

  describe('register', () => {
    const data: RegisterData = {
      email: 'newuser@example.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe'
    };

    it('should register successfully', async () => {
      const userData = {
        id: 'user1',
        email: 'newuser@example.com',
        first_name: 'John',
        last_name: 'Doe',
        kyc_level: 'RETAIL',
        kyc_status: 'NOT_STARTED',
        status: 'ACTIVE',
        is_accredited_investor: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: null }))
          }))
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: userData, error: null }))
          }))
        }))
      });

      mockSupabase.auth.signUp.mockResolvedValue({
        data: {
          user: { id: 'user1', email: 'newuser@example.com' },
          session: { access_token: 'access-token', refresh_token: 'refresh-token' }
        },
        error: null
      });

      const result = await service.register(data);
      
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.session).toBeDefined();
      expect(result.user?.email).toBe('newuser@example.com');
    });

    it('should return error when user already exists', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: { id: 'existing-user' },
              error: null
            }))
          }))
        }))
      });

      const result = await service.register(data);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('User already exists');
    });

    it('should return error on failed registration', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: null,
              error: null
            }))
          }))
        }))
      });

      mockSupabase.auth.signUp.mockResolvedValue({
        data: null,
        error: { message: 'Registration failed' }
      });

      const result = await service.register(data);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Registration failed');
    });

    it('should emit user_registered event', async () => {
      const userData = {
        id: 'user1',
        email: 'newuser@example.com',
        first_name: 'John',
        last_name: 'Doe',
        kyc_level: 'RETAIL',
        kyc_status: 'NOT_STARTED',
        status: 'ACTIVE',
        is_accredited_investor: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: null }))
          }))
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: userData, error: null }))
          }))
        }))
      });

      mockSupabase.auth.signUp.mockResolvedValue({
        data: {
          user: { id: 'user1', email: 'newuser@example.com' },
          session: { access_token: 'access-token', refresh_token: 'refresh-token' }
        },
        error: null
      });

      const eventSpy = vi.fn();
      service.on('user_registered', eventSpy);

      await service.register(data);
      
      expect(eventSpy).toHaveBeenCalledWith({
        userId: 'user1',
        email: 'newuser@example.com'
      });
    });
  });

  describe('logout', () => {
    beforeEach(() => {
      // Create a session
      service['sessions'].set('test-token', {
        userId: 'user1',
        email: 'test@example.com',
        token: 'test-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        kycLevel: 'RETAIL',
        permissions: ['view_treasury_bills']
      });
    });

    it('should logout successfully', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({
        error: null
      });

      const result = await service.logout('test-token');
      
      expect(result.success).toBe(true);
      expect(service['sessions'].has('test-token')).toBe(false);
    });

    it('should return error on failed logout', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({
        error: { message: 'Logout failed' }
      });

      const result = await service.logout('test-token');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Logout failed');
    });

    it('should emit user_logged_out event', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({
        error: null
      });

      const eventSpy = vi.fn();
      service.on('user_logged_out', eventSpy);

      await service.logout('test-token');
      
      expect(eventSpy).toHaveBeenCalledWith({
        sessionToken: 'test-token'
      });
    });
  });

  describe('refreshSession', () => {
    it('should refresh session successfully', async () => {
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: {
          user: {
            id: 'user1',
            email: 'test@example.com'
          },
          session: {
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token'
          }
        },
        error: null
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: {
                id: 'user1',
                email: 'test@example.com',
                kyc_level: 'RETAIL',
                kyc_status: 'NOT_STARTED',
                status: 'ACTIVE',
                is_accredited_investor: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              },
              error: null
            }))
          }))
        }))
      });

      const result = await service.refreshSession('refresh-token');
      
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.session).toBeDefined();
    });

    it('should return error on failed refresh', async () => {
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: null,
        error: { message: 'Refresh failed' }
      });

      const result = await service.refreshSession('refresh-token');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Refresh failed');
    });

    it('should emit session_refreshed event', async () => {
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: {
          user: {
            id: 'user1',
            email: 'test@example.com'
          },
          session: {
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token'
          }
        },
        error: null
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: {
                id: 'user1',
                email: 'test@example.com',
                kyc_level: 'RETAIL',
                kyc_status: 'NOT_STARTED',
                status: 'ACTIVE',
                is_accredited_investor: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              },
              error: null
            }))
          }))
        }))
      });

      const eventSpy = vi.fn();
      service.on('session_refreshed', eventSpy);

      await service.refreshSession('refresh-token');
      
      expect(eventSpy).toHaveBeenCalledWith({
        userId: 'user1'
      });
    });
  });

  describe('requestPasswordReset', () => {
    it('should request password reset successfully', async () => {
      mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({
        error: null
      });

      const result = await service.requestPasswordReset({
        email: 'test@example.com'
      });
      
      expect(result.success).toBe(true);
    });

    it('should return error on failed request', async () => {
      mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({
        error: { message: 'Request failed' }
      });

      const result = await service.requestPasswordReset({
        email: 'test@example.com'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Request failed');
    });

    it('should emit password_reset_requested event', async () => {
      mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({
        error: null
      });

      const eventSpy = vi.fn();
      service.on('password_reset_requested', eventSpy);

      await service.requestPasswordReset({
        email: 'test@example.com'
      });
      
      expect(eventSpy).toHaveBeenCalledWith({
        email: 'test@example.com'
      });
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      mockSupabase.auth.updateUser.mockResolvedValue({
        error: null
      });

      const result = await service.resetPassword({
        token: 'reset-token',
        newPassword: 'newpassword123'
      });
      
      expect(result.success).toBe(true);
    });

    it('should return error on failed reset', async () => {
      mockSupabase.auth.updateUser.mockResolvedValue({
        error: { message: 'Reset failed' }
      });

      const result = await service.resetPassword({
        token: 'reset-token',
        newPassword: 'newpassword123'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Reset failed');
    });

    it('should emit password_reset_completed event', async () => {
      mockSupabase.auth.updateUser.mockResolvedValue({
        error: null
      });

      const eventSpy = vi.fn();
      service.on('password_reset_completed', eventSpy);

      await service.resetPassword({
        token: 'reset-token',
        newPassword: 'newpassword123'
      });
      
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    it('should verify email successfully', async () => {
      mockSupabase.auth.verifyOtp.mockResolvedValue({
        error: null
      });

      const result = await service.verifyEmail({
        token: 'verify-token'
      });
      
      expect(result.success).toBe(true);
    });

    it('should return error on failed verification', async () => {
      mockSupabase.auth.verifyOtp.mockResolvedValue({
        error: { message: 'Verification failed' }
      });

      const result = await service.verifyEmail({
        token: 'verify-token'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Verification failed');
    });

    it('should emit email_verified event', async () => {
      mockSupabase.auth.verifyOtp.mockResolvedValue({
        error: null
      });

      const eventSpy = vi.fn();
      service.on('email_verified', eventSpy);

      await service.verifyEmail({
        token: 'verify-token'
      });
      
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('getSession', () => {
    beforeEach(() => {
      service['sessions'].set('test-token', {
        userId: 'user1',
        email: 'test@example.com',
        token: 'test-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        kycLevel: 'RETAIL',
        permissions: ['view_treasury_bills']
      });
    });

    it('should get session by token', () => {
      const result = service.getSession('test-token');
      
      expect(result).toBeDefined();
      expect(result?.userId).toBe('user1');
      expect(result?.email).toBe('test@example.com');
    });

    it('should return undefined for non-existent session', () => {
      const result = service.getSession('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('validateSession', () => {
    beforeEach(() => {
      service['sessions'].set('valid-token', {
        userId: 'user1',
        email: 'test@example.com',
        token: 'valid-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        kycLevel: 'RETAIL',
        permissions: ['view_treasury_bills']
      });

      service['sessions'].set('expired-token', {
        userId: 'user2',
        email: 'expired@example.com',
        token: 'expired-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() - 3600000).toISOString(),
        kycLevel: 'RETAIL',
        permissions: ['view_treasury_bills']
      });
    });

    it('should validate valid session', () => {
      const result = service.validateSession('valid-token');
      
      expect(result.valid).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.id).toBe('user1');
    });

    it('should invalidate expired session', () => {
      const result = service.validateSession('expired-token');
      
      expect(result.valid).toBe(false);
      expect(result.user).toBeUndefined();
      expect(service['sessions'].has('expired-token')).toBe(false);
    });

    it('should invalidate non-existent session', () => {
      const result = service.validateSession('non-existent');
      
      expect(result.valid).toBe(false);
      expect(result.user).toBeUndefined();
    });
  });

  describe('hasPermission', () => {
    let session: Session;

    beforeEach(() => {
      session = {
        userId: 'user1',
        email: 'test@example.com',
        token: 'test-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        kycLevel: 'RETAIL',
        permissions: ['view_treasury_bills', 'purchase_treasury_bills_retail']
      };
    });

    it('should return true when user has permission', () => {
      const result = service.hasPermission(session, 'view_treasury_bills');
      expect(result).toBe(true);
    });

    it('should return false when user does not have permission', () => {
      const result = service.hasPermission(session, 'access_privacy_vaults');
      expect(result).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    let session: Session;

    beforeEach(() => {
      session = {
        userId: 'user1',
        email: 'test@example.com',
        token: 'test-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        kycLevel: 'RETAIL',
        permissions: ['view_treasury_bills', 'purchase_treasury_bills_retail']
      };
    });

    it('should return true when user has any of the permissions', () => {
      const result = service.hasAnyPermission(session, ['view_treasury_bills', 'access_privacy_vaults']);
      expect(result).toBe(true);
    });

    it('should return false when user has none of the permissions', () => {
      const result = service.hasAnyPermission(session, ['access_privacy_vaults', 'access_real_estate']);
      expect(result).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    let session: Session;

    beforeEach(() => {
      session = {
        userId: 'user1',
        email: 'test@example.com',
        token: 'test-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        kycLevel: 'RETAIL',
        permissions: ['view_treasury_bills', 'purchase_treasury_bills_retail']
      };
    });

    it('should return true when user has all permissions', () => {
      const result = service.hasAllPermissions(session, ['view_treasury_bills', 'purchase_treasury_bills_retail']);
      expect(result).toBe(true);
    });

    it('should return false when user does not have all permissions', () => {
      const result = service.hasAllPermissions(session, ['view_treasury_bills', 'access_privacy_vaults']);
      expect(result).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty email', async () => {
      const result = await service.login({
        email: '',
        password: 'password123'
      });
      
      expect(result.success).toBe(false);
    });

    it('should handle empty password', async () => {
      const result = await service.login({
        email: 'test@example.com',
        password: ''
      });
      
      expect(result.success).toBe(false);
    });

    it('should handle invalid email format', async () => {
      const result = await service.login({
        email: 'invalid-email',
        password: 'password123'
      });
      
      expect(result.success).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockSupabase.auth.signInWithPassword.mockRejectedValue(new Error('Network error'));

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle timeout errors gracefully', async () => {
      mockSupabase.auth.signInWithPassword.mockRejectedValue(new Error('Timeout'));

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
