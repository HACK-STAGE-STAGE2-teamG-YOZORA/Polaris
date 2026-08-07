// docs/openapi.yaml ErrorResponse (application/problem+json) をラップするエラー型。
// fetch自体が失敗した場合(ネットワークエラー等)と、APIが返す業務エラーとを区別するために使う
export interface ErrorDetail {
  field?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "AI_UNAVAILABLE"
  | "AI_TIMEOUT"
  | "AI_INVALID_OUTPUT"
  | "UNSAFE_URL"
  | "FETCH_FAILED"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "INTERNAL_ERROR";

export interface ErrorResponseBody {
  requestId: string;
  code: ErrorCode;
  message: string;
  retryable: boolean;
  details: ErrorDetail[];
}

export class ApiError extends Error {
  readonly status: number;
  readonly response: ErrorResponseBody;

  constructor(status: number, response: ErrorResponseBody) {
    super(response.message);
    this.name = "ApiError";
    this.status = status;
    this.response = response;
  }
}

// レスポンスがOKでない場合、application/problem+json のボディをApiErrorへ変換してthrowする。
// ボディがErrorResponseの形をしていない(想定外のエラー)場合はそのままthrowする
export async function throwIfError(res: Response): Promise<void> {
  if (res.ok) return;
  const body: unknown = await res.json().catch(() => null);
  if (body && typeof body === "object" && "code" in body && "message" in body) {
    throw new ApiError(res.status, body as ErrorResponseBody);
  }
  throw new Error(`APIリクエストに失敗しました (status: ${res.status})`);
}
