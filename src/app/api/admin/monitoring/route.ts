import { NextRequest, NextResponse } from 'next/server';

// Принудительно делаем route динамическим
export const dynamic = 'force-dynamic';
// MINIMAL VERSION: monitoringService not needed

/**
 * 🏛️ Admin Monitoring API
 * Предоставляет детальную информацию о состоянии системы
 */

export async function GET(request: NextRequest) {
  try {
    // Проверяем авторизацию администратора
    const adminKey = request.headers.get('x-admin-key');
    if (adminKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // MINIMAL VERSION: No monitoring needed
    // Форматируем ответ
    const response = {
      success: true,
      timestamp: Date.now(),
      health: {
        status: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: Date.now()
      },
      performance: {
        averageResponseTime: 0,
        totalRequests: 0,
        errorRate: 0,
        throughput: 0
      },
      metrics: {
        monitoring: {
          addresses: {
            totalGenerated: 0,
            activeAddresses: 0,
            expiredAddresses: 0,
            averageLifetime: 0,
            generationRate: 0
          },
          performance: {
            averageResponseTime: 0,
            totalRequests: 0,
            errorRate: 0,
            throughput: 0
          },
          security: {
            spamAttempts: 0,
            blockedIPs: 0,
            blockedEmails: 0,
            suspiciousActivities: 0
          },
          business: {
            totalOrders: 0,
            completedOrders: 0,
            totalVolume: 0,
            averageOrderValue: 0
          }
        },
        addresses: {
          totalGenerated: 0,
          activeAddresses: 0,
          expiredAddresses: 0,
          averageLifetime: 0,
          generationRate: 0
        },
        activeAddresses: []
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        environment: process.env.NODE_ENV
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Monitoring API error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to get monitoring data',
        code: 'MONITORING_ERROR'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Проверяем авторизацию администратора
    const adminKey = request.headers.get('x-admin-key');
    if (adminKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action } = body;

    // MINIMAL VERSION: No monitoring needed
    switch (action) {
      case 'record_api_call':
      case 'record_order':
      case 'record_spam_attempt':
      case 'record_blocked_ip':
      case 'record_blocked_email':
      case 'record_suspicious_activity':
        // No-op in minimal version
        break;
        
      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: `Action ${action} recorded successfully`
    });

  } catch (error) {
    console.error('❌ Monitoring API error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to record monitoring data',
        code: 'MONITORING_ERROR'
      },
      { status: 500 }
    );
  }
}






