import { prisma } from '../../../../../lib/prisma.js';

function formatAxisDetail(d: Record<string, unknown>) {
  return {
    id: d.id,
    axisType: d.axisType,
    currentTendency: d.currentTendency,
    userComment: d.userComment,
    leftEvidence: d.leftEvidence,
    rightEvidence: d.rightEvidence,
    contextDifference: d.contextDifference ?? null,
    counterExample: d.counterExample ?? null,
    evidenceExperienceIds: d.evidenceExperienceIds ?? [],
    evidenceUtteranceIds: d.evidenceUtteranceIds ?? [],
    userEvaluation: d.userEvaluation ?? 'UNREVIEWED',
    createdAt: d.createdAt instanceof Date
      ? d.createdAt.toISOString()
      : new Date(d.createdAt as string).toISOString(),
  };
}

function formatReport(report: Record<string, unknown>) {
  return {
    id: report.id,
    isOutdated: report.isOutdated ?? false,
    createdAt: report.createdAt instanceof Date
      ? report.createdAt.toISOString()
      : new Date(report.createdAt as string).toISOString(),
    axisDetails: Array.isArray(report.axisDetails)
      ? (report.axisDetails as Record<string, unknown>[]).map(formatAxisDetail)
      : [],
  };
}

// GET /api/v1/career-reports/{reportId}
export async function GET(
  _request: Request,
  context: { params: Promise<{ reportId: string }> | { reportId: string } }
): Promise<Response> {
  try {
    const params = await context.params;
    const { reportId } = params;

    const report = await prisma.careerReport.findUnique({ where: { id: reportId } });

    if (!report) {
      return Response.json(
        { code: 'NOT_FOUND', message: '指定されたキャリアレポートが存在しません。' },
        { status: 404 }
      );
    }

    return Response.json(formatReport(report), { status: 200 });
  } catch (error) {
    console.error('Error fetching career report:', error);
    return Response.json(
      { code: 'INTERNAL_ERROR', message: 'キャリアレポートの取得中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}
