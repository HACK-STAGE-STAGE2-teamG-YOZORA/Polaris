import { randomUUID } from "node:crypto";
import { withE2eServer, type ApiResult } from "./e2e-harness.ts";

type JsonObject = Record<string, unknown>;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function object(value: unknown, label: string): JsonObject {
  assert(typeof value === "object" && value !== null && !Array.isArray(value), `${label}がobjectではありません。`);
  return value as JsonObject;
}

function items(value: unknown, label: string): JsonObject[] {
  assert(Array.isArray(value), `${label}が配列ではありません。`);
  return value.map((item, index) => object(item, `${label}[${index}]`));
}

function text(value: unknown, label: string): string {
  assert(typeof value === "string" && value.length > 0, `${label}が空です。`);
  return value;
}

function expectStatus(result: ApiResult, expected: number, label: string): JsonObject {
  assert(
    result.status === expected,
    `${label}: HTTP ${expected}を期待しましたが${result.status}でした。\n${JSON.stringify(result.body, null, 2)}`,
  );
  return object(result.body, label);
}

function expectProblem(result: ApiResult, expectedStatus: number, expectedCode: string, label: string): JsonObject {
  const body = expectStatus(result, expectedStatus, label);
  assert(result.contentType?.includes("application/problem+json"), `${label}: Problem Details形式ではありません。`);
  assert(body.code === expectedCode, `${label}: codeが${expectedCode}ではありません。`);
  assert(typeof body.requestId === "string" && /^[0-9a-f-]{36}$/iu.test(body.requestId), `${label}: requestIdがUUIDではありません。`);
  assert(typeof body.retryable === "boolean", `${label}: retryableがありません。`);
  assert(Array.isArray(body.details), `${label}: detailsが配列ではありません。`);
  return body;
}

await withE2eServer(async ({ request }) => {
  console.log("[1/4] 自己分析チャットと体験確認を検証します。");

  const health = expectStatus(await request("/api/v1/system/health"), 200, "health");
  assert(object(health.database, "health.database").status === "UP", "テストDBへ接続できません。");
  assert(object(health.ai, "health.ai").status === "UP", "LM Studioへ接続できません。");

  const session = expectStatus(await request("/api/v1/analysis-sessions", {
    method: "POST",
    body: { startMode: "START_NEW", title: "P0 E2E自己分析" },
  }), 201, "create session");
  const sessionId = text(session.id, "session.id");

  expectProblem(await request(`/api/v1/analysis-sessions/${sessionId}/finalize`, { method: "POST" }), 409, "CONFLICT", "finalize without messages");

  const clientMessageId = randomUUID();
  const experienceStory =
    "大学2年の授業で、4人チームで6週間かけてWebアプリを開発しました。" +
    "私はリーダーとバックエンドを担当しました。期限内に提出して発表を成功させることが目標でした。" +
    "均等分担と得意分野別分担を検討し、遅延を避けるため得意分野別に分担して毎週進捗確認する方針を選びました。" +
    "私はAPI設計、タスク分解、週2回の進捗確認を行いました。期限内に完成し、授業の発表代表に選ばれました。" +
    "途中は遅れが不安でしたが、完成時はとても達成感があり、かなり元気が出ました。少人数で役割が明確な環境が取り組みやすかったです。";

  const turnResult = await request(`/api/v1/analysis-sessions/${sessionId}/messages`, {
    method: "POST",
    body: { content: experienceStory, clientMessageId },
  });
  const turn = expectStatus(turnResult, 200, "send message");
  const userMessage = object(turn.userMessage, "turn.userMessage");
  const assistantMessage = object(turn.assistantMessage, "turn.assistantMessage");
  const userMessageId = text(userMessage.id, "userMessage.id");
  assert((text(assistantMessage.content, "assistantMessage.content").match(/[？?]/gu) ?? []).length === 1, "AI応答の質問数が1つではありません。");
  assert(Array.isArray(turn.evidenceCandidates), "evidenceCandidatesが配列ではありません。");

  const repeated = expectStatus(await request(`/api/v1/analysis-sessions/${sessionId}/messages`, {
    method: "POST",
    body: { content: experienceStory, clientMessageId },
  }), 200, "idempotent resend");
  assert(object(repeated.userMessage, "repeated.userMessage").id === userMessageId, "冪等再送でUSERメッセージが重複しました。");
  assert(object(repeated.assistantMessage, "repeated.assistantMessage").id === assistantMessage.id, "冪等再送でAI応答が重複しました。");

  expectProblem(await request(`/api/v1/analysis-sessions/${sessionId}/messages`, {
    method: "POST",
    body: { content: `${experienceStory}追記`, clientMessageId },
  }), 409, "CONFLICT", "clientMessageId conflict");

  const draft = expectStatus(await request(`/api/v1/analysis-sessions/${sessionId}/experience-drafts`, {
    method: "POST",
    body: { experienceType: "ENGAGED", messageIds: [userMessageId] },
  }), 201, "create experience draft");
  const experienceId = text(draft.id, "experience.id");
  assert(draft.status === "DRAFT", "抽出直後の経験がDRAFTではありません。");
  assert(draft.type === "ENGAGED", "抽出した経験種別が要求と一致しません。");

  const confirmedPayload = expectStatus(await request(`/api/v1/experiences/${experienceId}`, {
    method: "PATCH",
    body: { status: "CONFIRMED" },
  }), 200, "confirm experience");
  const confirmed = object(confirmedPayload.experience, "confirmed experience");
  assert(confirmed.status === "CONFIRMED", "経験をCONFIRMEDへ変更できませんでした。");

  console.log("[2/4] 4軸生成、本人確認、レポート確定、総合分析を検証します。");

  const generated = expectStatus(await request(`/api/v1/analysis-sessions/${sessionId}/axis-assessments/generate`, {
    method: "POST",
  }), 200, "generate axes");
  const assessments = items(generated.items, "axis assessments");
  assert(assessments.length === 4, `4軸が${assessments.length}件生成されました。`);
  assert(new Set(assessments.map((assessment) => assessment.axis)).size === 4, "4軸のaxisが重複しています。");

  expectProblem(await request(`/api/v1/analysis-sessions/${sessionId}/finalize`, { method: "POST" }), 409, "CONFLICT", "finalize before review");

  for (const assessment of assessments) {
    const assessmentId = text(assessment.id, "axisAssessment.id");
    const reviewed = expectStatus(await request(`/api/v1/axis-assessments/${assessmentId}`, {
      method: "PATCH",
      body: { assessment: "MATCHES", note: "E2Eで本人確認済み" },
    }), 200, `review ${String(assessment.axis)}`);
    assert(reviewed.userAssessment === "MATCHES", "本人評価が保存されませんでした。");
  }

  const continued = expectStatus(await request(`/api/v1/analysis-sessions/${sessionId}/messages`, {
    method: "POST",
    body: {
      content: "追加で、進捗が遅れたメンバーとは個別に相談し、担当範囲を組み替えて全員が納得できる形に調整しました。",
      clientMessageId: randomUUID(),
    },
  }), 200, "continue after review");
  assert(object(continued.userMessage, "continued.userMessage").role === "USER", "追加回答が保存されませんでした。");
  expectProblem(
    await request(`/api/v1/analysis-sessions/${sessionId}/finalize`, { method: "POST" }),
    409,
    "CONFLICT",
    "finalize after additional answer",
  );

  const regenerated = expectStatus(await request(`/api/v1/analysis-sessions/${sessionId}/axis-assessments/generate`, {
    method: "POST",
  }), 200, "regenerate axes after additional answer");
  const regeneratedAssessments = items(regenerated.items, "regenerated axis assessments");
  assert(regeneratedAssessments.length === 4, "再生成後の4軸が揃っていません。");
  for (const assessment of regeneratedAssessments) {
    const assessmentId = text(assessment.id, "regenerated axisAssessment.id");
    const reviewed = expectStatus(await request(`/api/v1/axis-assessments/${assessmentId}`, {
      method: "PATCH",
      body: { assessment: "MATCHES", note: "追加回答反映後に再確認済み" },
    }), 200, `review regenerated ${String(assessment.axis)}`);
    assert(reviewed.userAssessment === "MATCHES", "再生成後の本人評価が保存されませんでした。");
  }

  const report = expectStatus(await request(`/api/v1/analysis-sessions/${sessionId}/finalize`, {
    method: "POST",
  }), 200, "finalize session");
  const reportId = text(report.id, "report.id");
  assert(report.sourceSessionId === sessionId, "レポートのsourceSessionIdが不正です。");
  assert(report.userMessageCount === 2, "追加回答を含むUSERメッセージ件数が不正です。");
  assert(report.confirmedExperienceCount === 1, "確認済み経験件数が不正です。");
  assert(items(report.axes, "report.axes").length === 4, "レポートに4軸がありません。");
  expectProblem(await request(`/api/v1/analysis-sessions/${sessionId}/finalize`, { method: "POST" }), 409, "CONFLICT", "duplicate finalize");

  const profile = expectStatus(await request("/api/v1/overall-self-analysis/recompute", {
    method: "POST",
  }), 200, "recompute overall profile");
  assert(items(profile.axes, "overallProfile.axes").length === 4, "総合プロフィールに4軸がありません。");
  const dataSummary = object(profile.dataSummary, "overallProfile.dataSummary");
  assert(dataSummary.completedSessionCount === 1, "完了セッション件数が不正です。");
  assert(dataSummary.confirmedExperienceCount === 1, "総合プロフィールの経験件数が不正です。");
  assert(dataSummary.isDataSparse === true, "ADR-032のデータ不足表示がありません。");
  assert(Array.isArray(profile.sourceReportIds) && profile.sourceReportIds.includes(reportId), "総合プロフィールが確定レポートを参照していません。");

  const dashboard = expectStatus(await request("/api/v1/dashboard"), 200, "dashboard");
  assert(dashboard.activeSession === null, "完了後もactiveSessionが残っています。");
  assert(object(dashboard.overallProfile, "dashboard.overallProfile").freshness === "CURRENT", "総合プロフィールがCURRENTではありません。");

  console.log("[3/4] ES検査、完成版生成、独立再検査を検証します。");

  const company = expectStatus(await request('/api/v1/companies', {
    method: 'POST',
    body: {
      name: 'Polarisデモ株式会社',
      targetRole: 'Webエンジニア',
      officialUrl: 'https://example.com',
    },
  }), 201, 'create ES company');
  const companyId = text(company.id, 'company.id');
  const companyImport = expectStatus(await request(`/api/v1/companies/${companyId}/sources/text`, {
    method: 'POST',
    body: {
      title: '公式採用方針',
      sourceUrl: 'https://example.com/careers',
      trustLevel: 'OFFICIAL',
      text: '公式採用ページでは、職種を越えた協働と、根拠を明確にした設計レビューを重視すると説明しています。',
    },
  }), 201, 'import company text');
  assert(items(companyImport.facts, 'companyImport.facts').length > 0, '企業公式情報から事実を抽出できませんでした。');

  expectProblem(await request("/api/v1/es-documents", {
    method: "POST",
    body: {
      question: "チームで取り組んだ経験を300字以内で説明してください。",
      characterLimit: 300,
      originalText: experienceStory,
      preferredExperienceIds: [randomUUID()],
    },
  }), 422, "VALIDATION_ERROR", "unconfirmed preferred experience");

  const esDocument = expectStatus(await request("/api/v1/es-documents", {
    method: "POST",
    body: {
      companyId,
      targetRole: "Webエンジニア",
      question: "チームで取り組んだ経験を300字以内で説明してください。",
      characterLimit: 300,
      originalText: `${experienceStory}この経験を生かし、職種を越えた協働を重視する貴社でも、根拠を明確にした設計レビューへ貢献したいです。`,
      preferredExperienceIds: [experienceId],
      emphasis: ["役割", "行動", "結果"],
    },
  }), 201, "create ES document");
  const esDocumentId = text(esDocument.id, "esDocument.id");

  const analysis = expectStatus(await request(`/api/v1/es-documents/${esDocumentId}/analyses`, {
    method: "POST",
  }), 201, "analyze ES");
  const analysisId = text(analysis.id, "analysis.id");
  assert(analysis.esDocumentId === esDocumentId, "ES分析の文書IDが不正です。");
  assert(Array.isArray(analysis.claims), "ES分析のclaimsが配列ではありません。");
  assert(Array.isArray(analysis.comments), "ES分析のcommentsが配列ではありません。");

  const revision = expectStatus(await request(`/api/v1/es-documents/${esDocumentId}/revisions`, {
    method: "POST",
    body: { emphasis: ["役割", "行動", "結果"], preserveExpressions: ["API設計"] },
  }), 201, "revise ES");
  const revisionId = text(revision.id, "revision.id");
  const revisedText = text(revision.revisedText, "revision.revisedText");
  assert(revision.basedOnAnalysisId === analysisId, "推敲案が最新分析を参照していません。");
  assert(revision.characterCount === [...revisedText.replace(/\r\n?/g, "\n")].length, "ES文字数がUnicodeコードポイント数と一致しません。");
  assert(Array.isArray(revision.usedExperienceIds), "usedExperienceIdsが配列ではありません。");
  assert(revision.usedExperienceIds.every((id) => id === experienceId), "推敲案が未確認の経験IDを使用しています。");

  const verification = expectStatus(await request(`/api/v1/es-revisions/${revisionId}/verify`, {
    method: "POST",
  }), 201, "verify revision");
  assert(verification.revisionId === revisionId, "再検査が推敲案を参照していません。");
  assert(verification.sourceKind === "REVISION", "推敲後の独立再検査になっていません。");
  const verificationClaims = items(verification.claims, 'verification.claims');
  const readinessConditionsMet = verification.withinCharacterLimit === true
    && verification.questionCoverage === 'ANSWERED'
    && verificationClaims.length > 0
    && verificationClaims.every((claim) => claim.status === 'VERIFIED');
  assert(
    verification.submissionReadiness === (readinessConditionsMet ? 'READY_TO_SUBMIT' : 'NEEDS_REVIEW'),
    `再検査の提出可否が決定条件と一致しません。${JSON.stringify({
      questionCoverage: verification.questionCoverage,
      claimStatuses: verificationClaims.map((claim) => ({ type: claim.type, status: claim.status })),
      issueCodes: items(verification.issues, 'verification.issues').map((issue) => issue.code),
    })}`,
  );

  console.log("[4/4] セッション境界と未確定状態の異常系を検証します。");

  const secondSession = expectStatus(await request("/api/v1/analysis-sessions", {
    method: "POST",
    body: { startMode: "START_NEW", title: "境界検証" },
  }), 201, "create second session");
  const secondSessionId = text(secondSession.id, "secondSession.id");
  expectProblem(await request(`/api/v1/analysis-sessions/${secondSessionId}/experience-drafts`, {
    method: "POST",
    body: { experienceType: "ENGAGED", messageIds: [userMessageId] },
  }), 422, "VALIDATION_ERROR", "cross-session message");
  expectProblem(await request(`/api/v1/analysis-sessions/${secondSessionId}/finalize`, { method: "POST" }), 409, "CONFLICT", "empty second session finalize");

  const secondTurn = expectStatus(await request(`/api/v1/analysis-sessions/${secondSessionId}/messages`, {
    method: 'POST',
    body: {
      content: '今回はまだ具体的な経験を整理できていませんが、まず考え方の傾向だけ確認したいです。',
      clientMessageId: randomUUID(),
    },
  }), 200, 'second session message');
  assert(object(secondTurn.userMessage, 'secondTurn.userMessage').role === 'USER', '2件目セッションの回答が保存されませんでした。');
  const sparseAxes = expectStatus(await request(`/api/v1/analysis-sessions/${secondSessionId}/axis-assessments/generate`, {
    method: 'POST',
  }), 200, 'generate axes without confirmed experience');
  const sparseAssessments = items(sparseAxes.items, 'sparse axes');
  assert(sparseAssessments.length === 4, '根拠不足時にも4軸が生成されませんでした。');
  assert(sparseAssessments.every((assessment) => assessment.position === 'INSUFFICIENT_EVIDENCE'), '経験0件の軸が根拠不足になっていません。');
  for (const assessment of sparseAssessments) {
    expectStatus(await request(`/api/v1/axis-assessments/${text(assessment.id, 'sparse assessment.id')}`, {
      method: 'PATCH',
      body: { assessment: 'NEEDS_EXPLORATION', note: '根拠不足を確認済み' },
    }), 200, 'review sparse axis');
  }
  const sparseReport = expectStatus(await request(`/api/v1/analysis-sessions/${secondSessionId}/finalize`, {
    method: 'POST',
  }), 200, 'finalize session without confirmed experience');
  assert(sparseReport.confirmedExperienceCount === 0, '経験0件のセッションレポートに経験が混入しました。');

  const twoSessionProfile = expectStatus(await request('/api/v1/overall-self-analysis/recompute', {
    method: 'POST',
  }), 200, 'recompute two-session profile');
  assert(object(twoSessionProfile.dataSummary, 'twoSessionProfile.dataSummary').completedSessionCount === 2, '複数セッションが総合分析へ集計されませんでした。');

  for (const index of [2, 3]) {
    const manual = expectStatus(await request('/api/v1/experiences', {
      method: 'POST',
      body: {
        type: index === 2 ? 'CHALLENGE' : 'ENGAGED',
        title: `追加確認経験${index}`,
        situation: `デモ用の確認済み経験${index}です。`,
        role: '本人',
        options: [],
        actions: [`行動${index}を実施した`],
        energyChange: 1,
        environment: ['デモ環境'],
      },
    }), 201, `create manual experience ${index}`);
    expectStatus(await request(`/api/v1/experiences/${text(manual.id, 'manual experience.id')}`, {
      method: 'PATCH',
      body: { status: 'CONFIRMED' },
    }), 200, `confirm manual experience ${index}`);
  }

  const enoughDataProfile = expectStatus(await request('/api/v1/overall-self-analysis/recompute', {
    method: 'POST',
  }), 200, 'recompute enough-data profile');
  const enoughDataSummary = object(enoughDataProfile.dataSummary, 'enoughDataProfile.dataSummary');
  assert(enoughDataSummary.completedSessionCount === 2, '十分データ時の完了セッション数が不正です。');
  assert(enoughDataSummary.confirmedExperienceCount === 3, '十分データ時の確認済み経験数が不正です。');
  assert(enoughDataSummary.isDataSparse === false, 'ADR-032のデータ十分状態へ遷移しませんでした。');

  console.log("P0自己分析・ES E2Eテスト成功");
});
