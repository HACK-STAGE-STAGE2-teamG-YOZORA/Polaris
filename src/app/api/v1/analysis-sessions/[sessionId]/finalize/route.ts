import { LmStudioPolarisAiGateway, PolarisAiError } from '@/infrastructure/ai/lm-studio-ai-gateway';
import { prisma } from '@/lib/prisma';
import { aiError, internalError, problem, SELF_ANALYSIS_AXES, stringArray } from '@/server/api';
import { formatReport } from '@/server/formatters';

type Context = { params: Promise<{ sessionId: string }> };

export async function POST(_request: Request, context: Context): Promise<Response> {
  let ai: LmStudioPolarisAiGateway | undefined;
  try {
    const { sessionId } = await context.params;
    const session = await prisma.analysisSession.findUnique({ where: { id: sessionId } });
    if (!session) return problem(404, 'NOT_FOUND', '指定されたセッションがありません。');
    if (session.status !== 'READY_TO_FINALIZE') {
      return problem(409, 'CONFLICT', '4軸を生成し、すべて本人評価してから確定してください。');
    }
    const [userMessageCount, assessments, experiences, existingReport] = await Promise.all([
      prisma.message.count({ where: { sessionId, role: 'USER' } }),
      prisma.axisAssessment.findMany({
        where: { sourceSessionId: sessionId, isStale: false },
        include: { evidenceLinks: { include: { evidence: true } } },
      }),
      prisma.experience.findMany({
        where: { sourceSessionId: sessionId, status: 'CONFIRMED' },
        include: { quotes: { select: { messageId: true, quote: true } } },
      }),
      prisma.selfAnalysisReport.findUnique({ where: { sourceSessionId: sessionId } }),
    ]);
    if (existingReport) return problem(409, 'CONFLICT', 'このセッションのレポートは既に作成されています。');
    if (userMessageCount < 1) return problem(409, 'CONFLICT', '確定にはUSERメッセージが1件以上必要です。');
    const byAxis = new Map(assessments.map((item) => [item.axis, item]));
    const missing = SELF_ANALYSIS_AXES.filter((axis) => !byAxis.has(axis));
    const unreviewed = assessments.filter((item) => item.userAssessment === 'UNREVIEWED').map((item) => item.axis);
    if (missing.length > 0 || unreviewed.length > 0) {
      return problem(409, 'CONFLICT', '4軸すべての生成と本人評価が必要です。', {
        details: [...missing.map((axis) => ({ axis, reason: 'NOT_GENERATED' })), ...unreviewed.map((axis) => ({ axis, reason: 'UNREVIEWED' }))],
      });
    }

    ai = new LmStudioPolarisAiGateway();
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
    const references = assessments.map((item) => ({
      id: item.id,
      axis: item.axis,
      position: item.position,
      statement: item.displayStatement,
      userAssessment: item.userAssessment,
    }));
    const language = await ai.writeSelfAnalysisReport({
      sourceSessionId: sessionId,
      userMessageCount,
      axisAssessments: references,
      confirmedExperiences,
    });
    const commentByAssessment = new Map(language.axisComments.map((item) => [item.axisAssessmentId, item.comment]));
    const axisSnapshots = SELF_ANALYSIS_AXES.map((axis) => {
      const item = byAxis.get(axis)!;
      return {
        axisAssessmentId: item.id,
        axis: item.axis,
        position: item.position,
        displayStatement: commentByAssessment.get(item.id) ?? item.displayStatement,
        status: item.status,
        userAssessment: item.userAssessment,
        evidenceIds: item.evidenceLinks.map((link) => link.evidenceId),
      };
    });
    const generatedAt = new Date();
    const report = await prisma.$transaction(async (tx) => {
      const saved = await tx.selfAnalysisReport.create({
        data: {
          sourceSessionId: sessionId,
          summary: language.summary,
          axisSnapshots,
          mustConditions: language.mustConditions,
          preferConditions: language.preferConditions,
          avoidConditions: language.avoidConditions,
          verifyConditions: language.verifyConditions,
          nextExperiments: language.nextExperiments,
          userMessageCount,
          confirmedExperienceCount: experiences.length,
          isStale: false,
          generatedAt,
        },
      });
      await tx.analysisSession.update({
        where: { id: sessionId },
        data: { status: 'COMPLETED', completedAt: generatedAt },
      });
      await tx.overallSelfAnalysisProfile.updateMany({ where: { freshness: 'CURRENT' }, data: { freshness: 'STALE' } });
      await tx.esAnalysis.updateMany({ where: { freshness: 'CURRENT' }, data: { freshness: 'STALE' } });
      await tx.esRevision.updateMany({ where: { freshness: 'CURRENT' }, data: { freshness: 'STALE' } });
      return saved;
    });
    return Response.json(formatReport(report));
  } catch (error) {
    if (error instanceof PolarisAiError) return aiError(error);
    return internalError(error, '自己分析レポートの確定');
  } finally {
    if (ai) await ai[Symbol.asyncDispose]();
  }
}
