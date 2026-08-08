import { LmStudioPolarisAiGateway, PolarisAiError } from '@/infrastructure/ai/lm-studio-ai-gateway';
import { prisma } from '@/lib/prisma';
import { aiError, internalError, problem, SELF_ANALYSIS_AXES, stringArray } from '@/server/api';
import { deriveAxisPosition } from '@/server/axis';
import { formatAxisAssessment } from '@/server/formatters';
import { requireAuth } from '@/server/auth/require-auth';
import type { AxisPosition } from '@/types/dashboard';

type Context = { params: Promise<{ sessionId: string }> };

export async function POST(request: Request, context: Context): Promise<Response> {
  let ai: LmStudioPolarisAiGateway | undefined;
  try {
    const auth = await requireAuth(request);
    if ('response' in auth) return auth.response;
    const { sessionId } = await context.params;
    const session = await prisma.analysisSession.findFirst({ where: { id: sessionId, userId: auth.userId } });
    if (!session) return problem(404, 'NOT_FOUND', '指定されたセッションがありません。');
    if (session.status === 'COMPLETED' || session.status === 'ABANDONED') {
      return problem(409, 'CONFLICT', '完了または破棄されたセッションは再分析できません。');
    }
    const userMessageCount = await prisma.message.count({ where: { sessionId, role: 'USER' } });
    if (userMessageCount < 1) return problem(409, 'CONFLICT', '4軸分析にはUSERメッセージが1件以上必要です。');

    const [experiences, evidenceItems, previous] = await Promise.all([
      prisma.experience.findMany({
        where: { sourceSessionId: sessionId, status: 'CONFIRMED' },
        include: { quotes: { select: { messageId: true, quote: true } } },
      }),
      prisma.axisEvidenceItem.findMany({
        where: { experience: { sourceSessionId: sessionId, status: 'CONFIRMED' } },
      }),
      prisma.axisAssessment.findMany({ where: { sourceSessionId: sessionId } }),
    ]);

    ai = new LmStudioPolarisAiGateway();
    const generated = await ai.generateAxisAssessments({
      sourceSessionId: sessionId,
      userMessageCount,
      confirmedExperiences: experiences.map((item) => ({
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
      })),
      evidenceItems: evidenceItems.map((item) => ({
        id: item.id,
        experienceId: item.experienceId,
        axis: item.axis,
        pole: item.pole,
        statement: item.statement,
        supportType: item.supportType,
        quote: item.quote,
        interpretation: item.interpretation,
      })),
      previousAssessments: previous.map((item) => ({
        id: item.id,
        axis: item.axis,
        position: item.position,
        statement: item.displayStatement,
        userAssessment: item.userAssessment,
      })),
    });
    const generatedByAxis = new Map(generated.assessments.map((item) => [item.axis, item]));
    const evidenceById = new Map(evidenceItems.map((item) => [item.id, item]));

    const items = await prisma.$transaction(async (tx) => {
      const saved = [];
      for (const axis of SELF_ANALYSIS_AXES) {
        const candidate = generatedByAxis.get(axis);
        const groupedIds = candidate
          ? [...candidate.leftEvidenceIds, ...candidate.rightEvidenceIds, ...candidate.bothEvidenceIds, ...candidate.contextEvidenceIds, ...candidate.counterEvidenceIds]
          : [];
        const uniqueIds = [...new Set(groupedIds)];
        const selectedEvidence = uniqueIds.map((id) => evidenceById.get(id)).filter((item) => item !== undefined);
        const position = deriveAxisPosition(candidate?.suggestedPosition ?? 'INSUFFICIENT_EVIDENCE', selectedEvidence);
        const statement = candidate?.statement ?? '確認済みの根拠が不足しているため、現時点では判断できません。';
        const assessment = await tx.axisAssessment.upsert({
          where: { sourceSessionId_axis: { sourceSessionId: sessionId, axis } },
          create: {
            sourceSessionId: sessionId,
            axis,
            position,
            aiStatement: statement,
            displayStatement: statement,
            status: position === 'INSUFFICIENT_EVIDENCE' ? 'INSUFFICIENT_EVIDENCE' : 'CURRENT_HYPOTHESIS',
            leftConditions: candidate?.leftConditions ?? [],
            rightConditions: candidate?.rightConditions ?? [],
            contextNotes: candidate?.contextNotes ?? [],
            userAssessment: 'UNREVIEWED',
            userNote: null,
            isStale: false,
          },
          update: {
            position,
            aiStatement: statement,
            displayStatement: statement,
            status: position === 'INSUFFICIENT_EVIDENCE' ? 'INSUFFICIENT_EVIDENCE' : 'CURRENT_HYPOTHESIS',
            leftConditions: candidate?.leftConditions ?? [],
            rightConditions: candidate?.rightConditions ?? [],
            contextNotes: candidate?.contextNotes ?? [],
            userAssessment: 'UNREVIEWED',
            userNote: null,
            isStale: false,
          },
        });
        await tx.axisAssessmentEvidence.deleteMany({ where: { axisAssessmentId: assessment.id } });
        if (uniqueIds.length > 0) {
          await tx.axisAssessmentEvidence.createMany({
            data: uniqueIds.map((evidenceId) => ({ axisAssessmentId: assessment.id, evidenceId })),
          });
        }
        saved.push(assessment);
      }
      await tx.analysisSession.update({ where: { id: sessionId }, data: { status: 'ACTIVE' } });
      await tx.selfAnalysisReport.updateMany({ where: { sourceSessionId: sessionId, isStale: false }, data: { isStale: true } });
      await tx.overallSelfAnalysisProfile.updateMany({ where: { userId: auth.userId, freshness: 'CURRENT' }, data: { freshness: 'STALE' } });
      await tx.esAnalysis.updateMany({ where: { document: { userId: auth.userId }, freshness: 'CURRENT' }, data: { freshness: 'STALE' } });
      await tx.esRevision.updateMany({ where: { document: { userId: auth.userId }, freshness: 'CURRENT' }, data: { freshness: 'STALE' } });
      return saved;
    });
    const withEvidence = await prisma.axisAssessment.findMany({
      where: { id: { in: items.map((item) => item.id) } },
      include: { evidenceLinks: { include: { evidence: true } } },
      orderBy: { axis: 'asc' },
    });
    return Response.json({ items: withEvidence.map(formatAxisAssessment) });
  } catch (error) {
    if (error instanceof PolarisAiError) return aiError(error);
    return internalError(error, '4軸分析の生成');
  } finally {
    if (ai) await ai[Symbol.asyncDispose]();
  }
}
