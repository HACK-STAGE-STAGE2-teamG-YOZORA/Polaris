import {
  fitInputByDropping,
  promptFitsBudget,
  relevanceScore,
  splitTextForBudget,
} from '../src/infrastructure/ai/context-budget.ts';
import { fitCompanyRecommendationsInput } from '../src/infrastructure/ai/recommendation-input.ts';
import type { CompanyRecommendationsInput } from '../src/infrastructure/ai/types.ts';

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

const recommendationInput: CompanyRecommendationsInput = {
  selfAnalysisReport: {
    id: 'report',
    summary: 'API設計とチーム開発を重視する。',
    axisSnapshots: [],
    mustConditions: ['チーム開発'],
    preferConditions: ['改善提案'],
    avoidConditions: [],
    verifyConditions: [],
  },
  confirmedExperiences: Array.from({ length: 30 }, (_, index) => ({
    id: `experience-${index}`,
    title: index === 29 ? 'API設計' : `experience ${index}`,
    type: 'PROJECT',
    situation: '状況'.repeat(30),
    role: '役割'.repeat(20),
    actions: ['行動'.repeat(30)],
    result: '結果'.repeat(20),
  })),
  targetRoles: ['バックエンドエンジニア'],
  preferredLocations: ['東京'],
  companies: Array.from({ length: 20 }, (_, companyIndex) => ({
    id: `company-${companyIndex}`,
    name: `company ${companyIndex}`,
    targetRole: 'バックエンドエンジニア',
    sources: Array.from({ length: 3 }, (_, sourceIndex) => ({
      id: `source-${companyIndex}-${sourceIndex}`,
      url: `https://example.com/${companyIndex}/${sourceIndex}`,
      facts: Array.from({ length: 10 }, (_, factIndex) => ({
        id: `fact-${companyIndex}-${sourceIndex}-${factIndex}`,
        category: 'WORK_ENVIRONMENT',
        fact: factIndex === 9 ? 'API設計とチーム開発を重視する。' : '企業事実'.repeat(20),
        evidenceQuote: '公式本文'.repeat(20),
      })),
    })),
  })),
};
const fittedRecommendations = fitCompanyRecommendationsInput(recommendationInput, {
  contextLength: 16_384,
  maxOutputTokens: 4_096,
  schemaReserveTokens: 1_500,
  estimatedCharsPerToken: 2,
});
assert(fittedRecommendations.dropped, '20社の企業提案入力が予算に合わせて削減されませんでした。');
assert(fittedRecommendations.input.companies.length === 20, '候補企業そのものが削除されました。');
assert(
  fittedRecommendations.input.companies.every((company) => (
    company.sources.length >= 1 && company.sources.every((source) => source.facts.length >= 1)
  )),
  '各企業の最低1件の公式根拠が維持されませんでした。',
);
assert(fittedRecommendations.input.confirmedExperiences.length >= 1, '確認済み経験がすべて削除されました。');
assert(promptFitsBudget(fittedRecommendations.prompt, {
  contextLength: 16_384,
  maxOutputTokens: 4_096,
  schemaReserveTokens: 1_500,
  estimatedCharsPerToken: 2,
}), '企業提案入力の削減後も予算を超えています。');

console.log('AI context budgeting: OK');
