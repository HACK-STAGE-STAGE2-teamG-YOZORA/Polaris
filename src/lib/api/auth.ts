import { clearCache } from "@/lib/api/cache";
import { apiGet, apiPost } from "@/lib/api/client";
import type { AuthSessionResponse } from "@/types/auth";

// ログイン状態は毎回サーバーへ確認する（キャッシュ対象にしない）
export function getAuthSession(): Promise<AuthSessionResponse> {
  return apiGet<AuthSessionResponse>("/auth/session");
}

// POST /api/v1/auth/logout — アプリセッションCookieを失効させる。冪等(未ログインでも204)
export async function logout(): Promise<void> {
  await apiPost<void>("/auth/logout");
  // 次にログインしたユーザーへ前のユーザーのデータを見せないよう、取得済みデータを捨てる
  clearCache();
}
