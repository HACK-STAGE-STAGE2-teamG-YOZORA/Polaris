import { prisma } from '@/lib/prisma';
import { internalError, problem } from '@/server/api';
import { formatSession } from '@/server/formatters';
import { requireAuth } from '@/server/auth/require-auth';

export async function GET(request: Request, context: { params: Promise<{ sessionId: string }> }): Promise<Response> {
  try {
    const auth = await requireAuth(request);
    if ('response' in auth) return auth.response;
    const { sessionId } = await context.params;
    const session = await prisma.analysisSession.findFirst({ where: { id: sessionId, userId: auth.userId } });
    if (!session) return problem(404, 'NOT_FOUND', '指定されたセッションがありません。');
    return Response.json(await formatSession(session));
  } catch (error) {
    return internalError(error, '自己分析セッションの取得');
  }
}
