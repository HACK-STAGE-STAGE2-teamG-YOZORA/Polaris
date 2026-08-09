import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';
import type { AuthConfig } from './config';

const GOOGLE_SCOPES = ['openid', 'email', 'profile'];

export type GoogleIdentity = {
  subject: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
};

function client(config: AuthConfig): OAuth2Client {
  return new OAuth2Client(config.clientId, config.clientSecret, config.callbackUrl);
}

export function createGoogleAuthorizationUrl(
  config: AuthConfig,
  state: string,
  codeChallenge: string,
): string {
  return client(config).generateAuthUrl({
    access_type: 'online',
    scope: GOOGLE_SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: CodeChallengeMethod.S256,
    include_granted_scopes: true,
    prompt: 'select_account',
  });
}

export async function exchangeGoogleCode(
  config: AuthConfig,
  code: string,
  codeVerifier: string,
): Promise<GoogleIdentity> {
  const oauthClient = client(config);
  const { tokens } = await oauthClient.getToken({ code, codeVerifier });
  if (!tokens.id_token) throw new Error('GoogleからIDトークンが返されませんでした。');

  const ticket = await oauthClient.verifyIdToken({
    idToken: tokens.id_token,
    audience: config.clientId,
  });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    throw new Error('Googleアカウントの確認済みメールアドレスを取得できませんでした。');
  }

  return {
    subject: payload.sub,
    email: payload.email,
    displayName: payload.name?.trim() || null,
    avatarUrl: payload.picture?.trim() || null,
  };
}
