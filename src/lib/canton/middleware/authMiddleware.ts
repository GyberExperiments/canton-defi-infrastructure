'use client';

/**
 * 🛡️ AUTH MIDDLEWARE 2025
 * 
 * Middleware для защиты API routes:
 * - Валидация JWT токенов
 * - Проверка KYC уровня
 * - Проверка permissions
 * - Rate limiting
 * - IP whitelist/blacklist
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuthService, Session } from '../services/authService';

// ========================================
// MIDDLEWARE CONFIG
// ========================================

export interface AuthMiddlewareConfig {
  requireAuth: boolean;
  requireKYC?: 'RETAIL' | 'ACCREDITED' | 'INSTITUTIONAL' | 'ULTRA_HNW';
  requirePermissions?: string[];
  requireAnyPermission?: string[];
  requireAllPermissions?: string[];
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
  ipWhitelist?: string[];
  ipBlacklist?: string[];
}

// ========================================
// RATE LIMITING
// ========================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

function checkRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);
  
  if (!entry || now > entry.resetAt) {
    // Create new entry or reset expired entry
    rateLimitMap.set(identifier, {
      count: 1,
      resetAt: now + windowMs
    });
    
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: now + windowMs
    };
  }
  
  // Increment count
  entry.count++;
  
  if (entry.count > maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt
    };
  }
  
  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetAt: entry.resetAt
  };
}

// ========================================
// IP VALIDATION
// ========================================

function validateIP(
  ip: string,
  whitelist?: string[],
  blacklist?: string[]
): { valid: boolean; reason?: string } {
  // Check blacklist first
  if (blacklist && blacklist.length > 0) {
    for (const blockedIP of blacklist) {
      if (ip === blockedIP || ip.startsWith(blockedIP)) {
        return {
          valid: false,
          reason: 'IP is blacklisted'
        };
      }
    }
  }
  
  // Check whitelist if configured
  if (whitelist && whitelist.length > 0) {
    let allowed = false;
    for (const allowedIP of whitelist) {
      if (ip === allowedIP || ip.startsWith(allowedIP)) {
        allowed = true;
        break;
      }
    }
    
    if (!allowed) {
      return {
        valid: false,
        reason: 'IP is not whitelisted'
      };
    }
  }
  
  return { valid: true };
}

// ========================================
// AUTH MIDDLEWARE FUNCTION
// ========================================

export async function authMiddleware(
  request: NextRequest,
  config: AuthMiddlewareConfig,
  authService: AuthService
): Promise<NextResponse | null> {
  // Get client IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
             request.headers.get('x-real-ip') ||
             'unknown';
  
  // Validate IP
  const ipValidation = validateIP(ip, config.ipWhitelist, config.ipBlacklist);
  if (!ipValidation.valid) {
    return NextResponse.json(
      {
        success: false,
        error: ipValidation.reason || 'Access denied'
      },
      { status: 403 }
    );
  }
  
  // Rate limiting
  if (config.rateLimit) {
    const rateLimitResult = checkRateLimit(
      ip,
      config.rateLimit.maxRequests,
      config.rateLimit.windowMs
    );
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: rateLimitResult.resetAt
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': config.rateLimit.maxRequests.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetAt.toString()
          }
        }
      );
    }
  }
  
  // Check if auth is required
  if (config.requireAuth) {
    const sessionToken = request.cookies.get('session_token')?.value;
    
    if (!sessionToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required'
        },
        { status: 401 }
      );
    }
    
    // Validate session
    const sessionValidation = authService.validateSession(sessionToken);
    
    if (!sessionValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or expired session'
        },
        { status: 401 }
      );
    }
    
    const session = sessionValidation.user as any;
    
    // Check KYC level if required
    if (config.requireKYC) {
      const kycLevels = ['RETAIL', 'ACCREDITED', 'INSTITUTIONAL', 'ULTRA_HNW'];
      const requiredLevelIndex = kycLevels.indexOf(config.requireKYC);
      const userLevelIndex = kycLevels.indexOf(session.kycLevel);
      
      if (userLevelIndex < requiredLevelIndex) {
        return NextResponse.json(
          {
            success: false,
            error: `KYC level ${config.requireKYC} required`,
            currentKYCLevel: session.kycLevel
          },
          { status: 403 }
        );
      }
    }
    
    // Check permissions if required
    if (config.requirePermissions && config.requirePermissions.length > 0) {
      const hasAllPermissions = authService.hasAllPermissions(
        session as Session,
        config.requirePermissions
      );
      
      if (!hasAllPermissions) {
        return NextResponse.json(
          {
            success: false,
            error: 'Insufficient permissions',
            requiredPermissions: config.requirePermissions
          },
          { status: 403 }
        );
      }
    }
    
    // Check if user has any of the required permissions
    if (config.requireAnyPermission && config.requireAnyPermission.length > 0) {
      const hasAnyPermission = authService.hasAnyPermission(
        session as Session,
        config.requireAnyPermission
      );
      
      if (!hasAnyPermission) {
        return NextResponse.json(
          {
            success: false,
            error: 'Insufficient permissions',
            requiredPermissions: config.requireAnyPermission
          },
          { status: 403 }
        );
      }
    }
  }
  
  // All checks passed, allow request to proceed
  return null;
}

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Create auth middleware wrapper for API routes
 */
export function withAuth(
  handler: (request: NextRequest, context: any) => Promise<NextResponse>,
  config: AuthMiddlewareConfig = { requireAuth: true }
) {
  return async (request: NextRequest, context: any) => {
    // Import AuthService dynamically to avoid circular dependencies
    const { AuthService } = await import('../services/authService');
    
    const authService = new AuthService({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      jwtSecret: process.env.JWT_SECRET || '',
      sessionTimeout: 60,
      refreshTokenExpiry: 30,
      enableMFA: false
    });
    
    // Run middleware checks
    const middlewareResult = await authMiddleware(request, config, authService);
    
    // If middleware returned a response, return it
    if (middlewareResult) {
      return middlewareResult;
    }
    
    // Otherwise, proceed to handler
    return handler(request, context);
  };
}

/**
 * Create auth middleware with specific KYC level requirement
 */
export function withKYCLevel(
  handler: (request: NextRequest, context: any) => Promise<NextResponse>,
  kycLevel: 'RETAIL' | 'ACCREDITED' | 'INSTITUTIONAL' | 'ULTRA_HNW'
) {
  return withAuth(handler, {
    requireAuth: true,
    requireKYC: kycLevel
  });
}

/**
 * Create auth middleware with specific permission requirements
 */
export function withPermissions(
  handler: (request: NextRequest, context: any) => Promise<NextResponse>,
  permissions: string[],
  requireAll: boolean = true
) {
  return withAuth(handler, {
    requireAuth: true,
    ...(requireAll ? { requireAllPermissions: permissions } : { requireAnyPermission: permissions })
  });
}

/**
 * Create rate-limited middleware
 */
export function withRateLimit(
  handler: (request: NextRequest, context: any) => Promise<NextResponse>,
  maxRequests: number = 100,
  windowMs: number = 60000 // 1 minute
) {
  return async (request: NextRequest, context: any) => {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') ||
               'unknown';
    
    const rateLimitResult = checkRateLimit(ip, maxRequests, windowMs);
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: rateLimitResult.resetAt
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': maxRequests.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetAt.toString()
          }
        }
      );
    }
    
    return handler(request, context);
  };
}
