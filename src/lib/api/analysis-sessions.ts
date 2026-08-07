// docs/openapi.yaml の /api/v1/analysis-sessions 系エンドポイントに対応するAPIクライアント関数群。
// HTTP呼び出しの詳細（パス組み立て、fetchラッパーの利用）をここに閉じ込め、
// 呼び出し側（use-analysis-chat.ts）はドメイン用語の関数として使う。
import { apiGet, apiPost } from "@/lib/api/client";
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
