import { apiGet } from "@/lib/api/client";
import type { AuthSessionResponse } from "@/types/auth";

export function getAuthSession(): Promise<AuthSessionResponse> {
  return apiGet<AuthSessionResponse>("/auth/session");
}
