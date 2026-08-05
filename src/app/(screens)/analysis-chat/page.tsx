"use client";

import { useCallback, useState } from "react";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { CompletionBanner } from "./components/CompletionBanner";
import { ErrorBanner } from "./components/ErrorBanner";
import { MessageComposer } from "./components/MessageComposer";
import { MessageList } from "./components/MessageList";
import { ProgressBadge } from "./components/ProgressBadge";
import { SessionStartForm } from "./components/SessionStartForm";
import { StartModeChoice } from "./components/StartModeChoice";
import { useAnalysisChat } from "./use-analysis-chat";
import type { SelfAnalysisAxis } from "@/types/analysis-session";

// このファイルは状態とAPI呼び出しを持つuseAnalysisChatフックと、
// 見た目だけを担うcomponents/配下を繋ぐだけの薄い層にする。
// デザイン確定後はcomponents/配下の中身だけ差し替えれば済むようにする。
//
// 画面の分岐は次の順で評価する:
//   1. checkingCurrent          → 進行中セッション確認中のローディング
//   2. currentSession かつ 未選択 → チャット開始選択(StartModeChoice: 続きから/初めから)
//   3. currentSessionなし、または「初めから」選択後 → SessionStartForm
//   4. session確定後             → チャット本体(進捗・終了案内・履歴・入力欄)
export default function AnalysisChatPage() {
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
    error,
    resumeCurrentSession,
    chooseStartNew,
    startSession,
    sendMessage,
  } = useAnalysisChat();

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

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Stack spacing={2}>
        <Typography variant="h5" component="h1">
          自己分析チャット
        </Typography>

        {error && <ErrorBanner error={error} />}

        {!session && checkingCurrent && <CircularProgress size={24} />}

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

            {/* completionIntent=SUGGESTED、またはcanGenerateResult=trueのときだけ表示する終了案内 */}
            <CompletionBanner
              completionIntent={completionIntent}
              canGenerateResult={session.progress.canGenerateResult}
            />

            {loadingMessages ? (
              <CircularProgress size={24} />
            ) : (
              <MessageList messages={messages} />
            )}

            <MessageComposer
              value={draftContent}
              onChange={setDraftContent}
              onSubmit={handleSendMessage}
              disabled={sending}
              fieldError={error?.fieldErrors.content}
            />
          </>
        )}
      </Stack>
    </Container>
  );
}
