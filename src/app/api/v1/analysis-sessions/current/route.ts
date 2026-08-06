import { prisma } from '@/lib/prisma';
import { internalError } from '@/server/api';
import { formatSession } from '@/server/formatters';

export async function GET(): Promise<Response> {
  try {
    const session = await prisma.analysisSession.findFirst({
      where: { status: { in: ['ACTIVE', 'READY_TO_FINALIZE'] } },
      orderBy: { updatedAt: 'desc' },
    });
    return Response.json({ session: session ? await formatSession(session) : null });
  } catch (error) {
    return internalError(error, '進行中セッションの取得');
  }
}
