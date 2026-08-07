import { strict as assert } from 'node:assert';
import { stabilizeInterviewQuestionsCandidate } from '../src/infrastructure/ai/interview-output.ts';
import { loadAiSchema } from '../src/infrastructure/ai/schema.ts';
import type { InterviewQuestionsInput, InterviewQuestionsOutput } from '../src/infrastructure/ai/types.ts';

const experienceId = '00000000-0000-4000-8000-000000000001';
const sourceId = '00000000-0000-4000-8000-000000000002';
const input: InterviewQuestionsInput = {
  selfAnalysisReport: {
    id: '00000000-0000-4000-8000-000000000003',
    summary: 'summary',
    mustConditions: [],
    preferConditions: [],
    avoidConditions: [],
    verifyConditions: [],
  },
  confirmedExperiences: [{
    id: experienceId,
    title: 'team project',
    situation: 'situation',
    role: 'role',
    actions: ['action'],
    result: 'result',
  }],
  company: {
    id: '00000000-0000-4000-8000-000000000004',
    name: 'company',
    targetRole: 'engineer',
    sources: [{ id: sourceId, facts: [] }],
  },
  esDocument: null,
  targetRole: 'engineer',
  deepDiveCount: 3,
  reverseQuestionCount: 3,
};

const candidate: Record<string, unknown> = {
  ignored: true,
  deepDiveQuestions: [
    { question: 'どのように役割を決めましたか', purpose: '判断を確認', connectedExperienceIds: [experienceId, 'invalid'], extra: true },
    { question: '無効な経験ですか？', purpose: 'invalid', connectedExperienceIds: ['invalid'] },
    { question: 'どのように役割を決めましたか？', purpose: 'duplicate', connectedExperienceIds: [experienceId] },
  ],
  reverseQuestions: [
    { question: '改善提案はどのように評価されますか', purpose: '制度を確認', companySourceIds: [sourceId, 'invalid'], extra: true },
    { question: '根拠なしですか？', purpose: 'invalid', companySourceIds: ['invalid'] },
  ],
};

stabilizeInterviewQuestionsCandidate(candidate, input);
assert.deepEqual(Object.keys(candidate).sort(), ['deepDiveQuestions', 'reverseQuestions']);
const deepDive = candidate.deepDiveQuestions as Array<Record<string, unknown>>;
const reverse = candidate.reverseQuestions as Array<Record<string, unknown>>;
assert.equal(deepDive.length, 1);
assert.equal(deepDive[0].question, 'どのように役割を決めましたか？');
assert.deepEqual(deepDive[0].connectedExperienceIds, [experienceId]);
assert.equal(reverse.length, 1);
assert.deepEqual(reverse[0].companySourceIds, [sourceId]);
assert.equal('extra' in reverse[0], false);

const schema = await loadAiSchema<InterviewQuestionsOutput>('interview-questions-output.schema.json');
assert.doesNotThrow(() => schema.validateStrict(candidate));

const inputWithoutCompany: InterviewQuestionsInput = {
  ...input,
  company: null,
};
const candidateWithoutCompany: Record<string, unknown> = {
  deepDiveQuestions: [{
    question: 'その経験で最も難しかった判断は何ですか',
    purpose: '判断を確認',
    connectedExperienceIds: [experienceId],
  }],
  reverseQuestions: [{
    question: 'この職種で入社後に期待される役割を教えてください',
    purpose: '職種の期待を確認',
    companySourceIds: [sourceId],
  }],
};
stabilizeInterviewQuestionsCandidate(candidateWithoutCompany, inputWithoutCompany);
const reverseWithoutCompany = candidateWithoutCompany.reverseQuestions as Array<Record<string, unknown>>;
assert.equal(reverseWithoutCompany.length, 1);
assert.deepEqual(reverseWithoutCompany[0].companySourceIds, []);
assert.doesNotThrow(() => schema.validateStrict(candidateWithoutCompany));
console.log('面接質問AI出力の安全化テスト成功');
