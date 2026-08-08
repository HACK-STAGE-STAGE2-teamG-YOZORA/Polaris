// docs/openapi.yaml の AuthUser に対応
export interface AuthUserResponse {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
}

// docs/openapi.yaml の AuthSessionResponse に対応（GET /auth/session）
export interface AuthSessionResponse {
  authenticated: boolean;
  user: AuthUserResponse | null;
  expiresAt: string | null;
}
