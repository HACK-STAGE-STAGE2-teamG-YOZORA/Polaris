import type {
  CreateEsDocumentRequest,
  EsAnalysis,
  EsDocument,
  EsRevision,
  TextRange,
} from "../../../types/es-document";

export type RevisionWorkflowStage = "CREATE" | "UPDATE" | "ANALYZE" | "REVISE" | "DONE";

export interface RevisionWorkflowSnapshot {
  hasDocument: boolean;
  hasOriginalAnalysis: boolean;
  hasRevision: boolean;
  requestFingerprint: string | null;
}

export type RestoredEsStep = "INPUT" | "ANALYSIS" | "RESULT" | "COMMENTS";

export interface RestoredEsWorkflow {
  step: RestoredEsStep;
  originalAnalysis: EsAnalysis | null;
  revision: EsRevision | null;
  verificationAnalysis: EsAnalysis | null;
}

function sorted(values: string[] | undefined): string[] {
  return [...(values ?? [])].sort((left, right) => left.localeCompare(right));
}

export function fingerprintEsRequest(request: CreateEsDocumentRequest): string {
  return JSON.stringify({
    companyId: request.companyId ?? null,
    targetRole: request.targetRole ?? null,
    question: request.question,
    characterLimit: request.characterLimit,
    originalText: request.originalText,
    preferredExperienceIds: sorted(request.preferredExperienceIds),
    emphasis: request.emphasis ?? [],
  });
}

export function determineRevisionWorkflowStage(
  snapshot: RevisionWorkflowSnapshot,
  nextRequestFingerprint: string,
): RevisionWorkflowStage {
  if (!snapshot.hasDocument) return "CREATE";
  if (snapshot.requestFingerprint !== nextRequestFingerprint) return "UPDATE";
  if (!snapshot.hasOriginalAnalysis) return "ANALYZE";
  if (!snapshot.hasRevision) return "REVISE";
  return "DONE";
}

// 保存済みESはCURRENTの履歴だけを作業状態へ復元する。関連データが更新されて
// すべてSTALEになった場合は、入力内容を残したまま再検査できるINPUTへ戻す。
export function restoreEsWorkflow(document: EsDocument): RestoredEsWorkflow {
  const originalAnalysis = document.analyses.find(
    (analysis) =>
      analysis.sourceKind === "ORIGINAL" &&
      analysis.revisionId === null &&
      analysis.freshness === "CURRENT",
  ) ?? null;
  const revision = document.revisions.find((item) => item.freshness === "CURRENT") ?? null;
  const verificationAnalysis = revision
    ? document.analyses.find(
        (analysis) =>
          analysis.sourceKind === "REVISION" &&
          analysis.revisionId === revision.id &&
          analysis.freshness === "CURRENT",
      ) ?? null
    : null;

  return {
    step: verificationAnalysis
      ? "COMMENTS"
      : revision
        ? "RESULT"
        : originalAnalysis
          ? "ANALYSIS"
          : "INPUT",
    originalAnalysis,
    revision,
    verificationAnalysis,
  };
}

export function textForRange(text: string, range: TextRange | null): string | null {
  if (!range) return null;
  const codePoints = [...text.replace(/\r\n?/gu, "\n")];
  if (range.startOffset < 0 || range.endOffset <= range.startOffset || range.endOffset > codePoints.length) {
    return null;
  }
  return codePoints.slice(range.startOffset, range.endOffset).join("");
}
