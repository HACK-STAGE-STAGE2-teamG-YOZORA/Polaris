import { apiGet, apiPost } from "@/lib/api/client";
import type { AuthSessionResponse } from "@/types/auth";

export function getAuthSession(): Promise<AuthSessionResponse> {
  return apiGet<AuthSessionResponse>("/auth/session");
}

// POST /api/v1/auth/logout — アプリセッションCookieを失効させる。冪等(未ログインでも204)
export function logout(): Promise<void> {
  return apiPost<void>("/auth/logout");
}
