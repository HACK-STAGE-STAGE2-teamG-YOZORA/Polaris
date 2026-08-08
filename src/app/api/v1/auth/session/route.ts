import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalError } from '@/server/api';
import { areCookiesSecure, SESSION_COOKIE_NAME } from '@/server/auth/config';
import { clearSessionCookie, readSession } from '@/server/auth/session';

export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const session = await readSession(request);
    const response = NextResponse.json(session
      ? { authenticated: true, user: session.user, expiresAt: session.expiresAt }
      : { authenticated: false, user: null, expiresAt: null });
    if (!session && request.cookies.has(SESSION_COOKIE_NAME)) {
      clearSessionCookie(response, areCookiesSecure());
    }
    response.headers.set('cache-control', 'no-store');
    return response;
  } catch (error) {
    return internalError(error, '認証セッション取得');
  }
}
