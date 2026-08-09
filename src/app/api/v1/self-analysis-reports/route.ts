import { prisma } from '@/lib/prisma';
import { internalError, page, readPagination } from '@/server/api';
import { formatReportSummary } from '@/server/formatters';
import { requireAuth } from '@/server/auth/require-auth';

export async function GET(request: Request): Promise<Response> {
  try {
    const auth = await requireAuth(request);
    if ('response' in auth) return auth.response;
    const { cursor, limit } = readPagination(request);
    // 経験カードから「そのセッションの自己分析結果」を引くために使う絞り込み。
    // sourceSessionIdはレポート側のユニークキーなので、指定時は最大1件しか返らない
    const sourceSessionId = new URL(request.url).searchParams.get('sourceSessionId');
    const records = await prisma.selfAnalysisReport.findMany({
      where: {
        sourceSession: { userId: auth.userId },
        ...(sourceSessionId ? { sourceSessionId } : {}),
      },
      orderBy: [{ generatedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    return Response.json(page(records.map(formatReportSummary), limit));
  } catch (error) {
    return internalError(error, '自己分析レポート一覧の取得');
  }
}
