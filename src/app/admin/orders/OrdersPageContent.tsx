/**
 * 📦 Orders Page Content Component
 * Полнофункциональное управление заказами
 */

'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import OrdersTable from '@/components/admin/OrdersTable';
import OrderEditModal from '@/components/admin/OrderEditModal';
import { OTCOrder } from '@/config/otc';
import { Search, RefreshCw } from 'lucide-react';
import { useApiCall } from '@/hooks/useApiCall';
import { useLogger } from '@/hooks/useLogger';

export default function OrdersPageContent() {
  const logger = useLogger('OrdersPageContent');
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [editingOrder, setEditingOrder] = useState<OTCOrder | null>(null);

  // ✅ ИСПРАВЛЕНИЕ: Используем useRef для хранения актуальных значений фильтров
  // Это предотвращает пересоздание loadOrdersData при каждом изменении фильтров
  const filtersRef = useRef({ page, searchTerm, statusFilter });
  filtersRef.current = { page, searchTerm, statusFilter };

  const { execute: loadOrders, loading, data: ordersData } = useApiCall<{
    orders: OTCOrder[];
    totalPages: number;
  }>({
    showToast: false,
    // ✅ НЕ передаём onSuccess/onError - они создавали нестабильные зависимости
  });

  const orders = useMemo(() => ordersData?.orders || [], [ordersData?.orders]);
  const totalPagesFromData = useMemo(() => ordersData?.totalPages || 1, [ordersData?.totalPages]);

  // ✅ ИСПРАВЛЕНИЕ: Стабильная функция загрузки без внешних зависимостей
  const loadOrdersData = useCallback(async () => {
    const { page, statusFilter, searchTerm } = filtersRef.current;
    const params = new URLSearchParams({
      page: page.toString(),
      limit: '20',
    });

    if (statusFilter) params.set('status', statusFilter);
    if (searchTerm) params.set('search', searchTerm);

    logger.info('Loading orders', { page, statusFilter, searchTerm });
    const result = await loadOrders(`/api/admin/orders?${params}`);
    if (result) {
      logger.success('Orders loaded successfully', { count: result.orders.length });
    }
  }, [loadOrders, logger]);

  // ✅ ИСПРАВЛЕНИЕ: Загружаем данные только при изменении примитивных значений фильтров
  useEffect(() => {
    loadOrdersData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter]); // Зависимости только от примитивов!

  const handleSearch = useCallback(() => {
    setPage(1);
    loadOrdersData();
  }, [loadOrdersData]);

  const handleEdit = useCallback((order: OTCOrder) => {
    logger.info('Editing order', { orderId: order.orderId });
    setEditingOrder(order);
  }, [logger]);

  const { execute: updateOrder } = useApiCall({
    onSuccess: () => {
      logger.success('Order updated successfully');
      loadOrdersData();
    },
    onError: (error) => {
      logger.error('Failed to update order', error);
    }
  });

  const { execute: deleteOrder } = useApiCall({
    onSuccess: () => {
      logger.success('Order deleted successfully');
      loadOrdersData();
    },
    onError: (error) => {
      logger.error('Failed to delete order', error);
    }
  });

  const handleSave = useCallback(async (orderId: string, updates: Partial<OTCOrder>) => {
    logger.info('Saving order', { orderId, updates });
    await updateOrder(`/api/admin/orders/${orderId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }, [updateOrder, logger]);

  const handleDelete = useCallback(async (orderId: string) => {
    logger.info('Deleting order', { orderId });
    await deleteOrder(`/api/admin/orders/${orderId}`, {
      method: 'DELETE',
    });
  }, [deleteOrder, logger]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Заказы</h1>
          <p className="text-gray-600 mt-1">Управление всеми заказами OTC обменника</p>
        </div>
        <button
          onClick={loadOrdersData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Поиск по Order ID, Email, Canton Address..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
          </div>
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            >
              <option value="">Все статусы</option>
              <option value="awaiting-deposit">Ожидает депозита</option>
              <option value="awaiting-confirmation">Ожидает подтверждения</option>
              <option value="exchanging">Обмен</option>
              <option value="sending">Отправка</option>
              <option value="completed">Завершён</option>
              <option value="failed">Ошибка</option>
            </select>
          </div>
          <div>
            <button
              onClick={handleSearch}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Search className="h-4 w-4" />
              Поиск
            </button>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Загрузка заказов...</p>
        </div>
      ) : (
        <OrdersTable
          orders={orders}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onViewDetails={(id) => {
            // Find and open edit modal
            const order = orders.find(o => o.orderId === id);
            if (order) handleEdit(order);
          }}
        />
      )}

      {/* Pagination */}
      {totalPagesFromData > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Назад
          </button>
          <span className="text-gray-600 px-4 py-2 bg-gray-50 rounded-lg">
            Страница {page} из {totalPagesFromData}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPagesFromData, p + 1))}
            disabled={page === totalPagesFromData}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Вперёд
          </button>
        </div>
      )}

      {/* Edit Modal */}
      {editingOrder && (
        <OrderEditModal
          order={editingOrder}
          onClose={() => setEditingOrder(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

