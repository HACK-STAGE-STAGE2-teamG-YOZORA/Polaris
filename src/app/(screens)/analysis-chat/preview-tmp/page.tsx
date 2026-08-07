"use client";

// 一時的な見た目確認専用ページ。use-analysis-chatはDB接続が必要でローカル確認できないため、
// 固定データでcomponents/配下だけを目視確認する。確認後は削除する
import { useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { CompletionBanner } from "../components/CompletionBanner";
import { ErrorBanner } from "../components/ErrorBanner";
import { MessageComposer } from "../components/MessageComposer";
import { MessageList } from "../components/MessageList";
import { ProgressBadge } from "../components/ProgressBadge";
import { SessionStartForm } from "../components/SessionStartForm";
import { StartModeChoice } from "../components/StartModeChoice";
import { CHAT_COLORS } from "@/shared/ui/chat-colors";
import type { AnalysisSession, ChatMessage } from "@/types/analysis-session";

const FIXTURE_MESSAGES: ChatMessage[] = [
  {
    id: "1",
    sessionId: "s1",
    role: "ASSISTANT",
    content: "こんにちは!今日はあなたの経験について聞かせてください。最近印象に残った出来事はありますか?",
    createdAt: new Date().toISOString(),
  },
  {
    id: "2",
    sessionId: "s1",
    role: "USER",
    content: "サークルの新歓イベントを企画したことです。",
    createdAt: new Date().toISOString(),
  },
  {
    id: "3",
    sessionId: "s1",
    role: "ASSISTANT",
    content: "それは良い経験ですね。企画するうえで一番苦労した点はどこでしたか?",
    createdAt: new Date().toISOString(),
  },
];

const FIXTURE_SESSION: AnalysisSession = {
  id: "s1",
  title: "自己分析",
  status: "ACTIVE",
  targetAxes: ["ENERGY_SOURCE", "ACTION_STYLE", "SATISFACTION_SOURCE", "PREFERRED_ENVIRONMENT"],
  progress: {
    userMessageCount: 2,
    confirmedExperienceCount: 1,
    canGenerateResult: true,
    coveredExperienceTypes: [],
    missingAxes: [],
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export default function PreviewPage() {
  const [draft, setDraft] = useState("");
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
          <Typography variant="h6" component="h1" sx={{ color: CHAT_COLORS.textOnDark, fontWeight: 700, textAlign: "center" }}>
            自己分析チャット
          </Typography>
          <ProgressBadge
            progress={{ userMessageCount: 2, confirmedExperienceCount: 1, canGenerateResult: true, coveredExperienceTypes: [], missingAxes: [] }}
            missingAxes={["ACTION_STYLE"]}
            experienceReady
          />
          <CompletionBanner completionIntent="SUGGESTED" canGenerateResult />
          <MessageList messages={FIXTURE_MESSAGES} />
          <MessageComposer value={draft} onChange={setDraft} onSubmit={() => {}} disabled={false} />
          <ErrorBanner error={{ message: "通信に失敗しました。ネットワーク状況を確認してください。", retryable: true, fieldErrors: {} }} />
          <StartModeChoice
            session={FIXTURE_SESSION}
            onResume={() => {}}
            onStartNew={() => {}}
            busy={false}
          />
          <SessionStartForm submitting={false} fieldErrors={{}} onSubmit={() => {}} />
        </Stack>
      </Box>
    </Box>
  );
}
