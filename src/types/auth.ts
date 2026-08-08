export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface AuthSessionResponse {
  authenticated: boolean;
  user: AuthUser | null;
  expiresAt: string | null;
}
