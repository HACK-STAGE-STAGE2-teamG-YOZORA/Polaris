import { strict as assert } from 'node:assert';
import {
  hasBalancedRecommendationSlots,
  stabilizeCompanyRecommendationsCandidate,
} from '../src/infrastructure/ai/recommendation-output.ts';
import { loadAiSchema } from '../src/infrastructure/ai/schema.ts';
import type { CompanyRecommendationsInput, CompanyRecommendationsOutput } from '../src/infrastructure/ai/types.ts';

const input: CompanyRecommendationsInput = {
  selfAnalysisReport: {
    id: '00000000-0000-4000-8000-000000000001',
    summary: 'summary',
    axisSnapshots: [],
    mustConditions: [],
    preferConditions: [],
    avoidConditions: [],
    verifyConditions: [],
  },
  confirmedExperiences: [
    {
      id: '00000000-0000-4000-8000-000000000011',
      title: 'experience 1',
      type: 'PROJECT',
      situation: 'situation',
      role: 'role',
      actions: ['action'],
      result: 'result',
    },
  ],
  targetRoles: [],
  preferredLocations: [],
  companies: [
    {
      id: '00000000-0000-4000-8000-000000000021',
      name: 'company 1',
      targetRole: 'engineer',
      sources: [{
        id: '00000000-0000-4000-8000-000000000031',
        url: 'https://example.com/1',
        facts: [],
      }],
    },
    {
      id: '00000000-0000-4000-8000-000000000022',
      name: 'company 2',
      targetRole: null,
      sources: [{
        id: '00000000-0000-4000-8000-000000000032',
        url: 'https://example.com/2',
        facts: [],
      }],
    },
    {
      id: '00000000-0000-4000-8000-000000000023',
      name: 'company 3',
      targetRole: null,
      sources: [{
        id: '00000000-0000-4000-8000-000000000033',
        url: 'https://example.com/3',
        facts: [],
      }],
    },
  ],
};

const candidate: Record<string, unknown> = {
  ignoredTopLevel: true,
  recommendations: [
    {
      companyId: input.companies[0].id,
      slot: 'INVALID_SLOT',
      recommendedRole: '',
      rationale: '  grounded rationale  ',
      connectedExperienceIds: [input.confirmedExperiences[0].id, 'hallucinated-experience'],
      matchingConditions: ['condition', 'condition'],
      concerns: 'not-an-array',
      unknowns: [],
      verificationQuestions: ['question'],
      companySourceIds: [input.companies[0].sources[0].id, input.companies[1].sources[0].id],
      ignoredRecommendationField: true,
    },
    {
      companyId: input.companies[0].id,
      slot: 'CHALLENGE',
      rationale: 'duplicate company',
      connectedExperienceIds: [input.confirmedExperiences[0].id],
      companySourceIds: [input.companies[0].sources[0].id],
    },
    {
      companyId: input.companies[1].id,
      slot: 'PRIMARY',
      rationale: 'unsupported experience',
      connectedExperienceIds: ['hallucinated-experience'],
      companySourceIds: [input.companies[1].sources[0].id],
    },
    {
      companyId: 'hallucinated-company',
      slot: 'PRIMARY',
      rationale: 'unknown company',
      connectedExperienceIds: [input.confirmedExperiences[0].id],
      companySourceIds: [input.companies[0].sources[0].id],
    },
  ],
  excludedCompanies: [
    { companyId: input.companies[2].id, reason: '  explicit reason  ', ignored: true },
    { companyId: input.companies[2].id, reason: 'duplicate reason' },
    { companyId: input.companies[0].id, reason: 'must not overlap' },
  ],
};

stabilizeCompanyRecommendationsCandidate(candidate, input);

assert.deepEqual(Object.keys(candidate).sort(), ['excludedCompanies', 'recommendations']);
const recommendations = candidate.recommendations as Array<Record<string, unknown>>;
assert.equal(recommendations.length, 1);
assert.equal(recommendations[0].companyId, input.companies[0].id);
assert.equal(recommendations[0].slot, 'PRIMARY');
assert.equal(recommendations[0].recommendedRole, 'engineer');
assert.equal(recommendations[0].rationale, 'grounded rationale');
assert.deepEqual(recommendations[0].connectedExperienceIds, [input.confirmedExperiences[0].id]);
assert.deepEqual(recommendations[0].companySourceIds, [input.companies[0].sources[0].id]);
assert.deepEqual(recommendations[0].matchingConditions, ['condition']);
assert.equal('ignoredRecommendationField' in recommendations[0], false);

const excluded = candidate.excludedCompanies as Array<{ companyId: string; reason: string }>;
assert.deepEqual(excluded.map((item) => item.companyId), [input.companies[1].id, input.companies[2].id]);
assert.match(excluded[0].reason, /確認済み経験/);
assert.equal(excluded[1].reason, 'explicit reason');
assert(hasBalancedRecommendationSlots([{ slot: 'PRIMARY' }]), '1件の提案を偏りとして拒否しました。');
assert(hasBalancedRecommendationSlots([{ slot: 'PRIMARY' }, { slot: 'CHALLENGE' }]), '2件の異なる枠を拒否しました。');
assert(!hasBalancedRecommendationSlots([{ slot: 'PRIMARY' }, { slot: 'PRIMARY' }]), '2件の同一枠偏りを許可しました。');
assert(hasBalancedRecommendationSlots([
  { slot: 'PRIMARY' },
  { slot: 'CHALLENGE' },
  { slot: 'UNEXPECTED' },
]), '3枠を使用した提案を拒否しました。');
assert(!hasBalancedRecommendationSlots([
  { slot: 'PRIMARY' },
  { slot: 'PRIMARY' },
  { slot: 'CHALLENGE' },
]), '3件以上で意外枠のない偏りを許可しました。');

const schema = await loadAiSchema<CompanyRecommendationsOutput>('company-recommendations-output.schema.json');
assert.doesNotThrow(() => schema.validateStrict(candidate));

console.log('企業提案AI出力の安全化テスト成功');
