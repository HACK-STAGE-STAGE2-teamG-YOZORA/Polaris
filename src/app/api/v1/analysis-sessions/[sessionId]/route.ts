import { prisma } from '@/lib/prisma';
import { internalError, problem } from '@/server/api';
import { formatSession } from '@/server/formatters';

export async function GET(_request: Request, context: { params: Promise<{ sessionId: string }> }): Promise<Response> {
  try {
    const { sessionId } = await context.params;
    const session = await prisma.analysisSession.findUnique({ where: { id: sessionId } });
    if (!session) return problem(404, 'NOT_FOUND', '指定されたセッションがありません。');
    return Response.json(await formatSession(session));
  } catch (error) {
    return internalError(error, '自己分析セッションの取得');
  }
}
