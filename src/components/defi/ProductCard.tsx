'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LucideIcon, DollarSign, CheckCircle, AlertCircle, Clock, X, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import { useAccount } from 'wagmi';

export interface ProductCardProps {
  id: string;
  name: string;
  icon: LucideIcon;
  description: string;
  apy: string;
  minInvestment: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  status: 'live' | 'pending' | 'initializing' | 'coming-soon';
  totalLocked: number;
  participants: number;
  features: string[];
  color: string;
  onInvest?: (amount: number) => void | Promise<void>;
  isLoading?: boolean;
  className?: string;
}

const statusConfig = {
  live: {
    label: 'Live',
    icon: CheckCircle,
    className: 'bg-emerald-500/20 text-emerald-400 border-emerald-400/30',
    dot: 'bg-emerald-400'
  },
  pending: {
    label: 'Pending',
    icon: Clock,
    className: 'bg-amber-500/20 text-amber-400 border-amber-400/30',
    dot: 'bg-amber-400'
  },
  initializing: {
    label: 'Initializing',
    icon: Clock,
    className: 'bg-blue-500/20 text-blue-400 border-blue-400/30',
    dot: 'bg-blue-400'
  },
  'coming-soon': {
    label: 'Coming Soon',
    icon: AlertCircle,
    className: 'bg-gray-500/20 text-gray-400 border-gray-400/30',
    dot: 'bg-gray-400'
  }
};

const riskConfig = {
  Low: { color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  Medium: { color: 'text-amber-400', bg: 'bg-amber-500/10' },
  High: { color: 'text-red-400', bg: 'bg-red-500/10' }
};

export const ProductCard: React.FC<ProductCardProps> = ({
  name,
  icon: Icon,
  description,
  apy,
  minInvestment,
  riskLevel,
  status,
  totalLocked,
  participants,
  features,
  color,
  onInvest,
  isLoading = false,
  className
}) => {
  const { address, isConnected } = useAccount();
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [investmentAmount, setInvestmentAmount] = useState<string>(minInvestment.toString());
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const statusInfo = statusConfig[status];
  const riskInfo = riskConfig[riskLevel];
  const StatusIcon = statusInfo.icon;

  // Validate investment amount
  const validateInvestment = (amount: number): { valid: boolean; error?: string } => {
    if (!isConnected || !address) {
      return { valid: false, error: 'Подключите кошелек для инвестирования' };
    }
    
    if (amount < minInvestment) {
      return { valid: false, error: `Минимальная сумма инвестирования: $${minInvestment.toLocaleString()}` };
    }
    
    if (isNaN(amount) || amount <= 0) {
      return { valid: false, error: 'Введите корректную сумму' };
    }
    
    return { valid: true };
  };

  const handleInvestClick = () => {
    if (status !== 'live' || !onInvest || isLoading) return;
    
    setInvestmentAmount(minInvestment.toString());
    setValidationError(null);
    setShowConfirmation(true);
  };

  const handleInvest = async () => {
    if (!onInvest || !address || !isConnected) {
      toast.error('Подключите кошелек');
      return;
    }
    
    const amount = parseFloat(investmentAmount);
    const validation = validateInvestment(amount);
    
    if (!validation.valid) {
      setValidationError(validation.error || 'Ошибка валидации');
      toast.error(validation.error || 'Ошибка валидации');
      return;
    }
    
    setIsProcessing(true);
    setValidationError(null);
    
    try {
      await onInvest(amount);
      toast.success(`✅ Успешно инвестировано $${amount.toLocaleString()}`);
      setShowConfirmation(false);
      setInvestmentAmount(minInvestment.toString());
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Ошибка при инвестировании';
      setValidationError(errorMsg);
      toast.error(`❌ ${errorMsg}`);
      console.error('Investment error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -4 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'relative group bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all duration-300',
        className
      )}
    >
      {/* Status Badge */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <div className={cn('w-2 h-2 rounded-full animate-pulse', statusInfo.dot)} />
        <div className={cn(
          'px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5',
          statusInfo.className
        )}>
          <StatusIcon className="w-3 h-3" />
          <span>{statusInfo.label}</span>
        </div>
      </div>

      {/* Product Icon */}
      <div className={cn(
        'w-16 h-16 rounded-xl bg-gradient-to-br flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300',
        color
      )}>
        <Icon className="w-8 h-8 text-white" />
      </div>

      {/* Product Info */}
      <h3 className="text-2xl font-bold text-white mb-2">{name}</h3>
      <p className="text-gray-300 text-sm mb-4 leading-relaxed line-clamp-2">{description}</p>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-2xl font-bold text-emerald-400 mb-1">{apy}</div>
          <div className="text-xs text-gray-400">Annual Yield</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold text-white mb-1">${minInvestment.toLocaleString()}+</div>
          <div className="text-xs text-gray-400">Minimum</div>
        </div>
      </div>

      {/* Risk Level */}
      <div className={cn('inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium mb-4', riskInfo.bg)}>
        <div className={cn('w-2 h-2 rounded-full', riskInfo.color.replace('text-', 'bg-'))} />
        <span className={riskInfo.color}>{riskLevel} Risk</span>
      </div>

      {/* Features - Compact */}
      <div className="space-y-1.5 mb-4">
        {features.slice(0, 3).map((feature, idx) => (
          <div key={idx} className="flex items-center gap-2 text-xs text-gray-300">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span className="line-clamp-1">{feature}</span>
          </div>
        ))}
        {features.length > 3 && (
          <div className="text-xs text-gray-400 pl-5">+{features.length - 3} more</div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10 mb-4">
        <div>
          <div className="text-lg font-semibold text-white">${(totalLocked / 1000000).toFixed(1)}M</div>
          <div className="text-xs text-gray-400">Total Locked</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold text-white">{participants.toLocaleString()}</div>
          <div className="text-xs text-gray-400">Participants</div>
        </div>
      </div>

      {/* CTA Button */}
      <motion.button
        whileHover={status === 'live' && !isLoading ? { scale: 1.02 } : {}}
        whileTap={status === 'live' && !isLoading ? { scale: 0.98 } : {}}
        onClick={handleInvestClick}
        disabled={status !== 'live' || isLoading || isProcessing}
        className={cn(
          'w-full py-3 px-6 rounded-xl font-semibold transition-all duration-300 relative',
          status === 'live' && !isLoading && !isProcessing
            ? 'bg-gradient-to-r from-cyan-500 to-emerald-500 text-white hover:shadow-lg hover:shadow-cyan-500/25 cursor-pointer'
            : 'bg-white/5 text-gray-400 border border-white/10 cursor-not-allowed',
          (isLoading || isProcessing) && 'opacity-50 cursor-wait'
        )}
      >
        {isLoading || isProcessing ? (
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Processing...</span>
          </div>
        ) : status === 'live' ? (
          <span className="flex items-center justify-center gap-2">
            <DollarSign className="w-4 h-4" />
            Invest ${minInvestment.toLocaleString()}
          </span>
        ) : status === 'initializing' ? (
          <span className="flex items-center justify-center gap-2">
            <Clock className="w-4 h-4" />
            Initializing...
          </span>
        ) : (
          <span>Coming Soon</span>
        )}
      </motion.button>
      
      {/* Confirmation Modal */}
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
                <h3 className="text-2xl font-bold text-white">Подтверждение инвестирования</h3>
                <button
                  onClick={() => !isProcessing && setShowConfirmation(false)}
                  disabled={isProcessing}
                  className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Сумма инвестирования
                  </label>
                  <input
                    type="number"
                    value={investmentAmount}
                    onChange={(e) => {
                      setInvestmentAmount(e.target.value);
                      setValidationError(null);
                    }}
                    min={minInvestment}
                    step="0.01"
                    disabled={isProcessing}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400/50 transition-colors disabled:opacity-50"
                    placeholder={`Минимум $${minInvestment.toLocaleString()}`}
                  />
                  {validationError && (
                    <div className="mt-2 flex items-center gap-2 text-red-400 text-sm">
                      <AlertTriangle className="w-4 h-4" />
                      <span>{validationError}</span>
                    </div>
                  )}
                </div>
                
                <div className="p-4 bg-cyan-500/10 border border-cyan-400/30 rounded-xl">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Продукт:</span>
                      <span className="text-white font-semibold">{name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Ожидаемая доходность:</span>
                      <span className="text-emerald-400 font-semibold">{apy}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Уровень риска:</span>
                      <span className={riskInfo.color}>{riskLevel}</span>
                    </div>
                  </div>
                </div>
                
                <div className="p-3 bg-amber-500/10 border border-amber-400/30 rounded-xl">
                  <p className="text-amber-300 text-sm">
                    ⚠️ Убедитесь, что вы ознакомились с условиями инвестирования и понимаете связанные риски.
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
                  onClick={handleInvest}
                  disabled={isProcessing || !investmentAmount || parseFloat(investmentAmount) < minInvestment}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-cyan-500 to-emerald-500 text-white rounded-xl hover:shadow-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Обработка...
                    </span>
                  ) : (
                    `Инвестировать $${parseFloat(investmentAmount || '0').toLocaleString()}`
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hover Glow Effect */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none -z-10" />
    </motion.div>
  );
};
