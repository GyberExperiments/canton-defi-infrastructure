/**
 * 🛡️ Rate Limiting Service
 * Production-ready protection against spam and abuse
 */

import { RateLimiterMemory } from 'rate-limiter-flexible';

// Configuration interface for future use
// interface RateLimitConfig {
//   points: number; // Number of requests
//   duration: number; // Per duration in seconds
//   blockDuration: number; // Block duration in seconds
// }

interface RateLimitResult {
  allowed: boolean;
  remainingPoints?: number;
  msBeforeNext?: number;
}

class RateLimiterService {
  private orderCreationLimiter!: RateLimiterMemory;
  private ipLimiter!: RateLimiterMemory;
  private emailLimiter!: RateLimiterMemory;
  private dexLimiter!: RateLimiterMemory;

  constructor() {
    this.initializeLimiters();
  }

  private initializeLimiters() {
    // Order creation limits - configurable via environment variables
    this.orderCreationLimiter = new RateLimiterMemory({
      points: parseInt(process.env.RATE_LIMIT_ORDER_POINTS || '3'), // orders per duration
      duration: parseInt(process.env.RATE_LIMIT_ORDER_DURATION || '3600'), // per duration in seconds
      blockDuration: parseInt(process.env.RATE_LIMIT_ORDER_BLOCK || '3600'), // block duration in seconds
    });

    // General IP limits - configurable via environment variables
    this.ipLimiter = new RateLimiterMemory({
      points: parseInt(process.env.RATE_LIMIT_IP_POINTS || '100'), // requests per duration
      duration: parseInt(process.env.RATE_LIMIT_IP_DURATION || '900'), // per duration in seconds
      blockDuration: parseInt(process.env.RATE_LIMIT_IP_BLOCK || '300'), // block duration in seconds
    });

    // Email-based limits - configurable via environment variables
    this.emailLimiter = new RateLimiterMemory({
      points: parseInt(process.env.RATE_LIMIT_EMAIL_POINTS || '5'), // orders per email per duration
      duration: parseInt(process.env.RATE_LIMIT_EMAIL_DURATION || '86400'), // per duration in seconds
      blockDuration: parseInt(process.env.RATE_LIMIT_EMAIL_BLOCK || '43200'), // block duration in seconds
    });

    // DEX operation limits - configurable via environment variables
    this.dexLimiter = new RateLimiterMemory({
      points: parseInt(process.env.RATE_LIMIT_DEX_POINTS || '20'), // 20 requests per duration
      duration: parseInt(process.env.RATE_LIMIT_DEX_DURATION || '300'), // 5 minutes
      blockDuration: parseInt(process.env.RATE_LIMIT_DEX_BLOCK || '300'), // 5 minutes block
    });

    console.log('🛡️ Rate limiting configured:', {
      order: `${process.env.RATE_LIMIT_ORDER_POINTS || '3'} orders per ${process.env.RATE_LIMIT_ORDER_DURATION || '3600'}s`,
      ip: `${process.env.RATE_LIMIT_IP_POINTS || '100'} requests per ${process.env.RATE_LIMIT_IP_DURATION || '900'}s`,
      email: `${process.env.RATE_LIMIT_EMAIL_POINTS || '5'} orders per email per ${process.env.RATE_LIMIT_EMAIL_DURATION || '86400'}s`,
      dex: `${process.env.RATE_LIMIT_DEX_POINTS || '20'} requests per ${process.env.RATE_LIMIT_DEX_DURATION || '300'}s`
    });
  }

  /**
   * Check order creation rate limit
   */
  async checkOrderCreationLimit(ip: string, email: string): Promise<RateLimitResult> {
    try {
      // Check IP limit
      const ipResult = await this.orderCreationLimiter.consume(ip);
      
      // Check email limit
      const emailResult = await this.emailLimiter.consume(email.toLowerCase());

      return {
        allowed: true,
        remainingPoints: Math.min(ipResult.remainingPoints || 0, emailResult.remainingPoints || 0),
        msBeforeNext: Math.max(ipResult.msBeforeNext || 0, emailResult.msBeforeNext || 0),
      };

    } catch (rateLimiterRes: unknown) {
      // Rate limit exceeded
      return {
        allowed: false,
        remainingPoints: 0,
        msBeforeNext: (rateLimiterRes as { msBeforeNext?: number })?.msBeforeNext || 0,
      };
    }
  }

  /**
   * Check general API rate limit
   */
  async checkApiLimit(ip: string): Promise<RateLimitResult> {
    try {
      const result = await this.ipLimiter.consume(ip);
      
      return {
        allowed: true,
        remainingPoints: result.remainingPoints,
        msBeforeNext: result.msBeforeNext,
      };

    } catch (rateLimiterRes: unknown) {
      return {
        allowed: false,
        remainingPoints: 0,
        msBeforeNext: (rateLimiterRes as { msBeforeNext?: number })?.msBeforeNext || 0,
      };
    }
  }

  /**
   * Check DEX operation rate limit (swap/bridge)
   * More permissive than order creation, but still protected
   */
  async checkDexLimit(ip: string, userAccount?: string): Promise<RateLimitResult> {
    try {
      const key = userAccount ? `${ip}:${userAccount}` : ip;
      const result = await this.dexLimiter.consume(key);
      
      return {
        allowed: true,
        remainingPoints: result.remainingPoints,
        msBeforeNext: result.msBeforeNext,
      };

    } catch (rateLimiterRes: unknown) {
      return {
        allowed: false,
        remainingPoints: 0,
        msBeforeNext: (rateLimiterRes as { msBeforeNext?: number })?.msBeforeNext || 0,
      };
    }
  }

  /**
   * Reset limits for a specific key (admin function)
   */
  async resetLimits(ip: string, email?: string): Promise<boolean> {
    try {
      await this.ipLimiter.delete(ip);
      await this.orderCreationLimiter.delete(ip);
      
      if (email) {
        await this.emailLimiter.delete(email.toLowerCase());
      }

      console.log('Rate limits reset for:', ip, email);
      return true;

    } catch (error) {
      console.error('Failed to reset rate limits:', error);
      return false;
    }
  }

  /**
   * Get current limit status
   */
  async getLimitStatus(ip: string, email?: string): Promise<Record<string, { remaining: number; reset: Date }>> {
    try {
      const ipRes = await this.ipLimiter.get(ip);
      const orderRes = await this.orderCreationLimiter.get(ip);
      
      const result: Record<string, { remaining: number; reset: Date }> = {
        ip: {
          remaining: ipRes?.remainingPoints ?? 100,
          reset: new Date(Date.now() + (ipRes?.msBeforeNext ?? 0))
        },
        order: {
          remaining: orderRes?.remainingPoints ?? 3,
          reset: new Date(Date.now() + (orderRes?.msBeforeNext ?? 0))
        }
      };

      if (email) {
        const emailRes = await this.emailLimiter.get(email.toLowerCase());
        result.email = {
          remaining: emailRes?.remainingPoints ?? 5,
          reset: new Date(Date.now() + (emailRes?.msBeforeNext ?? 0))
        };
      }

      return result;

    } catch (error) {
      console.error('Failed to get limit status:', error);
      return {
        ip: { remaining: 0, reset: new Date() },
        order: { remaining: 0, reset: new Date() }
      };
    }
  }

  /**
   * Format rate limit error message
   */
  formatLimitExceededMessage(result: RateLimitResult): string {
    const waitTime = Math.ceil((result.msBeforeNext || 0) / 1000 / 60); // minutes
    
    if (waitTime < 1) {
      return 'Rate limit exceeded. Please wait a moment and try again.';
    } else if (waitTime < 60) {
      return `Rate limit exceeded. Please wait ${waitTime} minute(s) and try again.`;
    } else {
      const hours = Math.ceil(waitTime / 60);
      return `Rate limit exceeded. Please wait ${hours} hour(s) and try again.`;
    }
  }

  /**
   * Check if IP is from suspicious source
   */
  isSuspiciousIP(ip: string): boolean {
    // Basic checks for common suspicious patterns
    const suspiciousPatterns = [
      /^10\./, // Private IP
      /^192\.168\./, // Private IP
      /^172\./, // Private IP
      /^127\./, // Localhost
      /^0\./, // Invalid
    ];

    // Allow private IPs in development
    if (process.env.NODE_ENV === 'development') {
      return false;
    }

    return suspiciousPatterns.some(pattern => pattern.test(ip));
  }

  /**
   * Advanced spam detection
   */
  async detectSpam(orderData: {
    email: string;
    cantonAddress: string;
    usdtAmount: number;
    ip: string;
  }): Promise<{ isSpam: boolean; reason?: string; confidence: number }> {
    let spamScore = 0;
    const reasons: string[] = [];

    // Check for suspicious email patterns
    if (this.isSuspiciousEmail(orderData.email)) {
      spamScore += 30;
      reasons.push('Suspicious email pattern');
    }

    // Check for suspicious amounts
    if (this.isSuspiciousAmount(orderData.usdtAmount || 0)) {
      spamScore += 20;
      reasons.push('Suspicious transaction amount');
    }

    // Check for duplicate recent orders
    const isDuplicate = await this.checkDuplicateOrder(orderData);
    if (isDuplicate) {
      spamScore += 40;
      reasons.push('Duplicate order detected');
    }

    // Check IP reputation
    if (this.isSuspiciousIP(orderData.ip)) {
      spamScore += 15;
      reasons.push('Suspicious IP address');
    }

    const isSpam = spamScore >= 50;
    
    return {
      isSpam,
      reason: reasons.join(', '),
      confidence: Math.min(spamScore, 100)
    };
  }

  /**
   * Check for suspicious email patterns
   */
  private isSuspiciousEmail(email: string): boolean {
    const suspiciousPatterns = [
      /^\d+@/, // Starts with numbers
      /@(tempmail|10minutemail|guerrillamail|mailinator)/, // Temporary email services
      /[^\w\-_.@]/, // Contains unusual characters
      /.{50,}@/, // Very long username
    ];

    return suspiciousPatterns.some(pattern => pattern.test(email.toLowerCase()));
  }

  /**
   * Check for suspicious amounts
   */
  private isSuspiciousAmount(amount: number): boolean {
    // Flag very small or very large amounts
    return amount < 1 || amount > 100000;
  }

  /**
   * Simple duplicate order detection (in production, use database)
   */
  private duplicateOrderCache = new Map<string, number>();

  private async checkDuplicateOrder(orderData: {
    email: string;
    cantonAddress: string;
    usdtAmount: number;
  }): Promise<boolean> {
    const key = `${orderData.email}:${orderData.cantonAddress}:${orderData.usdtAmount || 0}`;
    const now = Date.now();
    const lastOrder = this.duplicateOrderCache.get(key);

    // Check if same order was created within 10 minutes
    if (lastOrder && (now - lastOrder) < 10 * 60 * 1000) {
      return true;
    }

    // Store this order
    this.duplicateOrderCache.set(key, now);

    // Clean old entries (keep only last hour)
    for (const [cacheKey, timestamp] of this.duplicateOrderCache.entries()) {
      if (now - timestamp > 60 * 60 * 1000) {
        this.duplicateOrderCache.delete(cacheKey);
      }
    }

    return false;
  }

  /**
   * Get rate limit headers for response
   */
  getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
    return {
      'X-RateLimit-Limit': '3',
      'X-RateLimit-Remaining': String(result.remainingPoints || 0),
      'X-RateLimit-Reset': String(Math.round((Date.now() + (result.msBeforeNext || 0)) / 1000)),
      'Retry-After': String(Math.ceil((result.msBeforeNext || 0) / 1000)),
    };
  }
}

// Export singleton instance
export const rateLimiterService = new RateLimiterService();
export default rateLimiterService;
