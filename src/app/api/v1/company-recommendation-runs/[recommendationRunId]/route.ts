import { prisma } from '@/lib/prisma';
import { internalError, problem } from '@/server/api';
import { formatRecommendationRun, recommendationRunInclude } from '@/server/recommendation';

type Context = { params: Promise<{ recommendationRunId: string }> };

export async function GET(_request: Request, context: Context): Promise<Response> {
  try {
    const { recommendationRunId } = await context.params;
    const run = await prisma.recommendationRun.findUnique({
      where: { id: recommendationRunId },
      include: recommendationRunInclude,
    });
    if (!run) return problem(404, 'NOT_FOUND', '指定された企業提案実行がありません。');
    return Response.json(formatRecommendationRun(run));
  } catch (error) {
    return internalError(error, '企業提案の取得');
  }
}
