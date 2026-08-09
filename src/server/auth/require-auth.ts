import type { NextRequest } from 'next/server';
import { internalError, problem } from '@/server/api';
import { readSession } from './session';

export type RequiredAuth =
  | { userId: string }
  | { response: Response };

export async function requireAuth(request: Request): Promise<RequiredAuth> {
  try {
    const session = await readSession(request as NextRequest);
    if (!session) {
      return { response: problem(401, 'AUTH_REQUIRED', 'ログインが必要です。') };
    }
    return { userId: session.user.id };
  } catch (error) {
    return { response: internalError(error, '認証確認') };
  }
}
