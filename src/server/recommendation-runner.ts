import { LmStudioPolarisAiGateway } from '@/infrastructure/ai/lm-studio-ai-gateway';
import { fetchCompanyUrl, SafeUrlFetchError } from '@/infrastructure/fetch/safe-url-fetcher';
import { prisma } from '@/lib/prisma';
import { logSafeError, stringArray } from '@/server/api';
import { persistCompanySource } from '@/server/company';
import type { RecommendationWarning } from '@/server/recommendation';

const ACTIVE_STATUSES = ['QUEUED', 'FETCHING_SOURCES', 'ANALYZING'] as const;
const globalForRunner = globalThis as unknown as { polarisRecommendationRuns?: Set<string> };
const runningRunIds = globalForRunner.polarisRecommendationRuns ?? new Set<string>();
globalForRunner.polarisRecommendationRuns = runningRunIds;

export async function recoverOrphanedRecommendationRuns(userId: string): Promise<void> {
  const active = await prisma.recommendationRun.findMany({
    where: { userId, status: { in: [...ACTIVE_STATUSES] } },
    select: { id: true },
  });
  const orphanedIds = active.map((run) => run.id).filter((id) => !runningRunIds.has(id));
  if (orphanedIds.length === 0) return;
  await prisma.recommendationRun.updateMany({
    where: { id: { in: orphanedIds } },
    data: { status: 'FAILED', completedAt: new Date() },
  });
}

export function enqueueRecommendationRun(runId: string): void {
  if (runningRunIds.has(runId)) return;
  runningRunIds.add(runId);
  setTimeout(() => {
    void processRecommendationRun(runId).finally(() => runningRunIds.delete(runId));
  }, 0);
}

async function processRecommendationRun(runId: string): Promise<void> {
  let ai: LmStudioPolarisAiGateway | undefined;
  try {
    const run = await prisma.recommendationRun.findUnique({ where: { id: runId } });
    if (!run || run.status !== 'QUEUED') return;
    const candidateCompanyIds = stringArray(run.candidateCompanyIds);
    const warnings: RecommendationWarning[] = [];
    let fetched = 0;
    const failedCompanyIds = new Set<string>();
    await prisma.recommendationRun.update({
      where: { id: runId },
      data: { status: run.refreshOfficialSources ? 'FETCHING_SOURCES' : 'ANALYZING', startedAt: new Date() },
    });

    if (run.refreshOfficialSources) {
      ai = new LmStudioPolarisAiGateway();
      const companies = await prisma.company.findMany({
        where: { userId: run.userId, id: { in: candidateCompanyIds } },
        orderBy: { createdAt: 'asc' },
      });
      for (const company of companies) {
        const sourceUrl = company.careerUrl ?? company.officialUrl;
        if (!sourceUrl) {
          failedCompanyIds.add(company.id);
          warnings.push({ code: 'NO_OFFICIAL_URL', companyId: company.id, message: '公式URLまたは採用URLが登録されていません。' });
        } else {
          try {
            const fetchedSource = await fetchCompanyUrl(sourceUrl);
            const extracted = await ai.extractCompanyFacts({
              company: {
                id: company.id,
                name: company.name,
                ...(company.targetRole ? { targetRole: company.targetRole } : {}),
              },
              source: {
                title: fetchedSource.title,
                sourceUrl: fetchedSource.url,
                trustLevel: 'OFFICIAL',
                text: fetchedSource.text,
              },
            });
            await persistCompanySource({
              companyId: company.id,
              type: 'URL',
              trustLevel: 'OFFICIAL',
              title: fetchedSource.title,
              sourceUrl: fetchedSource.url,
              text: fetchedSource.text,
              extracted,
            });
            fetched += 1;
          } catch (error) {
            if (!(error instanceof SafeUrlFetchError)) throw error;
            failedCompanyIds.add(company.id);
            warnings.push({ code: 'SOURCE_FETCH_FAILED', companyId: company.id, message: error.message });
          }
        }
        await prisma.recommendationRun.update({
          where: { id: runId },
          data: { progressFetched: fetched, progressFailed: failedCompanyIds.size, warnings },
        });
      }
      await prisma.recommendationRun.update({ where: { id: runId }, data: { status: 'ANALYZING' } });
    }

    const [report, experiences, companies] = await Promise.all([
      prisma.selfAnalysisReport.findFirst({ where: { id: run.selfAnalysisReportId, sourceSession: { userId: run.userId } } }),
      prisma.experience.findMany({ where: { userId: run.userId, status: 'CONFIRMED' }, orderBy: { createdAt: 'asc' } }),
      prisma.company.findMany({
        where: { userId: run.userId, id: { in: candidateCompanyIds } },
        include: { sources: { include: { facts: true }, orderBy: { retrievedAt: 'desc' } } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    if (!report) throw new Error('企業提案に使用する自己分析レポートがありません。');

    const groundedCompanies = companies.flatMap((company) => {
      const sources = company.sources
        .filter((source) => source.trustLevel === 'OFFICIAL' && source.facts.length > 0)
        .slice(0, 3);
      if (sources.length === 0) {
        failedCompanyIds.add(company.id);
        warnings.push({
          code: 'INSUFFICIENT_COMPANY_FACTS',
          companyId: company.id,
          message: '提案に使える公式企業事実がありません。',
        });
        return [];
      }
      const cacheTtlHours = Number(process.env.COMPANY_SOURCE_CACHE_TTL_HOURS ?? 24);
      const cacheTtlMs = (Number.isFinite(cacheTtlHours) && cacheTtlHours >= 0 ? cacheTtlHours : 24) * 60 * 60 * 1000;
      if (!run.refreshOfficialSources && Date.now() - sources[0].retrievedAt.getTime() > cacheTtlMs) {
        warnings.push({
          code: 'STALE_SOURCE_USED',
          companyId: company.id,
          message: '設定されたキャッシュ有効期間を超えた公式出典を使用しました。',
        });
      }
      return [{
        id: company.id,
        name: company.name,
        targetRole: company.targetRole,
        sources: sources.map((source) => ({
          id: source.id,
          url: source.sourceUrl,
          facts: source.facts.map((fact) => ({
            id: fact.id,
            category: fact.category,
            fact: fact.fact,
            evidenceQuote: fact.evidenceQuote,
          })),
        })),
      }];
    });
    if (groundedCompanies.length === 0) {
      await prisma.recommendationRun.update({
        where: { id: runId },
        data: {
          status: 'FAILED',
          progressAnalyzed: 0,
          progressFailed: failedCompanyIds.size,
          warnings,
          completedAt: new Date(),
        },
      });
      return;
    }

    ai ??= new LmStudioPolarisAiGateway();
    const output = await ai.recommendCompanies({
      selfAnalysisReport: {
        id: report.id,
        summary: report.summary,
        axisSnapshots: report.axisSnapshots,
        mustConditions: report.mustConditions,
        preferConditions: report.preferConditions,
        avoidConditions: report.avoidConditions,
        verifyConditions: report.verifyConditions,
      },
      confirmedExperiences: experiences.map((experience) => ({
        id: experience.id,
        title: experience.title,
        type: experience.type,
        situation: experience.situation,
        role: experience.role,
        actions: stringArray(experience.actions),
        result: experience.result,
      })),
      targetRoles: stringArray(run.targetRoles),
      preferredLocations: stringArray(run.preferredLocations),
      companies: groundedCompanies,
    });
    for (const excluded of output.excludedCompanies) {
      failedCompanyIds.add(excluded.companyId);
      warnings.push({ code: 'INSUFFICIENT_COMPANY_FACTS', companyId: excluded.companyId, message: excluded.reason });
    }
    await prisma.$transaction(async (tx) => {
      await tx.companyRecommendation.createMany({
        data: output.recommendations.map((recommendation, index) => ({
          recommendationRunId: runId,
          companyId: recommendation.companyId,
          slot: recommendation.slot,
          rank: index + 1,
          recommendedRole: recommendation.recommendedRole,
          rationale: recommendation.rationale,
          connectedExperienceIds: recommendation.connectedExperienceIds,
          matchingConditions: recommendation.matchingConditions,
          concerns: recommendation.concerns,
          unknowns: recommendation.unknowns,
          verificationQuestions: recommendation.verificationQuestions,
          companySourceIds: recommendation.companySourceIds,
        })),
      });
      await tx.recommendationRun.update({
        where: { id: runId },
        data: {
          status: warnings.length > 0 ? 'PARTIALLY_COMPLETED' : 'COMPLETED',
          progressAnalyzed: groundedCompanies.length,
          progressFetched: fetched,
          progressFailed: failedCompanyIds.size,
          warnings,
          completedAt: new Date(),
        },
      });
    });
  } catch (error) {
    logSafeError('企業提案runner', error);
    await prisma.recommendationRun.updateMany({
      where: { id: runId, status: { in: [...ACTIVE_STATUSES] } },
      data: { status: 'FAILED', completedAt: new Date() },
    });
  } finally {
    if (ai) await ai[Symbol.asyncDispose]();
  }
}
