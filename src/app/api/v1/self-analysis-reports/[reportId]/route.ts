import { prisma } from '@/lib/prisma';
import { formatReport } from '../route';

// GET /api/v1/self-analysis-reports/{reportId}
export async function GET(
  _request: Request,
  context: { params: Promise<{ reportId: string }> | { reportId: string } }
): Promise<Response> {
  try {
    const params = await context.params;
    const { reportId } = params;

    const report = await prisma.selfAnalysisAxisReport.findUnique({
      where: { id: reportId },
      include: { axisDetails: true },
    });

    if (!report) {
      return Response.json(
        { code: 'NOT_FOUND', message: '指定された自己分析レポートが存在しません。' },
        { status: 404 }
      );
    }

    return Response.json(formatReport(report), { status: 200 });
  } catch (error) {
    console.error('Error fetching self-analysis report:', error);
    return Response.json(
      { code: 'INTERNAL_ERROR', message: '自己分析レポートの取得中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}
