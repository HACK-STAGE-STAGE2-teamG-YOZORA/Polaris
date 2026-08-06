import { extractReadableContent, isBlockedIpAddress, parseSafeHttpUrl, SafeUrlFetchError } from '../src/infrastructure/fetch/safe-url-fetcher.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

for (const address of [
  '0.0.0.0',
  '10.0.0.1',
  '127.0.0.1',
  '169.254.169.254',
  '172.16.0.1',
  '192.168.1.1',
  '224.0.0.1',
  '::',
  '::1',
  'fc00::1',
  'fe80::1',
  'ff02::1',
  '::ffff:127.0.0.1',
  '::127.0.0.1',
]) {
  assert(isBlockedIpAddress(address), `禁止IPを許可しています: ${address}`);
}
for (const address of ['8.8.8.8', '1.1.1.1', '2001:4860:4860::8888']) {
  assert(!isBlockedIpAddress(address), `公開IPを拒否しています: ${address}`);
}

for (const unsafe of ['file:///etc/passwd', 'http://user:pass@example.com', 'http://localhost', 'http://127.0.0.1', 'http://[::1]']) {
  try {
    parseSafeHttpUrl(unsafe);
    throw new Error(`危険なURLを許可しています: ${unsafe}`);
  } catch (error) {
    assert(error instanceof SafeUrlFetchError && error.code === 'UNSAFE_URL', `危険URLのエラー形式が不正です: ${unsafe}`);
  }
}

const extracted = extractReadableContent(`<!doctype html><html><head><title> 採用情報 </title><style>.x{}</style></head><body>
  <nav>ナビゲーション</nav><main><h1>募集要項</h1><p>若手社員の改善提案を歓迎します。</p><script>ignore()</script></main>
</body></html>`, 'text/html', new URL('https://example.com/careers'));
assert(extracted.title === '採用情報', 'HTML titleを抽出できません。');
assert(extracted.text.includes('若手社員の改善提案を歓迎します。'), '本文を抽出できません。');
assert(!extracted.text.includes('ナビゲーション') && !extracted.text.includes('ignore'), '除外要素が本文へ混入しています。');

console.log('P1 URL安全性・HTML抽出テスト成功');
