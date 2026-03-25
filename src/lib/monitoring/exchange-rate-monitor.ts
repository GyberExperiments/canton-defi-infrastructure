/**
 * Exchange Rate Monitor
 * Мониторинг отклонений exchange rate для обнаружения подозрительных изменений цен
 */

interface RateDeviation {
  orderId: string
  direction: 'buy' | 'sell'
  expectedAmount: number
  actualAmount: number
  deviation: number
  deviationPercent: number
  tolerance: number
  timestamp: number
}

const MAX_DEVIATIONS_TO_STORE = 100
const deviations: RateDeviation[] = []

/**
 * Логирует отклонение exchange rate если оно превышает tolerance
 * @param orderId ID ордера
 * @param direction Направление обмена (buy/sell)
 * @param expectedAmount Ожидаемая сумма
 * @param actualAmount Фактическая сумма
 * @param tolerance Допустимое отклонение (в абсолютных единицах)
 */
export function logRateDeviation(
  orderId: string,
  direction: 'buy' | 'sell',
  expectedAmount: number,
  actualAmount: number,
  tolerance: number
): void {
  const deviation = Math.abs(actualAmount - expectedAmount)
  const deviationPercent = (deviation / expectedAmount) * 100

  // Сохраняем отклонение для мониторинга
  const rateDeviation: RateDeviation = {
    orderId,
    direction,
    expectedAmount,
    actualAmount,
    deviation,
    deviationPercent,
    tolerance,
    timestamp: Date.now()
  }

  deviations.push(rateDeviation)

  // Ограничиваем размер массива
  if (deviations.length > MAX_DEVIATIONS_TO_STORE) {
    deviations.shift()
  }

  // Логируем если отклонение близко к tolerance (более 80% от tolerance)
  const tolerancePercent = (tolerance / expectedAmount) * 100
  if (deviationPercent > tolerancePercent * 0.8) {
    console.warn('⚠️ Exchange rate deviation detected:', {
      orderId,
      direction,
      expectedAmount,
      actualAmount,
      deviation,
      deviationPercent: `${deviationPercent.toFixed(4)}%`,
      tolerancePercent: `${tolerancePercent.toFixed(4)}%`,
      timestamp: new Date().toISOString()
    })
  }

  // Критическое предупреждение если отклонение превышает tolerance
  if (deviation > tolerance) {
    console.error('🚨 CRITICAL: Exchange rate deviation exceeds tolerance:', {
      orderId,
      direction,
      expectedAmount,
      actualAmount,
      deviation,
      deviationPercent: `${deviationPercent.toFixed(4)}%`,
      tolerance,
      tolerancePercent: `${tolerancePercent.toFixed(4)}%`,
      timestamp: new Date().toISOString()
    })
  }
}

/**
 * Получает статистику отклонений за последние N минут
 */
export function getDeviationStats(minutes: number = 60): {
  total: number
  averageDeviation: number
  maxDeviation: number
  criticalCount: number
  deviations: RateDeviation[]
} {
  const cutoffTime = Date.now() - minutes * 60 * 1000
  const recentDeviations = deviations.filter(d => d.timestamp >= cutoffTime)

  const total = recentDeviations.length
  const averageDeviation = total > 0
    ? recentDeviations.reduce((sum, d) => sum + d.deviationPercent, 0) / total
    : 0
  const maxDeviation = total > 0
    ? Math.max(...recentDeviations.map(d => d.deviationPercent))
    : 0
  const criticalCount = recentDeviations.filter(d => d.deviation > d.tolerance).length

  return {
    total,
    averageDeviation,
    maxDeviation,
    criticalCount,
    deviations: recentDeviations
  }
}

/**
 * Проверяет наличие подозрительных паттернов в отклонениях
 * Может использоваться для алертов
 */
export function checkSuspiciousPatterns(): {
  hasSuspiciousPattern: boolean
  alerts: string[]
} {
  const alerts: string[] = []
  const stats = getDeviationStats(60) // Последний час

  // Проверка на большое количество критических отклонений
  if (stats.criticalCount > 5) {
    alerts.push(`High number of critical deviations: ${stats.criticalCount} in the last hour`)
  }

  // Проверка на высокое среднее отклонение
  if (stats.averageDeviation > 0.5) { // 0.5% среднее отклонение
    alerts.push(`High average deviation: ${stats.averageDeviation.toFixed(4)}%`)
  }

  // Проверка на очень большое максимальное отклонение
  if (stats.maxDeviation > 1.0) { // 1% максимальное отклонение
    alerts.push(`Very high maximum deviation: ${stats.maxDeviation.toFixed(4)}%`)
  }

  return {
    hasSuspiciousPattern: alerts.length > 0,
    alerts
  }
}




