import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { withE2eServer, type ApiResult } from './e2e-harness.ts';

type JsonObject = Record<string, unknown>;
const seeded: { companyIds: string[]; sourceIds: string[]; experienceId?: string; revisionId?: string; changeId?: string } = {
  companyIds: [],
  sourceIds: [],
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function object(value: unknown, label: string): JsonObject {
  assert(typeof value === 'object' && value !== null && !Array.isArray(value), `${label}がobjectではありません。`);
  return value as JsonObject;
}

function expectStatus(result: ApiResult, expected: number, label: string): JsonObject {
  assert(result.status === expected, `${label}: HTTP ${expected}を期待しましたが${result.status}でした。\n${JSON.stringify(result.body, null, 2)}`);
  return object(result.body, label);
}

async function seed(databaseUrl: string, userId: string, schemaName: string): Promise<void> {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool, { schema: schemaName }) });
  try {
    await prisma.$transaction(async (transaction) => {
      const session = await transaction.analysisSession.create({
        data: {
          userId,
          title: 'P1 E2E',
          status: 'COMPLETED',
          targetAxes: ['ENERGY_SOURCE', 'ACTION_STYLE', 'SATISFACTION_SOURCE', 'PREFERRED_ENVIRONMENT'],
          completedAt: new Date(),
        },
      });
      const experience = await transaction.experience.create({
        data: {
          userId,
          sourceSessionId: session.id,
          type: 'ACHIEVEMENT',
          title: 'チーム開発の改善',
          situation: '4人チームでWebアプリを開発した。',
          role: 'API設計とタスク分解を担当した。',
          options: [],
          actions: ['APIを設計した', 'タスクを分解した'],
          result: '期限内に完成した。',
          energyChange: 1,
          environment: ['少人数チーム', '役割分担あり'],
          status: 'CONFIRMED',
          confirmedAt: new Date(),
        },
      });
      seeded.experienceId = experience.id;
      await transaction.selfAnalysisReport.create({
        data: {
          sourceSessionId: session.id,
          summary: '少人数チームで役割を明確にし、計画的に改善する経験を重視する。',
          axisSnapshots: [],
          mustConditions: ['役割が明確である'],
          preferConditions: ['改善提案ができる'],
          avoidConditions: ['役割が極端に曖昧である'],
          verifyConditions: ['若手の裁量範囲'],
          nextExperiments: [],
          userMessageCount: 1,
          confirmedExperienceCount: 1,
        },
      });

      for (const [index, name] of ['北極星テック', 'コンパスラボ', 'オーロラシステムズ'].entries()) {
        const company = await transaction.company.create({
          data: {
            userId,
            name,
            targetRole: 'バックエンドエンジニア',
            recommendationEligible: true,
          },
        });
        const quote = `${name}では若手社員による改善提案とチーム開発を歓迎します。`;
        const source = await transaction.companySource.create({
          data: {
            companyId: company.id,
            type: 'TEXT',
            trustLevel: 'OFFICIAL',
            title: `${name}採用情報`,
            rawText: quote,
            contentHash: `p1-e2e-${index}`,
            unknownItems: [],
            retrievedAt: new Date(),
          },
        });
        await transaction.companyFact.create({
          data: {
            companySourceId: source.id,
            category: 'WORK_ENVIRONMENT',
            fact: '若手社員の改善提案とチーム開発を歓迎する。',
            evidenceQuote: quote,
          },
        });
        seeded.companyIds.push(company.id);
        seeded.sourceIds.push(source.id);
      }

      const document = await transaction.esDocument.create({
        data: {
          userId,
          question: 'チームで取り組んだ経験を説明してください。',
          characterLimit: 300,
          originalText: '4人チームでAPI設計を担当しました。',
          preferredExperienceIds: [experience.id],
          emphasis: [],
          status: 'REVISED',
        },
      });
      const analysis = await transaction.esAnalysis.create({
        data: {
          esDocumentId: document.id,
          sourceKind: 'ORIGINAL',
          freshness: 'CURRENT',
          characterCount: 20,
          withinCharacterLimit: true,
          questionCoverage: 'ANSWERED',
          submissionReadiness: 'NEEDS_REVIEW',
          issues: [],
          comments: [],
        },
      });
      const revision = await transaction.esRevision.create({
        data: {
          esDocumentId: document.id,
          basedOnAnalysisId: analysis.id,
          freshness: 'CURRENT',
          revisedText: '4人チームでAPI設計とタスク分解を担当しました。',
          usedExperienceIds: [experience.id],
          usedSessionReportIds: [],
          characterCount: 26,
        },
      });
      const change = await transaction.revisionChange.create({
        data: {
          esRevisionId: revision.id,
          beforeText: 'API設計を担当',
          afterText: 'API設計とタスク分解を担当',
          reason: '確認済み経験を具体化するため',
          evidence: [{ sourceType: 'EXPERIENCE', sourceId: experience.id, quote: 'API設計とタスク分解を担当した。' }],
        },
      });
      seeded.revisionId = revision.id;
      seeded.changeId = change.id;
    });
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

await withE2eServer(async ({ request }) => {
  console.log('[1/4] URL取込のP1制約を検証します。');
  expectStatus(await request(`/api/v1/companies/${seeded.companyIds[0]}/sources/url`, {
    method: 'POST',
    body: { url: 'http://127.0.0.1/private', trustLevel: 'OFFICIAL' },
  }), 400, 'unsafe URL');
  expectStatus(await request(`/api/v1/companies/${seeded.companyIds[0]}/sources/url`, {
    method: 'POST',
    body: { url: 'https://example.com', trustLevel: 'OFFICIAL', renderJavaScript: true },
  }), 422, 'P2 JavaScript rendering');

  console.log('[2/4] ES推敲変更の採否を検証します。');
  const accepted = expectStatus(await request(`/api/v1/es-revisions/${seeded.revisionId}/changes/${seeded.changeId}`, {
    method: 'PATCH',
    body: { decision: 'ACCEPTED' },
  }), 200, 'accept revision change');
  assert(accepted.decision === 'ACCEPTED', '推敲変更の採用状態が保存されませんでした。');
  expectStatus(await request(`/api/v1/es-revisions/${crypto.randomUUID()}/changes/${seeded.changeId}`, {
    method: 'PATCH',
    body: { decision: 'REJECTED' },
  }), 404, 'mismatched revision change');

  console.log('[3/4] 企業提案の非同期実行と根拠IDを検証します。');
  const created = expectStatus(await request('/api/v1/company-recommendation-runs', {
    method: 'POST',
    body: {
      candidateCompanyIds: seeded.companyIds,
      maxCandidates: 3,
      targetRoles: ['バックエンドエンジニア'],
      preferredLocations: ['東京'],
      refreshOfficialSources: false,
    },
  }), 202, 'create recommendation run');
  const runId = String(created.id);
  const deadline = Date.now() + 180_000;
  let run = created;
  while (['QUEUED', 'FETCHING_SOURCES', 'ANALYZING'].includes(String(run.status)) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    run = expectStatus(await request(`/api/v1/company-recommendation-runs/${runId}`), 200, 'poll recommendation run');
  }
  assert(['COMPLETED', 'PARTIALLY_COMPLETED'].includes(String(run.status)), `企業提案が完了しませんでした: ${String(run.status)}`);
  assert(Array.isArray(run.recommendations) && run.recommendations.length > 0, '企業提案が1件もありません。');
  for (const item of run.recommendations as JsonObject[]) {
    assert(Array.isArray(item.connectedExperienceIds) && item.connectedExperienceIds.includes(seeded.experienceId), '確認済み経験IDが提案根拠にありません。');
    assert(Array.isArray(item.companySourceIds) && item.companySourceIds.every((id) => seeded.sourceIds.includes(String(id))), '公式企業出典以外が提案根拠に含まれます。');
  }

  console.log('[4/4] 面接深掘り質問と逆質問の根拠IDを検証します。');
  const interview = expectStatus(await request('/api/v1/interview-questions/generate', {
    method: 'POST',
    body: {
      experienceIds: [seeded.experienceId],
      companyId: seeded.companyIds[0],
      targetRole: 'バックエンドエンジニア',
      deepDiveCount: 3,
      reverseQuestionCount: 3,
    },
  }), 200, 'generate interview questions');
  assert(Array.isArray(interview.deepDiveQuestions) && interview.deepDiveQuestions.length > 0, '深掘り質問がありません。');
  assert(Array.isArray(interview.reverseQuestions) && interview.reverseQuestions.length > 0, '逆質問がありません。');
  for (const item of interview.deepDiveQuestions as JsonObject[]) {
    assert(Array.isArray(item.connectedExperienceIds) && item.connectedExperienceIds.includes(seeded.experienceId), '深掘り質問が確認済み経験へ接続されていません。');
  }
  for (const item of interview.reverseQuestions as JsonObject[]) {
    assert(Array.isArray(item.companySourceIds) && item.companySourceIds.every((id) => id === seeded.sourceIds[0]), '逆質問に対象企業以外の出典があります。');
  }
  console.log('P1 HTTP E2Eテスト成功');
}, { COMPANY_RECOMMENDATION_ENABLED: 'true', COMPANY_URL_IMPORT_ENABLED: 'true' }, seed);
