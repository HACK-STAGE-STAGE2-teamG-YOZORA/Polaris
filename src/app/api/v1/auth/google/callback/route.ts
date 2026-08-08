import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { problem } from '@/server/api';
import {
  AuthConfigurationError,
  OAUTH_CALLBACK_PATH,
  OAUTH_STATE_COOKIE_NAME,
  OAUTH_VERIFIER_COOKIE_NAME,
  readAuthConfig,
} from '@/server/auth/config';
import { safeEqual } from '@/server/auth/crypto';
import { exchangeGoogleCode } from '@/server/auth/google';
import { createSession, setSessionCookie, upsertGoogleUser } from '@/server/auth/session';

export const runtime = 'nodejs';

function clearFlowCookies(response: NextResponse, secure: boolean): void {
  const options = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    path: OAUTH_CALLBACK_PATH,
    expires: new Date(0),
  };
  response.cookies.set(OAUTH_STATE_COOKIE_NAME, '', options);
  response.cookies.set(OAUTH_VERIFIER_COOKIE_NAME, '', options);
}

function redirectWithError(appUrl: URL, code: string, secure: boolean): NextResponse {
  const target = new URL('/', appUrl);
  target.searchParams.set('authError', code);
  const response = NextResponse.redirect(target);
  clearFlowCookies(response, secure);
  response.headers.set('cache-control', 'no-store');
  return response;
}

export async function GET(request: NextRequest): Promise<Response> {
  let config;
  try {
    config = readAuthConfig();
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      return problem(503, 'AUTH_NOT_CONFIGURED', error.message);
    }
    return problem(500, 'INTERNAL_ERROR', 'Google認証の設定確認中にエラーが発生しました。');
  }

  const url = new URL(request.url);
  const returnedState = url.searchParams.get('state') ?? undefined;
  const storedState = request.cookies.get(OAUTH_STATE_COOKIE_NAME)?.value;
  const verifier = request.cookies.get(OAUTH_VERIFIER_COOKIE_NAME)?.value;
  if (!safeEqual(returnedState, storedState) || !verifier) {
    return redirectWithError(config.appUrl, 'AUTH_FLOW_INVALID', config.secureCookies);
  }
  if (url.searchParams.has('error')) {
    return redirectWithError(config.appUrl, 'GOOGLE_AUTH_FAILED', config.secureCookies);
  }

  const code = url.searchParams.get('code');
  if (!code) return redirectWithError(config.appUrl, 'AUTH_FLOW_INVALID', config.secureCookies);

  try {
    const identity = await exchangeGoogleCode(config, code, verifier);
    const user = await upsertGoogleUser(identity);
    const session = await createSession(user.id, config);
    const response = NextResponse.redirect(new URL('/', config.appUrl));
    clearFlowCookies(response, config.secureCookies);
    setSessionCookie(response, config, session.token, session.expiresAt);
    response.headers.set('cache-control', 'no-store');
    return response;
  } catch {
    return redirectWithError(config.appUrl, 'GOOGLE_AUTH_FAILED', config.secureCookies);
  }
}
