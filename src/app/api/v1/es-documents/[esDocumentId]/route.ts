import { prisma } from '@/lib/prisma';
import { internalError, jsonBody, problem } from '@/server/api';
import { esDocumentInclude, formatEsDocument, validatePreferredExperiences } from '@/server/es';

type Context = { params: Promise<{ esDocumentId: string }> };
const FIELDS = ['companyId', 'targetRole', 'question', 'characterLimit', 'originalText', 'preferredExperienceIds', 'emphasis'] as const;

export async function GET(_request: Request, context: Context): Promise<Response> {
  try {
    const { esDocumentId } = await context.params;
    const document = await prisma.esDocument.findUnique({ where: { id: esDocumentId }, include: esDocumentInclude });
    if (!document) return problem(404, 'NOT_FOUND', '指定されたES文書がありません。');
    return Response.json(formatEsDocument(document));
  } catch (error) {
    return internalError(error, 'ES文書の取得');
  }
}

export async function PATCH(request: Request, context: Context): Promise<Response> {
  try {
    const { esDocumentId } = await context.params;
    const body = await jsonBody(request);
    if (!body || Object.keys(body).length === 0 || Object.keys(body).some((key) => !FIELDS.includes(key as never))) {
      return problem(422, 'VALIDATION_ERROR', '更新項目を1つ以上、定義された項目だけで指定してください。');
    }
    const exists = await prisma.esDocument.findUnique({ where: { id: esDocumentId }, select: { id: true } });
    if (!exists) return problem(404, 'NOT_FOUND', '指定されたES文書がありません。');
    if (body.question !== undefined && (typeof body.question !== 'string' || !body.question.trim() || body.question.length > 5000)) return problem(422, 'VALIDATION_ERROR', 'question が不正です。');
    if (body.originalText !== undefined && (typeof body.originalText !== 'string' || !body.originalText.trim() || body.originalText.length > 20_000)) return problem(422, 'VALIDATION_ERROR', 'originalText が不正です。');
    if (body.characterLimit !== undefined && (!Number.isInteger(body.characterLimit) || Number(body.characterLimit) < 1 || Number(body.characterLimit) > 10_000)) return problem(422, 'VALIDATION_ERROR', 'characterLimit が不正です。');
    if (body.targetRole !== undefined && body.targetRole !== null && (typeof body.targetRole !== 'string' || body.targetRole.length > 200)) return problem(422, 'VALIDATION_ERROR', 'targetRole が不正です。');
    if (body.emphasis !== undefined && (!Array.isArray(body.emphasis) || !body.emphasis.every((item) => typeof item === 'string'))) return problem(422, 'VALIDATION_ERROR', 'emphasis が不正です。');
    if (typeof body.companyId === 'string') {
      const company = await prisma.company.findUnique({ where: { id: body.companyId }, select: { id: true } });
      if (!company) return problem(404, 'NOT_FOUND', '指定された企業がありません。');
    } else if (body.companyId !== undefined && body.companyId !== null) return problem(422, 'VALIDATION_ERROR', 'companyId が不正です。');
    let preferred: string[] | undefined;
    if (body.preferredExperienceIds !== undefined) {
      const checked = await validatePreferredExperiences(body.preferredExperienceIds);
      if (typeof checked === 'string') return problem(422, 'VALIDATION_ERROR', checked);
      preferred = checked;
    }
    const data: Record<string, unknown> = {};
    for (const field of FIELDS) if (Object.hasOwn(body, field)) data[field] = body[field];
    if (preferred) data.preferredExperienceIds = preferred;
    data.status = 'DRAFT';
    const document = await prisma.$transaction(async (tx) => {
      await tx.esAnalysis.updateMany({ where: { esDocumentId, freshness: 'CURRENT' }, data: { freshness: 'STALE' } });
      await tx.esRevision.updateMany({ where: { esDocumentId, freshness: 'CURRENT' }, data: { freshness: 'STALE' } });
      return tx.esDocument.update({ where: { id: esDocumentId }, data: data as never, include: esDocumentInclude });
    });
    return Response.json(formatEsDocument(document));
  } catch (error) {
    return internalError(error, 'ES文書の更新');
  }
}

export async function DELETE(_request: Request, context: Context): Promise<Response> {
  try {
    const { esDocumentId } = await context.params;
    const exists = await prisma.esDocument.findUnique({ where: { id: esDocumentId }, select: { id: true } });
    if (!exists) return problem(404, 'NOT_FOUND', '指定されたES文書がありません。');
    await prisma.esDocument.delete({ where: { id: esDocumentId } });
    return new Response(null, { status: 204 });
  } catch (error) {
    return internalError(error, 'ES文書の削除');
  }
}
