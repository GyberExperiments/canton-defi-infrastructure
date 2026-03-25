/**
 * 📊 Intercom Monitoring API
 * Provides metrics and health status for Intercom integration
 */

import { NextRequest, NextResponse } from 'next/server'
import { intercomMonitoringService } from '@/lib/services/intercomMonitoring'
import { intercomService } from '@/lib/services/intercom'

// Принудительно делаем route динамическим
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const adminKey = searchParams.get('adminKey')
    const type = searchParams.get('type') || 'health'

    // Simple admin authentication
    if (adminKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    switch (type) {
      case 'health':
        return NextResponse.json({
          success: true,
          type: 'health',
          data: intercomMonitoringService.getHealthStatus(),
          timestamp: new Date().toISOString()
        })

      case 'metrics':
        return NextResponse.json({
          success: true,
          type: 'metrics',
          data: {
            metrics: intercomMonitoringService.getMetrics(),
            conversion: intercomMonitoringService.getConversionMetrics()
          },
          timestamp: new Date().toISOString()
        })

      case 'events':
        const limit = parseInt(searchParams.get('limit') || '50')
        return NextResponse.json({
          success: true,
          type: 'events',
          data: intercomMonitoringService.getRecentEvents(limit),
          timestamp: new Date().toISOString()
        })

      case 'test-connection':
        const connectionResult = await intercomService.testConnection()
        return NextResponse.json({
          success: true,
          type: 'test-connection',
          data: {
            connection: connectionResult,
            configured: !!(process.env.NEXT_PUBLIC_INTERCOM_APP_ID && process.env.INTERCOM_ACCESS_TOKEN && process.env.INTERCOM_ADMIN_ID)
          },
          timestamp: new Date().toISOString()
        })

      default:
        return NextResponse.json(
          { error: 'Invalid type parameter', code: 'INVALID_TYPE' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('❌ Intercom monitoring API error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Monitoring API failed',
        code: 'MONITORING_API_ERROR'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { adminKey, action, data } = await request.json()

    // Simple admin authentication
    if (adminKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    switch (action) {
      case 'track_widget_load':
        intercomMonitoringService.trackWidgetLoad(data.loadTime)
        break

      case 'track_widget_failure':
        intercomMonitoringService.trackWidgetFailure(data.error)
        break

      case 'track_message_sent':
        intercomMonitoringService.trackMessageSent(data.orderId)
        break

      case 'track_conversation_started':
        intercomMonitoringService.trackConversationStarted(data.orderId)
        break

      case 'track_error':
        intercomMonitoringService.trackError(data.error, data.context)
        break

      case 'update_response_time':
        intercomMonitoringService.updateResponseTime(data.responseTime)
        break

      case 'reset_metrics':
        intercomMonitoringService.resetMetrics()
        break

      default:
        return NextResponse.json(
          { error: 'Unknown action', code: 'UNKNOWN_ACTION' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      action,
      message: `Action ${action} executed successfully`,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Intercom monitoring POST error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Monitoring POST failed',
        code: 'MONITORING_POST_ERROR'
      },
      { status: 500 }
    )
  }
}
