import { clearCache } from "@/lib/api/cache";
import type { ErrorResponse } from "@/types/error";

// APIがエラーを返したときに投げる例外。
// HTTPステータスとErrorResponse本体の両方を保持し、
// 呼び出し側で code ごとにハンドリングできるようにする
export class ApiError extends Error {
  readonly status: number;
  readonly response: ErrorResponse;

  constructor(status: number, response: ErrorResponse) {
    super(response.message);
    this.name = "ApiError";
    this.status = status;
    this.response = response;
  }
}

// レスポンスがOKでない場合、application/problem+json のボディをApiErrorへ変換してthrowする。
// ボディがErrorResponseの形をしていない(想定外のエラー)場合はそのままthrowする。
// client.ts の apiGet/apiPost を経由しない呼び出し(es-documents.ts が fetch を直接使う箇所)で使う
export async function throwIfError(res: Response): Promise<void> {
  if (res.ok) return;
  // セッションが切れた時点で、前のログイン中に取得したデータを残さない
  if (res.status === 401) clearCache();
  const body: unknown = await res.json().catch(() => null);
  if (body && typeof body === "object" && "code" in body && "message" in body) {
    throw new ApiError(res.status, body as ErrorResponse);
  }
  throw new Error(`APIリクエストに失敗しました (status: ${res.status})`);
}
