"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { EsComments } from "./components/EsComments";
import { EsErrorBanner } from "./components/EsErrorBanner";
import { EsInputForm } from "./components/EsInputForm";
import { EsRevisionResult } from "./components/EsRevisionResult";
import { useEsRevision } from "./use-es-revision";
import { CHAT_COLORS } from "@/shared/ui/chat-colors";

// このファイルは状態とAPI呼び出しを持つuseEsRevisionフックと、
// 見た目だけを担うcomponents/配下を繋ぐだけの薄い層にする。
// デザイン確定後はcomponents/配下の中身だけ差し替えれば済むようにする。
//
// 画面はstepに応じて3つを一方向に遷移する: INPUT → RESULT → COMMENTS
export default function EsRevisionPage() {
  const {
    step,
    esDocument,
    esRevision,
    verifyAnalysis,
    comments,
    submissionReadiness,
    submitting,
    verifying,
    progressLabel,
    error,
    startRevision,
    requestComments,
  } = useEsRevision();

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        background: `linear-gradient(180deg, ${CHAT_COLORS.gradientTop} 0%, ${CHAT_COLORS.gradientBottom} 100%)`,
        display: "flex",
        justifyContent: "center",
        pb: "72px",
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 560, px: 2, pt: 3 }}>
        <Stack spacing={2}>
          <Typography
            variant="h5"
            component="h1"
            sx={{ color: CHAT_COLORS.textOnDark, fontWeight: 700, textAlign: "center" }}
          >
            ES推敲
          </Typography>

          {error && <EsErrorBanner error={error} />}

          {step === "INPUT" && (
            <EsInputForm
              submitting={submitting}
              progressLabel={submitting ? progressLabel : null}
              fieldErrors={error?.fieldErrors ?? {}}
              onSubmit={(request) => void startRevision(request)}
            />
          )}

          {step === "RESULT" && esDocument && esRevision && (
            <EsRevisionResult
              esDocument={esDocument}
              esRevision={esRevision}
              onRequestComments={() => void requestComments()}
              loading={verifying}
              progressLabel={verifying ? progressLabel : null}
            />
          )}

          {step === "COMMENTS" && esDocument && verifyAnalysis && submissionReadiness && (
            <EsComments
              analysis={verifyAnalysis}
              characterLimit={esDocument.characterLimit}
              comments={comments}
              submissionReadiness={submissionReadiness}
            />
          )}
        </Stack>
      </Box>
    </Box>
  );
}
