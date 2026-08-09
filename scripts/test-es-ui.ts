import assert from "node:assert/strict";

import {
  determineRevisionWorkflowStage,
  fingerprintEsRequest,
  restoreEsWorkflow,
  textForRange,
} from "../src/app/(screens)/es-revision/es-revision-logic.ts";
import type { EsAnalysis, EsDocument, EsRevision } from "../src/types/es-document.ts";

const request = {
  companyId: null,
  targetRole: null,
  question: "学生時代に力を入れたこと",
  characterLimit: 400,
  originalText: "チームで改善しました。",
  preferredExperienceIds: ["b", "a"],
};
const fingerprint = fingerprintEsRequest(request);

assert.equal(
  fingerprint,
  fingerprintEsRequest({ ...request, preferredExperienceIds: ["a", "b"] }),
  "経験IDの選択順だけでは別のES入力として扱わないこと",
);
assert.equal(
  determineRevisionWorkflowStage(
    { hasDocument: false, hasOriginalAnalysis: false, hasRevision: false, requestFingerprint: null },
    fingerprint,
  ),
  "CREATE",
);
assert.equal(
  determineRevisionWorkflowStage(
    { hasDocument: true, hasOriginalAnalysis: false, hasRevision: false, requestFingerprint: fingerprint },
    fingerprint,
  ),
  "ANALYZE",
  "文書作成後の再試行で文書を重複作成しないこと",
);
assert.equal(
  determineRevisionWorkflowStage(
    { hasDocument: true, hasOriginalAnalysis: true, hasRevision: false, requestFingerprint: fingerprint },
    fingerprint,
  ),
  "REVISE",
  "原文分析後の再試行で分析を重複保存しないこと",
);
assert.equal(
  determineRevisionWorkflowStage(
    { hasDocument: true, hasOriginalAnalysis: true, hasRevision: false, requestFingerprint: fingerprint },
    fingerprintEsRequest({ ...request, originalText: "入力を修正しました。" }),
  ),
  "UPDATE",
  "入力変更時は作成済み下書きを更新すること",
);
assert.equal(textForRange("A😀BC", { startOffset: 1, endOffset: 3 }), "😀B", "範囲はUnicodeコードポイントで扱うこと");
assert.equal(textForRange("A\r\nB", { startOffset: 1, endOffset: 2 }), "\n", "CRLFをLFへ正規化すること");
assert.equal(textForRange("abc", { startOffset: 2, endOffset: 5 }), null, "不正な範囲を表示しないこと");

const baseAnalysis: EsAnalysis = {
  id: "original-analysis",
  esDocumentId: "document",
  revisionId: null,
  sourceKind: "ORIGINAL",
  freshness: "CURRENT",
  characterCount: 12,
  withinCharacterLimit: true,
  questionCoverage: "ANSWERED",
  submissionReadiness: "NEEDS_REVIEW",
  claims: [],
  issues: [],
  comments: [],
  createdAt: "2026-08-09T00:00:00.000Z",
};
const baseRevision: EsRevision = {
  id: "revision",
  esDocumentId: "document",
  basedOnAnalysisId: baseAnalysis.id,
  freshness: "CURRENT",
  revisedText: "推敲後の文章",
  usedExperienceIds: [],
  usedSessionReportIds: [],
  characterCount: 7,
  changes: [],
  unsupportedClaims: [],
  verificationAnalysisId: null,
  createdAt: "2026-08-09T00:01:00.000Z",
};
const verificationAnalysis: EsAnalysis = {
  ...baseAnalysis,
  id: "verification",
  revisionId: baseRevision.id,
  sourceKind: "REVISION",
  submissionReadiness: "READY_TO_SUBMIT",
};
const baseDocument: EsDocument = {
  id: "document",
  companyId: null,
  targetRole: null,
  question: request.question,
  characterLimit: request.characterLimit,
  characterCount: 12,
  status: "DRAFT",
  createdAt: "2026-08-09T00:00:00.000Z",
  updatedAt: "2026-08-09T00:00:00.000Z",
  originalText: request.originalText,
  preferredExperienceIds: request.preferredExperienceIds,
  emphasis: [],
  analyses: [],
  revisions: [],
};

assert.equal(restoreEsWorkflow(baseDocument).step, "INPUT", "未検査の保存済みESは入力から再開すること");
assert.equal(
  restoreEsWorkflow({ ...baseDocument, analyses: [baseAnalysis], status: "ANALYZED" }).step,
  "ANALYSIS",
  "原文検査済みESは検査結果から再開すること",
);
assert.equal(
  restoreEsWorkflow({ ...baseDocument, analyses: [baseAnalysis], revisions: [baseRevision], status: "REVISED" }).step,
  "RESULT",
  "推敲済みESは完成版から再開すること",
);
assert.equal(
  restoreEsWorkflow({
    ...baseDocument,
    analyses: [verificationAnalysis, baseAnalysis],
    revisions: [baseRevision],
    status: "VERIFIED",
  }).step,
  "COMMENTS",
  "再検査済みESは最終コメントから再開すること",
);
assert.equal(
  restoreEsWorkflow({
    ...baseDocument,
    analyses: [{ ...baseAnalysis, freshness: "STALE" }],
    revisions: [{ ...baseRevision, freshness: "STALE" }],
    status: "REVISED",
  }).step,
  "INPUT",
  "古い履歴だけのESは入力を保持して再検査へ戻すこと",
);

console.log("ES frontend workflow/range contracts: OK");
