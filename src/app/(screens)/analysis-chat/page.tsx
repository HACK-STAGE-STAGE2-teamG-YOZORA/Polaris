"use client";

import { Suspense, useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { AxisAssessmentReview } from "./components/AxisAssessmentReview";
import { CompletionBanner } from "./components/CompletionBanner";
import { ErrorBanner } from "./components/ErrorBanner";
import { ExperienceDraftPanel } from "./components/ExperienceDraftPanel";
import { MessageComposer } from "./components/MessageComposer";
import { MessageList } from "./components/MessageList";
import { ProgressBadge } from "./components/ProgressBadge";
import { SessionStartForm } from "./components/SessionStartForm";
import { StartModeChoice } from "./components/StartModeChoice";
import { useAnalysisChat } from "./use-analysis-chat";
import type { InitialStartMode } from "./use-analysis-chat";
import { CHAT_COLORS } from "@/shared/ui/chat-colors";
import type { SelfAnalysisAxis } from "@/types/analysis-session";

// 画面全体の背景。ローディング時と本体で同じ見た目にするために切り出す
function ChatBackground({ children }: { children: React.ReactNode }) {
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
      <Box sx={{ width: "100%", maxWidth: 560, px: 2, pt: 3, display: "flex", flexDirection: "column" }}>
        {children}
      </Box>
    </Box>
  );
}

// useSearchParamsはSuspense境界の内側でだけ使える（Next.jsの静的レンダリング制約）
export default function AnalysisChatPage() {
  return (
    <Suspense
      fallback={
        <ChatBackground>
          <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
            <CircularProgress size={24} sx={{ color: CHAT_COLORS.orange }} />
          </Box>
        </ChatBackground>
      }
    >
      <AnalysisChatContent />
    </Suspense>
  );
}

// このファイルは状態とAPI呼び出しを持つuseAnalysisChatフックと、
// 見た目だけを担うcomponents/配下を繋ぐだけの薄い層にする。
// デザイン確定後はcomponents/配下の中身だけ差し替えれば済むようにする。
//
// 画面の分岐は次の順で評価する:
//   1. checkingCurrent          → 進行中セッション確認中のローディング
//   2. currentSession かつ 未選択 → チャット開始選択(StartModeChoice: 続きから/初めから)
//   3. currentSessionなし、または「初めから」選択後 → SessionStartForm
//   4. session確定後             → チャット本体(進捗・経験カード確認・終了案内・4軸評価・履歴・入力欄)
function AnalysisChatContent() {
  // ホームの「続きから」「初めから」から渡される開始モード。不正値は無視して通常の選択画面に戻す
  const searchParams = useSearchParams();
  const startParam = searchParams.get("start");
  const initialStartMode: InitialStartMode | undefined =
    startParam === "resume" || startParam === "new" ? startParam : undefined;

  const {
    checkingCurrent,
    currentSession,
    showNewSessionForm,
    session,
    messages,
    experienceReady,
    missingAxes,
    completionIntent,
    startingSession,
    loadingMessages,
    sending,
    generatingResult,
    assessments,
    reviewingAxisId,
    finalizingSession,
    draftExperience,
    creatingDraft,
    savingDraft,
    draftNotice,
    recomputeFailed,
    unreviewedAxes,
    hasStaleAssessment,
    canFinalize,
    error,
    resumeCurrentSession,
    chooseStartNew,
    startSession,
    sendMessage,
    createDraft,
    saveDraft,
    dismissDraft,
    generateResult,
    reviewAssessment,
    finalizeSession,
  } = useAnalysisChat(initialStartMode);

  // 送信中の入力内容はこの画面だけのUI状態なので、フックではなくここで持つ
  const [draftContent, setDraftContent] = useState("");

  const handleStartSession = useCallback(
    (title: string, targetAxes: SelfAnalysisAxis[]) => {
      void startSession(title, targetAxes);
    },
    [startSession],
  );

  const handleSendMessage = useCallback(async () => {
    if (draftContent.trim() === "") return;
    // 送信のたびに新規発行し、二重送信防止のキーとしてサーバーへ渡す
    const clientMessageId = crypto.randomUUID();
    const ok = await sendMessage(draftContent, clientMessageId);
    if (ok) {
      // 送信成功時だけ入力欄をクリアする。失敗時（504/502等）は入力内容を残す
      setDraftContent("");
    }
  }, [draftContent, sendMessage]);

  const completed = session?.status === "COMPLETED";

  return (
    <ChatBackground>
      <Stack spacing={2}>
          <Typography
            variant="h6"
            component="h1"
            sx={{ color: CHAT_COLORS.textOnDark, fontWeight: 700, textAlign: "center" }}
          >
            自己分析チャット
          </Typography>

          {error && <ErrorBanner error={error} />}

          {!session && checkingCurrent && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
              <CircularProgress size={24} sx={{ color: CHAT_COLORS.orange }} />
            </Box>
          )}

          {/* チャット開始選択: GET /analysis-sessions/current の結果、進行中セッションがあれば
              「続きから」「初めから」を選ばせる。POSTはまだ呼ばない */}
          {!session && !checkingCurrent && currentSession && !showNewSessionForm && (
            <StartModeChoice
              session={currentSession}
              onResume={() => void resumeCurrentSession()}
              onStartNew={chooseStartNew}
              busy={loadingMessages}
            />
          )}

          {/* 進行中セッションがない場合、または「初めから」を選んだ場合の新規セッション作成フォーム。
              startMode(START_NEW/RESTART_ACTIVE)はhook側がcurrentSessionの有無から自動判定する */}
          {!session && !checkingCurrent && (!currentSession || showNewSessionForm) && (
            <SessionStartForm
              submitting={startingSession}
              fieldErrors={error?.fieldErrors ?? {}}
              onSubmit={handleStartSession}
            />
          )}

          {session && (
            <>
              {/* 経験カード3件必須の表示は廃止。発言数・確認済み経験数の簡易表示のみ */}
              <ProgressBadge
                progress={session.progress}
                missingAxes={missingAxes}
                experienceReady={experienceReady}
              />

              {/* 経験カード確認: AIの案は必ずDRAFTで、本人が確認して初めて正式根拠になる */}
              {!completed && (
                <ExperienceDraftPanel
                  experienceReady={experienceReady}
                  confirmedExperienceCount={session.progress.confirmedExperienceCount}
                  draftExperience={draftExperience}
                  creatingDraft={creatingDraft}
                  savingDraft={savingDraft}
                  notice={draftNotice}
                  hasUserMessage={session.progress.userMessageCount > 0}
                  onCreateDraft={(experienceType) => void createDraft(experienceType)}
                  onSaveDraft={(body) => void saveDraft(body)}
                  onDismissDraft={dismissDraft}
                />
              )}

              {/* completionIntent=SUGGESTED、またはcanGenerateResult=trueのときだけ表示する終了案内 */}
              <CompletionBanner
                completionIntent={completionIntent}
                canGenerateResult={session.progress.canGenerateResult}
                onGenerateResult={() => void generateResult()}
                generatingResult={generatingResult}
                sessionStatus={session.status}
                confirmedExperienceCount={session.progress.confirmedExperienceCount}
                missingAxes={missingAxes}
              />

              {/* 生成済みの4軸結果と本人評価。4軸すべて評価するまで確定できない */}
              {assessments.length > 0 && (
                <AxisAssessmentReview
                  assessments={assessments}
                  reviewingAxisId={reviewingAxisId}
                  onReview={(id, assessment) => void reviewAssessment(id, assessment)}
                  unreviewedCount={unreviewedAxes.length}
                  hasStaleAssessment={hasStaleAssessment}
                  canFinalize={canFinalize}
                  onFinalize={() => void finalizeSession()}
                  finalizing={finalizingSession}
                  onRegenerate={() => void generateResult()}
                  regenerating={generatingResult}
                  completed={completed}
                  recomputeFailed={recomputeFailed}
                />
              )}

              {loadingMessages ? (
                <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
                  <CircularProgress size={24} sx={{ color: CHAT_COLORS.orange }} />
                </Box>
              ) : (
                <MessageList messages={messages} />
              )}

              {/* 確定後のセッションへは追記できない */}
              {!completed && (
                <MessageComposer
                  value={draftContent}
                  onChange={setDraftContent}
                  onSubmit={handleSendMessage}
                  disabled={sending}
                  fieldError={error?.fieldErrors.content}
                />
              )}
            </>
          )}
      </Stack>
    </ChatBackground>
  );
}
