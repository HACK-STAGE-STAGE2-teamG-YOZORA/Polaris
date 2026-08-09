// docs/openapi.yaml の /api/v1/es-documents, /api/v1/es-documents/{id}/analyses,
// /api/v1/es-documents/{id}/revisions, /api/v1/es-revisions/{id}/verify,
// /api/v1/es-text-extractions, /api/v1/es-revision-context 系スキーマに対応する型定義。

import type { CompanyPage } from "@/types/company";
import type { ExperiencePage } from "@/types/experience";

export type EsDocumentStatus = "DRAFT" | "ANALYZED" | "REVISED" | "VERIFIED";

export type ResultFreshness = "CURRENT" | "STALE";

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

export interface EsDocumentPage {
  items: EsDocumentSummary[];
}

export interface EsDocument extends EsDocumentSummary {
  originalText: string;
  preferredExperienceIds: string[];
  emphasis: string[];
  analyses: EsAnalysis[];
  revisions: EsRevision[];
}

// GET /api/v1/es-revision-context のレスポンス。
// ESタブの初期表示に必要な一覧を、認証確認1回でまとめて受け取る
export interface EsRevisionContext {
  companies: CompanyPage;
  // 根拠候補として使う確認済み経験だけが入る
  experiences: ExperiencePage;
  documents: EsDocumentPage;
  // documentId未指定時はnull
  selectedDocument: EsDocument | null;
}

// companyIdは任意。未指定時は本人経験だけを検査し、企業主張は確認済みにしない(docs/openapi.yaml参照)
export interface CreateEsDocumentRequest {
  companyId?: string | null;
  targetRole?: string | null;
  question: string;
  characterLimit: number;
  originalText: string;
  preferredExperienceIds?: string[];
  emphasis?: string[];
}

export interface UpdateEsDocumentRequest {
  companyId?: string | null;
  targetRole?: string | null;
  question?: string;
  characterLimit?: number;
  originalText?: string;
  preferredExperienceIds?: string[];
  emphasis?: string[];
}

export type ClaimType =
  | "PERSONAL_FACT"
  | "NUMBER"
  | "PERIOD"
  | "ROLE"
  | "RESULT"
  | "CAPABILITY"
  | "COMPANY_FACT"
  | "MOTIVATION"
  | "FUTURE_GOAL";

export type ClaimStatus = "VERIFIED" | "PARTIALLY_VERIFIED" | "NEEDS_CONFIRMATION" | "CONTRADICTED";

export interface ClaimEvidence {
  sourceType: "EXPERIENCE" | "COMPANY_FACT";
  sourceId: string;
  quote: string;
}

export interface EsClaim {
  id: string;
  sentence: string;
  text: string;
  type: ClaimType;
  status: ClaimStatus;
  evidence: ClaimEvidence[];
  explanation: string | null;
  targetRange: TextRange | null;
}

export type EsIssueCode =
  | "QUESTION_NOT_ANSWERED"
  | "UNSUPPORTED_PERSONAL_FACT"
  | "UNSUPPORTED_COMPANY_FACT"
  | "CONTRADICTION"
  | "ABSTRACT_EXPRESSION"
  | "REDUNDANT_EXPRESSION"
  | "CHARACTER_LIMIT_EXCEEDED"
  | "CHARACTER_LIMIT_UNDERUSED"
  | "VOICE_DEVIATION";

export type EsIssueSeverity = "ERROR" | "WARNING" | "INFO";

export interface TextRange {
  startOffset: number;
  endOffset: number;
}

export interface EsIssue {
  code: EsIssueCode;
  severity: EsIssueSeverity;
  message: string;
  sentence: string | null;
  targetRange: TextRange | null;
  relatedClaimIds: string[];
}

export type QuestionCoverage = "ANSWERED" | "PARTIALLY_ANSWERED" | "NOT_ANSWERED";

// 数値スコアではなく、設問回答状況・文字数・全主張の根拠を決定的に検査した結果
export type SubmissionReadiness = "READY_TO_SUBMIT" | "NEEDS_REVIEW";

export type EsAiCommentCategory = "EVIDENCE_STATUS" | "ISSUE" | "IMPROVEMENT_REASON";

// 完成版ESの下へ、根拠状態・問題箇所・改善理由として表示するAIコメント(docs/openapi.yaml EsAiComment)
export interface EsAiComment {
  category: EsAiCommentCategory;
  message: string;
  severity: EsIssueSeverity;
  targetRange: TextRange | null;
  evidence: ClaimEvidence[];
}

export interface EsAnalysis {
  id: string;
  esDocumentId: string;
  revisionId: string | null;
  sourceKind: "ORIGINAL" | "REVISION";
  freshness: ResultFreshness;
  characterCount: number;
  withinCharacterLimit: boolean;
  questionCoverage: QuestionCoverage;
  submissionReadiness: SubmissionReadiness;
  claims: EsClaim[];
  issues: EsIssue[];
  comments: EsAiComment[];
  createdAt: string;
}

export interface CreateEsRevisionRequest {
  emphasis?: string[];
  // 必ず残したい本人の表現
  preserveExpressions?: string[];
}

export type RevisionDecision = "PENDING" | "ACCEPTED" | "REJECTED";

export interface RevisionChange {
  id: string;
  before: string;
  after: string;
  reason: string;
  evidence: ClaimEvidence[];
  decision: RevisionDecision;
}

export interface EsRevision {
  id: string;
  esDocumentId: string;
  basedOnAnalysisId: string;
  freshness: ResultFreshness;
  revisedText: string;
  usedExperienceIds: string[];
  usedSessionReportIds: string[];
  characterCount: number;
  changes: RevisionChange[];
  unsupportedClaims: EsClaim[];
  verificationAnalysisId: string | null;
  createdAt: string;
}

// POST /api/v1/es-text-extractions (docs/openapi.yaml参照)
export type EsInputSourceType = "PNG" | "JPEG" | "PDF";

export type EsTextExtractionMethod = "OCR" | "PDF_TEXT" | "PDF_TEXT_WITH_OCR";

export interface EsTextExtraction {
  sourceType: EsInputSourceType;
  extractionMethod: EsTextExtractionMethod;
  originalFilename: string;
  // PDFの場合はページ数、画像の場合はnull
  pageCount: number | null;
  extractedText: string;
  characterCount: number;
  requiresReview: true;
  warnings: string[];
}
