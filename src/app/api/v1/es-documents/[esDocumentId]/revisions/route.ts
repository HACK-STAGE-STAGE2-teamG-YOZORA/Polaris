import { LmStudioPolarisAiGateway, PolarisAiError } from '@/infrastructure/ai/lm-studio-ai-gateway';
import { prisma } from '@/lib/prisma';
import { aiError, countCodePoints, internalError, jsonBody, problem } from '@/server/api';
import { analysisInclude, buildEsAnalysisInput, formatRevision, revisionInclude, toAiAnalysis } from '@/server/es';

type Context = { params: Promise<{ esDocumentId: string }> };

export async function POST(request: Request, context: Context): Promise<Response> {
  let ai: LmStudioPolarisAiGateway | undefined;
  try {
    const { esDocumentId } = await context.params;
    const body = await jsonBody(request) ?? {};
    for (const field of ['emphasis', 'preserveExpressions'] as const) {
      if (body[field] !== undefined && (!Array.isArray(body[field]) || !(body[field] as unknown[]).every((item) => typeof item === 'string'))) {
        return problem(422, 'VALIDATION_ERROR', `${field} は文字列配列で指定してください。`);
      }
    }
    const document = await prisma.esDocument.findUnique({ where: { id: esDocumentId } });
    if (!document) return problem(404, 'NOT_FOUND', '指定されたES文書がありません。');
    const latestAnalysis = await prisma.esAnalysis.findFirst({
      where: { esDocumentId, sourceKind: 'ORIGINAL', freshness: 'CURRENT' },
      include: analysisInclude,
      orderBy: { createdAt: 'desc' },
    });
    if (!latestAnalysis) return problem(409, 'CONFLICT', '先に現在のES原文を検査してください。');
    const input = await buildEsAnalysisInput(document, document.originalText);
    const reportIds = new Set((await prisma.selfAnalysisReport.findMany({ select: { id: true } })).map((item) => item.id));
    const experienceIds = new Set(input.allConfirmedExperiences.map((item) => item.id));
    ai = new LmStudioPolarisAiGateway();
    const output = await ai.reviseEs({
      ...input,
      latestAnalysis: toAiAnalysis(latestAnalysis),
      emphasis: (body.emphasis as string[] | undefined) ?? (Array.isArray(document.emphasis) ? document.emphasis as string[] : []),
      preserveExpressions: (body.preserveExpressions as string[] | undefined) ?? [],
      forbiddenAdditions: ['NUMBER', 'PERIOD', 'ROLE', 'RESULT', 'COMPANY_FACT', 'FUTURE_GOAL'],
    });
    if (output.usedExperienceIds.some((id) => !experienceIds.has(id)) || output.usedSessionReportIds.some((id) => !reportIds.has(id))) {
      return problem(502, 'AI_INVALID_OUTPUT', 'AIが許可されていない根拠IDを返しました。', { retryable: true });
    }
    const revision = await prisma.$transaction(async (tx) => {
      await tx.esRevision.updateMany({ where: { esDocumentId, freshness: 'CURRENT' }, data: { freshness: 'STALE' } });
      const saved = await tx.esRevision.create({
        data: {
          esDocumentId,
          basedOnAnalysisId: latestAnalysis.id,
          freshness: 'CURRENT',
          revisedText: output.revisedText,
          usedExperienceIds: output.usedExperienceIds,
          usedSessionReportIds: output.usedSessionReportIds,
          characterCount: countCodePoints(output.revisedText),
          verificationAnalysisId: null,
          changes: {
            create: output.changes.map((change) => ({
              beforeText: change.before,
              afterText: change.after,
              reason: change.reason,
              evidence: change.evidence,
              decision: 'PENDING',
            })),
          },
        },
        include: revisionInclude,
      });
      await tx.esDocument.update({ where: { id: esDocumentId }, data: { status: 'REVISED' } });
      return saved;
    });
    return Response.json(formatRevision(revision), { status: 201 });
  } catch (error) {
    if (error instanceof PolarisAiError) return aiError(error);
    return internalError(error, 'ES推敲案の作成');
  } finally {
    if (ai) await ai[Symbol.asyncDispose]();
  }
}
