/**
 * 🏥 Health Check API
 * Basic system health monitoring
 */

import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const startTime = Date.now()
    
    // Basic health checks
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      
      services: {
        api: true,
        database: checkDatabaseConnection(),
        external: checkExternalServices()
      },
      
      system: {
        memory: process.memoryUsage(),
        responseTime: Date.now() - startTime
      }
    }

    return NextResponse.json(health)

  } catch (error) {
    console.error('❌ Health check failed:', error)
    
    return NextResponse.json(
      { 
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Health check failed',
        timestamp: new Date().toISOString()
      }, 
      { status: 500 }
    )
  }
}

/**
 * Check database connection (Google Sheets in our case)
 */
function checkDatabaseConnection(): boolean {
  // Check if Google Sheets is configured
  return !!(
    process.env.GOOGLE_SHEET_ID && 
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && 
    process.env.GOOGLE_PRIVATE_KEY
  )
}

/**
 * Check external services configuration
 */
function checkExternalServices(): {
  telegram: boolean;
  email: boolean;
  sheets: boolean;
} {
  return {
    telegram: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    email: !!(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASSWORD),
    sheets: !!(process.env.GOOGLE_SHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL)
  }
}
