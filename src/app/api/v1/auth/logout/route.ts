import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalError } from '@/server/api';
import { areCookiesSecure } from '@/server/auth/config';
import { clearSessionCookie, deleteSession } from '@/server/auth/session';

export const runtime = 'nodejs';

export async function POST(request: NextRequest): Promise<Response> {
  try {
    await deleteSession(request);
    const response = new NextResponse(null, { status: 204 });
    clearSessionCookie(response, areCookiesSecure());
    response.headers.set('cache-control', 'no-store');
    return response;
  } catch (error) {
    return internalError(error, 'ログアウト');
  }
}
