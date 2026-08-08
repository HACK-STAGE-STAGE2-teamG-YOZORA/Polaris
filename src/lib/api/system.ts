// docs/openapi.yaml の /api/v1/system 系エンドポイントに対応するAPIクライアント。
// この2つは security: [] （認証不要）で、起動確認画面から未ログインでも呼べる。
import { apiGet } from "@/lib/api/client";
import type { HealthResponse, LmStudioStatus } from "@/types/system";

// GET /api/v1/system/health — DBとAIの稼働状態。依存先が停止していても200で返る
export function getHealth(): Promise<HealthResponse> {
  return apiGet<HealthResponse>("/system/health");
}

// GET /api/v1/system/lm-studio — LM Studioとの接続状態と復旧手順
export function getLmStudioStatus(): Promise<LmStudioStatus> {
  return apiGet<LmStudioStatus>("/system/lm-studio");
}
