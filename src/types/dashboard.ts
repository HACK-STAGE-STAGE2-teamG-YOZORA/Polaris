export type AnalysisSessionStatus = 'ACTIVE' | 'READY_TO_FINALIZE' | 'COMPLETED' | 'ABANDONED';

export type SelfAnalysisAxis =
  | 'ENERGY_SOURCE'
  | 'ACTION_STYLE'
  | 'SATISFACTION_SOURCE'
  | 'PREFERRED_ENVIRONMENT';

export type ExperienceType =
  | 'ENGAGED'
  | 'ACHIEVEMENT'
  | 'CHALLENGE'
  | 'DRAINING_SUCCESS'
  | 'TEAM_CONFLICT'
  | 'OTHER';

export type AxisPosition =
  | 'LEFT'
  | 'LEANS_LEFT'
  | 'BALANCED_OR_BOTH'
  | 'LEANS_RIGHT'
  | 'RIGHT'
  | 'CONTEXT_DEPENDENT'
  | 'INSUFFICIENT_EVIDENCE';

export type ResultFreshness = 'CURRENT' | 'STALE';

export type DataWarningReason = 'FEW_COMPLETED_SESSIONS' | 'FEW_CONFIRMED_EXPERIENCES';

export type EsDocumentStatus = 'DRAFT' | 'ANALYZED' | 'REVISED' | 'VERIFIED';

export interface AnalysisProgress {
  userMessageCount: number;
  confirmedExperienceCount: number;
  canGenerateResult: boolean;
  coveredExperienceTypes: ExperienceType[];
  missingAxes: SelfAnalysisAxis[];
}

export interface AnalysisSessionResponse {
  id: string;
  title: string;
  status: AnalysisSessionStatus;
  targetAxes: SelfAnalysisAxis[];
  progress: AnalysisProgress;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface OverallAxisTrend {
  axis: SelfAnalysisAxis;
  position: AxisPosition;
  statement: string;
  sourceReportIds: string[];
  evidenceIds: string[];
  contextNotes: string[];
}

export interface ProfileInsight {
  title: string;
  description: string;
  axes: SelfAnalysisAxis[];
  sourceReportIds: string[];
  evidenceIds: string[];
}

export interface OverallDataSummary {
  completedSessionCount: number;
  userMessageCount: number;
  confirmedExperienceCount: number;
  isDataSparse: boolean;
  warningReasons: DataWarningReason[];
}

export interface OverallSelfAnalysisProfileResponse {
  id: string;
  summary: string;
  axes: OverallAxisTrend[];
  strengths: ProfileInsight[];
  weaknesses: ProfileInsight[];
  dataSummary: OverallDataSummary;
  sourceReportIds: string[];
  freshness: ResultFreshness;
  generatedAt: string;
}

export interface EsDocumentSummary {
  id: string;
  companyId: string | null;
  targetRole: string | null;
  question: string;
  characterLimit: number;
  characterCount: number;
  status: EsDocumentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardResponse {
  activeSession: AnalysisSessionResponse | null;
  overallProfile: OverallSelfAnalysisProfileResponse | null;
  recentEsDocuments: EsDocumentSummary[];
}
