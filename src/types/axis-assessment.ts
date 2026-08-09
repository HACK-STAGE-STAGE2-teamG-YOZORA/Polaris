// docs/openapi.yaml の AxisAssessment 系スキーマに対応する型定義。
// セッション4軸結果画面（GET /axis-assessments, PATCH /axis-assessments/{id}）が使う。
import type { AxisPole, EvidenceSupportType } from "./analysis-session";
import type { AxisPosition, SelfAnalysisAxis } from "./dashboard";

// CONFIRMED_PATTERN=確認済み根拠あり、CURRENT_HYPOTHESIS=根拠が少ない/矛盾/本人確認不足、
// INSUFFICIENT_EVIDENCE=判断材料不足
export type AxisAssessmentStatus =
  | "CONFIRMED_PATTERN"
  | "CURRENT_HYPOTHESIS"
  | "INSUFFICIENT_EVIDENCE";

// UNREVIEWEDは本人評価がまだ保存されていない状態。
// docs/product-scope.md のとおり、UNREVIEWEDの軸が残るセッションはfinalizeできない
export type UserAssessment =
  | "UNREVIEWED"
  | "MATCHES"
  | "PARTIALLY_MATCHES"
  | "DOES_NOT_MATCH"
  | "NEEDS_EXPLORATION";

// 軸の位置を支える正式根拠。experienceId経由で確認済み経験へ、
// messageId経由でユーザー原文へ遡れる（手入力の経験ではmessageIdがnull）
export interface EvidenceReference {
  id: string;
  experienceId: string;
  messageId: string | null;
  axis: SelfAnalysisAxis;
  pole: AxisPole;
  supportType: EvidenceSupportType;
  quote: string;
  interpretation: string;
}

export interface AxisAssessment {
  id: string;
  sourceSessionId: string;
  axis: SelfAnalysisAxis;
  position: AxisPosition;
  // aiStatementは監査用の原文。画面にはユーザー修正を反映したdisplayStatementを出す
  aiStatement: string;
  displayStatement: string;
  status: AxisAssessmentStatus;
  leftEvidence: EvidenceReference[];
  rightEvidence: EvidenceReference[];
  bothEvidence: EvidenceReference[];
  contextEvidence: EvidenceReference[];
  counterEvidence: EvidenceReference[];
  leftConditions: string[];
  rightConditions: string[];
  contextNotes: string[];
  userAssessment: UserAssessment;
  userNote: string | null;
  // 本人評価後に会話を続けた場合など、再生成が必要になるとtrueになる
  isStale: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AxisAssessmentPage {
  items: AxisAssessment[];
}

export interface ReviewAxisAssessmentRequest {
  assessment: UserAssessment;
  editedStatement?: string;
  note?: string;
}
