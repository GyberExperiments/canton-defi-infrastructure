/**
 * 📝 Custom Hook for Logging
 * Хук для логирования операций в админке
 */

'use client';

import { useCallback, useMemo } from 'react';

export type LogLevel = 'info' | 'success' | 'warning' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: unknown;
  timestamp: number;
  component?: string;
  action?: string;
}

export function useLogger(componentName?: string) {
  const log = useCallback((
    level: LogLevel,
    message: string,
    data?: unknown,
    action?: string
  ) => {
    const entry: LogEntry = {
      level,
      message,
      data,
      timestamp: Date.now(),
      component: componentName,
      action
    };

    // Логируем в консоль с цветовой кодировкой
    const colors = {
      info: '#3B82F6',    // blue
      success: '#10B981', // green
      warning: '#F59E0B', // yellow
      error: '#EF4444',   // red
      debug: '#8B5CF6'    // purple
    };

    const emoji = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      debug: '🐛'
    };

    const logMessage = `${emoji[level]} [${componentName || 'Admin'}] ${message}`;
    
    console.log(
      `%c${logMessage}`,
      `color: ${colors[level]}; font-weight: bold;`,
      data ? data : ''
    );

    // В продакшне здесь можно отправить логи в сервис мониторинга
    // Например: sendToMonitoring(entry);

    // Сохраняем в localStorage для отладки (только в dev режиме)
    if (process.env.NODE_ENV === 'development') {
      try {
        const logs = JSON.parse(localStorage.getItem('admin-logs') || '[]');
        logs.push(entry);
        
        // Ограничиваем количество логов
        if (logs.length > 100) {
          logs.splice(0, logs.length - 100);
        }
        
        localStorage.setItem('admin-logs', JSON.stringify(logs));
      } catch (error) {
        console.warn('Failed to save log to localStorage:', error);
      }
    }
  }, [componentName]);

  const info = useCallback((message: string, data?: unknown, action?: string) => {
    log('info', message, data, action);
  }, [log]);

  const success = useCallback((message: string, data?: unknown, action?: string) => {
    log('success', message, data, action);
  }, [log]);

  const warning = useCallback((message: string, data?: unknown, action?: string) => {
    log('warning', message, data, action);
  }, [log]);

  const error = useCallback((message: string, data?: unknown, action?: string) => {
    log('error', message, data, action);
  }, [log]);

  const debug = useCallback((message: string, data?: unknown, action?: string) => {
    log('debug', message, data, action);
  }, [log]);

  const getLogs = useCallback((): LogEntry[] => {
    try {
      return JSON.parse(localStorage.getItem('admin-logs') || '[]');
    } catch {
      return [];
    }
  }, []);

  const clearLogs = useCallback(() => {
    localStorage.removeItem('admin-logs');
  }, []);

  // ✅ ИСПРАВЛЕНИЕ: мемоизация возвращаемого объекта для предотвращения бесконечных re-renders
  return useMemo(() => ({
    log,
    info,
    success,
    warning,
    error,
    debug,
    getLogs,
    clearLogs
  }), [log, info, success, warning, error, debug, getLogs, clearLogs]);
}
