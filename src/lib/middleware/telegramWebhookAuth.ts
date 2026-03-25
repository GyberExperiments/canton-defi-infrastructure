/**
 * Telegram Webhook Authentication & Validation
 * Comprehensive utilities для безопасной обработки webhooks
 */

export interface TelegramUpdate {
  update_id: number;
  callback_query?: {
    id: string;
    from: { id: number; username?: string; first_name?: string };
    data: string;
    message?: { chat?: { id: number; type: string }; message_id?: number };
  };
  message?: {
    message_id: number;
    from?: { id: number; username?: string; first_name?: string; is_bot?: boolean };
    chat: { id: number; type: string; title?: string };
    text?: string;
  };
}

/**
 * Валидация структуры Telegram update
 */
export function isValidTelegramUpdate(data: any): data is TelegramUpdate {
  // Базовая структура
  if (!data || typeof data !== 'object') {
    console.warn('Invalid data type:', typeof data);
    return false;
  }
  
  // update_id обязателен и должен быть положительным числом
  if (typeof data.update_id !== 'number' || data.update_id < 0) {
    console.warn('Invalid update_id:', data.update_id);
    return false;
  }
  
  // Должен быть хотя бы один тип обновления
  if (!data.callback_query && !data.message && !data.edited_message) {
    console.warn('No update type found');
    return false;
  }
  
  return true;
}

/**
 * Валидация callback query структуры
 */
export function isValidCallbackQuery(query: any): boolean {
  if (!query || typeof query !== 'object') return false;
  if (typeof query.id !== 'string') return false;
  if (typeof query.data !== 'string') return false;
  if (!query.from || typeof query.from.id !== 'number') return false;
  return true;
}

/**
 * Проверка что callback пришел из разрешенного чата
 */
export function isFromAllowedChat(
  chatId: number | string,
  allowedChats: (string | undefined)[]
): boolean {
  const chatIdStr = String(chatId);
  const validChats = allowedChats.filter((c): c is string => !!c);
  
  if (validChats.length === 0) {
    // Если allowed chats не настроены, разрешаем все (legacy mode)
    console.warn('⚠️ No allowed chats configured');
    return true;
  }
  
  return validChats.includes(chatIdStr);
}

/**
 * Rate limiting для webhook (защита от flood)
 */
const webhookRateLimiter = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60000; // 1 минута
const MAX_REQUESTS_PER_WINDOW = 100; // Максимум 100 запросов в минуту

export function checkWebhookRateLimit(identifier: string): boolean {
  const now = Date.now();
  const requests = webhookRateLimiter.get(identifier) || [];
  
  // Удаляем старые запросы (вне окна)
  const recentRequests = requests.filter(time => now - time < RATE_LIMIT_WINDOW);
  
  if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
    console.warn('⚠️ Webhook rate limit exceeded:', {
      identifier,
      requestCount: recentRequests.length,
      window: RATE_LIMIT_WINDOW
    });
    return false;
  }
  
  // Добавляем текущий запрос
  recentRequests.push(now);
  webhookRateLimiter.set(identifier, recentRequests);
  
  // Cleanup старых записей
  if (webhookRateLimiter.size > 1000) {
    const oldestKey = webhookRateLimiter.keys().next().value;
    if (oldestKey !== undefined) {
      webhookRateLimiter.delete(oldestKey);
    }
  }
  
  return true;
}
