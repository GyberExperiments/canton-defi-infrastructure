'use client';

/**
 * 🔐 AUTH REGISTER API ROUTE
 * 
 * API endpoints для регистрации:
 * - POST /api/defi/auth/register - Регистрация нового пользователя
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuthService, RegisterData } from '@/lib/canton/services/authService';

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
 * POST /api/defi/auth/register
 * Регистрация нового пользователя
 */
export async function POST(request: NextRequest) {
  try {
    console.log('📝 POST /api/defi/auth/register');
    
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
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid email format'
        },
        { status: 400 }
      );
    }
    
    // Validate password strength
    if (body.password.length < 8) {
      return NextResponse.json(
        {
          success: false,
          error: 'Password must be at least 8 characters long'
        },
        { status: 400 }
      );
    }
    
    const registerData: RegisterData = {
      email: body.email,
      password: body.password,
      firstName: body.firstName,
      lastName: body.lastName,
      walletAddress: body.walletAddress
    };
    
    const service = getAuthService();
    const result = await service.register(registerData);
    
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error
        },
        { status: 400 }
      );
    }
    
    // Set session cookie
    const response = NextResponse.json({
      success: true,
      user: result.user,
      message: 'Registration successful'
    }, { status: 201 });
    
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
    console.error('❌ Error in POST /api/defi/auth/register:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Registration failed'
      },
      { status: 500 }
    );
  }
}
