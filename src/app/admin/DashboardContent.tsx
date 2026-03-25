/**
 * 📊 Dashboard Content Component
 * Контент дашборда с реальной статистикой из Google Sheets
 */

'use client';

import { useEffect, useMemo, useCallback } from 'react';
import StatsCard from '@/components/admin/StatsCard';
import OrdersTable from '@/components/admin/OrdersTable';
import { 
  DollarSign, 
  ShoppingCart, 
  CheckCircle, 
  Clock,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { OTCOrder } from '@/config/otc';
import { useApiCall } from '@/hooks/useApiCall';
import { useLogger } from '@/hooks/useLogger';

interface Stats {
  totalOrders: number;
  totalVolume: number;
  completedOrders: number;
  pendingOrders: number;
  failedOrders: number;
  todayOrders: number;
  todayVolume: number;
  averageOrderValue: number;
  ordersByStatus: Record<string, number>;
  recentOrders: OTCOrder[];
}

export default function DashboardContent() {
  const logger = useLogger('DashboardContent');
  
  // ✅ ИСПРАВЛЕНИЕ: Обёрнуты callback функции в useCallback для стабильности
  const handleSuccess = useCallback((data: unknown) => {
    logger.success('Dashboard stats loaded successfully', { statsCount: Object.keys(data as object).length });
  }, [logger]);
  
  const handleError = useCallback((error: Error) => {
    logger.error('Failed to load dashboard stats', error);
  }, [logger]);
  
  const { execute: loadStats, loading, error, data: stats } = useApiCall<Stats>({
    showToast: false,
    onSuccess: handleSuccess,
    onError: handleError
  });

  // ✅ ИСПРАВЛЕНИЕ: Загружаем данные только один раз при монтировании компонента
  useEffect(() => {
    logger.info('Loading dashboard stats');
    loadStats('/api/admin/stats');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Пустой массив = загрузка только при монтировании

  const todayChange = useMemo(() => {
    if (!stats) return 'Нет данных';
    return stats.todayOrders > 0 
      ? `+${stats.todayOrders} сегодня`
      : 'Нет заказов сегодня';
  }, [stats]);

  const handleViewDetails = useCallback((id: string) => {
    logger.info('Viewing order details', { orderId: id });
    if (typeof window !== 'undefined') {
      window.location.href = `/admin/orders?id=${id}`;
    }
  }, [logger]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Загрузка статистики...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <p className="text-gray-600">
          {error ? `Ошибка загрузки: ${error.message}` : 'Не удалось загрузить статистику'}
        </p>
        <button
          onClick={() => loadStats('/api/admin/stats')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Обзор работы OTC обменника</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Всего заказов"
          value={stats.totalOrders}
          change={todayChange}
          changeType="positive"
          icon={ShoppingCart}
          iconColor="bg-blue-500"
        />
        <StatsCard
          title="Общий объём"
          value={`$${stats.totalVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          change={`$${stats.todayVolume.toFixed(2)} сегодня`}
          changeType="positive"
          icon={DollarSign}
          iconColor="bg-green-500"
        />
        <StatsCard
          title="Завершённые"
          value={stats.completedOrders}
          change={`${((stats.completedOrders / stats.totalOrders) * 100 || 0).toFixed(1)}% успеха`}
          changeType="positive"
          icon={CheckCircle}
          iconColor="bg-emerald-500"
        />
        <StatsCard
          title="В обработке"
          value={stats.pendingOrders}
          icon={Clock}
          iconColor="bg-yellow-500"
        />
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Средний чек</h3>
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-blue-500 mr-3" />
            <div>
              <p className="text-3xl font-bold text-gray-900">
                ${stats.averageOrderValue.toFixed(2)}
              </p>
              <p className="text-sm text-gray-600">На один заказ</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Статистика по статусам</h3>
          <div className="space-y-2">
            {Object.entries(stats.ordersByStatus).map(([status, count]) => (
              <div key={status} className="flex justify-between items-center">
                <span className="text-sm text-gray-600 capitalize">{status}</span>
                <span className="text-sm font-semibold text-gray-900">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Последние заказы</h2>
          <a 
            href="/admin/orders" 
            className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            Все заказы →
          </a>
        </div>
        <OrdersTable 
          orders={stats.recentOrders}
          onViewDetails={handleViewDetails}
        />
      </div>
    </div>
  );
}



