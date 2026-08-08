"use client";

import { Suspense, useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
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
import { SessionResultReveal } from "./components/SessionResultReveal";
import { SessionStartForm } from "./components/SessionStartForm";
import { StartModeChoice } from "./components/StartModeChoice";
import { useAnalysisChat } from "./use-analysis-chat";
import type { InitialStartAction } from "./use-analysis-chat";
import { SessionReportDialog } from "@/app/components/SessionReportDialog";
import { CHAT_COLORS } from "@/shared/ui/chat-colors";

// 画面全体の背景。ローディング時と本体で同じ見た目にするために切り出す
function ChatBackground({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: "100dvh",
        background: `linear-gradient(180deg, ${CHAT_COLORS.gradientTop} 0%, ${CHAT_COLORS.gradientMid} 46%, ${CHAT_COLORS.gradientBottom} 100%)`,
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
//   1. loadingResumable                 → 再開できるセッション一覧の確認中のローディング
//   2. resumableSessions かつ 未選択    → チャット開始選択(StartModeChoice: 一覧から続きから/初めから)
//   3. 一覧が0件、または「初めから」選択後 → SessionStartForm
//   4. session確定後                    → チャット本体(進捗・経験カード確認・終了案内・4軸評価・履歴・入力欄)
//
// ユーザーは複数のセッションを同時に進行できる(product-scope.mdの単一セッション前提から変更)。
// ?start=new でセッション作成フォームへ直接、?resume={sessionId} で特定セッションへ直接入れる
// (経験一覧のカードから「このセッションの続きから」で使う)
function AnalysisChatContent() {
  const searchParams = useSearchParams();
  const startParam = searchParams.get("start");
  const resumeParam = searchParams.get("resume");
  const initialAction: InitialStartAction | undefined =
    startParam === "new"
      ? { type: "new" }
      : resumeParam
        ? { type: "resume", sessionId: resumeParam }
        : undefined;

  const {
    loadingResumable,
    resumableSessions,
    otherSessions,
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
    resumeSession,
    chooseStartNew,
    backToSessionList,
    startSession,
    sendMessage,
    createDraft,
    saveDraft,
    dismissDraft,
    generateResult,
    reviewAssessment,
    finalizeSession,
  } = useAnalysisChat(initialAction);

  // 送信中の入力内容はこの画面だけのUI状態なので、フックではなくここで持つ
  const [draftContent, setDraftContent] = useState("");
  // 完了済みセッション一覧から「結果を見る」で開くダイアログの対象
  const [viewingSessionId, setViewingSessionId] = useState<string | null>(null);

  const handleStartSession = useCallback(
    (title: string) => {
      void startSession(title);
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
  const showPicker = !session && !loadingResumable && !showNewSessionForm;
  const showStartForm = !session && !loadingResumable && showNewSessionForm;

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

        {!session && loadingResumable && (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
            <CircularProgress size={24} sx={{ color: CHAT_COLORS.orange }} />
          </Box>
        )}

        {/* チャット開始選択: 進行中セッション一覧から個別に「続きから」を選べる。POSTはまだ呼ばない */}
        {showPicker && (
          <StartModeChoice
            resumableSessions={resumableSessions}
            otherSessions={otherSessions}
            onResume={(sessionId) => void resumeSession(sessionId)}
            onViewResult={setViewingSessionId}
            onStartNew={chooseStartNew}
            busy={loadingMessages}
          />
        )}

        {/* 一覧が0件、または「初めから」を選んだ場合の新規セッション作成フォーム。startModeは常にSTART_NEW */}
        {showStartForm && (
          <>
            {(resumableSessions.length > 0 || otherSessions.length > 0) && (
              <Button
                onClick={backToSessionList}
                size="small"
                sx={{ alignSelf: "flex-start", color: CHAT_COLORS.textOnDarkMuted }}
              >
                ← セッション一覧に戻る
              </Button>
            )}
            <SessionStartForm
              submitting={startingSession}
              fieldErrors={error?.fieldErrors ?? {}}
              onSubmit={handleStartSession}
            />
          </>
        )}

        {session && (
          <>
            <Button
              onClick={backToSessionList}
              size="small"
              sx={{ alignSelf: "flex-start", color: CHAT_COLORS.textOnDarkMuted }}
            >
              ← セッション一覧に戻る
            </Button>

            {/* 経験カード3件必須の表示は廃止。発言数・確認済み経験数の簡易表示のみ */}
            <ProgressBadge
              progress={session.progress}
              missingAxes={missingAxes}
              experienceReady={experienceReady}
            />

            {completed ? (
              // 確定済みセッションは、結果を大きく見せるカードを主役にする
              // （終了案内・4択評価バナーは確定前の操作用なのでここでは出さない）
              <SessionResultReveal sessionId={session.id} />
            ) : (
              <>
                {loadingMessages ? (
                  <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
                    <CircularProgress size={24} sx={{ color: CHAT_COLORS.orange }} />
                  </Box>
                ) : (
                  <MessageList messages={messages} />
                )}

                {/* 終了案内・4軸結果と本人評価は、メッセージ履歴のすぐ下(入力欄の近く)に置く。
                    以前は画面上部に固定されていたため、会話が伸びるほど一番上まで
                    スクロールしないと見えなかった */}
                <CompletionBanner
                  completionIntent={completionIntent}
                  canGenerateResult={session.progress.canGenerateResult}
                  onGenerateResult={() => void generateResult()}
                  generatingResult={generatingResult}
                  sessionStatus={session.status}
                  confirmedExperienceCount={session.progress.confirmedExperienceCount}
                  missingAxes={missingAxes}
                />

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

                {/* 経験カード確認: AIの案は必ずDRAFTで、本人が確認して初めて正式根拠になる。
                    入力欄のすぐ上に置き、長い会話でも上までスクロールせず操作できるようにする */}
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

                <MessageComposer
                  value={draftContent}
                  onChange={setDraftContent}
                  onSubmit={handleSendMessage}
                  disabled={sending}
                  fieldError={error?.fieldErrors.content}
                />
              </>
            )}
          </>
        )}
      </Stack>

      {viewingSessionId && (
        <SessionReportDialog
          open={viewingSessionId !== null}
          sessionId={viewingSessionId}
          onClose={() => setViewingSessionId(null)}
        />
      )}
    </ChatBackground>
  );
}
