"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import SvgIcon from "@mui/material/SvgIcon";
import Typography from "@mui/material/Typography";

import { toDisplayError } from "@/lib/api/error-messages";
import { findReportBySession, getSelfAnalysisReport } from "@/lib/api/self-analysis-reports";
import { ANALYSIS_CHAT_PATH } from "@/shared/routes";
import {
  AXIS_LABELS,
  USER_ASSESSMENT_LABELS,
  formatAssessmentStatus,
  formatAxisPosition,
} from "@/shared/self-analysis/axis-labels";
import { CHAT_COLORS } from "@/shared/ui/chat-colors";
import type { CareerCondition, SelfAnalysisReport } from "@/types/self-analysis-report";

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

function ConditionGroup({ title, conditions }: { title: string; conditions: CareerCondition[] }) {
  if (conditions.length === 0) return null;
  return (
    <Stack spacing={0.75}>
      <Typography variant="subtitle2" sx={{ color: CHAT_COLORS.textOnDark, fontWeight: 700 }}>
        {title}
      </Typography>
      {conditions.map((condition) => (
        <Typography key={condition.statement} variant="body2" sx={{ color: "rgba(255,255,255,0.9)" }}>
          ・{condition.statement}
        </Typography>
      ))}
    </Stack>
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

        {!loading && report && (
          <Stack spacing={2.5}>
            {report.freshness === "STALE" && (
              <Typography variant="caption" sx={{ color: CHAT_COLORS.orange }}>
                ※このセッションの後に経験の修正などがあり、内容が最新でない可能性があります。
              </Typography>
            )}

            <Typography sx={{ color: "rgba(255,255,255,0.92)", lineHeight: 1.8 }}>{report.summary}</Typography>

            <Stack spacing={1.5}>
              {report.axes.map((axis) => (
                <Box
                  key={axis.axisAssessmentId}
                  sx={{ borderRadius: 2, border: `1px solid ${CHAT_COLORS.navyBorder}`, p: 1.5 }}
                >
                  <Stack spacing={0.5}>
                    <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
                      <Typography variant="subtitle2" sx={{ color: "#F6C95D", fontWeight: 700 }}>
                        {AXIS_LABELS[axis.axis].name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: CHAT_COLORS.textOnDark }}>
                        {formatAxisPosition(axis.position, axis.axis)}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.9)" }}>
                      {axis.displayStatement}
                    </Typography>
                    <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                      <Chip size="small" label={formatAssessmentStatus(axis.status)} sx={{ bgcolor: CHAT_COLORS.navySurface, color: CHAT_COLORS.textOnDark }} />
                      <Chip size="small" label={`本人評価: ${USER_ASSESSMENT_LABELS[axis.userAssessment]}`} sx={{ bgcolor: CHAT_COLORS.navySurface, color: CHAT_COLORS.textOnDark }} />
                    </Stack>
                  </Stack>
                </Box>
              ))}
            </Stack>

            <ConditionGroup title="重視したい条件" conditions={report.mustConditions} />
            <ConditionGroup title="できれば重視したい条件" conditions={report.preferConditions} />
            <ConditionGroup title="避けたい条件" conditions={report.avoidConditions} />
            <ConditionGroup title="今後確かめたいこと" conditions={report.verifyConditions} />

            {report.nextExperiments.length > 0 && (
              <Stack spacing={0.75}>
                <Typography variant="subtitle2" sx={{ color: CHAT_COLORS.textOnDark, fontWeight: 700 }}>
                  次に試すとよさそうなこと
                </Typography>
                {report.nextExperiments.map((experiment) => (
                  <Typography key={experiment} variant="body2" sx={{ color: "rgba(255,255,255,0.9)" }}>
                    ・{experiment}
                  </Typography>
                ))}
              </Stack>
            )}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}
