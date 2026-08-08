import { strict as assert } from 'node:assert';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AuthConfigurationError, OAUTH_CALLBACK_PATH, readAuthConfig } from '../src/server/auth/config.ts';
import { createPkcePair, randomBase64Url, safeEqual, sha256Base64Url } from '../src/server/auth/crypto.ts';
import { createGoogleAuthorizationUrl } from '../src/server/auth/google.ts';

const original = {
  appUrl: process.env.APP_URL,
  clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
  clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  ttl: process.env.AUTH_SESSION_TTL_HOURS,
};

try {
  const first = randomBase64Url();
  const second = randomBase64Url();
  assert.match(first, /^[A-Za-z0-9_-]{43}$/u);
  assert.notEqual(first, second);
  assert.equal(sha256Base64Url('polaris'), sha256Base64Url('polaris'));
  assert.notEqual(sha256Base64Url('polaris'), 'polaris');
  assert.equal(safeEqual(first, first), true);
  assert.equal(safeEqual(first, second), false);
  assert.equal(safeEqual(first, undefined), false);

  const pkce = createPkcePair();
  assert.match(pkce.verifier, /^[A-Za-z0-9_-]{86}$/u);
  assert.equal(pkce.challenge, sha256Base64Url(pkce.verifier));

  delete process.env.GOOGLE_OAUTH_CLIENT_ID;
  delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  assert.throws(() => readAuthConfig(), AuthConfigurationError);

  process.env.APP_URL = 'http://localhost:3000';
  process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-client.apps.googleusercontent.com';
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-secret';
  process.env.AUTH_SESSION_TTL_HOURS = '168';
  const config = readAuthConfig();
  assert.equal(config.callbackUrl, `http://localhost:3000${OAUTH_CALLBACK_PATH}`);
  assert.equal(config.secureCookies, false);
  assert.equal(config.sessionTtlMs, 168 * 60 * 60 * 1000);

  const state = randomBase64Url();
  const authorizationUrl = new URL(createGoogleAuthorizationUrl(config, state, pkce.challenge));
  assert.equal(authorizationUrl.origin, 'https://accounts.google.com');
  assert.equal(authorizationUrl.searchParams.get('client_id'), config.clientId);
  assert.equal(authorizationUrl.searchParams.get('redirect_uri'), config.callbackUrl);
  assert.equal(authorizationUrl.searchParams.get('state'), state);
  assert.equal(authorizationUrl.searchParams.get('code_challenge'), pkce.challenge);
  assert.equal(authorizationUrl.searchParams.get('code_challenge_method'), 'S256');

  process.env.APP_URL = 'http://example.com';
  assert.throws(() => readAuthConfig(), AuthConfigurationError);
  process.env.APP_URL = 'https://example.com/app';
  assert.throws(() => readAuthConfig(), AuthConfigurationError);
  process.env.AUTH_SESSION_TTL_HOURS = '0';
  process.env.APP_URL = 'https://example.com';
  assert.throws(() => readAuthConfig(), AuthConfigurationError);
} finally {
  for (const [key, value] of Object.entries({
    APP_URL: original.appUrl,
    GOOGLE_OAUTH_CLIENT_ID: original.clientId,
    GOOGLE_OAUTH_CLIENT_SECRET: original.clientSecret,
    AUTH_SESSION_TTL_HOURS: original.ttl,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

console.log('Google auth security units: OK');

async function routeFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return routeFiles(path);
    return entry.isFile() && entry.name === 'route.ts' ? [path] : [];
  }))).flat();
}

const apiRoot = join(process.cwd(), 'src', 'app', 'api', 'v1');
for (const path of await routeFiles(apiRoot)) {
  const normalized = path.replaceAll('\\', '/');
  if (normalized.includes('/api/v1/auth/') || normalized.includes('/api/v1/system/')) continue;
  const source = await readFile(path, 'utf8');
  const operationCount = [...source.matchAll(/export\s+async\s+function\s+(GET|POST|PATCH|DELETE)\s*\(/gu)].length;
  const guardCount = [...source.matchAll(/await\s+requireAuth\s*\(/gu)].length;
  assert.equal(guardCount, operationCount, `${normalized}の全操作にrequireAuthがありません。`);
}

console.log('Business API auth guard coverage: OK');
