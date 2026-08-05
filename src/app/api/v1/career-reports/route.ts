import { prisma } from '../../../../lib/prisma.js';

const VALID_AXIS_TYPES = [
  'FOCUS_CONNECT',
  'PLAN_EXPERIMENT',
  'MASTERY_IMPACT',
  'STABLE_DYNAMIC',
] as const;

type AxisType = typeof VALID_AXIS_TYPES[number];

interface AxisDetailInput {
  axisType: string;
  currentTendency: string;
  userComment: string;
  leftEvidence: string;
  rightEvidence: string;
  contextDifference?: string;
  counterExample?: string;
  evidenceExperienceIds?: string[];
  evidenceUtteranceIds?: string[];
  userEvaluation?: string;
}

function validateAxisDetail(detail: unknown, index: number): string | null {
  if (typeof detail !== 'object' || detail === null) {
    return `axisDetails[${index}] はオブジェクトである必要があります。`;
  }
  const d = detail as Record<string, unknown>;

  if (!d.axisType || !VALID_AXIS_TYPES.includes(d.axisType as AxisType)) {
    return `axisDetails[${index}].axisType は ${VALID_AXIS_TYPES.join(', ')} のいずれかです。`;
  }
  if (typeof d.currentTendency !== 'string' || d.currentTendency.length === 0) {
    return `axisDetails[${index}].currentTendency は必須の文字列です。`;
  }
  if (typeof d.userComment !== 'string' || d.userComment.length === 0) {
    return `axisDetails[${index}].userComment は必須の文字列です。`;
  }
  if (typeof d.leftEvidence !== 'string' || d.leftEvidence.length === 0) {
    return `axisDetails[${index}].leftEvidence は必須の文字列です。`;
  }
  if (typeof d.rightEvidence !== 'string' || d.rightEvidence.length === 0) {
    return `axisDetails[${index}].rightEvidence は必須の文字列です。`;
  }
  if (d.evidenceExperienceIds !== undefined && !Array.isArray(d.evidenceExperienceIds)) {
    return `axisDetails[${index}].evidenceExperienceIds は配列である必要があります。`;
  }
  if (d.evidenceUtteranceIds !== undefined && !Array.isArray(d.evidenceUtteranceIds)) {
    return `axisDetails[${index}].evidenceUtteranceIds は配列である必要があります。`;
  }
  return null;
}

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

// POST /api/v1/career-reports
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();

    // axisDetails validation
    if (!Array.isArray(body.axisDetails) || body.axisDetails.length !== 4) {
      return Response.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'axisDetails は4軸すべてを含む配列である必要があります。',
          details: [],
        },
        { status: 422 }
      );
    }

    // Validate unique axis types
    const axisTypes = body.axisDetails.map((d: Record<string, unknown>) => d.axisType);
    const uniqueTypes = new Set(axisTypes);
    if (uniqueTypes.size !== 4 || VALID_AXIS_TYPES.some((t) => !uniqueTypes.has(t))) {
      return Response.json(
        {
          code: 'VALIDATION_ERROR',
          message: `axisDetails には ${VALID_AXIS_TYPES.join(', ')} のすべてを1件ずつ含める必要があります。`,
          details: [],
        },
        { status: 422 }
      );
    }

    // Validate each axis detail
    for (let i = 0; i < body.axisDetails.length; i++) {
      const err = validateAxisDetail(body.axisDetails[i], i);
      if (err) {
        return Response.json(
          { code: 'VALIDATION_ERROR', message: err, details: [] },
          { status: 422 }
        );
      }
    }

    const axisDetailsInput: AxisDetailInput[] = body.axisDetails;

    const created = await prisma.careerReport.create({
      data: {
        isOutdated: false,
        axisDetails: {
          create: axisDetailsInput.map((d) => ({
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
          })),
        },
      },
    });

    return Response.json(formatReport(created), { status: 201 });
  } catch (error) {
    console.error('Error creating career report:', error);
    return Response.json(
      { code: 'INTERNAL_ERROR', message: 'キャリアレポートの保存中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}

// GET /api/v1/career-reports
export async function GET(_request: Request): Promise<Response> {
  try {
    const reports = await prisma.careerReport.findMany();
    return Response.json(
      { items: reports.map(formatReport) },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching career reports:', error);
    return Response.json(
      { code: 'INTERNAL_ERROR', message: 'キャリアレポート一覧の取得中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}
