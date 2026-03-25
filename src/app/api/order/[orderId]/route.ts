/**
 * 📋 Order View API
 * Получение заявки с проверкой приватности
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { googleSheetsService } from '@/lib/services/googleSheets'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await context.params

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required', code: 'MISSING_ORDER_ID' },
        { status: 400 }
      )
    }

    // ✅ ИСПРАВЛЕНО: Проверяем в Supabase и Google Sheets параллельно
    // Supabase обычно быстрее, но Google Sheets может быть более актуальным
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    let orderFromSupabase = null
    let isPrivate = false

    // Параллельно проверяем оба источника
    const [supabaseResult, sheetsResult] = await Promise.allSettled([
      // Проверка Supabase
      (async () => {
        if (supabaseUrl && supabaseKey) {
          try {
            const supabase = createClient(supabaseUrl, supabaseKey)
            const { data, error } = await supabase
              .from('public_orders')
              .select('*')
              .eq('order_id', orderId)
              .single()

            if (!error && data) {
              return { data, isPrivate: data.is_private === true }
            }
          } catch (error) {
            console.warn('⚠️ Could not fetch from Supabase:', error)
          }
        }
        return null
      })(),
      // Проверка Google Sheets
      googleSheetsService.getOrderById(orderId)
    ])

    // Обрабатываем результаты Supabase
    if (supabaseResult.status === 'fulfilled' && supabaseResult.value) {
      orderFromSupabase = supabaseResult.value.data
      isPrivate = supabaseResult.value.isPrivate
    }

    // Обрабатываем результаты Google Sheets
    let order = null
    if (sheetsResult.status === 'fulfilled' && sheetsResult.value) {
      order = sheetsResult.value
    }

    // ✅ ИСПРАВЛЕНО: Если ордер не найден, но есть в Supabase, создаем базовую структуру
    if (!order && orderFromSupabase) {
      // Конвертируем данные из Supabase в формат OTCOrder
      order = {
        orderId: orderFromSupabase.order_id,
        timestamp: orderFromSupabase.created_at ? new Date(orderFromSupabase.created_at).getTime() : Date.now(),
        paymentAmount: orderFromSupabase.payment_amount_usd || 0,
        paymentAmountUSD: orderFromSupabase.payment_amount_usd || 0,
        cantonAmount: orderFromSupabase.canton_amount || 0,
        cantonAddress: orderFromSupabase.canton_address || '',
        receivingAddress: orderFromSupabase.receiving_address,
        refundAddress: orderFromSupabase.refund_address,
        email: orderFromSupabase.email || '',
        whatsapp: orderFromSupabase.whatsapp,
        telegram: orderFromSupabase.telegram,
        status: (orderFromSupabase.status as any) || 'awaiting-deposit',
        txHash: orderFromSupabase.tx_hash,
        paymentToken: {} as any, // Будет заполнено из конфигурации
        exchangeDirection: (orderFromSupabase.exchange_direction as 'buy' | 'sell') || 'buy',
        manualPrice: orderFromSupabase.manual_price ? orderFromSupabase.price : undefined,
        serviceCommission: orderFromSupabase.service_commission || 1,
        isPrivateDeal: isPrivate
      }
    }

    if (!order) {
      // ✅ ИСПРАВЛЕНО: Если ордер не найден, возвращаем более информативную ошибку
      console.warn('⚠️ Order not found:', {
        orderId,
        checkedSupabase: !!supabaseUrl && !!supabaseKey,
        supabaseResult: supabaseResult.status,
        sheetsResult: sheetsResult.status
      })
      return NextResponse.json(
        { 
          error: 'Order not found', 
          code: 'ORDER_NOT_FOUND',
          message: 'The order may still be processing. Please try again in a few seconds.'
        },
        { status: 404 }
      )
    }

    // Если заявка приватная, проверяем доступ
    // Для приватных заявок можно добавить токен доступа в будущем
    // Пока разрешаем доступ по прямой ссылке (любой может открыть по ссылке)
    // В будущем можно добавить: ?token=xxx для приватных заявок

    // Формируем ответ
    const orderData = {
      orderId: order.orderId,
      timestamp: order.timestamp,
      paymentAmount: order.paymentAmount,
      paymentAmountUSD: order.paymentAmountUSD,
      cantonAmount: order.cantonAmount,
      cantonAddress: order.cantonAddress,
      receivingAddress: order.receivingAddress,
      refundAddress: order.refundAddress,
      email: order.email,
      whatsapp: order.whatsapp,
      telegram: order.telegram,
      status: order.status,
      txHash: order.txHash,
      paymentToken: order.paymentToken,
      exchangeDirection: order.exchangeDirection,
      manualPrice: order.manualPrice,
      serviceCommission: order.serviceCommission,
      isPrivateDeal: isPrivate || order.isPrivateDeal || false,
      chatLink: order.chatLink,
      createdAt: order.timestamp ? new Date(order.timestamp).toISOString() : new Date().toISOString()
    }

    return NextResponse.json({
      success: true,
      order: orderData
    })

  } catch (error) {
    console.error('❌ Failed to get order:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to get order',
        code: 'ORDER_FETCH_FAILED'
      }, 
      { status: 500 }
    )
  }
}

