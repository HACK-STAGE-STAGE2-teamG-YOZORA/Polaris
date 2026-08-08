"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";

import { BottomNav } from "@/app/components/BottomNav";
import { apiGet } from "@/lib/api/client";
import { HOME_PATH, LOGIN_PATH } from "@/shared/routes";
import { CHAT_COLORS } from "@/shared/ui/chat-colors";
import type { AuthSessionResponse, AuthUserResponse } from "@/types/auth";

type AuthStatus = "loading" | "authenticated" | "anonymous";

// ログイン中のユーザー。AuthGateが取得済みのものを配るだけなので、
// 各画面から改めて GET /auth/session を呼ぶ必要はない
const AuthUserContext = createContext<AuthUserResponse | null>(null);

// AuthGateの内側でだけ使う。子はログイン済みのときしか描画されないため、常にユーザーが入る
export function useAuthUser(): AuthUserResponse | null {
  return useContext(AuthUserContext);
}

function LoadingScreen() {
  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        color: CHAT_COLORS.textOnDark,
        background: `linear-gradient(180deg, ${CHAT_COLORS.gradientTop} 0%, #0A2036 42%, #2B6699 100%)`,
      }}
    >
      <CircularProgress color="inherit" size={28} aria-label="読み込み中" />
    </Box>
  );
}

// docs/screen-api-map.md のとおり、GET /auth/session が未認証を返した場合は
// 個人データの画面を描画せずログイン画面へ送る。
// 認証状態はマウント時に一度だけ確認する（ログイン成功時はコールバックからの
// フルリロードで入り直すため、画面遷移ごとの再確認は不要）
export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUserResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    void apiGet<AuthSessionResponse>("/auth/session")
      .then((session) => {
        if (cancelled) return;
        setUser(session.user);
        setStatus(session.authenticated ? "authenticated" : "anonymous");
      })
      .catch(() => {
        // セッション確認自体に失敗した場合も、個人データを見せずログイン画面へ送る
        if (!cancelled) setStatus("anonymous");
      });

    return () => { cancelled = true; };
  }, []);

  const onLoginPage = pathname === LOGIN_PATH;

  useEffect(() => {
    if (status === "anonymous" && !onLoginPage) {
      router.replace(LOGIN_PATH);
    }
    if (status === "authenticated" && onLoginPage) {
      router.replace(HOME_PATH);
    }
  }, [status, onLoginPage, router]);

  // 確認中と、リダイレクト待ちの間は中身を描画しない
  if (status === "loading") return <LoadingScreen />;
  if (status === "anonymous" && !onLoginPage) return <LoadingScreen />;
  if (status === "authenticated" && onLoginPage) return <LoadingScreen />;

  return (
    <AuthUserContext.Provider value={user}>
      {children}
      {status === "authenticated" && <BottomNav />}
    </AuthUserContext.Provider>
  );
}
