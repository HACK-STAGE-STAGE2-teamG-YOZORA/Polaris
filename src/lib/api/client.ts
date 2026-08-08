import { ApiError } from "@/lib/api/errors";
import { LOGIN_PATH } from "@/shared/routes";
import type { ErrorResponse } from "@/types/error";

// docs/implementation-rules.md: APIベースパスは /api/v1
const API_BASE_PATH = "/api/v1";

// エラーレスポンスのJSONをパースする。パース自体に失敗した場合（HTMLエラーページが
// 返ってきた場合など）も、UI側が必ずErrorResponse形式で扱えるようフォールバック値を返す
async function parseErrorResponse(response: Response): Promise<ErrorResponse> {
  const body = (await response.json().catch(() => null)) as ErrorResponse | null;
  if (body) {
    return body;
  }
  return {
    requestId: "",
    code: "INTERNAL_ERROR",
    message: `リクエストに失敗しました (status ${response.status})`,
    retryable: false,
    details: [],
  };
}

// fetchの共通ラッパー。成功時はレスポンスJSONを返し、
// 失敗時（非2xx、またはfetch自体が例外を投げるネットワーク断）は必ずApiErrorを投げる
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_PATH}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  } catch {
    // サーバーに到達できない（LM Studio/開発サーバー未起動など）場合もAI_UNAVAILABLE相当として扱う
    throw new ApiError(0, {
      requestId: "",
      code: "AI_UNAVAILABLE",
      message: "サーバーに接続できませんでした。ネットワーク状況を確認してください。",
      retryable: true,
      details: [],
    });
  }

  if (!response.ok) {
    // セッション切れ（401）はどの画面から呼んでもログイン画面へ戻す。
    // 呼び出し側のcatchも動くよう、リダイレクトを開始したうえで例外は投げる
    if (response.status === 401 && typeof window !== "undefined" && window.location.pathname !== LOGIN_PATH) {
      window.location.assign(LOGIN_PATH);
    }
    throw new ApiError(response.status, await parseErrorResponse(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: "GET" });
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
