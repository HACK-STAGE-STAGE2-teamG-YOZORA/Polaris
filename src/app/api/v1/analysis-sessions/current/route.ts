import { prisma } from '@/lib/prisma';
import { internalError } from '@/server/api';
import { formatSession } from '@/server/formatters';
import { requireAuth } from '@/server/auth/require-auth';

export async function GET(request: Request): Promise<Response> {
  try {
    const auth = await requireAuth(request);
    if ('response' in auth) return auth.response;
    const session = await prisma.analysisSession.findFirst({
      where: { userId: auth.userId, status: { in: ['ACTIVE', 'READY_TO_FINALIZE'] } },
      orderBy: { updatedAt: 'desc' },
    });
    return Response.json({ session: session ? await formatSession(session) : null });
  } catch (error) {
    return internalError(error, '進行中セッションの取得');
  }
}
