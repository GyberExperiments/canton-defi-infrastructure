/**
 * 📊 Intercom Monitoring & Metrics Service
 * Tracks Intercom integration health and user interactions
 */

interface IntercomMetrics {
  widgetLoads: number
  widgetLoadFailures: number
  messagesSent: number
  conversationsStarted: number
  averageResponseTime: number
  lastActivity: string
  errorRate: number
}

interface IntercomEvent {
  type: 'widget_loaded' | 'widget_failed' | 'message_sent' | 'conversation_started' | 'error'
  timestamp: number
  metadata?: Record<string, unknown>
}

class IntercomMonitoringService {
  private metrics: IntercomMetrics = {
    widgetLoads: 0,
    widgetLoadFailures: 0,
    messagesSent: 0,
    conversationsStarted: 0,
    averageResponseTime: 0,
    lastActivity: new Date().toISOString(),
    errorRate: 0
  }

  private events: IntercomEvent[] = []
  private readonly MAX_EVENTS = 1000 // Keep last 1000 events

  /**
   * Track widget load success
   */
  trackWidgetLoad(loadTime: number): void {
    this.metrics.widgetLoads++
    this.metrics.lastActivity = new Date().toISOString()
    
    this.addEvent({
      type: 'widget_loaded',
      timestamp: Date.now(),
      metadata: { loadTime }
    })

    console.log('📊 Intercom widget loaded in', loadTime, 'ms')
  }

  /**
   * Track widget load failure
   */
  trackWidgetFailure(error: string): void {
    this.metrics.widgetLoadFailures++
    this.metrics.lastActivity = new Date().toISOString()
    
    this.addEvent({
      type: 'widget_failed',
      timestamp: Date.now(),
      metadata: { error }
    })

    this.updateErrorRate()
    console.error('📊 Intercom widget failed:', error)
  }

  /**
   * Track message sent by user
   */
  trackMessageSent(orderId?: string): void {
    this.metrics.messagesSent++
    this.metrics.lastActivity = new Date().toISOString()
    
    this.addEvent({
      type: 'message_sent',
      timestamp: Date.now(),
      metadata: { orderId }
    })

    console.log('📊 Intercom message sent', orderId ? `for order ${orderId}` : '')
  }

  /**
   * Track conversation started
   */
  trackConversationStarted(orderId?: string): void {
    this.metrics.conversationsStarted++
    this.metrics.lastActivity = new Date().toISOString()
    
    this.addEvent({
      type: 'conversation_started',
      timestamp: Date.now(),
      metadata: { orderId }
    })

    console.log('📊 Intercom conversation started', orderId ? `for order ${orderId}` : '')
  }

  /**
   * Track error
   */
  trackError(error: string, context?: Record<string, unknown>): void {
    this.metrics.lastActivity = new Date().toISOString()
    
    this.addEvent({
      type: 'error',
      timestamp: Date.now(),
      metadata: { error, context }
    })

    this.updateErrorRate()
    console.error('📊 Intercom error:', error, context)
  }

  /**
   * Update average response time
   */
  updateResponseTime(responseTime: number): void {
    // Simple moving average
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime + responseTime) / 2
  }

  /**
   * Get current metrics
   */
  getMetrics(): IntercomMetrics {
    return { ...this.metrics }
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy'
    issues: string[]
    metrics: IntercomMetrics
  } {
    const issues: string[] = []
    
    // Check error rate
    if (this.metrics.errorRate > 0.1) { // 10% error rate
      issues.push(`High error rate: ${(this.metrics.errorRate * 100).toFixed(1)}%`)
    }
    
    // Check widget load failures
    const totalLoads = this.metrics.widgetLoads + this.metrics.widgetLoadFailures
    if (totalLoads > 0 && this.metrics.widgetLoadFailures / totalLoads > 0.05) { // 5% failure rate
      issues.push(`Widget load failure rate: ${((this.metrics.widgetLoadFailures / totalLoads) * 100).toFixed(1)}%`)
    }
    
    // Check response time
    if (this.metrics.averageResponseTime > 5000) { // 5 seconds
      issues.push(`Slow response time: ${this.metrics.averageResponseTime.toFixed(0)}ms`)
    }
    
    // Check last activity
    const lastActivityTime = new Date(this.metrics.lastActivity).getTime()
    const timeSinceLastActivity = Date.now() - lastActivityTime
    if (timeSinceLastActivity > 24 * 60 * 60 * 1000) { // 24 hours
      issues.push('No activity in last 24 hours')
    }

    let status: 'healthy' | 'degraded' | 'unhealthy'
    if (issues.length === 0) {
      status = 'healthy'
    } else if (issues.length <= 2) {
      status = 'degraded'
    } else {
      status = 'unhealthy'
    }

    return {
      status,
      issues,
      metrics: this.metrics
    }
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit: number = 50): IntercomEvent[] {
    return this.events
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
  }

  /**
   * Get conversion metrics
   */
  getConversionMetrics(): {
    widgetToMessageRate: number
    messageToConversationRate: number
    overallConversionRate: number
  } {
    const totalWidgetLoads = this.metrics.widgetLoads + this.metrics.widgetLoadFailures
    const widgetToMessageRate = totalWidgetLoads > 0 ? this.metrics.messagesSent / totalWidgetLoads : 0
    const messageToConversationRate = this.metrics.messagesSent > 0 ? this.metrics.conversationsStarted / this.metrics.messagesSent : 0
    const overallConversionRate = totalWidgetLoads > 0 ? this.metrics.conversationsStarted / totalWidgetLoads : 0

    return {
      widgetToMessageRate,
      messageToConversationRate,
      overallConversionRate
    }
  }

  /**
   * Reset metrics (for testing)
   */
  resetMetrics(): void {
    this.metrics = {
      widgetLoads: 0,
      widgetLoadFailures: 0,
      messagesSent: 0,
      conversationsStarted: 0,
      averageResponseTime: 0,
      lastActivity: new Date().toISOString(),
      errorRate: 0
    }
    this.events = []
  }

  /**
   * Add event to history
   */
  private addEvent(event: IntercomEvent): void {
    this.events.push(event)
    
    // Keep only recent events
    if (this.events.length > this.MAX_EVENTS) {
      this.events = this.events.slice(-this.MAX_EVENTS)
    }
  }

  /**
   * Update error rate
   */
  private updateErrorRate(): void {
    const recentEvents = this.events.filter(
      event => Date.now() - event.timestamp < 60 * 60 * 1000 // Last hour
    )
    
    const errorEvents = recentEvents.filter(event => event.type === 'error')
    this.metrics.errorRate = recentEvents.length > 0 ? errorEvents.length / recentEvents.length : 0
  }
}

// Export singleton instance
export const intercomMonitoringService = new IntercomMonitoringService()
export default intercomMonitoringService
