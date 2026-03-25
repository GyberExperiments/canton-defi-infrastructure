/**
 * 🛡️ Middleware для защиты admin роутов
 * Использует cookies для проверки аутентификации (Edge Runtime compatible)
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Защищаем все admin роуты кроме страницы логина
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    // Проверяем наличие JWT токена в cookies (Edge Runtime compatible)
    const token = request.cookies.get('__Secure-authjs.session-token') || 
                  request.cookies.get('authjs.session-token');

    if (!token) {
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*']
};


