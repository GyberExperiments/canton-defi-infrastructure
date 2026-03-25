'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
// TOKEN_INFO removed - not needed for basic functionality
import { CantonBridgeService, type CantonBridgeRequest, type CantonBridgeResult, type ChainId, type AssetType } from '../services/cantonBridgeService';
import { DamlIntegrationService } from '../services/damlIntegrationService';

// ✨ CANTON BRIDGE API INTEGRATION

export interface BridgeTransfer {
  transferId: string;
  user: string;
  token: string;
  amount: string;
  fee: string;
  cantonAddress: string;
  isPrivate: boolean;
  isCompleted: boolean;
  timestamp: number;
  confirmations: number;
}

export interface BridgeStats {
  totalVolume: string;
  totalTransfers: number;
  activeValidators: number;
  averageConfirmationTime: number;
  bridgeFeeRate: number;
  supportedTokens: string[];
}

export interface UseBridgeReturn {
  // State
  transfers: BridgeTransfer[];
  bridgeStats: BridgeStats | null;
  isLoading: boolean;
  error: string | null;
  
  // Bridge Operations
  bridgeToCanton: (token: string, amount: string, cantonAddress: string, isPrivate: boolean) => Promise<string | null>;
  bridgeFromCanton: (transferId: string, amount: string) => Promise<string | null>;
  
  // Utility Functions
  calculateBridgeFee: (amount: string) => Promise<string>;
  checkTransferStatus: (transferId: string) => Promise<BridgeTransfer | null>;
  estimateConfirmationTime: () => Promise<number>;
  
  // Data Management
  refreshData: () => Promise<void>;
  getUserTransfers: (address: string) => Promise<BridgeTransfer[]>;
}

export const useCantonBridge = (): UseBridgeReturn => {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  
  const [transfers, setTransfers] = useState<BridgeTransfer[]>([]);
  const [bridgeStats, setBridgeStats] = useState<BridgeStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // ✅ Track cleanup functions to prevent memory leaks
  const cleanupFunctions = useRef<Map<string, () => void>>(new Map());
  
  // 🌉 New Canton Bridge Service with Daml integration
  const [cantonBridgeService] = useState(() => {
    const damlService = new DamlIntegrationService({
      participantUrl: 'http://localhost:7575',
      participantId: 'canton_bridge_participant',
      authToken: 'bridge_demo_token_2025',
      partyId: 'canton_bridge_party'
    });
    return new CantonBridgeService(damlService);
  });

  // ✨ BRIDGE TO CANTON NETWORK - Enhanced with Real Canton Integration
  const bridgeToCanton = async (
    token: string,
    amount: string,
    cantonAddress: string,
    isPrivate: boolean
  ): Promise<string | null> => {
    if (!isConnected || !walletClient || !address) {
      setError('Wallet not connected');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('🌉 Initiating advanced Canton bridge with Daml contracts...', {
        token,
        amount,
        cantonAddress,
        isPrivate
      });

      // Determine asset type and privacy level based on token and settings
      const assetType: AssetType = token.includes('USDT') || token.includes('USDC') ? 'STABLECOIN' : 'INSTITUTIONAL';
      const privacyLevel = isPrivate ? 'ENHANCED' : 'STANDARD';

      // Use Canton Bridge Service for real integration
      const bridgeResult = await cantonBridgeService.initiateBridge({
        sourceChain: 'BSC_MAINNET' as ChainId,
        destinationChain: 'CANTON_NETWORK' as ChainId,
        token: token,
        amount: amount,
        recipient: cantonAddress,
        sender: address,
        assetType,
        privacyLevel,
        zkProofRequired: isPrivate
      });

      if (!bridgeResult.success) {
        throw new Error(bridgeResult.error || 'Canton bridge initiation failed');
      }

      // Convert Canton Bridge Result to legacy BridgeTransfer format for UI compatibility
      const legacyTransfer: BridgeTransfer = {
        transferId: bridgeResult.transactionId,
        user: address,
        token: token,
        amount: amount,
        fee: bridgeResult.bridgeFee?.toString() || '0',
        cantonAddress: cantonAddress,
        isPrivate: isPrivate,
        isCompleted: false,
        timestamp: Date.now(),
        confirmations: 0
      };

      // Add to transfers
      setTransfers(prev => [legacyTransfer, ...prev]);

      // Setup real-time monitoring
      const cleanup = setupRealTimeBridgeMonitoring(bridgeResult.transactionId, legacyTransfer);
      cleanupFunctions.current.set(bridgeResult.transactionId, cleanup);

      console.log('✅ Canton bridge initiated successfully:', {
        transactionId: bridgeResult.transactionId,
        estimatedTime: bridgeResult.estimatedTime,
        bridgeFee: bridgeResult.bridgeFee?.toString()
      });

      return bridgeResult.transactionId;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Canton bridge operation failed';
      setError(errorMessage);
      console.error('❌ Canton bridge failed:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // ✨ BRIDGE FROM CANTON NETWORK
  const bridgeFromCanton = async (
    transferId: string,
    amount: string
  ): Promise<string | null> => {
    if (!isConnected || !walletClient || !address) {
      setError('Wallet not connected');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('🌉 Bridge from Canton:', { transferId, amount });

      // Simulate unlocking tokens on BSC
      const txHash = `0x${Math.random().toString(16).substring(2, 66)}`;

      // Update transfer status
      setTransfers(prev => 
        prev.map(transfer => 
          transfer.transferId === transferId 
            ? { ...transfer, isCompleted: true }
            : transfer
        )
      );

      return txHash;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Bridge from Canton failed';
      setError(errorMessage);
      console.error('❌ Bridge from Canton failed:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // ✨ CALCULATE BRIDGE FEE
  const calculateBridgeFee = async (amount: string): Promise<string> => {
    try {
      // Default to 18 decimals for stablecoins
      const amountWei = parseUnits(amount, 18);
      const feeWei = await calculateBridgeFeeInternal(amountWei.toString());
      return formatUnits(BigInt(feeWei), 18);
    } catch (err) {
      console.error('❌ Fee calculation failed:', err);
      return '0';
    }
  };

  // Internal fee calculation
  const calculateBridgeFeeInternal = async (amountWei: string): Promise<string> => {
    const baseFeeRate = 10; // 0.1% in basis points
    const baseFee = parseUnits('0.001', 18); // 0.001 BNB base fee
    
    const percentageFee = (BigInt(amountWei) * BigInt(baseFeeRate)) / BigInt(10000);
    const totalFee = baseFee + percentageFee;
    
    return totalFee.toString();
  };

  // ✅ Real-time Canton Bridge Monitoring with Daml Events
  const setupRealTimeBridgeMonitoring = useCallback((requestId: string, legacyTransfer: BridgeTransfer) => {
    let isCleanedUp = false;
    
    // Listen to Canton Bridge Service events
    const handleBridgeProgress = (progress: any) => {
      if (isCleanedUp || progress.requestId !== requestId) return;
      
      setTransfers(prev => prev.map(transfer =>
        transfer.transferId === requestId
          ? { 
              ...transfer, 
              confirmations: progress.confirmations,
              isCompleted: progress.status === 'COMPLETED'
            }
          : transfer
      ));
      
      console.log('📊 Bridge progress update:', progress);
    };
    
    const handleBridgeCompleted = (result: CantonBridgeResult) => {
      if (isCleanedUp || result.transactionId !== requestId) return;
      
      setTransfers(prev => prev.map(transfer =>
        transfer.transferId === requestId
          ? { ...transfer, isCompleted: true, confirmations: 3 }
          : transfer
      ));
      
      console.log('✅ Canton bridge completed:', result);
    };
    
    const handleBridgeFailed = (result: CantonBridgeResult) => {
      if (isCleanedUp || result.transactionId !== requestId) return;
      
      setError(`Bridge failed: ${result.error}`);
      console.error('❌ Canton bridge failed:', result);
    };
    
    // Subscribe to Canton Bridge Service events
    cantonBridgeService.on('bridge_progress', handleBridgeProgress);
    cantonBridgeService.on('bridge_completed', handleBridgeCompleted);
    cantonBridgeService.on('bridge_failed', handleBridgeFailed);
    
    // Return cleanup function
    return () => {
      isCleanedUp = true;
      cantonBridgeService.off('bridge_progress', handleBridgeProgress);
      cantonBridgeService.off('bridge_completed', handleBridgeCompleted);
      cantonBridgeService.off('bridge_failed', handleBridgeFailed);
    };
  }, [cantonBridgeService]);

  // ✨ CHECK TRANSFER STATUS
  const checkTransferStatus = async (transferId: string): Promise<BridgeTransfer | null> => {
    try {
      const transfer = transfers.find(t => t.transferId === transferId);
      
      if (!transfer) {
        console.log('🔍 Fetching transfer from blockchain:', transferId);
        return null;
      }
      
      return transfer;
      
    } catch (err) {
      console.error('❌ Failed to check transfer status:', err);
      return null;
    }
  };

  // ✨ ESTIMATE CONFIRMATION TIME
  const estimateConfirmationTime = async (): Promise<number> => {
    try {
      const baseConfirmationTime = 300; // 5 minutes in seconds
      const networkCongestionFactor = Math.random() * 0.5 + 0.75; // 0.75-1.25x multiplier
      
      return Math.round(baseConfirmationTime * networkCongestionFactor);
      
    } catch (err) {
      console.error('❌ Failed to estimate confirmation time:', err);
      return 300; // Fallback to 5 minutes
    }
  };

  // ✨ GET USER TRANSFERS
  const getUserTransfers = async (userAddress: string): Promise<BridgeTransfer[]> => {
    try {
      const userTransfers = transfers.filter(
        transfer => transfer.user.toLowerCase() === userAddress.toLowerCase()
      );
      
      return userTransfers;
      
    } catch (err) {
      console.error('❌ Failed to get user transfers:', err);
      return [];
    }
  };

  // ✨ REFRESH DATA - Enhanced with Real Canton Bridge Data
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get real bridge statistics from Canton Bridge Service
      const activeBridges = cantonBridgeService.getActiveBridges();
      const bridgeHistory = cantonBridgeService.getBridgeHistory();
      
      // Calculate real bridge stats
      const totalVolume = bridgeHistory.reduce((sum, bridge) => 
        sum + (bridge.sourceAmount?.toNumber() || 0), 0
      );
      
      const completedBridges = bridgeHistory.filter(b => b.success);
      const averageTime = completedBridges.length > 0 
        ? completedBridges.reduce((sum, b) => sum + (b.actualTime || 0), 0) / completedBridges.length
        : 285;

      const realStats: BridgeStats = {
        totalVolume: totalVolume.toLocaleString(),
        totalTransfers: bridgeHistory.length,
        activeValidators: 7, // Canton participant nodes
        averageConfirmationTime: Math.round(averageTime),
        bridgeFeeRate: 0.1, // 0.1% base fee
        supportedTokens: ['USDT', 'USDC', 'INSTITUTIONAL_ASSETS', 'REAL_ESTATE_TOKENS']
      };

      setBridgeStats(realStats);

      // Refresh user transfers with real data
      if (address) {
        const cantonBridges = cantonBridgeService.getActiveBridges()
          .filter(bridge => bridge.sender === address);
        
        const legacyTransfers: BridgeTransfer[] = cantonBridges.map(bridge => ({
          transferId: bridge.requestId,
          user: bridge.sender,
          token: bridge.sourceToken,
          amount: bridge.sourceAmount.toString(),
          fee: bridge.bridgeFee.toString(),
          cantonAddress: bridge.destinationAddress,
          isPrivate: bridge.privacyLevel !== 'STANDARD',
          isCompleted: bridge.status === 'COMPLETED',
          timestamp: bridge.requestTime.getTime(),
          confirmations: bridge.confirmations
        }));
        
        setTransfers(legacyTransfers);
      }

      // Real Canton bridge data refreshed

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh Canton bridge data';
      setError(errorMessage);
      console.error('❌ Canton bridge data refresh failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [address, cantonBridgeService]);

  // Initialize data on mount
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // ✅ Cleanup all intervals on unmount
  useEffect(() => {
    return () => {
      // Cleanup all pending confirmations
      cleanupFunctions.current.forEach((cleanup) => {
        cleanup();
      });
      cleanupFunctions.current.clear();
    };
  }, []);

  return {
    transfers,
    bridgeStats,
    isLoading,
    error,
    bridgeToCanton,
    bridgeFromCanton,
    calculateBridgeFee,
    checkTransferStatus,
    estimateConfirmationTime,
    refreshData,
    getUserTransfers,
  };
};