"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import SvgIcon from "@mui/material/SvgIcon";
import Typography from "@mui/material/Typography";

import { useAuthUser } from "@/app/components/AuthGate";
import { useTutorial } from "@/app/components/tutorial/TutorialProvider";
import { YozoraPageShell } from "@/app/components/YozoraPageShell";
import { logout } from "@/lib/api/auth";
import { toDisplayError } from "@/lib/api/error-messages";
import { HOME_PATH, LOGIN_PATH } from "@/shared/routes";
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
  const tutorial = useTutorial();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRestartTutorial = () => {
    tutorial.restart();
    router.push(HOME_PATH);
  };

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
    <YozoraPageShell
      section="USER"
      title="アカウント"
      description="あなたの記録と、polarisを使うための設定を確認できます。"
    >
      <Stack spacing={2}>
          <Box
            sx={{
              position: "relative",
              overflow: "hidden",
              borderRadius: 3,
              border: `1px solid ${CHAT_COLORS.orange}`,
              bgcolor: CHAT_COLORS.navySurface,
              p: 2.5,
              "&::after": {
                content: '"✦"',
                position: "absolute",
                top: 10,
                right: 14,
                color: CHAT_COLORS.orange,
                fontSize: 18,
              },
            }}
          >
            <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
              <Avatar
                src={user?.avatarUrl ?? undefined}
                alt={user?.displayName ?? user?.email ?? "プロフィール"}
                slotProps={{ img: { referrerPolicy: "no-referrer" } }}
                sx={{
                  width: 72,
                  height: 72,
                  bgcolor: "#F5F5F5",
                  color: "#54708D",
                  border: `2px solid ${CHAT_COLORS.orange}`,
                }}
              >
                <ProfileIcon />
              </Avatar>
              <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                <Chip
                  size="small"
                  label="Googleでログイン中"
                  sx={{ alignSelf: "flex-start", bgcolor: CHAT_COLORS.orangeMuted, color: CHAT_COLORS.orange, fontSize: 11 }}
                />
                <Typography variant="h6" sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>
                  {user?.displayName ?? "名前未設定"}
                </Typography>
                <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDarkMuted, overflowWrap: "anywhere" }}>
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
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                はじめてガイド
              </Typography>
              <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
                Homeの使い方をもう一度、案内付きで確認できます。
              </Typography>
              <Button
                variant="outlined"
                onClick={handleRestartTutorial}
                sx={{ color: CHAT_COLORS.orange, borderColor: CHAT_COLORS.orange, borderRadius: "999px" }}
              >
                チュートリアルをもう一度見る
              </Button>
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
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                セッション
              </Typography>
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
    </YozoraPageShell>
  );
}
