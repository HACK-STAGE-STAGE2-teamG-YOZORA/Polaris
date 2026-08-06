import { prisma } from '@/lib/prisma';
import { internalError, problem, SELF_ANALYSIS_AXES } from '@/server/api';
import { formatAxisAssessment } from '@/server/formatters';

const STATUSES = ['CONFIRMED_PATTERN', 'CURRENT_HYPOTHESIS', 'INSUFFICIENT_EVIDENCE'] as const;

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const axis = url.searchParams.get('axis');
    const sessionId = url.searchParams.get('sessionId');
    const status = url.searchParams.get('status');
    if (axis && !SELF_ANALYSIS_AXES.includes(axis as never)) return problem(422, 'VALIDATION_ERROR', 'axis が不正です。');
    if (status && !STATUSES.includes(status as never)) return problem(422, 'VALIDATION_ERROR', 'status が不正です。');
    const items = await prisma.axisAssessment.findMany({
      where: {
        ...(axis ? { axis: axis as never } : {}),
        ...(sessionId ? { sourceSessionId: sessionId } : {}),
        ...(status ? { status: status as never } : {}),
      },
      include: { evidenceLinks: { include: { evidence: true } } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
    return Response.json({ items: items.map(formatAxisAssessment) });
  } catch (error) {
    return internalError(error, '4軸分析一覧の取得');
  }
}
