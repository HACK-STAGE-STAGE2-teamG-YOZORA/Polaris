import { LmStudioPolarisAiGateway, PolarisAiError } from '@/infrastructure/ai/lm-studio-ai-gateway';
import { prisma } from '@/lib/prisma';
import { aiError, internalError, problem } from '@/server/api';
import { buildEsAnalysisInput, formatAnalysis, persistAnalysis } from '@/server/es';

type Context = { params: Promise<{ esDocumentId: string }> };

export async function POST(_request: Request, context: Context): Promise<Response> {
  let ai: LmStudioPolarisAiGateway | undefined;
  try {
    const { esDocumentId } = await context.params;
    const document = await prisma.esDocument.findUnique({ where: { id: esDocumentId } });
    if (!document) return problem(404, 'NOT_FOUND', '指定されたES文書がありません。');
    const input = await buildEsAnalysisInput(document, document.originalText);
    ai = new LmStudioPolarisAiGateway();
    const output = await ai.analyzeEs(input);
    const analysisId = await prisma.$transaction(async (tx) => {
      await tx.esAnalysis.updateMany({ where: { esDocumentId, freshness: 'CURRENT' }, data: { freshness: 'STALE' } });
      await tx.esRevision.updateMany({ where: { esDocumentId, freshness: 'CURRENT' }, data: { freshness: 'STALE' } });
      const saved = await persistAnalysis(tx, { esDocumentId, revisionId: null, sourceKind: 'ORIGINAL', input, output });
      await tx.esDocument.update({ where: { id: esDocumentId }, data: { status: 'ANALYZED' } });
      return saved.id;
    });
    const analysis = await prisma.esAnalysis.findUniqueOrThrow({ where: { id: analysisId }, include: { claims: { include: { evidence: true } } } });
    return Response.json(formatAnalysis(analysis), { status: 201 });
  } catch (error) {
    if (error instanceof PolarisAiError) return aiError(error);
    return internalError(error, 'ES文書の検査');
  } finally {
    if (ai) await ai[Symbol.asyncDispose]();
  }
}
