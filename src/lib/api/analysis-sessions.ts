// docs/openapi.yaml の /api/v1/analysis-sessions 系エンドポイントに対応するAPIクライアント関数群。
// HTTP呼び出しの詳細（パス組み立て、fetchラッパーの利用）をここに閉じ込め、
// 呼び出し側（use-analysis-chat.ts）はドメイン用語の関数として使う。
import { apiGet, apiPatch, apiPost } from "@/lib/api/client";
import type {
  AnalysisSession,
  ChatTurnResponse,
  CreateAnalysisSessionRequest,
  CurrentAnalysisSessionResponse,
  MessagePage,
  SendMessageRequest,
} from "@/types/analysis-session";

// POST /api/v1/analysis-sessions — 自己分析セッションを開始する。
// startModeで新規開始(START_NEW)か、進行中セッションを破棄しての再開始(RESTART_ACTIVE)かを指定する
export function createAnalysisSession(
  body: CreateAnalysisSessionRequest,
): Promise<AnalysisSession> {
  return apiPost<AnalysisSession>("/analysis-sessions", body);
}

// GET /api/v1/analysis-sessions/current — 「チャット開始選択」画面が
// 「続きから」に使う進行中セッションの有無を確認する（新規追加エンドポイント）
export function getCurrentAnalysisSession(): Promise<CurrentAnalysisSessionResponse> {
  return apiGet<CurrentAnalysisSessionResponse>("/analysis-sessions/current");
}

// GET /api/v1/analysis-sessions/{sessionId} — セッションを取得する
export function getAnalysisSession(sessionId: string): Promise<AnalysisSession> {
  return apiGet<AnalysisSession>(`/analysis-sessions/${sessionId}`);
}

// GET /api/v1/analysis-sessions/{sessionId}/messages — 会話履歴を取得する
export function listAnalysisMessages(
  sessionId: string,
  params?: { cursor?: string; limit?: number },
): Promise<MessagePage> {
  const query = new URLSearchParams();
  if (params?.cursor) query.set("cursor", params.cursor);
  if (params?.limit !== undefined) query.set("limit", String(params.limit));
  const queryString = query.toString();
  return apiGet<MessagePage>(
    `/analysis-sessions/${sessionId}/messages${queryString ? `?${queryString}` : ""}`,
  );
}

// POST /api/v1/analysis-sessions/{sessionId}/messages — 回答を送りAIの次の質問を取得する
export function sendAnalysisMessage(
  sessionId: string,
  body: SendMessageRequest,
): Promise<ChatTurnResponse> {
  return apiPost<ChatTurnResponse>(`/analysis-sessions/${sessionId}/messages`, body);
}

// POST /api/v1/analysis-sessions/{sessionId}/axis-assessments/generate — チャット内容から4軸分析を生成する
export function generateAxisAssessments(sessionId: string): Promise<{ items: unknown[] }> {
  return apiPost<{ items: unknown[] }>(`/analysis-sessions/${sessionId}/axis-assessments/generate`);
}

// GET /api/v1/axis-assessments — 軸分析結果を取得する
export function listAxisAssessments(sessionId: string): Promise<{ items: any[] }> {
  return apiGet<{ items: any[] }>(`/axis-assessments?sessionId=${sessionId}`);
}

// PATCH /api/v1/axis-assessments/{id} — 4軸分析を評価する
export function reviewAxisAssessment(
  id: string,
  assessment: "MATCHES" | "PARTIALLY_MATCHES" | "DOES_NOT_MATCH" | "NEEDS_EXPLORATION",
): Promise<unknown> {
  return apiPatch<unknown>(`/axis-assessments/${id}`, { assessment });
}

// POST /api/v1/analysis-sessions/{sessionId}/finalize — チャットを終了・確定する
export function finalizeAnalysisSession(sessionId: string): Promise<unknown> {
  return apiPost<unknown>(`/analysis-sessions/${sessionId}/finalize`);
}

// POST /api/v1/analysis-sessions/{sessionId}/experience-drafts — 会話から体験カード案を抽出する
export function createExperienceDraft(
  sessionId: string,
  experienceType: string,
  messageIds: string[],
): Promise<{ id: string }> {
  return apiPost<{ id: string }>(`/analysis-sessions/${sessionId}/experience-drafts`, {
    experienceType,
    messageIds,
  });
}

// PATCH /api/v1/experiences/{experienceId} — 体験カードを確定(CONFIRMED)にする
export function confirmExperience(experienceId: string): Promise<unknown> {
  return apiPatch<unknown>(`/experiences/${experienceId}`, { status: "CONFIRMED" });
}

// POST /api/v1/overall-self-analysis/recompute — 総合自己分析プロファイルを再計算する
export function recomputeOverallSelfAnalysis(): Promise<unknown> {
  return apiPost<unknown>("/overall-self-analysis/recompute");
}
