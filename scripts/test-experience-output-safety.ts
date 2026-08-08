import { strict as assert } from 'node:assert';
import {
  stabilizeExperienceDraftCandidate,
  stabilizeExperienceGroundingCandidate,
} from '../src/infrastructure/ai/experience-output.ts';
import { stabilizeChatTurnCandidate } from '../src/infrastructure/ai/chat-output.ts';

const messageId = '10000000-0000-4000-8000-000000000001';
const input = {
  requestedType: 'ENGAGED' as const,
  messages: [{ id: messageId, role: 'USER' as const, content: '4人チームでAPIを設計し、期限内に完成させました。' }],
};
const draft: Record<string, unknown> = {
  type: 'OTHER', title: '', situation: '', goal: '', role: '', options: [''], decision: '', decisionReason: '',
  actions: [], result: '', positiveEmotion: '', negativeEmotion: '', energyChange: 99, environment: [''],
  evidenceQuotes: [{ messageId, quote: '4人チームでAPIを設計し、期限内に完成させました。' }, { messageId: 'unknown', quote: '捏造' }],
  missingFields: ['UNKNOWN', 'goal'], extra: 'remove',
};
stabilizeExperienceDraftCandidate(draft, input);
assert.equal(draft.type, 'ENGAGED');
assert.equal(draft.situation, input.messages[0].content);
assert.equal(draft.energyChange, 0);
assert.equal((draft.evidenceQuotes as unknown[]).length, 1);
assert.equal(Object.hasOwn(draft, 'extra'), false);
assert.ok((draft.missingFields as string[]).includes('role'));
assert.ok((draft.actions as string[]).length === 1);

const grounding: Record<string, unknown> = {
  assessments: [
    { field: 'goal', grounded: true, messageId, quote: '期限内に完成', explanation: '' },
    { field: 'goal', grounded: true, messageId: 'unknown', quote: '捏造', explanation: 'duplicate' },
  ],
  extra: 'remove',
};
stabilizeExperienceGroundingCandidate(grounding, input.messages);
const assessments = grounding.assessments as Array<Record<string, unknown>>;
assert.deepEqual(assessments.map((item) => item.field), ['goal', 'options', 'decision', 'decisionReason']);
assert.equal(assessments[0]?.grounded, true);
assert.equal(assessments[1]?.grounded, false);
assert.equal(Object.hasOwn(grounding, 'extra'), false);

const chat: Record<string, unknown> = {
  reply: '質問1ですか？ 質問2ですか？',
  evidenceCandidates: [
    { axis: 'ENERGY_SOURCE', pole: 'LEFT', statement: '一人で集中した', supportType: 'SUPPORT', messageId, quote: 'APIを設計', interpretation: '集中した' },
    { axis: 'UNKNOWN', pole: 'LEFT', statement: '不正', supportType: 'SUPPORT', messageId, quote: '捏造', interpretation: '不正' },
  ],
  missingAxes: ['ENERGY_SOURCE', 'ENERGY_SOURCE', 'UNKNOWN'],
  nextQuestionTarget: 'UNKNOWN',
  experienceReady: 'yes',
  completionIntent: 'UNKNOWN',
  extra: true,
};
stabilizeChatTurnCandidate(chat, {
  session: { id: '20000000-0000-4000-8000-000000000001', targetAxes: ['ENERGY_SOURCE'], coveredExperienceTypes: [], missingAxes: ['ENERGY_SOURCE'] },
  messages: input.messages,
});
assert.equal(((chat.reply as string).match(/[？?]/gu) ?? []).length, 1);
assert.equal((chat.evidenceCandidates as unknown[]).length, 1);
assert.deepEqual(chat.missingAxes, ['ENERGY_SOURCE']);
assert.equal(chat.nextQuestionTarget, 'ENERGY_SOURCE');
assert.equal(chat.experienceReady, false);
assert.equal(chat.completionIntent, 'NONE');
assert.equal(Object.hasOwn(chat, 'extra'), false);

console.log('チャット・経験抽出の安全な出力正規化テストに成功しました。');
