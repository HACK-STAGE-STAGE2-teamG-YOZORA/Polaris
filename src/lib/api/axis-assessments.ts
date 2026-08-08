// docs/openapi.yaml の /api/v1/axis-assessments 系エンドポイントに対応するAPIクライアント。
import { apiGet, apiPatch } from "@/lib/api/client";
import type {
  AxisAssessment,
  AxisAssessmentPage,
  ReviewAxisAssessmentRequest,
} from "@/types/axis-assessment";

// GET /api/v1/axis-assessments — セッションを指定して4軸分析を取得する
export function listAxisAssessments(params?: { sessionId?: string }): Promise<AxisAssessmentPage> {
  const query = new URLSearchParams();
  if (params?.sessionId) query.set("sessionId", params.sessionId);
  const queryString = query.toString();
  return apiGet<AxisAssessmentPage>(`/axis-assessments${queryString ? `?${queryString}` : ""}`);
}

// PATCH /api/v1/axis-assessments/{id} — 軸への本人評価・修正文・メモを保存する。
// 本人が明示的に選んだ値だけを送る（未評価の軸を自動でMATCHESにしない）
export function reviewAxisAssessment(
  axisAssessmentId: string,
  body: ReviewAxisAssessmentRequest,
): Promise<AxisAssessment> {
  return apiPatch<AxisAssessment>(`/axis-assessments/${axisAssessmentId}`, body);
}
