'use client';

export type ProblemDetails = {
  requestId?: string;
  code?: string;
  message?: string;
  retryable?: boolean;
  details?: unknown[];
};

export class ApiProblem extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;
  readonly requestId?: string;

  constructor(status: number, problem: ProblemDetails) {
    super(problem.message || `HTTP ${status}`);
    this.name = 'ApiProblem';
    this.status = status;
    this.code = problem.code || 'UNKNOWN_ERROR';
    this.retryable = problem.retryable === true;
    this.requestId = problem.requestId;
  }
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; formData?: FormData; signal?: AbortSignal } = {},
): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? 'GET',
    headers: options.body === undefined ? undefined : { 'content-type': 'application/json' },
    body: options.formData ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
    signal: options.signal,
    cache: 'no-store',
  });
  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get('content-type') ?? '';
  const payload: unknown = contentType.includes('json') ? await response.json() : await response.text();
  if (!response.ok) {
    const problem = typeof payload === 'object' && payload !== null ? payload as ProblemDetails : { message: String(payload) };
    throw new ApiProblem(response.status, problem);
  }
  return payload as T;
}

export function friendlyError(error: unknown): string {
  if (!(error instanceof ApiProblem)) return '予期しないエラーが発生しました。もう一度お試しください。';
  if (error.code === 'AI_UNAVAILABLE') return 'LM Studioへ接続できません。起動とモデルのロードを確認してください。';
  if (error.code === 'AI_TIMEOUT') return 'AI処理がタイムアウトしました。入力は保持されています。もう一度お試しください。';
  if (error.code === 'AI_INVALID_OUTPUT') return 'AIの回答形式を確認できませんでした。入力は保持されています。再試行してください。';
  if (error.code === 'AI_INPUT_TOO_LARGE') return 'AIへ渡す情報量が多すぎます。関連する経験を指定するか、文章を短くしてください。';
  return error.message;
}
