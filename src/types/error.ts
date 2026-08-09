// docs/openapi.yaml の ErrorDetail に対応
export interface ErrorDetail {
  field?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

// docs/openapi.yaml ErrorResponse.code の enum と一致させる
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "AI_UNAVAILABLE"
  | "AI_TIMEOUT"
  | "AI_INVALID_OUTPUT"
  | "AI_INPUT_TOO_LARGE"
  | "UNSAFE_URL"
  | "FETCH_FAILED"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "AUTH_NOT_CONFIGURED"
  | "AUTH_REQUIRED"
  | "AUTH_FLOW_INVALID"
  | "GOOGLE_AUTH_FAILED"
  | "INTERNAL_ERROR";

// 全エンドポイント共通のエラーレスポンス形式（application/problem+json）
export interface ErrorResponse {
  requestId: string;
  code: ErrorCode;
  message: string;
  retryable: boolean;
  details: ErrorDetail[];
}
