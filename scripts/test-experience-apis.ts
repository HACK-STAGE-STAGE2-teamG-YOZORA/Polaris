/**
 * test-experience-apis.ts
 * 経験カードAPI の一連フローをテスト:
 *   作成（DRAFT）→ 一覧取得 → 更新（CONFIRMED）→ STALE 化連動確認
 */

import { POST as createSession } from '@/app/api/v1/analysis-sessions/route';
import { POST as createExperience, GET as listExperiences } from '@/app/api/v1/experiences/route';
import { PATCH as updateExperience } from '@/app/api/v1/experiences/[experienceId]/route';
import { POST as createAssessment } from '@/app/api/v1/analysis-sessions/[sessionId]/axis-assessments/route';

async function test() {
  console.log('=== Testing Experience Card APIs ===\n');

  // ─────────────────────────────────────
  // 前準備: セッション作成
  // ─────────────────────────────────────
  const sessionReq = new Request('http://localhost:3000/api/v1/analysis-sessions', {
    method: 'POST',
    body: JSON.stringify({ title: '経験カードAPIテスト用セッション' }),
  });
  const sessionRes = await createSession(sessionReq);
  const session = await sessionRes.json();
  const sessionId: string = session.id;
  console.log('✅ セッション作成:', sessionId);

  // ─────────────────────────────────────
  // 前準備: AxisAssessment 作成（STALE 化テスト用）
  // ─────────────────────────────────────
  const assessmentReq = new Request(
    `http://localhost:3000/api/v1/analysis-sessions/${sessionId}/axis-assessments`,
    {
      method: 'POST',
      body: JSON.stringify({
        axis: 'ENERGY_SOURCE',
        position: 'LEANS_LEFT',
        aiStatement: 'テスト用 AI ステートメント',
        displayStatement: '外向きエネルギー傾向',
        status: 'CURRENT_HYPOTHESIS',
        leftConditions: ['チームで動く場面でエネルギーが上がる'],
        rightConditions: [],
        contextNotes: [],
        internalConfidence: 0.7,
      }),
    }
  );
  const assessmentRes = await createAssessment(assessmentReq, { params: { sessionId } });
  const assessment = await assessmentRes.json();
  console.log('✅ AxisAssessment 作成:', assessment.id, '/ isStale:', assessment.isStale);

  console.log('\n--- 1. 経験カード作成（DRAFT）---');
  const createReq = new Request('http://localhost:3000/api/v1/experiences', {
    method: 'POST',
    body: JSON.stringify({
      sourceSessionId: sessionId,
      type: 'ENGAGED',
      title: '学園祭の企画リーダー',
      situation: '大学3年時、400人規模の学園祭企画を担当した',
      goal: 'ゲスト誘致と来場者数増加',
      role: 'プロジェクトリーダー',
      options: ['外部ゲスト招聘', '学内バンド中心の企画'],
      decision: '外部ゲスト招聘を選択',
      decisionReason: '集客力を最大化するため',
      actions: ['ゲスト交渉', 'スポンサー獲得', 'チームマネジメント'],
      result: '前年比150%の来場者数を達成',
      positiveEmotion: '達成感・チームとの一体感',
      negativeEmotion: null,
      energyChange: 8,
      environment: { teamSize: 20, duration: '6ヶ月' },
    }),
  });
  const createRes = await createExperience(createReq);
  const created = await createRes.json();
  console.log('Status:', createRes.status, '(期待: 201)');
  console.log('ID:', created.id);
  console.log('status:', created.status, '(期待: DRAFT)');
  console.log('isTarget:', created.isTarget, '(期待: true)');

  const experienceId: string = created.id;

  // ─────────────────────────────────────
  // 2. 一覧取得（全件）
  // ─────────────────────────────────────
  console.log('\n--- 2. 経験カード一覧取得（全件）---');
  const listReq = new Request('http://localhost:3000/api/v1/experiences');
  const listRes = await listExperiences(listReq);
  const list = await listRes.json();
  console.log('Status:', listRes.status, '(期待: 200)');
  console.log('total:', list.total, '(期待: 1)');
  console.log('experiences[0].title:', list.experiences[0]?.title);

  // ─────────────────────────────────────
  // 3. セッションフィルタで取得
  // ─────────────────────────────────────
  console.log('\n--- 3. セッション別フィルタ取得 ---');
  const filteredReq = new Request(
    `http://localhost:3000/api/v1/experiences?sessionId=${sessionId}&isTarget=true`
  );
  const filteredRes = await listExperiences(filteredReq);
  const filtered = await filteredRes.json();
  console.log('Status:', filteredRes.status, '(期待: 200)');
  console.log('total:', filtered.total, '(期待: 1)');

  // ─────────────────────────────────────
  // 4. 内容修正 + CONFIRMED 昇格 → STALE 化連動
  // ─────────────────────────────────────
  console.log('\n--- 4. 経験カード更新（CONFIRMED）+ STALE 化連動 ---');
  const patchReq = new Request(
    `http://localhost:3000/api/v1/experiences/${experienceId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        result: '前年比200%の来場者数を達成（修正後）',
        status: 'CONFIRMED',
      }),
    }
  );
  const patchRes = await updateExperience(patchReq, { params: { experienceId } });
  const patchData = await patchRes.json();
  console.log('Status:', patchRes.status, '(期待: 200)');
  console.log('experience.status:', patchData.experience?.status, '(期待: CONFIRMED)');
  console.log('experience.confirmedAt:', patchData.experience?.confirmedAt);
  console.log('experience.result:', patchData.experience?.result);
  console.log('staledAssessments 件数:', patchData.staledAssessments?.length, '(期待: 1)');
  if (patchData.staledAssessments?.length > 0) {
    console.log('  staled axis:', patchData.staledAssessments[0].axis, '(期待: ENERGY_SOURCE)');
  }

  // ─────────────────────────────────────
  // 5. STALE 化後のチェック（isTarget=false 更新）
  // ─────────────────────────────────────
  console.log('\n--- 5. isTarget=false に更新（次回分析対象外）---');
  const excludeReq = new Request(
    `http://localhost:3000/api/v1/experiences/${experienceId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ isTarget: false }),
    }
  );
  const excludeRes = await updateExperience(excludeReq, { params: { experienceId } });
  const excludeData = await excludeRes.json();
  console.log('Status:', excludeRes.status, '(期待: 200)');
  console.log('experience.isTarget:', excludeData.experience?.isTarget, '(期待: false)');

  // ─────────────────────────────────────
  // 6. isTarget=true のみ取得（次回分析候補フィルタ）
  // ─────────────────────────────────────
  console.log('\n--- 6. isTarget=true フィルタ（次回分析対象のみ）---');
  const targetReq = new Request('http://localhost:3000/api/v1/experiences?isTarget=true');
  const targetRes = await listExperiences(targetReq);
  const targetData = await targetRes.json();
  console.log('Status:', targetRes.status, '(期待: 200)');
  console.log('total:', targetData.total, '(期待: 0 ← isTarget=false にしたため)');

  console.log('\n=== テスト完了 ===');
}

test().catch((e) => {
  console.error('テスト失敗:', e);
  process.exit(1);
});
