import type { CompanyRecommendationsInput } from './types.ts';

type JsonObject = Record<string, unknown>;

const SLOTS = ['PRIMARY', 'CHALLENGE', 'UNEXPECTED'] as const;

export function hasBalancedRecommendationSlots(
  recommendations: Array<{ slot: string }>,
): boolean {
  if (recommendations.length <= 1) return true;
  const slots = new Set(recommendations.map((recommendation) => recommendation.slot));
  if (recommendations.length < SLOTS.length) return slots.size === recommendations.length;
  return SLOTS.every((slot) => slots.has(slot));
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  return [...value.trim()].slice(0, maxLength).join('');
}

function stringList(value: unknown, maxLength: number, limit = Number.POSITIVE_INFINITY): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((item) => {
    const normalized = text(item, maxLength);
    return normalized ? [normalized] : [];
  }))].slice(0, limit);
}

/**
 * Shrinks probabilistic model output to IDs and facts supplied by the backend.
 * A recommendation that loses all experience or official-source grounding is
 * excluded instead of being repaired with an unrelated fallback.
 */
export function stabilizeCompanyRecommendationsCandidate(
  value: unknown,
  input: CompanyRecommendationsInput,
): void {
  if (!isObject(value)) return;

  const companyById = new Map(input.companies.map((company) => [company.id, company]));
  const confirmedExperienceIds = new Set(input.confirmedExperiences.map((experience) => experience.id));
  const recommendedCompanyIds = new Set<string>();
  const rejectedReasons = new Map<string, string>();

  const recommendations = (Array.isArray(value.recommendations) ? value.recommendations : [])
    .slice(0, 50)
    .flatMap((candidate) => {
      if (!isObject(candidate) || typeof candidate.companyId !== 'string') return [];
      const company = companyById.get(candidate.companyId);
      if (!company || recommendedCompanyIds.has(company.id)) return [];

      const allowedSourceIds = new Set(company.sources.map((source) => source.id));
      const connectedExperienceIds = stringList(candidate.connectedExperienceIds, 100)
        .filter((id) => confirmedExperienceIds.has(id));
      const companySourceIds = stringList(candidate.companySourceIds, 100)
        .filter((id) => allowedSourceIds.has(id));

      if (connectedExperienceIds.length === 0) {
        rejectedReasons.set(company.id, '確認済み経験との直接の接続を確認できませんでした。');
        return [];
      }
      if (companySourceIds.length === 0) {
        rejectedReasons.set(company.id, '対象企業に属する公式出典を確認できませんでした。');
        return [];
      }

      recommendedCompanyIds.add(company.id);
      const slot = typeof candidate.slot === 'string' && SLOTS.includes(candidate.slot as typeof SLOTS[number])
        ? candidate.slot as typeof SLOTS[number]
        : SLOTS[(recommendedCompanyIds.size - 1) % SLOTS.length];
      return [{
        companyId: company.id,
        slot,
        recommendedRole: text(candidate.recommendedRole, 300) ?? company.targetRole ?? null,
        rationale: text(candidate.rationale, 3000) ?? '確認済み経験と公式企業情報の接点を確認してください。',
        connectedExperienceIds,
        matchingConditions: stringList(candidate.matchingConditions, 1000, 20),
        concerns: stringList(candidate.concerns, 1000, 20),
        unknowns: stringList(candidate.unknowns, 1000, 20),
        verificationQuestions: stringList(candidate.verificationQuestions, 1000, 20),
        companySourceIds,
      }];
    })
    .slice(0, 9);

  const explicitExcludedReasons = new Map<string, string>();
  if (Array.isArray(value.excludedCompanies)) {
    for (const candidate of value.excludedCompanies) {
      if (!isObject(candidate) || typeof candidate.companyId !== 'string') continue;
      if (!companyById.has(candidate.companyId) || recommendedCompanyIds.has(candidate.companyId)) continue;
      if (!explicitExcludedReasons.has(candidate.companyId)) {
        explicitExcludedReasons.set(
          candidate.companyId,
          text(candidate.reason, 1000) ?? '提案に必要な根拠を確認できませんでした。',
        );
      }
    }
  }

  const excludedCompanies = input.companies.flatMap((company) => {
    if (recommendedCompanyIds.has(company.id)) return [];
    return [{
      companyId: company.id,
      reason: rejectedReasons.get(company.id)
        ?? explicitExcludedReasons.get(company.id)
        ?? 'AI出力から提案に必要な根拠を確認できませんでした。',
    }];
  });

  for (const key of Object.keys(value)) delete value[key];
  Object.assign(value, { recommendations, excludedCompanies });
}
