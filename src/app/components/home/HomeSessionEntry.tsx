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
  activeSession: AnalysisSessionResponse | null;
  // 総合プロフィールが1件もない＝自己分析未実施
  hasProfile: boolean;
}

// ホームの自己分析導線。docs/screen-api-map.md「2. ホーム表示状態」に対応し、
// 進行中セッションがあれば「続きから」「初めから」、なければ開始ボタンを出す。
// どちらの選択もチャット画面側（StartModeChoice）で確定するため、ここでは遷移だけ行う
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
              「{activeSession.title}」/ 発言 {activeSession.progress.userMessageCount}件 / 確認済み経験{" "}
              {activeSession.progress.confirmedExperienceCount}件
            </Typography>
            <Typography variant="caption" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
              「初めから」を選んでも、確認済みの経験・完了した結果・保存済みESは消えません。
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
            href={activeSession ? `${ANALYSIS_CHAT_PATH}?start=resume` : ANALYSIS_CHAT_PATH}
            variant="contained"
            sx={{
              bgcolor: CHAT_COLORS.orange,
              color: CHAT_COLORS.bubbleText,
              fontWeight: 700,
              borderRadius: "999px",
              "&:hover": { bgcolor: CHAT_COLORS.orangeDark },
            }}
          >
            {activeSession ? "続きから" : "自己分析を始める"}
          </Button>
          {/* 「初めから」は進行中セッションをABANDONEDにするが、確定操作はチャット画面のフォーム送信時 */}
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
