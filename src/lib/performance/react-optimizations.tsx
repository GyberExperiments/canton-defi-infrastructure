/**
 * ⚡ React Performance Optimizations
 * Комплексная система оптимизации производительности React:
 * - Smart memoization с глубоким сравнением
 * - Lazy loading компонентов и ресурсов
 * - Virtual scrolling для больших списков
 * - Оптимизация re-renders
 * - Bundle splitting и code optimization
 */

import React, { 
  memo, 
  useMemo, 
  useCallback, 
  useRef, 
  useEffect, 
  useState,
  lazy,
  Suspense,
  ComponentType,
  ReactNode,
  forwardRef
} from 'react';
import { useUnifiedConfig } from '../config/unified-config-system';

// ============================================================================
// SMART MEMOIZATION SYSTEM
// ============================================================================

/**
 * Глубокое сравнение объектов для useMemo и useCallback
 */
export function useDeepMemo<T>(factory: () => T, deps: React.DependencyList): T {
  const ref = useRef<{ deps: React.DependencyList; value: T } | undefined>(undefined);
  
  if (!ref.current || !deepEqual(ref.current.deps, deps)) {
    ref.current = { deps, value: factory() };
  }
  
  return ref.current.value;
}

/**
 * Оптимизированный useCallback с глубоким сравнением
 */
export function useDeepCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  deps: React.DependencyList
): T {
  return useDeepMemo(() => callback, deps);
}

/**
 * Глубокое сравнение объектов
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  
  if (a == null || b == null) return a === b;
  
  if (typeof a !== typeof b) return false;
  
  if (typeof a !== 'object') return a === b;
  
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  
  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!keysB.includes(key) || !deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
      return false;
    }
  }
  
  return true;
}

// ============================================================================
// INTELLIGENT COMPONENT MEMOIZATION
// ============================================================================

interface MemoOptions {
  /**
   * Кастомная функция сравнения props
   */
  areEqual?: (prevProps: unknown, nextProps: unknown) => boolean;
  
  /**
   * Игнорировать определённые props при сравнении
   */
  ignoreProps?: string[];
  
  /**
   * Режим отладки - логирует причины re-render
   */
  debug?: boolean;
}

/**
 * Продвинутый memo с настройками
 */
export function smartMemo<P extends object>(
  Component: ComponentType<P>,
  options: MemoOptions = {}
): ComponentType<P> {
  const { areEqual, ignoreProps = [], debug = false } = options;
  
  return memo(Component, (prevProps, nextProps) => {
    if (debug) {
      console.group(`🔍 Memo check: ${Component.displayName || Component.name}`);
    }
    
    // Кастомная функция сравнения
    if (areEqual) {
      const result = areEqual(prevProps, nextProps);
      if (debug) {
        console.log(`Custom comparison result: ${result}`);
        console.groupEnd();
      }
      return result;
    }
    
    // Фильтрация props для сравнения
    const filteredPrevProps = ignoreProps.length > 0 
      ? Object.fromEntries(Object.entries(prevProps).filter(([key]) => !ignoreProps.includes(key)))
      : prevProps;
      
    const filteredNextProps = ignoreProps.length > 0
      ? Object.fromEntries(Object.entries(nextProps).filter(([key]) => !ignoreProps.includes(key)))
      : nextProps;
    
    // Глубокое сравнение
    const isEqual = deepEqual(filteredPrevProps, filteredNextProps);
    
    if (debug) {
      if (!isEqual) {
        console.log('Props changed:', {
          prev: filteredPrevProps,
          next: filteredNextProps,
          ignored: ignoreProps
        });
      } else {
        console.log('Props unchanged - skipping render');
      }
      console.groupEnd();
    }
    
    return isEqual;
  });
}

// ============================================================================
// LAZY LOADING SYSTEM
// ============================================================================

interface LazyComponentOptions {
  /**
   * Компонент загрузки
   */
  fallback?: ReactNode;
  
  /**
   * Задержка перед показом fallback (мс)
   */
  delay?: number;
  
  /**
   * Preload компонент при hover/focus
   */
  preloadOn?: 'hover' | 'focus' | 'intersection';
  
  /**
   * Retry при ошибке загрузки
   */
  retry?: boolean;
  
  /**
   * Максимальное количество попыток
   */
  maxRetries?: number;
}

/**
 * Продвинутый lazy loading с дополнительными функциями
 */
export function createLazyComponent<T extends ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>,
  options: LazyComponentOptions = {}
): ComponentType<React.ComponentProps<T>> {
  const {
    fallback = <div className="animate-pulse bg-gray-200 h-8 rounded" />,
    delay = 200,
    preloadOn,
    retry = true,
    maxRetries = 3
  } = options;
  
  const LazyComponent = lazy(importFn);
  
  const LazyComponentWithRef = forwardRef<unknown, React.ComponentProps<T>>(function LazyComponentWithRef(props, ref) {
    const [retryCount, setRetryCount] = useState(0);
    const [showFallback, setShowFallback] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
    
    // Задержка показа fallback
    useEffect(() => {
      timeoutRef.current = setTimeout(() => {
        setShowFallback(true);
      }, delay);
      
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, []);
    
    // Preloading logic
    const handlePreload = useCallback(() => {
      importFn().catch(console.warn);
    }, []);
    
    const preloadProps = preloadOn ? {
      [preloadOn === 'hover' ? 'onMouseEnter' : 'onFocus']: handlePreload
    } : {};
    
    return (
      <div {...preloadProps}>
        <Suspense 
          fallback={showFallback ? fallback : null}
        >
          <ErrorBoundary 
            onError={() => {
              if (retry && retryCount < maxRetries) {
                setRetryCount(prev => prev + 1);
              }
            }}
            fallback={
              <div className="text-red-500 p-4 border border-red-300 rounded">
                Failed to load component
                {retry && retryCount < maxRetries && (
                  <button 
                    onClick={() => setRetryCount(prev => prev + 1)}
                    className="ml-2 text-blue-500 underline"
                  >
                    Retry ({maxRetries - retryCount} attempts left)
                  </button>
                )}
              </div>
            }
          >
            {/* @ts-expect-error - LazyComponent doesn't support refs in type system but works at runtime */}
            <LazyComponent {...props} ref={ref} key={retryCount} />
          </ErrorBoundary>
        </Suspense>
      </div>
    );
  });
  
  LazyComponentWithRef.displayName = `LazyComponent(${importFn.name || "Unknown"})`;
  
  return LazyComponentWithRef as unknown as ComponentType<React.ComponentProps<T>>;
}

// ============================================================================
// VIRTUAL SCROLLING
// ============================================================================

interface VirtualScrollProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => ReactNode;
  overscan?: number;
  className?: string;
}

/**
 * Виртуальный скроллинг для больших списков
 */
export function VirtualScroll<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
  className = ''
}: VirtualScrollProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  
  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.min(
    visibleStart + Math.ceil(containerHeight / itemHeight),
    items.length - 1
  );
  
  const startIndex = Math.max(0, visibleStart - overscan);
  const endIndex = Math.min(items.length - 1, visibleEnd + overscan);
  
  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex + 1);
  }, [items, startIndex, endIndex]);
  
  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;
  
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);
  
  return (
    <div
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) =>
            renderItem(item, startIndex + index)
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

interface PerformanceMetrics {
  renderTime: number;
  componentName: string;
  props?: Record<string, unknown>;
  timestamp: number;
}

/**
 * HOC для мониторинга производительности компонентов
 */
export function withPerformanceMonitoring<P extends object>(
  WrappedComponent: ComponentType<P>,
  options: { 
    name?: string;
    logSlowRenders?: boolean;
    slowRenderThreshold?: number;
    trackProps?: boolean;
  } = {}
): ComponentType<P> {
  const { 
    name = WrappedComponent.displayName || WrappedComponent.name || 'Unknown',
    logSlowRenders = true,
    slowRenderThreshold = 16, // 16ms (60 FPS)
    trackProps = false
  } = options;
  
  return function PerformanceWrapper(props: P) {
    const renderStartTime = useRef<number | undefined>(undefined);
    const metricsRef = useRef<PerformanceMetrics[]>([]);
    
    // Измерение времени начала рендера
    renderStartTime.current = performance.now();
    
    useEffect(() => {
      const renderEndTime = performance.now();
      const renderTime = renderEndTime - (renderStartTime.current || 0);
      
      const metrics: PerformanceMetrics = {
        renderTime,
        componentName: name,
        timestamp: Date.now(),
        ...(trackProps && { props: props as Record<string, unknown> })
      };
      
      metricsRef.current.push(metrics);
      
      // Логирование медленных рендеров
      if (logSlowRenders && renderTime > slowRenderThreshold) {
        console.warn(`🐌 Slow render detected: ${name}`, {
          renderTime: `${renderTime.toFixed(2)}ms`,
          threshold: `${slowRenderThreshold}ms`,
          ...(trackProps && { props })
        });
      }
      
      // Ограничиваем количество сохранённых метрик
      if (metricsRef.current.length > 100) {
        metricsRef.current = metricsRef.current.slice(-50);
      }
    });
    
    return <WrappedComponent {...props} />;
  };
}

// ============================================================================
// OPTIMIZED HOOKS
// ============================================================================

/**
 * Оптимизированный useState для сложных объектов
 */
export function useOptimizedState<T extends object>(
  initialState: T
): [T, (updater: Partial<T> | ((prev: T) => T)) => void] {
  const [state, setState] = useState(initialState);
  
  const optimizedSetState = useCallback((updater: Partial<T> | ((prev: T) => T)) => {
    setState(prevState => {
      const nextState = typeof updater === 'function' 
        ? updater(prevState)
        : { ...prevState, ...updater };
      
      // Избегаем обновления если состояние не изменилось
      return deepEqual(prevState, nextState) ? prevState : nextState;
    });
  }, []);
  
  return [state, optimizedSetState];
}

/**
 * Debounced значение с оптимизацией
 */
export function useOptimizedDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(prevValue => 
        deepEqual(prevValue, value) ? prevValue : value
      );
    }, delay);
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay]);
  
  return debouncedValue;
}

/**
 * Оптимизированный useEffect с глубоким сравнением
 */
export function useDeepEffect(
  effect: React.EffectCallback,
  deps: React.DependencyList
): void {
  const ref = useRef<React.DependencyList | undefined>(undefined);
  
  if (!ref.current || !deepEqual(ref.current, deps)) {
    ref.current = deps;
  }
  
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(effect, ref.current);
}

// ============================================================================
// CONFIGURATION OPTIMIZATION HOC
// ============================================================================

/**
 * HOC для оптимизации работы с конфигурацией
 */
export function withOptimizedConfig<P extends object>(
  WrappedComponent: ComponentType<P & { config?: Record<string, unknown> }>,
  configKeys?: string[]
): ComponentType<P> {
  return smartMemo(function OptimizedConfigWrapper(props: P) {
    const { config, loading, error } = useUnifiedConfig();
    
    // Мемоизируем только нужные части конфигурации
    const selectedConfig = useMemo(() => {
      if (!config) return undefined;
      
      if (configKeys) {
        return Object.fromEntries(
          configKeys.map(key => [key, config[key as keyof typeof config]])
        );
      }
      
      return config as unknown as Record<string, unknown>;
    }, [config]);
    
    // Показываем fallback при загрузке
    if (loading) {
      return (
        <div className="animate-pulse bg-gray-200 h-8 rounded">
          Loading configuration...
        </div>
      );
    }
    
    // Показываем ошибку
    if (error) {
      return (
        <div className="text-red-500 p-4 border border-red-300 rounded">
          Configuration error: {error}
        </div>
      );
    }
    
    return <WrappedComponent {...props} config={selectedConfig} />;
  }, {
    debug: process.env.NODE_ENV === 'development'
  });
}

// ============================================================================
// ERROR BOUNDARY
// ============================================================================

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error) => ReactNode);
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback(this.state.error!)
          : this.props.fallback;
      }
      
      return (
        <div className="text-red-500 p-4 border border-red-300 rounded">
          <h2>Something went wrong</h2>
          <details className="mt-2">
            <summary>Error details</summary>
            <pre className="mt-2 text-xs bg-red-50 p-2 rounded">
              {this.state.error?.stack}
            </pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  ErrorBoundary,
  deepEqual
};

// Готовые оптимизированные компоненты
export const OptimizedSuspense = smartMemo(Suspense);

// Utility для создания оптимизированных компонентов
export function createOptimizedComponent<P extends object>(
  Component: ComponentType<P>,
  options?: MemoOptions & {
    withPerformanceMonitoring?: boolean;
    withConfigOptimization?: boolean;
    configKeys?: string[];
  }
) {
  let OptimizedComponent = smartMemo(Component, options);
  
  if (options?.withPerformanceMonitoring) {
    OptimizedComponent = withPerformanceMonitoring(OptimizedComponent, {
      name: Component.displayName || Component.name,
      logSlowRenders: process.env.NODE_ENV === 'development'
    });
  }
  
  if (options?.withConfigOptimization) {
    OptimizedComponent = withOptimizedConfig(OptimizedComponent, options.configKeys);
  }
  
  return OptimizedComponent;
}
