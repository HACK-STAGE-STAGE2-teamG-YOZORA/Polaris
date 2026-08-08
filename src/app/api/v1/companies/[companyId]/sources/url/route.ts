import { LmStudioPolarisAiGateway, PolarisAiError } from '@/infrastructure/ai/lm-studio-ai-gateway';
import { fetchCompanyUrl, SafeUrlFetchError } from '@/infrastructure/fetch/safe-url-fetcher';
import { prisma } from '@/lib/prisma';
import { aiError, internalError, jsonBody, problem } from '@/server/api';
import { formatCompanyFact, formatCompanySource, persistCompanySource, validHttpUrl } from '@/server/company';
import { requireAuth } from '@/server/auth/require-auth';

type Context = { params: Promise<{ companyId: string }> };

function fetchError(error: SafeUrlFetchError): Response {
  if (error.code === 'UNSAFE_URL') return problem(400, 'UNSAFE_URL', error.message);
  if (error.code === 'FETCH_TIMEOUT') return problem(504, 'URL_FETCH_TIMEOUT', error.message, { retryable: true });
  if (error.code === 'PAYLOAD_TOO_LARGE') return problem(422, 'VALIDATION_ERROR', error.message);
  if (error.code === 'UNSUPPORTED_MEDIA_TYPE') return problem(422, 'VALIDATION_ERROR', error.message);
  return problem(503, 'URL_FETCH_FAILED', error.message, { retryable: true });
}

export async function POST(request: Request, context: Context): Promise<Response> {
  let ai: LmStudioPolarisAiGateway | undefined;
  try {
    const auth = await requireAuth(request);
    if ('response' in auth) return auth.response;
    if (process.env.COMPANY_URL_IMPORT_ENABLED === 'false') {
      return problem(503, 'FEATURE_DISABLED', '企業URL取り込みは現在無効です。');
    }
    const { companyId } = await context.params;
    const body = await jsonBody(request);
    if (!body || !validHttpUrl(body.url)) {
      return problem(422, 'VALIDATION_ERROR', 'url は http(s) URLで指定してください。');
    }
    if (body.trustLevel !== 'OFFICIAL' && body.trustLevel !== 'USER_PROVIDED_UNVERIFIED') {
      return problem(422, 'VALIDATION_ERROR', 'trustLevel が不正です。');
    }
    if (body.renderJavaScript !== undefined && typeof body.renderJavaScript !== 'boolean') {
      return problem(422, 'VALIDATION_ERROR', 'renderJavaScript はbooleanで指定してください。');
    }
    if (body.renderJavaScript === true) {
      return problem(422, 'VALIDATION_ERROR', 'JavaScriptレンダリングはP2機能のため現在は使用できません。');
    }
    const company = await prisma.company.findFirst({ where: { id: companyId, userId: auth.userId } });
    if (!company) return problem(404, 'NOT_FOUND', '指定された企業がありません。');

    const fetched = await fetchCompanyUrl(body.url);
    ai = new LmStudioPolarisAiGateway();
    const extracted = await ai.extractCompanyFacts({
      company: {
        id: company.id,
        name: company.name,
        ...(company.targetRole ? { targetRole: company.targetRole } : {}),
      },
      source: {
        title: fetched.title,
        sourceUrl: fetched.url,
        trustLevel: body.trustLevel,
        text: fetched.text,
      },
    });
    const source = await persistCompanySource({
      companyId,
      type: 'URL',
      trustLevel: body.trustLevel,
      title: fetched.title,
      sourceUrl: fetched.url,
      text: fetched.text,
      extracted,
    });
    return Response.json({
      source: formatCompanySource(source),
      facts: source.facts.map((fact) => formatCompanyFact(fact, source.sourceUrl)),
      unknownItems: extracted.unknownItems,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof SafeUrlFetchError) return fetchError(error);
    if (error instanceof PolarisAiError) return aiError(error);
    return internalError(error, '企業URLの取り込み');
  } finally {
    if (ai) await ai[Symbol.asyncDispose]();
  }
}
