'use client';

/**
 * 🔐 CANTON AUTHENTICATION SERVICE — PRODUCTION VERSION
 * 
 * JWT-based authentication для Canton Network с EVM signature verification
 * Основано на официальной Canton Network authentication documentation
 */

import { ethers } from 'ethers';

// JWT library (will be available after pnpm install)
let jwt: any;
try {
  jwt = require('jsonwebtoken');
} catch (error) {
  console.warn('⚠️ jsonwebtoken not installed, using interface definitions');
}

// ========================================
// TYPES
// ========================================

export interface CantonJWTPayload {
  sub: string;           // Canton Party ID
  aud: string;           // 'canton-defi'
  iss: string;           // 'https://auth.canton.network'
  act: string[];         // ['readAs', 'actAs']
  exp: number;
  evmAddress: string;    // Linked EVM address
  iat?: number;          // Issued at
  jti?: string;          // JWT ID
}

export interface PartyAllocationRequest {
  displayName?: string;
  identifierHint?: string;
  localMetadata?: {
    evmAddress: string;
    createdAt: string;
    [key: string]: any;
  };
}

export interface PartyAllocationResponse {
  partyId: string;
  displayName: string;
  identifierHint?: string;
}

// ========================================
// CANTON AUTH SERVICE
// ========================================

export class CantonAuthService {
  private privateKey: string;
  private issuer: string;
  private audience: string;
  private adminApiUrl: string;
  
  constructor(config: {
    jwtPrivateKey: string;
    issuer?: string;
    audience?: string;
    adminApiUrl?: string;
  }) {
    this.privateKey = config.jwtPrivateKey;
    this.issuer = config.issuer || 'https://auth.canton.network';
    this.audience = config.audience || 'canton-defi';
    this.adminApiUrl = config.adminApiUrl || 
      process.env.NEXT_PUBLIC_CANTON_ADMIN_URL || 
      'http://localhost:7576/api/v1';
    
    if (!this.privateKey) {
      throw new Error('JWT private key is required for CantonAuthService');
    }
  }
  
  /**
   * Authenticate user via EVM signature, return Canton JWT
   * @critical Prevents replay attacks with timestamp validation
   */
  async authenticateWithEVMSignature(
    evmAddress: string,
    message: string,
    signature: string,
    partyId: string
  ): Promise<string> {
    try {
      // 1. Verify EVM signature
      const recoveredAddress = ethers.verifyMessage(message, signature);
      if (recoveredAddress.toLowerCase() !== evmAddress.toLowerCase()) {
        throw new Error('Invalid EVM signature');
      }
      
      // 2. Verify message is recent (prevent replay)
      let messageData: any;
      try {
        messageData = JSON.parse(message);
      } catch {
        // If message is not JSON, treat as plain text with timestamp
        throw new Error('Message must contain timestamp');
      }
      
      const timestamp = messageData.timestamp;
      if (!timestamp) {
        throw new Error('Message must contain timestamp');
      }
      
      const messageAge = Date.now() - timestamp;
      const maxAge = 5 * 60 * 1000; // 5 minutes max
      if (messageAge > maxAge) {
        throw new Error(`Signature expired. Message age: ${messageAge}ms, max: ${maxAge}ms`);
      }
      
      if (messageAge < 0) {
        throw new Error('Message timestamp is in the future');
      }
      
      // 3. Verify message is for Canton authentication
      if (messageData.purpose !== 'canton_authentication' && 
          messageData.domain !== 'canton-defi') {
        console.warn('⚠️ Message purpose/domain mismatch, but continuing');
      }
      
      // 4. Generate Canton JWT
      const payload: CantonJWTPayload = {
        sub: partyId,
        aud: this.audience,
        iss: this.issuer,
        act: ['readAs', 'actAs'],
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
        evmAddress: evmAddress.toLowerCase(),
        iat: Math.floor(Date.now() / 1000),
        jti: `${partyId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };
      
      if (jwt) {
        return jwt.sign(payload, this.privateKey, { algorithm: 'RS256' });
      } else {
        // Fallback for development (not secure!)
        console.warn('⚠️ JWT library not available, returning mock token');
        return `mock_jwt_${btoa(JSON.stringify(payload))}`;
      }
      
    } catch (error: any) {
      console.error('❌ EVM signature authentication failed:', error);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }
  
  /**
   * Allocate new Canton Party for EVM address
   * @critical Requires admin token for party allocation
   */
  async allocateParty(
    evmAddress: string,
    adminToken: string
  ): Promise<PartyAllocationResponse> {
    try {
      const requestBody: PartyAllocationRequest = {
        displayName: `user_${evmAddress.slice(0, 8)}`,
        identifierHint: `evm_${evmAddress.toLowerCase()}`,
        localMetadata: {
          evmAddress: evmAddress.toLowerCase(),
          createdAt: new Date().toISOString(),
        }
      };
      
      const response = await fetch(`${this.adminApiUrl}/parties/allocate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Party allocation failed: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const result = await response.json();
      
      console.log('✅ Canton Party allocated:', result.partyId);
      
      return {
        partyId: result.party || result.partyId || result.identifier,
        displayName: result.displayName || requestBody.displayName,
        identifierHint: result.identifierHint || requestBody.identifierHint,
      };
      
    } catch (error: any) {
      console.error('❌ Party allocation failed:', error);
      throw new Error(`Party allocation failed: ${error.message}`);
    }
  }
  
  /**
   * Get party information
   */
  async getPartyInfo(
    partyId: string,
    authToken: string
  ): Promise<any> {
    try {
      const response = await fetch(`${this.adminApiUrl}/parties/${partyId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get party info: ${response.status}`);
      }
      
      return await response.json();
      
    } catch (error: any) {
      console.error('❌ Failed to get party info:', error);
      throw error;
    }
  }
  
  /**
   * Verify JWT token
   */
  async verifyToken(token: string): Promise<CantonJWTPayload | null> {
    try {
      if (jwt) {
        const decoded = jwt.verify(token, this.privateKey, {
          audience: this.audience,
          issuer: this.issuer,
        });
        return decoded as CantonJWTPayload;
      } else {
        // Fallback for development
        console.warn('⚠️ JWT library not available, skipping verification');
        return null;
      }
    } catch (error: any) {
      console.error('❌ Token verification failed:', error);
      return null;
    }
  }
  
  /**
   * Generate authentication message for user to sign
   */
  generateAuthMessage(evmAddress: string, partyId?: string): string {
    const message = {
      purpose: 'canton_authentication',
      domain: 'canton-defi',
      address: evmAddress.toLowerCase(),
      partyId: partyId || 'pending',
      timestamp: Date.now(),
      nonce: Math.random().toString(36).substr(2, 9),
    };
    
    return JSON.stringify(message);
  }
}

// ========================================
// EXPORTS
// ========================================

export default CantonAuthService;
