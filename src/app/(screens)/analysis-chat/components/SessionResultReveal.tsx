"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { SessionReportContent } from "@/app/components/SessionReportContent";
import { toDisplayError } from "@/lib/api/error-messages";
import { findReportBySession, getSelfAnalysisReport } from "@/lib/api/self-analysis-reports";
import { HOME_PATH } from "@/shared/routes";
import { CHAT_COLORS } from "@/shared/ui/chat-colors";
import type { SelfAnalysisReport } from "@/types/self-analysis-report";

// セッション確定(finalize)直後・完了済みセッションを開いたときに表示する、
// そのセッションの結果を大きく見せるカード。Homeの総合傾向と同じ見た目の軸バーを使い、
// 下端はページ背景色へフェードさせて「結果に注目が集まる」演出にする
interface SessionResultRevealProps {
  sessionId: string;
  // 「続きから会話を再開する」が押されたときの通知。再開すると4軸分析とレポートは
  // 古い状態になり、再確定するまでは新しい結果が確定しない
  onContinue: () => void;
}

export function SessionResultReveal({ sessionId, onContinue }: SessionResultRevealProps) {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<SelfAnalysisReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const summary = await findReportBySession(sessionId);
        if (cancelled) return;
        if (!summary) {
          setErrorMessage("結果がまだ見つかりませんでした。時間をおいて再読み込みしてください。");
          setLoading(false);
          return;
        }
        const detail = await getSelfAnalysisReport(summary.id);
        if (!cancelled) setReport(detail);
      } catch (err) {
        if (!cancelled) setErrorMessage(toDisplayError(err, "結果を読み込めませんでした。").message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <Box sx={{ position: "relative" }}>
      <Box
        sx={{
          borderRadius: 4,
          border: `1px solid ${CHAT_COLORS.orange}`,
          bgcolor: CHAT_COLORS.navy,
          boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
          p: { xs: 2.5, sm: 3.5 },
          pb: 6,
        }}
      >
        <Stack spacing={2.5}>
          <Typography
            component="h2"
            sx={{ textAlign: "center", fontSize: 24, fontWeight: 400, letterSpacing: "0.08em", color: CHAT_COLORS.textOnDark }}
          >
            このセッションの自己分析結果
          </Typography>

          {loading && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={28} sx={{ color: CHAT_COLORS.orange }} />
            </Box>
          )}

          {!loading && errorMessage && (
            <Typography sx={{ color: "#FFD1D1", textAlign: "center" }}>{errorMessage}</Typography>
          )}

          {!loading && report && <SessionReportContent report={report} />}

          <Stack direction="row" spacing={1.5} sx={{ justifyContent: "center", flexWrap: "wrap" }}>
            <Button
              component={Link}
              href={HOME_PATH}
              variant="contained"
              size="large"
              sx={{
                bgcolor: CHAT_COLORS.orange,
                color: CHAT_COLORS.bubbleText,
                fontWeight: 700,
                borderRadius: "999px",
                px: 4,
                "&:hover": { bgcolor: CHAT_COLORS.orangeDark },
              }}
            >
              ホームへ戻る
            </Button>
            <Button
              onClick={onContinue}
              variant="outlined"
              size="large"
              sx={{ color: CHAT_COLORS.textOnDark, borderColor: CHAT_COLORS.navyBorder, borderRadius: "999px", px: 4 }}
            >
              続きから会話を再開する
            </Button>
          </Stack>
          <Typography variant="caption" sx={{ color: CHAT_COLORS.textOnDarkMuted, textAlign: "center" }}>
            会話を再開すると、この結果は再確定するまで古い状態として扱われます。
          </Typography>
        </Stack>
      </Box>

      {/* カード下端をページ背景へなじませ、結果カードへ視線が集まるようにする */}
      <Box
        sx={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 64,
          borderRadius: "0 0 16px 16px",
          background: `linear-gradient(to bottom, rgba(0,0,0,0) 0%, ${CHAT_COLORS.gradientBottom} 90%)`,
          pointerEvents: "none",
        }}
      />
    </Box>
  );
}
