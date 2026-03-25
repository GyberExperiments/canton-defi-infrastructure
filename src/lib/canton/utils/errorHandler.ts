'use client';

/**
 * 🚨 Advanced Error Handler for Multi-Network Support
 * 
 * Provides intelligent error handling and user-friendly messages
 * for network-related issues and general application errors
 */

import { toast } from 'react-hot-toast';

export interface ErrorContext {
  component?: string;
  action?: string;
  networkId?: number;
  chainId?: number;
  userId?: string;
  timestamp?: Date;
}

export interface ErrorInfo {
  type: 'NETWORK' | 'WALLET' | 'RPC' | 'CONTRACT' | 'UNKNOWN';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  userMessage: string;
  technicalMessage: string;
  canRetry: boolean;
  requiresUserAction: boolean;
  suggestedAction?: string;
}

/**
 * Network-related error patterns
 */
const NETWORK_ERROR_PATTERNS = {
  // RPC Errors
  RPC_TIMEOUT: /timeout|timed out|ETIMEDOUT/i,
  RPC_CONNECTION: /connection|ECONNREFUSED|ENOTFOUND/i,
  RPC_RATE_LIMIT: /rate limit|too many requests|429/i,
  RPC_INVALID_RESPONSE: /invalid response|malformed/i,
  
  // Network Errors
  UNSUPPORTED_NETWORK: /unsupported network|wrong network/i,
  NETWORK_MISMATCH: /network mismatch|chain id/i,
  NETWORK_SWITCH_REQUIRED: /switch network|change network/i,
  
  // Wallet Errors
  WALLET_NOT_CONNECTED: /not connected|no wallet/i,
  WALLET_REJECTED: /user rejected|rejected by user/i,
  WALLET_LOCKED: /wallet locked|please unlock/i,
  WALLET_ACCOUNT_CHANGED: /account changed|account mismatch/i,
  
  // Contract Errors
  CONTRACT_NOT_DEPLOYED: /contract not deployed|no contract/i,
  CONTRACT_CALL_FAILED: /contract call failed|execution reverted/i,
  INSUFFICIENT_FUNDS: /insufficient funds|not enough/i,
  GAS_ESTIMATION_FAILED: /gas estimation failed/i,
  
  // Canton Network Errors
  CANTON_CONNECTION_FAILED: /canton.*connection|canton.*failed/i,
  CANTON_API_ERROR: /canton.*api|canton.*endpoint/i,
  CANTON_AUTH_FAILED: /canton.*auth|canton.*token/i,
} as const;

/**
 * Analyze error and determine type and severity
 */
export const analyzeError = (error: any, context?: ErrorContext): ErrorInfo => {
  const errorMessage = error?.message || error?.toString() || 'Unknown error';
  const errorCode = error?.code || error?.error?.code;
  
  // Check for network errors
  for (const [patternName, pattern] of Object.entries(NETWORK_ERROR_PATTERNS)) {
    if (pattern.test(errorMessage)) {
      return getNetworkErrorInfo(patternName as keyof typeof NETWORK_ERROR_PATTERNS, error, context);
    }
  }
  
  // Check for specific error codes
  if (errorCode) {
    return getErrorCodeInfo(errorCode, error, context);
  }
  
  // Default to unknown error
  return {
    type: 'UNKNOWN',
    severity: 'MEDIUM',
    userMessage: 'An unexpected error occurred. Please try again.',
    technicalMessage: errorMessage,
    canRetry: true,
    requiresUserAction: false
  };
};

/**
 * Get error info for network pattern matches
 */
const getNetworkErrorInfo = (patternName: keyof typeof NETWORK_ERROR_PATTERNS, error: any, context?: ErrorContext): ErrorInfo => {
  switch (patternName) {
    case 'RPC_TIMEOUT':
      return {
        type: 'RPC',
        severity: 'MEDIUM',
        userMessage: 'Network request timed out. The network might be slow.',
        technicalMessage: `RPC timeout: ${error.message}`,
        canRetry: true,
        requiresUserAction: false,
        suggestedAction: 'Try again in a few moments'
      };
      
    case 'RPC_CONNECTION':
      return {
        type: 'RPC',
        severity: 'HIGH',
        userMessage: 'Cannot connect to the network. Please check your internet connection.',
        technicalMessage: `RPC connection failed: ${error.message}`,
        canRetry: true,
        requiresUserAction: true,
        suggestedAction: 'Check your internet connection and try again'
      };
      
    case 'RPC_RATE_LIMIT':
      return {
        type: 'RPC',
        severity: 'MEDIUM',
        userMessage: 'Too many requests. Please wait a moment before trying again.',
        technicalMessage: `RPC rate limit exceeded: ${error.message}`,
        canRetry: true,
        requiresUserAction: false,
        suggestedAction: 'Wait 30 seconds and try again'
      };
      
    case 'UNSUPPORTED_NETWORK':
      return {
        type: 'NETWORK',
        severity: 'HIGH',
        userMessage: 'This network is not supported. Please switch to BSC Testnet or Canton Network.',
        technicalMessage: `Unsupported network: ${error.message}`,
        canRetry: false,
        requiresUserAction: true,
        suggestedAction: 'Switch to a supported network'
      };
      
    case 'WALLET_NOT_CONNECTED':
      return {
        type: 'WALLET',
        severity: 'HIGH',
        userMessage: 'Please connect your wallet to continue.',
        technicalMessage: `Wallet not connected: ${error.message}`,
        canRetry: false,
        requiresUserAction: true,
        suggestedAction: 'Connect your wallet'
      };
      
    case 'WALLET_REJECTED':
      return {
        type: 'WALLET',
        severity: 'LOW',
        userMessage: 'Transaction was cancelled by user.',
        technicalMessage: `User rejected transaction: ${error.message}`,
        canRetry: true,
        requiresUserAction: false
      };
      
    case 'INSUFFICIENT_FUNDS':
      return {
        type: 'CONTRACT',
        severity: 'MEDIUM',
        userMessage: 'Insufficient funds for this transaction.',
        technicalMessage: `Insufficient funds: ${error.message}`,
        canRetry: false,
        requiresUserAction: true,
        suggestedAction: 'Add more funds to your wallet'
      };
      
    case 'CANTON_CONNECTION_FAILED':
      return {
        type: 'NETWORK',
        severity: 'MEDIUM',
        userMessage: 'Cannot connect to Canton Network. Using fallback mode.',
        technicalMessage: `Canton connection failed: ${error.message}`,
        canRetry: true,
        requiresUserAction: false,
        suggestedAction: 'The app will work with limited functionality'
      };
      
    default:
      return {
        type: 'UNKNOWN',
        severity: 'MEDIUM',
        userMessage: 'A network error occurred. Please try again.',
        technicalMessage: error.message || 'Unknown network error',
        canRetry: true,
        requiresUserAction: false
      };
  }
};

/**
 * Get error info for specific error codes
 */
const getErrorCodeInfo = (errorCode: number | string, error: any, context?: ErrorContext): ErrorInfo => {
  const code = typeof errorCode === 'string' ? parseInt(errorCode, 16) : errorCode;
  
  switch (code) {
    case 4001: // User rejected
      return {
        type: 'WALLET',
        severity: 'LOW',
        userMessage: 'Transaction was cancelled.',
        technicalMessage: 'User rejected transaction',
        canRetry: true,
        requiresUserAction: false
      };
      
    case 4902: // Network not added
      return {
        type: 'NETWORK',
        severity: 'HIGH',
        userMessage: 'Please add this network to your wallet.',
        technicalMessage: 'Network not added to wallet',
        canRetry: false,
        requiresUserAction: true,
        suggestedAction: 'Add the network manually to your wallet'
      };
      
    case -32603: // Internal error
      return {
        type: 'RPC',
        severity: 'MEDIUM',
        userMessage: 'Network error occurred. Please try again.',
        technicalMessage: 'RPC internal error',
        canRetry: true,
        requiresUserAction: false
      };
      
    case -32000: // Invalid input
      return {
        type: 'CONTRACT',
        severity: 'MEDIUM',
        userMessage: 'Invalid transaction parameters.',
        technicalMessage: 'Invalid input parameters',
        canRetry: true,
        requiresUserAction: false
      };
      
    default:
      return {
        type: 'UNKNOWN',
        severity: 'MEDIUM',
        userMessage: 'An error occurred. Please try again.',
        technicalMessage: `Error code ${code}: ${error.message}`,
        canRetry: true,
        requiresUserAction: false
      };
  }
};

/**
 * Handle error with appropriate user feedback
 */
export const handleError = (error: any, context?: ErrorContext): ErrorInfo => {
  const errorInfo = analyzeError(error, context);
  
  // Log error for debugging
  console.error('Error handled:', {
    error,
    context,
    errorInfo
  });
  
  // Show appropriate toast notification
  switch (errorInfo.severity) {
    case 'LOW':
      toast.error(errorInfo.userMessage);
      break;
      
    case 'MEDIUM':
      toast.error(errorInfo.userMessage);
      break;
      
    case 'HIGH':
      toast.error(errorInfo.userMessage, {
        duration: 6000,
        style: {
          background: '#ef4444',
          color: 'white',
        }
      });
      break;
      
    case 'CRITICAL':
      toast.error(errorInfo.userMessage, {
        duration: 10000,
        style: {
          background: '#dc2626',
          color: 'white',
        }
      });
      break;
  }
  
  return errorInfo;
};

/**
 * Retry function with exponential backoff
 */
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Retry attempt ${attempt + 1}/${maxRetries + 1} in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

/**
 * Safe async operation wrapper
 */
export const safeAsync = async <T>(
  operation: () => Promise<T>,
  context?: ErrorContext
): Promise<{ success: true; data: T } | { success: false; error: ErrorInfo }> => {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    const errorInfo = handleError(error, context);
    return { success: false, error: errorInfo };
  }
};
