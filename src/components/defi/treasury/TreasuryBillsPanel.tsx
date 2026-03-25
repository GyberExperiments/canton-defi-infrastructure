'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  DollarSign, 
  TrendingUp, 
  Shield, 
  Clock, 
  CheckCircle,
  AlertCircle,
  ArrowUpRight,
  Calendar,
  BarChart3,
  Info,
  X
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { useTreasuryBills } from '@/lib/canton/hooks/useTreasuryBills';
import { ProductCardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';

// Types
export interface TreasuryBill {
  id: string;
  name: string;
  symbol: string;
  maturityDate: string;
  apy: number;
  pricePerToken: number;
  minInvestment: number;
  totalSupply: number;
  availableSupply: number;
  riskLevel: 'Ultra-Low' | 'Low' | 'Medium';
  status: 'live' | 'pending' | 'coming-soon';
  features: string[];
}

export interface TreasuryHolding {
  id: string;
  billId: string;
  billName: string;
  tokensOwned: number;
  averagePrice: number;
  currentValue: number;
  yieldEarned: number;
  purchaseDate: string;
  maturityDate: string;
}

// Treasury Bills Panel Component
export const TreasuryBillsPanel: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [selectedBill, setSelectedBill] = useState<TreasuryBill | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseAmount, setPurchaseAmount] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'market' | 'holdings'>('market');

  const {
    availableBills,
    userHoldings,
    isLoading,
    error,
    purchaseTokens,
    refreshData
  } = useTreasuryBills(address ?? undefined);

  // Calculate portfolio stats
  const portfolioStats = useMemo(() => {
    if (!userHoldings || userHoldings.length === 0) {
      return {
        totalValue: 0,
        totalYield: 0,
        averageAPY: 0,
        holdingsCount: 0
      };
    }

    const totalValue = userHoldings.reduce((sum, h) => sum + h.currentValue, 0);
    const totalYield = userHoldings.reduce((sum, h) => sum + h.yieldEarned, 0);
    const averageAPY = userHoldings.reduce((sum, h) => sum + (h.yieldEarned / h.averagePrice * 100), 0) / userHoldings.length;

    return {
      totalValue,
      totalYield,
      averageAPY,
      holdingsCount: userHoldings.length
    };
  }, [userHoldings]);

  // Handle purchase
  const handlePurchase = async () => {
    if (!selectedBill || !address || !isConnected) {
      toast.error('Подключите кошелек для покупки');
      return;
    }

    const amount = parseFloat(purchaseAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Введите корректную сумму');
      return;
    }

    if (amount < selectedBill.minInvestment) {
      toast.error(`Минимальная сумма: $${selectedBill.minInvestment.toLocaleString()}`);
      return;
    }

    setIsProcessing(true);
    try {
      await purchaseTokens({
        billId: selectedBill.id,
        investorAddress: address,
        amount,
        paymentMethod: { type: 'CRYPTO', currency: 'USDT', details: {} }
      });

      toast.success(`✅ Успешно куплено токенов на $${amount.toLocaleString()}`);
      setShowPurchaseModal(false);
      setPurchaseAmount('');
      setSelectedBill(null);
      await refreshData();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Ошибка при покупке';
      toast.error(`❌ ${errorMsg}`);
      console.error('Purchase error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Risk level config
  const riskConfig = {
    'Ultra-Low': { color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Ultra-Low' },
    'Low': { color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Low' },
    'Medium': { color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Medium' }
  };

  // Status config
  const statusConfig = {
    live: { label: 'Live', icon: CheckCircle, className: 'bg-emerald-500/20 text-emerald-400 border-emerald-400/30' },
    pending: { label: 'Pending', icon: Clock, className: 'bg-amber-500/20 text-amber-400 border-amber-400/30' },
    'coming-soon': { label: 'Coming Soon', icon: AlertCircle, className: 'bg-gray-500/20 text-gray-400 border-gray-400/30' }
  };

  if (error) {
    return <ErrorState message={error.message} onRetry={refreshData} />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-full border border-blue-400/30 mb-6">
          <Shield className="w-4 h-4 text-blue-400" />
          <span className="text-blue-300 text-sm font-medium">US Treasury Bills</span>
        </div>
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
            Treasury Bills Tokenization
          </span>
        </h2>
        <p className="text-xl text-gray-300 max-w-3xl mx-auto">
          Fractional ownership of US Treasury Bills with instant settlement (T+0) and automatic yield distribution
        </p>
      </motion.div>

      {/* Portfolio Stats */}
      {isConnected && userHoldings && userHoldings.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-6"
        >
          {[
            { label: 'Total Value', value: `$${portfolioStats.totalValue.toLocaleString()}`, icon: DollarSign, color: 'text-cyan-400' },
            { label: 'Total Yield', value: `$${portfolioStats.totalYield.toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-400' },
            { label: 'Average APY', value: `${portfolioStats.averageAPY.toFixed(1)}%`, icon: BarChart3, color: 'text-blue-400' },
            { label: 'Holdings', value: portfolioStats.holdingsCount.toString(), icon: Shield, color: 'text-purple-400' }
          ].map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10"
            >
              <stat.icon className={`w-8 h-8 ${stat.color} mb-3`} />
              <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
              <div className="text-gray-400 text-sm">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex justify-center"
      >
        <div className="flex bg-white/5 backdrop-blur-xl rounded-2xl p-2 border border-white/10">
          {[
            { id: 'market', name: 'Market', icon: BarChart3 },
            { id: 'holdings', name: 'My Holdings', icon: Shield }
          ].map((tab) => (
            <motion.button
              key={tab.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              data-testid={tab.testId}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300',
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg'
                  : 'text-gray-300 hover:text-white hover:bg-white/10'
              )}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.name}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'market' && (
          <motion.div
            key="market"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            ) : !availableBills || availableBills.length === 0 ? (
              <EmptyState
                icon={Shield}
                title="No Treasury Bills Available"
                description="Check back soon for new investment opportunities."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {availableBills.map((bill, index) => {
                  const riskInfo = riskConfig[bill.riskLevel];
                  const statusInfo = statusConfig[bill.status];
                  const StatusIcon = statusInfo.icon;

                  return (
                    <motion.div
                      key={bill.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: 1.02, y: -4 }}
                      className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all duration-300 group"
                    >
                      {/* Status Badge */}
                      <div className="absolute top-4 right-4 flex items-center gap-2">
                        <div className={cn('w-2 h-2 rounded-full animate-pulse', bill.status === 'live' ? 'bg-emerald-400' : 'bg-gray-400')} />
                        <div className={cn('px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5', statusInfo.className)}>
                          <StatusIcon className="w-3 h-3" />
                          <span>{statusInfo.label}</span>
                        </div>
                      </div>

                      {/* Bill Info */}
                      <div className="mb-4">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                            <DollarSign className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-white">{bill.name}</h3>
                            <div className="text-sm text-gray-400">{bill.symbol}</div>
                          </div>
                        </div>
                      </div>

                      {/* Key Metrics */}
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <div className="text-2xl font-bold text-emerald-400 mb-1">{bill.apy.toFixed(1)}%</div>
                          <div className="text-xs text-gray-400">Annual Yield</div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-white mb-1">${bill.pricePerToken.toFixed(2)}</div>
                          <div className="text-xs text-gray-400">Per Token</div>
                        </div>
                      </div>

                      {/* Maturity Date */}
                      <div className="flex items-center gap-2 mb-4 text-sm text-gray-300">
                        <Calendar className="w-4 h-4 text-blue-400" />
                        <span>Maturity: {new Date(bill.maturityDate).toLocaleDateString()}</span>
                      </div>

                      {/* Risk Level */}
                      <div className={cn('inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium mb-4', riskInfo.bg)}>
                        <div className={cn('w-2 h-2 rounded-full', riskInfo.color.replace('text-', 'bg-'))} />
                        <span className={riskInfo.color}>{riskInfo.label} Risk</span>
                      </div>

                      {/* Features */}
                      <div className="space-y-1.5 mb-4">
                        {bill.features.slice(0, 3).map((feature, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs text-gray-300">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                            <span className="line-clamp-1">{feature}</span>
                          </div>
                        ))}
                      </div>

                      {/* Supply Info */}
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10 mb-4">
                        <div>
                          <div className="text-sm font-semibold text-white mb-1">
                            ${(bill.availableSupply / 1000000).toFixed(1)}M
                          </div>
                          <div className="text-xs text-gray-400">Available</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-white mb-1">
                            ${bill.minInvestment.toLocaleString()}+
                          </div>
                          <div className="text-xs text-gray-400">Minimum</div>
                        </div>
                      </div>

                      {/* CTA Button */}
                      <motion.button
                        whileHover={bill.status === 'live' ? { scale: 1.02 } : {}}
                        whileTap={bill.status === 'live' ? { scale: 0.98 } : {}}
                        onClick={() => {
                          if (bill.status === 'live') {
                            setSelectedBill(bill);
                            setPurchaseAmount(bill.minInvestment.toString());
                            setShowPurchaseModal(true);
                          }
                        }}
                        disabled={bill.status !== 'live'}
                        className={cn(
                          'w-full py-3 px-6 rounded-xl font-semibold transition-all duration-300',
                          bill.status === 'live'
                            ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:shadow-lg hover:shadow-cyan-500/25 cursor-pointer'
                            : 'bg-white/5 text-gray-400 border border-white/10 cursor-not-allowed'
                        )}
                      >
                        <span className="flex items-center justify-center gap-2">
                          <DollarSign className="w-4 h-4" />
                          {bill.status === 'live' ? 'Purchase Tokens' : 'Coming Soon'}
                        </span>
                      </motion.button>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'holdings' && (
          <motion.div
            key="holdings"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {!isConnected ? (
              <EmptyState
                icon={Shield}
                title="Connect Wallet"
                description="Connect your wallet to view your Treasury Bill holdings."
              />
            ) : !userHoldings?.length ? (
              <EmptyState
                icon={DollarSign}
                title="No Holdings Yet"
                description="Purchase Treasury Bills to start earning yield."
              />
            ) : (
              <div className="space-y-4">
                {userHoldings.map((holding, index) => (
                  <motion.div
                    key={holding.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                          <DollarSign className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-white">{holding.billName}</h3>
                          <div className="text-sm text-gray-400">
                            {holding.tokensOwned.toLocaleString()} tokens
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">
                          ${holding.currentValue.toLocaleString()}
                        </div>
                        <div className="text-sm text-emerald-400">
                          +${holding.yieldEarned.toLocaleString()} yield
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-white/10">
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Purchase Date</div>
                        <div className="text-sm text-white">
                          {new Date(holding.purchaseDate).toLocaleDateString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Maturity Date</div>
                        <div className="text-sm text-white">
                          {new Date(holding.maturityDate).toLocaleDateString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Average Price</div>
                        <div className="text-sm text-white">
                          ${holding.averagePrice.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Yield Earned</div>
                        <div className="text-sm text-emerald-400">
                          {((holding.yieldEarned / holding.averagePrice) * 100).toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Purchase Modal */}
      <AnimatePresence>
        {showPurchaseModal && selectedBill && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => !isProcessing && setShowPurchaseModal(false)}
            data-testid="modal-backdrop"
          >
            <motion.div
              data-testid="purchase-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 max-w-md w-full border border-white/10 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">Purchase Treasury Bills</h3>
                <button
                  onClick={() => !isProcessing && setShowPurchaseModal(false)}
                  disabled={isProcessing}
                  className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div className="p-4 bg-blue-500/10 border border-blue-400/30 rounded-xl">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-lg font-bold text-white">{selectedBill.name}</div>
                      <div className="text-sm text-gray-400">{selectedBill.symbol}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-gray-400">APY</div>
                      <div className="text-emerald-400 font-semibold" data-testid="modal-bill-apy">{selectedBill.apy.toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Maturity</div>
                      <div className="text-white font-semibold">
                        {new Date(selectedBill.maturityDate).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Investment Amount (USD)
                  </label>
                  <input
                    type="number"
                    data-testid="purchase-amount-input"
                    value={purchaseAmount}
                    onChange={(e) => setPurchaseAmount(e.target.value)}
                    min={selectedBill.minInvestment}
                    step="0.01"
                    disabled={isProcessing}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400/50 transition-colors disabled:opacity-50"
                    placeholder={`Minimum: $${selectedBill.minInvestment.toLocaleString()}`}
                  />
                </div>

                {purchaseAmount && parseFloat(purchaseAmount) >= selectedBill.minInvestment && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-400/30 rounded-xl">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Tokens to receive:</span>
                        <span className="text-white font-semibold">
                          {(parseFloat(purchaseAmount) / selectedBill.pricePerToken).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Expected annual yield:</span>
                        <span className="text-emerald-400 font-semibold">
                          ${(parseFloat(purchaseAmount) * selectedBill.apy / 100).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-3 bg-amber-500/10 border border-amber-400/30 rounded-xl">
                  <p className="text-amber-300 text-sm">
                    ⚠️ Treasury Bills are backed by the US government. Returns are guaranteed at maturity.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  data-testid="cancel-purchase-button"
                  onClick={() => !isProcessing && setShowPurchaseModal(false)}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  data-testid="confirm-purchase-button"
                  onClick={handlePurchase}
                  disabled={isProcessing || !purchaseAmount || parseFloat(purchaseAmount) < selectedBill.minInvestment}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:shadow-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    `Purchase $${parseFloat(purchaseAmount || '0').toLocaleString()}`
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TreasuryBillsPanel;
