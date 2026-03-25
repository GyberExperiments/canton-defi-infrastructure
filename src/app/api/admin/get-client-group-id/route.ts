import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

/**
 * GET /api/admin/get-client-group-id
 * Получить ID группы клиентов из логов или env
 */
export async function GET(request: NextRequest) {
  try {
    // Проверка авторизации (NextAuth v5 API)
    const session = await auth();
    if (!session || !session.user || (session.user as { role?: string }).role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Пробуем получить из env
    const clientGroupChatId = process.env.TELEGRAM_CLIENT_GROUP_CHAT_ID;

    if (clientGroupChatId) {
      return NextResponse.json({
        success: true,
        source: 'environment',
        clientGroupChatId,
        message: 'ID группы найден в переменных окружения'
      });
    }

    // Если нет в env, возвращаем инструкции
    return NextResponse.json({
      success: false,
      source: 'not_found',
      message: 'ID группы не найден в переменных окружения',
      instructions: {
        step1: 'Напишите "ruheggs" в группе клиентов',
        step2: 'Бот автоматически сохранит ID группы',
        step3: 'Добавьте TELEGRAM_CLIENT_GROUP_CHAT_ID в секреты',
        step4: 'Перезапустите deployment'
      }
    });

  } catch (error) {
    console.error('❌ Error getting client group ID:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
