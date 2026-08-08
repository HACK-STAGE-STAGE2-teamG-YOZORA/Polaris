// docs/openapi.yaml の /api/v1/experiences 系エンドポイントに対応するAPIクライアント。
import { apiDelete, apiGet, apiPatch } from "@/lib/api/client";
import type {
  ExperiencePage,
  ExperienceResponse,
  ExperienceStatus,
  UpdateExperienceRequest,
  UpdateExperienceResponse,
} from "@/types/experience";

// ES添削画面が根拠候補として使う確認済み経験だけの一覧
export function listConfirmedExperiences(): Promise<ExperiencePage> {
  return apiGet<ExperiencePage>("/experiences?status=CONFIRMED&limit=100");
}

// GET /api/v1/experiences — 経験一覧。statusを省略するとDRAFT/CONFIRMEDの両方を返す
export function listExperiences(params?: {
  status?: ExperienceStatus;
  cursor?: string;
  limit?: number;
}): Promise<ExperiencePage> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.cursor) query.set("cursor", params.cursor);
  query.set("limit", String(params?.limit ?? 100));
  return apiGet<ExperiencePage>(`/experiences?${query.toString()}`);
}

// GET /api/v1/experiences/{experienceId}
export function getExperience(experienceId: string): Promise<ExperienceResponse> {
  return apiGet<ExperienceResponse>(`/experiences/${experienceId}`);
}

// PATCH /api/v1/experiences/{experienceId} — 内容の修正と確認(CONFIRMED)を行う。
// レスポンスには、この更新で古くなった4軸分析(staledAssessments)が含まれる
export function updateExperience(
  experienceId: string,
  body: UpdateExperienceRequest,
): Promise<UpdateExperienceResponse> {
  return apiPatch<UpdateExperienceResponse>(`/experiences/${experienceId}`, body);
}

// DELETE /api/v1/experiences/{experienceId}
export function deleteExperience(experienceId: string): Promise<void> {
  return apiDelete(`/experiences/${experienceId}`);
}
