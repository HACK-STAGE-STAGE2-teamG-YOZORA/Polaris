import { LmStudioPolarisAiGateway, PolarisAiError } from '@/infrastructure/ai/lm-studio-ai-gateway';
import { prisma } from '@/lib/prisma';
import { aiError, internalError, jsonBody, problem } from '@/server/api';
import { formatCompanyFact, formatCompanySource, persistCompanySource, validHttpUrl } from '@/server/company';
import { requireAuth } from '@/server/auth/require-auth';

type Context = { params: Promise<{ companyId: string }> };

export async function POST(request: Request, context: Context): Promise<Response> {
  let ai: LmStudioPolarisAiGateway | undefined;
  try {
    const auth = await requireAuth(request);
    if ('response' in auth) return auth.response;
    const { companyId } = await context.params;
    const body = await jsonBody(request);
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const sourceText = typeof body?.text === 'string' ? body.text.trim() : '';
    const trustLevel = body?.trustLevel;
    if (!title || title.length > 300 || !sourceText || sourceText.length > 100_000) {
      return problem(422, 'VALIDATION_ERROR', 'title と text の長さが不正です。');
    }
    if (trustLevel !== 'OFFICIAL' && trustLevel !== 'USER_PROVIDED_UNVERIFIED') {
      return problem(422, 'VALIDATION_ERROR', 'trustLevel が不正です。');
    }
    if (body?.sourceUrl !== undefined && !validHttpUrl(body.sourceUrl)) {
      return problem(422, 'VALIDATION_ERROR', 'sourceUrl は http(s) URLで指定してください。');
    }
    const company = await prisma.company.findFirst({ where: { id: companyId, userId: auth.userId } });
    if (!company) return problem(404, 'NOT_FOUND', '指定された企業がありません。');
    ai = new LmStudioPolarisAiGateway();
    const extracted = await ai.extractCompanyFacts({
      company: { id: company.id, name: company.name, ...(company.targetRole ? { targetRole: company.targetRole } : {}) },
      source: {
        title,
        ...(typeof body?.sourceUrl === 'string' ? { sourceUrl: body.sourceUrl } : {}),
        trustLevel,
        text: sourceText,
      },
    });
    const source = await persistCompanySource({
      companyId,
      type: 'TEXT',
      trustLevel,
      title,
      sourceUrl: typeof body?.sourceUrl === 'string' ? body.sourceUrl : null,
      text: sourceText,
      extracted,
    });
    return Response.json({
      source: formatCompanySource(source),
      facts: source.facts.map((fact) => formatCompanyFact(fact, source.sourceUrl)),
      unknownItems: extracted.unknownItems,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof PolarisAiError) return aiError(error);
    return internalError(error, '企業テキストの取り込み');
  } finally {
    if (ai) await ai[Symbol.asyncDispose]();
  }
}
