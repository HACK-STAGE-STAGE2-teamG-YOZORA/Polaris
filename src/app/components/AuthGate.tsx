"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";

import { BottomNav } from "@/app/components/BottomNav";
import { TutorialProvider } from "@/app/components/tutorial/TutorialProvider";
import { setCacheOwner } from "@/lib/api/cache";
import { apiGet } from "@/lib/api/client";
import { HOME_PATH, LOGIN_PATH, isPublicPath } from "@/shared/routes";
import { CHAT_COLORS } from "@/shared/ui/chat-colors";
import type { AuthSessionResponse, AuthUser } from "@/types/auth";

type AuthStatus = "loading" | "authenticated" | "anonymous";

// ログイン中のユーザー。AuthGateが取得済みのものを配るだけなので、
// 各画面から改めて GET /auth/session を呼ぶ必要はない
const AuthUserContext = createContext<AuthUser | null>(null);

// AuthGateの内側でだけ使う。子はログイン済みのときしか描画されないため、常にユーザーが入る
export function useAuthUser(): AuthUser | null {
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
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    void apiGet<AuthSessionResponse>("/auth/session")
      .then((session) => {
        if (cancelled) return;
        // タブ間キャッシュの持ち主を確定させる。別ユーザーならここで前のデータが消える。
        // 子（各画面）はこのあとに描画されるため、キャッシュの取り違えは起きない
        setCacheOwner(session.authenticated ? (session.user?.id ?? null) : null);
        setUser(session.user);
        setStatus(session.authenticated ? "authenticated" : "anonymous");
      })
      .catch(() => {
        // セッション確認自体に失敗した場合も、個人データを見せずログイン画面へ送る
        if (!cancelled) {
          setCacheOwner(null);
          setStatus("anonymous");
        }
      });

    return () => { cancelled = true; };
  }, []);

  const onLoginPage = pathname === LOGIN_PATH;
  // ログイン画面と起動確認画面は未ログインのまま開ける（docs/screen-api-map.md）
  const onPublicPage = isPublicPath(pathname);

  useEffect(() => {
    if (status === "anonymous" && !onPublicPage) {
      router.replace(LOGIN_PATH);
    }
    if (status === "authenticated" && onLoginPage) {
      router.replace(HOME_PATH);
    }
  }, [status, onPublicPage, onLoginPage, router]);

  // 認証必須の画面だけ、確認中とリダイレクト待ちの間は中身を描画しない。
  // 起動確認はDB・LM Studioが落ちている状況を見るための画面なので、
  // GET /auth/session の応答を待たずに描画する
  if (!onPublicPage && (status === "loading" || status === "anonymous")) return <LoadingScreen />;
  if (status === "authenticated" && onLoginPage) return <LoadingScreen />;

  return (
    <AuthUserContext.Provider value={user}>
      <TutorialProvider userId={status === "authenticated" ? (user?.id ?? null) : null}>
        {children}
        {status === "authenticated" && <BottomNav />}
      </TutorialProvider>
    </AuthUserContext.Provider>
  );
}
