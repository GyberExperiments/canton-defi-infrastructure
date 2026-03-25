'use client';

/**
 * 👥 MULTI-PARTY AUTHORIZATION PANEL 2025
 * 
 * Revolutionary React UI для enterprise multi-party workflows
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Shield,
  CheckCircle,
  Clock,
  AlertCircle,
  Eye,
  FileText,
  Building,
  UserCheck,
  ChevronRight,
  Award,
  Zap,
  X,
  AlertTriangle
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { toast } from 'react-hot-toast';
import Decimal from 'decimal.js';
import type { MultiPartyTransaction, PartyRequirement, PartySignature } from '@/lib/canton/services/multiPartyWorkflowService';

interface MultiPartyAuthPanelProps {
  transaction: MultiPartyTransaction;
  onApprove?: (transactionId: string, signature: string) => Promise<void>;
  onReject?: (transactionId: string, reason: string) => Promise<void>;
  className?: string;
}

export const MultiPartyAuthPanel: React.FC<MultiPartyAuthPanelProps> = ({
  transaction,
  onApprove,
  onReject,
  className = ''
}) => {
  const { address } = useAccount();
  const [selectedAction, setSelectedAction] = useState<'approve' | 'reject' | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Validate user permissions
  const userPermission = useMemo(() => {
    if (!address) return null;
    
    // Check if user is required to sign
    const requiredParty = transaction.requiredSignatures?.find(
      req => req.partyId.toLowerCase() === address.toLowerCase()
    );
    
    // Check if user already signed
    const hasSigned = transaction.collectedSignatures?.some(
      sig => sig.partyId.toLowerCase() === address.toLowerCase()
    );
    
    return {
      isRequired: !!requiredParty,
      hasSigned,
      requirement: requiredParty,
      canApprove: !!requiredParty && !hasSigned && transaction.status === 'PENDING_SIGNATURES'
    };
  }, [address, transaction]);

  // Validate transaction before approval
  const validateTransaction = (): { valid: boolean; error?: string } => {
    if (!address) {
      return { valid: false, error: 'Кошелек не подключен' };
    }
    
    if (!userPermission?.canApprove) {
      return { valid: false, error: 'Вы не имеете прав для подписания этой транзакции' };
    }
    
    if (transaction.status !== 'PENDING_SIGNATURES' && transaction.status !== 'UNDER_REVIEW') {
      return { valid: false, error: 'Транзакция не требует подписи в текущем статусе' };
    }
    
    if (transaction.expiresAt && new Date() > transaction.expiresAt) {
      return { valid: false, error: 'Срок действия транзакции истек' };
    }
    
    // Validate transaction has required signatures structure
    if (!transaction.requiredSignatures || transaction.requiredSignatures.length === 0) {
      return { valid: false, error: 'Транзакция не имеет требуемых подписей' };
    }
    
    // Check if user's party is in required signatures
    const userRequirement = transaction.requiredSignatures.find(
      req => req.partyId.toLowerCase() === address.toLowerCase()
    );
    if (!userRequirement) {
      return { valid: false, error: 'Ваша подпись не требуется для этой транзакции' };
    }
    
    return { valid: true };
  };

  const handleApproveClick = () => {
    const validation = validateTransaction();
    if (!validation.valid) {
      setValidationError(validation.error || 'Ошибка валидации');
      toast.error(validation.error || 'Ошибка валидации');
      return;
    }
    
    setValidationError(null);
    setShowConfirmation(true);
  };

  const handleApprove = async () => {
    if (!onApprove || !address) {
      toast.error('Кошелек не подключен или функция одобрения не доступна');
      return;
    }
    
    // Final validation before approval
    const validation = validateTransaction();
    if (!validation.valid) {
      setValidationError(validation.error || 'Ошибка валидации');
      toast.error(validation.error || 'Ошибка валидации');
      return;
    }
    
    setIsProcessing(true);
    setValidationError(null);
    
    try {
      // Generate signature (in production, this would be a real signature from wallet)
      const signature = `signature_${Date.now()}_${address}`;
      await onApprove(transaction.id, signature);
      
      toast.success('✅ Транзакция успешно одобрена');
      setSelectedAction(null);
      setShowConfirmation(false);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Ошибка при одобрении транзакции';
      setValidationError(errorMsg);
      toast.error(`❌ ${errorMsg}`);
      console.error('Approve error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectClick = () => {
    if (!userPermission?.canApprove) {
      toast.error('Вы не имеете прав для отклонения этой транзакции');
      return;
    }
    
    setSelectedAction('reject');
  };

  const handleReject = async () => {
    if (!onReject || !address) {
      toast.error('Кошелек не подключен или функция отклонения не доступна');
      return;
    }
    
    // Validate user can reject
    if (!userPermission?.canApprove) {
      toast.error('Вы не имеете прав для отклонения этой транзакции');
      return;
    }
    
    if (!rejectReason.trim()) {
      toast.error('Укажите причину отклонения');
      return;
    }
    
    if (rejectReason.trim().length < 10) {
      toast.error('Причина отклонения должна содержать минимум 10 символов');
      return;
    }
    
    // Final validation
    const validation = validateTransaction();
    if (!validation.valid && validation.error !== 'Вы не имеете прав для подписания этой транзакции') {
      toast.error(validation.error || 'Ошибка валидации');
      return;
    }
    
    setIsProcessing(true);
    setValidationError(null);
    
    try {
      await onReject(transaction.id, rejectReason.trim());
      toast.success('✅ Транзакция отклонена');
      setSelectedAction(null);
      setRejectReason('');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Ошибка при отклонении транзакции';
      setValidationError(errorMsg);
      toast.error(`❌ ${errorMsg}`);
      console.error('Reject error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 ${className}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          
          <div>
            <h3 className="text-xl font-bold text-white mb-1">{transaction?.title || 'Multi-Party Transaction'}</h3>
            <p className="text-gray-300 text-sm">{transaction?.description || 'Requires multiple signatures'}</p>
          </div>
        </div>

        <div className="px-3 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-400/30">
          <Clock className="w-3 h-3 inline mr-1" />
          Pending
        </div>
      </div>

      {/* Progress Section */}
      <div className="mb-6">
        <h4 className="text-lg font-semibold text-white mb-4">Authorization Progress</h4>
        
        {(() => {
          const totalRequired = transaction.requiredSignatures?.length || 0;
          const collected = transaction.collectedSignatures?.length || 0;
          const progress = totalRequired > 0 ? (collected / totalRequired) * 100 : 0;
          
          return (
            <>
              <div className="relative h-2 bg-white/10 rounded-full mb-4">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all duration-500" 
                  style={{ width: `${progress}%` }} 
                />
              </div>
              <div className="text-sm text-gray-300">
                {collected} / {totalRequired} required signatures collected
              </div>
            </>
          );
        })()}
      </div>

      {/* Required Signatures */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-400 mb-3">Required Signatures</h4>
        <div className="space-y-2">
          {transaction.requiredSignatures?.map((req, index) => {
            const hasSigned = transaction.collectedSignatures?.some(
              sig => sig.partyId === req.partyId
            );
            const isUser = address && req.partyId.toLowerCase() === address.toLowerCase();
            
            return (
              <div 
                key={req.partyId} 
                className={`flex items-center justify-between p-3 rounded-xl ${
                  hasSigned ? 'bg-emerald-500/10 border border-emerald-400/30' : 
                  isUser ? 'bg-cyan-500/10 border border-cyan-400/30' :
                  'bg-black/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    hasSigned ? 'bg-emerald-500' : 
                    isUser ? 'bg-cyan-500' :
                    'bg-gray-600'
                  }`}>
                    {hasSigned ? (
                      <CheckCircle className="w-4 h-4 text-white" />
                    ) : (
                      <Clock className="w-4 h-4 text-gray-300" />
                    )}
                  </div>
                  <div>
                    <span className="text-white font-medium">{req.name || req.role}</span>
                    {isUser && (
                      <div className="text-xs text-cyan-400">Ваша подпись требуется</div>
                    )}
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${
                  hasSigned ? 'bg-emerald-500/20 text-emerald-400' : 
                  isUser ? 'bg-cyan-500/20 text-cyan-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {hasSigned ? 'Signed' : isUser ? 'Your Turn' : 'Pending'}
                </span>
              </div>
            );
          }) || (
            <div className="text-gray-400 text-sm">No signatures required</div>
          )}
        </div>
      </div>
      
      {/* Validation Error */}
      {validationError && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-400/30 rounded-xl">
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>{validationError}</span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {address && userPermission?.canApprove && (
        <div className="border-t border-white/10 pt-6">
          <div className="flex items-center gap-2 mb-4">
            <UserCheck className="w-5 h-5 text-cyan-400" />
            <span className="text-white font-medium">Your Authorization Required</span>
          </div>

          {!selectedAction && !showConfirmation ? (
            <div className="flex gap-3">
              <button
                onClick={handleApproveClick}
                disabled={isProcessing}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-green-500 text-white font-medium rounded-xl hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle className="w-4 h-4 inline mr-2" />
                Approve
              </button>
              
              <button
                onClick={handleRejectClick}
                disabled={isProcessing}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-medium rounded-xl hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <AlertCircle className="w-4 h-4 inline mr-2" />
                Reject
              </button>
            </div>
          ) : null}

          {/* Approval Confirmation Modal */}
          <AnimatePresence>
            {showConfirmation && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                onClick={() => !isProcessing && setShowConfirmation(false)}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 max-w-md w-full border border-white/10 shadow-2xl"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-bold text-white">Подтверждение одобрения</h3>
                    <button
                      onClick={() => !isProcessing && setShowConfirmation(false)}
                      disabled={isProcessing}
                      className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  
                  <div className="space-y-4 mb-6">
                    <div className="p-4 bg-emerald-500/10 border border-emerald-400/30 rounded-xl">
                      <div className="flex items-center gap-2 mb-3">
                        <Shield className="w-5 h-5 text-emerald-400" />
                        <span className="text-emerald-400 font-medium">Детали транзакции</span>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Название:</span>
                          <span className="text-white font-semibold">{transaction.title}</span>
                        </div>
                        {transaction.amount && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Сумма:</span>
                            <span className="text-white font-semibold">
                              ${transaction.amount.toFixed(2)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-gray-400">Тип:</span>
                          <span className="text-white">{transaction.transactionType}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Статус:</span>
                          <span className="text-white">{transaction.status}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-3 bg-amber-500/10 border border-amber-400/30 rounded-xl">
                      <p className="text-amber-300 text-sm">
                        ⚠️ Это действие необратимо. Убедитесь, что вы ознакомились со всеми деталями транзакции.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => !isProcessing && setShowConfirmation(false)}
                      disabled={isProcessing}
                      className="flex-1 px-4 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors disabled:opacity-50"
                    >
                      Отмена
                    </button>
                    <button
                      onClick={handleApprove}
                      disabled={isProcessing}
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-green-500 text-white rounded-xl hover:shadow-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Обработка...
                        </span>
                      ) : (
                        'Подтвердить одобрение'
                      )}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}

            {selectedAction === 'reject' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4"
              >
                <div className="mb-2">
                  <label className="text-sm text-gray-400 mb-1 block">
                    Причина отклонения <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Укажите причину отклонения (минимум 10 символов)..."
                    className="w-full h-24 p-3 bg-black/20 border border-red-400/30 rounded-xl text-white placeholder-gray-400 resize-none focus:outline-none focus:border-red-400 transition-colors"
                  />
                  <div className="text-xs text-gray-400 mt-1">
                    {rejectReason.length}/10 символов (минимум)
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleReject}
                    disabled={!rejectReason.trim() || rejectReason.trim().length < 10 || isProcessing}
                    className="px-4 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isProcessing ? 'Обработка...' : 'Подтвердить отклонение'}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedAction(null);
                      setRejectReason('');
                    }}
                    disabled={isProcessing}
                    className="px-4 py-2 bg-white/10 text-white text-sm rounded-lg hover:bg-white/20 transition-colors disabled:opacity-50"
                  >
                    Отмена
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      
      {/* Already Signed Indicator */}
      {address && userPermission?.hasSigned && (
        <div className="border-t border-white/10 pt-6">
          <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-400/30 rounded-xl">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <span className="text-emerald-300 font-medium">Вы уже подписали эту транзакцию</span>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default MultiPartyAuthPanel;