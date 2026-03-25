/**
 * 👥 Customers Page Content Component (CRM)
 * Полноценная CRM система управления клиентами
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Users, Crown, UserX, DollarSign, RefreshCw, Mail } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import StatsCard from '@/components/admin/StatsCard';
import toast from 'react-hot-toast';

interface CustomerProfile {
  email: string;
  totalOrders: number;
  totalVolume: number;
  averageOrderValue: number;
  lifetimeValue: number;
  firstOrderDate: number;
  lastOrderDate: number;
  status: 'new' | 'active' | 'vip' | 'inactive';
  completedOrders: number;
  failedOrders: number;
  contactInfo: {
    whatsapp?: string;
    telegram?: string;
  };
  cantonAddresses: string[];
  preferredTokens: string[];
}

interface Analytics {
  totalCustomers: number;
  newCustomersThisMonth: number;
  vipCustomers: number;
  inactiveCustomers: number;
  averageLTV: number;
  topCustomers: CustomerProfile[];
}

export default function CustomersPageContent() {
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState<'totalVolume' | 'totalOrders' | 'lastOrderDate'>('totalVolume');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [customersRes, analyticsRes] = await Promise.all([
        fetch(`/api/admin/customers?page=${page}&limit=20&sortBy=${sortBy}&sortOrder=desc`),
        fetch('/api/admin/customers/analytics')
      ]);

      if (customersRes.ok) {
        const data = await customersRes.json();
        setCustomers(data.customers);
        setTotalPages(data.totalPages);
      }

      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Failed to load customers:', error);
      toast.error('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }, [page, sortBy]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const statusColors = {
    new: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Новый' },
    active: { bg: 'bg-green-100', text: 'text-green-800', label: 'Активный' },
    vip: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'VIP' },
    inactive: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Неактивный' },
  };

  if (loading && !analytics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">CRM - Управление клиентами</h1>
          <p className="text-gray-600 mt-1">Полная аналитика и взаимодействие с клиентами</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </button>
      </div>

      {/* Analytics Stats */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="Всего клиентов"
            value={analytics.totalCustomers}
            change={`+${analytics.newCustomersThisMonth} за месяц`}
            changeType="positive"
            icon={Users}
            iconColor="bg-blue-500"
          />
          <StatsCard
            title="Средний LTV"
            value={`$${analytics.averageLTV.toFixed(2)}`}
            icon={DollarSign}
            iconColor="bg-green-500"
          />
          <StatsCard
            title="VIP клиенты"
            value={analytics.vipCustomers}
            icon={Crown}
            iconColor="bg-purple-500"
          />
          <StatsCard
            title="Неактивные"
            value={analytics.inactiveCustomers}
            icon={UserX}
            iconColor="bg-gray-500"
          />
        </div>
      )}

      {/* Sorting */}
      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
        <div className="flex items-center gap-4">
          <label htmlFor="sort-select" className="text-sm font-medium text-gray-700">Сортировать по:</label>
          <select
            id="sort-select"
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as 'totalVolume' | 'totalOrders' | 'lastOrderDate');
              setPage(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="totalVolume">Общий объём</option>
            <option value="totalOrders">Количество заказов</option>
            <option value="lastOrderDate">Дата последнего заказа</option>
          </select>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Статус
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Заказы
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  LTV (USD)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Средний чек
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Последний заказ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Контакты
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    Нет клиентов
                  </td>
                </tr>
              ) : (
                customers.map((customer) => {
                  const statusConfig = statusColors[customer.status];
                  return (
                    <tr key={customer.email} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">
                            {customer.email}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {customer.totalOrders} ({customer.completedOrders} ✓)
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        ${customer.lifetimeValue.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        ${customer.averageOrderValue.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDistanceToNow(customer.lastOrderDate, { addSuffix: true, locale: ru })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-xs">
                          {customer.contactInfo.whatsapp && (
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                              WhatsApp
                            </span>
                          )}
                          {customer.contactInfo.telegram && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                              Telegram
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Назад
          </button>
          <span className="text-gray-600">
            Страница {page} из {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Вперёд
          </button>
        </div>
      )}

      {/* Top Customers */}
      {analytics && analytics.topCustomers.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            Топ клиенты по LTV
          </h2>
          <div className="space-y-3">
            {analytics.topCustomers.map((customer, index) => (
              <div
                key={customer.email}
                className="flex items-center justify-between p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200"
              >
                <div className="flex items-center gap-4">
                  <div className="text-2xl font-bold text-yellow-600">#{index + 1}</div>
                  <div>
                    <p className="font-medium text-gray-900">{customer.email}</p>
                    <p className="text-sm text-gray-600">
                      {customer.totalOrders} заказов • {customer.preferredTokens.join(', ')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">
                    ${customer.lifetimeValue.toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-600">LTV</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

