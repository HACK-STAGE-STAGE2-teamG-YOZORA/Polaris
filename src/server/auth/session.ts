import type { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { iso } from '@/server/api';
import { randomBase64Url, sha256Base64Url } from './crypto';
import {
  LAST_SEEN_UPDATE_INTERVAL_MS,
  SESSION_COOKIE_NAME,
  shouldTouchLastSeenAt,
  type AuthConfig,
} from './config';

export type AuthUserResponse = {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export async function upsertGoogleUser(identity: {
  subject: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
}): Promise<AuthUserResponse> {
  const user = await prisma.user.upsert({
    where: { googleSubject: identity.subject },
    create: {
      googleSubject: identity.subject,
      email: identity.email,
      emailVerified: true,
      displayName: identity.displayName,
      avatarUrl: identity.avatarUrl,
    },
    update: {
      email: identity.email,
      emailVerified: true,
      displayName: identity.displayName,
      avatarUrl: identity.avatarUrl,
      lastLoginAt: new Date(),
    },
  });
  return formatUser(user);
}

export async function createSession(userId: string, config: AuthConfig): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const token = randomBase64Url();
  const expiresAt = new Date(Date.now() + config.sessionTtlMs);
  await prisma.authSession.create({
    data: { userId, tokenHash: sha256Base64Url(token), expiresAt },
  });
  return { token, expiresAt };
}

export function setSessionCookie(
  response: NextResponse,
  config: AuthConfig,
  token: string,
  expiresAt: Date,
): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.secureCookies,
    path: '/',
    expires: expiresAt,
  });
}

export function clearSessionCookie(response: NextResponse, secure: boolean): void {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    expires: new Date(0),
  });
}

export async function readSession(request: NextRequest): Promise<{
  user: AuthUserResponse;
  expiresAt: string;
} | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const now = new Date();
  const session = await prisma.authSession.findUnique({
    where: { tokenHash: sha256Base64Url(token) },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt <= now) {
    await prisma.authSession.delete({ where: { id: session.id } });
    return null;
  }
  await touchLastSeenAt(session.id, session.lastSeenAt, now);
  return { user: formatUser(session.user), expiresAt: iso(session.expiresAt) };
}

// 一定間隔でだけlastSeenAtを更新し、DBへの書き込み回数を抑える
async function touchLastSeenAt(sessionId: string, lastSeenAt: Date, now: Date): Promise<void> {
  if (!shouldTouchLastSeenAt(lastSeenAt, now)) return;
  // 同時に届いた複数リクエストが揃って更新しないよう、where側にもlastSeenAtの条件を入れる。
  // 条件を満たす行がなければ0件更新になるだけで、updateと違い例外にならない
  await prisma.authSession.updateMany({
    where: {
      id: sessionId,
      lastSeenAt: { lte: new Date(now.getTime() - LAST_SEEN_UPDATE_INTERVAL_MS) },
    },
    data: { lastSeenAt: now },
  });
}

export async function deleteSession(request: NextRequest): Promise<void> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return;
  await prisma.authSession.deleteMany({ where: { tokenHash: sha256Base64Url(token) } });
}

function formatUser(user: {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
}): AuthUserResponse {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  };
}
