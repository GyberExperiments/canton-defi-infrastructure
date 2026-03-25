/**
 * Prometheus metrics endpoint
 * Format: Prometheus text format
 */

import { NextResponse } from 'next/server';
import { metricsCollector } from '@/lib/monitoring/metricsCollector';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const metrics = metricsCollector.getMetrics();
    
    // Prometheus text format
    const prometheusMetrics = `
# HELP canton_otc_orders_created_total Total number of orders created
# TYPE canton_otc_orders_created_total counter
canton_otc_orders_created_total ${metrics.orderCreations}

# HELP canton_otc_orders_failed_total Total number of order creation failures
# TYPE canton_otc_orders_failed_total counter
canton_otc_orders_failed_total ${metrics.orderCreationErrors}

# HELP canton_otc_order_creation_duration_ms Average order creation duration
# TYPE canton_otc_order_creation_duration_ms gauge
canton_otc_order_creation_duration_ms ${metrics.averageOrderCreationTime}

# HELP canton_otc_supabase_saves_success_total Successful Supabase saves
# TYPE canton_otc_supabase_saves_success_total counter
canton_otc_supabase_saves_success_total ${metrics.supabaseSaveSuccesses}

# HELP canton_otc_supabase_saves_failed_total Failed Supabase saves
# TYPE canton_otc_supabase_saves_failed_total counter
canton_otc_supabase_saves_failed_total ${metrics.supabaseSaveErrors}

# HELP canton_otc_webhook_validations_total Valid webhook requests
# TYPE canton_otc_webhook_validations_total counter
canton_otc_webhook_validations_total ${metrics.webhookValidations}

# HELP canton_otc_webhook_rejections_total Rejected webhook requests
# TYPE canton_otc_webhook_rejections_total counter
canton_otc_webhook_rejections_total ${metrics.webhookRejections}

# HELP canton_otc_notifications_sent_total Notifications sent by channel
# TYPE canton_otc_notifications_sent_total counter
canton_otc_notifications_sent_total{channel="telegram"} ${metrics.notificationsSent.telegram}
canton_otc_notifications_sent_total{channel="intercom"} ${metrics.notificationsSent.intercom}
canton_otc_notifications_sent_total{channel="email"} ${metrics.notificationsSent.email}

# HELP canton_otc_notifications_failed_total Notifications failed by channel
# TYPE canton_otc_notifications_failed_total counter
canton_otc_notifications_failed_total{channel="telegram"} ${metrics.notificationsFailed.telegram}
canton_otc_notifications_failed_total{channel="intercom"} ${metrics.notificationsFailed.intercom}
canton_otc_notifications_failed_total{channel="email"} ${metrics.notificationsFailed.email}

# HELP canton_otc_order_creation_success_rate Order creation success rate percentage
# TYPE canton_otc_order_creation_success_rate gauge
canton_otc_order_creation_success_rate ${metrics.orderCreationSuccessRate}

# HELP canton_otc_supabase_save_success_rate Supabase save success rate percentage
# TYPE canton_otc_supabase_save_success_rate gauge
canton_otc_supabase_save_success_rate ${metrics.supabaseSaveSuccessRate}
    `.trim();
    
    return new NextResponse(prometheusMetrics, {
      headers: {
        'Content-Type': 'text/plain; version=0.0.4'
      }
    });
  } catch (error) {
    return new NextResponse('Error collecting metrics', { status: 500 });
  }
}
