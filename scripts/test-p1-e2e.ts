import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { withE2eServer, type ApiResult } from './e2e-harness.ts';

type SqliteDatabase = {
  prepare(sql: string): { run(...parameters: unknown[]): unknown };
  close(): void;
};
const Database = createRequire(import.meta.url)('better-sqlite3') as new (path: string) => SqliteDatabase;

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

async function seed(databaseUrl: string): Promise<void> {
  const database = new Database(databaseUrl.replace(/^file:/u, ''));
  const now = new Date().toISOString();
  try {
    const sessionId = randomUUID();
    const experienceId = randomUUID();
    const reportId = randomUUID();
    database.prepare(`INSERT INTO analysis_sessions
      (id, title, status, target_axes_json, created_at, updated_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(sessionId, 'P1 E2E', 'COMPLETED', JSON.stringify(['ENERGY_SOURCE', 'ACTION_STYLE', 'SATISFACTION_SOURCE', 'PREFERRED_ENVIRONMENT']), now, now, now);
    database.prepare(`INSERT INTO experiences
      (id, type, title, situation, goal, role, options_json, decision, decision_reason, actions_json, result,
       positive_emotion, negative_emotion, energy_change, environment_json, status, confirmed_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, NULL, ?, ?, NULL, NULL, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?)`)
      .run(experienceId, 'ACHIEVEMENT', 'チーム開発の改善', '4人チームでWebアプリを開発した。',
        'API設計とタスク分解を担当した。', '[]', JSON.stringify(['APIを設計した', 'タスクを分解した']),
        '期限内に完成した。', 1, JSON.stringify(['少人数チーム', '役割分担あり']), 'CONFIRMED', now, now, now);
    seeded.experienceId = experienceId;
    database.prepare(`INSERT INTO self_analysis_reports
      (id, source_session_id, summary, axis_snapshots_json, must_conditions_json, prefer_conditions_json,
       avoid_conditions_json, verify_conditions_json, next_experiments_json, user_message_count,
       confirmed_experience_count, is_stale, generated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(reportId, sessionId, '少人数チームで役割を明確にし、計画的に改善する経験を重視する。', '[]',
        JSON.stringify(['役割が明確である']), JSON.stringify(['改善提案ができる']), JSON.stringify(['役割が極端に曖昧である']),
        JSON.stringify(['若手の裁量範囲']), '[]', 1, 1, 0, now);

    for (const [index, name] of ['北極星テック', 'コンパスラボ', 'オーロラシステムズ'].entries()) {
      const companyId = randomUUID();
      const sourceId = randomUUID();
      database.prepare(`INSERT INTO companies
        (id, name, target_role, origin, official_url, career_url, recommendation_eligible, note, created_at, updated_at)
        VALUES (?, ?, ?, ?, NULL, NULL, ?, NULL, ?, ?)`)
        .run(companyId, name, 'バックエンドエンジニア', 'USER_REGISTERED', 1, now, now);
      const quote = `${name}では若手社員による改善提案とチーム開発を歓迎します。`;
      database.prepare(`INSERT INTO company_sources
        (id, company_id, type, trust_level, title, source_url, raw_text, content_hash, unknown_items_json, retrieved_at, created_at)
        VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`)
        .run(sourceId, companyId, 'TEXT', 'OFFICIAL', `${name}採用情報`, quote, `p1-e2e-${index}`, '[]', now, now);
      database.prepare(`INSERT INTO company_facts
        (id, company_source_id, category, fact, evidence_quote, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(randomUUID(), sourceId, 'WORK_ENVIRONMENT', '若手社員の改善提案とチーム開発を歓迎する。', quote, now);
      seeded.companyIds.push(companyId);
      seeded.sourceIds.push(sourceId);
    }

    const documentId = randomUUID();
    const analysisId = randomUUID();
    const revisionId = randomUUID();
    const changeId = randomUUID();
    database.prepare(`INSERT INTO es_documents
      (id, company_id, target_role, question, character_limit, original_text, preferred_experience_ids_json,
       emphasis_json, status, created_at, updated_at)
      VALUES (?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(documentId, 'チームで取り組んだ経験を説明してください。', 300, '4人チームでAPI設計を担当しました。',
        JSON.stringify([experienceId]), '[]', 'REVISED', now, now);
    database.prepare(`INSERT INTO es_analyses
      (id, es_document_id, revision_id, source_kind, freshness, character_count, within_character_limit,
       question_coverage, submission_readiness, issues_json, comments_json, created_at)
      VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(analysisId, documentId, 'ORIGINAL', 'CURRENT', 20, 1, 'ANSWERED', 'NEEDS_REVIEW', '[]', '[]', now);
    database.prepare(`INSERT INTO es_revisions
      (id, es_document_id, based_on_analysis_id, freshness, revised_text, used_experience_ids_json,
       used_session_report_ids_json, character_count, verification_analysis_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`)
      .run(revisionId, documentId, analysisId, 'CURRENT', '4人チームでAPI設計とタスク分解を担当しました。',
        JSON.stringify([experienceId]), '[]', 26, now);
    database.prepare(`INSERT INTO revision_changes
      (id, es_revision_id, before_text, after_text, reason, evidence_json, decision, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(changeId, revisionId, 'API設計を担当', 'API設計とタスク分解を担当', '確認済み経験を具体化するため',
        JSON.stringify([{ sourceType: 'EXPERIENCE', sourceId: experienceId, quote: 'API設計とタスク分解を担当した。' }]),
        'PENDING', now, now);
    seeded.revisionId = revisionId;
    seeded.changeId = changeId;
  } finally {
    database.close();
  }
}

await withE2eServer(async ({ request }) => {
  console.log('[1/3] URL取込のP1制約を検証します。');
  expectStatus(await request(`/api/v1/companies/${seeded.companyIds[0]}/sources/url`, {
    method: 'POST',
    body: { url: 'http://127.0.0.1/private', trustLevel: 'OFFICIAL' },
  }), 400, 'unsafe URL');
  expectStatus(await request(`/api/v1/companies/${seeded.companyIds[0]}/sources/url`, {
    method: 'POST',
    body: { url: 'https://example.com', trustLevel: 'OFFICIAL', renderJavaScript: true },
  }), 422, 'P2 JavaScript rendering');

  console.log('[2/3] ES推敲変更の採否を検証します。');
  const accepted = expectStatus(await request(`/api/v1/es-revisions/${seeded.revisionId}/changes/${seeded.changeId}`, {
    method: 'PATCH',
    body: { decision: 'ACCEPTED' },
  }), 200, 'accept revision change');
  assert(accepted.decision === 'ACCEPTED', '推敲変更の採用状態が保存されませんでした。');
  expectStatus(await request(`/api/v1/es-revisions/${crypto.randomUUID()}/changes/${seeded.changeId}`, {
    method: 'PATCH',
    body: { decision: 'REJECTED' },
  }), 404, 'mismatched revision change');

  console.log('[3/3] 企業提案の非同期実行と根拠IDを検証します。');
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
  console.log('P1 HTTP E2Eテスト成功');
}, { COMPANY_RECOMMENDATION_ENABLED: 'true', COMPANY_URL_IMPORT_ENABLED: 'true' }, seed);
