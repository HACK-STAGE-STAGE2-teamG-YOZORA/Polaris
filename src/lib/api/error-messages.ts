// 画面共通のエラー文言変換。docs/screen-api-map.md「5. 主要ローディング・失敗UI」に対応する。
// 入力保持や再試行導線など画面固有の案内が必要なチャット画面は、独自の変換を持つ。
import { ApiError } from "@/lib/api/errors";
import type { ErrorCode } from "@/types/error";

export interface DisplayError {
  code: ErrorCode;
  message: string;
}

export function toDisplayError(err: unknown, fallback = "処理に失敗しました。"): DisplayError {
  if (!(err instanceof ApiError)) {
    return {
      code: "INTERNAL_ERROR",
      message: "通信に失敗しました。ネットワーク状況を確認してください。",
    };
  }

  const code = err.response.code;
  switch (code) {
    case "AI_UNAVAILABLE":
      return { code, message: "LM Studioが起動していません。起動確認から状態を確認してください。" };
    case "AI_TIMEOUT":
      return { code, message: "AIの応答が時間内に返りませんでした。もう一度お試しください。" };
    case "AI_INVALID_OUTPUT":
      return { code, message: "AIの出力を正しく解釈できませんでした。もう一度お試しください。" };
    case "NOT_FOUND":
      return { code, message: "対象が見つかりませんでした。画面を再読み込みしてください。" };
    default:
      // CONFLICT/VALIDATION_ERRORはサーバーが理由を日本語で返すため、その文言を優先する
      return { code, message: err.response.message || fallback };
  }
}
