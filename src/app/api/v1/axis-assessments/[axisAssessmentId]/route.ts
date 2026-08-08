import { prisma } from '@/lib/prisma';
import { internalError, jsonBody, problem, SELF_ANALYSIS_AXES } from '@/server/api';
import { deriveAxisStatus } from '@/server/axis';
import { formatAxisAssessment } from '@/server/formatters';
import { requireAuth } from '@/server/auth/require-auth';

const USER_ASSESSMENTS = ['UNREVIEWED', 'MATCHES', 'PARTIALLY_MATCHES', 'DOES_NOT_MATCH', 'NEEDS_EXPLORATION'] as const;
type Context = { params: Promise<{ axisAssessmentId: string }> };

export async function PATCH(request: Request, context: Context): Promise<Response> {
  try {
    const auth = await requireAuth(request);
    if ('response' in auth) return auth.response;
    const { axisAssessmentId } = await context.params;
    const body = await jsonBody(request);
    if (!body || !USER_ASSESSMENTS.includes(body.assessment as never)) {
      return problem(422, 'VALIDATION_ERROR', 'assessment が不正です。');
    }
    if (body.editedStatement !== undefined && (typeof body.editedStatement !== 'string' || !body.editedStatement.trim() || body.editedStatement.length > 1000)) {
      return problem(422, 'VALIDATION_ERROR', 'editedStatement は1〜1000文字で指定してください。');
    }
    if (body.note !== undefined && (typeof body.note !== 'string' || body.note.length > 3000)) {
      return problem(422, 'VALIDATION_ERROR', 'note は3000文字以内で指定してください。');
    }
    const existing = await prisma.axisAssessment.findFirst({
      where: { id: axisAssessmentId, sourceSession: { userId: auth.userId } },
      include: { evidenceLinks: { include: { evidence: true } } },
    });
    if (!existing) return problem(404, 'NOT_FOUND', '指定された4軸分析がありません。');
    if (existing.isStale) return problem(409, 'CONFLICT', '古くなった4軸分析は評価できません。再生成してください。');
    const assessment = body.assessment as (typeof USER_ASSESSMENTS)[number];
    const status = deriveAxisStatus(existing.position, assessment, existing.evidenceLinks.map((link) => link.evidence));
    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.axisAssessment.update({
        where: { id: axisAssessmentId },
        data: {
          userAssessment: assessment,
          ...(typeof body.editedStatement === 'string' ? { displayStatement: body.editedStatement.trim() } : {}),
          userNote: typeof body.note === 'string' ? body.note : null,
          status,
        },
      });
      await tx.selfAnalysisReport.updateMany({ where: { sourceSessionId: existing.sourceSessionId, isStale: false }, data: { isStale: true } });
      await tx.overallSelfAnalysisProfile.updateMany({ where: { userId: auth.userId, freshness: 'CURRENT' }, data: { freshness: 'STALE' } });
      await tx.esAnalysis.updateMany({ where: { document: { userId: auth.userId }, freshness: 'CURRENT' }, data: { freshness: 'STALE' } });
      await tx.esRevision.updateMany({ where: { document: { userId: auth.userId }, freshness: 'CURRENT' }, data: { freshness: 'STALE' } });
      const remaining = await tx.axisAssessment.count({
        where: { sourceSessionId: existing.sourceSessionId, isStale: false, userAssessment: 'UNREVIEWED' },
      });
      const axisCount = await tx.axisAssessment.count({ where: { sourceSessionId: existing.sourceSessionId, isStale: false } });
      if (remaining === 0 && axisCount === SELF_ANALYSIS_AXES.length) {
        await tx.analysisSession.update({ where: { id: existing.sourceSessionId }, data: { status: 'READY_TO_FINALIZE' } });
      }
      return saved;
    });
    const withEvidence = await prisma.axisAssessment.findUniqueOrThrow({
      where: { id: updated.id }, include: { evidenceLinks: { include: { evidence: true } } },
    });
    return Response.json(formatAxisAssessment(withEvidence));
  } catch (error) {
    return internalError(error, '4軸分析の本人評価');
  }
}
