import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

/**
 * API endpoint для генерации JWT токенов для Intercom Identity Verification
 * 
 * Генерирует безопасный HMAC-подписанный токен для аутентификации пользователей в Intercom
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id, email, name, custom_attributes } = body

    // Валидация обязательных полей
    if (!user_id || !email) {
      return NextResponse.json(
        { error: 'user_id and email are required' },
        { status: 400 }
      )
    }

    // Получаем секретный ключ из переменных окружения
    // Поддержка нескольких возможных имен переменных
    const intercomSecret = process.env.INTERCOM_API_SECRET || 
                          process.env.INTERCOM_SECRET_KEY ||
                          process.env.INTERCOM_IDENTITY_VERIFICATION_SECRET
    
    if (!intercomSecret) {
      console.warn('⚠️ INTERCOM_API_SECRET not configured, JWT generation skipped')
      // Возвращаем успех без токена (Intercom будет работать без Identity Verification)
      return NextResponse.json({
        success: true,
        token: null,
        warning: 'Identity verification disabled - Intercom secret not configured',
        expires_in: 0,
      })
    }

    // Создаём JWT payload
    // Все атрибуты здесь будут защищены и проверены Intercom
    const payload: Record<string, string | number | boolean | null> = {
      user_id,
      email,
    }

    // Добавляем имя если есть
    if (name) {
      payload.name = name
    }

    // Добавляем custom attributes если есть (данные заказа)
    if (custom_attributes) {
      // Все sensitive данные должны быть в payload для защиты
      Object.keys(custom_attributes).forEach(key => {
        payload[key] = custom_attributes[key]
      })
    }

    // Генерируем JWT с подписью HMAC SHA256
    // Токен действителен 1 час (можно увеличить до 24 часов)
    const token = jwt.sign(payload, intercomSecret, {
      algorithm: 'HS256',
      expiresIn: '24h', // 24 часа для stage окружения
    })

    console.log('✅ JWT token generated for user:', email)

    return NextResponse.json({
      success: true,
      token,
      expires_in: 86400, // 24 часа в секундах
    })

  } catch (error) {
    console.error('❌ Error generating JWT:', error)
    return NextResponse.json(
      { 
        error: 'Failed to generate JWT token',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Health check endpoint
 */
export async function GET() {
  const isConfigured = !!process.env.INTERCOM_API_SECRET
  
  return NextResponse.json({
    service: 'Intercom JWT Generator',
    configured: isConfigured,
    status: isConfigured ? 'ready' : 'missing_configuration',
  })
}

