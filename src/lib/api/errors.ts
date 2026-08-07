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
