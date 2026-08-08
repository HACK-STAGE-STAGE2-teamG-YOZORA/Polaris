const DEFAULT_LM_STUDIO_BASE_URL = 'http://127.0.0.1:1234';

export function normalizeLocalLmStudioBaseUrl(rawValue: string | undefined): string {
  const value = rawValue?.trim() || DEFAULT_LM_STUDIO_BASE_URL;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('LM_STUDIO_BASE_URLにはローカルのHTTP URLを設定してください。');
  }
  if (
    url.protocol !== 'http:'
    || url.hostname !== '127.0.0.1'
    || url.username !== ''
    || url.password !== ''
    || (url.pathname !== '/' && url.pathname !== '')
    || url.search !== ''
    || url.hash !== ''
  ) {
    throw new Error('LM_STUDIO_BASE_URLはhttp://127.0.0.1:<port>だけ使用できます。');
  }
  return url.origin;
}
