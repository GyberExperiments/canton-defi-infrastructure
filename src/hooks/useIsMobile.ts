'use client'

import { useState, useEffect } from 'react'

/**
 * Hook для определения мобильного устройства
 * Использует комбинацию размера экрана и User Agent
 */
export function useIsMobile(breakpoint: number = 768): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // Проверка размера экрана
    const checkMobile = () => {
      const width = window.innerWidth
      const isMobileWidth = width < breakpoint
      
      // Дополнительная проверка User Agent для точности
      const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      
      // Если экран маленький ИЛИ это мобильное устройство
      setIsMobile(isMobileWidth || isMobileDevice)
    }

    // Первоначальная проверка
    checkMobile()

    // Слушатель изменения размера
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [breakpoint])

  return isMobile
}

/**
 * Hook для определения размера viewport
 */
export function useViewportSize() {
  const [size, setSize] = useState({
    width: 0,
    height: 0,
    isMobile: false,
    isTablet: false,
    isDesktop: false
  })

  useEffect(() => {
    const updateSize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      
      setSize({
        width,
        height,
        isMobile: width < 768,
        isTablet: width >= 768 && width < 1024,
        isDesktop: width >= 1024
      })
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  return size
}

/**
 * Hook для определения предпочтения уменьшенных анимаций
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    
    setPrefersReducedMotion(mediaQuery.matches)

    const handler = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches)
    }

    mediaQuery.addEventListener('change', handler)
    
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  return prefersReducedMotion
}

/**
 * Hook для получения оптимальных настроек анимаций
 */
export function useAnimationConfig() {
  const isMobile = useIsMobile()
  const prefersReducedMotion = usePrefersReducedMotion()

  // Если пользователь предпочитает меньше анимаций или на мобильном
  const shouldReduceAnimations = prefersReducedMotion || isMobile

  return {
    isMobile,
    prefersReducedMotion,
    shouldReduceAnimations,
    // Конфигурация анимаций
    animationDuration: shouldReduceAnimations ? 0.3 : 0.8,
    complexAnimationDuration: shouldReduceAnimations ? 0.5 : 1.5,
    // Blur эффекты
    blurAmount: isMobile ? 'blur(40px)' : 'blur(80px)',
    backdropBlurAmount: isMobile ? 'blur(16px)' : 'blur(32px)',
    // Количество декоративных элементов
    showDecorativeEffects: !shouldReduceAnimations,
    showParticles: !shouldReduceAnimations,
    // Easing функции
    easing: shouldReduceAnimations ? 'easeOut' : ([0.6, 0.05, 0.01, 0.9] as [number, number, number, number]),
  }
}

