import { recoverExactQuote } from './quotes.ts';
import type { CompanyFactsInput } from './types.ts';

type JsonObject = Record<string, unknown>;

const COMPANY_FACT_CATEGORIES = new Set([
  'MISSION',
  'BUSINESS',
  'PRODUCT_OR_SERVICE',
  'DESIRED_CANDIDATE',
  'REQUIRED_SKILL',
  'WORK_ENVIRONMENT',
  'INTERNSHIP_DETAIL',
  'ELIGIBILITY',
  'DEADLINE',
  'LOCATION',
  'WORK_STYLE',
  'OTHER',
]);

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  return [...value.trim()].slice(0, maxLength).join('');
}

function stringList(value: unknown, maxLength: number, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((item) => {
    const normalized = text(item, maxLength);
    return normalized ? [normalized] : [];
  }))].slice(0, limit);
}

export function stabilizeCompanyFactsCandidate(value: unknown, input: CompanyFactsInput): void {
  if (!isObject(value)) return;

  const facts = (Array.isArray(value.facts) ? value.facts : [])
    .slice(0, 400)
    .flatMap((candidate) => {
      if (!isObject(candidate)) return [];
      const fact = text(candidate.fact, 2000);
      const rawQuote = text(candidate.evidenceQuote, 3000);
      if (!fact || !rawQuote) return [];
      const evidenceQuote = recoverExactQuote(input.source.text, rawQuote);
      if (!evidenceQuote) return [];
      return [{
        category: typeof candidate.category === 'string' && COMPANY_FACT_CATEGORIES.has(candidate.category)
          ? candidate.category
          : 'OTHER',
        fact,
        evidenceQuote,
      }];
    })
    .filter((fact, index, items) => items.findIndex((candidate) => (
      candidate.category === fact.category
      && candidate.fact === fact.fact
      && candidate.evidenceQuote === fact.evidenceQuote
    )) === index)
    .slice(0, 200);

  const unknownItems = stringList(value.unknownItems, 1000, 50);
  for (const key of Object.keys(value)) delete value[key];
  Object.assign(value, { facts, unknownItems });
}
