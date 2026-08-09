import { prisma } from '@/lib/prisma';
import { internalError, jsonBody, problem } from '@/server/api';
import { enqueueRecommendationRun, recoverOrphanedRecommendationRuns } from '@/server/recommendation-runner';
import { formatRecommendationRun, recommendationRunInclude } from '@/server/recommendation';
import { requireAuth } from '@/server/auth/require-auth';

const ACTIVE_STATUSES = ['QUEUED', 'FETCHING_SOURCES', 'ANALYZING'] as const;

function readStringList(value: unknown, maxItems: number, maxLength: number): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maxItems || value.some((item) => typeof item !== 'string' || item.length > maxLength)) {
    return null;
  }
  return value as string[];
}

export async function POST(request: Request): Promise<Response> {
  try {
    const auth = await requireAuth(request);
    if ('response' in auth) return auth.response;
    if (process.env.COMPANY_RECOMMENDATION_ENABLED === 'false') {
      return problem(422, 'VALIDATION_ERROR', '企業提案機能は現在無効です。');
    }
    const body = await jsonBody(request);
    if (!body) return problem(422, 'VALIDATION_ERROR', 'JSONオブジェクトを指定してください。');
    const maxCandidates = body.maxCandidates === undefined
      ? Number(process.env.COMPANY_RECOMMENDATION_MAX_CANDIDATES ?? 10)
      : body.maxCandidates;
    if (!Number.isInteger(maxCandidates) || Number(maxCandidates) < 3 || Number(maxCandidates) > 20) {
      return problem(422, 'VALIDATION_ERROR', 'maxCandidates は3〜20の整数で指定してください。');
    }
    const targetRoles = readStringList(body.targetRoles, 10, 200);
    const preferredLocations = readStringList(body.preferredLocations, 20, 200);
    if (!targetRoles || !preferredLocations) {
      return problem(422, 'VALIDATION_ERROR', 'targetRoles または preferredLocations が不正です。');
    }
    if (body.refreshOfficialSources !== undefined && typeof body.refreshOfficialSources !== 'boolean') {
      return problem(422, 'VALIDATION_ERROR', 'refreshOfficialSources はbooleanで指定してください。');
    }
    if (body.selfAnalysisReportId !== undefined && typeof body.selfAnalysisReportId !== 'string') {
      return problem(422, 'VALIDATION_ERROR', 'selfAnalysisReportId が不正です。');
    }

    let candidateCompanyIds: string[];
    if (body.candidateCompanyIds !== undefined) {
      if (
        !Array.isArray(body.candidateCompanyIds) ||
        body.candidateCompanyIds.length < 1 ||
        body.candidateCompanyIds.length > 20 ||
        body.candidateCompanyIds.some((id) => typeof id !== 'string') ||
        new Set(body.candidateCompanyIds).size !== body.candidateCompanyIds.length
      ) {
        return problem(422, 'VALIDATION_ERROR', 'candidateCompanyIds は1〜20件の重複しないID配列で指定してください。');
      }
      candidateCompanyIds = body.candidateCompanyIds as string[];
      const count = await prisma.company.count({ where: { userId: auth.userId, id: { in: candidateCompanyIds } } });
      if (count !== candidateCompanyIds.length) {
        return problem(422, 'VALIDATION_ERROR', 'candidateCompanyIds に未登録企業が含まれます。');
      }
    } else {
      candidateCompanyIds = (await prisma.company.findMany({
        where: { userId: auth.userId, recommendationEligible: true },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        take: Number(maxCandidates),
      })).map((company) => company.id);
      if (candidateCompanyIds.length === 0) {
        return problem(422, 'VALIDATION_ERROR', '提案対象として登録された企業がありません。');
      }
    }

    const report = typeof body.selfAnalysisReportId === 'string'
      ? await prisma.selfAnalysisReport.findFirst({ where: { id: body.selfAnalysisReportId, sourceSession: { userId: auth.userId } } })
      : await prisma.selfAnalysisReport.findFirst({ where: { sourceSession: { userId: auth.userId }, isStale: false }, orderBy: { generatedAt: 'desc' } });
    if (!report) return problem(409, 'CONFLICT', '現在利用できる自己分析レポートがありません。');
    if (report.isStale) return problem(409, 'CONFLICT', '指定された自己分析レポートは古いため再生成が必要です。');
    const confirmedExperienceCount = await prisma.experience.count({ where: { userId: auth.userId, status: 'CONFIRMED' } });
    if (confirmedExperienceCount === 0) {
      return problem(409, 'CONFLICT', '企業提案の根拠に使える確認済み経験がありません。');
    }

    await recoverOrphanedRecommendationRuns(auth.userId);
    const active = await prisma.recommendationRun.findFirst({ where: { userId: auth.userId, status: { in: [...ACTIVE_STATUSES] } } });
    if (active) return problem(409, 'CONFLICT', '別の企業提案を実行中です。');

    const run = await prisma.recommendationRun.create({
      data: {
        userId: auth.userId,
        selfAnalysisReportId: report.id,
        status: 'QUEUED',
        candidateCompanyIds,
        targetRoles,
        preferredLocations,
        refreshOfficialSources: body.refreshOfficialSources !== false,
        progressTotal: candidateCompanyIds.length,
        warnings: [],
      },
      include: recommendationRunInclude,
    });
    enqueueRecommendationRun(run.id);
    const location = `/api/v1/company-recommendation-runs/${run.id}`;
    return Response.json(formatRecommendationRun(run), { status: 202, headers: { location } });
  } catch (error) {
    return internalError(error, '企業提案の開始');
  }
}
