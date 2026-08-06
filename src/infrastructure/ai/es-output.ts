import { recoverExactQuote } from './quotes.ts';
import type { EsAnalysisInput, EsRevisionInput } from './types.ts';

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  return [...value.trim()].slice(0, max).join('');
}

function stringArray(value: unknown, max: number, limit = Number.POSITIVE_INFINITY): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((item) => {
    const normalized = text(item, max);
    return normalized ? [normalized] : [];
  }))].slice(0, limit);
}

function sourceEvidence(value: unknown, input: EsAnalysisInput): Array<{
  sourceType: 'EXPERIENCE' | 'COMPANY_FACT';
  sourceId: string;
  quote: string;
}> {
  if (!Array.isArray(value)) return [];
  return value.flatMap<{ sourceType: 'EXPERIENCE' | 'COMPANY_FACT'; sourceId: string; quote: string }>((candidate) => {
    if (!isObject(candidate) || typeof candidate.sourceId !== 'string' || typeof candidate.quote !== 'string') return [];
    if (candidate.sourceType === 'EXPERIENCE') {
      const experience = input.allConfirmedExperiences.find((item) => item.id === candidate.sourceId);
      if (!experience) return [];
      const quote = [...experience.sourceQuotes, ...experience.confirmedFacts]
        .map((source) => recoverExactQuote(source, candidate.quote as string))
        .find((item) => item !== null);
      return quote ? [{ sourceType: 'EXPERIENCE' as const, sourceId: candidate.sourceId, quote }] : [];
    }
    if (candidate.sourceType === 'COMPANY_FACT') {
      const fact = input.allowedCompanyFacts.find((item) => item.id === candidate.sourceId);
      const quote = fact ? recoverExactQuote(fact.evidenceQuote, candidate.quote) : null;
      return quote ? [{ sourceType: 'COMPANY_FACT' as const, sourceId: candidate.sourceId, quote }] : [];
    }
    return [];
  });
}

const claimTypes = new Set([
  'PERSONAL_FACT',
  'NUMBER',
  'PERIOD',
  'ROLE',
  'RESULT',
  'CAPABILITY',
  'COMPANY_FACT',
  'MOTIVATION',
  'FUTURE_GOAL',
]);
const claimStatuses = new Set([
  'VERIFIED',
  'PARTIALLY_VERIFIED',
  'NEEDS_CONFIRMATION',
  'CONTRADICTED',
]);
const issueCodes = new Set([
  'QUESTION_NOT_ANSWERED',
  'UNSUPPORTED_PERSONAL_FACT',
  'UNSUPPORTED_COMPANY_FACT',
  'CONTRADICTION',
  'ABSTRACT_EXPRESSION',
  'REDUNDANT_EXPRESSION',
  'CHARACTER_LIMIT_EXCEEDED',
  'CHARACTER_LIMIT_UNDERUSED',
  'VOICE_DEVIATION',
]);
const issueSeverities = new Set(['ERROR', 'WARNING', 'INFO']);

export function stabilizeEsAnalysisCandidate(value: unknown, input: EsAnalysisInput): void {
  if (!isObject(value)) return;
  const claims = Array.isArray(value.claims) ? value.claims.slice(0, 200).flatMap((candidate) => {
    if (!isObject(candidate)) return [];
    const rawSentence = text(candidate.sentence, 5000);
    const rawText = text(candidate.text, 2000);
    const sentence = (rawSentence ? recoverExactQuote(input.text, rawSentence) : null)
      ?? (rawText ? recoverExactQuote(input.text, rawText) : null);
    if (!sentence) return [];
    const claimText = (rawText ? recoverExactQuote(sentence, rawText) : null) ?? sentence;
    const evidence = sourceEvidence(candidate.evidence, input);
    const requestedStatus = typeof candidate.suggestedStatus === 'string'
      && claimStatuses.has(candidate.suggestedStatus)
      ? candidate.suggestedStatus
      : 'NEEDS_CONFIRMATION';
    return [{
      sentence,
      text: [...claimText].slice(0, 2000).join(''),
      type: typeof candidate.type === 'string' && claimTypes.has(candidate.type)
        ? candidate.type
        : 'PERSONAL_FACT',
      suggestedStatus: evidence.length > 0 ? requestedStatus : 'NEEDS_CONFIRMATION',
      evidence,
      explanation: text(candidate.explanation, 2000) ?? '根拠との対応を確認してください。',
    }];
  }) : [];
  const issues = Array.isArray(value.issues) ? value.issues.slice(0, 100).flatMap((candidate) => {
    if (!isObject(candidate) || typeof candidate.code !== 'string' || !issueCodes.has(candidate.code)) return [];
    const sentence = text(candidate.sentence, 5000);
    return [{
      code: candidate.code,
      severity: typeof candidate.severity === 'string' && issueSeverities.has(candidate.severity)
        ? candidate.severity
        : 'WARNING',
      message: text(candidate.message, 2000) ?? '内容を確認してください。',
      sentence: sentence ? recoverExactQuote(input.text, sentence) : null,
    }];
  }) : [];
  const coverage = typeof value.questionCoverage === 'string'
    && ['ANSWERED', 'PARTIALLY_ANSWERED', 'NOT_ANSWERED'].includes(value.questionCoverage)
    ? value.questionCoverage
    : 'PARTIALLY_ANSWERED';
  for (const key of Object.keys(value)) delete value[key];
  Object.assign(value, { questionCoverage: coverage, claims, issues });
}

export function stabilizeEsRevisionCandidate(value: unknown, input: EsRevisionInput): void {
  if (!isObject(value)) return;
  const experienceIds = new Set(input.allConfirmedExperiences.map((item) => item.id));
  const reportIds = new Set(input.allSessionReports.flatMap((item) => typeof item.id === 'string' ? [item.id] : []));
  const changes = Array.isArray(value.changes) ? value.changes.slice(0, 100).flatMap((candidate) => {
    if (!isObject(candidate)) return [];
    return [{
      before: typeof candidate.before === 'string' ? [...candidate.before].slice(0, 5000).join('') : '',
      after: typeof candidate.after === 'string' ? [...candidate.after].slice(0, 5000).join('') : '',
      reason: text(candidate.reason, 2000) ?? '変更理由は未確認です。',
      evidence: sourceEvidence(candidate.evidence, input),
    }];
  }) : [];
  const normalized = {
    revisedText: text(value.revisedText, 20000) ?? [...input.text].slice(0, 20000).join(''),
    usedExperienceIds: stringArray(value.usedExperienceIds, 100).filter((id) => experienceIds.has(id)),
    usedSessionReportIds: stringArray(value.usedSessionReportIds, 100).filter((id) => reportIds.has(id)),
    changes,
    questionsForUser: stringArray(value.questionsForUser, 1000, 10),
  };
  for (const key of Object.keys(value)) delete value[key];
  Object.assign(value, normalized);
}
