'use client';

/**
 * 📊 MULTI-PARTY DASHBOARD 2025
 * 
 * Enterprise dashboard для monitoring multi-party workflows:
 * - Real-time transaction status tracking
 * - Party performance analytics
 * - Compliance monitoring dashboard
 * - Executive summary reports
 * - Risk assessment visualization
 * - Automated workflow optimization
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  TrendingUp,
  Shield,
  Clock,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  Activity,
  Target,
  Award,
  Bell,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  X
} from 'lucide-react';
import { MultiPartyAuthPanel } from './MultiPartyAuthPanel';
import { useMultiPartyWorkflowService } from '@/lib/canton/hooks/useMultiPartyWorkflowService';
import { 
  type MultiPartyTransaction,
  type TransactionType,
  type TransactionStatus
} from '@/lib/canton/services/multiPartyWorkflowService';

interface MultiPartyDashboardProps {
  userPartyId?: string;
  className?: string;
}

export const MultiPartyDashboard: React.FC<MultiPartyDashboardProps> = ({
  userPartyId,
  className = ''
}) => {
  // Use workflow service hook
  const {
    workflowService,
    transactions,
    isLoading,
    error,
    signTransaction,
    refreshTransactions
  } = useMultiPartyWorkflowService();
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | TransactionStatus | TransactionType>('ALL');
  const [selectedTransaction, setSelectedTransaction] = useState<MultiPartyTransaction | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Filtered and searched transactions
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;
    
    // Apply status/type filter
    if (selectedFilter !== 'ALL') {
      if (['PENDING_SIGNATURES', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED', 'EXECUTED'].includes(selectedFilter)) {
        filtered = filtered.filter(t => t.status === selectedFilter);
      } else {
        filtered = filtered.filter(t => t.transactionType === selectedFilter);
      }
    }
    
    // Apply user party filter
    if (userPartyId) {
      filtered = filtered.filter(t => 
        (t.requiredSignatures?.some(req => req.partyId === userPartyId) || false) ||
        t.initiator === userPartyId
      );
    }
    
    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.id.toLowerCase().includes(query) ||
        t.title.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.initiator.toLowerCase().includes(query) ||
        t.transactionType.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [transactions, selectedFilter, userPartyId, searchQuery]);
  
  // Paginated transactions
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredTransactions.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredTransactions, currentPage, itemsPerPage]);
  
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  
  // Dashboard metrics
  const dashboardMetrics = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const completedToday = transactions.filter(t => 
      t.completedAt && t.completedAt >= today
    ).length;
    
    const completedTransactions = transactions.filter(t => t.completedAt);
    const averageApprovalTime = completedTransactions.length > 0
      ? Math.round(
          completedTransactions.reduce((sum, t) => {
            const approvalTime = t.completedAt!.getTime() - (t.createdAt?.getTime() || Date.now());
            return sum + (approvalTime / 1000 / 60); // Convert to minutes
          }, 0) / completedTransactions.length
        )
      : 0;
    
    const complianceTransactions = transactions.filter(t => t.complianceCheck);
    const complianceScore = complianceTransactions.length > 0
      ? Math.round(
          (complianceTransactions.filter(t => 
            t.status === 'EXECUTED' || t.status === 'APPROVED'
          ).length / complianceTransactions.length) * 100
        )
      : 100;
    
    const uniqueParties = new Set<string>();
    transactions.forEach(t => {
      t.requiredSignatures?.forEach(req => uniqueParties.add(req.partyId));
      t.collectedSignatures?.forEach(sig => uniqueParties.add(sig.partyId));
    });
    
    return {
      totalTransactions: transactions.length,
      pendingApprovals: transactions.filter(t => t.status === 'PENDING_SIGNATURES').length,
      completedToday,
      averageApprovalTime,
      complianceScore,
      activeParties: uniqueParties.size
    };
  }, [transactions]);
  
  // Reset to first page when filter/search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFilter, searchQuery]);
  
  // Refresh data periodically
  useEffect(() => {
    if (!workflowService) return;
    
    const interval = setInterval(() => {
      refreshTransactions();
    }, 30000); // Refresh every 30 seconds
    
    return () => {
      clearInterval(interval);
    };
  }, [workflowService, refreshTransactions]);

  const handleApprove = async (transactionId: string, signature: string) => {
    if (!userPartyId) return;
    
    const success = await signTransaction(transactionId, signature);
    if (success) {
      await refreshTransactions();
    }
  };

  const handleReject = async (transactionId: string, reason: string) => {
    if (!userPartyId) return;
    
    // Reject by signing with rejection reason
    const success = await signTransaction(transactionId, `REJECTED: ${reason}`);
    if (success) {
      await refreshTransactions();
    }
  };
  
  // Export transactions to CSV
  const exportToCSV = () => {
    const headers = ['ID', 'Title', 'Type', 'Status', 'Initiator', 'Created At', 'Completed At'];
    const rows = filteredTransactions.map(t => [
      t.id,
      t.title,
      t.transactionType,
      t.status,
      t.initiator,
      t.createdAt?.toISOString() || '',
      t.completedAt?.toISOString() || ''
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `multi-party-transactions-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="text-white">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Dashboard Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-white">Multi-Party Authorization Dashboard</h2>
        {userPartyId && (
          <div className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 rounded-xl border border-cyan-400/30">
            <Users className="w-4 h-4 text-cyan-400" />
            <span className="text-cyan-300 text-sm">Signed in as: {userPartyId.slice(0, 12)}...</span>
          </div>
        )}
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          {
            label: 'Total Workflows',
            value: dashboardMetrics.totalTransactions,
            icon: Activity,
            color: 'text-blue-400',
            bgColor: 'from-blue-500/20 to-cyan-500/20'
          },
          {
            label: 'Pending Approvals',
            value: dashboardMetrics.pendingApprovals,
            icon: Clock,
            color: 'text-amber-400',
            bgColor: 'from-amber-500/20 to-yellow-500/20'
          },
          {
            label: 'Completed Today',
            value: dashboardMetrics.completedToday,
            icon: CheckCircle,
            color: 'text-emerald-400',
            bgColor: 'from-emerald-500/20 to-green-500/20'
          },
          {
            label: 'Avg Approval Time',
            value: `${dashboardMetrics.averageApprovalTime}min`,
            icon: TrendingUp,
            color: 'text-purple-400',
            bgColor: 'from-purple-500/20 to-pink-500/20'
          },
          {
            label: 'Compliance Score',
            value: `${dashboardMetrics.complianceScore}%`,
            icon: Shield,
            color: 'text-green-400',
            bgColor: 'from-green-500/20 to-emerald-500/20'
          },
          {
            label: 'Active Parties',
            value: dashboardMetrics.activeParties,
            icon: Users,
            color: 'text-cyan-400',
            bgColor: 'from-cyan-500/20 to-blue-500/20'
          }
        ].map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`bg-gradient-to-br ${metric.bgColor} backdrop-blur-xl rounded-2xl p-4 border border-white/10`}
          >
            <div className="flex items-center justify-between mb-2">
              <metric.icon className={`w-6 h-6 ${metric.color}`} />
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">{metric.value}</div>
            <div className="text-xs text-gray-300">{metric.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Search and Filter Controls */}
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск по ID, названию, описанию или инициатору..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400/50 transition-colors"
          />
        </div>
        
        {/* Filter and Export */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 overflow-x-auto pb-2">
            <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
            {[
              { id: 'ALL', label: 'Все' },
              { id: 'PENDING_SIGNATURES', label: 'Ожидают подписи' },
              { id: 'APPROVED', label: 'Одобрены' },
              { id: 'EXECUTED', label: 'Выполнены' },
              { id: 'ASSET_PURCHASE', label: 'Покупка активов' },
              { id: 'BRIDGE_TRANSFER', label: 'Bridge переводы' }
            ].map(filter => (
              <button
                key={filter.id}
                onClick={() => setSelectedFilter(filter.id as any)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex-shrink-0 ${
                  selectedFilter === filter.id
                    ? 'bg-cyan-500 text-white'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 text-gray-300 rounded-xl hover:bg-white/20 hover:text-white transition-all flex-shrink-0"
          >
            <Download className="w-4 h-4" />
            <span className="text-sm">Экспорт CSV</span>
          </button>
        </div>
      </div>

      {/* Transactions List */}
      <div className="space-y-4">
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-400/30 rounded-xl">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </div>
        )}
        
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <div className="text-white mt-4">Загрузка транзакций...</div>
          </div>
        ) : paginatedTransactions.length === 0 ? (
          <div className="text-center py-12 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10">
            <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <div className="text-white text-lg font-medium mb-2">Транзакции не найдены</div>
            <div className="text-gray-400">
              {searchQuery 
                ? `Нет транзакций, соответствующих запросу: "${searchQuery}"`
                : selectedFilter === 'ALL' 
                  ? 'Нет активных multi-party транзакций'
                  : `Нет транзакций с фильтром: ${selectedFilter}`
              }
            </div>
          </div>
        ) : (
          <>
            {paginatedTransactions.map((transaction, index) => (
              <motion.div
                key={transaction.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="relative"
              >
                <div className="absolute top-4 right-4 z-10">
                  <button
                    onClick={() => setSelectedTransaction(transaction)}
                    className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                    title="Детали транзакции"
                  >
                    <Eye className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                <MultiPartyAuthPanel
                  transaction={transaction}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              </motion.div>
            ))}
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <div className="text-gray-400 text-sm">
                  Показано {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} из {filteredTransactions.length}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 bg-white/10 rounded-lg hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                            currentPage === pageNum
                              ? 'bg-cyan-500 text-white'
                              : 'bg-white/10 text-gray-300 hover:bg-white/20'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 bg-white/10 rounded-lg hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Transaction Detail Modal */}
      <AnimatePresence>
        {selectedTransaction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedTransaction(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 max-w-2xl w-full border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">Детали транзакции</h3>
                <button
                  onClick={() => setSelectedTransaction(null)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-gray-400 mb-1">ID транзакции</div>
                  <div className="text-white font-mono text-sm">{selectedTransaction.id}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400 mb-1">Название</div>
                  <div className="text-white font-semibold">{selectedTransaction.title}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400 mb-1">Описание</div>
                  <div className="text-white">{selectedTransaction.description}</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Тип</div>
                    <div className="text-white">{selectedTransaction.transactionType}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Статус</div>
                    <div className="text-white">{selectedTransaction.status}</div>
                  </div>
                </div>
                {selectedTransaction.amount && (
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Сумма</div>
                    <div className="text-white font-semibold">${selectedTransaction.amount.toString()}</div>
                  </div>
                )}
                <div>
                  <div className="text-sm text-gray-400 mb-2">Требуемые подписи</div>
                  <div className="space-y-2">
                    {selectedTransaction.requiredSignatures?.map((req, idx) => (
                      <div key={idx} className="p-3 bg-white/5 rounded-lg">
                        <div className="text-white font-medium">{req.name} ({req.role})</div>
                        <div className="text-sm text-gray-400">{req.partyId}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-400 mb-2">Собранные подписи</div>
                  <div className="space-y-2">
                    {selectedTransaction.collectedSignatures?.map((sig, idx) => (
                      <div key={idx} className="p-3 bg-emerald-500/10 rounded-lg">
                        <div className="text-emerald-400 font-medium">{sig.partyId}</div>
                        <div className="text-sm text-gray-400">
                          Подписано: {sig.signedAt.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MultiPartyDashboard;
