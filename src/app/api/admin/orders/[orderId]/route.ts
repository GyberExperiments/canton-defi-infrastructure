/**
 * 📊 Admin API - Single Order Operations
 * GET, PATCH, DELETE для конкретного заказа
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { googleSheetsService } from '@/lib/services/googleSheets';
import { telegramService } from '@/lib/services/telegram';

// Принудительно делаем route динамическим
export const dynamic = 'force-dynamic';

/**
 * GET - Получить конкретный заказ
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const order = await googleSheetsService.getOrderById(params.orderId);
    
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error('Admin API - Get order error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Обновить заказ
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const updates = await request.json();
    
    // Validate updates
    const allowedFields = ['status', 'txHash', 'cantonAddress'];
    const validUpdates: Record<string, unknown> = {};
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        validUpdates[field] = updates[field];
      }
    }

    if (Object.keys(validUpdates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const success = await googleSheetsService.updateOrder(params.orderId, validUpdates);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update order' },
        { status: 500 }
      );
    }

    // Notify via Telegram if status changed
    if (validUpdates.status) {
      const order = await googleSheetsService.getOrderById(params.orderId);
      if (order) {
        await telegramService.sendOrderNotification({
          ...order,
          status: validUpdates.status as import('@/config/otc').OrderStatus,
          txHash: (validUpdates.txHash as string | undefined) || order.txHash
        }).catch(err => console.error('Failed to send telegram notification:', err));
      }
    }

    return NextResponse.json({ success: true, updates: validUpdates });
  } catch (error) {
    console.error('Admin API - Update order error:', error);
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Удалить заказ
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const success = await googleSheetsService.deleteOrder(params.orderId);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete order' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin API - Delete order error:', error);
    return NextResponse.json(
      { error: 'Failed to delete order' },
      { status: 500 }
    );
  }
}

