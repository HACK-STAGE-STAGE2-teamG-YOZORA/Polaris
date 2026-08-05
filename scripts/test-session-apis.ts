import { POST as createSession } from '@/app/api/v1/analysis-sessions/route';
import { POST as saveMessage } from '@/app/api/v1/analysis-sessions/[sessionId]/messages/route';
import { PATCH as updateStatus } from '@/app/api/v1/analysis-sessions/[sessionId]/status/route';

async function test() {
  console.log('=== Testing Session Management APIs ===');

  // 1. セッション作成
  const req1 = new Request('http://localhost:3000/api/v1/analysis-sessions', {
    method: 'POST',
    body: JSON.stringify({ startMode: 'RESTART_ACTIVE', title: 'テスト自己分析' }),
  });
  const res1 = await createSession(req1);
  const sessionData = await res1.json();
  console.log('1. Create Session Response Status:', res1.status);
  console.log('   Payload:', JSON.stringify(sessionData, null, 2));

  const sessionId = sessionData.id;

  // 2. メッセージ追加
  const req2 = new Request(`http://localhost:3000/api/v1/analysis-sessions/${sessionId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ role: 'USER', content: '自己分析を開始します' }),
  });
  const res2 = await saveMessage(req2, { params: { sessionId } });
  const msgData = await res2.json();
  console.log('2. Save Message Response Status:', res2.status);
  console.log('   Payload:', JSON.stringify(msgData, null, 2));

  // 3. 重複メッセージ送信テスト (二重送信防止)
  const req2Dup = new Request(`http://localhost:3000/api/v1/analysis-sessions/${sessionId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ role: 'USER', content: '自己分析を開始します' }),
  });
  const res2Dup = await saveMessage(req2Dup, { params: { sessionId } });
  console.log('3. Duplicate Message Prevention Status:', res2Dup.status, '(Existing message returned)');

  // 4. ステータス更新
  const req3 = new Request(`http://localhost:3000/api/v1/analysis-sessions/${sessionId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'READY_TO_FINALIZE' }),
  });
  const res3 = await updateStatus(req3, { params: { sessionId } });
  const statusData = await res3.json();
  console.log('4. Update Status Response Status:', res3.status);
  console.log('   Payload:', JSON.stringify(statusData, null, 2));
}

test();
