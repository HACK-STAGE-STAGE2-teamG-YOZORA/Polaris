export function safeErrorDiagnostic(error: unknown): { name: string; code?: string } {
  if (!(error instanceof Error)) return { name: 'UnknownError' };
  const rawCode = (error as Error & { code?: unknown }).code;
  const code = typeof rawCode === 'string' && /^[A-Z0-9_]{1,64}$/u.test(rawCode) ? rawCode : undefined;
  return { name: error.name || 'Error', ...(code ? { code } : {}) };
}

export function logSafeError(operation: string, error: unknown): void {
  console.error(`${operation} failed`, safeErrorDiagnostic(error));
}
