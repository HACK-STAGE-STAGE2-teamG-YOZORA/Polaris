import { prisma } from '@/lib/prisma';
import { internalError, problem } from '@/server/api';
import { formatReport } from '@/server/formatters';
import { requireAuth } from '@/server/auth/require-auth';

export async function GET(request: Request): Promise<Response> {
  try {
    const auth = await requireAuth(request);
    if ('response' in auth) return auth.response;
    const report = await prisma.selfAnalysisReport.findFirst({ where: { sourceSession: { userId: auth.userId } }, orderBy: { generatedAt: 'desc' } });
    if (!report) return problem(404, 'NOT_FOUND', '自己分析レポートがありません。');
    return Response.json(formatReport(report));
  } catch (error) {
    return internalError(error, '最新自己分析レポートの取得');
  }
}
