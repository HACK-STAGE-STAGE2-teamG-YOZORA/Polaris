"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import SvgIcon from "@mui/material/SvgIcon";
import Typography from "@mui/material/Typography";

import { SessionReportContent } from "@/app/components/SessionReportContent";
import { toDisplayError } from "@/lib/api/error-messages";
import { findReportBySession, getSelfAnalysisReport } from "@/lib/api/self-analysis-reports";
import { ANALYSIS_CHAT_PATH } from "@/shared/routes";
import { CHAT_COLORS } from "@/shared/ui/chat-colors";
import type { SelfAnalysisReport } from "@/types/self-analysis-report";

interface SessionReportDialogProps {
  open: boolean;
  sessionId: string;
  onClose: () => void;
}

function CloseIcon() {
  return (
    <SvgIcon fontSize="small">
      <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </SvgIcon>
  );
}

// 経験カードから「このセッションの自己分析結果を見る」導線。
// Experience.sourceSessionId → GET /self-analysis-reports?sourceSessionId → GET /self-analysis-reports/{id}
// の順で辿る。まだfinalizeされていないセッションでは0件になるため、
// その場合はチャットへ戻って続きから進められるようにする
export function SessionReportDialog({ open, sessionId, onClose }: SessionReportDialogProps) {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<SelfAnalysisReport | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setReport(null);
    setNotFound(false);
    setErrorMessage(null);

    (async () => {
      try {
        const summary = await findReportBySession(sessionId);
        if (cancelled) return;
        if (!summary) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        const detail = await getSelfAnalysisReport(summary.id);
        if (!cancelled) setReport(detail);
      } catch (err) {
        if (!cancelled) setErrorMessage(toDisplayError(err, "自己分析結果を読み込めませんでした。").message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, sessionId]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" scroll="paper">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        このセッションの自己分析結果
        <IconButton onClick={onClose} size="small" aria-label="閉じる">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ bgcolor: CHAT_COLORS.navy }}>
        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={24} sx={{ color: CHAT_COLORS.orange }} />
          </Box>
        )}

        {!loading && errorMessage && (
          <Typography sx={{ color: "#FFD1D1" }}>{errorMessage}</Typography>
        )}

        {!loading && notFound && (
          <Stack spacing={1.5} sx={{ alignItems: "flex-start" }}>
            <Typography sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
              このセッションはまだ結果が確定していません。会話を続けて4軸分析を確定すると、ここに結果が表示されます。
            </Typography>
            <Button
              component={Link}
              href={`${ANALYSIS_CHAT_PATH}?resume=${sessionId}`}
              variant="contained"
              onClick={onClose}
              sx={{
                bgcolor: CHAT_COLORS.orange,
                color: CHAT_COLORS.bubbleText,
                fontWeight: 700,
                borderRadius: "999px",
                "&:hover": { bgcolor: CHAT_COLORS.orangeDark },
              }}
            >
              このセッションの続きから
            </Button>
          </Stack>
        )}

        {!loading && report && <SessionReportContent report={report} />}
      </DialogContent>
    </Dialog>
  );
}
