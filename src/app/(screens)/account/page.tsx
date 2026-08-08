"use client";

import { useState } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import SvgIcon from "@mui/material/SvgIcon";
import Typography from "@mui/material/Typography";

import { useAuthUser } from "@/app/components/AuthGate";
import { logout } from "@/lib/api/auth";
import { toDisplayError } from "@/lib/api/error-messages";
import { LOGIN_PATH } from "@/shared/routes";
import { CHAT_COLORS } from "@/shared/ui/chat-colors";

function ProfileIcon() {
  return (
    <SvgIcon sx={{ fontSize: 42 }} viewBox="0 0 24 24">
      <path d="M12 12a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5Zm0 2.1c-4.25 0-7.7 2.34-7.7 5.22V21h15.4v-1.68c0-2.88-3.45-5.22-7.7-5.22Z" />
    </SvgIcon>
  );
}

// アカウント画面。ユーザー情報の確認とログアウトだけを扱う。
// docs/product-scope.md P1「Googleログイン／新規登録／ログアウト」のうち、
// ログアウトへの導線がこれまで画面上に存在しなかった穴を埋める
export default function AccountPage() {
  const user = useAuthUser();
  const [loggingOut, setLoggingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogout = async () => {
    setLoggingOut(true);
    setErrorMessage(null);
    try {
      await logout();
      // ログアウト後はAuthGateが未認証を検知できるよう、フルリロードでログイン画面へ入り直す
      window.location.assign(LOGIN_PATH);
    } catch (err) {
      setLoggingOut(false);
      setErrorMessage(toDisplayError(err, "ログアウトに失敗しました。").message);
    }
  };

  return (
    <Box
      component="main"
      sx={{
        minHeight: "100dvh",
        pb: "72px",
        color: CHAT_COLORS.textOnDark,
        background: `linear-gradient(180deg, ${CHAT_COLORS.gradientTop} 0%, ${CHAT_COLORS.gradientMid} 46%, ${CHAT_COLORS.gradientBottom} 100%)`,
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 560, mx: "auto", px: 2, pt: 3 }}>
        <Typography component="h1" sx={{ fontSize: 28, fontWeight: 400, letterSpacing: "0.08em", mb: 3 }}>
          アカウント
        </Typography>

        <Stack spacing={2}>
          <Box
            sx={{
              borderRadius: 3,
              border: `1px solid ${CHAT_COLORS.navyBorder}`,
              bgcolor: CHAT_COLORS.navySurface,
              p: 2.5,
            }}
          >
            <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
              <Avatar
                src={user?.avatarUrl ?? undefined}
                alt={user?.displayName ?? user?.email ?? "プロフィール"}
                slotProps={{ img: { referrerPolicy: "no-referrer" } }}
                sx={{ width: 64, height: 64, bgcolor: "#F5F5F5", color: "#54708D" }}
              >
                <ProfileIcon />
              </Avatar>
              <Stack spacing={0.25}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {user?.displayName ?? "名前未設定"}
                </Typography>
                <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
                  {user?.email}
                </Typography>
              </Stack>
            </Stack>
          </Box>

          <Box
            sx={{
              borderRadius: 3,
              border: `1px solid ${CHAT_COLORS.navyBorder}`,
              bgcolor: CHAT_COLORS.navySurface,
              p: 2.5,
            }}
          >
            <Stack spacing={1.5} sx={{ alignItems: "flex-start" }}>
              <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
                ログアウトすると、次回はGoogleアカウントで再度ログインが必要になります。
              </Typography>
              {errorMessage && (
                <Typography variant="body2" sx={{ color: "#FFD1D1" }}>
                  {errorMessage}
                </Typography>
              )}
              <Button
                variant="outlined"
                color="error"
                onClick={() => void handleLogout()}
                disabled={loggingOut}
                startIcon={loggingOut ? <CircularProgress size={16} color="inherit" /> : undefined}
                sx={{ borderRadius: "999px" }}
              >
                ログアウト
              </Button>
            </Stack>
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}
