import { NextResponse } from 'next/server';
import { problem } from '@/server/api';
import {
  AuthConfigurationError,
  OAUTH_CALLBACK_PATH,
  OAUTH_STATE_COOKIE_NAME,
  OAUTH_VERIFIER_COOKIE_NAME,
  readAuthConfig,
} from '@/server/auth/config';
import { createPkcePair, randomBase64Url } from '@/server/auth/crypto';
import { createGoogleAuthorizationUrl } from '@/server/auth/google';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  try {
    const config = readAuthConfig();
    const state = randomBase64Url();
    const { verifier, challenge } = createPkcePair();
    const response = NextResponse.redirect(createGoogleAuthorizationUrl(config, state, challenge));
    const cookieOptions = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: config.secureCookies,
      path: OAUTH_CALLBACK_PATH,
      maxAge: 10 * 60,
    };
    response.cookies.set(OAUTH_STATE_COOKIE_NAME, state, cookieOptions);
    response.cookies.set(OAUTH_VERIFIER_COOKIE_NAME, verifier, cookieOptions);
    response.headers.set('cache-control', 'no-store');
    return response;
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      return problem(503, 'AUTH_NOT_CONFIGURED', error.message);
    }
    return problem(500, 'INTERNAL_ERROR', 'Google認証の開始中にエラーが発生しました。');
  }
}
