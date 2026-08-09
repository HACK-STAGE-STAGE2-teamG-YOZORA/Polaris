"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { EsComments } from "./components/EsComments";
import { EsErrorBanner } from "./components/EsErrorBanner";
import { EsHub } from "./components/EsHub";
import { EsInputForm } from "./components/EsInputForm";
import { EsRevisionResult } from "./components/EsRevisionResult";
import { useEsRevision } from "./use-es-revision";
import { YozoraPageShell } from "@/app/components/YozoraPageShell";
import { ES_REVISION_PATH } from "@/shared/routes";
import { CHAT_COLORS } from "@/shared/ui/chat-colors";
import type { CreateEsDocumentRequest } from "@/types/es-document";

const REVIEW_STEPS = ["ES入力", "根拠を検査", "完成版"] as const;

function EsPageShell({ children }: { children: React.ReactNode }) {
  return (
    <YozoraPageShell
      section="ES"
      title="ES"
      description="作成中のESと企業情報を一か所で管理し、確認済みの根拠から提出できる文章へ磨きます。"
    >
      {children}
    </YozoraPageShell>
  );
}

export default function EsRevisionPage() {
  return (
    <Suspense
      fallback={
        <EsPageShell>
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress size={28} sx={{ color: CHAT_COLORS.orange }} />
          </Box>
        </EsPageShell>
      }
    >
      <EsRevisionContent />
    </Suspense>
  );
}

function EsRevisionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialDocumentId = searchParams.get("document");
  const initialStartNew = searchParams.get("new") === "1";
  const {
    step,
    accessStatus,
    companies,
    experiences,
    documents,
    esDocument,
    originalAnalysis,
    esRevision,
    verifyAnalysis,
    submitting,
    verifying,
    reviewingChangeId,
    loadingDocumentId,
    progressLabel,
    error,
    startAnalysis,
    requestRevision,
    requestComments,
    reviewChange,
    startNewDocument,
    openDocument,
    backToHub,
    editDocument,
    refreshCompanies,
    reloadContext,
  } = useEsRevision({ initialDocumentId, startNew: initialStartNew });

  const activeStep = step === "INPUT" ? 0 : step === "ANALYSIS" ? 1 : 2;
  const initialRequest: CreateEsDocumentRequest | null = esDocument
    ? {
        companyId: esDocument.companyId,
        targetRole: esDocument.targetRole,
        question: esDocument.question,
        characterLimit: esDocument.characterLimit,
        originalText: esDocument.originalText,
        preferredExperienceIds: esDocument.preferredExperienceIds,
        emphasis: esDocument.emphasis,
      }
    : null;
  const hasStaleHistory = Boolean(
    esDocument &&
      (esDocument.analyses.some((analysis) => analysis.freshness === "STALE") ||
        esDocument.revisions.some((revision) => revision.freshness === "STALE")),
  );

  const handleStartNew = () => {
    router.replace(`${ES_REVISION_PATH}?new=1`);
    startNewDocument();
  };

  const handleOpenDocument = async (documentId: string) => {
    const opened = await openDocument(documentId);
    if (opened) router.replace(`${ES_REVISION_PATH}?document=${encodeURIComponent(documentId)}`);
  };

  const handleBackToHub = () => {
    router.replace(ES_REVISION_PATH);
    void backToHub();
  };

  return (
    <EsPageShell>
      <Stack spacing={2}>
        {error && <EsErrorBanner error={error} />}

        {accessStatus === "LOADING_CONTEXT" && (
          <Stack spacing={1.5} sx={{ alignItems: "center", py: 6 }}>
            <CircularProgress sx={{ color: CHAT_COLORS.orange }} />
            <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
              ES・企業・経験を読み込んでいます…
            </Typography>
          </Stack>
        )}

        {accessStatus === "UNAUTHENTICATED" && (
          <Box sx={{ borderRadius: 3, bgcolor: CHAT_COLORS.navySurface, p: 3, textAlign: "center" }}>
            <Stack spacing={2}>
              <Typography variant="h6" sx={{ color: CHAT_COLORS.textOnDark, fontWeight: 700 }}>
                ES機能にはログインが必要です
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

        {accessStatus === "READY" && step === "HUB" && (
          <EsHub
            documents={documents}
            companies={companies}
            loadingDocumentId={loadingDocumentId}
            onStartNew={handleStartNew}
            onOpenDocument={(documentId) => void handleOpenDocument(documentId)}
            onCompaniesChanged={refreshCompanies}
          />
        )}

        {accessStatus === "READY" && step !== "HUB" && (
          <>
            <Button
              variant="text"
              onClick={handleBackToHub}
              sx={{ alignSelf: "flex-start", px: 0, color: CHAT_COLORS.orange }}
            >
              ← ES一覧・企業情報へ
            </Button>

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
          </>
        )}

        {accessStatus === "READY" && step === "INPUT" && (
          <>
            {hasStaleHistory && (
              <Box sx={{ borderRadius: 3, border: `1px solid ${CHAT_COLORS.orange}`, bgcolor: CHAT_COLORS.orangeMuted, p: 1.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  関連する経験または企業情報が更新されています
                </Typography>
                <Typography variant="caption" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
                  入力内容を確認し、最新の根拠でもう一度検査してください。
                </Typography>
              </Box>
            )}
            <EsInputForm
              key={`${esDocument?.id ?? "new"}-${esDocument?.updatedAt ?? ""}`}
              submitting={submitting}
              progressLabel={submitting ? progressLabel : null}
              fieldErrors={error?.fieldErrors ?? {}}
              companies={companies}
              experiences={experiences}
              initialRequest={initialRequest}
              existingDocument={esDocument !== null}
              onSubmit={(request) => void startAnalysis(request)}
            />
          </>
        )}

        {accessStatus === "READY" && step === "ANALYSIS" && esDocument && originalAnalysis && (
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
              <Typography variant="h6" sx={{ color: CHAT_COLORS.textOnDark, fontWeight: 700 }}>
                ES原文の検査結果
              </Typography>
              <Button variant="text" onClick={editDocument} sx={{ alignSelf: "flex-start", color: CHAT_COLORS.orange }}>
                原文・設問を編集
              </Button>
            </Stack>
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
          <Stack spacing={2}>
            <EsRevisionResult
              esDocument={esDocument}
              esRevision={esRevision}
              onRequestComments={() => void requestComments()}
              onReviewChange={(changeId, decision) => void reviewChange(changeId, decision)}
              reviewingChangeId={reviewingChangeId}
              loading={verifying}
              progressLabel={verifying ? progressLabel : null}
            />
            <Button variant="text" onClick={editDocument} sx={{ alignSelf: "flex-start", color: CHAT_COLORS.orange }}>
              原文・設問を編集して作り直す
            </Button>
          </Stack>
        )}

        {accessStatus === "READY" && step === "COMMENTS" && esDocument && esRevision && verifyAnalysis && (
          <Stack spacing={2}>
            <EsComments
              analysis={verifyAnalysis}
              characterLimit={esDocument.characterLimit}
              sourceText={esRevision.revisedText}
              submissionReadiness={verifyAnalysis.submissionReadiness}
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button
                variant="contained"
                onClick={handleBackToHub}
                sx={{ bgcolor: CHAT_COLORS.orange, color: CHAT_COLORS.bubbleText, fontWeight: 700, borderRadius: "999px" }}
              >
                ES一覧へ戻る
              </Button>
              <Button variant="outlined" onClick={editDocument} sx={{ color: CHAT_COLORS.textOnDark, borderColor: CHAT_COLORS.navyBorder, borderRadius: "999px" }}>
                原文・設問を編集して再検査
              </Button>
            </Stack>
          </Stack>
        )}
      </Stack>
    </EsPageShell>
  );
}
