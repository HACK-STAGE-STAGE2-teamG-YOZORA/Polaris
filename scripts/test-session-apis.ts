import { randomUUID } from 'node:crypto';
import { POST as createSession } from '@/app/api/v1/analysis-sessions/route';
import { GET as getSession } from '@/app/api/v1/analysis-sessions/[sessionId]/route';
import { POST as sendMessage } from '@/app/api/v1/analysis-sessions/[sessionId]/messages/route';

async function test() {
  const createdResponse = await createSession(new Request('http://localhost/api/v1/analysis-sessions', {
    method: 'POST',
    body: JSON.stringify({ startMode: 'RESTART_ACTIVE', title: 'セッションAPIテスト' }),
  }));
  const session = await createdResponse.json();
  if (createdResponse.status !== 201) throw new Error('セッション作成に失敗しました。');

  const clientMessageId = randomUUID();
  const send = () => sendMessage(new Request(`http://localhost/api/v1/analysis-sessions/${session.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content: '自己分析を始めます。', clientMessageId }),
  }), { params: Promise.resolve({ sessionId: session.id }) });
  const first = await send();
  const second = await send();
  if (first.status !== 200 || second.status !== 200) throw new Error('メッセージ送信または冪等再送に失敗しました。');

  const getResponse = await getSession(new Request(`http://localhost/api/v1/analysis-sessions/${session.id}`), {
    params: Promise.resolve({ sessionId: session.id }),
  });
  if (getResponse.status !== 200) throw new Error('セッション取得に失敗しました。');
  console.log('Session API contract test passed.');
}

test().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
