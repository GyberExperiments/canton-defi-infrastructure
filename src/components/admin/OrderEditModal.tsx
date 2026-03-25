/**
 * ✏️ Order Edit Modal Component
 * Модальное окно для редактирования заказа
 */

'use client';

import { useState } from 'react';
import { OTCOrder, OrderStatus } from '@/config/otc';
import { X } from 'lucide-react';

interface OrderEditModalProps {
  order: OTCOrder;
  onClose: () => void;
  onSave: (orderId: string, updates: Partial<OTCOrder>) => Promise<void>;
}

const statusOptions: { value: OrderStatus; label: string }[] = [
  { value: 'awaiting-deposit', label: 'Ожидает депозита' },
  { value: 'awaiting-confirmation', label: 'Ожидает подтверждения' },
  { value: 'exchanging', label: 'Обмен' },
  { value: 'sending', label: 'Отправка' },
  { value: 'completed', label: 'Завершён' },
  { value: 'failed', label: 'Ошибка' },
];

export default function OrderEditModal({ order, onClose, onSave }: OrderEditModalProps) {
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [txHash, setTxHash] = useState(order.txHash || '');
  const [cantonAddress, setCantonAddress] = useState(order.cantonAddress);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      const updates: Partial<OTCOrder> = {};
      
      if (status !== order.status) updates.status = status;
      if (txHash !== order.txHash) updates.txHash = txHash;
      if (cantonAddress !== order.cantonAddress) updates.cantonAddress = cantonAddress;

      await onSave(order.orderId, updates);
      onClose();
    } catch (error) {
      console.error('Failed to save order:', error);
      alert('Ошибка при сохранении заказа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
        
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Редактировать заказ</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-md hover:bg-gray-100"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="order-id" className="block text-sm font-medium text-gray-700 mb-1">
                Order ID
              </label>
              <input
                id="order-id"
                type="text"
                value={order.orderId}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="order-status" className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                id="order-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as OrderStatus)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="canton-address" className="block text-sm font-medium text-gray-700 mb-1">
                Canton Address
              </label>
              <input
                id="canton-address"
                type="text"
                value={cantonAddress}
                onChange={(e) => setCantonAddress(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="transaction-hash" className="block text-sm font-medium text-gray-700 mb-1">
                Transaction Hash
              </label>
              <input
                id="transaction-hash"
                type="text"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="amount-usd" className="block text-sm font-medium text-gray-700 mb-1">
                  Amount (USD)
                </label>
                <input
                  id="amount-usd"
                  type="text"
                  value={`$${(order.paymentAmountUSD || order.usdtAmount || 0).toFixed(2)}`}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
                />
              </div>
              <div>
                <label htmlFor="canton-amount" className="block text-sm font-medium text-gray-700 mb-1">
                  Canton Amount
                </label>
                <input
                  id="canton-amount"
                  type="text"
                  value={`${order.cantonAmount.toFixed(2)} CANTON`}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label htmlFor="customer-email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="customer-email"
                type="text"
                value={order.email}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}



