'use client';

/**
 * 👥 Hook для работы с Multi-Party Workflow Service
 */

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { CantonServiceManager } from '../services/CantonServiceManager';
import { 
  MultiPartyWorkflowService,
  type MultiPartyTransaction,
  type TransactionType,
  type TransactionStatus,
  type PartyRequirement
} from '../services/multiPartyWorkflowService';

export interface UseMultiPartyWorkflowServiceReturn {
  // Service instance
  workflowService: MultiPartyWorkflowService | null;
  
  // State
  isLoading: boolean;
  error: string | null;
  
  // Transactions
  transactions: MultiPartyTransaction[];
  getTransaction: (id: string) => MultiPartyTransaction | null;
  getTransactionsByParty: (partyId: string) => MultiPartyTransaction[];
  
  // Actions
  createTransaction: (config: {
    transactionType: TransactionType;
    title: string;
    description: string;
    amount?: number;
    assetId?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  }) => Promise<MultiPartyTransaction | null>;
  
  signTransaction: (transactionId: string, signature: string) => Promise<boolean>;
  executeTransaction: (transactionId: string) => Promise<boolean>;
  
  // Party management
  getPartyDetails: (partyId: string) => PartyRequirement | null;
  
  // Refresh
  refreshTransactions: () => Promise<void>;
}

export const useMultiPartyWorkflowService = (): UseMultiPartyWorkflowServiceReturn => {
  const { address } = useAccount();
  const [workflowService, setWorkflowService] = useState<MultiPartyWorkflowService | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<MultiPartyTransaction[]>([]);
  
  // Initialize workflow service
  useEffect(() => {
    let isMounted = true;
    let serviceInstance: MultiPartyWorkflowService | null = null;
    let cleanupFunctions: Array<() => void> = [];
    
    const initializeService = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const serviceManager = CantonServiceManager.getInstance();
        const service = await serviceManager.getWorkflowService();
        
        if (!isMounted) return;
        
        serviceInstance = service;
        setWorkflowService(service);
        
        // Load initial transactions
        const initialTransactions = service.getActiveTransactions();
        setTransactions(initialTransactions);
        
        // Setup event listeners with proper cleanup
        const handleTransactionCreated = () => {
          if (isMounted && serviceInstance) {
            setTransactions(serviceInstance.getActiveTransactions());
          }
        };
        
        const handleSignatureCollected = () => {
          if (isMounted && serviceInstance) {
            setTransactions(serviceInstance.getActiveTransactions());
          }
        };
        
        const handleTransactionExecuted = () => {
          if (isMounted && serviceInstance) {
            setTransactions(serviceInstance.getActiveTransactions());
          }
        };
        
        service.on('transaction_created', handleTransactionCreated);
        service.on('signature_collected', handleSignatureCollected);
        service.on('transaction_executed', handleTransactionExecuted);
        
        // Store cleanup functions
        cleanupFunctions = [
          () => service.off('transaction_created', handleTransactionCreated),
          () => service.off('signature_collected', handleSignatureCollected),
          () => service.off('transaction_executed', handleTransactionExecuted),
        ];
        
        setIsLoading(false);
      } catch (err) {
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to initialize workflow service';
          setError(errorMessage);
          setIsLoading(false);
          console.error('❌ Failed to initialize workflow service:', err);
        }
      }
    };
    
    initializeService();
    
    return () => {
      isMounted = false;
      // Execute all cleanup functions
      cleanupFunctions.forEach(cleanup => cleanup());
      cleanupFunctions = [];
    };
  }, []);
  
  const refreshTransactions = useCallback(async () => {
    if (!workflowService) return;
    
    try {
      const updatedTransactions = workflowService.getActiveTransactions();
      setTransactions(updatedTransactions);
    } catch (err) {
      console.error('❌ Failed to refresh transactions:', err);
    }
  }, [workflowService]);
  
  const createTransaction = useCallback(async (config: {
    transactionType: TransactionType;
    title: string;
    description: string;
    amount?: number;
    assetId?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  }): Promise<MultiPartyTransaction | null> => {
    if (!workflowService || !address) {
      setError('Workflow service not initialized or wallet not connected');
      return null;
    }
    
    try {
      const Decimal = (await import('decimal.js')).default;
      const transaction = await workflowService.createTransaction({
        ...config,
        amount: config.amount ? new Decimal(config.amount) : undefined,
        initiator: address,
      });
      
      await refreshTransactions();
      return transaction;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create transaction';
      setError(errorMessage);
      console.error('❌ Failed to create transaction:', err);
      return null;
    }
  }, [workflowService, address, refreshTransactions]);
  
  const signTransaction = useCallback(async (
    transactionId: string,
    signature: string
  ): Promise<boolean> => {
    if (!workflowService || !address) {
      setError('Workflow service not initialized or wallet not connected');
      return false;
    }
    
    try {
      const result = await workflowService.signTransaction(
        transactionId,
        address,
        'APPROVAL',
        signature
      );
      
      if (result) {
        await refreshTransactions();
      }
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign transaction';
      setError(errorMessage);
      console.error('❌ Failed to sign transaction:', err);
      return false;
    }
  }, [workflowService, address, refreshTransactions]);
  
  const executeTransaction = useCallback(async (transactionId: string): Promise<boolean> => {
    if (!workflowService) {
      setError('Workflow service not initialized');
      return false;
    }
    
    try {
      const result = await workflowService.executeTransaction(transactionId);
      
      if (result) {
        await refreshTransactions();
      }
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to execute transaction';
      setError(errorMessage);
      console.error('❌ Failed to execute transaction:', err);
      return false;
    }
  }, [workflowService, refreshTransactions]);
  
  const getTransaction = useCallback((id: string): MultiPartyTransaction | null => {
    if (!workflowService) return null;
    return workflowService.getTransaction(id);
  }, [workflowService]);
  
  const getTransactionsByParty = useCallback((partyId: string): MultiPartyTransaction[] => {
    if (!workflowService) return [];
    return workflowService.getTransactionsByParty(partyId);
  }, [workflowService]);
  
  const getPartyDetails = useCallback((partyId: string): PartyRequirement | null => {
    if (!workflowService) return null;
    return workflowService.getPartyDetails(partyId);
  }, [workflowService]);
  
  return {
    workflowService,
    isLoading,
    error,
    transactions,
    getTransaction,
    getTransactionsByParty,
    createTransaction,
    signTransaction,
    executeTransaction,
    getPartyDetails,
    refreshTransactions,
  };
};
