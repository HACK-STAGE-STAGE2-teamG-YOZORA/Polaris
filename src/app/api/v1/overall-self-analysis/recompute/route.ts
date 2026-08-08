import { LmStudioPolarisAiGateway, PolarisAiError } from '@/infrastructure/ai/lm-studio-ai-gateway';
import { prisma } from '@/lib/prisma';
import { aiError, internalError, objectArray, problem, stringArray } from '@/server/api';
import { deriveAxisPosition } from '@/server/axis';
import { formatOverallProfile } from '@/server/formatters';
import type { AxisPosition, SelfAnalysisAxis } from '@/types/dashboard';
import { requireAuth } from '@/server/auth/require-auth';

export async function POST(request: Request): Promise<Response> {
  let ai: LmStudioPolarisAiGateway | undefined;
  let authenticatedUserId: string | undefined;
  try {
    const auth = await requireAuth(request);
    if ('response' in auth) return auth.response;
    authenticatedUserId = auth.userId;
    const [reports, experiences, evidenceItems, quotes] = await Promise.all([
      prisma.selfAnalysisReport.findMany({ where: { sourceSession: { userId: auth.userId, status: 'COMPLETED' } }, orderBy: { generatedAt: 'asc' } }),
      prisma.experience.findMany({
        where: { userId: auth.userId, status: 'CONFIRMED' },
        include: { quotes: { select: { messageId: true, quote: true } } },
      }),
      prisma.axisEvidenceItem.findMany({ where: { experience: { userId: auth.userId, status: 'CONFIRMED' } } }),
      prisma.experienceQuote.findMany({
        where: { experience: { userId: auth.userId, status: 'CONFIRMED' } },
        include: { message: { select: { sessionId: true } } },
      }),
    ]);
    if (reports.length === 0) return problem(409, 'CONFLICT', '完了済みの自己分析レポートがありません。');

    const completedSessionReports = reports.map((report) => ({
      id: report.id,
      summary: report.summary,
      axes: objectArray(report.axisSnapshots).map((axis) => ({
        axis: axis.axis as SelfAnalysisAxis,
        position: axis.position as AxisPosition,
        statement: String(axis.displayStatement ?? ''),
        evidenceIds: stringArray(axis.evidenceIds),
        contextNotes: [],
        userAssessment: axis.userAssessment as 'UNREVIEWED' | 'MATCHES' | 'PARTIALLY_MATCHES' | 'DOES_NOT_MATCH' | 'NEEDS_EXPLORATION',
      })),
    }));
    const confirmedExperiences = experiences.map((item) => ({
      id: item.id,
      status: 'CONFIRMED' as const,
      type: item.type,
      title: item.title,
      situation: item.situation,
      goal: item.goal,
      role: item.role,
      options: stringArray(item.options),
      decision: item.decision,
      decisionReason: item.decisionReason,
      actions: stringArray(item.actions),
      result: item.result,
      positiveEmotion: item.positiveEmotion,
      negativeEmotion: item.negativeEmotion,
      energyChange: item.energyChange as -2 | -1 | 0 | 1 | 2,
      environment: stringArray(item.environment),
      evidenceQuotes: item.quotes,
      missingFields: [],
    }));
    const aiEvidence = evidenceItems.map((item) => ({
      id: item.id,
      experienceId: item.experienceId,
      axis: item.axis,
      pole: item.pole,
      statement: item.statement,
      supportType: item.supportType,
      quote: item.quote,
      interpretation: item.interpretation,
    }));
    ai = new LmStudioPolarisAiGateway();
    const output = await ai.generateOverallSelfAnalysis({
      completedSessionReports,
      confirmedExperiences,
      evidenceItems: aiEvidence,
      sourceUserQuotes: quotes.map((item) => ({ messageId: item.messageId, sessionId: item.message.sessionId, quote: item.quote })),
    });
    const evidenceById = new Map(evidenceItems.map((item) => [item.id, item]));
    const axisTrends = output.axisTrends.map((trend) => {
      const selected = trend.evidenceIds.map((id) => evidenceById.get(id)).filter((item) => item !== undefined);
      return { ...trend, position: deriveAxisPosition(trend.suggestedPosition, selected) };
    });
    const completedSessionCount = new Set(reports.map((report) => report.sourceSessionId)).size;
    const userMessageCount = await prisma.message.count({
      where: { role: 'USER', session: { userId: auth.userId, status: 'COMPLETED' } },
    });
    const warningReasons = [
      ...(completedSessionCount < 2 ? ['FEW_COMPLETED_SESSIONS'] : []),
      ...(experiences.length < 3 ? ['FEW_CONFIRMED_EXPERIENCES'] : []),
    ];
    const generatedAt = new Date();
    const profile = await prisma.$transaction(async (tx) => {
      const saved = await tx.overallSelfAnalysisProfile.upsert({
      where: { userId: auth.userId },
      create: {
        userId: auth.userId,
        summary: output.summary,
        axisTrends,
        strengths: output.strengths,
        weaknesses: output.weaknesses,
        sourceReportIds: reports.map((report) => report.id),
        completedSessionCount,
        userMessageCount,
        confirmedExperienceCount: experiences.length,
        isDataSparse: warningReasons.length > 0,
        dataWarningReasons: warningReasons,
        freshness: 'CURRENT',
        generatedAt,
      },
      update: {
        summary: output.summary,
        axisTrends,
        strengths: output.strengths,
        weaknesses: output.weaknesses,
        sourceReportIds: reports.map((report) => report.id),
        completedSessionCount,
        userMessageCount,
        confirmedExperienceCount: experiences.length,
        isDataSparse: warningReasons.length > 0,
        dataWarningReasons: warningReasons,
        freshness: 'CURRENT',
        generatedAt,
      },
      });
      await tx.esAnalysis.updateMany({ where: { document: { userId: auth.userId }, freshness: 'CURRENT' }, data: { freshness: 'STALE' } });
      await tx.esRevision.updateMany({ where: { document: { userId: auth.userId }, freshness: 'CURRENT' }, data: { freshness: 'STALE' } });
      return saved;
    });
    return Response.json(formatOverallProfile(profile));
  } catch (error) {
    if (authenticatedUserId) {
      await prisma.overallSelfAnalysisProfile.updateMany({ where: { userId: authenticatedUserId, freshness: 'CURRENT' }, data: { freshness: 'STALE' } }).catch(() => undefined);
    }
    if (error instanceof PolarisAiError) return aiError(error);
    return internalError(error, '総合自己分析の再計算');
  } finally {
    if (ai) await ai[Symbol.asyncDispose]();
  }
}
