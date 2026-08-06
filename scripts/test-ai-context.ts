import {
  fitInputByDropping,
  promptFitsBudget,
  relevanceScore,
  splitTextForBudget,
} from '../src/infrastructure/ai/context-budget.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const budget = {
  contextLength: 120,
  maxOutputTokens: 20,
  schemaReserveTokens: 10,
  estimatedCharsPerToken: 2,
};
assert(promptFitsBudget({ system: 'system', user: 'short input' }, budget), '短いプロンプトが上限内になりません。');
assert(!promptFitsBudget({ system: 'system', user: '長'.repeat(200) }, budget), '長いプロンプトを上限内と誤判定しました。');

const input = { messages: ['old '.repeat(30), 'middle '.repeat(20), 'newest answer'] };
const fitted = fitInputByDropping(
  input,
  (value) => ({ system: 'system', user: JSON.stringify(value) }),
  budget,
  [(value) => value.messages.length > 1 ? Boolean(value.messages.shift()) : false],
);
assert(fitted.dropped, '上限超過時に履歴が削減されませんでした。');
assert(fitted.input.messages.at(-1) === 'newest answer', '最新回答が削減されました。');
assert(promptFitsBudget(fitted.prompt, budget), '削減後もプロンプトが上限を超えています。');

assert(
  relevanceScore('API設計とチーム開発', 'チームでAPI設計を担当した')
  > relevanceScore('API設計とチーム開発', '一人で料理をした'),
  '関連度順が不正です。',
);

const source = `第一段落${'A'.repeat(30)}\n\n第二段落${'B'.repeat(30)}\n\n第三段落${'C'.repeat(30)}`;
const chunks = splitTextForBudget(source, 45, 5);
assert(chunks.length >= 2, '長文が分割されませんでした。');
assert(chunks.every((chunk) => [...chunk].length <= 45), '分割後の文字数が上限を超えています。');

console.log('AI context budgeting: OK');
