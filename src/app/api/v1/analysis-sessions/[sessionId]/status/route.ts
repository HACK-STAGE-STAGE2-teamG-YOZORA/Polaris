import { prisma } from '../../../../../../lib/prisma.ts';
import type { UpdateAnalysisSessionStatusRequest } from '../../../../../../types/session.ts';
import type { AnalysisSessionStatus, SelfAnalysisAxis } from '../../../../../../types/dashboard.ts';

const VALID_STATUSES: AnalysisSessionStatus[] = ['ACTIVE', 'READY_TO_FINALIZE', 'COMPLETED', 'ABANDONED'];

export async function PATCH(
  request: Request,
  context: { params: Promise<{ sessionId: string }> | { sessionId: string } }
): Promise<Response> {
  try {
    const params = await context.params;
    const { sessionId } = params;

    // 1. セッションの存在確認
    const existingSession = await prisma.analysisSession.findUnique({
      where: { id: sessionId },
    });

    if (!existingSession) {
      return Response.json(
        { code: 'NOT_FOUND', message: '指定されたセッションが存在しません。' },
        { status: 404 }
      );
    }

    const body: UpdateAnalysisSessionStatusRequest = (await request.json()) as UpdateAnalysisSessionStatusRequest;

    if (!body.status || !VALID_STATUSES.includes(body.status as AnalysisSessionStatus)) {
      return Response.json(
        {
          code: 'VALIDATION_ERROR',
          message: `無効なステータスです。有効な値: ${VALID_STATUSES.join(', ')}`,
        },
        { status: 422 }
      );
    }

    const newStatus = body.status as AnalysisSessionStatus;
    const completedAt =
      newStatus === 'COMPLETED'
        ? new Date()
        : newStatus === 'ACTIVE' || newStatus === 'READY_TO_FINALIZE'
        ? null
        : existingSession.completedAt;

    // 2. セッションのステータス更新
    const updatedSession = await prisma.analysisSession.update({
      where: { id: sessionId },
      data: {
        status: newStatus,
        title: body.title || existingSession.title,
        completedAt,
      },
    });

    const targetAxes = (updatedSession.targetAxes as SelfAnalysisAxis[]) || [];

    return Response.json(
      {
        id: updatedSession.id,
        title: updatedSession.title,
        status: updatedSession.status,
        targetAxes,
        createdAt: updatedSession.createdAt instanceof Date ? updatedSession.createdAt.toISOString() : new Date(updatedSession.createdAt).toISOString(),
        updatedAt: updatedSession.updatedAt instanceof Date ? updatedSession.updatedAt.toISOString() : new Date(updatedSession.updatedAt).toISOString(),
        completedAt: updatedSession.completedAt
          ? (updatedSession.completedAt instanceof Date ? updatedSession.completedAt.toISOString() : new Date(updatedSession.completedAt).toISOString())
          : null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating session status:', error);
    return Response.json(
      { code: 'INTERNAL_ERROR', message: 'ステータス更新中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}
