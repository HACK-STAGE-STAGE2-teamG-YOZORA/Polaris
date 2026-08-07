import { strict as assert } from 'node:assert';
import { stabilizeCompanyFactsCandidate } from '../src/infrastructure/ai/company-facts-output.ts';
import { loadAiSchema } from '../src/infrastructure/ai/schema.ts';
import type { CompanyFactsInput, CompanyFactsOutput } from '../src/infrastructure/ai/types.ts';

const input: CompanyFactsInput = {
  company: { id: '00000000-0000-4000-8000-000000000001', name: '北極星テック' },
  source: {
    title: '採用情報',
    trustLevel: 'OFFICIAL',
    text: '若手社員による改善提案を歓迎します。\nチーム開発を重視しています。',
  },
};

const candidate: Record<string, unknown> = {
  ignored: true,
  facts: [
    {
      category: 'WORK_ENVIRONMENT',
      fact: '若手社員の改善提案を歓迎する。',
      evidenceQuote: '若手社員による 改善提案を歓迎します。',
      ignoredFactField: true,
    },
    {
      category: 'INVALID_CATEGORY',
      fact: 'チーム開発を重視している。',
      evidenceQuote: 'チーム開発を重視しています。',
    },
    {
      category: 'BUSINESS',
      fact: '本文に存在しない事実',
      evidenceQuote: '存在しない引用',
    },
    {
      category: 'WORK_ENVIRONMENT',
      fact: '若手社員の改善提案を歓迎する。',
      evidenceQuote: '若手社員による 改善提案を歓迎します。',
    },
  ],
  unknownItems: [' 福利厚生の詳細 ', '福利厚生の詳細', '', 123],
};

stabilizeCompanyFactsCandidate(candidate, input);

assert.deepEqual(Object.keys(candidate).sort(), ['facts', 'unknownItems']);
const facts = candidate.facts as Array<Record<string, unknown>>;
assert.equal(facts.length, 2);
assert.equal(facts[0].evidenceQuote, '若手社員による改善提案を歓迎します。');
assert.equal(facts[1].category, 'OTHER');
assert.equal('ignoredFactField' in facts[0], false);
assert.deepEqual(candidate.unknownItems, ['福利厚生の詳細']);

const schema = await loadAiSchema<CompanyFactsOutput>('company-facts-output.schema.json');
assert.doesNotThrow(() => schema.validateStrict(candidate));

console.log('企業事実抽出AI出力の安全化テスト成功');
