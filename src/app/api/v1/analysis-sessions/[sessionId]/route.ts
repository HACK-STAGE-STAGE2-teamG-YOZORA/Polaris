import { prisma } from '../../../../../lib/prisma.js';
import type { SelfAnalysisAxis } from '../../../../../types/dashboard.js';
export { PATCH } from './status/route.js';

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> | { sessionId: string } }
): Promise<Response> {
  try {
    const params = await context.params;
    const { sessionId } = params;

    const session = await prisma.analysisSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return Response.json(
        { code: 'NOT_FOUND', message: '指定されたセッションが存在しません。' },
        { status: 404 }
      );
    }

    const targetAxes = (session.targetAxes as SelfAnalysisAxis[]) || [];

    return Response.json(
      {
        id: session.id,
        title: session.title,
        status: session.status,
        targetAxes,
        createdAt: session.createdAt instanceof Date ? session.createdAt.toISOString() : new Date(session.createdAt).toISOString(),
        updatedAt: session.updatedAt instanceof Date ? session.updatedAt.toISOString() : new Date(session.updatedAt).toISOString(),
        completedAt: session.completedAt
          ? (session.completedAt instanceof Date ? session.completedAt.toISOString() : new Date(session.completedAt).toISOString())
          : null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching session:', error);
    return Response.json(
      { code: 'INTERNAL_ERROR', message: 'セッション取得中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}
