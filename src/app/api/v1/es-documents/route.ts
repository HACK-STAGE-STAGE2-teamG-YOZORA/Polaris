import { prisma } from '@/lib/prisma';
import { countCodePoints, internalError, jsonBody, problem } from '@/server/api';
import { esDocumentInclude, formatEsDocument, formatEsSummary, validatePreferredExperiences } from '@/server/es';

function stringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export async function GET(request: Request): Promise<Response> {
  try {
    const companyId = new URL(request.url).searchParams.get('companyId');
    const documents = await prisma.esDocument.findMany({
      where: companyId ? { companyId } : undefined,
      orderBy: { updatedAt: 'desc' },
    });
    return Response.json({ items: documents.map(formatEsSummary) });
  } catch (error) {
    return internalError(error, 'ES文書一覧の取得');
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await jsonBody(request);
    if (!body || typeof body.question !== 'string' || !body.question.trim() || countCodePoints(body.question) > 5000) {
      return problem(422, 'VALIDATION_ERROR', 'question は1〜5000文字で指定してください。');
    }
    if (!Number.isInteger(body.characterLimit) || Number(body.characterLimit) < 1 || Number(body.characterLimit) > 10_000) {
      return problem(422, 'VALIDATION_ERROR', 'characterLimit は1〜10000の整数で指定してください。');
    }
    if (typeof body.originalText !== 'string' || !body.originalText.trim() || countCodePoints(body.originalText) > 20_000) {
      return problem(422, 'VALIDATION_ERROR', 'originalText は1〜20000文字で指定してください。');
    }
    if (body.targetRole !== undefined && body.targetRole !== null && (typeof body.targetRole !== 'string' || countCodePoints(body.targetRole) > 200)) {
      return problem(422, 'VALIDATION_ERROR', 'targetRole は200文字以内または null で指定してください。');
    }
    if (body.emphasis !== undefined && !stringList(body.emphasis)) return problem(422, 'VALIDATION_ERROR', 'emphasis は文字列配列で指定してください。');
    if (typeof body.companyId === 'string') {
      const company = await prisma.company.findUnique({ where: { id: body.companyId }, select: { id: true } });
      if (!company) return problem(404, 'NOT_FOUND', '指定された企業がありません。');
    } else if (body.companyId !== undefined && body.companyId !== null) {
      return problem(422, 'VALIDATION_ERROR', 'companyId はIDまたは null で指定してください。');
    }
    const preferred = await validatePreferredExperiences(body.preferredExperienceIds);
    if (typeof preferred === 'string') return problem(422, 'VALIDATION_ERROR', preferred);
    const document = await prisma.esDocument.create({
      data: {
        companyId: typeof body.companyId === 'string' ? body.companyId : null,
        targetRole: typeof body.targetRole === 'string' ? body.targetRole : null,
        question: body.question.trim(),
        characterLimit: body.characterLimit as number,
        originalText: body.originalText,
        preferredExperienceIds: preferred,
        emphasis: (body.emphasis as string[] | undefined) ?? [],
        status: 'DRAFT',
      },
      include: esDocumentInclude,
    });
    return Response.json(formatEsDocument(document), { status: 201 });
  } catch (error) {
    return internalError(error, 'ES文書の作成');
  }
}
