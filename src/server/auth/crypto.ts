import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export function randomBase64Url(byteLength = 32): string {
  return randomBytes(byteLength).toString('base64url');
}

export function sha256Base64Url(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('base64url');
}

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBase64Url(64);
  return { verifier, challenge: sha256Base64Url(verifier) };
}

export function safeEqual(left: string | undefined, right: string | undefined): boolean {
  if (!left || !right) return false;
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
