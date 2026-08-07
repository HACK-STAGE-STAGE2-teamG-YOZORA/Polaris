import { prisma } from '@/lib/prisma';
import { internalError, problem } from '@/server/api';
import { formatReport } from '@/server/formatters';

export async function GET(): Promise<Response> {
  try {
    const report = await prisma.selfAnalysisReport.findFirst({ orderBy: { generatedAt: 'desc' } });
    if (!report) return problem(404, 'NOT_FOUND', '自己分析レポートがありません。');
    return Response.json(formatReport(report));
  } catch (error) {
    return internalError(error, '最新自己分析レポートの取得');
  }
}
