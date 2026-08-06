import type { SelfAnalysisAxis } from './dashboard';

export type ExperienceType =
  | 'ENGAGED'
  | 'ACHIEVEMENT'
  | 'CHALLENGE'
  | 'DRAINING_SUCCESS'
  | 'TEAM_CONFLICT'
  | 'OTHER';
export type ExperienceStatus = 'DRAFT' | 'CONFIRMED';

export interface ExperienceWriteFields {
  type: ExperienceType;
  title: string;
  situation: string;
  goal?: string | null;
  role: string;
  options?: string[];
  decision?: string | null;
  decisionReason?: string | null;
  actions: string[];
  result?: string | null;
  positiveEmotion?: string | null;
  negativeEmotion?: string | null;
  energyChange: number;
  environment: string[];
}

export interface CreateExperienceRequest extends ExperienceWriteFields {
  sourceSessionId?: string;
  sourceMessageId?: string;
}

export type UpdateExperienceRequest = Partial<ExperienceWriteFields> & {
  status?: ExperienceStatus;
};

export interface ExperienceResponse extends ExperienceWriteFields {
  id: string;
  sourceSessionId: string | null;
  sourceMessageId: string | null;
  goal: string | null;
  options: string[];
  decision: string | null;
  decisionReason: string | null;
  result: string | null;
  positiveEmotion: string | null;
  negativeEmotion: string | null;
  evidenceQuotes: Array<{ messageId: string; quote: string }>;
  status: ExperienceStatus;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StaleAssessmentInfo {
  id: string;
  axis: SelfAnalysisAxis;
  sourceSessionId: string;
}

export interface UpdateExperienceResponse {
  experience: ExperienceResponse;
  staledAssessments: StaleAssessmentInfo[];
}

export interface ExperiencePage {
  items: ExperienceResponse[];
  nextCursor?: string;
}
