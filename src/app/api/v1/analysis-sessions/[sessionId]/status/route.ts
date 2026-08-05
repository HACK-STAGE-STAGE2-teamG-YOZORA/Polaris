import { prisma } from '@/lib/prisma';
import type { UpdateAnalysisSessionStatusRequest } from '@/types/session';
import type { AnalysisSessionStatus, SelfAnalysisAxis } from '@/types/dashboard';

const VALID_STATUSES: AnalysisSessionStatus[] = [
  'ACTIVE',
  'READY_TO_FINALIZE',
  'ANALYZING',
  'COMPLETED',
  'FAILED',
  'ABANDONED',
];

// ステータス遷移の整合性検証テーブル
const ALLOWED_TRANSITIONS: Record<AnalysisSessionStatus, AnalysisSessionStatus[]> = {
  ACTIVE: ['READY_TO_FINALIZE', 'ANALYZING', 'ABANDONED'],
  READY_TO_FINALIZE: ['ACTIVE', 'ANALYZING', 'ABANDONED'],
  ANALYZING: ['COMPLETED', 'FAILED', 'ACTIVE'], // 失敗時はFAILEDまたは再開用のACTIVEへ戻せる
  COMPLETED: [], // 完了後は遷移不可
  FAILED: ['ACTIVE', 'ANALYZING', 'ABANDONED'], // 失敗からの再試行(ANALYZING)またはACTIVE復帰
  ABANDONED: ['ACTIVE'],
};

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

    const currentStatus = existingSession.status as AnalysisSessionStatus;
    const newStatus = body.status as AnalysisSessionStatus;

    // 同じステータスへの更新はスキップして正常返却
    if (currentStatus !== newStatus) {
      const allowedNextStatuses = ALLOWED_TRANSITIONS[currentStatus] || [];
      if (!allowedNextStatuses.includes(newStatus)) {
        return Response.json(
          {
            code: 'CONFLICT',
            message: `現在のステータス (${currentStatus}) から ${newStatus} への遷移は許可されていません。`,
          },
          { status: 409 }
        );
      }
    }

    // FAILED 遷移時のエラーログ出力処理
    if (newStatus === 'FAILED' && body.failureReason) {
      console.error(`[Session ${sessionId}] Status updated to FAILED. Reason: ${body.failureReason}`);
    }

    // completedAtの管理: COMPLETED遷移時は現在時刻、それ以外（再開等）でクリアまたは既存値保持
    const completedAt =
      newStatus === 'COMPLETED'
        ? new Date()
        : newStatus === 'ACTIVE' || newStatus === 'READY_TO_FINALIZE' || newStatus === 'ANALYZING'
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
