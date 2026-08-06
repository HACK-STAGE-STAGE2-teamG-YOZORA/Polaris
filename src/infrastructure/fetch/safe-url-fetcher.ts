import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { isIP } from 'node:net';
import { request as httpsRequest } from 'node:https';
import * as cheerio from 'cheerio';

function positiveIntegerSetting(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

const CONNECT_TIMEOUT_MS = positiveIntegerSetting('COMPANY_FETCH_CONNECT_TIMEOUT_MS', 10_000);
const TOTAL_TIMEOUT_MS = positiveIntegerSetting('COMPANY_FETCH_TOTAL_TIMEOUT_MS', 30_000);
const MAX_REDIRECTS = positiveIntegerSetting('COMPANY_FETCH_MAX_REDIRECTS', 3);
const MAX_RESPONSE_BYTES = positiveIntegerSetting('COMPANY_FETCH_MAX_BYTES', 2 * 1024 * 1024);

type ResolvedAddress = { address: string; family: 4 | 6 };

export type SafeUrlResult = {
  url: string;
  title: string;
  text: string;
  contentType: 'text/html' | 'text/plain';
};

export class SafeUrlFetchError extends Error {
  readonly code:
    | 'UNSAFE_URL'
    | 'FETCH_FAILED'
    | 'FETCH_TIMEOUT'
    | 'PAYLOAD_TOO_LARGE'
    | 'UNSUPPORTED_MEDIA_TYPE';

  constructor(code: SafeUrlFetchError['code'], message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SafeUrlFetchError';
    this.code = code;
  }
}

function isBlockedIpv4(address: string): boolean {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    return true;
  }
  const [a, b, c] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function expandIpv6(address: string): number[] | null {
  const normalized = address.toLowerCase().split('%')[0];
  const ipv4Tail = normalized.match(/(?:^|:)(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  let value = normalized;
  if (ipv4Tail) {
    const octets = ipv4Tail.split('.').map(Number);
    if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
    const replacement = `${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
    value = `${normalized.slice(0, normalized.length - ipv4Tail.length)}${replacement}`;
  }
  const halves = value.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
  const parts = [...left, ...Array(missing).fill('0'), ...right];
  if (parts.length !== 8 || parts.some((part) => !/^[0-9a-f]{1,4}$/u.test(part))) return null;
  return parts.map((part) => Number.parseInt(part, 16));
}

function isBlockedIpv6(address: string): boolean {
  const parts = expandIpv6(address);
  if (!parts) return true;
  const [first, second] = parts;
  const allZero = parts.every((part) => part === 0);
  const loopback = parts.slice(0, 7).every((part) => part === 0) && parts[7] === 1;
  const uniqueLocal = (first & 0xfe00) === 0xfc00;
  const linkLocal = (first & 0xffc0) === 0xfe80;
  const siteLocal = (first & 0xffc0) === 0xfec0;
  const multicast = (first & 0xff00) === 0xff00;
  const documentation = first === 0x2001 && second === 0x0db8;
  const ipv4Mapped = parts.slice(0, 5).every((part) => part === 0) && parts[5] === 0xffff;
  if (ipv4Mapped) {
    const mapped = `${parts[6] >> 8}.${parts[6] & 0xff}.${parts[7] >> 8}.${parts[7] & 0xff}`;
    return isBlockedIpv4(mapped);
  }
  const ipv4Compatible = parts.slice(0, 6).every((part) => part === 0);
  return allZero || loopback || ipv4Compatible || uniqueLocal || linkLocal || siteLocal || multicast || documentation;
}

export function isBlockedIpAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isBlockedIpv4(address);
  if (family === 6) return isBlockedIpv6(address);
  return true;
}

export function parseSafeHttpUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch (error) {
    throw new SafeUrlFetchError('UNSAFE_URL', '有効なURLを指定してください。', { cause: error });
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SafeUrlFetchError('UNSAFE_URL', 'http または https のURLだけを指定できます。');
  }
  if (url.username || url.password) {
    throw new SafeUrlFetchError('UNSAFE_URL', 'ユーザー情報を含むURLは指定できません。');
  }
  const literalHost = url.hostname.replace(/^\[|\]$/gu, '');
  if (isIP(literalHost) && isBlockedIpAddress(literalHost)) {
    throw new SafeUrlFetchError('UNSAFE_URL', 'プライベートまたは予約済みIPへのアクセスは許可されません。');
  }
  if (url.hostname.toLowerCase() === 'localhost' || url.hostname.toLowerCase().endsWith('.localhost')) {
    throw new SafeUrlFetchError('UNSAFE_URL', 'localhostへのアクセスは許可されません。');
  }
  return url;
}

async function resolvePublicAddresses(url: URL, deadline: number): Promise<ResolvedAddress[]> {
  const literalHost = url.hostname.replace(/^\[|\]$/gu, '');
  const literalFamily = isIP(literalHost);
  let addresses: ResolvedAddress[];
  try {
    if (literalFamily) {
      addresses = [{ address: literalHost, family: literalFamily as 4 | 6 }];
    } else {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new SafeUrlFetchError('FETCH_TIMEOUT', 'URL取得が全体制限時間を超えました。');
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const resolved = await Promise.race([
          lookup(literalHost, { all: true, verbatim: true }),
          new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => reject(new SafeUrlFetchError('FETCH_TIMEOUT', 'URLの名前解決が制限時間を超えました。')), remaining);
          }),
        ]);
        addresses = resolved.map((item) => ({ address: item.address, family: item.family as 4 | 6 }));
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
  } catch (error) {
    if (error instanceof SafeUrlFetchError) throw error;
    throw new SafeUrlFetchError('FETCH_FAILED', 'URLのホスト名を解決できませんでした。', { cause: error });
  }
  if (addresses.length === 0 || addresses.some((item) => isBlockedIpAddress(item.address))) {
    throw new SafeUrlFetchError('UNSAFE_URL', 'URLの接続先にプライベートまたは予約済みIPが含まれます。');
  }
  return addresses;
}

function requestOnce(url: URL, addresses: ResolvedAddress[], deadline: number): Promise<{
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
}> {
  return new Promise((resolve, reject) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      reject(new SafeUrlFetchError('FETCH_TIMEOUT', 'URL取得が全体制限時間を超えました。'));
      return;
    }
    const selected = addresses[0];
    const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
      method: 'GET',
      headers: {
        accept: 'text/html,text/plain;q=0.9',
        'user-agent': 'Polaris/0.3 (+local-company-import)',
      },
      lookup: ((_hostname: string, _options: unknown, callback: (error: Error | null, address?: string, family?: number) => void) => {
        callback(null, selected.address, selected.family);
      }) as never,
    }, (response) => {
      const chunks: Buffer[] = [];
      let bytes = 0;
      const declaredLength = Number(response.headers['content-length'] ?? 0);
      if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
        response.destroy();
        reject(new SafeUrlFetchError('PAYLOAD_TOO_LARGE', `取得先の本文が${MAX_RESPONSE_BYTES}バイトを超えています。`));
        return;
      }
      response.on('data', (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += buffer.length;
        if (bytes > MAX_RESPONSE_BYTES) {
          response.destroy();
          reject(new SafeUrlFetchError('PAYLOAD_TOO_LARGE', `取得先の本文が${MAX_RESPONSE_BYTES}バイトを超えています。`));
          return;
        }
        chunks.push(buffer);
      });
      response.on('end', () => resolve({
        statusCode: response.statusCode ?? 0,
        headers: response.headers,
        body: Buffer.concat(chunks),
      }));
      response.on('error', reject);
    });
    const totalTimer = setTimeout(() => {
      request.destroy(new SafeUrlFetchError('FETCH_TIMEOUT', 'URL取得が全体制限時間を超えました。'));
    }, remaining);
    request.setTimeout(Math.min(CONNECT_TIMEOUT_MS, remaining), () => {
      request.destroy(new SafeUrlFetchError('FETCH_TIMEOUT', 'URLへの接続が10秒以内に完了しませんでした。'));
    });
    request.on('close', () => clearTimeout(totalTimer));
    request.on('error', (error) => {
      clearTimeout(totalTimer);
      reject(error instanceof SafeUrlFetchError
        ? error
        : new SafeUrlFetchError('FETCH_FAILED', 'URLから企業情報を取得できませんでした。', { cause: error }));
    });
    request.end();
  });
}

export function extractReadableContent(
  body: string,
  contentType: 'text/html' | 'text/plain',
  url: URL,
): { title: string; text: string } {
  if (contentType === 'text/plain') {
    const text = body.replace(/\r\n?/gu, '\n').trim();
    return { title: url.hostname, text };
  }
  const $ = cheerio.load(body);
  $('script,style,noscript,template,svg,canvas,iframe,nav,header,footer,aside,[role="navigation"],[aria-hidden="true"],.navigation,.advertisement,.ads,.cookie-banner').remove();
  const title = ($('title').first().text() || $('h1').first().text() || url.hostname).replace(/\s+/gu, ' ').trim();
  const text = ($('main').first().text() || $('article').first().text() || $('body').text())
    .replace(/[\t\f\v ]+/gu, ' ')
    .replace(/ *\n+ */gu, '\n')
    .trim();
  return { title, text };
}

export async function fetchCompanyUrl(value: string): Promise<SafeUrlResult> {
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  let url = parseSafeHttpUrl(value);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const addresses = await resolvePublicAddresses(url, deadline);
    const response = await requestOnce(url, addresses, deadline);
    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
      const location = response.headers.location;
      if (redirects === MAX_REDIRECTS || typeof location !== 'string') {
        throw new SafeUrlFetchError('FETCH_FAILED', 'URLのリダイレクト上限を超えました。');
      }
      url = parseSafeHttpUrl(new URL(location, url).toString());
      continue;
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new SafeUrlFetchError('FETCH_FAILED', `取得先がHTTP ${response.statusCode}を返しました。`);
    }
    const mediaType = String(response.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
    if (mediaType !== 'text/html' && mediaType !== 'text/plain') {
      throw new SafeUrlFetchError('UNSUPPORTED_MEDIA_TYPE', 'P1で取得できるのはHTMLまたはプレーンテキストだけです。');
    }
    const contentType = mediaType as SafeUrlResult['contentType'];
    const readable = extractReadableContent(response.body.toString('utf8'), contentType, url);
    if (!readable.text) {
      throw new SafeUrlFetchError('FETCH_FAILED', '取得先から解析可能な本文を抽出できませんでした。');
    }
    return { url: url.toString(), title: readable.title.slice(0, 300), text: readable.text, contentType };
  }
  throw new SafeUrlFetchError('FETCH_FAILED', 'URLを取得できませんでした。');
}
