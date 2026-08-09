"use client";

import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { ANALYSIS_CHAT_PATH } from "@/shared/routes";
import { CHAT_COLORS } from "@/shared/ui/chat-colors";
import type { AnalysisSessionResponse } from "@/types/dashboard";

interface HomeSessionEntryProps {
  // GET /dashboard が返す「直近1件」の目安。件数の厳密表示や一覧はChat画面側の責務にする
  activeSession: AnalysisSessionResponse | null;
  // 総合プロフィールが1件もない＝自己分析未実施
  hasProfile: boolean;
}

// ホームの自己分析導線。ユーザーは複数のセッションを同時に進行できるため、
// ホームでは「進行中がある/ない」の大まかな案内だけにとどめ、
// 一覧から選ぶ操作はチャット画面（StartModeChoice）に任せる
export function HomeSessionEntry({ activeSession, hasProfile }: HomeSessionEntryProps) {
  return (
    <Box
      sx={{
        mt: 3,
        borderRadius: 3,
        border: `1px solid ${CHAT_COLORS.navyBorder}`,
        bgcolor: CHAT_COLORS.navySurface,
        p: 2,
      }}
    >
      <Stack spacing={1.5}>
        {activeSession ? (
          <>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              進行中の自己分析があります
            </Typography>
            <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
              直近の更新: 「{activeSession.title}」
            </Typography>
          </>
        ) : (
          <>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {hasProfile ? "新しく自己分析を始める" : "まずは自己分析を始めましょう"}
            </Typography>
            <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
              AIと会話しながら経験を整理すると、4軸の傾向と根拠が作られます。
            </Typography>
          </>
        )}

        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
          <Button
            component={Link}
            href={ANALYSIS_CHAT_PATH}
            variant="contained"
            sx={{
              bgcolor: CHAT_COLORS.orange,
              color: CHAT_COLORS.bubbleText,
              fontWeight: 700,
              borderRadius: "999px",
              "&:hover": { bgcolor: CHAT_COLORS.orangeDark },
            }}
          >
            {activeSession ? "続きから一覧を見る" : "自己分析を始める"}
          </Button>
          {/* 「初めから」は他の進行中セッションを破棄しない。新規セッションを追加で作るだけ */}
          {activeSession && (
            <Button
              component={Link}
              href={`${ANALYSIS_CHAT_PATH}?start=new`}
              variant="outlined"
              sx={{ color: CHAT_COLORS.textOnDark, borderColor: CHAT_COLORS.navyBorder, borderRadius: "999px" }}
            >
              初めから
            </Button>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}
