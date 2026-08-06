import { prisma } from '@/lib/prisma';
import { internalError, jsonBody, problem } from '@/server/api';
import { companyInclude, formatCompany, validHttpUrl } from '@/server/company';

type Context = { params: Promise<{ companyId: string }> };
const FIELDS = ['name', 'targetRole', 'officialUrl', 'careerUrl', 'recommendationEligible', 'note'] as const;

export async function GET(_request: Request, context: Context): Promise<Response> {
  try {
    const { companyId } = await context.params;
    const company = await prisma.company.findUnique({ where: { id: companyId }, include: companyInclude });
    if (!company) return problem(404, 'NOT_FOUND', '指定された企業がありません。');
    return Response.json(formatCompany(company));
  } catch (error) {
    return internalError(error, '企業の取得');
  }
}

export async function PATCH(request: Request, context: Context): Promise<Response> {
  try {
    const { companyId } = await context.params;
    const body = await jsonBody(request);
    if (!body || Object.keys(body).length === 0 || Object.keys(body).some((key) => !FIELDS.includes(key as never))) {
      return problem(422, 'VALIDATION_ERROR', '更新項目を1つ以上、定義された項目だけで指定してください。');
    }
    if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 200)) {
      return problem(422, 'VALIDATION_ERROR', 'name は1〜200文字で指定してください。');
    }
    for (const field of ['targetRole', 'note'] as const) {
      if (body[field] !== undefined && body[field] !== null && typeof body[field] !== 'string') return problem(422, 'VALIDATION_ERROR', `${field} が不正です。`);
    }
    for (const field of ['officialUrl', 'careerUrl'] as const) {
      if (body[field] !== undefined && body[field] !== null && !validHttpUrl(body[field])) return problem(422, 'VALIDATION_ERROR', `${field} は http(s) URLまたは null で指定してください。`);
    }
    if (body.recommendationEligible !== undefined && typeof body.recommendationEligible !== 'boolean') return problem(422, 'VALIDATION_ERROR', 'recommendationEligible が不正です。');
    const exists = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!exists) return problem(404, 'NOT_FOUND', '指定された企業がありません。');
    const data: Record<string, unknown> = {};
    for (const field of FIELDS) if (Object.hasOwn(body, field)) data[field] = body[field];
    if (typeof data.name === 'string') data.name = data.name.trim();
    const company = await prisma.company.update({ where: { id: companyId }, data: data as never, include: companyInclude });
    return Response.json(formatCompany(company));
  } catch (error) {
    return internalError(error, '企業の更新');
  }
}

export async function DELETE(_request: Request, context: Context): Promise<Response> {
  try {
    const { companyId } = await context.params;
    const exists = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!exists) return problem(404, 'NOT_FOUND', '指定された企業がありません。');
    await prisma.$transaction(async (tx) => {
      await tx.companyRecommendation.deleteMany({ where: { companyId } });
      await tx.company.delete({ where: { id: companyId } });
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    return internalError(error, '企業の削除');
  }
}
