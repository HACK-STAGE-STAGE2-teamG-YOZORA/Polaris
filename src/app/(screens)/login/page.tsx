"use client";

import { Suspense, useCallback, useState } from "react";
import type { MouseEvent } from "react";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import SvgIcon from "@mui/material/SvgIcon";
import Typography from "@mui/material/Typography";

import { Constellation } from "@/app/components/Constellation";
import { CHAT_COLORS } from "@/shared/ui/chat-colors";

// GET /auth/google/start へは全画面遷移が必要（Googleの認証画面へリダイレクトされるため）
const GOOGLE_AUTH_START_PATH = "/api/v1/auth/google/start";

// コールバックが ?authError= に載せてくる安全なコードだけを画面文言に対応付ける
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  AUTH_FLOW_INVALID: "ログインの有効期限が切れました。もう一度お試しください。",
  GOOGLE_AUTH_FAILED: "Googleログインに失敗しました。時間をおいてもう一度お試しください。",
  AUTH_NOT_CONFIGURED: "Google認証が設定されていません。管理者に連絡してください。",
};

const GENERIC_AUTH_ERROR_MESSAGE = "ログインに失敗しました。もう一度お試しください。";

function GoogleIcon() {
  return (
    <SvgIcon viewBox="0 0 48 48" sx={{ fontSize: 30 }}>
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </SvgIcon>
  );
}

function LoginContent() {
  const authError = useSearchParams().get("authError");
  const [startError, setStartError] = useState<string | null>(null);
  const errorMessage =
    startError ?? (authError ? (AUTH_ERROR_MESSAGES[authError] ?? GENERIC_AUTH_ERROR_MESSAGE) : null);

  // 認証開始はGoogleへのリダイレクトなので基本は全画面遷移に任せる。
  // ただしサーバー側が設定不備などでエラーJSONを返すとその生データが画面に出てしまうため、
  // 先に一度だけ叩いてリダイレクト以外の応答ならこの画面にエラーを表示する
  const handleStart = useCallback(async (event: MouseEvent<HTMLAnchorElement>) => {
    // 別タブで開く操作は邪魔しない
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    setStartError(null);
    try {
      const response = await fetch(GOOGLE_AUTH_START_PATH, { redirect: "manual" });
      if (response.type !== "opaqueredirect" && !response.ok) {
        const body = (await response.json().catch(() => null)) as { code?: string } | null;
        setStartError(
          (body?.code ? AUTH_ERROR_MESSAGES[body.code] : undefined) ?? GENERIC_AUTH_ERROR_MESSAGE,
        );
        return;
      }
    } catch {
      setStartError("サーバーに接続できませんでした。ネットワーク状況を確認してください。");
      return;
    }
    window.location.assign(GOOGLE_AUTH_START_PATH);
  }, []);

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 560,
        mx: "auto",
        px: 3,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography
          component="h1"
          sx={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: { xs: 56, sm: 66 },
            fontWeight: 400,
            letterSpacing: "-0.03em",
            lineHeight: 1,
          }}
        >
          polaris
        </Typography>
        <Constellation size={104} />
      </Box>

      <Button
        component="a"
        href={GOOGLE_AUTH_START_PATH}
        onClick={handleStart}
        startIcon={<GoogleIcon />}
        disableElevation
        sx={{
          mt: 8,
          width: "100%",
          minHeight: 64,
          px: 3,
          borderRadius: 999,
          color: "#3C4043",
          bgcolor: "#FFFFFF",
          fontSize: 22,
          fontWeight: 400,
          textTransform: "none",
          "& .MuiButton-startIcon": { mr: 1.5 },
          "&:hover": { bgcolor: "#F1F1F1" },
        }}
      >
        google でログイン
      </Button>

      {errorMessage && (
        <Typography role="alert" sx={{ mt: 3, color: "#FFD1D1", textAlign: "center", lineHeight: 1.8 }}>
          {errorMessage}
        </Typography>
      )}
    </Box>
  );
}

// 未ログイン時の入口画面。認証はバックエンド（GET /auth/google/start）に任せ、
// この画面はリンクの提示とエラーコードの表示だけを担当する
export default function LoginPage() {
  return (
    <Box
      component="main"
      sx={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: CHAT_COLORS.textOnDark,
        background: `linear-gradient(180deg, ${CHAT_COLORS.gradientTop} 0%, #0A2036 42%, #2B6699 100%)`,
      }}
    >
      <Suspense fallback={null}>
        <LoginContent />
      </Suspense>
    </Box>
  );
}
