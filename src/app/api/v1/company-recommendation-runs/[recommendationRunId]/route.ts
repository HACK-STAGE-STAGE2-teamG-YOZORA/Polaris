import { prisma } from '@/lib/prisma';
import { internalError, problem } from '@/server/api';
import { formatRecommendationRun, recommendationRunInclude } from '@/server/recommendation';
import { requireAuth } from '@/server/auth/require-auth';

type Context = { params: Promise<{ recommendationRunId: string }> };

export async function GET(request: Request, context: Context): Promise<Response> {
  try {
    const auth = await requireAuth(request);
    if ('response' in auth) return auth.response;
    const { recommendationRunId } = await context.params;
    const run = await prisma.recommendationRun.findFirst({
      where: { id: recommendationRunId, userId: auth.userId },
      include: recommendationRunInclude,
    });
    if (!run) return problem(404, 'NOT_FOUND', '指定された企業提案実行がありません。');
    return Response.json(formatRecommendationRun(run));
  } catch (error) {
    return internalError(error, '企業提案の取得');
  }
}
