/**
 * 🏛️ Canton Network Address Validation
 * Production-ready validation for Canton Network addresses
 */

/**
 * Canton Network address patterns and validation rules
 */
interface CantonAddressFormat {
  pattern: RegExp;
  length: number;
  description: string;
}

/**
 * Canton Network address validation service
 */
class CantonValidationService {
  // Canton Network поддерживает несколько форматов адресов
  private addressFormats: CantonAddressFormat[] = [
    {
      pattern: /^[a-fA-F0-9]{32,}::[a-fA-F0-9]{32,}$/,
      length: 64,
      description: 'Canton Network HEX::HEX format (participant_id::party_hint) - MOST COMMON'
    },
    {
      pattern: /^[a-zA-Z][a-zA-Z0-9_]*::[a-fA-F0-9]{32,}$/,
      length: 40,
      description: 'Canton Network namespace format (bron::fingerprint)'
    },
    {
      pattern: /^[a-zA-Z][a-zA-Z0-9_-]{2,49}::[a-fA-F0-9]{32,80}$/,
      length: 40,
      description: 'Canton Network classic format (name:fingerprint)'
    },
    {
      pattern: /^[a-fA-F0-9]{32,80}$/,
      length: 32,
      description: 'Canton Network hex-only format (fingerprint)'
    }
  ];

  /**
   * Validate Canton Network address
   */
  validateCantonAddress(address: string): { isValid: boolean; error?: string; format?: string } {
    try {
      // Basic checks
      if (!address) {
        return { isValid: false, error: 'Address is required' };
      }

      if (typeof address !== 'string') {
        return { isValid: false, error: 'Address must be a string' };
      }

      // Trim and normalize
      const normalizedAddress = address.trim();

      // Canton address minimum: 32 hex chars or formatted address
      if (normalizedAddress.length < 32) {
        return { isValid: false, error: 'Canton address is too short' };
      }

      if (normalizedAddress.length > 150) {
        return { isValid: false, error: 'Canton address is too long' };
      }

      // Check Canton Network format: name:fingerprint
      for (const format of this.addressFormats) {
        if (format.pattern.test(normalizedAddress)) {
          return {
            isValid: true,
            format: format.description
          };
        }
      }

      return {
        isValid: false,
        error: 'Invalid Canton address format. Expected: bron::fingerprint, name:fingerprint, or hex string'
      };

    } catch {
      return {
        isValid: false,
        error: 'Address validation error'
      };
    }
  }


  /**
   * Validate refund address (can be Canton or other formats)
   */
  validateRefundAddress(address: string): { isValid: boolean; error?: string; format?: string } {
    if (!address || !address.trim()) {
      return { isValid: true }; // Refund address is optional
    }

    // First try Canton validation
    const cantonResult = this.validateCantonAddress(address);
    if (cantonResult.isValid) {
      return cantonResult;
    }

    // Check other common address formats for refunds
    const otherFormats = this.validateOtherAddressFormats(address);
    if (otherFormats.isValid) {
      return otherFormats;
    }

    return {
      isValid: false,
      error: 'Invalid refund address format'
    };
  }

  /**
   * Validate other common cryptocurrency address formats
   */
  private validateOtherAddressFormats(address: string): { isValid: boolean; error?: string; format?: string } {
    const normalizedAddress = address.trim();

    // Common crypto address patterns
    const addressPatterns = [
      {
        pattern: /^T[A-Za-z1-9]{33}$/,
        format: 'TRON (TRX) address'
      },
      {
        pattern: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/,
        format: 'Bitcoin address'
      },
      {
        pattern: /^bc1[a-z0-9]{39,59}$/,
        format: 'Bitcoin Bech32 address'
      },
      {
        pattern: /^0x[a-fA-F0-9]{40}$/,
        format: 'Ethereum address'
      },
      {
        pattern: /^bnb1[a-z0-9]{38}$/,
        format: 'Binance Chain address'
      },
      {
        pattern: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
        format: 'Solana address'
      }
    ];

    for (const { pattern, format } of addressPatterns) {
      if (pattern.test(normalizedAddress)) {
        return { isValid: true, format };
      }
    }

    return { isValid: false };
  }

  /**
   * Format address for display (truncate long addresses)
   */
  formatAddressForDisplay(address: string, maxLength: number = 20): string {
    if (!address || address.length <= maxLength) {
      return address;
    }

    const start = address.slice(0, maxLength / 2);
    const end = address.slice(-maxLength / 2);
    return `${start}...${end}`;
  }

  /**
   * Check if two addresses are the same
   */
  addressesMatch(address1: string, address2: string): boolean {
    if (!address1 || !address2) return false;
    return address1.trim().toLowerCase() === address2.trim().toLowerCase();
  }

  /**
   * Get address type information
   */
  getAddressInfo(address: string): { 
    isValid: boolean; 
    type?: string; 
    network?: string; 
    format?: string;
    error?: string;
  } {
    const validation = this.validateCantonAddress(address);
    
    if (validation.isValid) {
      return {
        isValid: true,
        type: 'Canton Network',
        network: 'Canton',
        format: validation.format
      };
    }

    // Try other formats
    const otherValidation = this.validateOtherAddressFormats(address);
    if (otherValidation.isValid) {
      const networkInfo = this.extractNetworkInfo(otherValidation.format || '');
      return {
        isValid: true,
        type: 'Cryptocurrency',
        network: networkInfo.network,
        format: otherValidation.format
      };
    }

    return {
      isValid: false,
      error: validation.error
    };
  }

  /**
   * Extract network information from format string
   */
  private extractNetworkInfo(format: string): { network: string; type: string } {
    const networkMap: Record<string, { network: string; type: string }> = {
      'TRON': { network: 'TRON', type: 'TRX' },
      'Bitcoin': { network: 'Bitcoin', type: 'BTC' },
      'Ethereum': { network: 'Ethereum', type: 'ETH' },
      'Binance': { network: 'BSC', type: 'BNB' },
      'Solana': { network: 'Solana', type: 'SOL' },
    };

    for (const [key, value] of Object.entries(networkMap)) {
      if (format.includes(key)) {
        return value;
      }
    }

    return { network: 'Unknown', type: 'Unknown' };
  }

  /**
   * Generate example addresses for testing
   */
  generateExampleAddresses(): { valid: string[]; invalid: string[] } {
    return {
      valid: [
        'alice:1234567890abcdef1234567890abcdef12345678',
        'bob123:deadbeef12345678abcdef1234567890abcdef',
        'company_wallet:9876543210fedcba9876543210fedcba98765432',
        'user_test123:1a2b3c4d5e6f7890abcdef1234567890abcdef12',
      ],
      invalid: [
        '',
        '123',
        'invalid_address',
        'alice::1234567890abcdef', // Double colon (old format)
        'alice:xyz', // Invalid fingerprint (not hex)
        '123alice:1234567890abcdef', // Name starts with number
        'al:1234567890abcdef', // Name too short
        'alice:123', // Fingerprint too short
        '0x742D35Cc6634C0532925a3B8D000B47E0e', // Ethereum address
        'TNaRAoLUyYEV15ZF9FvWs6StdMdRCCMK3f', // TRON address
      ]
    };
  }

  /**
   * Validate batch addresses
   */
  validateBatch(addresses: string[]): Array<{
    address: string;
    isValid: boolean;
    error?: string;
    format?: string;
  }> {
    return addresses.map(address => ({
      address,
      ...this.validateCantonAddress(address)
    }));
  }
}

// Export singleton instance
export const cantonValidationService = new CantonValidationService();
export default cantonValidationService;
