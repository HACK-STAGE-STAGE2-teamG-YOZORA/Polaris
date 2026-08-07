import { normalizeLocalLmStudioBaseUrl } from '../src/infrastructure/ai/local-endpoint.ts';
import { safeErrorDiagnostic } from '../src/server/safe-log.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function expectRejected(value: string): void {
  try {
    normalizeLocalLmStudioBaseUrl(value);
  } catch {
    return;
  }
  throw new Error(`非ローカルURLを拒否できませんでした: ${value}`);
}

assert(normalizeLocalLmStudioBaseUrl(undefined) === 'http://127.0.0.1:1234', '既定URLが不正です。');
assert(normalizeLocalLmStudioBaseUrl('http://127.0.0.1:1234/') === 'http://127.0.0.1:1234', '末尾スラッシュを正規化できません。');
expectRejected('http://localhost:1234');
expectRejected('http://0.0.0.0:1234');
expectRejected('http://192.168.1.10:1234');
expectRejected('https://127.0.0.1:1234');
expectRejected('http://127.0.0.1:1234/v1');
expectRejected('http://user:password@127.0.0.1:1234');
expectRejected('http://127.0.0.1:1234?target=remote');

const sensitive = new Error('ES本文を含む秘密のエラー');
const diagnostic = safeErrorDiagnostic(sensitive);
assert(diagnostic.name === 'Error', '安全なエラー種別を取得できません。');
assert(!JSON.stringify(diagnostic).includes('秘密'), 'ログ診断へ例外本文が混入しました。');
const coded = Object.assign(new Error('秘密'), { code: 'AI_TIMEOUT' });
assert(safeErrorDiagnostic(coded).code === 'AI_TIMEOUT', '安全なエラーコードが失われました。');

console.log('LM Studio loopback enforcement: OK');
