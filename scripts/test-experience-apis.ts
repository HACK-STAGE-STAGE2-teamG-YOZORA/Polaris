import { POST as createSession } from '@/app/api/v1/analysis-sessions/route';
import { POST as createExperience, GET as listExperiences } from '@/app/api/v1/experiences/route';
import { PATCH as updateExperience } from '@/app/api/v1/experiences/[experienceId]/route';

async function test() {
  const sessionResponse = await createSession(new Request('http://localhost/api/v1/analysis-sessions', {
    method: 'POST',
    body: JSON.stringify({ startMode: 'RESTART_ACTIVE', title: '体験APIテスト' }),
  }));
  const session = await sessionResponse.json();

  const createResponse = await createExperience(new Request('http://localhost/api/v1/experiences', {
    method: 'POST',
    body: JSON.stringify({
      sourceSessionId: session.id,
      type: 'ENGAGED',
      title: 'チーム開発',
      situation: '4人でWebアプリを開発した。',
      role: 'API設計担当',
      actions: ['API契約を整理した。'],
      energyChange: 1,
      environment: ['少人数チーム'],
    }),
  }));
  const created = await createResponse.json();
  if (createResponse.status !== 201 || created.status !== 'DRAFT') throw new Error('DRAFT作成に失敗しました。');

  const updateResponse = await updateExperience(new Request(`http://localhost/api/v1/experiences/${created.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'CONFIRMED' }),
  }), { params: Promise.resolve({ experienceId: created.id }) });
  const updated = await updateResponse.json();
  if (updated.experience?.status !== 'CONFIRMED' || !Array.isArray(updated.staledAssessments)) {
    throw new Error('確認またはstaledAssessments契約が不正です。');
  }

  const listResponse = await listExperiences(new Request('http://localhost/api/v1/experiences?status=CONFIRMED'));
  const list = await listResponse.json();
  if (!Array.isArray(list.items) || !list.items.some((item: { id: string }) => item.id === created.id)) {
    throw new Error('ExperiencePage契約が不正です。');
  }
  console.log('Experience API contract test passed.');
}

test().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
