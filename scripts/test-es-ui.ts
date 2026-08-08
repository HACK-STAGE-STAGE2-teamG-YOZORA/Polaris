import assert from "node:assert/strict";

import {
  determineRevisionWorkflowStage,
  fingerprintEsRequest,
  textForRange,
} from "../src/app/(screens)/es-revision/es-revision-logic.ts";

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

console.log("ES frontend workflow/range contracts: OK");
