"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { EsComments } from "./components/EsComments";
import { EsErrorBanner } from "./components/EsErrorBanner";
import { EsInputForm } from "./components/EsInputForm";
import { EsRevisionResult } from "./components/EsRevisionResult";
import { useEsRevision } from "./use-es-revision";
import { YozoraPageShell } from "@/app/components/YozoraPageShell";
import { CHAT_COLORS } from "@/shared/ui/chat-colors";

const REVIEW_STEPS = ["ES入力", "根拠を検査", "完成版"] as const;

// このファイルは状態とAPI呼び出しを持つuseEsRevisionフックと、
// 見た目だけを担うcomponents/配下を繋ぐだけの薄い層にする。
// デザイン確定後はcomponents/配下の中身だけ差し替えれば済むようにする。
//
// 画面はstepに応じて3つを一方向に遷移する: INPUT → RESULT → COMMENTS
export default function EsRevisionPage() {
  const {
    step,
    accessStatus,
    companies,
    experiences,
    esDocument,
    originalAnalysis,
    esRevision,
    verifyAnalysis,
    submitting,
    verifying,
    reviewingChangeId,
    progressLabel,
    error,
    startAnalysis,
    requestRevision,
    requestComments,
    reviewChange,
    reloadContext,
  } = useEsRevision();
  const activeStep = step === "INPUT" ? 0 : step === "ANALYSIS" ? 1 : 2;

  return (
    <YozoraPageShell
      section="REVIEW"
      title="ES推敲"
      description="確認済みの経験と照らし合わせながら、あなたらしさが伝わる文章へ磨きます。"
    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }} aria-label="ES推敲の進行状況">
          {REVIEW_STEPS.map((label, index) => (
            <Chip
              key={label}
              size="small"
              label={`${String(index + 1).padStart(2, "0")} ${label}`}
              sx={
                index === activeStep
                  ? { bgcolor: CHAT_COLORS.orange, color: CHAT_COLORS.bubbleText, fontWeight: 700 }
                  : index < activeStep
                    ? { color: CHAT_COLORS.orange, border: `1px solid ${CHAT_COLORS.orange}`, bgcolor: CHAT_COLORS.orangeMuted }
                    : { color: CHAT_COLORS.textOnDarkMuted, border: `1px solid ${CHAT_COLORS.navyBorder}`, bgcolor: "transparent" }
              }
            />
          ))}
        </Stack>

          {error && <EsErrorBanner error={error} />}

          {(accessStatus === "CHECKING" || accessStatus === "LOADING_CONTEXT") && (
            <Stack spacing={1.5} sx={{ alignItems: "center", py: 6 }}>
              <CircularProgress sx={{ color: CHAT_COLORS.orange }} />
              <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
                {accessStatus === "CHECKING" ? "ログイン状態を確認しています…" : "企業と経験を読み込んでいます…"}
              </Typography>
            </Stack>
          )}

          {accessStatus === "UNAUTHENTICATED" && (
            <Box sx={{ borderRadius: 3, bgcolor: CHAT_COLORS.navySurface, p: 3, textAlign: "center" }}>
              <Stack spacing={2}>
                <Typography variant="h6" sx={{ color: CHAT_COLORS.textOnDark, fontWeight: 700 }}>
                  ES推敲にはログインが必要です
                </Typography>
                <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
                  個人の経験・企業情報・ESを安全に分離するため、Googleでログインしてください。
                </Typography>
                <Button
                  component="a"
                  href="/api/v1/auth/google/start"
                  variant="contained"
                  sx={{ bgcolor: CHAT_COLORS.orange, color: CHAT_COLORS.bubbleText, fontWeight: 700 }}
                >
                  Googleでログイン
                </Button>
              </Stack>
            </Box>
          )}

          {accessStatus === "ERROR" && (
            <Button
              variant="outlined"
              onClick={() => void reloadContext()}
              sx={{ alignSelf: "flex-start", color: CHAT_COLORS.orange, borderColor: CHAT_COLORS.orange, borderRadius: "999px" }}
            >
              読み込みを再試行
            </Button>
          )}

          {accessStatus === "READY" && step === "INPUT" && (
            <EsInputForm
              submitting={submitting}
              progressLabel={submitting ? progressLabel : null}
              fieldErrors={error?.fieldErrors ?? {}}
              companies={companies}
              experiences={experiences}
              onSubmit={(request) => void startAnalysis(request)}
            />
          )}

          {accessStatus === "READY" && step === "ANALYSIS" && esDocument && originalAnalysis && (
            <Stack spacing={2}>
              <Typography variant="h6" sx={{ color: CHAT_COLORS.textOnDark, fontWeight: 700 }}>
                ES原文の検査結果
              </Typography>
              <EsComments
                analysis={originalAnalysis}
                characterLimit={esDocument.characterLimit}
                sourceText={esDocument.originalText}
                submissionReadiness={originalAnalysis.submissionReadiness}
              />
              <Button
                variant="contained"
                disabled={submitting}
                onClick={() => void requestRevision()}
                startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : undefined}
                sx={{ bgcolor: CHAT_COLORS.orange, color: CHAT_COLORS.bubbleText, fontWeight: 700, borderRadius: "999px" }}
              >
                完成版ES案を作る
              </Button>
              {submitting && progressLabel && (
                <Typography variant="caption" sx={{ color: CHAT_COLORS.textOnDarkMuted, textAlign: "center" }}>
                  {progressLabel}
                </Typography>
              )}
            </Stack>
          )}

          {accessStatus === "READY" && step === "RESULT" && esDocument && esRevision && (
            <EsRevisionResult
              esDocument={esDocument}
              esRevision={esRevision}
              onRequestComments={() => void requestComments()}
              onReviewChange={(changeId, decision) => void reviewChange(changeId, decision)}
              reviewingChangeId={reviewingChangeId}
              loading={verifying}
              progressLabel={verifying ? progressLabel : null}
            />
          )}

          {accessStatus === "READY" && step === "COMMENTS" && esDocument && esRevision && verifyAnalysis && (
            <EsComments
              analysis={verifyAnalysis}
              characterLimit={esDocument.characterLimit}
              sourceText={esRevision.revisedText}
              submissionReadiness={verifyAnalysis.submissionReadiness}
            />
          )}
      </Stack>
    </YozoraPageShell>
  );
}
