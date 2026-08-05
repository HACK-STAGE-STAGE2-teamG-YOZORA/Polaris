import type { SelfAnalysisAxis } from './dashboard';

// ────────────────────────────────────────
// Enum types
// ────────────────────────────────────────
export type ExperienceType =
  | 'ENGAGED'
  | 'ACHIEVEMENT'
  | 'CHALLENGE'
  | 'DRAINING_SUCCESS'
  | 'TEAM_CONFLICT'
  | 'OTHER';

export type ExperienceStatus = 'DRAFT' | 'CONFIRMED';

// ────────────────────────────────────────
// Request types
// ────────────────────────────────────────

/** POST /api/v1/experiences */
export interface CreateExperienceRequest {
  sourceSessionId?: string;
  sourceMessageId?: string; // 元発言紐付け
  type: ExperienceType;
  title: string;
  situation: string;
  goal?: string;
  role: string;
  options?: string[];
  decision?: string;
  decisionReason?: string;
  actions?: string[];
  result?: string;
  positiveEmotion?: string;
  negativeEmotion?: string;
  energyChange?: number;
  environment?: Record<string, unknown>;
  isTarget?: boolean; // 次回分析対象フラグ（デフォルト: true）
}

/** PATCH /api/v1/experiences/[experienceId] */
export interface UpdateExperienceRequest {
  type?: ExperienceType;
  title?: string;
  situation?: string;
  goal?: string;
  role?: string;
  options?: string[];
  decision?: string;
  decisionReason?: string;
  actions?: string[];
  result?: string;
  positiveEmotion?: string;
  negativeEmotion?: string;
  energyChange?: number;
  environment?: Record<string, unknown>;
  status?: ExperienceStatus; // CONFIRMED に更新する際に使用
  isTarget?: boolean;
}

// ────────────────────────────────────────
// Response types
// ────────────────────────────────────────

export interface ExperienceResponse {
  id: string;
  sourceSessionId: string | null;
  sourceMessageId: string | null;
  type: ExperienceType;
  title: string;
  situation: string;
  goal: string | null;
  role: string;
  options: string[];
  decision: string | null;
  decisionReason: string | null;
  actions: string[];
  result: string | null;
  positiveEmotion: string | null;
  negativeEmotion: string | null;
  energyChange: number;
  environment: Record<string, unknown>;
  status: ExperienceStatus;
  isTarget: boolean; // 次回分析で使うかどうか
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** GET /api/v1/experiences のレスポンス */
export interface ExperienceListResponse {
  experiences: ExperienceResponse[];
  total: number;
}

/** PATCH 後に STALE 化された AxisAssessment の情報 */
export interface StaleAssessmentInfo {
  id: string;
  axis: SelfAnalysisAxis;
  sourceSessionId: string;
}

/** PATCH /api/v1/experiences/[experienceId] のレスポンス */
export interface UpdateExperienceResponse {
  experience: ExperienceResponse;
  staledAssessments: StaleAssessmentInfo[]; // 連動して STALE 化された分析結果
}
