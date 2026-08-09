import { strict as assert } from 'node:assert';
import {
  stabilizeEsAnalysisCandidate,
  stabilizeEsRevisionCandidate,
} from '../src/infrastructure/ai/es-output.ts';
import { esSubmissionReadiness } from '../src/server/es-readiness.ts';

const ids = {
  experience: '10000000-0000-4000-8000-000000000001',
  report: '20000000-0000-4000-8000-000000000001',
  fact: '30000000-0000-4000-8000-000000000001',
  unknown: '90000000-0000-4000-8000-000000000001',
};
const input = {
  question: 'チーム経験を説明してください。',
  characterLimit: 300,
  text: '私はチームでAPIを設計しました。',
  allConfirmedExperiences: [{
    id: ids.experience,
    confirmedFacts: ['APIを設計しました'],
    sourceQuotes: ['私はチームでAPIを設計しました。'],
  }],
  allowedCompanyFacts: [{
    id: ids.fact,
    category: 'WORK_ENVIRONMENT',
    fact: '設計レビューを重視する',
    evidenceQuote: '設計レビューを重視する',
    trustLevel: 'OFFICIAL' as const,
  }],
  allSessionReports: [{ id: ids.report }],
  preferredExperienceIds: [ids.experience],
  latestAnalysis: { questionCoverage: 'ANSWERED' as const, claims: [], issues: [] },
  emphasis: [], preserveExpressions: [], forbiddenAdditions: [],
};
const candidate: Record<string, unknown> = {
  revisedText: '',
  usedExperienceIds: [ids.experience, ids.unknown, ids.experience],
  usedSessionReportIds: [ids.unknown, ids.report],
  changes: [{
    before: 1,
    after: 'APIを設計しました',
    reason: '',
    evidence: [
      { sourceType: 'EXPERIENCE', sourceId: ids.experience, quote: 'APIを設計しました' },
      { sourceType: 'COMPANY_FACT', sourceId: ids.unknown, quote: '捏造' },
    ],
    extra: true,
  }],
  questionsForUser: ['', '役割を確認してください'],
  extra: true,
};
stabilizeEsRevisionCandidate(candidate, input);
assert.equal(candidate.revisedText, input.text);
assert.deepEqual(candidate.usedExperienceIds, [ids.experience]);
assert.deepEqual(candidate.usedSessionReportIds, [ids.report]);
assert.equal(((candidate.changes as Array<{ evidence: unknown[] }>)[0]?.evidence.length), 1);
assert.equal(Object.hasOwn(candidate, 'extra'), false);

const analysisCandidate: Record<string, unknown> = {
  questionCoverage: 'UNKNOWN',
  claims: [{
    sentence: input.text,
    text: 'APIを設計しました',
    type: 'UNKNOWN',
    suggestedStatus: 'VERIFIED',
    evidence: [{ sourceType: 'EXPERIENCE', sourceId: ids.unknown, quote: '捏造' }],
    explanation: '',
    extra: true,
  }],
  issues: [{
    code: 'ABSTRACT_EXPRESSION',
    severity: 'UNKNOWN',
    message: '',
    sentence: '本文にない文章',
  }],
  extra: true,
};
stabilizeEsAnalysisCandidate(analysisCandidate, input);
const stabilizedClaim = (analysisCandidate.claims as Array<Record<string, unknown>>)[0];
assert.equal(analysisCandidate.questionCoverage, 'PARTIALLY_ANSWERED');
assert.equal(stabilizedClaim?.type, 'PERSONAL_FACT');
assert.equal(stabilizedClaim?.suggestedStatus, 'NEEDS_CONFIRMATION');
assert.deepEqual(stabilizedClaim?.evidence, []);
assert.equal((analysisCandidate.issues as Array<Record<string, unknown>>)[0]?.sentence, null);
assert.equal(Object.hasOwn(analysisCandidate, 'extra'), false);

assert.equal(esSubmissionReadiness({ withinCharacterLimit: true, questionCoverage: 'ANSWERED', claimStatuses: [] }), 'NEEDS_REVIEW');
assert.equal(esSubmissionReadiness({ withinCharacterLimit: true, questionCoverage: 'ANSWERED', claimStatuses: ['VERIFIED'] }), 'READY_TO_SUBMIT');
assert.equal(esSubmissionReadiness({ withinCharacterLimit: true, questionCoverage: 'PARTIALLY_ANSWERED', claimStatuses: ['VERIFIED'] }), 'NEEDS_REVIEW');

console.log('ES完成版の安全な出力正規化テストに成功しました。');
