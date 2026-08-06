import { PolarisAiError } from '@/infrastructure/ai/lm-studio-ai-gateway';

export const SELF_ANALYSIS_AXES = [
  'ENERGY_SOURCE',
  'ACTION_STYLE',
  'SATISFACTION_SOURCE',
  'PREFERRED_ENVIRONMENT',
] as const;

export const EXPERIENCE_TYPES = [
  'ENGAGED',
  'ACHIEVEMENT',
  'CHALLENGE',
  'DRAINING_SUCCESS',
  'TEAM_CONFLICT',
  'OTHER',
] as const;

export function problem(
  status: number,
  code: string,
  message: string,
  options: { retryable?: boolean; details?: unknown[] } = {},
): Response {
  return Response.json(
    {
      code,
      message,
      retryable: options.retryable ?? false,
      ...(options.details ? { details: options.details } : {}),
    },
    { status, headers: { 'content-type': 'application/problem+json' } },
  );
}

export function internalError(error: unknown, operation: string): Response {
  console.error(`${operation}:`, error);
  return problem(500, 'INTERNAL_ERROR', `${operation}中にエラーが発生しました。`);
}

export function aiError(error: unknown): Response {
  if (error instanceof PolarisAiError) {
    if (error.code === 'AI_UNAVAILABLE') {
      return problem(503, 'AI_UNAVAILABLE', error.message, { retryable: true });
    }
    if (error.code === 'AI_INVALID_OUTPUT') {
      return problem(502, 'AI_INVALID_OUTPUT', error.message, { retryable: true });
    }
    return problem(503, 'AI_UNAVAILABLE', error.message, { retryable: true });
  }
  return internalError(error, 'AI処理');
}

export function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function nullableIso(value: Date | string | null | undefined): string | null {
  return value ? iso(value) : null;
}

export function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function objectArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    : [];
}

export function readPagination(request: Request): { cursor?: string; limit: number } {
  const url = new URL(request.url);
  const cursor = url.searchParams.get('cursor') ?? undefined;
  const rawLimit = Number(url.searchParams.get('limit') ?? 20);
  const limit = Number.isInteger(rawLimit) ? Math.min(100, Math.max(1, rawLimit)) : 20;
  return { cursor, limit };
}

export function page<T extends { id: string }>(items: T[], limit: number): { items: T[]; nextCursor?: string } {
  if (items.length <= limit) return { items };
  const visible = items.slice(0, limit);
  return { items: visible, nextCursor: visible.at(-1)?.id };
}

export function countCodePoints(value: string): number {
  return [...value.replace(/\r\n?/g, '\n')].length;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function jsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    return isPlainObject(value) ? value : null;
  } catch {
    return null;
  }
}
