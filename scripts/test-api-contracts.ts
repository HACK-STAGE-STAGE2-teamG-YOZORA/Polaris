import { createCanvas } from '@napi-rs/canvas';
import { withE2eServer, type ApiResult } from './e2e-harness.ts';

type JsonObject = Record<string, unknown>;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function object(value: unknown, label: string): JsonObject {
  assert(typeof value === 'object' && value !== null && !Array.isArray(value), `${label}がobjectではありません。`);
  return value as JsonObject;
}

function expectStatus(result: ApiResult, status: number, label: string): JsonObject {
  assert(result.status === status, `${label}: HTTP ${status}を期待しましたが${result.status}でした。`);
  return result.body === null ? {} : object(result.body, label);
}

function textImage(): ArrayBuffer {
  const canvas = createCanvas(1000, 220);
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#111111';
  context.font = 'bold 64px Arial';
  context.fillText('POLARIS ENTRY 2026', 40, 140);
  const bytes = canvas.toBuffer('image/png');
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

await withE2eServer(async ({ request }) => {
  expectStatus(await request('/api/v1/system/health'), 200, 'health');
  expectStatus(await request('/api/v1/system/lm-studio'), 200, 'lm studio status');
  expectStatus(await request('/api/v1/dashboard'), 200, 'empty dashboard');
  expectStatus(await request('/api/v1/analysis-sessions/current'), 200, 'empty current session');

  const firstSession = expectStatus(await request('/api/v1/analysis-sessions', {
    method: 'POST',
    body: { startMode: 'START_NEW', title: '契約テスト1' },
  }), 201, 'create first session');
  assert(typeof firstSession.id === 'string', 'first session idがありません。');
  expectStatus(await request('/api/v1/analysis-sessions', {
    method: 'POST',
    body: { startMode: 'START_NEW', title: '重複開始' },
  }), 409, 'active session conflict');

  const session = expectStatus(await request('/api/v1/analysis-sessions', {
    method: 'POST',
    body: { startMode: 'RESTART_ACTIVE', title: '契約テスト2' },
  }), 201, 'restart session');
  const sessionId = String(session.id);
  expectStatus(await request(`/api/v1/analysis-sessions/${sessionId}`), 200, 'get session');
  expectStatus(await request('/api/v1/analysis-sessions?limit=10'), 200, 'list sessions');
  expectStatus(await request('/api/v1/analysis-sessions?status=UNKNOWN'), 422, 'invalid session status');

  const experience = expectStatus(await request('/api/v1/experiences', {
    method: 'POST',
    body: {
      sourceSessionId: sessionId,
      type: 'ACHIEVEMENT',
      title: '契約テスト経験',
      situation: '4人チームでWebアプリを開発した。',
      goal: '期限内に完成させる。',
      role: 'API設計担当',
      options: ['先に設計する', '実装しながら決める'],
      decision: '先に設計する',
      decisionReason: '認識差を減らすため。',
      actions: ['OpenAPIを作成した', 'レビューを実施した'],
      result: '期限内に完成した。',
      positiveEmotion: '達成感があった。',
      negativeEmotion: null,
      energyChange: 1,
      environment: ['少人数チーム'],
    },
  }), 201, 'create experience');
  const experienceId = String(experience.id);
  expectStatus(await request(`/api/v1/experiences/${experienceId}`), 200, 'get experience');
  expectStatus(await request(`/api/v1/experiences/${experienceId}`, {
    method: 'PATCH',
    body: { status: 'CONFIRMED' },
  }), 200, 'confirm experience');
  expectStatus(await request('/api/v1/experiences?status=CONFIRMED'), 200, 'list experiences');

  const company = expectStatus(await request('/api/v1/companies', {
    method: 'POST',
    body: {
      name: 'Polaris契約株式会社',
      targetRole: 'バックエンドエンジニア',
      officialUrl: 'https://example.com',
      recommendationEligible: false,
    },
  }), 201, 'create company');
  const companyId = String(company.id);
  expectStatus(await request(`/api/v1/companies/${companyId}`), 200, 'get company');
  expectStatus(await request(`/api/v1/companies/${companyId}`, {
    method: 'PATCH',
    body: { note: '契約テスト更新' },
  }), 200, 'patch company');
  expectStatus(await request('/api/v1/companies'), 200, 'list companies');

  const document = expectStatus(await request('/api/v1/es-documents', {
    method: 'POST',
    body: {
      companyId,
      targetRole: 'バックエンドエンジニア',
      question: '学生時代に力を入れたことを教えてください。',
      characterLimit: 400,
      originalText: '私はAPI設計とレビューに力を入れ、チームの認識差を減らしました。',
      preferredExperienceIds: [experienceId],
      emphasis: ['協働'],
    },
  }), 201, 'create ES document');
  const documentId = String(document.id);
  expectStatus(await request(`/api/v1/es-documents/${documentId}`), 200, 'get ES document');
  expectStatus(await request(`/api/v1/es-documents/${documentId}`, {
    method: 'PATCH',
    body: { originalText: '😀'.repeat(20_000) },
  }), 200, 'patch ES with Unicode code points');
  expectStatus(await request('/api/v1/es-documents'), 200, 'list ES documents');
  expectStatus(await request('/api/v1/dashboard'), 200, 'populated dashboard');

  const formData = new FormData();
  formData.set('file', new File([textImage()], 'entry.png', { type: 'application/octet-stream' }));
  expectStatus(await request('/api/v1/es-text-extractions', { method: 'POST', formData }), 200, 'extract ES image');

  expectStatus(await request(`/api/v1/es-documents/${documentId}`, { method: 'DELETE' }), 204, 'delete ES document');
  expectStatus(await request(`/api/v1/es-documents/${documentId}`), 404, 'deleted ES document');
  expectStatus(await request(`/api/v1/companies/${companyId}`, { method: 'DELETE' }), 204, 'delete company');
  expectStatus(await request(`/api/v1/companies/${companyId}`), 404, 'deleted company');
  expectStatus(await request(`/api/v1/experiences/${experienceId}`, { method: 'DELETE' }), 204, 'delete experience');
  expectStatus(await request(`/api/v1/experiences/${experienceId}`), 404, 'deleted experience');
});

console.log('Deterministic API/OpenAPI contracts: OK');
