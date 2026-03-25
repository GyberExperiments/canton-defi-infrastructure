'use client';

/**
 * 🔐 AUTH LOGIN API ROUTE
 * 
 * API endpoints для аутентификации:
 * - POST /api/defi/auth/login - Вход в систему
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuthService, LoginCredentials } from '@/lib/canton/services/authService';

// Initialize service
let authService: AuthService | null = null;

function getAuthService(): AuthService {
  if (!authService) {
    authService = new AuthService({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      jwtSecret: process.env.JWT_SECRET || '',
      sessionTimeout: 60, // 1 hour
      refreshTokenExpiry: 30, // 30 days
      enableMFA: false
    });
  }
  
  return authService;
}

/**
 * POST /api/defi/auth/login
 * Вход в систему
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔐 POST /api/defi/auth/login');
    
    const body = await request.json();
    
    // Validate required fields
    if (!body.email || !body.password) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: email, password'
        },
        { status: 400 }
      );
    }
    
    const credentials: LoginCredentials = {
      email: body.email,
      password: body.password,
      mfaCode: body.mfaCode
    };
    
    const service = getAuthService();
    const result = await service.login(credentials);
    
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          requiresMFA: result.requiresMFA
        },
        { status: 401 }
      );
    }
    
    // Set session cookie
    const response = NextResponse.json({
      success: true,
      user: result.user,
      message: 'Login successful'
    });
    
    if (result.session) {
      response.cookies.set('session_token', result.session.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        expires: new Date(result.session.expiresAt),
        path: '/'
      });
      
      response.cookies.set('refresh_token', result.session.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        path: '/'
      });
    }
    
    return response;
    
  } catch (error: any) {
    console.error('❌ Error in POST /api/defi/auth/login:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Login failed'
      },
      { status: 500 }
    );
  }
}
