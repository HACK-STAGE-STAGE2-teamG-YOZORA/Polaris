import { LmStudioPolarisAiGateway, PolarisAiError } from '@/infrastructure/ai/lm-studio-ai-gateway';
import { prisma } from '@/lib/prisma';
import { aiError, internalError, problem } from '@/server/api';
import { buildEsAnalysisInput, formatAnalysis, persistAnalysis } from '@/server/es';

type Context = { params: Promise<{ revisionId: string }> };

export async function POST(_request: Request, context: Context): Promise<Response> {
  let ai: LmStudioPolarisAiGateway | undefined;
  try {
    const { revisionId } = await context.params;
    const revision = await prisma.esRevision.findUnique({ where: { id: revisionId }, include: { document: true } });
    if (!revision) return problem(404, 'NOT_FOUND', '指定されたES推敲案がありません。');
    if (revision.freshness === 'STALE') return problem(409, 'CONFLICT', '古くなった推敲案は再検査できません。');
    const input = await buildEsAnalysisInput(revision.document, revision.revisedText);
    ai = new LmStudioPolarisAiGateway();
    const output = await ai.analyzeEs(input);
    const analysisId = await prisma.$transaction(async (tx) => {
      await tx.esAnalysis.updateMany({ where: { revisionId, freshness: 'CURRENT' }, data: { freshness: 'STALE' } });
      const saved = await persistAnalysis(tx, {
        esDocumentId: revision.esDocumentId,
        revisionId,
        sourceKind: 'REVISION',
        input,
        output,
      });
      await tx.esRevision.update({ where: { id: revisionId }, data: { verificationAnalysisId: saved.id } });
      await tx.esDocument.update({
        where: { id: revision.esDocumentId },
        data: { status: saved.submissionReadiness === 'READY_TO_SUBMIT' ? 'VERIFIED' : 'REVISED' },
      });
      return saved.id;
    });
    const analysis = await prisma.esAnalysis.findUniqueOrThrow({ where: { id: analysisId }, include: { claims: { include: { evidence: true } } } });
    return Response.json(formatAnalysis(analysis), { status: 201 });
  } catch (error) {
    if (error instanceof PolarisAiError) return aiError(error);
    return internalError(error, 'ES推敲案の再検査');
  } finally {
    if (ai) await ai[Symbol.asyncDispose]();
  }
}
