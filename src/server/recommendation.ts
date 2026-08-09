import type { Prisma } from '@/generated/prisma/client';
import { companyInclude, formatCompanySummary } from '@/server/company';
import { iso, nullableIso, objectArray, stringArray } from '@/server/api';

export const recommendationRunInclude = {
  recommendations: {
    include: { company: { include: companyInclude } },
    orderBy: { rank: 'asc' as const },
  },
} as const;

type RecommendationRunRecord = Prisma.RecommendationRunGetPayload<{
  include: typeof recommendationRunInclude;
}>;

export type RecommendationWarning = {
  code: 'SOURCE_FETCH_FAILED' | 'NO_OFFICIAL_URL' | 'INSUFFICIENT_COMPANY_FACTS' | 'STALE_SOURCE_USED';
  companyId?: string;
  message: string;
};

export function formatRecommendationRun(run: RecommendationRunRecord) {
  return {
    id: run.id,
    selfAnalysisReportId: run.selfAnalysisReportId,
    candidateCompanyIds: stringArray(run.candidateCompanyIds),
    refreshOfficialSources: run.refreshOfficialSources,
    status: run.status,
    progress: {
      total: run.progressTotal,
      fetched: run.progressFetched,
      analyzed: run.progressAnalyzed,
      failed: run.progressFailed,
    },
    warnings: objectArray(run.warnings),
    recommendations: run.recommendations.map((recommendation) => ({
      id: recommendation.id,
      company: formatCompanySummary(recommendation.company),
      slot: recommendation.slot,
      rank: recommendation.rank,
      recommendedRole: recommendation.recommendedRole,
      rationale: recommendation.rationale,
      connectedExperienceIds: stringArray(recommendation.connectedExperienceIds),
      matchingConditions: stringArray(recommendation.matchingConditions),
      concerns: stringArray(recommendation.concerns),
      unknowns: stringArray(recommendation.unknowns),
      verificationQuestions: stringArray(recommendation.verificationQuestions),
      companySourceIds: stringArray(recommendation.companySourceIds),
      generatedAt: iso(recommendation.generatedAt),
    })),
    startedAt: nullableIso(run.startedAt),
    completedAt: nullableIso(run.completedAt),
    createdAt: iso(run.createdAt),
    updatedAt: iso(run.updatedAt),
  };
}
