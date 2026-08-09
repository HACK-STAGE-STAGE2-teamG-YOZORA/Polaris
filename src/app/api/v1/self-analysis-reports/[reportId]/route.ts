import { prisma } from '@/lib/prisma';
import { internalError, problem } from '@/server/api';
import { formatReport } from '@/server/formatters';
import { requireAuth } from '@/server/auth/require-auth';

export async function GET(request: Request, context: { params: Promise<{ reportId: string }> }): Promise<Response> {
  try {
    const auth = await requireAuth(request);
    if ('response' in auth) return auth.response;
    const { reportId } = await context.params;
    const report = await prisma.selfAnalysisReport.findFirst({ where: { id: reportId, sourceSession: { userId: auth.userId } } });
    if (!report) return problem(404, 'NOT_FOUND', '指定された自己分析レポートがありません。');
    return Response.json(formatReport(report));
  } catch (error) {
    return internalError(error, '自己分析レポートの取得');
  }
}
