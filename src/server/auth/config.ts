export const SESSION_COOKIE_NAME = 'polaris_session';
export const OAUTH_STATE_COOKIE_NAME = 'polaris_oauth_state';
export const OAUTH_VERIFIER_COOKIE_NAME = 'polaris_oauth_verifier';
export const OAUTH_CALLBACK_PATH = '/api/v1/auth/google/callback';

const DEFAULT_SESSION_TTL_HOURS = 168;

// lastSeenAtを更新する最小間隔。1画面の表示で複数のAPIが認証確認を通るため、
// 毎回書き込むとタブ移動のたびに不要なUPDATEが増える
export const LAST_SEEN_UPDATE_INTERVAL_MS = 5 * 60 * 1000;

// lastSeenAtを更新すべきか判定する。セッションの有効期限判定はexpiresAtで行っており、
// lastSeenAtは最終アクセスの記録用なので、この間隔で間引いてもログイン状態は変わらない
export function shouldTouchLastSeenAt(lastSeenAt: Date, now: Date): boolean {
  return lastSeenAt.getTime() <= now.getTime() - LAST_SEEN_UPDATE_INTERVAL_MS;
}

export class AuthConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthConfigurationError';
  }
}

export type AuthConfig = {
  appUrl: URL;
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  sessionTtlMs: number;
  secureCookies: boolean;
};

export function areCookiesSecure(): boolean {
  try {
    return new URL(process.env.APP_URL ?? 'http://localhost:3000').protocol === 'https:';
  } catch {
    return false;
  }
}

function readSessionTtlHours(): number {
  const raw = process.env.AUTH_SESSION_TTL_HOURS;
  if (!raw) return DEFAULT_SESSION_TTL_HOURS;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 720) {
    throw new AuthConfigurationError('AUTH_SESSION_TTL_HOURSは1〜720の整数で指定してください。');
  }
  return value;
}

export function readAuthConfig(): AuthConfig {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new AuthConfigurationError('Google認証が設定されていません。');
  }

  let appUrl: URL;
  try {
    appUrl = new URL(process.env.APP_URL ?? 'http://localhost:3000');
  } catch {
    throw new AuthConfigurationError('APP_URLが有効なURLではありません。');
  }

  const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(appUrl.hostname);
  if ((appUrl.protocol !== 'https:' && !(appUrl.protocol === 'http:' && isLocalhost))
    || appUrl.username
    || appUrl.password
    || appUrl.pathname !== '/'
    || appUrl.search
    || appUrl.hash) {
    throw new AuthConfigurationError('APP_URLはlocalhostのhttp、またはhttpsのオリジンだけを指定してください。');
  }

  return {
    appUrl,
    clientId,
    clientSecret,
    callbackUrl: new URL(OAUTH_CALLBACK_PATH, appUrl).toString(),
    sessionTtlMs: readSessionTtlHours() * 60 * 60 * 1000,
    secureCookies: appUrl.protocol === 'https:',
  };
}
