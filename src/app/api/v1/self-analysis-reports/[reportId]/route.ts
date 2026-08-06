import { prisma } from '@/lib/prisma';
import { internalError, problem } from '@/server/api';
import { formatReport } from '@/server/formatters';

export async function GET(_request: Request, context: { params: Promise<{ reportId: string }> }): Promise<Response> {
  try {
    const { reportId } = await context.params;
    const report = await prisma.selfAnalysisReport.findUnique({ where: { id: reportId } });
    if (!report) return problem(404, 'NOT_FOUND', '指定された自己分析レポートがありません。');
    return Response.json(formatReport(report));
  } catch (error) {
    return internalError(error, '自己分析レポートの取得');
  }
}
