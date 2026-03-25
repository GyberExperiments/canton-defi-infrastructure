/**
 * 🔄 Custom Hook for API Calls
 * Хук для API вызовов с retry логикой, error handling и loading states
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';

interface ApiCallOptions {
  retries?: number;
  retryDelay?: number;
  timeout?: number;
  showToast?: boolean;
  onSuccess?: (data: unknown) => void;
  onError?: (error: Error) => void;
}

interface ApiCallState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  retryCount: number;
}

export function useApiCall<T = unknown>(options: ApiCallOptions = {}) {
  const {
    retries = 3,
    retryDelay = 1000,
    timeout = 30000,
    showToast = true,
    onSuccess,
    onError
  } = options;

  const [state, setState] = useState<ApiCallState<T>>({
    data: null,
    loading: false,
    error: null,
    retryCount: 0
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const execute = useCallback(async (
    url: string,
    requestOptions: RequestInit = {},
    currentRetry = 0
  ): Promise<T | null> => {
    // Отменяем предыдущий запрос если он есть
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Создаем новый AbortController
    abortControllerRef.current = new AbortController();

    setState(prev => ({
      ...prev,
      loading: true,
      error: null,
      retryCount: currentRetry
    }));

    try {
      console.log(`🔄 API Call: ${requestOptions.method || 'GET'} ${url} (attempt ${currentRetry + 1})`);

      const timeoutId = setTimeout(() => {
        abortControllerRef.current?.abort();
      }, timeout);

      const response = await fetch(url, {
        ...requestOptions,
        signal: abortControllerRef.current.signal,
        headers: {
          'Content-Type': 'application/json',
          ...requestOptions.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      console.log(`✅ API Success: ${url}`, data);

      setState(prev => ({
        ...prev,
        data,
        loading: false,
        error: null,
        retryCount: 0
      }));

      if (onSuccess) {
        onSuccess(data);
      }

      if (showToast && requestOptions.method !== 'GET') {
        toast.success('Операция выполнена успешно');
      }

      return data;

    } catch (error) {
      const isAborted = error instanceof Error && error.name === 'AbortError';
      
      // ✅ ИСПРАВЛЕНИЕ: При AbortError тихо выходим без вызова onError
      // Это предотвращает бесконечный цикл re-renders когда запрос отменяется
      if (isAborted) {
        console.log(`⏹️ API Call aborted: ${url}`);
        setState(prev => ({
          ...prev,
          loading: false
        }));
        return null;
      }

      console.error(`❌ API Error: ${url}`, error);

      const isRetryable = currentRetry < retries;

      if (isRetryable) {
        console.log(`🔄 Retrying API call in ${retryDelay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return execute(url, requestOptions, currentRetry + 1);
      }

      const finalError = error instanceof Error ? error : new Error('Unknown error');
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: finalError,
        retryCount: currentRetry
      }));

      if (onError) {
        onError(finalError);
      }

      if (showToast) {
        toast.error(`Ошибка: ${finalError.message}`);
      }

      return null;
    }
  }, [retries, retryDelay, timeout, showToast, onSuccess, onError]);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setState(prev => ({
        ...prev,
        loading: false
      }));
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
      retryCount: 0
    });
  }, []);

  return {
    ...state,
    execute,
    cancel,
    reset
  };
}
