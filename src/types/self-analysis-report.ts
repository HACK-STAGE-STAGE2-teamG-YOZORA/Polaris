// docs/openapi.yaml の SelfAnalysisReport に対応する型定義。
// finalize（POST /analysis-sessions/{id}/finalize）のレスポンスとして返る、
// そのセッション1件分の自己分析レポート。
import type { AxisAssessmentStatus, UserAssessment } from "./axis-assessment";
import type { AxisPosition, ResultFreshness, SelfAnalysisAxis } from "./dashboard";

// レポート確定時点の軸の状態を固定したもの。以後の再評価では書き換えない
export interface AxisAssessmentSnapshot {
  axisAssessmentId: string;
  axis: SelfAnalysisAxis;
  position: AxisPosition;
  displayStatement: string;
  status: AxisAssessmentStatus;
  userAssessment: UserAssessment;
  evidenceIds: string[];
}

// 根拠となった軸分析IDを必ず伴う条件文。根拠のない条件は作らない
export interface CareerCondition {
  statement: string;
  axisAssessmentIds: string[];
}

// GET /self-analysis-reports の一覧項目。sourceSessionIdで絞り込むと0〜1件になる
export interface SelfAnalysisReportSummary {
  id: string;
  sourceSessionId: string;
  summary: string;
  userMessageCount: number;
  confirmedExperienceCount: number;
  freshness: ResultFreshness;
  generatedAt: string;
}

export interface SelfAnalysisReport {
  id: string;
  sourceSessionId: string;
  summary: string;
  axes: AxisAssessmentSnapshot[];
  mustConditions: CareerCondition[];
  preferConditions: CareerCondition[];
  avoidConditions: CareerCondition[];
  verifyConditions: CareerCondition[];
  nextExperiments: string[];
  userMessageCount: number;
  confirmedExperienceCount: number;
  freshness: ResultFreshness;
  generatedAt: string;
}
