import { prisma } from '@/lib/prisma';
import { internalError, jsonBody, problem } from '@/server/api';
import { companyInclude, formatCompany, formatCompanySummary, validHttpUrl } from '@/server/company';

export async function GET(request: Request): Promise<Response> {
  try {
    const rawEligible = new URL(request.url).searchParams.get('recommendationEligible');
    if (rawEligible !== null && rawEligible !== 'true' && rawEligible !== 'false') {
      return problem(422, 'VALIDATION_ERROR', 'recommendationEligible は boolean で指定してください。');
    }
    const companies = await prisma.company.findMany({
      where: rawEligible === null ? undefined : { recommendationEligible: rawEligible === 'true' },
      include: companyInclude,
      orderBy: { updatedAt: 'desc' },
    });
    return Response.json({ items: companies.map(formatCompanySummary) });
  } catch (error) {
    return internalError(error, '企業一覧の取得');
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await jsonBody(request);
    if (!body || typeof body.name !== 'string' || !body.name.trim() || body.name.length > 200) {
      return problem(422, 'VALIDATION_ERROR', 'name は1〜200文字で指定してください。');
    }
    for (const field of ['targetRole', 'note'] as const) {
      if (body[field] !== undefined && typeof body[field] !== 'string') return problem(422, 'VALIDATION_ERROR', `${field} が不正です。`);
    }
    for (const field of ['officialUrl', 'careerUrl'] as const) {
      if (body[field] !== undefined && !validHttpUrl(body[field])) return problem(422, 'VALIDATION_ERROR', `${field} は http(s) URLで指定してください。`);
    }
    if (body.recommendationEligible !== undefined && typeof body.recommendationEligible !== 'boolean') {
      return problem(422, 'VALIDATION_ERROR', 'recommendationEligible が不正です。');
    }
    const company = await prisma.company.create({
      data: {
        name: body.name.trim(),
        targetRole: typeof body.targetRole === 'string' ? body.targetRole : null,
        officialUrl: typeof body.officialUrl === 'string' ? body.officialUrl : null,
        careerUrl: typeof body.careerUrl === 'string' ? body.careerUrl : null,
        recommendationEligible: body.recommendationEligible === true,
        note: typeof body.note === 'string' ? body.note : null,
      },
      include: companyInclude,
    });
    return Response.json(formatCompany(company), { status: 201 });
  } catch (error) {
    return internalError(error, '企業の作成');
  }
}
