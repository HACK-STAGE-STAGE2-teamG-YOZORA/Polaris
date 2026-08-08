// docs/openapi.yaml の /api/v1/analysis-sessions 系エンドポイントに対応するAPIクライアント関数群。
// HTTP呼び出しの詳細（パス組み立て、fetchラッパーの利用）をここに閉じ込め、
// 呼び出し側（use-analysis-chat.ts）はドメイン用語の関数として使う。
import { apiGet, apiPost } from "@/lib/api/client";
import type {
  AnalysisSession,
  AnalysisSessionPage,
  AnalysisSessionStatus,
  ChatTurnResponse,
  CreateAnalysisSessionRequest,
  CurrentAnalysisSessionResponse,
  MessagePage,
  SendMessageRequest,
} from "@/types/analysis-session";
import type { AxisAssessmentPage } from "@/types/axis-assessment";
import type { OverallSelfAnalysisProfileResponse } from "@/types/dashboard";
import type { ExperienceResponse, ExperienceType } from "@/types/experience";
import type { SelfAnalysisReport } from "@/types/self-analysis-report";

// POST /api/v1/analysis-sessions — 自己分析セッションを開始する。
// startModeで新規開始(START_NEW)か、進行中セッションを破棄しての再開始(RESTART_ACTIVE)かを指定する
export function createAnalysisSession(
  body: CreateAnalysisSessionRequest,
): Promise<AnalysisSession> {
  return apiPost<AnalysisSession>("/analysis-sessions", body);
}

// GET /api/v1/analysis-sessions/current — 直近に更新された進行中セッションを1件だけ確認する軽量版。
// ホームの簡易表示に使う
export function getCurrentAnalysisSession(): Promise<CurrentAnalysisSessionResponse> {
  return apiGet<CurrentAnalysisSessionResponse>("/analysis-sessions/current");
}

// GET /api/v1/analysis-sessions — statusを複数指定して「続きからを選べるセッション一覧」を取得する。
// ユーザーは複数セッションを同時に進行できるため、チャット開始選択画面はこちらを使う
export function listAnalysisSessions(params?: {
  statuses?: AnalysisSessionStatus[];
  limit?: number;
}): Promise<AnalysisSessionPage> {
  const query = new URLSearchParams();
  for (const status of params?.statuses ?? []) query.append("status", status);
  query.set("limit", String(params?.limit ?? 50));
  return apiGet<AnalysisSessionPage>(`/analysis-sessions?${query.toString()}`);
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

// POST /api/v1/analysis-sessions/{sessionId}/axis-assessments/generate — チャット内容から4軸分析を生成する。
// 生成直後の userAssessment は全軸 UNREVIEWED で、本人評価は別途 PATCH /axis-assessments/{id} で保存する
export function generateAxisAssessments(sessionId: string): Promise<AxisAssessmentPage> {
  return apiPost<AxisAssessmentPage>(`/analysis-sessions/${sessionId}/axis-assessments/generate`);
}

// POST /api/v1/analysis-sessions/{sessionId}/finalize — チャットを終了・確定する。
// UNREVIEWEDの軸が1つでも残っていると409 CONFLICTになる
export function finalizeAnalysisSession(sessionId: string): Promise<SelfAnalysisReport> {
  return apiPost<SelfAnalysisReport>(`/analysis-sessions/${sessionId}/finalize`);
}

// POST /api/v1/analysis-sessions/{sessionId}/experience-drafts — 会話から経験カード案を抽出する。
// 結果は必ずDRAFTで、本人が確認するまで4軸分析の正式根拠にならない
export function createExperienceDraft(
  sessionId: string,
  experienceType: ExperienceType,
  messageIds: string[],
): Promise<ExperienceResponse> {
  return apiPost<ExperienceResponse>(`/analysis-sessions/${sessionId}/experience-drafts`, {
    experienceType,
    messageIds,
  });
}

// POST /api/v1/overall-self-analysis/recompute — 総合自己分析プロファイルを再計算する
export function recomputeOverallSelfAnalysis(): Promise<OverallSelfAnalysisProfileResponse> {
  return apiPost<OverallSelfAnalysisProfileResponse>("/overall-self-analysis/recompute");
}
