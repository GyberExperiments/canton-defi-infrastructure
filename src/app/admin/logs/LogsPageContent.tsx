/**
 * 📝 Logs Page Content Component
 * Мониторинг системы и просмотр логов
 */

'use client';

import { useEffect, useState } from 'react';
import { Activity, AlertCircle, CheckCircle, XCircle, Info, Filter } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface LogEntry {
  id: string;
  timestamp: number;
  level: 'info' | 'success' | 'warning' | 'error';
  category: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export default function LogsPageContent() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filterLevel, setFilterLevel] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');

  useEffect(() => {
    // В продакшне логи должны храниться в БД или внешнем сервисе (CloudWatch, Datadog и т.д.)
    // Здесь демонстрационные данные
    const mockLogs: LogEntry[] = [
      {
        id: '1',
        timestamp: Date.now() - 1000 * 60 * 5,
        level: 'success',
        category: 'Order',
        message: 'Заказ успешно создан',
        metadata: { orderId: 'LT5H2K-A3B4C5', amount: 1000 }
      },
      {
        id: '2',
        timestamp: Date.now() - 1000 * 60 * 15,
        level: 'info',
        category: 'Telegram',
        message: 'Уведомление отправлено в Telegram',
        metadata: { orderId: 'LT5H2K-A3B4C5' }
      },
      {
        id: '3',
        timestamp: Date.now() - 1000 * 60 * 30,
        level: 'warning',
        category: 'RateLimit',
        message: 'Rate limit достигнут для IP 192.168.1.1',
        metadata: { ip: '192.168.1.1', attempts: 3 }
      },
      {
        id: '4',
        timestamp: Date.now() - 1000 * 60 * 45,
        level: 'error',
        category: 'GoogleSheets',
        message: 'Ошибка записи в Google Sheets',
        metadata: { error: 'Connection timeout' }
      },
      {
        id: '5',
        timestamp: Date.now() - 1000 * 60 * 60,
        level: 'success',
        category: 'Order',
        message: 'Заказ завершён успешно',
        metadata: { orderId: 'LT5H1K-B2C3D4', txHash: '0x123...' }
      },
    ];

    setLogs(mockLogs);
  }, []);

  const levelColors = {
    info: { bg: 'bg-blue-100', text: 'text-blue-800', icon: Info },
    success: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
    warning: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: AlertCircle },
    error: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle },
  };

  const filteredLogs = logs.filter(log => {
    if (filterLevel && log.level !== filterLevel) return false;
    if (filterCategory && log.category !== filterCategory) return false;
    return true;
  });

  const categories = Array.from(new Set(logs.map(l => l.category)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Логи и мониторинг</h1>
        <p className="text-gray-600 mt-1">Отслеживание работы системы в реальном времени</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Object.entries(levelColors).map(([level, config]) => {
          const count = logs.filter(l => l.level === level).length;
          const Icon = config.icon;
          return (
            <div key={level} className={`${config.bg} rounded-lg p-4`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${config.text} capitalize`}>{level}</p>
                  <p className={`text-2xl font-bold ${config.text} mt-1`}>{count}</p>
                </div>
                <Icon className={`h-8 w-8 ${config.text} opacity-70`} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
        <div className="flex items-center gap-4">
          <Filter className="h-5 w-5 text-gray-400" />
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Все уровни</option>
            <option value="info">Info</option>
            <option value="success">Success</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Все категории</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {(filterLevel || filterCategory) && (
            <button
              onClick={() => {
                setFilterLevel('');
                setFilterCategory('');
              }}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Сбросить фильтры
            </button>
          )}
        </div>
      </div>

      {/* Logs List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="divide-y divide-gray-200">
          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Activity className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>Нет логов для отображения</p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const config = levelColors[log.level];
              const Icon = config.icon;
              
              return (
                <div key={log.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start gap-4">
                    <div className={`${config.bg} p-2 rounded-lg`}>
                      <Icon className={`h-5 w-5 ${config.text}`} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
                          {log.level}
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          {log.category}
                        </span>
                        <span className="text-sm text-gray-500">
                          {formatDistanceToNow(log.timestamp, { addSuffix: true, locale: ru })}
                        </span>
                      </div>
                      
                      <p className="text-sm font-medium text-gray-900 mb-2">{log.message}</p>
                      
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div className="bg-gray-50 rounded-lg p-3 text-xs font-mono text-gray-700">
                          <pre className="whitespace-pre-wrap">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* System Health Status */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Состояние системы</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
            <div>
              <p className="text-sm font-medium text-green-900">API</p>
              <p className="text-xs text-green-700 mt-1">Online</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>

          <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
            <div>
              <p className="text-sm font-medium text-green-900">Google Sheets</p>
              <p className="text-xs text-green-700 mt-1">Connected</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>

          <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
            <div>
              <p className="text-sm font-medium text-green-900">Telegram Bot</p>
              <p className="text-xs text-green-700 mt-1">Active</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>💡 В продакшне:</strong> Рекомендуется интеграция с профессиональным сервисом логирования 
          (CloudWatch, Datadog, Sentry) для централизованного сбора, анализа и алертинга.
        </p>
      </div>
    </div>
  );
}

