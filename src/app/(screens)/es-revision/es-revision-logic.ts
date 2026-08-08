import type { CreateEsDocumentRequest, TextRange } from "../../../types/es-document";

export type RevisionWorkflowStage = "CREATE" | "UPDATE" | "ANALYZE" | "REVISE" | "DONE";

export interface RevisionWorkflowSnapshot {
  hasDocument: boolean;
  hasOriginalAnalysis: boolean;
  hasRevision: boolean;
  requestFingerprint: string | null;
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

export function textForRange(text: string, range: TextRange | null): string | null {
  if (!range) return null;
  const codePoints = [...text.replace(/\r\n?/gu, "\n")];
  if (range.startOffset < 0 || range.endOffset <= range.startOffset || range.endOffset > codePoints.length) {
    return null;
  }
  return codePoints.slice(range.startOffset, range.endOffset).join("");
}
