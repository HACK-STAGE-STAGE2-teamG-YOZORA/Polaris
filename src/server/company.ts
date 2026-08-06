import { iso, stringArray } from './api';

type CompanyRecord = {
  id: string;
  name: string;
  targetRole: string | null;
  origin: string;
  officialUrl: string | null;
  careerUrl: string | null;
  recommendationEligible: boolean;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  sources: Array<{
    id: string;
    type: string;
    trustLevel: string;
    title: string;
    sourceUrl: string | null;
    unknownItems: unknown;
    retrievedAt: Date;
    facts: Array<{
      id: string;
      companySourceId: string;
      category: string;
      fact: string;
      evidenceQuote: string;
    }>;
  }>;
};

export function formatCompanySummary(company: CompanyRecord) {
  return {
    id: company.id,
    name: company.name,
    targetRole: company.targetRole,
    origin: company.origin,
    officialUrl: company.officialUrl,
    careerUrl: company.careerUrl,
    recommendationEligible: company.recommendationEligible,
    sourceCount: company.sources.length,
    factCount: company.sources.reduce((count, source) => count + source.facts.length, 0),
    createdAt: iso(company.createdAt),
    updatedAt: iso(company.updatedAt),
  };
}

export function formatCompany(company: CompanyRecord) {
  return {
    ...formatCompanySummary(company),
    note: company.note,
    sources: company.sources.map(formatCompanySource),
    facts: company.sources.flatMap((source) => source.facts.map((fact) => formatCompanyFact(fact, source.sourceUrl))),
    unknownItems: [...new Set(company.sources.flatMap((source) => stringArray(source.unknownItems)))],
  };
}

export function formatCompanySource(source: CompanyRecord['sources'][number]) {
  return {
    id: source.id,
    type: source.type,
    trustLevel: source.trustLevel,
    title: source.title,
    url: source.sourceUrl,
    retrievedAt: iso(source.retrievedAt),
  };
}

export function formatCompanyFact(fact: CompanyRecord['sources'][number]['facts'][number], sourceUrl: string | null) {
  return {
    id: fact.id,
    sourceId: fact.companySourceId,
    category: fact.category,
    fact: fact.fact,
    evidenceQuote: fact.evidenceQuote,
    sourceUrl,
  };
}

export const companyInclude = {
  sources: { include: { facts: true }, orderBy: { retrievedAt: 'desc' as const } },
} as const;

export function validHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
