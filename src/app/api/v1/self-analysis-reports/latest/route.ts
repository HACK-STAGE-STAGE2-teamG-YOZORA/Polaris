import { prisma } from '@/lib/prisma';
import { formatReport } from '../route';

// GET /api/v1/self-analysis-reports/latest
export async function GET(_request: Request): Promise<Response> {
  try {
    const reports = await prisma.selfAnalysisAxisReport.findMany({
      take: 1,
      orderBy: { createdAt: 'desc' },
      include: { axisDetails: true },
    });

    if (!reports || reports.length === 0) {
      return Response.json(
        { code: 'NOT_FOUND', message: '自己分析レポートが存在しません。' },
        { status: 404 }
      );
    }

    return Response.json(formatReport(reports[0]), { status: 200 });
  } catch (error) {
    console.error('Error fetching latest self-analysis report:', error);
    return Response.json(
      { code: 'INTERNAL_ERROR', message: '最新自己分析レポートの取得中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}
