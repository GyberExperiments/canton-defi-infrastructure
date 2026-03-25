/**
 * 📋 Orders Table Component
 * Таблица заказов с фильтрацией и пагинацией
 */

'use client';

import { OTCOrder } from '@/config/otc';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Edit, Trash2, ExternalLink, Package } from 'lucide-react';
import { memo } from 'react';

interface OrdersTableProps {
  orders: OTCOrder[];
  onEdit?: (order: OTCOrder) => void;
  onDelete?: (orderId: string) => void;
  onViewDetails?: (orderId: string) => void;
}

const statusColors: Record<string, string> = {
  'awaiting-deposit': 'bg-yellow-100 text-yellow-800',
  'awaiting-confirmation': 'bg-blue-100 text-blue-800',
  'exchanging': 'bg-purple-100 text-purple-800',
  'sending': 'bg-indigo-100 text-indigo-800',
  'completed': 'bg-green-100 text-green-800',
  'failed': 'bg-red-100 text-red-800',
};

const statusLabels: Record<string, string> = {
  'awaiting-deposit': 'Ожидает депозита',
  'awaiting-confirmation': 'Ожидает подтверждения',
  'exchanging': 'Обмен',
  'sending': 'Отправка',
  'completed': 'Завершён',
  'failed': 'Ошибка',
};

const OrdersTable = memo(function OrdersTable({ orders, onEdit, onDelete, onViewDetails }: OrdersTableProps) {
  return (
    <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Order ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount (USD)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Canton
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center">
                    <Package className="h-12 w-12 text-gray-300 mb-4" />
                    <p className="text-lg font-medium">Нет заказов</p>
                    <p className="text-sm">Заказы появятся здесь после создания</p>
                  </div>
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.orderId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <button
                      onClick={() => onViewDetails?.(order.orderId)}
                      className="hover:text-blue-600 flex items-center gap-1 transition-colors"
                    >
                      {order.orderId}
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {order.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                    ${(order.paymentAmountUSD || order.usdtAmount || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {order.cantonAmount.toFixed(2)} CANTON
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                      {statusLabels[order.status] || order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {formatDistanceToNow(order.timestamp, { addSuffix: true, locale: ru })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      {onEdit && (
                        <button
                          onClick={() => onEdit(order)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded-md hover:bg-blue-50 transition-colors"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => {
                            if (confirm(`Удалить заказ ${order.orderId}?`)) {
                              onDelete(order.orderId);
                            }
                          }}
                          className="text-red-600 hover:text-red-900 p-1 rounded-md hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default OrdersTable;

